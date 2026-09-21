import { apiOptions, apiResponse } from "@/lib/api";
import { getBearerToken, isAdminToken } from "@/lib/auth";
import { approvedGuests, checkInGuest } from "@/lib/db";
export const runtime = "nodejs";
export function OPTIONS(request: Request) { return apiOptions(request); }
export function GET(request: Request) { try { if (!isAdminToken(getBearerToken(request))) return apiResponse(request, { error: "Acesso não autorizado." }, { status: 401 }); return apiResponse(request, { guests: approvedGuests() }); } catch { return apiResponse(request, { error: "Portaria ainda não configurada." }, { status: 503 }); } }
export async function POST(request: Request) { try { if (!isAdminToken(getBearerToken(request))) return apiResponse(request, { error: "Acesso não autorizado." }, { status: 401 }); const body = await request.json() as { guestId?: number }; const guestId = body.guestId; if (!Number.isInteger(guestId)) return apiResponse(request, { error: "Participante inválido." }, { status: 422 }); if (!checkInGuest(guestId as number)) return apiResponse(request, { error: "Participante não disponível." }, { status: 404 }); return apiResponse(request, { checkedIn: true }); } catch { return apiResponse(request, { error: "Não foi possível confirmar entrada." }, { status: 503 }); } }
