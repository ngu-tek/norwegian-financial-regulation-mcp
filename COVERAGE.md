# Coverage -- Norwegian Financial Regulation MCP

Current coverage of Norwegian financial sector regulatory data from Finanstilsynet.

**Last updated:** 2026-04-04

---

## Sources

| Source | Authority | Records | Content |
|--------|-----------|---------|---------|
| **Finanstilsynet** | Norwegian Financial Supervisory Authority | 200 provisions + 36 enforcement actions | Forskrifter (regulations), rundskriv (circulars), veiledninger (guidance), enforcement actions |
| **Total** | | **236 records** | ~408 KB SQLite database |

---

## Sourcebooks

| Sourcebook ID | Norwegian Term | Description | Provisions |
|---------------|----------------|-------------|------------|
| `FTNO_FORSKRIFTER` | Forskrifter (Regulations) | Binding financial regulations issued under Norwegian law | 86 |
| `FTNO_RUNDSKRIV` | Rundskriv (Circulars) | Supervisory circulars providing interpretation and expectations | 55 |
| `FTNO_VEILEDNINGER` | Veiledninger (Guidance) | Non-binding guidance on regulatory compliance | 59 |

## Provision Breakdown

| Category | Count | Examples |
|----------|-------|---------|
| Forskrifter | 86 | Capital adequacy, anti-money laundering, insurance solvency, securities trading, payment services |
| Rundskriv | 55 | ICT security expectations, internal control requirements, AML/CFT supervisory letters, risk management circulars |
| Veiledninger | 59 | Compliance programme guidance, outsourcing guidelines, fitness and propriety assessments, reporting instructions |
| **Total provisions** | **200** | |

## Enforcement Actions

| Type | Description | Count |
|------|-------------|-------|
| `fine` | Administrative fines (overtredelsesgebyr) | Included |
| `ban` | Licence revocations (tilbakekall av tillatelse) | Included |
| `restriction` | Activity restrictions or conditions | Included |
| `warning` | Public warnings (offentlig advarsel) | Included |
| **Total enforcement actions** | | **36** |

---

## What Is NOT Included

This is a seed dataset. The following are not yet covered:

- **Full text of original documents** -- records contain summaries, not complete legal text from lovdata.no
- **Finansklagenemnda decisions** -- Norwegian Financial Complaints Board rulings are not included
- **EU financial directives** -- MiFID II, Solvency II, CRD/CRR, PSD2, DORA, etc. are covered by the [EU Regulations MCP](https://github.com/Ansvar-Systems/EU_compliance_MCP), not this server
- **Stortinget proceedings** -- parliamentary debates on financial legislation are not included
- **Individual firm supervision reports** -- confidential supervisory correspondence is not covered
- **Historical regulation versions** -- limited to current in-force versions
- **Norges Bank financial stability reports** -- central bank publications are not included
- **Sector-specific prudential returns** -- individual reporting templates are not included (only the regulatory basis)

---

## Limitations

- **Seed dataset** -- 236 records across 3 sourcebooks and enforcement actions. Full coverage is planned.
- **Norwegian text only** -- all regulatory content is in Norwegian. English search queries may return limited results.
- **Summaries, not full legal text** -- records contain representative summaries, not the complete official text from lovdata.no or finanstilsynet.no.
- **Quarterly manual refresh** -- data is updated manually. Recent regulatory changes may not be reflected.
- **No real-time tracking** -- amendments and repeals are not tracked automatically.

---

## Planned Improvements

Full automated ingestion is planned from:

- **lovdata.no** -- official Norwegian legal information system (forskrifter, lover, rundskriv)
- **finanstilsynet.no** -- Finanstilsynet regulatory publications, circulars, guidance, and enforcement decisions

---

## Language

All content is in Norwegian. The following search terms are useful starting points:

| Norwegian Term | English Equivalent |
|----------------|-------------------|
| hvitvaskingsloven | anti-money laundering act |
| kapitaldekning | capital adequacy |
| IKT-sikkerhet | ICT security |
| verdipapirhandel | securities trading |
| forsikringsvirksomhet | insurance business |
| betalingstjenester | payment services |
| internkontroll | internal control |
| risikostyring | risk management |
| soliditet | solvency |
| overtredelsesgebyr | administrative fine |
| tilbakekall | revocation |
| konsesjon | licence |
| rapportering | reporting |
| egnethetsvurdering | fitness and propriety assessment |
