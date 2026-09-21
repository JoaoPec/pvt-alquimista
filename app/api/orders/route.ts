import { apiOptions, apiResponse } from "@/lib/api";
import { createOrder, type TicketKind } from "@/lib/db";

export const runtime = "nodejs";

const ticketPrices: Record<TicketKind, number> = { social: 2000, normal: 2500, combo5: 8000 };
type Payload = { buyerName?: string; email?: string; whatsapp?: string; tickets?: Array<{ kind?: string; guestName?: string }>; cooler?: boolean };

export function OPTIONS(request: Request) { return apiOptions(request); }

export async function POST(request: Request) {
  let payload: Payload;
  try { payload = await request.json(); } catch { return apiResponse(request, { error: "Dados inválidos." }, { status: 400 }); }
  const buyerName = payload.buyerName?.trim();
  const email = payload.email?.trim().toLowerCase();
  const whatsapp = payload.whatsapp?.replace(/\D/g, "");
  const tickets = (payload.tickets ?? []).map((ticket) => ({ kind: ticket.kind, guestName: ticket.guestName?.trim() }));
  if (!buyerName || !email || !/^\S+@\S+\.\S+$/.test(email) || !whatsapp || whatsapp.length < 10 || tickets.length === 0 || tickets.some((ticket) => !ticket.guestName || !["social", "normal", "combo5"].includes(ticket.kind ?? ""))) {
    return apiResponse(request, { error: "Preencha comprador, contato e o nome de cada participante." }, { status: 422 });
  }
  const normalized = tickets as Array<{ kind: TicketKind; guestName: string }>;
  const cooler = Boolean(payload.cooler);
  if (cooler && normalized.length < 2) return apiResponse(request, { error: "O adicional de cooler exige pelo menos 2 ingressos." }, { status: 422 });
  const comboGuests = normalized.filter((ticket) => ticket.kind === "combo5").length;
  if (comboGuests % 5 !== 0) return apiResponse(request, { error: "Cada Combo 5 precisa ter cinco participantes." }, { status: 422 });
  const totalCents = normalized.filter((ticket) => ticket.kind === "social").length * ticketPrices.social
    + normalized.filter((ticket) => ticket.kind === "normal").length * ticketPrices.normal
    + (comboGuests / 5) * ticketPrices.combo5
    + (cooler ? 10000 : 0);
  try {
    const order = createOrder({ buyerName, email, whatsapp, tickets: normalized, cooler, totalCents });
    return apiResponse(request, { ...order, totalCents }, { status: 201 });
  } catch {
    return apiResponse(request, { error: "Não foi possível iniciar o pedido." }, { status: 503 });
  }
}
