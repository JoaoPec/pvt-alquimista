/**
 * Interruptores de funcionalidade do site.
 *
 * COOLER_ENABLED — adicional de cooler, oferecido como extra opcional.
 * Não exige mais nenhuma combinação de ingressos: é só uma opção a mais.
 * Para tirar do ar, troque para `false` e faça o deploy — o card do site, o
 * seletor do checkout e a cobrança saem juntos.
 *
 * COOLER_PRICE — preço em reais. Fonte única da verdade: o site, o checkout e
 * a API leem daqui, então não tem como um cobrar diferente do outro.
 *
 * Pedidos antigos com cooler continuam aparecendo normalmente no admin e na
 * página do ingresso (é histórico, não é oferta).
 */
export const COOLER_ENABLED = true;
export const COOLER_PRICE = 50;
