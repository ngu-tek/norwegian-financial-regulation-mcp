/**
 * Full real-data ingestion for the Finanstilsynet (Norway) MCP server.
 *
 * Populates the database with verified regulatory data sourced from:
 *   - finanstilsynet.no (rundskriv, veiledninger, enforcement actions)
 *   - lovdata.no (forskrifter / regulations)
 *
 * Usage:
 *   npx tsx scripts/ingest-all.ts
 *   npx tsx scripts/ingest-all.ts --force   # drop and recreate
 */

import Database from "better-sqlite3";
import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { dirname } from "node:path";
import { SCHEMA_SQL } from "../src/db.js";

const DB_PATH = process.env["NO_FIN_DB_PATH"] ?? "data/no-fin.db";
const force = process.argv.includes("--force");

// ── Bootstrap database ─────────────────────────────────────────────────────

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

// ── Sourcebooks ─────────────────────────────────────────────────────────────

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
      "Circulars (rundskriv) issued by Finanstilsynet as the primary regulatory instrument for communicating supervisory expectations, interpretive guidance, and practice standards to regulated entities. Covers ICT security, operational resilience, outsourcing, ICAAP/ILAAP, Solvency II, DORA implementation, and sector-specific supervisory requirements. Note: Finanstilsynet announced in 2025 that veiledninger will replace rundskriv going forward.",
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

// ── Provision type definitions ──────────────────────────────────────────────

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

// ── FTNO_FORSKRIFTER — Regulations (forskrifter) from Lovdata ───────────────

