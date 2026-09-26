"use client";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { toDataURL } from "qrcode";
import { apiFetch, authHeaders } from "@/lib/client-api";
import { lerToken, limparToken, salvarToken } from "@/lib/session";
import { PORTARIA_PRICE, TICKET_KINDS, TICKET_LABEL } from "@/lib/tickets";

type Guest = { id: number; name: string; kind: string; code: string; checkedInAt: string | null };
type Complimentary = { id: number; name: string; listName: string; note: string | null; checkedInAt: string | null };
type ScanGuest = { name: string; kind: string; checkedIn: boolean };
type ScanResult = { ok: boolean; message: string; code?: string; buyerName?: string; guests?: ScanGuest[] };
type Pendente = { code: string; buyerName: string; totalCents: number; pessoas: number; createdAt: string };
type Cobranca = { code: string; totalCents: number; pessoas: number; pixPayload: string | null };

type DetectedBarcode = { rawValue: string };
type BarcodeDetectorLike = { detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]> };
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const kindLabel: Record<string, string> = TICKET_LABEL;
const kindOrder = TICKET_KINDS;
const PRECO = PORTARIA_PRICE;
const brl = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

/** Aceita o QR do pedido ("ALQUIMISTA:ALQ-XXXX"), o QR da lista ("ALQUIMISTA-LISTA:..."), a URL do pedido ou o código solto. */
function parseScan(raw: string): { kind: "lista"; token: string } | { kind: "pedido"; code: string } | null {
  const value = raw.trim();
  const lista = value.match(/ALQUIMISTA-LISTA:(\S+)/i) ?? value.match(/\/comprovante\/(\S+)/i);
  if (lista) return { kind: "lista", token: lista[1] };
  const url = value.match(/\/pedido\/([A-Za-z0-9-]+)/);
  if (url) return { kind: "pedido", code: url[1].toUpperCase() };
  const code = value.replace(/^ALQUIMISTA:/i, "").trim().toUpperCase();
  return code ? { kind: "pedido", code } : null;
}

