/**
 * Regras de quantidade de ingressos — puras e testáveis.
 *
 * O limite (`limit`) é sempre em PESSOAS, não em linhas de compra:
 * 1 Combo 5 ocupa 5 lugares. No link de um DJ, `limit` é o que ainda resta
 * da cota dele; no site geral é um teto de segurança.
 */
export type TicketKind = "social" | "normal" | "combo5";
export type Counts = Record<TicketKind, number>;

/** Quantas pessoas cada unidade desse ingresso ocupa. */
export const TICKET_STEP: Record<TicketKind, number> = { social: 1, normal: 1, combo5: 5 };

export const emptyCounts = (): Counts => ({ social: 0, normal: 0, combo5: 0 });

/** Total de pessoas selecionadas. */
export function guestsOf(counts: Counts): number {
  return counts.social * TICKET_STEP.social + counts.normal * TICKET_STEP.normal + counts.combo5 * TICKET_STEP.combo5;
}

/** Cabe mais um desse tipo sem estourar o limite? */
export function canAdd(counts: Counts, kind: TicketKind, limit: number): boolean {
  return guestsOf(counts) + TICKET_STEP[kind] <= limit;
}

/** Soma (ou tira) um ingresso, nunca passando do limite. */
export function changeTicket(counts: Counts, kind: TicketKind, delta: number, limit: number): Counts {
  const step = TICKET_STEP[kind] * delta;
  if (delta > 0 && guestsOf(counts) + step > limit) return counts;
  return { ...counts, [kind]: Math.max(0, counts[kind] + delta) };
}

/**
 * Encolhe a seleção para caber no limite atual — usado quando o limite cai
 * (outra venda entrou no mesmo link) enquanto o cliente escolhia.
 */
export function clampToLimit(counts: Counts, limit: number): Counts {
  if (guestsOf(counts) <= limit) return counts;
  const next = emptyCounts();
  let left = limit;
  for (const kind of ["combo5", "social", "normal"] as TicketKind[]) {
    while (counts[kind] - next[kind] > 0 && TICKET_STEP[kind] <= left) {
      next[kind] += 1;
      left -= TICKET_STEP[kind];
    }
  }
  return next;
}
