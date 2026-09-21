"use client";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, authHeaders } from "@/lib/client-api";

type Guest = { id: number; name: string; kind: string; code: string; checkedInAt: string | null };
type Complimentary = { id: number; name: string; listName: string; note: string | null; checkedInAt: string | null };
type ScanGuest = { name: string; kind: string; checkedIn: boolean };
type ScanResult = { ok: boolean; message: string; code?: string; buyerName?: string; guests?: ScanGuest[] };

type DetectedBarcode = { rawValue: string };
type BarcodeDetectorLike = { detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]> };
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const kindLabel: Record<string, string> = { social: "Social", normal: "Normal", combo5: "Combo 5" };
const kindOrder = ["social", "normal", "combo5"];

/** Aceita "ALQUIMISTA:ALQ-XXXX", a URL da página do pedido ou só o código. */
function extractCode(raw: string) {
  const value = raw.trim();
  const url = value.match(/\/pedido\/([A-Za-z0-9-]+)/);
  if (url) return url[1].toUpperCase();
  return value.replace(/^ALQUIMISTA:/i, "").trim().toUpperCase();
}

export default function PortariaPage() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [guests, setGuests] = useState<Guest[]>([]);
  const [complimentary, setComplimentary] = useState<Complimentary[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [cameraBlocked, setCameraBlocked] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [busy, setBusy] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopRef = useRef(false);

  const load = async (t: string) => {
    const r = await apiFetch("/api/door", { headers: authHeaders(t) });
    const d = await r.json();
    if (!r.ok) throw Error(d.error);
    setGuests(d.guests ?? []);
    setComplimentary(d.complimentary ?? []);
  };
  const login = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const r = await apiFetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setToken(d.token);
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

  const stopCamera = useCallback(() => {
    stopRef.current = true;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const checkInCode = useCallback(async (raw: string) => {
    const code = extractCode(raw);
    if (!code) return;
    setBusy(true);
    try {
      const r = await apiFetch("/api/door", { method: "POST", headers: authHeaders(token, true), body: JSON.stringify({ code }) });
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
  }, [token]);

  const closeScanner = useCallback(() => { stopCamera(); setScanning(false); }, [stopCamera]);

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
  const card = (name: string, meta: string, done: boolean, onCheck: () => void, extra?: string) => (
    <article className="card" key={`${name}-${meta}`}>
      <b>{name}</b>
      <p>{meta}{extra ? ` · ${extra}` : ""}</p>
      <button className="btn" disabled={done} onClick={onCheck}>{done ? "Entrada confirmada" : "Confirmar entrada"}</button>
    </article>
  );

  if (!token) return <main className="admin-page">
    <form className="card" onSubmit={login}>
      <p className="kicker">PVT ALQUIMISTA</p><h1>Portaria</h1>
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha" required />
      <button className="btn">Entrar</button>
      {error && <p className="error">{error}</p>}
    </form>
  </main>;

  return <main className="admin-page">
    <header className="admin-hero">
      <p className="kicker">LISTA APROVADA · PORTARIA</p>
      <h1>Portaria</h1>
      <p className="admin-hero-sub">{guests.filter((g) => !g.checkedInAt).length} ainda não entraram · {guests.filter((g) => g.checkedInAt).length} confirmados · {complimentary.length} cortesias</p>
      <div className="scan-actions">
        <button className="btn scan-btn" type="button" onClick={openScanner}>Ler QR Code</button>
        <button className="btn btn-sm" type="button" onClick={() => void load(token)}>Atualizar lista</button>
      </div>
    </header>

    <section className="admin-body">
      {error && <p className="error">{error}</p>}
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
          {group.map((g) => card(g.name, kindLabel[g.kind] ?? g.kind, !!g.checkedInAt, () => checkGuest(g.id), g.code))}
        </section>;
      })}

      {lists.length > 0 && <section>
        <h2>Cortesias / Listas · {visibleComplimentary.length}</h2>
        {lists.map((list) => <div key={list}>
          <h3>{list}</h3>
          {visibleComplimentary.filter((c) => c.listName === list).map((c) => card(c.name, list, !!c.checkedInAt, () => checkComplimentary(c.id), c.note ?? undefined))}
        </div>)}
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
