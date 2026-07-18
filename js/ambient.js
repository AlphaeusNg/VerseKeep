/**
 * VerseKeep music — station dock only (matches AA).
 * Player stays in the side panel slot; never free-floats or drags.
 * Iframe stays mounted when closed so audio never cuts.
 */
(function () {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const MUSIC_KEY = "versekeep-music";
  const UI_KEY = "versekeep-music-ui-v5";
  const DEFAULT_SPOTIFY_ID = "alph-gods-encouragement";
  const DEFAULT_EMBED =
    "https://open.spotify.com/embed/playlist/0qKlX3MZWEHZgR17jNfI3e?utm_source=generator";

  let playlists = { youtube: [], spotify: [] };
  let musicTab = "spotify";
  let activeMusicId = null;
  let currentEmbed = "";
  let currentLabel = "Playing…";
  let lastEmbed = "";
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

  function dockRoot() {
    return $("#worship");
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

  /** Keep shell inside the dock slot — never reparent to body. */
  function ensureShellInSlot() {
    const s = shell();
    const slot = $("#music-player-slot");
    if (!s || !slot) return s;
    if (s.parentElement !== slot) slot.appendChild(s);
    s.classList.add("music-player-shell", "is-docked");
    s.classList.remove("is-popup", "is-home", "is-minimized", "is-dragged", "is-dragging", "is-snap-near");
    s.style.position = "";
    s.style.left = "";
    s.style.top = "";
    s.style.right = "";
    s.style.bottom = "";
    s.style.width = "";
    s.style.maxWidth = "";
    s.style.transform = "";
    s.style.zIndex = "";
    return s;
  }

  function ensureStopButton() {
    const bar = shell()?.querySelector(".music-player-bar");
    if (!bar) return;
    $("#music-player-grip")?.remove();
    $("#music-player-min")?.remove();
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
    const closeB = $("#music-player-close");
    if (closeB) closeB.hidden = false;
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
        : playing
          ? `Open stations · ${currentLabel} (playing)`
          : "Open stations";
      t.classList.toggle("is-active-tab", dockOpen);
      t.classList.toggle("is-playing-tab", playing);
      t.classList.remove("is-player-mini");
      t.style.zIndex = "";
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

  function setDockOpen(open, { persist = true } = {}) {
    dockOpen = !!open;
    const d = dockRoot();
    const t = tab();
    const sc = scrim();
    if (d) {
      d.classList.toggle("is-open", dockOpen);
      d.classList.toggle("is-dock", dockOpen);
      d.classList.toggle("is-tab", !dockOpen);
      d.classList.toggle("is-playing", playing);
    }
    if (t) {
      t.setAttribute("aria-expanded", dockOpen ? "true" : "false");
      t.classList.toggle("is-active-tab", dockOpen);
    }
    if (sc) {
      const narrow = window.matchMedia("(max-width: 820px)").matches;
      sc.hidden = !(dockOpen && narrow);
      sc.setAttribute("aria-hidden", sc.hidden ? "true" : "false");
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
    ensureShellInSlot();
    ensureStopButton();
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
      updateLabels();
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
    persistUi();
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
        setDockOpen(!!data.dockOpen, { persist: false });
        return;
      }
      localStorage.removeItem("versekeep-music-ui-v4");
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
      setDockOpen(!dockOpen);
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
        if (e.target.closest?.("#music-player-close")) {
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
    window.addEventListener("resize", () => {
      const sc = scrim();
      if (sc) {
        const narrow = window.matchMedia("(max-width: 820px)").matches;
        sc.hidden = !(dockOpen && narrow);
        sc.setAttribute("aria-hidden", sc.hidden ? "true" : "false");
      }
    });
  }

  async function boot() {
    ensureShellInSlot();
    ensureStopButton();
    $("#music-mini-tab")?.remove();
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
