# StreamEo Universal Media Proxy (Cloudflare Worker)

Blocked / CORS / hotlink-protected addon streams ko browser me chalane ke liye ek chhota proxy.
Ye **free** hai (Workers free plan: 100k requests/day).

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
3. **Edit code** → `worker.js` ka pura content paste karo → **Deploy**
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

Set hone par player sabse pehle yahi proxy try karta hai, phir public proxies.

### Hardcode karna ho to
`index.html` me `PUBLIC_PROXIES` ke pehle apna entry daal do:

```js
const PUBLIC_PROXIES = [
function (u) { return "https://stream-proxy.abc.workers.dev/?u=" + encodeURIComponent(u) + "&k=MYTOKEN"; },
/* ...defaults... */
];
```

## Limits / notes

- Free plan: **100,000 requests/day**, ~10ms CPU/request (body streaming CPU me nahi ginta).
- Video proxy bandwidth heavy hota hai — zyada viewers ho to Workers Paid ($5/mo) lo.
- Sensitive content / copyright: sirf wahi content proxy karo jiska right tumhare paas ho.
