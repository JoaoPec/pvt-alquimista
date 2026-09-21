"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { toDataURL } from "qrcode";

type Kind = "social" | "normal" | "combo5";
type Step = "select" | "payment" | "sent";
const pixKey = process.env.NEXT_PUBLIC_PIX_KEY ?? "";
const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
const api = (path: string) => `${apiBase}${path}`;
const labels: Record<Kind, string> = { social: "Social · 1 kg de alimento", normal: "Normal", combo5: "Combo 5 · 5 pessoas" };
const prices: Record<Kind, number> = { social: 20, normal: 25, combo5: 80 };
const perks: Record<Kind, string> = { social: "Solidário, valor reduzido", normal: "Entrada individual", combo5: "Melhor valor por pessoa" };

export function Checkout() {
  const [open, setOpen] = useState(false); const [step, setStep] = useState<Step>("select");
  const [counts, setCounts] = useState<Record<Kind, number>>({ social: 0, normal: 0, combo5: 0 });
  const [cooler, setCooler] = useState(false); const [names, setNames] = useState<string[]>([]);
  const [code, setCode] = useState(""); const [qr, setQr] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const totalGuests = counts.social + counts.normal + counts.combo5 * 5;
  const total = counts.social * 20 + counts.normal * 25 + counts.combo5 * 80 + (cooler ? 100 : 0);
  const kinds = useMemo(() => [...Array(counts.social).fill("social"), ...Array(counts.normal).fill("normal"), ...Array(counts.combo5 * 5).fill("combo5")] as Kind[], [counts]);
  useEffect(() => { if (open && pixKey) toDataURL(pixKey, { margin: 1, width: 320, color: { dark: "#0a283c", light: "#f5ecda" } }).then(setQr); }, [open]);
  useEffect(() => { setNames((all) => Array.from({ length: totalGuests }, (_, i) => all[i] ?? "")); if (totalGuests < 2) setCooler(false); }, [totalGuests]);
  const change = (kind: Kind, n: number) => setCounts((all) => ({ ...all, [kind]: Math.max(0, all[kind] + n) }));
  async function submitOrder(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!totalGuests || names.some((name) => !name.trim())) return setError("Informe todos os participantes."); const form = new FormData(event.currentTarget); setLoading(true); setError(""); try { const r = await fetch(api("/api/orders"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ buyerName: form.get("buyerName"), email: form.get("email"), whatsapp: form.get("whatsapp"), cooler, tickets: kinds.map((kind, i) => ({ kind, guestName: names[i] })) }) }); const data = await r.json(); if (!r.ok) throw new Error(data.error); setCode(data.code); setStep("payment"); } catch (e) { setError(e instanceof Error ? e.message : "Falha ao criar pedido."); } finally { setLoading(false); } }
  async function submitReceipt(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const receipt = new FormData(event.currentTarget).get("receipt"); if (!(receipt instanceof File)) return setError("Escolha o comprovante."); setLoading(true); setError(""); try { const body = new FormData(); body.set("receipt", receipt); const r = await fetch(api(`/api/orders/${code}/receipt`), { method: "POST", body }); const data = await r.json(); if (!r.ok) throw new Error(data.error); setStep("sent"); } catch (e) { setError(e instanceof Error ? e.message : "Falha ao enviar comprovante."); } finally { setLoading(false); } }
  return <><button className="ticket-action" onClick={() => { setOpen(true); setStep("select"); }}>Comprar ingresso <span>↗</span></button>{open && <div className="checkout-backdrop" role="dialog" aria-modal="true"><div className="checkout-shell alchemy-checkout"><button className="close" onClick={() => setOpen(false)} aria-label="Fechar">×</button>
    {step === "select" && <form onSubmit={submitOrder}><p className="kicker">INGRESSOS · LUA CHEIA</p><h2>Garanta antes de virar o lote.</h2><p className="checkout-ticket">Escolha o formato ideal e avance para o Pix. O Combo 5 sai por apenas R$ 16 por pessoa.</p><div className="ticket-picker">{(Object.keys(labels) as Kind[]).map((kind) => <article className={`picker-card${kind === "combo5" ? " featured" : ""}`} key={kind}><div><b>{labels[kind]}</b><p>{perks[kind]}</p><span className="price">R$ {prices[kind]}</span></div><div className="counter"><button className="btn btn-sm" type="button" aria-label={`Remover ${labels[kind]}`} onClick={() => change(kind, -1)}>−</button><b aria-live="polite">{counts[kind]}</b><button className="btn btn-sm" type="button" aria-label={`Adicionar ${labels[kind]}`} onClick={() => change(kind, 1)}>+</button></div></article>)}</div>
      {totalGuests === 0 && <p className="fineprint">Comece escolhendo pelo menos 1 ingresso acima. O botão de pagamento aparece automaticamente.</p>}
      {totalGuests > 0 && <><label>Comprador<input required name="buyerName" placeholder="Quem está comprando?" /></label><label>E-mail<input required type="email" name="email" placeholder="Para receber a confirmação" /></label><label>WhatsApp<input required name="whatsapp" placeholder="Para avisos do evento" /></label>{kinds.map((kind, i) => <label key={i}>{labels[kind]} · pessoa {i + 1}<input required value={names[i]} placeholder="Nome completo" onChange={(e) => setNames((all) => all.map((name, index) => index === i ? e.target.value : name))} /></label>)}{totalGuests >= 2 && <label className="cooler-toggle"><input type="checkbox" checked={cooler} onChange={(e) => setCooler(e.target.checked)} /> Adicionar cooler (+ R$ 100)</label>}<p className="checkout-ticket">Total <strong>R$ {total.toFixed(2).replace(".", ",")}</strong></p><button className="checkout-submit btn" disabled={loading}>{loading ? "Criando pedido…" : `Continuar · R$ ${total.toFixed(2).replace(".", ",")}`}</button></>}</form>}
    {step === "payment" && <form onSubmit={submitReceipt}><p className="kicker">PEDIDO {code}</p><h2>Pague via Pix.</h2>{qr && <img className="pix-qr" src={qr} alt="QR Code Pix" />}<div className="pix-key"><code>{pixKey}</code><button className="btn btn-sm" type="button" onClick={() => navigator.clipboard.writeText(pixKey)}>Copiar chave</button></div><label>Print do pagamento<input required name="receipt" type="file" accept="image/png,image/jpeg,image/webp" /></label><button className="checkout-submit btn" disabled={loading}>{loading ? "Enviando…" : "Enviar comprovante"}</button></form>}
    {step === "sent" && <><p className="kicker">COMPROVANTE ENVIADO</p><h2>Agora é com a alquimia.</h2><p className="checkout-ticket">Seu pedido {code} aguarda aprovação. Após aprovado, os nomes entram na lista da portaria.</p></>}{error && <p className="error">{error}</p>}</div></div>}</>;
}
