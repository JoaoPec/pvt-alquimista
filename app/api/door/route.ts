import { apiOptions, apiResponse } from "@/lib/api";
import { createListToken, getBearerToken, isDoorToken, readListToken } from "@/lib/auth";
import {
  approvedGuests, checkInComplimentary, checkInGuest, checkInList, checkInOrder, listComplimentary,
  undoCheckInComplimentary, undoCheckInGuest, undoCheckInList, undoCheckInOrder,
} from "@/lib/db";

export const runtime = "nodejs";

export function OPTIONS(request: Request) { return apiOptions(request); }

export function GET(request: Request) {
  try {
    if (!isDoorToken(getBearerToken(request))) return apiResponse(request, { error: "Acesso não autorizado." }, { status: 401 });
    const ativas = listComplimentary(false);
    const listas = Array.from(new Set(ativas.map((c) => c.listName))).sort((a, b) => a.localeCompare(b)).map((nome) => ({
      nome,
      total: ativas.filter((c) => c.listName === nome).length,
      entrados: ativas.filter((c) => c.listName === nome && c.checkedInAt).length,
      token: createListToken(nome),
    }));
    return apiResponse(request, { guests: approvedGuests(), complimentary: ativas, listas });
  } catch { return apiResponse(request, { error: "Portaria ainda não configurada." }, { status: 503 }); }
}

type Corpo = { undo?: boolean; guestId?: number; complimentaryId?: number; code?: string; listToken?: string };

/** Alvo da ação, na ordem em que o QR da portaria manda. */
function alvo(body: Corpo): { tipo: "lista" | "pedido" | "cortesia" | "convidado"; valor: string | number } | { erro: string } {
  if (typeof body.listToken === "string" && body.listToken.trim()) {
    const lista = readListToken(body.listToken.trim());
    return lista ? { tipo: "lista", valor: lista } : { erro: "QR de lista inválido." };
  }
  if (typeof body.code === "string" && body.code.trim()) return { tipo: "pedido", valor: body.code };
  if (Number.isInteger(body.complimentaryId)) return { tipo: "cortesia", valor: body.complimentaryId as number };
  if (Number.isInteger(body.guestId)) return { tipo: "convidado", valor: body.guestId as number };
  return { erro: "Participante inválido." };
}

export async function POST(request: Request) {
  try {
    if (!isDoorToken(getBearerToken(request))) return apiResponse(request, { error: "Acesso não autorizado." }, { status: 401 });
    const body = await request.json() as Corpo;
    const destino = alvo(body);
    if ("erro" in destino) return apiResponse(request, { error: destino.erro }, { status: 422 });

    if (destino.tipo === "lista") {
      const lista = destino.valor as string;
      const resumo = body.undo ? undoCheckInList(lista) : checkInList(lista);
      if (!resumo) return apiResponse(request, { error: body.undo ? "Ninguém desta lista tinha entrado." : "Esta lista não tem mais ingressos." }, { status: 404 });
      return apiResponse(request, { checkedIn: !body.undo, lista: resumo });
    }

    if (destino.tipo === "pedido") {
      const code = destino.valor as string;
      const result = body.undo ? undoCheckInOrder(code) : checkInOrder(code);
      if (!result) return apiResponse(request, { error: "Pedido não encontrado." }, { status: 404 });
      if (!body.undo && result.status !== "approved") return apiResponse(request, { error: `Pedido ${result.code} não está aprovado (${result.status}).`, order: result }, { status: 409 });
      return apiResponse(request, { checkedIn: !body.undo, order: result });
    }

    if (destino.tipo === "cortesia") {
      const id = destino.valor as number;
      const feito = body.undo ? undoCheckInComplimentary(id) : checkInComplimentary(id);
      if (!feito) return apiResponse(request, { error: body.undo ? "Esta cortesia não tinha entrada registrada." : "Cortesia não disponível." }, { status: 404 });
      return apiResponse(request, { checkedIn: !body.undo });
    }

    const id = destino.valor as number;
    const feito = body.undo ? undoCheckInGuest(id) : checkInGuest(id);
    if (!feito) return apiResponse(request, { error: body.undo ? "Este participante não tinha entrada registrada." : "Participante não disponível." }, { status: 404 });
    return apiResponse(request, { checkedIn: !body.undo });
  } catch { return apiResponse(request, { error: "Não foi possível confirmar entrada." }, { status: 503 }); }
}
