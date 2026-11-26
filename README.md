# StreamEo Cinema

A static, Stremio-inspired personal cinema. Existing catalog, add-on, direct-stream, HLS, subtitle and external-player integrations are preserved. No framework or production build is required.

## Run

```sh
npm install
npm run dev
```

Open `http://localhost:3000`. The server binds to `0.0.0.0` for hosted previews. Alternatively, serve this directory with any static web server. Deploy the root directory (including `cinema.css`, `cinema.js`, `addon-engine.js`, `platform-core.js`, `platform-ui.js`, `assets`, `manifest.json`, `icon.svg`, and `sw.js`) to your static host.

## Cinema update

- Purple cinema theme, desktop sidebar, compact tablet rail and mobile bottom navigation.
- Featured title carousel, catalog filters, movie/series shelves, watchlist actions and search.
- Bundled seed artwork and catalog rows remain available when remote add-ons are unavailable. These are catalog listings, not bundled movies or guaranteed streams.
- Refined built-in player: seek bar, buffered progress, play/pause, manual seeking, volume, subtitle and playback settings, fullscreen, picture-in-picture where supported, and mini-player.
- Local MP4/WebM playback using browser object URLs: choose **Local files** in the sidebar or **+ Local file** in the discovery filters. Files are not uploaded. Codec support depends on the browser.
- Secondary player actions live in the three-dot menu. Keyboard help is available from the header/sidebar and desktop player.
- Accessible control labels, keyboard-seekable timeline, focus restoration, modal focus wrapping and reduced-motion styles.
- Fixed rapid-seek retry snap-back, Tab being hijacked for intro skipping, overlay menus covering the mini-player, subtitle object-URL cleanup and a fullscreen event-listener leak.
- No fabricated intro timings: the automatic “Skip Intro” prompt is no longer displayed without real markers.

### Shortcuts

| Action | Key |
| --- | --- |
| Search | Ctrl / Cmd + K |
| Play / pause | Space or K |
| Seek 10 seconds | Left / Right |
| Volume | Up / Down |
| Mute | M |
| Fullscreen | F |
| Mini-player | P |
| Episodes, when available | E |
| Close menu/player | Escape |

Playback shortcuts apply to the built-in HTML video player. Third-party iframe players have their own controls and cannot be reliably controlled across origins. Picture-in-picture/fullscreen also depend on browser support and permissions.

## Fast add-on / playback engine (v3.1)

- **Bounded parallel loading:** at most eight active JSON requests and three per host; background work has lower limits, reserving slots for playback. Slow/dead providers cannot create an unlimited request storm.
- **One request per URL:** concurrent catalog/detail/search/play requests share in-flight work instead of duplicating it.
- **Progressive providers:** valid manifests and stream groups become usable as soon as each provider responds. Metadata providers race rather than trying sequentially. Queued catalog/search results are not discarded by the old UI-only timeout.
- **First usable source:** playback starts on the first browser-usable direct source instead of waiting for every provider. Late direct links become fallback options without restarting the video. Metadata is not on the direct-play critical path. Automatic source selection favors a quicker 720p/1080p start over 4K; quality remains manually selectable.
- **Endpoint-specific cache:** catalogs stay fresh for two minutes with up to one hour of stale-while-revalidate fallback; metadata is fresh for 15 minutes with a bounded stale window. Stream responses have only a 20-second in-memory TTL and are never served stale or written to disk.
- **Optional on-device cache:** up to 160 public root manifest/catalog/meta responses in IndexedDB. Query-bearing URLs and configured-prefix paths are not persisted. No video bytes, subtitle responses or stream links are stored there. Denied/private-mode storage falls back to RAM. Requests wait at most 120 ms for initial hydration before using the network; a particularly slow disk can therefore produce a cache miss. Use **Add-ons → Clear request cache** to clear it.
- **Real deadlines:** response-body parsing is covered by the request deadline, not just response headers. No automatic multi-attempt JSON retry storm; manual Retry bypasses host cooldown. The existing circuit breaker still skips repeatedly failing hosts for 45 seconds.
- **Local HLS dependency:** hls.js 1.5.17 is pinned, licensed and bundled, loaded only for HLS playback. No render-blocking HLS CDN request at startup. HLS starts at a low adaptive level and can ramp up; shorter manifest timeouts enable earlier failover.
- **Startup recovery:** a source with no playable data after ten visible-tab seconds enters fallback recovery. Alternative direct sources are tried before public proxy chains; a configured worker still gets one chance first. Closing/changing titles cancels stale UI playback results.
- **Independent startup:** optional remote profile sync no longer blocks manifest revalidation. The add-ons page exposes actual cache/queue counters, not promised download speeds.

Third-party server latency, source authorization, codec support, CORS and network bandwidth still determine real playback performance. This does not add torrent-to-browser conversion or make unsupported/dead add-ons work.

## Profiles, playback intelligence and privacy (v3.2)

