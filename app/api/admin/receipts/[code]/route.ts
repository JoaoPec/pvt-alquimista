import { apiOptions, apiResponse } from "@/lib/api";
import { getBearerToken, isAdminToken } from "@/lib/auth";
import { receiptForOrder } from "@/lib/db";

export const runtime = "nodejs";

export function OPTIONS(request: Request) { return apiOptions(request); }

export function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  return context.params.then(({ code }) => {
    try {
      if (!isAdminToken(getBearerToken(request))) return apiResponse(request, { error: "Acesso não autorizado." }, { status: 401 });
      const receipt = receiptForOrder(code);
      if (!receipt) return apiResponse(request, { error: "Comprovante não encontrado." }, { status: 404 });
      const data = Buffer.from(receipt.file_data).toString("base64");
      return apiResponse(request, { filename: receipt.filename, contentType: receipt.content_type, dataBase64: data });
    } catch { return apiResponse(request, { error: "Não foi possível carregar o comprovante." }, { status: 503 }); }
  });
}
