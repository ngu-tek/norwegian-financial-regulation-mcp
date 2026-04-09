/**
 * SQLite database access layer for the Finanstilsynet MCP server.
 *
 * Schema mirrors the Norwegian Finanstilsynet regulatory structure:
 *   - sourcebooks        — FTNO_FORSKRIFTER, FTNO_RUNDSKRIV, FTNO_VEILEDNINGER
 *   - provisions         — individual forskrifter, rundskriv, and veiledninger provisions
 *   - enforcement_actions — Finanstilsynet enforcement decisions and administrative fines
 *
 * FTS5 virtual tables back full-text search on provisions and enforcement actions.
 */
import Database from "@ansvar/mcp-sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { seedDatabase } from "./seed.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PKG_ROOT = join(__dirname, "..");
const DB_PATH = process.env["NO_FIN_DB_PATH"] ?? join(PKG_ROOT, "data", "no-fin.db");
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS sourcebooks (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS provisions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  sourcebook_id  TEXT    NOT NULL,
  reference      TEXT    NOT NULL,
  title          TEXT,
  text           TEXT    NOT NULL,
  type           TEXT,
  status         TEXT    DEFAULT 'in_force',
  effective_date TEXT,
  chapter        TEXT,
  section        TEXT,
  FOREIGN KEY (sourcebook_id) REFERENCES sourcebooks(id)
);

CREATE INDEX IF NOT EXISTS idx_provisions_sourcebook ON provisions(sourcebook_id);
CREATE INDEX IF NOT EXISTS idx_provisions_reference  ON provisions(reference);
CREATE INDEX IF NOT EXISTS idx_provisions_status     ON provisions(status);

CREATE VIRTUAL TABLE IF NOT EXISTS provisions_fts USING fts5(
  reference, title, text,
  content='provisions',
  content_rowid='id'
);

CREATE TRIGGER IF NOT EXISTS provisions_ai AFTER INSERT ON provisions BEGIN
  INSERT INTO provisions_fts(rowid, reference, title, text)
  VALUES (new.id, new.reference, COALESCE(new.title, ''), new.text);
END;

CREATE TRIGGER IF NOT EXISTS provisions_ad AFTER DELETE ON provisions BEGIN
  INSERT INTO provisions_fts(provisions_fts, rowid, reference, title, text)
  VALUES ('delete', old.id, old.reference, COALESCE(old.title, ''), old.text);
END;

CREATE TRIGGER IF NOT EXISTS provisions_au AFTER UPDATE ON provisions BEGIN
  INSERT INTO provisions_fts(provisions_fts, rowid, reference, title, text)
  VALUES ('delete', old.id, old.reference, COALESCE(old.title, ''), old.text);
  INSERT INTO provisions_fts(rowid, reference, title, text)
  VALUES (new.id, new.reference, COALESCE(new.title, ''), new.text);
END;

CREATE TABLE IF NOT EXISTS enforcement_actions (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  firm_name             TEXT    NOT NULL,
  reference_number      TEXT,
  action_type           TEXT,
  amount                REAL,
  date                  TEXT,
  summary               TEXT,
  sourcebook_references TEXT
);

CREATE INDEX IF NOT EXISTS idx_enforcement_date ON enforcement_actions(date);
CREATE INDEX IF NOT EXISTS idx_enforcement_type ON enforcement_actions(action_type);

CREATE VIRTUAL TABLE IF NOT EXISTS enforcement_fts USING fts5(
  firm_name, summary,
  content='enforcement_actions',
  content_rowid='id'
);

CREATE TRIGGER IF NOT EXISTS enforcement_ai AFTER INSERT ON enforcement_actions BEGIN
  INSERT INTO enforcement_fts(rowid, firm_name, summary)
  VALUES (new.id, new.firm_name, COALESCE(new.summary, ''));
END;

