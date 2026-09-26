import { apiOptions, apiResponse } from "@/lib/api";
import { createPorterToken, getBearerToken, isPorterToken, verifyPorterPassword } from "@/lib/auth";
import { createPorterSale, listPorterPending, setOrderStatus } from "@/lib/db";
import { buildPixPayload } from "@/lib/pix";
import { PORTARIA_PRICE } from "@/lib/tickets";

export const runtime = "nodejs";

/** A portaria vende UM tipo de ingresso: o normal, de R$ 30. */
const PRECO_REAIS = PORTARIA_PRICE;
const MAX_POR_VENDA = 20;

type Corpo = {
  password?: string;
  action?: "cobrar" | "confirmar" | "cancelar";
  names?: string[];
  code?: string;
};

export function OPTIONS(request: Request) { return apiOptions(request); }

/** Monta o BR Code do Pix com o valor exato e o código do pedido no txid. */
function pixDoPedido(code: string, totalCents: number) {
  const key = process.env.PIX_KEY;
  if (!key) return null;
  try {
    return buildPixPayload({
      key,
      name: "PVT ALQUIMISTA",
      city: "AREMBEPE",
      amount: totalCents / 100,
      txid: code.replace(/[^A-Za-z0-9]/g, ""),
    });
  } catch { return null; }
}

export function GET(request: Request) {
  try {
    if (!isPorterToken(getBearerToken(request))) return apiResponse(request, { error: "Acesso não autorizado." }, { status: 401 });
    return apiResponse(request, { pendentes: listPorterPending(), precoReais: PRECO_REAIS });
  } catch { return apiResponse(request, { error: "Portaria ainda não configurada." }, { status: 503 }); }
}

export async function POST(request: Request) {
  let body: Corpo;
  try { body = await request.json(); } catch { return apiResponse(request, { error: "Dados inválidos." }, { status: 400 }); }

  try {
    // 1) login da portaria — senha própria, diferente da do admin
    if (body.password !== undefined) {
      if (!verifyPorterPassword(body.password)) return apiResponse(request, { error: "Senha da portaria incorreta." }, { status: 401 });
      return apiResponse(request, { token: createPorterToken() });
    }

    if (!isPorterToken(getBearerToken(request))) return apiResponse(request, { error: "Acesso não autorizado." }, { status: 401 });

    // 2) gera a cobrança: cria o pedido pendente e devolve o QR do Pix
    if (body.action === "cobrar") {
      const nomes = (body.names ?? []).map((n) => (n ?? "").trim()).filter(Boolean);
      if (nomes.length === 0) return apiResponse(request, { error: "Preencha o nome de quem vai entrar." }, { status: 422 });
      if (nomes.length > MAX_POR_VENDA) return apiResponse(request, { error: `No máximo ${MAX_POR_VENDA} ingressos por venda.` }, { status: 422 });
      if (nomes.some((n) => n.length > 80)) return apiResponse(request, { error: "Nome muito longo." }, { status: 422 });

      // O valor é sempre calculado aqui — nunca vem do navegador.
      const totalCents = nomes.length * PRECO_REAIS * 100;
      const pedido = createPorterSale({ buyerName: nomes[0], names: nomes, totalCents });
      return apiResponse(request, {
        code: pedido.code,
        status: pedido.status,
        totalCents,
        pessoas: nomes.length,
        pixPayload: pixDoPedido(pedido.code, totalCents),
      }, { status: 201 });
    }

    // 3) confirma o pagamento — só aqui a entrada é liberada
    if (body.action === "confirmar" || body.action === "cancelar") {
      if (!body.code?.trim()) return apiResponse(request, { error: "Pedido inválido." }, { status: 422 });
      const ok = setOrderStatus(body.code.trim().toUpperCase(), body.action === "confirmar" ? "approved" : "rejected");
      if (!ok) return apiResponse(request, { error: "Este pedido já foi decidido ou não existe." }, { status: 409 });
      return apiResponse(request, { status: body.action === "confirmar" ? "approved" : "rejected", pendentes: listPorterPending() });
    }

    return apiResponse(request, { error: "Ação inválida." }, { status: 422 });
  } catch {
    return apiResponse(request, { error: "Portaria ainda não configurada." }, { status: 503 });
  }
}
