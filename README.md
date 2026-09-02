# WHOOP MCP server

A small remote MCP server that lets Claude read your WHOOP recovery, sleep,
strain (cycle), and workout data. It's built for one person (you) — WHOOP
itself is the thing that decides which account's data it can see, via a
one-time login you do in your browser.

It exposes these tools to Claude:

- `whoop_connection_status`
- `get_whoop_profile`
- `get_whoop_body_measurements`
- `get_whoop_recovery`
- `get_whoop_sleep`
- `get_whoop_cycles`
- `get_whoop_workouts`

There are three things to do, in order: register an app with WHOOP, deploy
this server somewhere reachable over HTTPS, then add it to Claude as a
custom connector.

## 1. Register an app on the WHOOP Developer Platform

1. Go to <https://developer.whoop.com> and sign in with your regular WHOOP
   account.
2. The first time, you'll be asked to create a **Team** (any name is fine —
   it's just a container for your apps).
3. Create an **App**. You get up to 5 apps per team.
4. Under **Scopes**, select: `read:recovery`, `read:sleep`, `read:cycles`,
   `read:workout`, `read:profile`, `read:body_measurement`, and `offline`
   (the `offline` scope is what lets WHOOP issue a refresh token, so this
   server doesn't need you to log in again every hour).
5. Under **Redirect URIs**, add:
   `https://<your-deployed-domain>/oauth/callback`
   You won't know the exact domain until step 2, but most hosts (Render,
   Railway, Fly.io, etc.) show you the domain before the first deploy
   finishes — come back and fill this in once you know it. It must match
   exactly, including `https://`.
6. Save, then copy the **Client ID** and **Client Secret** it gives you.
   Keep the secret private — never put it in client-side code or commit it
   to a public repo.

## 2. Deploy the server

Any Node.js host that lets you set environment variables and gives you a
public HTTPS URL works. Render's free tier is the path of least resistance:

1. Push this folder to a new GitHub repo (or use Render's "public Git URL"
   option if you don't want a repo).
2. On [render.com](https://render.com), **New +** → **Web Service**, point
   it at the repo. Render will pick up `render.yaml` automatically, or set
   it manually: build command `npm install`, start command `npm start`.
3. Add these environment variables in the Render dashboard:
   - `WHOOP_CLIENT_ID` — from step 1
   - `WHOOP_CLIENT_SECRET` — from step 1
   - `WHOOP_REDIRECT_URI` — `https://<your-service>.onrender.com/oauth/callback`
   - `PUBLIC_HOST` — `<your-service>.onrender.com` (no `https://`, no path)
4. Deploy. Once it's live, go back to your WHOOP app settings (step 1.5)
   and make sure the redirect URI there matches `WHOOP_REDIRECT_URI` exactly.
5. **Add a persistent disk** (Render's free tier includes a small one) at
   the path `/opt/render/project/src/data`, or set `TOKENS_PATH` to a
   location on that disk. Without this, a redeploy or restart wipes the
   stored WHOOP connection and you'll need to re-authorize.

Prefer Railway or Fly.io? Same three env vars, same idea — just no
`render.yaml` (Railway/Fly config isn't included, but both auto-detect a
Node app from `package.json`).

### Testing locally first (optional)

```bash
npm install
cp .env.example .env   # fill in the values from step 1
npm start
```

Locally you can use `WHOOP_REDIRECT_URI=http://localhost:3000/oauth/callback`
and leave `PUBLIC_HOST` unset — but Claude can't reach `localhost`, so this
is only useful for confirming the WHOOP login flow works before you deploy.

## 3. Connect it once to your WHOOP account

Visit `https://<your-deployed-domain>/connect` in a browser and log in with
WHOOP when prompted. You'll land on a "Connected ✅" page. This is a
one-time step — the server stores a refresh token and renews its own access
token from then on. Visiting `/` on your deployed URL shows the current
connection status.

## 4. Add it to Claude as a custom connector

Requires a Claude Pro, Max, Team, or Enterprise plan.

1. In Claude, go to **Settings → Connectors → Add custom connector**.
2. **Remote MCP server URL**: `https://<your-deployed-domain>/mcp`
3. Leave the OAuth Client ID/Secret fields blank — this server doesn't
   require Claude itself to authenticate (the WHOOP login in step 3 is
   what gates access to your data). If you want an extra layer so a stolen
   URL alone isn't enough, ask and I can add a shared-secret header check.
4. Click **Add**.
5. In a conversation, click the **+** button → **Connectors**, and enable
   "whoop" for that chat. Then just ask — e.g. "how was my recovery this
   week?"

## Notes

- This server is unauthenticated at the transport level: anyone with the
  URL and access to your Claude account's connector settings could call it.
  It only talks to *your* WHOOP account, and connector URLs aren't
  publicly discoverable, but don't post the URL anywhere public.
- Data ranges: `get_whoop_recovery`, `get_whoop_sleep`, `get_whoop_cycles`,
  and `get_whoop_workouts` all accept optional `start`, `end` (ISO 8601),
  `limit` (max 25 per page), and `nextToken` (for pagination) — ask Claude
  for a specific window (e.g. "last 30 days") and it will pass these
  through.
- WHOOP's API and developer terms can change; if something breaks, check
  <https://developer.whoop.com/docs> for updates.
