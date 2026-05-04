/**
 * Full real-data ingestion for the Finanstilsynet (Norway) MCP server.
 *
 * Fetches verified regulatory data from:
 *   - finanstilsynet.no API (/api/search/nyhetsarkiv) — rundskriv, veiledninger
 *   - finanstilsynet.no individual pages — full text of each rundskriv/veiledning
 *   - finanstilsynet.no API (type 104) — tilsynsrapporter og vedtak (enforcement)
 *   - lovdata.no — key financial forskrifter (regulations)
 *
 * For rundskriv and veiledninger we now also:
 *   - parse the HTML article into numbered sections (provision_sections),
 *   - capture sidebar metadata (applies_to, replaces, source_url),
 *   - download every linked PDF and extract its text (provision_attachments).
 *
 * Usage:
 *   npx tsx scripts/ingest-all.ts
 *   npx tsx scripts/ingest-all.ts --force                # drop and recreate
 *   npx tsx scripts/ingest-all.ts --only=rundskriv       # subset for testing
 *   npx tsx scripts/ingest-all.ts --only=rundskriv,veiledninger,enforcement
 */

import Database from "@ansvar/mcp-sqlite";
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { SCHEMA_SQL } from "../src/db.js";
import {
  extractPdfText,
  extractRundskrivPage,
  type ExtractedAttachment,
} from "./lib/extract.js";

const DB_PATH = process.env["NO_FIN_DB_PATH"] ?? "data/no-fin.db";
const force = process.argv.includes("--force");

const STAGES = new Set(["rundskriv", "veiledninger", "enforcement", "forskrifter"]);
const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const enabledStages = onlyArg
  ? new Set(
      onlyArg
        .slice("--only=".length)
        .split(",")
        .map((s) => s.trim())
        .filter((s) => STAGES.has(s)),
    )
  : STAGES;

// Polite delay between Finanstilsynet requests; PDFs use a longer delay.
const DELAY_MS = 800;
const PDF_DELAY_MS = 1200;
// Skip PDFs larger than ~25MB to keep ingestion bounded.
const MAX_PDF_BYTES = 25 * 1024 * 1024;
// Truncate extracted PDF text to keep DB size reasonable.
const MAX_PDF_TEXT_CHARS = 200_000;
// Quality gate: if pdfjs returns fewer than this per page, the PDF is likely
// scanned/image-only or extraction failed. Norwegian rundskriv are typeset
// documents and easily yield 1000+ chars/page; 80 is a generous floor.
const MIN_PDF_CHARS_PER_PAGE = 80;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Bootstrap database ─────────────────────────────────────────────────────

const dir = dirname(DB_PATH);
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

