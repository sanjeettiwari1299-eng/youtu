const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const source = "http://127.0.0.1:3000/tests/fixtures/sample.webm";
let errors = [];
test.afterEach(() => expect(errors).toEqual([]));
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", (r) =>
    r.request().url().startsWith("http://127.0.0.1:3000/")
      ? r.continue()
      : r.abort(),
  );
  await page.goto("/");
  await expect(page.locator("#heroBox")).toBeVisible();
});
test("local libraries remain separate and survive switching and reload", async ({
  page,
}) => {
  await page.locator("#heroListBtn").click();
  await page.locator(".profile-button").click();
  await expect(page.locator(".platform-page")).toContainText(
    "A space of your own",
  );
  await page.locator("#profileName").fill("Family");
  await page.locator("#newProfile button").click();
  await page.locator("[data-switch-profile]").click();
  expect(await page.evaluate(() => store.get("se_list", []).length)).toBe(0);
  await page.locator("[data-switch-profile]").click();
  expect(await page.evaluate(() => store.get("se_list", [])[0].name)).toBe(
    "Dune: Part Two",
  );
  await page.reload();
  expect(await page.evaluate(() => store.get("se_list", [])[0].name)).toBe(
    "Dune: Part Two",
  );
  await expect(page.locator(".profile-card.current")).toContainText("Personal");
});
test("local-only defaults never make cloud sync requests; preferences survive reload", async ({
  page,
}) => {
  let syncRequests = 0;
  page.on("request", (r) => {
    if (r.url().includes("/api/sync")) syncRequests++;
  });
  await page.goto("/#/settings");
  await expect(
    page.locator('[data-pref="se_public_proxies"]'),
  ).not.toBeChecked();
  await page.locator('[data-pref="se_autoplay_next"]').uncheck();
  await page.locator('[data-pref="se_sub_lang"]').selectOption("hi");
  await page.reload();
  await expect(
    page.locator('[data-pref="se_autoplay_next"]'),
  ).not.toBeChecked();
  await expect(page.locator('[data-pref="se_sub_lang"]')).toHaveValue("hi");
  expect(await page.evaluate(() => syncCode())).toBe("");
  expect(syncRequests).toBe(0);
});
test("safe diagnostic download does not contain tokens, hostnames or library titles", async ({
  page,
}) => {
  const marker = "DO_NOT_EXPORT_THIS";
  await page.evaluate((marker) => {
    store.set("se_sync_code", "c".repeat(64));
    store.set("se_list", [{ id: marker, name: marker }]);
    playbackMonitor.provider(
      "https://" + marker + ".test/config?token=" + marker,
      10,
      new Error(marker),
    );
  }, marker);
  await page.goto("/#/health");
  const pending = page.waitForEvent("download");
  await page.locator("#downloadDiagnostics").click();
  const download = await pending;
  const body = await fs.readFile(await download.path(), "utf8");
  expect(body).not.toContain(marker);
  expect(body).not.toContain("c".repeat(64));
  expect(JSON.parse(body).providers[0].provider).toBe("Provider 1");
});
test("a cloud download from the previous profile cannot overwrite the next profile", async ({
  page,
}) => {
  let release,
    started = false;
  const blocked = new Promise((r) => (release = r));
  await page.route("https://private.test/**", async (route) => {
    started = true;
    await blocked;
    await route
      .fulfill({
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: JSON.stringify({
          revision: 1,
          ts: 1,
          data: { se_list: [{ id: "old-private", name: "Old private title" }] },
        }),
      })
      .catch(() => {});
  });
  await page.evaluate(() => {
    store.set("se_sync_code", "a".repeat(64));
    store.set("se_sync_api", "https://private.test");
    window.oldSync = pullSync(false);
  });
  await expect.poll(() => started).toBe(true);
  await page.evaluate(() => switchLocalProfile(localProfiles.create("Second")));
  release();
  await page.evaluate(() => window.oldSync);
  expect(await page.evaluate(() => store.get("se_list", []))).toEqual([]);
  expect(await page.evaluate(() => syncCode())).toBe("");
});
test("autoplay preference suppresses the next-episode prompt", async ({
  page,
}) => {
  await page.evaluate((source) => {
    store.set("se_autoplay_next", false);
    openPlayer({
      title: "Current episode",
      metaId: "test-episode",
      type: "movie",
      noHistory: true,
      sources: [{ url: source, label: "Fixture", noProxy: true }],
      next: { vid: "tt123:1:2", title: "Next episode" },
    });
  }, source);
  await expect
    .poll(() => page.locator("#npVideo").evaluate((v) => v.readyState))
    .toBeGreaterThanOrEqual(2);
  await page
    .locator("#npVideo")
    .evaluate((v) => v.dispatchEvent(new Event("ended")));
  await expect(page.locator("#npUpnext")).toBeHidden();
  await expect(page.locator("#playerTitle")).toHaveText("Current episode");
});
test("TV navigation moves focus without activating a route", async ({
  page,
}) => {
  await page.goto("/#/settings");
  await page.locator('[data-pref="se_tv_navigation"]').check();
  await page.locator('.side-link[data-page="home"]').focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator('.side-link[data-page="movies"]')).toBeFocused();
  expect(page.url()).toContain("#/settings");
});
test("denied local storage leaves a usable temporary local profile", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("Denied");
      },
    }),
  );
  await page.goto("/#/profiles");
  await page.reload();
  await expect(page.locator(".platform-page")).toContainText(
    "This session is temporary",
  );
  await expect(page.locator(".profile-card.current")).toContainText("Personal");
  expect(await page.evaluate(() => syncCode())).toBe("");
});
test("offline dirty library is kept across reload when cloud has a newer revision", async ({
  page,
}) => {
  let writes = 0;
  await page.route("https://sync.test/**", (route) => {
    if (route.request().method() === "PUT") writes++;
    return route.fulfill({
      contentType: "application/json",
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "Authorization,Content-Type,If-Match",
      },
      body: JSON.stringify({
        revision: 2,
        ts: 1,
        data: { se_list: [{ id: "remote", name: "Remote" }] },
      }),
    });
  });
  await page.evaluate(() => {
    store.set("se_sync_code", "a".repeat(64));
    store.set("se_sync_api", "https://sync.test");
    store.set("se_sync_revision", 1);
    store.set("se_list", [{ id: "offline", name: "Offline edit" }]);
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!S.syncConflict)).toBe(true);
  expect(await page.evaluate(() => store.get("se_list", [])[0].id)).toBe(
    "offline",
  );
  expect(await page.evaluate(() => store.get("se_sync_dirty", false))).toBe(
    true,
  );
  await page.evaluate(() => pushSync(false));
  expect(writes).toBe(0);
});
test("a local edit made during a cloud download is not overwritten", async ({
  page,
}) => {
  let release,
    started = false;
  const blocked = new Promise((r) => (release = r));
  await page.route("https://sync.test/**", async (route) => {
    started = true;
    await blocked;
    await route.fulfill({
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({
        revision: 1,
        ts: 1,
        data: { se_list: [{ id: "remote", name: "Remote" }] },
      }),
    });
  });
  await page.evaluate(() => {
    store.set("se_sync_code", "a".repeat(64));
    store.set("se_sync_api", "https://sync.test");
    window.pendingSync = pullSync(true);
  });
  await expect.poll(() => started).toBe(true);
  await page.evaluate(() =>
    store.set("se_list", [{ id: "just-edited", name: "Local edit" }]),
  );
  release();
  expect(await page.evaluate(() => window.pendingSync)).toBe(false);
  expect(await page.evaluate(() => store.get("se_list", [])[0].id)).toBe(
    "just-edited",
  );
});
test("profile/preferences/health pages fit mobile and expose navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ["profiles", "settings", "health"]) {
    await page.goto("/#/" + route);
    await expect(page.locator(".platform-page")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await expect(page.locator(".platform-tabs a")).toHaveCount(3);
  }
});

test("a clean connected profile downloads on boot without a false dirty theme change", async ({
  page,
}) => {
  await page.route("https://sync.test/**", (route) =>
    route.fulfill({
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({
        revision: 1,
        ts: 1,
        data: {
          se_list: [{ id: "fresh-cloud", name: "Fresh cloud" }],
          se_theme: "stremio",
        },
      }),
    }),
  );
  await page.evaluate(() => {
    store.set("se_sync_code", "a".repeat(64));
    store.set("se_sync_api", "https://sync.test");
    store.set("se_sync_dirty", false);
    store.set("se_sync_revision", 0);
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => store.get("se_list", [])[0]?.id))
    .toBe("fresh-cloud");
  expect(await page.evaluate(() => store.get("se_sync_dirty", false))).toBe(
    false,
  );
  expect(await page.evaluate(() => !!S.syncConflict)).toBe(false);
});
