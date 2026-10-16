import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { openBooks, openMedMore, openMedOptions, openTopicTools, openTopics } from "./disclose.mjs";

// Runtime fixtures deliberately replace catalog/network responses. Keep the
// service worker boundary isolated in offline.spec.mjs so those routes remain
// observable and deterministic here.
test.use({ serviceWorkers: "block" });

const runtimeErrors = new WeakMap();

async function exportedDeviceBackup(page) {
  const pending = page.waitForEvent("download");
  await openTopicTools(page);
  await page.locator("#btn-export-device").click();
  const download = await pending;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

test("saves individual meditation verses and restores the collection through device backup", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?v=Psalm%2056%3A3", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".med-ref")).toHaveText("Psalm 56:3");
  await page.locator("#med-more").click();
  const save = page.getByRole("button", { name: "Save verse", exact: true });
  await save.focus();
  await page.keyboard.press("Enter");
  await expect(save).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#med-saved-count")).toHaveText("(1)");
  const backup = await exportedDeviceBackup(page);
  expect(backup.practice.savedVerses).toEqual({ "Psalm 56:3": true });
  await page.reload();
  await expect(page.locator("#med-saved-count")).toHaveText("(1)");
  await page.locator("#med-next").click();
  await expect(page.locator(".med-ref")).not.toHaveText("Psalm 56:3");
  await openMedOptions(page);
  await page.locator("#tr-select").selectOption("niv");
  await page.locator("#med-saved summary").click();
  await page.getByRole("button", { name: "Meditate on Psalm 56:3", exact: true }).click();
  await expect(page.locator(".med-ref")).toHaveText("Psalm 56:3");
  expect(new URL(page.url()).searchParams.get("v")).toBe("Psalm 56:3");
  expect(new URL(page.url()).searchParams.get("tr")).toBe("niv");
  await expect(page.locator("#meditate-card")).toBeFocused();
  await expect(page.locator("#meditate-card .med-block")).toHaveCount(3);
  await page.getByRole("button", { name: "Remove Psalm 56:3 from saved verses" }).click();
  await expect(page.locator("#med-saved-count")).toHaveText("(0)");
  await expect(page.locator("#med-saved summary")).toBeFocused();
  const restore = async (snapshot, count) => {
    const dialog = page.waitForEvent("dialog").then(async (dialog) => {
      expect(dialog.message()).toContain(`Saved verses: ${count}`);
      await dialog.accept();
    });
    await page.locator("#device-import-file").setInputFiles({ name: "backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(snapshot)) });
    await dialog;
    await expect(page.locator("#device-data-status")).toContainText("Restored practice");
  };
  backup.practice.savedVerses["arbitrary injected reference"] = true;
  await restore(backup, 1);
  await expect(page.locator("#med-saved-count")).toHaveText("(1)");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("versekeep-stats-v1")).savedVerses)).toEqual({ "Psalm 56:3": true });
  const older = structuredClone(backup);
  delete older.practice.savedVerses;
  await restore(older, 0);
  await expect(page.locator("#med-saved-count")).toHaveText("(0)");
  await restore(backup, 1);
  await openMedMore(page);
  await page.locator("#med-focus").click();
  await expect(page.locator("#med-saved")).not.toBeVisible();
  await openMedMore(page);
  await page.locator("#med-focus").click();
  page.once("dialog", dialog => dialog.accept());
  await openTopicTools(page);
  await page.locator("#btn-reset-stats").click();
  await expect(page.locator("#med-saved-count")).toHaveText("(0)");
  await page.reload();
  await expect(page.locator("#med-saved-count")).toHaveText("(0)");
});

test("saved verses disclose denied storage and export the visit-only collection", async ({ page }) => {
  await page.addInitScript(() => {
    window.__allowSavedWrites = false;
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "versekeep-stats-v1" && !window.__allowSavedWrites) throw new DOMException("Denied", "QuotaExceededError");
      return write.call(this, key, value);
    };
  });
  await page.goto("/?v=Psalm%2056%3A3", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".med-ref")).toHaveText("Psalm 56:3");
  await page.locator("#med-more").click();
  await page.locator("#med-save").click();
  await expect(page.locator("#med-feedback")).toContainText("for this visit only");
  expect(await page.evaluate(() => localStorage.getItem("versekeep-stats-v1"))).toBeNull();
  const backup = await exportedDeviceBackup(page);
  expect(backup.practice.savedVerses).toEqual({ "Psalm 56:3": true });
  await page.locator("#med-saved summary").click();
  await expect(page.locator("#med-saved-status")).toContainText("for this visit only");
  page.once("dialog", dialog => dialog.accept());
  await openTopicTools(page);
  await page.locator("#btn-reset-stats").click();
  await expect(page.locator("#med-saved-count")).toHaveText("(0)");
  await expect(page.locator("#resume-hint")).toContainText("for this visit");
  page.once("dialog", dialog => dialog.accept());
  await page.locator("#device-import-file").setInputFiles({ name: "backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup)) });
  await expect(page.locator("#device-data-status")).toContainText("could not be saved");
  await expect(page.locator("#med-saved-count")).toHaveText("(0)");
  await page.reload();
  await expect(page.locator("#med-saved-count")).toHaveText("(0)");
  await page.evaluate(() => { window.__allowSavedWrites = true; });
  await page.locator("#med-more").click();
  await page.locator("#med-save").click();
  await expect(page.locator("#med-feedback")).toContainText("saved on this device");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("versekeep-stats-v1")).savedVerses)).toEqual({ "Psalm 56:3": true });
});

test("meditation swipes ignore canceled gestures and multiple fingers", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?v=Psalm%2056%3A3", { waitUntil: "domcontentloaded" });
  const reference = page.locator("#meditate-card .med-ref");
  await expect(reference).toHaveText("Psalm 56:3");
  const gesture = async (events) => page.locator("#meditate-card").evaluate((card, events) => {
    for (const { type, touches, changed } of events) {
      const make = ([identifier, clientX, clientY]) => new Touch({ identifier, target: card, clientX, clientY });
      card.dispatchEvent(new TouchEvent(type, {
        bubbles: true, touches: touches.map(make), changedTouches: changed.map(make),
      }));
    }
  }, events);
  const start = { type: "touchstart", touches: [[1, 250, 150]], changed: [[1, 250, 150]] };
  const end = { type: "touchend", touches: [], changed: [[1, 100, 150]] };
  for (const events of [
    [start, { type: "touchcancel", touches: [], changed: [[1, 250, 150]] }, end],
    [start, { type: "touchstart", touches: [[1, 250, 150], [2, 100, 150]], changed: [[2, 100, 150]] }, end],
    [start, { type: "touchmove", touches: [[1, 250, 150], [2, 100, 150]], changed: [[1, 250, 150]] }, end],
    [start, { type: "touchend", touches: [], changed: [[2, 100, 150]] }],
    [start, { type: "touchend", touches: [[2, 100, 150]], changed: [[1, 100, 150]] }],
    [start, { type: "touchend", touches: [], changed: [[1, 200, 400]] }],
  ]) {
    await gesture(events);
    await expect(reference).toHaveText("Psalm 56:3");
  }
  await gesture([start, end]);
  await expect(reference).not.toHaveText("Psalm 56:3");
  await gesture([
    { type: "touchstart", touches: [[3, 100, 150]], changed: [[3, 100, 150]] },
    { type: "touchend", touches: [], changed: [[3, 250, 150]] },
  ]);
  await expect(reference).toHaveText("Psalm 56:3");
});

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

test("previews device backup counts and only replaces data after confirmation", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#theme-grid [data-theme]")).not.toHaveCount(0);
  const backup = await page.evaluate(() => window.VerseKeepSession.exportSnapshot({
    practice: { checks: 3, correct: 1, verseHits: { "Psalm 56:3": 1 },
      versePractice: { "Psalm 56:3": { correct: 1 }, "John 3:16": { missed: 2 } } },
    amen: { count: 7, history: [{ day: "2026-09-24", ref: "Psalm 56:3" }] },
    wallpapers: { mode: "manual", id: "dawn-hills", src: "assets/wallpapers/dawn-hills.jpg" },
  }).snapshot);
  const readStored = () => page.evaluate(() => Object.fromEntries(
    Object.values(window.VerseKeepSession.KEYS).map((key) => [key, localStorage.getItem(key)])
  ));
  const before = await readStored();
  const file = { name: "device.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup)) };
  const cancelled = page.waitForEvent("dialog").then(async (dialog) => {
    expect(dialog.type()).toBe("confirm");
    expect(dialog.message()).toContain("Practiced verses: 2");
    expect(dialog.message()).toContain("Recorded Amen days: 1");
    expect(dialog.message()).toContain("Wallpaper selection: included");
    expect(dialog.message()).toContain("does not merge");
    await dialog.dismiss();
  });
  await page.locator("#device-import-file").setInputFiles(file);
  await cancelled;
  await expect(page.locator("#device-data-status")).toContainText("Import cancelled");
  expect(await readStored()).toEqual(before);

  const accepted = page.waitForEvent("dialog").then((dialog) => dialog.accept());
  await page.locator("#device-import-file").setInputFiles(file);
  await accepted;
  await expect(page.locator("#device-data-status")).toContainText("Restored practice");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("versekeep-stats-v1")).checks)).toBe(3);
  const after = await readStored();
  await page.locator("#device-import-file").setInputFiles({ ...file, buffer: Buffer.from("{invalid") });
  await expect(page.locator("#device-data-status")).toContainText("Nothing was changed");
  expect(await readStored()).toEqual(after);
});