if (force && existsSync(DB_PATH)) {
  unlinkSync(DB_PATH);
  console.log(`Deleted existing database at ${DB_PATH}`);
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(SCHEMA_SQL);

console.log(`Database initialised at ${DB_PATH}`);

// ── Sourcebooks ─────────────────────────────────────────────────────────────

const sourcebooks = [
  {
    id: "FTNO_FORSKRIFTER",
    name: "Finanstilsynet Forskrifter (Regulations/Ordinances)",
    description:
      "Binding regulations (forskrifter) issued under Norwegian financial legislation, sourced from Lovdata. Covers capital adequacy, risk management, governance, AML/CFT, reporting, and prudential requirements.",
  },
  {
    id: "FTNO_RUNDSKRIV",
    name: "Finanstilsynet Rundskriv (Circulars)",
    description:
      "Circulars (rundskriv) issued by Finanstilsynet communicating supervisory expectations, interpretive guidance, and practice standards. Finanstilsynet announced in 2025 that veiledninger will replace rundskriv going forward.",
  },
  {
    id: "FTNO_VEILEDNINGER",
    name: "Finanstilsynet Veiledninger (Guidance)",
    description:
      "Non-binding guidance documents (veiledninger) published by Finanstilsynet explaining the application and interpretation of Norwegian and EEA financial regulation.",
  },
];

const insertSourcebook = db.prepare(
  "INSERT OR IGNORE INTO sourcebooks (id, name, description) VALUES (?, ?, ?)",
);

for (const sb of sourcebooks) {
  insertSourcebook.run(sb.id, sb.name, sb.description);
}

console.log(`Inserted ${sourcebooks.length} sourcebooks`);

// ── Types ───────────────────────────────────────────────────────────────────

interface ApiHit {
  id: number;
  name: string;
  url: string;
  published: string;
  preamble: string;
  metaData: string;
}

interface ApiResponse {
  hits: ApiHit[];
  page: number;
  totalHits: number;
  totalPages: number;
  pageSize: number;
}

// ── HTTP helpers ────────────────────────────────────────────────────────────

const USER_AGENT =
  "AnsvarMCP/1.0 (compliance research; https://ansvar.eu)";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return (await res.json()) as T;
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

/**
 * Fetch a binary resource with bounded retries on transient errors.
 * Retries on network errors and HTTP 429/5xx with exponential backoff;
 * 4xx other than 429 fail fast (the URL is wrong or gone, not flaky).
 */
async function fetchBuffer(
  url: string,
  retries = 3,
): Promise<{ buffer: Buffer; bytes: number; contentType: string | null }> {
  let lastErr: Error | null = null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
      });
      if (!res.ok) {
        const transient = res.status === 429 || res.status >= 500;
        const err = new Error(`HTTP ${res.status} for ${url}`);
        if (!transient) throw err; // permanent → don't retry
        lastErr = err;
      } else {
        const buf = Buffer.from(await res.arrayBuffer());
        return {
          buffer: buf,
          bytes: buf.length,
          contentType: res.headers.get("content-type"),
        };
      }
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      // Permanent HTTP errors thrown above (status not in 429/5xx) bubble up.
      const msg = lastErr.message;
      const m = msg.match(/HTTP (\d+)/);
      if (m && m[1]) {
        const status = parseInt(m[1], 10);
        if (status !== 429 && status < 500) throw lastErr;
      }
    }
    if (attempt < retries) {
      const backoff = 2000 * 2 ** (attempt - 1); // 2s, 4s, 8s
      console.warn(
        `  fetchBuffer attempt ${attempt}/${retries} failed (${lastErr?.message}); retrying in ${backoff}ms`,
      );
      await sleep(backoff);
    }
  }
  throw lastErr ?? new Error(`fetchBuffer exhausted retries for ${url}`);
}

// ── Date / metadata helpers ─────────────────────────────────────────────────

function parseNorwegianDate(dateStr: string): string {
  const months: Record<string, string> = {
    januar: "01",
    februar: "02",
    mars: "03",
    april: "04",
    mai: "05",
    juni: "06",
    juli: "07",
    august: "08",
    september: "09",
    oktober: "10",
    november: "11",
    desember: "12",
  };

  const cleaned = dateStr.replace(/\./g, "").trim();
  const parts = cleaned.split(/\s+/);
  if (parts.length < 3) return dateStr;

  const day = (parts[0] ?? "").padStart(2, "0");
  const monthName = (parts[1] ?? "").toLowerCase();
  const year = parts[2] ?? "";
  const month = months[monthName];

  if (!month || !year) return dateStr;
  return `${year}-${month}-${day}`;
}

function parseMetaData(
  metaData: string,
  name: string,
): { type: "rundskriv" | "veiledning"; reference: string } {
  if (metaData === "Veiledning") return { type: "veiledning", reference: name };

  const match = metaData.match(/(?:Rundskriv(?:\/veiledninger)?)\s+(\d+\/\d{4})/);
  if (match?.[1]) return { type: "rundskriv", reference: `Rundskriv ${match[1]}` };

  return { type: "veiledning", reference: name };
}

// ── Prepared statements ─────────────────────────────────────────────────────

