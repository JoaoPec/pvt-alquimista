import { createHmac, timingSafeEqual } from "node:crypto";

const encoder = new TextEncoder();

/** Papéis: admin (gestão) e portaria (porta + venda no balcão). */
export type Role = "admin" | "portaria";

const VARIAVEL: Record<Role, "ADMIN_PASSWORD" | "PORTER_PASSWORD"> = {
  admin: "ADMIN_PASSWORD",
  portaria: "PORTER_PASSWORD",
};

function requiredEnv(name: "ADMIN_PASSWORD" | "ADMIN_SESSION_SECRET" | "PORTER_PASSWORD") {
  const value = process.env[name];
  if (!value) throw new Error("ADMIN_NOT_CONFIGURED");
  return value;
}

function sign(payload: string) {
  return createHmac("sha256", requiredEnv("ADMIN_SESSION_SECRET")).update(payload).digest("base64url");
}

/** Compara senhas em tempo constante. */
function senhaConfere(candidate: string, expectedValue: string) {
  const expected = encoder.encode(expectedValue);
  const received = encoder.encode(candidate);
  return expected.byteLength === received.byteLength && timingSafeEqual(expected, received);
}

export function verifyAdminPassword(candidate: string) {
  return senhaConfere(candidate, requiredEnv("ADMIN_PASSWORD"));
}

/** Senha da portaria — diferente da do admin. */
export function verifyPorterPassword(candidate: string) {
  const esperada = process.env[VARIAVEL.portaria];
  // Sem PORTER_PASSWORD configurada, ninguém entra pela portaria.
  if (!esperada) return false;
  return senhaConfere(candidate, esperada);
}

function createToken(role: Role) {
  const payload = Buffer.from(JSON.stringify({ role, exp: Date.now() + 1000 * 60 * 60 * 12 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function createAdminToken() { return createToken("admin"); }
export function createPorterToken() { return createToken("portaria"); }

/** Lê e valida a assinatura/validade; devolve o papel, ou null. */
function readToken(token: string | null): { role: Role } | null {
  if (!token || !token.includes(".")) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (given.byteLength !== expected.byteLength || !timingSafeEqual(given, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { role?: string; exp?: number };
    if (parsed.role !== "admin" && parsed.role !== "portaria") return null;
    if (typeof parsed.exp !== "number" || parsed.exp <= Date.now()) return null;
    return { role: parsed.role };
  } catch { return null; }
}

/** Só o admin (gestão). */
export function isAdminToken(token: string | null) {
  return readToken(token)?.role === "admin";
}

/** Só a portaria. */
export function isPorterToken(token: string | null) {
  return readToken(token)?.role === "portaria";
}

/** Porta e venda no balcão: admin ou portaria. */
export function isDoorToken(token: string | null) {
  const role = readToken(token)?.role;
  return role === "admin" || role === "portaria";
}

export function getBearerToken(request: Request) {
  const header = request.headers.get("authorization");
  return header?.startsWith("Bearer ") ? header.slice(7) : null;
}

/**
 * Link assinado de um comprovante de lista (ex: os 10 do Darlan).
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
