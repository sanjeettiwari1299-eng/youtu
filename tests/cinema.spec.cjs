const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const errors = [];
test.beforeEach(async ({ page }) => {
  errors.length = 0;
  page.on("pageerror", (e) => errors.push(e.message));
  // Exercise the offline/catalog fallback, not a third-party service's uptime.
  await page.route("**/*", (route) =>
    /^(http:\/\/(127\.0\.0\.1|localhost):3000|blob:|data:)/.test(
      route.request().url(),
    )
      ? route.continue()
      : route.abort(),
  );
  await page.goto("/");
  await expect(page.locator("#heroBox")).toBeVisible();
});
test.afterEach(() => expect(errors).toEqual([]));

test("discovery is useful without remote add-ons", async ({ page }) => {
  await expect(page.locator("#heroBox")).toContainText("Dune: Part Two");
  await expect(page.locator("#app")).toContainText("Trending movies");
  expect(
    await page
      .locator(".card-img")
      .first()
      .evaluate((img) => img.complete && img.naturalWidth > 0),
  ).toBe(true);
  await page.locator('[data-hcat="series"]').click();
  await expect(page.locator('.row[data-rowcat="movie"]').first()).toBeHidden();
  await expect(
    page.locator('.row[data-rowcat="series"]').first(),
  ).toBeVisible();
  await page.locator('[data-hcat="all"]').click();
  await page.locator("#heroListBtn").click();
  await expect(page.locator("#heroListBtn")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.locator('.side-link[data-page="list"]').click();
  await expect(page.locator("#app")).toContainText("Dune: Part Two");
  await expect(page.locator('.side-link[data-page="list"]')).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("search shortcut and accessible help dialog", async ({ page }) => {
  await page.keyboard.press("Control+k");
  await expect(page.locator("#searchInput")).toBeFocused();
  await expect(page.locator("#cmdModal")).toBeHidden();
  await page.locator("#searchInput").fill("Interstellar");
  await page.locator("#searchForm").evaluate((form) => form.requestSubmit());
  await expect(page.locator("#app")).toContainText("Interstellar");
  await page.locator("#topHelp").click();
  await expect(page.locator("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog")).toBeHidden();
});

test("mobile has bottom navigation and no horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("#heroBox")).toBeVisible();
  await expect(page.locator('.side-link[data-page="home"]')).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const nav = await page.locator("#sidebar").boundingBox();
  expect(nav.y).toBeGreaterThan(700);
  await page.screenshot({ path: ".playwright/mobile.png" });
});

for (const size of ["desktop", "mobile"]) {
  test(`local file playback, seeking, settings and cleanup (${size})`, async ({
    page,
  }) => {
    if (size === "mobile")
      await page.setViewportSize({ width: 390, height: 844 });
    const fixture = process.env.TEST_VIDEO || "tests/fixtures/sample.webm";
    test.skip(
      !fs.existsSync(fixture),
      "Set TEST_VIDEO to any local MP4 or WebM to test real media playback.",
    );
    await page.locator("input[type=file]").last().setInputFiles(fixture);
    await expect(page.locator("#player")).toBeVisible();
    await expect
      .poll(() => page.locator("#npVideo").evaluate((v) => v.readyState))
      .toBeGreaterThanOrEqual(2);
    if (size === "desktop") {
      await page.locator("#npFs").click();
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              !!document.fullscreenElement ||
              document
                .querySelector("#player")
                .classList.contains("np-fake-fs"),
          ),
        )
        .toBe(true);
      await page.locator("#npFs").click();
    }
    await page.locator("#npPlay").click();
    await page.locator("#npVideo").evaluate((v) => {
      v.pause();
      v.currentTime = 2;
    });
    await page.locator("#npFwd").click();
    await expect
      .poll(() => page.locator("#npVideo").evaluate((v) => v.currentTime))
      .toBeGreaterThan(9);
    await page.locator("#npProg").focus();
    await page.keyboard.press("ArrowLeft");
    await expect
      .poll(() => page.locator("#npVideo").evaluate((v) => v.currentTime))
      .toBeLessThan(4);
    await page.waitForTimeout(1600); // Old seek verification must not undo a newer seek.
    expect(
      await page.locator("#npVideo").evaluate((v) => v.currentTime),
    ).toBeLessThan(4);
    const before = await page
      .locator("#npVideo")
      .evaluate((v) => v.currentTime);
    await page.keyboard.press("Tab");
    expect(
      await page.locator("#npVideo").evaluate((v) => v.currentTime),
    ).toBeLessThan(before + 1);
    await page.locator("#npSet").click();
    await expect(page.locator("#npMenu")).toBeVisible();
    await page.locator("#npSet").click();
    await page.locator("#npCC").click();
    await expect(page.locator("#npMenu")).toBeVisible();
    await page.locator("#npCC").click();
    await page.locator("#playerMore").click();
    await expect(page.locator("#playerToolsPanel")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#playerToolsPanel")).toBeHidden();
    await expect(page.locator("#player")).toBeVisible();
    await page.locator("#playerMini").click();
    await expect(page.locator("#player")).toHaveClass(/mini-mode/);
    await page.locator("#playerMini").click();
    await expect(page.locator("#player")).not.toHaveClass(/mini-mode/);
    await page.screenshot({ path: `.playwright/player-${size}.png` });
    await page.locator("#playerClose").click();
    await expect(page.locator("#player")).toBeHidden();
    await expect(page.locator("#playerStage")).toBeEmpty();
  });
}
