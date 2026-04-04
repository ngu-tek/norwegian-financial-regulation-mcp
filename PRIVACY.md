# Privacy Policy

## Data Collection

**This Tool collects no data.** Specifically:

- No queries are logged
- No user data is stored
- No usage tracking or analytics
- No cookies or session identifiers
- No telemetry

The database is a read-only knowledge base. No user data is written to disk.

## Data Flows

### Local npm Package

```
User Query -> MCP Client (Claude Desktop/Cursor) -> Local MCP Server -> Local SQLite Database
```

When running locally via `npx @ansvar/norwegian-financial-regulation-mcp`, all database queries stay on your machine. The only external data flow is between the MCP client and the AI provider (e.g., Anthropic).

### Remote HTTP Endpoint

```
User Query -> MCP Client -> Hetzner Server -> SQLite Database -> Response
```

When connecting to the remote endpoint (`mcp.ansvar.eu`), queries transit Ansvar's Hetzner infrastructure. No queries are logged or stored.

### What Gets Transmitted

When you use this Tool through an AI client:

- **Query text**: Your search queries and tool parameters
- **Tool responses**: Regulation text, enforcement action summaries, provision metadata
- **MCP protocol metadata**: Session identifiers, request IDs

**What does NOT get transmitted:**

- Files on your computer
- Other conversation content (depends on AI client configuration)

## Third-Party Data Processing

- **Anthropic** (if using Claude): Subject to [Anthropic Privacy Policy](https://www.anthropic.com/legal/privacy)
- **AI client provider**: Subject to that provider's privacy policy

## Confidentiality Considerations

### For Financial Sector Professionals

- **General regulatory research**: Safe to use through any deployment -- Norwegian financial regulation text is public information
- **Client-specific queries**: If your queries could reveal confidential business information (e.g., specific firm compliance gaps), consider using the local npm package
- **Sensitive matters**: For confidential regulatory compliance work, use the local deployment option

## GDPR

This Tool processes no personal data. No Data Processing Agreement (DPA) is required for use of the MCP server itself. Separate agreements may be required with AI service providers (Anthropic, etc.).

## Questions

For privacy questions: https://github.com/Ansvar-Systems/norwegian-financial-regulation-mcp/issues

---

**Last Updated**: 2026-04-04
