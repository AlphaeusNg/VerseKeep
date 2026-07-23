/**
 * VerseKeep wallpapers:
 * - Daily remote suggestions (curated Unsplash CDN, no API key)
 * - Manual "New suggestions" reshuffle
 * - Hearts (local + best-effort global counters)
 * - Responsive grid density + scrollable tag filters
 */
(function () {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);

  const PREF_KEY = "versekeep-wallpaper-pref-v2";
  const HEARTS_KEY = "versekeep-wallpaper-hearts-v1";
  const CATALOG_KEY = "versekeep-wallpaper-catalog-v1";
  const SALT_KEY = "versekeep-wallpaper-salt-v1";
  const FORMAT_KEY = "versekeep-wallpaper-format-v1";
  const GRID_KEY = "versekeep-wallpaper-grid-v1";
  const DEFAULT_ID = "dawn-hills";
  const DAILY_COUNT = 6;
  const COUNTER_NS = "versekeepwp";
  const PHONE_MEDIA = window.matchMedia("(max-width: 720px)");

  let classics = [];
  let remotePool = [];
  let daily = [];
  let heartsLocal = {}; // id -> true if user hearted
  let heartCounts = {}; // id -> number (local + remote best effort)
  let catalog = {}; // id -> { id, title, blurb, src, download }
  let salt = 0;
  let applying = false;
  let searchQuery = "";
  let wallpaperFormat = "desktop";
  let gridPreferences = { desktop: 4, phone: 2 };

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

  function phoneAssetPath(src) {
    const value = String(src || "");
    const match = value.match(/^assets\/wallpapers\/([^/]+)\.jpg$/i);
    return match ? `assets/wallpapers/phone/${match[1]}-phone.jpg` : "";
  }

  function wallpaperAsset(w, format = wallpaperFormat, { download = false } = {}) {
    if (!w) return "";
    if (format === "phone") {
      if (w.unsplash) {
        return unsplashUrl(w.unsplash, download ? { w: 1080, h: 1920, q: 90 } : { w: 540, h: 960, q: 80 });
      }
      return (
        (download ? w.phoneDownload : w.phoneSrc) ||
        w.phoneSrc ||
        w.phoneDownload ||
        phoneAssetPath(w.src) ||
        w.src ||
        ""
      );
    }
    if (w.unsplash && download) return unsplashUrl(w.unsplash, { w: 3840, h: 2160, q: 90 });
    return (download ? w.download : w.src) || w.src || w.download || "";
  }

  /** Selected full-resolution URL for Open HD / download. */
  function hdUrl(w) {
    return wallpaperAsset(w, wallpaperFormat, { download: true });
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

  function picsumUrl(seed, { w = 1920, h = 1080 } = {}) {
    return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;
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
      phoneSrc: w.phoneSrc || phoneAssetPath(w.src),
      phoneDownload: w.phoneDownload || w.phoneSrc || phoneAssetPath(w.src),
      unsplash: w.unsplash || "",
      tags: normalizeTags(w.tags || w.tag),
      tone: w.tone || "",
      theme: w.theme || "",
      themeTitle: w.themeTitle || "",
      style: w.style || "",
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

  function loadFormatPreference() {
    try {
      const stored = localStorage.getItem(FORMAT_KEY);
      if (stored === "desktop" || stored === "phone") return stored;
    } catch {
      /* ignore */
    }
    return window.matchMedia("(max-width: 720px)").matches ? "phone" : "desktop";
  }

  function syncFormatUi() {
    document.documentElement.dataset.wallpaperFormat = wallpaperFormat;
    document.querySelectorAll("[data-wp-format]").forEach((btn) => {
      const active = btn.dataset.wpFormat === wallpaperFormat;
      btn.setAttribute("aria-pressed", active ? "true" : "false");
      btn.classList.toggle("is-active", active);
    });
  }

  function setWallpaperFormat(format) {
    if (format !== "desktop" && format !== "phone") return;
    wallpaperFormat = format;
    try {
      localStorage.setItem(FORMAT_KEY, format);
    } catch {
      /* ignore */
    }
    syncFormatUi();

    const pref = loadPref();
    const current = pref?.id ? findWallpaper(pref.id) : getTodayFeatured();
    if (current) {
      const src = wallpaperAsset(current);
      applyVisual(src);
      if (pref) {
        savePref({
          ...pref,
          src,
          format,
          desktopSrc: current.src || pref.desktopSrc || "",
          desktopDownload: current.download || pref.desktopDownload || current.src || "",
          phoneSrc: current.phoneSrc || pref.phoneSrc || phoneAssetPath(current.src),
          phoneDownload:
            current.phoneDownload ||
            pref.phoneDownload ||
            current.phoneSrc ||
            phoneAssetPath(current.src),
          unsplash: current.unsplash || pref.unsplash || "",
        });
      }
    }
    paintAll();
  }

  function loadGridPreferences() {
    const defaults = { desktop: 4, phone: 2 };
    try {
      const stored = JSON.parse(localStorage.getItem(GRID_KEY) || "null");
      if (!stored || typeof stored !== "object") return defaults;
      const desktop = Number(stored.desktop);
      const phone = Number(stored.phone);
      return {
        desktop: Number.isInteger(desktop) && desktop >= 1 && desktop <= 4 ? desktop : defaults.desktop,
        phone: Number.isInteger(phone) && phone >= 1 && phone <= 2 ? phone : defaults.phone,
      };
    } catch {
      return defaults;
    }
  }

  function syncGridUi() {
    const viewport = PHONE_MEDIA.matches ? "phone" : "desktop";
    const max = viewport === "phone" ? 2 : 4;
    const density = gridPreferences[viewport];
    const root = document.documentElement;
    root.dataset.wallpaperGrid = String(density);
    root.dataset.wallpaperGridViewport = viewport;
    root.style.setProperty("--wp-grid-columns", String(density));

    document.querySelectorAll("[data-wp-grid]").forEach((btn) => {
      const value = Number(btn.dataset.wpGrid);
      const active = value === density;
      btn.hidden = value > max;
      btn.setAttribute("aria-pressed", active ? "true" : "false");
      btn.classList.toggle("is-active", active);
    });
  }

  function setGridDensity(value) {
    const viewport = PHONE_MEDIA.matches ? "phone" : "desktop";
    const max = viewport === "phone" ? 2 : 4;
    const density = Number(value);
    if (!Number.isInteger(density) || density < 1 || density > max) return;
    gridPreferences[viewport] = density;
    try {
      localStorage.setItem(GRID_KEY, JSON.stringify(gridPreferences));
    } catch {
      /* ignore */
    }
    syncGridUi();
  }

  function normalizeTags(raw) {
    if (Array.isArray(raw)) {
      return raw.map((t) => String(t || "").trim()).filter(Boolean).slice(0, 3);
    }
    if (typeof raw === "string" && raw.trim()) return [raw.trim()];
    return [];
  }

  function normalizeClassic(w) {
    const phoneSrc = w.phoneSrc || phoneAssetPath(w.src);
    return {
      ...w,
      kind: "classic",
      download: w.download || w.src || "",
      phoneSrc,
      phoneDownload: w.phoneDownload || phoneSrc,
      tags: normalizeTags(w.tags || w.tag),
      tone: w.tone || "",
      theme: w.theme || "",
      themeTitle: w.themeTitle || "",
      style: w.style || "",
    };
  }

  function normalizeRemote(item, day, index) {
    const photo = String(item.unsplash || "").replace(/^photo-/, "");
    const src = photo
      ? unsplashUrl(photo)
      : picsumUrl(`versekeep-${day}-${item.id}-${index}`);
    const download = photo ? unsplashUrl(photo, { w: 3840, h: 2160, q: 90 }) : src;
    const phoneSrc = photo
      ? unsplashUrl(photo, { w: 540, h: 960, q: 80 })
      : picsumUrl(`versekeep-${day}-${item.id}-${index}`, { w: 540, h: 960 });
    const phoneDownload = photo
      ? unsplashUrl(photo, { w: 1080, h: 1920, q: 90 })
      : picsumUrl(`versekeep-${day}-${item.id}-${index}`, { w: 1080, h: 1920 });
    const tags = normalizeTags(item.tags || item.tag);
    if (!tags.length) tags.push("Today’s light");
    return {
      id: item.id,
      title: item.title || "Daily light",
      blurb: item.blurb || "Today’s suggestion",
      src,
      download,
      phoneSrc,
      phoneDownload,
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
   * CSS custom properties resolve url() against the stylesheet (assets/css/style.css),
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
    const src = wallpaperAsset(w);
    applyVisual(src);
    rememberCatalog(w);
    if (persist) {
      savePref({
        mode,
        id: w.id,
        src,
        desktopSrc: w.src || "",
        desktopDownload: w.download || w.src || "",
        phoneSrc: w.phoneSrc || phoneAssetPath(w.src),
        phoneDownload: w.phoneDownload || w.phoneSrc || phoneAssetPath(w.src),
        unsplash: w.unsplash || "",
        format: wallpaperFormat,
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
    const formatName = wallpaperFormat === "phone" ? "Phone HD" : "Desktop 4K";
    const dimensions = wallpaperFormat === "phone" ? "1080 × 1920" : "3840 × 2160";
    const dimensionSlug = wallpaperFormat === "phone" ? "1080x1920" : "3840x2160";
    const thumbSrc = wallpaperAsset(w);
    const thumb = thumbSrc
      ? `<img src="${escapeHtml(thumbSrc)}" alt="" loading="lazy" width="${wallpaperFormat === "phone" ? "540" : "320"}" height="${wallpaperFormat === "phone" ? "960" : "180"}" referrerpolicy="no-referrer" />`
      : `<div class="wp-none">Default dark</div>`;
    const open = hdUrl(w);
    // Open HD: always open in a new tab
    const openHd = open
      ? `<a class="wp-open-hd" href="${escapeHtml(open)}" target="_blank" rel="noopener noreferrer" title="View ${formatName} in a new tab">View ${formatName}</a>`
      : "";
    // Mini download beside heart — uses blob fetch so daily/remote actually downloads
    const dlMini = open
      ? `<button type="button" class="wp-dl-mini" data-dl-url="${escapeHtml(open)}" data-dl-name="${escapeHtml(w.id || "wallpaper")}-${wallpaperFormat}-${dimensionSlug}.jpg" title="Download ${formatName}" aria-label="Download ${formatName} wallpaper at ${dimensions}">⬇</button>`
      : "";
    const badge = badgeHtml(w, { showDailyBadge });

    return `
      <article class="wp-card${active ? " is-active" : ""}${hearted ? " is-hearted" : ""}" data-wp-id="${escapeHtml(w.id)}">
        <button type="button" class="wp-main" data-apply="${escapeHtml(w.id)}" aria-label="Use ${formatName} wallpaper ${escapeHtml(w.title)}">
          <div class="wp-thumb">${thumb}${badge}</div>
          <div class="wp-meta">
            <strong>${escapeHtml(w.title)}</strong>
            <small>${escapeHtml(w.blurb || "")}</small>
            <span class="wp-format-meta mono">${formatName} · ${dimensions}</span>
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

  /** Search haystack: title, blurb, tags, theme, style, id */
  function wallpaperSearchText(w) {
    const parts = [
      w.id,
      w.title,
      w.blurb,
      w.theme,
      w.themeTitle,
      w.style,
      w.kind,
      ...(Array.isArray(w.tags) ? w.tags : []),
    ];
    return parts
      .filter(Boolean)
      .map((x) => String(x).toLowerCase())
      .join(" ");
  }

  function parseSearchQuery(raw) {
    return String(raw || "")
      .toLowerCase()
      .trim()
      .split(/[\s,+/|]+/)
      .map((t) => t.trim())
      .filter(Boolean);
  }

  function matchesSearch(w, tokens) {
    if (!tokens.length) return true;
    const hay = wallpaperSearchText(w);
    // Every token must match (AND). Allows "baptism minimal" or "jesus"
    return tokens.every((t) => hay.includes(t));
  }

  function filterList(list, tokens) {
    if (!tokens.length) return list;
    return list.filter((w) => matchesSearch(w, tokens));
  }

  function updateSearchChrome(matchCount, totalCount, tokens) {
    const meta = $("#wp-search-meta");
    const clearBtn = $("#wp-search-clear");
    if (clearBtn) clearBtn.hidden = !tokens.length;
    if (!meta) return;
    if (!tokens.length) {
      meta.textContent = "";
      meta.hidden = true;
      return;
    }
    meta.hidden = false;
    meta.textContent =
      matchCount === 0
        ? `No matches for “${tokens.join(" ")}” — try another tag or clear`
        : `${matchCount} match${matchCount === 1 ? "" : "es"} · filtering ${totalCount} wallpapers`;
  }

  function collectQuickChips() {
    const counts = new Map();
    const bump = (label) => {
      if (!label) return;
      const key = String(label).trim();
      if (!key || key.length > 18) return;
      counts.set(key, (counts.get(key) || 0) + 1);
    };
    classics.forEach((w) => {
      (w.tags || []).forEach(bump);
      if (w.style) {
        const pretty =
          w.style === "lofi" ? "Lo-fi" : w.style === "minimal" ? "Minimal" : w.style === "realistic" ? "Realistic" : w.style;
        bump(pretty);
      }
      if (w.themeTitle) bump(w.themeTitle);
    });
    daily.forEach((w) => (w.tags || []).forEach(bump));
    // Prefer high-signal chips
    const preferred = [
      "Jesus",
      "Baptism",
      "Shepherd",
      "Communion",
      "Cosmos",
      "Spirit",
      "Easter",
      "Prayer",
      "Word",
      "Lo-fi",
      "Minimal",
      "Realistic",
      "Yours",
      "Cross",
      "Hope",
    ];
    const out = [];
    preferred.forEach((p) => {
      if (counts.has(p) || [...counts.keys()].some((k) => k.toLowerCase() === p.toLowerCase())) {
        out.push(p);
      }
    });
    // Fill with popular tags
    [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .forEach(([k]) => {
        if (out.length >= 12) return;
        if (!out.some((x) => x.toLowerCase() === k.toLowerCase())) out.push(k);
      });
    return out.slice(0, 12);
  }

  function nextChipSelection(tokens, token, additive = false) {
    const current = [...tokens];
    const index = current.indexOf(token);
    if (additive) {
      if (index >= 0) current.splice(index, 1);
      else current.push(token);
      return current;
    }
    return current.length === 1 && index === 0 ? [] : [token];
  }

  function paintSearchChips() {
    const host = $("#wp-search-chips");
    if (!host) return;
    const chips = collectQuickChips();
    const active = new Set(parseSearchQuery(searchQuery));
    host.innerHTML = chips
      .map((label) => {
        const on = active.has(label.toLowerCase());
        return `<button type="button" class="wp-chip${on ? " is-on" : ""}" data-wp-chip="${escapeHtml(label)}" aria-pressed="${on ? "true" : "false"}" title="Click to filter · Shift-click to combine tags">${escapeHtml(label)}</button>`;
      })
      .join("");
    host.querySelectorAll("[data-wp-chip]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        const token = btn.dataset.wpChip || "";
        const tokens = parseSearchQuery(searchQuery);
        const lower = token.toLowerCase();
        const nextTokens = nextChipSelection(tokens, lower, event.shiftKey);
        // Prefer readable casing for known chips
        const next = nextTokens
          .map((t) => {
            const hit = chips.find((c) => c.toLowerCase() === t);
            return hit || t;
          })
          .join(" ");
        setSearchQuery(next, { focus: false });
      });
    });
  }

  function setSearchQuery(q, { focus = false } = {}) {
    searchQuery = String(q || "");
    const input = $("#wp-search");
    if (input && input.value !== searchQuery) input.value = searchQuery;
    paintGrid();
    paintSearchChips();
    if (focus) input?.focus();
  }

  function paintGrid() {
    const host = $("#wallpaper-grid");
    if (!host) return;
    const tokens = parseSearchQuery(searchQuery);
    const allWallpapers = [...daily, ...classics];
    const visibleWallpapers = filterList(allWallpapers, tokens);
    const totalCount = allWallpapers.length;
    const matchCount = visibleWallpapers.length;
    updateSearchChrome(matchCount, totalCount, tokens);

    const emptyFilter =
      tokens.length && matchCount === 0
        ? `<p class="wp-search-empty hint">No wallpapers match <strong>${escapeHtml(tokens.join(" "))}</strong>. Try a tag like <em>baptism</em>, <em>Jesus</em>, <em>minimal</em>, or <em>cosmos</em>.</p>`
        : "";

    host.innerHTML = `
      ${emptyFilter}
      <div class="wallpaper-grid-inner" id="wp-all-grid">
        ${visibleWallpapers
          .map((w) => cardHtml(w, { showDailyBadge: w.kind === "daily" }))
          .join("")}
      </div>
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
    paintHeroLoved();
    paintGrid();
    paintSearchChips();
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
        src: pref.desktopSrc || pref.src || "",
        download: pref.desktopDownload || pref.desktopSrc || pref.src || "",
        phoneSrc: pref.phoneSrc || "",
        phoneDownload: pref.phoneDownload || pref.phoneSrc || "",
        unsplash: pref.unsplash || "",
        blurb: "",
      };
      applyVisual(wallpaperAsset(w));
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
    syncFormatUi();
    syncGridUi();
    document.querySelector(".wp-format-picker")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-wp-format]");
      if (!btn) return;
      setWallpaperFormat(btn.dataset.wpFormat);
    });
    $("#wp-grid-density")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-wp-grid]");
      if (!btn) return;
      setGridDensity(btn.dataset.wpGrid);
    });
    const handleViewportChange = () => syncGridUi();
    if (typeof PHONE_MEDIA.addEventListener === "function") {
      PHONE_MEDIA.addEventListener("change", handleViewportChange);
    } else {
      PHONE_MEDIA.addListener(handleViewportChange);
    }

    const searchInput = $("#wp-search");
    let searchTimer = null;
    searchInput?.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        setSearchQuery(searchInput.value, { focus: false });
      }, 120);
    });
    searchInput?.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setSearchQuery("", { focus: true });
      }
    });
    $("#wp-search-clear")?.addEventListener("click", () => {
      setSearchQuery("", { focus: true });
    });
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

  function bindDetailsMemory() {
    const det = document.getElementById("wp-details");
    if (!det) return;
    try {
      if (localStorage.getItem("versekeep-wp-open") === "1") det.open = true;
    } catch {
      /* ignore */
    }
    det.addEventListener("toggle", () => {
      try {
        localStorage.setItem("versekeep-wp-open", det.open ? "1" : "0");
      } catch {
        /* ignore */
      }
    });
  }

  async function boot() {
    loadHearts();
    wallpaperFormat = loadFormatPreference();
    gridPreferences = loadGridPreferences();
    bindDetailsMemory();
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
