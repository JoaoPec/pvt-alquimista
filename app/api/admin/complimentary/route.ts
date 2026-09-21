import { apiOptions, apiResponse } from "@/lib/api";
import { getBearerToken, isAdminToken } from "@/lib/auth";
import { addComplimentary, listComplimentary, removeComplimentary } from "@/lib/db";

export const runtime = "nodejs";

export function OPTIONS(request: Request) { return apiOptions(request); }

export function GET(request: Request) {
  try {
    if (!isAdminToken(getBearerToken(request))) return apiResponse(request, { error: "Acesso não autorizado." }, { status: 401 });
    return apiResponse(request, { complimentary: listComplimentary(true) });
  } catch { return apiResponse(request, { error: "Não foi possível carregar as cortesias." }, { status: 503 }); }
}

export async function POST(request: Request) {
  let body: { action?: "add" | "remove"; name?: string; listName?: string; note?: string; id?: number; reason?: string };
  try { body = await request.json(); } catch { return apiResponse(request, { error: "Dados inválidos." }, { status: 400 }); }
  try {
    if (!isAdminToken(getBearerToken(request))) return apiResponse(request, { error: "Acesso não autorizado." }, { status: 401 });
    if (body.action === "remove") {
      if (!Number.isInteger(body.id)) return apiResponse(request, { error: "Cortesia inválida." }, { status: 422 });
      try {
        if (!removeComplimentary(body.id as number, body.reason ?? "")) return apiResponse(request, { error: "Cortesia não disponível." }, { status: 404 });
      } catch (error) {
        if (error instanceof Error && error.message === "Informe o motivo da remoção.") return apiResponse(request, { error: error.message }, { status: 422 });
        throw error;
      }
      return apiResponse(request, { removed: true, complimentary: listComplimentary(true) });
    }
    if (!body.name?.trim()) return apiResponse(request, { error: "Informe o nome da cortesia." }, { status: 422 });
    const created = addComplimentary({ name: body.name, listName: body.listName, note: body.note });
    return apiResponse(request, { created, complimentary: listComplimentary(true) }, { status: 201 });
  } catch { return apiResponse(request, { error: "Não foi possível salvar a cortesia." }, { status: 503 }); }
}
