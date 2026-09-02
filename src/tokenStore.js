import fs from "node:fs";
import path from "node:path";

const TOKENS_PATH = process.env.TOKENS_PATH || path.join(process.cwd(), "data", "tokens.json");

function ensureDir() {
    const dir = path.dirname(TOKENS_PATH);
    if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
    }
}

/**
 * Reads stored WHOOP tokens from disk.
 * Falls back to WHOOP_REFRESH_TOKEN env var on first run (useful for
 * platforms with ephemeral disks, e.g. after a redeploy) so the server
 * can refresh a fresh access token without repeating the browser flow.
 * Returns null if nothing is available yet.
 */
export function readTokens() {
    try {
          if (fs.existsSync(TOKENS_PATH)) {
                  const raw = fs.readFileSync(TOKENS_PATH, "utf8");
                  return JSON.parse(raw);
          }
    } catch (err) {
          console.error("[tokenStore] failed to read tokens file:", err.message);
    }

  if (process.env.WHOOP_REFRESH_TOKEN) {
        return {
                access_token: null,
                refresh_token: process.env.WHOOP_REFRESH_TOKEN,
                expires_at: 0,
        };
  }

  return null;
}

export function writeTokens({ access_token, refresh_token, expires_in }) {
    ensureDir();
    const expires_at = Date.now() + (Number(expires_in) || 0) * 1000;
    const record = { access_token, refresh_token, expires_at };
    fs.writeFileSync(TOKENS_PATH, JSON.stringify(record, null, 2), "utf8");
    return record;
}

export function clearTokens() {
    try {
          if (fs.existsSync(TOKENS_PATH)) fs.unlinkSync(TOKENS_PATH);
    } catch (err) {
          console.error("[tokenStore] failed to clear tokens file:", err.message);
    }
}
