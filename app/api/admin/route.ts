import { apiOptions, apiResponse } from "@/lib/api";
import { createAdminToken, getBearerToken, isAdminToken, verifyAdminPassword } from "@/lib/auth";
import { listOrders, orderStats, setOrderStatus } from "@/lib/db";

export const runtime = "nodejs";

export function OPTIONS(request: Request) { return apiOptions(request); }

export async function POST(request: Request) {
  let body: { password?: string; code?: string; action?: "approve" | "reject" };
  try { body = await request.json(); } catch { return apiResponse(request, { error: "Dados inválidos." }, { status: 400 }); }
  try {
    if (body.password !== undefined) {
      if (!verifyAdminPassword(body.password)) return apiResponse(request, { error: "Acesso não autorizado." }, { status: 401 });
      return apiResponse(request, { token: createAdminToken() });
    }
    if (!isAdminToken(getBearerToken(request))) return apiResponse(request, { error: "Acesso não autorizado." }, { status: 401 });
    if (!body.code || (body.action !== "approve" && body.action !== "reject")) return apiResponse(request, { error: "Ação inválida." }, { status: 422 });
    if (!setOrderStatus(body.code, body.action === "approve" ? "approved" : "rejected")) return apiResponse(request, { error: "Pedido não disponível para esta ação." }, { status: 409 });
    return apiResponse(request, { status: body.action === "approve" ? "approved" : "rejected" });
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
