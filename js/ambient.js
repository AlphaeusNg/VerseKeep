/**
 * Worship music for VerseKeep.
 * Auto-starts a default (or last) station on page load.
 * Player sits on the left of the Music section; docks bottom-left when
 * that section scrolls out of view so it stays reachable while practicing.
 * Wallpapers live in js/wallpapers.js.
 */
(function () {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const MUSIC_KEY = "versekeep-music";
  const DEFAULT_SPOTIFY_ID = "alph-gods-encouragement";

  let playlists = { youtube: [], spotify: [] };
  let musicTab = "spotify";
  let activeMusicId = null;
  let currentEmbed = "";
  let playing = false;
  let observer = null;

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function withAutoplay(url) {
    if (!url) return url;
    try {
      const u = new URL(url, location.href);
      u.searchParams.set("autoplay", "1");
      // YouTube often needs this pair for autoplay attempts
      if (u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be")) {
        u.searchParams.set("autoplay", "1");
        if (!u.searchParams.has("rel")) u.searchParams.set("rel", "0");
      }
      return u.toString();
    } catch {
      return url.includes("?") ? `${url}&autoplay=1` : `${url}?autoplay=1`;
    }
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

  function updateDockState() {
    const shell = $("#music-player-shell");
    const sl = $("#music-player-slot");
    if (!shell || !playing) return;

    const rect = sl?.getBoundingClientRect();
    const slotVisible =
      sl &&
      !sl.closest("[hidden]") &&
      rect &&
      rect.bottom > 48 &&
      rect.top < (window.innerHeight || 0) - 48;

    const shouldDock = !slotVisible;
    shell.classList.toggle("is-docked", shouldDock);
    sl?.classList.toggle("is-player-docked", shouldDock);

    const pin = $("#music-dock-pin");
    if (pin) pin.hidden = !shouldDock;
  }

  function watchVisibility() {
    const sl = $("#music-player-slot");
    if (!sl || !("IntersectionObserver" in window)) {
      window.addEventListener("scroll", updateDockState, { passive: true });
      window.addEventListener("resize", updateDockState);
      return;
    }
    observer = new IntersectionObserver(() => updateDockState(), {
      root: null,
      threshold: [0, 0.01, 0.1, 0.5, 1],
      rootMargin: "-40px 0px -40px 0px",
    });
    observer.observe(sl);
    window.addEventListener("scroll", updateDockState, { passive: true });
    window.addEventListener("resize", updateDockState);
  }

  function selectMusic(id, embed, title) {
    if (!embed) return;
    const frame = $("#music-frame");
    const shell = $("#music-player-shell");
    const empty = $("#music-empty");
    if (!frame || !shell) return;

    activeMusicId = id;
    const src = withAutoplay(embed);

    if (currentEmbed === embed && playing) {
      paintMusicList();
      updateDockState();
      return;
    }

    currentEmbed = embed;
    if (frame.getAttribute("src") !== src) {
      frame.src = src;
    }
    playing = true;
    shell.hidden = false;
    if (empty) empty.hidden = true;

    const lab = $("#music-player-label");
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
    updateDockState();
  }

  function stopMusic() {
    const frame = $("#music-frame");
    const shell = $("#music-player-shell");
    const empty = $("#music-empty");
    if (frame) {
      frame.removeAttribute("src");
      frame.src = "about:blank";
    }
    if (shell) {
      shell.hidden = true;
      shell.classList.remove("is-docked");
    }
    $("#music-player-slot")?.classList.remove("is-player-docked");
    if (empty) empty.hidden = false;
    activeMusicId = null;
    currentEmbed = "";
    playing = false;
    try {
      localStorage.removeItem(MUSIC_KEY);
    } catch {
      /* ignore */
    }
    paintMusicList();
  }

  function autoStartMusic() {
    try {
      const raw = localStorage.getItem(MUSIC_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.tab) musicTab = data.tab;
        paintMusicTabs();
        paintMusicList();
        if (data.embed) {
          activeMusicId = data.id || null;
          currentEmbed = "";
          selectMusic(data.id, data.embed, data.title || "");
          return;
        }
      }
    } catch {
      /* ignore */
    }

    // Default: Alphaeus "God's encouragement", else first Spotify entry
    musicTab = "spotify";
    paintMusicTabs();
    paintMusicList();
    const list = playlists.spotify || [];
    const pick =
      list.find((p) => p.id === DEFAULT_SPOTIFY_ID) || list[0] || (playlists.youtube || [])[0];
    if (pick?.embed) {
      if (!list.includes(pick) && (playlists.youtube || []).includes(pick)) {
        musicTab = "youtube";
        paintMusicTabs();
        paintMusicList();
      }
      selectMusic(pick.id, pick.embed, pick.title);
    }
  }

  function bindUi() {
    $$("[data-music-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        musicTab = btn.dataset.musicTab;
        paintMusicTabs();
        paintMusicList();
      });
    });

    $("#music-stop")?.addEventListener("click", stopMusic);
    $("#music-player-stop")?.addEventListener("click", stopMusic);
  }

  async function boot() {
    try {
      playlists = await loadJson("data/playlists.json");
      paintMusicTabs();
      paintMusicList();
      bindUi();
      watchVisibility();
      autoStartMusic();
    } catch (err) {
      console.warn("[ambient]", err);
      const el = $("#ambient-error");
      if (el) {
        el.hidden = false;
        el.textContent = `Could not load music: ${err.message}`;
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
