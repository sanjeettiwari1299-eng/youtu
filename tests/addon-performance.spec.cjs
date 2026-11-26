const { test, expect } = require("@playwright/test");
const source = "http://127.0.0.1:3000/tests/fixtures/sample.webm";
const json = (route, body) =>
  route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify(body),
  });
const gate = () => {
  let release;
  const promise = new Promise((r) => (release = r));
  return { promise, release };
};
async function providers(page, resources, bases) {
  await page.evaluate(
    ({ resources, bases }) => {
      S._revSeq++;
      S.loading = false;
      S.addons = bases.map((base, i) => ({
        base,
        manifest: {
          id: "test." + i,
          name: "Provider " + i,
          version: "1.0.0",
          resources,
          types: ["movie"],
          catalogs: [],
        },
      }));
    },
    { resources, bases },
  );
}

test.beforeEach(async ({ page }) => {
  await page.route("**/*", (r) =>
    r.request().url().startsWith("http://127.0.0.1:3000/")
      ? r.continue()
      : r.abort(),
  );
  await page.goto("/");
  await expect(page.locator("#heroBox")).toBeVisible();
});

test("first playable provider starts without waiting for the blocked provider; late links join fallback list", async ({
  page,
}) => {
  const blocked = gate();
  let slowStarted = false;
  await page.route("https://fast.test/**", (r) =>
    json(r, { streams: [{ url: source, title: "720p direct" }] }),
  );
  await page.route("https://slow.test/**", async (r) => {
    slowStarted = true;
    await blocked.promise;
    await json(r, {
      streams: [{ url: source + "?backup=1", title: "1080p backup" }],
    });
  });
  await providers(page, ["stream"], ["https://slow.test", "https://fast.test"]);
  await page.evaluate(() =>
    instantPlay({
      id: "tt1375666",
      type: "movie",
      name: "Fast discovery test",
    }),
  );
  await expect(page.locator("#npVideo")).toBeVisible();
  await expect
    .poll(() => page.locator("#npVideo").evaluate((v) => v.readyState))
    .toBeGreaterThanOrEqual(2);
  expect(slowStarted).toBe(true);
  expect(await page.evaluate(() => S.current.sources.length)).toBe(1);
  blocked.release();
  await expect
    .poll(() => page.evaluate(() => S.current.sources.length))
    .toBe(2);
  await expect(page.locator("#playerTitle")).toHaveText("Fast discovery test");
});

test("metadata races providers instead of waiting through them sequentially", async ({
  page,
}) => {
  const blocked = gate();
  await page.route("https://slow-meta.test/**", async (r) => {
    await blocked.promise;
    await json(r, { meta: { id: "tt1375666", name: "Late metadata" } });
  });
  await page.route("https://fast-meta.test/**", (r) =>
    json(r, { meta: { id: "tt1375666", name: "Fast metadata" } }),
  );
  await providers(
    page,
    ["meta"],
    ["https://slow-meta.test", "https://fast-meta.test"],
  );
  const name = await page.evaluate(async () => {
    const result = await fetchMeta("movie", "tt1375666");
    return result.meta.name;
  });
  expect(name).toBe("Fast metadata");
  blocked.release();
});

test("an abandoned title request cannot replace the newer player", async ({
  page,
}) => {
  const blocked = gate();
  let requested = false;
  await page.route("https://playback.test/**", async (r) => {
    if (r.request().url().includes("tt11111")) {
      requested = true;
      await blocked.promise;
    }
    await json(r, { streams: [{ url: source, title: "Direct WebM" }] });
  });
  await providers(page, ["stream"], ["https://playback.test"]);
  await page.evaluate(() => {
    window.__oldPlayback = instantPlay({
      id: "tt11111",
      type: "movie",
      name: "Old title",
    });
  });
  await expect.poll(() => requested).toBe(true);
  await page.evaluate(() =>
    instantPlay({ id: "tt22222", type: "movie", name: "New title" }),
  );
  await expect(page.locator("#playerTitle")).toHaveText("New title");
  blocked.release();
  await page.evaluate(() => window.__oldPlayback);
  await expect(page.locator("#playerTitle")).toHaveText("New title");
  await expect(page.locator("#npVideo")).toBeVisible();
});

test("closing while discovery is pending does not reopen playback", async ({
  page,
}) => {
  const blocked = gate();
  let requested = false;
  await page.route("https://pending.test/**", async (r) => {
    requested = true;
    await blocked.promise;
    await json(r, { streams: [{ url: source }] });
  });
  await providers(page, ["stream"], ["https://pending.test"]);
  await page.evaluate(() => {
    window.__pendingPlayback = instantPlay({
      id: "tt11111",
      type: "movie",
      name: "Cancelled title",
    });
  });
  await expect.poll(() => requested).toBe(true);
  await page.locator("#playerClose").click();
  blocked.release();
  await page.evaluate(() => window.__pendingPlayback);
  await expect(page.locator("#player")).toBeHidden();
  await expect(page.locator("#playerStage")).toBeEmpty();
});

