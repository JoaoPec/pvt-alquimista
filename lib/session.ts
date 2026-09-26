/**
 * Sessão do admin e da portaria.
 *
 * Cada tela guarda o próprio token (chaves separadas), então entrar numa não
 * derruba a outra. O token já expira sozinho em 12h do lado do servidor, e a
 * tela confere com a API antes de confiar nele — se estiver vencido, cai no login.
 */
export type Area = "admin" | "portaria";

const chaveDe = (area: Area) => `alquimista.sessao.${area}`;

export function salvarToken(area: Area, token: string) {
  try { window.localStorage.setItem(chaveDe(area), token); } catch { /* aba anônima bloqueia */ }
}

export function lerToken(area: Area): string | null {
  try { return window.localStorage.getItem(chaveDe(area)); } catch { return null; }
}

export function limparToken(area: Area) {
  try { window.localStorage.removeItem(chaveDe(area)); } catch { /* ignora */ }
}
