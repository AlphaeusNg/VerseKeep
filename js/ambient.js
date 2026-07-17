/**
 * Worship music for VerseKeep.
 * - Starts default/last station ASAP on load
 * - Floating mini-player (bottom-right popup) — not stuck in the Music section
 * - Station picks stay in #worship; no separate Stop buttons (use the embed controls)
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
      // Compact Spotify chrome is friendlier in a popup
      if (u.hostname.includes("spotify.com")) {
        u.searchParams.set("theme", "0");
      }
      if (u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be")) {
        u.searchParams.set("autoplay", "1");
        u.searchParams.set("playsinline", "1");
        if (!u.searchParams.has("rel")) u.searchParams.set("rel", "0");
      }
      return u.toString();
    } catch {
      const join = url.includes("?") ? "&" : "?";
      return `${url}${join}autoplay=1`;
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

  function mountShellInPopup() {
    const shell = $("#music-player-shell");
    if (!shell) return;
    const host = ensurePopupHost();
    if (shell.parentElement !== host) {
      host.appendChild(shell);
    }
    shell.classList.add("is-popup");
    shell.classList.add("is-docked");
  }

  function selectMusic(id, embed, title, { forceReload = false } = {}) {
    if (!embed) return;
    const frame = $("#music-frame");
    const shell = $("#music-player-shell");
    const empty = $("#music-empty");
    if (!frame || !shell) return;

    mountShellInPopup();

    activeMusicId = id;
    const src = withAutoplay(embed);

    if (currentEmbed === embed && playing && !forceReload) {
      paintMusicList();
      shell.hidden = false;
      return;
    }

    currentEmbed = embed;
    // Force a real navigation so Spotify/YouTube re-evaluate autoplay
    frame.removeAttribute("src");
    // next frame so browsers don't coalesce to a no-op
    requestAnimationFrame(() => {
      frame.src = src;
    });

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
  }

  function nudgeAutoplayOnGesture() {
    if (gestureHooked) return;
    gestureHooked = true;
    const once = () => {
      window.removeEventListener("pointerdown", once, true);
      window.removeEventListener("keydown", once, true);
      window.removeEventListener("touchstart", once, true);
      if (!playing || !currentEmbed) return;
      // Re-assert autoplay after a user gesture (browser autoplay policy)
      selectMusic(activeMusicId || "nudge", currentEmbed, $("#music-player-label")?.textContent || "", {
        forceReload: true,
      });
    };
    window.addEventListener("pointerdown", once, { capture: true, passive: true });
    window.addEventListener("keydown", once, { capture: true });
    window.addEventListener("touchstart", once, { capture: true, passive: true });
  }

  function autoStartMusic() {
    // Kick the default embed immediately (before JSON if needed) so audio starts ASAP
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
      if (list.length && !list.some((p) => p.id === pick.id) && (playlists.youtube || []).some((p) => p.id === pick.id)) {
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
  }

  async function boot() {
    // Start default audio path immediately (don't wait on network for playlists.json)
    mountShellInPopup();
    autoStartMusic();

    try {
      playlists = await loadJson("data/playlists.json");
      paintMusicTabs();
      paintMusicList();
      // Re-resolve default from full catalog if we started on hard-coded fallback
      if (!activeMusicId || activeMusicId === DEFAULT_SPOTIFY_ID) {
        const list = playlists.spotify || [];
        const pick = list.find((p) => p.id === DEFAULT_SPOTIFY_ID) || list[0];
        if (pick?.embed && pick.embed !== currentEmbed) {
          selectMusic(pick.id, pick.embed, pick.title);
        } else {
          paintMusicList();
        }
      }
      bindUi();
    } catch (err) {
      console.warn("[ambient]", err);
      const el = $("#ambient-error");
      if (el) {
        el.hidden = false;
        el.textContent = `Could not load music list: ${err.message}`;
      }
      paintMusicList();
      bindUi();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
