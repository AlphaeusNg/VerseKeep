(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const state = {
    data: null,
    themeId: null,
    mode: "study", // study | blank | type | order | quiz
    queue: [],
    index: 0,
    score: 0,
    streak: 0,
    answered: false,
    blanks: [],
    orderPicked: [],
    liveBible: true,
    liveMeta: null,
  };

  const MODE_LABELS = {
    study: "Study",
    blank: "Fill blanks",
    type: "Type it",
    order: "Order words",
    quiz: "Which verse?",
  };

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

  function paintThemes() {
    const host = $("#theme-grid");
    if (!host || !state.data) return;
    host.innerHTML = state.data.themes
      .map(
        (t) => `
      <button type="button" class="theme-card${t.id === state.themeId ? " is-active" : ""}" data-theme="${t.id}">
        <span class="emoji" aria-hidden="true">${t.emoji}</span>
        <strong>${escapeHtml(t.title)}</strong>
        <small>${escapeHtml(t.blurb)}</small>
      </button>`
      )
      .join("");
    host.querySelectorAll("[data-theme]").forEach((btn) => {
      btn.addEventListener("click", () => selectTheme(btn.dataset.theme));
    });
  }

  async function hydrateQueueFromLive(queue) {
    if (!state.liveBible || !window.VerseKeepBible?.resolveVerse) return queue;
    const out = [];
    for (const v of queue) {
      try {
        const live = await window.VerseKeepBible.resolveVerse(v.ref, v.text);
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

  async function selectTheme(id) {
    state.themeId = id;
    const theme = currentTheme();
    if (!theme) return;
    $("#play-panel").hidden = false;
    $("#theme-label").textContent = `${theme.emoji} ${theme.title}`;
    $("#stage").innerHTML = `<p class="hint">Loading verses${state.liveBible ? " (live text)…" : "…"}</p>`;
    paintThemes();

    let queue = shuffle(theme.verses.map((v) => ({ ...v, themeId: theme.id, localText: v.text })));
    queue = await hydrateQueueFromLive(queue);
    state.queue = queue;
    state.index = 0;
    state.score = 0;
    state.streak = 0;
    state.answered = false;

    const first = queue[0];
    state.liveMeta = first?.liveTranslation
      ? `${first.liveTranslation} · ${first.liveSource || "live"}`
      : "local JSON";
    const lbl = $("#live-bible-label");
    if (lbl) lbl.textContent = `(${state.liveMeta})`;

    startRound();
    $("#play-panel").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function setMode(mode) {
    state.mode = mode;
    $$(".mode-row .chip").forEach((c) => {
      c.classList.toggle("is-active", c.dataset.mode === mode);
    });
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
    fb.hidden = true;
    fb.className = "feedback";
    fb.textContent = "";
  }

  function showFeedback(ok, msg) {
    const fb = $("#feedback");
    fb.hidden = false;
    fb.className = `feedback ${ok ? "ok" : "bad"}`;
    fb.textContent = msg;
  }

  function startRound() {
    const v = currentVerse();
    clearFeedback();
    state.answered = false;
    state.orderPicked = [];
    state.blanks = [];
    updateHud();
    $("#btn-check").hidden = state.mode === "study" || state.mode === "quiz";
    $("#btn-next").textContent = state.index >= state.queue.length - 1 ? "Finish theme" : "Next verse";
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
      <div class="study-box">
        <div class="ref">${escapeHtml(v.ref)} ${src}</div>
        <p>${escapeHtml(v.text)}</p>
      </div>
      <p class="hint" style="margin-top:0.75rem;color:var(--dim);font-size:0.88rem">Read it aloud. When ready, switch mode to test yourself — or hit Next.</p>`;
    $("#btn-check").hidden = true;
  }

  function pickBlankIndices(n, count) {
    const candidates = [];
    for (let i = 0; i < n; i++) {
      if (i > 0 && i < n - 1) candidates.push(i);
    }
    return shuffle(candidates).slice(0, Math.min(count, candidates.length)).sort((a, b) => a - b);
  }

  function renderBlank(v) {
    const w = words(v.text);
    const idxs = pickBlankIndices(w.length, Math.min(4, Math.max(2, Math.floor(w.length / 8))));
    state.blanks = idxs.map((i) => w[i].replace(/[^\w']/g, ""));
    const html = w
      .map((word, i) => {
        if (!idxs.includes(i)) return escapeHtml(word);
        return `<input type="text" class="blank-input" data-bi="${idxs.indexOf(i)}" autocomplete="off" spellcheck="false" aria-label="Blank ${idxs.indexOf(i) + 1}" style="width:${Math.max(4, word.length + 1)}ch;display:inline-block;margin:0 .15rem;padding:.15rem .3rem;border:none;border-bottom:2px solid var(--gold);background:transparent;color:var(--gold);font:inherit;font-weight:600;text-align:center" />`;
      })
      .join(" ");
    $("#stage").innerHTML = `
      <div class="ref">${escapeHtml(v.ref)}</div>
      <p class="verse-prompt">${html}</p>`;
    $("#btn-check").hidden = false;
    const first = $("#stage .blank-input");
    first?.focus();
  }

  function renderType(v) {
    $("#stage").innerHTML = `
      <div class="ref">${escapeHtml(v.ref)}</div>
      <p class="hint" style="color:var(--dim);font-size:0.9rem;margin:0.5rem 0 0">Type the verse from memory (punctuation flexible).</p>
      <div class="input-block">
        <label for="type-input">Your recall</label>
        <textarea id="type-input" rows="4" placeholder="Start typing…"></textarea>
      </div>`;
    $("#btn-check").hidden = false;
    $("#type-input")?.focus();
  }

  function renderOrder(v) {
    const w = words(v.text).map((x) => x.replace(/[^\w']/g, "")).filter(Boolean);
    // Cap length for mobile UX
    const slice = w.length > 18 ? w.slice(0, 14) : w;
    state.orderTarget = slice;
    const bank = shuffle(slice.map((word, i) => ({ word, i: `${word}-${i}-${Math.random()}` })));
    $("#stage").innerHTML = `
      <div class="ref">${escapeHtml(v.ref)}</div>
      <p class="hint" style="color:var(--dim);font-size:0.9rem;margin:0.5rem 0 0">Tap words in order${w.length > 18 ? " (first lines)" : ""}.</p>
      <div class="assemble-line" id="assemble-line" aria-live="polite"></div>
      <div class="word-bank" id="word-bank">
        ${bank
          .map(
            (b) =>
              `<button type="button" class="word-chip" data-word="${escapeHtml(b.word)}">${escapeHtml(b.word)}</button>`
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
      state.orderPicked.push(chip.dataset.word);
      paintAssemble();
    });
    $("#btn-order-undo")?.addEventListener("click", () => {
      const last = state.orderPicked.pop();
      if (!last) return;
      const chip = [...$$("#word-bank .word-chip")].find(
        (c) => c.dataset.word === last && c.classList.contains("is-used")
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
      ? state.orderPicked.map((w) => `<span class="word-chip" style="cursor:default">${escapeHtml(w)}</span>`).join("")
      : `<span style="color:var(--dim);font-size:0.88rem">Your sequence appears here…</span>`;
  }

  function renderQuiz(v) {
    const theme = currentTheme();
    const others = shuffle(theme.verses.filter((x) => x.ref !== v.ref)).slice(0, 3);
    const options = shuffle([v, ...others]);
    $("#stage").innerHTML = `
      <p class="hint" style="color:var(--dim);font-size:0.9rem;margin:0">Which reference matches this text?</p>
      <p class="verse-prompt" style="margin-top:0.65rem">${escapeHtml(v.text)}</p>
      <div class="choices" id="quiz-choices">
        ${options
          .map(
            (o) =>
              `<button type="button" class="choice" data-ref="${escapeHtml(o.ref)}">${escapeHtml(o.ref)}</button>`
          )
          .join("")}
      </div>`;
    $("#btn-check").hidden = true;
    $("#quiz-choices")?.addEventListener("click", (e) => {
      const btn = e.target.closest(".choice");
      if (!btn || state.answered) return;
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
        showFeedback(true, "Yes — well remembered.");
      } else {
        state.streak = 0;
        showFeedback(false, `Not quite. Correct: ${v.ref}`);
      }
      updateHud();
    });
  }

  function checkAnswer() {
    const v = currentVerse();
    if (!v || state.answered) return;
    let ok = false;
    let detail = "";

    if (state.mode === "blank") {
      const inputs = $$("#stage .blank-input");
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
      detail = ok ? "All blanks correct." : `You got ${right}/${state.blanks.length}. Correct words filled in.`;
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
      const got = state.orderPicked.map((w) => normalize(w));
      ok = target.length > 0 && target.every((w, i) => w === got[i]) && got.length === target.length;
      detail = ok ? "Order perfect." : `Target order: ${state.orderTarget.join(" ")}`;
    }

    state.answered = true;
    if (ok) {
      state.score += 10 + state.streak * 2;
      state.streak += 1;
      showFeedback(true, detail);
    } else {
      state.streak = 0;
      showFeedback(false, detail);
    }
    updateHud();
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
    if (state.index >= state.queue.length - 1) {
      showFeedback(
        true,
        `Theme complete · score ${state.score}. Pick another theme or shuffle with a new mode.`
      );
      state.index = 0;
      state.queue = shuffle(state.queue);
      startRound();
      return;
    }
    state.index += 1;
    startRound();
  }

  async function boot() {
    try {
      const res = await fetch("data/verses.json", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      state.data = await res.json();
      paintThemes();
      $("#load-error").hidden = true;
    } catch (err) {
      console.error(err);
      $("#load-error").hidden = false;
      $("#load-error").textContent = `Could not load verses: ${err.message}`;
    }

    $$(".mode-row .chip[data-mode]").forEach((chip) => {
      chip.addEventListener("click", () => setMode(chip.dataset.mode));
    });
    $("#btn-check")?.addEventListener("click", checkAnswer);
    $("#btn-next")?.addEventListener("click", nextVerse);
    $("#btn-reveal")?.addEventListener("click", () => {
      const v = currentVerse();
      if (!v) return;
      showFeedback(true, `${v.ref}: ${v.text}`);
    });

    const liveToggle = $("#live-bible");
    if (liveToggle) {
      const pref = window.VERSEKEEP_BIBLE?.preferred || "web";
      liveToggle.checked = pref !== "local";
      state.liveBible = liveToggle.checked;
      liveToggle.addEventListener("change", () => {
        state.liveBible = liveToggle.checked;
        if (window.VERSEKEEP_BIBLE) {
          window.VERSEKEEP_BIBLE.preferred = liveToggle.checked ? "web" : "local";
        }
        const lbl = $("#live-bible-label");
        if (lbl) {
          lbl.textContent = liveToggle.checked ? "(bible-api WEB · live)" : "(bundled JSON only)";
        }
      });
    }

    const y = $("#year");
    if (y) y.textContent = String(new Date().getFullYear());
  }

  boot();
})();
