/* Presentation only: no data requests, numeric tweening, or map mutations. */
const root = document.body;
const preference = matchMedia('(prefers-reduced-motion: reduce)');
const storageKey = 'brians-dash-motion';
let savedPreference;
try { savedPreference = localStorage.getItem(storageKey); } catch { /* Storage is optional. */ }

function syncMotion() {
  if (preference.matches) root.classList.add('no-motion');
  const enabled = !root.classList.contains('no-motion');
  for (const id of ['motionBtn', 'globalMotionBtn']) {
    const button = document.getElementById(id);
    if (!button) continue;
    button.textContent = enabled ? 'Motion on' : 'Motion off';
    button.setAttribute('aria-pressed', String(enabled));
    button.title = preference.matches ? 'Reduced motion is enabled in your device settings' : 'Toggle dashboard animations';
  }
}
if (savedPreference === 'off' || preference.matches) root.classList.add('no-motion');
syncMotion();
document.getElementById('motionBtn')?.addEventListener('click', () => {
  syncMotion();
  if (!preference.matches) {
    savedPreference = root.classList.contains('no-motion') ? 'off' : 'on';
    try { localStorage.setItem(storageKey, savedPreference); } catch { /* Optional. */ }
  }
});
preference.addEventListener('change', () => {
  root.classList.toggle('no-motion', preference.matches || savedPreference === 'off');
  syncMotion();
});
document.addEventListener('visibilitychange', () => root.classList.toggle('nd-page-hidden', document.hidden));
root.classList.toggle('nd-page-hidden', document.hidden);

const ambient = document.createElement('div');
ambient.className = 'nd-ambient';
ambient.setAttribute('aria-hidden', 'true');
ambient.innerHTML = `<i></i><i></i><svg viewBox="0 0 1440 1000" preserveAspectRatio="xMidYMid slice" focusable="false">
  <path d="M-100 760 C240 200 430 950 850 510 S1270 120 1570 400"/>
  <path d="M-100 790 C240 230 430 980 850 540 S1270 150 1570 430"/>
  <path class="nd-ribbon-light" d="M-100 760 C240 200 430 950 850 510 S1270 120 1570 400"/>
  <path class="nd-ribbon-light nd-ribbon-pink" d="M-100 790 C240 230 430 980 850 540 S1270 150 1570 430"/>
</svg>`;
root.prepend(ambient);

// Observe only dashboard-owned shells and charts. Content is always readable
// without JS/IntersectionObserver; offscreen charts reveal when first reached.
const charts = '.pc-chart-grid svg, .pc-donut, .pc-legend';
const surfaces = '.metric, .pc-metrics article, .retro-brief, .command-panel, brians-career-board';
const selector = `${surfaces}, .pd-panel, .panel, .pd-mini, .contact-card, .event-card, ${charts}, #momentum svg, .fill`;
const mapSelector = '.geo-root, #geoCanvas, #geoMap, .maplibregl-map, .leaflet-container, canvas';
const observed = new WeakSet();
const entered = new WeakSet();
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    let stagger = 0;
    for (const {target, isIntersecting} of entries) {
      const continuous = target.matches(surfaces);
      if (continuous) target.classList.toggle('nd-visible', isIntersecting);
      if (!isIntersecting || entered.has(target)) continue;
      entered.add(target);
      if (!target.matches('brians-career-board')) {
        target.style.setProperty('--nd-delay', `${Math.min(stagger++ * 20, 60)}ms`);
        target.classList.add('nd-enter');
      }
      // One-shot reveals need no further scroll/intersection callbacks.
      if (!continuous) { observer.unobserve(target); observed.delete(target); }
    }
  }, {threshold: 0});
  const scan = node => {
    if (!(node instanceof Element) || node.closest(mapSelector)) return;
    const candidates = [...(node.matches(selector) ? [node] : []), ...node.querySelectorAll(selector)];
    for (const el of candidates) {
      if (observed.has(el) || entered.has(el) || el.matches('.pd-daily-briefing') || el.closest(mapSelector) || el.querySelector(`${mapSelector}, #portfolioVisuals`)) continue;
      observed.add(el);
      observer.observe(el);
    }
  };
  const main = document.querySelector('main');
  scan(main);
  // Coalesce render bursts into a single frame, skipping nested roots already
  // covered by their parent. The map's changing DOM never enters this queue.
  const pending = new Set();
  let frame = 0, replayCharts = false;
  function flush() {
    frame = 0;
    const roots = [...pending].filter(node => node.isConnected);
    pending.clear();
    for (const node of roots) if (!roots.some(other => other !== node && other.contains(node))) scan(node);
    if (replayCharts) {
      replayCharts = false;
      for (const chart of document.querySelectorAll(`#personalView :is(${charts})`)) {
        entered.delete(chart);
        chart.classList.remove('nd-enter');
        observer.unobserve(chart);
        observed.add(chart);
        // Re-observing lets below-the-fold charts wait until actually visible;
        // the next intersection delivery restarts CSS without a forced reflow.
        observer.observe(chart);
      }
    }
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(flush); };
  document.addEventListener('dashboard:sectionchange', event => {
    if (event.detail?.section === 'investments') { replayCharts = true; schedule(); }
  });
  if (main) new MutationObserver(records => {
    for (const record of records) {
      if (record.target instanceof Element && record.target.closest(mapSelector)) continue;
      for (const node of record.addedNodes) if (node instanceof Element) pending.add(node);
      // Unsubscribe detached render output instead of retaining old card trees.
      for (const node of record.removedNodes) {
        if (!(node instanceof Element) || node.isConnected) continue;
        for (const el of [node, ...node.querySelectorAll(selector)]) {
          observer.unobserve(el);
          observed.delete(el);
        }
      }
    }
    if (pending.size) schedule();
  }).observe(main, {childList: true, subtree: true});
}