export default function PortariaPage() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [guests, setGuests] = useState<Guest[]>([]);
  const [complimentary, setComplimentary] = useState<Complimentary[]>([]);
  const [listas, setListas] = useState<Array<{ nome: string; total: number; entrados: number; token: string }>>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [scanning, setScanning] = useState(false);
  const [cameraBlocked, setCameraBlocked] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [pendente, setPendente] = useState<{ token: string; lista: string; total: number } | null>(null);
  const [busy, setBusy] = useState(false);
  // venda no balcão
  const [nomes, setNomes] = useState<string[]>([""]);
  const [cobranca, setCobranca] = useState<Cobranca | null>(null);
  const [qrVenda, setQrVenda] = useState("");
  const [aguardando, setAguardando] = useState<Pendente[]>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopRef = useRef(false);

  const load = async (t: string) => {
    const r = await apiFetch("/api/door", { headers: authHeaders(t) });
    const d = await r.json();
    if (!r.ok) throw Error(d.error);
    setGuests(d.guests ?? []);
    setComplimentary(d.complimentary ?? []);
    setListas(d.listas ?? []);
    const p = await apiFetch("/api/portaria", { headers: authHeaders(t) });
    const pd = await p.json();
    if (p.ok) setAguardando(pd.pendentes ?? []);
  };
  // Retoma a sessão guardada: fechar a aba não derruba mais o login.
  useEffect(() => {
    const salvo = lerToken("portaria");
    if (!salvo) return;
    load(salvo).then(() => setToken(salvo)).catch(() => limparToken("portaria"));
  }, []);

  const sair = () => { limparToken("portaria"); setToken(""); setPassword(""); };

  const login = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const r = await apiFetch("/api/portaria", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      salvarToken("portaria", d.token);
      setToken(d.token);
      setError("");
      await load(d.token);
    } catch (x) { setError(x instanceof Error ? x.message : "Falha ao entrar."); }
  };
  const checkGuest = async (id: number) => {
    try {
      await apiFetch("/api/door", { method: "POST", headers: authHeaders(token, true), body: JSON.stringify({ guestId: id }) });
      await load(token);
    } catch (x) { setError(x instanceof Error ? x.message : "Falha ao confirmar."); }
  };
  const checkComplimentary = async (id: number) => {
    try {
      await apiFetch("/api/door", { method: "POST", headers: authHeaders(token, true), body: JSON.stringify({ complimentaryId: id }) });
      await load(token);
    } catch (x) { setError(x instanceof Error ? x.message : "Falha ao confirmar."); }
  };
  const desfazer = async (corpo: Record<string, unknown>, rotulo: string) => {
    try {
      const r = await apiFetch("/api/door", { method: "POST", headers: authHeaders(token, true), body: JSON.stringify({ undo: true, ...corpo }) });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? "Não foi possível desfazer."); return; }
      setError("");
      setResult({ ok: true, message: `Entrada desfeita · ${rotulo}` });
      await load(token);
    } catch (x) { setError(x instanceof Error ? x.message : "Falha ao desfazer."); }
  };
  const desfazerGuest = (id: number) => desfazer({ guestId: id }, "participante liberado de novo");
  const desfazerComplimentary = (id: number) => desfazer({ complimentaryId: id }, "cortesia liberada de novo");

  // ---------- venda no balcão ----------
  const nomesValidos = nomes.map((n) => n.trim()).filter(Boolean);
  const totalVenda = nomesValidos.length * PRECO * 100;

  const cobrar = async () => {
    setError(""); setAviso("");
    if (nomesValidos.length === 0) { setError("Preencha o nome de quem vai entrar."); return; }
    setBusy(true);
    try {
      const r = await apiFetch("/api/portaria", { method: "POST", headers: authHeaders(token, true), body: JSON.stringify({ action: "cobrar", names: nomesValidos }) });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setCobranca({ code: d.code, totalCents: d.totalCents, pessoas: d.pessoas, pixPayload: d.pixPayload ?? null });
      if (d.pixPayload) {
        const url = await toDataURL(d.pixPayload, { margin: 1, width: 320, color: { dark: "#0a283c", light: "#f5ecda" } }).catch(() => "");
        setQrVenda(url);
      } else setQrVenda("");
      setNomes([""]);
      await load(token);
    } catch (x) { setError(x instanceof Error ? x.message : "Falha ao gerar a cobrança."); }
    finally { setBusy(false); }
  };

  const decidir = async (code: string, confirmar: boolean) => {
    setError(""); setAviso("");
    if (confirmar && !window.confirm(`Confirmar que o Pix de ${code} caiu?\n\nOs nomes entram na lista da portaria agora.`)) return;
    if (!confirmar && !window.confirm(`Cancelar a venda ${code}?`)) return;
    setBusy(true);
    try {
      const r = await apiFetch("/api/portaria", { method: "POST", headers: authHeaders(token, true), body: JSON.stringify({ action: confirmar ? "confirmar" : "cancelar", code }) });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setAviso(confirmar ? `Pagamento confirmado · ${code}. As entradas já estão na lista.` : `Venda ${code} cancelada.`);
      if (cobranca?.code === code) { setCobranca(null); setQrVenda(""); }
      await load(token);
      setTimeout(() => setAviso(""), 6000);
    } catch (x) { setError(x instanceof Error ? x.message : "Falha ao decidir a venda."); }
    finally { setBusy(false); }
  };

  const copiarPix = async () => {
    if (!cobranca?.pixPayload) return;
    try { await navigator.clipboard.writeText(cobranca.pixPayload); setAviso("Pix copiado."); }
    catch { setAviso("Não foi possível copiar. Selecione o código na tela."); }
    setTimeout(() => setAviso(""), 4000);
  };

  const stopCamera = useCallback(() => {
    stopRef.current = true;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const checkInCode = useCallback(async (raw: string) => {
    const scan = parseScan(raw);
    if (!scan) return;
    // Fecha a câmera assim que lê. Sem isto o modal ficava aberto por cima
    // e o resultado nunca aparecia — foi o que aconteceu na leitura acidental.
    stopCamera();
    setScanning(false);
    setBusy(true);
    try {
      const corpo = scan.kind === "lista" ? { listToken: scan.token } : { code: scan.code };
      if (scan.kind === "lista") {
        // Nao libera direto: confere a lista e pede confirmacao. Uma leitura
        // acidental nao pode marcar o grupo inteiro como entrado.
        const info = await apiFetch(`/api/comprovante/${encodeURIComponent(scan.token)}`).then((r) => r.json()).catch(() => null);
        if (!info?.comprovante) { setResult({ ok: false, message: "QR de lista inválido ou lista sem ingressos." }); return; }
        setResult(null);
        setPendente({ token: scan.token, lista: info.comprovante.lista, total: info.comprovante.total });
        return;
      }
      const r = await apiFetch("/api/door", { method: "POST", headers: authHeaders(token, true), body: JSON.stringify(corpo) });
      const d = await r.json();
      if (r.status === 409 && d.order) {
        setResult({ ok: false, message: d.error, code: d.order.code, buyerName: d.order.buyerName, guests: d.order.guests });
      } else if (!r.ok) {
        setResult({ ok: false, message: d.error ?? "Não foi possível confirmar." });
      } else {
        setResult({ ok: true, message: "Entrada confirmada", code: d.order.code, buyerName: d.order.buyerName, guests: d.order.guests });
        await load(token);
      }
    } catch (x) {
      setResult({ ok: false, message: x instanceof Error ? x.message : "Falha ao confirmar." });
    } finally { setBusy(false); }
  }, [token, stopCamera]);

  const closeScanner = useCallback(() => { stopCamera(); setScanning(false); }, [stopCamera]);

  /** Só depois de confirmar é que a lista inteira é liberada. */
  const confirmarLista = async () => {
    if (!pendente) return;
    setBusy(true);
    try {
      const r = await apiFetch("/api/door", { method: "POST", headers: authHeaders(token, true), body: JSON.stringify({ listToken: pendente.token }) });
      const d = await r.json();
      if (!r.ok) setResult({ ok: false, message: d.error ?? "Não foi possível liberar a lista." });
      else setResult({ ok: true, message: `Lista liberada · ${d.lista.entrados} de ${d.lista.total}`, code: d.lista.lista, guests: (d.lista.convidados as Array<{ nome: string; entrou: boolean }>).map((g) => ({ name: g.nome, kind: "cortesia", checkedIn: g.entrou })) });
      setPendente(null);
      await load(token);
    } catch (x) { setResult({ ok: false, message: x instanceof Error ? x.message : "Falha ao liberar." }); }
    finally { setBusy(false); }
  };

  const openScanner = useCallback(async () => {
    setError(""); setResult(null); setManualCode(""); setCameraBlocked(false);
    const ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
    if (!ctor) { setCameraBlocked(true); setScanning(true); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } } });
      streamRef.current = stream;
      stopRef.current = false;
      setScanning(true);
    } catch {
      setCameraBlocked(true);
      setScanning(true);
      setError("Não consegui abrir a câmera. Autorize o acesso ou digite o código do pedido.");
    }
  }, []);

  useEffect(() => {
    if (!scanning || cameraBlocked) return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    void video.play().catch(() => undefined);
    const ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
    if (!ctor) return;
    const detector = new ctor({ formats: ["qr_code"] });
    let timer: number | undefined;
    const tick = async () => {
      if (stopRef.current) return;
      try {
        const found = await detector.detect(video);
        if (found.length > 0) { stopCamera(); void checkInCode(found[0].rawValue); return; }
      } catch { /* frame ainda não pronto */ }
      timer = window.setTimeout(tick, 220);
    };
    timer = window.setTimeout(tick, 400);
    return () => { if (timer) window.clearTimeout(timer); };
  }, [scanning, cameraBlocked, stopCamera, checkInCode]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const search = norm(query);
  const match = (name: string) => !search || norm(name).includes(search);
  const visibleGuests = guests.filter((g) => match(g.name));
  const visibleComplimentary = complimentary.filter((c) => match(c.name));
  const lists = Array.from(new Set(visibleComplimentary.map((c) => c.listName))).sort((a, b) => a.localeCompare(b));
  const card = (name: string, meta: string, done: boolean, onCheck: () => void, onUndo: () => void, extra?: string) => (
    <article className="card" key={`${name}-${meta}`}>
      <b>{name}</b>
      <p>{meta}{extra ? ` · ${extra}` : ""}</p>
      {done
        ? <div className="entrada-feita"><span className="picked">entrada confirmada</span><button className="btn btn-sm" type="button" onClick={onUndo}>Desfazer</button></div>
        : <button className="btn" type="button" onClick={onCheck}>Confirmar entrada</button>}
    </article>
  );

  if (!token) return <main className="admin-page">
    <form className="card" onSubmit={login}>
      <p className="kicker">PVT ALQUIMISTA</p><h1>Portaria</h1>
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha da portaria" required />
      <button className="btn">Entrar</button>
      {error && <p className="error">{error}</p>}
    </form>
  </main>;

  return <main className="admin-page">
    <header className="admin-hero">
      <p className="kicker">LISTA APROVADA · PORTARIA</p>
      <h1>Portaria</h1>
      <p className="admin-hero-sub">{guests.filter((g) => !g.checkedInAt).length} ainda não entraram · {guests.filter((g) => g.checkedInAt).length} confirmados · {complimentary.length} cortesias
        <button className="sair" type="button" onClick={sair}>Sair</button>
      </p>
      <div className="scan-actions">
        <button className="btn scan-btn" type="button" onClick={openScanner}>Ler QR Code</button>
        <button className="btn btn-sm" type="button" onClick={() => void load(token)}>Atualizar lista</button>
      </div>
    </header>

    <section className="admin-body">
      {error && <p className="error">{error}</p>}
      {aviso && <p className="success">{aviso}</p>}

      <section className="balcao">
        <h2>Vender ingresso · {brl(PRECO * 100)}</h2>
        <p className="fineprint">Preencha o nome de cada pessoa. Gere o QR, receba o Pix e confirme — aí a entrada entra na lista.</p>

        {!cobranca && <>
          {nomes.map((n, i) => <div className="linha-ingresso" key={i}>
            <input value={n} onChange={(e) => setNomes((all) => all.map((x, j) => j === i ? e.target.value : x))} placeholder={`Nome de quem vai entrar${i > 0 ? ` (${i + 1})` : ""}`} />
            {nomes.length > 1 && <button className="btn btn-sm btn-danger" type="button" onClick={() => setNomes((all) => all.filter((_, j) => j !== i))} aria-label="Remover este nome">×</button>}
          </div>)}
          <button className="btn btn-sm" type="button" onClick={() => setNomes((all) => [...all, ""])}>+ Adicionar pessoa</button>
          <p className="checkout-ticket">Total <strong>{brl(totalVenda)}</strong> · {nomesValidos.length} {nomesValidos.length === 1 ? "ingresso" : "ingressos"}</p>
          <button className="btn" type="button" disabled={busy || nomesValidos.length === 0} onClick={cobrar}>{busy ? "Gerando…" : "Gerar QR do Pix"}</button>
        </>}

        {cobranca && <div className="cobranca">
          <b>{cobranca.code} · {brl(cobranca.totalCents)} · {cobranca.pessoas} {cobranca.pessoas === 1 ? "pessoa" : "pessoas"}</b>
          {qrVenda && <img className="pix-qr" src={qrVenda} alt="QR Code do Pix" />}
          {cobranca.pixPayload
            ? <div className="pix-key"><code>{cobranca.pixPayload}</code><button className="btn btn-sm" type="button" onClick={copiarPix}>Copiar Pix</button></div>
            : <p className="error">Pix não configurado na API. Use a chave do evento.</p>}
          <p className="fineprint">Só confirme depois de ver o pagamento cair.</p>
          <div className="ticket-actions">
            <button className="btn" type="button" disabled={busy} onClick={() => decidir(cobranca.code, true)}>Confirmar pagamento</button>
            <button className="btn btn-sm" type="button" disabled={busy} onClick={() => decidir(cobranca.code, false)}>Cancelar</button>
          </div>
        </div>}

        {aguardando.length > 0 && <div className="aguardando">
          <h3>Aguardando confirmação · {aguardando.length}</h3>
          {aguardando.map((p) => <div className="linha-pendente" key={p.code}>
            <span><strong>{p.buyerName}</strong> · {p.pessoas} {p.pessoas === 1 ? "pessoa" : "pessoas"} · {brl(p.totalCents)} <em>{p.code}</em></span>
            <span className="ticket-actions">
              <button className="btn btn-sm" type="button" disabled={busy} onClick={() => decidir(p.code, true)}>Confirmar</button>
              <button className="btn btn-sm btn-danger" type="button" disabled={busy} onClick={() => decidir(p.code, false)}>Cancelar</button>
            </span>
          </div>)}
        </div>}
      </section>

      {pendente && <article className="card scan-result aviso">
        <b>⚠ Liberar a lista inteira?</b>
        <p><strong>{pendente.lista}</strong> · {pendente.total} {pendente.total === 1 ? "ingresso" : "ingressos"}</p>
        <p>Isso marca todos como <strong>entrados</strong> de uma vez.</p>
        <div className="ticket-actions">
          <button className="btn" type="button" disabled={busy} onClick={confirmarLista}>{busy ? "Liberando…" : `Sim, liberar os ${pendente.total}`}</button>
          <button className="btn btn-sm" type="button" disabled={busy} onClick={() => setPendente(null)}>Cancelar</button>
        </div>
      </article>}
      {result && <article className={result.ok ? "card scan-result ok" : "card scan-result bad"}>
        <b>{result.ok ? "✓ " : "✕ "}{result.message}{result.code ? ` · ${result.code}` : ""}</b>
        {result.buyerName && <p>{result.buyerName}</p>}
        {result.guests?.map((g) => <p key={g.name}>{g.name} · {kindLabel[g.kind] ?? g.kind} · {g.checkedIn ? "entrou" : "liberado"}</p>)}
        <button className="btn btn-sm" type="button" onClick={() => setResult(null)}>Fechar</button>
      </article>}

      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar participante (ignora acentos)" />

      {kindOrder.map((kind) => {
        const group = visibleGuests.filter((g) => g.kind === kind);
        if (group.length === 0) return null;
        return <section key={kind}>
          <h2>{kindLabel[kind] ?? kind} · {group.length}</h2>
          {group.map((g) => card(g.name, kindLabel[g.kind] ?? g.kind, !!g.checkedInAt, () => checkGuest(g.id), () => desfazerGuest(g.id), g.code))}
        </section>;
      })}

      {lists.length > 0 && <section>
        <h2>Cortesias / Listas · {visibleComplimentary.length}</h2>
        {lists.map((list) => {
          const info = listas.find((l) => l.nome === list);
          const daLista = visibleComplimentary.filter((c) => c.listName === list);
          const entrados = daLista.filter((c) => c.checkedInAt).length;
          return <div key={list}>
            <h3>{list}</h3>
            {info && <div className="lista-acoes">
              <span className="fineprint">{entrados} de {daLista.length} entraram</span>
              {entrados > 0 && <button className="btn btn-sm" type="button" onClick={() => desfazer({ listToken: info.token }, "lista liberada de novo")}>Desfazer lista inteira</button>}
            </div>}
            {daLista.map((c) => card(c.name, list, !!c.checkedInAt, () => checkComplimentary(c.id), () => desfazerComplimentary(c.id), c.note ?? undefined))}
          </div>;
        })}
      </section>}

      {visibleGuests.length === 0 && visibleComplimentary.length === 0 && <p className="fineprint">Nenhum participante encontrado.</p>}
    </section>

    {scanning && <div className="checkout-backdrop"><div className="checkout-shell scan-shell">
      <button className="close" type="button" onClick={closeScanner} aria-label="Fechar">×</button>
      <p className="kicker">LEITOR DE QR CODE</p>
      <h2>Aponte para o QR do ingresso.</h2>
      {!cameraBlocked && <div className="scan-frame"><video ref={videoRef} playsInline muted /></div>}
      {cameraBlocked && <p className="fineprint">Leitura pela câmera indisponível neste navegador. Digite o código do pedido (ex: ALQ-D547EDEF) ou abra a página do ingresso e digite o código que aparece no topo.</p>}
      <form className="scan-manual" onSubmit={(e) => { e.preventDefault(); stopCamera(); setScanning(false); void checkInCode(manualCode); }}>
        <label>Código do pedido<input value={manualCode} onChange={(e) => setManualCode(e.target.value)} placeholder="ALQ-XXXXXXXX" /></label>
        <button className="btn" type="submit" disabled={busy || !manualCode.trim()}>{busy ? "Confirmando…" : "Confirmar entrada"}</button>
      </form>
    </div></div>}
  </main>;
}
