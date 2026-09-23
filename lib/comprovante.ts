/**
 * Comprovante de uma lista de ingressos (ex: os 10 do Darlan).
 * O texto é montado aqui para o admin copiar e colar numa mensagem ou e-mail.
 */
export type Comprovante = {
  lista: string;
  dj: string | null;
  total: number;
  entrados?: number;
  convidados: { nome: string; entrou?: boolean }[];
};

export const EVENTO = {
  nome: "PVT ALQUIMISTA",
  quando: "26/09 · 22h → 27/09 · 12h",
  onde: "Dunas Mar · Aldeia Hippie, Arembepe",
};

export const linkComprovante = (token: string) => `https://pvt-alquimista.vercel.app/comprovante/${token}`;

/** Bloco pronto para colar numa mensagem ou e-mail. */
export function comprovanteTexto(c: Comprovante, link: string) {
  const nomes = c.convidados.map((g, i) => `${String(i + 1).padStart(2, "0")}. ${g.nome}`).join("\n");
  return [
    `${EVENTO.nome} — COMPROVANTE DE INGRESSOS`,
    `${EVENTO.quando}`,
    `${EVENTO.onde}`,
    "",
    `Lista: ${c.lista}`,
    c.dj ? `Vendedor: ${c.dj}` : null,
    `Ingressos: ${c.total}`,
    "",
    "NOMES:",
    nomes,
    "",
    `Comprovante com QR Code: ${link}`,
    "Apresente o QR Code na portaria para liberar a entrada.",
  ].filter((l) => l !== null).join("\n");
}

/** Só os nomes, para quem quiser colar apenas a lista. */
export function comprovanteNomes(c: Comprovante) {
  return c.convidados.map((g) => g.nome).join("\n");
}
