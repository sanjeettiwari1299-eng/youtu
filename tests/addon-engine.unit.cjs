const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createClient, collect, policyFor } = require("../addon-engine.js");
const tick = () => new Promise((resolve) => setImmediate(resolve));
const response = (data) => ({
  ok: true,
  text: async () => JSON.stringify(data),
});
function deferred() {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
}

test("single-flight coalesces duplicate requests and shares failures safely", async () => {
  let calls = 0;
  const gate = deferred();
  const client = createClient({
    persistence: false,
    fetch: async () => {
      calls++;
      await gate.promise;
      return response({ metas: [] });
    },
  });
  const url = "https://addon.test/catalog/movie/popular.json";
  const requests = [
    client.request(url),
    client.request(url),
    client.request(url),
  ];
  await tick();
  assert.equal(calls, 1);
  gate.resolve();
  await Promise.all(requests);
  await client.request(url);
  assert.equal(calls, 1);
  assert.equal(client.snapshot().shared, 2);
  assert.equal(client.snapshot().hits, 1);
  let failures = 0;
  const broken = createClient({
    persistence: false,
    fetch: async () => {
      failures++;
      throw new Error("offline");
    },
  });
  await Promise.allSettled([broken.request(url), broken.request(url)]);
  await assert.rejects(broken.request(url));
  assert.equal(failures, 2);
  assert.equal(broken.snapshot().active, 0);
});

test("stale catalog returns immediately while one revalidation updates it", async () => {
  let time = 0,
    calls = 0;
  const gate = deferred();
  const client = createClient({
    persistence: false,
    now: () => time,
    fetch: async () => {
      calls++;
      if (calls > 1) await gate.promise;
      return response({ version: calls });
    },
  });
  const url = "https://addon.test/catalog/movie/popular.json";
  assert.equal((await client.request(url)).version, 1);
  time = policyFor(url).ttl + 1;
  assert.equal((await client.request(url)).version, 1);
  assert.equal((await client.request(url)).version, 1);
  await tick();
  assert.equal(calls, 2);
  gate.resolve();
  await tick();
  await tick();
  assert.equal((await client.request(url)).version, 2);
});

test("stream URLs expire quickly and are never served stale", async () => {
  let time = 0,
    calls = 0;
  const client = createClient({
    persistence: false,
    now: () => time,
    fetch: async () =>
      response({ streams: [{ url: "https://video.test/" + ++calls }] }),
  });
  const url = "https://addon.test/stream/movie/tt123.json";
  await client.request(url);
  time = 20001;
  const data = await client.request(url);
  assert.equal(calls, 2);
  assert.equal(data.streams[0].url, "https://video.test/2");
  assert.equal(policyFor(url).persist, false);
  assert.equal(policyFor(url).stale, 0);
});

test("a hanging response body is aborted and its scheduler slot released", async () => {
  let signal;
  const client = createClient({
    persistence: false,
    fetch: async (_, opts) => {
      signal = opts.signal;
      return { ok: true, text: () => new Promise(() => {}) };
    },
  });
  await assert.rejects(
    client.request("https://hung.test/meta/movie/tt1.json", { timeoutMs: 25 }),
    /timed out/,
  );
  assert.equal(signal.aborted, true);
  assert.equal(client.snapshot().active, 0);
});

test("background catalog fan-out leaves capacity for playback", async () => {
  const gate = deferred(),
    started = [];
  const client = createClient({
    persistence: false,
    fetch: async (url) => {
      started.push(url);
      if (url.includes("/catalog/")) await gate.promise;
      return response({ ok: true });
    },
  });
  const jobs = Array.from({ length: 10 }, (_, i) =>
    client.request(
      `https://host${Math.floor(i / 2)}.test/catalog/movie/${i}.json`,
    ),
  );
  await tick();
  assert.equal(client.snapshot().active, 6);
  assert.equal(client.snapshot().queued, 4);
  await client.request("https://host0.test/stream/movie/tt1.json");
  assert.equal(started.filter((x) => x.includes("/stream/")).length, 1);
  gate.resolve();
  await Promise.all(jobs);
  assert.equal(client.snapshot().active, 0);
});

test("invalid JSON and HTTP failures are not cached or retried automatically", async () => {
  for (const bad of [
    { ok: false, status: 404 },
    { ok: true, text: async () => "<html>blocked</html>" },
    { ok: true, text: async () => "{broken" },
    { ok: true, text: async () => '{"error":"down"}' },
  ]) {
    let calls = 0;
    const client = createClient({
      persistence: false,
      fetch: async () => {
        calls++;
        return bad;
      },
    });
    await assert.rejects(client.request("https://bad.test/manifest.json"));
    assert.equal(calls, 1);
    assert.equal(client.snapshot().cached, 0);
  }
});

test("clearing cache while a response is in flight cannot resurrect that entry", async () => {
  const gate = deferred();
  let calls = 0;
  const client = createClient({
    persistence: false,
    fetch: async () => {
      calls++;
      await gate.promise;
      return response({ metas: [] });
    },
  });
  const job = client.request("https://addon.test/catalog/movie/popular.json");
  await tick();
  client.clear();
  gate.resolve();
  await job;
  assert.equal(client.snapshot().cached, 0);
  await client.request("https://addon.test/catalog/movie/popular.json");
  assert.equal(calls, 2);
});

test("fast collection starts on useful result while late providers keep publishing", async () => {
  const gate = deferred(),
    updates = [];
  const first = await collect(
    [
      async () => ({ name: "fast" }),
      async () => {
        await gate.promise;
        return { name: "slow" };
      },
      async () => {
        throw Error("down");
      },
    ],
    { firstUseful: (v) => v.name === "fast", onUpdate: (v) => updates.push(v) },
  );
  assert.deepEqual(first, [{ name: "fast" }]);
  gate.resolve();
  await tick();
  assert.deepEqual(updates.at(-1), [{ name: "fast" }, { name: "slow" }]);
});

test("empty collections finish immediately and discovery has a bounded budget", async () => {
  assert.deepEqual(
    await collect([], { firstUseful: () => true, waitMs: 20 }),
    [],
  );
  assert.deepEqual(
    await collect([() => new Promise(() => {})], {
      firstUseful: () => true,
      waitMs: 20,
    }),
    [],
  );
});

test("metadata prefetch also reserves a slot for a new playback request", async () => {
  const gate = deferred();
  const client = createClient({
    persistence: false,
    fetch: async (url) => {
      if (url.includes("/meta/")) await gate.promise;
      return response({ ok: true });
    },
  });
  const jobs = Array.from({ length: 8 }, (_, i) =>
    client.request(`https://meta${i}.test/meta/movie/tt1.json`),
  );
  await tick();
  assert.equal(client.snapshot().active, 7);
  await client.request("https://meta0.test/stream/movie/tt1.json");
  gate.resolve();
  await Promise.all(jobs);
  assert.equal(client.snapshot().active, 0);
});
