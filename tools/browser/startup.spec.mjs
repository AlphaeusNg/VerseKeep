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

  await expect(page.locator(".hero")).toHaveCount(0);
  await expect(page.locator(".top-nav > a[href='#meditate']")).toBeVisible();
  await expect(page.locator(".top-nav > a[href='#themes']")).toBeVisible();
  await expect(page.locator("#nav-music")).toBeVisible();
  await expect(page.locator(".top-nav > a[href='#topics']")).toHaveCount(0);
  await page.locator(".top-nav .nav-more > summary").click();
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
    "aria-pressed",
    "true"
  );
});

test("exposes meditation topics and feedback with matching semantics", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const topics = page.getByRole("group", { name: "Meditation topics" });
  await expect(topics).toBeVisible();
  await expect(topics.getByRole("button").first()).toHaveAttribute("aria-pressed", "true");

  await expect(page.locator("#med-streak")).toBeVisible();
  await expect(page.locator("#med-streak")).toContainText(
    "Sit with this, then tap Amen to start a streak"
  );
  await expect(page.locator("#med-streak .med-week-dot")).toHaveCount(7);
  await expect(page.locator("#med-streak .med-week-dot.is-today")).toHaveCount(1);
  await expect(page.locator("#med-streak .med-week-dot.is-today.is-filled")).toHaveCount(0);

  await expect(page.locator("#med-prev")).toBeVisible();
  await expect(page.locator("#med-next")).toBeVisible();
  await expect(page.locator("#med-amen")).toBeVisible();
  await expect(page.locator("#med-focus")).toBeVisible();
  await expect(page.locator("#med-more")).toBeVisible();
  await expect(page.locator("#med-today")).toBeHidden();
  await expect(page.locator("#med-shuffle")).toBeHidden();
  await expect(page.locator("#med-copy")).toBeHidden();
  await expect(page.locator("#med-share")).toBeHidden();
  await expect(page.locator("#med-listen")).toBeHidden();

  await page.locator("#med-more").click();
  await expect(page.locator("#med-more")).toHaveAttribute("aria-expanded", "true");
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
  await page.locator("#theme-grid [data-drill]").first().click();
  await expect(page.locator("#play-panel")).toBeVisible();

  const feedback = page.locator("#feedback");
  await page.locator("#btn-reveal").click();
  await expect(page.getByRole("status").filter({ hasText: /.+/ })).toBeVisible();
  await expect(feedback).not.toHaveText("");
  await expect(feedback).toHaveAttribute("aria-atomic", "true");

  await page.locator("#btn-copy").click();
  await expect(feedback).toHaveText("Verse copied to clipboard.");
  await page.locator("#btn-shuffle").click();
  await expect(feedback).toHaveText("Queue shuffled.");

  await page.locator('#play-panel [data-mode="type"]').click();
  await page.locator("#type-input").fill("not the verse");
  await page.locator("#btn-check").click();
  await expect(feedback).toContainText("Keep going");
});

test("exposes practice modes as a pressed-button group", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
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
  await expect(page.locator("#auto-advance")).toBeChecked();
  await expect(page.locator('#med-topics [data-topic="strength-trials"]')).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(page.locator("#meditate-card .med-topic-pill")).toContainText("Strength in Trials");
  await expect(page.locator("body")).toHaveClass(/med-focus/);
  await expect(page.locator("#med-focus")).toHaveAttribute("aria-pressed", "true");

  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("versekeep-prefs-v1")))).toEqual({
    mode: "quiz",
    translation: "niv",
    autoAdvance: true,
    lastMedTopic: "strength-trials",
    medFocus: true,
  });

  await page.locator("#med-focus").click();
  await expect(page.locator("body")).not.toHaveClass(/med-focus/);
  await page.locator("#med-more").click();
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
  await expect(page.locator("#med-feedback")).toHaveText("Amen already marked today.");
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem("versekeep-med-streak-v1"))),
  ).toEqual(afterAmen);
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

  await page.evaluate(() => window.scrollTo(0, 1000));
  await expect(topbar).toHaveClass(/is-scroll-hidden/);
  await page.evaluate(() => window.scrollTo(0, 600));
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
