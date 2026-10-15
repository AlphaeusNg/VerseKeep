/* Shared disclosure menu: preserve existing action handlers and shortcuts. */
(() => {
  const button = document.getElementById('btn-more');
  const menu = document.getElementById('practice-menu');
  if (!button || !menu) return;
  const items = () => [...menu.querySelectorAll('[role="menuitem"], [role="menuitemcheckbox"]')].filter(item => !item.disabled && !item.hidden);
  function close(restore = false) {
    menu.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    if (restore) button.focus();
  }
  function open() {
    menu.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    items()[0]?.focus();
  }
  new MutationObserver(() => {
    if (document.getElementById('practice-actions')?.hidden) close();
  }).observe(document.getElementById('practice-actions'), { attributes: true, attributeFilter: ['hidden'] });
  button.addEventListener('click', () => menu.hidden ? open() : close());
  menu.addEventListener('click', event => {
    if (event.target.closest('[role="menuitem"]')) close(true);
  });
  document.addEventListener('click', event => {
    if (!menu.contains(event.target) && !button.contains(event.target)) close();
  });
  document.addEventListener('keydown', event => {
    if (menu.hidden && event.target !== button) return;
    if (event.key === 'Tab' && !menu.hidden && menu.contains(event.target)) {
      close(true); return;
    }
    if (event.key === 'Escape' && !menu.hidden) {
      event.preventDefault(); event.stopImmediatePropagation(); close(true); return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    if (!menu.contains(event.target) && event.target !== button) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (menu.hidden) { open(); return; }
    const list = items();
    const index = list.indexOf(document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? list.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length;
    list[next]?.focus();
  });
})();
