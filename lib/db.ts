import { DatabaseSync } from "node:sqlite";
import path from "node:path";

const databasePath = path.join(process.cwd(), "data", "alta-festival.sqlite");
let database: DatabaseSync | undefined;

type PriorityOrder = { code: string; alreadyRegistered: boolean };

function getDatabase() {
  if (!database) {
    database = new DatabaseSync(databasePath);
    database.exec(`
      CREATE TABLE IF NOT EXISTS priority_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        ticket_type TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        whatsapp TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'priority',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE UNIQUE INDEX IF NOT EXISTS priority_orders_email_unique ON priority_orders(email);
    `);
  }
  return database;
}

export function createPriorityOrder(input: { ticketType: string; name: string; email: string; whatsapp: string }): PriorityOrder {
  const db = getDatabase();
  const existing = db.prepare("SELECT code FROM priority_orders WHERE email = ?").get(input.email) as { code: string } | undefined;
  if (existing) return { code: existing.code, alreadyRegistered: true };

  const code = `ALQ-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  try {
    db.prepare(`
      INSERT INTO priority_orders (code, ticket_type, name, email, whatsapp)
      VALUES (?, ?, ?, ?, ?)
    `).run(code, input.ticketType, input.name, input.email, input.whatsapp);
    return { code, alreadyRegistered: false };
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("UNIQUE")) throw error;
    const concurrent = db.prepare("SELECT code FROM priority_orders WHERE email = ?").get(input.email) as { code: string } | undefined;
    if (!concurrent) throw error;
    return { code: concurrent.code, alreadyRegistered: true };
  }
}
