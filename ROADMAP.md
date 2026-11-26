# Public roadmap

## Implemented in this working tree (v3.2)

- Bounded priority scheduler, request deduplication, progressive provider results and endpoint-specific cache.
- Native-player startup/failure/buffer observations; stable origin-level source ranking and failure cooldown penalty.
- Up to eight isolated local profiles with library/progress/preferences, local-only default and private backups.
- Optional private-sync worker + D1 migration, bearer secrets, hashed identifiers and optimistic concurrency.
- Provider health UI, measured response times, targeted manifest retry and honest network/CORS uncertainty.
- Resume/autoplay/countdown/subtitle-language/size preferences, bounded per-title subtitle offsets and opt-in TV focus navigation.
- Allowlisted diagnostic downloads, opt-in public proxies and capability consent on provider install.
- CI, contribution/security/API docs and deterministic release artifacts.

## Required before public launch

- Review contribution/artwork rights for redistribution; the owner has selected GPL-3.0-only for original project code.
- Operator deploys/tests optional D1 sync, configures allowed origins/rate limits/retention, and establishes private security reporting.
- Exercise real authorized HLS/MP4, mobile Safari, TV remotes, varied bandwidth and codec combinations. Current browser suite uses Chromium and synthetic/mock services.
- Audit existing third-party provider/iframe integrations for authorization, privacy, branding and claims. No new unofficial mirrors are a launch goal.

## Next milestones (not implemented / no promised dates)

1. Source health decay/confidence, per-device ranking and quality selection informed by real measurements, not resolution labels alone.
2. Sync conflict preview/merge, cloud deletion UI, optional end-to-end encryption and authenticated hosting with resource quotas.
3. Audio/subtitle language normalization across HLS/browser tracks, per-profile audio delay where supported and real provider-supplied intro markers.
4. Dedicated TV screen/roving grid focus, screen-reader audit and Firefox/WebKit/device coverage.
5. Extract inline SPA into tested modules, tighten CSP, pin action SHAs and obtain independent security review.
6. Fully rights-cleared demo assets, documented authorized sample add-on and community governance under the selected GPL-3.0-only license.

“World's best” and guaranteed third-party uptime are not testable release claims. Track regressions using reproducible fixtures and opt-in, privacy-reviewed measurements.
