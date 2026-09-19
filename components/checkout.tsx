"use client";

import { useState } from "react";

const WHATSAPP_GROUP = "https://chat.whatsapp.com/KKGTkftbQDt1iNMJRPq246";
const INSTAGRAM = "https://www.instagram.com/alquimista.pvt/";

export function Checkout() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="ticket-action" onClick={() => setOpen(true)}>
        Acompanhar pré-venda <span>↗</span>
      </button>
      {open && (
        <div className="checkout-backdrop" role="dialog" aria-modal="true" aria-labelledby="checkout-title">
          <div className="checkout-shell">
            <button className="close" aria-label="Fechar" onClick={() => setOpen(false)}>×</button>
            <p className="kicker">PVT ALQUIMISTA</p>
            <h2 id="checkout-title">A pré-venda será anunciada em breve.</h2>
            <p className="checkout-ticket">Entre no grupo oficial para receber primeiro os lotes, valores e instruções de compra.</p>
            <div className="checkout-links">
              <a className="checkout-submit" href={WHATSAPP_GROUP} target="_blank" rel="noreferrer">Entrar no grupo oficial <span>↗</span></a>
              <a className="checkout-secondary" href={INSTAGRAM} target="_blank" rel="noreferrer">Acompanhar no Instagram <span>↗</span></a>
            </div>
            <p className="fineprint">Nenhum dado é solicitado antes da abertura oficial das vendas.</p>
          </div>
        </div>
      )}
    </>
  );
}
