# StreamEo Cinema

A static, Stremio-inspired personal cinema. Existing catalog, add-on, direct-stream, HLS, subtitle and external-player integrations are preserved. No framework or production build is required.

## Run

```sh
npm install
npm run dev
```

Open `http://localhost:3000`. The server binds to `0.0.0.0` for hosted previews. Alternatively, serve this directory with any static web server. Deploy the root directory (including `cinema.css`, `cinema.js`, `assets`, `manifest.json`, `icon.svg`, and `sw.js`) to your static host.

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

## Tests

```sh
npm run test:syntax
npx playwright install chromium
npm test
```

The five browser tests cover offline discovery/filtering, watchlist navigation, search/help, mobile overflow/navigation, and actual local video playback on desktop and mobile, including seeking, settings, fullscreen on desktop, mini-player and cleanup. External requests are blocked during these tests for reproducibility; they do **not** verify third-party add-on availability, remote HLS playback, cross-origin embeds or provider uptime.

`tests/fixtures/sample.webm` is a tiny generated, silent, solid-color 24-second video for real media tests, not movie content. Set `TEST_VIDEO` to use a different compatible local fixture. To use an already-installed Chromium, set `CHROMIUM_PATH`.

## Files

- `index.html`: existing application/catalog/playback engine, plus cinema integration and player fixes.
- `cinema.css`: responsive cinema shell and player styles.
- `cinema.js`: navigation, local-file picker, player actions, shortcuts/help and focus behavior.
- `worker/`: existing optional Cloudflare Worker; see its README for setup.
- `assets/README.md`: artwork attribution.

Only use streams and add-ons for content you are authorized to watch. Catalog artwork belongs to the respective rights holders. The app does not include or host the films or series displayed in its catalog.