async function installSpeechProbe(page) {
  await page.addInitScript(() => {
    globalThis.__versekeepSpeech = { cancelled: 0, spoken: [] };
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        cancel() {
          globalThis.__versekeepSpeech.cancelled += 1;
        },
        speak(utterance) {
          globalThis.__versekeepSpeech.spoken.push(String(utterance?.text || ""));
        },
      },
    });
  });
}

test("boots meditation and navigates from a topic into practice", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.locator("#load-error")).toBeHidden();
  await expect(page.locator("#meditate-card .med-ref")).not.toHaveText("");
  await expect(page.locator("#meditate-card .med-verse")).not.toHaveText("");
  await expect(page.locator("#theme-grid [data-theme]")).not.toHaveCount(0);
  await expect(page.locator("#music-list [data-music-id]")).not.toHaveCount(0);
  await expect(page.locator("#wallpaper-grid .wp-card")).not.toHaveCount(0);

  await expect(page.locator(".hero")).toHaveCount(0);
  await expect(page.locator(".top-nav > a[href='#meditate']")).toBeVisible();
  await expect(page.locator(".top-nav > a[href='#themes']")).toBeVisible();
  await expect(page.locator("#nav-music")).toBeVisible();
  await expect(page.locator(".top-nav > a[href='#topics']")).toHaveCount(0);
  await page.locator(".top-nav .nav-more > summary").click();
  await page.locator('.top-nav a[href="#topics"]').click();
  await expect(page).toHaveURL(/#topics$/);

  await openTopics(page);
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

  await openTopics(page);
  await page.locator(`#theme-grid [data-drill="${themeId}"]`).click();
  await expect(page.locator("#play-panel")).toBeVisible();
  await expect(page.locator("#theme-label")).toContainText(themeTitle);
  await expect(page.locator("#stage #study-text")).not.toHaveText("");

  await page.locator('#play-panel [data-mode="type"]').click();
  await expect(page.locator("#stage #type-input")).toBeVisible();
  await expect(page.locator('#play-panel [data-mode="type"]')).toHaveAttribute(
    "aria-pressed",
    "true"
  );
});

