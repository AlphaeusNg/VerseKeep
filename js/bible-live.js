/**
 * Live verse text: bible-api.com (no key) + optional ESV key.
 * YouVersion needs a private app key and is not used on static Pages.
 */
(function (global) {
  "use strict";

  function cfg() {
    return global.VERSEKEEP_BIBLE || {};
  }

  function cleanRef(ref) {
    return String(ref || "")
      .replace(/[–—]/g, "-")
      .replace(/\s+/g, " ")
      .trim();
  }

  async function fetchBibleApi(ref, translation) {
    const q = encodeURIComponent(cleanRef(ref));
    const tr = translation || cfg().bibleApiTranslation || "web";
    const url = `https://bible-api.com/${q}?translation=${encodeURIComponent(tr)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`bible-api ${res.status}`);
    const data = await res.json();
    const text = String(data.text || "")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) throw new Error("Empty passage");
    return {
      text,
      reference: data.reference || ref,
      translation: (data.translation_name || tr).toUpperCase(),
      source: "bible-api.com",
    };
  }

  async function fetchEsv(ref) {
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

  /**
   * Prefer configured source; fall back to local text on failure.
   * @returns {Promise<{text, reference, translation, source, fromCache?: boolean}>}
   */
  async function resolveVerse(ref, localText) {
    const preferred = cfg().preferred || "web";
    const tryOrder =
      preferred === "esv"
        ? ["esv", "web", "local"]
        : preferred === "local"
          ? ["local", "web"]
          : ["web", "esv", "local"];

    for (const kind of tryOrder) {
      try {
        if (kind === "local") {
          if (!localText) continue;
          return {
            text: localText,
            reference: ref,
            translation: "LOCAL",
            source: "bundled JSON",
            fromCache: true,
          };
        }
        if (kind === "web") return await fetchBibleApi(ref);
        if (kind === "esv" && cfg().esvApiKey) return await fetchEsv(ref);
      } catch (err) {
        console.warn("[bible-live]", kind, err.message);
      }
    }
    return {
      text: localText || "",
      reference: ref,
      translation: "LOCAL",
      source: "bundled JSON (live fetch failed)",
      fromCache: true,
    };
  }

  global.VerseKeepBible = {
    resolveVerse,
    fetchBibleApi,
    fetchEsv,
  };
})(window);
