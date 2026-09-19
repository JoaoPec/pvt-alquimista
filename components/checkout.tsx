"use client";

import { FormEvent, useState } from "react";

type Ticket = "general" | "experience";

const tickets = {
  general: { label: "Ingresso geral", price: "R$ 350,00" },
  experience: { label: "Experiência +", price: "R$ 680,00" },
};

export function Checkout() {
  const [ticket, setTicket] = useState<Ticket>("general");
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticketType: ticket,
        name: form.get("name"),
        email: form.get("email"),
        whatsapp: form.get("whatsapp"),
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setStatus("error");
      setMessage(data.error || "Não foi possível iniciar seu pedido.");
      return;
    }
    setStatus("success");
    setMessage(`Pedido ${data.code} reservado. Em produção, redirecione agora para o checkout do gateway.`);
  }

  return (
    <>
      <button className="ticket-action" onClick={() => { setOpen(true); setStatus("idle"); }}>
        Comprar agora <span>↗</span>
      </button>
      {open && (
        <div className="checkout-backdrop" role="dialog" aria-modal="true" aria-labelledby="checkout-title">
          <div className="checkout-shell">
            <button className="close" aria-label="Fechar" onClick={() => setOpen(false)}>×</button>
            <p className="kicker">RESERVA DE INGRESSO</p>
            <h2 id="checkout-title">Seu lugar em ALTA.</h2>
            <p className="checkout-ticket">{tickets[ticket].label} · <strong>{tickets[ticket].price}</strong></p>
            <div className="ticket-tabs">
              {(Object.keys(tickets) as Ticket[]).map((key) => (
                <button key={key} onClick={() => setTicket(key)} className={ticket === key ? "selected" : ""}>{tickets[key].label}</button>
              ))}
            </div>
            {status === "success" ? (
              <div className="success"><b>Reserva registrada.</b><br />{message}</div>
            ) : (
              <form onSubmit={submit}>
                <label>Nome completo<input required name="name" placeholder="Como quer ser chamado?" /></label>
                <label>E-mail<input required type="email" name="email" placeholder="voce@email.com" /></label>
                <label>WhatsApp<input required name="whatsapp" placeholder="(71) 99999-9999" /></label>
                {status === "error" && <p className="error">{message}</p>}
                <button className="checkout-submit" disabled={status === "loading"}>{status === "loading" ? "Reservando..." : "Reservar ingresso"}<span>↗</span></button>
              </form>
            )}
            <p className="fineprint">Ao continuar, você receberá as próximas instruções no e-mail informado.</p>
          </div>
        </div>
      )}
    </>
  );
}