test("stops meditation speech before showing another verse", async ({ page }) => {
  await installSpeechProbe(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const originalRef = await page.locator("#meditate-card .med-ref").textContent();
  await page.keyboard.press("l");
  await expect.poll(() => page.evaluate(() => globalThis.__versekeepSpeech.spoken.length)).toBe(1);
  const cancelsAfterStart = await page.evaluate(() => globalThis.__versekeepSpeech.cancelled);

  await page.locator("#med-next").click();
  await expect(page.locator("#meditate-card .med-ref")).not.toHaveText(originalRef || "");
  await expect.poll(() => page.evaluate(() => globalThis.__versekeepSpeech.cancelled))
    .toBeGreaterThan(cancelsAfterStart);
});

test("suspends meditation Listen while live verse is still loading", async ({ page }) => {
  await installSpeechProbe(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#meditate-card .med-ref")).not.toHaveText("");
  await expect(page.locator("#live-bible")).toBeChecked();

  await page.evaluate(() => {
    globalThis.__versekeepReleaseMedHydration = null;
    window.VerseKeepBible.resolveVerse = (ref, localText) =>
      new Promise((resolve) => {
        globalThis.__versekeepReleaseMedHydration = () =>
          resolve({
            text: `LIVE ${localText}`,
            translation: "ESV",
            source: "test",
          });
      });
  });

  await page.locator("#med-next").click();
  await expect(page.locator("#meditate-card .med-verse")).toHaveClass(/is-loading/);
  await expect(page.locator("#med-listen")).toBeDisabled();

  const spokenBefore = await page.evaluate(() => globalThis.__versekeepSpeech.spoken.length);
  await page.keyboard.press("l");
  await expect(page.locator("#med-feedback")).toContainText("Waiting for live verse");
  expect(await page.evaluate(() => globalThis.__versekeepSpeech.spoken.length)).toBe(
    spokenBefore
  );

  await expect
    .poll(() => page.evaluate(() => typeof globalThis.__versekeepReleaseMedHydration))
    .toBe("function");
  await page.evaluate(() => globalThis.__versekeepReleaseMedHydration());
  await expect(page.locator("#meditate-card .med-verse")).not.toHaveClass(/is-loading/);
  await expect(page.locator("#med-listen")).toBeEnabled();

  // Listen lives in the collapsed More panel; L is the supported path (same as other smoke tests).
  await page.keyboard.press("l");
  await expect
    .poll(() => page.evaluate(() => globalThis.__versekeepSpeech.spoken.length))
    .toBe(spokenBefore + 1);
});

test("paints bundled practice before live hydration and preserves started input", async ({ page }) => {
  await installSpeechProbe(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#meditate-card .med-ref")).not.toHaveText("");

  await page.keyboard.press("l");
  await expect.poll(() => page.evaluate(() => globalThis.__versekeepSpeech.spoken.length)).toBe(1);
  const cancelsAfterStart = await page.evaluate(() => globalThis.__versekeepSpeech.cancelled);

  await page.evaluate(() => {
    globalThis.__versekeepReleasePracticeHydration = null;
    window.VerseKeepBible.resolveVerse = (ref, localText) =>
      new Promise((resolve) => {
        globalThis.__versekeepReleasePracticeHydration = () =>
          resolve({ text: localText, translation: "ESV", source: "test" });
      });
  });

  await openMedMore(page);
  await page.locator("#med-practice-verse").click();
  await expect(page.locator("#play-panel")).toBeVisible();
  const firstBlank = page.locator("#stage .blank-input").first();
  await expect(firstBlank).toBeVisible();
  await expect(page.locator("#stage")).not.toContainText("Loading verses");
  await expect.poll(() => page.evaluate(() => globalThis.__versekeepSpeech.cancelled))
    .toBeGreaterThan(cancelsAfterStart);
  await expect.poll(() => page.evaluate(() => typeof globalThis.__versekeepReleasePracticeHydration))
    .toBe("function");

  await firstBlank.fill("started");
  await page.evaluate(() => globalThis.__versekeepReleasePracticeHydration());
  await expect(firstBlank).toHaveValue("started");
  // Started rounds retain bundled text, so the label must retain its source too.
  await expect(page.locator("#live-bible-label")).toHaveText("(bundled)");
});

test("keeps shortcut speech playing when live practice text arrives", async ({ page }) => {
  await installSpeechProbe(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#meditate-card .med-ref")).not.toHaveText("");

  await page.evaluate(() => {
    const pending = [];
    globalThis.__versekeepReleasePracticeHydration = null;
    window.VerseKeepBible.resolveVerse = (ref, localText) =>
      new Promise((resolve) => {
        pending.push(() => resolve({ text: localText, translation: "ESV", source: "test" }));
        globalThis.__versekeepReleasePracticeHydration = () => pending.splice(0).forEach((done) => done());
      });
  });

  await openMedMore(page);
  await page.locator("#med-drill").click();
  await expect(page.locator("#stage #study-text")).not.toHaveText("");
  await expect.poll(() => page.evaluate(() => typeof globalThis.__versekeepReleasePracticeHydration))
    .toBe("function");

  await page.keyboard.press("l");
  await expect.poll(() => page.evaluate(() => globalThis.__versekeepSpeech.spoken.length)).toBe(1);
  const cancelsAfterSpeech = await page.evaluate(() => globalThis.__versekeepSpeech.cancelled);
  const spokenText = await page.locator("#stage #study-text").textContent();
  await page.evaluate(() => globalThis.__versekeepReleasePracticeHydration());

  await expect(page.locator("#stage #study-text")).toHaveText(spokenText);
  await expect(page.locator("#live-bible-label")).toHaveText("(bundled)");
  await expect.poll(() => page.evaluate(() => globalThis.__versekeepSpeech.cancelled))
    .toBe(cancelsAfterSpeech);
});

test("stops practice speech before showing another drill verse", async ({ page }) => {
  await installSpeechProbe(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await openMedMore(page);
  await page.locator("#med-drill").click();
  await expect(page.locator("#play-panel")).toBeVisible();

  await page.locator("#btn-speak").click();
  await expect.poll(() => page.evaluate(() => globalThis.__versekeepSpeech.spoken.length)).toBe(1);
  const cancelsAfterStart = await page.evaluate(() => globalThis.__versekeepSpeech.cancelled);

  await page.locator("#btn-next").click();
  await expect.poll(() => page.evaluate(() => globalThis.__versekeepSpeech.cancelled))
    .toBeGreaterThan(cancelsAfterStart);
});

test("page departure stops speech without queuing another utterance", async ({ page }) => {
  await installSpeechProbe(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#meditate-card .med-ref")).not.toHaveText("");
  await page.keyboard.press("l");
  await expect.poll(() => page.evaluate(() => globalThis.__versekeepSpeech.spoken.length)).toBe(1);
  const before = await page.evaluate(() => globalThis.__versekeepSpeech.cancelled);
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  expect(await page.evaluate(() => globalThis.__versekeepSpeech.cancelled)).toBeGreaterThan(before);
  expect(await page.evaluate(() => globalThis.__versekeepSpeech.spoken.length)).toBe(1);
});

test("renders theme emoji text without interpreting catalog markup", async ({ page }) => {
  const probe = '<span id="catalog-markup-probe">unsafe</span>';
  await page.route("**/data/verses.json", async (route) => {
    const response = await route.fetch();
    const catalog = await response.json();
    catalog.themes[0].emoji = probe;
    catalog.books[0].emoji = probe;
    await route.fulfill({
      response,
      contentType: "application/json",
      body: JSON.stringify(catalog),
    });
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.locator("#load-error")).toBeHidden();
  await expect(page.locator("#catalog-markup-probe")).toHaveCount(0);
  await expect(page.locator("#theme-grid .emoji").first()).toHaveText(probe);
  await expect(page.locator("#book-grid .emoji").first()).toHaveText(probe);
  await expect(page.locator("#med-topics [data-topic] span").nth(1)).toHaveText(probe);
});

test("exposes meditation topics and feedback with matching semantics", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await openMedOptions(page);

  const topics = page.getByRole("group", { name: "Meditation topics" });
  await expect(topics).toBeVisible();
  await expect(topics.getByRole("button").first()).toHaveAttribute("aria-pressed", "true");

  await expect(page.locator("#med-streak")).toBeVisible();
  await expect(page.locator("#med-streak")).toContainText(
    "Tap Amen to start a streak."
  );
  await expect(page.locator("#med-streak .med-week-dot")).toHaveCount(7);
  await expect(page.locator("#med-streak .med-week-dot.is-today")).toHaveCount(1);
  await expect(page.locator("#med-streak .med-week-dot.is-today.is-filled")).toHaveCount(0);

  await expect(page.locator("#med-prev")).toBeVisible();
  await expect(page.locator("#med-next")).toBeVisible();
  await expect(page.locator("#med-amen")).toBeVisible();
  await expect(page.locator("#med-more")).toBeVisible();
  await expect(page.locator("#med-focus")).toBeHidden();
  await expect(page.locator("#med-today")).toBeHidden();
  await expect(page.locator("#med-shuffle")).toBeHidden();
  await expect(page.locator("#med-copy")).toBeHidden();
  await expect(page.locator("#med-copy-link")).toBeHidden();
  await expect(page.locator("#med-share")).toBeHidden();
  await expect(page.locator("#med-listen")).toBeHidden();

  await page.locator("#med-more").click();
  await expect(page.locator("#med-more")).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#med-focus")).toBeVisible();
  await expect(page.locator("#med-today")).toBeVisible();
  await expect(page.locator("#med-shuffle")).toBeVisible();

  await page.locator("#med-amen").click();
  const feedback = page.getByRole("status");
  await expect(feedback).toHaveText(/Amen\./);
  await expect(feedback).toHaveAttribute("aria-atomic", "true");
  await expect(page.locator("#med-streak")).toContainText("Streak 1 day · Amen today");
  await expect(page.locator("#med-streak .med-week-dot.is-today.is-filled")).toHaveCount(1);
});

test("announces practice feedback for grading and actions", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: "http://127.0.0.1:4174",
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await openTopics(page);
  await page.locator("#theme-grid [data-drill]").first().click();
  await expect(page.locator("#play-panel")).toBeVisible();

  const feedback = page.locator("#feedback");
  await page.locator("#btn-reveal").click();
  await expect(page.getByRole("status").filter({ hasText: /.+/ })).toBeVisible();
  await expect(feedback).not.toHaveText("");
  await expect(feedback).toHaveAttribute("aria-atomic", "true");

  await page.getByRole("button", { name: "More options", exact: true }).click();
  await page.getByRole("menuitem", { name: "Copy", exact: true }).click();
  await expect(feedback).toHaveText("Verse copied to clipboard.");
  await page.getByRole("button", { name: "More options", exact: true }).click();
  await page.getByRole("menuitem", { name: "Shuffle", exact: true }).click();
  await expect(feedback).toHaveText("Queue shuffled.");

  await page.locator('#play-panel [data-mode="type"]').click();
  await page.locator("#type-input").fill("not the verse");
  await page.locator("#btn-check").click();
  await expect(feedback).toContainText("Full verse");
});

test("keeps practice stats session-safe and honest when device storage is denied", async ({ page }) => {
  await page.addInitScript(() => {
    const setItem = Storage.prototype.setItem;
    globalThis.__versekeepStatsWritesAllowed = false;
    Storage.prototype.setItem = function (key, value) {
      if (key === "versekeep-stats-v1" && !globalThis.__versekeepStatsWritesAllowed) {
        throw new DOMException("Storage denied", "QuotaExceededError");
      }
      return setItem.call(this, key, value);
    };
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await openTopics(page);
  await page.locator("#theme-grid [data-drill]").first().click();
  const storageStatus = page.locator("#practice-storage-status");
  await expect(storageStatus).toBeVisible();
  await expect(storageStatus).toHaveText(
    "Practice progress is kept for this visit only; device storage is blocked.",
  );
  page.once("dialog", (dialog) => dialog.accept());
  await openTopicTools(page);
  await page.locator("#btn-reset-stats").click();
  await expect(page.locator("#resume-hint")).toHaveText(
    "Progress reset for this visit; device storage is blocked.",
  );

  await page.locator('#play-panel [data-mode="type"]').click();
  await page.locator("#type-input").fill("not the verse");
  await page.locator("#btn-check").click();
  await expect(page.locator("#feedback")).toContainText("Full verse");
  await expect(page.locator("#stats-bar")).toContainText("Checks 1");
  expect(await page.evaluate(() => localStorage.getItem("versekeep-stats-v1"))).toBeNull();

  await page.evaluate(() => {
    globalThis.__versekeepStatsWritesAllowed = true;
  });
  await page.locator("#btn-next").click();
  await page.locator("#type-input").fill("still not the verse");
  await page.locator("#btn-check").click();
  await expect(storageStatus).toBeHidden();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("versekeep-stats-v1")));
  expect(saved.checks).toBe(2);
});

test("exposes practice modes as a pressed-button group", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await openTopics(page);
  await page.locator("#theme-grid [data-drill]").first().click();
  await expect(page.locator("#play-panel")).toBeVisible();

  const modes = page.getByRole("group", { name: "Practice mode" });
  await expect(modes).toBeVisible();
  await expect(page.getByRole("tablist", { name: "Practice mode" })).toHaveCount(0);
  await expect(modes.getByRole("button", { name: "Study" })).toHaveAttribute(
    "aria-pressed",
    "true"
  );

  await modes.getByRole("button", { name: "Type it" }).click();
  await expect(modes.getByRole("button", { name: "Type it" })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(modes.getByRole("button", { name: "Study" })).toHaveAttribute(
    "aria-pressed",
    "false"
  );
  await expect(page.locator("#stage #type-input")).toBeVisible();
});

test("restores normalized meditation and practice preferences", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "versekeep-prefs-v1",
      JSON.stringify({
        mode: "quiz",
        translation: "NIV",
        autoAdvance: true,
        lastMedTopic: " strength-trials ",
        medFocus: true,
        unexpected: "discard me",
      })
    );
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.locator("#load-error")).toBeHidden();
  await expect(page.locator("#tr-select")).toHaveValue("niv");
  await expect(page.getByRole("menuitemcheckbox", { name: "Auto-advance after a correct answer", includeHidden: true })).toHaveAttribute("aria-checked", "true");
  await expect(page.locator('#med-topics [data-topic="strength-trials"]')).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(page.locator("#meditate-card .med-topic-pill")).toContainText("Strength in Trials");
  await expect(page.locator("body")).toHaveClass(/med-focus/);
  await expect(page.locator("#med-focus")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#med-amen")).toBeVisible();
  await expect(page.locator("#med-prev")).toBeVisible();
  await expect(page.locator("#med-next")).toBeVisible();
  await expect(page.locator("#med-more")).toBeHidden();
  await expect(page.locator("#med-more-panel")).toBeHidden();
  await expect(page.locator("#music-dock-tab")).toBeHidden();

  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("versekeep-prefs-v1")))).toEqual({
    mode: "quiz",
    translation: "niv",
    autoAdvance: true,
    lastMedTopic: "strength-trials",
    medFocus: true,
  });

  await openMedMore(page);
  await page.locator("#med-focus").click();
  await expect(page.locator("body")).not.toHaveClass(/med-focus/);
  await expect(page.locator("#med-more")).toBeVisible();
  await expect(page.locator("#music-dock-tab")).toBeVisible();
  await openMedMore(page);
  await expect(page.locator("#med-drill")).toBeVisible();
  await openMedMore(page);
  await page.locator("#med-drill").click();
  await expect(page.locator("#play-panel")).toBeVisible();
  await expect(page.locator('#play-panel [data-mode="quiz"]')).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(page.locator("#stage #quiz-choices .choice")).toHaveCount(4);
});