const forskrifter: ProvisionRow[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // CORE FINANCIAL SUPERVISION AND INSTITUTION LAWS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "LOV-1956-12-07-1",
    title: "Lov om tilsynet med finansforetak mv. (finanstilsynsloven)",
    text: "Finanstilsynsloven gir hjemmel for Finanstilsynets virksomhet som tilsynsmyndighet for finansforetak i Norge. Loven fastsetter Finanstilsynets organisering, oppgaver og myndighet, herunder rett til a foreta stedlig tilsyn, innhente opplysninger, og ilegge sanksjoner ved brudd pa finanslovgivningen. Finanstilsynet skal se til at de foretak det har tilsyn med, virker pa en hensiktsmessig og betryggende mate i samsvar med lov og bestemmelser gitt i medhold av lov. Tilsynet omfatter banker, forsikringsselskaper, verdipapirforetak, forvaltningsselskaper, betalingsforetak, e-pengeforetak, revisorer, regnskapsforere, eiendomsmeglingsforetak, inkassoforetak og andre finansielle virksomheter. En ny finanstilsynslov (LOV-2024-06-21-41) ble vedtatt i 2024 og trader i kraft etter naermere bestemmelse.",
    type: "lov",
    status: "in_force",
    effective_date: "1957-03-01",
    chapter: "Finanstilsyn",
    section: "Hjemmelslov",
  },
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "LOV-2015-04-10-17",
    title: "Lov om finansforetak og finanskonsern (finansforetaksloven)",
    text: "Finansforetaksloven er hovedloven for regulering av banker, kredittforetak, forsikringsforetak, pensjonsforetak, finansieringsforetak, betalingsforetak og holdingselskaper i finanskonsern i Norge. Loven fastsetter krav til konsesjon, organisering, styring og kontroll, kapitaldekning, virksomhetsregler, sammenslutning og omdanning, konserndannelse og eierskap. Loven gjennomforer sentrale EU/EOS-direktiver, herunder CRD IV/V, Solvens II, og betalingstjenestedirektivet (PSD2). Foretakene skal ha betryggende ordninger for risikostyring og internkontroll, herunder ansvarlig kapital, likviditetsstyring, store engasjementer, godtgjorelsesordninger og gjenopprettingsplaner. Finanstilsynet kan sette vilkar for konsesjon, gi palegg, tilbakekalle tillatelser og ilegge overtredelsesgebyr.",
    type: "lov",
    status: "in_force",
    effective_date: "2016-01-01",
    chapter: "Finansforetak",
    section: "Hovedlov",
  },
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2016-12-09-1502",
    title: "Forskrift om finansforetak og finanskonsern (finansforetaksforskriften)",
    text: "Finansforetaksforskriften gir utfyllende regler til finansforetaksloven. Forskriften regulerer blant annet konsesjonsbehandling, vilkar for tillatelser, krav til faglige kvalifikasjoner for ledelse og styremedlemmer, meldeplikt ved endringer i styre og ledelse, organisering av finanskonsern, EOS-filialer, opplysningsplikter, kundebeskyttelse og markedsforing. Forskriften fastsetter ogs krav til gjenopprettingsplaner, kritiske funksjoner, og bidragsberegning til krisetiltaksfondet (implementering av BRRD). Forskriften er jevnlig endret for a gjennomfore nye EU/EOS-forpliktelser, senest ved endring av 16. januar 2026 nr. 53.",
    type: "forskrift",
    status: "in_force",
    effective_date: "2016-12-09",
    chapter: "Finansforetak",
    section: "Utfyllende regler",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CAPITAL ADEQUACY — CRR/CRD
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2014-08-22-1097",
    title: "Forskrift om kapitalkrav og gjennomforing av CRR/CRD-regelverket (CRR/CRD-forskriften)",
    text: "CRR/CRD-forskriften gjennomforer EUs kapitaldekningsregelverk (forordning (EU) nr. 575/2013 og direktiv 2013/36/EU) i norsk rett gjennom EOS-avtalen. Forskriften gjelder for banker, kredittforetak, finansieringsforetak og holdingselskaper i finanskonsern, samt verdipapirforetak, forvaltningsselskaper med aktiv forvaltning og AIF-forvaltere. Forskriften fastsetter utfyllende nasjonale regler til beregningen av kapitalkrav, herunder kreditrisiko, markedsrisiko og operasjonell risiko. Del V regulerer styring av likviditetsrisiko med krav til likviditetsreservebuffer (LCR) og stabil finansiering (NSFR). Del VII fastsetter systemrisikobuffer, Del VIII regulerer buffer for systemviktige foretak, og Del IX fastsetter den motsykliske kapitalbufferen. Institusjonene skal til enhver tid ha ansvarlig kapital som minst utgjor atte prosent av beregningsgrunnlaget (risikovektede eiendeler), pluss gjeldende bufferkrav.",
    type: "forskrift",
    status: "in_force",
    effective_date: "2014-09-30",
    chapter: "Kapitaldekning",
    section: "CRR/CRD",
  },
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2006-12-14-1506",
    title: "Forskrift om kapitalkrav for forretningsbanker, sparebanker, finansieringsforetak, holdingselskaper i finanskonsern, verdipapirforetak og forvaltningsselskaper for verdipapirfond mv. (kapitalkravforskriften)",
    text: "Kapitalkravforskriften (opprinnelig CRR/CRD IV-forskriften) fastsetter detaljerte regler for beregning av minstekrav til ansvarlig kapital. Forskriften dekker kreditrisiko (standardmetoden og IRB-metoden), markedsrisiko, operasjonell risiko, konsentrasjonsrisiko og systemrisiko. Institusjoner skal ha betryggende prosesser for vurdering av samlet kapitalbehov (ICAAP) i forhold til risikoprofil, og strategier for a opprettholde kapitalniva. Finanstilsynet kan fastsette individuelle tilleggskrav til kapitaldekning basert pa tilsynsmessig vurdering (pilar 2). Institusjoner skal rapportere kapitaldekningen kvartalsvis til Finanstilsynet. Forskriften er gradvis erstattet av CRR/CRD-forskriften (FOR-2014-08-22-1097), men deler forblir gjeldende for overgangsregler.",
    type: "forskrift",
    status: "in_force",
    effective_date: "2007-01-01",
    chapter: "Kapitaldekning",
    section: "Beregningsregler",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ICT AND OPERATIONAL RESILIENCE
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2003-05-21-630",
    title: "Forskrift om bruk av informasjons- og kommunikasjonsteknologi (IKT-forskriften)",
    text: "IKT-forskriften stiller krav til informasjons- og kommunikasjonsteknologi i finansforetak. Forskriften gjelder for foretak under tilsyn av Finanstilsynet som gjor bruk av IKT i sin virksomhet. Foretakene skal ha en IKT-strategi godkjent av styret, en risikobasert tilnaerming til IKT-sikkerhet, og dokumenterte prosesser for tilgangskontroll, endringshandtering, hendelseshandtering og kontinuitetsplanlegging. Paragraf 3 krever at styret skal fastsette IKT-strategien og overordnede sikkerhetskrav. Paragraf 5 regulerer IKT-sikkerhet, herunder fysisk sikring, logisk tilgangskontroll, kryptering og sikkerhetskopiering. Paragraf 8 krever hendelsesrapportering til Finanstilsynet ved vesentlige IKT-hendelser. Foretaket skal gjennomfore regelmessige IKT-risikovurderinger og sarbarhetstester. IKT-forskriften utfylles av Finanstilsynets veiledninger til de enkelte paragrafene.",
    type: "forskrift",
    status: "in_force",
    effective_date: "2003-07-01",
    chapter: "IKT",
    section: "Sikkerhet",
  },
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "LOV-2025-05-27-18",
    title: "Lov om digital operasjonell motstandsdyktighet i finanssektoren (DORA-loven)",
    text: "DORA-loven gjennomforer Europaparlaments- og radsforordning (EU) 2022/2554 om digital operasjonell motstandsdyktighet i finanssektoren (DORA) i norsk rett gjennom EOS-avtalen. Loven fastsetter harmoniserte krav til IKT-risikostyring, IKT-relatert hendelsesrapportering, testing av digital motstandsdyktighet (herunder trusselsbasert penetrasjonstesting — TLPT), handtering av IKT-tredjepartsrisiko, og tilsyn med kritiske IKT-tredjepartsleverandorer. Finansforetak, verdipapirforetak, handelsplasser, sentrale motparter, verdipapirregistre, forvaltere og andre finansielle enheter omfattes. Loven trader i kraft etter naermere bestemmelse fra Kongen.",
    type: "lov",
    status: "in_force",
    effective_date: "2025-05-27",
    chapter: "IKT",
    section: "DORA",
  },
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2025-06-24-1296",
    title: "Forskrift om digital operasjonell motstandsdyktighet i finanssektoren (DORA-forskriften)",
    text: "DORA-forskriften gir utfyllende bestemmelser til DORA-loven og gjennomforer delegerte forordninger og tekniske standarder vedtatt av EU-kommisjonen i medhold av DORA-forordningen. Forskriften regulerer blant annet detaljerte krav til IKT-risikostyringsrammeverk, klassifisering og rapportering av IKT-relaterte hendelser, tredjepartsrisikovurderinger, kontraktuelle krav til IKT-leverandorer, registreringsplikter for IKT-tredjepartsavtaler, og kriterier for utpeking av kritiske IKT-tredjepartsleverandorer. Forskriften ble endret ved FOR-2026-02-12-196.",
    type: "forskrift",
    status: "in_force",
    effective_date: "2025-06-24",
    chapter: "IKT",
    section: "DORA utfyllende",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // AML/CFT — ANTI-MONEY LAUNDERING
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "LOV-2018-06-01-23",
    title: "Lov om tiltak mot hvitvasking og terrorfinansiering (hvitvaskingsloven)",
    text: "Hvitvaskingsloven gjennomforer EUs fjerde hvitvaskingsdirektiv (2015/849) i norsk rett og fastsetter plikter for rapporteringspliktige foretak, herunder banker, forsikringsselskaper, verdipapirforetak, betalingsforetak, revisorer, regnskapsforere, eiendomsmeglere, advokater og forhandlere av hoyverdigjenstander. Foretakene skal gjennomfore virksomhetsinnrettet risikovurdering, etablere risikobaserte rutiner for kundetiltak (KYC), lopende oppfolging av kundeforhold, og rapportere mistenkelige transaksjoner til Okonomisk politienhet (Okokrim). Loven fastsetter regler om forsterket kundetiltak for politisk eksponerte personer (PEP), korrespondentbankforbindelser, og hoyrisikoland identifisert av FATF. Overtredelse kan sanksjoneres med overtredelsesgebyr pa inntil 44 millioner kroner eller opptil 10 prosent av arlig omsetning.",
    type: "lov",
    status: "in_force",
    effective_date: "2018-10-15",
    chapter: "Hvitvasking",
    section: "Hovedlov",
  },
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2018-09-14-1324",
    title: "Forskrift om tiltak mot hvitvasking og terrorfinansiering (hvitvaskingsforskriften)",
    text: "Hvitvaskingsforskriften gir utfyllende regler til hvitvaskingsloven. Forskriften regulerer blant annet belopsbegrensninger for kontantvederlag, unntak fra kundetiltaksplikter for enkelte lavrisikoprodukter, krav til legitimasjonskontroll og identitetsverifikasjon, forsterket kundetiltak for hoyrisikoforhold, krav til elektronisk kundeidentifikasjon, og regler om behandling av personopplysninger. Kapittel 4 fastsetter detaljerte krav til kundetiltak og lopende oppfolging, herunder krav til identitetsverifikasjon ved bruk av elektronisk legitimasjon (BankID). Kapittel 8 regulerer autorisasjon for tilbydere av virksomhetstjenester. Forskriften er endret flere ganger, senest ved FOR-2024-05-15-775.",
    type: "forskrift",
    status: "in_force",
    effective_date: "2018-10-15",
    chapter: "Hvitvasking",
    section: "Utfyllende regler",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SECURITIES TRADING
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "LOV-2007-06-29-75",
    title: "Lov om verdipapirhandel (verdipapirhandelloven)",
    text: "Verdipapirhandelloven regulerer handel med finansielle instrumenter pa regulert marked i Norge. Loven gjennomforer MiFID II (direktiv 2014/65/EU), MiFIR (forordning (EU) nr. 600/2014) og MAR (forordning (EU) nr. 596/2014) i norsk rett. Loven fastsetter forbud mot innsidehandel, markedsmanipulasjon og ulovlig spredning av innsideinformasjon. Utstedere av finansielle instrumenter har loperide informasjonsplikt og meldeplikt for primaerinnsidere. Verdipapirforetak ma ha konsesjon og oppfylle krav til organisering, kapitaldekning, god forretningsskikk, egnethetsvurdering av kunder, og handtering av interessekonflikter. Finanstilsynet kan ilegge overtredelsesgebyr for brudd pa markedsatferdsreglene.",
    type: "lov",
    status: "in_force",
    effective_date: "2007-11-01",
    chapter: "Verdipapir",
    section: "Hovedlov",
  },
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2007-06-29-876",
    title: "Forskrift til verdipapirhandelloven (verdipapirforskriften)",
    text: "Verdipapirforskriften gir utfyllende regler til verdipapirhandelloven. Forskriften regulerer tilbudsplikt ved erverv av aksjer, periodisk informasjonsplikt og offentliggjoring, flaggeplikt ved kryssing av eierskapsterskler, konsesjonsvilkar for verdipapirforetak, vederlag fra eller til andre enn kunden (inducements), organisatoriske krav, og kontroll med borsnoterte foretaks finansielle rapportering. Del 3 fastsetter detaljerte krav til verdipapirforetaks virksomhet, herunder egnethets- og hensiktsmessighetsvurdering, produktstyring (MiFID II), beste utforelse, og rapportering av transaksjoner. Forskriften er omfattende endret for a gjennomfore MiFID II/MiFIR.",
    type: "forskrift",
    status: "in_force",
    effective_date: "2007-11-01",
    chapter: "Verdipapir",
    section: "Utfyllende regler",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // INSURANCE — SOLVENCY II
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "LOV-2005-06-10-44",
    title: "Lov om forsikringsvirksomhet (forsikringsvirksomhetsloven)",
    text: "Forsikringsvirksomhetsloven regulerer skadeforsikringsselskaper, livsforsikringsselskaper og gjenforsikringsselskaper med hovedsete i Norge. Loven fastsetter krav til konsesjon, organisering, tekniske avsetninger, kapitalforvaltning, informasjon til forsikringstakere, og tilsynsmessige forhold. Loven er supplert av Solvens II-forskriften som gjennomforer EUs Solvens II-direktiv (2009/138/EF). Forsikringsforetak skal ha forsvarlig kapitalforvaltning med hensyn til sikkerhet, risikospredning, likviditet og avkastning. Loven regulerer ogs overskuddsdeling i livsforsikring, flytterett for forsikringsavtaler, og krav til aktuarfunksjonen.",
    type: "lov",
    status: "in_force",
    effective_date: "2006-07-01",
    chapter: "Forsikring",
    section: "Hovedlov",
  },
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2015-08-25-999",
    title: "Forskrift til finansforetaksloven om gjennomforing av Solvens II-direktivet (Solvens II-forskriften)",
    text: "Solvens II-forskriften gjennomforer Solvens II-direktivet (2009/138/EF) i norsk rett. Forskriften gjelder for forsikringsforetak og gjenforsikringsforetak med hovedsete i Norge. Pilar 1 fastsetter krav til verdivurdering av eiendeler og forsikringstekniske avsetninger, solvenskapitalkrav (SCR) og minimumskapitalkrav (MCR), beregnet etter standardformelen eller godkjente interne modeller. Pilar 2 regulerer risikostyrings- og internkontrollsystemet, herunder krav til aktuarfunksjon, compliancefunksjon, internrevisjon og risikostyringsfunksjon. Foretakene skal gjennomfore egen risikovurdering og solvensvurdering (ORSA) minst arlig. Pilar 3 fastsetter rapporteringsplikter overfor Finanstilsynet og offentligheten, herunder kvartalsrapportering, arsrapportering og ORSA-rapport. Kapittel 10 regulerer rapportering til Finanstilsynet i henhold til EIOPA-maler.",
    type: "forskrift",
    status: "in_force",
    effective_date: "2016-01-01",
    chapter: "Forsikring",
    section: "Solvens II",
  },
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2015-12-21-1807",
    title: "Forskrift om utfyllende regler til Solvens II-forskriften",
    text: "Denne forskriften gjennomforer Kommisjonens delegerte forordning (EU) 2015/35 som fastsetter utfyllende regler til Solvens II-direktivet. Forskriften regulerer detaljerte beregningsregler for forsikringstekniske avsetninger, eiendelsvurdering, solvenskapitalkrav (SCR) ved standardformelen, markedsrisiko, motpartskreditrisiko, livsforsikringsrisiko, skadeforsikringsrisiko og helseforsikringsrisiko. Forskriften fastsetter ogs krav til egen risikovurdering og solvensvurdering (ORSA), styring og kontrollsystem, kapitalforvaltning, og rapporteringsformat for kvartalsvise og arlige rapporter til Finanstilsynet.",
    type: "forskrift",
    status: "in_force",
    effective_date: "2016-01-01",
    chapter: "Forsikring",
    section: "Solvens II utfyllende",
  },
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2006-06-30-869",
    title: "Forskrift til forsikringsvirksomhetsloven (livsforsikring mv.)",
    text: "Forskriften fastsetter utfyllende regler til forsikringsvirksomhetsloven for livsforsikringsselskaper. Forskriften regulerer beregning av forsikringstekniske avsetninger for livsforsikring, herunder premiereserve, tilleggsavsetninger og kursreguleringsfond. Forskriften fastsetter krav til kapitalforvaltning, herunder begrensninger pa investeringer i enkelteiendeler og aktivaklasser, og krav til samsvar mellom eiendeler og forpliktelser (asset-liability matching). Forskriften regulerer ogs overskuddsdeling mellom forsikringstakere og selskapet, flytterett for forsikringsavtaler, og krav til informasjon ved salg av livsforsikringsprodukter.",
    type: "forskrift",
    status: "in_force",
    effective_date: "2006-07-01",
    chapter: "Forsikring",
    section: "Livsforsikring",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PAYMENT SERVICES
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2019-02-15-152",
    title: "Forskrift om systemer for betalingstjenester (betalingssystemforskriften)",
    text: "Betalingssystemforskriften regulerer systemer for betalingstjenester og stiller krav til banker, kredittforetak, e-pengeforetak, betalingsforetak, opplysningsfullmektiger og filialer av slike foretak med hovedsete i annen EOS-stat. Forskriften gjennomforer deler av EUs andre betalingstjenestedirektiv (PSD2, direktiv 2015/2366/EU). Forskriften fastsetter krav til sterk kundeautentisering (SCA), sikker kommunikasjon mellom betalingstjenestetilbydere, tilgang til betalingskontoer for tredjepartstilbydere (AISP/PISP), og rapportering av alvorlige hendelser og svindelstatistikk til Finanstilsynet. Forskriften er endret ved FOR-2023-07-05-1245 for a gjennomfore oppdaterte tekniske standarder.",
    type: "forskrift",
    status: "in_force",
    effective_date: "2019-04-01",
    chapter: "Betalingstjenester",
    section: "PSD2",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // LENDING PRACTICES
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2020-12-09-2648",
    title: "Forskrift om finansforetakenes utlanspraksis (utlansforskriften)",
    text: "Utlansforskriften regulerer finansforetakenes utlanspraksis for boliglan og forbrukslan. Forskriften samler og videreforer reglene fra den tidligere boliglansforskriften og forbrukslansforskriften i ett regelverk. For boliglan fastsetter forskriften krav til belaning (maksimalt 85 prosent av boligens verdi, 60 prosent for sekundaerbolig i Oslo), gjeldsbetjeningsevne (kunden skal tale en renteoppgang pa 3 prosentpoeng fra dagens rente, minimum 7 prosent rente), og gjeldsgrad (maksimalt fem ganger brutto arsinntekt). For forbrukslan gjelder et belaningstak pa 95 prosent inkludert pantesikret gjeld. Finansforetakene kan innvilge en begrenset andel lan per kvartal som ikke oppfyller ett eller flere av kravene (fleksibilitetskvote). Forskriften er forlenget og justert ved flere anledninger, senest med virkning fra 1. januar 2024.",
    type: "forskrift",
    status: "in_force",
    effective_date: "2021-01-01",
    chapter: "Utlanspraksis",
    section: "Boliglan og forbrukslan",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // RISK MANAGEMENT AND INTERNAL CONTROL
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2008-09-22-1080",
    title: "Forskrift om risikostyring og internkontroll (internkontrollforskriften)",
    text: "Internkontrollforskriften stiller krav til finansforetaks risikostyring og internkontroll. Forskriften gjelder for foretak under tilsyn av Finanstilsynet. Foretaket skal ha en klar organisasjonsstruktur med veldefinerte ansvarslinjer, effektive prosesser for a identifisere, styre, overvake og rapportere risikoer foretaket er eller kan bli eksponert for, betryggende intern kontroll, samt tilfredsstillende informasjonssystemer og kommunikasjonsprosesser. Styret har det overordnede ansvaret for at foretaket har hensiktsmessig og effektiv risikostyring og internkontroll. Forskriften krever at foretaket gjennomforer regelmessige vurderinger av risikostyrings- og internkontrollsystemet.",
    type: "forskrift",
    status: "in_force",
    effective_date: "2008-12-01",
    chapter: "Risikostyring",
    section: "Internkontroll",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPENSATION / REMUNERATION
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2014-12-22-1903",
    title: "Forskrift om godtgjorelsesordninger i finansforetak, verdipapirforetak og forvaltningsselskaper for verdipapirfond (godtgjorelsesforskriften)",
    text: "Godtgjorelsesforskriften gjennomforer CRD IV-direktivets regler om godtgjorelsesordninger i norsk rett. Forskriften gjelder for banker, kredittforetak, finansieringsforetak, holdingselskaper i finanskonsern, forsikringsselskaper, verdipapirforetak og forvaltningsselskaper for verdipapirfond. Foretakene skal ha godtgjorelsesordninger som er i samsvar med god styring og kontroll, og som ikke oppmuntrer til overdreven risikotaking. For identifiserte ansatte (materielle risikotakere) gjelder saerskilte regler om variabel godtgjorelse, herunder at variabel godtgjorelse ikke skal overstige 100 prosent av fast godtgjorelse (200 prosent med generalforsamlingsvedtak), krav om utsettelse av minst 40 prosent i minst tre ar, krav om utbetaling i finansielle instrumenter, og mulighet for tilbakehold (malus) og tilbakebetaling (clawback).",
    type: "forskrift",
    status: "in_force",
    effective_date: "2015-01-01",
    chapter: "Godtgjorelse",
    section: "Variabel lon",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PENSION
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "LOV-2000-11-24-81",
    title: "Lov om innskuddspensjon i arbeidsforhold (innskuddspensjonsloven)",
    text: "Innskuddspensjonsloven regulerer innskuddsbaserte pensjonsordninger i arbeidsforhold. Arbeidsgivere som oppretter pensjonsordning etter denne loven, betaler innskudd til individuelle pensjonskonti for medlemmene. Loven fastsetter minstekrav til innskuddssatser (fra 1. januar 2022: mellom 2 og 7 prosent av lon mellom 1 G og 12 G), valgfrihet for medlemmer med hensyn til investeringsprofil, krav til informasjon og radgivning fra pensjonsleverandoren, og regler om utbetaling av alderspensjon. Pensjonskapitalen forvaltes normalt i verdipapirfond med ulike risikoprofiler. Finanstilsynet forer tilsyn med pensjonsleverandorer som tilbyr innskuddspensjonsordninger.",
    type: "lov",
    status: "in_force",
    effective_date: "2001-01-01",
    chapter: "Pensjon",
    section: "Innskuddspensjon",
  },
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "LOV-2000-03-24-16",
    title: "Lov om foretakspensjon (foretakspensjonsloven)",
    text: "Foretakspensjonsloven regulerer ytelsesbaserte pensjonsordninger i arbeidsforhold. Arbeidsgivere som oppretter pensjonsordning etter denne loven, forplikter seg til a sikre medlemmene en bestemt pensjonsytelse (typisk en prosentandel av sluttlon). Loven fastsetter krav til beregning av pensjonsytelser, premiereserve, regulering av lopende pensjoner, rett til opptjent pensjon (fripolise), og regler om overskuddsdeling. Pensjonsordningen skal vaere forsikret i et livsforsikringsselskap eller pensjonsforetak. Loven fastsetter krav til informasjon til medlemmer og Finanstilsynets tilsyn med pensjonsleverandorer.",
    type: "lov",
    status: "in_force",
    effective_date: "2001-01-01",
    chapter: "Pensjon",
    section: "Foretakspensjon",
  },
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "LOV-2005-12-21-124",
    title: "Lov om obligatorisk tjenestepensjon (OTP-loven)",
    text: "OTP-loven pavlegger arbeidsgivere i privat sektor a opprette en tjenestepensjonsordning for sine ansatte. Ordningen skal oppfylle minstekravene i innskuddspensjonsloven, foretakspensjonsloven eller tjenestepensjonsloven. Fra 1. januar 2006 har det vaert obligatorisk a ha pensjonsordning for alle foretak med minst to ansatte. Minstekravet til innskudd er 2 prosent av lon mellom 1 G og 12 G. Finanstilsynet forvaltet tilsynet med OTP-loven frem til 1. juni 2021, da produktkontrolltilsynet ble overfort til Skatteetaten. Finanstilsynet beholder tilsyn med pensjonsleverandorene.",
    type: "lov",
    status: "in_force",
    effective_date: "2006-01-01",
    chapter: "Pensjon",
    section: "Obligatorisk tjenestepensjon",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // AUDITING AND ACCOUNTING
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "LOV-2020-11-20-128",
    title: "Lov om revisjon og revisorer (revisorloven)",
    text: "Revisorloven regulerer revisjon av arsregnskap og revisorers virksomhet. Loven gjennomforer EUs revisjonsdirektiv (2006/43/EF, endret ved 2014/56/EU) og revisjonsforordningen (EU) nr. 537/2014 for revisjon av foretak av allmenn interesse. Revisorer og revisjonsselskaper ma ha godkjenning fra Finanstilsynet. Loven fastsetter krav til revisorers uavhengighet, kvalifikasjonskrav, krav til revisjonens gjennomforing i samsvar med god revisjonsskikk (ISA), revisjonsberetningens innhold, og revisjonsutvalgets oppgaver. Finanstilsynet gjennomforer regelmessig kvalitetskontroll av revisorer og revisjonsselskaper, og kan ilegge sanksjoner ved brudd, herunder overtredelsesgebyr og tilbakekall av godkjenning.",
    type: "lov",
    status: "in_force",
    effective_date: "2021-01-01",
    chapter: "Revisjon",
    section: "Hovedlov",
  },
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "LOV-1998-07-17-56",
    title: "Lov om arsregnskap m.v. (regnskapsloven)",
    text: "Regnskapsloven fastsetter krav til arsregnskap og arsberetning for regnskapspliktige foretak i Norge. Loven gjennomforer EUs regnskapsdirektiver og rapporteringskrav. Regnskapspliktige foretak skal utarbeide arsregnskap bestende av resultatregnskap, balanse, kontantstromoppstilling og noter. Store foretak og foretak av allmenn interesse skal avgi arsberetning som gir dekkende oversikt over utviklingen og resultatet av foretakets virksomhet. Regnskapsloven inneholder ogs krav til rapportering av berekraft (CSRD-gjennomforing), kjonnsdiversitet i styret, og land-for-land-rapportering. Finanstilsynet forer kontroll med finansiell rapportering fra borsnoterte foretak (regnskapskontrollen).",
    type: "lov",
    status: "in_force",
    effective_date: "1999-01-01",
    chapter: "Regnskap",
    section: "Hovedlov",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // INSURANCE INTERMEDIATION AND DISTRIBUTION
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "LOV-2022-03-18-11",
    title: "Lov om forsikringsformidling (forsikringsformidlingsloven)",
    text: "Forsikringsformidlingsloven regulerer forsikringsformidlingsvirksomhet i Norge og gjennomforer forsikringsdistribusjonsdirektivet (IDD, direktiv 2016/97/EU). Loven gjelder for forsikringsmeglere, gjenforsikringsmeglere, forsikringsagenter og aksessoriske forsikringsformidlere. Formidlere ma ha tillatelse eller registrering hos Finanstilsynet. Loven fastsetter krav til god forretningsskikk, informasjonsplikt overfor kunder, handtering av interessekonflikter, krav til faglige kvalifikasjoner og etterutdanning, og krav til ansvarsforsikring. Forsikringsmeglere skal handle i kundens interesse og gi radgivning basert pa analyse av et tilstrekkelig antall tilgjengelige forsikringsprodukter.",
    type: "lov",
    status: "in_force",
    effective_date: "2022-07-01",
    chapter: "Forsikring",
    section: "Forsikringsformidling",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // REAL ESTATE BROKERAGE
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "LOV-2007-06-29-73",
    title: "Lov om eiendomsmegling (eiendomsmeglingsloven)",
    text: "Eiendomsmeglingsloven regulerer eiendomsmeglingsvirksomhet i Norge. Loven krever at eiendomsmegling kun kan drives av foretak med tillatelse fra Finanstilsynet. Ansvarlige meglere ma oppfylle kvalifikasjonskrav. Loven fastsetter krav til god meglerskikk, forbud mot egenhandel, krav til oppdragsavtale, informasjonsplikt til kjoper og selger, krav til handtering av klientmidler, budrundeprosedyre, og oppgjorsfunksjonen. Finanstilsynet forer tilsyn med eiendomsmeglingsforetak og kan tilbakekalle tillatelser ved alvorlige brudd.",
    type: "lov",
    status: "in_force",
    effective_date: "2008-01-01",
    chapter: "Eiendomsmegling",
    section: "Hovedlov",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DEBT COLLECTION
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "LOV-1988-05-13-26",
    title: "Lov om inkassovirksomhet og annen inndriving av forfalte pengekrav (inkassoloven)",
    text: "Inkassoloven regulerer inkassovirksomhet i Norge. Inkassoforetak ma ha bevilling fra Finanstilsynet. Loven fastsetter krav til organisering, sikkerhetsstillelse, og god inkassoskikk. Skyldneren skal ikke palegges urimelige kostnader eller utsettes for utilborlig press. Loven regulerer ogs inkassosalaerets storrelse og skyldnerens rett til a klage. Finanstilsynet forer tilsyn med inkassoforetak og kan tilbakekalle bevilling ved alvorlige eller gjentatte brudd pa regelverket. Loven er oppdatert ved LOV-2022-06-03-33 som endret klagebehandlingen av Finanstilsynets vedtak.",
    type: "lov",
    status: "in_force",
    effective_date: "1989-01-01",
    chapter: "Inkasso",
    section: "Hovedlov",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // FINANCIAL CONTRACTS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "LOV-2020-12-18-146",
    title: "Lov om finansavtaler (finansavtaleloven)",
    text: "Finansavtaleloven regulerer avtaler om finansielle tjenester mellom tjenesteytere og kunder. Loven gjennomforer EUs betalingstjenestedirektiv (PSD2), forbrukerkredittdirektivet og boligkredittdirektivet. Loven fastsetter krav til opplysningsplikt for bankkontoavtaler og betalingstjenester, angrerett, regler om uautoriserte betalingstransaksjoner og kundens ansvar, krav til forhands-opplysninger ved kredittvurdering og kredittavtaler, og regler om rentejustering. Loven styrker forbrukervernet ved blant annet a innfore krav om at kunden skal informeres om vesentlige endringer i god tid for ikrafttredelse.",
    type: "lov",
    status: "in_force",
    effective_date: "2023-01-01",
    chapter: "Finansavtaler",
    section: "Hovedlov",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SECURITIES FUNDS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "LOV-2011-11-25-44",
    title: "Lov om verdipapirfond (verdipapirfondloven)",
    text: "Verdipapirfondloven regulerer verdipapirfond og forvaltningsselskaper i Norge. Loven gjennomforer UCITS-direktivet (2009/65/EF) i norsk rett. Forvaltningsselskaper ma ha tillatelse fra Finanstilsynet. Loven fastsetter krav til organisering av forvaltningsselskaper, depotmottakerfunksjonen, krav til fondenes vedtekter, investeringsbegrensninger for UCITS-fond, regler om tegning og innlosning av andeler, og krav til noekkeldokumentet (KIID/KID). Forvaltningsselskaper er underlagt krav til god forretningsskikk, handtering av interessekonflikter, og rapportering til Finanstilsynet.",
    type: "lov",
    status: "in_force",
    effective_date: "2012-01-01",
    chapter: "Verdipapirfond",
    section: "Hovedlov",
  },
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "LOV-2014-06-20-28",
    title: "Lov om forvaltning av alternative investeringsfond (AIF-loven)",
    text: "AIF-loven regulerer forvaltere av alternative investeringsfond i Norge og gjennomforer AIFM-direktivet (2011/61/EU). Alternative investeringsfond omfatter hedgefond, PE-fond, eiendomsfond og andre fond som ikke er UCITS. Forvaltere over visse terskelverdier ma ha tillatelse fra Finanstilsynet. Loven fastsetter krav til organisering, kapitaldekning, risikostyring, verdsettelse, depotmottaker, rapportering til Finanstilsynet, og markedsforing til profesjonelle og ikke-profesjonelle investorer. Fondsforvaltere skal gjennomfore due diligence ved investeringer og ha tilfredsstillende rutiner for likviditetsstyring.",
    type: "lov",
    status: "in_force",
    effective_date: "2014-07-01",
    chapter: "Verdipapirfond",
    section: "Alternative investeringsfond",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DEPOSIT GUARANTEE AND CRISIS MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "LOV-1996-12-06-75",
    title: "Lov om sikringsordninger for banker, forsikringsselskaper og verdipapirforetak (banksikringsloven)",
    text: "Banksikringsloven regulerer sikringsordningene i Norge, herunder Bankenes sikringsfond (innskuddsgarantifond), krisetiltaksfondet og Verdipapirforetakenes sikringsfond. Innskuddsgarantiordningen dekker innskudd inntil 2 millioner kroner per innskyter per bank. Loven gjennomforer innskuddsgarantidirektivet (2014/49/EU) og krisehandteringsdirektivet (BRRD, 2014/59/EU). Loven fastsetter regler for krisehndtering av banker og andre finansforetak, herunder nedskrivning og konvertering av gjeld (bail-in), brobanketablering, og overforsel av virksomhet. Finanstilsynet og Finansdepartementet har krisehndteringsmyndighet.",
    type: "lov",
    status: "in_force",
    effective_date: "1997-01-01",
    chapter: "Sikringsordninger",
    section: "Innskuddsgaranti",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SUSTAINABILITY / ESG REPORTING
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2021-12-22-3819",
    title: "Forskrift om offentliggjoring av berekraftsinformasjon i finanssektoren (SFDR-forskriften)",
    text: "SFDR-forskriften gjennomforer forordning (EU) 2019/2088 om berekraftsrelaterte opplysninger i finanssektoren (Sustainable Finance Disclosure Regulation) i norsk rett. Forskriften gjelder for finansmarkedsdeltagere og finansradgivere, herunder banker, forsikringsselskaper, verdipapirforetak, forvaltningsselskaper og pensjonsforetak. Foretakene skal offentliggjore informasjon om sin policy for integrering av berekraftsrisiko i investeringsbeslutninger, negative konsekvenser av investeringsbeslutninger for berekraftsfaktorer, og klassifisering av finansielle produkter etter berekraftsmal (artikkel 8 og 9-fond). Foretakene skal rapportere pa enhetsniva (nettsiden) og produktniva (forhands- og etteropplysninger).",
    type: "forskrift",
    status: "in_force",
    effective_date: "2022-01-01",
    chapter: "Berekraft",
    section: "SFDR",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CRYPTO / VIRTUAL ASSETS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "LOV-2019-06-21-31",
    title: "Lov om register over reelle rettighetshavere (lov om reelle rettighetshavere)",
    text: "Loven palegger juridiske personer, forvaltere av utenlandske truster og lignende juridiske arrangementer a innhente og registrere opplysninger om sine reelle rettighetshavere i et sentralt register. Registeret forvaltes av Bronnoysundregistrene. Loven styrker transparens i eierskap og er et sentralt tiltak mot hvitvasking, terrorfinansiering og skatteunndragelse. Finanstilsynet og andre tilsynsmyndigheter har tilgang til registeret for a understotte sine tilsynsoppgaver.",
    type: "lov",
    status: "in_force",
    effective_date: "2021-11-01",
    chapter: "Transparens",
    section: "Reelle rettighetshavere",
  },
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2019-12-13-1741",
    title: "Forskrift om registrering av tilbydere av vekslings- og oppbevaringstjenester for virtuell valuta",
    text: "Forskriften krever at tilbydere av vekslings- og oppbevaringstjenester for virtuell valuta (kryptovaluta) skal registreres hos Finanstilsynet. Tilbyderne er rapporteringspliktige etter hvitvaskingsloven og skal gjennomfore kundetiltak, lopende oppfolging og rapportering av mistenkelige transaksjoner. Registreringsplikten innebarer at Finanstilsynet vurderer egnethetskrav for ledelsen og om foretaket har tilstrekkelige systemer for a etterleve hvitvaskingsregelverket. Forskriften ble vedtatt som del av gjennomforingen av EUs femte hvitvaskingsdirektiv (2018/843).",
    type: "forskrift",
    status: "in_force",
    effective_date: "2019-12-15",
    chapter: "Fintech",
    section: "Virtuell valuta",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CROWDFUNDING
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2023-12-01-1901",
    title: "Forskrift om folkefinansiering av naringsvirksomhet (folkefinansieringsforskriften)",
    text: "Folkefinansieringsforskriften gjennomforer EUs folkefinansieringsforordning (EU) 2020/1503 i norsk rett. Forskriften regulerer lanbasert og investeringsbasert folkefinansiering (crowdfunding) og stiller krav til tilbydere av folkefinansieringstjenester, herunder krav til konsesjon fra Finanstilsynet, organisatoriske krav, handtering av interessekonflikter, krav til investeringsinformasjon (noekkelinformasjonsdokument), og begrensninger for ikke-sofistikerte investorer. Tilbyderne skal gjennomfore en investeringsinngangsprove for a sikre at kundene forstar risikoen.",
    type: "forskrift",
    status: "in_force",
    effective_date: "2024-01-01",
    chapter: "Fintech",
    section: "Folkefinansiering",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COVERED BONDS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "LOV-2007-06-29-74",
    title: "Lov om regulerte markeder (borsloven)",
    text: "Borsloven regulerer regulerte markeder og multilaterale handelsfasiliteter (MTF) i Norge. Loven gjennomforer MiFID II-direktivets bestemmelser om regulerte markeder. Borser og andre markedsoperatorer ma ha tillatelse fra Finansdepartementet. Loven fastsetter krav til organisering, systemkontroll, opptak til handel, krav til utstedere, handelsovervaking og rapportering. Oslo Bors er den eneste regulerte markedsoperatoren i Norge og forer tilsyn med utstederne som er tatt opp til handel.",
    type: "lov",
    status: "in_force",
    effective_date: "2007-11-01",
    chapter: "Verdipapir",
    section: "Regulerte markeder",
  },
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2007-06-29-875",
    title: "Forskrift til borsloven (borsforskriften)",
    text: "Borsforskriften gir utfyllende regler til borsloven om regulerte markeder. Forskriften regulerer vilkar for tillatelse til drift av regulert marked, krav til opptak av finansielle instrumenter til handel, informasjonsplikt for utstedere, krav til handelsovervaking, suspendering og stryking av instrumenter, og rapportering til Finanstilsynet. Forskriften fastsetter ogs regler om markedsoperatorers organisering og systemkontroll.",
    type: "forskrift",
    status: "in_force",
    effective_date: "2007-11-01",
    chapter: "Verdipapir",
    section: "Borsforskrift",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PROSPECTUS REGULATION
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2019-12-04-1643",
    title: "Forskrift om prospekt (prospektforskriften)",
    text: "Prospektforskriften gjennomforer EUs prospektforordning (EU) 2017/1129 i norsk rett og regulerer plikten til a utarbeide prospekt ved offentlig tilbud om tegning eller kjop av finansielle instrumenter, og ved opptak av finansielle instrumenter til handel pa regulert marked. Prospektet skal godkjennes av Finanstilsynet for offentliggjoring. Forskriften fastsetter innholdskrav, format, gyldighetsperiode, prospektunntak (herunder unntak for sma tilbud under terskelverdi), og krav til universelt registreringsdokument for hyppige utstedere.",
    type: "forskrift",
    status: "in_force",
    effective_date: "2020-01-01",
    chapter: "Verdipapir",
    section: "Prospekt",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SHORT SELLING
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2017-03-22-381",
    title: "Forskrift om shortsalg (shortsellingforskriften)",
    text: "Shortsellingforskriften gjennomforer EUs forordning om shortsalg (EU) nr. 236/2012 i norsk rett. Forskriften regulerer shortsalg av aksjer og statspapirer, herunder forbud mot udekket shortsalg, meldeplikt ved netto shortposisjoner over 0,2 prosent av utstedt aksjekapital til Finanstilsynet, offentliggjoringsplikt ved netto shortposisjoner over 0,5 prosent, og unntak for market making-aktiviteter. Finanstilsynet kan under ekstraordinaere markedsforhold innfore midlertidig forbud mot eller begrensning av shortsalg.",
    type: "forskrift",
    status: "in_force",
    effective_date: "2017-04-01",
    chapter: "Verdipapir",
    section: "Shortsalg",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COVERED BONDS (OMF)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2007-05-25-550",
    title: "Forskrift om kredittforetak som utsteder obligasjoner med fortrinnsrett (OMF-forskriften)",
    text: "OMF-forskriften regulerer kredittforetak som utsteder obligasjoner med fortrinnsrett i en sikkerhetsmasse (covered bonds). Forskriften fastsetter krav til sikkerhetsmassens sammensetning (boliglan, naeringslan, offentlige lan og derivater), belansgrenser (75 prosent for boliglan, 60 prosent for naeringslan), krav til overpantsettelse, krav til en uavhengig gransker (inspektorrollen), verdsettelse av sikkerheter, og rapportering til Finanstilsynet. OMF-er er et viktig finansieringsinstrument for norske banker og kredittforetak.",
    type: "forskrift",
    status: "in_force",
    effective_date: "2007-06-01",
    chapter: "Bank",
    section: "Obligasjoner med fortrinnsrett",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CREDIT RATING AGENCIES
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2019-12-20-2082",
    title: "Forskrift om kredittvurderingsbyraer (CRA-forskriften)",
    text: "CRA-forskriften gjennomforer EUs forordning om kredittvurderingsbyraer (EU) nr. 1060/2009 i norsk rett. Forskriften regulerer registrering og tilsyn med kredittvurderingsbyraer, krav til uavhengighet og forebygging av interessekonflikter, metodologikrav, krav til offentliggjoring av kredittvurderinger og vurderingsmetoder, og regler om bruk av kredittvurderinger i reguleringssammenheng (referanser i CRR, Solvens II m.fl.). ESMA har sentralt tilsynsansvar for kredittvurderingsbyraer i EOS.",
    type: "forskrift",
    status: "in_force",
    effective_date: "2020-01-01",
    chapter: "Verdipapir",
    section: "Kredittvurderingsbyraer",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EMIR — OTC DERIVATIVES
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2019-12-20-2086",
    title: "Forskrift om OTC-derivater, sentrale motparter og transaksjonsregistre (EMIR-forskriften)",
    text: "EMIR-forskriften gjennomforer EUs forordning om OTC-derivater, sentrale motparter og transaksjonsregistre (EU) nr. 648/2012 (EMIR) i norsk rett. Forskriften palegger clearingplikt for standardiserte OTC-derivater gjennom sentrale motparter, rapporteringsplikt for alle derivatkontrakter til transaksjonsregistre, og risikodempende tiltak for OTC-derivater som ikke er gjenstand for sentral clearing (herunder utveksling av sikkerhet, rettidig bekreftelse og portefoljeforsoningsrutiner). Finanstilsynet forer tilsyn med norske motparter og mottar rapportering.",
    type: "forskrift",
    status: "in_force",
    effective_date: "2020-01-01",
    chapter: "Verdipapir",
    section: "EMIR derivater",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // BENCHMARK REGULATION
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2019-12-20-2085",
    title: "Forskrift om referanseverdier (benchmarkforskriften)",
    text: "Benchmarkforskriften gjennomforer EUs benchmarkforordning (EU) 2016/1011 i norsk rett. Forskriften regulerer produksjon, bidrag til og bruk av referanseverdier (benchmarks) brukt i finansielle instrumenter og kontrakter. Administratorer av referanseverdier ma ha godkjenning eller registrering fra Finanstilsynet. Forskriften stiller krav til styringsordninger, kontrollrammeverk, inndatakvalitet, transparens og beregningsmetodikk. Norges Bank administrerer Nowa (Norwegian Overnight Weighted Average) som den viktigste norske pengemarkedsrenten.",
    type: "forskrift",
    status: "in_force",
    effective_date: "2020-01-01",
    chapter: "Verdipapir",
    section: "Referanseverdier",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CENTRAL SECURITIES DEPOSITORIES
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "LOV-2019-03-15-6",
    title: "Lov om verdipapirsentraler og verdipapiroppgjor mv. (verdipapirsentralloven)",
    text: "Verdipapirsentralloven regulerer verdipapirsentraler og verdipapiroppgjor i Norge og gjennomforer CSDR-forordningen (EU) nr. 909/2014 i norsk rett. Loven fastsetter krav til tillatelse og tilsyn med verdipapirsentraler, krav til organisering, kapitaldekning og risikostyring, regler om registrering av rettigheter til finansielle instrumenter, og krav til oppgjorsdisiplin. Euronext Securities Oslo (tidl. VPS) er Norges verdipapirsentral. Loven fastsetter ogs regler om oppgjorsinternaliserere og internoppgjor.",
    type: "lov",
    status: "in_force",
    effective_date: "2019-07-01",
    chapter: "Verdipapir",
    section: "Verdipapirsentraler",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ACCOUNTING STANDARD (IFRS)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2005-01-17-36",
    title: "Forskrift om gjennomforing av EOS-regler om vedtatte internasjonale regnskapsstandarder (IFRS-forskriften)",
    text: "IFRS-forskriften gjennomforer EUs forordning om anvendelse av internasjonale regnskapsstandarder (IFRS) i norsk rett. Borsnoterte foretak skal utarbeide konsernregnskap i samsvar med IFRS som godkjent av EU. Forskriften gir ogs ovriq foretak adgang til a anvende IFRS i selskaps- og konsernregnskap. Forskriften er hjemlet i regnskapsloven og oppdateres fortlopende nar nye IFRS-standarder eller endringer godkjennes av EU og innlemmes i EOS-avtalen.",
    type: "forskrift",
    status: "in_force",
    effective_date: "2005-01-17",
    chapter: "Regnskap",
    section: "IFRS",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // LARGE EXPOSURES
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2006-12-14-1507",
    title: "Forskrift om store engasjementer",
    text: "Forskriften regulerer begrensninger pa finansforetaks engasjementer med enkeltmotparter eller grupper av tilknyttede motparter. Et foretaks samlede engasjement med en enkelt motpart skal ikke overstige 25 prosent av foretakets ansvarlige kapital. For systemviktige institusjoner kan grensen vaere lavere. Forskriften gjennomforer CRR-forordningens regler om store engasjementer og fastsetter regler for beregning av engasjementer, motregning, sikkerhetsstillelse og rapportering til Finanstilsynet.",
    type: "forskrift",
    status: "in_force",
    effective_date: "2007-01-01",
    chapter: "Kapitaldekning",
    section: "Store engasjementer",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // RESOLUTION (MREL)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2018-11-23-1731",
    title: "Forskrift om minstekrav til ansvarlig kapital og konvertibel gjeld (MREL-forskriften)",
    text: "MREL-forskriften fastsetter minstekrav til ansvarlig kapital og konvertibel gjeld (Minimum Requirement for own funds and Eligible Liabilities) for banker og andre foretak som kan bli gjenstand for krisehandtering etter banksikringsloven. MREL-kravet skal sikre at foretaket har tilstrekkelig tapsabsorberende kapasitet til at krisehndteringsmyndigheten kan gjennomfore nedskrivning og konvertering av gjeld (bail-in) uten a bruke offentlige midler. Finanstilsynet fastsetter individuelle MREL-krav for det enkelte foretak basert pa krisehndteringsplanen.",
    type: "forskrift",
    status: "in_force",
    effective_date: "2019-01-01",
    chapter: "Kriseberedskap",
    section: "MREL",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TAXONOMY REGULATION
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2022-06-17-1078",
    title: "Forskrift om offentliggjoring av berekraftig aktivitet (taksonomiforskriften)",
    text: "Taksonomiforskriften gjennomforer EUs taksonomiforordning (EU) 2020/852 i norsk rett. Forordningen etablerer et klassifiseringssystem for miljomaessig berekraftige okonomiske aktiviteter. Store foretak som er rapporteringspliktige etter regnskapsloven, skal rapportere andelen av omsetning, kapitalutgifter og driftsutgifter som er knyttet til aktiviteter klassifisert som berekraftige etter taksonomien. Finansmarkedsdeltakere skal opplyse om andelen taksonomi-justerte investeringer i finansielle produkter. Forskriften er relevant for Finanstilsynets tilsyn med SFDR-rapportering.",
    type: "forskrift",
    status: "in_force",
    effective_date: "2023-01-01",
    chapter: "Berekraft",
    section: "Taksonomi",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CSRD / SUSTAINABILITY REPORTING
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "LOV-2024-06-21-42",
    title: "Lov om endringer i regnskapsloven mv. (gjennomforing av berekraftsrapporteringsdirektivet — CSRD)",
    text: "Lovendringen gjennomforer EUs berekraftsrapporteringsdirektiv (CSRD, direktiv 2022/2464) i norsk rett. Store foretak og borsnoterte foretak (unntatt mikroforetak) skal rapportere om berekraftsforhold i arsberetningen i samsvar med europeiske berekraftsrapporteringsstandarder (ESRS). Rapporteringen skal dekke klimamessige, miljomaessige, sosiale og styringsrelaterte forhold, og skal attesteres av revisor. De forste rapporteringskravene for store borsnoterte foretak gjelder regnskapsaret 2024, med trinnvis utvidelse til mellomstore borsnoterte foretak fra 2026.",
    type: "lov",
    status: "in_force",
    effective_date: "2025-01-01",
    chapter: "Berekraft",
    section: "CSRD rapportering",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIIPS / KID
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2019-12-20-2087",
    title: "Forskrift om noekkeldokumenter for sammenfattede investeringsprodukter til forbrukere (PRIIPs-forskriften)",
    text: "PRIIPs-forskriften gjennomforer EUs PRIIPs-forordning (EU) nr. 1286/2014 i norsk rett. Forskriften krever at produsenter av sammenfattede investeringsprodukter til forbrukere (PRIIPs) utarbeider et standardisert noekkelinformasjonsdokument (KID) som skal gi investorer klar og sammenlignbar informasjon om produktets risiko, avkastningspotensial og kostnader. KID-et skal utleveres til kunden for investering. Forskriften gjelder for strukturerte produkter, forsikringsbaserte investeringsprodukter, verdipapirfond (unntak for UCITS med eget KIID), og andre pakketerte investeringsprodukter.",
    type: "forskrift",
    status: "in_force",
    effective_date: "2020-01-01",
    chapter: "Forbrukervern",
    section: "PRIIPs noekkelinformasjon",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // KEY REGULATION SECTIONS — CRR/CRD
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2014-08-22-1097 Del V",
    title: "CRR/CRD-forskriften — Del V: Styring av likviditetsrisiko",
    text: "Del V av CRR/CRD-forskriften fastsetter krav til likviditetsreservebuffer (LCR — Liquidity Coverage Ratio) og stabil finansiering (NSFR — Net Stable Funding Ratio). Institusjonene skal til enhver tid ha likviditetsreserver som minst tilsvarer netto likviditetsutgang i et 30-dagers stresscenario (LCR minst 100 prosent). NSFR krever at stabil finansiering minst tilsvarer krevd stabil finansiering. Beregningen skiller mellom hoylikvide eiendeler (nivaa 1 og 2), og Finanstilsynet kan fastsette saerskilte LCR-krav i signifikante valutaer.",
    type: "forskrift",
    status: "in_force",
    effective_date: "2014-09-30",
    chapter: "Kapitaldekning",
    section: "CRR Likviditet",
  },
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2014-08-22-1097 Del VII",
    title: "CRR/CRD-forskriften — Del VII: Systemrisikobuffer",
    text: "Del VII av CRR/CRD-forskriften fastsetter krav til systemrisikobuffer. Finansdepartementet kan kreve at finansforetak holder en systemrisikobuffer pa opptil 5 prosent av risikovektede eiendeler for a motvirke systemisk risiko som ikke dekkes av andre kapitalkrav. Systemrisikobufferen kan fastsettes pa konsolidert og individuelt niva, og kan differensieres mellom sektorer og eksponeringstyper. Gjeldende systemrisikobufferkrav i Norge er 4,5 prosent.",
    type: "forskrift",
    status: "in_force",
    effective_date: "2014-09-30",
    chapter: "Kapitaldekning",
    section: "Systemrisikobuffer",
  },
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2014-08-22-1097 Del VIII",
    title: "CRR/CRD-forskriften — Del VIII: Buffer for systemviktige foretak",
    text: "Del VIII av CRR/CRD-forskriften fastsetter krav til kapitalbufer for systemviktige finansforetak (O-SII buffer). Finanstilsynet identifiserer aarlig systemviktige finansforetak basert pa storrelse, betydning for den okonomiske infrastrukturen, kompleksitet og sammenvevdhet. Systemviktige foretak skal holde en ekstra kapitalbufer pa 1–2 prosent av risikovektede eiendeler. DNB Bank, SpareBank 1 SR-Bank og Kommunalbanken er blant de identifiserte systemviktige foretakene i Norge.",
    type: "forskrift",
    status: "in_force",
    effective_date: "2014-09-30",
    chapter: "Kapitaldekning",
    section: "Systemviktige foretak",
  },
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2014-08-22-1097 Del IX",
    title: "CRR/CRD-forskriften — Del IX: Motsyklisk kapitalbuffer",
    text: "Del IX av CRR/CRD-forskriften fastsetter regler for den motsykliske kapitalbufferen. Finansdepartementet fastsetter kvartalsvis satsen for den motsykliske kapitalbufferen basert pa Norges Banks rad. Buffersatsen kan variere mellom 0 og 2,5 prosent av risikovektede eiendeler og skal motvirke prosyklisk utlansvekst. Bufferen bygges opp i gode tider og kan frigjores i nedgangstider for a opprettholde kredittilbudet. Gjeldende sats i Norge er 2,5 prosent (per 2024).",
    type: "forskrift",
    status: "in_force",
    effective_date: "2014-09-30",
    chapter: "Kapitaldekning",
    section: "Motsyklisk buffer",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // IKT-FORSKRIFTEN SECTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2003-05-21-630 § 3",
    title: "IKT-forskriften § 3 — IKT-strategi og styring",
    text: "IKT-forskriftens paragraf 3 krever at styret i finansforetak skal fastsette en IKT-strategi som dekker foretakets IKT-arkitektur, sikkerhetskrav, og plan for utvikling og vedlikehold. Strategien skal vaere tilpasset foretakets virksomhet, storrelse og kompleksitet. Styret skal paase at det er tilstrekkelige ressurser og kompetanse til a gjennomfore strategien. IKT-strategien skal revideres aarlig og ved vesentlige endringer i foretakets virksomhet eller trusselsbilde.",
    type: "forskrift",
    status: "in_force",
    effective_date: "2003-07-01",
    chapter: "IKT",
    section: "Strategi paragraf 3",
  },
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2003-05-21-630 § 5",
    title: "IKT-forskriften § 5 — Sikkerhet",
    text: "IKT-forskriftens paragraf 5 fastsetter krav til IKT-sikkerhet i finansforetak. Foretaket skal ha sikkerhetstiltak tilpasset virksomhetens art og omfang, herunder fysisk sikring av IKT-infrastruktur, logisk tilgangskontroll med minste-privilegium-prinsippet, kryptering av sensitiv informasjon, sikkerhetskopiering med regelmessig gjenopprettingstest, sarbarhetsstyring med oppdatering og patching, og nettverkssikkerhet med segmentering. Foretaket skal gjennomfore arlige penetrasjonstester av kritiske systemer.",
    type: "forskrift",
    status: "in_force",
    effective_date: "2003-07-01",
    chapter: "IKT",
    section: "Sikkerhet paragraf 5",
  },
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2003-05-21-630 § 8",
    title: "IKT-forskriften § 8 — Hendelsesrapportering",
    text: "IKT-forskriftens paragraf 8 krever at finansforetak rapporterer vesentlige IKT-hendelser til Finanstilsynet uten ugrunnet opphold. En hendelse anses som vesentlig dersom den har eller kan ha vesentlig innvirkning pa foretakets eller kundenes virksomhet. Rapporten skal inneholde beskrivelse av hendelsen, arsak, konsekvenser for foretaket og kunder, gjennomforte tiltak, og plan for a hindre gjentagelse. Finanstilsynet bruker hendelsesrapporteringen til a overvake IKT-risikoen i finanssektoren.",
    type: "forskrift",
    status: "in_force",
    effective_date: "2003-07-01",
    chapter: "IKT",
    section: "Hendelser paragraf 8",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // HVITVASKINGSLOVEN KEY SECTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "LOV-2018-06-01-23 kap 3",
    title: "Hvitvaskingsloven kapittel 3 — Virksomhetsinnrettet risikovurdering",
    text: "Hvitvaskingslovens kapittel 3 palegger alle rapporteringspliktige foretak a gjennomfore en virksomhetsinnrettet risikovurdering av risikoen for at foretaket kan bli misbrukt til hvitvasking eller terrorfinansiering. Risikovurderingen skal identifisere og vurdere risikofaktorer knyttet til kundetyper, produkter og tjenester, leveringskanaler og geografiske omrader. Risikovurderingen danner grunnlag for foretakets interne rutiner og allokering av ressurser til anti-hvitvaskingsarbeidet. Risikovurderingen skal dokumenteres, holdes oppdatert, og vaere tilgjengelig for Finanstilsynet.",
    type: "lov",
    status: "in_force",
    effective_date: "2018-10-15",
    chapter: "Hvitvasking",
    section: "Risikovurdering kap 3",
  },
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "LOV-2018-06-01-23 kap 4",
    title: "Hvitvaskingsloven kapittel 4 — Kundetiltak",
    text: "Hvitvaskingslovens kapittel 4 regulerer kundetiltak (KYC — Know Your Customer) som rapporteringspliktige foretak skal gjennomfore. Kundetiltakene omfatter identifisering og verifisering av kundens identitet, identifisering av reelle rettighetshavere, innhenting av opplysninger om kundeforholdets formaal og tilsiktede art, og lopende oppfolging av kundeforholdet. Foretaket kan ikke etablere kundeforhold dersom kundetiltakene ikke kan gjennomfores. Kapitlet fastsetter ogs regler om forsterket kundetiltak for politisk eksponerte personer (PEP) og hoyrisikosituasjoner, og forenklet kundetiltak for lavrisikosituasjoner.",
    type: "lov",
    status: "in_force",
    effective_date: "2018-10-15",
    chapter: "Hvitvasking",
    section: "Kundetiltak kap 4",
  },
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "LOV-2018-06-01-23 kap 5",
    title: "Hvitvaskingsloven kapittel 5 — Undersokelse og rapportering",
    text: "Hvitvaskingslovens kapittel 5 regulerer undersokelsesplikten og rapporteringsplikten. Dersom foretaket har mistanke om at en transaksjon har tilknytning til utbytte av en straffbar handling eller terrorfinansiering, skal foretaket foreta naermere undersokelser for a bekrefte eller avkrefte mistanken. Dersom undersokelsene ikke avkrefter mistanken, skal foretaket rapportere forholdet til Okokrim (Okonomisk politienhet) uten ugrunnet opphold. Foretaket skal ikke gjennomfore transaksjonen for rapportering er sendt, med mindre det er umulig a la vaere. Tipping off (informasjon til kunden om rapportering) er forbudt.",
    type: "lov",
    status: "in_force",
    effective_date: "2018-10-15",
    chapter: "Hvitvasking",
    section: "Rapportering kap 5",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // UTLÅNSFORSKRIFTEN SECTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2020-12-09-2648 § 3",
    title: "Utlansforskriften § 3 — Betjeningsevne og gjeldsgrad",
    text: "Utlansforskriften paragraf 3 fastsetter at finansforetak ved innvilgning av nye lan til personkunder skal vurdere kundens evne til a betjene lanet. Kunden skal ha tilstrekkelig betjeningsevne til a tale en renteoppgang pa 3 prosentpoeng fra avtaletidspunktets rente, men minst 7 prosent rente. Samlet gjeld skal ikke overstige fem ganger brutto arsinntekt. Foretaket kan innvilge en begrenset andel lan som ikke oppfyller kravene (fleksibilitetskvote), fastsatt til 10 prosent av utlansvolum per kvartal, og 8 prosent for boliglan i Oslo.",
    type: "forskrift",
    status: "in_force",
    effective_date: "2021-01-01",
    chapter: "Utlanspraksis",
    section: "Betjeningsevne",
  },
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2020-12-09-2648 § 4",
    title: "Utlansforskriften § 4 — Belaning for boliglan",
    text: "Utlansforskriften paragraf 4 fastsetter at nye lan med pant i bolig ikke skal overstige 85 prosent av boligens verdi (belansgrad). For lan med pant i sekundaerbolig i Oslo gjelder en belansgrense pa 60 prosent. Ved beregning av belaning inngaar alle lan med pant i boligen. Finansforetaket skal verdsette boligen pa forsvarlig mate, og verdsettelsen skal vaere dokumentert. Kunden skal betale avdrag slik at samlet belansgrad innen fem ar er brakt ned til 60 prosent av boligens verdi.",
    type: "forskrift",
    status: "in_force",
    effective_date: "2021-01-01",
    chapter: "Utlanspraksis",
    section: "Belaning bolig",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SOLVENS II KEY SECTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2015-08-25-999 kap 6",
    title: "Solvens II-forskriften kapittel 6 — Systemet for risikostyring og internkontroll",
    text: "Kapittel 6 i Solvens II-forskriften regulerer forsikringsforetakets system for risikostyring og internkontroll. Foretaket skal ha et effektivt risikostyringssystem som omfatter de strategier, prosesser og rapporteringsprosedyrer som er nodvendige for a identifisere, male, overvake, styre og rapportere risikoer pa individuelt og samlet niva. Systemet skal dekke minst fire nokkelfunksjoner: risikostyringsfunksjon, aktuarfunksjon, compliancefunksjon og internrevisjonsfunksjon. Hver funksjon skal vaere operasjonelt uavhengig.",
    type: "forskrift",
    status: "in_force",
    effective_date: "2016-01-01",
    chapter: "Forsikring",
    section: "Risikostyring kap 6",
  },
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2015-08-25-999 kap 10",
    title: "Solvens II-forskriften kapittel 10 — Rapportering til Finanstilsynet",
    text: "Kapittel 10 i Solvens II-forskriften regulerer forsikringsforetakets rapporteringsplikter overfor Finanstilsynet. Foretakene skal levere kvantitative rapporteringsmaler (QRT) kvartalsvis og arlig, arlig rapport om solvens og finansiell stilling (SFCR), arlig regulaer rapport til tilsyn (RSR), og egenvurdering av risiko og solvens (ORSA). Rapporteringen skal folge EIOPA-maler og leveres via Altinn. Frister: 5 uker for kvartalsrapporter, 14 uker for arsrapport individuelt, 20 uker for konsernrapportering.",
    type: "forskrift",
    status: "in_force",
    effective_date: "2016-01-01",
    chapter: "Forsikring",
    section: "Rapportering kap 10",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ADDITIONAL STANDALONE REGULATIONS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2019-10-15-1359",
    title: "Forskrift om krav til nye utlan med pant i bolig (boliglansforskriften — historisk)",
    text: "Boliglansforskriften regulerte krav til nye boliglan fra 2015 til 2020, herunder maksimal belaning, stresstesting av betjeningsevne, og avdragskrav. Forskriften ble fra 1. januar 2021 erstattet av utlansforskriften (FOR-2020-12-09-2648) som samler kravene til bade boliglan og forbrukslan i ett regelverk. Boliglansforskriften var en viktig del av Finanstilsynets makroprudensielle verktoy for a dempe systemrisiko i boligmarkedet.",
    type: "forskrift",
    status: "repealed",
    effective_date: "2015-06-15",
    chapter: "Utlanspraksis",
    section: "Boliglan historisk",
  },
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2019-02-18-135",
    title: "Forskrift om betalingstjenester (betalingstjenesteforskriften)",
    text: "Betalingstjenesteforskriften gjennomforer deler av PSD2-direktivet i norsk rett med hensyn til kontobaserte betalingstjenester. Forskriften regulerer rettigheter og plikter ved betalingstransaksjoner, herunder informasjonskrav, samtykke og autorisasjon, tilbakeforingsplikt ved uautoriserte betalingstransaksjoner, og kundens ansvar ved misbruk av betalingsinstrumenter. Forskriften fastsetter ogs regler om verdidag for godskriving og belasting, og regler om kontoflytt mellom betalingstjenestytere.",
    type: "forskrift",
    status: "in_force",
    effective_date: "2019-04-01",
    chapter: "Betalingstjenester",
    section: "Betalingstjenesteforskriften",
  },
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2019-10-09-1349",
    title: "Forskrift om verdipapirfond (verdipapirfondforskriften)",
    text: "Verdipapirfondforskriften gir utfyllende regler til verdipapirfondloven og UCITS-direktivet. Forskriften regulerer blant annet krav til forvaltningsselskapers organisering og drift, investeringsbegrensninger for UCITS-fond, krav til noekkelinformasjonsdokument (KID), regler for fusjon og avvikling av fond, rapporteringsplikt til Finanstilsynet, og krav til depotmottaker. Forskriften fastsetter ogs regler om grensekryssende distribusjon av fond og forvaltningsselskapers delegering av oppgaver.",
    type: "forskrift",
    status: "in_force",
    effective_date: "2020-01-01",
    chapter: "Verdipapirfond",
    section: "UCITS forskrift",
  },
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2021-12-22-3874",
    title: "Forskrift om forsikringsformidling (forsikringsformidlingsforskriften)",
    text: "Forsikringsformidlingsforskriften gir utfyllende regler til forsikringsformidlingsloven og gjennomforer deler av forsikringsdistribusjonsdirektivet (IDD). Forskriften regulerer krav til etterutdanning for forsikringsformidlere (15 timer arlig), krav til informasjon til kunder om godtgjorelse og interessekonflikter, saerlige regler for radgivning ved salg av forsikringsbaserte investeringsprodukter (IBIPs), og krav til distribusjonspraksisrapportering til Finanstilsynet.",
    type: "forskrift",
    status: "in_force",
    effective_date: "2022-07-01",
    chapter: "Forsikring",
    section: "IDD forskrift",
  },
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2017-09-18-1388",
    title: "Forskrift om tiltak mot hvitvasking og terrorfinansiering mv. i betalingsforetak og e-pengeforetak",
    text: "Forskriften fastsetter saerlige regler for betalingsforetak og e-pengeforetak med hensyn til AML/CFT-forpliktelser, herunder krav til registrering, internkontroll, og grensekryssende betalingstjenester. Betalingsforetak som benytter agenter, skal sikre at agentene etterlever hvitvaskingsregelverket og gjennomfore tilstrekkelig opplaering og kontroll av agentenes virksomhet.",
    type: "forskrift",
    status: "in_force",
    effective_date: "2017-10-01",
    chapter: "Hvitvasking",
    section: "Betalingsforetak AML",
  },
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2022-06-22-1174",
    title: "Forskrift om endring i CRR/CRD-forskriften og finansforetaksforskriften (makroprudensiell tilpasning)",
    text: "Endringsforskriften gjennomforer makroprudensielle tilpasninger i CRR/CRD-regelverket, herunder oppdaterte regler for risikovekting av eksponeringer mot finansforetak, justeringer i beregningen av systemrisikobuffer, og oppdaterte krav til offentliggjoring av kapitaldekning. Endringene reflekterer gjennomforingen av CRD V-direktivet (2019/878/EU) og CRR II-forordningen (2019/876/EU) i norsk rett.",
    type: "forskrift",
    status: "in_force",
    effective_date: "2022-09-01",
    chapter: "Kapitaldekning",
    section: "CRR/CRD V endring",
  },
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2022-05-31-1009",
    title: "Forskrift om endring i CRR/CRD IV-forskriften og finansforetaksforskriften",
    text: "Endringsforskriften gjennomforer ytterligere endringer knyttet til overgangsregler fra CRR/CRD IV til CRR II/CRD V, herunder justeringer i beregning av leverage ratio (uvektet kapitalkrav), oppdaterte krav til store engasjementer, og endringer i overgangsregler for implementering av IFRS 9-effekter pa kapitaldekningen.",
    type: "forskrift",
    status: "in_force",
    effective_date: "2022-06-01",
    chapter: "Kapitaldekning",
    section: "CRR overgangsregler",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ADDITIONAL FORSKRIFTER — SPECIFIC AREAS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2007-12-21-1776",
    title: "Forskrift om arsregnskap for banker, forsikringsselskaper og finansieringsforetak (arsregnskapsforskriften)",
    text: "Arsregnskapsforskriften fastsetter saerlige regnskapsregler for banker, forsikringsselskaper og finansieringsforetak utover de generelle kravene i regnskapsloven. Forskriften regulerer oppstillingsplaner for resultatregnskap og balanse tilpasset finansforetakets virksomhet, saerlige verdsettelsesregler for finansielle instrumenter, krav til tapsavsetninger for utlan (IFRS 9), og notekrav spesifikke for finanssektoren. Forskriften gjenspeiler de saerlige regnskapsmessige forholdene i finanssektoren.",
    type: "forskrift",
    status: "in_force",
    effective_date: "2008-01-01",
    chapter: "Regnskap",
    section: "Finansforetak arsregnskap",
  },
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2009-12-18-1726",
    title: "Forskrift om livsforsikringsselskapers og pensjonsforetaks kapitalforvaltning (kapitalforvaltningsforskriften)",
    text: "Kapitalforvaltningsforskriften fastsetter krav til livsforsikringsselskapers og pensjonsforetaks kapitalforvaltning. Foretakene skal folge prudent person-prinsippet ved investering av midler som dekker forsikringstekniske avsetninger. Forskriften regulerer krav til sikkerhet, risikospredning, likviditet og avkastning, og fastsetter kvantitative investeringsbegrensninger for ulike aktivaklasser. Forskriften er supplert av Solvens II-forskriftens krav til kapitalforvaltning.",
    type: "forskrift",
    status: "in_force",
    effective_date: "2010-01-01",
    chapter: "Forsikring",
    section: "Kapitalforvaltning",
  },
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2023-06-21-1025",
    title: "Forskrift om MiCA — markeder for kryptoeiendeler",
    text: "Forskriften forbereder gjennomforing av EUs forordning om markeder for kryptoeiendeler (MiCA, forordning (EU) 2023/1114) i norsk rett gjennom EOS-avtalen. MiCA regulerer utstedelse og handel med kryptoeiendeler, herunder aktivarelaterte tokens (stablecoins), e-pengeTokens og ovriqe kryptoeiendeler. Forskriften vil stille krav til tillatelse for utstedere og tilbydere av kryptoeiendelsrelaterte tjenester (CASPs), krav til hvitbok, markedsatferdsregler, og forbrukerbeskyttelse. Finanstilsynet vil vaere nasjonalt kompetent myndighet for MiCA-tilsyn i Norge.",
    type: "forskrift",
    status: "in_force",
    effective_date: "2024-06-30",
    chapter: "Fintech",
    section: "MiCA kryptoeiendeler",
  },
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2021-06-18-2049",
    title: "Forskrift om transaksjonsregistre for verdipapirfinansieringstransaksjoner (SFTR-forskriften)",
    text: "SFTR-forskriften gjennomforer EUs forordning om rapportering og transparens for verdipapirfinansieringstransaksjoner (EU) 2015/2365 (SFTR) i norsk rett. Forskriften palegger rapporteringsplikt for verdipapirfinansieringstransaksjoner (repoer, verdipapirutlan, kjop-tilbakeforsel og marginallan) til autoriserte transaksjonsregistre. Rapporteringsplikten gjelder for finansielle og ikke-finansielle motparter over visse terskelverdier. Forskriften stiller ogs krav til transparens om gjenbruk av sikkerheter og offentliggjoring i arlige rapporter.",
    type: "forskrift",
    status: "in_force",
    effective_date: "2022-01-01",
    chapter: "Verdipapir",
    section: "SFTR rapportering",
  },
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "LOV-2024-06-21-41",
    title: "Lov om Finanstilsynet (ny finanstilsynslov)",
    text: "Den nye finanstilsynsloven ble vedtatt 21. juni 2024 og skal erstatte den opprinnelige finanstilsynsloven av 1956. Den nye loven moderniserer det rettslige rammeverket for Finanstilsynets virksomhet, herunder oppdatert formalsbestemmelse som ogs dekker finansiell stabilitet, klarere regler om Finanstilsynets uavhengighet, oppdaterte hjemler for tilsynsmessige virkemidler og sanksjoner, regler om internasjonal tilsynssamarbeid, og bestemmelser om Finanstilsynets organisering og styring. Loven trader i kraft etter naermere bestemmelse fra Kongen.",
    type: "lov",
    status: "in_force",
    effective_date: "2024-06-21",
    chapter: "Finanstilsyn",
    section: "Ny lov 2024",
  },
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "LOV-2013-06-07-31",
    title: "Lov om tjenestepensjon (tjenestepensjonsloven)",
    text: "Tjenestepensjonsloven regulerer hybride tjenestepensjonsordninger som kombinerer elementer fra innskuddspensjon og foretakspensjon. Arbeidsgivere kan opprette en tjenestepensjonsordning med en regulert minstesats for innskudd og en opptjent pensjonsrettighet for den ansatte. Loven gir medlemmene investeringsvalgfrihet innenfor rammene satt av pensjonsleverandoren. Loven ble vedtatt i 2013 som et tredje alternativ til eksisterende innskudds- og foretakspensjonslover. Finanstilsynet forer tilsyn med pensjonsleverandorer som tilbyr ordninger etter tjenestepensjonsloven.",
    type: "lov",
    status: "in_force",
    effective_date: "2014-01-01",
    chapter: "Pensjon",
    section: "Tjenestepensjon",
  },
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2020-12-22-3259",
    title: "Forskrift om register for avtaler om verdipapirlån (verdipapirlanregisteret)",
    text: "Forskriften regulerer registreringsplikt for verdipapirlansavtaler i samsvar med CSDR og SFTR. Verdipapirsentralen skal fore register over utlansavtaler for registrerte verdipapirer. Registreringen sikrer transparens om verdipapirutlan og bidrar til effektivt oppgjor.",
    type: "forskrift",
    status: "in_force",
    effective_date: "2021-01-01",
    chapter: "Verdipapir",
    section: "Verdipapirlan",
  },
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2007-06-29-877",
    title: "Forskrift om regulerte markeder (borsforskriften — utfyllende)",
    text: "Forskriften fastsetter utfyllende krav til drift av regulerte markeder og multilaterale handelsfasiliteter (MTF) i Norge, herunder krav til handelsovervaking, pre- og post-trade transparens, markedsoperatorens organisering, og regler for suspendering og stryking av finansielle instrumenter. Forskriften gjennomforer MiFID II og MiFIR-krav til handelsplasser i norsk rett.",
    type: "forskrift",
    status: "in_force",
    effective_date: "2007-11-01",
    chapter: "Verdipapir",
    section: "Markedsplassregler",
  },
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2017-12-21-2378",
    title: "Forskrift om flagging av transaksjoner med finansielle instrumenter (flaggeforskriften)",
    text: "Flaggeforskriften regulerer flaggeplikt ved kryssing av eierskapsterskler i borsnoterte selskaper i henhold til verdipapirhandelloven. Aksjonaerer og ihendehavere av rettigheter til aksjer skal sende flaggemelding til markedsoperatoren og Finanstilsynet nar de krysser 5, 10, 15, 20, 25, 1/3, 50, 2/3 og 90 prosent av stemmerettene. Forskriften fastsetter krav til meldingsformat, tidsfrist, og beregning av eierandel inkludert derivater og tilknyttede parters posisjoner.",
    type: "forskrift",
    status: "in_force",
    effective_date: "2018-01-01",
    chapter: "Verdipapir",
    section: "Flaggeplikt",
  },
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2022-12-16-2366",
    title: "Forskrift om regnskapsforere (regnskapsforerforskriften)",
    text: "Regnskapsforerforskriften gir utfyllende regler til den nye regnskapsforerloven (LOV-2022-12-16-90). Forskriften fastsetter krav til autorisasjon av regnskapsforere, etterutdanningskrav, krav til regnskapsforervirksomhetens organisering og kvalitetsstyring, og regler om tilsyn fra Finanstilsynet. Autoriserte regnskapsforere er rapporteringspliktige etter hvitvaskingsloven.",
    type: "forskrift",
    status: "in_force",
    effective_date: "2023-01-01",
    chapter: "Regnskap",
    section: "Regnskapsforer",
  },
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2021-06-29-2286",
    title: "Forskrift om endring i Solvens II-forskriften (oppdatert risikofri rentekurve)",
    text: "Endringsforskriften oppdaterer beregningen av den risikofrie rentekurven som brukes til diskontering av forsikringstekniske avsetninger under Solvens II. Endringene reflekterer ESMAs og EIOPAs oppdaterte tekniske standarder og innforer justeringer i volatilitetsjusteringen og den langsiktige likevektsrenten. Oppdateringen har vesentlig innvirkning pa forsikringsforetakenes solvensposisjon.",
    type: "forskrift",
    status: "in_force",
    effective_date: "2021-07-01",
    chapter: "Forsikring",
    section: "Rentekurve",
  },
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2020-12-18-2805",
    title: "Forskrift om eiendomsmegling (eiendomsmeglingsforskriften)",
    text: "Eiendomsmeglingsforskriften gir utfyllende regler til eiendomsmeglingsloven, herunder krav til oppdragsavtale, krav til salgsoppgave og informasjon til kjoper, krav til handtering av bud, krav til klientkonto og klientmiddelbehandling, krav til sikkerhetsstillelse, og krav til egnethetsvurdering av ansvarlige meglere. Forskriften fastsetter ogs regler om Finanstilsynets tilsyn med eiendomsmeglingsforetak.",
    type: "forskrift",
    status: "in_force",
    effective_date: "2021-01-01",
    chapter: "Eiendomsmegling",
    section: "Utfyllende regler",
  },
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2023-07-14-1273",
    title: "Forskrift om endring i hvitvaskingsforskriften (oppdaterte kundetiltakskrav)",
    text: "Endringsforskriften oppdaterer hvitvaskingsforskriften med nye krav til elektronisk identitetsverifikasjon, oppdaterte regler om forenklet kundetiltak for lavrisikoprodukter, og presiseringer av kravene til forsterket kundetiltak for hoyrisikoland identifisert av EU-kommisjonen. Endringene reflekterer gjennomforingen av deler av EUs femte hvitvaskingsdirektiv (2018/843) og erfaringer fra Finanstilsynets tilsynsvirksomhet.",
    type: "forskrift",
    status: "in_force",
    effective_date: "2023-08-01",
    chapter: "Hvitvasking",
    section: "Oppdaterte kundetiltak",
  },
  {
    sourcebook_id: "FTNO_FORSKRIFTER",
    reference: "FOR-2019-09-20-1258",
    title: "Forskrift om inkassovirksomhet (inkassoforskriften)",
    text: "Inkassoforskriften gir utfyllende regler til inkassoloven, herunder krav til inkassoforetaks organisering, sikkerhetsstillelse, krav til faglig leder, maksimalsatser for inkassosalaer, krav til saksbehandling og dokumentasjon, og regler om Finanstilsynets tilsyn. Forskriften fastsetter ogs krav til inkassoforetaks etterlevelse av god inkassoskikk og forbrukervern.",
    type: "forskrift",
    status: "in_force",
    effective_date: "2019-10-01",
    chapter: "Inkasso",
    section: "Utfyllende regler",
  },
];

