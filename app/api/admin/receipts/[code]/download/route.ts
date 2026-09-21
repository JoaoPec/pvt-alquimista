import { NextResponse } from "next/server";
import { apiOptions } from "@/lib/api";
import { getBearerToken, isAdminToken } from "@/lib/auth";
import { receiptForOrder } from "@/lib/db";

export const runtime = "nodejs";

export function OPTIONS(request: Request) { return apiOptions(request); }

export function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  return context.params.then(({ code }) => {
    if (!isAdminToken(getBearerToken(request))) return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
    const receipt = receiptForOrder(code);
    if (!receipt) return NextResponse.json({ error: "Comprovante não encontrado." }, { status: 404 });
    return new NextResponse(Buffer.from(receipt.file_data), {
      headers: {
        "Content-Type": receipt.content_type,
        "Content-Disposition": `attachment; filename="${receipt.filename.replace(/"/g, "")}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  });
}
