"use client";

import { use, useEffect, useState } from "react";
import { toDataURL } from "qrcode";

const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
const api = (path: string) => `${apiBase}${path}`;
type Order = { code: string; buyerName: string; totalCents: number; cooler: boolean; status: string; proofType: string; sellerName: string | null; guests: { name: string; kind: string }[] };

export default function PedidoPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [qr, setQr] = useState("");
  useEffect(() => {
    fetch(api(`/api/orders/${code.toUpperCase()}`)).then((r) => r.json()).then((d) => {
      if (!d.order) { setError(d.error ?? "Pedido não encontrado."); return; }
      setOrder(d.order);
    }).catch(() => setError("Não foi possível carregar o pedido."));
  }, [code]);
  useEffect(() => {
    if (!order) return;
    toDataURL(`ALQUIMISTA:${order.code}`, { margin: 1, width: 360, color: { dark: "#0a283c", light: "#f5ecda" } }).then(setQr).catch(() => setQr(""));
  }, [order]);
  if (error) return <main className="admin-page"><p className="kicker">PVT ALQUIMISTA</p><h1>Pedido não encontrado</h1><p>{error}</p></main>;
  if (!order) return <main className="admin-page"><p className="kicker">PVT ALQUIMISTA</p><h1>Carregando pedido…</h1></main>;
  const statusLabel = order.status === "approved" ? "APROVADO · apresente este QR na portaria" : order.status === "rejected" ? "RECUSADO · fale com a produção" : "EM ANÁLISE · guarde este QR para a portaria";
  return <main className="admin-page ticket-page"><p className="kicker">MEU INGRESSO · {order.code}</p><h1>{order.buyerName}</h1><p className="ticket-status">{statusLabel}</p>
    {qr && <img className="ticket-qr" src={qr} alt={`QR do pedido ${order.code}`} />}
    <p className="checkout-ticket">Total R$ {(order.totalCents / 100).toFixed(2).replace(".", ",")} · {order.cooler ? "com cooler" : "sem cooler"}{order.sellerName ? ` · vendedor ${order.sellerName}` : ""}</p>
    <section className="card"><b>Participantes ({order.guests.length})</b>{order.guests.map((g) => <p key={g.name}>{g.name} · {g.kind}</p>)}</section>
    <p className="fineprint">A portaria lê este QR e confirma sua entrada. Não precisa de login.</p></main>;
}
