import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Pool } from "pg";

//let pool: Pool || null

//const args = process.argv.slice(2);
//if (args.length === 0) {
//  console.error("❌ Debes pasar la URL de conexión");
//
//  process.exit(1);
//}
//
//const databaseUrl = args[0];

interface QueryInput {
  query: string;
  connectionString: string;
}

const server = new Server(
  {
    name: "mcp-postgres",
    version: "1.0.0",
  },
  {
    capabilities: { tools: {} },
  }
);

// 🔹 Tools disponibles
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "run_query",
      description:
        "Ejecuta una consulta SQL (SELECT, INSERT, UPDATE, DELETE, etc.)",
      inputSchema: {
        type: "object",
        properties: {
          connectionString: {
            type: "string",
            description:
              "Cadena de conexión PostgreSQL. Ej: postgres://user:pass@host:5432/db",
          },
          query: {
            type: "string",
            description: "Consulta SQL a ejecutar",
          },
        },
        required: ["connectionString", "query"],
      },
    },
  ],
}));

// 🔹 Ejecución de la tool
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "run_query") {
    const { query, connectionString } = args as unknown as QueryInput;
    if (!connectionString || !query) {
      return {
        content: [
          {
            type: "text",
            text: "❌ Debes enviar 'connectionString' y 'query'.",
          },
        ],
      };
    }
    const pool = new Pool({
      connectionString,
    });

    const client = await pool.connect();
    try {
      const isSelect = query.trim().toUpperCase().startsWith("SELECT");
      const result = await client.query(query);
      let text: string;

      if (isSelect) {
        text =
          result.rows.length > 0
            ? JSON.stringify(result.rows, null, 2)
            : "✅ Query ejecutada correctamente.";
      } else {
        text = `✅ Query ejecutado correctamente. Filas afectadas: ${result.rowCount}`;
      }
       return {
        content: [{ type: "text", text }],
      };
    } catch (error: any) {
      return {
        content: [
          { type: "text", text: `❌ Error ejecutando query: ${error.message}` },
        ],
      };
    } finally {
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