const insertProvision = db.prepare(`
  INSERT INTO provisions
    (sourcebook_id, reference, title, text, type, status,
     effective_date, chapter, section, source_url,
     applies_to, replaces, content_source)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertSection = db.prepare(`
  INSERT INTO provision_sections
    (provision_id, section_number, section_title, depth, ord, text)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const insertAttachment = db.prepare(`
  INSERT INTO provision_attachments
    (provision_id, url, mime_type, filename, text, pages, bytes)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const insertEnforcement = db.prepare(`
  INSERT INTO enforcement_actions
    (firm_name, reference_number, action_type, amount, date, summary, sourcebook_references)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

// ── Fetch all rundskriv/veiledninger ────────────────────────────────────────

interface IndexEntry extends ApiHit {
  resolvedType: "rundskriv" | "veiledning";
  resolvedReference: string;
  cleanUrl: string;
}

async function fetchIndex(): Promise<IndexEntry[]> {
  const baseUrl =
    "https://www.finanstilsynet.no/api/search/nyhetsarkiv?query=&t=59&language=no";

  const firstPage = await fetchJson<ApiResponse>(`${baseUrl}&page=1`);
  console.log(
    `Index: ${firstPage.totalHits} items across ${firstPage.totalPages} pages`,
  );

  const allHits: ApiHit[] = [...firstPage.hits];
  for (let page = 2; page <= firstPage.totalPages; page++) {
    await sleep(DELAY_MS);
    const pageData = await fetchJson<ApiResponse>(`${baseUrl}&page=${page}`);
    allHits.push(...pageData.hits);
  }

  return allHits.map((h) => {
    const { type, reference } = parseMetaData(h.metaData, h.name);
    return {
      ...h,
      resolvedType: type,
      resolvedReference: reference,
      cleanUrl: h.url.split("?")[0] ?? h.url,
    };
  });
}

async function ingestPdfAttachment(
  provisionId: number,
  attachment: ExtractedAttachment,
): Promise<{ ok: boolean; chars: number; pages: number; err?: string }> {
  let url: URL;
  try {
    url = new URL(attachment.url);
  } catch {
    insertAttachment.run(
      provisionId,
      attachment.url,
      attachment.mime_type,
      attachment.filename,
      null,
      null,
      null,
    );
    return { ok: false, chars: 0, pages: 0, err: "invalid url" };
  }

  // Only attempt PDF extraction for PDFs hosted on the canonical domain.
  if (
    attachment.mime_type !== "application/pdf" ||
    !url.hostname.endsWith("finanstilsynet.no")
  ) {
    insertAttachment.run(
      provisionId,
      attachment.url,
      attachment.mime_type,
      attachment.filename,
      null,
      null,
      null,
    );
    return { ok: false, chars: 0, pages: 0, err: "skipped (non-pdf or off-domain)" };
  }

  try {
    await sleep(PDF_DELAY_MS);
    const { buffer, bytes } = await fetchBuffer(attachment.url);
    if (bytes > MAX_PDF_BYTES) {
      insertAttachment.run(
        provisionId,
        attachment.url,
        attachment.mime_type,
        attachment.filename,
        `[Skipped: PDF is ${(bytes / 1024 / 1024).toFixed(1)}MB (>${MAX_PDF_BYTES / 1024 / 1024}MB cap)]`,
        null,
        bytes,
      );
      return { ok: false, chars: 0, pages: 0, err: `too large (${bytes} bytes)` };
    }
    const { text, pages } = await extractPdfText(buffer);

    // Quality gate: a typeset PDF should easily exceed ~1000 chars/page.
    // Falling well below that suggests the PDF is image-only (scanned) or
    // pdfjs failed to extract a text layer. Surface as a warning so it's
    // visible in the ingest log; we still store what we got, since even a
    // small amount of text (titles, headers) is better than nothing.
    const charsPerPage = pages > 0 ? text.length / pages : 0;
    const lowDensity = pages > 0 && charsPerPage < MIN_PDF_CHARS_PER_PAGE;
    if (lowDensity) {
      console.warn(
        `  ⚠ Low-density PDF for provision ${provisionId}: ${text.length} chars / ${pages} pages = ${charsPerPage.toFixed(0)} c/p — likely scanned or text-layer-less. ${attachment.url}`,
      );
    }

    let stored = text;
    if (stored.length > MAX_PDF_TEXT_CHARS) {
      stored =
        stored.slice(0, MAX_PDF_TEXT_CHARS) +
        `\n\n[Truncated — full PDF (${pages} pages) at ${attachment.url}]`;
    }
    if (lowDensity) {
      stored =
        `[Low text density: ${text.length} chars across ${pages} pages — PDF is likely scanned. The text below may be incomplete.]\n\n` +
        stored;
    }
    insertAttachment.run(
      provisionId,
      attachment.url,
      attachment.mime_type,
      attachment.filename,
      stored,
      pages,
      bytes,
    );
    return { ok: !lowDensity, chars: text.length, pages };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    insertAttachment.run(
      provisionId,
      attachment.url,
      attachment.mime_type,
      attachment.filename,
      `[PDF extraction failed: ${msg}]`,
      null,
      null,
    );
    return { ok: false, chars: 0, pages: 0, err: msg };
  }
}

async function ingestArticlePage(entry: IndexEntry): Promise<void> {
  const sourcebookId =
    entry.resolvedType === "rundskriv"
      ? "FTNO_RUNDSKRIV"
      : "FTNO_VEILEDNINGER";

  let extracted: ReturnType<typeof extractRundskrivPage> | null = null;

  try {
    await sleep(DELAY_MS);
    const html = await fetchHtml(entry.cleanUrl);
    extracted = extractRundskrivPage(html, entry.cleanUrl);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`  Warning: HTML fetch/parse failed for "${entry.name}": ${msg}`);
  }

  // Build the canonical text blob and pick a content_source label.
  let text = extracted?.full_text ?? "";
  let contentSource: "html_inline" | "html_with_pdf" | "pdf_only" | "preamble_only" =
    text.length > 1000 ? "html_inline" : "preamble_only";

  if (text.length < entry.preamble.length) {
    text = entry.preamble;
  }

  const effectiveDate = extracted?.published
    ? extracted.published.slice(0, 10)
    : parseNorwegianDate(entry.published);

  const title = (extracted?.title ?? entry.name).trim() || entry.name;

  const result = insertProvision.run(
    sourcebookId,
    entry.resolvedReference,
    title,
    text,
    entry.resolvedType,
    "in_force",
    effectiveDate,
    "",
    "",
    entry.cleanUrl,
    extracted?.applies_to ?? "",
    extracted?.replaces ?? "",
    contentSource,
  );
  const provisionId = Number(result.lastInsertRowid);

  // Persist sections.
  if (extracted) {
    let ord = 0;
    for (const sec of extracted.sections) {
      if (
        sec.section_number === "" &&
        sec.section_title === "" &&
        sec.text.trim() === ""
      ) {
        continue;
      }
      insertSection.run(
        provisionId,
        sec.section_number || null,
        sec.section_title || null,
        sec.depth,
        ord++,
        sec.text,
      );
    }
  }

  // Process attachments. PDF text gets appended to the provision text so
  // FTS over `provisions` returns the canonical body; the attachments table
  // remains the per-PDF system of record.
  let pdfChars = 0;
  let pdfCount = 0;
  if (extracted) {
    for (const att of extracted.attachments) {
      const r = await ingestPdfAttachment(provisionId, att);
      if (r.ok) {
        pdfChars += r.chars;
        pdfCount++;
      }
    }
  }

  if (pdfCount > 0) {
    contentSource = text.length > 1000 ? "html_with_pdf" : "pdf_only";
    const pdfRows = db
      .prepare<{ text: string | null; filename: string | null; url: string }>(
        `SELECT text, filename, url FROM provision_attachments
         WHERE provision_id = ? AND mime_type = 'application/pdf' AND text IS NOT NULL`,
      )
      .all(provisionId);
    const pdfBlocks: string[] = [];
    for (const row of pdfRows) {
      if (!row.text) continue;
      const header = `\n\n--- Attachment: ${row.filename || row.url} ---\n\n`;
      pdfBlocks.push(header + row.text);
    }
    const newText = (text + pdfBlocks.join("")).trim();
    db.prepare(
      "UPDATE provisions SET text = ?, content_source = ? WHERE id = ?",
    ).run(newText, contentSource, provisionId);
  } else {
    db.prepare("UPDATE provisions SET content_source = ? WHERE id = ?").run(
      contentSource,
      provisionId,
    );
  }

  console.log(
    `  ✓ ${entry.resolvedReference}: ${(extracted?.sections.length ?? 0)} sections, ${pdfCount} PDFs (+${pdfChars} chars)`,
  );
}

async function fetchAllRundskrivVeiledninger(): Promise<void> {
  const wantRundskriv = enabledStages.has("rundskriv");
  const wantVeiledninger = enabledStages.has("veiledninger");
  if (!wantRundskriv && !wantVeiledninger) return;

  console.log("\n--- Fetching rundskriv/veiledninger from Finanstilsynet API ---");

  const all = await fetchIndex();
  const target = all.filter(
    (e) =>
      (e.resolvedType === "rundskriv" && wantRundskriv) ||
      (e.resolvedType === "veiledning" && wantVeiledninger),
  );
  console.log(`Processing ${target.length} pages…`);

  let inserted = 0;
  let failed = 0;

  for (const entry of target) {
    try {
      await ingestArticlePage(entry);
      inserted++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`  Error ingesting "${entry.name}": ${msg}`);
      failed++;
    }
  }

  console.log(`Articles: ${inserted} ingested, ${failed} failed`);
}

