"use client";

import { use, useEffect, useState } from "react";
import { toDataURL } from "qrcode";
import { apiFetch } from "@/lib/client-api";
import { EVENTO, type Comprovante } from "@/lib/comprovante";

const AZUL = "#0a283c", AZUL_PROF = "#061e2d", PAPEL = "#f5ecda", AREIA = "#ddc79f", TINTA = "#092b43", MARROM = "#765633";

/** Retângulo com cantos arredondados, sem depender de ctx.roundRect. */
function caixa(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function carregarImagem(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

/**
 * Desenha o comprovante num canvas e baixa como PNG.
 * Feito à mão de propósito: sai exatamente o que interessa (sem os botões)
 * e sem depender de biblioteca externa.
 */
async function baixarImagem(dados: Comprovante, qr: string) {
  const W = 1080, PAD = 76;
  const nomes = dados.convidados;
  const alturaNomes = 92 + nomes.length * 52 + 40;
  const H = 300 + 40 + 210 + 40 + 520 + 60 + alturaNomes + 90;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  if (document.fonts?.ready) await document.fonts.ready.catch(() => undefined);

  const centrado = (txt: string, y: number) => ctx.fillText(txt, W / 2, y);

  // cabeçalho
  const g = ctx.createLinearGradient(0, 0, 0, 300);
  g.addColorStop(0, AZUL);
  g.addColorStop(1, AZUL_PROF);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, 300);

  ctx.textAlign = "center";
  ctx.fillStyle = AREIA;
  ctx.font = '700 20px "DM Mono", monospace';
  centrado(EVENTO.nome, 96);

  ctx.fillStyle = "#fff1d8";
  ctx.font = '600 82px "Playfair Display", serif';
  centrado("Comprovante", 190);

  ctx.fillStyle = "rgba(245,236,218,.82)";
  ctx.font = '26px "Space Grotesk", sans-serif';
  centrado(EVENTO.quando, 240);
  centrado(EVENTO.onde, 274);

  // corpo
  ctx.fillStyle = PAPEL;
  ctx.fillRect(0, 300, W, H - 300);

  // card de contagem
  let y = 300 + 40;
  const cardW = W - PAD * 2, cardX = PAD;
  ctx.fillStyle = "#fff9eb";
  caixa(ctx, cardX, y, cardW, 210, 26); ctx.fill();
  ctx.strokeStyle = "rgba(9,43,67,.18)"; ctx.lineWidth = 2; ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = MARROM;
  ctx.font = '700 19px "DM Mono", monospace';
  centrado("INGRESSOS", y + 58);

  ctx.fillStyle = TINTA;
  ctx.font = '600 96px "Playfair Display", serif';
  centrado(String(dados.total), y + 148);

  ctx.fillStyle = MARROM;
  ctx.font = '24px "Space Grotesk", sans-serif';
  centrado(dados.dj ? `${dados.lista} · ${dados.dj}` : dados.lista, y + 186);

  // QR
  y += 210 + 40;
  const qrLado = 440, qrX = (W - qrLado) / 2;
  ctx.fillStyle = "#fff9eb";
  caixa(ctx, qrX - 20, y, qrLado + 40, qrLado + 40, 28); ctx.fill();
  if (qr) {
    try {
      const img = await carregarImagem(qr);
      ctx.drawImage(img, qrX, y + 20, qrLado, qrLado);
    } catch { /* segue sem o QR */ }
  }
  y += qrLado + 40 + 46;
  ctx.fillStyle = "rgba(9,43,67,.72)";
  ctx.font = '24px "Space Grotesk", sans-serif';
  centrado("Apresente este QR na portaria para liberar o grupo.", y);

  // nomes
  y += 60;
  ctx.fillStyle = "#fff9eb";
  caixa(ctx, cardX, y, cardW, alturaNomes, 26); ctx.fill();
  ctx.strokeStyle = "rgba(9,43,67,.18)"; ctx.lineWidth = 2; ctx.stroke();

  ctx.textAlign = "left";
  ctx.fillStyle = MARROM;
  ctx.font = '700 19px "DM Mono", monospace';
  ctx.fillText(`NOMES (${nomes.length})`, cardX + 44, y + 62);

  nomes.forEach((g, i) => {
    const ny = y + 92 + i * 52 + 22;
    ctx.fillStyle = TINTA;
    ctx.font = '600 28px "Space Grotesk", sans-serif';
    ctx.fillText(`${String(i + 1).padStart(2, "0")}. ${g.nome}`, cardX + 44, ny);
    if (i < nomes.length - 1) {
      ctx.strokeStyle = "rgba(9,43,67,.12)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cardX + 44, ny + 18); ctx.lineTo(cardX + cardW - 44, ny + 18); ctx.stroke();
    }
  });

  // rodapé
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(9,43,67,.55)";
  ctx.font = '20px "DM Mono", monospace';
  centrado(`${EVENTO.nome} · ${EVENTO.quando}`, H - 46);

  // baixa o PNG
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
  if (!blob) throw new Error("sem imagem");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `comprovante-${dados.lista.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase()}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export default function ComprovantePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [dados, setDados] = useState<Comprovante | null>(null);
  const [error, setError] = useState("");
  const [qr, setQr] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    apiFetch(`/api/comprovante/${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => { if (d.comprovante) setDados(d.comprovante); else setError(d.error ?? "Comprovante não encontrado."); })
      .catch(() => setError("Não foi possível carregar o comprovante."));
  }, [token]);

  useEffect(() => {
    if (!dados) return;
    toDataURL(`ALQUIMISTA-LISTA:${token}`, { margin: 1, width: 520, color: { dark: "#0a283c", light: "#f5ecda" } })
      .then(setQr).catch(() => setQr(""));
  }, [dados, token]);

  const salvar = async () => {
    if (!dados) return;
    setSalvando(true); setAviso("");
    try {
      await baixarImagem(dados, qr);
      setAviso("Imagem salva na pasta de downloads.");
    } catch {
      setAviso("Não foi possível gerar a imagem neste navegador.");
    } finally {
      setSalvando(false);
      setTimeout(() => setAviso(""), 5000);
    }
  };

  const botao = (classe: string) => (
    <button className={classe} type="button" disabled={salvando || !dados} onClick={salvar}>
      {salvando ? "Gerando imagem…" : "Salvar comprovante"}
    </button>
  );

  if (error) return <main className="admin-page"><p className="kicker">PVT ALQUIMISTA</p><h1>Comprovante indisponível</h1><p>{error}</p></main>;
  if (!dados) return <main className="admin-page"><p className="kicker">PVT ALQUIMISTA</p><h1>Carregando…</h1></main>;

  return <main className="comprovante-page">
    <header className="comprovante-hero">
      <p className="kicker">{EVENTO.nome}</p>
      <h1>Comprovante</h1>
      <p className="comprovante-sub">{EVENTO.quando} · {EVENTO.onde}</p>
      {botao("comprovante-salvar topo")}
      {aviso && <p className="comprovante-aviso">{aviso}</p>}
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

      {botao("comprovante-salvar")}
      {aviso && <p className="comprovante-aviso">{aviso}</p>}
    </section>
  </main>;
}
