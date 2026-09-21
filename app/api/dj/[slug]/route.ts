import { apiOptions, apiResponse } from "@/lib/api";
import { findSellerBySlug } from "@/lib/db";

export const runtime = "nodejs";

export function OPTIONS(request: Request) { return apiOptions(request); }

export function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  return context.params.then(({ slug }) => {
    try {
      const seller = findSellerBySlug(slug);
      if (!seller) return apiResponse(request, { error: "Link não encontrado." }, { status: 404 });
      return apiResponse(request, { dj: { id: seller.id, name: seller.name, slug: seller.slug, quota: seller.quota, remaining: seller.remaining } });
    } catch { return apiResponse(request, { error: "Não foi possível carregar o link." }, { status: 503 }); }
  });
}
