/**
 * Sessão do admin/portaria.
 *
 * O token fica guardado no navegador para a sessão sobreviver quando a aba é
 * fechada. O token já expira sozinho em 12h do lado do servidor, e a tela
 * confere com a API antes de confiar nele — se estiver vencido, cai no login.
 */
const CHAVE = "alquimista.sessao";

export function salvarToken(token: string) {
  try { window.localStorage.setItem(CHAVE, token); } catch { /* aba anônima bloqueia */ }
}

export function lerToken(): string | null {
  try { return window.localStorage.getItem(CHAVE); } catch { return null; }
}

export function limparToken() {
  try { window.localStorage.removeItem(CHAVE); } catch { /* ignora */ }
}
