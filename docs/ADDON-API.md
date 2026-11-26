# Supported HTTP add-on subset

This client supports a pragmatic Stremio-style JSON subset, not every protocol feature. Serve HTTPS JSON with browser-readable CORS headers. Only install providers you trust and have rights to use. A manifest/catalog is metadata, not evidence of an authorized playable source.

## Manifest

`GET /manifest.json`

```json
{
  "id": "org.example.authorized-library",
  "name": "My authorized library",
  "version": "1.0.0",
  "types": ["movie", "series"],
  "resources": ["catalog", "meta", "stream", "subtitles"],
  "catalogs": [{"type": "movie", "id": "library", "name": "Library"}]
}
```

`id` and `name` are strings limited to 200 characters, `resources` is an array (up to 20) of names or objects with a `name`, and optional catalogs are an array (up to 100) with string `id`/`type`. Resource objects can supply `types`/`idPrefixes`; catalogs may declare `extra` options such as `search`, `genre`, `skip`. Validation is structural, not a trust/security certification. The install confirmation shows name, origin and capabilities. Configured-prefix manifests are supported but URLs with tokens must be treated as secrets.

## Endpoints

| Request | Response shape |
| --- | --- |
| `/catalog/{type}/{catalogId}.json` | `{"metas":[{"id":"local:1","type":"movie","name":"My film","poster":"https://…"}]}` |
| `/catalog/{type}/{catalogId}/search={encoded}.json` | same shape, if `search` extra is advertised |
| `/meta/{type}/{id}.json` | `{"meta":{"id":"local:1","type":"movie","name":"My film"}}` |
| `/stream/{type}/{videoId}.json` | `{"streams":[{"name":"Library","title":"720p","url":"https://media.example/authorized.mp4"}]}` |
| `/subtitles/{type}/{id}.json` | `{"subtitles":[{"id":"en","lang":"en","url":"https://media.example/authorized.vtt"}]}` |

Metadata can contain `videos` with actual `id`, `season`, `episode`, `title` for series. The client does not fabricate episode lists. A subtitle retry may request `/subtitles/{type}/{id}/videoId={encoded}.json`. Video IDs are URL-encoded; `:` separates conventional episode IDs (`seriesId:season:episode`).

Native playback supports browser-compatible direct HTTP(S) video and HLS through native support or pinned local hls.js. Codec support still varies. External browser/YouTube links have separate controls. Torrent/infoHash transport, DRM/license acquisition and universal transcoding are **not** implemented by this client or proxy.

## Scheduling, cache and health

Eight global/three per-host active JSON requests at most; lower-priority traffic has reserved-slot limits. Typical stream/meta/manifest deadlines are 4/3.5/4.5 seconds, including JSON body parsing; queued work is bounded. Successful provider results appear progressively. Manual Retry bypasses host cooldown and refreshes that provider; automatic retry storms are avoided.

Streams: 20-second RAM TTL, never stale/disk. Manifests/meta/catalogs have bounded longer cache windows; only public root endpoints without query/configuration prefixes are eligible for IndexedDB. No video bytes are cached by the JSON engine. Network failures are shown as network-or-CORS when the browser cannot distinguish them. Playback ranking observes origin-level real startup, failures and buffering; it is heuristic, not a verification badge.

Tests must use synthetic local/mocked responses, not production tokens or copyrighted media. See `tests/addon-performance.spec.cjs` for reproducible progressive/blocked-provider fixtures.
