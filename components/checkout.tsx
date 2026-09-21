"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { toDataURL } from "qrcode";
import { buildPixPayload } from "@/lib/pix";
import { COOLER_ENABLED, COOLER_PRICE } from "@/lib/features";
import { apiFetch, apiUrl } from "@/lib/client-api";
import { canAdd as canAddTicket, changeTicket, clampToLimit, emptyCounts, guestsOf, type Counts, type TicketKind } from "@/lib/tickets";

type Kind = TicketKind;
type Step = "select" | "payment" | "sent";
const pixKey = process.env.NEXT_PUBLIC_PIX_KEY ?? "";
const labels: Record<Kind, string> = { social: "Social · 1 kg de alimento", normal: "Normal", combo5: "Combo 5 · 5 pessoas" };
const prices: Record<Kind, number> = { social: 20, normal: 25, combo5: 80 };
const perks: Record<Kind, string> = { social: "Solidário, valor reduzido", normal: "Entrada individual", combo5: "Melhor valor por pessoa" };

export function Checkout({ djSlug, maxTickets, djName }: { djSlug?: string; maxTickets?: number; djName?: string } = {}) {
  const [open, setOpen] = useState(false); const [step, setStep] = useState<Step>("select");
  const [counts, setCounts] = useState<Counts>(emptyCounts());
  const [limit, setLimit] = useState(maxTickets ?? 20);
  const [cooler, setCooler] = useState(false);
  const [buyer, setBuyer] = useState(""); const [extraNames, setExtraNames] = useState<string[]>([]);
  const [receiptName, setReceiptName] = useState("");
  const [code, setCode] = useState(""); const [qr, setQr] = useState(""); const [pixPayload, setPixPayload] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const totalGuests = guestsOf(counts);
  const canAdd = (kind: Kind) => canAddTicket(counts, kind, limit);
  const atLimit = totalGuests >= limit;
  const total = counts.social * 20 + counts.normal * 25 + counts.combo5 * 80 + (cooler ? COOLER_PRICE : 0);
  const kinds = useMemo(() => [...Array(counts.social).fill("social"), ...Array(counts.normal).fill("normal"), ...Array(counts.combo5 * 5).fill("combo5")] as Kind[], [counts]);
  useEffect(() => {
    if (step !== "payment" || !pixKey) return;
    try {
      const payload = buildPixPayload({ key: pixKey, name: "PVT ALQUIMISTA", city: "AREMBEPE", amount: total, txid: code.replace(/[^A-Za-z0-9]/g, "") });
      setPixPayload(payload);
      toDataURL(payload, { margin: 1, width: 320, color: { dark: "#0a283c", light: "#f5ecda" } }).then(setQr).catch(() => setQr(""));
    } catch { setPixPayload(""); setQr(""); }
  }, [step, total, code]);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open, djSlug]);
  // Reconfere o limite real do link do DJ toda vez que o checkout abre.
  useEffect(() => {
    if (!open) return;
    if (!djSlug) { setLimit(maxTickets ?? 20); return; }
    let alive = true;
    apiFetch(`/api/dj/${encodeURIComponent(djSlug)}`)
      .then((r) => r.json())
      .then((d) => { if (alive && typeof d.dj?.remaining === "number") setLimit(Math.max(0, d.dj.remaining)); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [open, djSlug, maxTickets]);
  // Se o limite caiu (outra venda entrou), encolhe a seleção para caber.
  useEffect(() => { setCounts((all) => clampToLimit(all, limit)); }, [limit]);
  useEffect(() => { setExtraNames((all) => Array.from({ length: Math.max(0, totalGuests - 1) }, (_, i) => all[i] ?? "")); }, [totalGuests]);
  const change = (kind: Kind, n: number) => setCounts((all) => changeTicket(all, kind, n, limit));
  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!totalGuests) return setError("Escolha pelo menos 1 ingresso.");
    if (!buyer.trim()) return setError("Informe o nome do comprador (pessoa 1).");
    if (extraNames.some((name) => !name.trim())) return setError("Informe o nome de todos os participantes.");
    const form = new FormData(event.currentTarget); setLoading(true); setError("");
    const guestNames = [buyer.trim(), ...extraNames.map((n) => n.trim())];
    try {
      const r = await apiFetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ buyerName: buyer.trim(), email: form.get("email"), whatsapp: form.get("whatsapp"), cooler, djSlug: djSlug ?? null, tickets: kinds.map((kind, i) => ({ kind, guestName: guestNames[i] })) }) });
      const data = await r.json(); if (!r.ok) throw new Error(data.error); setCode(data.code); setStep("payment");
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao criar pedido."); } finally { setLoading(false); }
  }
  async function submitReceipt(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const receipt = new FormData(event.currentTarget).get("receipt"); if (!(receipt instanceof File)) return setError("Escolha o comprovante ou use o botão Já paguei."); setLoading(true); setError(""); try { const body = new FormData(); body.set("receipt", receipt); const r = await apiFetch(`/api/orders/${code}/receipt`, { method: "POST", body }); const data = await r.json(); if (!r.ok) throw new Error(data.error); window.location.href = `/pedido/${code}`; } catch (e) { setError(e instanceof Error ? e.message : "Falha ao enviar comprovante."); } finally { setLoading(false); } }
  async function declarePaid() { if (!window.confirm(`Confirmar que você já pagou R$ ${total.toFixed(2).replace(".", ",")} via Pix para o pedido ${code}?`)) return; setLoading(true); setError(""); try { const r = await apiFetch(`/api/orders/${code}/declare-paid`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: true }) }); const data = await r.json(); if (!r.ok) throw new Error(data.error); window.location.href = `/pedido/${code}`; } catch (e) { setError(e instanceof Error ? e.message : "Falha ao confirmar pagamento."); } finally { setLoading(false); } }
  return <><button className="ticket-action" onClick={() => { setOpen(true); setStep("select"); }}>Comprar ingresso <span>↗</span></button>{open && <div className="checkout-backdrop" role="dialog" aria-modal="true"><div className="checkout-shell alchemy-checkout"><button className="close" onClick={() => setOpen(false)} aria-label="Fechar">×</button>
    {step === "select" && <form onSubmit={submitOrder}><p className="kicker">INGRESSOS · LUA CHEIA</p><h2>Garanta antes de virar o lote.</h2><p className="checkout-ticket">Toque em <strong>adicionar</strong> para montar sua lista. O Combo 5 sai por apenas R$ 16 por pessoa.</p>
      <div className="ticket-picker">{(Object.keys(labels) as Kind[]).map((kind) => (
        <article className={`picker-card${kind === "combo5" ? " featured" : ""}${counts[kind] > 0 ? " active" : ""}${!canAdd(kind) && counts[kind] === 0 ? " sold-out" : ""}`} key={kind}>
          <div className="picker-info"><b>{labels[kind]}</b><p>{perks[kind]}</p><span className="price">R$ {prices[kind]}</span>{counts[kind] > 0 && <span className="picked">{counts[kind]} selecionado{counts[kind] > 1 ? "s" : ""}</span>}</div>
          {counts[kind] === 0
            ? <button className="btn add-btn" type="button" disabled={!canAdd(kind)} onClick={() => change(kind, 1)}>{canAdd(kind) ? "+ Adicionar" : "Limite atingido"}</button>
            : <div className="counter" role="group" aria-label={`Quantidade ${labels[kind]}`}><button className="btn step-btn" type="button" aria-label={`Remover um ${labels[kind]}`} onClick={() => change(kind, -1)}>−</button><b aria-live="polite">{counts[kind]}</b><button className="btn step-btn" type="button" aria-label={`Adicionar um ${labels[kind]}`} disabled={!canAdd(kind)} onClick={() => change(kind, 1)}>+</button></div>}
        </article>))}</div>
      {COOLER_ENABLED && <section className="extra-block">
        <p className="extra-kicker">EXTRA OPCIONAL · NÃO É INGRESSO</p>
        <article className={cooler ? "extra-card on" : "extra-card"}>
          <div className="extra-info">
            <b>Cooler</b>
            <p>Leve seu cooler com bebida e gelo. Pode adicionar junto com qualquer ingresso — não precisa de quantidade mínima.</p>
            <span className="price">R$ {COOLER_PRICE}</span>
            {cooler && <span className="picked">adicionado</span>}
          </div>
          {cooler
            ? <button className="btn extra-btn on" type="button" onClick={() => setCooler(false)}>− Remover cooler</button>
            : <button className="btn extra-btn" type="button" onClick={() => setCooler(true)}>+ Adicionar cooler</button>}
        </article>
      </section>}
      {djSlug && <p className={atLimit ? "quota-note full" : "quota-note"}>
        {atLimit
          ? <>Você já selecionou os <strong>{limit}</strong> ingressos disponíveis neste link{djName ? ` de ${djName}` : ""}.</>
          : <>Este link{djName ? ` de ${djName}` : ""} tem <strong>{limit}</strong> ingresso{limit > 1 ? "s" : ""} disponíve{limit > 1 ? "is" : "l"} · você escolheu <strong>{totalGuests}</strong>.</>}
      </p>}
      {totalGuests === 0 && !atLimit && <p className="fineprint">Comece tocando em <strong>+ Adicionar</strong> em pelo menos 1 formato acima.</p>}
      {totalGuests === 0 && atLimit && <p className="error">Este link não tem mais ingressos disponíveis.</p>}
      {totalGuests > 0 && <>
        <label>Pessoa 1 · Comprador<input required value={buyer} onChange={(e) => setBuyer(e.target.value)} placeholder="Seu nome completo (vale como ingresso 1)" /></label>
        <label>E-mail<input required type="email" name="email" placeholder="Para receber a confirmação" /></label>
        <label>WhatsApp<input required name="whatsapp" placeholder="Para avisos do evento" /></label>
        {kinds.slice(1).map((kind, i) => <label key={i}>Pessoa {i + 2} · {labels[kind]}<input required value={extraNames[i] ?? ""} placeholder="Nome completo" onChange={(e) => setExtraNames((all) => all.map((name, index) => index === i ? e.target.value : name))} /></label>)}
        {COOLER_ENABLED && cooler && <p className="extra-summary">Cooler incluído · + R$ {COOLER_PRICE},00</p>}
        <p className="checkout-ticket">Total <strong>R$ {total.toFixed(2).replace(".", ",")}</strong></p>
        <button className="checkout-submit btn" disabled={loading}>{loading ? "Criando pedido…" : `Continuar · R$ ${total.toFixed(2).replace(".", ",")}`}</button></>}
      </form>}
    {step === "payment" && <form onSubmit={submitReceipt}><p className="kicker">PEDIDO {code}</p><h2>Pague via Pix.</h2><p className="checkout-ticket">Total <strong>R$ {total.toFixed(2).replace(".", ",")}</strong> · o QR já vem com o valor exato.</p>{qr && <img className="pix-qr" src={qr} alt="QR Code Pix" />}<div className="pix-key"><code>{pixPayload || pixKey}</code><button className="btn btn-sm" type="button" onClick={() => navigator.clipboard.writeText(pixPayload || pixKey)}>Copiar Pix</button></div><span className="field-label">Print do pagamento</span><label className="receipt-drop" htmlFor="receipt-file"><span className="receipt-plus" aria-hidden="true">+</span><span className="receipt-text">{receiptName || "Tocar para anexar o print"}</span><span className="receipt-hint">JPG, PNG ou WEBP · até 5 MB</span></label><input id="receipt-file" className="receipt-input" name="receipt" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setReceiptName(e.target.files?.[0]?.name ?? "")} /><button className="checkout-submit btn" disabled={loading}>{loading ? "Enviando…" : "Enviar comprovante"}</button><button className="checkout-secondary" type="button" disabled={loading} onClick={declarePaid}>Já paguei <span>✓</span></button></form>}
    {step === "sent" && <><p className="kicker">COMPROVANTE ENVIADO</p><h2>Agora é com a alquimia.</h2><p className="checkout-ticket">Seu pedido {code} aguarda aprovação. Após aprovado, os nomes entram na lista da portaria.</p></>}{error && <p className="error">{error}</p>}</div></div>}</>;
}
