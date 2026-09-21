import { apiOptions, apiResponse } from "@/lib/api";

export const runtime = "nodejs";

export function OPTIONS(request: Request) { return apiOptions(request); }

export function GET(request: Request) {
  const pixKey = process.env.PIX_KEY;
  if (!pixKey) return apiResponse(request, { error: "PIX_NOT_CONFIGURED" }, { status: 503 });
  return apiResponse(request, { pixKey, eventName: "PVT Alquimista" });
}
