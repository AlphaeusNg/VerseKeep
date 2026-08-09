/**
 * VerseKeep deployment stamp.
 * Bump only this id for each deploy: YYYY.MM.DD.N.
 */
(function (global) {
  "use strict";

  global.SITE_VERSION = {
    id: "2026.08.09.5",
    repo: "VerseKeep",
  };

  function paintVersion() {
    var element =
      global.document && global.document.getElementById("site-version");
    if (element) {
      element.textContent = "v" + global.SITE_VERSION.id;
    }
  }

  if (global.document && global.document.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", paintVersion, {
      once: true,
    });
  } else {
    paintVersion();
  }
})(window);
