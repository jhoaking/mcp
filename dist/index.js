import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { Pool } from "pg";
const args = process.argv.slice(2);
if (args.length === 0) {
    console.error("❌ Debes pasar la URL de conexión, ej:");
    process.exit(1);
}
const databaseUrl = args[0];
const pool = new Pool({
    connectionString: databaseUrl,
});
const server = new Server({
    name: "mcp-postgres",
    version: "1.0.0",
}, {
    capabilities: { tools: {} },
});
// 🔹 Tools disponibles
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
        {
            name: "run_query",
            description: "Ejecuta una consulta SQL (SELECT, INSERT, UPDATE, DELETE, etc.)",
            inputSchema: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "Consulta SQL a ejecutar",
                    },
                },
                required: ["query"],
            },
        },
    ],
}));
// 🔹 Ejecución de la tool
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    if (name === "run_query") {
        const { query } = args;
        if (!query || typeof query !== "string") {
            return {
                content: [{ type: "text", text: "❌ Debes enviar un 'query' válido." }],
            };
        }
        const client = await pool.connect();
        try {
            const isSelect = query.trim().toUpperCase().startsWith("SELECT");
            const result = await client.query(query);
            let text;
            if (isSelect) {
                text =
                    result.rows.length > 0
                        ? JSON.stringify(result.rows, null, 2)
                        : "✅ Query ejecutada correctamente.";
            }
            else {
                text = `✅ Query ejecutado correctamente. Filas afectadas: ${result.rowCount}`;
            }
        }
        catch (error) {
            return {
                content: [
                    { type: "text", text: `❌ Error ejecutando query: ${error.message}` },
                ],
            };
        }
        finally {
            client.release();
        }
    }
    throw new Error(`Unknown tool: ${name}`);
});
// 🔹 Inicializar
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("🚀 Server MCP Postgres inicializado correctamente");
}
main().catch((error) => console.error("❌ Error al iniciar MCP:", error));
