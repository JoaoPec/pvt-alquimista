import { apiOptions, apiResponse } from "@/lib/api";
import { createAdminToken, getBearerToken, isAdminToken, verifyAdminPassword } from "@/lib/auth";
import { COOLER_PRICE } from "@/lib/features";
import { createManualOrder, listOrders, orderStats, setOrderStatus, type TicketKind } from "@/lib/db";

export const runtime = "nodejs";

const precos: Record<TicketKind, number> = { social: 2000, normal: 2500, combo5: 8000 };
const kinds: TicketKind[] = ["social", "normal", "combo5"];

type Corpo = {
  password?: string;
  code?: string;
  action?: "approve" | "reject";
  /** geração manual */
  manual?: {
    buyerName?: string; email?: string; whatsapp?: string;
    tickets?: Array<{ kind?: string; guestName?: string }>;
    cooler?: boolean; sellerId?: number | null; note?: string;
  };
};

export function OPTIONS(request: Request) { return apiOptions(request); }

/** Valida e precifica um pedido feito na mão pelo admin. */
function prepararManual(m: NonNullable<Corpo["manual"]>) {
  const buyerName = m.buyerName?.trim();
  const email = (m.email?.trim() || "sem-email@pvt-alquimista.local").toLowerCase();
  const whatsapp = (m.whatsapp?.replace(/\D/g, "") || "0000000000");
  const tickets = (m.tickets ?? []).map((t) => ({ kind: t.kind as TicketKind, guestName: t.guestName?.trim() ?? "" }));
  if (!buyerName) throw new Error("Informe o nome do comprador.");
  if (tickets.length === 0) throw new Error("Adicione pelo menos 1 ingresso.");
  if (tickets.some((t) => !t.guestName || !kinds.includes(t.kind))) throw new Error("Preencha o nome de cada participante.");
  const combos = tickets.filter((t) => t.kind === "combo5").length;
  if (combos % 5 !== 0) throw new Error("Cada Combo 5 precisa ter cinco participantes.");
  const cooler = Boolean(m.cooler);
  const totalCents = tickets.filter((t) => t.kind === "social").length * precos.social
    + tickets.filter((t) => t.kind === "normal").length * precos.normal
    + (combos / 5) * precos.combo5
    + (cooler ? COOLER_PRICE * 100 : 0);
  return { buyerName, email, whatsapp, tickets, cooler, totalCents, sellerId: m.sellerId ?? null, note: m.note ?? "" };
}

export async function POST(request: Request) {
  let body: Corpo;
  try { body = await request.json(); } catch { return apiResponse(request, { error: "Dados inválidos." }, { status: 400 }); }
  try {
    if (body.password !== undefined) {
      if (!verifyAdminPassword(body.password)) return apiResponse(request, { error: "Acesso não autorizado." }, { status: 401 });
      return apiResponse(request, { token: createAdminToken() });
    }
    if (!isAdminToken(getBearerToken(request))) return apiResponse(request, { error: "Acesso não autorizado." }, { status: 401 });

    // 1) geração manual de ingresso
    if (body.manual) {
      if (!body.manual.note?.trim()) return apiResponse(request, { error: "Informe o motivo (ex: Pix recebido na conta)." }, { status: 422 });
      try {
        const pedido = createManualOrder(prepararManual(body.manual));
        return apiResponse(request, { manual: pedido, orders: listOrders(), stats: orderStats() }, { status: 201 });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "";
        if (msg && !msg.includes("SQLITE") && !msg.includes("UNIQUE")) return apiResponse(request, { error: msg }, { status: 422 });
        throw error;
      }
    }

    // 2) aprovar / recusar
    if (!body.code || (body.action !== "approve" && body.action !== "reject")) return apiResponse(request, { error: "Ação inválida." }, { status: 422 });
    if (!setOrderStatus(body.code, body.action === "approve" ? "approved" : "rejected")) {
      return apiResponse(request, { error: "Este pedido já foi decidido ou não existe." }, { status: 409 });
    }
    return apiResponse(request, { status: body.action === "approve" ? "approved" : "rejected", orders: listOrders(), stats: orderStats() });
  } catch {
    return apiResponse(request, { error: "Administração ainda não configurada." }, { status: 503 });
  }
}

export function GET(request: Request) {
  try {
    if (!isAdminToken(getBearerToken(request))) return apiResponse(request, { error: "Acesso não autorizado." }, { status: 401 });
    return apiResponse(request, { orders: listOrders(), stats: orderStats() });
  } catch { return apiResponse(request, { error: "Administração ainda não configurada." }, { status: 503 }); }
}