test("successful manifests become usable before a slow manifest completes", async ({
  page,
}) => {
  const blocked = gate();
  await page.route("https://ready.test/manifest.json", (r) =>
    json(r, {
      id: "ready",
      name: "Ready now",
      version: "1",
      resources: ["stream"],
      types: ["movie"],
      catalogs: [],
    }),
  );
  await page.route("https://waiting.test/manifest.json", async (r) => {
    await blocked.promise;
    await json(r, {
      id: "late",
      name: "Ready later",
      version: "1",
      resources: ["stream"],
      types: ["movie"],
      catalogs: [],
    });
  });
  await page.evaluate(() => {
    S.addons = [];
    store.set("se_addons", ["https://ready.test", "https://waiting.test"]);
    window.__registryUpdate = revalidateAddons();
  });
  await expect
    .poll(() =>
      page.evaluate(() =>
        S.addons.some((a) => a.manifest.name === "Ready now"),
      ),
    )
    .toBe(true);
  expect(
    await page.evaluate(() =>
      S.addons.some((a) => a.manifest.name === "Ready later"),
    ),
  ).toBe(false);
  blocked.release();
  await page.evaluate(() => window.__registryUpdate);
  expect(await page.evaluate(() => S.addons.length)).toBe(2);
});

test("public catalog JSON survives reload; HLS is local and loaded on demand", async ({
  page,
}) => {
  let requests = 0;
  await page.route("https://catalog.test/**", (r) => {
    requests++;
    return json(r, { metas: [{ id: "tt-test", name: "Persisted catalog" }] });
  });
  await page.evaluate(async () => {
    await addonClient.ready;
    await jget("https://catalog.test/catalog/movie/popular.json");
  });
  // Verify the write committed, rather than sleeping for an arbitrary disk delay.
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise((resolve) => {
            const open = indexedDB.open("streameo-addon-cache", 2);
            open.onsuccess = () => {
              const db = open.result;
              const read = db
                .transaction("json")
                .objectStore("json")
                .get("https://catalog.test/catalog/movie/popular.json");
              read.onsuccess = () => {
                resolve(!!read.result);
                db.close();
              };
            };
          }),
      ),
    )
    .toBe(true);
  await page.reload();
  await expect(page.locator("#heroBox")).toBeVisible();
  // This checks committed persistence, not a machine-specific disk deadline.
  // Ordinary requests wait at most 120ms for hydration, then can use network.
  const name = await page.evaluate(async () => {
    await addonClient.ready;
    return (await jget("https://catalog.test/catalog/movie/popular.json"))
      .metas[0].name;
  });
  expect(name).toBe("Persisted catalog");
  expect(requests).toBe(1);
  expect(await page.evaluate(() => typeof window.Hls)).toBe("undefined");
  await page.evaluate(() => loadHlsLibrary());
  expect(await page.evaluate(() => window.Hls.version)).toBe("1.5.17");
  await page.locator('.side-link[data-page="addons"]').click();
  await expect(page.locator("#engineStats")).toContainText("cache hits");
  await page.locator("#clearAddonCache").click();
  expect(await page.evaluate(() => addonClient.snapshot().cached)).toBe(0);
});

test("a source that never starts falls back without waiting through public proxies", async ({
  page,
}) => {
  const blocked = gate();
  await page.route("**/never-starts.webm", async (route) => {
    await blocked.promise;
    await route.abort().catch(() => {});
  });
  await page.clock.install();
  await page.evaluate(() =>
    openPlayer({
      title: "Fallback test",
      type: "movie",
      metaId: "fixture",
      noHistory: true,
      sources: [
        {
          url: "http://127.0.0.1:3000/never-starts.webm",
          label: "Hung source",
          noProxy: true,
        },
        {
          url: "http://127.0.0.1:3000/tests/fixtures/sample.webm",
          label: "Ready fallback",
          noProxy: true,
        },
      ],
    }),
  );
  await expect(page.locator("#npVideo")).toBeVisible();
  await page.clock.fastForward(10100);
  await expect
    .poll(() => page.locator("#npVideo").evaluate((v) => v.currentSrc))
    .toContain("sample.webm");
  await expect
    .poll(() => page.locator("#npVideo").evaluate((v) => v.readyState))
    .toBeGreaterThanOrEqual(2);
  blocked.release();
  await page.locator("#playerClose").click();
  await expect(page.locator("#player")).toBeHidden();
});

test("blocked browser storage does not break discovery or playback", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "indexedDB", {
      configurable: true,
      get() {
        throw new Error("Storage denied");
      },
    }),
  );
  await page.reload();
  await expect(page.locator("#heroBox")).toBeVisible();
  await page.evaluate(() =>
    openPlayer({
      title: "Storage fallback",
      type: "movie",
      metaId: "fixture",
      noHistory: true,
      sources: [
        {
          url: "http://127.0.0.1:3000/tests/fixtures/sample.webm",
          label: "Direct",
          noProxy: true,
        },
      ],
    }),
  );
  await expect
    .poll(() => page.locator("#npVideo").evaluate((v) => v.readyState))
    .toBeGreaterThanOrEqual(2);
});
