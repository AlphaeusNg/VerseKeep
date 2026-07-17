/**
 * VerseKeep music — left-edge dock (open/close tab).
 * Single iframe stays mounted; closing the panel does not stop audio.
 */
(function () {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const MUSIC_KEY = "versekeep-music";
  const DOCK_KEY = "versekeep-music-dock-open";
  const DEFAULT_SPOTIFY_ID = "alph-gods-encouragement";
  const DEFAULT_EMBED =
    "https://open.spotify.com/embed/playlist/0qKlX3MZWEHZgR17jNfI3e?utm_source=generator";

  let playlists = { youtube: [], spotify: [] };
  let musicTab = "spotify";
  let activeMusicId = null;
  let currentEmbed = "";
  let currentLabel = "Playing…";
  let playing = false;
  let gestureHooked = false;
  let dockOpen = false;

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
      u.searchParams.set("utm_source", u.searchParams.get("utm_source") || "generator");
      u.searchParams.set("autoplay", "1");
      if (u.hostname.includes("spotify.com")) u.searchParams.set("theme", "0");
      if (u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be")) {
        u.searchParams.set("playsinline", "1");
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

  function dock() {
    return $("#worship");
  }
  function panel() {
    return $("#music-dock-panel");
  }
  function tab() {
    return $("#music-dock-tab");
  }
  function scrim() {
    return $("#music-dock-scrim");
  }
  function shell() {
    return $("#music-player-shell");
  }
  function frame() {
    return $("#music-frame");
  }
  function empty() {
    return $("#music-empty");
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

  function updateLabels() {
    const lab = $("#music-player-label");
    if (lab) lab.textContent = currentLabel;
    const tabText = $("#music-dock-tab-text");
    if (tabText) {
      const short =
        currentLabel && currentLabel !== "Playing…"
          ? currentLabel.length > 14
            ? currentLabel.slice(0, 12) + "…"
            : currentLabel
          : "Music";
      tabText.textContent = short;
    }
    const t = tab();
    if (t) {
      t.title = dockOpen ? "Close music" : `Open music · ${currentLabel || "Music"}`;
      t.setAttribute(
        "aria-label",
        dockOpen ? "Close music panel" : `Open music panel · ${currentLabel || "Music"}`
      );
    }
  }

  function applyDock(open, { persist = true } = {}) {
    dockOpen = !!open;
    const d = dock();
    const t = tab();
    const sc = scrim();
    if (d) d.classList.toggle("is-open", dockOpen);
    if (t) t.setAttribute("aria-expanded", dockOpen ? "true" : "false");
    if (sc) {
      const narrow = window.matchMedia("(max-width: 820px)").matches;
      sc.hidden = !(dockOpen && narrow);
    }
    updateLabels();
    if (persist) {
      try {
        localStorage.setItem(DOCK_KEY, dockOpen ? "1" : "0");
      } catch {
        /* ignore */
      }
    }
  }

  function toggleDock() {
    applyDock(!dockOpen);
  }

  function openDock() {
    applyDock(true);
  }

  function closeDock() {
    applyDock(false);
  }

  function selectMusic(id, embed, title, { forceReload = false } = {}) {
    if (!embed) return;
    const f = frame();
    const s = shell();
    const e = empty();
    if (!f || !s) return;

    activeMusicId = id;
    const src = withAutoplay(embed);

    if (currentEmbed === embed && playing && !forceReload) {
      paintMusicList();
      s.hidden = false;
      return;
    }

    currentEmbed = embed;
    currentLabel = title || id || "Playing…";
    f.src = src;

    playing = true;
    s.hidden = false;
    if (e) e.hidden = true;
    updateLabels();

    try {
      localStorage.setItem(
        MUSIC_KEY,
        JSON.stringify({ tab: musicTab, id, embed, title: currentLabel })
      );
    } catch {
      /* ignore */
    }
    paintMusicList();
  }

  function nudgeAutoplayOnGesture() {
    if (gestureHooked) return;
    gestureHooked = true;
    const once = () => {
      window.removeEventListener("pointerdown", once, true);
      window.removeEventListener("keydown", once, true);
      window.removeEventListener("touchstart", once, true);
      if (!playing || !currentEmbed) return;
      selectMusic(activeMusicId || "nudge", currentEmbed, currentLabel, { forceReload: true });
    };
    window.addEventListener("pointerdown", once, { capture: true, passive: true });
    window.addEventListener("keydown", once, { capture: true });
    window.addEventListener("touchstart", once, { capture: true, passive: true });
  }

  function autoStartMusic() {
    try {
      const raw = localStorage.getItem(MUSIC_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.tab) musicTab = data.tab;
        paintMusicTabs();
        if (data.embed) {
          selectMusic(data.id || "restored", data.embed, data.title || "");
          nudgeAutoplayOnGesture();
          return;
        }
      }
    } catch {
      /* ignore */
    }
    musicTab = "spotify";
    paintMusicTabs();
    const list = playlists.spotify || [];
    const pick =
      list.find((p) => p.id === DEFAULT_SPOTIFY_ID) ||
      list[0] || {
        id: DEFAULT_SPOTIFY_ID,
        title: "God's encouragement",
        embed: DEFAULT_EMBED,
      };
    if (pick?.embed) selectMusic(pick.id, pick.embed, pick.title);
    nudgeAutoplayOnGesture();
  }

  function restoreDockState() {
    let open = false;
    try {
      const v = localStorage.getItem(DOCK_KEY);
      if (v === "1") open = true;
      else if (v === "0") open = false;
      else open = window.matchMedia("(min-width: 1100px)").matches;
    } catch {
      open = false;
    }
    applyDock(open, { persist: false });
  }

  function bindUi() {
    $$("[data-music-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        musicTab = btn.dataset.musicTab;
        paintMusicTabs();
        paintMusicList();
      });
    });

    tab()?.addEventListener("click", (e) => {
      e.preventDefault();
      toggleDock();
    });
    $("#music-dock-close")?.addEventListener("click", (e) => {
      e.preventDefault();
      closeDock();
    });
    scrim()?.addEventListener("click", () => closeDock());

    $("#nav-music")?.addEventListener("click", (e) => {
      e.preventDefault();
      toggleDock();
    });

    if (location.hash === "#worship") openDock();
    window.addEventListener("hashchange", () => {
      if (location.hash === "#worship") openDock();
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && dockOpen) closeDock();
    });

    window.addEventListener("resize", () => {
      applyDock(dockOpen, { persist: false });
    });
  }

  async function boot() {
    restoreDockState();
    autoStartMusic();
    bindUi();

    try {
      playlists = await loadJson("data/playlists.json");
      paintMusicTabs();
      paintMusicList();
      if (!activeMusicId || activeMusicId === DEFAULT_SPOTIFY_ID) {
        const list = playlists.spotify || [];
        const pick = list.find((p) => p.id === DEFAULT_SPOTIFY_ID) || list[0];
        if (pick?.embed && pick.embed !== currentEmbed) {
          selectMusic(pick.id, pick.embed, pick.title);
        } else {
          paintMusicList();
        }
      }
    } catch (err) {
      console.warn("[ambient]", err);
      const el = $("#ambient-error");
      if (el) {
        el.hidden = false;
        el.textContent = `Could not load music list: ${err.message}`;
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
