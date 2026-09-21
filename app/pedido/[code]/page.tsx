"use client";

import { use, useEffect, useState } from "react";
import { toDataURL } from "qrcode";
import { apiFetch } from "@/lib/client-api";

type Order = { code: string; buyerName: string; totalCents: number; cooler: boolean; status: string; proofType: string; sellerName: string | null; guests: { name: string; kind: string }[] };

export default function PedidoPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [qr, setQr] = useState("");
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState("");

  useEffect(() => { setLink(`${window.location.origin}/pedido/${code.toUpperCase()}`); }, [code]);
  useEffect(() => {
    apiFetch(`/api/orders/${code.toUpperCase()}`).then((r) => r.json()).then((d) => {
      if (!d.order) { setError(d.error ?? "Pedido não encontrado."); return; }
      setOrder(d.order);
    }).catch(() => setError("Não foi possível carregar o pedido."));
  }, [code]);
  useEffect(() => {
    if (!order) return;
    toDataURL(`ALQUIMISTA:${order.code}`, { margin: 1, width: 360, color: { dark: "#0a283c", light: "#f5ecda" } }).then(setQr).catch(() => setQr(""));
  }, [order]);

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(link); setCopied("Link copiado!"); }
    catch { setCopied("Não foi possível copiar. Copie manualmente abaixo."); }
    setTimeout(() => setCopied(""), 3000);
  };
  const shareLink = async () => {
    if (navigator.share) { try { await navigator.share({ title: `Meu ingresso PVT Alquimista · ${order?.code ?? code}`, url: link }); } catch { /* cancelado */ } }
    else void copyLink();
  };

  if (error) return <main className="admin-page"><p className="kicker">PVT ALQUIMISTA</p><h1>Pedido não encontrado</h1><p>{error}</p></main>;
  if (!order) return <main className="admin-page"><p className="kicker">PVT ALQUIMISTA</p><h1>Carregando pedido…</h1></main>;
  const statusLabel = order.status === "approved" ? "APROVADO · apresente este QR na portaria" : order.status === "rejected" ? "RECUSADO · fale com a produção" : "EM ANÁLISE · guarde este QR para a portaria";
  return <main className="admin-page ticket-page"><p className="kicker">MEU INGRESSO · {order.code}</p><h1>{order.buyerName}</h1><p className="ticket-status">{statusLabel}</p>
    {qr && <img className="ticket-qr" src={qr} alt={`QR do pedido ${order.code}`} />}
    <p className="checkout-ticket">Total R$ {(order.totalCents / 100).toFixed(2).replace(".", ",")} · {order.cooler ? "com cooler" : "sem cooler"}{order.sellerName ? ` · vendedor ${order.sellerName}` : ""}</p>
    <section className="card">
      <b>Link desta página</b>
      <p className="fineprint">Salve ou mande no seu WhatsApp: é por aqui que você mostra o ingresso na portaria.</p>
      <div className="pix-key"><code>{link}</code>
        <button className="btn btn-sm" type="button" onClick={copyLink}>Copiar link</button>
      </div>
      <div className="ticket-actions">
        <button className="btn btn-sm" type="button" onClick={shareLink}>Compartilhar</button>
        <a className="btn btn-sm" href={`https://wa.me/?text=${encodeURIComponent(`Meu ingresso do PVT Alquimista (${order.code}): ${link}`)}`} target="_blank" rel="noopener noreferrer">Enviar no WhatsApp</a>
      </div>
      {copied && <p className="success">{copied}</p>}
    </section>
    <section className="card"><b>Participantes ({order.guests.length})</b>{order.guests.map((g) => <p key={g.name}>{g.name} · {g.kind}</p>)}</section>
    <p className="fineprint">A portaria lê este QR e confirma sua entrada. Não precisa de login.</p></main>;
}
