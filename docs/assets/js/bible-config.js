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
    /**
     * Optional official ESV API token (https://api.esv.org/).
     * Used only as a secondary path for ESV when set; browser CORS may block it.
     */
    esvApiKey: "",
  };
})(window);
