/**
 * VerseKeep music — single iframe player (never reparented → no audio cut on dock).
 * - Music section always shows a soundboard (live when in view, mirror when floating)
 * - Scroll away → bottom-right popup (drag · minimize · close without scrolling)
 * - Station picks + autoplay defaults unchanged
 */
(function () {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const MUSIC_KEY = "versekeep-music";
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
  let preferHome = false;
  let mode = "home"; // home | popup | mini
  let drag = null;
  let popupPos = null;

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

  function shell() {
    return $("#music-player-shell");
  }
  function slot() {
    return $("#music-player-slot");
  }
  function frame() {
    return $("#music-frame");
  }
  function empty() {
    return $("#music-empty");
  }
  function closeBtn() {
    return $("#music-player-close");
  }
  function minBtn() {
    return $("#music-player-min");
  }
  function miniTab() {
    return $("#music-mini-tab");
  }
  function mirror() {
    return $("#music-slot-mirror");
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

  function ensureHost() {
    let host = $("#music-popup-host");
    if (!host) {
      host = document.createElement("div");
      host.id = "music-popup-host";
      host.className = "music-popup-host";
      host.setAttribute("aria-live", "polite");
      document.body.appendChild(host);
    }
    const s = shell();
    // Never reparent after first attach if already under host — moving iframe stops audio
    if (s && s.parentElement !== host) host.appendChild(s);
    return host;
  }

  function ensureMirror() {
    const sl = slot();
    if (!sl) return null;
    let m = mirror();
    if (!m) {
      m = document.createElement("button");
      m.type = "button";
      m.id = "music-slot-mirror";
      m.className = "music-slot-mirror";
      m.hidden = true;
      m.innerHTML = `<span class="music-slot-mirror-icon" aria-hidden="true">♪</span>
        <span class="music-slot-mirror-body">
          <strong class="music-slot-mirror-title">Now playing</strong>
          <small class="music-slot-mirror-sub mono" id="music-slot-mirror-sub">—</small>
        </span>
        <span class="music-slot-mirror-hint mono">floating</span>`;
      sl.appendChild(m);
      m.addEventListener("click", () => {
        if (mode === "mini") expandFromTab();
        else if (mode !== "popup") {
          preferHome = false;
          setMode("popup");
        }
      });
    }
    return m;
  }

  function ensureMiniTab() {
    let tab = miniTab();
    if (tab) return tab;
    tab = document.createElement("button");
    tab.type = "button";
    tab.id = "music-mini-tab";
    tab.className = "music-mini-tab";
    tab.hidden = true;
    tab.setAttribute("aria-label", "Expand music player");
    tab.innerHTML = `<span class="music-mini-tab-icon" aria-hidden="true">♪</span><span class="music-mini-tab-label mono" id="music-mini-tab-label">Music</span>`;
    document.body.appendChild(tab);
    tab.addEventListener("click", () => expandFromTab());
    return tab;
  }

  function ensureBarControls() {
    const bar = shell()?.querySelector(".music-player-bar");
    if (!bar) return;
    if (!bar.id) bar.id = "music-player-bar";
    if (!minBtn()) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.id = "music-player-min";
      btn.className = "music-player-min";
      btn.title = "Minimize to tab";
      btn.setAttribute("aria-label", "Minimize music player to a tab");
      btn.hidden = true;
      btn.textContent = "–";
      bar.appendChild(btn);
    }
    if (!closeBtn()) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.id = "music-player-close";
      btn.className = "music-player-close";
      btn.title = "Dock player back to Music section";
      btn.setAttribute("aria-label", "Close popup and dock to Music section");
      btn.hidden = true;
      btn.textContent = "×";
      bar.appendChild(btn);
    }
  }

  function setChromeVisible(show) {
    if (closeBtn()) closeBtn().hidden = !show;
    if (minBtn()) minBtn().hidden = !show;
  }

  function updateLabels() {
    const lab = $("#music-player-label");
    if (lab) lab.textContent = currentLabel;
    const sub = $("#music-slot-mirror-sub");
    if (sub) sub.textContent = currentLabel;
    const tabLab = $("#music-mini-tab-label");
    if (tabLab) {
      tabLab.textContent =
        currentLabel.length > 18 ? currentLabel.slice(0, 16) + "…" : currentLabel;
    }
  }

  function clearShellPos(s) {
    if (!s) return;
    s.style.left = "";
    s.style.top = "";
    s.style.right = "";
    s.style.bottom = "";
    s.style.width = "";
    s.classList.remove("is-dragged");
  }

  function slotVisible() {
    const sl = slot();
    if (!sl) return false;
    const rect = sl.getBoundingClientRect();
    const vh = window.innerHeight || 0;
    return rect.bottom > 72 && rect.top < vh - 48 && rect.width > 0;
  }

  function placeHome() {
    const s = shell();
    const sl = slot();
    if (!s || !sl) return;
    ensureHost();
    const rect = sl.getBoundingClientRect();
    s.classList.remove("is-popup", "is-minimized");
    s.classList.add("is-home");
    s.hidden = !playing;
    setChromeVisible(false);
    clearShellPos(s);
    if (rect.width > 0) {
      s.style.position = "fixed";
      s.style.left = `${Math.max(0, rect.left)}px`;
      s.style.top = `${Math.max(0, rect.top)}px`;
      s.style.width = `${rect.width}px`;
      s.style.right = "auto";
      s.style.bottom = "auto";
      s.style.zIndex = "40";
    }
    const h = Math.max(s.offsetHeight || 180, 168);
    sl.style.minHeight = `${h}px`;
    const m = ensureMirror();
    if (m) m.hidden = true;
    const tab = miniTab();
    if (tab) tab.hidden = true;
    mode = "home";
  }

  function placePopup() {
    const s = shell();
    if (!s) return;
    ensureHost();
    s.classList.add("is-popup");
    s.classList.remove("is-home", "is-minimized");
    s.hidden = false;
    setChromeVisible(true);
    s.style.zIndex = "70";
    if (popupPos) {
      s.style.position = "fixed";
      s.style.left = `${popupPos.left}px`;
      s.style.top = `${popupPos.top}px`;
      s.style.right = "auto";
      s.style.bottom = "auto";
      s.style.width = "min(340px, calc(100vw - 1.5rem))";
      s.classList.add("is-dragged");
    } else {
      clearShellPos(s);
      s.style.position = "fixed";
      s.style.right = "1rem";
      s.style.bottom = "1rem";
      s.style.left = "auto";
      s.style.top = "auto";
      s.style.width = "min(340px, calc(100vw - 1.5rem))";
    }
    const m = ensureMirror();
    if (m) {
      m.hidden = false;
      updateLabels();
    }
    const tab = miniTab();
    if (tab) tab.hidden = true;
    const sl = slot();
    if (sl) sl.style.minHeight = "";
    mode = "popup";
  }

  function placeMini() {
    const s = shell();
    if (s) {
      s.hidden = true;
      s.classList.add("is-minimized", "is-popup");
      s.classList.remove("is-home");
    }
    setChromeVisible(false);
    const tab = ensureMiniTab();
    tab.hidden = false;
    updateLabels();
    const m = ensureMirror();
    if (m) {
      m.hidden = false;
      updateLabels();
    }
    mode = "mini";
  }

  function setMode(next) {
    if (!playing && next !== "home") return;
    if (next === "home") placeHome();
    else if (next === "mini") placeMini();
    else placePopup();
  }

  function updateDockState() {
    if (!playing) return;
    const visible = slotVisible();

    if (visible) {
      preferHome = false;
      if (mode !== "home") setMode("home");
      else placeHome();
      return;
    }

    if (preferHome) {
      if (mode !== "home") setMode("home");
      return;
    }

    if (mode === "mini") {
      placeMini();
      return;
    }
    if (mode !== "popup") setMode("popup");
    else placePopup();
  }

  function closeToHome() {
    preferHome = true;
    popupPos = null;
    setMode("home");
    // no scrollIntoView — stay where the user is
  }

  function minimize() {
    if (!playing) return;
    preferHome = false;
    setMode("mini");
  }

  function expandFromTab() {
    preferHome = false;
    setMode("popup");
  }

  function bindDrag() {
    const s = shell();
    const bar = $("#music-player-bar") || s?.querySelector(".music-player-bar");
    if (!s || !bar || bar.dataset.dragBound) return;
    bar.dataset.dragBound = "1";

    bar.addEventListener("pointerdown", (e) => {
      if (mode !== "popup") return;
      if (e.target.closest("button, a, iframe")) return;
      e.preventDefault();
      const rect = s.getBoundingClientRect();
      drag = { ox: e.clientX - rect.left, oy: e.clientY - rect.top, id: e.pointerId };
      bar.setPointerCapture?.(e.pointerId);
      s.classList.add("is-dragging");
    });
    bar.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const w = s.offsetWidth || 320;
      const h = s.offsetHeight || 200;
      let left = e.clientX - drag.ox;
      let top = e.clientY - drag.oy;
      left = Math.min(Math.max(4, left), Math.max(4, (window.innerWidth || 0) - w - 4));
      top = Math.min(Math.max(4, top), Math.max(4, (window.innerHeight || 0) - h - 4));
      popupPos = { left, top };
      s.style.left = `${left}px`;
      s.style.top = `${top}px`;
      s.style.right = "auto";
      s.style.bottom = "auto";
      s.classList.add("is-dragged");
    });
    const end = (e) => {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      drag = null;
      s.classList.remove("is-dragging");
    };
    bar.addEventListener("pointerup", end);
    bar.addEventListener("pointercancel", end);
  }

  function selectMusic(id, embed, title, { forceReload = false } = {}) {
    if (!embed) return;
    const f = frame();
    const s = shell();
    const e = empty();
    if (!f || !s) return;

    ensureHost();
    activeMusicId = id;
    const src = withAutoplay(embed);

    if (currentEmbed === embed && playing && !forceReload) {
      paintMusicList();
      s.hidden = false;
      updateDockState();
      return;
    }

    currentEmbed = embed;
    currentLabel = title || id || "Playing…";
    // Change src only — never reparent the iframe (that was stopping Spotify)
    f.src = src;

    playing = true;
    s.hidden = false;
    if (e) e.hidden = true;
    const sl = slot();
    if (sl) sl.hidden = false;
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

    if (mode === "mini") placeMini();
    else if (mode === "popup" && !preferHome) placePopup();
    else placeHome();
    updateDockState();
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

  function bindUi() {
    $$("[data-music-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        musicTab = btn.dataset.musicTab;
        paintMusicTabs();
        paintMusicList();
      });
    });
    closeBtn()?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeToHome();
    });
    minBtn()?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      minimize();
    });
    bindDrag();
    window.addEventListener("scroll", updateDockState, { passive: true });
    window.addEventListener("resize", updateDockState);
    if ("IntersectionObserver" in window && slot()) {
      new IntersectionObserver(() => updateDockState(), {
        threshold: [0, 0.05, 0.25, 0.5, 1],
        rootMargin: "-48px 0px -48px 0px",
      }).observe(slot());
    }
  }

  async function boot() {
    ensureHost();
    ensureBarControls();
    ensureMirror();
    ensureMiniTab();
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
    updateDockState();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
