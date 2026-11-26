const fs = require("node:fs");
const vm = require("node:vm");
const html = fs.readFileSync("index.html", "utf8");
for (const [i, match] of [
  ...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g),
].entries())
  new vm.Script(match[1], { filename: `index-inline-${i}.js` });
for (const path of [
  "cinema.js",
  "addon-engine.js",
  "platform-core.js",
  "platform-ui.js",
  "sw.js",
])
  new vm.Script(fs.readFileSync(path, "utf8"), { filename: path });
const { spawnSync } = require("node:child_process");
for (const path of ["worker/worker.js", "worker/sync.mjs"]) {
  const result = spawnSync(process.execPath, ["--check", path], {
    encoding: "utf8",
  });
  if (result.status !== 0)
    throw new Error(result.stderr || "Worker syntax failed");
}
console.log("Frontend and worker scripts parse successfully.");
