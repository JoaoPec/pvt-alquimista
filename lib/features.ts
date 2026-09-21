/**
 * Interruptores de funcionalidade do site.
 *
 * COOLER_ENABLED — adicional de cooler (+ R$ 100 a partir de 2 ingressos).
 * Desligado temporariamente a pedido da produção: a opção sai do site, mas
 * todo o código continua no lugar. Para voltar a oferecer, troque para `true`
 * e faça o deploy — nada mais precisa ser mexido.
 *
 * Pedidos antigos com cooler continuam aparecendo normalmente no admin e na
 * página do ingresso (é histórico, não é oferta).
 */
export const COOLER_ENABLED = false;
