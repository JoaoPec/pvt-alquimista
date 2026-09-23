import { createHmac, timingSafeEqual } from "node:crypto";

const encoder = new TextEncoder();

function requiredEnv(name: "ADMIN_PASSWORD" | "ADMIN_SESSION_SECRET") {
  const value = process.env[name];
  if (!value) throw new Error("ADMIN_NOT_CONFIGURED");
  return value;
}

function sign(payload: string) {
  return createHmac("sha256", requiredEnv("ADMIN_SESSION_SECRET")).update(payload).digest("base64url");
}

export function verifyAdminPassword(candidate: string) {
  const expected = encoder.encode(requiredEnv("ADMIN_PASSWORD"));
  const received = encoder.encode(candidate);
  return expected.byteLength === received.byteLength && timingSafeEqual(expected, received);
}

export function createAdminToken() {
  const payload = Buffer.from(JSON.stringify({ role: "admin", exp: Date.now() + 1000 * 60 * 60 * 12 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function isAdminToken(token: string | null) {
  if (!token || !token.includes(".")) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  const expected = sign(payload);
  const given = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  if (given.byteLength !== expectedBytes.byteLength || !timingSafeEqual(given, expectedBytes)) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { role?: string; exp?: number };
    return parsed.role === "admin" && typeof parsed.exp === "number" && parsed.exp > Date.now();
  } catch { return false; }
}

export function getBearerToken(request: Request) {
  const header = request.headers.get("authorization");
  return header?.startsWith("Bearer ") ? header.slice(7) : null;
}

/**
 * Link assinado de um comprovante de lista (ex: os 10 ingressos do Darlan).
 * Não guarda nada no banco: o nome da lista vai dentro do próprio token, e a
 * assinatura garante que ninguém troque o nome para espiar outra lista.
 */
export function createListToken(listName: string) {
  const payload = Buffer.from(JSON.stringify({ kind: "list", list: listName })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** Devolve o nome da lista se a assinatura conferir; senão, null. */
export function readListToken(token: string | null): string | null {
  if (!token || !token.includes(".")) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (given.byteLength !== expected.byteLength || !timingSafeEqual(given, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { kind?: string; list?: string };
    return parsed.kind === "list" && typeof parsed.list === "string" && parsed.list.trim() ? parsed.list : null;
  } catch { return null; }
}
