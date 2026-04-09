#!/usr/bin/env node
/**
 * HTTP Server Entry Point for Docker Deployment
 *
 * Provides Streamable HTTP transport for remote MCP clients.
 * Use src/index.ts for local stdio-based usage.
 *
 * Endpoints:
 *   GET  /health  -- liveness probe
 *   POST /mcp     -- MCP Streamable HTTP (session-aware)
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { listSourcebooks, searchProvisions, getProvision, searchEnforcement, checkProvisionCurrency, } from "./db.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PORT = parseInt(process.env["PORT"] ?? "3000", 10);
const SERVER_NAME = "norwegian-financial-regulation-mcp";
let pkgVersion = "0.1.0";
try {
    const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8"));
    pkgVersion = pkg.version;
}
catch {
    // fallback
}
// --- Tool definitions ---
const TOOLS = [
    {
        name: "no_fin_search_regulations",
        description: "Full-text search across Finanstilsynet regulatory provisions. Returns forskrifter (regulations), rundskriv (circulars), and veiledninger (guidance). Supports Norwegian-language queries.",
        inputSchema: {
            type: "object",
            properties: {
                query: { type: "string", description: "Search query in Norwegian or English (e.g., 'hvitvaskingsloven', 'IKT-sikkerhet', 'kapitaldekning')" },
                sourcebook: { type: "string", description: "Filter by sourcebook ID (e.g., FTNO_FORSKRIFTER). Optional." },
                status: {
                    type: "string",
                    enum: ["in_force", "deleted", "not_yet_in_force"],
                    description: "Filter by provision status. Optional.",
                },
                limit: { type: "number", description: "Max results (default 20)." },
            },
            required: ["query"],
        },
    },
    {
        name: "no_fin_get_regulation",
        description: "Get a specific Finanstilsynet provision by sourcebook and reference.",
        inputSchema: {
            type: "object",
            properties: {
                sourcebook: { type: "string", description: "Sourcebook identifier (e.g., FTNO_FORSKRIFTER)" },
                reference: { type: "string", description: "Provision reference (e.g., 'Rundskriv 14/2021')" },
            },
            required: ["sourcebook", "reference"],
        },
    },
    {
        name: "no_fin_list_sourcebooks",
        description: "List all Finanstilsynet regulatory sourcebooks.",
        inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
        name: "no_fin_search_enforcement",
        description: "Search Finanstilsynet enforcement actions — administrative fines, licence revocations, and public warnings.",
        inputSchema: {
            type: "object",
            properties: {
                query: { type: "string", description: "Search query (entity name, 'overtredelsesgebyr', 'tilbakekall')" },
                action_type: {
                    type: "string",
                    enum: ["fine", "ban", "restriction", "warning"],
                    description: "Filter by action type. Optional.",
                },
                limit: { type: "number", description: "Max results (default 20)." },
            },
            required: ["query"],
        },
    },
    {
        name: "no_fin_check_currency",
        description: "Check whether a specific Finanstilsynet provision is currently in force.",
        inputSchema: {
            type: "object",
            properties: {
                reference: { type: "string", description: "Provision reference to check" },
            },
            required: ["reference"],
        },
    },
    {
        name: "no_fin_about",
        description: "Return metadata about this MCP server: version, data source, tool list.",
        inputSchema: { type: "object", properties: {}, required: [] },
    },
];
// --- Zod schemas ---
const SearchRegulationsArgs = z.object({
    query: z.string().min(1),
    sourcebook: z.string().optional(),
    status: z.enum(["in_force", "deleted", "not_yet_in_force"]).optional(),
    limit: z.number().int().positive().max(100).optional(),
});
const GetRegulationArgs = z.object({
    sourcebook: z.string().min(1),
    reference: z.string().min(1),
});
const SearchEnforcementArgs = z.object({
    query: z.string().min(1),
    action_type: z.enum(["fine", "ban", "restriction", "warning"]).optional(),
    limit: z.number().int().positive().max(100).optional(),
});
const CheckCurrencyArgs = z.object({
    reference: z.string().min(1),
});
// --- MCP server factory ---
function createMcpServer() {
    const server = new Server({ name: SERVER_NAME, version: pkgVersion }, { capabilities: { tools: {} } });
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: TOOLS,
    }));
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args = {} } = request.params;
        function textContent(data) {
            return {
                content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
            };
        }
        function errorContent(message) {
            return {
                content: [{ type: "text", text: message }],
                isError: true,
            };
        }
        try {
            switch (name) {
                case "no_fin_search_regulations": {
                    const parsed = SearchRegulationsArgs.parse(args);
                    const results = searchProvisions({
                        query: parsed.query,
                        sourcebook: parsed.sourcebook,
                        status: parsed.status,
                        limit: parsed.limit,
                    });
                    return textContent({ results, count: results.length });
                }
                case "no_fin_get_regulation": {
                    const parsed = GetRegulationArgs.parse(args);
                    const provision = getProvision(parsed.sourcebook, parsed.reference);
                    if (!provision) {
                        return errorContent(`Provision not found: ${parsed.sourcebook} ${parsed.reference}`);
                    }
                    return textContent(provision);
                }
                case "no_fin_list_sourcebooks": {
                    const sourcebooks = listSourcebooks();
                    return textContent({ sourcebooks, count: sourcebooks.length });
                }
                case "no_fin_search_enforcement": {
                    const parsed = SearchEnforcementArgs.parse(args);
                    const results = searchEnforcement({
                        query: parsed.query,
                        action_type: parsed.action_type,
                        limit: parsed.limit,
                    });
                    return textContent({ results, count: results.length });
                }
                case "no_fin_check_currency": {
                    const parsed = CheckCurrencyArgs.parse(args);
                    const currency = checkProvisionCurrency(parsed.reference);
                    return textContent(currency);
                }
                case "no_fin_about": {
                    return textContent({
                        name: SERVER_NAME,
                        version: pkgVersion,
                        description: "Finanstilsynet (Norwegian FSA) financial regulation MCP server. Provides access to forskrifter (regulations), rundskriv (circulars), veiledninger (guidance), and enforcement actions.",
                        data_source: "Finanstilsynet regulatory publications (https://www.finanstilsynet.no/)",
                        tools: TOOLS.map((t) => ({ name: t.name, description: t.description })),
                    });
                }
                default:
                    return errorContent(`Unknown tool: ${name}`);
            }
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return errorContent(`Error in ${name}: ${message}`);
        }
    });
    return server;
}
// --- HTTP server ---
async function main() {
    const sessions = new Map();
    const httpServer = createServer((req, res) => {
        handleRequest(req, res, sessions).catch((err) => {
            console.error(`[${SERVER_NAME}] Unhandled error:`, err);
            if (!res.headersSent) {
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Internal server error" }));
            }
        });
    });
    async function handleRequest(req, res, activeSessions) {
        const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
        if (url.pathname === "/health") {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ status: "ok", server: SERVER_NAME, version: pkgVersion }));
            return;
        }
        if (url.pathname === "/mcp") {
            const sessionId = req.headers["mcp-session-id"];
            if (sessionId && activeSessions.has(sessionId)) {
                const session = activeSessions.get(sessionId);
                await session.transport.handleRequest(req, res);
                return;
            }
            const mcpServer = createMcpServer();
            const transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: () => randomUUID(),
            });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK type mismatch with exactOptionalPropertyTypes
            await mcpServer.connect(transport);
            transport.onclose = () => {
                if (transport.sessionId) {
                    activeSessions.delete(transport.sessionId);
                }
                mcpServer.close().catch(() => { });
            };
            await transport.handleRequest(req, res);
            if (transport.sessionId) {
                activeSessions.set(transport.sessionId, { transport, server: mcpServer });
            }
            return;
        }
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not found" }));
    }
    httpServer.listen(PORT, () => {
        console.error(`${SERVER_NAME} v${pkgVersion} (HTTP) listening on port ${PORT}`);
        console.error(`MCP endpoint:  http://localhost:${PORT}/mcp`);
        console.error(`Health check:  http://localhost:${PORT}/health`);
    });
    process.on("SIGTERM", () => {
        console.error("Received SIGTERM, shutting down...");
        httpServer.close(() => process.exit(0));
    });
}
main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
