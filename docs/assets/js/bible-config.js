/**
 * Live Bible translation preferences for VerseKeep.
 * Default: ESV. Options: ESV, NIV, NKJV.
 */
(function (global) {
  "use strict";
  global.VERSEKEEP_BIBLE = {
    /** Default translation: esv | niv | nkjv | local */
    preferred: "esv",
    /** Active translation slug used by the UI select */
    bibleApiTranslation: "esv",
    /** Abort a stalled live lookup so bundled text can render promptly. */
    requestTimeoutMs: 8000,
    /**
     * Optional official ESV API token (https://api.esv.org/).
     * Tried first for ESV when set; browser CORS may block it.
     */
    esvApiKey: "",
  };
})(window);
