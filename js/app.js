(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const STATS_KEY = "versekeep-stats-v1";
  const PREFS_KEY = "versekeep-prefs-v1";

  const state = {
    data: null,
    themeId: null,
    mode: "study", // study | blank | type | order | quiz
    queue: [],
    index: 0,
    score: 0,
    streak: 0,
    bestStreakSession: 0,
    answered: false,
    blanks: [],
    orderPicked: [],
    liveBible: true,
    liveMeta: null,
    selecting: false,
    autoAdvance: false,
  };

  const MODE_LABELS = {
    study: "Study",
    blank: "Fill blanks",
    type: "Type it",
    order: "Order words",
    quiz: "Which verse?",
  };

  const MODE_ORDER = ["study", "blank", "type", "order", "quiz"];

  function defaultStats() {
    return {
      checks: 0,
      correct: 0,
      themesCompleted: 0,
      bestStreak: 0,
      verseHits: {}, // "ref" -> correct count
      themePlays: {}, // themeId -> times selected
      favorites: {},
      lastTheme: null,
      totalScore: 0,
    };
  }

  function loadStats() {
    try {
      const raw = localStorage.getItem(STATS_KEY);
      if (!raw) return defaultStats();
      const data = JSON.parse(raw);
      return {
        ...defaultStats(),
        ...data,
        verseHits: data.verseHits || {},
        themePlays: data.themePlays || {},
        favorites: data.favorites || {},
      };
    } catch {
      return defaultStats();
    }
  }

  function saveStats(stats) {
    try {
      localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    } catch {
      /* ignore */
    }
  }

  let stats = loadStats();

  function loadPrefs() {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (!raw) return {};
      return JSON.parse(raw) || {};
    } catch {
      return {};
    }
  }

  function savePrefs(partial) {
    try {
      const next = { ...loadPrefs(), ...partial };
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  function normalize(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[^\w\s']/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function words(text) {
    return text.split(/\s+/).filter(Boolean);
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function currentTheme() {
    return state.data?.themes?.find((t) => t.id === state.themeId) || null;
  }

  function currentVerse() {
    return state.queue[state.index] || null;
  }

  function masteryForTheme(theme) {
    if (!theme?.verses?.length) return 0;
    let known = 0;
    for (const v of theme.verses) {
      if ((stats.verseHits[v.ref] || 0) >= 1) known += 1;
    }
    return Math.round((known / theme.verses.length) * 100);
  }

  function themeMatchesFilter(t, q) {
    if (!q) return true;
    const hay = `${t.title} ${t.blurb} ${t.id} ${t.verses.map((v) => v.ref).join(" ")}`.toLowerCase();
    return hay.includes(q);
  }

  function paintThemes() {
    const host = $("#theme-grid");
    if (!host || !state.data) return;
    const q = normalize($("#theme-search")?.value || "").replace(/\s+/g, " ");
    const list = state.data.themes
      .filter((t) => themeMatchesFilter(t, q))
      .slice()
      .sort((a, b) => {
        const fa = stats.favorites?.[a.id] ? 1 : 0;
        const fb = stats.favorites?.[b.id] ? 1 : 0;
        return fb - fa;
      });
    if (!list.length) {
      host.innerHTML = `<p class="hint">No themes match “${escapeHtml($("#theme-search")?.value || "")}”.</p>`;
      return;
    }
    host.innerHTML = list
      .map((t) => {
        const m = masteryForTheme(t);
        const plays = stats.themePlays[t.id] || 0;
        const fav = !!(stats.favorites && stats.favorites[t.id]);
        return `
      <div class="theme-card-wrap">
        <button type="button" class="theme-card${t.id === state.themeId ? " is-active" : ""}${fav ? " is-fav" : ""}" data-theme="${escapeHtml(t.id)}" aria-pressed="${t.id === state.themeId ? "true" : "false"}">
          <span class="emoji" aria-hidden="true">${t.emoji}</span>
          <strong>${escapeHtml(t.title)}</strong>
          <small>${escapeHtml(t.blurb)}</small>
          <span class="theme-meta mono">
            <span class="theme-mastery" title="Verses you've answered correctly at least once">${m}% known</span>
            <span class="theme-count">${t.verses.length} verses${plays ? ` · ×${plays}` : ""}</span>
          </span>
          <span class="theme-bar" aria-hidden="true"><span style="width:${m}%"></span></span>
        </button>
        <button type="button" class="theme-drill-btn" data-drill="${escapeHtml(t.id)}" title="Open memory practice for this topic">Drill</button>
        <button type="button" class="fav-btn${fav ? " is-on" : ""}" data-fav="${escapeHtml(t.id)}" title="${fav ? "Unfavorite" : "Favorite"}" aria-label="${fav ? "Unfavorite" : "Favorite"} ${escapeHtml(t.title)}">${fav ? "★" : "☆"}</button>
      </div>`;
      })
      .join("");
    // Primary: open meditation on this topic (low friction)
    host.querySelectorAll("[data-theme]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.theme;
        state.themeId = id;
        paintThemes();
        if (window.VerseKeepMeditate?.setTopic) {
          try {
            await window.VerseKeepMeditate.setTopic(id);
          } catch {
            /* ignore */
          }
        }
        $("#meditate")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
    host.querySelectorAll("[data-drill]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        selectTheme(btn.dataset.drill);
      });
    });
    host.querySelectorAll("[data-fav]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleFavorite(btn.dataset.fav);
      });
    });
  }

  function toggleFavorite(id) {
    if (!stats.favorites) stats.favorites = {};
    if (stats.favorites[id]) delete stats.favorites[id];
    else stats.favorites[id] = true;
    saveStats(stats);
    paintThemes();
  }

  function stopSpeech() {
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* ignore */
    }
  }

  function readAloud() {
    const v = currentVerse();
    if (!v || !window.speechSynthesis) {
      showFeedback(false, "Speech not available in this browser.");
      return;
    }
    stopSpeech();
    const u = new SpeechSynthesisUtterance(`${v.ref}. ${v.text}`);
    u.rate = 0.92;
    u.pitch = 1;
    window.speechSynthesis.speak(u);
    showFeedback(true, "Reading aloud…");
  }

  function paintStatsBar() {
    const el = $("#stats-bar");
    if (!el) return;
    const acc =
      stats.checks > 0 ? Math.round((stats.correct / stats.checks) * 100) : null;
    el.innerHTML = `
      <span>Checks <strong>${stats.checks}</strong></span>
      <span>Accuracy <strong>${acc == null ? "—" : acc + "%"}</strong></span>
      <span>Best streak <strong>${stats.bestStreak}</strong></span>
      <span>Themes done <strong>${stats.themesCompleted}</strong></span>
    `;
  }

  async function hydrateQueueFromLive(queue) {
    if (!state.liveBible || !window.VerseKeepBible?.resolveVerse) return queue;
    const out = [];
    for (const v of queue) {
      try {
        const live = await window.VerseKeepBible.resolveVerse(v.ref, v.localText || v.text);
        out.push({
          ...v,
          text: live.text || v.text,
          liveSource: live.source,
          liveTranslation: live.translation,
        });
      } catch {
        out.push(v);
      }
    }
    return out;
  }

  async function beginQueue(queue, label) {
    $("#play-panel").hidden = false;
    $("#theme-label").textContent = label;
    $("#stage").innerHTML = `<p class="hint">Loading verses${state.liveBible ? " (live text)…" : "…"}</p>`;
    queue = await hydrateQueueFromLive(queue);
    state.queue = queue;
    state.index = 0;
    state.score = 0;
    state.streak = 0;
    state.bestStreakSession = 0;
    state.answered = false;

    const first = queue[0];
    state.liveMeta = first?.liveTranslation
      ? `${first.liveTranslation} · ${first.liveSource || "live"}`
      : "local JSON";
    const lbl = $("#live-bible-label");
    if (lbl && state.liveBible) lbl.textContent = `(${state.liveMeta})`;

    startRound();
    $("#play-panel").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function selectTheme(id) {
    if (state.selecting) return;
    state.selecting = true;
    state.themeId = id;
    const theme = currentTheme();
    if (!theme) {
      state.selecting = false;
      return;
    }
    paintThemes();
    // Align meditation topic with memory theme when user picks a card
    if (window.VerseKeepMeditate?.setTopic) {
      try {
        await window.VerseKeepMeditate.setTopic(id);
      } catch {
        /* ignore */
      }
    }

    stats.themePlays[id] = (stats.themePlays[id] || 0) + 1;
    stats.lastTheme = id;
    saveStats(stats);
    paintStatsBar();

    // Prefer verses never answered correctly, then least-practiced
    const ranked = theme.verses
      .map((v) => ({ ...v, themeId: theme.id, localText: v.text, hits: stats.verseHits[v.ref] || 0 }))
      .sort((a, b) => a.hits - b.hits || Math.random() - 0.5);
    // Mix: 60% weak-first order, then light shuffle of chunks
    let queue = ranked;
    if (ranked.length > 3) {
      const weak = ranked.filter((v) => v.hits === 0);
      const rest = ranked.filter((v) => v.hits > 0);
      queue = [...shuffle(weak.length ? weak : ranked.slice(0, 2)), ...shuffle(rest.length ? rest : ranked.slice(2))];
      // de-dupe while preserving order
      const seen = new Set();
      queue = queue.filter((v) => {
        if (seen.has(v.ref)) return false;
        seen.add(v.ref);
        return true;
      });
      // ensure full coverage
      for (const v of ranked) {
        if (!seen.has(v.ref)) queue.push(v);
      }
    }

    try {
      await beginQueue(queue, `${theme.emoji} ${theme.title}`);
    } finally {
      state.selecting = false;
    }
  }

  /** Cross-theme drill of never-answered verses (or lowest hits). */
  async function practiceWeak() {
    if (!state.data?.themes || state.selecting) return;
    state.selecting = true;
    const all = state.data.themes.flatMap((t) =>
      t.verses.map((v) => ({
        ...v,
        themeId: t.id,
        localText: v.text,
        hits: stats.verseHits[v.ref] || 0,
        themeTitle: t.title,
      }))
    );
    let pool = all.filter((v) => v.hits === 0);
    if (pool.length < 4) {
      pool = all.slice().sort((a, b) => a.hits - b.hits).slice(0, Math.min(12, all.length));
    } else {
      pool = shuffle(pool).slice(0, Math.min(12, pool.length));
    }
    state.themeId = pool[0]?.themeId || null;
    paintThemes();
    try {
      await beginQueue(pool, "🎯 Weak verses drill");
      setMode("blank");
    } finally {
      state.selecting = false;
    }
  }

  function setMode(mode) {
    if (!MODE_LABELS[mode]) return;
    state.mode = mode;
    // Scope to practice chips only — music tabs also use .mode-row .chip
    $$("#play-panel [data-mode]").forEach((c) => {
      c.classList.toggle("is-active", c.dataset.mode === mode);
      c.setAttribute("aria-selected", c.dataset.mode === mode ? "true" : "false");
    });
    savePrefs({ mode });
    if (state.themeId) startRound();
  }

  function updateHud() {
    const theme = currentTheme();
    const total = state.queue.length || 0;
    $("#hud-progress").innerHTML = `Verse <strong>${Math.min(state.index + 1, total)} / ${total}</strong>`;
    $("#hud-score").innerHTML = `Score <strong>${state.score}</strong>`;
    $("#hud-streak").innerHTML = `Streak <strong>${state.streak}</strong>`;
    $("#hud-mode").textContent = MODE_LABELS[state.mode] || state.mode;
    if (theme) $("#theme-label").textContent = `${theme.emoji} ${theme.title}`;
    const prev = $("#btn-prev");
    if (prev) prev.disabled = state.index <= 0;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function clearFeedback() {
    const fb = $("#feedback");
    if (!fb) return;
    fb.hidden = true;
    fb.className = "feedback";
    fb.textContent = "";
  }

  function showFeedback(ok, msg) {
    const fb = $("#feedback");
    if (!fb) return;
    fb.hidden = false;
    fb.className = `feedback ${ok ? "ok" : "bad"}`;
    fb.textContent = msg;
  }

  function recordResult(ok, verse) {
    stats.checks += 1;
    if (ok) {
      stats.correct += 1;
      if (verse?.ref) {
        stats.verseHits[verse.ref] = (stats.verseHits[verse.ref] || 0) + 1;
      }
      if (state.streak > stats.bestStreak) stats.bestStreak = state.streak;
    }
    stats.totalScore = (stats.totalScore || 0) + (ok ? 10 : 0);
    saveStats(stats);
    paintStatsBar();
    paintThemes();
  }

  function startRound() {
    const v = currentVerse();
    clearFeedback();
    state.answered = false;
    state.orderPicked = [];
    state.blanks = [];
    updateHud();
    $("#btn-check").hidden = state.mode === "study" || state.mode === "quiz";
    $("#btn-next").textContent =
      state.index >= state.queue.length - 1 ? "Finish theme" : "Next verse";
    if (!v) {
      $("#stage").innerHTML = `<p class="hint">Pick a theme to begin.</p>`;
      return;
    }
    if (state.mode === "study") renderStudy(v);
    else if (state.mode === "blank") renderBlank(v);
    else if (state.mode === "type") renderType(v);
    else if (state.mode === "order") renderOrder(v);
    else if (state.mode === "quiz") renderQuiz(v);
  }

  function renderStudy(v) {
    const src = v.liveTranslation
      ? `<span class="live-tag mono">${escapeHtml(v.liveTranslation)} · ${escapeHtml(v.liveSource || "live")}</span>`
      : `<span class="live-tag mono">bundled</span>`;
    $("#stage").innerHTML = `
      <div class="study-box" id="study-box">
        <div class="ref">${escapeHtml(v.ref)} ${src}</div>
        <p id="study-text">${escapeHtml(v.text)}</p>
      </div>
      <div class="actions study-actions">
        <button type="button" class="btn ghost" id="btn-hide-text" aria-pressed="false">Hide text (flashcard)</button>
        <button type="button" class="btn ghost" id="btn-speak">Read aloud</button>
        <button type="button" class="btn ghost" id="btn-speak-stop">Stop voice</button>
      </div>
      <p class="hint study-hint">Read it yourself or use speech. Hide text to self-test. <kbd>C</kbd> copies · <kbd>L</kbd> listens · <kbd>H</kbd> hide.</p>`;
    $("#btn-check").hidden = true;
    $("#btn-speak")?.addEventListener("click", readAloud);
    $("#btn-speak-stop")?.addEventListener("click", stopSpeech);
    $("#btn-hide-text")?.addEventListener("click", toggleStudyHide);
  }

  function toggleStudyHide() {
    const text = $("#study-text");
    const btn = $("#btn-hide-text");
    if (!text || !btn) return;
    const hidden = text.classList.toggle("is-obscured");
    btn.setAttribute("aria-pressed", hidden ? "true" : "false");
    btn.textContent = hidden ? "Reveal text" : "Hide text (flashcard)";
    if (hidden) {
      text.setAttribute("aria-hidden", "true");
      text.dataset.full = text.textContent;
      text.textContent = "···· ··· ····· ···· ······· ····";
    } else {
      text.removeAttribute("aria-hidden");
      if (text.dataset.full) text.textContent = text.dataset.full;
    }
  }

  function pickBlankIndices(n, count) {
    const candidates = [];
    for (let i = 0; i < n; i++) {
      // Prefer middle words; for very short verses allow any non-trivial word
      if (n <= 4) {
        if (i < n) candidates.push(i);
      } else if (i > 0 && i < n - 1) {
        candidates.push(i);
      }
    }
    // Prefer longer words for blanks
    candidates.sort((a, b) => {
      // Will be re-shuffled after filter; use as preference seed later
      return a - b;
    });
    return shuffle(candidates).slice(0, Math.min(count, candidates.length)).sort((a, b) => a - b);
  }

  function renderBlank(v) {
    const w = words(v.text);
    if (w.length < 2) {
      $("#stage").innerHTML = `
        <div class="ref">${escapeHtml(v.ref)}</div>
        <p class="hint">This verse is too short for blanks — try Study or Type it.</p>
        <p class="verse-prompt">${escapeHtml(v.text)}</p>`;
      $("#btn-check").hidden = true;
      return;
    }
    const blankCount = Math.min(
      Math.max(1, Math.floor(w.length / 7)),
      Math.max(1, Math.min(5, w.length - (w.length > 4 ? 2 : 0)))
    );
    const idxs = pickBlankIndices(w.length, blankCount);
    if (!idxs.length) {
      // Fallback: blank the longest middle word
      const mid = Math.floor(w.length / 2);
      idxs.push(mid);
    }
    state.blanks = idxs.map((i) => w[i].replace(/[^\w']/g, ""));
    const html = w
      .map((word, i) => {
        if (!idxs.includes(i)) return escapeHtml(word);
        const bi = idxs.indexOf(i);
        return `<input type="text" class="blank-input" data-bi="${bi}" autocomplete="off" spellcheck="false" aria-label="Blank ${bi + 1}" style="width:${Math.max(4, word.length + 1)}ch;display:inline-block;margin:0 .15rem;padding:.15rem .3rem;border:none;border-bottom:2px solid var(--gold);background:transparent;color:var(--gold);font:inherit;font-weight:600;text-align:center" />`;
      })
      .join(" ");
    $("#stage").innerHTML = `
      <div class="ref">${escapeHtml(v.ref)}</div>
      <p class="verse-prompt">${html}</p>
      <p class="hint kbd-hint"><kbd>Enter</kbd> checks · <kbd>Tab</kbd> next blank</p>`;
    $("#btn-check").hidden = false;
    const inputs = $$("#stage .blank-input");
    inputs.forEach((inp, i) => {
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          if (i < inputs.length - 1) inputs[i + 1].focus();
          else checkAnswer();
        }
      });
    });
    inputs[0]?.focus();
  }

  function firstLetterHint(text) {
    return words(text)
      .map((w) => {
        const clean = w.replace(/[^\w']/g, "");
        if (!clean) return w;
        return clean[0] + "_".repeat(Math.max(0, clean.length - 1));
      })
      .join(" ");
  }

  function renderType(v) {
    $("#stage").innerHTML = `
      <div class="ref">${escapeHtml(v.ref)}</div>
      <p class="hint type-hint">Type the verse from memory (punctuation flexible).</p>
      <div class="input-block">
        <label for="type-input">Your recall</label>
        <textarea id="type-input" rows="4" placeholder="Start typing…" autocomplete="off" spellcheck="false"></textarea>
      </div>
      <div class="actions type-actions">
        <button type="button" class="btn ghost" id="btn-hint">Show first letters</button>
      </div>
      <p id="type-hint-line" class="hint mono type-letter-hint" hidden></p>`;
    $("#btn-check").hidden = false;
    $("#btn-hint")?.addEventListener("click", () => {
      const line = $("#type-hint-line");
      if (!line) return;
      line.hidden = false;
      line.textContent = firstLetterHint(v.text);
    });
    $("#type-input")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        checkAnswer();
      }
    });
    $("#type-input")?.focus();
  }

  function renderOrder(v) {
    const w = words(v.text)
      .map((x) => x.replace(/[^\w']/g, ""))
      .filter(Boolean);
    const slice = w.length > 18 ? w.slice(0, 14) : w;
    state.orderTarget = slice;
    const bank = shuffle(slice.map((word, i) => ({ word, key: `${word}-${i}-${Math.random()}` })));
    $("#stage").innerHTML = `
      <div class="ref">${escapeHtml(v.ref)}</div>
      <p class="hint">Tap words in order${w.length > 18 ? " (first lines)" : ""}.</p>
      <div class="assemble-line" id="assemble-line" aria-live="polite"></div>
      <div class="word-bank" id="word-bank">
        ${bank
          .map(
            (b) =>
              `<button type="button" class="word-chip" data-word="${escapeHtml(b.word)}" data-key="${escapeHtml(b.key)}">${escapeHtml(b.word)}</button>`
          )
          .join("")}
      </div>
      <div class="actions">
        <button type="button" class="btn ghost" id="btn-order-undo">Undo</button>
        <button type="button" class="btn ghost" id="btn-order-clear">Clear</button>
      </div>`;
    $("#btn-check").hidden = false;
    $("#word-bank")?.addEventListener("click", (e) => {
      const chip = e.target.closest(".word-chip");
      if (!chip || chip.classList.contains("is-used")) return;
      chip.classList.add("is-used");
      state.orderPicked.push({ word: chip.dataset.word, key: chip.dataset.key });
      paintAssemble();
      // Auto-check when all words placed
      if (state.orderPicked.length === (state.orderTarget || []).length) {
        checkAnswer();
      }
    });
    $("#btn-order-undo")?.addEventListener("click", () => {
      const last = state.orderPicked.pop();
      if (!last) return;
      const chip = [...$$("#word-bank .word-chip")].find(
        (c) => c.dataset.key === last.key && c.classList.contains("is-used")
      );
      chip?.classList.remove("is-used");
      paintAssemble();
    });
    $("#btn-order-clear")?.addEventListener("click", () => {
      state.orderPicked = [];
      $$("#word-bank .word-chip").forEach((c) => c.classList.remove("is-used"));
      paintAssemble();
    });
  }

  function paintAssemble() {
    const line = $("#assemble-line");
    if (!line) return;
    line.innerHTML = state.orderPicked.length
      ? state.orderPicked
          .map((w) => `<span class="word-chip" style="cursor:default">${escapeHtml(w.word)}</span>`)
          .join("")
      : `<span style="color:var(--dim);font-size:0.88rem">Your sequence appears here…</span>`;
  }

  function renderQuiz(v) {
    const theme = currentTheme();
    const pool = theme.verses.filter((x) => x.ref !== v.ref);
    // Pull distractors from other themes if this theme is thin
    let others = shuffle(pool).slice(0, 3);
    if (others.length < 3 && state.data?.themes) {
      const extra = state.data.themes
        .flatMap((t) => t.verses)
        .filter((x) => x.ref !== v.ref && !others.some((o) => o.ref === x.ref));
      others = [...others, ...shuffle(extra)].slice(0, 3);
    }
    const options = shuffle([v, ...others]);
    $("#stage").innerHTML = `
      <p class="hint">Which reference matches this text?</p>
      <p class="verse-prompt" style="margin-top:0.65rem">${escapeHtml(v.text)}</p>
      <div class="choices" id="quiz-choices" role="group" aria-label="Verse references">
        ${options
          .map(
            (o, i) =>
              `<button type="button" class="choice" data-ref="${escapeHtml(o.ref)}"><span class="choice-num mono">${i + 1}</span> ${escapeHtml(o.ref)}</button>`
          )
          .join("")}
      </div>`;
    $("#btn-check").hidden = true;
    $("#quiz-choices")?.addEventListener("click", (e) => {
      const btn = e.target.closest(".choice");
      if (!btn || state.answered) return;
      gradeQuiz(btn, v);
    });
  }

  function gradeQuiz(btn, v) {
    state.answered = true;
    const ok = btn.dataset.ref === v.ref;
    $$("#quiz-choices .choice").forEach((c) => {
      c.disabled = true;
      if (c.dataset.ref === v.ref) c.classList.add("is-correct");
      else if (c === btn && !ok) c.classList.add("is-wrong");
    });
    if (ok) {
      state.score += 10 + state.streak * 2;
      state.streak += 1;
      if (state.streak > state.bestStreakSession) state.bestStreakSession = state.streak;
      showFeedback(true, "Yes — well remembered.");
    } else {
      state.streak = 0;
      showFeedback(false, `Not quite. Correct: ${v.ref}`);
    }
    recordResult(ok, v);
    updateHud();
    maybeAutoAdvance(ok);
  }

  function checkAnswer() {
    const v = currentVerse();
    if (!v || state.answered) return;
    if (state.mode === "study" || state.mode === "quiz") return;

    let ok = false;
    let detail = "";

    if (state.mode === "blank") {
      const inputs = $$("#stage .blank-input");
      if (!inputs.length || !state.blanks.length) return;
      let right = 0;
      inputs.forEach((inp, i) => {
        const expect = normalize(state.blanks[i]);
        const got = normalize(inp.value);
        if (got && (got === expect || expect.startsWith(got) || got.startsWith(expect))) {
          right += 1;
          inp.style.borderBottomColor = "var(--ok)";
        } else {
          inp.style.borderBottomColor = "var(--bad)";
          inp.value = state.blanks[i];
        }
      });
      ok = right === state.blanks.length;
      detail = ok
        ? "All blanks correct."
        : `You got ${right}/${state.blanks.length}. Correct words filled in.`;
    } else if (state.mode === "type") {
      const got = normalize($("#type-input")?.value);
      const expect = normalize(v.text);
      const ratio = similarity(got, expect);
      ok = ratio >= 0.82;
      detail = ok
        ? `Strong recall (${Math.round(ratio * 100)}% match).`
        : `Keep going — about ${Math.round(ratio * 100)}% match. Full verse: “${v.text}”`;
    } else if (state.mode === "order") {
      const target = (state.orderTarget || []).map((w) => normalize(w));
      const got = state.orderPicked.map((p) => normalize(p.word));
      ok =
        target.length > 0 &&
        target.every((w, i) => w === got[i]) &&
        got.length === target.length;
      detail = ok ? "Order perfect." : `Target order: ${state.orderTarget.join(" ")}`;
    }

    state.answered = true;
    if (ok) {
      state.score += 10 + state.streak * 2;
      state.streak += 1;
      if (state.streak > state.bestStreakSession) state.bestStreakSession = state.streak;
      showFeedback(true, detail);
    } else {
      state.streak = 0;
      showFeedback(false, detail);
    }
    recordResult(ok, v);
    updateHud();
    maybeAutoAdvance(ok);
  }

  function maybeAutoAdvance(ok) {
    if (!ok || !state.autoAdvance) return;
    if (state.mode === "study") return;
    setTimeout(() => {
      if (state.answered) nextVerse();
    }, 1100);
  }

  function similarity(a, b) {
    if (!a && !b) return 1;
    if (!a || !b) return 0;
    const ta = a.split(" ");
    const tb = new Set(b.split(" "));
    let hit = 0;
    ta.forEach((w) => {
      if (tb.has(w)) hit += 1;
    });
    const recall = hit / Math.max(tb.size, 1);
    const precision = hit / Math.max(ta.length, 1);
    return (2 * recall * precision) / Math.max(recall + precision, 0.0001);
  }

  function nextVerse() {
    if (!state.queue.length) return;
    if (state.index >= state.queue.length - 1) {
      stats.themesCompleted += 1;
      saveStats(stats);
      paintStatsBar();
      showFeedback(
        true,
        `Theme complete · score ${state.score} · best streak ${state.bestStreakSession}. Queue reshuffled — keep going or pick another theme.`
      );
      state.index = 0;
      state.queue = shuffle(state.queue);
      startRound();
      return;
    }
    state.index += 1;
    startRound();
  }

  function prevVerse() {
    if (state.index <= 0) return;
    state.index -= 1;
    startRound();
  }

  function shuffleQueue() {
    if (!state.queue.length) return;
    const current = currentVerse();
    state.queue = shuffle(state.queue);
    // Keep current verse if possible
    if (current) {
      const i = state.queue.findIndex((v) => v.ref === current.ref);
      if (i > 0) {
        const [item] = state.queue.splice(i, 1);
        state.queue.unshift(item);
      }
    }
    state.index = 0;
    startRound();
    showFeedback(true, "Queue shuffled.");
  }

  async function copyCurrentVerse() {
    const v = currentVerse();
    if (!v) {
      showFeedback(false, "Pick a theme first.");
      return;
    }
    const text = `${v.ref} — ${v.text}`;
    try {
      await navigator.clipboard.writeText(text);
      showFeedback(true, "Verse copied to clipboard.");
    } catch {
      prompt("Copy verse:", text);
    }
  }

  function isTypingTarget(el) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
  }

  async function boot() {
    try {
      const res = await fetch("data/verses.json", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      state.data = await res.json();
      paintThemes();
      paintStatsBar();
      $("#load-error").hidden = true;
      // Meditation is primary: start as soon as data is ready
      if (window.VerseKeepMeditate?.bootWithData) {
        await window.VerseKeepMeditate.bootWithData(state.data);
      }
    } catch (err) {
      console.error(err);
      $("#load-error").hidden = false;
      $("#load-error").textContent = `Could not load verses: ${err.message}`;
    }

    $$("#play-panel [data-mode]").forEach((chip) => {
      chip.addEventListener("click", () => setMode(chip.dataset.mode));
    });
    $("#btn-check")?.addEventListener("click", checkAnswer);
    $("#btn-next")?.addEventListener("click", nextVerse);
    $("#btn-prev")?.addEventListener("click", prevVerse);
    $("#btn-shuffle")?.addEventListener("click", shuffleQueue);
    $("#btn-copy")?.addEventListener("click", () => {
      copyCurrentVerse().catch(() => {});
    });
    $("#btn-reveal")?.addEventListener("click", () => {
      const v = currentVerse();
      if (!v) return;
      showFeedback(true, `${v.ref}: ${v.text}`);
    });
    $("#theme-search")?.addEventListener("input", () => paintThemes());
    $("#btn-reset-stats")?.addEventListener("click", () => {
      if (!confirm("Reset all VerseKeep progress on this device? (favorites, mastery, streaks)")) return;
      stats = defaultStats();
      saveStats(stats);
      paintStatsBar();
      paintThemes();
      const resume = $("#resume-hint");
      if (resume) {
        resume.hidden = false;
        resume.textContent = "Progress reset on this device.";
      }
    });

    $("#btn-practice-weak")?.addEventListener("click", () => practiceWeak());

    const trSelect = $("#tr-select");
    if (trSelect && window.VERSEKEEP_BIBLE) {
      const allowed = new Set(["esv", "niv", "nkjv"]);
      let savedTr = (
        loadPrefs().translation ||
        window.VERSEKEEP_BIBLE.bibleApiTranslation ||
        "esv"
      ).toLowerCase();
      if (!allowed.has(savedTr)) savedTr = "esv";
      trSelect.value = savedTr;
      window.VERSEKEEP_BIBLE.bibleApiTranslation = savedTr;
      window.VERSEKEEP_BIBLE.preferred = savedTr;
      const lbl0 = $("#live-bible-label");
      if (lbl0 && state.liveBible) lbl0.textContent = `(${savedTr.toUpperCase()})`;
      trSelect.addEventListener("change", async () => {
        const tr = allowed.has(trSelect.value) ? trSelect.value : "esv";
        trSelect.value = tr;
        window.VERSEKEEP_BIBLE.bibleApiTranslation = tr;
        window.VERSEKEEP_BIBLE.preferred = tr;
        savePrefs({ translation: tr });
        const lbl = $("#live-bible-label");
        if (lbl && state.liveBible) lbl.textContent = `(${tr.toUpperCase()})`;
        if (window.VerseKeepMeditate?.refresh) {
          try {
            await window.VerseKeepMeditate.refresh();
          } catch {
            /* ignore */
          }
        }
        if (state.themeId && state.liveBible && state.queue.length) {
          $("#stage").innerHTML = `<p class="hint">Fetching ${tr.toUpperCase()}…</p>`;
          state.queue = await hydrateQueueFromLive(
            state.queue.map((v) => ({ ...v, text: v.localText || v.text }))
          );
          startRound();
        }
      });
    }

    const autoToggle = $("#auto-advance");
    const prefs = loadPrefs();
    if (autoToggle) {
      state.autoAdvance = !!prefs.autoAdvance;
      autoToggle.checked = state.autoAdvance;
      autoToggle.addEventListener("change", () => {
        state.autoAdvance = autoToggle.checked;
        savePrefs({ autoAdvance: state.autoAdvance });
      });
    }
    if (prefs.mode && MODE_LABELS[prefs.mode]) {
      setMode(prefs.mode);
    }

    const liveToggle = $("#live-bible");
    if (liveToggle) {
      const pref = window.VERSEKEEP_BIBLE?.preferred || "esv";
      liveToggle.checked = pref !== "local";
      state.liveBible = liveToggle.checked;
      liveToggle.addEventListener("change", async () => {
        state.liveBible = liveToggle.checked;
        if (window.VERSEKEEP_BIBLE) {
          const tr = $("#tr-select")?.value || "esv";
          window.VERSEKEEP_BIBLE.preferred = liveToggle.checked ? tr : "local";
        }
        const lbl = $("#live-bible-label");
        if (lbl) {
          lbl.textContent = liveToggle.checked
            ? `(${($("#tr-select")?.value || "esv").toUpperCase()})`
            : "(bundled)";
        }
        if (window.VerseKeepMeditate?.refresh) {
          try {
            await window.VerseKeepMeditate.refresh();
          } catch {
            /* ignore */
          }
        }
        // Re-hydrate current theme queue when toggled mid-session
        if (state.themeId && state.queue.length) {
          $("#stage").innerHTML = `<p class="hint">${liveToggle.checked ? "Fetching live text…" : "Restoring bundled text…"}</p>`;
          if (liveToggle.checked) {
            state.queue = await hydrateQueueFromLive(
              state.queue.map((v) => ({
                ...v,
                text: v.localText || v.text,
              }))
            );
          } else {
            state.queue = state.queue.map((v) => ({
              ...v,
              text: v.localText || v.text,
              liveSource: undefined,
              liveTranslation: undefined,
            }));
          }
          startRound();
        }
      });
    }

    // Keyboard shortcuts (skip when typing in free-form fields except controlled cases)
    window.addEventListener("keydown", (e) => {
      if (e.altKey || e.metaKey || e.ctrlKey) return;
      const typing = isTypingTarget(document.activeElement);

      // In quiz mode, 1–4 pick answers; otherwise 1–5 switch practice modes
      if (!typing && state.mode === "quiz" && !state.answered && e.key >= "1" && e.key <= "4") {
        const choices = $$("#quiz-choices .choice");
        const btn = choices[Number(e.key) - 1];
        const v = currentVerse();
        if (btn && v) {
          e.preventDefault();
          gradeQuiz(btn, v);
          return;
        }
      }

      if (!typing && e.key >= "1" && e.key <= "5") {
        const mode = MODE_ORDER[Number(e.key) - 1];
        if (mode) {
          e.preventDefault();
          setMode(mode);
        }
        return;
      }

      if (!typing && (e.key === "n" || e.key === "N")) {
        e.preventDefault();
        nextVerse();
        return;
      }
      if (!typing && (e.key === "b" || e.key === "B")) {
        e.preventDefault();
        prevVerse();
        return;
      }
      if (!typing && (e.key === "r" || e.key === "R")) {
        e.preventDefault();
        $("#btn-reveal")?.click();
        return;
      }
      if (!typing && (e.key === "c" || e.key === "C")) {
        e.preventDefault();
        copyCurrentVerse().catch(() => {});
        return;
      }
      if (!typing && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        shuffleQueue();
        return;
      }
      if (!typing && (e.key === "l" || e.key === "L")) {
        e.preventDefault();
        readAloud();
        return;
      }
      if (!typing && (e.key === "h" || e.key === "H") && state.mode === "study") {
        e.preventDefault();
        toggleStudyHide();
        return;
      }
      if (!typing && e.key === "Enter" && !$("#btn-check")?.hidden) {
        e.preventDefault();
        checkAnswer();
        return;
      }
    });

    const y = $("#year");
    if (y) y.textContent = String(new Date().getFullYear());
    const ver = $("#site-version");
    if (ver) ver.textContent = "v2026.07.19.8";

    // Phone: hide sticky topbar while scrolling down; show on scroll up / near top
    (function bindPhoneHeaderHide() {
      const bar = document.querySelector(".topbar");
      if (!bar) return;
      const mq = window.matchMedia("(max-width: 720px)");
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
      let lastY = window.scrollY || 0;
      let ticking = false;

      function apply() {
        ticking = false;
        if (!mq.matches || reduce.matches) {
          bar.classList.remove("is-scroll-hidden");
          return;
        }
        const yPos = window.scrollY || 0;
        const delta = yPos - lastY;
        if (yPos < 24) {
          bar.classList.remove("is-scroll-hidden");
        } else if (delta > 6) {
          bar.classList.add("is-scroll-hidden");
        } else if (delta < -6) {
          bar.classList.remove("is-scroll-hidden");
        }
        lastY = yPos;
      }

      window.addEventListener(
        "scroll",
        () => {
          if (!ticking) {
            ticking = true;
            requestAnimationFrame(apply);
          }
        },
        { passive: true }
      );
      window.addEventListener("resize", () => {
        if (!mq.matches) bar.classList.remove("is-scroll-hidden");
      });
      mq.addEventListener?.("change", () => {
        if (!mq.matches) bar.classList.remove("is-scroll-hidden");
      });
    })();

    // Soft resume hint for last memory theme
    if (stats.lastTheme && state.data?.themes?.some((t) => t.id === stats.lastTheme)) {
      const hint = $("#resume-hint");
      if (hint) {
        const t = state.data.themes.find((x) => x.id === stats.lastTheme);
        hint.hidden = false;
        hint.innerHTML = `Last drill: <button type="button" class="linkish" id="btn-resume">${escapeHtml(t.emoji + " " + t.title)}</button>`;
        $("#btn-resume")?.addEventListener("click", () => selectTheme(stats.lastTheme));
      }
    }
  }

  window.VerseKeepPractice = {
    selectTheme,
    practiceWeak,
  };

  boot();
})();