test("restores a returning meditation and advances Amen exactly once", async ({ page }) => {
  await page.addInitScript(() => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = `${yesterdayDate.getFullYear()}-${String(yesterdayDate.getMonth() + 1).padStart(2, "0")}-${String(yesterdayDate.getDate()).padStart(2, "0")}`;
    const daySeed = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
    localStorage.setItem(
      "versekeep-meditate-v1",
      JSON.stringify({ topicId: "trusting-god", ref: "Psalm 56:3", day: daySeed }),
    );
    localStorage.setItem(
      "versekeep-med-streak-v1",
      JSON.stringify({
        count: 4,
        lastDay: yesterday,
        history: [{ day: yesterday, ref: "Proverbs 3:5–6" }],
      }),
    );
    globalThis.__versekeepReturningFixture = { today, yesterday, daySeed };
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.locator("#load-error")).toBeHidden();
  await expect(page.locator('#med-topics [data-topic="trusting-god"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("#meditate-card .med-ref")).toHaveText("Psalm 56:3");
  await expect(page.locator("#med-streak")).toContainText("Streak 4 days · mark Amen to continue");
  await expect(page.locator("#med-streak")).toBeVisible();
  await expect(page.locator("#med-streak .med-week-dot")).toHaveCount(7);
  await expect(page.locator("#med-streak .med-week-dot.is-filled")).toHaveCount(1);

  const restoredSession = await page.evaluate(() => ({
    fixture: globalThis.__versekeepReturningFixture,
    session: JSON.parse(localStorage.getItem("versekeep-meditate-v1")),
  }));
  expect(restoredSession.session).toEqual({
    topicId: "trusting-god",
    ref: "Psalm 56:3",
    day: restoredSession.fixture.daySeed,
  });

  await page.locator("#med-amen").click();
  await expect(page.locator("#med-feedback")).toHaveText("Amen. 5-day streak.");
  await expect(page.locator("#med-streak")).toContainText("Streak 5 days · Amen today");
  await expect(page.locator("#med-streak .med-week-dot.is-filled")).toHaveCount(2);
  await expect(page.locator("#med-streak .med-week-dot.is-today.is-filled")).toHaveCount(1);
  const afterAmen = await page.evaluate(() => JSON.parse(localStorage.getItem("versekeep-med-streak-v1")));
  expect(afterAmen).toEqual({
    count: 5,
    lastDay: restoredSession.fixture.today,
    history: [
      { day: restoredSession.fixture.yesterday, ref: "Proverbs 3:5–6" },
      { day: restoredSession.fixture.today, ref: "Psalm 56:3" },
    ],
  });

  await page.locator("#med-amen").click();
  await expect(page.locator("#med-feedback")).toHaveText("Amen already marked for this calendar day.");
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem("versekeep-med-streak-v1"))),
  ).toEqual(afterAmen);
});

test("keeps Amen truthful and session-safe when device storage denies the streak", async ({ page }) => {
  await page.addInitScript(() => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "versekeep-med-streak-v1") {
        throw new DOMException("Storage denied", "QuotaExceededError");
      }
      return setItem.call(this, key, value);
    };
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator("#med-amen").click();

  await expect(page.locator("#med-feedback")).toHaveText(
    "Amen marked for this visit. Device storage could not save the streak.",
  );
  await expect(page.locator("#med-streak")).toContainText("Streak 1 day · Amen today");
  await expect(page.locator("#med-streak .med-week-dot.is-today.is-filled")).toHaveCount(1);
  expect(await page.evaluate(() => localStorage.getItem("versekeep-med-streak-v1"))).toBeNull();

  await page.locator("#med-amen").click();
  await expect(page.locator("#med-feedback")).toHaveText(
    "Amen already marked for this calendar day.",
  );
  await expect(page.locator("#med-streak")).toContainText("Streak 1 day · Amen today");
});

test("keeps meditation place session-safe and honest when device storage is denied", async ({ page }) => {
  await page.addInitScript(() => {
    const setItem = Storage.prototype.setItem;
    globalThis.__versekeepMedWritesAllowed = false;
    Storage.prototype.setItem = function (key, value) {
      if (key === "versekeep-meditate-v1" && !globalThis.__versekeepMedWritesAllowed) {
        throw new DOMException("Storage denied", "QuotaExceededError");
      }
      return setItem.call(this, key, value);
    };
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  const firstRef = await page.locator("#meditate-card .med-ref").innerText();
  await page.locator("#med-next").click();
  await expect(page.locator("#meditate-card .med-ref")).not.toHaveText(firstRef);
  const storageStatus = page.locator("#med-storage-status");
  await expect(storageStatus).toBeVisible();
  await expect(storageStatus).toHaveText(
    "Meditation place is kept for this visit only; device storage is blocked.",
  );
  expect(await page.evaluate(() => localStorage.getItem("versekeep-meditate-v1"))).toBeNull();

  await page.evaluate(() => {
    globalThis.__versekeepMedWritesAllowed = true;
  });
  await page.locator("#med-next").click();
  await expect(storageStatus).toBeHidden();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("versekeep-meditate-v1")));
  expect(saved.ref).toBeTruthy();
});

test("rejects an invalid playlist catalog without exposing diagnostics", async ({ page }) => {
  await page.route("**/data/playlists.json", (route) =>
    route.fulfill({ json: { youtube: {}, spotify: [] } })
  );
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const error = page.locator("#ambient-error");
  await expect(error).toBeVisible();
  await expect(error).toHaveText("Could not load music stations. Please refresh or try again later.");
  await expect(error).not.toContainText("youtube must be a non-empty array");
  await expect(page.locator("#music-list [data-music-id]")).toHaveCount(0);
  await expect(page.locator("#meditate-card .med-ref")).not.toHaveText("");
});

test("rejects an invalid remote wallpaper catalog and keeps bundled wallpapers", async ({ page }) => {
  await page.route("**/data/remote-wallpapers.json", (route) =>
    route.fulfill({ json: { pool: [{ id: "unsafe", unsplash: "javascript:alert(1)" }] } })
  );
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const error = page.locator("#ambient-error");
  await expect(error).toBeVisible();
  await expect(error).toHaveText(
    "Daily wallpaper suggestions are unavailable. Bundled wallpapers are still ready."
  );
  await expect(error).not.toContainText("Unsplash photo identifier");
  await expect(page.locator("#wallpaper-grid .wp-card")).not.toHaveCount(0);
  await expect(page.locator("#meditate-card .med-ref")).not.toHaveText("");
});

test("rejects invalid bundled wallpaper metadata without exposing diagnostics", async ({ page }) => {
  await page.route("**/data/wallpapers.json", (route) =>
    route.fulfill({
      json: {
        wallpapers: [{
          id: "Unsafe ID",
          title: "Unsafe",
          blurb: "Malformed fixture",
          tags: ["Test"],
          tone: "Unsafe Tone",
          style: "classic",
        }],
      },
    })
  );
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const error = page.locator("#ambient-error");
  await expect(error).toBeVisible();
  await expect(error).toHaveText("Could not load wallpapers. Please refresh or try again later.");
  await expect(error).not.toContainText("lowercase slug");
  await expect(page.locator("#wallpaper-grid .wp-card")).toHaveCount(0);
  await expect(page.locator("#meditate-card .med-ref")).not.toHaveText("");
});

test("first screen shows primary action with sections collapsed", async ({ page }) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1366, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page.locator("#med-amen")).toBeVisible();
    await expect(page.locator("#meditate-card .med-ref")).not.toHaveText("");
    await expect(page.locator("#bible-books")).toBeVisible();
    for (const selector of [
      "#topics-disclosure",
      "#books-disclosure",
      "#memorize-disclosure",
      "#med-options",
      ".med-reflect",
    ]) {
      await expect(page.locator(selector)).toHaveJSProperty("open", false);
    }
    await expect(page.locator("#theme-grid")).toBeHidden();
    await expect(page.locator("#book-grid")).toBeHidden();

    await page.locator("#books-disclosure > summary").click();
    await expect(page.locator("#books-disclosure")).toHaveJSProperty("open", true);
    const proverbs = page.locator('#book-grid [data-book="proverbs"]');
    await expect(proverbs).toBeVisible();
    await expect(proverbs).toContainText("Proverbs");

    const summary = page.locator("#topics-disclosure > summary");
    await summary.focus();
    await expect(summary).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#topics-disclosure")).toHaveJSProperty("open", true);
    await page.keyboard.press("Enter");
    await expect(page.locator("#topics-disclosure")).toHaveJSProperty("open", false);
    await expect(page.locator("#theme-grid")).toBeHidden();
  }
});