// ── Fetch enforcement actions ───────────────────────────────────────────────

async function fetchEnforcementActions(): Promise<void> {
  if (!enabledStages.has("enforcement")) return;

  console.log("\n--- Fetching enforcement actions from Finanstilsynet API ---");

  const baseUrl =
    "https://www.finanstilsynet.no/api/search/nyhetsarkiv?query=&t=104&language=no";

  const firstPage = await fetchJson<ApiResponse>(`${baseUrl}&page=1`);
  console.log(
    `Total: ${firstPage.totalHits} enforcement reports across ${firstPage.totalPages} pages`,
  );

  const allHits: ApiHit[] = [...firstPage.hits];
  for (let page = 2; page <= firstPage.totalPages; page++) {
    await sleep(DELAY_MS);
    const pageData = await fetchJson<ApiResponse>(`${baseUrl}&page=${page}`);
    allHits.push(...pageData.hits);
  }

  console.log(`Fetched ${allHits.length} enforcement entries`);

  let inserted = 0;
  const insertAll = db.transaction(() => {
    for (const hit of allHits) {
      const lower = (hit.preamble + " " + hit.name).toLowerCase();
      let actionType = "inspection";
      if (lower.includes("overtredelsesgebyr") || lower.includes("gebyr")) {
        actionType = "fine";
      } else if (lower.includes("tilbakekall") || lower.includes("inndragning")) {
        actionType = "ban";
      } else if (lower.includes("advarsel") || lower.includes("åtvar")) {
        actionType = "warning";
      } else if (lower.includes("pålegg") || lower.includes("vilkår")) {
        actionType = "restriction";
      }
      insertEnforcement.run(
        hit.name,
        `FTNO/${hit.id}`,
        actionType,
        0,
        parseNorwegianDate(hit.published),
        hit.preamble,
        "",
      );
      inserted++;
    }
  });
  insertAll();
  console.log(`Enforcement actions: ${inserted} inserted`);
}

