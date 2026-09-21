import { Checkout } from "@/components/checkout";
import { Reveal } from "@/components/reveal";

const sounds = ["PSYTECH", "PROGRESSIVE", "FULLON", "PSYTRANCE"];
const whatsapp = "https://chat.whatsapp.com/KKGTkftbQDt1iNMJRPq246";

export default function Home() {
  return (
    <main className="festival-page">
      <section className="hero" id="inicio">
        <nav className="nav" aria-label="Navegação principal">
          <a className="mark" href="#inicio" aria-label="PVT Alquimista"><img src="/images/alta-mark.jfif" alt="Símbolo PVT Alquimista" width={58} height={58} /></a>
          <div className="nav-links"><a href="#experiencias">A EXPERIÊNCIA</a><a href="#lineup">PROGRAMAÇÃO</a><a href="#local">LOCAL</a><a href={whatsapp} target="_blank" rel="noreferrer">GRUPO</a></div>
          <a className="nav-cta" href="#ingressos">COMPRAR INGRESSO <span>↗</span></a>
        </nav>
        <div className="hero-mosaic" aria-hidden="true"><div className="mosaic-main" /><div className="mosaic-stage" /><div className="mosaic-crowd" /></div><div className="hero-shade" />
        <div className="hero-copy"><p className="eyebrow">LUA CHEIA · AREMBEPE · 26—27 SET</p><h1>PVT ALQUIMISTA:<br /><em>VIVA A LUA CHEIA</em></h1><p className="hero-subtitle">Psytrance, natureza e conexão.<br />26 de setembro, 22h — 27 de setembro, 12h.</p><a className="hero-cta" href="#ingressos">GARANTA SEU LUGAR <span>↗</span></a></div>
        <div className="sun-seal" aria-hidden="true"><i /><i /><i /><i /><i /><b /></div>
      </section>

      <section className="tickets section" id="ingressos">
        <div className="ticket-heading"><p className="eyebrow">LUGARES LIMITADOS</p><h2>VENDA DE INGRESSOS</h2></div>
        <Reveal className="ticket-layout"><article className="ticket-card cream"><p className="ticket-index">01 · PRIMEIRO LOTE</p><h3>LISTA<br />ALQUIMISTA</h3><p className="ticket-copy">Receba primeiro o acesso ao lote e todas as informações do ritual.</p><ul><li>Prioridade na abertura</li><li>Informações pelo WhatsApp</li><li>Novidades da experiência</li></ul><Checkout /></article><article className="ticket-card night"><p className="ticket-index">02 · LOTES</p><h3>EM<br />BREVE</h3><p className="ticket-copy">Os valores e formatos de ingresso serão divulgados no Instagram e no grupo oficial.</p><a className="ticket-action alt" href="https://www.instagram.com/alquimista.pvt/" target="_blank" rel="noreferrer">SEGUIR NO INSTAGRAM <span>↗</span></a><span className="pine" aria-hidden="true">⌁</span></article></Reveal>
        <div className="lineup-wrap" id="lineup"><h2>LINE-UP</h2><div className="sound-list">{sounds.map((sound, index) => <span key={sound}><b>0{index + 1}</b>{sound}</span>)}</div></div>
        <aside className="experiences" id="experiencias"><h2>EXPERIÊNCIAS</h2><div className="experience-row"><span className="experience beach">PRAIA</span><span className="experience moonlight">LUA CHEIA</span><span className="experience sound">SOM</span><span className="experience nature">NATUREZA</span></div></aside>
      </section>

      <section className="place section" id="local"><div className="place-art map-frame"><iframe title="Mapa do Dunas Mar, Arembepe" src="https://www.openstreetmap.org/export/embed.html?bbox=-38.1715%2C-12.7613%2C-38.1615%2C-12.7573&layer=mapnik&marker=-12.759258%2C-38.1665401" loading="lazy" referrerPolicy="no-referrer-when-downgrade" /><div className="map-label"><span>AREMBEPE</span><b>DUNAS MAR</b></div></div><Reveal className="place-copy"><p className="eyebrow ink">ONDE ACONTECE</p><h2>DUNAS MAR</h2><p>Aldeia Hippie, Arembepe.<br />De frente para o mar, cercada por natureza.</p><a href="https://maps.app.goo.gl/ZieKgh1qJgqvHhy58" target="_blank" rel="noreferrer">ABRIR NO GOOGLE MAPS <span>↗</span></a><a className="whatsapp-link" href={whatsapp} target="_blank" rel="noreferrer">ENTRAR NO GRUPO DO WHATSAPP <span>↗</span></a></Reveal></section>
      <footer><img src="/images/alta-mark.jfif" alt="PVT Alquimista" width={56} height={56} /><p>PVT ALQUIMISTA · 2026</p><a href="https://www.instagram.com/alquimista.pvt/" target="_blank" rel="noreferrer">@alquimista.pvt</a></footer><a className="mobile-dock" href={whatsapp} target="_blank" rel="noreferrer">GRUPO WHATSAPP <span>↗</span></a>
    </main>
  );
}
