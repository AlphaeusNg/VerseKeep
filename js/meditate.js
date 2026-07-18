/**
 * VerseKeep meditation — open the site and start sitting with the Word.
 * Daily pick + topic browsing; verse / context / application / prayer.
 */
(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const PREFS_KEY = "versekeep-prefs-v1";
  const MED_KEY = "versekeep-meditate-v1";

  const state = {
    data: null,
    pool: [],
    index: 0,
    topicId: "all",
    loading: false,
  };

  function loadPrefs() {
    try {
      return JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") || {};
    } catch {
      return {};
    }
  }

  function savePrefs(partial) {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ ...loadPrefs(), ...partial }));
    } catch {
      /* ignore */
    }
  }

  function loadMed() {
    try {
      return JSON.parse(localStorage.getItem(MED_KEY) || "{}") || {};
    } catch {
      return {};
    }
  }

  function saveMed(partial) {
    try {
      localStorage.setItem(MED_KEY, JSON.stringify({ ...loadMed(), ...partial }));
    } catch {
      /* ignore */
    }
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function daySeed() {
    const d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }

  function seededIndex(len, seed) {
    if (len <= 0) return 0;
    let x = seed | 0;
    x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
    x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
    x = x ^ (x >>> 16);
    return Math.abs(x) % len;
  }

  function buildPool(data, topicId) {
    if (!data?.themes) return [];
    const themes =
      topicId && topicId !== "all"
        ? data.themes.filter((t) => t.id === topicId)
        : data.themes;
    const out = [];
    for (const t of themes) {
      for (const v of t.verses || []) {
        out.push({
          ...v,
          localText: v.text,
          themeId: t.id,
          themeTitle: t.title,
          themeEmoji: t.emoji,
        });
      }
    }
    return out;
  }

  function current() {
    return state.pool[state.index] || null;
  }

  function paintTopics() {
    const host = $("#med-topics");
    if (!host || !state.data) return;
    const items = [
      { id: "all", title: "All topics", emoji: "✦" },
      ...state.data.themes.map((t) => ({
        id: t.id,
        title: t.title,
        emoji: t.emoji,
      })),
    ];
    host.innerHTML = items
      .map(
        (t) => `
      <button type="button" class="med-topic-chip${t.id === state.topicId ? " is-active" : ""}" data-topic="${escapeHtml(t.id)}" aria-pressed="${t.id === state.topicId ? "true" : "false"}">
        <span aria-hidden="true">${t.emoji}</span> ${escapeHtml(t.title)}
      </button>`
      )
      .join("");
    host.querySelectorAll("[data-topic]").forEach((btn) => {
      btn.addEventListener("click", () => setTopic(btn.dataset.topic));
    });
  }

  function paintCard(v, meta) {
    const host = $("#meditate-card");
    if (!host) return;
    if (!v) {
      host.innerHTML = `<p class="hint">No verses in this topic yet.</p>`;
      return;
    }
    const tr = meta?.translation || "";
    const n = state.pool.length;
    const pos = state.index + 1;
    host.innerHTML = `
      <div class="med-card-top">
        <span class="med-topic-pill mono">${escapeHtml(v.themeEmoji || "")} ${escapeHtml(v.themeTitle || "")}</span>
        <span class="med-pos mono" aria-live="polite">${pos} / ${n}${tr ? ` · ${escapeHtml(tr)}` : ""}</span>
      </div>
      <p class="med-ref">${escapeHtml(v.ref)}</p>
      <blockquote class="med-verse">${escapeHtml(v.text)}</blockquote>
      <div class="med-block">
        <h3 class="med-label">Context</h3>
        <p>${escapeHtml(v.context || "Sit with this passage in its place in the whole counsel of God.")}</p>
      </div>
      <div class="med-block">
        <h3 class="med-label">Application</h3>
        <p>${escapeHtml(v.application || "Ask how this truth should shape one thought, word, or action today.")}</p>
      </div>
      <div class="med-block med-block-prayer">
        <h3 class="med-label">Prayer</h3>
        <p>${escapeHtml(v.prayer || "Lord, write this word on my heart. Help me believe and obey.")}</p>
      </div>
    `;
  }

  async function hydrateCurrent() {
    const v = current();
    if (!v) {
      paintCard(null);
      return;
    }
    const liveOn = $("#live-bible")?.checked !== false;
    if (!liveOn) {
      v.text = v.localText || v.text;
      paintCard(v, {});
      return;
    }
    paintCard(v, { translation: "…" });
    if (window.VerseKeepBible?.resolveVerse) {
      try {
        const live = await window.VerseKeepBible.resolveVerse(v.ref, v.localText || v.text);
        if (current()?.ref !== v.ref) return;
        v.text = live.text || v.localText || v.text;
        v.liveTranslation = live.translation;
        paintCard(v, { translation: live.translation || "" });
        return;
      } catch {
        /* fall through */
      }
    }
    v.text = v.localText || v.text;
    paintCard(v, {});
  }

  async function showIndex(i) {
    if (!state.pool.length) {
      paintCard(null);
      return;
    }
    state.index = ((i % state.pool.length) + state.pool.length) % state.pool.length;
    saveMed({ topicId: state.topicId, ref: current()?.ref, day: daySeed() });
    await hydrateCurrent();
  }

  async function setTopic(id) {
    if (state.loading) return;
    state.topicId = id || "all";
    state.pool = buildPool(state.data, state.topicId);
    paintTopics();
    const seed = daySeed() + (state.topicId === "all" ? 0 : state.topicId.length * 17);
    const start = seededIndex(state.pool.length, seed);
    await showIndex(start);
    savePrefs({ lastMedTopic: state.topicId });
  }

  async function next(delta = 1) {
    if (!state.pool.length) return;
    await showIndex(state.index + delta);
  }

  async function shuffleOne() {
    if (state.pool.length < 2) return;
    let n = Math.floor(Math.random() * state.pool.length);
    if (n === state.index) n = (n + 1) % state.pool.length;
    await showIndex(n);
  }

  async function copyMeditation() {
    const v = current();
    if (!v) return;
    const text = [
      v.ref,
      v.text,
      "",
      "Context: " + (v.context || ""),
      "Application: " + (v.application || ""),
      "Prayer: " + (v.prayer || ""),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      const note = $("#med-feedback");
      if (note) {
        note.hidden = false;
        note.textContent = "Copied meditation.";
        setTimeout(() => {
          note.hidden = true;
        }, 1800);
      }
    } catch {
      prompt("Copy meditation:", text);
    }
  }

  function readAloud() {
    const v = current();
    if (!v || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
    const parts = [v.ref, v.text, "Context.", v.context, "Application.", v.application, "Prayer.", v.prayer]
      .filter(Boolean)
      .join(" ");
    const u = new SpeechSynthesisUtterance(parts);
    u.rate = 0.92;
    window.speechSynthesis.speak(u);
  }

  function bindUi() {
    $("#med-next")?.addEventListener("click", () => next(1));
    $("#med-prev")?.addEventListener("click", () => next(-1));
    $("#med-shuffle")?.addEventListener("click", () => shuffleOne());
    $("#med-copy")?.addEventListener("click", () => {
      copyMeditation().catch(() => {});
    });
    $("#med-listen")?.addEventListener("click", readAloud);
    $("#med-today")?.addEventListener("click", async () => {
      const seed = daySeed();
      await showIndex(seededIndex(state.pool.length, seed));
    });
    $("#theme-search")?.addEventListener("input", () => {
      /* themes section still filtered by app.js */
    });

    // Keyboard when focused in meditate region or page-level shortcuts not typing
    document.addEventListener("keydown", (e) => {
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || e.target?.isContentEditable) return;
      if (e.key === "ArrowRight" || e.key === "n" || e.key === "N") {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        const medVisible = $("#meditate");
        if (!medVisible) return;
        // Only steal N when play panel is closed / not primary
        if (!$("#play-panel") || $("#play-panel").hidden) {
          e.preventDefault();
          next(1);
        }
      }
    });
  }

  async function bootWithData(data) {
    state.data = data;
    const prefs = loadPrefs();
    const med = loadMed();
    const topic = prefs.lastMedTopic || med.topicId || "all";
    state.topicId = topic;
    state.pool = buildPool(data, state.topicId);
    paintTopics();

    // Prefer today's meditation when topic is "all" and same day; else daily seed
    let idx = seededIndex(state.pool.length, daySeed());
    if (med.ref && med.day === daySeed() && med.topicId === state.topicId) {
      const found = state.pool.findIndex((v) => v.ref === med.ref);
      if (found >= 0) idx = found;
    }
    await showIndex(idx);
  }

  window.VerseKeepMeditate = {
    bootWithData,
    setTopic,
    next,
    current,
    refresh: hydrateCurrent,
  };

  // If verses already loaded by app, it will call bootWithData.
  // Standalone fallback if app loads after us with data event.
  document.addEventListener("DOMContentLoaded", () => {
    bindUi();
  });
  if (document.readyState !== "loading") bindUi();
})();
