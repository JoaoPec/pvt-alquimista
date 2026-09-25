/**
 * Fonte única dos ingressos: tipos, preços e quantas pessoas cada um ocupa.
 * Site, checkout, API e admin leem daqui — assim não tem como um cobrar
 * diferente do outro.
 *
 * O `limit` das funções abaixo é sempre em PESSOAS, não em linhas de compra:
 * 1 Combo 5 ocupa 5 lugares. No link de um DJ, `limit` é o que ainda resta
 * da cota dele; no site geral é um teto de segurança.
 */
export type TicketKind = "social" | "normal" | "combo2" | "combo3" | "combo5";
export type Counts = Record<TicketKind, number>;

/** Todos os tipos, na ordem em que aparecem no site. */
export const TICKET_KINDS: TicketKind[] = ["social", "normal", "combo2", "combo3", "combo5"];

/** Quantas pessoas cada unidade ocupa. */
export const TICKET_STEP: Record<TicketKind, number> = { social: 1, normal: 1, combo2: 2, combo3: 3, combo5: 5 };

/** Preço em reais. */
export const TICKET_PRICE: Record<TicketKind, number> = { social: 20, normal: 25, combo2: 35, combo3: 50, combo5: 80 };

/** Nome curto, para listas e portaria. */
export const TICKET_LABEL: Record<TicketKind, string> = {
  social: "Social", normal: "Normal", combo2: "Combo 2", combo3: "Combo 3", combo5: "Combo 5",
};

/** Nome completo, para o checkout. */
export const TICKET_LONG: Record<TicketKind, string> = {
  social: "Social · 1 kg de alimento",
  normal: "Normal",
  combo2: "Combo 2 · 2 pessoas",
  combo3: "Combo 3 · 3 pessoas",
  combo5: "Combo 5 · 5 pessoas",
};

export const TICKET_PERK: Record<TicketKind, string> = {
  social: "Solidário, valor reduzido",
  normal: "Entrada individual",
  combo2: "Dupla, sai mais barato",
  combo3: "Turma pequena, bom preço",
  combo5: "Melhor valor por pessoa",
};

export const isCombo = (kind: TicketKind) => TICKET_STEP[kind] > 1;

export const emptyCounts = (): Counts => ({ social: 0, normal: 0, combo2: 0, combo3: 0, combo5: 0 });

/** Total de pessoas selecionadas. */
export function guestsOf(counts: Counts): number {
  return TICKET_KINDS.reduce((soma, kind) => soma + (counts[kind] ?? 0) * TICKET_STEP[kind], 0);
}

/** Valor total, em reais. */
export function totalOf(counts: Counts, cooler = false, precoCooler = 0): number {
  return TICKET_KINDS.reduce((soma, kind) => soma + (counts[kind] ?? 0) * TICKET_PRICE[kind], 0) + (cooler ? precoCooler : 0);
}

/** Cabe mais um desse tipo sem estourar o limite? */
export function canAdd(counts: Counts, kind: TicketKind, limit: number): boolean {
  return guestsOf(counts) + TICKET_STEP[kind] <= limit;
}

/** Soma (ou tira) um ingresso, nunca passando do limite. */
export function changeTicket(counts: Counts, kind: TicketKind, delta: number, limit: number): Counts {
  const passo = TICKET_STEP[kind] * delta;
  if (delta > 0 && guestsOf(counts) + passo > limit) return counts;
  return { ...counts, [kind]: Math.max(0, (counts[kind] ?? 0) + delta) };
}

/** Expande a seleção na lista de pessoas, na ordem em que os nomes são pedidos. */
export function kindsOf(counts: Counts): TicketKind[] {
  return TICKET_KINDS.flatMap((kind) => Array.from({ length: (counts[kind] ?? 0) * TICKET_STEP[kind] }, () => kind));
}

/**
 * Encolhe a seleção para caber no limite atual — usado quando o limite cai
 * (outra venda entrou no mesmo link) enquanto o cliente escolhia.
 * Combos maiores primeiro, para aproveitar melhor o espaço.
 */
export function clampToLimit(counts: Counts, limit: number): Counts {
  if (guestsOf(counts) <= limit) return counts;
  const next = emptyCounts();
  let sobra = limit;
  for (const kind of ["combo5", "combo3", "combo2", "social", "normal"] as TicketKind[]) {
    while ((counts[kind] ?? 0) - next[kind] > 0 && TICKET_STEP[kind] <= sobra) {
      next[kind] += 1;
      sobra -= TICKET_STEP[kind];
    }
  }
  return next;
}

/**
 * Valida uma lista de ingressos vinda de fora (checkout ou admin).
 * Devolve a mensagem de erro, ou null se estiver tudo certo.
 */
export function validarIngressos(tickets: Array<{ kind?: string; guestName?: string }>): string | null {
  if (tickets.length === 0) return "Adicione pelo menos 1 ingresso.";
  if (tickets.some((t) => !t.guestName?.trim() || !TICKET_KINDS.includes(t.kind as TicketKind))) {
    return "Preencha o nome de cada participante.";
  }
  for (const kind of TICKET_KINDS) {
    const n = tickets.filter((t) => t.kind === kind).length;
    if (n > 0 && n % TICKET_STEP[kind] !== 0) {
      return `Cada ${TICKET_LABEL[kind]} precisa ter ${TICKET_STEP[kind]} participantes.`;
    }
  }
  return null;
}

/** Preço total de uma lista de ingressos, em centavos. */
export function precoDe(tickets: Array<{ kind?: string }>, cooler: boolean, precoCoolerReais: number): number {
  let cents = 0;
  for (const kind of TICKET_KINDS) {
    const n = tickets.filter((t) => t.kind === kind).length;
    if (n === 0) continue;
    // Só conta combo completo: 2 ingressos de Combo 3 não viram "2/3 de combo".
    // (validarIngressos já barra combo incompleto antes de chegar aqui.)
    cents += Math.floor(n / TICKET_STEP[kind]) * TICKET_PRICE[kind] * 100;
  }
  if (cooler) cents += precoCoolerReais * 100;
  return Math.round(cents);
}
