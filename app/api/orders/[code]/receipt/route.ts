import { apiOptions, apiResponse } from "@/lib/api";
import { attachReceipt } from "@/lib/db";

export const runtime = "nodejs";
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxBytes = 5 * 1024 * 1024;

export function OPTIONS(request: Request) { return apiOptions(request); }

export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  let form: FormData;
  try { form = await request.formData(); } catch { return apiResponse(request, { error: "Envie um comprovante válido." }, { status: 400 }); }
  const file = form.get("receipt");
  if (!(file instanceof File) || !allowedTypes.has(file.type) || file.size === 0 || file.size > maxBytes) {
    return apiResponse(request, { error: "Envie imagem JPG, PNG ou WEBP de até 5 MB." }, { status: 422 });
  }
  try {
    const saved = attachReceipt(code, { filename: file.name.slice(0, 120), contentType: file.type, data: new Uint8Array(await file.arrayBuffer()) });
    if (!saved) return apiResponse(request, { error: "Pedido não encontrado." }, { status: 404 });
    return apiResponse(request, { status: "pending_approval" });
  } catch (error) {
    const message = error instanceof Error && error.message === "Pedido já aprovado." ? error.message : "Não foi possível enviar o comprovante.";
    return apiResponse(request, { error: message }, { status: 503 });
  }
}