CREATE TRIGGER IF NOT EXISTS enforcement_ad AFTER DELETE ON enforcement_actions BEGIN
  INSERT INTO enforcement_fts(enforcement_fts, rowid, firm_name, summary)
  VALUES ('delete', old.id, old.firm_name, COALESCE(old.summary, ''));
END;

CREATE TRIGGER IF NOT EXISTS enforcement_au AFTER UPDATE ON enforcement_actions BEGIN
  INSERT INTO enforcement_fts(enforcement_fts, rowid, firm_name, summary)
  VALUES ('delete', old.id, old.firm_name, COALESCE(old.summary, ''));
  INSERT INTO enforcement_fts(rowid, firm_name, summary)
  VALUES (new.id, new.firm_name, COALESCE(new.summary, ''));
END;
`;
let _db = null;
export function getDb() {
    if (_db)
        return _db;
    const dir = dirname(DB_PATH);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    _db.exec(SCHEMA_SQL);
    seedDatabase(_db);
    return _db;
}
// --- Sourcebook queries ---
export function listSourcebooks() {
    const db = getDb();
    return db
        .prepare("SELECT id, name, description FROM sourcebooks ORDER BY id")
        .all();
}
export function searchProvisions(opts) {
    const db = getDb();
    const limit = opts.limit ?? 20;
    if (opts.sourcebook ?? opts.status) {
        const conditions = [];
        const params = { query: opts.query, limit };
        if (opts.sourcebook) {
            conditions.push("p.sourcebook_id = :sourcebook");
            params["sourcebook"] = opts.sourcebook.toUpperCase();
        }
        if (opts.status) {
            conditions.push("p.status = :status");
            params["status"] = opts.status;
        }
        const where = conditions.length > 0 ? `AND ${conditions.join(" AND ")}` : "";
        return db
            .prepare(`SELECT p.* FROM provisions_fts f
         JOIN provisions p ON p.id = f.rowid
         WHERE provisions_fts MATCH :query ${where}
         ORDER BY rank
         LIMIT :limit`)
            .all(params);
    }
    return db
        .prepare(`SELECT p.* FROM provisions_fts f
       JOIN provisions p ON p.id = f.rowid
       WHERE provisions_fts MATCH :query
       ORDER BY rank
       LIMIT :limit`)
        .all({ query: opts.query, limit });
}
export function getProvision(sourcebook, reference) {
    const db = getDb();
    const row = db
        .prepare("SELECT * FROM provisions WHERE sourcebook_id = ? AND reference = ? LIMIT 1")
        .get(sourcebook.toUpperCase(), reference);
    if (row)
        return row;
    return (db
        .prepare("SELECT * FROM provisions WHERE sourcebook_id = ? AND LOWER(reference) LIKE LOWER(?) LIMIT 1")
        .get(sourcebook.toUpperCase(), `${reference}%`) ??
        null);
}
export function checkProvisionCurrency(reference) {
    const db = getDb();
    const row = db
        .prepare("SELECT reference, status, effective_date FROM provisions WHERE reference = ? LIMIT 1")
        .get(reference);
    if (!row) {
        return { reference, status: "unknown", effective_date: null, found: false };
    }
    return { ...row, found: true };
}
export function searchEnforcement(opts) {
    const db = getDb();
    const limit = opts.limit ?? 20;
    if (opts.action_type) {
        return db
            .prepare(`SELECT e.* FROM enforcement_fts f
         JOIN enforcement_actions e ON e.id = f.rowid
         WHERE enforcement_fts MATCH :query AND e.action_type = :action_type
         ORDER BY rank
         LIMIT :limit`)
            .all({ query: opts.query, action_type: opts.action_type, limit });
    }
    return db
        .prepare(`SELECT e.* FROM enforcement_fts f
       JOIN enforcement_actions e ON e.id = f.rowid
       WHERE enforcement_fts MATCH :query
       ORDER BY rank
       LIMIT :limit`)
        .all({ query: opts.query, limit });
}
