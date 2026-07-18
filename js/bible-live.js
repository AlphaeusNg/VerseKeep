/**
 * Live verse text for ESV / NIV / NKJV (with local JSON fallback).
 */
(function (global) {
  "use strict";

  const TRANSLATIONS = {
    esv: { id: "ESV", label: "ESV" },
    niv: { id: "NIV", label: "NIV" },
    nkjv: { id: "NKJV", label: "NKJV" },
  };

  /** Protestant canon book order used by bolls.life book ids (1–66). */
  const BOOK_IDS = {
    genesis: 1,
    exodus: 2,
    leviticus: 3,
    numbers: 4,
    deuteronomy: 5,
    joshua: 6,
    judges: 7,
    ruth: 8,
    "1 samuel": 9,
    "2 samuel": 10,
    "1 kings": 11,
    "2 kings": 12,
    "1 chronicles": 13,
    "2 chronicles": 14,
    ezra: 15,
    nehemiah: 16,
    esther: 17,
    job: 18,
    psalm: 19,
    psalms: 19,
    proverbs: 20,
    ecclesiastes: 21,
    "song of solomon": 22,
    "song of songs": 22,
    canticles: 22,
    isaiah: 23,
    jeremiah: 24,
    lamentations: 25,
    ezekiel: 26,
    daniel: 27,
    hosea: 28,
    joel: 29,
    amos: 30,
    obadiah: 31,
    jonah: 32,
    micah: 33,
    nahum: 34,
    habakkuk: 35,
    zephaniah: 36,
    haggai: 37,
    zechariah: 38,
    malachi: 39,
    matthew: 40,
    mark: 41,
    luke: 42,
    john: 43,
    acts: 44,
    romans: 45,
    "1 corinthians": 46,
    "2 corinthians": 47,
    galatians: 48,
    ephesians: 49,
    philippians: 50,
    colossians: 51,
    "1 thessalonians": 52,
    "2 thessalonians": 53,
    "1 timothy": 54,
    "2 timothy": 55,
    titus: 56,
    philemon: 57,
    hebrews: 58,
    james: 59,
    "1 peter": 60,
    "2 peter": 61,
    "1 john": 62,
    "2 john": 63,
    "3 john": 64,
    jude: 65,
    revelation: 66,
  };

  function cfg() {
    return global.VERSEKEEP_BIBLE || {};
  }

  function cleanRef(ref) {
    return String(ref || "")
      .replace(/[–—]/g, "-")
      .replace(/\s+/g, " ")
      .trim();
  }

  function stripHtml(html) {
    return String(html || "")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim();
  }

  /** Single-chapter books often cited as "Jude 24–25" (verse only). */
  const SINGLE_CHAPTER_BOOKS = new Set([
    "obadiah",
    "philemon",
    "2 john",
    "3 john",
    "jude",
  ]);

  /**
   * Parse "John 3:16", "1 John 3:1", "Proverbs 3:5-6", "Jude 24-25"
   * @returns {{ bookId: number, chapter: number, verseStart: number, verseEnd: number } | null}
   */
  function parseRef(ref) {
    const s = cleanRef(ref);

    // Standard Book Chapter:Verse[-Verse]
    let m = s.match(
      /^((?:[123]|I{1,3})\s+)?([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+(\d+)\s*:\s*(\d+)(?:\s*-\s*(\d+))?$/
    );
    if (m) {
      const prefix = (m[1] || "")
        .trim()
        .replace(/^III$/i, "3")
        .replace(/^II$/i, "2")
        .replace(/^I$/i, "1");
      const name = (prefix ? prefix + " " : "") + m[2];
      const key = name.toLowerCase().replace(/\./g, "").trim();
      const bookId = BOOK_IDS[key];
      if (!bookId) return null;
      const chapter = parseInt(m[3], 10);
      const verseStart = parseInt(m[4], 10);
      const verseEnd = m[5] ? parseInt(m[5], 10) : verseStart;
      if (!chapter || !verseStart || verseEnd < verseStart) return null;
      return { bookId, chapter, verseStart, verseEnd };
    }

    // Single-chapter: "Jude 24" / "Jude 24-25" / "3 John 2"
    m = s.match(
      /^((?:[123]|I{1,3})\s+)?([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+(\d+)(?:\s*-\s*(\d+))?$/
    );
    if (m) {
      const prefix = (m[1] || "")
        .trim()
        .replace(/^III$/i, "3")
        .replace(/^II$/i, "2")
        .replace(/^I$/i, "1");
      const name = (prefix ? prefix + " " : "") + m[2];
      const key = name.toLowerCase().replace(/\./g, "").trim();
      if (!SINGLE_CHAPTER_BOOKS.has(key)) return null;
      const bookId = BOOK_IDS[key];
      if (!bookId) return null;
      const verseStart = parseInt(m[3], 10);
      const verseEnd = m[4] ? parseInt(m[4], 10) : verseStart;
      if (!verseStart || verseEnd < verseStart) return null;
      return { bookId, chapter: 1, verseStart, verseEnd };
    }

    return null;
  }

  function normalizeTranslation(slug) {
    const s = String(slug || cfg().bibleApiTranslation || "esv").toLowerCase();
    if (s === "niv2011") return "niv";
    if (TRANSLATIONS[s]) return s;
    // migrate old prefs
    if (s === "web" || s === "bbe" || s === "asv" || s === "kjv") return "esv";
    return "esv";
  }

  async function fetchBollsRange(trId, bookId, chapter, verseStart, verseEnd) {
    if (verseStart === verseEnd) {
      const url = `https://bolls.life/get-verse/${encodeURIComponent(trId)}/${bookId}/${chapter}/${verseStart}/`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`verse ${res.status}`);
      const data = await res.json();
      const text = stripHtml(data.text);
      if (!text) throw new Error("Empty verse");
      return text;
    }
    const url = `https://bolls.life/get-text/${encodeURIComponent(trId)}/${bookId}/${chapter}/`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`chapter ${res.status}`);
    const rows = await res.json();
    if (!Array.isArray(rows)) throw new Error("Bad chapter payload");
    const parts = rows
      .filter((r) => r.verse >= verseStart && r.verse <= verseEnd)
      .sort((a, b) => a.verse - b.verse)
      .map((r) => stripHtml(r.text));
    const text = parts.join(" ").replace(/\s+/g, " ").trim();
    if (!text) throw new Error("Empty range");
    return text;
  }

  async function fetchOfficialEsv(ref) {
    const key = cfg().esvApiKey;
    if (!key) throw new Error("No ESV API key");
    const url =
      "https://api.esv.org/v3/passage/text/?" +
      new URLSearchParams({
        q: cleanRef(ref),
        "include-passage-references": "false",
        "include-verse-numbers": "false",
        "include-first-verse-numbers": "false",
        "include-footnotes": "false",
        "include-headings": "false",
        "include-short-copyright": "false",
      });
    const res = await fetch(url, {
      headers: { Authorization: `Token ${key}` },
    });
    if (!res.ok) throw new Error(`ESV ${res.status}`);
    const data = await res.json();
    const text = String(data.passages?.[0] || "")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) throw new Error("Empty ESV passage");
    return {
      text,
      reference: data.canonical || ref,
      translation: "ESV",
      source: "api.esv.org",
    };
  }

  const memCache = new Map(); // key -> { text, reference, translation, source, ts }
  const inflight = new Map(); // key -> Promise
  const CACHE_TTL_MS = 1000 * 60 * 60 * 12; // 12h
  const CACHE_PREFIX = "vk-bible-v1:";

  function cacheKey(slug, ref) {
    return `${slug}|${cleanRef(ref).toLowerCase()}`;
  }

  function readSessionCache(key) {
    try {
      const raw = sessionStorage.getItem(CACHE_PREFIX + key);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data?.text || !data.ts) return null;
      if (Date.now() - data.ts > CACHE_TTL_MS) return null;
      return data;
    } catch {
      return null;
    }
  }

  function writeSessionCache(key, payload) {
    try {
      sessionStorage.setItem(
        CACHE_PREFIX + key,
        JSON.stringify({ ...payload, ts: Date.now() })
      );
    } catch {
      /* quota / private mode */
    }
  }

  async function fetchLive(ref, translationSlug) {
    const slug = normalizeTranslation(translationSlug);
    const meta = TRANSLATIONS[slug];
    const parsed = parseRef(ref);
    if (!parsed) throw new Error("Unparsed ref: " + ref);

    // Optional official ESV key path first when slug is esv
    if (slug === "esv" && cfg().esvApiKey) {
      try {
        return await fetchOfficialEsv(ref);
      } catch (err) {
        console.warn("[bible-live] official ESV", err.message);
      }
    }

    const text = await fetchBollsRange(
      meta.id,
      parsed.bookId,
      parsed.chapter,
      parsed.verseStart,
      parsed.verseEnd
    );
    return {
      text,
      reference: ref,
      translation: meta.label,
      source: "live",
    };
  }

  /**
   * Prefer selected translation; fall back to local text on failure.
   * Session + memory cache; in-flight requests are de-duped.
   * @returns {Promise<{text, reference, translation, source, fromCache?: boolean}>}
   */
  async function resolveVerse(ref, localText) {
    const preferred = String(cfg().preferred || "esv").toLowerCase();
    if (preferred === "local") {
      return {
        text: localText || "",
        reference: ref,
        translation: "LOCAL",
        source: "bundled JSON",
        fromCache: true,
      };
    }

    const slug = normalizeTranslation(cfg().bibleApiTranslation || preferred);
    const key = cacheKey(slug, ref);

    const mem = memCache.get(key);
    if (mem && Date.now() - mem.ts < CACHE_TTL_MS) {
      return { ...mem, fromCache: true };
    }

    const sess = readSessionCache(key);
    if (sess) {
      memCache.set(key, sess);
      return { ...sess, fromCache: true };
    }

    if (inflight.has(key)) {
      try {
        return await inflight.get(key);
      } catch {
        /* fall through to local */
      }
    }

    const job = (async () => {
      const live = await fetchLive(ref, slug);
      const stored = { ...live, ts: Date.now() };
      memCache.set(key, stored);
      writeSessionCache(key, stored);
      return live;
    })();

    inflight.set(key, job);
    try {
      return await job;
    } catch (err) {
      console.warn("[bible-live]", slug, err.message);
    } finally {
      inflight.delete(key);
    }

    return {
      text: localText || "",
      reference: ref,
      translation: "LOCAL",
      source: "bundled JSON (live fetch failed)",
      fromCache: true,
    };
  }

  /** Warm cache for a ref without throwing (used to prefetch next/prev). */
  function prefetch(ref, translationSlug) {
    if (!ref) return;
    const slug = normalizeTranslation(
      translationSlug || cfg().bibleApiTranslation || "esv"
    );
    const key = cacheKey(slug, ref);
    if (memCache.has(key) || inflight.has(key) || readSessionCache(key)) return;
    resolveVerse(ref, "").catch(() => {});
  }

  global.VerseKeepBible = {
    resolveVerse,
    prefetch,
    parseRef,
    normalizeTranslation,
    TRANSLATIONS,
  };
})(window);
