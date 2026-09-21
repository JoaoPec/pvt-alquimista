const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
export const apiUrl = (path: string) => `${apiBase}${path}`;

export class ApiUnavailable extends Error {
  constructor() { super("Servidor indisponível no momento. Tente novamente em alguns segundos."); this.name = "ApiUnavailable"; }
}

/**
 * Chamada à API com novas tentativas. O servidor reinicia por alguns segundos
 * a cada deploy; sem isso o navegador mostra erro de CORS/“Failed to fetch”.
 */
export async function apiFetch(path: string, init?: RequestInit, attempts = 3): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch(apiUrl(path), init);
      if (response.status >= 500 && response.status !== 503 && attempt < attempts - 1) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) await new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1)));
    }
  }
  console.error("apiFetch falhou", path, lastError);
  throw new ApiUnavailable();
}

export function authHeaders(token: string, json = false): HeadersInit {
  return json ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` } : { Authorization: `Bearer ${token}` };
}
