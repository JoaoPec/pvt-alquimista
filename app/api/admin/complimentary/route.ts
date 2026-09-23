import { apiOptions, apiResponse } from "@/lib/api";
import { createListToken, getBearerToken, isAdminToken } from "@/lib/auth";
import { ordenarNatural } from "@/lib/comprovante";
import { addComplimentary, listComplimentary, listSellers, removeComplimentary } from "@/lib/db";

export const runtime = "nodejs";

export function OPTIONS(request: Request) { return apiOptions(request); }

/** Agrupa as cortesias ativas por lista e já assina o link do comprovante de cada uma. */
function listasComToken() {
  const ativas = listComplimentary(false);
  const nomes = Array.from(new Set(ativas.map((c) => c.listName)));
  return nomes.sort((a, b) => a.localeCompare(b)).map((nome) => {
    const doGrupo = ativas.filter((c) => c.listName === nome);
    return {
      nome,
      dj: doGrupo.find((c) => c.sellerName)?.sellerName ?? null,
      total: doGrupo.length,
      entrados: doGrupo.filter((c) => c.checkedInAt).length,
      convidados: ordenarNatural(doGrupo, (c) => c.name).map((c) => ({ nome: c.name, entrou: Boolean(c.checkedInAt) })),
      token: createListToken(nome),
    };
  });
}

export function GET(request: Request) {
  try {
    if (!isAdminToken(getBearerToken(request))) return apiResponse(request, { error: "Acesso não autorizado." }, { status: 401 });
    return apiResponse(request, { complimentary: listComplimentary(true), sellers: listSellers(false), listas: listasComToken() });
  } catch { return apiResponse(request, { error: "Não foi possível carregar as cortesias." }, { status: 503 }); }
}

export async function POST(request: Request) {
  let body: { action?: "add" | "remove"; name?: string; listName?: string; note?: string; sellerId?: number | null; id?: number; reason?: string };
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
      return apiResponse(request, { removed: true, complimentary: listComplimentary(true), sellers: listSellers(false) });
    }
    if (!body.name?.trim()) return apiResponse(request, { error: "Informe o nome da cortesia." }, { status: 422 });
    try {
      const created = addComplimentary({ name: body.name, listName: body.listName, note: body.note, sellerId: body.sellerId ?? null });
      return apiResponse(request, { created, complimentary: listComplimentary(true), sellers: listSellers(false) }, { status: 201 });
    } catch (error) {
      if (error instanceof Error && (error.message === "DJ inválido." || error.message.startsWith("Este DJ já usou"))) {
        return apiResponse(request, { error: error.message }, { status: 422 });
      }
      throw error;
    }
  } catch { return apiResponse(request, { error: "Não foi possível salvar a cortesia." }, { status: 503 }); }
}
