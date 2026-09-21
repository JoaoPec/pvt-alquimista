import { apiOptions, apiResponse } from "@/lib/api";
import { getBearerToken, isAdminToken } from "@/lib/auth";
import { listSellers, setSellerActive, upsertSeller } from "@/lib/db";

export const runtime = "nodejs";

const knownErrors = new Set([
  "Nome do vendedor é obrigatório.",
  "Vendedor não encontrado.",
  "Esse link já está em uso por outro DJ.",
]);

export function OPTIONS(request: Request) { return apiOptions(request); }

export function GET(request: Request) {
  try { return apiResponse(request, { sellers: listSellers(false) }); }
  catch { return apiResponse(request, { error: "Vendedores ainda não configurados." }, { status: 503 }); }
}

export async function POST(request: Request) {
  let body: { action?: "delete" | "reactivate"; name?: string; id?: number; slug?: string; quota?: number; active?: boolean };
  try { body = await request.json(); } catch { return apiResponse(request, { error: "Dados inválidos." }, { status: 400 }); }
  try {
    if (!isAdminToken(getBearerToken(request))) return apiResponse(request, { error: "Acesso não autorizado." }, { status: 401 });

    if (body.action === "delete" || body.action === "reactivate") {
      if (!Number.isInteger(body.id)) return apiResponse(request, { error: "DJ inválido." }, { status: 422 });
      if (!setSellerActive(body.id as number, body.action === "reactivate")) return apiResponse(request, { error: "DJ não encontrado." }, { status: 404 });
      return apiResponse(request, { sellers: listSellers(false) });
    }

    const seller = upsertSeller({ id: body.id, name: body.name ?? "", slug: body.slug, quota: body.quota, active: body.active });
    return apiResponse(request, { seller, sellers: listSellers(false) }, { status: body.id ? 200 : 201 });
  } catch (error) {
    if (error instanceof Error && knownErrors.has(error.message)) return apiResponse(request, { error: error.message }, { status: 422 });
    return apiResponse(request, { error: "Não foi possível salvar o vendedor." }, { status: 503 });
  }
}
