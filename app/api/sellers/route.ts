import { apiOptions, apiResponse } from "@/lib/api";
import { getBearerToken, isAdminToken } from "@/lib/auth";
import { listSellers, upsertSeller } from "@/lib/db";

export const runtime = "nodejs";

export function OPTIONS(request: Request) { return apiOptions(request); }

export function GET(request: Request) {
  try { return apiResponse(request, { sellers: listSellers(true) }); }
  catch { return apiResponse(request, { error: "Vendedores ainda não configurados." }, { status: 503 }); }
}

export async function POST(request: Request) {
  try {
    if (!isAdminToken(getBearerToken(request))) return apiResponse(request, { error: "Acesso não autorizado." }, { status: 401 });
    const body = await request.json() as { name?: string; id?: number; active?: boolean };
    const seller = upsertSeller({ id: body.id, name: body.name ?? "", active: body.active });
    return apiResponse(request, { seller, sellers: listSellers(false) });
  } catch (error) {
    const message = error instanceof Error && error.message === "Nome do vendedor é obrigatório." ? error.message : "Não foi possível salvar o vendedor.";
    return apiResponse(request, { error: message }, { status: 503 });
  }
}
