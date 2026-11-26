# StreamEo Universal Media Proxy (Cloudflare Worker)

Blocked / CORS / hotlink-protected addon streams ko browser me chalane ke liye ek chhota proxy.
Cloudflare account/plan limits apply; verify current quotas and pricing before deployment. This is not authorization to access restricted media.

## Kya karta hai

- **HLS (.m3u8)** → playlist rewrite karta hai, saare sub-playlist + segments bhi proxy se jaate hain
  (`#EXT-X-KEY`, `#EXT-X-MEDIA` audio renditions included).
- **MP4 / WebM** → `Range` requests pass-through, matlab seek/scrub sahi chalta hai (206 responses).
- **CORS** → `Access-Control-Allow-Origin: *` + expose headers.
- **Hotlink protection** → `Referer` / `Origin` / `User-Agent` original host ke naam par set hote hain.
- **Security** → optional `TOKEN` (`&k=...`), optional `ALLOW_HOSTS` allowlist, localhost/SSRF blocklist.
- Torrent / infoHash links isse bhi nahi chalenge — unke liye debrid service chahiye.

## Deploy — Option A: Dashboard (2 min)

1. https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Worker**
2. Naam do: `stream-proxy` → **Deploy**
3. **Edit code** → create modules `worker.js` **and** `sync.mjs` using both files in this directory; keep `worker.js` as the entry point → **Deploy**. CLI deployment below is recommended because module imports must be preserved.
4. URL milega: `https://stream-proxy.<your-subdomain>.workers.dev`
5. Test: browser me `https://stream-proxy.<your-subdomain>.workers.dev/` kholo → "StreamEo Media Proxy — OK" dikhna chahiye.

> `workers.dev` subdomain pehli baar set karna padta hai: Workers & Pages → **Settings** → *Subdomain* / "Change" → apna subdomain choose karo. Iske bina URL kaam nahi karega.

## Deploy — Option B: CLI (dashboard error aaye to ye use karo)

```bash
cd worker
npx wrangler login          # browser me Cloudflare login
npx wrangler deploy         # URL print karega
npx wrangler secret put TOKEN   # optional: secret token
```

`wrangler` login bhi na chale to API token se:

```bash
export CLOUDFLARE_API_TOKEN=xxxxx   # My Profile → API Tokens → "Edit Cloudflare Workers"
export CLOUDFLARE_ACCOUNT_ID=xxxxx  # dashboard URL me /accounts/<id>
npx wrangler deploy
```

## App me kaise lagayein

### Aasan tareeka (koi code change nahi)
App kholo → **Add-ons** page → **🛡️ proxy URL** box me apna worker URL paste karo → **Save Proxy** → **🧪 Test**.
Format chalte hain:

```
https://stream-proxy.abc.workers.dev
https://stream-proxy.abc.workers.dev/?u=
https://stream-proxy.abc.workers.dev/?url={url}
https://stream-proxy.abc.workers.dev/?u=&k=MYTOKEN      (token ke saath)
```

A configured worker gets a fallback attempt. Public proxies are OFF by default; enable them explicitly in Preferences only if you accept sharing full stream URLs.

### Do not hardcode secrets

Set your private worker in the app's Add-ons proxy setting. Do not commit real tokens in `PUBLIC_PROXIES`, source code, configuration examples, issues or logs. The legacy media proxy token travels in a URL and may appear in logs; it is not the private sync authentication mechanism.

## Limits / notes

- Worker/D1 quotas and limits depend on your current plan; check Cloudflare documentation.
- Video proxying can incur significant usage; configure rate limits and cost controls.
- Sensitive content / copyright: sirf wahi content proxy karo jiska right tumhare paas ho.


## Optional private sync + D1 (v3.2)

Nothing is provisioned automatically. Without a `DB` binding, `/api/sync` returns 503 and the media proxy still operates. This API is separate from the proxy's legacy `?u=` / `?k=` URLs. Do not send sync secrets in query parameters.

1. Use a Cloudflare account you control; `cd worker` then `npx wrangler d1 create streameo-private-sync`.
2. In `wrangler.toml`, uncomment the `[[d1_databases]]` block and replace `database_id` with the **real ID printed by create**. Keep `binding = "DB"` and `migrations_dir = "migrations"`.
3. Configure a single `[vars]` section with `SYNC_ALLOWED_ORIGINS = "https://your-static-site.example"`. Multiple origins are comma-separated; origins exclude paths. For GitHub Pages use `https://sanjeettiwari1299-eng.github.io` (not `/youtu/`). Configure `ALLOW_HOSTS` for authorized media separately if using the proxy. Never deploy an unrestricted public proxy just to enable sync.
4. Run `npx wrangler d1 migrations apply streameo-private-sync --remote`, then `npx wrangler deploy`.
5. Check `https://your-worker.example/api/sync/health`: it returns only service/version/configured, never profile identifiers. A healthy binding does not prove the migration was applied; test a fresh authorized snapshot too.
6. In the frontend avatar → Profiles & sync, enter the worker's HTTPS **origin**, generate a private secret, and keep a secure copy. Connect/download checks that secret's snapshot; use Upload snapshot to create the first revision. On another device, create/select a local profile and use the same worker and secret. Treat Connect/download as replacement of the active library if a remote snapshot exists. Export a private backup first.

### API contract

- `GET /api/sync`: `Authorization: Bearer <64 lowercase hex>` → `{data,revision,ts}`. Missing profile returns revision 0 and empty data. No profile-list endpoint.
- `PUT /api/sync`: same header, `Content-Type: application/json`, `If-Match: <last revision>` and `{data:{...supported keys...}}`. Payloads are capped at 256 KiB, unsupported top-level keys ignored. Snapshot schema is validated by the frontend on import. The server stores only SHA-256 of the secret as row ID, never the bearer secret itself.
- Creation uses revision 0; updates use the last downloaded revision. A single conditional SQL statement enforces atomic compare-and-swap. A stale revision returns 409; the client keeps local data and stops automatic upload. Export local changes, then explicitly download latest. There is no automatic conflict merge.
- Only exact configured CORS origins are allowed. Non-browser requests still require the secret; CORS is not authentication. Query parameters are rejected. Set external WAF/rate limits and usage quotas; an optional `SYNC_RATE_LIMITER` Workers binding with `.limit({key})` is supported. Without it no application-layer rate limiter is installed.

### Operator responsibilities

Snapshots contain private library/progress/preferences and potentially credential-bearing add-on URLs. Sync uses TLS but is **not end-to-end encrypted**. The worker/database operator can read snapshots. Never log Authorization headers or request bodies. Configure retention/backups, allowed origins, request-rate/size/cost limits and restrict D1 access. Rotate a compromised secret by generating a new one and migrating data privately; delete the old hashed row through a secure operator process. Disconnect in the UI only removes local authorization, not the cloud row. There is no recovery if a secret is lost.

Read [../SECURITY.md](../SECURITY.md). The existing media proxy's short hostname blocklist is not a complete SSRF boundary (including redirects/DNS). Restrict allowed media hosts and audit before exposing it. Neither proxy nor sync should be used to bypass DRM, access controls or content rights. D1 behavior is tested locally with real SQLite; a production Cloudflare deployment still requires a smoke test.
