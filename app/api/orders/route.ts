import { apiOptions, apiResponse } from "@/lib/api";
import { createOrder, findSellerBySlug, type TicketKind } from "@/lib/db";
import { COOLER_ENABLED, COOLER_PRICE } from "@/lib/features";
import { precoDe, validarIngressos } from "@/lib/tickets";

export const runtime = "nodejs";

type Payload = { buyerName?: string; email?: string; whatsapp?: string; tickets?: Array<{ kind?: string; guestName?: string }>; cooler?: boolean; djSlug?: string | null };

export function OPTIONS(request: Request) { return apiOptions(request); }

export async function POST(request: Request) {
  let payload: Payload;
  try { payload = await request.json(); } catch { return apiResponse(request, { error: "Dados inválidos." }, { status: 400 }); }
  const buyerName = payload.buyerName?.trim();
  const email = payload.email?.trim().toLowerCase();
  const whatsapp = payload.whatsapp?.replace(/\D/g, "");
  const tickets = (payload.tickets ?? []).map((ticket) => ({ kind: ticket.kind, guestName: ticket.guestName?.trim() }));
  if (!buyerName || !email || !/^\S+@\S+\.\S+$/.test(email) || !whatsapp || whatsapp.length < 10) {
    return apiResponse(request, { error: "Preencha comprador, contato e o nome de cada participante." }, { status: 422 });
  }
  const problema = validarIngressos(tickets);
  if (problema) return apiResponse(request, { error: problema }, { status: 422 });

  const normalized = tickets as Array<{ kind: TicketKind; guestName: string }>;
  const cooler = COOLER_ENABLED && Boolean(payload.cooler);
  const totalCents = precoDe(normalized, cooler, COOLER_PRICE);
  try {
    // Atribuição só pelo link do DJ — não existe mais escolha manual de vendedor.
    let sellerId: number | null = null;
    if (payload.djSlug) {
      const dj = findSellerBySlug(payload.djSlug);
      if (!dj) return apiResponse(request, { error: "Link de DJ inválido ou inativo." }, { status: 422 });
      sellerId = dj.id;
    }
    const order = createOrder({ buyerName, email, whatsapp, tickets: normalized, cooler, totalCents, sellerId });
    return apiResponse(request, { ...order, totalCents }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "Vendedor inválido." || message.startsWith("Restam apenas") || message.startsWith("Este link já atingiu")) {
      return apiResponse(request, { error: message }, { status: 422 });
    }
    return apiResponse(request, { error: "Não foi possível iniciar o pedido." }, { status: 503 });
  }
}
