import type { Metadata } from "next";
import { brl, MENU } from "@/lib/menu";

export const metadata: Metadata = {
  title: { absolute: "Cardápio — PVT Alquimista" },
  description: "Cervejas, drinks e água no bar da PVT Alquimista, em Arembepe.",
};

const whatsapp = "https://chat.whatsapp.com/KKGTkftbQDt1iNMJRPq246";

export default function CardapioPage() {
  return <main className="menu-page">
    <header className="menu-hero">
      <a className="menu-back" href="/">← VOLTAR AO SITE</a>
      <p className="kicker">PVT ALQUIMISTA · LUA CHEIA · AREMBEPE</p>
      <h1>Cardápio</h1>
      <p className="menu-sub">26/09 · 22h → 27/09 · 12h · Dunas Mar · Aldeia Hippie</p>
    </header>

    <div className="menu-body">
      {MENU.map((group) => <section className="menu-group" key={group.title}>
        <div className="menu-group-head">
          <h2>{group.title}</h2>
          <span>{group.kicker}</span>
        </div>
        <ul className="menu-list">
          {group.items.map((item) => <li className="menu-item" key={item.name}>
            <span className="menu-name">{item.name}{item.note ? <small>{item.note}</small> : null}</span>
            <span className="menu-lead" aria-hidden="true" />
            <span className="menu-price">{brl(item.price)}</span>
          </li>)}
        </ul>
      </section>)}
    </div>

    <footer className="menu-foot">
      <p>Pagamento no bar em <strong>Pix ou dinheiro</strong>. Beba com moderação — a festa é longa.</p>
      <div className="menu-links">
        <a className="btn" href="/#ingressos">COMPRAR INGRESSO</a>
        <a className="btn btn-ghost" href={whatsapp} target="_blank" rel="noreferrer">GRUPO DO WHATSAPP</a>
      </div>
    </footer>
  </main>;
}
