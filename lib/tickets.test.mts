import { canAdd, changeTicket, clampToLimit, emptyCounts, guestsOf, type Counts, type TicketKind } from "./tickets.ts";

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

console.log("--- cenario do bug: link do DJ com 10 restantes, usuario clicando + varias vezes ---");
const dj = add(emptyCounts(), "social", 19, 10);
check("19 cliques em Social param em 10", dj.social, 10);
check("total de pessoas = 10", guestsOf(dj), 10);
check("nao cabe mais social", canAdd(dj, "social", 10), false);
check("nao cabe normal tambem", canAdd(dj, "normal", 10), false);

console.log("\n--- limite 3 ---");
check("4 cliques param em 3", add(emptyCounts(), "normal", 4, 3).normal, 3);

console.log("\n--- Combo 5 ocupa 5 lugares ---");
check("1 combo em limite 10 cabe", canAdd(emptyCounts(), "combo5", 10), true);
check("2 combos em limite 10 cabem (10 pessoas)", add(emptyCounts(), "combo5", 2, 10).combo5, 2);
check("3 combos em limite 10 -> so 2", add(emptyCounts(), "combo5", 3, 10).combo5, 2);
check("2 combos ocupam 10 pessoas", guestsOf(add(emptyCounts(), "combo5", 3, 10)), 10);
check("combo com 3 restantes NAO cabe", canAdd(emptyCounts(), "combo5", 3), false);
check("combo com 5 restantes cabe", canAdd(emptyCounts(), "combo5", 5), true);

console.log("\n--- mistura social + normal ---");
const mix = add(add(emptyCounts(), "social", 7, 10), "normal", 7, 10);
check("7 social + 3 normal = 10", mix, { social: 7, normal: 3, combo5: 0 });
check("total 10", guestsOf(mix), 10);

console.log("\n--- tirar ingresso sempre pode ---");
check("diminuir nao trava", changeTicket(mix, "social", -1, 10).social, 6);
check("nao fica negativo", changeTicket(emptyCounts(), "social", -1, 10).social, 0);

console.log("\n--- limite cai enquanto o cliente escolhe ---");
const cheio = add(emptyCounts(), "social", 10, 10);
check("limite 10 -> 4 encolhe para 4", guestsOf(clampToLimit(cheio, 4)), 4);
check("limite 10 -> 0 esvazia", guestsOf(clampToLimit(cheio, 0)), 0);
const combos = add(emptyCounts(), "combo5", 2, 10);
check("2 combos com limite 7 -> 1 combo", clampToLimit(combos, 7), { social: 0, normal: 0, combo5: 1 });
check("2 combos com limite 4 -> 0 combos", clampToLimit(combos, 4), { social: 0, normal: 0, combo5: 0 });

console.log("\n--- limite zero: link esgotado ---");
check("nada cabe", canAdd(emptyCounts(), "social", 0), false);
check("clicar nao adiciona", add(emptyCounts(), "social", 5, 0).social, 0);

console.log(`\n${fails === 0 ? "TODOS OS TESTES PASSARAM" : `${fails} TESTE(S) FALHARAM`}`);
process.exit(fails === 0 ? 0 : 1);
