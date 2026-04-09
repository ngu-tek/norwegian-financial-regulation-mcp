/**
 * Seed the Finanstilsynet (Norway) database with sample provisions for testing.
 *
 * Inserts representative provisions from FTNO_FORSKRIFTER, FTNO_RUNDSKRIV,
 * and FTNO_VEILEDNINGER sourcebooks so MCP tools can be tested
 * without running a full data ingestion pipeline.
 *
 * Usage:
 *   npx tsx scripts/seed-sample.ts
 *   npx tsx scripts/seed-sample.ts --force   # drop and recreate
 */

import Database from "@ansvar/mcp-sqlite";
import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { dirname } from "node:path";
import { SCHEMA_SQL } from "../src/db.js";

const DB_PATH = process.env["NO_FIN_DB_PATH"] ?? "data/no-fin.db";
const force = process.argv.includes("--force");

// -- Bootstrap database --

const dir = dirname(DB_PATH);
if (!existsSync(dir)) {
  mkdirSync(dir, { recursive: true });
}

if (force && existsSync(DB_PATH)) {
  unlinkSync(DB_PATH);
  console.log(`Deleted existing database at ${DB_PATH}`);
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(SCHEMA_SQL);

console.log(`Database initialised at ${DB_PATH}`);

// -- Sourcebooks --

interface SourcebookRow {
  id: string;
  name: string;
  description: string;
}

const sourcebooks: SourcebookRow[] = [
  {
    id: "FTNO_FORSKRIFTER",
    name: "Finanstilsynet Forskrifter (Regulations/Ordinances)",
    description:
      "Binding regulations (forskrifter) issued under Norwegian financial legislation. Covers capital adequacy, risk management, governance, AML/CFT, reporting obligations, consumer protection, and prudential requirements for banks, insurance companies, investment firms, payment institutions, and other regulated entities supervised by Finanstilsynet.",
  },
  {
    id: "FTNO_RUNDSKRIV",
    name: "Finanstilsynet Rundskriv (Circulars)",
    description:
      "Circulars (rundskriv) issued by Finanstilsynet as the primary regulatory instrument for communicating supervisory expectations, interpretive guidance, and practice standards to regulated entities. Covers ICT security, operational resilience, outsourcing, ICAAP/ILAAP, Solvency II, DORA implementation, and sector-specific supervisory requirements.",
  },
  {
    id: "FTNO_VEILEDNINGER",
    name: "Finanstilsynet Veiledninger (Guidance)",
    description:
      "Non-binding guidance documents (veiledninger) published by Finanstilsynet explaining the application and interpretation of Norwegian and EEA financial regulation. Covers risk assessment methodology, compliance expectations, reporting formats, and implementation guidance for EU/EEA directives and regulations transposed into Norwegian law.",
  },
];

const insertSourcebook = db.prepare(
  "INSERT OR IGNORE INTO sourcebooks (id, name, description) VALUES (?, ?, ?)",
);

for (const sb of sourcebooks) {
  insertSourcebook.run(sb.id, sb.name, sb.description);
}

console.log(`Inserted ${sourcebooks.length} sourcebooks`);

// -- Sample provisions --

interface ProvisionRow {
  sourcebook_id: string;
  reference: string;
  title: string;
  text: string;
  type: string;
  status: string;
  effective_date: string;
  chapter: string;
  section: string;
}

const provisions: ProvisionRow[] = [
  // -- FTNO_FORSKRIFTER -- Regulations --
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2006-12-14-1506",
    title: "Forskrift om kapitaldekning og risikovekting (CRR/CRD IV-forskriften)",
    text: "Denne forskriften gjennomforer EUs kapitaldekningsregelverk (CRR/CRD IV) i norsk rett gjennom EOS-avtalen. Banker, kredittforetak og verdipapirforetak skal til enhver tid ha ansvarlig kapital som utgjor minst atte prosent av beregningsgrunnlaget (risikovektede eiendeler). Institusjoner skal ha betryggende prosesser for vurdering av samlet kapitalbehov (ICAAP) i forhold til risikoprofil, og strategier for a opprettholde kapitalniva. Finanstilsynet kan fastsette individuelle tilleggskrav til kapitaldekning basert pa tilsynsmessig vurdering (pilar 2). Forskriften omfatter kreditrisiko, markedsrisiko, operasjonell risiko, konsentrasjonsrisiko og systemrisiko. Institusjoner skal rapportere kapitaldekningen kvartalsvis til Finanstilsynet.",
    type: "forskrift",
    status: "in_force",
    effective_date: "2007-01-01",
    chapter: "1",
    section: "1",
  },
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2009-03-13-302",
    title: "Forskrift om IKT-sikkerhet i finanssektoren (IKT-forskriften)",
    text: "Forskriften stiller krav til informasjons- og kommunikasjonsteknologi (IKT) i finansforetak. Foretakene skal ha en IKT-strategi godkjent av styret, en risikobasert tilnaerming til IKT-sikkerhet, og dokumenterte prosesser for tilgangskontroll, endringshaandtering, hendelseshaandtering og kontinuitetsplanlegging. Foretaket skal gjennomfore regelmessige IKT-risikovurderinger og sarbarhetstester, herunder penetrasjonstesting av kritiske systemer. Utkontraktering av IKT-tjenester skal vurderes mot operasjonell risiko og foretakets evne til a opprettholde forsvarlig drift. Finanstilsynet skal varsles ved vesentlige IKT-hendelser uten ugrunnet opphold.",
    type: "forskrift",
    status: "in_force",
    effective_date: "2009-04-01",
    chapter: "1",
    section: "1",
  },
  // -- FTNO_RUNDSKRIV -- Circulars --
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 14/2021",
    title: "Veiledning om hvitvaskingsregelverket for finansforetak",
    text: "Dette rundskrivet gir Finanstilsynets forventninger til finansforetaks etterlevelse av hvitvaskingsloven og hvitvaskingsforskriften. Foretakene skal gjennomfore en virksomhetsinnrettet risikovurdering av risikoen for hvitvasking og terrorfinansiering, og etablere risikobaserte rutiner for kundetiltak (KYC), lopende oppfolging, og rapportering av mistenkelige transaksjoner til Okonomisk politienhet (Okokrim). Foretaket skal ha en hvitvaskingsansvarlig med tilstrekkelig myndighet og ressurser. Styret skal holdes orientert om hvitvaskingsrisiko og etterlevelse. Rundskrivet beskriver forventninger til forsterket kundetiltak overfor politisk eksponerte personer (PEP), korrespondentbankforbindelser, og hoyrisikoland identifisert av FATF.",
    type: "rundskriv",
    status: "in_force",
    effective_date: "2021-06-15",
    chapter: "1",
    section: "1",
  },
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 3/2023",
    title: "Digital operasjonell motstandsdyktighet (DORA) — forberedelse",
    text: "Rundskrivet orienterer om Europaparlaments- og radsforordning (EU) 2022/2554 om digital operasjonell motstandsdyktighet i finanssektoren (DORA), som vil bli gjennomfort i norsk rett gjennom EOS-avtalen. Finansforetak skal etablere et rammeverk for IKT-risikostyring med klart definerte roller og ansvar, kartlegging av IKT-eiendeler og kritiske funksjoner, krav til forretningskontinuitet og gjenoppretting etter katastrofe, samt periodisk testing av digital motstandsdyktighet. Tilbydere av kritiske tredjepartstjenester vil bli underlagt direkte tilsyn av europeiske tilsynsmyndigheter. Finanstilsynet forventer at finansforetak forbereder seg pa full DORA-etterlevelse innen januar 2025.",
    type: "rundskriv",
    status: "in_force",
    effective_date: "2023-03-01",
    chapter: "1",
    section: "1",
  },
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 9/2019",
    title: "Retningslinjer for utkontraktering i finansforetak",
    text: "Dette rundskrivet beskriver Finanstilsynets forventninger til finansforetaks utkontraktering av virksomhet. Foretaket skal sikre at utkontraktering ikke svekker kvaliteten pa intern kontroll eller Finanstilsynets mulighet til a fore tilsyn. Kritiske eller vesentlige funksjoner som utkontrakteres krever forutgaende melding til Finanstilsynet. Foretaket forblir fullt ansvarlig for de utkontrakterte oppgavene. Avtaler om utkontraktering skal inneholde bestemmelser om tilgang og revisjonsrett, databehandling, forretningskontinuitet og exitstrategier. Foretaket skal gjennomfore tilstrekkelig due diligence av tjenesteytere og ha lopende overvakning av tjenestekvalitet og risiko.",
    type: "rundskriv",
    status: "in_force",
    effective_date: "2019-10-01",
    chapter: "1",
    section: "1",
  },
  // -- FTNO_VEILEDNINGER -- Guidance --
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning 2022-01",
    title: "Veiledning om Solvens II-rapportering for forsikringsforetak",
    text: "Denne veiledningen beskriver Finanstilsynets forventninger til forsikringsforetaks rapportering under Solvens II-regelverket, som er gjennomfort i norsk rett gjennom EOS-avtalen. Foretakene skal rapportere solvenskapitalkrav (SCR), minimumskapitalkrav (MCR), egen risikovurdering (ORSA), og tekniske avsetninger til Finanstilsynet i henhold til fastsatte tidsfrister og formater. Veiledningen dekker beregningsmetoder for standardformelen og interne modeller, samt krav til kvalitetssikring av data og aktuariell funksjon. Foretakene skal ha betryggende prosesser for a sikre at rapporterte data er fullstendige, noyaktige og konsistente.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2022-01-15",
    chapter: "1",
    section: "1",
  },
];

