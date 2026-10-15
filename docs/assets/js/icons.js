/* Shared currentColor line icons. Use data-icon in markup or the factory in renderers. */
(() => {
  const paths = {
  "close": '<path d="m6 6 12 12M6 18 18 6"/>',
  "heart": '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  "eye": "<path d=\"M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/>",
  "prev": "<path d=\"m14 6-6 6 6 6M8 12h13\"/>",
  "next": "<path d=\"m10 6 6 6-6 6M3 12h13\"/>",
  "check": "<path d=\"m5 12 4 4L19 6\"/>",
  "shuffle": "<path d=\"M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c5 0 7-12 12-12h3m-4-4 4 4-4 4\"/>",
  "copy": "<rect x=\"8\" y=\"8\" width=\"13\" height=\"13\" rx=\"2\"/><path d=\"M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3\"/>",
  "more": "<circle cx=\"5\" cy=\"12\" r=\"1\"/><circle cx=\"12\" cy=\"12\" r=\"1\"/><circle cx=\"19\" cy=\"12\" r=\"1\"/>",
  "chevron": "<path d=\"m9 5 7 7-7 7\"/>",
  "book": "<path d=\"M12 5v15M12 5C9 3 5 3 2 4v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Z\"/>",
  "keyboard": "<rect x=\"2\" y=\"5\" width=\"20\" height=\"14\" rx=\"2\"/><path d=\"M5 9h2m2 0h2m2 0h2m2 0h2M5 12h2m2 0h2m2 0h2m2 0h2M7 16h10\"/>",
  "reflect": "<path d=\"M8 5h13M8 12h13M8 19h13\"/><circle cx=\"3\" cy=\"5\" r=\"1\"/><circle cx=\"3\" cy=\"12\" r=\"1\"/><circle cx=\"3\" cy=\"19\" r=\"1\"/>",
  "music": "<path d=\"M9 18V5l12-2v13M9 7l12-2\"/><ellipse cx=\"6\" cy=\"18\" rx=\"3\" ry=\"3\"/><ellipse cx=\"18\" cy=\"16\" rx=\"3\" ry=\"3\"/>"
};
  window.VerseKeepIcons = Object.freeze(Object.fromEntries(Object.entries(paths).map(([name, body]) =>
    [name, () => `<svg class="vk-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`])));
  document.querySelectorAll("[data-icon]").forEach(node => {
    node.innerHTML = window.VerseKeepIcons[node.dataset.icon]();
  });
  document.querySelectorAll('.icon-control, .nav-more > summary[data-tip], #play-panel [data-mode="study"], #play-panel [data-mode="type"]').forEach(node => {
    const face = document.createElement("span");
    face.className = "icon-face";
    face.append(...node.childNodes);
    node.append(face);
  });
  document.querySelectorAll("summary.disclosure-summary, summary.wp-summary").forEach(node => {
    node.insertAdjacentHTML("beforeend", `<span class="disclosure-chevron">${window.VerseKeepIcons.chevron()}</span>`);
  });
})();