test("keeps the compact header and persistent music dock usable on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const topbar = page.locator(".topbar");
  await expect(topbar).toBeVisible();
  await expect(page.locator(".hero")).toHaveCount(0);
  await expect(page.locator("#nav-music")).toBeVisible();
  await expect(page.locator(".top-nav .nav-more > summary")).toBeVisible();
  await expect(page.locator(".top-nav a[href='#topics']")).toBeHidden();
  await expect(page.locator(".top-nav .nav-extra").first()).toBeHidden();

  // Collapsed sections leave a short phone page, so scroll within the real range.
  // Down past the header hides it; a smaller position still below the top brings it back.
  const travel = await page.evaluate(() => {
    const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const header = document.querySelector(".topbar")?.offsetHeight || 0;
    return { max, header };
  });
  expect(travel.max).toBeGreaterThan(travel.header);
  const upward = Math.min(Math.max(24, Math.floor(travel.max / 2)), travel.max - 1);
  expect(upward).toBeLessThan(travel.max);
  await page.evaluate((y) => window.scrollTo(0, y), travel.max);
  await expect(topbar).toHaveClass(/is-scroll-hidden/);
  await page.evaluate((y) => window.scrollTo(0, y), upward);
  await expect(topbar).not.toHaveClass(/is-scroll-hidden/);

  const dock = page.locator("#worship");
  const tab = page.locator("#music-dock-tab");
  const panel = page.locator("#music-dock-panel");
  const scrim = page.locator("#music-dock-scrim");
  const frame = page.locator("#music-frame");
  await expect(page.locator("#music-list [data-music-id]")).not.toHaveCount(0);
  await expect(frame).toHaveAttribute("src", /spotify\.com\/embed\/playlist/);
  const playingSrc = await frame.getAttribute("src");

  await tab.click();
  await expect(dock).toHaveClass(/is-open/);
  await expect(tab).toHaveAttribute("aria-expanded", "true");
  await expect(panel).toHaveAttribute("aria-hidden", "false");
  await expect(panel).toBeVisible();
  await expect(scrim).toBeVisible();
  expect(await page.locator("#music-player-shell").evaluate((node) => node.parentElement?.id)).toBe(
    "music-player-slot"
  );

  const panelBox = await panel.boundingBox();
  expect(panelBox).not.toBeNull();
  expect(panelBox.x).toBeGreaterThanOrEqual(0);
  expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(390.5);

  await scrim.click({ position: { x: 380, y: 820 } });
  await expect(tab).toHaveAttribute("aria-expanded", "false");
  await expect(panel).toHaveAttribute("aria-hidden", "true");
  await expect(scrim).toBeHidden();
  await expect(frame).toHaveAttribute("src", playingSrc);

  await page.locator("#nav-music").click();
  await expect(tab).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(tab).toHaveAttribute("aria-expanded", "false");
  await expect(frame).toHaveAttribute("src", playingSrc);
});

test("exposes music sources as a pressed-button group", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator("#music-dock-tab").click();

  const sources = page.getByRole("group", { name: "Music source" });
  await expect(sources).toBeVisible();
  await expect(page.getByRole("tablist", { name: "Music source" })).toHaveCount(0);
  await expect(sources.getByRole("button", { name: "Spotify" })).toHaveAttribute(
    "aria-pressed",
    "true"
  );

  await sources.getByRole("button", { name: "YouTube" }).click();
  await expect(sources.getByRole("button", { name: "YouTube" })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(sources.getByRole("button", { name: "Spotify" })).toHaveAttribute(
    "aria-pressed",
    "false"
  );
  await expect(page.locator("#music-list [data-music-id]")).not.toHaveCount(0);
});

test("focus mode hides More and the music dock without stopping playback", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const frame = page.locator("#music-frame");
  await expect(frame).toHaveAttribute("src", /spotify\.com\/embed\/playlist/);
  const playingSrc = await frame.getAttribute("src");

  await expect(page.locator("#med-more")).toBeVisible();
  await expect(page.locator("#music-dock-tab")).toBeVisible();
  await expect(page.locator("#med-amen")).toBeVisible();

  await openMedMore(page);
  await page.locator("#med-focus").click();
  await expect(page.locator("body")).toHaveClass(/med-focus/);
  await expect(page.locator("#med-focus")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#med-more")).toBeHidden();
  await expect(page.locator("#med-more-panel")).toBeHidden();
  await expect(page.locator("#music-dock-tab")).toBeHidden();
  await expect(page.locator("#med-amen")).toBeVisible();
  await expect(page.locator("#med-prev")).toBeVisible();
  await expect(page.locator("#med-next")).toBeVisible();
  await expect(frame).toHaveAttribute("src", playingSrc);

  await openMedMore(page);
  await page.locator("#med-focus").click();
  await expect(page.locator("body")).not.toHaveClass(/med-focus/);
  await expect(page.locator("#med-more")).toBeVisible();
  await expect(page.locator("#music-dock-tab")).toBeVisible();
  await expect(frame).toHaveAttribute("src", playingSrc);
});

