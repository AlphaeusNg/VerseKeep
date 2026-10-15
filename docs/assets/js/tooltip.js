/* One viewport-contained tooltip for static and dynamically rendered controls. */
(() => {
  const tip = document.createElement("div");
  tip.id = "vk-tip";
  tip.role = "tooltip";
  tip.hidden = true;
  document.body.append(tip);
  let target = null;
  let timer;
  let source = null;
  let lastPointerMove = -Infinity;

  const resetPointerMove = () => { lastPointerMove = -Infinity; };

  function hide() {
    clearTimeout(timer);
    if (target) {
      const ids = (target.getAttribute("aria-describedby") || "").split(/\s+/).filter(id => id && id !== tip.id);
      if (ids.length) target.setAttribute("aria-describedby", ids.join(" "));
      else target.removeAttribute("aria-describedby");
    }
    target = null;
    source = null;
    tip.hidden = true;
  }

  function place() {
    if (!target) return;
    if (!target.isConnected) return hide();
    const rect = target.getBoundingClientRect();
    const width = document.documentElement.clientWidth;
    const height = document.documentElement.clientHeight;
    const box = tip.getBoundingClientRect();
    const clamp = (value, size, limit) => Math.max(0, Math.min(value, limit - size));
    tip.style.left = `${clamp(rect.left + (rect.width - box.width) / 2, box.width, width)}px`;
    const top = rect.bottom + 6;
    tip.style.top = `${clamp(top + box.height <= height ? top : rect.top - box.height - 6, box.height, height)}px`;
  }

  function show(control, reason = "touch") {
    hide();
    if (!control?.isConnected || !control.dataset.tip) return;
    target = control;
    source = reason;
    tip.textContent = control.dataset.tip;
    tip.style.left = "0px";
    tip.style.top = "0px";
    tip.hidden = false;
    place();
    if (!target) return;
    const ids = (control.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean);
    control.setAttribute("aria-describedby", [...new Set([...ids, tip.id])].join(" "));
  }

  const controlFor = event => event.target.closest?.("[data-tip]");
  function showHover(control) {
    if (!control || performance.now() - lastPointerMove > 100) return;
    // A stationary pointer must never replace an active keyboard tooltip.
    if (source === "focus" && document.activeElement === target) return;
    if (target !== control) show(control, "hover");
  }
  document.addEventListener("mouseenter", event => {
    const control = controlFor(event);
    if (control === event.target) showHover(control);
  }, true);
  document.addEventListener("mouseleave", event => {
    if (event.target === target && source === "hover") {
      if (document.activeElement === target && target.matches(":focus-visible")) source = "focus";
      else hide();
    }
  }, true);
  document.addEventListener("focusin", event => {
    resetPointerMove();
    const control = controlFor(event);
    if (control?.matches(":focus-visible")) show(control, "focus");
  });
  document.addEventListener("focusout", event => {
    if (source === "focus" && target?.contains(event.target)) hide();
  });
  document.addEventListener("keydown", event => {
    resetPointerMove();
    if (event.key === "Escape") hide();
  });
  document.addEventListener("pointerdown", event => {
    resetPointerMove();
    if (event.pointerType !== "touch") return;
    hide();
    const control = controlFor(event);
    if (control) timer = setTimeout(() => show(control), 500);
  });
  document.addEventListener("pointerup", () => clearTimeout(timer));
  document.addEventListener("pointercancel", hide);
  document.addEventListener("pointermove", event => {
    if (event.pointerType === "touch") hide();
    if (event.pointerType === "mouse" || event.pointerType === "pen") {
      lastPointerMove = performance.now();
      // Entry events can precede pointermove, so also handle the move itself.
      showHover(controlFor(event));
    }
  });
  function layoutChanged() {
    resetPointerMove();
    place();
  }
  window.addEventListener("scroll", layoutChanged, true);
  window.addEventListener("resize", layoutChanged);
})();