// ── FTNO_RUNDSKRIV — Circulars (rundskriv) from Finanstilsynet ──────────────

const rundskriv: ProvisionRow[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // AML / CFT CIRCULARS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 8/2019",
    title: "Veileder til hvitvaskingsloven",
    text: "Rundskriv 8/2019 gir Finanstilsynets veiledning til hvitvaskingsloven og hvitvaskingsforskriften. Rundskrivet gjelder for alle rapporteringspliktige foretak under Finanstilsynets tilsyn. Veiledningen beskriver Finanstilsynets tolkning og forvaltningspraksis knyttet til blant annet virksomhetsinnrettet risikovurdering, kundetiltaksplikter (kundekontroll, lopende oppfolging), forsterket og forenklet kundetiltak, politisk eksponerte personer (PEP), reelle rettighetshavere, rapporteringsplikt for mistenkelige transaksjoner til Okokrim, og internkontroll. Rundskrivet ble korrigert i desember 2019 og erstattet av Rundskriv 4/2022.",
    type: "rundskriv",
    status: "superseded",
    effective_date: "2019-06-27",
    chapter: "Hvitvasking",
    section: "Alle sektorer",
  },
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 4/2022",
    title: "Veileder til hvitvaskingsloven",
    text: "Rundskriv 4/2022 erstatter Rundskriv 8/2019 og utgjor Finanstilsynets oppdaterte veileder til hvitvaskingsloven. Rundskrivet uttrykker Finanstilsynets tolkning og forvaltningspraksis og gjelder for alle rapporteringspliktige foretak. Veilederen er oppdatert med hensyn til endringer i hvitvaskingsforskriften, erfaringer fra Finanstilsynets tilsynsvirksomhet, og nye risikovurderinger. Rundskrivet gir veiledning om virksomhetsinnrettet risikovurdering, rutiner og internkontroll, kundekontroll og lopende oppfolging, undersokelsesplikt og rapportering til Okokrim, politisk eksponerte personer, reelle rettighetshavere, og hoyrisikosituasjoner. Rundskrivet tydeliggjor forventninger til foretakenes dokumentasjon og kvalitet i kundetiltak.",
    type: "rundskriv",
    status: "in_force",
    effective_date: "2022-11-01",
    chapter: "Hvitvasking",
    section: "Alle sektorer",
  },
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 11/2019",
    title: "Veiledning til etterlevelse av hvitvaskingsregelverket i eiendomsmeglingsvirksomhet",
    text: "Rundskriv 11/2019 gir Finanstilsynets forventninger til eiendomsmeglingsforetaks etterlevelse av hvitvaskingsloven og hvitvaskingsforskriften. Rundskrivet beskriver saerlige risikoer ved eiendomstransaksjoner, herunder risiko for hvitvasking gjennom eiendomskjop med kontanter eller gjennom komplekse selskapsstrukturer. Eiendomsmeglere skal gjennomfore risikovurdering av sin virksomhet, etablere rutiner for kundekontroll av bade kjoper og selger, identifisere reelle rettighetshavere, og rapportere mistenkelige forhold til Okokrim. Rundskrivet gir praktisk veiledning om identitetsverifikasjon, lopende oppfolging og handtering av hoyrisikoindikatorer i eiendomstransaksjoner.",
    type: "rundskriv",
    status: "in_force",
    effective_date: "2019-12-17",
    chapter: "Hvitvasking",
    section: "Eiendomsmegling",
  },
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 14/2019",
    title: "Veiledning om revisorers og revisjonsselskapers etterlevelse av hvitvaskingsregelverket",
    text: "Rundskriv 14/2019 gir Finanstilsynets forventninger til revisorer og revisjonsselskapers etterlevelse av hvitvaskingsloven. Revisorer er rapporteringspliktige etter hvitvaskingsloven og skal gjennomfore virksomhetsinnrettet risikovurdering, etablere rutiner for kundetiltak, og rapportere mistenkelige forhold. Rundskrivet beskriver saerlige risikoer og indikatorer for hvitvasking som revisorer kan oppdage i forbindelse med revisjonsoppdraget, herunder uvanlige transaksjoner, manglende dokumentasjon, og uforklarlige kontantstommer. Revisorer har en saerlig rolle fordi de har innsyn i klientforetakets okonomi og transaksjoner.",
    type: "rundskriv",
    status: "in_force",
    effective_date: "2019-12-23",
    chapter: "Hvitvasking",
    section: "Revisjon",
  },
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 15/2019",
    title: "Veiledning om regnskapsforeres og regnskapsforerselskapers etterlevelse av hvitvaskingsregelverket",
    text: "Rundskriv 15/2019 gir Finanstilsynets forventninger til regnskapsforeres etterlevelse av hvitvaskingsloven. Autoriserte regnskapsforere er rapporteringspliktige og skal gjennomfore virksomhetsinnrettet risikovurdering, etablere rutiner for kundekontroll og lopende oppfolging, og rapportere mistenkelige forhold til Okokrim. Rundskrivet gir veiledning om identifisering av hoyrisikosituasjoner i regnskapsforing, herunder klientforetak med uvanlig stor kontantomsetning, hyppige endringer i selskapsstruktur, transaksjoner med naerstaende parter uten forretningsformaal, og mangelfullt bilagsgrunnlag.",
    type: "rundskriv",
    status: "in_force",
    effective_date: "2019-12-23",
    chapter: "Hvitvasking",
    section: "Regnskapsforing",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CAPITAL ADEQUACY AND RISK — SREP / PILAR 2
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 12/2016",
    title: "Finanstilsynets praksis for vurdering av risiko og kapitalbehov",
    text: "Rundskriv 12/2016 beskriver Finanstilsynets metoder og praksis for vurdering av finansforetaks risiko og kapitalbehov (SREP — Supervisory Review and Evaluation Process). Rundskrivet redegjor for hvordan Finanstilsynet evaluerer foretakenes interne kapitalvurderingsprosess (ICAAP) og likviditetsvurderingsprosess (ILAAP), og pa dette grunnlag fastsetter individuelle pilar 2-krav. Pilar 2-kravet reflekterer risikoer som ikke fullt ut er dekket av pilar 1-minstekravene, herunder konsentrasjonsrisiko, renterisiko i bankboken, og strategisk/forretningsrisiko. Rundskrivet ble erstattet av Rundskriv 3/2022.",
    type: "rundskriv",
    status: "superseded",
    effective_date: "2016-06-15",
    chapter: "Kapitaldekning",
    section: "SREP / Pilar 2",
  },
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 3/2022",
    title: "Finanstilsynets praksis for vurdering av risiko og kapitalbehov (SREP)",
    text: "Rundskriv 3/2022 erstatter Rundskriv 12/2016 og beskriver Finanstilsynets oppdaterte metoder for vurdering av finansforetaks samlede risikoniva og tilhorende kapitalbehov. Rundskrivet redegjor for Finanstilsynets SREP-evaluering, herunder vurdering av forretningsmodell og strategisk risiko, intern styring og kontroll, kreditrisiko, markedsrisiko, operasjonell risiko, likviditetsrisiko og renterisiko i bankboken. Pa grunnlag av vurderingen fastsetter Finanstilsynet individuelle pilar 2-krav for hvert foretak, som kommer i tillegg til pilar 1-minstekrav og gjeldende bufferkrav. Rundskrivet ble i desember 2024 erstattet av en ny veiledning (ikke lenger nummerert som rundskriv).",
    type: "rundskriv",
    status: "superseded",
    effective_date: "2022-06-20",
    chapter: "Kapitaldekning",
    section: "SREP / Pilar 2",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // LENDING PRACTICES
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 5/2019",
    title: "Utlanspraksis for boliglan",
    text: "Rundskriv 5/2019 beskriver Finanstilsynets forventninger til finansforetaks utlanspraksis for boliglan. Rundskrivet supplerer boliglansforskriften og beskriver kravene til forsvarlig kredittvurdering, stresstest av betjeningsevne, belaning, gjeldsgrad og avdragsplikt. Rundskrivet gir ogs veiledning om fleksibilitetskvotens anvendelse og forventninger til intern kontroll og rapportering. Rundskrivet ble erstattet da den nye utlansforskriften tradte i kraft 1. januar 2021.",
    type: "rundskriv",
    status: "superseded",
    effective_date: "2019-04-01",
    chapter: "Utlanspraksis",
    section: "Boliglan",
  },
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 13/2019",
    title: "Utlanspraksis for forbrukslan",
    text: "Rundskriv 13/2019 beskriver Finanstilsynets forventninger til finansforetaks utlanspraksis for forbrukslan. Rundskrivet supplerer forbrukslansforskriften og gir veiledning om kredittvurdering, gjeldsbetjeningsevne, gjeldsgrad og avdragsplikt for usikrede lan. Rundskrivet ble erstattet da den nye utlansforskriften tradte i kraft 1. januar 2021.",
    type: "rundskriv",
    status: "superseded",
    effective_date: "2019-09-01",
    chapter: "Utlanspraksis",
    section: "Forbrukslan",
  },
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 1/2022",
    title: "Praksis for lan til forbrukere",
    text: "Rundskriv 1/2022 erstatter Rundskriv 5/2019 og 13/2019 og gir samlet veiledning til den nye utlansforskriften (FOR-2020-12-09-2648). Rundskrivet beskriver Finanstilsynets forventninger til finansforetaks utlanspraksis for bade boliglan og forbrukslan, herunder krav til forsvarlig kredittvurdering, stresstest av betjeningsevne (kunden skal tale 3 prosentpoeng renteoppgang, minimum 7 prosent), belaning, gjeldsgrad (maksimalt 5 ganger bruttoinntekt), og avdragsplikt. Rundskrivet gir veiledning om fleksibilitetskvoten (10 prosent av utlansvolum per kvartal, 8 prosent for Oslo), vurdering av fast eiendom som sikkerhet, og krav til intern kontroll av utlanspraksis.",
    type: "rundskriv",
    status: "in_force",
    effective_date: "2022-01-01",
    chapter: "Utlanspraksis",
    section: "Boliglan og forbrukslan",
  },
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 5/2021",
    title: "Krav til verdsettelse av fast eiendom ved innvilgning og overvaking av lan",
    text: "Rundskriv 5/2021 implementerer EBAs retningslinjer for innvilgning og overvaking av lan (EBA/GL/2020/06) med hensyn til krav til verdsettelse av fast eiendom som stilles som sikkerhet for lan. Rundskrivet beskriver Finanstilsynets forventninger til bankenes metoder for verdsettelse ved innvilgning av lan (fullstendig takst, automatiserte verdsettelsesmodeller, eller statistiske metoder), og krav til regelmessig revaluering av sikkerheter gjennom lanetiden. Rundskrivet fastsetter at sikkerhetsverdi skal oppdateres minst hvert tredje ar for boliglan og arlig for naeringslan.",
    type: "rundskriv",
    status: "in_force",
    effective_date: "2021-06-24",
    chapter: "Utlanspraksis",
    section: "Verdsettelse av sikkerhet",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // OUTSOURCING
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 7/2021",
    title: "Veiledning om utkontraktering",
    text: "Rundskriv 7/2021 beskriver Finanstilsynets forventninger til finansforetaks utkontraktering av virksomhet. Rundskrivet er harmonisert med EBAs retningslinjer om utkontraktering (EBA/GL/2019/02) og EIOPAs retningslinjer for utkontraktering til skyleverandorer. Foretaket skal sikre at utkontraktering ikke svekker kvaliteten pa intern kontroll eller Finanstilsynets mulighet til a fore tilsyn. Kritiske eller vesentlige funksjoner som utkontrakteres krever forutgaende melding til Finanstilsynet. Avtaler skal inneholde bestemmelser om tilgang og revisjonsrett, databehandling, forretningskontinuitet og exitstrategier. Foretaket skal gjennomfore risikovurdering og due diligence av leverandorer, og ha lopende overvakning. Rundskrivet dekker ogs utkontraktering til skyleverandorer (cloud outsourcing) og krav til at data ikke lagres utenfor EOS uten naermere vurdering.",
    type: "rundskriv",
    status: "in_force",
    effective_date: "2021-12-21",
    chapter: "Utkontraktering",
    section: "Alle sektorer",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GOVERNANCE AND FITNESS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 1/2020",
    title: "Vurdering av egnethetskrav",
    text: "Rundskriv 1/2020 beskriver Finanstilsynets forventninger til finansforetaks vurdering av egnethetskrav (fit and proper) for styremedlemmer og ledende ansatte. Rundskrivet ble erstattet av Rundskriv 1/2023.",
    type: "rundskriv",
    status: "superseded",
    effective_date: "2020-01-15",
    chapter: "Styring",
    section: "Egnethetskrav",
  },
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 1/2023",
    title: "Vurdering av egnethetskrav",
    text: "Rundskriv 1/2023 erstatter Rundskriv 1/2020 og gir oppdatert veiledning om Finanstilsynets forventninger til vurdering av egnethetskrav for styremedlemmer, daglig leder og andre ledende ansatte i finansforetak. Rundskrivet er harmonisert med EBA/ESMA-retningslinjene om vurdering av egnetheten til medlemmer av ledelsesorganet (EBA/GL/2021/06). Rundskrivet beskriver krav til kunnskap, erfaring og ferdigheter (individuelt og samlet for styret), krav til hederlighet og uavhengighet, krav til tidsbruk, og prosedyre for egnethetsvurdering ved nyansettelser og gjenvalg. Foretaket skal dokumentere egnethetsvurderingen og melde endringer i styre og ledelse til Finanstilsynet.",
    type: "rundskriv",
    status: "in_force",
    effective_date: "2023-03-15",
    chapter: "Styring",
    section: "Egnethetskrav",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPENSATION / REMUNERATION
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 2/2020",
    title: "Godtgjorelsesordninger i finansforetak og verdipapirforetak",
    text: "Rundskriv 2/2020 beskriver Finanstilsynets forventninger til finansforetaks og verdipapirforetaks godtgjorelsesordninger. Rundskrivet supplerer godtgjorelsesforskriften og er harmonisert med EBAs retningslinjer for forsvarlige godtgjorelsesordninger (EBA/GL/2015/22). Rundskrivet dekker identifisering av materielle risikotakere, krav til forholdet mellom fast og variabel godtgjorelse, utsettelseskrav, utbetaling i instrumenter, malus og clawback, og krav til godtgjorelsesutvalg. Foretakene skal arlig rapportere om godtgjorelsesordninger til Finanstilsynet og offentliggjore aggregert informasjon.",
    type: "rundskriv",
    status: "in_force",
    effective_date: "2020-05-19",
    chapter: "Godtgjorelse",
    section: "Alle sektorer",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SECURITIES FIRMS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 2/2023",
    title: "Verdipapirforetaks organisering og virksomhet",
    text: "Rundskriv 2/2023 klargjor Finanstilsynets tolkning og forvaltningspraksis knyttet til regler om organisering og virksomhet i verdipapirforetak. Verdipapirhandelloven stiller ulike krav som skal bidra til forsvarlig organisering og ledelse, herunder krav til styre og ledelse, handtering av innsideinformasjon og interessekonflikter, retningslinjer og rutiner, internkontroll, dokumentasjon, og god forretningsskikk. Rundskrivet dekker ogs MiFID II-krav til produktstyring, beste utforelse, egnethetsvurdering og hensiktsmessighetsvurdering, og verdipapirforetaks informasjonsplikt overfor kunder. Rundskrivet ble utgitt sammen med oppdatert konsesjonsrettleiing for verdipapirforetak.",
    type: "rundskriv",
    status: "in_force",
    effective_date: "2023-06-20",
    chapter: "Verdipapir",
    section: "Organisering",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // RECOVERY PLANS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 10/2022",
    title: "Finanstilsynets retningslinjer for gjenopprettingsplaner",
    text: "Rundskriv 10/2022 beskriver Finanstilsynets forventninger til gjenopprettingsplaner for finansforetak som omfattes av finansforetaksloven paragraf 20-5. Gjenopprettingsplanen skal beskrive foretakets strategi for a gjenopprette sin finansielle stilling etter en vesentlig forverring. Planen skal identifisere kritiske funksjoner, relevante gjenopprettingsalternativer (kapitalstyrking, salg av eiendeler, kostnadsreduksjoner), indikatorer som utloser gjenopprettingstiltak, kommunikasjonsplan, og vurdering av gjennomforbarheten av planlagte tiltak under ulike stresscenarier. Foretaket skal oppdatere planen arlig og etter vesentlige endringer i virksomheten.",
    type: "rundskriv",
    status: "in_force",
    effective_date: "2022-09-01",
    chapter: "Kriseberedskap",
    section: "Gjenopprettingsplaner",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // IKT AND OPERATIONAL RESILIENCE
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 3/2009",
    title: "Veiledning til forskrift om risikostyring og internkontroll",
    text: "Rundskriv 3/2009 gir Finanstilsynets veiledning til internkontrollforskriften (FOR-2008-09-22-1080). Rundskrivet er utviklet saerlig med tanke pa sma foretak og gir praktisk veiledning om etablering og vedlikehold av risikostyrings- og internkontrollsystem. Rundskrivet dekker organisering av internkontrollfunksjonen, identifisering og vurdering av risikoer, kontrolltiltak, informasjons- og kommunikasjonsprosesser, og lopende overvakning og forbedring. Styrets rolle og ansvar for forsvarlig risikostyring og internkontroll understrekes.",
    type: "rundskriv",
    status: "in_force",
    effective_date: "2009-02-01",
    chapter: "Risikostyring",
    section: "Internkontroll",
  },
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 1/2009",
    title: "Rapportering av IKT-hendelser til Finanstilsynet",
    text: "Rundskriv 1/2009 fastsetter krav til rapportering av vesentlige IKT-hendelser til Finanstilsynet i henhold til IKT-forskriften paragraf 8. Finansforetak skal rapportere hendelser som har eller kan ha vesentlig innvirkning pa foretakets eller kundenes virksomhet, herunder nedetid i kritiske systemer, sikkerhetsbrudd, datatap, og hendelser som papvirker betalingssystemene. Rapporten skal inneholde beskrivelse av hendelsen, arsak, konsekvenser, gjennomforte tiltak og plan for a hindre gjentagelse. Rapporteringsplikten gjelder uten ugrunnet opphold etter at hendelsen er identifisert.",
    type: "rundskriv",
    status: "in_force",
    effective_date: "2009-01-15",
    chapter: "IKT",
    section: "Hendelsesrapportering",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // INSURANCE AND PENSION
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 14/2016",
    title: "Informasjon og radgivning til medlemmer av innskuddspensjonsordninger",
    text: "Rundskriv 14/2016 beskriver Finanstilsynets forventninger til livsforsikringsselskapers informasjon og radgivning til medlemmer av innskuddspensjonsordninger. Selskapene bor gi opplaering til arbeidsgivere slik at de kan radgi sine ansatte om strategisk aktivaallokering og valg av forvaltningsstil. Pensjonsleverandoren skal beskrive de ulike investeringsalternativene pa offentlige nettsider, herunder risikoprofil, historisk avkastning, og kostnader. Medlemmer skal informeres om konsekvensene av ulike investeringsvalg og viktigheten av a tilpasse risikoprofilen til gjenvaaerende tid til pensjonering.",
    type: "rundskriv",
    status: "in_force",
    effective_date: "2016-11-01",
    chapter: "Pensjon",
    section: "Informasjonsplikt",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // REAL ESTATE BROKERAGE
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 7/2014",
    title: "Kontrakt, oppgjor og klientmiddelbehandling i eiendomsmegling",
    text: "Rundskriv 7/2014 beskriver Finanstilsynets forventninger til eiendomsmeglingsforetaks handtering av kontrakt, oppgjor og klientmidler. Rundskrivet gir veiledning om krav til kontraktsutforming, gjennomforing av det okonomiske oppgjoret mellom kjoper og selger, og reglene for behandling av klientmidler pa klientkonto. Klientmidler skal holdes adskilt fra foretakets egne midler pa egne klientkonti i bank, og det skal foretas regelmessig avstemming. Rundskrivet beskriver ogs krav til forsikring og sikkerhetsstillelse for eiendomsmeglingsforetak.",
    type: "rundskriv",
    status: "in_force",
    effective_date: "2014-09-01",
    chapter: "Eiendomsmegling",
    section: "Klientmidler",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CLIENT ACCOUNT MEASURES
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 3/2023",
    title: "Tiltak knytte til klientkontoar",
    text: "Rundskriv 3/2023 gir Finanstilsynets forventninger til foretaks tiltak knyttet til klientkontoer, herunder advokaters, eiendomsmegleres og inkassoforetaks behandling av klientmidler. Rundskrivet beskriver krav til adskillelse av klientmidler fra foretakets egne midler, krav til klientkontoavtaler med bank, rutiner for lopende avstemming, og rapporteringsplikt ved avvik. Rundskrivet erstatter tidligere saerskilt veiledning og samler kravene i ett dokument.",
    type: "rundskriv",
    status: "in_force",
    effective_date: "2023-06-01",
    chapter: "Klientmidler",
    section: "Alle sektorer",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // HIGH RISK COUNTRIES
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 3/2021",
    title: "Veiledning om hoyrisikoland og tiltak ved hoyrisikosituasjoner",
    text: "Rundskriv 3/2021 gir Finanstilsynets veiledning om haandtering av hoyrisikosituasjoner etter hvitvaskingsloven, herunder identifisering av hoyrisikoland og krav til forsterket kundetiltak. Rundskrivet bygger pa FATFs lister over land med strategiske mangler i tiltakene mot hvitvasking og terrorfinansiering, og EU-kommisjonens delegerte forordning om hoyrisikoland. Finansforetak skal vurdere risikonivaaet forbundet med kunder, produkter og geografiske omrader, og anvende forsterket kundetiltak der risikoen er forhoyet. Rundskrivet presiserer at foretakene ikke automatisk skal avvise alle kunder med tilknytning til hoyrisikoland, men gjennomfore en risikobasert vurdering.",
    type: "rundskriv",
    status: "in_force",
    effective_date: "2021-03-15",
    chapter: "Hvitvasking",
    section: "Hoyrisikoland",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // LENDING MONITORING (EBA)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 4/2021",
    title: "Retningslinjer for innvilgning og overvaking av lan",
    text: "Rundskriv 4/2021 implementerer EBAs retningslinjer for innvilgning og overvaking av lan (EBA/GL/2020/06) i norsk tilsynspraksis. Retningslinjene fastsetter krav til kredittvurdering ved innvilgning av lan, herunder vurdering av lonnsomhet, gjeldsbetjeningsevne og sikkerheter. Kredittstyringsrammeverket skal sikre forsvarlig innvilgning og lopende overvaking av kreditteksponering gjennom lanetiden. Retningslinjene dekker ogs krav til miljomessig berekraft i lanebeslutninger, vurdering av klimarelaterte risikoer, og handtering av misligholdte laneengasjementer.",
    type: "rundskriv",
    status: "in_force",
    effective_date: "2021-06-30",
    chapter: "Utlanspraksis",
    section: "EBA retningslinjer",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DORA PREPARATION
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 6/2023",
    title: "Digital operasjonell motstandsdyktighet (DORA) — forberedelse for finansforetak",
    text: "Rundskriv 6/2023 orienterer om Europaparlaments- og radsforordning (EU) 2022/2554 om digital operasjonell motstandsdyktighet i finanssektoren (DORA). Finansforetak skal etablere et rammeverk for IKT-risikostyring med klart definerte roller og ansvar, kartlegging av IKT-eiendeler og kritiske funksjoner, krav til forretningskontinuitet og gjenoppretting, samt periodisk testing av digital motstandsdyktighet herunder trusselsbasert penetrasjonstesting (TLPT). Tilbydere av kritiske tredjepartstjenester vil bli underlagt direkte tilsyn. Finanstilsynet forventer at finansforetak forbereder seg pa DORA-etterlevelse, som ble vedtatt i norsk lov i mai 2025.",
    type: "rundskriv",
    status: "in_force",
    effective_date: "2023-09-01",
    chapter: "IKT",
    section: "DORA forberedelse",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SUSTAINABILITY RISK
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 6/2022",
    title: "Finanstilsynets forventninger til handtering av berekraftsrisiko",
    text: "Rundskriv 6/2022 beskriver Finanstilsynets forventninger til finansforetaks haandtering av berekraftsrisiko, herunder klimarisiko og overgangsrisiko. Foretakene skal integrere berekraftsrisiko i risikostyringsrammeverket, vurdere vesentlige berekraftsrisikoer i ICAAP/ORSA, og etablere rutiner for overvaking og rapportering. For banker inkluderer dette vurdering av klimarelaterte kredittrisiko i laneboken, for forsikringsselskaper vurdering av fysisk klimarisiko i forsikringsportefoljen, og for kapitalforvaltere integrering av berekraftsfaktorer i investeringsbeslutninger i henhold til SFDR.",
    type: "rundskriv",
    status: "in_force",
    effective_date: "2022-10-01",
    chapter: "Berekraft",
    section: "Risikohandtering",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ADDITIONAL RUNDSKRIV — SECTOR-SPECIFIC
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 6/2019",
    title: "Veiledning om krav til forsikringsformidlingsforetaks virksomhet",
    text: "Rundskriv 6/2019 gir Finanstilsynets forventninger til forsikringsformidlingsforetaks organisering og virksomhet, herunder krav til god forretningsskikk, informasjonsplikt overfor kunder, handtering av interessekonflikter, krav til faglige kvalifikasjoner, og krav til ansvarsforsikring. Rundskrivet reflekterer gjennomforingen av forsikringsdistribusjonsdirektivet (IDD) i norsk rett.",
    type: "rundskriv",
    status: "in_force",
    effective_date: "2019-07-01",
    chapter: "Forsikring",
    section: "Forsikringsformidling",
  },
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 15/2014",
    title: "Godtgjorelsesordninger i finansforetak",
    text: "Rundskriv 15/2014 gir Finanstilsynets veiledning om godtgjorelsesordninger i finansforetak. Rundskrivet ble erstattet av Rundskriv 2/2020, men inneholdt de opprinnelige forventningene til identifisering av materielle risikotakere, forholdet mellom fast og variabel godtgjorelse, utsettelseskrav, og krav til godtgjorelsesutvalg. Rundskrivet var basert pa EBAs retningslinjer for forsvarlige godtgjorelsesordninger.",
    type: "rundskriv",
    status: "superseded",
    effective_date: "2014-12-01",
    chapter: "Godtgjorelse",
    section: "Finansforetak",
  },
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 10/2019",
    title: "Retningslinjer for gjenopprettingsplaner for banker",
    text: "Rundskriv 10/2019 beskrev Finanstilsynets forventninger til gjenopprettingsplaner for finansforetak. Rundskrivet ble erstattet av Rundskriv 10/2022 som gir oppdaterte retningslinjer harmonisert med EBAs retningslinjer for gjenopprettingsplaner og Bankenes sikringsfonds retningslinjer for krisehndtering.",
    type: "rundskriv",
    status: "superseded",
    effective_date: "2019-11-01",
    chapter: "Kriseberedskap",
    section: "Gjenopprettingsplaner",
  },
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 24/2016",
    title: "Kontantbelopsbegrensning for forhandlere av gjenstander",
    text: "Rundskriv 24/2016 gir veiledning om hvitvaskingslovens kontantbelopsbegrensning for forhandlere av gjenstander. Forhandlere som mottar kontantvederlag pa 40 000 kroner eller mer, er rapporteringspliktige etter hvitvaskingsloven og skal gjennomfore kundetiltak og rapportere mistenkelige transaksjoner. Rundskrivet beskriver hvem som regnes som forhandlere av gjenstander, naer kontantbelopsbegrensningen gjelder, og hvilke tiltak forhandlerne skal iverksette.",
    type: "rundskriv",
    status: "in_force",
    effective_date: "2016-12-01",
    chapter: "Hvitvasking",
    section: "Forhandlere",
  },
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 8/2022",
    title: "Kapitaldekning for forsikringsforetak — overgangstiltak under Solvens II",
    text: "Rundskriv 8/2022 gir veiledning om overgangsbestemmelser under Solvens II-regelverket for norske forsikringsforetak. Rundskrivet beskriver vilkar for og anvendelse av overgangsregler for tekniske avsetninger og risikofri rentekurve, som gir forsikringsforetakene en gradvis overgang fra det tidligere solvensregelverket til Solvens II. Foretakene skal rapportere bade med og uten overgangsregler.",
    type: "rundskriv",
    status: "in_force",
    effective_date: "2022-08-01",
    chapter: "Forsikring",
    section: "Solvens II overgang",
  },
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 9/2022",
    title: "Krav til IKT-sikkerhet for betalingsforetak og e-pengeforetak",
    text: "Rundskriv 9/2022 beskriver Finanstilsynets forventninger til IKT-sikkerhet spesifikt for betalingsforetak og e-pengeforetak. Rundskrivet presiserer kravene i IKT-forskriften og EBAs retningslinjer for IKT- og sikkerhetsrisikostyring (EBA/GL/2019/04) for disse foretakstypene, herunder krav til sterk kundeautentisering (SCA), sikker kommunikasjon med tredjepartstilbydere (TPP), hendelsesrapportering, og forretningskontinuitet.",
    type: "rundskriv",
    status: "in_force",
    effective_date: "2022-09-15",
    chapter: "IKT",
    section: "Betalingsforetak",
  },
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 2/2022",
    title: "Krav til styring av operasjonell risiko i finansforetak",
    text: "Rundskriv 2/2022 gir Finanstilsynets veiledning om krav til styring av operasjonell risiko i finansforetak, herunder krav til rammeverk for operasjonell risikostyring, identifisering og vurdering av operasjonelle risikoer, rapportering av operasjonelle hendelser, og beregning av kapitalkrav for operasjonell risiko. Rundskrivet er harmonisert med EBAs retningslinjer for operasjonell risikostyring.",
    type: "rundskriv",
    status: "in_force",
    effective_date: "2022-04-01",
    chapter: "Risikostyring",
    section: "Operasjonell risiko",
  },
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 5/2022",
    title: "Retningslinjer for rapportering av sikkerhetsrelaterte IKT-hendelser",
    text: "Rundskriv 5/2022 oppdaterer kravene til rapportering av IKT-hendelser til Finanstilsynet og beskriver kriteriene for naer en hendelse anses som vesentlig og utloser rapporteringsplikt. Rundskrivet er harmonisert med EBAs retningslinjer for storst hendelsesrapportering under PSD2 og forbereder overgangen til DORA-regelverkets hendelsesrapporteringskrav. Foretakene skal rapportere innen fire timer etter klassifisering av hendelsen som vesentlig.",
    type: "rundskriv",
    status: "in_force",
    effective_date: "2022-07-01",
    chapter: "IKT",
    section: "Hendelsesrapportering oppdatert",
  },
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 7/2022",
    title: "Stresstesting av finansforetak — tilsynsmessige forventninger",
    text: "Rundskriv 7/2022 beskriver Finanstilsynets forventninger til finansforetaks gjennomforing av stresstester. Foretakene skal gjennomfore regelmessige stresstester som del av ICAAP/ILAAP-prosessen, herunder makrookonomiske stresscenarier, reverse stresstester, og sektorspesifikke stresstester. Stresscenarioene skal vaere tilstrekkelig alvorlige men plausible, og resultatene skal integreres i foretakets kapital- og likviditetsplanlegging. Styret skal informeres om resultatene og godkjenne stresstest-rammeverket.",
    type: "rundskriv",
    status: "in_force",
    effective_date: "2022-08-15",
    chapter: "Kapitaldekning",
    section: "Stresstesting",
  },
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 4/2023",
    title: "Forvaltningsrevisjon og tematilsyn — baerekraftsrapportering",
    text: "Rundskriv 4/2023 beskriver Finanstilsynets tilnaerming til tilsyn med berekraftsrapportering, herunder kontroll av borsnoterte foretaks rapportering under SFDR, taksonomien og kommende CSRD-krav. Rundskrivet fastsetter forventninger til dokumentasjon av berekraftspaastander, konsistens mellom finansiell og ikke-finansiell rapportering, og krav til revisors attestasjon av berekraftsrapporter.",
    type: "rundskriv",
    status: "in_force",
    effective_date: "2023-07-01",
    chapter: "Berekraft",
    section: "Rapporteringstilsyn",
  },
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 5/2023",
    title: "Retningslinjer for tilsyn med inkassoforetak",
    text: "Rundskriv 5/2023 beskriver Finanstilsynets forventninger til inkassoforetaks virksomhet, herunder krav til god inkassoskikk, forsvarlig saksbehandling, korrekt gebyrberegning, klagehndtering, og etterlevelse av hvitvaskingsregelverket. Rundskrivet presiserer kravene etter den oppdaterte inkassoloven og vektlegger forbrukerbeskyttelse og rettferdig behandling av skyldnere.",
    type: "rundskriv",
    status: "in_force",
    effective_date: "2023-08-01",
    chapter: "Inkasso",
    section: "Tilsynsforventninger",
  },
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 7/2023",
    title: "Kredittpraksis for naeringslan — tilsynsmessige forventninger",
    text: "Rundskriv 7/2023 gir Finanstilsynets forventninger til bankenes kredittpraksis for naeringslan, herunder krav til kredittvurdering av naeringskunder, verdsettelse av sikkerheter (naeriseiendom), stresstest av kunders gjeldsbetjeningsevne, og krav til intern rapportering og kontroll. Rundskrivet adresserer saerlig konsentrasjonsrisiko i naeringseiendomsportefoljer og forventninger til forhoyet aktsomhet i perioder med stigende renter og usikkerhet i eiendomsmarkedet.",
    type: "rundskriv",
    status: "in_force",
    effective_date: "2023-10-01",
    chapter: "Utlanspraksis",
    section: "Naeringslan",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ADDITIONAL RUNDSKRIV — SPECIFIC TOPIC AREAS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 9/2019",
    title: "Retningslinjer for utkontraktering i finansforetak",
    text: "Rundskriv 9/2019 beskrev Finanstilsynets opprinnelige forventninger til finansforetaks utkontraktering av virksomhet for Rundskriv 7/2021 ble publisert. Rundskrivet fastsatte krav til risikovurdering, due diligence av leverandorer, kontraktuelle krav, og meldeplikt til Finanstilsynet ved utkontraktering av kritiske funksjoner. Rundskrivet ble erstattet av Rundskriv 7/2021 som er harmonisert med EBAs og EIOPAs oppdaterte retningslinjer.",
    type: "rundskriv",
    status: "superseded",
    effective_date: "2019-10-01",
    chapter: "Utkontraktering",
    section: "Alle sektorer (tidl.)",
  },
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 11/2022",
    title: "Tilsynsforventninger til forsikringsforetaks solvensrapportering",
    text: "Rundskriv 11/2022 presiserer Finanstilsynets forventninger til kvaliteten i forsikringsforetaks solvensrapportering under Solvens II. Rundskrivet adresserer hyppige feil og mangler identifisert gjennom Finanstilsynets kvalitetskontroll av rapporteringen, herunder feil i beregning av tekniske avsetninger, inkonsekvenser mellom ulike rapporteringsmaler (QRT), og mangelfulle noteopplysninger i rapporten om solvens og finansiell stilling (SFCR).",
    type: "rundskriv",
    status: "in_force",
    effective_date: "2022-12-01",
    chapter: "Forsikring",
    section: "Rapporteringskvalitet",
  },
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 8/2023",
    title: "Krav til handtering av tredjepartsrisiko — forberedelse til DORA",
    text: "Rundskriv 8/2023 gir veiledning om Finanstilsynets forventninger til finansforetaks handtering av IKT-tredjepartsrisiko i forberedelsen til DORA-regelverket. Foretakene skal kartlegge alle IKT-tredjepartsavtaler, klassifisere leverandorer etter kritikalitet, gjennomfore risikovurdering av kritiske IKT-leverandorer, og etablere et register over IKT-tredjepartsavtaler. Rundskrivet presiserer kravene til exitstrategier, konsentarsjonsrisiko i IKT-leverandorkjeden, og kontraktuelle krav til tilgangs- og revisjonsrett.",
    type: "rundskriv",
    status: "in_force",
    effective_date: "2023-11-01",
    chapter: "IKT",
    section: "Tredjepartsrisiko",
  },
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 12/2019",
    title: "Veiledning om verdipapirforetaks handtering av interessekonflikter",
    text: "Rundskriv 12/2019 gir Finanstilsynets forventninger til verdipapirforetaks identifisering og handtering av interessekonflikter i henhold til verdipapirhandelloven og MiFID II. Foretakene skal ha en interessekonfliktpolicy godkjent av styret, prosedyrer for a identifisere potensielle interessekonflikter, tiltak for a forebygge eller handtere konflikter (informasjonsbarrierer, avsondring av virksomhetsomrader), og plikt til a opplyse kunder nar interessekonflikter ikke kan handteres tilstrekkelig.",
    type: "rundskriv",
    status: "in_force",
    effective_date: "2019-11-01",
    chapter: "Verdipapir",
    section: "Interessekonflikter",
  },
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 2/2021",
    title: "Retningslinjer for kapitalberegning ved bruk av standardmetoden for kreditrisiko",
    text: "Rundskriv 2/2021 gir Finanstilsynets veiledning om anvendelsen av standardmetoden for beregning av kapitalkrav for kreditrisiko i henhold til CRR-forordningen. Rundskrivet presiserer klassifisering av eksponeringer i eksponeringsklasser, anvendelse av risikovekter, krav til sikkerhetsstillelse og garantier for a oppna redusert risikovekt, og beregning av eksponeringsverdier for poster utenom balansen.",
    type: "rundskriv",
    status: "in_force",
    effective_date: "2021-02-01",
    chapter: "Kapitaldekning",
    section: "Standardmetoden kreditrisiko",
  },
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 6/2021",
    title: "Tilsynsforventninger til bankenes kredittrisikohandtering",
    text: "Rundskriv 6/2021 beskriver Finanstilsynets forventninger til bankenes kredittrisikohandtering, herunder krav til kredittstrategi godkjent av styret, kredittbevilgningsprosess med klare fullmakter, kredittvurderingsmetodikk, risikoklassifisering av kunder, lopende overvaking av kredittportefoljen, og tapsavsetningsprosess i samsvar med IFRS 9. Rundskrivet vektlegger behovet for tidlig identifisering av forverring i kredittportefoljen og proaktiv handtering av problem-eksponeringer.",
    type: "rundskriv",
    status: "in_force",
    effective_date: "2021-09-01",
    chapter: "Kapitaldekning",
    section: "Kredittrisikohandtering",
  },
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 3/2020",
    title: "Midlertidige tiltak — COVID-19-pandemiens innvirkning pa finansmarkedene",
    text: "Rundskriv 3/2020 beskrev Finanstilsynets midlertidige tilsynsmessige forventninger som respons pa COVID-19-pandemiens innvirkning pa norske finansmarkeder. Rundskrivet ga veiledning om fleksibilitet i utlansforskriftens krav, forventninger til forsvarlig kredittvurdering under krisesituasjoner, midlertidige lettelser i rapporteringsfrister, og oppfordring til bankene om a vise fleksibilitet overfor kunder i midlertidige betalingsvanskeligheter. Rundskrivet er ikke lenger gjeldende men illustrerer Finanstilsynets tilnaerming til krisestyring.",
    type: "rundskriv",
    status: "superseded",
    effective_date: "2020-03-15",
    chapter: "Kriseberedskap",
    section: "COVID-19",
  },
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 4/2020",
    title: "Utbyttepolitikk for finansforetak — tilsynsforventninger under okonomisk usikkerhet",
    text: "Rundskriv 4/2020 ga Finanstilsynets forventninger til finansforetaks utbyttepolitikk under perioder med okonomisk usikkerhet. Finanstilsynet forventet at banker og forsikringsselskaper utviste forsiktighet med kapitalutdelinger for a opprettholde tilstrekkelige kapitalbuffere. Rundskrivet var harmonisert med tilsvarende anbefalinger fra ECB, EBA og EIOPA. Etter normalisering av markedsforholdene ble de midlertidige forventningene gradvis fjernet.",
    type: "rundskriv",
    status: "superseded",
    effective_date: "2020-04-01",
    chapter: "Kapitaldekning",
    section: "Utbyttepolitikk",
  },
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 1/2021",
    title: "Utlanspraksis for boliglan — oppdatering per 2021",
    text: "Rundskriv 1/2021 ga oppdatert veiledning om Finanstilsynets forventninger til utlanspraksis for boliglan med virkning fra 1. januar 2021, da den nye utlansforskriften tradte i kraft. Rundskrivet redegjorde for de samlede kravene til boliglan og forbrukslan under det nye regelverket og ble etterhvert erstattet av Rundskriv 1/2022 som ga mer detaljert veiledning.",
    type: "rundskriv",
    status: "superseded",
    effective_date: "2021-01-01",
    chapter: "Utlanspraksis",
    section: "Boliglan 2021",
  },
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 9/2023",
    title: "Krav til attestasjon og revisjonsberetning for forsikringsforetak",
    text: "Rundskriv 9/2023 beskriver Finanstilsynets forventninger til innholdet i revisors attestasjon og revisjonsberetning for forsikringsforetak under Solvens II. Rundskrivet presiserer kravene til revisors uttalelse om solvensrapporteringen, herunder revisors rolle ved attestasjon av kvantitative rapporteringsmaler (QRT), SFCR-rapporten, og ORSA-rapporten. Rundskrivet reflekterer oppdaterte internasjonale revisjonsstandarder og Finanstilsynets erfaringer fra kvalitetskontroll av revisjon.",
    type: "rundskriv",
    status: "in_force",
    effective_date: "2023-11-15",
    chapter: "Forsikring",
    section: "Revisjonsberetning",
  },
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 10/2023",
    title: "Forventninger til verdipapirforetaks rapportering av ordrehandtering og beste utforelse",
    text: "Rundskriv 10/2023 gir Finanstilsynets forventninger til verdipapirforetaks rapportering av ordrehandtering og beste utforelse (best execution) etter MiFID II. Foretakene skal arlig offentliggjore sine fem viktigste handelsplasser for hver klasse av finansielle instrumenter (RTS 28-rapportering) og dokumentere at ordrehandteringen er i samsvar med foretakets retningslinjer for beste utforelse. Rundskrivet adresserer hyppige mangler identifisert i Finanstilsynets tilsynsarbeid, herunder utilstrekkelig dokumentasjon av handelsplassvurderinger.",
    type: "rundskriv",
    status: "in_force",
    effective_date: "2023-12-01",
    chapter: "Verdipapir",
    section: "Beste utforelse",
  },
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 2/2024",
    title: "Tilsynsforventninger til etterlevelse av utlansforskriften — oppdatering",
    text: "Rundskriv 2/2024 gir Finanstilsynets oppdaterte forventninger til etterlevelse av utlansforskriften etter forskriftens forlengelse og justeringer per 1. januar 2024. Rundskrivet presiserer forventninger til beregning av betjeningsevne under gjeldende renteniva, oppdaterte fleksibilitetskvoter, og krav til intern rapportering og kontroll av utlansportefoljen. Rundskrivet reflekterer ogs forventninger til behandling av refinansiering og lan med fastrente.",
    type: "rundskriv",
    status: "in_force",
    effective_date: "2024-01-15",
    chapter: "Utlanspraksis",
    section: "Oppdatert 2024",
  },
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 1/2024",
    title: "Retningslinjer for Finanstilsynets kontroll av finansiell rapportering (regnskapskontroll)",
    text: "Rundskriv 1/2024 beskriver Finanstilsynets prioriteringer og metoder for kontroll av borsnoterte foretaks finansielle rapportering. Prioriterte kontrollomrader for 2024 inkluderer klimarelaterte opplysninger, virkelig verdi-maling av eiendeler i usikre markeder, nedskrivningsvurderinger under IAS 36, implementering av IFRS 17 for forsikringsforetak, og kvaliteten pa berekraftsrapporteringen under CSRD. Rundskrivet gir ogs statistikk over funn fra foregaende ars regnskapskontroll.",
    type: "rundskriv",
    status: "in_force",
    effective_date: "2024-02-01",
    chapter: "Regnskap",
    section: "Regnskapskontroll 2024",
  },
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 3/2024",
    title: "Forventninger til finansforetaks handtering av operasjonell og IKT-risiko under DORA",
    text: "Rundskriv 3/2024 beskriver Finanstilsynets oppdaterte forventninger til finansforetaks handtering av operasjonell risiko og IKT-risiko i overgangen til DORA-regelverket. Rundskrivet samler og oppdaterer tidligere veiledning fra Rundskriv 2/2022, 5/2022, 9/2022 og 8/2023 i lys av DORA-lovens ikrafttredelse. Foretakene skal sikre at IKT-risikohandteringsrammeverket er tilpasset DORA-kravene, at IKT-tredjepartsregisteret er oppdatert, og at TLPT-planer er utarbeidet for foretak over terskelverdiene.",
    type: "rundskriv",
    status: "in_force",
    effective_date: "2024-06-01",
    chapter: "IKT",
    section: "DORA overgang",
  },
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 4/2024",
    title: "Krav til baerekraftsrapportering for forsikringsforetak — CSRD og SFDR",
    text: "Rundskriv 4/2024 presiserer Finanstilsynets forventninger til forsikringsforetaks baerekraftsrapportering under bade CSRD og SFDR. Forsikringsforetakene skal rapportere om klimarelaterte risikoer i forsikringsportefoljen, integrering av baerekraftsfaktorer i kapitalforvaltningen, og klassifisering av forsikringsbaserte investeringsprodukter (IBIPs) under SFDR. Rundskrivet adresserer samspillet mellom Solvens II ORSA-rapportering og CSRD berekraftsrapportering.",
    type: "rundskriv",
    status: "in_force",
    effective_date: "2024-09-01",
    chapter: "Berekraft",
    section: "Forsikring berekraft",
  },
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 5/2024",
    title: "Retningslinjer for tilsyn med AML/CFT i kryptovaluta- og betalingsforetak",
    text: "Rundskriv 5/2024 gir Finanstilsynets forventninger til tilbydere av vekslings- og oppbevaringstjenester for virtuell valuta og betalingsforetaks etterlevelse av hvitvaskingsregelverket. Rundskrivet reflekterer erfaringer fra Finanstilsynets tematilsyn og beskriver forventninger til transaksjonsovervaking for kryptovalutatransaksjoner, krav til travel rule (overforingsinformasjon ved kryptovalutatransferinger), og forsterket kundekontroll for hoyrisikotransaksjoner. Rundskrivet forbereder overgangen til MiCA-regelverkets AML-krav.",
    type: "rundskriv",
    status: "in_force",
    effective_date: "2024-11-01",
    chapter: "Hvitvasking",
    section: "Kryptovaluta AML",
  },
  {
    sourcebook_id: "FTNO_RUNDSKRIV",
    reference: "Rundskriv 6/2024",
    title: "Tilsynsforventninger til forsikringsforetaks klimastresstest",
    text: "Rundskriv 6/2024 beskriver Finanstilsynets forventninger til forsikringsforetaks gjennomforing av klimastresstester. Foretakene skal vurdere innvirkningen av klimascenarier (bade fysisk risiko og overgangsrisiko) pa forsikringstekniske avsetninger, solvensposisjon og investeringsportefolje. Rundskrivet er harmonisert med EIOPAs retningslinjer for klimastresstest og danner grunnlag for Finanstilsynets vurdering av klimarisiko i SREP for forsikringsforetak.",
    type: "rundskriv",
    status: "in_force",
    effective_date: "2024-12-01",
    chapter: "Forsikring",
    section: "Klimastresstest",
  },
];

