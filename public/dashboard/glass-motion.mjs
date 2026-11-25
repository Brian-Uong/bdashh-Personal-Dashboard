/* Intentional navigation only. No timers, data access or DOM reconstruction.
 * Animations release their transforms on completion; maps and chart canvases
 * never acquire a transformed ancestor. Native dialogs retain focus handling.
 */
export const GLASS_MOTION = Object.freeze({card: 700, stagger: 70, maxDelay: 210, heading: 500, dialog: 720});

export function mountGlassMotion(doc = document) {
  const win = doc.defaultView, body = doc.body;
  if (!body.classList.contains('glass-workspace')) return () => {};
  const preference = win.matchMedia('(prefers-reduced-motion: reduce)');
  const running = new Set();
  let navigationFrame = 0;
  let openingFrame = 0, opening = null;
  let ready = body.dataset?.dashboardReady === 'true', openingScheduled = false;
  const allowed = () => !doc.hidden && !preference.matches &&
    !body.classList.contains('no-motion') && !body.classList.contains('nd-no-motion');
  const stop = () => {
    if (openingFrame) win.cancelAnimationFrame(openingFrame);
    openingFrame = 0;
    opening?.skipTransition();
    for (const animation of running) animation.cancel();
    running.clear();
  };
  // One native snapshot reveal per load. Nothing is cloned, delayed, or made
  // inert; unsupported browsers keep the normal readable page and card motion.
  function revealOpening() {
    openingFrame = 0;
    if (!allowed() || !doc.startViewTransition || !doc.getElementById('mainContent')) return;
    body.classList.add('workspace-revealing');
    const release = () => { opening = null; body.classList.remove('workspace-revealing'); };
    try {
      opening = doc.startViewTransition(() => {});
      opening.ready.catch(() => {});
      opening.finished.then(release, release);
    } catch { release(); }
  }
  const play = (element, keyframes, duration, delay = 0) => {
    if (!allowed() || !element?.animate) return;
    const animation = element.animate(keyframes, {duration, delay, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards'});
    running.add(animation);
    const release = () => running.delete(animation);
    animation.finished.then(release, release);
  };
  const visible = element => {
    if (!element.isConnected || element.closest('[hidden]')) return false;
    const box = element.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && box.top < win.innerHeight && box.bottom > 0;
  };
  const candidates = '.pageheading, #tabBrief, #careerTabs, #sectionActions, .metric, .pc-metrics article, .pd-panel, .panel, .pd-mini, .pd-overview-card, .pd-hero, .section-toolbar, .contact-card, .event-card, .position-card, .rec-pick, .news-picker, .news-topic-card, .investment-loading, .bdc-head, .bdc-pulse-row, .bdc-filter-row, .bdc-result, .bdc-empty';
  const protectedSurface = '.geo-root, .maplibregl-map, .leaflet-container, canvas, iframe, dialog';
  function cascade(scope, withHeading = true) {
    if (!scope || !allowed()) return;
    const all = [...scope.querySelectorAll(candidates)].filter(visible);
    // Reveal the individual cards in a panel instead of moving the whole grid.
    // Still choose just one surface at each depth: no compounded transforms.
    const surfaces = all.filter(el => !el.matches('.pd-panel, .panel') ||
      !all.some(child => child !== el && el.contains(child)));
    const outer = surfaces.filter(el => !surfaces.some(parent => parent !== el && parent.contains(el)));
    let index = 0;
    for (const el of outer) {
      if (el.matches('.pageheading')) {
        if (withHeading) play(el, [{opacity: .25, translate: '0 10px'}, {opacity: 1, translate: '0 0'}], GLASS_MOTION.heading);
        continue;
      }
      const stationary = el.matches(protectedSurface) || el.querySelector(protectedSurface);
      const frames = stationary ? [{opacity: .35}, {opacity: 1}] :
        [{opacity: .12, translate: '0 22px', scale: '.975'},
         {opacity: 1, translate: '0 -1px', scale: '1.003', offset: .82},
         {opacity: 1, translate: '0 0', scale: '1'}];
      play(el, frames, GLASS_MOTION.card, Math.min(index++ * GLASS_MOTION.stagger, GLASS_MOTION.maxDelay));
    }
  }
  function navigate(event) {
    if (!ready && doc.startViewTransition) return;
    stop();
    if (navigationFrame) win.cancelAnimationFrame(navigationFrame);
    if (!allowed()) return;
    // A single frame lets the selected view finish its synchronous render.
    // Subsequent data arrivals and background refreshes never enqueue motion.
    navigationFrame = win.requestAnimationFrame(() => {
      navigationFrame = 0;
      if (event.type === 'career:leadtypechange') {
        const board = doc.querySelector('brians-career-board');
        if (board && visible(board)) cascade(board.shadowRoot, false);
      } else {
        cascade(doc.querySelector('main'));
        const board = doc.querySelector('brians-career-board');
        if (board && visible(board)) cascade(board.shadowRoot, false);
      }
    });
  }
  // Only user-activated disclosure content gets a pop. A programmatic refresh
  // restoring an already-open details element must not replay its animation.
  function disclosure(event) {
    const summary = event.target.closest?.('summary');
    if (!summary || !event.isTrusted || !allowed()) return;
    const details = summary.parentElement;
    if (!details?.matches('details') || details.open || details.id === 'eventMapWrap') return;
    win.requestAnimationFrame(() => {
      if (!details.open || !details.isConnected) return;
      for (const child of details.children) {
        if (child === summary || !visible(child)) continue;
        const stationary = child.matches(protectedSurface) || child.querySelector(protectedSurface);
        play(child, stationary ? [{opacity: .3}, {opacity: 1}] :
          [{opacity: .15, translate: '0 14px', scale: '.97'},
           {opacity: 1, translate: '0 -1px', scale: '1.005', offset: .78},
           {opacity: 1, translate: '0 0', scale: '1'}], GLASS_MOTION.dialog);
      }
    });
  }
  const cancelIfDisabled = () => { if (!allowed()) stop(); };
  const readyOpening = () => {
    ready = true;
    if (openingScheduled || !doc.startViewTransition) return;
    openingScheduled = true;
    openingFrame = win.requestAnimationFrame(revealOpening);
  };
  const attributes = new win.MutationObserver(cancelIfDisabled);
  attributes.observe(body, {attributes: true, attributeFilter: ['class']});
  doc.addEventListener('dashboard:sectionchange', navigate);
  doc.addEventListener('dashboard:ready', readyOpening);
  doc.addEventListener('career:leadtypechange', navigate);
  doc.addEventListener('click', disclosure);
  doc.addEventListener('visibilitychange', cancelIfDisabled);
  preference.addEventListener('change', cancelIfDisabled);
  if (ready) readyOpening();
  return () => {
    stop();
    if (navigationFrame) win.cancelAnimationFrame(navigationFrame);
    attributes.disconnect();
    doc.removeEventListener('dashboard:sectionchange', navigate);
    doc.removeEventListener('dashboard:ready', readyOpening);
    doc.removeEventListener('career:leadtypechange', navigate);
    doc.removeEventListener('click', disclosure);
    doc.removeEventListener('visibilitychange', cancelIfDisabled);
    preference.removeEventListener('change', cancelIfDisabled);
  };
}
