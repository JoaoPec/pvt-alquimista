import type { DatabaseSync } from "node:sqlite";

/** SQL de criação da tabela de convidados, usado também na reconstrução. */
const ORDER_GUESTS_SQL = `
  CREATE TABLE order_guests_novo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    guest_name TEXT NOT NULL,
    ticket_kind TEXT NOT NULL CHECK(ticket_kind IN ('social','normal','combo2','combo3','combo5')),
    checked_in_at TEXT,
    removed_at TEXT,
    removed_reason TEXT
  );
`;

/**
 * Bancos criados antes dos combos novos têm um CHECK que só aceita os tipos
 * daquela época. O SQLite não deixa alterar CHECK, então a tabela é
 * reconstruída copiando tudo — ids, check-ins e remoções saem iguais.
 *
 * Roda só quando falta o tipo novo, e é idempotente.
 */
export function migrarTiposDeIngresso(database: DatabaseSync) {
  const sqlDe = (tabela: string) => {
    const linha = database.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`).get(tabela) as { sql?: string } | undefined;
    return linha?.sql ?? "";
  };

  const atual = sqlDe("order_guests");
  if (!atual || !atual.includes("CHECK") || atual.includes("combo2")) return;

  const antes = (database.prepare(`SELECT COUNT(*) AS n FROM order_guests`).get() as { n: number }).n;

  database.exec("PRAGMA foreign_keys=OFF;");
  database.exec("BEGIN IMMEDIATE;");
  try {
    database.exec(ORDER_GUESTS_SQL);
    database.exec(`
      INSERT INTO order_guests_novo (id, order_id, guest_name, ticket_kind, checked_in_at, removed_at, removed_reason)
        SELECT id, order_id, guest_name, ticket_kind, checked_in_at, removed_at, removed_reason FROM order_guests;
    `);
    database.exec("DROP TABLE order_guests;");
    database.exec("ALTER TABLE order_guests_novo RENAME TO order_guests;");
    database.exec("COMMIT;");
  } catch (erro) {
    database.exec("ROLLBACK;");
    database.exec("PRAGMA foreign_keys=ON;");
    throw erro;
  }
  database.exec("PRAGMA foreign_keys=ON;");
  database.exec(`CREATE INDEX IF NOT EXISTS order_guests_order_idx ON order_guests(order_id);`);

  const depois = (database.prepare(`SELECT COUNT(*) AS n FROM order_guests`).get() as { n: number }).n;
  if (antes !== depois) throw new Error(`Migração de ingressos perdeu registros (${antes} -> ${depois}).`);
}