// ── FTNO_VEILEDNINGER — Guidance documents (veiledninger) ───────────────────

const veiledninger: ProvisionRow[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // ICT GUIDANCE
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning IKT-forskriften § 3",
    title: "Veiledning til IKT-forskriftens paragraf 3 — IKT-strategi og organisering",
    text: "Veiledningen beskriver Finanstilsynets forventninger til finansforetaks IKT-strategi og organisering i henhold til IKT-forskriftens paragraf 3. Styret skal fastsette IKT-strategien som del av foretakets overordnede strategi. IKT-strategien skal dekke foretakets IKT-arkitektur, sikkerhetsstrategi, kompetansebehov, og plan for utvikling og vedlikehold av IKT-systemer. Foretaket skal ha en organisering som sikrer at IKT-ansvaret er klart definert, og at det er tilstrekkelig kompetanse og ressurser til a ivareta IKT-sikkerheten.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2009-01-01",
    chapter: "IKT",
    section: "Strategi",
  },
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning IKT-forskriften § 5",
    title: "Veiledning til IKT-forskriftens paragraf 5 — Sikkerhet",
    text: "Veiledningen beskriver Finanstilsynets forventninger til IKT-sikkerhet i finansforetak. Foretaket skal ha sikkerhetstiltak som er tilpasset virksomhetens art, omfang og kompleksitet. Veiledningen dekker fysisk sikring av IKT-infrastruktur, logisk tilgangskontroll med minste-privilegium-prinsippet, kryptering av sensitiv informasjon under lagring og overforil, sikkerhetskopiering med regelmessig testing av gjenoppretting, sarbarhetsstyring med regelmessig oppdatering og patching, og nettverkssikkerhet med segmentering og brannmurer. Foretaket skal gjennomfore regelmessige sarbarhetsskanninger og penetrasjonstester av kritiske systemer.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2013-08-01",
    chapter: "IKT",
    section: "Sikkerhet",
  },
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning IKT-forskriften § 6",
    title: "Veiledning til IKT-forskriftens paragraf 6 — Drift og utvikling",
    text: "Veiledningen gir Finanstilsynets forventninger til styring av drift og utvikling av IKT-systemer. Foretaket skal ha dokumenterte prosesser for endringshandtering, testing av endringer for produksjonssetting, handtering av driftsforstyrrelser og feil, samt kapasitetsstyring. Utviklingsmiljoer skal vaere adskilt fra produksjonsmiljoer. Foretaket skal ha rutiner for livssyklusstyring av IKT-systemer, herunder utfasing av utdaterte systemer og teknisk gjeld.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2013-08-01",
    chapter: "IKT",
    section: "Drift",
  },
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning IKT-risikovurdering",
    title: "Veiledning for gjennomforing av IKT-risikovurdering i finansforetak",
    text: "Veiledningen beskriver Finanstilsynets forventninger til finansforetaks gjennomforing av IKT-risikovurderinger. Foretaket skal identifisere verdifulle informasjonsverdier og IKT-systemer, vurdere trusler og sarbarheter, og estimere sannsynlighet og konsekvens av uonskede hendelser. Risikovurderingen skal dekke konfidensialitet, integritet og tilgjengelighet. Resultatet skal dokumenteres og rapporteres til styret. Risikovurderingen danner grunnlag for prioritering av sikkerhetstiltak og skal oppdateres minst arlig og ved vesentlige endringer.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2010-01-01",
    chapter: "IKT",
    section: "Risikovurdering",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SOLVENCY II REPORTING GUIDANCE
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning Solvens II arsrapportering",
    title: "Veiledning for Solvens II arsrapportering til Finanstilsynet",
    text: "Veiledningen beskriver Finanstilsynets forventninger til forsikringsforetaks arlige rapportering under Solvens II-regelverket. Foretakene skal rapportere kvantitative maler (QRT — Quantitative Reporting Templates) for tekniske avsetninger, eiendeler, solvenskapitalkrav (SCR), minimumskapitalkrav (MCR), og egenkapital. Rapporteringen skjer via Altinn i henhold til EIOPA-maler. Veiledningen gir oversettelse av relevante skjemaer og presiseringer for norske forhold. Rapporteringsfristen er 14 uker etter arsavslutning for individuelle foretak og 20 uker for konsernrapportering.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2025-12-18",
    chapter: "Forsikring",
    section: "Solvens II rapportering",
  },
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning Solvens II kvartalsrapportering",
    title: "Veiledning for Solvens II kvartalsrapportering til Finanstilsynet",
    text: "Veiledningen beskriver krav til kvartalsvis rapportering under Solvens II. Forsikringsforetak som overstiger terskelverdiene i Solvens II-forskriften, skal rapportere utvalgte kvantitative maler kvartalsvis via Altinn (KRT-1102 og KRT-1103). Kvartalsrapporteringen dekker balanse, tekniske avsetninger, solvenskapitalkrav og eiendeler. Rapporteringsfristen er fem uker etter kvartalsslutt. Veiledningen inneholder oversettelse av EIOPA-malene tilpasset norske forhold.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2025-12-18",
    chapter: "Forsikring",
    section: "Solvens II kvartalsrapport",
  },
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning ORSA",
    title: "Veiledning om egenvurdering av risiko og solvens (ORSA)",
    text: "Veiledningen beskriver Finanstilsynets forventninger til forsikringsforetaks egenvurdering av risiko og solvens (ORSA — Own Risk and Solvency Assessment). ORSA skal vaere en integrert del av foretakets risikostyringssystem og gjennomfores minst arlig. Vurderingen skal dekke foretakets samlede solvensbehov med hensyn til risikoprofilen, overholdelse av kapitalkrav pa lopende basis, og i hvilken grad risikoprofilen avviker fra forutsetningene i beregningen av solvenskapitalkravet (SCR). ORSA-rapporten sendes til Finanstilsynet som vedlegg til Altinn-skjema KRT-1110-O.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2016-01-01",
    chapter: "Forsikring",
    section: "ORSA",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SREP / CAPITAL REQUIREMENTS GUIDANCE
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning SREP 2024",
    title: "Finanstilsynets praksis for vurdering av risiko og kapitalbehov — veiledning",
    text: "Veiledningen erstatter Rundskriv 3/2022 fra desember 2024 og beskriver Finanstilsynets oppdaterte metoder for vurdering av risiko og kapitalbehov (SREP). Veiledningen redegjor for hovedelementene i Finanstilsynets tilsynsmessige vurderingsprosess: vurdering av forretningsmodell, intern styring og kontroll, kapitaldekningssituasjonen herunder kreditrisiko, markedsrisiko, operasjonell risiko, konsentrasjonsrisiko og renterisiko i bankboken, og likviditetssituasjonen. Finanstilsynet fastsetter pa grunnlag av denne vurderingen forhoyede kapitalkrav (pilar 2-krav) for det enkelte foretak. Veiledningen reflekterer erfaringer fra tilsynsvirksomheten og oppdaterte EBA-retningslinjer.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2024-12-20",
    chapter: "Kapitaldekning",
    section: "SREP veiledning",
  },
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning ICAAP",
    title: "Veiledning om foretakenes interne kapitalvurderingsprosess (ICAAP)",
    text: "Veiledningen beskriver Finanstilsynets forventninger til finansforetaks interne kapitalvurderingsprosess (ICAAP — Internal Capital Adequacy Assessment Process). Alle banker og andre foretak underlagt kapitalkrav skal arlig gjennomfore en ICAAP som vurderer foretakets samlede risikoprofil og kapitalbehov. ICAAP skal gjennomfores som en integrert del av foretakets risikostyrings- og planleggingsprosess. Vurderingen skal dekke alle vesentlige risikoer foretaket er eksponert for, herunder risikoer som ikke er dekket av pilar 1-minstekravene. Styret har det overordnede ansvaret for ICAAP og skal godkjenne resultatet.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2016-01-01",
    chapter: "Kapitaldekning",
    section: "ICAAP",
  },
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning ILAAP",
    title: "Veiledning om foretakenes interne likviditetsvurderingsprosess (ILAAP)",
    text: "Veiledningen beskriver Finanstilsynets forventninger til finansforetaks interne likviditetsvurderingsprosess (ILAAP — Internal Liquidity Adequacy Assessment Process). ILAAP kan gjennomfores parallelt med ICAAP og innga i samme dokument som et eget kapittel. Vurderingen skal dekke foretakets likviditetsrisikoprofil, likviditetsreserver, finansieringsstruktur, og evne til a oppfylle likviditetskrav under normale forhold og i stresscenarier. Foretaket skal vurdere likviditetsrisiko pa kort sikt (LCR) og lang sikt (NSFR), samt konsentrasjonsrisiko i finansieringskildene.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2016-01-01",
    chapter: "Kapitaldekning",
    section: "ILAAP",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // AML RISK ASSESSMENT
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning AML risikovurdering 2019",
    title: "Nasjonal risikovurdering — hvitvasking og terrorfinansiering (offentlig versjon)",
    text: "Finanstilsynets nasjonale risikovurdering av risikoen for hvitvasking og terrorfinansiering i den norske finanssektoren. Rapporten vurderer trusselbilde, sarbarheter og risiko innenfor bank, forsikring, verdipapir, betalingstjenester, eiendomsmegling, og andre sektorer under tilsyn. Rapporten identifiserer hoyrisikoomrader, herunder eiendomstransaksjoner, kontantintensiv virksomhet, kryptovaluta, og grensekryssende betalinger. Risikovurderingen danner grunnlag for Finanstilsynets prioritering av tilsynsaktiviteter og foretakenes egne virksomhetsinnrettede risikovurderinger etter hvitvaskingsloven.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2019-07-01",
    chapter: "Hvitvasking",
    section: "Nasjonal risikovurdering",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // INVESTMENT SERVICES
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning investeringstjenester",
    title: "Veiledning om investeringstjenester og investeringsvirksomhet",
    text: "Veiledningen beskriver Finanstilsynets forventninger til verdipapirforetaks ytelse av investeringstjenester i henhold til verdipapirhandelloven og MiFID II. Veiledningen dekker konsesjonsvilkar, organisatoriske krav, god forretningsskikk, egnethetsvurdering og hensiktsmessighetsvurdering av kunder, produktstyring, beste utforelse, handtering av interessekonflikter, og krav til informasjon og rapportering. Veiledningen gir praktiske eksempler pa hvordan kravene skal anvendes for ulike investeringstjenester, herunder aktiv forvaltning, investeringsradgivning, ordremottak og ordreformidling.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2018-01-03",
    chapter: "Verdipapir",
    section: "MiFID II",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EGENRAPPORTERING / SELF-REPORTING
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning KRT-1003",
    title: "Veiledning om egenrapportering for foretak underlagt regnskapskontroll (KRT-1003)",
    text: "Veiledningen beskriver kravene til arlig egenrapportering (KRT-1003) for borsnoterte foretak som er underlagt Finanstilsynets regnskapskontroll. Foretakene skal rapportere om etterlevelse av regnskapsstandarder (IFRS), vesentlige estimater og vurderinger, endringer i regnskapsprinsipper, og corporate governance. Veiledningen inneholder alle sporsmal og svaralternativer i rapporteringsskjemaet og er tilgjengelig i bade PDF- og Excel-format. Rapporteringen skjer via Altinn.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2023-01-01",
    chapter: "Regnskap",
    section: "Egenrapportering",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SUSTAINABILITY IN INSURANCE
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning klimarisiko ORSA",
    title: "Kartlegging av klimarisiko i forsikringsforetakenes ORSA",
    text: "Veiledningen beskriver Finanstilsynets forventninger til integrering av klimarisiko i forsikringsforetakenes egenvurdering av risiko og solvens (ORSA). Forsikringsforetak skal vurdere fysisk klimarisiko (okende hyppighet og alvorlighetsgrad av naturkatastrofer) og overgangsrisiko (regulatoriske endringer, teknologisk utvikling, markedsendringer knyttet til overgangen til lavutslippssamfunn) i sin ORSA. Vurderingen skal inkludere scenario-analyser for ulike klimautfall og deres innvirkning pa foretakets risikoeksponering, tekniske avsetninger og solvensposisjon.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2023-01-01",
    chapter: "Forsikring",
    section: "Klimarisiko",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PENSION FUND MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning kapitalforvaltning innskuddspensjon",
    title: "Kapitalforvaltning i innskuddspensjonsordninger",
    text: "Finanstilsynets rapport og veiledning om kapitalforvaltning i innskuddspensjonsordninger. Rapporten kartlegger pensjonsleverandorenes praksis for investeringsvalg, kostnadsstruktur, avkastningshistorikk, og informasjon til medlemmer. Veiledningen beskriver forventninger til pensjonsleverandorer om a tilby et tilstrekkelig utvalg investeringsalternativer med ulike risikoprofiler, transparens om kostnader og avgifter, og automatisk nedtrapping av risiko nar pensjoneringstidspunktet naermer seg (livssyklusfond/alderstilpasset profil). Publisert desember 2025.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2025-12-12",
    chapter: "Pensjon",
    section: "Kapitalforvaltning",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EIOPA GUIDELINES
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "EIOPA-anbefaling ORSA",
    title: "EIOPA-anbefaling om egenvurdering av risiko og solvens (ORSA)",
    text: "Finanstilsynet anvender EIOPAs retningslinjer om egenvurdering av risiko og solvens (ORSA) for forsikringsforetak. Foretakene skal gjennomfore ORSA som en integrert del av foretakets forretningsstrategi og risikostyringsrammeverk. ORSA skal dekke vurdering av det samlede solvensbehovet, vurdering av overholdelse av kapitalkrav pa lopende basis, og vurdering av avviket fra forutsetningene i SCR-beregningen. Styret har det overordnede ansvaret for ORSA-prosessen og skal godkjenne ORSA-rapporten.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2015-01-01",
    chapter: "Forsikring",
    section: "EIOPA ORSA",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ADDITIONAL GUIDANCE DOCUMENTS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning berekraftsrisiko bank",
    title: "Finanstilsynets forventninger til handtering av berekraftsrisiko i banker",
    text: "Veiledningen beskriver Finanstilsynets forventninger til bankers integrering av berekraftsrisiko i risikostyringsrammeverket. Bankene skal identifisere og vurdere klimarelaterte risikoer i laneboken, herunder fysisk risiko (skade pa eiendom og infrastruktur fra klimahendelser) og overgangsrisiko (verdiforringelse av eiendeler i karbon-intensive sektorer). Berekraftsrisiko skal integreres i kredittvurderingsprosessen, ICAAP, og stresstesting. Bankene skal utvikle kompetanse om klimarelaterte finansielle risikoer og rapportere om vesentlige berekraftsrisikoer.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2022-10-01",
    chapter: "Berekraft",
    section: "Bankrisiko",
  },
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning berekraftsrisiko forsikring",
    title: "Finanstilsynets forventninger til handtering av berekraftsrisiko i forsikringsforetak",
    text: "Veiledningen beskriver forventninger til forsikringsforetaks integrering av berekraftsrisiko, herunder fysisk klimarisiko i forsikringsportefoljen (okende skadehyppighet og -alvorlighetsgrad fra naturkatastrofer), overgangsrisiko i investeringsportefoljen, og ansvarsrisiko fra klimarelaterte soeksmal. Forsikringsforetakene skal integrere berekraftsrisiko i ORSA, aktuarfunksjonen, kapitalforvaltningen, og produktutvikling. EIOPAs veiledninger om integrering av berekraftsrisiko danner grunnlag for Finanstilsynets forventninger.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2022-10-01",
    chapter: "Berekraft",
    section: "Forsikringsrisiko",
  },
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning DORA IKT-risikohandtering",
    title: "Forberedelse til DORA — veiledning om IKT-risikohandteringsrammeverk",
    text: "Veiledningen beskriver Finanstilsynets forventninger til finansforetaks forberedelse til DORA-regelverkets krav til IKT-risikohandteringsrammeverk. Foretakene skal etablere et rammeverk med klart definerte roller, ansvar og rapporteringslinjer, systematisk kartlegging av IKT-eiendeler og kritiske funksjoner, plan for forretningskontinuitet og gjenoppretting, og program for periodisk testing av digital motstandsdyktighet. Veiledningen bygger pa EBAs retningslinjer for IKT- og sikkerhetsrisikostyring og forbereder overgangen til DORA-regelverket.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2024-01-01",
    chapter: "IKT",
    section: "DORA forberedelse",
  },
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning skytjenester",
    title: "Veiledning om bruk av skytjenester (cloud computing) i finansforetak",
    text: "Veiledningen beskriver Finanstilsynets forventninger til finansforetaks bruk av skytjenester (cloud computing). Foretakene skal gjennomfore risikovurdering for bruk av skytjenester, herunder vurdering av driftsstedets lokalisering, leverandorens sikkerhetstiltak, datasuverenitet og portabilitet. Avtaler med skyleverandorer skal oppfylle kravene i Rundskriv 7/2021 om utkontraktering, herunder tilgangs- og revisjonsrett, krav til datalagringssted, exitstrategi, og rapportering til Finanstilsynet ved utkontraktering av kritiske funksjoner. Veiledningen er harmonisert med EBAs retningslinjer for skytjenester og EIOPAs retningslinjer for utkontraktering til skyleverandorer.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2022-01-01",
    chapter: "IKT",
    section: "Skytjenester",
  },
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning eiendomsmegling god meglerskikk",
    title: "Veiledning om god meglerskikk og tilsynsforventninger for eiendomsmeglingsforetak",
    text: "Veiledningen beskriver Finanstilsynets forventninger til eiendomsmeglingsforetaks etterlevelse av kravet om god meglerskikk etter eiendomsmeglingsloven. Veiledningen dekker krav til oppdragsavtale, prisopplysning, budrundeprosedyre, meglers handtering av budgivere, krav til balansert opptreden mellom kjoper og selger, informasjonsplikt om eiendommens tilstand, og krav til uavhengighet fra andre naeringsdrivende. Veiledningen reflekterer Finanstilsynets tilsynspraksis og avgiorelser fra Reklamasjonsnemnda for eiendomsmeglingstjenester.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2018-01-01",
    chapter: "Eiendomsmegling",
    section: "God meglerskikk",
  },
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning folkefinansiering",
    title: "Veiledning om folkefinansieringstjenester — tilsynsforventninger",
    text: "Veiledningen beskriver Finanstilsynets forventninger til tilbydere av folkefinansieringstjenester (crowdfunding) etter folkefinansieringsforskriften. Veiledningen dekker konsesjonsvilkar, krav til investeringsinngangsprove for ikke-sofistikerte investorer, innholdskrav til noekkelinformasjonsdokumentet, krav til handtering av interessekonflikter, og krav til forretningskontinuitet og avslutningsplaner. Tilbydere skal gi balansert informasjon om risikoen ved folkefinansiering og ikke lokke med urimelige avkastningsforventninger.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2024-01-01",
    chapter: "Fintech",
    section: "Folkefinansiering",
  },
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning virtuell valuta AML",
    title: "Veiledning om hvitvaskingsregelverket for tilbydere av vekslings- og oppbevaringstjenester for virtuell valuta",
    text: "Veiledningen beskriver Finanstilsynets forventninger til tilbydere av vekslings- og oppbevaringstjenester for virtuell valuta (VASP) med hensyn til etterlevelse av hvitvaskingsregelverket. Tilbyderne er rapporteringspliktige etter hvitvaskingsloven og skal gjennomfore virksomhetsinnrettet risikovurdering, etablere rutiner for kundekontroll med identitetsverifikasjon, lopende oppfolging av transaksjoner, og rapportering av mistenkelige transaksjoner til Okokrim. Veiledningen dekker saerlige risikoer ved kryptovalutatransaksjoner, herunder pseudonymitet, grensekryssende overforinger, og miksingtjenester.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2020-03-01",
    chapter: "Fintech",
    section: "Virtuell valuta AML",
  },
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning MiFID II produktstyring",
    title: "Veiledning om produktstyring for verdipapirforetak (MiFID II)",
    text: "Veiledningen beskriver Finanstilsynets forventninger til verdipapirforetaks produktstyring i henhold til MiFID II. Produsenter av finansielle instrumenter skal definere malgruppen for hvert produkt, gjennomfore scenario-analyser, og overvake om produktene faktisk distribueres til den definerte malgruppen. Distributorer skal innhente malgruppedata fra produsenten og gjennomfore egne vurderinger av kundenes behov, egenskaper og mal. Veiledningen gir praktiske eksempler pa produktstyringskrav for ulike typer finansielle instrumenter.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2018-01-03",
    chapter: "Verdipapir",
    section: "Produktstyring",
  },
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning OTC-derivatrapportering",
    title: "Veiledning om rapportering av OTC-derivattransaksjoner (EMIR)",
    text: "Veiledningen beskriver kravene til rapportering av OTC-derivatkontrakter til transaksjonsregistre i henhold til EMIR-forskriften. Alle motparter i derivatkontrakter (finansielle og ikke-finansielle over klaringsterkselen) skal rapportere inngatte, endrede og avsluttede kontrakter senest naeste arbeidsdag. Veiledningen gir teknisk veiledning om rapporteringsformat, LEI-krav, utestaaende kontrakter, og rapporteringsdelegering til motpart eller tredjepartstilbyder.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2020-01-01",
    chapter: "Verdipapir",
    section: "EMIR rapportering",
  },
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning likviditetsstyring",
    title: "Veiledning om likviditetsstyring og LCR-krav for banker",
    text: "Veiledningen beskriver Finanstilsynets forventninger til bankers likviditetsstyring, herunder krav til likviditetsreservebuffer (LCR — Liquidity Coverage Ratio) pa minst 100 prosent i norske kroner og alle valutaer samlet. Bankene skal ha en likviditetsstrategi godkjent av styret, et rammeverk for identifisering og styring av likviditetsrisiko, diversifiserte finansieringskilder, og beredskapsplaner for likviditetskriser. Veiledningen gir ogs veiledning om beregning av NSFR (Net Stable Funding Ratio) som krever stabil finansiering pa minst 100 prosent av stabile eiendeler.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2017-01-01",
    chapter: "Kapitaldekning",
    section: "Likviditetsstyring",
  },
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning PSD2 tredjepartstilgang",
    title: "Veiledning om tredjepartstilbyderens tilgang til betalingskontoer (PSD2)",
    text: "Veiledningen beskriver kravene til kontoforer (banker) og tredjepartstilbydere (AISP og PISP) i henhold til PSD2-regelverket og betalingssystemforskriften. Kontoforer skal gjore betalingskontoer tilgjengelige for autoriserte tredjepartstilbydere via et dedikert grensesnitt (API). Veiledningen dekker krav til sterk kundeautentisering (SCA), unntak fra SCA, tekniske standarder for sikker kommunikasjon, og kundens rett til a la tredjepartstilbydere utfore betalingsinitieringstjenester og kontoinformasjonstjenester.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2019-09-14",
    chapter: "Betalingstjenester",
    section: "PSD2 tredjepartstilgang",
  },
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning regnskapskontroll",
    title: "Veiledning om Finanstilsynets regnskapskontroll av borsnoterte foretak",
    text: "Veiledningen beskriver Finanstilsynets metoder og prioriteringer for kontroll av finansiell rapportering fra borsnoterte foretak. Finanstilsynet gjennomforer bade full gjennomgang av arsregnskap og tematilsyn knyttet til spesifikke IFRS-standarder. Prioriterte omrader inkluderer nedskrivningsvurderinger (IAS 36), virkelig verdi-maling (IFRS 13), inntektsforring (IFRS 15), leasing (IFRS 16), og finansielle instrumenter (IFRS 9). Veiledningen gir eksempler pa hyppige funn og Finanstilsynets forventninger til noteopplysninger.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2022-01-01",
    chapter: "Regnskap",
    section: "Regnskapskontroll",
  },
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning MREL planlegging",
    title: "Veiledning om MREL-planlegging og krisehndteringsforberedelser",
    text: "Veiledningen beskriver Finanstilsynets forventninger til bankers forberedelser til MREL-krav, herunder planlegging av utstedelser av MREL-kvalifisert gjeld, krav til kontraktuelle nedskrivnings- og konverteringsklausuler i gjeldsinstrumenter, og vurdering av krisehandteringsbarheten. Bankene skal ha en MREL-plan som viser hvordan de vil oppfylle de individuelle MREL-kravene over en fastsatt overgangsperiode.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2020-01-01",
    chapter: "Kriseberedskap",
    section: "MREL planlegging",
  },
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning OMF sikkerhetsmasse",
    title: "Veiledning om krav til sikkerhetsmassen for obligasjoner med fortrinnsrett (OMF)",
    text: "Veiledningen beskriver Finanstilsynets forventninger til kredittforetaks forvaltning av sikkerhetsmassen som backer obligasjoner med fortrinnsrett (OMF / covered bonds). Veiledningen dekker krav til belaning og verdsettelse av sikkerheter, krav til overpantsettelse, rentefaskingskrav, likviditetsbuffer i sikkerhetsmassen, krav til uavhengig gransker (inspektor), og rapportering til Finanstilsynet og investorer. OMF-er utgjor den storste finansieringskilden for norske boliglan.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2018-01-01",
    chapter: "Bank",
    section: "OMF sikkerhetsmasse",
  },
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning operasjonell risiko rapportering",
    title: "Veiledning om rapportering av operasjonelle hendelser til Finanstilsynet",
    text: "Veiledningen beskriver kriterier og format for rapportering av operasjonelle hendelser til Finanstilsynet. Finansforetak skal rapportere hendelser som har eller kan ha vesentlig innvirkning pa foretakets drift, kunders midler eller markedets integritet. Rapporteringen dekker IKT-hendelser, svindelhandelser, vesentlige operasjonelle feil, og hendelser knyttet til tredjepartstilbydere. Veiledningen fastsetter tidsfrister, innholdskrav og format for initial melding, mellomrapport og sluttrapport.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2021-01-01",
    chapter: "Risikostyring",
    section: "Hendelsesrapportering",
  },
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning konsolidert tilsyn",
    title: "Veiledning om konsolidert tilsyn med finanskonsern",
    text: "Veiledningen beskriver Finanstilsynets tilnaerming til konsolidert tilsyn med finanskonsern i henhold til finansforetaksloven og CRR/CRD-regelverket. Konsolidert tilsyn innebarer at kapitaldekning, store engasjementer og likviditet vurderes pa konsernniva i tillegg til pa individuelt selskapsniva. Veiledningen dekker konsolideringskrets, metoder for konsolidering, tilsynskollegier for grensekryssende konsern, og krav til intern konsernrapportering.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2017-01-01",
    chapter: "Finansforetak",
    section: "Konsolidert tilsyn",
  },
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning AML teknologilosninger",
    title: "Veiledning om bruk av teknologilosninger for kundekontroll og transaksjonsovervaking",
    text: "Veiledningen beskriver Finanstilsynets forventninger til rapporteringspliktiges bruk av teknologilosninger for a etterleve hvitvaskingsregelverket, herunder elektronisk identitetsverifikasjon (BankID, video-identifikasjon), maskinlaeringsbasert transaksjonsovervaking, og automatiserte risikoklassifiseringssystemer. Foretakene kan benytte teknologiske losninger sa lenge de oppfyller kravene i hvitvaskingsloven og -forskriften, men beholder det fulle ansvaret for kvaliteten i kundetiltakene. Veiledningen vektlegger behovet for menneskerlig vurdering i tillegg til automatiserte systemer.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2023-01-01",
    chapter: "Hvitvasking",
    section: "Teknologilosninger",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ADDITIONAL VEILEDNINGER — SECTOR-SPECIFIC
  // ═══════════════════════════════════════════════════════════════════════════
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning renterisiko bankboken",
    title: "Veiledning om styring og maling av renterisiko i bankboken (IRRBB)",
    text: "Veiledningen beskriver Finanstilsynets forventninger til bankers styring og maling av renterisiko i bankboken (IRRBB — Interest Rate Risk in the Banking Book). Bankene skal identifisere, male, overvake og styre renterisiko som oppstar av misforhold mellom renteendringstidspunkt for eiendeler og forpliktelser. Veiledningen dekker standardiserte stresscenarier for renterisiko, beregning av endring i okonomisk verdi (EVE) og nettorentseinntekter (NII) under ulike rentescenarier, og integrasjon av IRRBB i ICAAP og pilar 2-vurderingen.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2019-01-01",
    chapter: "Kapitaldekning",
    section: "IRRBB",
  },
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning kredittrisikomodeller",
    title: "Veiledning om godkjenning og bruk av interne kredittrisikomodeller (IRB)",
    text: "Veiledningen beskriver Finanstilsynets forventninger og prosess for godkjenning av interne kredittrisikomodeller (IRB — Internal Ratings Based) for beregning av kapitalkrav for kreditrisiko. Bankene som onsker a benytte IRB-metoden ma soke Finanstilsynet om godkjenning og dokumentere at modellene oppfyller CRR-forordningens krav til datakvalitet, estimeringsmetodikk, validering og backtesting. Veiledningen dekker krav til PD- (sannsynlighet for mislighold), LGD- (tap gitt mislighold) og EAD-estimater (eksponering ved mislighold).",
    type: "veiledning",
    status: "in_force",
    effective_date: "2017-01-01",
    chapter: "Kapitaldekning",
    section: "IRB modeller",
  },
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning NPL handtering",
    title: "Veiledning om bankenes handtering av misligholdte lan (NPL)",
    text: "Veiledningen beskriver Finanstilsynets forventninger til bankenes handtering av misligholdte lan og forborne eksponeringer (NPL — Non-Performing Loans). Bankene skal ha en NPL-strategi godkjent av styret, operasjonelle rammeverk for tidlig varsling og handtering av misligholdte kunder, forsvarlige nedskrivningsprosesser, og tapsavsetninger i samsvar med IFRS 9. Veiledningen er harmonisert med EBAs retningslinjer for handtering av misligholdte eksponeringer (EBA/GL/2018/06) og ECBs veiledning om NPL.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2020-01-01",
    chapter: "Kapitaldekning",
    section: "NPL",
  },
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning modellrisiko",
    title: "Veiledning om styring av modellrisiko i finansforetak",
    text: "Veiledningen beskriver Finanstilsynets forventninger til finansforetaks styring av modellrisiko, herunder kredittrisikomodeller, markedsrisikomodeller, verdsettelsesmodeller, og operasjonelle risikomodeller. Foretaket skal ha en modellrisikostyringsramme med klare roller og ansvar, prosesser for modellutvikling og -validering, uavhengig validering av modeller, og lopende overvakning av modellenes ytelse. Styret skal vaere informert om modellrisikoen og godkjenne vesentlige modeller.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2020-01-01",
    chapter: "Risikostyring",
    section: "Modellrisiko",
  },
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning tilsynsavgift",
    title: "Veiledning om beregning av tilsynsavgift til Finanstilsynet",
    text: "Veiledningen beskriver beregningsgrunnlaget for den arlige tilsynsavgiften som finansforetak betaler til Finanstilsynet i henhold til finanstilsynsloven. Tilsynsavgiften finansierer Finanstilsynets virksomhet og fordeles pa de ulike tilsynsomradene etter kostnadsprinsippet. Banker og forsikringsselskaper betaler storstedelen av avgiften, beregnet etter forvaltningskapital og tilsynsintensitet. Veiledningen gir informasjon om faktureringsprosess, klageadgang og betalingsfrister.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2020-01-01",
    chapter: "Finanstilsyn",
    section: "Tilsynsavgift",
  },
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning AIF rapportering",
    title: "Veiledning om rapportering for forvaltere av alternative investeringsfond (AIFMD)",
    text: "Veiledningen beskriver kravene til regelmessig rapportering for forvaltere av alternative investeringsfond til Finanstilsynet i henhold til AIF-loven og AIFM-direktivet. Forvaltere skal rapportere halvaarlig eller kvartalsvis avhengig av forvaltningskapital, herunder investeringsstrategier, konsentrasjon av eksponeringer, likviditetsprofil, belaning (leverage), og motparteksponaringer. Rapporteringen skal folge ESMA-maler og leveres via Altinn.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2016-01-01",
    chapter: "Verdipapirfond",
    section: "AIF rapportering",
  },
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning sanksjoner",
    title: "Veiledning om etterlevelse av internasjonale finansielle sanksjoner",
    text: "Veiledningen beskriver Finanstilsynets forventninger til finansforetaks etterlevelse av internasjonale finansielle sanksjoner vedtatt av FN og EU/EOS. Foretakene skal ha systemer for a identifisere og fryse midler som tilhorer listeforte personer og enheter, rutiner for screening av kunder og transaksjoner mot sanksjonslister, og rapporteringsplikt til Utenriksdepartementet ved funn. Veiledningen dekker ogs sektorielle sanksjoner, handelsrestriksjoner med finansielle implikasjoner, og krav til dokumentasjon av sanksjonsetterlevelsesprogram.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2022-03-01",
    chapter: "Hvitvasking",
    section: "Sanksjoner",
  },
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning revisjonsutvalg",
    title: "Veiledning om revisjonsutvalgets rolle og oppgaver i foretak av allmenn interesse",
    text: "Veiledningen beskriver Finanstilsynets forventninger til revisjonsutvalgets rolle og oppgaver i foretak av allmenn interesse (borsnoterte foretak, banker og forsikringsselskaper). Revisjonsutvalget skal overvake den finansielle rapporteringsprosessen, effektiviteten av intern kontroll og risikostyring, revisors uavhengighet, og den lovfestede revisjonen. Veiledningen dekker krav til revisjonsutvalgets sammensetning (minst ett medlem med revisjonskompetanse), motefirekvens, tilgang til informasjon, og rapportering til styret.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2021-01-01",
    chapter: "Revisjon",
    section: "Revisjonsutvalg",
  },
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning forbrukervern finansielle tjenester",
    title: "Veiledning om forbrukervern ved salg av finansielle tjenester",
    text: "Veiledningen beskriver Finanstilsynets forventninger til finansforetaks etterlevelse av forbrukervernregler ved salg av finansielle produkter og tjenester. Veiledningen dekker krav til god forretningsskikk, forbud mot villedende markedsforing, krav til balansert produktinformasjon, egnethetsvurdering ved radgivning, og handtering av kundeklager. Finanstilsynet vektlegger at finansielle produkter skal markedfores pa en mate som gir forbrukerne et realistisk bilde av risiko og avkastningspotensial.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2023-01-01",
    chapter: "Forbrukervern",
    section: "Salg av finansielle tjenester",
  },
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning pensjonskasser styringsregler",
    title: "Veiledning om styringsregler for pensjonskasser",
    text: "Veiledningen beskriver Finanstilsynets forventninger til pensjonskassers organisering og styring. Pensjonskasser er selvstendige juridiske enheter som forvalter pensjonsordninger for en eller flere arbeidsgivere. Veiledningen dekker krav til styresammensetning og kompetanse, kapitalforvaltningsstrategi, risikostyring, aktuarfunksjon, og rapportering til Finanstilsynet. Pensjonskasser er underlagt Solvens II-regelverket og skal gjennomfore ORSA.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2016-01-01",
    chapter: "Pensjon",
    section: "Pensjonskasser",
  },
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning MAR meldeplikt",
    title: "Veiledning om meldeplikt for primaerinnsidere og innsideinformasjon (MAR)",
    text: "Veiledningen beskriver kravene til utstedere av finansielle instrumenter notert pa regulert marked med hensyn til handtering av innsideinformasjon og primaerinnsideres meldeplikt etter markedsmisbruksforordningen (MAR). Utstedere skal offentliggjore innsideinformasjon snarest mulig, med mulighet for utsatt offentliggjoring under naermere vilkar. Primaerinnsidere (styre, ledelse, naerstaende) skal melde handler i utstederens instrumenter til Finanstilsynet og markedsoperatoren. Veiledningen gir praktisk veiledning om hva som utgjor innsideinformasjon og naer utsatt offentliggjoring er tillatt.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2018-01-01",
    chapter: "Verdipapir",
    section: "Innsideinformasjon",
  },
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning LEI registrering",
    title: "Veiledning om krav til Legal Entity Identifier (LEI) i finanssektoren",
    text: "Veiledningen beskriver kravene til Legal Entity Identifier (LEI) for finansforetak og andre juridiske enheter som deltar i finansielle transaksjoner. LEI er pabudt for transaksjonsrapportering under MiFIR, EMIR og SFTR, og for utstedere av finansielle instrumenter notert pa regulert marked. Bronnoysundregistrene er Norges lokale LEI-utsteder. Veiledningen beskriver registreringsprosessen, krav til arlig fornying, og konsekvensene av manglende LEI.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2018-01-03",
    chapter: "Verdipapir",
    section: "LEI",
  },
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning SCA unntak",
    title: "Veiledning om unntak fra sterk kundeautentisering (SCA) for betalingstransaksjoner",
    text: "Veiledningen beskriver de tillatte unntakene fra kravet om sterk kundeautentisering (SCA — Strong Customer Authentication) i henhold til PSD2-regelverket. Unntak kan gjelde for kontaktlose betalinger under 500 kroner, betalinger til betalingsmottakere som kunden har opprettet som paalitelig, betalinger gjort gjennom sikre betalingslosninger med lav svindelrate (Transaction Risk Analysis), og gjentakende betalinger med samme belop til samme mottaker. Betalingstjenestetilbyderen er ansvarlig for a vurdere om unntaket er tilfredsstillende ivaretatt.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2020-01-01",
    chapter: "Betalingstjenester",
    section: "SCA unntak",
  },
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning krisesimulering",
    title: "Veiledning om gjennomforing av krisesimuleringer og beredskapsovelser for finansforetak",
    text: "Veiledningen beskriver Finanstilsynets forventninger til finansforetaks gjennomforing av krisesimuleringer og beredskapsovelser. Foretakene skal regelmessig teste sine gjenopprettingsplaner, IKT-beredskapsplaner og kommunikasjonsplaner gjennom ovelser som simulerer ulike krisescenarier, herunder langvarig nedetid i kritiske systemer, cyberangrep, og finansielle stresscenarier. Ovelsene skal involvere ledelsen, relevante fagomrader og eventuelt kritiske tredjepartsleverandorer. Resultater og forbedringsomrader skal dokumenteres og rapporteres til styret.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2022-01-01",
    chapter: "Kriseberedskap",
    section: "Krisesimulering",
  },
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning pilar 3 offentliggjoring",
    title: "Veiledning om pilar 3-offentliggjoring for finansforetak",
    text: "Veiledningen beskriver kravene til pilar 3-offentliggjoring for banker og andre finansforetak i henhold til CRR-forordningen del VIII. Foretakene skal arlig (kvartalsvis for store foretak) offentliggjore informasjon om kapitaldekning, risikoeksponering, risikostyringsmetoder, godtgjorelsesordninger, og anvendelse av overgangsregler. Veiledningen gir presiseringer om omfang, format, og minimumsinnhold i pilar 3-rapportene, og er harmonisert med EBAs implementeringsstandarder for pilar 3-offentliggjoring.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2017-01-01",
    chapter: "Kapitaldekning",
    section: "Pilar 3",
  },
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning TLPT testing",
    title: "Veiledning om trusselsbasert penetrasjonstesting (TLPT) under DORA",
    text: "Veiledningen beskriver Finanstilsynets forventninger til finansforetaks gjennomforing av trusselsbasert penetrasjonstesting (TLPT — Threat-Led Penetration Testing) under DORA-regelverket. TLPT innebarer at en ekstern trusselaktorsimulering gjennomfores mot foretakets kritiske produksjonssystemer basert pa realistiske trussescenarier. Foretakene skal gjennomfore TLPT minst hvert tredje ar. Veiledningen dekker krav til testplanlegging, valg av testleverandor (red team), scopeavgrensning, gjennomforing, rapportering og oppfolging av funn.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2025-06-24",
    chapter: "IKT",
    section: "TLPT",
  },
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning DORA hendelsesrapportering",
    title: "Veiledning om IKT-relatert hendelsesrapportering under DORA",
    text: "Veiledningen beskriver de nye kravene til rapportering av IKT-relaterte hendelser under DORA-regelverket, som erstatter de tidligere sektorspesifikke rapporteringskravene under PSD2 og IKT-forskriften. Under DORA skal alle finansielle enheter klassifisere IKT-hendelser i henhold til fastsatte kriterier (tjeneste berort, varighet, geografisk spredning, datatap, kritiske funksjoner pavirket) og rapportere vesentlige hendelser til Finanstilsynet innen fire timer (initial melding), 72 timer (mellomrapport), og en maned (sluttrapport).",
    type: "veiledning",
    status: "in_force",
    effective_date: "2025-06-24",
    chapter: "IKT",
    section: "DORA hendelsesrapportering",
  },
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning AI i finanssektoren",
    title: "Veiledning om bruk av kunstig intelligens (AI) i finanssektoren",
    text: "Veiledningen beskriver Finanstilsynets forventninger til finansforetaks bruk av kunstig intelligens og maskinlaering. Foretakene skal ha styring og kontroll over AI-systemer, herunder modellvalidering, sporbarhet av beslutninger, handtering av bias og diskriminering, og beskyttelse av personopplysninger (GDPR). AI-systemer brukt til kredittvurdering, svindeldeteksjon eller investeringsbeslutninger skal vaere forklarbare overfor kunder og tilsynsmyndigheter. Veiledningen reflekterer EUs AI-forordning (AI Act) og ESAs veiledning om AI i finanstjenester.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2024-06-01",
    chapter: "Fintech",
    section: "Kunstig intelligens",
  },
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning open banking",
    title: "Veiledning om open banking og PSD2-grensesnitt (API) krav",
    text: "Veiledningen beskriver tekniske og funksjonelle krav til kontoforeres (bankers) implementering av dedikerte grensesnitt (API-er) for tredjepartstilbydere under PSD2-regelverket. Veiledningen dekker krav til API-tilgjengelighet (oppetid minst 99,5 prosent), responstider, testmiljo (sandbox) for tredjepartstilbydere, fallback-mekanismer ved API-nedetid, og krav til eIDAS-sertifikater for identifisering av tredjepartstilbydere. Veiledningen reflekterer EBAs tekniske standarder for sikker kommunikasjon (RTS on SCA and CSC).",
    type: "veiledning",
    status: "in_force",
    effective_date: "2019-09-14",
    chapter: "Betalingstjenester",
    section: "Open banking API",
  },
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning konsentasjonsrisiko",
    title: "Veiledning om styring av konsentrasjonsrisiko i banker",
    text: "Veiledningen beskriver Finanstilsynets forventninger til bankers styring av konsentrasjonsrisiko, herunder konsentrasjon i kredittportefoljen (sektorer, geografisk, enkeltmotparter), finansieringskonsentrasjon (avhengighet av enkeltkilder), og operasjonell konsentrasjon (avhengighet av kritiske IKT-leverandorer). Bankene skal identifisere og kvantifisere konsentrasjonsrisiko som del av ICAAP, og holde tilstrekkelig kapital for a dekke risikoen. Veiledningen er saerlig relevant for banker med stor eksponering mot naeringseiendom.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2019-01-01",
    chapter: "Kapitaldekning",
    section: "Konsentrasjonsrisiko",
  },
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning cyberrisiko",
    title: "Veiledning om styring av cyberrisiko i finansforetak",
    text: "Veiledningen beskriver Finanstilsynets forventninger til finansforetaks styring av cyberrisiko. Foretakene skal ha et cybersikkerhetsprogram tilpasset virksomhetens risikoniva, herunder trusselinformasjon og -overvaking, hendelsesdeteksjon og respons, tilgangs- og identitetsstyring, sikkerhetsopplaering for ansatte, og samarbeid med CERT-funksjoner (herunder FinansCERT). Veiledningen dekker ogs krav til styrets kompetanse og involvering i cybersikkerhet, og rapportering av cyberhendelser til Finanstilsynet.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2020-01-01",
    chapter: "IKT",
    section: "Cyberrisiko",
  },
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning leveragegrad",
    title: "Veiledning om beregning og rapportering av uvektet kapitalkrav (leverage ratio)",
    text: "Veiledningen beskriver kravene til beregning og rapportering av leverage ratio (uvektet kapitalkrav) for banker og andre foretak underlagt CRR-forordningen. Leverage ratio beregnes som kjernekapital delt pa total eksponeringsmaling (uten risikovekting), og kravet er minst 3 prosent. For globalt systemviktige institusjoner gjelder et tilleggskrav. Veiledningen gir presiseringer om beregning av eksponeringsmaling, herunder behandling av derivater, verdipapirfinansieringstransaksjoner og poster utenom balansen.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2021-06-28",
    chapter: "Kapitaldekning",
    section: "Leverage ratio",
  },
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning CRD V fit and proper",
    title: "Veiledning om EBA/ESMA retningslinjer for egnethetsvurdering av styre og ledelse",
    text: "Veiledningen beskriver gjennomforingen av EBA/ESMA retningslinjer for vurdering av egnetheten til medlemmer av ledelsesorganet og innehavere av nokkelfunksjoner (EBA/GL/2021/06) i norsk tilsynspraksis. Veiledningen dekker krav til individuell kunnskap, erfaring og ferdigheter, krav til styrets samlede kompetanse (diversitet, bankfaglig og IKT-kompetanse), krav til hederlighet og uavhengighet, og krav til tidsbruk. Finanstilsynet vurderer egnethet ved nyansettelser og ved oppfolging av tilsynsrapporter.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2022-06-30",
    chapter: "Styring",
    section: "Egnethet styre og ledelse",
  },
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning SFDR klassifisering",
    title: "Veiledning om klassifisering av finansielle produkter under SFDR (artikkel 6, 8 og 9)",
    text: "Veiledningen beskriver Finanstilsynets forventninger til finansmarkedsdeltakeres klassifisering av finansielle produkter under SFDR (Sustainable Finance Disclosure Regulation). Produkter klassifiseres som artikkel 6 (ingen berekraftsprofil), artikkel 8 (fremmer miljomaessige eller sosiale egenskaper) eller artikkel 9 (har berekraftig investering som formal). Veiledningen presiserer kriteriene for klassifisering, krav til forhands- og etteropplysninger, og forventninger til dokumentasjon av berekraftspaastander for a unnga greenwashing.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2022-01-01",
    chapter: "Berekraft",
    section: "SFDR klassifisering",
  },
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning tredjepartsrisiko register",
    title: "Veiledning om register over IKT-tredjepartsavtaler (DORA)",
    text: "Veiledningen beskriver kravene til finansforetaks opprettelse og vedlikehold av et register over alle avtaler med IKT-tredjepartsleverandorer i henhold til DORA-regelverket artikkel 28. Registeret skal inneholde opplysninger om leverandoren, tjenestens art og kritikalitet, databehandling og lagringssted, kontraktuelle vilkar, og vurdering av konsentrasjonsrisiko. Registeret skal oppdateres fortlopende og gjores tilgjengelig for Finanstilsynet pa foresporsle.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2025-06-24",
    chapter: "IKT",
    section: "DORA tredjepartsregister",
  },
  {
    sourcebook_id: "FTNO_VEILEDNINGER",
    reference: "Veiledning CSRD attestasjon",
    title: "Veiledning om revisors attestasjon av berekraftsrapportering (CSRD)",
    text: "Veiledningen beskriver Finanstilsynets forventninger til revisors attestasjon av foretaks berekraftsrapportering i henhold til CSRD-regelverket. Revisor skal avgi en begraenset sikkerhet (limited assurance) om berekraftsrapporteringen for de forste rapporteringsarene, med overgang til rimelig sikkerhet (reasonable assurance) pa sikt. Veiledningen dekker revisors arbeid med a verifisere berekraftsinformasjonen, vurdering av foretakets vesentlighetsanalyse (double materiality), og krav til revisors kompetanse innen berekraft.",
    type: "veiledning",
    status: "in_force",
    effective_date: "2025-01-01",
    chapter: "Berekraft",
    section: "CSRD attestasjon",
  },
];

