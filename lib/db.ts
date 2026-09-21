import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export type TicketKind = "social" | "normal" | "combo5";
export type OrderStatus = "awaiting_receipt" | "pending_approval" | "approved" | "rejected";
export type OrderProof = "receipt" | "declared";

type CreateOrderInput = {
  buyerName: string;
  email: string;
  whatsapp: string;
  tickets: Array<{ kind: TicketKind; guestName: string }>;
  cooler: boolean;
  totalCents: number;
  sellerId: number | null;
};

export type Seller = { id: number; name: string; active: boolean };

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
  sellerId: number | null;
  sellerName: string | null;
  guests: Array<{ id: number; name: string; kind: TicketKind; checkedInAt: string | null; removedAt: string | null; removedReason: string | null }>;
};

export type AuditEntry = { id: number; createdAt: string; action: string; orderCode: string | null; guestId: number | null; guestName: string | null; detail: string | null };

const databasePath = process.env.SQLITE_PATH || path.join(process.cwd(), "data", "alquimista.sqlite");
let database: DatabaseSync | undefined;

function getDatabase() {
  if (!database) {
    mkdirSync(path.dirname(databasePath), { recursive: true });
    database = new DatabaseSync(databasePath);

    // 1) Estrutura base. Nunca apaga nada: tudo é CREATE ... IF NOT EXISTS.
    database.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS sellers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        buyer_name TEXT NOT NULL,
        email TEXT NOT NULL,
        whatsapp TEXT NOT NULL,
        total_cents INTEGER NOT NULL,
        cooler INTEGER NOT NULL DEFAULT 0,
        seller_id INTEGER REFERENCES sellers(id) ON DELETE SET NULL,
        proof_type TEXT NOT NULL DEFAULT 'receipt',
        status TEXT NOT NULL DEFAULT 'awaiting_receipt' CHECK(status IN ('awaiting_receipt','pending_approval','approved','rejected')),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS order_guests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        guest_name TEXT NOT NULL,
        ticket_kind TEXT NOT NULL CHECK(ticket_kind IN ('social','normal','combo5')),
        checked_in_at TEXT,
        removed_at TEXT,
        removed_reason TEXT
      );
      CREATE TABLE IF NOT EXISTS payment_receipts (
        order_id INTEGER PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
        filename TEXT NOT NULL,
        content_type TEXT NOT NULL,
        byte_length INTEGER NOT NULL,
        file_data BLOB NOT NULL,
        uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS admin_audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        actor TEXT NOT NULL DEFAULT 'admin',
        action TEXT NOT NULL,
        order_code TEXT,
        guest_id INTEGER,
        guest_name TEXT,
        detail TEXT
      );
      CREATE INDEX IF NOT EXISTS orders_status_created_idx ON orders(status, created_at DESC);
      CREATE INDEX IF NOT EXISTS order_guests_order_idx ON order_guests(order_id);
      CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx ON admin_audit_log(created_at DESC);
    `);

    // 2) Evolução de colunas em bancos antigos (ALTER só quando falta a coluna).
    //    Precisa vir ANTES de qualquer índice que use essas colunas.
    const columnsOf = (table: string) => new Set((database!.prepare(`PRAGMA table_info(${table})`).all() as Array<Record<string, unknown>>).map((column) => String(column.name)));
    const addColumn = (table: string, column: string, definition: string) => {
      if (!columnsOf(table).has(column)) database!.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
    };
    addColumn("orders", "seller_id", "INTEGER REFERENCES sellers(id) ON DELETE SET NULL");
    addColumn("orders", "proof_type", "TEXT NOT NULL DEFAULT 'receipt'");
    addColumn("order_guests", "removed_at", "TEXT");
    addColumn("order_guests", "removed_reason", "TEXT");

    // 3) Índices que dependem das colunas acima.
    database.exec(`CREATE INDEX IF NOT EXISTS orders_seller_idx ON orders(seller_id);`);
  }
  return database;
}

function toAdminOrder(row: Record<string, unknown>): AdminOrder {
  const db = getDatabase();
  const orderId = Number(row.id);
  const guests = db.prepare(`SELECT id, guest_name, ticket_kind, checked_in_at, removed_at, removed_reason FROM order_guests WHERE order_id = ? ORDER BY id`).all(orderId) as Array<Record<string, unknown>>;
  return {
    code: String(row.code), buyerName: String(row.buyer_name), email: String(row.email), whatsapp: String(row.whatsapp),
    totalCents: Number(row.total_cents), cooler: Boolean(row.cooler), status: row.status as OrderStatus,
    createdAt: String(row.created_at), receiptUploaded: Boolean(row.receipt_uploaded),
    sellerId: row.seller_id == null ? null : Number(row.seller_id),
    sellerName: row.seller_name == null ? null : String(row.seller_name),
    guests: guests.map((guest) => ({ id: Number(guest.id), name: String(guest.guest_name), kind: guest.ticket_kind as TicketKind, checkedInAt: guest.checked_in_at ? String(guest.checked_in_at) : null, removedAt: guest.removed_at ? String(guest.removed_at) : null, removedReason: guest.removed_reason ? String(guest.removed_reason) : null })),
  };
}

function audit(action: string, input: { orderCode?: string; guestId?: number | null; guestName?: string | null; detail?: string | null }) {
  getDatabase().prepare(`INSERT INTO admin_audit_log (action, order_code, guest_id, guest_name, detail) VALUES (?, ?, ?, ?, ?)`)
    .run(action, input.orderCode ?? null, input.guestId ?? null, input.guestName ?? null, input.detail ?? null);
}

export function createOrder(input: CreateOrderInput) {
  const db = getDatabase();
  const code = `ALQ-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  if (input.sellerId != null) {
    const seller = db.prepare(`SELECT id FROM sellers WHERE id = ? AND active = 1`).get(input.sellerId) as Record<string, unknown> | undefined;
    if (!seller) throw new Error("Vendedor inválido.");
  }
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = db.prepare(`INSERT INTO orders (code, buyer_name, email, whatsapp, total_cents, cooler, seller_id) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(code, input.buyerName, input.email, input.whatsapp, input.totalCents, input.cooler ? 1 : 0, input.sellerId);
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
  db.prepare(`UPDATE orders SET status = 'pending_approval', proof_type = 'receipt', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(orderId);
  audit("order.proof_receipt", { orderCode: code, detail: receipt.filename });
  return true;
}

export function declarePaid(code: string) {
  const db = getDatabase();
  const order = db.prepare(`SELECT id, status FROM orders WHERE code = ?`).get(code) as Record<string, unknown> | undefined;
  if (!order) return false;
  if (order.status === "approved") throw new Error("Pedido já aprovado.");
  db.prepare(`UPDATE orders SET status = 'pending_approval', proof_type = 'declared', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(Number(order.id));
  audit("order.proof_declared", { orderCode: code, detail: "cliente declarou pagamento sem anexo" });
  return true;
}

export function publicOrder(code: string) {
  const db = getDatabase();
  const row = db.prepare(`SELECT o.code, o.buyer_name, o.email, o.total_cents, o.cooler, o.status, o.proof_type, o.created_at, s.name AS seller_name FROM orders o LEFT JOIN sellers s ON s.id = o.seller_id WHERE o.code = ?`).get(code) as Record<string, unknown> | undefined;
  if (!row) return null;
  const guests = db.prepare(`SELECT guest_name, ticket_kind, removed_at FROM order_guests WHERE order_id = (SELECT id FROM orders WHERE code = ?) ORDER BY id`).all(code) as Array<Record<string, unknown>>;
  return {
    code: String(row.code), buyerName: String(row.buyer_name), email: String(row.email),
    totalCents: Number(row.total_cents), cooler: Boolean(row.cooler), status: String(row.status),
    proofType: String(row.proof_type ?? "receipt"), createdAt: String(row.created_at),
    sellerName: row.seller_name == null ? null : String(row.seller_name),
    guests: guests.filter((g) => !g.removed_at).map((g) => ({ name: String(g.guest_name), kind: String(g.ticket_kind) })),
  };
}

export function listOrders(status?: OrderStatus) {
  const db = getDatabase();
  const select = `SELECT o.*, s.name AS seller_name, EXISTS(SELECT 1 FROM payment_receipts r WHERE r.order_id=o.id) AS receipt_uploaded FROM orders o LEFT JOIN sellers s ON s.id=o.seller_id`;
  const rows = status
    ? db.prepare(`${select} WHERE o.status = ? ORDER BY o.created_at DESC`).all(status)
    : db.prepare(`${select} ORDER BY o.created_at DESC`).all();
  return (rows as Array<Record<string, unknown>>).map(toAdminOrder);
}

export function listSellers(activeOnly = true) {
  const db = getDatabase();
  const rows = activeOnly
    ? db.prepare(`SELECT id, name, active FROM sellers WHERE active = 1 ORDER BY name COLLATE NOCASE`).all()
    : db.prepare(`SELECT id, name, active FROM sellers ORDER BY name COLLATE NOCASE`).all();
  return (rows as Array<Record<string, unknown>>).map((row) => ({ id: Number(row.id), name: String(row.name), active: Boolean(row.active) }));
}

export function upsertSeller(input: { id?: number; name: string; active?: boolean }) {
  const db = getDatabase();
  const name = input.name.trim();
  if (!name) throw new Error("Nome do vendedor é obrigatório.");
  if (input.id != null) {
    db.prepare(`UPDATE sellers SET name = ?, active = ? WHERE id = ?`).run(name, input.active === false ? 0 : 1, input.id);
    return { id: input.id, name, active: input.active !== false };
  }
  const result = db.prepare(`INSERT INTO sellers (name, active) VALUES (?, ?)`).run(name, input.active === false ? 0 : 1);
  return { id: Number(result.lastInsertRowid), name, active: input.active !== false };
}

export function orderStats() {
  const db = getDatabase();
  const byStatus = db.prepare(`SELECT status, COUNT(*) AS orders, COALESCE(SUM(total_cents),0) AS cents FROM orders GROUP BY status`).all() as Array<Record<string, unknown>>;
  const guests = db.prepare(`SELECT o.status, g.ticket_kind, COUNT(*) AS n FROM order_guests g JOIN orders o ON o.id = g.order_id WHERE g.removed_at IS NULL GROUP BY o.status, g.ticket_kind`).all() as Array<Record<string, unknown>>;
  const removed = db.prepare(`SELECT COUNT(*) AS n FROM order_guests WHERE removed_at IS NOT NULL`).get() as Record<string, unknown>;
  const checkedIn = db.prepare(`SELECT COUNT(*) AS n FROM order_guests g JOIN orders o ON o.id = g.order_id WHERE o.status = 'approved' AND g.removed_at IS NULL AND g.checked_in_at IS NOT NULL`).get() as Record<string, unknown>;
  const bySeller = db.prepare(`SELECT COALESCE(s.name,'(sem vendedor)') AS seller, COUNT(DISTINCT o.id) AS orders, COALESCE(SUM(o.total_cents),0) AS cents, COUNT(g.id) AS guests FROM orders o LEFT JOIN sellers s ON s.id = o.seller_id LEFT JOIN order_guests g ON g.order_id = o.id AND g.removed_at IS NULL WHERE o.status = 'approved' GROUP BY COALESCE(s.name,'(sem vendedor)') ORDER BY cents DESC`).all() as Array<Record<string, unknown>>;
  return {
    byStatus: byStatus.map((row) => ({ status: String(row.status), orders: Number(row.orders), cents: Number(row.cents) })),
    guests: guests.map((row) => ({ status: String(row.status), kind: String(row.ticket_kind), count: Number(row.n) })),
    removed: Number(removed.n), checkedIn: Number(checkedIn.n),
    bySeller: bySeller.map((row) => ({ seller: String(row.seller), orders: Number(row.orders), cents: Number(row.cents), guests: Number(row.guests) })),
  };
}

export function setOrderStatus(code: string, status: Extract<OrderStatus, "approved" | "rejected">) {
  const db = getDatabase();
  const result = db.prepare(`UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE code = ? AND status = 'pending_approval'`).run(status, code);
  if (result.changes > 0) audit(status === "approved" ? "order.approved" : "order.rejected", { orderCode: code });
  return result.changes > 0;
}

export function removeGuest(guestId: number, reason: string) {
  const db = getDatabase();
  const cleanReason = reason.trim().slice(0, 280);
  if (!cleanReason) throw new Error("Informe o motivo da remoção.");
  const guest = db.prepare(`SELECT g.id, g.guest_name, g.removed_at, o.code FROM order_guests g JOIN orders o ON o.id = g.order_id WHERE g.id = ?`).get(guestId) as Record<string, unknown> | undefined;
  if (!guest || guest.removed_at) return false;
  db.prepare(`UPDATE order_guests SET removed_at = CURRENT_TIMESTAMP, removed_reason = ? WHERE id = ?`).run(cleanReason, guestId);
  audit("guest.removed", { orderCode: String(guest.code), guestId, guestName: String(guest.guest_name), detail: cleanReason });
  return true;
}

export function listAudit(limit = 200) {
  const db = getDatabase();
  const rows = db.prepare(`SELECT id, created_at, action, order_code, guest_id, guest_name, detail FROM admin_audit_log ORDER BY id DESC LIMIT ?`).all(Math.min(Math.max(limit, 1), 500)) as Array<Record<string, unknown>>;
  return rows.map((row) => ({ id: Number(row.id), createdAt: String(row.created_at), action: String(row.action), orderCode: row.order_code == null ? null : String(row.order_code), guestId: row.guest_id == null ? null : Number(row.guest_id), guestName: row.guest_name == null ? null : String(row.guest_name), detail: row.detail == null ? null : String(row.detail) }));
}

export function receiptForOrder(code: string) {
  const db = getDatabase();
  return db.prepare(`SELECT r.filename, r.content_type, r.file_data FROM payment_receipts r JOIN orders o ON o.id=r.order_id WHERE o.code = ?`).get(code) as { filename: string; content_type: string; file_data: Uint8Array } | undefined;
}

export function approvedGuests() {
  const db = getDatabase();
  const rows = db.prepare(`SELECT g.id, g.guest_name, g.ticket_kind, g.checked_in_at, o.code, o.whatsapp FROM order_guests g JOIN orders o ON o.id=g.order_id WHERE o.status='approved' AND g.removed_at IS NULL ORDER BY g.guest_name COLLATE NOCASE`).all() as Array<Record<string, unknown>>;
  return rows.map((row) => ({ id: Number(row.id), name: String(row.guest_name), kind: row.ticket_kind as TicketKind, checkedInAt: row.checked_in_at ? String(row.checked_in_at) : null, code: String(row.code), whatsapp: String(row.whatsapp) }));
}

export function checkInGuest(id: number) {
  const db = getDatabase();
  const result = db.prepare(`UPDATE order_guests SET checked_in_at = COALESCE(checked_in_at, CURRENT_TIMESTAMP) WHERE id = ? AND removed_at IS NULL AND order_id IN (SELECT id FROM orders WHERE status='approved')`).run(id);
  return result.changes > 0;
}
