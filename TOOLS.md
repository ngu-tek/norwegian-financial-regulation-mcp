# Tools -- Norwegian Financial Regulation MCP

6 tools for searching and retrieving Finanstilsynet regulatory data.

All data is in Norwegian. Tool descriptions and parameter names are in English.

---

## 1. no_fin_search_regulations

Full-text search across Finanstilsynet regulatory provisions. Returns forskrifter (regulations), rundskriv (circulars), and veiledninger (guidance). Supports Norwegian-language queries.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `query` | string | Yes | Search query in Norwegian or English (e.g., `hvitvaskingsloven`, `IKT-sikkerhet`, `kapitaldekning`, `Solvens II`) |
| `sourcebook` | string | No | Filter by sourcebook ID: `FTNO_FORSKRIFTER`, `FTNO_RUNDSKRIV`, `FTNO_VEILEDNINGER` |
| `status` | string | No | Filter by status: `in_force`, `deleted`, `not_yet_in_force`. Defaults to all. |
| `limit` | number | No | Maximum results (default 20, max 100) |

**Returns:** Array of matching provisions with id, sourcebook_id, reference, title, text, type, status, effective_date, chapter, and section.

**Example:**

```json
{
  "query": "hvitvaskingsloven",
  "sourcebook": "FTNO_FORSKRIFTER",
  "status": "in_force"
}
```

**Data sources:** Finanstilsynet (finanstilsynet.no) via lovdata.no.

**Limitations:** Summaries, not full legal text. Norwegian-language content only.

---

## 2. no_fin_get_regulation

Get a specific Finanstilsynet provision by sourcebook and reference. Returns the full record including text, metadata, and status.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `sourcebook` | string | Yes | Sourcebook identifier: `FTNO_FORSKRIFTER`, `FTNO_RUNDSKRIV`, or `FTNO_VEILEDNINGER` |
| `reference` | string | Yes | Full provision reference (e.g., `Rundskriv 14/2021`) |

**Returns:** Single provision record with all fields, or an error if not found.

**Example:**

```json
{
  "sourcebook": "FTNO_RUNDSKRIV",
  "reference": "Rundskriv 14/2021"
}
```

**Data sources:** Finanstilsynet (finanstilsynet.no), lovdata.no.

**Limitations:** Exact match on sourcebook + reference. Partial prefix matching is attempted as a fallback. Use `no_fin_search_regulations` for fuzzy search.

---

## 3. no_fin_list_sourcebooks

List all Finanstilsynet regulatory sourcebooks available in the database. Takes no parameters.

**Parameters:** None.

**Returns:** Array of sourcebooks with id, name, and description.

**Example:**

```json
{}
```

**Data sources:** N/A (database metadata).

**Limitations:** None.

---

## 4. no_fin_search_enforcement

Search Finanstilsynet enforcement actions: administrative fines (overtredelsesgebyr), licence revocations (tilbakekall), activity restrictions, and public warnings.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `query` | string | Yes | Search query (e.g., entity name, `overtredelsesgebyr`, `tilbakekall`, `advarsel`) |
| `action_type` | string | No | Filter by action type: `fine`, `ban`, `restriction`, `warning` |
| `limit` | number | No | Maximum results (default 20, max 100) |

**Returns:** Array of matching enforcement actions with id, firm_name, reference_number, action_type, amount, date, summary, and sourcebook_references.

**Example:**

```json
{
  "query": "overtredelsesgebyr",
  "action_type": "fine"
}
```

**Data sources:** Finanstilsynet (finanstilsynet.no).

**Limitations:** Summaries of enforcement decisions, not full legal text. Norwegian-language content only.

---

## 5. no_fin_check_currency

Check whether a specific Finanstilsynet provision is currently in force. Returns the status and effective date.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `reference` | string | Yes | Full provision reference to check (e.g., `Rundskriv 14/2021`) |

**Returns:** Object with reference, status (`in_force`, `deleted`, `not_yet_in_force`, or `unknown`), effective_date, and found (boolean).

**Example:**

```json
{
  "reference": "Rundskriv 14/2021"
}
```

**Data sources:** Finanstilsynet (finanstilsynet.no), lovdata.no.

**Limitations:** Only checks provisions in the database. A `found: false` result means the provision is not in the dataset, not that it does not exist.

---

## 6. no_fin_about

Return metadata about this MCP server: version, data source, tool list. Takes no parameters.

**Parameters:** None.

**Returns:** Server name, version, description, data source URL, and tool list (name, description).

**Example:**

```json
{}
```

**Data sources:** N/A (server metadata).

**Limitations:** None.
