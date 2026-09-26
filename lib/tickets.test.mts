/**
 * Testes das regras de ingressos.
 */
import {
  canAdd, changeTicket, clampToLimit, emptyCounts, guestsOf, kindsOf, precoDe, totalOf,
  validarIngressos, TICKET_KINDS, TICKET_PRICE, PORTARIA_PRICE, TICKET_STEP, type Counts, type TicketKind,
} from "./tickets.ts";

let fails = 0;
const check = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? "PASS" : "FALHA"}  ${name}${ok ? "" : `  -> obtido ${JSON.stringify(got)} / esperado ${JSON.stringify(want)}`}`);
};
const add = (counts: Counts, kind: TicketKind, times: number, limit: number) => {
  let c = counts;
  for (let i = 0; i < times; i++) c = changeTicket(c, kind, 1, limit);
  return c;
};
const so = (kind: TicketKind, n: number): Counts => ({ ...emptyCounts(), [kind]: n });

console.log("--- catalogo de ingressos ---");
check("5 tipos a venda", TICKET_KINDS, ["social", "normal", "combo2", "combo3", "combo5"]);
check("preco social 20", TICKET_PRICE.social, 20);
check("preco normal 25", TICKET_PRICE.normal, 25);
check("preco portaria 30", PORTARIA_PRICE, 30);
check("preco combo2 35", TICKET_PRICE.combo2, 35);
check("preco combo3 50", TICKET_PRICE.combo3, 50);
check("preco combo5 80", TICKET_PRICE.combo5, 80);

console.log("\n--- combos 2 e 3 ---");
check("combo2 ocupa 2 lugares", TICKET_STEP.combo2, 2);
check("combo3 ocupa 3 lugares", TICKET_STEP.combo3, 3);
check("combo2 com 1 restante NAO cabe", canAdd(emptyCounts(), "combo2", 1), false);
check("combo2 com 2 restantes cabe", canAdd(emptyCounts(), "combo2", 2), true);
check("combo3 com 2 restantes NAO cabe", canAdd(emptyCounts(), "combo3", 2), false);
check("combo3 com 3 restantes cabe", canAdd(emptyCounts(), "combo3", 3), true);
check("3 cliques em combo2 param em 2 (limite 5)", add(emptyCounts(), "combo2", 3, 5).combo2, 2);
check("2 combo3 ocupam 6 pessoas", guestsOf(so("combo3", 2)), 6);
check("1 combo2 = R$ 35", totalOf(so("combo2", 1)), 35);
check("1 combo3 = R$ 50", totalOf(so("combo3", 1)), 50);
check("combo2 com 1 nome: erro", validarIngressos([{ kind: "combo2", guestName: "A" }]), "Cada Combo 2 precisa ter 2 participantes.");
check("combo2 com 2 nomes: ok", validarIngressos([{ kind: "combo2", guestName: "A" }, { kind: "combo2", guestName: "B" }]), null);
check("combo3 com 3 nomes: ok", validarIngressos([{ kind: "combo3", guestName: "A" }, { kind: "combo3", guestName: "B" }, { kind: "combo3", guestName: "C" }]), null);

console.log("\n--- tipos ativos continuam certos ---");
check("1 social = R$ 20", totalOf(so("social", 1)), 20);
check("1 normal = R$ 25", totalOf(so("normal", 1)), 25);
check("1 combo5 = R$ 80", totalOf(so("combo5", 1)), 80);
check("social + normal + combo5 = R$ 125", totalOf({ ...emptyCounts(), social: 1, normal: 1, combo5: 1 }), 125);
check("social sozinho: ok", validarIngressos([{ kind: "social", guestName: "A" }]), null);
check("combo5 com 5 nomes: ok", validarIngressos(["A", "B", "C", "D", "E"].map((g) => ({ kind: "combo5", guestName: g }))), null);
check("combo5 com 4 nomes: erro", validarIngressos(["A", "B", "C", "D"].map((g) => ({ kind: "combo5", guestName: g }))), "Cada Combo 5 precisa ter 5 participantes.");
check("tipo desconhecido: erro", validarIngressos([{ kind: "vip", guestName: "A" }]), "Preencha o nome de cada participante.");
check("sem nome: erro", validarIngressos([{ kind: "normal", guestName: "  " }]), "Preencha o nome de cada participante.");
check("lista vazia: erro", validarIngressos([]), "Adicione pelo menos 1 ingresso.");

console.log("\n--- cenario do bug: link do DJ com 10 restantes ---");
const dj = add(emptyCounts(), "social", 19, 10);
check("19 cliques em Social param em 10", dj.social, 10);
check("total de pessoas = 10", guestsOf(dj), 10);
check("nao cabe mais social", canAdd(dj, "social", 10), false);
check("nao cabe normal tambem", canAdd(dj, "normal", 10), false);

console.log("\n--- Combo 5 ocupa 5 lugares ---");
check("2 combos em limite 10 cabem (10 pessoas)", add(emptyCounts(), "combo5", 2, 10).combo5, 2);
check("3 combos em limite 10 -> so 2", add(emptyCounts(), "combo5", 3, 10).combo5, 2);
check("combo com 3 restantes NAO cabe", canAdd(emptyCounts(), "combo5", 3), false);

console.log("\n--- mistura social + normal ---");
const mix = add(add(emptyCounts(), "social", 7, 10), "normal", 7, 10);
check("7 social + 3 normal = 10", mix, { social: 7, normal: 3, combo2: 0, combo3: 0, combo5: 0 });
check("total 10", guestsOf(mix), 10);

console.log("\n--- tirar ingresso sempre pode ---");
check("diminuir nao trava", changeTicket(mix, "social", -1, 10).social, 6);
check("nao fica negativo", changeTicket(emptyCounts(), "social", -1, 10).social, 0);

console.log("\n--- limite cai enquanto o cliente escolhe ---");
const cheio = add(emptyCounts(), "social", 10, 10);
check("limite 10 -> 4 encolhe para 4", guestsOf(clampToLimit(cheio, 4)), 4);
check("limite 10 -> 0 esvazia", guestsOf(clampToLimit(cheio, 0)), 0);
const combos = add(emptyCounts(), "combo5", 2, 10);
check("2 combo5 com limite 7 -> 1 combo", clampToLimit(combos, 7), { social: 0, normal: 0, combo2: 0, combo3: 0, combo5: 1 });
check("2 combo5 com limite 4 -> 0 combos", guestsOf(clampToLimit(combos, 4)), 0);

console.log("\n--- limite zero: link esgotado ---");
check("nada cabe", canAdd(emptyCounts(), "social", 0), false);
check("clicar nao adiciona", add(emptyCounts(), "social", 5, 0).social, 0);

console.log("\n--- nomes na ordem certa ---");
check("1 combo5 + 1 social = 6 pessoas", kindsOf({ ...emptyCounts(), combo5: 1, social: 1 }).length, 6);
check("combo5 vem antes de social", kindsOf({ ...emptyCounts(), combo5: 1, social: 1 }), ["social", "combo5", "combo5", "combo5", "combo5", "combo5"]);

console.log(`\n${fails === 0 ? "TODOS OS TESTES PASSARAM" : `${fails} TESTE(S) FALHARAM`}`);
process.exit(fails === 0 ? 0 : 1);