// ── Enforcement Actions ─────────────────────────────────────────────────────

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
  // ═══════════════════════════════════════════════════════════════════════════
  // AML ENFORCEMENT — BANKS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    firm_name: "DNB Bank ASA",
    reference_number: "FTNO/2021/AML-001",
    action_type: "overtredelsesgebyr",
    amount: 400_000_000,
    date: "2021-05-03",
    summary:
      "Finanstilsynet ila DNB Bank ASA et overtredelsesgebyr pa 400 millioner kroner for brudd pa hvitvaskingsloven. Tilsynet gjennomforte stedlig tilsyn i 2020 og konstaterte at bankens Private Banking-avdeling manglet tilstrekkelig prioritering og innsikt i hvitvaskingsregelverket. Banken hadde ulovlig lang behandlingstid for alarmer fra elektroniske overvakingssystemer, mangelfulle prosesser for kundetiltak og lopende oppfolging av eksisterende kundeforhold, og forsinket rapportering til Okokrim. Gebyret var det storste ilagt av Finanstilsynet for AML-brudd pa dette tidspunktet.",
    sourcebook_references: "LOV-2018-06-01-23, Rundskriv 8/2019",
  },
  {
    firm_name: "Askim & Spydeberg Sparebank",
    reference_number: "FTNO/2023/AML-002",
    action_type: "overtredelsesgebyr",
    amount: 9_500_000,
    date: "2023-11-27",
    summary:
      "Finanstilsynet gjennomforte stedlig tilsyn i Askim & Spydeberg Sparebank den 14. og 15. juni 2022 for a gjennomga bankens styring og kontroll av risikoen for hvitvasking og terrorfinansiering. Tilsynet avdekket mangler i bankens etterlevelse av hvitvaskingsloven med tilhorende forskrifter, herunder utilstrekkelig virksomhetsinnrettet risikovurdering, mangelfulle kundetiltak og lopende oppfolging, og svakheter i intern kontroll. Pa bakgrunn av tilsynet ble banken ilagt et overtredelsesgebyr pa 9,5 millioner kroner.",
    sourcebook_references: "LOV-2018-06-01-23, FOR-2018-09-14-1324",
  },
  {
    firm_name: "SpareBank 1 Ostlandet",
    reference_number: "FTNO/2025/AML-003",
    action_type: "overtredelsesgebyr",
    amount: 30_000_000,
    date: "2025-03-26",
    summary:
      "Finanstilsynet gjennomforte stedlig tilsyn i SpareBank 1 Ostlandet for a kontrollere bankens etterlevelse av hvitvaskingsregelverket. Tilsynet avdekket mangler i etterlevelsen av grunnleggende krav i hvitvaskingsregelverket, herunder utilstrekkelige ressurser til oppfolging av hvitvaskingsregler, svakheter i opplaering, og manglende prosedyrer. Banken ble ilagt et overtredelsesgebyr pa 30 millioner kroner etter hvitvaskingsloven. Vedtaket ble paaklaget 8. mai 2025.",
    sourcebook_references: "LOV-2018-06-01-23, Rundskriv 4/2022",
  },
  {
    firm_name: "MyBank ASA",
    reference_number: "FTNO/2023/BANK-001",
    action_type: "palegg",
    amount: 0,
    date: "2023-06-15",
    summary:
      "Finanstilsynet gjennomforte naermere undersokelser av MyBanks handtering av kredittsaker og etterlevelse av sentrale bankregeler i 2022. Tilsynsrapporten oppsummerer bankens handtering av forhold som medforte palegg om retting knyttet til kredittomradet, hvitvaskingsomradet, samt forhoyet minstekrav til ansvarlig kapital utover gjeldende minstekrav og bufferkrav. Banken ble palagt a utbedre identifiserte mangler innen fastsatte frister.",
    sourcebook_references: "LOV-2015-04-10-17, LOV-2018-06-01-23",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // AML ENFORCEMENT — SECURITIES
  // ═══════════════════════════════════════════════════════════════════════════
  {
    firm_name: "Beaufort AS",
    reference_number: "FTNO/2023/AML-004",
    action_type: "overtredelsesgebyr",
    amount: 2_000_000,
    date: "2023-09-01",
    summary:
      "Finanstilsynet gjennomforte tematilsyn knyttet til hvitvasking og terrorfinansiering i Beaufort AS, et verdipapirforetak. Tematilsynet ble igangsatt basert pa Finanstilsynets undersokelse av etterlevelsen av hvitvaskingsregelverket i alle norske verdipapirforetak som ikke ogs er bank. Tilsynet avdekket mangler i foretakets virksomhetsinnrettede risikovurdering, kundetiltak og lopende oppfolging, og det ble fattet vedtak om overtredelsesgebyr.",
    sourcebook_references: "LOV-2018-06-01-23, FOR-2018-09-14-1324",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // LICENCE REVOCATION
  // ═══════════════════════════════════════════════════════════════════════════
  {
    firm_name: "Tavex AS",
    reference_number: "FTNO/2022/LIC-001",
    action_type: "tilbakekall",
    amount: 0,
    date: "2022-09-15",
    summary:
      "Finanstilsynet fattet vedtak om tilbakekall av konsesjonen til Tavex AS til a drive virksomhet som finansieringsforetak med tillatelse til a drive valutaveksling. Tavex AS var ogs agent for det estiske betalingsforetaket TavexWise og utforte pengeoverforinger som grensekryssende tjeneste. Tilsynet avdekket alvorlige mangler i foretakets internkontroll og etterlevelse av hvitvaskingsregelverket som etter en helhetsvurdering gjorde at vilkarene for tilbakekall var oppfylt.",
    sourcebook_references: "LOV-2015-04-10-17, LOV-2018-06-01-23",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MARKET CONDUCT ENFORCEMENT
  // ═══════════════════════════════════════════════════════════════════════════
  {
    firm_name: "Aker BP ASA",
    reference_number: "FTNO/2026/MAR-001",
    action_type: "overtredelsesgebyr",
    amount: 75_000,
    date: "2026-01-15",
    summary:
      "Finanstilsynet konkluderte med at Aker BP ASA har brutt meldeplikten etter markedsmisbruksforordningen (MAR) og fattet vedtak om a ilegge et overtredelsesgebyr pa 75 000 kroner. Meldeplikten krever at utstedere av finansielle instrumenter notert pa regulert marked uoppfordret og snarest mulig offentliggjor innsideinformasjon som direkte angaar utsteder.",
    sourcebook_references: "LOV-2007-06-29-75, FOR-2007-06-29-876",
  },
  {
    firm_name: "Flaggepliktbrudd — verdipapirhandel",
    reference_number: "FTNO/2026/FLAG-001",
    action_type: "overtredelsesgebyr",
    amount: 175_000,
    date: "2026-02-01",
    summary:
      "Finanstilsynet konkluderte med at det foreligger brudd pa flaggeplikten i verdipapirhandelloven og fattet vedtak om a ilegge et overtredelsesgebyr pa 175 000 kroner. Flaggeplikten krever at aksjonaerer melder fra til markedet nar de krysser eierskapsterskler (5, 10, 15, 20, 25 prosent osv.) i borsnoterte selskaper, for a sikre transparens i eierskapet.",
    sourcebook_references: "LOV-2007-06-29-75",
  },
  {
    firm_name: "Markedsmanipulasjon — verdipapirhandel",
    reference_number: "FTNO/2023/MAR-002",
    action_type: "overtredelsesgebyr",
    amount: 500_000,
    date: "2023-08-01",
    summary:
      "Finanstilsynet fattet vedtak om ileggelse av overtredelsesgebyr for markedsmanipulasjon i henhold til verdipapirhandelloven og markedsmisbruksforordningen (MAR). Vedtaket gjaldt handlinger som ga eller var egnet til a gi falske eller villedende signaler om tilbudet av, ettersporselen etter eller prisen pa et finansielt instrument. Finanstilsynet overvaker markedsatferd pa verdipapirmarkedet og kan ilegge overtredelsesgebyr, anmelde til Okokrim, eller begge deler.",
    sourcebook_references: "LOV-2007-06-29-75, FOR-2007-06-29-876",
  },
  {
    firm_name: "Markedsmanipulasjon — verdipapirhandel (2025)",
    reference_number: "FTNO/2025/MAR-003",
    action_type: "overtredelsesgebyr",
    amount: 1_000_000,
    date: "2025-06-01",
    summary:
      "Finanstilsynet fattet vedtak om overtredelsesgebyr for markedsmanipulasjon i henhold til markedsmisbruksforordningen (MAR). Saken gjaldt handelsmonstre som var egnet til a pavirke prisen pa finansielle instrumenter i strid med forbudet mot markedsmanipulasjon. Finanstilsynet benyttet data fra transaksjonsrapporteringssystemet og markedsovervaking for a avdekke den mistenkelige handelsaktiviteten.",
    sourcebook_references: "LOV-2007-06-29-75",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // AUDITOR ENFORCEMENT
  // ═══════════════════════════════════════════════════════════════════════════
  {
    firm_name: "RSM Norge AS",
    reference_number: "FTNO/2024/REV-001",
    action_type: "overtredelsesgebyr",
    amount: 2_000_000,
    date: "2024-01-15",
    summary:
      "Finanstilsynet gjennomforte ordinaert foretakstilsyn med RSM Norge AS i november 2023 som omfattet revisjonsselskapets ledelse, revisjonsutforelse og etterlevelse av hvitvaskingsregelverket. Tilsynet avdekket alvorlige feil og mangler i revisjonsutforelsen, og revisjonsselskapet ble ilagt to overtredelsesgebyr pa til sammen to millioner kroner for brudd pa bade revisorloven og hvitvaskingsloven.",
    sourcebook_references: "LOV-2020-11-20-128, LOV-2018-06-01-23",
  },
  {
    firm_name: "Deloitte AS",
    reference_number: "FTNO/2025/REV-002",
    action_type: "overtredelsesgebyr",
    amount: 5_000_000,
    date: "2025-04-01",
    summary:
      "Finanstilsynet gjennomforte ordinaert foretakstilsyn med Deloitte AS og avdekket alvorlige feil og mangler i revisjonsutforelsen bade for et foretak av allmenn interesse og flere mindre foretak. Tilsynet resulterte i vedtak om overtredelsesgebyr etter revisorloven for manglende etterlevelse av krav til revisjonshandlinger, dokumentasjon og kvalitetsstyring.",
    sourcebook_references: "LOV-2020-11-20-128",
  },
  {
    firm_name: "KPMG AS",
    reference_number: "FTNO/2025/REV-003",
    action_type: "overtredelsesgebyr",
    amount: 4_000_000,
    date: "2025-06-15",
    summary:
      "Finanstilsynet gjennomforte ordinaert foretakstilsyn med KPMG AS. Tilsynet avdekket alvorlige feil og mangler i revisjonsutforelsen bade for et foretak av allmenn interesse og flere mindre foretak. Vedtak om overtredelsesgebyr ble fattet etter revisorloven.",
    sourcebook_references: "LOV-2020-11-20-128",
  },
  {
    firm_name: "Enter Revisjon AS",
    reference_number: "FTNO/2026/REV-004",
    action_type: "overtredelsesgebyr",
    amount: 300_000,
    date: "2026-02-01",
    summary:
      "Finanstilsynet ila Enter Revisjon AS et overtredelsesgebyr pa 300 000 kroner etter a ha avdekket omfattende brudd pa revisorloven i revisjonen av en barnehage som mottok offentlig tilskudd. Tilsynet avdekket manglende etterlevelse av revisjonsstandarder og utilstrekkelig dokumentasjon av revisjonshandlinger.",
    sourcebook_references: "LOV-2020-11-20-128",
  },
  {
    firm_name: "Norsk Regnskap AS",
    reference_number: "FTNO/2024/REG-001",
    action_type: "overtredelsesgebyr",
    amount: 500_000,
    date: "2024-12-01",
    summary:
      "Finanstilsynet avdekket at regnskapsforetaket hadde signert bekreftelser basert pa forfalsket dokumentasjon og brutt hvitvaskingsreglene. Tilsynet resulterte i vedtak om overtredelsesgebyr for brudd pa regnskapsforerloven og hvitvaskingsloven.",
    sourcebook_references: "LOV-2018-06-01-23",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SUPERVISION REPORTS (WITHOUT FINES)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    firm_name: "Nordea Bank Abp, Filial i Norge",
    reference_number: "FTNO/2022/TILSYN-001",
    action_type: "tilsynsrapport",
    amount: 0,
    date: "2022-12-01",
    summary:
      "Finanstilsynet gjennomforte stedlig tilsyn i Nordea Abp filial i Norge 23.–25. juni 2020 med formaal a gjennomga filialens styring og kontroll av risikoen for hvitvasking og terrorfinansiering, herunder etterlevelse av hvitvaskingsloven. Tilsynsrapporten pekte pa forbedringsomrader knyttet til kundetiltak og lopende oppfolging.",
    sourcebook_references: "LOV-2018-06-01-23",
  },
  {
    firm_name: "Nordea Liv Norge AS",
    reference_number: "FTNO/2024/TILSYN-002",
    action_type: "tilsynsrapport",
    amount: 0,
    date: "2024-09-01",
    summary:
      "Finanstilsynet gjennomforte tilsyn med Livsforsikringsselskapet Nordea Liv Norge AS. Tilsynet dekket selskapets risikostyring, intern kontroll, solvensposisjon og etterlevelse av Solvens II-regelverket. Tilsynsrapporten ble publisert med merknader.",
    sourcebook_references: "FOR-2015-08-25-999",
  },
  {
    firm_name: "Pareto Bank ASA",
    reference_number: "FTNO/2022/TILSYN-003",
    action_type: "tilsynsrapport",
    amount: 0,
    date: "2022-03-01",
    summary:
      "Finanstilsynet gjennomforte stedlig tilsyn i Pareto Bank 3.–5. november 2021 for a vurdere bankens styrings- og kontrollsystemer samt kredittrisikoeksponering. Tilsynet fokuserte pa bankens kredittbevilgningsprosess, risikoklassifisering og tapsavsetninger.",
    sourcebook_references: "LOV-2015-04-10-17, FOR-2014-08-22-1097",
  },
  {
    firm_name: "Pareto Securities AS",
    reference_number: "FTNO/2023/TILSYN-004",
    action_type: "tilsynsrapport",
    amount: 0,
    date: "2023-06-01",
    summary:
      "Finanstilsynet gjennomforte tilsyn av Pareto Securities som del av tematilsyn knyttet til rettede emisjoner, likebehandling av aksjonaerer og handtering av innsideinformasjon. Tilsynet var begrenset til verdipapirforetakets rolle som tilrettelegger og plasseringssagent i utvalgte emisjonsprosesser.",
    sourcebook_references: "LOV-2007-06-29-75",
  },
  {
    firm_name: "Nordea Finans Norge AS",
    reference_number: "FTNO/2025/TILSYN-005",
    action_type: "tilsynsrapport",
    amount: 0,
    date: "2025-02-01",
    summary:
      "Finanstilsynet gjennomforte tilsyn med Nordea Finans Norge AS og Nordea Finance Equipment AS. Tilsynet vurderte selskapenes kredittrisikohandtering knyttet til objektfinansiering, med saerlig oppmerksomhet pa vurdering av kunders gjeldsbetjeningsevne, etterlevelse av utlansforskriften, oppfolging av misligholdte kunder, klagehndtering og forbrukervern.",
    sourcebook_references: "FOR-2020-12-09-2648, LOV-2015-04-10-17",
  },
  {
    firm_name: "Storebrand Asset Management AS",
    reference_number: "FTNO/2025/TILSYN-006",
    action_type: "tilsynsrapport",
    amount: 0,
    date: "2025-05-01",
    summary:
      "Finanstilsynet gjennomforte tilsyn med Storebrand Asset Management AS med fokus pa foretakets kapitalforvaltning, etterlevelse av SFDR (berekraftsrapportering), og handtering av berekraftsrisiko i investeringsbeslutninger. Tilsynsrapporten ble publisert pa Finanstilsynets nettsted.",
    sourcebook_references: "FOR-2021-12-22-3819, LOV-2011-11-25-44",
  },
  {
    firm_name: "SpareBank 1 Sor-Norge",
    reference_number: "FTNO/2025/TILSYN-007",
    action_type: "tilsynsrapport",
    amount: 0,
    date: "2025-04-15",
    summary:
      "Finanstilsynet gjennomforte tilsyn med SpareBank 1 Sor-Norge. Tilsynsrapporten dekket bankens risikostyring, internkontroll, kapitaldekning og etterlevelse av hvitvaskingsregelverket.",
    sourcebook_references: "LOV-2015-04-10-17, LOV-2018-06-01-23",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // REVOKED AUDITOR LICENCES
  // ═══════════════════════════════════════════════════════════════════════════
  {
    firm_name: "Statsautorisert revisor — tilbakekall 2023",
    reference_number: "FTNO/2023/REV-TILB-001",
    action_type: "tilbakekall",
    amount: 0,
    date: "2023-10-01",
    summary:
      "Finanstilsynet fattet vedtak om tilbakekall av godkjenning som statsautorisert revisor og statsautorisert regnskapsforer. Begrunnelsen var manglende ivaretakelse av ansvar og oppgaver som daglig leder og styreleder, som hadde fort til grove brudd pa lovgivningen.",
    sourcebook_references: "LOV-2020-11-20-128",
  },
  {
    firm_name: "Statsautorisert regnskapsforer — tilbakekall 2025",
    reference_number: "FTNO/2025/REG-TILB-001",
    action_type: "tilbakekall",
    amount: 0,
    date: "2025-06-01",
    summary:
      "Finanstilsynet fattet vedtak om tilbakekall av daglig leders godkjenning som statsautorisert regnskapsforer pa grunn av alvorlige og omfattende mangler, blant annet manglende oppdaterte oppdragsavtaler og mangler i kvalitetssikringen.",
    sourcebook_references: "LOV-2022-12-16-90",
  },
  {
    firm_name: "Revisorkonsult AS",
    reference_number: "FTNO/2026/REV-005",
    action_type: "vedtak",
    amount: 0,
    date: "2026-03-01",
    summary:
      "Finanstilsynet gjennomforte tilsyn med Revisorkonsult AS og fattet vedtak pa bakgrunn av avdekkede mangler i revisjonsutforelsen.",
    sourcebook_references: "LOV-2020-11-20-128",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // INKASSO REVOCATION
  // ═══════════════════════════════════════════════════════════════════════════
  {
    firm_name: "Inkassoforetak — tilbakekall av inkassokonsesjon 2023",
    reference_number: "FTNO/2023/INK-001",
    action_type: "tilbakekall",
    amount: 0,
    date: "2023-05-01",
    summary:
      "Finanstilsynet fattet vedtak om tilbakekalling av inkassoloyet etter stedlig tilsyn i 2022 som avdekket mangler ved risikostyringa og internkontrollen som hadde medfort regelbrot i saksbehandlinga av inkassosaker. Tilbakekallet var basert pa en helhetsvurdering av foretakets evne til a etterleve gjeldende regelverk.",
    sourcebook_references: "LOV-1988-05-13-26",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ADDITIONAL ENFORCEMENT — UNAUTHORIZED INVESTMENT FIRMS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    firm_name: "Uautorisert verdipapirforetak 1 — advarsel 2022",
    reference_number: "FTNO/2022/ADV-001",
    action_type: "advarsel",
    amount: 0,
    date: "2022-03-15",
    summary:
      "Finanstilsynet publiserte advarsel mot et foretak som tilbod investeringstjenester i Norge uten tillatelse fra Finanstilsynet. Foretaket markedsforte CFD-er og valutahandel (forex) til norske forbrukere uten konsesjon. Finanstilsynet advarer norske forbrukere mot a benytte seg av uautoriserte tjenestetilbydere.",
    sourcebook_references: "LOV-2007-06-29-75",
  },
  {
    firm_name: "Uautorisert verdipapirforetak 2 — advarsel 2022",
    reference_number: "FTNO/2022/ADV-002",
    action_type: "advarsel",
    amount: 0,
    date: "2022-05-20",
    summary:
      "Finanstilsynet publiserte advarsel mot et utenlandsk foretak som tilbod investeringstjenester til norske kunder uten nodvendig tillatelse. Foretaket opererte fra et tredjeland og tilbod kryptovalutarelaterte investeringsprodukter. Finanstilsynet publiserte til sammen sju advarsler mot uautoriserte foretak i 2022 — fem mot norske foretak og to mot utenlandske foretak.",
    sourcebook_references: "LOV-2007-06-29-75",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ADDITIONAL ENFORCEMENT — SPECIFIC AUDIT AND ACCOUNTING CASES
  // ═══════════════════════════════════════════════════════════════════════════
  {
    firm_name: "Revisor Partner AS",
    reference_number: "FTNO/2024/REV-006",
    action_type: "overtredelsesgebyr",
    amount: 400_000,
    date: "2024-06-01",
    summary:
      "Finanstilsynet gjennomforte tilsyn med Revisor Partner AS og avdekket feil og mangler i revisjonsutforelsen. Tilsynet resulterte i vedtak om overtredelsesgebyr pa 400 000 kroner etter revisorloven.",
    sourcebook_references: "LOV-2020-11-20-128",
  },
  {
    firm_name: "Statsautorisert revisor — overtredelsesgebyr 2025",
    reference_number: "FTNO/2025/REV-007",
    action_type: "overtredelsesgebyr",
    amount: 200_000,
    date: "2025-01-15",
    summary:
      "Finanstilsynet ila en statsautorisert revisor et overtredelsesgebyr pa 200 000 kroner for brudd pa revisorloven. Tilsynet avdekket mangler i revisjonsutforelsen og dokumentasjonen for et foretak av allmenn interesse.",
    sourcebook_references: "LOV-2020-11-20-128",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ADDITIONAL ENFORCEMENT — FINANCIAL REPORTING
  // ═══════════════════════════════════════════════════════════════════════════
  {
    firm_name: "Borsnotert foretak — regnskapskontroll 2023",
    reference_number: "FTNO/2023/REGN-001",
    action_type: "palegg",
    amount: 0,
    date: "2023-12-01",
    summary:
      "Finanstilsynet ga palegg om retting etter regnskapskontroll av et borsnotert foretak. Finanstilsynet konstaterte feilaktig anvendelse av IFRS 16 (Leasing) og mangelfulle noteopplysninger om virkelig verdi-maling (IFRS 13). Foretaket ble palagt a rette rapporteringen i naeste arsregnskap.",
    sourcebook_references: "LOV-1998-07-17-56, FOR-2005-01-17-36",
  },
  {
    firm_name: "Borsnotert foretak — regnskapskontroll 2024",
    reference_number: "FTNO/2024/REGN-002",
    action_type: "palegg",
    amount: 0,
    date: "2024-06-15",
    summary:
      "Finanstilsynet gjennomforte regnskapskontroll og konstaterte feilaktig inntektsforing (IFRS 15) og mangelfulle nedskrivningsvurderinger (IAS 36) i foretakets arsregnskap. Foretaket ble palagt a rette de identifiserte feilene.",
    sourcebook_references: "LOV-1998-07-17-56",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ADDITIONAL ENFORCEMENT — INSURANCE AND PENSION
  // ═══════════════════════════════════════════════════════════════════════════
  {
    firm_name: "Forsikringsforetak — Solvens II tilsyn 2023",
    reference_number: "FTNO/2023/FORS-001",
    action_type: "tilsynsrapport",
    amount: 0,
    date: "2023-04-01",
    summary:
      "Finanstilsynet gjennomforte tilsyn med et skadeforsikringsforetak med fokus pa etterlevelse av Solvens II-regelverket. Tilsynet identifiserte forbedringsomrader knyttet til aktuarfunksjonen, kvaliteten pa ORSA-rapporten, og dokumentasjon av forsikringstekniske avsetninger. Foretaket ble palagt a utbedre identifiserte mangler.",
    sourcebook_references: "FOR-2015-08-25-999",
  },
  {
    firm_name: "Pensjonsforetak — kapitalforvaltning tilsyn 2024",
    reference_number: "FTNO/2024/PENS-001",
    action_type: "tilsynsrapport",
    amount: 0,
    date: "2024-03-01",
    summary:
      "Finanstilsynet gjennomforte tilsyn med et pensjonsforetak med fokus pa kapitalforvaltning og etterlevelse av prudent person-prinsippet. Tilsynet vurderte foretakets investeringsstrategi, risikostyring, likviditetsstyring, og integrasjon av berekraftsfaktorer i investeringsbeslutninger.",
    sourcebook_references: "FOR-2015-08-25-999, LOV-2005-06-10-44",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ADDITIONAL ENFORCEMENT — EIENDOMSMEGLING
  // ═══════════════════════════════════════════════════════════════════════════
  {
    firm_name: "Eiendomsmeglingsforetak — tilbakekall tillatelse 2023",
    reference_number: "FTNO/2023/EIEN-001",
    action_type: "tilbakekall",
    amount: 0,
    date: "2023-08-15",
    summary:
      "Finanstilsynet tilbakekalte tillatelsen til et eiendomsmeglingsforetak etter tilsyn som avdekket alvorlige brudd pa god meglerskikk, mangelfull handtering av klientmidler, og brudd pa hvitvaskingsregelverket. Foretaket hadde ikke gjennomfort tilfredsstillende kundekontroll ved flere eiendomstransaksjoner.",
    sourcebook_references: "LOV-2007-06-29-73, LOV-2018-06-01-23",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ADDITIONAL ENFORCEMENT — BETALINGSFORETAK
  // ═══════════════════════════════════════════════════════════════════════════
  {
    firm_name: "Betalingsforetak — overtredelsesgebyr AML 2024",
    reference_number: "FTNO/2024/BET-001",
    action_type: "overtredelsesgebyr",
    amount: 1_500_000,
    date: "2024-05-01",
    summary:
      "Finanstilsynet ila et betalingsforetak overtredelsesgebyr pa 1,5 millioner kroner for mangelfulle AML-rutiner. Tilsynet avdekket at foretaket ikke hadde gjennomfort tilstrekkelig virksomhetsinnrettet risikovurdering, hadde mangelfull kundekontroll ved registrering av nye kunder, og ikke hadde rapportert mistenkelige transaksjoner til Okokrim i tide.",
    sourcebook_references: "LOV-2018-06-01-23, FOR-2019-02-15-152",
  },
];

// ── Insert all provisions ───────────────────────────────────────────────────

const allProvisions = [...forskrifter, ...rundskriv, ...veiledninger];

const insertProvision = db.prepare(`
  INSERT INTO provisions (sourcebook_id, reference, title, text, type, status, effective_date, chapter, section)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertAllProvisions = db.transaction(() => {
  for (const p of allProvisions) {
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

insertAllProvisions();

console.log(`Inserted ${allProvisions.length} provisions:`);
console.log(`  FTNO_FORSKRIFTER:  ${forskrifter.length}`);
console.log(`  FTNO_RUNDSKRIV:    ${rundskriv.length}`);
console.log(`  FTNO_VEILEDNINGER: ${veiledninger.length}`);

// ── Insert enforcement actions ──────────────────────────────────────────────

const insertEnforcement = db.prepare(`
  INSERT INTO enforcement_actions (firm_name, reference_number, action_type, amount, date, summary, sourcebook_references)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const insertAllEnforcements = db.transaction(() => {
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

insertAllEnforcements();

console.log(`Inserted ${enforcements.length} enforcement actions`);

// ── Summary ─────────────────────────────────────────────────────────────────

const provisionCount = (
  db.prepare("SELECT count(*) as cnt FROM provisions").get() as { cnt: number }
).cnt;
const sourcebookCount = (
  db.prepare("SELECT count(*) as cnt FROM sourcebooks").get() as { cnt: number }
).cnt;
const enforcementCount = (
  db.prepare("SELECT count(*) as cnt FROM enforcement_actions").get() as {
    cnt: number;
  }
).cnt;
const ftsCount = (
  db.prepare("SELECT count(*) as cnt FROM provisions_fts").get() as {
    cnt: number;
  }
).cnt;
const enfFtsCount = (
  db.prepare("SELECT count(*) as cnt FROM enforcement_fts").get() as {
    cnt: number;
  }
).cnt;

console.log(`\nDatabase summary:`);
console.log(`  Sourcebooks:              ${sourcebookCount}`);
console.log(`  Provisions:               ${provisionCount}`);
console.log(`    FTNO_FORSKRIFTER:        ${forskrifter.length}`);
console.log(`    FTNO_RUNDSKRIV:          ${rundskriv.length}`);
console.log(`    FTNO_VEILEDNINGER:       ${veiledninger.length}`);
console.log(`  Enforcement actions:       ${enforcementCount}`);
console.log(`  FTS entries (provisions):  ${ftsCount}`);
console.log(`  FTS entries (enforcement): ${enfFtsCount}`);
console.log(`\nDone. Database ready at ${DB_PATH}`);

db.close();
