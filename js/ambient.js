/**
 * VerseKeep music — dock / float / tab (matches AlpArcade).
 * - Side tab packs the player (music keeps playing)
 * - Drag panel out → free floating popup
 * - Drag near left edge → snaps to left dock
 * - Minimize (–) → side tab
 * - Close (×) → stop audio and pack to tab
 * Iframe never reparented.
 */
(function () {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const MUSIC_KEY = "versekeep-music";
  const UI_KEY = "versekeep-music-ui-v2";
  const DEFAULT_SPOTIFY_ID = "alph-gods-encouragement";
  const DEFAULT_EMBED =
    "https://open.spotify.com/embed/playlist/0qKlX3MZWEHZgR17jNfI3e?utm_source=generator";
  const SNAP_X = 72;

  let playlists = { youtube: [], spotify: [] };
  let musicTab = "spotify";
  let activeMusicId = null;
  let currentEmbed = "";
  let currentLabel = "Playing…";
  let playing = false;
  let gestureHooked = false;
  /** @type {'tab'|'dock'|'float'} */
  let mode = "tab";
  let floatPos = null;
  let drag = null;

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

  function dockEl() {
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
    if (lab) lab.textContent = playing ? currentLabel : "Stopped";
    const tabText = $("#music-dock-tab-text");
    if (tabText) {
      if (!playing) tabText.textContent = "Music";
      else {
        tabText.textContent =
          currentLabel.length > 14 ? currentLabel.slice(0, 12) + "…" : currentLabel || "Music";
      }
    }
    const t = tab();
    if (t) {
      const tip =
        mode === "tab"
          ? playing
            ? `Open music · ${currentLabel}`
            : "Open music"
          : mode === "float"
            ? "Dock music to the left"
            : "Minimize music to side tab";
      t.title = tip;
      t.setAttribute("aria-expanded", mode !== "tab" ? "true" : "false");
      t.setAttribute("aria-label", tip);
    }
    const d = dockEl();
    if (d) d.dataset.playing = playing ? "1" : "0";
  }

  function persistUi() {
    try {
      localStorage.setItem(
        UI_KEY,
        JSON.stringify({
          mode,
          float: floatPos,
          playing,
          id: activeMusicId,
          embed: currentEmbed,
          label: currentLabel,
          tab: musicTab,
        })
      );
    } catch {
      /* ignore */
    }
  }

  function clearPanelInlinePos(p) {
    if (!p) return;
    p.style.left = "";
    p.style.top = "";
    p.style.right = "";
    p.style.bottom = "";
    p.style.width = "";
    p.style.maxHeight = "";
    p.style.transform = "";
  }

  function setMode(next, { persist = true } = {}) {
    mode = next;
    const d = dockEl();
    const p = panel();
    const sc = scrim();
    if (!d || !p) return;

    d.classList.remove("is-tab", "is-dock", "is-float", "is-open", "is-dragging", "is-snap-near");
    d.classList.add(`is-${mode}`);
    if (mode === "dock" || mode === "float") d.classList.add("is-open");

    if (mode === "float" && floatPos) {
      p.style.left = `${floatPos.left}px`;
      p.style.top = `${floatPos.top}px`;
      p.style.right = "auto";
      p.style.bottom = "auto";
      p.style.transform = "none";
    } else {
      clearPanelInlinePos(p);
    }

    if (sc) {
      const narrow = window.matchMedia("(max-width: 820px)").matches;
      sc.hidden = !(mode === "dock" && narrow);
    }

    updateLabels();
    if (persist) persistUi();
  }

  function minimizeToTab() {
    setMode("tab");
  }

  function openDock() {
    setMode("dock");
  }

  function stopMusic() {
    playing = false;
    const f = frame();
    if (f) {
      try {
        f.src = "about:blank";
      } catch {
        f.removeAttribute("src");
      }
    }
    currentEmbed = "";
    const s = shell();
    if (s) s.hidden = true;
    const e = empty();
    if (e) {
      e.hidden = false;
      e.textContent = "Music stopped · pick a station to play";
    }
    updateLabels();
    try {
      const raw = localStorage.getItem(MUSIC_KEY);
      const prev = raw ? JSON.parse(raw) : {};
      localStorage.setItem(
        MUSIC_KEY,
        JSON.stringify({
          ...prev,
          tab: musicTab,
          id: activeMusicId || prev.id,
          embed: prev.embed || "",
          title: currentLabel || prev.title,
          stopped: true,
        })
      );
    } catch {
      /* ignore */
    }
    persistUi();
  }

  function closeAndStop() {
    stopMusic();
    setMode("tab");
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
      if (e) e.hidden = true;
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
        JSON.stringify({
          tab: musicTab,
          id,
          embed,
          title: currentLabel,
          stopped: false,
        })
      );
    } catch {
      /* ignore */
    }
    paintMusicList();
    persistUi();
    if (mode === "tab") openDock();
  }

  function clampFloat(left, top, el) {
    const w = el?.offsetWidth || 320;
    const h = el?.offsetHeight || 360;
    const maxL = Math.max(8, (window.innerWidth || 0) - w - 8);
    const maxT = Math.max(8, (window.innerHeight || 0) - Math.min(h, window.innerHeight * 0.9) - 8);
    return {
      left: Math.min(Math.max(8, left), maxL),
      top: Math.min(Math.max(8, top), maxT),
    };
  }

  function bindDrag() {
    const p = panel();
    const head = $("#music-dock-drag") || p?.querySelector(".music-dock-head");
    if (!p || !head || head.dataset.dragBound) return;
    head.dataset.dragBound = "1";

    head.addEventListener("pointerdown", (e) => {
      if (e.button != null && e.button !== 0) return;
      if (e.target.closest("button, a, input, select, textarea, iframe")) return;
      e.preventDefault();
      const rect = p.getBoundingClientRect();
      if (mode === "dock" || mode === "tab") {
        floatPos = { left: rect.left, top: rect.top };
        setMode("float", { persist: false });
      }
      drag = {
        ox: e.clientX - rect.left,
        oy: e.clientY - rect.top,
        id: e.pointerId,
      };
      head.setPointerCapture?.(e.pointerId);
      dockEl()?.classList.add("is-dragging");
    });

    head.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const pos = clampFloat(e.clientX - drag.ox, e.clientY - drag.oy, p);
      floatPos = pos;
      p.style.left = `${pos.left}px`;
      p.style.top = `${pos.top}px`;
      p.style.right = "auto";
      p.style.bottom = "auto";
      p.style.transform = "none";
      dockEl()?.classList.toggle("is-snap-near", pos.left < SNAP_X);
    });

    const end = (e) => {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      const near = floatPos && floatPos.left < SNAP_X;
      drag = null;
      dockEl()?.classList.remove("is-dragging", "is-snap-near");
      if (near) {
        floatPos = null;
        setMode("dock");
      } else {
        setMode("float");
      }
    };
    head.addEventListener("pointerup", end);
    head.addEventListener("pointercancel", end);
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
        if (data.stopped) {
          activeMusicId = data.id || null;
          currentLabel = data.title || "Playing…";
          updateLabels();
          return;
        }
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

  function restoreUi() {
    try {
      const raw = localStorage.getItem(UI_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.float && typeof data.float.left === "number") floatPos = data.float;
        if (data.mode === "float" || data.mode === "dock" || data.mode === "tab") {
          setMode(data.mode, { persist: false });
          return;
        }
      }
    } catch {
      /* ignore */
    }
    setMode(window.matchMedia("(min-width: 1100px)").matches ? "dock" : "tab", {
      persist: false,
    });
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
      if (mode === "tab" || mode === "float") openDock();
      else minimizeToTab();
    });
    $("#music-dock-min")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      minimizeToTab();
    });
    $("#music-dock-close")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeAndStop();
    });
    scrim()?.addEventListener("click", () => minimizeToTab());

    $("#nav-music")?.addEventListener("click", (e) => {
      e.preventDefault();
      if (mode === "tab") openDock();
      else if (mode === "dock") minimizeToTab();
      else openDock();
    });

    if (location.hash === "#worship") openDock();
    window.addEventListener("hashchange", () => {
      if (location.hash === "#worship") openDock();
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && (mode === "dock" || mode === "float")) minimizeToTab();
    });

    window.addEventListener("resize", () => {
      if (mode === "float" && floatPos) {
        const p = panel();
        floatPos = clampFloat(floatPos.left, floatPos.top, p);
        if (p) {
          p.style.left = `${floatPos.left}px`;
          p.style.top = `${floatPos.top}px`;
        }
        persistUi();
      } else if (mode === "dock") {
        setMode("dock", { persist: false });
      }
    });

    bindDrag();
  }

  async function boot() {
    restoreUi();
    autoStartMusic();
    bindUi();

    try {
      playlists = await loadJson("data/playlists.json");
      paintMusicTabs();
      paintMusicList();
      if (!activeMusicId || activeMusicId === DEFAULT_SPOTIFY_ID) {
        const list = playlists.spotify || [];
        const pick = list.find((p) => p.id === DEFAULT_SPOTIFY_ID) || list[0];
        if (pick?.embed && pick.embed !== currentEmbed && playing) {
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
