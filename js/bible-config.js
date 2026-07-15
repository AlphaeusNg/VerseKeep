/**
 * Optional live Bible sources for VerseKeep.
 *
 * - bible-api.com works in the browser with no key (public domain translations).
 * - ESV requires a free key from https://api.esv.org/ (non-commercial).
 *   Browser CORS often blocks direct ESV calls → use a tiny proxy or leave key empty.
 * - YouVersion requires a developer app at https://platform.youversion.com/ (not embeddable
 *   with a public client key on static GitHub Pages). Use local JSON + bible-api instead.
 */
(function (global) {
  "use strict";
  global.VERSEKEEP_BIBLE = {
    /** Default remote source: "web" (bible-api World English Bible) | "local" | "esv" */
    preferred: "web",
    /** bible-api.com translation slug: web, kjv, asv, … */
    bibleApiTranslation: "web",
    /**
     * Optional ESV API token (https://api.esv.org/account/create-application/).
     * Leave empty to skip. Direct browser calls often fail CORS — then we fall back.
     */
    esvApiKey: "",
  };
})(window);
