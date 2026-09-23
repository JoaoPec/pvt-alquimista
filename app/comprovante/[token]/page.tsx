"use client";

import { use, useEffect, useState } from "react";
import { toDataURL } from "qrcode";
import { apiFetch } from "@/lib/client-api";
import { EVENTO, type Comprovante } from "@/lib/comprovante";

export default function ComprovantePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [dados, setDados] = useState<Comprovante | null>(null);
  const [error, setError] = useState("");
  const [qr, setQr] = useState("");

  useEffect(() => {
    apiFetch(`/api/comprovante/${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => { if (d.comprovante) setDados(d.comprovante); else setError(d.error ?? "Comprovante não encontrado."); })
      .catch(() => setError("Não foi possível carregar o comprovante."));
  }, [token]);

  useEffect(() => {
    if (!dados) return;
    toDataURL(`ALQUIMISTA-LISTA:${token}`, { margin: 1, width: 420, color: { dark: "#0a283c", light: "#f5ecda" } })
      .then(setQr).catch(() => setQr(""));
  }, [dados, token]);

  if (error) return <main className="admin-page"><p className="kicker">PVT ALQUIMISTA</p><h1>Comprovante indisponível</h1><p>{error}</p></main>;
  if (!dados) return <main className="admin-page"><p className="kicker">PVT ALQUIMISTA</p><h1>Carregando…</h1></main>;

  return <main className="comprovante-page">
    <header className="comprovante-hero">
      <p className="kicker">{EVENTO.nome}</p>
      <h1>Comprovante</h1>
      <p className="comprovante-sub">{EVENTO.quando} · {EVENTO.onde}</p>
    </header>

    <section className="comprovante-body">
      <div className="comprovante-resumo">
        <span>INGRESSOS</span>
        <b>{dados.total}</b>
        <p>{dados.lista}{dados.dj ? ` · ${dados.dj}` : ""}</p>
      </div>

      {qr && <div className="comprovante-qr">
        <img src={qr} alt="QR Code do comprovante" />
        <p>Apresente este QR na portaria para liberar o grupo.</p>
      </div>}

      <div className="comprovante-lista">
        <h2>Nomes ({dados.convidados.length})</h2>
        <ol>{dados.convidados.map((g, i) => <li key={`${g.nome}-${i}`}>{g.nome}{g.entrou ? <em> · entrou</em> : null}</li>)}</ol>
      </div>

      <p className="fineprint">Para guardar em PDF, use Imprimir (Ctrl+P) e escolha "Salvar como PDF".</p>
    </section>
  </main>;
}
