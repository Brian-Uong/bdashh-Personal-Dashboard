// Decoration only: never navigates, scrolls the document, or reads dashboard data.
export function mountSeamlessSidebar(sidebar, nav) {
  if (!sidebar || !nav) return () => {};
  const win = sidebar.ownerDocument.defaultView;
  const desktop = win.matchMedia('(min-width: 851px)');
  let frame = 0, disposed = false, previousKey = null;
  const update = () => {
    frame = 0;
    if (disposed) return;
    const active = nav.querySelector('[aria-current="page"]');
    if (!desktop.matches || !active) {
      sidebar.removeAttribute('data-seam-ready');
      sidebar.removeAttribute('data-seam-motion');
      previousKey = null;
      return;
    }
    const shell = sidebar.getBoundingClientRect();
    const list = nav.getBoundingClientRect();
    const row = active.getBoundingClientRect();
    const top = Math.max(row.top, list.top, shell.top);
    const bottom = Math.min(row.bottom, list.bottom, shell.bottom);
    const height = Math.max(0, bottom - top);
    const key = active.dataset.section;
    // Animate intentional selection changes; track resize/scroll immediately.
    sidebar.toggleAttribute('data-seam-motion', previousKey !== null && key !== previousKey);
    sidebar.style.setProperty('--seam-top', `${Math.max(0, Math.min(shell.height, top - shell.top))}px`);
    sidebar.style.setProperty('--seam-height', `${height}px`);
    sidebar.dataset.seamVisible = String(height >= row.height - 1);
    sidebar.setAttribute('data-seam-ready', '');
    previousKey = key;
  };
  const schedule = () => {
    if (!disposed && !frame) frame = win.requestAnimationFrame(update);
  };
  const mutation = new win.MutationObserver(schedule);
  mutation.observe(nav, {subtree:true, childList:true, attributes:true, attributeFilter:['aria-current']});
  const resize = new win.ResizeObserver(schedule);
  resize.observe(sidebar);
  resize.observe(nav);
  nav.addEventListener('scroll', schedule, {passive:true});
  win.addEventListener('resize', schedule);
  sidebar.ownerDocument.fonts?.ready.then(schedule);
  schedule();
  return () => {
    disposed = true;
    mutation.disconnect();
    resize.disconnect();
    nav.removeEventListener('scroll', schedule);
    win.removeEventListener('resize', schedule);
    if (frame) win.cancelAnimationFrame(frame);
  };
}
