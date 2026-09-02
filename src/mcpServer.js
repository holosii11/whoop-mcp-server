import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { whoop } from "./whoopClient.js";

const rangeParams = {
    start: z
      .string()
      .optional()
      .describe("ISO 8601 start of the date range, e.g. 2026-08-01T00:00:00.000Z"),
    end: z
      .string()
      .optional()
      .describe("ISO 8601 end of the date range, e.g. 2026-09-01T00:00:00.000Z"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(25)
      .optional()
      .describe("Max records to return, 1-25 (default 10)."),
    nextToken: z
      .string()
      .optional()
      .describe("Pagination token from a previous call's response, to fetch the next page."),
};

function asToolResult(data) {
    return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
}

function asToolError(err) {
    return {
          isError: true,
          content: [{ type: "text", text: err instanceof Error ? err.message : String(err) }],
    };
}

export function createWhoopMcpServer() {
    const server = new McpServer({
          name: "whoop",
          version: "1.0.0",
    });

  server.registerTool(
        "whoop_connection_status",
    {
            title: "WHOOP connection status",
            description:
                      "Checks whether this server has an authorized WHOOP account connected yet.",
            inputSchema: {},
    },
        async () => asToolResult({ connected: whoop.isConnected() })
      );

  server.registerTool(
        "get_whoop_profile",
    {
            title: "Get WHOOP profile",
            description: "Fetches the connected member's basic WHOOP profile (name, email, user id).",
            inputSchema: {},
    },
        async () => {
                try {
                          return asToolResult(await whoop.getProfile());
                } catch (err) {
                          return asToolError(err);
                }
        }
      );

  server.registerTool(
        "get_whoop_body_measurements",
    {
            title: "Get WHOOP body measurements",
            description: "Fetches height, weight, and max heart rate on file with WHOOP.",
            inputSchema: {},
    },
        async () => {
                try {
                          return asToolResult(await whoop.getBodyMeasurements());
                } catch (err) {
                          return asToolError(err);
                }
        }
      );

  server.registerTool(
        "get_whoop_recovery",
    {
            title: "Get WHOOP recovery scores",
            description:
                      "Fetches recovery records (recovery score, HRV, resting heart rate) for a date range, newest first.",
            inputSchema: rangeParams,
    },
        async (params) => {
                try {
                          return asToolResult(await whoop.getRecovery(params));
                } catch (err) {
                          return asToolError(err);
                }
        }
      );

  server.registerTool(
        "get_whoop_sleep",
    {
            title: "Get WHOOP sleep data",
            description:
                      "Fetches sleep records (sleep stages, sleep performance, respiratory rate) for a date range, newest first.",
            inputSchema: rangeParams,
    },
        async (params) => {
                try {
                          return asToolResult(await whoop.getSleep(params));
                } catch (err) {
                          return asToolError(err);
                }
        }
      );

  server.registerTool(
        "get_whoop_cycles",
    {
            title: "Get WHOOP physiological cycles",
            description:
                      "Fetches daily strain/cycle records (day strain, average/max heart rate, calories) for a date range, newest first.",
            inputSchema: rangeParams,
    },
        async (params) => {
                try {
                          return asToolResult(await whoop.getCycles(params));
                } catch (err) {
                          return asToolError(err);
                }
        }
      );

  server.registerTool(
        "get_whoop_workouts",
    {
            title: "Get WHOOP workouts",
            description:
                      "Fetches workout records (sport, strain, duration, heart rate zones) for a date range, newest first.",
            inputSchema: rangeParams,
    },
        async (params) => {
                try {
                          return asToolResult(await whoop.getWorkouts(params));
                } catch (err) {
                          return asToolError(err);
                }
        }
      );

  return server;
}