test("offers yesterday's last verse as a resume chip on the meditation card", async ({ page }) => {
  await page.addInitScript(() => {
    const now = new Date();
    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const daySeed =
      yesterdayDate.getFullYear() * 10000 +
      (yesterdayDate.getMonth() + 1) * 100 +
      yesterdayDate.getDate();
    localStorage.setItem(
      "versekeep-prefs-v1",
      JSON.stringify({ lastMedTopic: "gospel" }),
    );
    localStorage.setItem(
      "versekeep-meditate-v1",
      JSON.stringify({ topicId: "trusting-god", ref: "Psalm 56:3", day: daySeed }),
    );
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.locator("#load-error")).toBeHidden();
  await expect(page.locator('#med-topics [data-topic="gospel"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("#meditate-card .med-ref")).not.toHaveText("Psalm 56:3");
  const chip = page.locator("#med-resume");
  await expect(chip).toBeVisible();
  await expect(chip).toHaveText("Resume last · Psalm 56:3");
  await expect(page.locator("#resume-hint")).toBeHidden();

  await chip.click();
  await expect(page.locator("#meditate-card .med-ref")).toHaveText("Psalm 56:3");
  await expect(page.locator('#med-topics [data-topic="trusting-god"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("#med-resume")).toHaveCount(0);
});

test("shows a memorize empty state until practice opens", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "versekeep-stats-v1",
      JSON.stringify({
        checks: 1,
        correct: 1,
        lastTheme: "gospel",
      })
    );
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await page.locator('.top-nav a[href="#themes"]').click();
  await expect(page).toHaveURL(/#themes$/);
  await expect(page.locator("#play-panel")).toBeHidden();

  const empty = page.locator("#memorize-empty");
  await expect(empty).toBeVisible();
  await expect(empty).toContainText("Resume your last drill");
  await expect(page.getByRole("group", { name: "Memorize topics" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Start a drill" })).toBeVisible();

  await page.locator("#btn-resume-drill").click();
  await expect(page.locator("#play-panel")).toBeVisible();
  await expect(empty).toBeHidden();
  await expect(page.locator("#theme-label")).toContainText("Gospel");
});

test("opens a shared meditation URL and copies a canonical link", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: "http://127.0.0.1:4174",
  });

  await page.addInitScript(() => {
    localStorage.setItem(
      "versekeep-prefs-v1",
      JSON.stringify({ lastMedTopic: "gods-character", translation: "esv" }),
    );
    const now = new Date();
    const daySeed = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
    localStorage.setItem(
      "versekeep-meditate-v1",
      JSON.stringify({ topicId: "gods-character", ref: "Exodus 34:6", day: daySeed }),
    );
  });

  await page.goto("/?v=Proverbs+3:5-6&t=trusting-god&tr=niv#meditate", {
    waitUntil: "domcontentloaded",
  });

  await expect(page.locator("#load-error")).toBeHidden();
  await expect(page.locator("#meditate-card .med-ref")).toHaveText("Proverbs 3:5–6");
  await expect(page.locator('#med-topics [data-topic="trusting-god"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("#tr-select")).toHaveValue("niv");
  await expect(page).toHaveURL(/v=Proverbs(\+|%20)3%3A5(%E2%80%93|–|-)6/);
  await expect(page).toHaveURL(/t=trusting-god/);
  await expect(page).toHaveURL(/tr=niv/);
  await expect(page).toHaveURL(/#meditate$/);

  await page.locator("#med-next").click();
  await expect(page.locator("#meditate-card .med-ref")).not.toHaveText("Proverbs 3:5–6");
  await expect.poll(() => new URL(page.url()).searchParams.get("v")).not.toBe("Proverbs 3:5–6");
  const afterNext = new URL(page.url());
  expect(afterNext.searchParams.get("t")).toBe("trusting-god");
  expect(afterNext.searchParams.get("tr")).toBe("niv");

  await page.locator("#med-more").click();
  await page.locator("#med-copy-link").click();
  await expect(page.locator("#med-feedback")).toHaveText("Copied meditation link.");
  const copied = new URL(await page.evaluate(() => navigator.clipboard.readText()));
  expect(copied.searchParams.get("t")).toBe("trusting-god");
  expect(copied.searchParams.get("tr")).toBe("niv");
  expect(copied.searchParams.get("v")).toBe(afterNext.searchParams.get("v"));
  expect(copied.hash).toBe("#meditate");

  await page.goto("/?v=DefinitelyNotAVerse&t=not-a-theme&tr=kjv#meditate", {
    waitUntil: "domcontentloaded",
  });
  await expect(page.locator("#load-error")).toBeHidden();
  await expect(page.locator("#meditate-card .med-ref")).not.toHaveText("");
  await expect(page.locator("#meditate-card .med-ref")).not.toHaveText("DefinitelyNotAVerse");
  await expect(page.locator('#med-topics [data-topic="not-a-theme"]')).toHaveCount(0);
  const recovered = new URL(page.url());
  expect(recovered.searchParams.get("v")).toBeTruthy();
  expect(recovered.searchParams.get("v")).not.toBe("DefinitelyNotAVerse");
});

test("practices the meditation verse only from Practice this verse", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.locator("#meditate-card .med-ref")).not.toHaveText("");
  const ref = (await page.locator("#meditate-card .med-ref").textContent())?.trim();
  expect(ref).toBeTruthy();
  await openMedMore(page);
  await expect(page.locator("#med-practice-verse")).toBeVisible();
  await expect(page.locator("#med-practice-verse")).toHaveText("Practice this verse");
  await expect(page.locator("#play-panel")).toBeHidden();

  await page.locator("#med-amen").click();
  await expect(page.locator("#med-practice-verse")).toHaveClass(/is-offered/);
  await expect(page.locator("#med-practice-verse")).toHaveClass(/primary/);

  await openMedMore(page);
  await page.locator("#med-practice-verse").click();
  await expect(page.locator("#play-panel")).toBeVisible();
  await expect(page.locator('#play-panel [data-mode="blank"]')).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(page.locator("#stage .ref")).toHaveText(ref);
  await expect(page.locator("#hud-progress")).toContainText("1 / 1");
  await expect(page.locator("#hud-score")).toContainText("Score");
  await expect(page.locator("#hud-streak")).toContainText("Streak");
  // Re-entering the same mode calls updateHud; identical strings must not rewrite the DOM.
  const hudWrites = await page.evaluate(async () => {
    const ids = ["hud-progress", "hud-score", "hud-streak"];
    let writes = 0;
    const observers = ids.map((id) => {
      const el = document.getElementById(id);
      if (!el) throw new Error(`missing ${id}`);
      const obs = new MutationObserver(() => {
        writes += 1;
      });
      obs.observe(el, { characterData: true, childList: true, subtree: true });
      return obs;
    });
    document.querySelector('#play-panel [data-mode="blank"]')?.click();
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    );
    observers.forEach((obs) => obs.disconnect());
    return writes;
  });
  expect(hudWrites).toBe(0);
  await expect(page.locator("#stage .blank-input").first()).toBeVisible();

  await openMedMore(page);
  await expect(page.locator("#med-drill")).toBeVisible();
  const drillTitle = (await page.locator("#med-drill").textContent())
    ?.replace(/^Drill ·\s*/, "")
    .trim();
  await openMedMore(page);
  await page.locator("#med-drill").click();
  await expect(page.locator("#play-panel")).toBeVisible();
  await expect(page.locator("#hud-progress")).toHaveText(/Verse\s+1 \/ [2-9]/);
  if (drillTitle) {
    await expect(page.locator("#theme-label")).toContainText(drillTitle);
  }
});

test("finishes focused verse practice without inflating completed topics", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await openMedMore(page);
  await expect(page.locator("#med-practice-verse")).toBeVisible();

  await openMedMore(page);
  await page.locator("#med-practice-verse").click();
  await expect(page.locator("#hud-progress")).toContainText("1 / 1");
  await expect(page.locator("#btn-next")).toHaveAccessibleName("Finish practice");
  await page.locator("#btn-next").click();

  const completion = page.locator("#stage .practice-complete");
  await expect(completion).toBeVisible();
  await expect(completion).toContainText("Practice complete");
  await expect(completion).toContainText("does not change Themes done");
  await expect(completion).toBeFocused();
  await expect(page.locator("#practice-actions")).toBeHidden();
  await expect(page.locator("#practice-auto-advance")).toBeHidden();
  await expect(page.locator("#stats-bar")).toContainText("Themes done 0");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
  ).toBe(true);

  await completion.getByRole("button", { name: "Practice again" }).click();
  await expect(page.locator("#stage .blank-input").first()).toBeVisible();
  await expect(page.locator("#practice-actions")).toBeVisible();
  await expect(page.locator("#stats-bar")).toContainText("Themes done 0");

  await page.locator("#btn-next").click();
  await page.getByRole("button", { name: "Choose another topic", exact: true }).click();
  await expect(page.locator("#play-panel")).toBeHidden();
  await expect(page.locator("#memorize-empty")).toBeVisible();
  await expect(page.locator("#theme-search")).toBeFocused();
});

test("shows a stable topic completion summary before an intentional restart", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await openTopics(page);
  await page.locator("#theme-grid [data-drill]").first().click();
  await expect(page.locator("#play-panel")).toBeVisible();

  const progress = await page.locator("#hud-progress").textContent();
  const total = Number(/\/\s*(\d+)/.exec(progress || "")?.[1]);
  expect(total).toBeGreaterThan(1);
  for (let index = 1; index < total; index += 1) {
    await page.locator("#btn-next").click();
  }
  await expect(page.locator("#btn-next")).toHaveAccessibleName("Finish theme");
  await page.locator("#btn-next").click();

  const completion = page.locator("#stage .practice-complete");
  await expect(completion).toContainText("Topic complete");
  await expect(completion).toContainText(`${total}-verse set`);
  await expect(completion).toContainText("added to Themes done");
  await expect(page.locator("#hud-progress")).toHaveText(`Complete · ${total} / ${total}`);
  await expect(page.locator("#stats-bar")).toContainText("Themes done 1");

  await page.keyboard.press("r");
  await expect(page.locator("#feedback")).toBeHidden();
  await page.keyboard.press("n");
  await expect(page.locator("#stats-bar")).toContainText("Themes done 1");
  await completion.getByRole("button", { name: "Practice again" }).click();
  await expect(completion).toHaveCount(0);
  await expect(page.locator("#hud-progress")).toHaveText(`Verse 1 / ${total}`);
  await expect(page.locator("#stats-bar")).toContainText("Themes done 1");
});


test("keeps a wallpaper heart locally when its community counter fails", async ({ page }) => {
  await page.addInitScript(() => {
    const originalFetch = window.fetch;
    window.fetch = (input, options) => {
      if (String(input).includes("api.counterapi.dev") && String(input).endsWith("/up")) {
        return Promise.reject(new TypeError("Counter is offline"));
      }
      return originalFetch(input, options);
    };
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator("#wp-details > summary").click();
  const card = page.locator("#wallpaper-grid .wp-card").first();
  await expect(card).toBeVisible();
  const id = await card.getAttribute("data-wp-id");
  await card.locator("[data-heart]").click();
  const selected = page.locator(`#wallpaper-grid [data-wp-id="${id}"]`);
  await expect(selected.locator("[data-heart]")).toHaveAttribute("aria-pressed", "true");
  await expect(selected.getByRole("status")).toContainText("Community counter unavailable");
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem("versekeep-wallpaper-hearts-v1"))[key], id)).toBe(true);
  await selected.locator("[data-heart]").click();
  await expect(selected.locator("[data-heart]")).toHaveAttribute("aria-pressed", "false");
  await expect(selected.getByRole("status")).toHaveCount(0);
});

test('only the newest selected device backup can replace progress', async ({ page }) => {
  await page.addInitScript(() => {
    const original = File.prototype.text;
    File.prototype.text = function () {
      if (this.name !== 'slow.json') return original.call(this);
      return new Promise(resolve => { window.__releaseOldBackup = async () => resolve(await original.call(this)); });
    };
  });
  await page.goto('/');
  await expect(page.locator('#theme-grid [data-theme]')).not.toHaveCount(0);
  const snapshot = await page.evaluate(() => window.VerseKeepSession.exportSnapshot({practice: {checks: 3}}).snapshot);
  let dialogs = 0;
  page.on('dialog', dialog => { dialogs++; return dialog.accept(); });
  await page.locator('#device-import-file').setInputFiles({name:'slow.json', mimeType:'application/json', buffer:Buffer.from(JSON.stringify(snapshot))});
  snapshot.practice.checks = 7;
  await page.locator('#device-import-file').setInputFiles({name:'new.json', mimeType:'application/json', buffer:Buffer.from(JSON.stringify(snapshot))});
  await expect(page.locator('#device-data-status')).toContainText('Restored practice');
  await page.evaluate(() => window.__releaseOldBackup());
  await page.waitForTimeout(100);
  expect(dialogs).toBe(1);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('versekeep-stats-v1')).checks)).toBe(7);
});

