"use client";
import { FormEvent, useState } from "react";
import { apiFetch, authHeaders, apiUrl } from "@/lib/client-api";

type Guest = { id: number; name: string; kind: string; checkedInAt: string | null; removedAt: string | null; removedReason: string | null };
type Order = { code: string; buyerName: string; email: string; whatsapp: string; totalCents: number; cooler: boolean; status: string; receiptUploaded: boolean; sellerName: string | null; createdAt: string; guests: Guest[] };
type Audit = { id: number; createdAt: string; action: string; orderCode: string | null; guestName: string | null; detail: string | null };
type Receipt = { filename: string; contentType: string; dataBase64: string };
type Complimentary = { id: number; name: string; listName: string; note: string | null; sellerId: number | null; sellerName: string | null; checkedInAt: string | null; removedAt: string | null; removedReason: string | null };
type Stats = { byStatus: { status: string; orders: number; cents: number }[]; guests: { status: string; kind: string; count: number }[]; removed: number; checkedIn: number; bySeller: { seller: string; orders: number; cents: number; guests: number }[]; complimentary: { total: number; checkedIn: number } };
type Seller = { id: number; name: string; slug: string | null; quota: number; active: boolean; sold: number; given: number; used: number; remaining: number };
type Target = { kind: "guest" | "complimentary" | "seller"; id: number; name: string };
type Tab = "visao" | "djs" | "cortesias" | "pedidos" | "log";

