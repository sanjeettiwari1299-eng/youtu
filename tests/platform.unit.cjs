const { test } = require("node:test");
const assert = require("node:assert/strict");
const Core = require("../platform-core.js");
function storage() {
  const data = new Map();
  return {
    getItem: (k) => data.get(k) || null,
    setItem: (k, v) => data.set(k, v),
  };
}
test("local profiles isolate data, persist selection, and enforce deletion safeguards", () => {
  const disk = storage();
  let n = 0;
  const p = Core.createProfiles({ storage: disk, id: () => String(++n) });
  const first = p.current().id;
  p.set("se_list", [{ id: "personal" }]);
  const other = p.create("<Family>");
  p.switch(other);
  assert.deepEqual(p.current().data, {});
  p.set("se_list", [{ id: "family" }]);
  p.switch(first);
  assert.equal(p.current().data.se_list[0].id, "personal");
  const restored = Core.createProfiles({
    storage: disk,
    id: () => String(++n),
  });
  assert.equal(restored.current().id, first);
  assert.throws(() => restored.remove(first));
  restored.remove(other);
  assert.throws(() => restored.remove(first));
});
test("denied local storage gracefully stays in memory", () => {
  const p = Core.createProfiles({
    storage: {
      getItem() {
        throw Error("denied");
      },
      setItem() {
        throw Error("denied");
      },
    },
    id: () => "test",
  });
  p.set("se_theme", "stremio");
  assert.equal(p.current().data.se_theme, "stremio");
  assert.equal(p.available(), false);
});
test("sync secrets use 256 bits of secure randomness and shared/weak credentials are rejected", () => {
  const a = Core.secret(),
    b = Core.secret();
  assert.equal(Core.validSecret(a), true);
  assert.notEqual(a, b);
  assert.equal(Core.validSecret("streameo_d1_main"), false);
  assert.equal(Core.validSecret("abcdef"), false);
  assert.throws(() => Core.secret({}));
});
test("source observations demote failures and reward real startup performance", () => {
  let now = 0;
  const m = Core.createMonitor({ now: () => now });
  for (let i = 0; i < 3; i++) {
    const ticket = m.begin("https://bad.test/video?token=secret");
    m.failure(ticket);
    m.failure(ticket);
  }
  const fast = m.begin("https://fast.test/video");
  now = 500;
  m.playing(fast);
  const ranked = m.rank([
    { url: "https://bad.test/other" },
    { url: "https://unknown.test/a" },
    { url: "https://fast.test/next" },
  ]);
  assert.equal(ranked[0].url, "https://fast.test/next");
  assert.equal(ranked.at(-1).url, "https://bad.test/other");
  assert.equal(m.summary().failedAttempts, 3);
});
test("buffer observations exclude pauses and deduplicate first-frame starts", () => {
  let now = 0,
    saved;
  const m = Core.createMonitor({ now: () => now, write: (v) => (saved = v) });
  const ticket = m.begin("https://media.test/file?token=never-store");
  now = 100;
  m.playing(ticket);
  m.waiting(ticket);
  now = 300;
  m.pause(ticket);
  now = 1000;
  m.playing(ticket);
  assert.equal(saved["https://media.test"].bufferMs, 0);
  m.waiting(ticket);
  now = 1500;
  m.playing(ticket);
  assert.equal(saved["https://media.test"].bufferMs, 500);
  assert.equal(saved["https://media.test"].samples, 1);
  assert.ok(!JSON.stringify(saved).includes("never-store"));
});
test("diagnostics allowlist excludes secret URLs, titles, raw errors and profile data", () => {
  const secret = "SUPER_PRIVATE_TOKEN";
  const report = Core.diagnostics({
    build: "v3.2-platform",
    queue: { network: 3, secret },
    providers: [
      {
        origin: "https://" + secret + ".test",
        name: secret,
        status: secret,
        requests: 1,
        error: secret,
      },
    ],
    playback: { observedOrigins: 1, title: secret },
    profile: secret,
    history: [secret],
  });
  assert.ok(!JSON.stringify(report).includes(secret));
  assert.equal(report.providers[0].provider, "Provider 1");
  assert.equal(report.providers[0].status, "unobserved");
});
test("backup validation ignores credentials, invalid preferences and malformed library data", () => {
  const data = Core.validateSnapshot({
    se_sync_code: Core.secret(),
    se_list: [{ id: "okay" }, null, 3],
    se_progress: { good: { t: 5, d: 10 }, bad: { t: -1, d: 10 } },
    se_autoplay_next: "yes",
    se_next_delay: -9,
    se_sub_lang: "<script>",
    se_theme: "stremio",
    se_addons: ["javascript:alert(1)", "https://public.test/manifest.json"],
  });
  assert.equal(data.se_sync_code, undefined);
  assert.equal(data.se_autoplay_next, undefined);
  assert.equal(data.se_next_delay, undefined);
  assert.equal(data.se_list.length, 1);
  assert.deepEqual(Object.keys(data.se_progress), ["good"]);
  assert.equal(data.se_theme, "stremio");
  assert.deepEqual(data.se_addons, ["https://public.test/manifest.json"]);
});
test("imported library records cannot smuggle navigation attributes or executable URLs", () => {
  const data = Core.validateSnapshot({
    se_list: [
      {
        id: "x",
        name: "Example",
        link: "javascript:alert(1)",
        poster: "javascript:alert(1)",
        arbitrary: "private",
      },
    ],
    se_progress: {
      x: {
        t: 1,
        d: 2,
        link: '#/detail/movie/x" onclick="alert(1)',
        name: "Movie",
      },
    },
  });
  assert.equal(data.se_list[0].link, undefined);
  assert.equal(data.se_list[0].poster, undefined);
  assert.equal(data.se_list[0].arbitrary, undefined);
  assert.equal(data.se_progress.x.link, undefined);
  assert.equal(data.se_progress.x.name, "Movie");
});
