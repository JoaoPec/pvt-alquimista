import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export type TicketKind = "social" | "normal" | "combo5";
export type OrderStatus = "awaiting_receipt" | "pending_approval" | "approved" | "rejected";

type CreateOrderInput = {
  buyerName: string;
  email: string;
  whatsapp: string;
  tickets: Array<{ kind: TicketKind; guestName: string }>;
  cooler: boolean;
  totalCents: number;
};

export type AdminOrder = {
  code: string;
  buyerName: string;
  email: string;
  whatsapp: string;
  totalCents: number;
  cooler: boolean;
  status: OrderStatus;
  createdAt: string;
  receiptUploaded: boolean;
  guests: Array<{ id: number; name: string; kind: TicketKind; checkedInAt: string | null }>;
};

const databasePath = process.env.SQLITE_PATH || path.join(process.cwd(), "data", "alquimista.sqlite");
let database: DatabaseSync | undefined;

function getDatabase() {
  if (!database) {
    mkdirSync(path.dirname(databasePath), { recursive: true });
    database = new DatabaseSync(databasePath);
    database.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        buyer_name TEXT NOT NULL,
        email TEXT NOT NULL,
        whatsapp TEXT NOT NULL,
        total_cents INTEGER NOT NULL,
        cooler INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'awaiting_receipt' CHECK(status IN ('awaiting_receipt','pending_approval','approved','rejected')),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS order_guests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        guest_name TEXT NOT NULL,
        ticket_kind TEXT NOT NULL CHECK(ticket_kind IN ('social','normal','combo5')),
        checked_in_at TEXT
      );
      CREATE TABLE IF NOT EXISTS payment_receipts (
        order_id INTEGER PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
        filename TEXT NOT NULL,
        content_type TEXT NOT NULL,
        byte_length INTEGER NOT NULL,
        file_data BLOB NOT NULL,
        uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS orders_status_created_idx ON orders(status, created_at DESC);
      CREATE INDEX IF NOT EXISTS order_guests_order_idx ON order_guests(order_id);
    `);
  }
  return database;
}

function toAdminOrder(row: Record<string, unknown>): AdminOrder {
  const db = getDatabase();
  const orderId = Number(row.id);
  const guests = db.prepare(`SELECT id, guest_name, ticket_kind, checked_in_at FROM order_guests WHERE order_id = ? ORDER BY id`).all(orderId) as Array<Record<string, unknown>>;
  return {
    code: String(row.code), buyerName: String(row.buyer_name), email: String(row.email), whatsapp: String(row.whatsapp),
    totalCents: Number(row.total_cents), cooler: Boolean(row.cooler), status: row.status as OrderStatus,
    createdAt: String(row.created_at), receiptUploaded: Boolean(row.receipt_uploaded),
    guests: guests.map((guest) => ({ id: Number(guest.id), name: String(guest.guest_name), kind: guest.ticket_kind as TicketKind, checkedInAt: guest.checked_in_at ? String(guest.checked_in_at) : null })),
  };
}

export function createOrder(input: CreateOrderInput) {
  const db = getDatabase();
  const code = `ALQ-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = db.prepare(`INSERT INTO orders (code, buyer_name, email, whatsapp, total_cents, cooler) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(code, input.buyerName, input.email, input.whatsapp, input.totalCents, input.cooler ? 1 : 0);
    const orderId = Number(result.lastInsertRowid);
    const insertGuest = db.prepare(`INSERT INTO order_guests (order_id, guest_name, ticket_kind) VALUES (?, ?, ?)`);
    for (const ticket of input.tickets) insertGuest.run(orderId, ticket.guestName, ticket.kind);
    db.exec("COMMIT");
    return { code, status: "awaiting_receipt" as const };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function attachReceipt(code: string, receipt: { filename: string; contentType: string; data: Uint8Array }) {
  const db = getDatabase();
  const order = db.prepare(`SELECT id, status FROM orders WHERE code = ?`).get(code) as Record<string, unknown> | undefined;
  if (!order) return false;
  if (order.status === "approved") throw new Error("Pedido já aprovado.");
  const orderId = Number(order.id);
  db.prepare(`INSERT INTO payment_receipts (order_id, filename, content_type, byte_length, file_data) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(order_id) DO UPDATE SET filename=excluded.filename, content_type=excluded.content_type, byte_length=excluded.byte_length, file_data=excluded.file_data, uploaded_at=CURRENT_TIMESTAMP`)
    .run(orderId, receipt.filename, receipt.contentType, receipt.data.byteLength, receipt.data);
  db.prepare(`UPDATE orders SET status = 'pending_approval', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(orderId);
  return true;
}

export function listOrders(status?: OrderStatus) {
  const db = getDatabase();
  const rows = status
    ? db.prepare(`SELECT o.*, EXISTS(SELECT 1 FROM payment_receipts r WHERE r.order_id=o.id) AS receipt_uploaded FROM orders o WHERE o.status = ? ORDER BY o.created_at DESC`).all(status)
    : db.prepare(`SELECT o.*, EXISTS(SELECT 1 FROM payment_receipts r WHERE r.order_id=o.id) AS receipt_uploaded FROM orders o ORDER BY o.created_at DESC`).all();
  return (rows as Array<Record<string, unknown>>).map(toAdminOrder);
}

export function setOrderStatus(code: string, status: Extract<OrderStatus, "approved" | "rejected">) {
  const db = getDatabase();
  const result = db.prepare(`UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE code = ? AND status = 'pending_approval'`).run(status, code);
  return result.changes > 0;
}

export function receiptForOrder(code: string) {
  const db = getDatabase();
  return db.prepare(`SELECT r.filename, r.content_type, r.file_data FROM payment_receipts r JOIN orders o ON o.id=r.order_id WHERE o.code = ?`).get(code) as { filename: string; content_type: string; file_data: Uint8Array } | undefined;
}

export function approvedGuests() {
  const db = getDatabase();
  const rows = db.prepare(`SELECT g.id, g.guest_name, g.ticket_kind, g.checked_in_at, o.code, o.whatsapp FROM order_guests g JOIN orders o ON o.id=g.order_id WHERE o.status='approved' ORDER BY g.guest_name COLLATE NOCASE`).all() as Array<Record<string, unknown>>;
  return rows.map((row) => ({ id: Number(row.id), name: String(row.guest_name), kind: row.ticket_kind as TicketKind, checkedInAt: row.checked_in_at ? String(row.checked_in_at) : null, code: String(row.code), whatsapp: String(row.whatsapp) }));
}

export function checkInGuest(id: number) {
  const db = getDatabase();
  const result = db.prepare(`UPDATE order_guests SET checked_in_at = COALESCE(checked_in_at, CURRENT_TIMESTAMP) WHERE id = ? AND order_id IN (SELECT id FROM orders WHERE status='approved')`).run(id);
  return result.changes > 0;
}
