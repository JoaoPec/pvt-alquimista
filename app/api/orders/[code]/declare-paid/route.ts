import { apiOptions, apiResponse } from "@/lib/api";
import { declarePaid } from "@/lib/db";

export const runtime = "nodejs";

export function OPTIONS(request: Request) { return apiOptions(request); }

export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  let body: { confirm?: boolean };
  try { body = await request.json(); } catch { return apiResponse(request, { error: "Confirmação inválida." }, { status: 400 }); }
  if (body.confirm !== true) return apiResponse(request, { error: "Confirme que você já pagou." }, { status: 422 });
  try {
    const saved = declarePaid(code);
    if (!saved) return apiResponse(request, { error: "Pedido não encontrado." }, { status: 404 });
    return apiResponse(request, { status: "pending_approval" });
  } catch (error) {
    const message = error instanceof Error && error.message === "Pedido já aprovado." ? error.message : "Não foi possível confirmar o pagamento.";
    return apiResponse(request, { error: message }, { status: 503 });
  }
}
