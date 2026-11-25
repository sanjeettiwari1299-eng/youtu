const fs = require("node:fs");
const vm = require("node:vm");
const html = fs.readFileSync("index.html", "utf8");
for (const [i, match] of [
  ...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g),
].entries())
  new vm.Script(match[1], { filename: `index-inline-${i}.js` });
for (const path of ["cinema.js", "sw.js"])
  new vm.Script(fs.readFileSync(path, "utf8"), { filename: path });
console.log("All frontend scripts parse successfully.");
