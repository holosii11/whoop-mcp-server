import { readTokens, writeTokens } from "./tokenStore.js";

const AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2/auth";
const TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";
const API_BASE = "https://api.prod.whoop.com/developer";

// Only request the scopes this server actually uses.
export const SCOPES = [
    "read:recovery",
    "read:sleep",
    "read:cycles",
    "read:workout",
    "read:profile",
    "read:body_measurement",
    "offline", // required to receive a refresh token
  ].join(" ");

function requireEnv(name) {
    const value = process.env[name];
    if (!value) {
          throw new Error(
                  `Missing required environment variable ${name}. Set it before starting the server.`
                );
    }
    return value;
}

export function getAuthorizationUrl(state) {
    const clientId = requireEnv("WHOOP_CLIENT_ID");
    const redirectUri = requireEnv("WHOOP_REDIRECT_URI");
    const url = new URL(AUTH_URL);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", SCOPES);
    url.searchParams.set("state", state);
    return url.toString();
}

export async function exchangeCodeForTokens(code) {
    const body = new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: requireEnv("WHOOP_CLIENT_ID"),
          client_secret: requireEnv("WHOOP_CLIENT_SECRET"),
          redirect_uri: requireEnv("WHOOP_REDIRECT_URI"),
    });

  const res = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
  });

  if (!res.ok) {
        const text = await res.text();
        throw new Error(`WHOOP token exchange failed (${res.status}): ${text}`);
  }

  const json = await res.json();
    return writeTokens(json);
}

async function refreshAccessToken(refreshToken) {
    const body = new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          client_id: requireEnv("WHOOP_CLIENT_ID"),
          client_secret: requireEnv("WHOOP_CLIENT_SECRET"),
          scope: "offline",
    });

  const res = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
  });

  if (!res.ok) {
        const text = await res.text();
        throw new Error(`WHOOP token refresh failed (${res.status}): ${text}`);
  }

  const json = await res.json();
    return writeTokens(json);
}

// Returns a valid access token, refreshing it first if it's missing or
// close to expiry. Throws a clear error if the server has never been
// connected to WHOOP yet.
async function getValidAccessToken() {
    let tokens = readTokens();
    if (!tokens || !tokens.refresh_token) {
          throw new Error(
                  "This server hasn't been connected to a WHOOP account yet. " +
                    "Open the server's /connect URL in a browser and authorize it once."
                );
    }

  const isExpiringSoon = !tokens.access_token || Date.now() > tokens.expires_at - 60_000;
    if (isExpiringSoon) {
          tokens = await refreshAccessToken(tokens.refresh_token);
    }

  return tokens.access_token;
}

async function apiGet(pathname, params = {}) {
    const accessToken = await getValidAccessToken();
    const url = new URL(API_BASE + pathname);
    for (const [key, value] of Object.entries(params)) {
          if (value !== undefined && value !== null && value !== "") {
                  url.searchParams.set(key, value);
          }
    }

  const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
        const text = await res.text();
        throw new Error(`WHOOP API error (${res.status}) for ${pathname}: ${text}`);
  }

  return res.json();
}

export const whoop = {
    isConnected() {
          const tokens = readTokens();
          return Boolean(tokens && tokens.refresh_token);
    },
    getProfile: () => apiGet("/v2/user/profile/basic"),
    getBodyMeasurements: () => apiGet("/v2/user/measurement/body"),
    getRecovery: (params) => apiGet("/v2/recovery", params),
    getSleep: (params) => apiGet("/v2/activity/sleep", params),
    getCycles: (params) => apiGet("/v2/cycle", params),
    getWorkouts: (params) => apiGet("/v2/activity/workout", params),
};
