# Catalog artwork

Bundled seed artwork keeps the discovery screen useful if an add-on or image CDN is unavailable. All titles retain their real IMDb identifiers. Posters and promotional artwork belong to the respective film/TV studios; inclusion is for catalog identification, not a claim of ownership or a license to stream a title.

Sources retrieved through GitHub:
- `dune-backdrop.jpg`: https://github.com/RamonSFR/dune2LandingPageClone/blob/main/src/images/home/home_bg_desktop.jpg . `tt15239678.jpg` is a portrait crop of this artwork.
- Interstellar, Inception, The Dark Knight, The Matrix, John Wick: corresponding IMDb-named images in https://github.com/laxmimerit/Movies-Poster_Dataset/tree/master/Images
- The Umbrella Academy, Pokémon, Breaking Bad, House, Supernatural, Smallville: `mini1`, `mini3`, `mini6`, `mini7`, `mini8`, `mini9` respectively from https://github.com/felipeAguiarCode/netflix-clone/tree/master/img

The remaining catalog artwork is fetched from the existing add-ons/image providers at runtime. A title listing does not imply an available or authorized playable source.

## Playback dependency

`hls.min.js` is the pinned hls.js 1.5.17 browser bundle from https://github.com/video-dev/hls.js (Apache-2.0). Its complete license is included in `HLS-LICENSE.txt`. It is loaded on demand from the same origin. Rebuild this vendored copy with `npm run vendor:hls`.

## License scope

The root GPL-3.0-only license covers original project code, not these film/TV posters or backdrops. No artwork rights are granted by that code license. Preserve the separate hls.js Apache-2.0 notice and review artwork permissions before redistribution.