const br = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
const statusLabel: Record<string, string> = {
  awaiting_receipt: "Aguardando comprovante",
  pending_approval: "Aguardando aprovação",
  approved: "Aprovado",
  rejected: "Recusado",
};

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [tab, setTab] = useState<Tab>("visao");
  const [orders, setOrders] = useState<Order[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [complimentary, setComplimentary] = useState<Complimentary[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [receipts, setReceipts] = useState<Record<string, Receipt>>({});
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState<Target | null>(null);
  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [newName, setNewName] = useState("");
  const [newList, setNewList] = useState("DJ");
  const [newNote, setNewNote] = useState("");
  const [newSellerId, setNewSellerId] = useState("");
  const [djName, setDjName] = useState("");
  const [djSlug, setDjSlug] = useState("");
  const [djQuota, setDjQuota] = useState("10");

  const load = async (t: string) => {
    const r = await apiFetch("/api/admin", { headers: authHeaders(t) });
    const d = await r.json();
    if (!r.ok) throw Error(d.error);
    setOrders(d.orders ?? []);
    setStats(d.stats ?? null);
    const a = await apiFetch("/api/admin/guests", { headers: authHeaders(t) });
    const ad = await a.json();
    if (a.ok) setAudit(ad.audit ?? []);
    const c = await apiFetch("/api/admin/complimentary", { headers: authHeaders(t) });
    const cd = await c.json();
    if (c.ok) { setComplimentary(cd.complimentary ?? []); setSellers(cd.sellers ?? []); }
  };

  const login = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const r = await apiFetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setToken(d.token);
      await load(d.token);
    } catch (x) { setError(x instanceof Error ? x.message : "Falha ao entrar."); }
  };

  const action = async (code: string, act: "approve" | "reject") => {
    try {
      await apiFetch("/api/admin", { method: "POST", headers: authHeaders(token, true), body: JSON.stringify({ code, action: act }) });
      await load(token);
    } catch (x) { setError(x instanceof Error ? x.message : "Falha na ação."); }
  };

  const view = async (code: string) => {
    if (receipts[code]) return;
    try {
      const r = await apiFetch(`/api/admin/receipts/${code}`, { headers: authHeaders(token) });
      const d = await r.json();
      if (r.ok) setReceipts((all) => ({ ...all, [code]: d }));
    } catch (x) { setError(x instanceof Error ? x.message : "Falha ao carregar comprovante."); }
  };

  const addDj = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const r = await apiFetch("/api/sellers", { method: "POST", headers: authHeaders(token, true), body: JSON.stringify({ name: djName, slug: djSlug, quota: Number(djQuota) || 10 }) });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setSellers(d.sellers ?? []);
      setDjName(""); setDjSlug(""); setDjQuota("10");
    } catch (x) { setError(x instanceof Error ? x.message : "Falha ao criar o link do DJ."); }
  };

  const addComplimentary = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const r = await apiFetch("/api/admin/complimentary", { method: "POST", headers: authHeaders(token, true), body: JSON.stringify({ action: "add", name: newName, listName: newList, note: newNote, sellerId: newSellerId ? Number(newSellerId) : null }) });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setComplimentary(d.complimentary ?? []);
      setSellers(d.sellers ?? []);
      setNewName(""); setNewNote("");
    } catch (x) { setError(x instanceof Error ? x.message : "Falha ao adicionar cortesia."); }
  };

  const askRemove = (target: Target) => { setRemoving(target); setReason(""); setConfirmText(""); };

  const doRemove = async () => {
    if (!removing || confirmText !== "REMOVER") return;
    try {
      const path = removing.kind === "guest" ? "/api/admin/guests" : removing.kind === "complimentary" ? "/api/admin/complimentary" : "/api/sellers";
      const body = removing.kind === "guest" ? { guestId: removing.id, reason }
        : removing.kind === "complimentary" ? { action: "remove", id: removing.id, reason }
        : { action: "delete", id: removing.id };
      const r = await apiFetch(path, { method: "POST", headers: authHeaders(token, true), body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      if (removing.kind === "seller") setSellers(d.sellers ?? []);
      setRemoving(null);
      await load(token);
    } catch (x) { setError(x instanceof Error ? x.message : "Falha ao remover."); }
  };

  const reactivateDj = async (id: number) => {
    try {
      const r = await apiFetch("/api/sellers", { method: "POST", headers: authHeaders(token, true), body: JSON.stringify({ action: "reactivate", id }) });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setSellers(d.sellers ?? []);
    } catch (x) { setError(x instanceof Error ? x.message : "Falha ao reativar."); }
  };

  const approvedByKind = (kind: string) => stats?.guests.find((g) => g.status === "approved" && g.kind === kind)?.count ?? 0;
  const byStatus = (status: string) => stats?.byStatus.find((s) => s.status === status);
  const pending = byStatus("pending_approval")?.orders ?? 0;

  if (!token) {
    return <main className="admin-page">
      <form className="card" onSubmit={login}>
        <p className="kicker">PVT ALQUIMISTA</p>
        <h1>Administração</h1>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha" required />
        <button className="btn" type="submit">Entrar</button>
        {error && <p className="error">{error}</p>}
      </form>
    </main>;
  }

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: "visao", label: "Visão geral" },
    { id: "djs", label: "DJs e links", badge: sellers.length },
    { id: "cortesias", label: "Cortesias", badge: complimentary.filter((c) => !c.removedAt).length },
    { id: "pedidos", label: "Pedidos", badge: pending || undefined },
    { id: "log", label: "Auditoria", badge: audit.length },
  ];

  return <main className="admin-page">
    <header className="admin-hero">
      <p className="kicker">PVT ALQUIMISTA · ADMIN</p>
      <h1>Painel da produção</h1>
      <p className="admin-hero-sub">
        {byStatus("approved")?.orders ?? 0} aprovados · {pending} aguardando · {br(byStatus("approved")?.cents ?? 0)} confirmados
      </p>
      <nav className="admin-tabs" aria-label="Seções do painel">
        {tabs.map((item) => (
          <button key={item.id} type="button" className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}>
            {item.label}{item.badge ? <span className="tab-badge">{item.badge}</span> : null}
          </button>
        ))}
      </nav>
    </header>

    <section className="admin-body">
      {error && <p className="error">{error}</p>}

      {tab === "visao" && stats && <section className="stats-grid">
        <article className="card stat hero"><span>RECEITA APROVADA</span><b>{br(byStatus("approved")?.cents ?? 0)}</b><p>{byStatus("approved")?.orders ?? 0} pedidos aprovados</p></article>
        <article className="card stat"><span>INGRESSOS APROVADOS</span><b>{approvedByKind("social") + approvedByKind("normal") + approvedByKind("combo5")}</b><p>social {approvedByKind("social")} · normal {approvedByKind("normal")} · combo5 {approvedByKind("combo5")}</p></article>
        <article className="card stat"><span>CORTESIAS</span><b>{stats.complimentary.total}</b><p>{stats.complimentary.checkedIn} já entraram</p></article>
        <article className="card stat"><span>CHECK-IN NA PORTARIA</span><b>{stats.checkedIn}</b><p>entradas confirmadas</p></article>
        <article className="card stat"><span>AGUARDANDO APROVAÇÃO</span><b>{pending}</b><p>{br(byStatus("pending_approval")?.cents ?? 0)} em análise</p></article>
        <article className="card stat"><span>AGUARDANDO COMPROVANTE</span><b>{byStatus("awaiting_receipt")?.orders ?? 0}</b><p>{br(byStatus("awaiting_receipt")?.cents ?? 0)} sem envio</p></article>
        <article className="card stat"><span>REMOVIDOS (PRESERVADOS)</span><b>{stats.removed}</b><p>fora da portaria, com log</p></article>
        {stats.bySeller.length > 0 && <article className="card stat wide"><span>POR VENDEDOR (APROVADOS)</span>{stats.bySeller.map((s) => <p key={s.seller}>{s.seller} · {s.orders} pedidos · {s.guests} pessoas · {br(s.cents)}</p>)}</article>}
      </section>}

      {tab === "djs" && <>
        <form className="card" onSubmit={addDj}>
          <label>Nome do DJ<input value={djName} onChange={(e) => setDjName(e.target.value)} placeholder="Ex: DJ Alquimista" required /></label>
          <label>Link (opcional)<input value={djSlug} onChange={(e) => setDjSlug(e.target.value)} placeholder="deixe vazio para gerar do nome" /></label>
          <label>Limite total de ingressos<input value={djQuota} onChange={(e) => setDjQuota(e.target.value)} inputMode="numeric" placeholder="10" /></label>
          <button className="btn" type="submit">Criar link do DJ</button>
        </form>
        {sellers.length === 0 && <p className="fineprint">Nenhum DJ cadastrado ainda.</p>}
        {sellers.map((s) => {
          const link = typeof window !== "undefined" ? `${window.location.origin}/dj/${s.slug}` : `/dj/${s.slug}`;
          return <article className={s.active ? "card" : "card card-off"} key={s.id}>
            <b>{s.name}{s.active ? "" : " · link apagado"}</b>
            <p>Usou <strong>{s.used}</strong> de {s.quota} · {s.sold} vendidos pelo link · {s.given} cortesias · restam <strong>{s.remaining}</strong></p>
            {s.active
              ? <div className="pix-key"><code>{link}</code>
                <button className="btn btn-sm" type="button" onClick={() => navigator.clipboard.writeText(link)}>Copiar link</button>{" "}
                <button className="btn btn-sm" type="button" onClick={() => window.open(link, "_blank")}>Abrir</button>{" "}
                <button className="btn btn-sm btn-danger" type="button" onClick={() => askRemove({ kind: "seller", id: s.id, name: s.name })}>Apagar link</button>
              </div>
              : <div className="pix-key"><code>{link} (fora do ar)</code>
                <button className="btn btn-sm" type="button" onClick={() => reactivateDj(s.id)}>Reativar link</button>
              </div>}
          </article>;
        })}
      </>}

      {tab === "cortesias" && <>
        <form className="card" onSubmit={addComplimentary}>
          <label>Nome<input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome completo" required /></label>
          <label>Lista<input value={newList} onChange={(e) => setNewList(e.target.value)} placeholder="Ex: DJ, Produção, Imprensa" /></label>
          <label>Observação<input value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Opcional" /></label>
          <label>Descontar do limite de qual DJ?
            <select value={newSellerId} onChange={(e) => setNewSellerId(e.target.value)}>
              <option value="">Sem DJ (não desconta de ninguém)</option>
              {sellers.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name} · restam {s.remaining}</option>)}
            </select>
          </label>
          <button className="btn" type="submit">Adicionar cortesia</button>
        </form>
        {complimentary.length === 0 && <p className="fineprint">Nenhuma cortesia cadastrada ainda.</p>}
        {complimentary.map((c) => <article className="card" key={c.id}>
          <b>{c.name}</b>
          <p>{c.listName}{c.sellerName ? ` · ${c.sellerName}` : ""}{c.note ? ` · ${c.note}` : ""}{c.checkedInAt ? " · entrou" : ""}</p>
          {c.removedAt
            ? <p>removido: {c.removedReason}</p>
            : <button className="btn btn-sm" type="button" onClick={() => askRemove({ kind: "complimentary", id: c.id, name: c.name })}>Remover</button>}
        </article>)}
      </>}

      {tab === "pedidos" && <>
        {orders.length === 0 && <p className="fineprint">Nenhum pedido ainda.</p>}
        {orders.map((o) => <article className="card" key={o.code}>
          <b>{o.code} · {br(o.totalCents)}</b>
          <p>{o.buyerName} · {o.whatsapp} · {o.email}</p>
          {o.sellerName && <p>Vendedor: {o.sellerName}</p>}
          <p>{o.cooler ? "Com cooler" : "Sem cooler"} · {statusLabel[o.status] ?? o.status}</p>
          {o.guests.map((g) => <p key={g.id}>
            {g.removedAt ? `${g.name} (removido: ${g.removedReason})` : g.name} · {g.kind}{g.checkedInAt ? " · entrou" : ""}{" "}
            {!g.removedAt && <button className="btn btn-sm" type="button" onClick={() => askRemove({ kind: "guest", id: g.id, name: g.name })}>Remover</button>}
          </p>)}
          {o.receiptUploaded && <div>
            <button className="btn btn-sm" type="button" onClick={() => view(o.code)}>Ver comprovante</button>{" "}
            <button className="btn btn-sm" type="button" onClick={() => window.open(`${apiUrl(`/api/admin/receipts/${o.code}/download`)}?token=${encodeURIComponent(token)}`, "_blank")}>Baixar</button>
            {receipts[o.code] && <img src={`data:${receipts[o.code].contentType};base64,${receipts[o.code].dataBase64}`} alt={`Comprovante ${o.code}`} style={{ maxWidth: "100%", borderRadius: 8 }} />}
          </div>}
          {o.status === "pending_approval" && <div>
            <button className="btn" onClick={() => action(o.code, "approve")}>Aprovar</button>{" "}
            <button className="btn" onClick={() => action(o.code, "reject")}>Recusar</button>
          </div>}
        </article>)}
      </>}

      {tab === "log" && <>
        <p className="fineprint">Registro permanente: nada é apagado, nem o que foi removido.</p>
        {audit.length === 0 && <p className="fineprint">Sem movimentações registradas ainda.</p>}
        {audit.map((a) => <article className="card" key={a.id}>
          <b>#{a.id} · {a.action}</b>
          <p>{a.createdAt}</p>
          <p>{a.orderCode ?? "-"} · {a.guestName ?? "-"}{a.detail ? ` · ${a.detail}` : ""}</p>
        </article>)}
      </>}
    </section>

    {removing && <div className="checkout-backdrop"><div className="checkout-shell">
      {removing.kind === "seller" ? <>
        <h2>Apagar o link de {removing.name}?</h2>
        <p>O link sai do ar imediatamente e ninguém mais consegue comprar por ele. O DJ continua no histórico, com os pedidos e cortesias dele preservados. Você pode reativar depois.</p>
        <label>Confirmação<input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="REMOVER" /></label>
        <button className="btn btn-danger" disabled={confirmText !== "REMOVER"} onClick={doRemove}>Apagar link</button>{" "}
        <button className="btn" onClick={() => setRemoving(null)}>Cancelar</button>
      </> : <>
        <h2>Remover {removing.name}?</h2>
        <p>O nome sai da lista da portaria, mas o registro é preservado com motivo e log. Digite REMOVER para confirmar.</p>
        <label>Motivo<input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex: pagamento estornado" /></label>
        <label>Confirmação<input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="REMOVER" /></label>
        <button className="btn" disabled={confirmText !== "REMOVER" || !reason.trim()} onClick={doRemove}>Confirmar remoção</button>{" "}
        <button className="btn" onClick={() => setRemoving(null)}>Cancelar</button>
      </>}
    </div></div>}
  </main>;
}