- **Your space:** use the avatar → Profiles & sync. Up to eight on-device profiles keep separate libraries, native-player progress, add-ons and preferences. Data now survives reloads in localStorage; denied/quota-exhausted storage falls back to a temporary session. These are not password-protected accounts.
- **No shared cloud account:** legacy shared/weak codes are disconnected, not queried. Private cloud sync is opt-in; the included worker/D1 backend uses random 256-bit bearer secrets in Authorization headers, hashed database identifiers, no profile enumeration, exact-origin CORS and atomic revision checks. Dirty offline edits survive reload; cloud conflicts stop automatic uploads. Explicit download replaces the active snapshot—export first. No end-to-end encryption, secret recovery or cloud deletion UI is claimed.
- **Observed source ranking:** native-player first-frame latency, actual failures and buffer waits are measured locally by origin. Repeated failures get a five-minute ranking penalty; stable ordering preserves normal quality hints for unknown sources. This does not measure iframe players or guarantee the fastest source.
- **Health centre:** session provider responses, measured response latency, request queue/cache counters and targeted manifest Retry. A manifest response is not a stream playback test. Browser failures stay labelled network-or-CORS when the cause cannot be known.
- **Playback preferences:** auto-resume, next-episode autoplay/countdown, preferred subtitle language/off/size, bounded saved per-title subtitle offsets and opt-in arrow-key TV focus navigation. Episode navigation uses real supplied metadata, not fabricated episodes. External iframes have their own preferences; TV mode is not a dedicated TV app.
- **Private by default:** public playback proxies require explicit opt-in. Add-on installation shows an origin/capability consent prompt (not a verification badge). Local files are not uploaded.
- **Support safely:** Health centre → Download safe diagnostics exports allowlisted aggregate counters without URLs, origins, names, history, tokens or raw errors. Profiles → library backup is a **separate private export** and can contain configured add-on credentials. Sync secrets are excluded from both exports.

Optional cloud features are code-ready, **not provisioned or deployed**. Follow [worker setup](worker/README.md), configure operator quotas/rate limits/retention and smoke-test before offering hosting. Read [SECURITY.md](SECURITY.md) for trust boundaries and legacy proxy limitations.

## Project readiness and licensing

See [CONTRIBUTING.md](CONTRIBUTING.md), [supported add-on API](docs/ADDON-API.md), [ROADMAP.md](ROADMAP.md), and [release instructions](docs/RELEASING.md). CI runs syntax, unit/browser tests, dependency audit, pinned-bundle checks and deterministic release packaging. A separate manual workflow builds artifacts; neither workflow deploys or publishes a release automatically.

**License:** original project code is licensed under **GNU GPL version 3 only (`GPL-3.0-only`)**, without warranty. See [LICENSE](LICENSE) and [license scope / third-party notices](LICENSE-DECISION.md). Bundled hls.js remains Apache-2.0; promotional artwork and third-party content are not relicensed under GPL. Review asset/contribution rights before redistribution.

## Tests

```sh
npm install
npx playwright install chromium
npm test
```

Use Node.js 22.13+ (Node 24 recommended; SQLite tests use `node:sqlite`) and Python 3. `npm test` runs syntax checks, **22 unit tests** (engine, profiles/diagnostics and SQLite-backed sync) and **24 Playwright browser tests**. Run individual suites with `npm run test:unit` or `npm run test:browser`.

Engine tests cover single-flight sharing, stale revalidation, short stream expiry, body timeout aborts, priority reservations, invalid responses, cache clearing and progressive collection. Browser tests cover the original desktop/mobile UI and real local media playback, plus controlled fast/blocked provider races, metadata racing, incremental manifest availability, reload persistence, local HLS library loading, cancelled playback results, hung-source failover and denied-storage fallback.

External requests are blocked or mocked for reproducibility. These tests do **not** benchmark public providers, verify remote HLS delivery, or guarantee third-party add-on/iframe uptime. Local video tests play a real synthetic WebM fixture; the HLS test verifies local library loading, not a real third-party HLS stream.

To refresh the checked-in HLS bundle after deliberately updating its pinned dependency, run `npm run vendor:hls` and rerun the tests.

`tests/fixtures/sample.webm` is a tiny generated, silent, solid-color 24-second video for real media tests, not movie content. Set `TEST_VIDEO` to use a different compatible local fixture. To use an already-installed Chromium, set `CHROMIUM_PATH`.

## Files

- `index.html`: existing application/catalog/playback engine, plus cinema integration and player fixes.
- `cinema.css`: responsive cinema shell and player styles.
- `cinema.js`: navigation, local-file picker, player actions, shortcuts/help, focus behavior and request counters.
- `addon-engine.js`: priority scheduler, in-flight coalescing, endpoint cache policies, optional IndexedDB cache and progressive collection.
- `platform-core.js` / `platform-ui.js`: local profiles, observed source ranking, health/preferences UI and allowlisted diagnostics.
- `worker/`: optional media worker and private-sync module/D1 migration; see its README for setup.
- `assets/README.md`: artwork attribution.

Only use streams and add-ons for content you are authorized to watch. Catalog artwork belongs to the respective rights holders. The app does not include or host the films or series displayed in its catalog.
