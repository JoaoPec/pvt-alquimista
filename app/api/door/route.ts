import { apiOptions, apiResponse } from "@/lib/api";
import { getBearerToken, isAdminToken, readListToken } from "@/lib/auth";
import { approvedGuests, checkInComplimentary, checkInGuest, checkInList, checkInOrder, listComplimentary } from "@/lib/db";
export const runtime = "nodejs";
export function OPTIONS(request: Request) { return apiOptions(request); }
export function GET(request: Request) {
  try {
    if (!isAdminToken(getBearerToken(request))) return apiResponse(request, { error: "Acesso não autorizado." }, { status: 401 });
    return apiResponse(request, { guests: approvedGuests(), complimentary: listComplimentary(false) });
  } catch { return apiResponse(request, { error: "Portaria ainda não configurada." }, { status: 503 }); }
}
export async function POST(request: Request) {
  try {
    if (!isAdminToken(getBearerToken(request))) return apiResponse(request, { error: "Acesso não autorizado." }, { status: 401 });
    const body = await request.json() as { guestId?: number; complimentaryId?: number; code?: string; listToken?: string };
    if (typeof body.listToken === "string" && body.listToken.trim()) {
      const lista = readListToken(body.listToken.trim());
      if (!lista) return apiResponse(request, { error: "QR de lista inválido." }, { status: 404 });
      const resumo = checkInList(lista);
      if (!resumo) return apiResponse(request, { error: "Esta lista não tem mais ingressos." }, { status: 404 });
      return apiResponse(request, { checkedIn: true, lista: resumo });
    }
    if (typeof body.code === "string" && body.code.trim()) {
      const result = checkInOrder(body.code);
      if (!result) return apiResponse(request, { error: "Pedido não encontrado." }, { status: 404 });
      if (result.status !== "approved") return apiResponse(request, { error: `Pedido ${result.code} não está aprovado (${result.status}).`, order: result }, { status: 409 });
      return apiResponse(request, { checkedIn: true, order: result });
    }
    if (Number.isInteger(body.complimentaryId)) {
      if (!checkInComplimentary(body.complimentaryId as number)) return apiResponse(request, { error: "Cortesia não disponível." }, { status: 404 });
      return apiResponse(request, { checkedIn: true });
    }
    const guestId = body.guestId;
    if (!Number.isInteger(guestId)) return apiResponse(request, { error: "Participante inválido." }, { status: 422 });
    if (!checkInGuest(guestId as number)) return apiResponse(request, { error: "Participante não disponível." }, { status: 404 });
    return apiResponse(request, { checkedIn: true });
  } catch { return apiResponse(request, { error: "Não foi possível confirmar entrada." }, { status: 503 }); }
}