// ── Fetch ALL Finanstilsynet forskrifter from Lovdata public dataset ────────

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const LOVDATA_DATASET_URL =
  "https://api.lovdata.no/v1/publicData/get/gjeldende-sentrale-forskrifter.tar.bz2";

function plainTextFromForskriftHtml(html: string): string {
  let content = html;
  content = content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  content = content.replace(/<\/?(p|div|br|h[1-6]|li|tr)[^>]*>/gi, "\n");
  content = content.replace(/<[^>]+>/g, "");
  content = content
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#\d+;/g, "");
  return content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join("\n")
    .trim();
}

async function fetchForskrifter(): Promise<void> {
  if (!enabledStages.has("forskrifter")) return;

  console.log(
    "\n--- Fetching ALL Finanstilsynet forskrifter from Lovdata public dataset ---",
  );

  const tmpDir = "/tmp/lovdata-forskrifter";
  const tarFile = "/tmp/lovdata-forskrifter.tar.bz2";

  console.log("  Downloading Lovdata public dataset (~21MB)…");
  const response = await fetch(LOVDATA_DATASET_URL, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!response.ok) {
    throw new Error(`Failed to download Lovdata dataset: HTTP ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  writeFileSync(tarFile, buffer);
  console.log(`  Downloaded ${(buffer.length / 1024 / 1024).toFixed(1)}MB`);

  execFileSync("rm", ["-rf", tmpDir]);
  mkdirSync(tmpDir, { recursive: true });
  execFileSync("tar", ["xjf", tarFile, "-C", tmpDir]);

  const sfDir = join(tmpDir, "sf");
  const xmlFiles = readdirSync(sfDir).filter((f) => f.endsWith(".xml"));
  console.log(`  Dataset contains ${xmlFiles.length} forskrifter total`);

  let inserted = 0;
  let skipped = 0;

  for (const fname of xmlFiles) {
    const filePath = join(sfDir, fname);
    const content = readFileSync(filePath, "utf-8");

    if (
      !content.includes("<li>Finanstilsynet</li>") ||
      !content.includes("subunit")
    ) {
      continue;
    }

    const refMatch = content.match(/<dd class="legacyID">(FOR-[^<]+)/);
    const titleMatch = content.match(/<title>([^<]+)/);
    const dateMatch = content.match(/<dd class="dateInForce">([^<]+)/);

    const reference =
      refMatch?.[1] ?? fname.replace("sf-", "FOR-").replace(".xml", "");
    const title = titleMatch?.[1] ?? "Untitled forskrift";
    const effectiveDate = dateMatch?.[1] ?? "";

    let fullText = plainTextFromForskriftHtml(content);
    const lovdataUrl = `https://lovdata.no/dokument/SF/forskrift/${reference.replace("FOR-", "")}`;
    if (fullText.length > 50000) {
      fullText =
        fullText.slice(0, 50000) +
        `\n\n[Truncated — full text at ${lovdataUrl}]`;
    }
    if (fullText.length < 50) {
      console.warn(`  Skipping ${reference}: too short (${fullText.length} chars)`);
      skipped++;
      continue;
    }

    try {
      insertProvision.run(
        "FTNO_FORSKRIFTER",
        reference,
        title,
        fullText,
        "forskrift",
        "in_force",
        effectiveDate,
        "",
        "",
        lovdataUrl,
        "",
        "",
        "lovdata_xml",
      );
      inserted++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`  Error inserting ${reference}: ${msg}`);
      skipped++;
    }
  }

  execFileSync("rm", ["-rf", tmpDir, tarFile]);
  console.log(`Forskrifter: ${inserted} inserted, ${skipped} skipped`);
}

