# StreamEo — Mirror Research (tested 2026-10-31)

Live HTTP checks from the build sandbox. "OK" = server rendered a real player page for
`The Shawshank Redemption` (`tt0111161` / TMDB `278`) and `Breaking Bad S1E1`
(`tt0903747` / TMDB `1396`).

## ✅ Working mirrors (shipped in the app)

| # | Mirror | Movie URL | TV URL | ID type | Notes |
|---|--------|-----------|--------|---------|-------|
| 1 | **VixSrc** | `vixsrc.to/movie/{tmdb}` | `vixsrc.to/tv/{tmdb}/{s}/{e}` | TMDB | Cleanest player seen in testing, 1080p/720p/480p, English CC + multi-language subs, native fullscreen |
| 2 | **EmbedWave** | `embedwave.cc/embed/movie/{tmdb}` | `embedwave.cc/embed/tv/{tmdb}/{s}/{e}` | TMDB | Advertises zero injected ads, multi-server dropdown, no key/signup |
| 3 | **VidNest** | `vidnest.fun/movie/{tmdb}` | `vidnest.fun/tv/{tmdb}/{s}/{e}` | TMDB | 12 internal sources (Lamda, Zeta, Prime, Hexa…), Skip Intro, Auto Next Episode |
| 4 | **VidLink Pro** | `vidlink.pro/movie/{imdb}` | `vidlink.pro/tv/{tmdb}/{s}/{e}` | mixed | Hindi subtitles, quality selector, PiP + fullscreen. **TV needs TMDB id** (IMDb gives 500) |
| 5 | **VidFast Pro** | `vidfast.pro/movie/{imdb}` | `vidfast.pro/tv/{imdb}/{s}/{e}` | IMDb | Redirects to `vidfast.vc`, 4K + multi-audio (vRapid/vBlaze/Cobra/Cine) |
| 6 | **VidSpark** | `vidspark.to/movie/{imdb}` | `vidspark.to/tv/{imdb}/{s}/{e}` | IMDb or TMDB | `moviesapi.to` redirects here (same service). Episode duration resolved correctly |
| 7 | **VidSrc SH** | `vidsrc.sh/embed/movie/{imdb}` | `vidsrc.sh/embed/tv/{imdb}/{s}/{e}` | IMDb | `vidsrc.me` redirects here (so `me` was removed as a duplicate) |
| 8 | **VidSrc TO** | `vidsrc.to/embed/movie/{imdb}` | `vidsrc.to/embed/tv/{imdb}/{s}/{e}` | IMDb | Multi-quality |
| 9 | **VidSrc PM** | `vidsrc.pm/embed/movie/{imdb}` | `vidsrc.pm/embed/tv/{imdb}/{s}/{e}` | IMDb | "VidSpark/Moviesapi" backend, ISP-friendly |
| 10 | **NontonGo** | `nontongo.win/embed/movie/{imdb}` | `nontongo.win/embed/tv/{imdb}/{s}/{e}` | IMDb | MultiSources (MIX / HD / VIP) |
| 11 | **AutoEmbed** | `autoembed.co/movie/imdb/{imdb}` | `autoembed.co/tv/imdb/{imdb}-{s}-{e}` | IMDb | Redirects to `autoembed.me` |
| 12 | **2Embed** | `www.2embed.cc/embed/{imdb}` | `www.2embed.cc/embedtv/{imdb}&s={s}&e={e}` | IMDb | Redirects to `2embed.skin`, embed still works |

## ❌ Dead / unusable (tested, not shipped)

| Mirror | Result |
|---|---|
| `vidsrc.cc` | Cloudflare 522 time-out |
| `vidsrc.xyz` | fetch failed |
| `vidsrc.rip` | HTTP 500 |
| `videasy.net` / `videasy.xyz` / `videasy.to` | 500 / 404 / unreachable |
| `vidbinge.dev` | HTTP 500 |
| `embed.su` | HTTP 500 |
| `111movies.com` | domain parked ("for sale") |
| `vidking.net` | fetch failed |
| `moviesapi.club` | fetch failed (use `moviesapi.to` → VidSpark instead) |

## How the app uses this

- **TMDB id** comes free from Cinemeta meta (`meta.moviedb_id`) and is cached in `TMDB_CACHE`.
- If TMDB id is known → **12 mirrors** (4 clean/TMDB first).
- If not (rare addon-only titles) → **9–8 IMDb-only mirrors** are used, so something always plays.
- The **last server that worked** for a title is remembered (`se_last_srv`) and tried first next time.
- Cloud iframes render inside a **sandbox** (`allow-scripts allow-same-origin allow-forms
  allow-presentation allow-downloads`, but **no** `allow-popups` / `allow-top-navigation`),
  which blocks popup and redirect ads. Toggle it from the cloud toolbar (`🧼 Sandbox`).
- `↗ New Tab` opens the current mirror isolated (`noopener noreferrer`).

> Re-run this research anytime: mirrors rotate domains often (VidSrc alone went `.to → .xyz →
> .sbs → .mov` style over time), so re-test before removing/adding one.
