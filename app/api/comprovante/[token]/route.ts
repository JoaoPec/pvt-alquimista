import { apiOptions, apiResponse } from "@/lib/api";
import { readListToken } from "@/lib/auth";
import { ordenarNatural } from "@/lib/comprovante";
import { listComplimentary } from "@/lib/db";

export const runtime = "nodejs";

export function OPTIONS(request: Request) { return apiOptions(request); }

/**
 * Comprovante público de uma lista de ingressos (ex: os 10 do Darlan).
 * Só expõe o que já vai no papel: nome da lista, DJ e os nomes dos convidados.
 * Nada de telefone, e-mail ou qualquer dado de pagamento.
 */
export function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  return params.then(({ token }) => {
    const lista = readListToken(token);
    if (!lista) return apiResponse(request, { error: "Comprovante inválido ou expirado." }, { status: 404 });
    try {
      const convidados = ordenarNatural(listComplimentary(false).filter((c) => c.listName === lista), (c) => c.name);
      if (convidados.length === 0) return apiResponse(request, { error: "Esta lista não tem mais ingressos." }, { status: 404 });
      return apiResponse(request, {
        comprovante: {
          lista,
          dj: convidados.find((c) => c.sellerName)?.sellerName ?? null,
          total: convidados.length,
          entrados: convidados.filter((c) => c.checkedInAt).length,
          convidados: convidados.map((c) => ({ nome: c.name, entrou: Boolean(c.checkedInAt) })),
        },
      });
    } catch {
      return apiResponse(request, { error: "Comprovante indisponível agora." }, { status: 503 });
    }
  });
}
