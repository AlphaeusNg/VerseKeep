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
  const STREAK_KEY = "versekeep-med-streak-v1";

  const state = {
    data: null,
    pool: [],
    index: 0,
    topicId: "all",
    loading: false,
    hydrateToken: 0,
    focusMode: false,
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

  function loadStreak() {
    try {
      return JSON.parse(localStorage.getItem(STREAK_KEY) || "{}") || {};
    } catch {
      return {};
    }
  }

  function saveStreak(data) {
    try {
      localStorage.setItem(STREAK_KEY, JSON.stringify(data));
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

  function dayKey() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${day}`;
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

  function neighbor(delta) {
    if (!state.pool.length) return null;
    const i = ((state.index + delta) % state.pool.length + state.pool.length) % state.pool.length;
    return state.pool[i] || null;
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
    // Keep active chip in view on horizontal scroll rows
    const active = host.querySelector(".med-topic-chip.is-active");
    active?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }

  function paintStreak() {
    const el = $("#med-streak");
    if (!el) return;
    const s = loadStreak();
    const count = s.count || 0;
    const today = dayKey();
    const didToday = s.lastDay === today;
    if (!count) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    el.textContent = didToday
      ? `Streak ${count} day${count === 1 ? "" : "s"} · Amen today`
      : `Streak ${count} day${count === 1 ? "" : "s"} · mark Amen to continue`;
  }

  function paintDrillBtn() {
    const btn = $("#med-drill");
    if (!btn) return;
    const topic = state.topicId && state.topicId !== "all" ? state.topicId : current()?.themeId;
    if (!topic) {
      btn.hidden = true;
      return;
    }
    btn.hidden = false;
    btn.dataset.theme = topic;
    const title =
      state.data?.themes?.find((t) => t.id === topic)?.title || "topic";
    btn.textContent = `Drill · ${title}`;
    btn.title = `Open memory practice for ${title}`;
  }

  function paintCard(v, meta) {
    const host = $("#meditate-card");
    if (!host) return;
    if (!v) {
      host.innerHTML = `<p class="hint">No verses in this topic yet.</p>`;
      return;
    }
    const tr = meta?.translation || "";
    const loading = !!meta?.loading;
    const n = state.pool.length;
    const pos = state.index + 1;
    host.innerHTML = `
      <div class="med-card-top">
        <span class="med-topic-pill mono">${escapeHtml(v.themeEmoji || "")} ${escapeHtml(v.themeTitle || "")}</span>
        <span class="med-pos mono" aria-live="polite">${pos} / ${n}${tr ? ` · ${escapeHtml(tr)}` : ""}${loading ? " · …" : ""}</span>
      </div>
      <p class="med-ref">${escapeHtml(v.ref)}</p>
      <blockquote class="med-verse${loading ? " is-loading" : ""}">${escapeHtml(v.text)}</blockquote>
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

  function prefetchNeighbors() {
    if (!window.VerseKeepBible?.prefetch) return;
    const a = neighbor(1);
    const b = neighbor(-1);
    if (a?.ref) window.VerseKeepBible.prefetch(a.ref);
    if (b?.ref) window.VerseKeepBible.prefetch(b.ref);
  }

  async function hydrateCurrent() {
    const v = current();
    if (!v) {
      paintCard(null);
      return;
    }
    const token = ++state.hydrateToken;
    const liveOn = $("#live-bible")?.checked !== false;
    if (!liveOn) {
      v.text = v.localText || v.text;
      paintCard(v, {});
      return;
    }
    // Show local text immediately, then upgrade if live arrives
    paintCard(
      { ...v, text: v.localText || v.text },
      { translation: "…", loading: true }
    );
    if (window.VerseKeepBible?.resolveVerse) {
      try {
        const live = await window.VerseKeepBible.resolveVerse(v.ref, v.localText || v.text);
        if (token !== state.hydrateToken || current()?.ref !== v.ref) return;
        v.text = live.text || v.localText || v.text;
        v.liveTranslation = live.translation;
        paintCard(v, { translation: live.translation || "" });
        prefetchNeighbors();
        return;
      } catch {
        /* fall through */
      }
    }
    if (token !== state.hydrateToken) return;
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
    paintStreak();
    paintDrillBtn();
  }

  async function setTopic(id) {
    if (state.loading) return;
    state.loading = true;
    try {
      state.topicId = id || "all";
      state.pool = buildPool(state.data, state.topicId);
      paintTopics();
      const seed = daySeed() + (state.topicId === "all" ? 0 : state.topicId.length * 17);
      const start = seededIndex(state.pool.length, seed);
      await showIndex(start);
      savePrefs({ lastMedTopic: state.topicId });
    } finally {
      state.loading = false;
    }
  }

  async function next(delta = 1) {
    if (!state.pool.length || state.loading) return;
    await showIndex(state.index + delta);
  }

  async function shuffleOne() {
    if (state.pool.length < 2) return;
    let n = Math.floor(Math.random() * state.pool.length);
    if (n === state.index) n = (n + 1) % state.pool.length;
    await showIndex(n);
  }

  function flashFeedback(msg) {
    const note = $("#med-feedback");
    if (!note) return;
    note.hidden = false;
    note.textContent = msg;
    clearTimeout(flashFeedback._t);
    flashFeedback._t = setTimeout(() => {
      note.hidden = true;
    }, 2000);
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
      flashFeedback("Copied meditation.");
    } catch {
      prompt("Copy meditation:", text);
    }
  }

  async function shareMeditation() {
    const v = current();
    if (!v) return;
    const text = `${v.ref}\n${v.text}\n\n— VerseKeep`;
    try {
      if (navigator.share) {
        await navigator.share({ title: v.ref, text });
        flashFeedback("Shared.");
        return;
      }
    } catch (err) {
      if (err?.name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(text);
      flashFeedback("Copied verse to share.");
    } catch {
      prompt("Share:", text);
    }
  }

  function readAloud() {
    const v = current();
    if (!v || !window.speechSynthesis) {
      flashFeedback("Speech not available.");
      return;
    }
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
    flashFeedback("Reading aloud…");
  }

  function markAmen() {
    const today = dayKey();
    const s = loadStreak();
    if (s.lastDay === today) {
      flashFeedback("Amen already marked today.");
      paintStreak();
      return;
    }
    // Yesterday?
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const yKey = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(y.getDate()).padStart(2, "0")}`;
    let count = 1;
    if (s.lastDay === yKey) count = (s.count || 0) + 1;
    else if (s.lastDay && s.lastDay !== today) count = 1;
    else if (!s.lastDay) count = 1;

    const v = current();
    const history = Array.isArray(s.history) ? s.history.slice(-29) : [];
    if (v?.ref) history.push({ day: today, ref: v.ref });

    saveStreak({ count, lastDay: today, history });
    flashFeedback(count === 1 ? "Amen. Streak started." : `Amen. ${count}-day streak.`);
    paintStreak();
  }

  function setFocusMode(on) {
    state.focusMode = !!on;
    document.body.classList.toggle("med-focus", state.focusMode);
    const btn = $("#med-focus");
    if (btn) {
      btn.setAttribute("aria-pressed", state.focusMode ? "true" : "false");
      btn.textContent = state.focusMode ? "Exit focus" : "Focus";
    }
    savePrefs({ medFocus: state.focusMode });
    if (state.focusMode) {
      $("#meditate")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function bindUi() {
    $("#med-next")?.addEventListener("click", () => next(1));
    $("#med-prev")?.addEventListener("click", () => next(-1));
    $("#med-shuffle")?.addEventListener("click", () => shuffleOne());
    $("#med-copy")?.addEventListener("click", () => {
      copyMeditation().catch(() => {});
    });
    $("#med-share")?.addEventListener("click", () => {
      shareMeditation().catch(() => {});
    });
    $("#med-listen")?.addEventListener("click", readAloud);
    $("#med-amen")?.addEventListener("click", markAmen);
    $("#med-focus")?.addEventListener("click", () => setFocusMode(!state.focusMode));
    $("#med-today")?.addEventListener("click", async () => {
      const seed = daySeed();
      // Today's pick always from full pool when on "all"; else within topic
      await showIndex(seededIndex(state.pool.length, seed));
    });
    $("#med-drill")?.addEventListener("click", () => {
      const id = $("#med-drill")?.dataset.theme;
      if (!id) return;
      if (typeof window.VerseKeepPractice?.selectTheme === "function") {
        window.VerseKeepPractice.selectTheme(id);
      } else {
        document.querySelector(`[data-drill="${CSS.escape(id)}"]`)?.click();
      }
    });

    // Swipe on card: left = next, right = prev (touch)
    const card = $("#meditate-card");
    if (card) {
      let startX = 0;
      let startY = 0;
      let tracking = false;
      card.addEventListener(
        "touchstart",
        (e) => {
          const t = e.changedTouches?.[0];
          if (!t) return;
          startX = t.clientX;
          startY = t.clientY;
          tracking = true;
        },
        { passive: true }
      );
      card.addEventListener(
        "touchend",
        (e) => {
          if (!tracking) return;
          tracking = false;
          const t = e.changedTouches?.[0];
          if (!t) return;
          const dx = t.clientX - startX;
          const dy = t.clientY - startY;
          if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
          if (dx < 0) next(1);
          else next(-1);
        },
        { passive: true }
      );
    }

    document.addEventListener("keydown", (e) => {
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.target?.isContentEditable) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const playOpen = $("#play-panel") && !$("#play-panel").hidden;
      if (playOpen) return;

      if (e.key === "ArrowRight" || e.key === "n" || e.key === "N") {
        e.preventDefault();
        next(1);
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "b" || e.key === "B" || e.key === "p" || e.key === "P") {
        e.preventDefault();
        next(-1);
        return;
      }
      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        shuffleOne();
        return;
      }
      if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        copyMeditation().catch(() => {});
        return;
      }
      if (e.key === "l" || e.key === "L") {
        e.preventDefault();
        readAloud();
        return;
      }
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        setFocusMode(!state.focusMode);
        return;
      }
      if (e.key === "a" || e.key === "A") {
        e.preventDefault();
        markAmen();
        return;
      }
      if (e.key === "Escape" && state.focusMode) {
        e.preventDefault();
        setFocusMode(false);
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
    paintStreak();
    paintDrillBtn();

    if (prefs.medFocus) setFocusMode(true);

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
    setFocusMode,
  };

  document.addEventListener("DOMContentLoaded", () => {
    bindUi();
  });
  if (document.readyState !== "loading") bindUi();
})();
