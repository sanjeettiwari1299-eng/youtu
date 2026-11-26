// Keep the browser bundle in sync with the pinned npm dependency.
const fs = require("node:fs");
const path = require("node:path");
const dist = path.dirname(require.resolve("hls.js"));
fs.mkdirSync("assets", { recursive: true });
fs.writeFileSync(
  "assets/hls.min.js",
  fs
    .readFileSync(path.join(dist, "hls.min.js"), "utf8")
    .replace(/\/\/# sourceMappingURL=.*$/m, ""),
);
fs.copyFileSync(path.join(dist, "..", "LICENSE"), "assets/HLS-LICENSE.txt");
console.log("Vendored hls.js with its license.");
