/**
 * SQLite database access layer for the Finanstilsynet MCP server.
 *
 * Schema mirrors the Norwegian Finanstilsynet regulatory structure:
 *   - sourcebooks            FTNO_FORSKRIFTER, FTNO_RUNDSKRIV, FTNO_VEILEDNINGER
 *   - provisions             individual forskrifter, rundskriv, veiledninger
 *   - provision_sections     numbered subsections of a rundskriv/veiledning
 *   - provision_attachments  PDFs (and other downloads) linked from a provision
 *   - enforcement_actions    Finanstilsynet enforcement decisions and fines
 *
 * FTS5 virtual tables back full-text search on provisions, sections, and
 * enforcement actions.
 */

import Database from "@ansvar/mcp-sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __db_dirname = dirname(fileURLToPath(import.meta.url));
// When compiled: dist/src/db.js → need ../../data/no-fin.db to reach project root
const DB_PATH =
  process.env["NO_FIN_DB_PATH"] ??
  join(__db_dirname, "..", "..", "data", "no-fin.db");

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS sourcebooks (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS provisions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  sourcebook_id   TEXT    NOT NULL,
  reference       TEXT    NOT NULL,
  title           TEXT,
  text            TEXT    NOT NULL,
  type            TEXT,
  status          TEXT    DEFAULT 'in_force',
  effective_date  TEXT,
  chapter         TEXT,
  section         TEXT,
  source_url      TEXT,
  applies_to      TEXT,
  replaces        TEXT,
  content_source  TEXT,
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

CREATE TABLE IF NOT EXISTS provision_sections (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  provision_id    INTEGER NOT NULL REFERENCES provisions(id) ON DELETE CASCADE,
  section_number  TEXT,
  section_title   TEXT,
  depth           INTEGER NOT NULL,
  ord             INTEGER NOT NULL,
  text            TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sections_provision ON provision_sections(provision_id);
CREATE INDEX IF NOT EXISTS idx_sections_number    ON provision_sections(section_number);

CREATE VIRTUAL TABLE IF NOT EXISTS provision_sections_fts USING fts5(
  section_number, section_title, text,
  content='provision_sections',
  content_rowid='id'
);

CREATE TRIGGER IF NOT EXISTS sections_ai AFTER INSERT ON provision_sections BEGIN
  INSERT INTO provision_sections_fts(rowid, section_number, section_title, text)
  VALUES (new.id, COALESCE(new.section_number, ''), COALESCE(new.section_title, ''), new.text);
END;

CREATE TRIGGER IF NOT EXISTS sections_ad AFTER DELETE ON provision_sections BEGIN
  INSERT INTO provision_sections_fts(provision_sections_fts, rowid, section_number, section_title, text)
  VALUES ('delete', old.id, COALESCE(old.section_number, ''), COALESCE(old.section_title, ''), old.text);
END;

CREATE TABLE IF NOT EXISTS provision_attachments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  provision_id  INTEGER NOT NULL REFERENCES provisions(id) ON DELETE CASCADE,
  url           TEXT    NOT NULL,
  mime_type     TEXT,
  filename      TEXT,
  text          TEXT,
  pages         INTEGER,
  bytes         INTEGER
);
CREATE INDEX IF NOT EXISTS idx_attachments_provision ON provision_attachments(provision_id);

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

export interface Sourcebook {
  id: string;
  name: string;
  description: string | null;
}

export interface Provision {
  id: number;
  sourcebook_id: string;
  reference: string;
  title: string | null;
  text: string;
  type: string | null;
  status: string;
  effective_date: string | null;
  chapter: string | null;
  section: string | null;
  source_url: string | null;
  applies_to: string | null;
  replaces: string | null;
  content_source: string | null;
}

export interface ProvisionSection {
  id: number;
  provision_id: number;
  section_number: string | null;
  section_title: string | null;
  depth: number;
  ord: number;
  text: string;
}

export interface ProvisionAttachment {
  id: number;
  provision_id: number;
  url: string;
  mime_type: string | null;
  filename: string | null;
  text: string | null;
  pages: number | null;
  bytes: number | null;
}

export interface EnforcementAction {
  id: number;
  firm_name: string;
  reference_number: string | null;
  action_type: string | null;
  amount: number | null;
  date: string | null;
  summary: string | null;
  sourcebook_references: string | null;
}

let _db: InstanceType<typeof Database> | null = null;

export function getDb(): InstanceType<typeof Database> {
  if (_db) return _db;

  const dir = dirname(DB_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  _db.exec(SCHEMA_SQL);

  return _db;
}

// --- Sourcebook queries ---

export function listSourcebooks(): Sourcebook[] {
  const db = getDb();
  return db
    .prepare<Sourcebook>("SELECT id, name, description FROM sourcebooks ORDER BY id")
    .all();
}

// --- Provision queries ---

export interface SearchProvisionsOptions {
  query: string;
  sourcebook?: string | undefined;
  status?: string | undefined;
  limit?: number | undefined;
}

export interface ProvisionSearchHit {
  id: number;
  sourcebook_id: string;
  reference: string;
  title: string | null;
  status: string;
  effective_date: string | null;
  source_url: string | null;
  snippet: string;
}

export function searchProvisions(
  opts: SearchProvisionsOptions,
): ProvisionSearchHit[] {
  const db = getDb();
  const limit = opts.limit ?? 20;

  const conditions: string[] = [];
  const params: Record<string, unknown> = { query: opts.query, limit };

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
    .prepare<ProvisionSearchHit>(
      `SELECT p.id, p.sourcebook_id, p.reference, p.title, p.status,
              p.effective_date, p.source_url,
              snippet(provisions_fts, -1, '«', '»', '…', 24) AS snippet
       FROM provisions_fts f
       JOIN provisions p ON p.id = f.rowid
       WHERE provisions_fts MATCH :query ${where}
       ORDER BY rank
       LIMIT :limit`,
    )
    .all(params);
}

export interface SectionSearchHit {
  section_id: number;
  provision_id: number;
  sourcebook_id: string;
  reference: string;
  provision_title: string | null;
  section_number: string | null;
  section_title: string | null;
  snippet: string;
}

export function searchProvisionSections(
  opts: SearchProvisionsOptions,
): SectionSearchHit[] {
  const db = getDb();
  const limit = opts.limit ?? 20;

  const conditions: string[] = [];
  const params: Record<string, unknown> = { query: opts.query, limit };

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
    .prepare<SectionSearchHit>(
      `SELECT s.id AS section_id, s.provision_id,
              p.sourcebook_id, p.reference,
              p.title AS provision_title,
              s.section_number, s.section_title,
              snippet(provision_sections_fts, -1, '«', '»', '…', 24) AS snippet
       FROM provision_sections_fts f
       JOIN provision_sections s ON s.id = f.rowid
       JOIN provisions p ON p.id = s.provision_id
       WHERE provision_sections_fts MATCH :query ${where}
       ORDER BY rank
       LIMIT :limit`,
    )
    .all(params);
}

export function getProvision(
  sourcebook: string,
  reference: string,
): Provision | null {
  const db = getDb();
  const row = db
    .prepare<Provision>(
      "SELECT * FROM provisions WHERE sourcebook_id = ? AND reference = ? LIMIT 1",
    )
    .get(sourcebook.toUpperCase(), reference);

  if (row) return row;

  return (
    db
      .prepare<Provision>(
        "SELECT * FROM provisions WHERE sourcebook_id = ? AND LOWER(reference) LIKE LOWER(?) LIMIT 1",
      )
      .get(sourcebook.toUpperCase(), `${reference}%`) ?? null
  );
}

export function getProvisionSections(provisionId: number): ProvisionSection[] {
  const db = getDb();
  return db
    .prepare<ProvisionSection>(
      `SELECT id, provision_id, section_number, section_title, depth, ord, text
       FROM provision_sections WHERE provision_id = ? ORDER BY ord`,
    )
    .all(provisionId);
}

export function getProvisionAttachments(
  provisionId: number,
): ProvisionAttachment[] {
  const db = getDb();
  return db
    .prepare<ProvisionAttachment>(
      `SELECT id, provision_id, url, mime_type, filename, text, pages, bytes
       FROM provision_attachments WHERE provision_id = ? ORDER BY id`,
    )
    .all(provisionId);
}

export function checkProvisionCurrency(reference: string): {
  reference: string;
  status: string;
  effective_date: string | null;
  found: boolean;
} {
  const db = getDb();
  const row = db
    .prepare<Pick<Provision, "reference" | "status" | "effective_date">>(
      "SELECT reference, status, effective_date FROM provisions WHERE reference = ? LIMIT 1",
    )
    .get(reference);

  if (!row) {
    return { reference, status: "unknown", effective_date: null, found: false };
  }

  return { ...row, found: true };
}

// --- Enforcement queries ---

export interface SearchEnforcementOptions {
  query: string;
  action_type?: string | undefined;
  limit?: number | undefined;
}

export function searchEnforcement(
  opts: SearchEnforcementOptions,
): EnforcementAction[] {
  const db = getDb();
  const limit = opts.limit ?? 20;

  if (opts.action_type) {
    return db
      .prepare<EnforcementAction>(
        `SELECT e.* FROM enforcement_fts f
         JOIN enforcement_actions e ON e.id = f.rowid
         WHERE enforcement_fts MATCH :query AND e.action_type = :action_type
         ORDER BY rank
         LIMIT :limit`,
      )
      .all({ query: opts.query, action_type: opts.action_type, limit });
  }

  return db
    .prepare<EnforcementAction>(
      `SELECT e.* FROM enforcement_fts f
       JOIN enforcement_actions e ON e.id = f.rowid
       WHERE enforcement_fts MATCH :query
       ORDER BY rank
       LIMIT :limit`,
    )
    .all({ query: opts.query, limit });
}
