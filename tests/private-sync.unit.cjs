const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { DatabaseSync } = require("node:sqlite");
const secret = "a".repeat(64),
  other = "b".repeat(64);
async function setup() {
  const { handleSync } = await import("../worker/sync.mjs");
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(
    fs.readFileSync("worker/migrations/0001_private_sync.sql", "utf8"),
  );
  const DB = {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              return sqlite.prepare(sql).get(...args) || null;
            },
          };
        },
      };
    },
  };
  const env = { DB, SYNC_ALLOWED_ORIGINS: "https://app.test" };
  const call = (method = "GET", token = secret, options = {}) =>
    handleSync(
      new Request(options.url || "https://worker.test/api/sync", {
        method,
        headers: {
          Origin: "https://app.test",
          Authorization: "Bearer " + token,
          ...(method === "PUT"
            ? { "Content-Type": "application/json", "If-Match": "0" }
            : {}),
          ...options.headers,
        },
        body: options.body,
      }),
      env,
    );
  return { call, sqlite, env, handleSync };
}
test("private sync isolates tokens and stores only their SHA-256 identifiers", async () => {
  const { call, sqlite } = await setup();
  const saved = await call("PUT", secret, {
    body: JSON.stringify({
      data: { se_list: [{ id: "one" }], se_sync_code: "must-not-store" },
    }),
  });
  assert.equal(saved.status, 200);
  const body = await (await call()).json();
  assert.equal(body.revision, 1);
  assert.equal(body.data.se_list[0].id, "one");
  assert.equal(body.data.se_sync_code, undefined);
  assert.equal((await (await call("GET", other)).json()).revision, 0);
  const row = sqlite.prepare("SELECT * FROM sync_profiles").get();
  assert.notEqual(row.id, secret);
  assert.ok(!JSON.stringify(row).includes(secret));
  sqlite.close();
});
test("revision checks reject lost updates including stale creation and nonexistent revisions", async () => {
  const { call, sqlite } = await setup();
  const data = JSON.stringify({ data: { se_theme: "stremio" } });
  assert.equal((await call("PUT", secret, { body: data })).status, 200);
  assert.equal((await call("PUT", secret, { body: data })).status, 409);
  assert.equal(
    (await call("PUT", secret, { headers: { "If-Match": "1" }, body: data }))
      .status,
    200,
  );
  assert.equal(
    (await call("PUT", other, { headers: { "If-Match": "5" }, body: data }))
      .status,
    409,
  );
  sqlite.close();
});
test("weak tokens, query secrets, disallowed origins and malformed requests are rejected", async () => {
  const { call, sqlite } = await setup();
  assert.equal((await call("GET", "streameo_d1_main")).status, 401);
  assert.equal(
    (
      await call("GET", secret, {
        url: "https://worker.test/api/sync?code=" + secret,
      })
    ).status,
    400,
  );
  assert.equal(
    (await call("GET", secret, { headers: { Origin: "https://evil.test" } }))
      .status,
    403,
  );
  assert.equal((await call("PUT", secret, { body: "broken" })).status, 400);
  assert.equal(
    (await call("PUT", secret, { headers: { "If-Match": "" }, body: "{}" }))
      .status,
    428,
  );
  assert.equal(
    (await call("PUT", secret, { body: "x".repeat(262145) })).status,
    413,
  );
  sqlite.close();
});
test("health never enumerates profiles; absent database fails closed", async () => {
  const { call, sqlite, handleSync } = await setup();
  const body = await (
    await call("GET", secret, { url: "https://worker.test/api/sync/health" })
  ).json();
  assert.equal(body.service, "streameo-private-sync");
  assert.equal(body.profiles, undefined);
  const response = await handleSync(
    new Request("https://worker.test/api/sync", {
      headers: { Authorization: "Bearer " + secret },
    }),
    {},
  );
  assert.equal(response.status, 503);
  sqlite.close();
});
