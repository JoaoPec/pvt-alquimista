import { NextResponse } from "next/server";

const defaultOrigins = ["https://pvt-alquimista.vercel.app", "http://localhost:3099", "http://localhost:3000"];

function allowedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const configured = process.env.FRONTEND_ORIGIN?.split(",").map((item) => item.trim()).filter(Boolean) ?? [];
  return origin && [...defaultOrigins, ...configured].includes(origin) ? origin : null;
}

export function apiResponse(request: Request, body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  const origin = allowedOrigin(request);
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  }
  return NextResponse.json(body, { ...init, headers });
}

export function apiOptions(request: Request) {
  return apiResponse(request, {}, { status: 204 });
}
