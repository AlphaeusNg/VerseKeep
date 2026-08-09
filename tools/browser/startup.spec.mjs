import { expect, test } from "@playwright/test";

const runtimeErrors = new WeakMap();

test.beforeEach(async ({ page }) => {
  const errors = [];
  runtimeErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });

  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.hostname === "127.0.0.1" || url.protocol === "data:") {
      await route.continue();
      return;
    }

    const resourceType = request.resourceType();
    if (resourceType === "script") {
      await route.fulfill({ contentType: "application/javascript", body: "" });
    } else if (resourceType === "stylesheet") {
      await route.fulfill({ contentType: "text/css", body: "" });
    } else if (resourceType === "document") {
      await route.fulfill({
        contentType: "text/html",
        body: "<!doctype html><title>Offline test</title>",
      });
    } else if (resourceType === "image" || resourceType === "media" || resourceType === "font") {
      await route.fulfill({ status: 204, body: "" });
    } else {
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    }
  });
});

test.afterEach(async ({ page }) => {
  await page.waitForTimeout(50);
  expect(runtimeErrors.get(page), "unexpected browser runtime errors").toEqual([]);
});

test("boots meditation and navigates from a topic into practice", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.locator("#load-error")).toBeHidden();
  await expect(page.locator("#meditate-card .med-ref")).not.toHaveText("");
  await expect(page.locator("#meditate-card .med-verse")).not.toHaveText("");
  await expect(page.locator("#theme-grid [data-theme]")).not.toHaveCount(0);
  await expect(page.locator("#music-list [data-music-id]")).not.toHaveCount(0);
  await expect(page.locator("#wallpaper-grid .wp-card")).not.toHaveCount(0);

  await page.locator('.top-nav a[href="#topics"]').click();
  await expect(page).toHaveURL(/#topics$/);

  const themeButton = page.locator("#theme-grid [data-theme]").first();
  const themeId = await themeButton.getAttribute("data-theme");
  const themeTitle = (await themeButton.locator("strong").textContent())?.trim();
  expect(themeId).toBeTruthy();
  expect(themeTitle).toBeTruthy();

  await themeButton.click();
  await expect(page.locator(`#med-topics [data-topic="${themeId}"]`)).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(page.locator("#meditate-card .med-topic-pill")).toContainText(themeTitle);
  await expect(page.locator("#play-panel")).toBeHidden();

  await page.locator(`#theme-grid [data-drill="${themeId}"]`).click();
  await expect(page.locator("#play-panel")).toBeVisible();
  await expect(page.locator("#theme-label")).toContainText(themeTitle);
  await expect(page.locator("#stage #study-text")).not.toHaveText("");

  await page.locator('#play-panel [data-mode="type"]').click();
  await expect(page.locator("#stage #type-input")).toBeVisible();
  await expect(page.locator('#play-panel [data-mode="type"]')).toHaveAttribute(
    "aria-selected",
    "true"
  );
});
