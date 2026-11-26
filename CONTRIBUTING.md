# Contributing

## Before contributing

Original project code is licensed under **GPL-3.0-only**; see [LICENSE](LICENSE) and [license scope / third-party notices](LICENSE-DECISION.md). Submit changes only if you have the rights to contribute them under these terms. Third-party dependencies and artwork retain their own licenses/rights; do not include them as GPL-covered code without appropriate permission.

## Local workflow

1. Install Node.js 24 (tests use `node:sqlite`) and Python 3.
2. Run `npm ci`, `npx playwright install --with-deps chromium`, and `npm run dev`.
3. Make small changes with regression tests. The app is static: no production bundler.
4. Run `npm test`, `npm audit --audit-level=high`, and `git diff --check`.
5. Run `npm run release:package` to check packaging; never commit `release/`.

For a preinstalled browser, use `CHROMIUM_PATH=/path/to/chromium npm test`. Browser tests mock/block external providers: never rely on a public server's uptime. Do not add real tokens, private media URLs, user watch history, copyrighted films, or captured provider snapshots to fixtures/issues. Synthetic media fixtures are preferred.

## Pull requests

Explain the problem, observable behavior, tests and limitations. Include desktop/mobile screenshots for visual changes. Preserve keyboard, reduced-motion and denied-storage behavior. Keep browser calls relative or explicitly user-configured HTTPS; no hard-coded localhost backend in deployed code. Never introduce a shared cloud profile, credential-in-query API, provider enumeration, unbounded fan-out or automatic retry storms.

New add-ons need capability validation and user consent. Document endpoints with [the supported API](docs/ADDON-API.md). Only propose lawful, authorized integrations; provider count is not a quality metric. Do not promise that CORS, codecs, external players or third-party servers always work.

## Releases

Update `package.json`/lock, `APP_BUILD` in `index.html`, `version.json`, and `VER` in `sw.js` together. Cache the new local shell files, but never cache private sync responses. Refresh pinned HLS with `npm run vendor:hls`; preserve its license. The packaging workflow creates downloadable artifacts, not an automatic public release or deployment. See [release instructions](docs/RELEASING.md).
