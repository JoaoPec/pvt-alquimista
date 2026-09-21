import { apiOptions, apiResponse } from "@/lib/api";
import { getBearerToken, isAdminToken } from "@/lib/auth";
import { listAudit, removeGuest } from "@/lib/db";

export const runtime = "nodejs";

export function OPTIONS(request: Request) { return apiOptions(request); }

export function GET(request: Request) {
  try {
    if (!isAdminToken(getBearerToken(request))) return apiResponse(request, { error: "Acesso não autorizado." }, { status: 401 });
    return apiResponse(request, { audit: listAudit() });
  } catch { return apiResponse(request, { error: "Não foi possível carregar o log." }, { status: 503 }); }
}

export async function POST(request: Request) {
  let body: { guestId?: number; reason?: string };
  try { body = await request.json(); } catch { return apiResponse(request, { error: "Dados inválidos." }, { status: 400 }); }
  try {
    if (!isAdminToken(getBearerToken(request))) return apiResponse(request, { error: "Acesso não autorizado." }, { status: 401 });
    if (!Number.isInteger(body.guestId)) return apiResponse(request, { error: "Participante inválido." }, { status: 422 });
    try {
      if (!removeGuest(body.guestId as number, body.reason ?? "")) return apiResponse(request, { error: "Participante não disponível." }, { status: 404 });
    } catch (error) {
      if (error instanceof Error && error.message === "Informe o motivo da remoção.") return apiResponse(request, { error: error.message }, { status: 422 });
      throw error;
    }
    return apiResponse(request, { removed: true });
  } catch { return apiResponse(request, { error: "Não foi possível remover." }, { status: 503 }); }
}