test('rejects an oversized backup before reading it or confirming replacement', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#theme-grid [data-theme]')).not.toHaveCount(0);
  const before = await page.evaluate(() => localStorage.getItem('versekeep-stats-v1'));
  let dialogs = 0;
  page.on('dialog', dialog => { dialogs++; return dialog.dismiss(); });
  await page.evaluate(() => {
    const file = new File(['{}'], 'large.json', {type:'application/json'});
    Object.defineProperty(file, 'size', {value:8 * 1024 * 1024 + 1});
    window.__backupReads = 0;
    file.text = async () => { window.__backupReads++; return '{}'; };
    const input = document.querySelector('#device-import-file');
    Object.defineProperty(input, 'files', {configurable:true,value:[file]});
    input.dispatchEvent(new Event('change', {bubbles:true}));
  });
  await expect(page.locator('#device-data-status')).toContainText('exceeds 8 MB');
  expect(await page.evaluate(() => window.__backupReads)).toBe(0);
  expect(await page.evaluate(() => localStorage.getItem('versekeep-stats-v1'))).toBe(before);
  expect(dialogs).toBe(0);
});

test("Amen calendar labels refresh after midnight without changing the selected verse", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-11T23:59:30") });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#meditate-card .med-ref")).not.toBeEmpty();
  await page.evaluate(() => window.VerseKeepMeditate.replaceStreak({
    count: 3, lastDay: "2026-10-11", history: [{ day: "2026-10-11", ref: "Psalm 56:3" }],
  }));
  await expect(page.locator("#med-streak")).toContainText("Amen today");
  const verse = await page.locator("#meditate-card .med-ref").textContent();
  await page.clock.fastForward(60_000);
  await expect(page.locator("#med-streak")).toContainText("mark Amen to continue");
  await expect(page.locator("#meditate-card .med-ref")).toHaveText(verse);
});

test("composition Enter finishes typing without submitting or advancing a drill", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await openTopics(page);
  await page.locator("#theme-grid [data-drill]").first().click();
  await page.locator('#play-panel [data-mode="type"]').click();
  await page.locator("#type-input").fill("still composing");
  const before = await page.locator("#feedback").textContent();
  await page.locator("#type-input").evaluate((field) => field.dispatchEvent(new KeyboardEvent("keydown", {
    key: "Enter", ctrlKey: true, isComposing: true, bubbles: true, cancelable: true,
  })));
  await expect(page.locator("#feedback")).toHaveText(before || "");
  await page.locator('#play-panel [data-mode="blank"]').click();
  const first = page.locator("#stage .blank-input").first();
  await first.focus();
  await first.evaluate((field) => field.dispatchEvent(new KeyboardEvent("keydown", {
    key: "Enter", isComposing: true, bubbles: true, cancelable: true,
  })));
  await expect(first).toBeFocused();
});


test('practice shortcuts preserve native buttons, selects and composition', async ({ page }) => {
  await page.goto('/');
  await openTopics(page);
  await page.locator('#theme-grid [data-drill]').first().click();
  await page.locator('#play-panel [data-mode="blank"]').click();
  const reveal = page.locator('#btn-reveal');
  await reveal.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#feedback')).toHaveClass(/\bok\b/);
  await expect(page.locator('#feedback')).toContainText(':');
  await page.locator('#play-panel [data-mode="study"]').click();
  await openMedOptions(page);
  const select = page.locator('#tr-select');
  await select.focus();
  await select.evaluate(field => field.dispatchEvent(new KeyboardEvent('keydown', {key:'1',bubbles:true,cancelable:true})));
  await expect(page.locator('#play-panel [data-mode="study"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#stage').evaluate(field => {
    field.tabIndex = -1; field.focus();
    field.dispatchEvent(new KeyboardEvent('keydown', {key:'2',isComposing:true,bubbles:true,cancelable:true}));
  });
  await expect(page.locator('#play-panel [data-mode="study"]')).toHaveAttribute('aria-pressed', 'true');
});

test("practices Proverbs from Bible books without incrementing Themes done", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const section = page.getByRole("region", { name: "Bible books", exact: true });
  await expect(section).toBeVisible();
  await expect(section).toContainText("18 verses");
  await openBooks(page);
  await section.getByRole("button", { name: "Drill Proverbs", exact: true }).click();
  await expect(page.locator("#play-panel")).toBeVisible();
  await expect(page.locator("#stage .ref")).toContainText("Proverbs 1:7");
  await page.locator('#play-panel [data-mode="blank"]').click();
  await expect(page.locator("#stage .blank-input").first()).toBeVisible();
  await page.locator("#btn-reveal").click();
  await expect(page.locator("#feedback")).toContainText("The fear of the Lord");
  await page.locator("#btn-next").click();
  await expect(page.locator("#hud-progress")).toHaveText("Verse 2 / 18");
  for (let index = 2; index < 18; index += 1) await page.locator("#btn-next").click();
  await expect(page.locator("#btn-next")).toHaveAccessibleName("Finish book");
  await page.locator("#btn-next").click();
  await expect(page.locator("#stage .practice-complete")).toContainText("Book complete");
  await expect(page.locator("#stage .practice-complete")).toContainText("Book practice does not change Themes done");
  await expect(page.locator("#stats-bar")).toContainText("Themes done 0");
  const chooser = page.getByRole("button", { name: "Choose another book", exact: true });
  await expect(chooser).toHaveAttribute("data-tip", "Choose another book");
  await expect(chooser.locator(".icon-face svg")).toBeVisible();
  await page.locator("#books-disclosure").evaluate(node => { node.open = false; });
  await chooser.click();
  await expect(page.locator("#books-disclosure")).toHaveJSProperty("open", true);
  await expect(page.locator("#books-disclosure > summary")).toBeFocused();
  await expect(page.locator("#play-panel")).toBeHidden();
  await section.getByRole("button", { name: "Drill Proverbs", exact: true }).click();
  for (let index = 0; index < 18; index += 1) await page.locator("#btn-next").click();
  await page.getByRole("button", { name: "Practice again", exact: true }).click();
  await expect(page.locator("#hud-progress")).toHaveText("Verse 1 / 18");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});


test("practice icons expose keyboard tooltips and fit a 390px screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?v=Psalm%2056%3A3");
  await expect(page.locator(".med-ref")).toHaveText("Psalm 56:3");
  await page.evaluate(() => {
    window.VerseKeepBible.resolveVerse = async (ref, localText) =>
      ({ text: localText, translation: "ESV", source: "test" });
  });
  await openMedMore(page);
  await page.locator("#med-practice-verse").click();
  await expect(page.locator("#stage .ref")).toHaveText("Psalm 56:3");
  await expect(page.locator("#live-bible-label")).toHaveText("(ESV · test)");
  const reveal = page.getByRole("button", { name: "Reveal", exact: true });
  await page.mouse.move(0, 0);
  await page.getByRole("button", { name: "Check", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(reveal).toBeFocused();
  await expect(page.locator("#vk-tip")).toBeVisible();
  await expect(page.locator("#vk-tip")).toHaveText("Reveal");
  await expect(reveal).toHaveAttribute("aria-describedby", "vk-tip");
  // A stale pointer exit and viewport changes must preserve a keyboard tip.
  await reveal.dispatchEvent("mouseleave");
  await page.evaluate(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    window.dispatchEvent(new Event("scroll"));
    window.dispatchEvent(new Event("resize"));
  });
  await expect(reveal).toBeFocused();
  await expect(page.locator("#vk-tip")).toBeVisible();
  await expect(reveal).toHaveAttribute("aria-describedby", "vk-tip");
  await page.keyboard.press("Tab");
  await expect(reveal).not.toHaveAttribute("aria-describedby");
  await expect(reveal).toHaveAttribute("data-tip", "Reveal");
  await expect(reveal).not.toHaveAttribute("title");
  for (const id of ["btn-reveal", "btn-prev", "btn-next", "btn-more"]) {
    const button = page.locator(`#${id}`);
    const box = await button.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    const face = await button.locator(".icon-face").boundingBox();
    expect(face.width).toBe(32);
    expect(face.height).toBe(32);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const summaries = await page.locator("summary").evaluateAll(nodes => nodes.every(el => !el.querySelector("p, span h2")));
  expect(summaries).toBe(true);
});

