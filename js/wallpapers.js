/**
 * VerseKeep wallpapers:
 * - Daily remote suggestions (curated Unsplash CDN, no API key)
 * - Manual "New suggestions" reshuffle
 * - Hearts (local + best-effort global counters)
 * - Featured strip: today's pick + most-hearted
 */
(function () {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);

  const PREF_KEY = "versekeep-wallpaper-pref-v2";
  const HEARTS_KEY = "versekeep-wallpaper-hearts-v1";
  const CATALOG_KEY = "versekeep-wallpaper-catalog-v1";
  const SALT_KEY = "versekeep-wallpaper-salt-v1";
  const DEFAULT_ID = "dawn-hills";
  const DAILY_COUNT = 6;
  const COUNTER_NS = "versekeepwp";

  let classics = [];
  let remotePool = [];
  let daily = [];
  let heartsLocal = {}; // id -> true if user hearted
  let heartCounts = {}; // id -> number (local + remote best effort)
  let catalog = {}; // id -> { id, title, blurb, src, download }
  let salt = 0;
  let applying = false;

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function dayKey(d = new Date()) {
    return d.toISOString().slice(0, 10);
  }

  function hashStr(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function unsplashUrl(photoId, { w = 1920, h = 1080, q = 80 } = {}) {
    return `https://images.unsplash.com/photo-${photoId}?auto=format&fit=crop&w=${w}&h=${h}&q=${q}`;
  }

  /** Full-res-ish URL for Open HD / download (same for classic + daily). */
  function hdUrl(w) {
    if (!w) return "";
    if (w.unsplash) return unsplashUrl(w.unsplash, { w: 2400, h: 1350, q: 90 });
    return w.download || w.src || "";
  }

  /**
   * Force a real file download (works for same-origin classics and CORS remotes like Unsplash).
   * Plain <a download> is ignored for cross-origin URLs — browsers just navigate/open instead.
   */
  async function downloadWallpaperFile(url, filename) {
    if (!url) return;
    const name = String(filename || "versekeep-wallpaper").replace(/[^\w.-]+/g, "_");
    const file = name.toLowerCase().endsWith(".jpg") || name.toLowerCase().endsWith(".jpeg") || name.toLowerCase().endsWith(".png")
      ? name
      : `${name}.jpg`;
    try {
      const res = await fetch(url, { mode: "cors", credentials: "omit", cache: "no-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = file;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 2500);
    } catch (err) {
      console.warn("[wallpapers] download failed, falling back", err);
      // Last resort: open in a new tab (user can save manually)
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  function picsumUrl(seed) {
    return `https://picsum.photos/seed/${encodeURIComponent(seed)}/1920/1080`;
  }

  function loadJson(path) {
    return fetch(path, { cache: "no-store" }).then((r) => {
      if (!r.ok) throw new Error(`${path}: ${r.status}`);
      return r.json();
    });
  }

  function loadHearts() {
    try {
      heartsLocal = JSON.parse(localStorage.getItem(HEARTS_KEY) || "{}") || {};
    } catch {
      heartsLocal = {};
    }
    try {
      catalog = JSON.parse(localStorage.getItem(CATALOG_KEY) || "{}") || {};
    } catch {
      catalog = {};
    }
    try {
      const s = localStorage.getItem(SALT_KEY);
      salt = s ? Number(s) || 0 : 0;
    } catch {
      salt = 0;
    }
  }

  function saveHearts() {
    try {
      localStorage.setItem(HEARTS_KEY, JSON.stringify(heartsLocal));
      localStorage.setItem(CATALOG_KEY, JSON.stringify(catalog));
    } catch {
      /* ignore */
    }
  }

  function rememberCatalog(w) {
    if (!w?.id) return;
    catalog[w.id] = {
      id: w.id,
      title: w.title || w.id,
      blurb: w.blurb || "",
      src: w.src || "",
      download: w.download || w.src || "",
      tags: normalizeTags(w.tags || w.tag),
      tone: w.tone || "",
    };
    try {
      localStorage.setItem(CATALOG_KEY, JSON.stringify(catalog));
    } catch {
      /* ignore */
    }
  }

  function loadPref() {
    try {
      const raw = localStorage.getItem(PREF_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function savePref(pref) {
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify(pref));
    } catch {
      /* ignore */
    }
  }

  function normalizeTags(raw) {
    if (Array.isArray(raw)) {
      return raw.map((t) => String(t || "").trim()).filter(Boolean).slice(0, 3);
    }
    if (typeof raw === "string" && raw.trim()) return [raw.trim()];
    return [];
  }

  function normalizeClassic(w) {
    return {
      ...w,
      kind: "classic",
      download: w.download || w.src || "",
      tags: normalizeTags(w.tags || w.tag),
      tone: w.tone || "",
    };
  }

  function normalizeRemote(item, day, index) {
    const photo = String(item.unsplash || "").replace(/^photo-/, "");
    const src = photo
      ? unsplashUrl(photo)
      : picsumUrl(`versekeep-${day}-${item.id}-${index}`);
    const download = photo ? unsplashUrl(photo, { w: 2400, h: 1350, q: 90 }) : src;
    const tags = normalizeTags(item.tags || item.tag);
    if (!tags.length) tags.push("Today’s light");
    return {
      id: item.id,
      title: item.title || "Daily light",
      blurb: item.blurb || "Today’s suggestion",
      src,
      download,
      kind: "daily",
      unsplash: photo,
      tags,
      tone: item.tone || "daily",
    };
  }

  /** Badge chips: personalized tags from catalog, with gentle fallbacks. */
  function badgeHtml(w, { showDailyBadge = false } = {}) {
    const tags = normalizeTags(w.tags);
    const tone = String(w.tone || "").toLowerCase().replace(/[^a-z0-9-]/g, "") || "classic";
    const chips = [];

    if (showDailyBadge || w.kind === "daily") {
      chips.push({ label: "Today", tone: "daily" });
    }

    if (tags.length) {
      tags.forEach((label) => {
        // Avoid duplicating "Today" style labels
        if (/^today/i.test(label) && chips.some((c) => c.tone === "daily")) return;
        chips.push({ label, tone });
      });
    } else if (String(w.id || "").startsWith("win-")) {
      chips.push({ label: "Yours", tone: "personal" });
    } else if (String(w.id || "").startsWith("lofi-")) {
      chips.push({ label: "Lo-fi", tone: "lofi" });
    } else if (w.id === "none") {
      chips.push({ label: "Minimal", tone: "minimal" });
    } else if (w.kind === "classic") {
      chips.push({ label: "Sanctuary", tone: "classic" });
    }

    if (!chips.length) return "";
    return `<div class="wp-badges">${chips
      .slice(0, 3)
      .map(
        (c) =>
          `<span class="wp-badge wp-badge-${escapeHtml(c.tone)}">${escapeHtml(c.label)}</span>`
      )
      .join("")}</div>`;
  }

  function pickDaily(pool, day, saltVal, count) {
    const list = pool.filter((p) => p && !p.disabled && p.id);
    if (!list.length) return [];
    const base = hashStr(`${day}|${saltVal}|versekeep-wp`);
    // Fisher-Yates with seeded PRNG
    const arr = list.slice();
    let s = base || 1;
    const rand = () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, Math.min(count, arr.length)).map((item, i) =>
      normalizeRemote(item, day, i)
    );
  }

  function allKnownWallpapers() {
    const map = new Map();
    for (const w of classics) map.set(w.id, w);
    for (const w of daily) map.set(w.id, w);
    for (const id of Object.keys(catalog)) {
      if (!map.has(id)) map.set(id, { ...catalog[id], kind: "catalog" });
    }
    return [...map.values()];
  }

  function findWallpaper(id) {
    return allKnownWallpapers().find((w) => w.id === id) || catalog[id] || null;
  }

  /**
   * CSS custom properties resolve url() against the stylesheet (css/style.css),
   * not the page — so relative classic paths like assets/wallpapers/x.jpg 404.
   * Always absolutize before putting into --wallpaper.
   */
  function resolveAssetUrl(src) {
    if (!src) return "";
    const s = String(src).trim();
    if (!s) return "";
    if (/^(https?:|data:|blob:)/i.test(s)) return s;
    try {
      return new URL(s, location.href).href;
    } catch {
      return s;
    }
  }

  function applyVisual(src) {
    const root = document.documentElement;
    const abs = resolveAssetUrl(src);
    if (abs) {
      // Quote-safe for CSS url("…")
      const safe = abs.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      root.style.setProperty("--wallpaper", `url("${safe}")`);
      document.body.classList.add("has-wallpaper");
      // Also set on body as a belt-and-suspenders for stubborn mobile browsers
      document.body.style.backgroundImage = `linear-gradient(180deg, rgba(12, 16, 14, 0.72) 0%, rgba(12, 16, 14, 0.86) 100%), url("${safe}")`;
      document.body.style.backgroundSize = "auto, cover";
      document.body.style.backgroundPosition = "center, center";
      document.body.style.backgroundRepeat = "no-repeat, no-repeat";
      document.body.style.backgroundAttachment = "scroll, fixed";
      document.body.style.backgroundColor = "var(--bg-deep)";
    } else {
      root.style.removeProperty("--wallpaper");
      document.body.classList.remove("has-wallpaper");
      document.body.style.backgroundImage = "";
      document.body.style.backgroundSize = "";
      document.body.style.backgroundPosition = "";
      document.body.style.backgroundRepeat = "";
      document.body.style.backgroundAttachment = "";
      document.body.style.backgroundColor = "";
    }
  }

  function applyWallpaper(w, { mode = "manual", persist = true } = {}) {
    if (!w) return;
    applying = true;
    const src = w.src || "";
    applyVisual(src);
    rememberCatalog({ ...w, src, download: w.download || src });
    if (persist) {
      savePref({
        mode,
        id: w.id,
        src,
        title: w.title || w.id,
        day: dayKey(),
        at: Date.now(),
      });
    }
    applying = false;
    paintAll();
  }

  function getTodayFeatured() {
    return daily[0] || classics.find((c) => c.id === DEFAULT_ID) || classics[0] || null;
  }

  function getTopHearted() {
    const known = allKnownWallpapers().filter((w) => w.id && w.id !== "none");
    if (!known.length) return null;
    let best = null;
    let bestScore = -1;
    for (const w of known) {
      const score = Number(heartCounts[w.id] || 0);
      const localBoost = heartsLocal[w.id] ? 0.5 : 0;
      const total = score + localBoost;
      if (total > bestScore) {
        bestScore = total;
        best = w;
      }
    }
    if (!best || bestScore <= 0) {
      // Fallback: most locally hearted first, else today
      const localIds = Object.keys(heartsLocal).filter((id) => heartsLocal[id]);
      if (localIds.length) {
        return findWallpaper(localIds[0]) || best;
      }
      return null;
    }
    return best;
  }

  /** Best-effort global counter (fails soft offline / if API down). */
  async function fetchRemoteCount(id) {
    const key = String(id).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
    if (!key) return 0;
    try {
      const res = await fetch(
        `https://api.counterapi.dev/v1/${COUNTER_NS}/${encodeURIComponent(key)}/`,
        { cache: "no-store" }
      );
      if (!res.ok) return 0;
      const data = await res.json();
      return Number(data.count) || 0;
    } catch {
      return 0;
    }
  }

  async function bumpRemoteCount(id) {
    const key = String(id).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
    if (!key) return null;
    try {
      const res = await fetch(
        `https://api.counterapi.dev/v1/${COUNTER_NS}/${encodeURIComponent(key)}/up`,
        { cache: "no-store" }
      );
      if (!res.ok) return null;
      const data = await res.json();
      return Number(data.count) || null;
    } catch {
      return null;
    }
  }

  async function refreshHeartCounts() {
    const ids = new Set([
      ...daily.map((w) => w.id),
      ...classics.map((w) => w.id),
      ...Object.keys(heartsLocal),
      ...Object.keys(catalog),
    ]);
    ids.delete("none");
    const list = [...ids].slice(0, 40);
    const results = await Promise.all(
      list.map(async (id) => {
        const remote = await fetchRemoteCount(id);
        const localOnly = heartsLocal[id] ? 1 : 0;
        // Prefer remote when available; ensure local heart shows at least 1
        const count = Math.max(remote, localOnly, Number(heartCounts[id] || 0));
        return [id, count];
      })
    );
    for (const [id, count] of results) {
      heartCounts[id] = count;
    }
  }

  async function toggleHeart(id) {
    const w = findWallpaper(id);
    if (!w || id === "none") return;
    rememberCatalog(w);
    if (heartsLocal[id]) {
      delete heartsLocal[id];
      heartCounts[id] = Math.max(0, (heartCounts[id] || 1) - 1);
      saveHearts();
      paintAll();
      return;
    }
    heartsLocal[id] = true;
    heartCounts[id] = (heartCounts[id] || 0) + 1;
    saveHearts();
    paintAll();
    const remote = await bumpRemoteCount(id);
    if (remote != null) {
      heartCounts[id] = Math.max(heartCounts[id] || 0, remote);
      paintAll();
    }
  }

  function cardHtml(w, { showDailyBadge = false } = {}) {
    const current = loadPref();
    const active = current?.id === w.id;
    const hearted = !!heartsLocal[w.id];
    const count = Number(heartCounts[w.id] || 0);
    const thumb = w.src
      ? `<img src="${escapeHtml(w.src)}" alt="" loading="lazy" width="320" height="180" referrerpolicy="no-referrer" />`
      : `<div class="wp-none">Default dark</div>`;
    const open = hdUrl(w);
    // Open HD: always open in a new tab
    const openHd = open
      ? `<a class="wp-open-hd" href="${escapeHtml(open)}" target="_blank" rel="noopener noreferrer" title="Open HD in a new tab">Open HD</a>`
      : "";
    // Mini download beside heart — uses blob fetch so daily/remote actually downloads
    const dlMini = open
      ? `<button type="button" class="wp-dl-mini" data-dl-url="${escapeHtml(open)}" data-dl-name="${escapeHtml(w.id || "wallpaper")}.jpg" title="Download HD" aria-label="Download HD wallpaper">⬇</button>`
      : "";
    const badge = badgeHtml(w, { showDailyBadge });

    return `
      <article class="wp-card${active ? " is-active" : ""}${hearted ? " is-hearted" : ""}" data-wp-id="${escapeHtml(w.id)}">
        <button type="button" class="wp-main" data-apply="${escapeHtml(w.id)}" aria-label="Use wallpaper ${escapeHtml(w.title)}">
          <div class="wp-thumb">${thumb}${badge}</div>
          <div class="wp-meta">
            <strong>${escapeHtml(w.title)}</strong>
            <small>${escapeHtml(w.blurb || "")}</small>
            ${openHd}
          </div>
        </button>
        <div class="wp-side-actions">
          ${dlMini}
          <button type="button" class="wp-heart${hearted ? " is-on" : ""}" data-heart="${escapeHtml(w.id)}" aria-pressed="${hearted ? "true" : "false"}" title="${hearted ? "Unheart" : "Heart this wallpaper"}">
            <span class="wp-heart-icon" aria-hidden="true">${hearted ? "♥" : "♡"}</span>
            <span class="wp-heart-count mono">${count}</span>
          </button>
        </div>
      </article>`;
  }

  function paintFeatured() {
    const host = $("#wp-featured");
    if (!host) return;
    const today = getTodayFeatured();
    const top = getTopHearted();
    const pref = loadPref();

    const todayHtml = today
      ? `
      <button type="button" class="wp-feature-card" data-apply="${escapeHtml(today.id)}">
        <div class="wp-feature-thumb">
          ${today.src ? `<img src="${escapeHtml(today.src)}" alt="" loading="lazy" referrerpolicy="no-referrer" />` : ""}
        </div>
        <div class="wp-feature-body">
          <span class="wp-feature-label mono">Today’s light · ${escapeHtml(dayKey())}</span>
          <strong>${escapeHtml(today.title)}</strong>
          <small>${escapeHtml(today.blurb || "Daily suggestion")}</small>
        </div>
      </button>`
      : "";

    const topCount = top ? Number(heartCounts[top.id] || 0) : 0;
    const topHtml = top
      ? `
      <button type="button" class="wp-feature-card wp-feature-loved" data-apply="${escapeHtml(top.id)}">
        <div class="wp-feature-thumb">
          ${top.src ? `<img src="${escapeHtml(top.src)}" alt="" loading="lazy" referrerpolicy="no-referrer" />` : ""}
          <span class="wp-feature-heart-badge">♥ ${topCount}</span>
        </div>
        <div class="wp-feature-body">
          <span class="wp-feature-label mono">Most loved</span>
          <strong>${escapeHtml(top.title)}</strong>
          <small>Community hearts · tap to use</small>
        </div>
      </button>`
      : `
      <div class="wp-feature-card wp-feature-empty">
        <div class="wp-feature-body">
          <span class="wp-feature-label mono">Most loved</span>
          <strong>No hearts yet</strong>
          <small>Heart a wallpaper below — the favorite shows here.</small>
        </div>
      </div>`;

    const mode = pref?.mode === "daily" ? "Following daily wallpaper" : pref?.id ? `Using: ${pref.title || pref.id}` : "Pick a wallpaper";
    host.innerHTML = `
      <div class="wp-feature-row">
        ${todayHtml}
        ${topHtml}
      </div>
      <p class="wp-feature-status mono">${escapeHtml(mode)}</p>
    `;

    host.querySelectorAll("[data-apply]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const w = findWallpaper(btn.dataset.apply);
        if (w) applyWallpaper(w, { mode: w.kind === "daily" ? "daily" : "manual" });
      });
    });
  }

  function paintHeroLoved() {
    const el = $("#wp-hero-loved");
    if (!el) return;
    const top = getTopHearted();
    if (!top || !(heartCounts[top.id] > 0 || heartsLocal[top.id])) {
      el.hidden = true;
      el.innerHTML = "";
      return;
    }
    el.hidden = false;
    const n = heartCounts[top.id] || 1;
    el.innerHTML = `
      <button type="button" class="wp-hero-loved-btn" data-apply="${escapeHtml(top.id)}" title="Use most-loved wallpaper">
        <span class="wp-hero-loved-icon" aria-hidden="true">♥</span>
        <span>Most loved: <strong>${escapeHtml(top.title)}</strong> · ${n}</span>
      </button>`;
    el.querySelector("[data-apply]")?.addEventListener("click", () => {
      const w = findWallpaper(top.id);
      if (w) {
        applyWallpaper(w, { mode: "manual" });
        $("#wallpapers")?.scrollIntoView({ behavior: "smooth" });
      }
    });
  }

  function paintGrid() {
    const host = $("#wallpaper-grid");
    if (!host) return;
    const classicList = classics.filter((w) => w.id !== "none");
    const none = classics.find((w) => w.id === "none");
    const fromPc = classicList.filter((w) => String(w.id || "").startsWith("win-"));
    const lofi = classicList.filter((w) => String(w.id || "").startsWith("lofi-"));
    const sanctuary = classicList.filter(
      (w) => !String(w.id || "").startsWith("win-") && !String(w.id || "").startsWith("lofi-")
    );

    const section = (label, list, gridId) =>
      list.length
        ? `
      <div class="wp-section-label mono">${label}</div>
      <div class="wallpaper-grid-inner" id="${gridId}">
        ${list.map((w) => cardHtml(w)).join("")}
      </div>`
        : "";

    host.innerHTML = `
      <div class="wp-section-label mono">Today’s suggestions</div>
      <div class="wallpaper-grid-inner" id="wp-daily-grid">
        ${daily.map((w) => cardHtml(w, { showDailyBadge: true })).join("") || `<p class="hint">Could not load daily images — classics still work.</p>`}
      </div>
      ${section("From your PC", fromPc, "wp-pc-grid")}
      ${section("Christian lo-fi", lofi, "wp-lofi-grid")}
      ${section("Sanctuary classics", sanctuary, "wp-classic-grid")}
      ${
        none
          ? `
      <div class="wp-section-label mono">Theme only</div>
      <div class="wallpaper-grid-inner" id="wp-none-grid">
        ${cardHtml(none)}
      </div>`
          : ""
      }
    `;

    host.querySelectorAll("[data-apply]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        // don't apply when using Open HD / download controls
        if (e.target.closest("a, .wp-side-actions")) return;
        const w = findWallpaper(btn.dataset.apply);
        if (w) applyWallpaper(w, { mode: "manual" });
      });
    });
    host.querySelectorAll(".wp-open-hd").forEach((a) => {
      a.addEventListener("click", (e) => e.stopPropagation());
    });
    host.querySelectorAll(".wp-dl-mini").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const url = btn.dataset.dlUrl;
        const name = btn.dataset.dlName || "versekeep-wallpaper.jpg";
        btn.disabled = true;
        btn.classList.add("is-busy");
        downloadWallpaperFile(url, name).finally(() => {
          btn.disabled = false;
          btn.classList.remove("is-busy");
        });
      });
    });
    host.querySelectorAll("[data-heart]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleHeart(btn.dataset.heart);
      });
    });
  }

  function paintAll() {
    paintFeatured();
    paintHeroLoved();
    paintGrid();
  }

  function rebuildDaily({ reshuffle = false } = {}) {
    const day = dayKey();
    if (reshuffle) {
      salt = (salt + 1 + Math.floor(Math.random() * 7)) % 997;
      try {
        localStorage.setItem(SALT_KEY, String(salt));
      } catch {
        /* ignore */
      }
    }
    daily = pickDaily(remotePool, day, salt, DAILY_COUNT);
    for (const w of daily) rememberCatalog(w);
  }

  function restoreOrDaily() {
    const pref = loadPref();
    const today = dayKey();

    if (pref?.mode === "manual" && pref.id) {
      const w = findWallpaper(pref.id) || {
        id: pref.id,
        title: pref.title || pref.id,
        src: pref.src || "",
        download: pref.src || "",
        blurb: "",
      };
      applyVisual(w.src || "");
      return;
    }

    // Daily mode or first visit: use today's featured
    const featured = getTodayFeatured();
    if (featured) {
      applyWallpaper(featured, { mode: "daily", persist: true });
      return;
    }

    const classic = classics.find((c) => c.id === DEFAULT_ID) || classics[0];
    if (classic) applyWallpaper(classic, { mode: "manual" });
  }

  function bindUi() {
    $("#wp-new-suggestions")?.addEventListener("click", async () => {
      rebuildDaily({ reshuffle: true });
      const btn = $("#wp-new-suggestions");
      if (btn) {
        btn.disabled = true;
        btn.textContent = "Fetching…";
      }
      await refreshHeartCounts();
      // If following daily, apply the new first pick
      const pref = loadPref();
      if (!pref || pref.mode === "daily") {
        const featured = getTodayFeatured();
        if (featured) applyWallpaper(featured, { mode: "daily" });
      } else {
        paintAll();
      }
      if (btn) {
        btn.disabled = false;
        btn.textContent = "New suggestions";
      }
    });

    $("#wp-use-daily")?.addEventListener("click", () => {
      const featured = getTodayFeatured();
      if (featured) applyWallpaper(featured, { mode: "daily" });
    });
  }

  async function boot() {
    loadHearts();
    try {
      const [local, remote] = await Promise.all([
        loadJson("data/wallpapers.json"),
        loadJson("data/remote-wallpapers.json").catch(() => ({ pool: [] })),
      ]);
      classics = (local.wallpapers || []).map(normalizeClassic);
      remotePool = remote.pool || [];
      for (const w of classics) rememberCatalog(w);
      rebuildDaily({ reshuffle: false });
      bindUi();
      restoreOrDaily();
      paintAll();
      // Background: refresh community heart counts
      refreshHeartCounts().then(() => paintAll());
    } catch (err) {
      console.warn("[wallpapers]", err);
      const el = $("#ambient-error");
      if (el) {
        el.hidden = false;
        el.textContent = `Could not load wallpapers: ${err.message}`;
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