// ── Update coverage.json ────────────────────────────────────────────────────

function singleCount(sql: string): number {
  const row = db.prepare<{ cnt: number }>(sql).get();
  return row?.cnt ?? 0;
}

function updateCoverage(): void {
  const provisionCount = singleCount("SELECT count(*) as cnt FROM provisions");
  const sourcebookCount = singleCount("SELECT count(*) as cnt FROM sourcebooks");
  const enforcementCount = singleCount(
    "SELECT count(*) as cnt FROM enforcement_actions",
  );
  const ftsCount = singleCount("SELECT count(*) as cnt FROM provisions_fts");
  const sectionCount = singleCount(
    "SELECT count(*) as cnt FROM provision_sections",
  );
  const attachmentCount = singleCount(
    "SELECT count(*) as cnt FROM provision_attachments",
  );
  const pdfTextCount = singleCount(
    "SELECT count(*) as cnt FROM provision_attachments WHERE mime_type = 'application/pdf' AND text IS NOT NULL AND text NOT LIKE '[%'",
  );
  const rundskrivCount = singleCount(
    "SELECT count(*) as cnt FROM provisions WHERE sourcebook_id = 'FTNO_RUNDSKRIV'",
  );
  const veiledningCount = singleCount(
    "SELECT count(*) as cnt FROM provisions WHERE sourcebook_id = 'FTNO_VEILEDNINGER'",
  );
  const forskriftCount = singleCount(
    "SELECT count(*) as cnt FROM provisions WHERE sourcebook_id = 'FTNO_FORSKRIFTER'",
  );

  const now = new Date().toISOString().split("T")[0]!;

  const coverage = {
    schema_version: "1.1",
    mcp_name: "Norwegian Financial Regulation MCP",
    mcp_type: "domain_intelligence",
    coverage_date: now,
    database_version: "1.1.0",
    sources: [
      {
        id: "ftno_forskrifter",
        name: "Finanstilsynet Forskrifter (Regulations)",
        authority: "Lovdata / Finansdepartementet",
        url: "https://lovdata.no",
        item_count: forskriftCount,
        item_type: "provision",
        last_refresh: now,
        refresh_frequency: "quarterly",
      },
      {
        id: "ftno_rundskriv",
        name: "Finanstilsynet Rundskriv (Circulars)",
        authority: "Finanstilsynet",
        url: "https://www.finanstilsynet.no/nyhetsarkiv/rundskriv/",
        item_count: rundskrivCount,
        item_type: "provision",
        last_refresh: now,
        refresh_frequency: "quarterly",
      },
      {
        id: "ftno_veiledninger",
        name: "Finanstilsynet Veiledninger (Guidance)",
        authority: "Finanstilsynet",
        url: "https://www.finanstilsynet.no/nyhetsarkiv/rundskriv/",
        item_count: veiledningCount,
        item_type: "provision",
        last_refresh: now,
        refresh_frequency: "quarterly",
      },
      {
        id: "enforcement_actions",
        name: "Finanstilsynet Tilsynsrapporter og Vedtak",
        authority: "Finanstilsynet",
        url: "https://www.finanstilsynet.no/nyhetsarkiv/tilsynsrapporter/",
        item_count: enforcementCount,
        item_type: "enforcement_action",
        last_refresh: now,
        refresh_frequency: "quarterly",
      },
    ],
    structure: {
      total_provision_sections: sectionCount,
      total_attachments: attachmentCount,
      pdf_attachments_with_text: pdfTextCount,
    },
    summary: {
      total_sources: 4,
      total_items: provisionCount + enforcementCount,
      sourcebooks: sourcebookCount,
      fts_entries: ftsCount,
    },
  };

  writeFileSync("data/coverage.json", JSON.stringify(coverage, null, 2) + "\n");

  console.log(`\nDatabase summary:`);
  console.log(`  Sourcebooks:           ${sourcebookCount}`);
  console.log(`  Provisions:            ${provisionCount}`);
  console.log(`    Forskrifter:         ${forskriftCount}`);
  console.log(`    Rundskriv:           ${rundskrivCount}`);
  console.log(`    Veiledninger:        ${veiledningCount}`);
  console.log(`  Provision sections:    ${sectionCount}`);
  console.log(`  Attachments:           ${attachmentCount}`);
  console.log(`    PDFs w/ text:        ${pdfTextCount}`);
  console.log(`  Enforcement actions:   ${enforcementCount}`);
  console.log(`  FTS provision entries: ${ftsCount}`);
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("Starting real data ingestion from Finanstilsynet + Lovdata…\n");
  console.log(`Stages enabled: ${[...enabledStages].join(", ")}`);

  await fetchAllRundskrivVeiledninger();
  await fetchEnforcementActions();
  await fetchForskrifter();

  updateCoverage();

  db.close();
  console.log(`\nDone. Database ready at ${DB_PATH}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  db.close();
  process.exit(1);
});