const insertProvision = db.prepare(`
  INSERT INTO provisions (sourcebook_id, reference, title, text, type, status, effective_date, chapter, section)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertAll = db.transaction(() => {
  for (const p of provisions) {
    insertProvision.run(
      p.sourcebook_id,
      p.reference,
      p.title,
      p.text,
      p.type,
      p.status,
      p.effective_date,
      p.chapter,
      p.section,
    );
  }
});

insertAll();

console.log(`Inserted ${provisions.length} sample provisions`);

// -- Sample enforcement actions --

interface EnforcementRow {
  firm_name: string;
  reference_number: string;
  action_type: string;
  amount: number;
  date: string;
  summary: string;
  sourcebook_references: string;
}

const enforcements: EnforcementRow[] = [
  {
    firm_name: "DNB Bank ASA",
    reference_number: "FTNO/2023/042",
    action_type: "fine",
    amount: 400_000_000,
    date: "2023-06-14",
    summary:
      "Finanstilsynet ila DNB Bank ASA et overtredelsesgebyr pa 400 millioner kroner for brudd pa hvitvaskingsloven. Tilsynet konstaterte at banken over en lengre periode ikke hadde tilstrekkelige systemer og rutiner for a avdekke og rapportere mistenkelige transaksjoner. Banken hadde mangelfulle prosesser for kundetiltak, lopende oppfolging av eksisterende kundeforhold, og forsinket rapportering til Okokrim. Gebyret gjenspeiler overtredelsens alvorlighetsgrad, varighet og den potensielle risikoen for misbruk av det finansielle systemet.",
    sourcebook_references: "Rundskriv 14/2021",
  },
  {
    firm_name: "Nordisk Forsikring AS",
    reference_number: "FTNO/2024/008",
    action_type: "warning",
    amount: 0,
    date: "2024-02-20",
    summary:
      "Finanstilsynet ga Nordisk Forsikring AS en offentlig advarsel etter stedlig tilsyn avdekket alvorlige mangler i foretakets IKT-sikkerhet. Tilsynet konstaterte mangelfull tilgangskontroll til kritiske systemer, manglende gjennomforing av penetrasjonstester, og utilstrekkelig hendelseshaandtering. Foretaket fikk frist pa seks maneder til a bringe IKT-sikkerheten i samsvar med IKT-forskriften og rapportere gjennomforte tiltak til Finanstilsynet.",
    sourcebook_references: "FOR-2009-03-13-302",
  },
];

const insertEnforcement = db.prepare(`
  INSERT INTO enforcement_actions (firm_name, reference_number, action_type, amount, date, summary, sourcebook_references)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const insertEnforcementsAll = db.transaction(() => {
  for (const e of enforcements) {
    insertEnforcement.run(
      e.firm_name,
      e.reference_number,
      e.action_type,
      e.amount,
      e.date,
      e.summary,
      e.sourcebook_references,
    );
  }
});

insertEnforcementsAll();

console.log(`Inserted ${enforcements.length} sample enforcement actions`);

// -- Summary --

const provisionCount = (
  db.prepare("SELECT count(*) as cnt FROM provisions").get() as { cnt: number }
).cnt;
const sourcebookCount = (
  db.prepare("SELECT count(*) as cnt FROM sourcebooks").get() as { cnt: number }
).cnt;
const enforcementCount = (
  db.prepare("SELECT count(*) as cnt FROM enforcement_actions").get() as { cnt: number }
).cnt;
const ftsCount = (
  db.prepare("SELECT count(*) as cnt FROM provisions_fts").get() as { cnt: number }
).cnt;

console.log(`\nDatabase summary:`);
console.log(`  Sourcebooks:          ${sourcebookCount}`);
console.log(`  Provisions:           ${provisionCount}`);
console.log(`  Enforcement actions:  ${enforcementCount}`);
console.log(`  FTS entries:          ${ftsCount}`);
console.log(`\nDone. Database ready at ${DB_PATH}`);

db.close();
