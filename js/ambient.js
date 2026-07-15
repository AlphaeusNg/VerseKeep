/**
 * Worship music (YouTube / Spotify) + wallpaper picker for VerseKeep.
 * Music iframe lives in a sticky dock and is never reloaded unless the station
 * changes or the user hits Stop (survives tab switches in the UI + scrolling).
 */
(function () {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const WP_KEY = "versekeep-wallpaper";
  const MUSIC_KEY = "versekeep-music";
  const DEFAULT_WP = "dawn-hills";

  let playlists = { youtube: [], spotify: [] };
  let wallpapers = [];
  let musicTab = "spotify";
  let activeMusicId = null;
  let currentEmbed = "";
  let minimized = false;

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function loadJson(path) {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) throw new Error(`${path}: ${res.status}`);
    return res.json();
  }

  function paintMusicTabs() {
    $$("[data-music-tab]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.musicTab === musicTab);
    });
  }

  function groupByCategory(list) {
    const order = [];
    const map = new Map();
    for (const p of list) {
      const cat = p.category || "More";
      if (!map.has(cat)) {
        map.set(cat, []);
        order.push(cat);
      }
      map.get(cat).push(p);
    }
    order.sort((a, b) => {
      if (a === "From Alphaeus") return -1;
      if (b === "From Alphaeus") return 1;
      return 0;
    });
    return order.map((cat) => ({ cat, items: map.get(cat) }));
  }

  function paintMusicList() {
    const host = $("#music-list");
    if (!host) return;
    const list = playlists[musicTab] || [];
    const groups = groupByCategory(list);

    host.innerHTML = groups
      .map(
        (g) => `
      <div class="pick-group">
        <div class="pick-group-title mono">${escapeHtml(g.cat)}</div>
        ${g.items
          .map(
            (p) => `
        <button type="button" class="pick-card${p.id === activeMusicId ? " is-active" : ""}${
              g.cat === "From Alphaeus" ? " pick-mine" : ""
            }" data-music-id="${escapeHtml(p.id)}" data-embed="${escapeHtml(p.embed)}" data-title="${escapeHtml(p.title)}">
          <strong>${escapeHtml(p.title)}</strong>
          <small>${escapeHtml(p.blurb || "")}</small>
        </button>`
          )
          .join("")}
      </div>`
      )
      .join("");

    host.querySelectorAll("[data-music-id]").forEach((btn) => {
      btn.addEventListener("click", () =>
        selectMusic(btn.dataset.musicId, btn.dataset.embed, btn.dataset.title)
      );
    });
  }

  function selectMusic(id, embed, title) {
    if (!embed) return;
    const frame = $("#music-frame");
    const dock = $("#music-dock");
    if (!frame || !dock) return;

    activeMusicId = id;

    // Same station already playing — only refresh UI highlight, never reload iframe
    if (currentEmbed === embed && frame.getAttribute("src") === embed && !dock.hidden) {
      paintMusicList();
      dock.classList.remove("is-minimized");
      minimized = false;
      return;
    }

    currentEmbed = embed;
    if (frame.getAttribute("src") !== embed) {
      frame.src = embed;
    }
    dock.hidden = false;
    dock.classList.remove("is-minimized");
    minimized = false;

    const lab = $("#music-dock-label");
    if (lab) lab.textContent = title || id || "Playing…";

    try {
      localStorage.setItem(
        MUSIC_KEY,
        JSON.stringify({ tab: musicTab, id, embed, title: title || "" })
      );
    } catch {
      /* ignore */
    }
    paintMusicList();
  }

  function stopMusic() {
    const frame = $("#music-frame");
    const dock = $("#music-dock");
    if (frame) {
      frame.removeAttribute("src");
      frame.src = "about:blank";
    }
    if (dock) {
      dock.hidden = true;
      dock.classList.remove("is-minimized");
    }
    activeMusicId = null;
    currentEmbed = "";
    minimized = false;
    try {
      localStorage.removeItem(MUSIC_KEY);
    } catch {
      /* ignore */
    }
    paintMusicList();
  }

  function toggleMinimize() {
    const dock = $("#music-dock");
    if (!dock || dock.hidden) return;
    minimized = !minimized;
    dock.classList.toggle("is-minimized", minimized);
    const btn = $("#music-dock-minimize");
    if (btn) btn.textContent = minimized ? "▴" : "▾";
  }

  function paintWallpapers() {
    const host = $("#wallpaper-grid");
    if (!host) return;
    const current = localStorage.getItem(WP_KEY) || DEFAULT_WP;
    host.innerHTML = wallpapers
      .map((w) => {
        const active = w.id === current;
        const thumb = w.src
          ? `<img src="${escapeHtml(w.src)}" alt="" loading="lazy" width="320" height="180" />`
          : `<div class="wp-none">Default dark</div>`;
        const dl = w.download
          ? `<a class="wp-dl" href="${escapeHtml(w.download)}" download="${escapeHtml(w.id)}.jpg" onclick="event.stopPropagation()">Download HD</a>`
          : "";
        return `
        <button type="button" class="wp-card${active ? " is-active" : ""}" data-wp="${escapeHtml(w.id)}" data-src="${escapeHtml(w.src || "")}">
          <div class="wp-thumb">${thumb}</div>
          <div class="wp-meta">
            <strong>${escapeHtml(w.title)}</strong>
            <small>${escapeHtml(w.blurb || "")}</small>
            ${dl}
          </div>
        </button>`;
      })
      .join("");

    host.querySelectorAll("[data-wp]").forEach((btn) => {
      btn.addEventListener("click", () => applyWallpaper(btn.dataset.wp, btn.dataset.src || ""));
    });
  }

  function applyWallpaper(id, src) {
    const root = document.documentElement;
    if (src) {
      root.style.setProperty("--wallpaper", `url("${src}")`);
      document.body.classList.add("has-wallpaper");
    } else {
      root.style.removeProperty("--wallpaper");
      document.body.classList.remove("has-wallpaper");
    }
    try {
      localStorage.setItem(WP_KEY, id);
    } catch {
      /* ignore */
    }
    paintWallpapers();
  }

  function restoreWallpaper() {
    let id = localStorage.getItem(WP_KEY);
    if (!id) id = DEFAULT_WP;
    const w =
      wallpapers.find((x) => x.id === id) ||
      wallpapers.find((x) => x.id === DEFAULT_WP) ||
      wallpapers[0];
    if (w) applyWallpaper(w.id, w.src || "");
  }

  function restoreMusic() {
    try {
      const raw = localStorage.getItem(MUSIC_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.tab) musicTab = data.tab;
      paintMusicTabs();
      paintMusicList();
      // Restore without forcing a double-load if already set
      if (data.embed) {
        activeMusicId = data.id || null;
        currentEmbed = "";
        selectMusic(data.id, data.embed, data.title || "");
      }
    } catch {
      /* ignore */
    }
  }

  function bindUi() {
    $$("[data-music-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        // Only switch the station list — never touch the playing iframe
        musicTab = btn.dataset.musicTab;
        paintMusicTabs();
        paintMusicList();
      });
    });

    $("#music-stop")?.addEventListener("click", stopMusic);
    $("#music-dock-stop")?.addEventListener("click", stopMusic);
    $("#music-dock-minimize")?.addEventListener("click", toggleMinimize);
  }

  async function boot() {
    try {
      const [pl, wp] = await Promise.all([
        loadJson("data/playlists.json"),
        loadJson("data/wallpapers.json"),
      ]);
      playlists = pl;
      wallpapers = wp.wallpapers || [];
      paintMusicTabs();
      paintMusicList();
      paintWallpapers();
      restoreWallpaper();
      restoreMusic();
      bindUi();
    } catch (err) {
      console.warn("[ambient]", err);
      const el = $("#ambient-error");
      if (el) {
        el.hidden = false;
        el.textContent = `Could not load music/wallpapers: ${err.message}`;
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
