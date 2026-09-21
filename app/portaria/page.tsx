"use client";
import { FormEvent, useState } from "react";
import { apiFetch, authHeaders } from "@/lib/client-api";

type Guest = { id: number; name: string; kind: string; code: string; checkedInAt: string | null };
type Complimentary = { id: number; name: string; listName: string; note: string | null; checkedInAt: string | null };
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const kindLabel: Record<string, string> = { social: "Social", normal: "Normal", combo5: "Combo 5" };
const kindOrder = ["social", "normal", "combo5"];

export default function PortariaPage() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [guests, setGuests] = useState<Guest[]>([]);
  const [complimentary, setComplimentary] = useState<Complimentary[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

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

  return <main className="admin-page">{!token ? (
    <form className="card" onSubmit={login}>
      <p className="kicker">PVT ALQUIMISTA</p><h1>Portaria</h1>
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha" required />
      <button className="btn">Entrar</button>
      {error && <p className="error">{error}</p>}
    </form>
  ) : (
    <section>
      <p className="kicker">LISTA APROVADA</p><h1>Portaria</h1>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar participante (ignora acentos)" />
      {error && <p className="error">{error}</p>}

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
  )}</main>;
}
