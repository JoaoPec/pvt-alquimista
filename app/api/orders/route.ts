import { NextResponse } from "next/server";
import { createPriorityOrder } from "@/lib/db";

export const runtime = "nodejs";

type Payload = { ticketType?: string; name?: string; email?: string; whatsapp?: string };

export async function POST(request: Request) {
  let payload: Payload;
  try { payload = await request.json(); } catch { return NextResponse.json({ error: "Dados inválidos." }, { status: 400 }); }

  const name = payload.name?.trim();
  const email = payload.email?.trim().toLowerCase();
  const whatsapp = payload.whatsapp?.trim();
  if (!name || !email || !whatsapp || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: "Preencha nome, e-mail válido e WhatsApp." }, { status: 422 });
  }

  try {
    const order = createPriorityOrder({ ticketType: payload.ticketType === "experience" ? "experience" : "general", name, email, whatsapp });
    return NextResponse.json(order, { status: order.alreadyRegistered ? 200 : 201 });
  } catch {
    return NextResponse.json({ error: "Não foi possível registrar sua prioridade. Tente novamente." }, { status: 503 });
  }
}
