import { expect, test } from "@playwright/test";

test("opens an unseen shared meditation from the bundled catalog offline", async ({ context, page }) => {
  await page.route(/^https:\/\//, async (route) => {
    const request = route.request();
    const contentType = request.resourceType() === "stylesheet"
      ? "text/css"
      : request.resourceType() === "script"
        ? "application/javascript"
        : "application/json";
    await route.fulfill({ status: 200, contentType, body: contentType === "application/json" ? "{}" : "" });
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#load-error")).toBeHidden();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  const navigation = await page.goto("/?v=Psalm+56%3A3&t=trusting-god&tr=esv#meditate", {
    waitUntil: "domcontentloaded",
  });
  expect(navigation?.fromServiceWorker()).toBe(true);
  await expect(page.locator("#load-error")).toBeHidden();
  await expect(page.locator("#meditate-card .med-ref")).toHaveText("Psalm 56:3");
  await expect(page.locator("#meditate-card .med-verse")).not.toHaveText("");

  await page.locator("#med-practice-verse").click();
  await expect(page.locator("#play-panel")).toBeVisible();
  await expect(page.locator("#stage .ref")).toHaveText("Psalm 56:3");
  await expect(page.locator("#stage .blank-input").first()).toBeVisible();
});