for (const width of [390, 320]) {
  test(`practice icon geometry and single action row at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/?v=Psalm%2056%3A3");
    await openMedMore(page);
    const row = await page.locator(".med-dock-primary").boundingBox();
    const panel = await page.locator("#med-more-panel").boundingBox();
    expect(panel.y).toBeGreaterThanOrEqual(row.y + row.height);
    await page.locator("#med-practice-verse").click();
    await expect(page.locator("#btn-check")).toBeVisible();
    await page.locator("#practice-actions").scrollIntoViewIfNeeded();
    const buttons = page.locator("#practice-actions > button");
    await expect(buttons).toHaveCount(5);
    const boxes = await buttons.evaluateAll(nodes => nodes.map(node => {
      const rect = node.getBoundingClientRect();
      return { centerY: rect.top + rect.height / 2, left: rect.left, right: rect.right };
    }));
    expect(Math.max(...boxes.map(b => b.centerY)) - Math.min(...boxes.map(b => b.centerY))).toBeLessThanOrEqual(2);
    expect(boxes[0].left).toBeGreaterThanOrEqual(0);
    expect(boxes.at(-1).right).toBeLessThanOrEqual(width);
    for (const control of await page.locator("#practice-actions .icon-control").all()) {
      const box = await control.boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      const face = await control.locator(".icon-face").boundingBox();
      expect(face.width).toBe(32);
      expect(face.height).toBe(32);
      await expect(control.locator("svg")).toHaveAttribute("stroke-width", "1.75");
      expect((await control.textContent()).trim()).toBe("");
      // Targets overlap horizontally to keep a 4px face gap; verify the full vertical hit area.
      expect(await control.evaluate(node => {
        const r = node.querySelector(".icon-face").getBoundingClientRect();
        return [
          [r.left + r.width / 2, r.top + r.height / 2],
          [r.left + r.width / 2, r.top - 5],
          [r.left + r.width / 2, r.bottom + 5],
        ].every(([x, y]) => document.elementFromPoint(x, y)?.closest("button") === node);
      })).toBe(true);
    }
    const faces = await page.locator("#practice-actions .icon-face").evaluateAll(nodes =>
      nodes.map(node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right }; }));
    for (let i = 1; i < faces.length; i++) {
      expect(faces[i].left - faces[i - 1].right).toBe(4);
    }
    await expect(page.locator('#btn-next svg')).toHaveAttribute('stroke-width', '1.75');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test("touch tap shows Reveal label for about 1.5 seconds", async ({ browser }) => {
  const context = await browser.newContext({ baseURL: "http://127.0.0.1:4174", hasTouch: true, viewport: { width: 320, height: 844 } });
  const page = await context.newPage();
  try {
    await page.goto("/?v=Psalm%2056%3A3");
    await openMedMore(page);
    await page.locator("#med-practice-verse").click();
    await page.tap("#btn-reveal");
    await expect(page.locator("#vk-tip")).toBeVisible();
    await expect(page.locator("#vk-tip")).toHaveText("Reveal");
    await page.waitForTimeout(1000);
    await expect(page.locator("#vk-tip")).toBeVisible();
    await expect(page.locator("#vk-tip")).toBeHidden({ timeout: 1000 });
  } finally {
    await context.close();
  }
});

test("meditation topic pill starts with its catalog emoji", async ({ page }) => {
  const catalog = JSON.parse(readFileSync(new URL("../../docs/data/verses.json", import.meta.url), "utf8"));
  const theme = catalog.themes.find(theme => theme.verses.some(verse => verse.ref === "Psalm 56:3"));
  expect(theme.emoji).toBeTruthy();
  await page.goto("/?v=Psalm%2056%3A3");
  await expect(page.locator("#meditate-card .med-ref")).toHaveText("Psalm 56:3");
  await expect.poll(async () => (await page.locator("#meditate-card .med-topic-pill").innerText()).trim().startsWith(theme.emoji)).toBe(true);
});

test('practice More menu groups, keyboard navigation, and outlined Check', async ({ page }) => {
  await page.goto('/?v=Psalm%2056%3A3');
  await openMedMore(page);
  await page.locator('#med-practice-verse').click();
  const more = page.getByRole('button', { name: 'More options', exact: true });
  await more.click();
  const menu = page.getByRole('menu', { name: 'Practice options' });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('group', { name: 'Verse', exact: true })).toBeVisible();
  await expect(menu.getByRole('group', { name: 'Settings', exact: true })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Shuffle', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'Copy', exact: true })).toBeFocused();
  const rowBox = await page.locator('#practice-actions').boundingBox();
  const menuBox = await menu.boundingBox();
  expect(menuBox.y).toBeGreaterThanOrEqual(rowBox.y + rowBox.height);
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(more).toBeFocused();
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  const outline = await page.locator('#btn-check').evaluate(node => {
    const s = getComputedStyle(node);
    return { width: parseFloat(s.borderTopWidth), style: s.borderTopStyle, color: s.borderTopColor, text: s.color, background: s.backgroundColor };
  });
  expect(outline.width).toBeGreaterThan(0);
  expect(outline.style).toBe('solid');
  expect(outline.color).toBe(outline.text);
  expect(outline.background).toBe('rgba(0, 0, 0, 0)');
  await more.click();
  await page.locator('#stage').click();
  await expect(menu).toBeHidden();
  await page.keyboard.press('s');
  await expect(page.locator('#feedback')).toHaveText('Queue shuffled.');
  await expect(menu).toBeHidden();
});

test('mobile music ghost control stays clear of content and opens mounted player', async ({ browser }) => {
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4174', hasTouch: true, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  try {
    await page.goto('/');
    const tab = page.getByRole('button', { name: 'Music', exact: true });
    await expect(tab).toHaveAttribute('data-tip', /Music · .+/);
    const box = await tab.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    const face = await tab.locator('.icon-face').boundingBox();
    expect(face.width).toBe(32);
    expect(face.height).toBe(32);
    const overlaps = await page.locator('#meditate-card, .med-dock-primary button, main .panel').evaluateAll((nodes, b) => nodes.filter(n => n.checkVisibility()).filter(n => {
      const r = n.getBoundingClientRect();
      return r.top < 844 && r.bottom > 0 && r.left < b.x + b.width && r.right > b.x && r.top < b.y + b.height && r.bottom > b.y;
    }).map(n => n.id), box);
    expect(overlaps).toEqual([]);
    const frame = page.locator('#music-frame');
    const src = await frame.getAttribute('src');
    await frame.evaluate(node => { window.musicFrameBefore = node; });
    await tab.tap();
    await expect(tab).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#music-dock-panel')).toBeVisible();
    await expect(page.locator('#vk-tip')).toContainText('Music ·');
    expect(await frame.evaluate(node => node === window.musicFrameBefore)).toBe(true);
    await expect(frame).toHaveAttribute('src', src);
  } finally { await context.close(); }
});

test('auto-advance has one tick and supports click, Space and Enter', async ({ page }) => {
  await page.goto('/?v=Psalm%2056%3A3');
  await openMedMore(page);
  await page.locator('#med-practice-verse').click();
  await page.getByRole('button', { name: 'More options', exact: true }).click();
  const toggle = page.getByRole('menuitemcheckbox', { name: 'Auto-advance after a correct answer' });
  await expect(page.locator('#practice-menu input')).toHaveCount(0);
  const initial = await toggle.getAttribute('aria-checked');
  let checked = initial === 'true';
  for (const action of ['click', 'Space', 'Enter']) {
    if (action === 'click') await toggle.click();
    else { await toggle.focus(); await page.keyboard.press(action); }
    checked = !checked;
    await expect(toggle).toHaveAttribute('aria-checked', String(checked));
    await expect(toggle.locator('svg')).toHaveCount(1);
    await expect(toggle.locator('[data-icon="check"]')).toHaveCSS('visibility', checked ? 'visible' : 'hidden');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('versekeep-prefs-v1')).autoAdvance)).toBe(checked);
  }
});

for (const width of [320, 390]) {
  test('meditation ghost row geometry at ' + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    const row = page.locator('.med-dock-primary');
    const boxes = [];
    for (const name of ['Previous verse', 'Next verse', 'Amen', 'More']) {
      const control = row.getByRole('button', { name, exact: true });
      await expect(control).toHaveAttribute('data-tip', name);
      const box = await control.boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      boxes.push(box);
      {
        const face = await control.locator('.icon-face').boundingBox();
        expect(face.width).toBe(32); expect(face.height).toBe(32);
      }
      await expect(control.locator('svg')).toHaveCSS('width', '18px');
    }
    const centers = boxes.map(box => box.y + box.height / 2);
    expect(Math.max(...centers) - Math.min(...centers)).toBeLessThanOrEqual(2);
    const amen = row.getByRole('button', { name: 'Amen', exact: true });
    await expect(amen).toHaveText('Amen');
    await expect(amen).toHaveCSS('border-top-width', '1px');
    await expect(amen).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  });
}


test("practice More closes on Tab without leaving focus in hidden content", async ({ page }) => {
  await page.goto("/");
  await openBooks(page);
  await page.getByRole("button", { name: "Drill Proverbs", exact: true }).click();
  const trigger = page.locator("#btn-more");
  const menu = page.locator("#practice-menu");
  await trigger.click();
  await expect(menu).toBeVisible();
  await page.keyboard.press("Shift+Tab");
  await expect(menu).toBeHidden();
  await expect(page.locator("#btn-next")).toBeFocused();
  await trigger.click();
  await page.keyboard.press("Tab");
  await expect(menu).toBeHidden();
  expect(await page.evaluate(() => document.activeElement !== document.body
    && !document.activeElement.closest("[hidden]"))).toBe(true);
});


test("last drill resumes the new Bible book after reload", async ({ page }) => {
  await page.goto("/");
  await openBooks(page);
  await page.getByRole("button", { name: "Drill Proverbs", exact: true }).click();
  await expect(page.locator("#hud-progress")).toHaveText("Verse 1 / 18");
  await page.reload();
  await expect(page.locator("#btn-resume")).toContainText("Proverbs");
  await page.locator("#btn-resume").click();
  await expect(page.locator("#stage .ref")).toContainText("Proverbs 1:7");
  await expect(page.locator("#stats-bar")).toContainText("Themes done 0");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("versekeep-stats-v1")).lastTheme)).toBe("proverbs");
});
