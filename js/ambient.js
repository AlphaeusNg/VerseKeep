/**
 * VerseKeep music — station dock + free-floating small player (matches AA).
 * Shell is mounted on body so drag is never trapped by dock transforms.
 */
(function () {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const MUSIC_KEY = "versekeep-music";
  const UI_KEY = "versekeep-music-ui-v4";
  const DEFAULT_SPOTIFY_ID = "alph-gods-encouragement";
  const DEFAULT_EMBED =
    "https://open.spotify.com/embed/playlist/0qKlX3MZWEHZgR17jNfI3e?utm_source=generator";
  const SNAP_LEFT = 96;

  let playlists = { youtube: [], spotify: [] };
  let musicTab = "spotify";
  let activeMusicId = null;
  let currentEmbed = "";
  let currentLabel = "Playing…";
  let lastEmbed = "";
  let playing = false;
  let gestureHooked = false;
  let dockOpen = false;
  let playerMode = "home";
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

  function dockRoot() {
    return $("#worship");
  }
  function tab() {
    return $("#music-dock-tab");
  }
  function scrim() {
    return $("#music-dock-scrim");
  }
  function slot() {
    return $("#music-player-slot");
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

  function ensureShellOnBody() {
    const s = shell();
    if (!s) return null;
    if (s.parentElement !== document.body) document.body.appendChild(s);
    return s;
  }

  function ensureBarChrome() {
    const s = ensureShellOnBody();
    const bar = s?.querySelector(".music-player-bar");
    if (!bar) return;
    if (!$("#music-player-grip")) {
      const g = document.createElement("span");
      g.id = "music-player-grip";
      g.className = "music-player-grip";
      g.setAttribute("aria-hidden", "true");
      g.title = "Drag player";
      g.textContent = "⋮⋮";
      bar.insertBefore(g, bar.firstChild);
    }
    if (!$("#music-player-min")) {
      const b = document.createElement("button");
      b.type = "button";
      b.id = "music-player-min";
      b.className = "music-player-min";
      b.title = "Minimize to side tab";
      b.setAttribute("aria-label", "Minimize to side tab");
      b.textContent = "–";
      bar.appendChild(b);
    }
    if (!$("#music-player-close")) {
      const b = document.createElement("button");
      b.type = "button";
      b.id = "music-player-close";
      b.className = "music-player-close";
      b.title = "Stop music";
      b.setAttribute("aria-label", "Stop music");
      b.textContent = "×";
      bar.appendChild(b);
    }
  }

  function updateLabels() {
    const lab = $("#music-player-label");
    if (lab) lab.textContent = playing ? currentLabel : "Stopped";
    const short = playing
      ? currentLabel.length > 14
        ? currentLabel.slice(0, 12) + "…"
        : currentLabel
      : "Music";
    const tabText = $("#music-dock-tab-text");
    if (tabText) tabText.textContent = short;
    const t = tab();
    if (t) {
      t.setAttribute("aria-expanded", dockOpen ? "true" : "false");
      t.title = dockOpen
        ? "Close stations"
        : playerMode === "mini" && playing
          ? `Open stations · ${currentLabel} (playing)`
          : "Open stations";
      t.classList.toggle("is-active-tab", dockOpen);
      t.classList.toggle("is-player-mini", playerMode === "mini" && playing);
    }
    dockRoot()?.classList.toggle("is-playing", playing);
    $("#music-mini-tab")?.remove();
  }

  function persistUi() {
    try {
      localStorage.setItem(
        UI_KEY,
        JSON.stringify({
          dockOpen,
          playerMode,
          float: floatPos,
          playing,
          id: activeMusicId,
          embed: lastEmbed || currentEmbed,
          label: currentLabel,
          tab: musicTab,
        })
      );
    } catch {
      /* ignore */
    }
  }

  function clearShellPos(s) {
    if (!s) return;
    s.style.left = "";
    s.style.top = "";
    s.style.right = "";
    s.style.bottom = "";
    s.style.width = "";
    s.style.maxWidth = "";
    s.style.transform = "";
    s.classList.remove("is-dragged", "is-popup", "is-home", "is-minimized", "is-snap-near", "is-dragging");
  }

  function setChrome(floaty) {
    const minB = $("#music-player-min");
    const closeB = $("#music-player-close");
    const grip = $("#music-player-grip");
    if (minB) minB.hidden = !floaty;
    if (closeB) closeB.hidden = !floaty;
    if (grip) grip.hidden = !floaty;
  }

  function placePlayerHome() {
    const s = ensureShellOnBody();
    const sl = slot();
    if (!s) return;
    playerMode = "home";
    s.classList.remove("is-popup", "is-minimized", "is-dragged");
    s.classList.add("is-home");
    s.hidden = !playing;
    clearShellPos(s);
    if (!playing || !sl) {
      setChrome(false);
      return;
    }
    const rect = sl.getBoundingClientRect();
    const slotOnScreen =
      dockOpen && rect.width > 8 && rect.bottom > 0 && rect.top < (window.innerHeight || 0);
    if (slotOnScreen) {
      s.style.position = "fixed";
      s.style.left = `${Math.max(0, rect.left)}px`;
      s.style.top = `${Math.max(0, rect.top)}px`;
      s.style.width = `${rect.width}px`;
      s.style.zIndex = "58";
      sl.style.minHeight = `${Math.max(s.offsetHeight || 180, 168)}px`;
      setChrome(false);
    } else {
      placePlayerFloat({ soft: true });
      return;
    }
  }

  function placePlayerFloat({ soft = false } = {}) {
    const s = ensureShellOnBody();
    if (!s || !playing) return;
    playerMode = "float";
    s.hidden = false;
    s.classList.add("is-popup");
    s.classList.remove("is-home", "is-minimized");
    s.style.position = "fixed";
    s.style.zIndex = "80";
    s.style.width = "min(340px, calc(100vw - 1.5rem))";
    s.style.maxWidth = "calc(100vw - 1rem)";
    if (floatPos && Number.isFinite(floatPos.left)) {
      const pos = clamp(floatPos.left, floatPos.top, s);
      floatPos = pos;
      s.style.left = `${pos.left}px`;
      s.style.top = `${pos.top}px`;
      s.style.right = "auto";
      s.style.bottom = "auto";
      s.classList.add("is-dragged");
    } else {
      s.style.right = "1rem";
      s.style.bottom = "1rem";
      s.style.left = "auto";
      s.style.top = "auto";
      s.classList.remove("is-dragged");
    }
    const sl = slot();
    if (sl) sl.style.minHeight = "";
    setChrome(true);
    if (!soft) persistUi();
  }

  function placePlayerMini() {
    const s = ensureShellOnBody();
    if (s) {
      s.hidden = true;
      s.classList.add("is-minimized", "is-popup");
      s.classList.remove("is-home");
    }
    playerMode = "mini";
    setChrome(false);
    updateLabels();
  }

  function setPlayerMode(next, { persist = true } = {}) {
    if (!playing && next !== "home") {
      placePlayerHome();
      if (persist) persistUi();
      return;
    }
    if (next === "home") placePlayerHome();
    else if (next === "mini") placePlayerMini();
    else placePlayerFloat();
    if (persist) persistUi();
  }

  function setDockOpen(open, { persist = true } = {}) {
    dockOpen = !!open;
    const d = dockRoot();
    const t = tab();
    const sc = scrim();
    if (d) {
      d.classList.toggle("is-open", dockOpen);
      d.classList.toggle("is-dock", dockOpen);
      d.classList.toggle("is-tab", !dockOpen);
    }
    if (t) {
      t.setAttribute("aria-expanded", dockOpen ? "true" : "false");
      t.classList.toggle("is-active-tab", dockOpen);
    }
    if (sc) {
      const narrow = window.matchMedia("(max-width: 820px)").matches;
      sc.hidden = !(dockOpen && narrow);
    }
    if (playing) {
      if (playerMode === "home") placePlayerHome();
      else if (playerMode === "float") placePlayerFloat({ soft: true });
    }
    updateLabels();
    if (persist) persistUi();
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
      e.textContent = "Music stopped · pick a station";
    }
    setPlayerMode("home", { persist: false });
    updateLabels();
    try {
      localStorage.setItem(
        MUSIC_KEY,
        JSON.stringify({
          tab: musicTab,
          id: activeMusicId,
          embed: lastEmbed,
          title: currentLabel,
          stopped: true,
        })
      );
    } catch {
      /* ignore */
    }
    persistUi();
  }

  function selectMusic(id, embed, title, { forceReload = false } = {}) {
    if (!embed) return;
    ensureShellOnBody();
    ensureBarChrome();
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
      setPlayerMode(playerMode === "mini" ? "mini" : playerMode === "float" ? "float" : "home");
      return;
    }

    currentEmbed = embed;
    lastEmbed = embed;
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

    if (playerMode === "mini") placePlayerMini();
    else if (playerMode === "float") placePlayerFloat();
    else placePlayerHome();
    persistUi();
  }

  /**
   * Soft bounds only: player may hang mostly off-screen (past the viewport
   * edge). Keep a grab strip (~48px) visible so it can always be dragged back.
   */
  function clamp(left, top, el) {
    const w = el?.offsetWidth || 320;
    const h = el?.offsetHeight || 200;
    const vw = window.innerWidth || 800;
    const vh = window.innerHeight || 600;
    const keep = 48;
    return {
      left: Math.min(Math.max(-(w - keep), left), vw - keep),
      top: Math.min(Math.max(-(h - keep), top), vh - keep),
    };
  }

  function bindPlayerDrag() {
    const s = ensureShellOnBody();
    const bar = s?.querySelector(".music-player-bar");
    if (!s || !bar || bar.dataset.dragBound) return;
    bar.dataset.dragBound = "1";

    bar.addEventListener("pointerdown", (e) => {
      if (e.button != null && e.button !== 0) return;
      if (e.target.closest("button, a, iframe")) return;
      if (playerMode === "mini" || !playing) return;
      e.preventDefault();
      const rect = s.getBoundingClientRect();
      if (playerMode === "home") {
        floatPos = { left: rect.left, top: rect.top };
        placePlayerFloat({ soft: true });
      }
      drag = { ox: e.clientX - rect.left, oy: e.clientY - rect.top, id: e.pointerId };
      try {
        bar.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      s.classList.add("is-dragging");
    });
    bar.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const pos = clamp(e.clientX - drag.ox, e.clientY - drag.oy, s);
      floatPos = pos;
      s.style.left = `${pos.left}px`;
      s.style.top = `${pos.top}px`;
      s.style.right = "auto";
      s.style.bottom = "auto";
      s.classList.add("is-dragged");
      s.classList.toggle("is-snap-near", pos.left < SNAP_LEFT && dockOpen);
    });
    const end = (e) => {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      const near = floatPos && floatPos.left < SNAP_LEFT && dockOpen;
      drag = null;
      s.classList.remove("is-dragging", "is-snap-near");
      if (near) {
        floatPos = null;
        setPlayerMode("home");
      } else {
        setPlayerMode("float");
      }
    };
    bar.addEventListener("pointerup", end);
    bar.addEventListener("pointercancel", end);
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
          lastEmbed = data.embed || "";
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
        if (data.float && Number.isFinite(data.float.left)) floatPos = data.float;
        if (data.playerMode === "float" || data.playerMode === "mini" || data.playerMode === "home") {
          playerMode = data.playerMode;
        }
        setDockOpen(!!data.dockOpen, { persist: false });
        return;
      }
    } catch {
      /* ignore */
    }
    setDockOpen(false, { persist: false });
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
      e.stopPropagation();
      const opening = !dockOpen;
      setDockOpen(opening);
      if (opening && playing && playerMode === "mini") setPlayerMode("home");
    });
    $("#music-dock-close")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDockOpen(false);
    });
    scrim()?.addEventListener("click", () => setDockOpen(false));

    document.addEventListener(
      "click",
      (e) => {
        if (e.target.closest?.("#music-player-min")) {
          e.preventDefault();
          e.stopPropagation();
          setPlayerMode("mini");
        } else if (e.target.closest?.("#music-player-close")) {
          e.preventDefault();
          e.stopPropagation();
          stopMusic();
        }
      },
      true
    );

    $("#nav-music")?.addEventListener("click", (e) => {
      e.preventDefault();
      setDockOpen(!dockOpen);
    });

    if (location.hash === "#worship") setDockOpen(true);
    window.addEventListener("hashchange", () => {
      if (location.hash === "#worship") setDockOpen(true);
    });
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && dockOpen) setDockOpen(false);
    });
    window.addEventListener(
      "scroll",
      () => {
        if (playerMode === "home" && playing) placePlayerHome();
      },
      { passive: true }
    );
    window.addEventListener("resize", () => {
      if (playerMode === "home" && playing) placePlayerHome();
      else if (playerMode === "float" && floatPos) {
        const s = shell();
        floatPos = clamp(floatPos.left, floatPos.top, s);
        if (s) {
          s.style.left = `${floatPos.left}px`;
          s.style.top = `${floatPos.top}px`;
        }
      }
      setDockOpen(dockOpen, { persist: false });
    });
  }

  async function boot() {
    ensureShellOnBody();
    ensureBarChrome();
    $("#music-mini-tab")?.remove();
    restoreUi();
    autoStartMusic();
    if (playing) setPlayerMode(playerMode, { persist: false });
    bindPlayerDrag();
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
