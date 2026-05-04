/**
 * Extraction primitives for Finanstilsynet rundskriv/veiledning pages.
 *
 *   extractRundskrivPage(html, baseUrl) — parse an article page into a
 *     structured object with title, sections, attachments, applies_to,
 *     replaces, etc.
 *
 *   extractPdfText(buffer) — extract text from a PDF buffer using
 *     pdfjs-dist (no native modules, no canvas).
 */

import * as cheerio from "cheerio";
import type { Cheerio, CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";

// ── Types ───────────────────────────────────────────────────────────────────

export interface ExtractedSection {
  /** "1", "2.3", "" (untitled prelude) */
  section_number: string;
  /** Heading text without the leading number */
  section_title: string;
  /** Depth derived from section_number dot count, or 0 for prelude */
  depth: number;
  /** Body text under this heading (markdown-ish: links inline, lists as "- ...") */
  text: string;
}

export interface ExtractedAttachment {
  /** Absolute URL */
  url: string;
  /** Inferred from extension */
  mime_type: string;
  filename: string;
  /** The link's anchor text (often "<title> (pdf)") */
  link_text: string;
}

export interface ExtractedPage {
  title: string;
  /** Markdown-ish full body, useful as a single-blob fallback */
  full_text: string;
  sections: ExtractedSection[];
  attachments: ExtractedAttachment[];
  /** Bullet list of entity types under "Rundskrivet gjelder for" / "Gjelder for" */
  applies_to: string;
  /** Reference to a superseded rundskriv, e.g. "Rundskriv 1/2020" */
  replaces: string;
  /** ISO date from <meta property="article:published_time"> */
  published: string;
}

// ── HTML extraction ─────────────────────────────────────────────────────────

const STOP_HEADINGS = /^(utskriftsversjon|skriv ut|print)\s*$/i;

const APPLIES_TO_HEADINGS =
  /^(rundskrivet\s+gjeld(?:er)?\s+for|veiledningen?\s+gjeld(?:er)?\s+for|gjeld(?:er)?\s+for)\s*$/i;

/**
 * Resolve a relative URL against a base URL. Returns the original on error.
 */
function resolveUrl(href: string, base: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

/**
 * Parse a heading text like "2.3 Andre som skal egnethetsvurderes" into a
 * { number, title, depth } triple. If no leading number is present, depth
 * falls back to the provided headingLevel.
 */
function parseHeadingText(
  raw: string,
  headingLevel: number,
): { number: string; title: string; depth: number } {
  const text = raw.replace(/\s+/g, " ").trim();
  const m = text.match(/^(\d+(?:\.\d+)*)[\s. \-–—:]+(.+)$/);
  if (m && m[1] && m[2]) {
    const number = m[1];
    const title = m[2].trim();
    const depth = number.split(".").length;
    return { number, title, depth };
  }
  return { number: "", title: text, depth: headingLevel };
}

/**
 * Render a single block element (or an iterable of them) as markdown-ish
 * plain text. Links become "[text](url)", lists become "- item" lines,
 * paragraphs/divs become newline-separated text, tables collapse to TSV.
 */
function renderBlock(
  $: CheerioAPI,
  node: AnyNode,
  baseUrl: string,
): string {
  const $node = $(node);

  // Skip script/style/nav/footer entirely
  if (node.type === "tag") {
    const tag = node.name.toLowerCase();
    if (
      tag === "script" ||
      tag === "style" ||
      tag === "nav" ||
      tag === "footer" ||
      tag === "aside"
    ) {
      return "";
    }
  }

  if (node.type === "text") {
    return $node.text().replace(/\s+/g, " ");
  }

  if (node.type !== "tag") return "";

  const tag = node.name.toLowerCase();

  if (tag === "br") return "\n";

  if (tag === "a") {
    const inner = $node
      .text()
      .replace(/\s+/g, " ")
      .trim();
    const href = $node.attr("href");
    if (href && inner) {
      const absolute = resolveUrl(href, baseUrl);
      // Avoid noise from anchor links to the same page
      if (absolute === baseUrl || href.startsWith("#")) return inner;
      return `[${inner}](${absolute})`;
    }
    return inner;
  }

  if (tag === "ul" || tag === "ol") {
    const lines: string[] = [];
    $node.children("li").each((idx, li) => {
      const liText = renderInline($, li, baseUrl).trim();
      if (!liText) return;
      const prefix = tag === "ol" ? `${idx + 1}. ` : "- ";
      lines.push(prefix + liText);
    });
    return lines.join("\n");
  }

  if (tag === "li") {
    return renderInline($, node, baseUrl).trim();
  }

  if (tag === "table") {
    const rows: string[] = [];
    $node.find("tr").each((_, tr) => {
      const cells: string[] = [];
      $(tr)
        .find("th, td")
        .each((__, c) => {
          cells.push(renderInline($, c, baseUrl).trim());
        });
      if (cells.some((c) => c.length > 0)) rows.push(cells.join("\t"));
    });
    return rows.join("\n");
  }

  if (tag === "p" || tag === "div" || tag === "section" || tag === "article") {
    // Concatenate block-rendered children; if no block children produce
    // output, fall back to inline rendering.
    const parts: string[] = [];
    $node.contents().each((_, child) => {
      const rendered = renderBlock($, child, baseUrl);
      if (rendered) parts.push(rendered);
    });
    const joined = parts.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    return joined;
  }

  // Inline tags fall through to inline rendering
  return renderInline($, node, baseUrl);
}

/** Inline rendering: keep on one line, no list/table formatting. */
function renderInline(
  $: CheerioAPI,
  node: AnyNode,
  baseUrl: string,
): string {
  const parts: string[] = [];
  $(node)
    .contents()
    .each((_, child) => {
      if (child.type === "text") {
        parts.push($(child).text());
      } else if (child.type === "tag") {
        const tag = child.name.toLowerCase();
        if (tag === "br") {
          parts.push("\n");
        } else if (tag === "a") {
          const inner = $(child).text().replace(/\s+/g, " ").trim();
          const href = $(child).attr("href");
          if (href && inner) {
            const absolute = resolveUrl(href, baseUrl);
            parts.push(
              absolute === baseUrl || href.startsWith("#")
                ? inner
                : `[${inner}](${absolute})`,
            );
          } else {
            parts.push(inner);
          }
        } else {
          parts.push(renderInline($, child, baseUrl));
        }
      }
    });
  return parts.join("").replace(/[ \t]+/g, " ");
}

/**
 * Find every PDF / xlsx / docx link inside $container and append distinct
 * entries to `out`. URLs are deduplicated against existing entries in `out`.
 */
function collectAttachments(
  $: CheerioAPI,
  $container: Cheerio<AnyNode>,
  baseUrl: string,
  out: ExtractedAttachment[],
): void {
  const seen = new Set(out.map((a) => a.url));
  $container
    .find(
      'a[href$=".pdf"], a[href*=".pdf?"], a[href$=".xlsx"], a[href$=".docx"], a[href$=".doc"]',
    )
    .each((_, a) => {
      const href = $(a).attr("href");
      if (!href) return;
      const url = resolveUrl(href, baseUrl);
      if (seen.has(url)) return;
      seen.add(url);
      const linkText = $(a).text().replace(/\s+/g, " ").trim();
      const lower = url.toLowerCase().split("?")[0] ?? url.toLowerCase();
      const ext = lower.slice(lower.lastIndexOf(".") + 1);
      const mime =
        ext === "pdf"
          ? "application/pdf"
          : ext === "xlsx"
            ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            : ext === "docx"
              ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              : ext === "doc"
                ? "application/msword"
                : "application/octet-stream";
      const filename = decodeURIComponent(
        (lower.split("/").pop() ?? "").split("?")[0] ?? "",
      );
      out.push({ url, mime_type: mime, filename, link_text: linkText });
    });
}

/**
 * Walk the children of $article and split into sections by heading.
 * Returns [sections, attachments].
 */
function walkArticle(
  $: CheerioAPI,
  $article: Cheerio<AnyNode>,
  baseUrl: string,
): { sections: ExtractedSection[]; attachments: ExtractedAttachment[]; appliesTo: string } {
  const sections: ExtractedSection[] = [];
  const attachments: ExtractedAttachment[] = [];

  // The "prelude" — content before the first heading
  let current: ExtractedSection = {
    section_number: "",
    section_title: "",
    depth: 0,
    text: "",
  };
  const buffer: string[] = [];

  let appliesTo = "";
  let appliesToBuffer: string[] | null = null;

  let stopped = false;

  const flush = () => {
    const body = buffer.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    if (body || current.section_title || current.section_number) {
      sections.push({ ...current, text: body });
    }
    buffer.length = 0;
  };

  $article.children().each((_, el) => {
    if (stopped) return;
    if (el.type !== "tag") return;
    const tag = el.name.toLowerCase();
    const $el = $(el);

    if (/^h[1-6]$/.test(tag)) {
      const level = parseInt(tag.slice(1), 10);
      const headingText = $el.text().replace(/ /g, " ").replace(/\s+/g, " ").trim();

      // Stop sentinel — anything after "Utskriftsversjon" is post-content cruft
      if (STOP_HEADINGS.test(headingText)) {
        stopped = true;
        return;
      }

      // Special handling: "Gjelder for" / "Rundskrivet gjelder for" populates
      // appliesTo and is NOT recorded as a normal section.
      if (APPLIES_TO_HEADINGS.test(headingText)) {
        flush();
        appliesToBuffer = [];
        // We start a sentinel section so any subsequent non-applies-to
        // heading restores normal flow.
        current = {
          section_number: "__APPLIES_TO__",
          section_title: headingText,
          depth: level,
          text: "",
        };
        return;
      }

      // Real heading — flush previous section and start new
      if (appliesToBuffer) {
        appliesTo = appliesToBuffer.join("\n").trim();
        appliesToBuffer = null;
      }
      flush();
      const parsed = parseHeadingText(headingText, level);
      current = {
        section_number: parsed.number,
        section_title: parsed.title,
        depth: parsed.depth || level,
        text: "",
      };
      return;
    }

    // Body element
    const rendered = renderBlock($, el, baseUrl).trim();
    if (!rendered) return;
    if (appliesToBuffer) {
      appliesToBuffer.push(rendered);
    } else if (current.section_number === "__APPLIES_TO__") {
      // Defensive: shouldn't happen because we set appliesToBuffer in the
      // heading branch, but keep things consistent.
      appliesToBuffer = [rendered];
    } else {
      buffer.push(rendered);
    }
  });

  // Final flush. Cast widens the type that TS narrowed inside the each()
  // closure — the actual value may have been reassigned in there.
  const finalAppliesTo = appliesToBuffer as string[] | null;
  if (finalAppliesTo) {
    appliesTo = finalAppliesTo.join("\n").trim();
  }
  flush();

  // Drop any leftover sentinel rows (defensive)
  const cleanSections = sections.filter(
    (s) => s.section_number !== "__APPLIES_TO__",
  );

  return { sections: cleanSections, attachments, appliesTo };
}

/**
 * Extract a Finanstilsynet rundskriv/veiledning page into a structured form.
 * `baseUrl` is used to resolve relative hrefs and as the canonical link.
 */
export function extractRundskrivPage(
  html: string,
  baseUrl: string,
): ExtractedPage {
  const $ = cheerio.load(html);

  const title = $("article h1").first().text().replace(/\s+/g, " ").trim() ||
    $("h1").first().text().replace(/\s+/g, " ").trim() ||
    $('meta[property="og:title"]').attr("content") ||
    "";

  const published =
    $('meta[property="article:published_time"]').attr("content") ?? "";

  // The whole article container — used for scanning attachments and the
  // free-text "erstatter ... rundskriv N/YYYY" supersession pattern. PDF
  // links typically sit in the print/sidebar block under <article> rather
  // than inside the main body.
  let $articleRoot: Cheerio<AnyNode> = $("article").first() as unknown as Cheerio<AnyNode>;
  if ($articleRoot.length === 0) {
    $articleRoot = $("main").first() as unknown as Cheerio<AnyNode>;
  }
  if ($articleRoot.length === 0) {
    $articleRoot = $("body") as unknown as Cheerio<AnyNode>;
  }

  // The body container — the actual rundskriv text with numbered headings.
  // Finanstilsynet wraps the body in <div id="articleMainBody"> a few levels
  // deep inside <article>; iterating direct children of <article> only
  // yields wrapper divs.
  let $body: Cheerio<AnyNode> = $("#articleMainBody").first() as unknown as Cheerio<AnyNode>;
  if ($body.length === 0) {
    $body = $("article .article--bodytext").first() as unknown as Cheerio<AnyNode>;
  }
  if ($body.length === 0) {
    $body = $articleRoot;
  }

  // Strip share buttons / breadcrumbs from BOTH containers before scanning.
  for (const $c of [$articleRoot, $body]) {
    $c
      .find(
        "[data-component='ShareButtons'], .breadcrumb, .breadcrumbs, .navigation",
      )
      .remove();
  }

  const { sections, attachments, appliesTo } = walkArticle($, $body, baseUrl);

  // Re-scan attachments at the full-article level (PDF links typically live
  // in a "Utskriftsversjon" sibling block outside the body container).
  collectAttachments($, $articleRoot, baseUrl, attachments);

  // Build the markdown-ish full text from sections
  const body: string[] = [];
  for (const sec of sections) {
    if (sec.section_number === "" && sec.section_title === "") {
      if (sec.text) body.push(sec.text);
      continue;
    }
    const depth = Math.min(Math.max(sec.depth, 1), 6);
    const heading =
      "#".repeat(depth) +
      " " +
      (sec.section_number
        ? `${sec.section_number} ${sec.section_title}`
        : sec.section_title);
    body.push(heading);
    if (sec.text) body.push(sec.text);
  }
  const fullText = body.join("\n\n").trim();

  // "Replaces" — scan full article text for "erstatter ... rundskriv X/YYYY"
  const articleText = $articleRoot.text();
  const replacesMatch = articleText.match(
    /erstatter[^.]{0,200}?(?:Finanstilsynets\s+)?[Rr]undskriv\s+(\d+\/\d{4})/,
  );
  const replaces = replacesMatch?.[1]
    ? `Rundskriv ${replacesMatch[1]}`
    : "";

  return {
    title,
    full_text: fullText,
    sections,
    attachments,
    applies_to: appliesTo,
    replaces,
    published,
  };
}

// ── PDF extraction ──────────────────────────────────────────────────────────

interface PdfTextItem {
  str: string;
  transform: number[];
  hasEOL?: boolean;
  width?: number;
  height?: number;
}

let pdfjsModule: typeof import("pdfjs-dist/legacy/build/pdf.mjs") | null = null;

async function loadPdfjs(): Promise<typeof import("pdfjs-dist/legacy/build/pdf.mjs")> {
  if (pdfjsModule) return pdfjsModule;
  // Suppress pdfjs verbose console output
  const mod = (await import(
    "pdfjs-dist/legacy/build/pdf.mjs"
  )) as typeof import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjsModule = mod;
  return mod;
}

/**
 * Extract text from a PDF buffer. Uses pdfjs-dist's legacy build (no worker,
 * no canvas, no native modules). Groups items by Y coordinate to preserve
 * line breaks; pages are separated by blank lines.
 */
export async function extractPdfText(
  buffer: Buffer | Uint8Array,
): Promise<{ text: string; pages: number }> {
  const pdfjsLib = await loadPdfjs();
  const data =
    buffer instanceof Uint8Array
      ? new Uint8Array(buffer)
      : new Uint8Array(buffer);

  const loadingTask = pdfjsLib.getDocument({
    data,
    disableFontFace: true,
    isEvalSupported: false,
    useSystemFonts: false,
    verbosity: 0,
  });
  const doc = await loadingTask.promise;

  const pageTexts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const lines: string[] = [];
    let currentLine = "";
    let lastY: number | null = null;
    let lastX: number | null = null;
    for (const raw of content.items as unknown as PdfTextItem[]) {
      if (typeof raw.str !== "string") continue;
      const y = Math.round(raw.transform?.[5] ?? 0);
      const x = raw.transform?.[4] ?? 0;
      if (lastY !== null && Math.abs(y - lastY) > 1) {
        lines.push(currentLine);
        currentLine = "";
        lastX = null;
      }
      // Insert a space if we're continuing a line and there's a horizontal gap
      if (
        lastX !== null &&
        currentLine.length > 0 &&
        x - lastX > (raw.height ?? 6) &&
        !currentLine.endsWith(" ")
      ) {
        currentLine += " ";
      }
      currentLine += raw.str;
      if (raw.hasEOL) {
        lines.push(currentLine);
        currentLine = "";
        lastY = null;
        lastX = null;
      } else {
        lastY = y;
        lastX = x + (raw.width ?? 0);
      }
    }
    if (currentLine.length > 0) lines.push(currentLine);

    // Collapse triple+ blank lines and trim
    const pageText = lines
      .map((l) => l.replace(/[ \t]+/g, " ").trimEnd())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    pageTexts.push(pageText);
    // Free page resources
    page.cleanup();
  }
  await doc.destroy();

  return {
    text: pageTexts.join("\n\n").trim(),
    pages: doc.numPages,
  };
}
