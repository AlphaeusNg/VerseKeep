/**
 * Worship music for VerseKeep.
 * - Starts in the Music section
 * - When that section scrolls away → bottom-right popup (draggable, closable)
 * - Close returns the player to the Music box
 * - No separate Stop buttons (use embed controls)
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
  let playing = false;
  let gestureHooked = false;
  /** User closed the popup → stay inline until section is seen then left again */
  let preferInline = false;
  let docked = false;
  let minimized = false;
  let drag = null; // { ox, oy, id }
  let popupPos = null; // { left, top } when user dragged

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

  function ensurePopupHost() {
    let host = $("#music-popup-host");
    if (host) return host;
    host = document.createElement("div");
    host.id = "music-popup-host";
    host.className = "music-popup-host";
    host.setAttribute("aria-live", "polite");
    document.body.appendChild(host);
    return host;
  }

  function clearPopupPos(s) {
    if (!s) return;
    s.style.left = "";
    s.style.top = "";
    s.style.right = "";
    s.style.bottom = "";
    s.classList.remove("is-dragged");
  }

  function applyPopupPos(s) {
    if (!s || !popupPos) return;
    s.style.left = `${popupPos.left}px`;
    s.style.top = `${popupPos.top}px`;
    s.style.right = "auto";
    s.style.bottom = "auto";
    s.classList.add("is-dragged");
  }

  function setChromeVisible(isFloating) {
    const c = closeBtn();
    const m = minBtn();
    if (c) c.hidden = !isFloating;
    if (m) m.hidden = !isFloating;
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

  function updateMiniTabLabel() {
    const lab = $("#music-mini-tab-label");
    const title = $("#music-player-label")?.textContent || "Music";
    if (lab) lab.textContent = title.length > 18 ? title.slice(0, 16) + "…" : title;
  }

  function hideMiniTab() {
    const tab = miniTab();
    if (tab) tab.hidden = true;
  }

  function showMiniTab() {
    const tab = ensureMiniTab();
    updateMiniTabLabel();
    tab.hidden = false;
  }

  function mountInline() {
    const s = shell();
    const sl = slot();
    if (!s || !sl) return;
    minimized = false;
    hideMiniTab();
    if (s.parentElement !== sl) sl.appendChild(s);
    s.classList.remove("is-popup", "is-docked", "is-minimized");
    s.hidden = !playing;
    clearPopupPos(s);
    docked = false;
    setChromeVisible(false);
    sl.classList.remove("is-player-docked");
  }

  function mountPopup() {
    const s = shell();
    if (!s) return;
    const host = ensurePopupHost();
    if (s.parentElement !== host) host.appendChild(s);
    s.classList.add("is-popup", "is-docked");
    docked = true;
    setChromeVisible(true);
    slot()?.classList.add("is-player-docked");
    if (popupPos) applyPopupPos(s);
    else clearPopupPos(s);
    if (minimized) {
      s.classList.add("is-minimized");
      s.hidden = true;
      showMiniTab();
    } else {
      s.classList.remove("is-minimized");
      s.hidden = false;
      hideMiniTab();
    }
  }

  function minimizePopup() {
    if (!playing) return;
    // If still inline, treat as dock-then-minimize so user gets a tab
    if (!docked) {
      preferInline = false;
      minimized = false;
      mountPopup();
    }
    minimized = true;
    const s = shell();
    if (s) {
      s.hidden = true;
      s.classList.add("is-minimized");
    }
    showMiniTab();
  }

  function expandFromTab() {
    minimized = false;
    preferInline = false;
    hideMiniTab();
    const s = shell();
    if (s) {
      s.classList.remove("is-minimized");
      s.hidden = false;
    }
    if (!docked) mountPopup();
    else {
      setChromeVisible(true);
      if (popupPos) applyPopupPos(s);
    }
  }

  function slotVisible() {
    const sl = slot();
    if (!sl) return false;
    const rect = sl.getBoundingClientRect();
    const vh = window.innerHeight || 0;
    // Consider "in view" if any meaningful part is on screen
    return rect.bottom > 64 && rect.top < vh - 48;
  }

  function updateDockState() {
    const s = shell();
    if (!s || !playing) return;

    const visible = slotVisible();
    if (visible) {
      // Music section is on screen → player lives there; allow future auto-dock again
      preferInline = false;
      if (docked || minimized) mountInline();
      return;
    }

    // Section off-screen
    if (preferInline) {
      // User closed popup — keep in Music box (off-screen) until they visit Music again
      if (docked || minimized) mountInline();
      return;
    }

    if (!docked) mountPopup();
    else if (minimized) {
      // keep tab visible while scrolled away
      if (s) {
        s.hidden = true;
        s.classList.add("is-minimized");
      }
      showMiniTab();
    }
  }

  function closePopupToMusic() {
    // Return player to Music box without scrolling the page
    preferInline = true;
    popupPos = null;
    mountInline();
  }

  function bindDrag() {
    const s = shell();
    const bar = $("#music-player-bar") || s?.querySelector(".music-player-bar");
    if (!s || !bar || bar.dataset.dragBound) return;
    bar.dataset.dragBound = "1";

    bar.addEventListener("pointerdown", (e) => {
      if (!docked || minimized) return;
      if (e.target.closest("button, a, iframe")) return;
      e.preventDefault();
      const rect = s.getBoundingClientRect();
      drag = {
        ox: e.clientX - rect.left,
        oy: e.clientY - rect.top,
        id: e.pointerId,
      };
      bar.setPointerCapture?.(e.pointerId);
      s.classList.add("is-dragging");
    });

    bar.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const w = s.offsetWidth;
      const h = s.offsetHeight;
      let left = e.clientX - drag.ox;
      let top = e.clientY - drag.oy;
      const maxL = Math.max(0, (window.innerWidth || 0) - w - 4);
      const maxT = Math.max(0, (window.innerHeight || 0) - h - 4);
      left = Math.min(maxL, Math.max(4, left));
      top = Math.min(maxT, Math.max(4, top));
      popupPos = { left, top };
      applyPopupPos(s);
    });

    const endDrag = (e) => {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      drag = null;
      s.classList.remove("is-dragging");
    };
    bar.addEventListener("pointerup", endDrag);
    bar.addEventListener("pointercancel", endDrag);
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
      updateDockState();
      return;
    }

    currentEmbed = embed;
    f.removeAttribute("src");
    requestAnimationFrame(() => {
      f.src = src;
    });

    playing = true;
    s.hidden = false;
    if (e) e.hidden = true;
    const sl = slot();
    if (sl) sl.hidden = false;

    const lab = $("#music-player-label");
    if (lab) lab.textContent = title || id || "Playing…";
    updateMiniTabLabel();

    try {
      localStorage.setItem(
        MUSIC_KEY,
        JSON.stringify({ tab: musicTab, id, embed, title: title || "" })
      );
    } catch {
      /* ignore */
    }
    paintMusicList();
    // Prefer showing in Music section first
    if (!docked && !minimized) mountInline();
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
      selectMusic(activeMusicId || "nudge", currentEmbed, $("#music-player-label")?.textContent || "", {
        forceReload: true,
      });
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
      list[0] ||
      (playlists.youtube || [])[0] || {
        id: DEFAULT_SPOTIFY_ID,
        title: "God's encouragement",
        embed: DEFAULT_EMBED,
      };
    if (pick?.embed) {
      if (
        list.length &&
        !list.some((p) => p.id === pick.id) &&
        (playlists.youtube || []).some((p) => p.id === pick.id)
      ) {
        musicTab = "youtube";
        paintMusicTabs();
      }
      selectMusic(pick.id, pick.embed, pick.title);
    }
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
      closePopupToMusic();
    });
    minBtn()?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      minimizePopup();
    });
    ensureMiniTab();
    bindDrag();
    window.addEventListener("scroll", updateDockState, { passive: true });
    window.addEventListener("resize", updateDockState);
    if ("IntersectionObserver" in window && slot()) {
      new IntersectionObserver(() => updateDockState(), {
        root: null,
        threshold: [0, 0.05, 0.2, 0.5, 1],
        rootMargin: "-40px 0px -40px 0px",
      }).observe(slot());
    }
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
      btn.title = "Return player to Music section";
      btn.setAttribute("aria-label", "Close popup and return to Music section");
      btn.hidden = true;
      btn.textContent = "×";
      bar.appendChild(btn);
    }
  }

  async function boot() {
    ensureBarControls();
    mountInline();
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
