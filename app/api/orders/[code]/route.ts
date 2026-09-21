import { apiOptions, apiResponse } from "@/lib/api";
import { publicOrder } from "@/lib/db";

export const runtime = "nodejs";

export function OPTIONS(request: Request) { return apiOptions(request); }

export function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  return context.params.then(({ code }) => {
    try {
      const order = publicOrder(code.toUpperCase());
      if (!order) return apiResponse(request, { error: "Pedido não encontrado." }, { status: 404 });
      return apiResponse(request, { order });
    } catch { return apiResponse(request, { error: "Não foi possível carregar o pedido." }, { status: 503 }); }
  });
}
