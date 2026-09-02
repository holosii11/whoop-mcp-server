import crypto from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { createWhoopMcpServer } from "./mcpServer.js";
import { getAuthorizationUrl, exchangeCodeForTokens } from "./whoopClient.js";
import { whoop } from "./whoopClient.js";

const PORT = process.env.PORT || 3000;
const PUBLIC_HOST = process.env.PUBLIC_HOST; // e.g. "whoop-mcp.onrender.com"

const app = createMcpExpressApp(
    PUBLIC_HOST
      ? { host: "0.0.0.0", allowedHosts: [PUBLIC_HOST] }
      : { host: "0.0.0.0" }
  );
// In-memory CSRF state for the one-time WHOOP OAuth handshake. This is a
// single-user personal server, so a simple in-memory Set is enough.
const pendingStates = new Set();

app.get("/", (_req, res) => {
    const connected = whoop.isConnected();
    res.type("html").send(`
        <html>
              <body style="font-family: sans-serif; max-width: 560px; margin: 60px auto;">
                      <h1>WHOOP MCP server</h1>
                              <p>Status: <strong>${connected ? "connected to WHOOP ✅" : "not connected yet"}</strong></p>
                                      ${connected ? "" : '<p><a href="/connect">Connect your WHOOP account</a></p>'}
                                              <p>MCP endpoint for Claude: <code>${PUBLIC_HOST ? `https://${PUBLIC_HOST}` : ""}/mcp</code></p>
                                                    </body>
                                                        </html>
                                                          `);
});

// Step 1 of the one-time setup: send the browser to WHOOP to authorize.
app.get("/connect", (_req, res) => {
    const state = crypto.randomBytes(16).toString("hex");
    pendingStates.add(state);
    try {
          res.redirect(getAuthorizationUrl(state));
    } catch (err) {
          res.status(500).send(`Configuration error: ${err.message}`);
    }
});

// Step 2: WHOOP redirects back here with an authorization code.
app.get("/oauth/callback", async (req, res) => {
    const { code, state, error } = req.query;

          if (error) {
                return res.status(400).send(`WHOOP returned an error: ${error}`);
          }
    if (!state || !pendingStates.has(state)) {
          return res.status(400).send("Invalid or expired state parameter. Start over at /connect.");
    }
    pendingStates.delete(state);

          if (!code) {
                return res.status(400).send("Missing authorization code from WHOOP.");
          }

          try {
                await exchangeCodeForTokens(String(code));
                res.type("html").send(`
                      <html>
                              <body style="font-family: sans-serif; max-width: 560px; margin: 60px auto;">
                                        <h1>Connected ✅</h1>
                                                  <p>This server can now read your WHOOP data. You can close this tab and add it to Claude as a custom connector.</p>
                                                          </body>
                                                                </html>
                                                                    `);
          } catch (err) {
                res.status(500).send(`Token exchange failed: ${err.message}`);
          }
});

// The MCP endpoint Claude talks to. Stateless mode: a fresh server +
// transport per request, since this is a low-traffic personal integration.
app.post("/mcp", async (req, res) => {
    try {
          const server = createWhoopMcpServer();
          const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
          await server.connect(transport);
          await transport.handleRequest(req, res, req.body);
          res.on("close", () => {
                  transport.close();
                  server.close();
          });
    } catch (err) {
          console.error("Error handling MCP request:", err);
          if (!res.headersSent) {
                  res.status(500).json({
                            jsonrpc: "2.0",
                            error: { code: -32603, message: "Internal server error" },
                            id: null,
                  });
          }
    }
});

app.get("/mcp", (_req, res) => {
    res.status(405).json({
          jsonrpc: "2.0",
          error: { code: -32000, message: "Method not allowed." },
          id: null,
    });
});

app.delete("/mcp", (_req, res) => {
    res.status(405).json({
          jsonrpc: "2.0",
          error: { code: -32000, message: "Method not allowed." },
          id: null,
    });
});

app.listen(PORT, () => {
    console.log(`WHOOP MCP server listening on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT}/connect to authorize with WHOOP (locally),`);
    console.log(`or your deployed URL's /connect once it's live.`);
});
