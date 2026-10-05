// This is the only script embedded in the reader. Never accept source script or eval messages.
export const POSITION_BRIDGE = String.raw`
(function () {
  'use strict';
  let ready = false;
  let engaged = false;
  let dirty = false;
  let timer = null;
  let epoch = 0;
  const root = document.getElementById('chapter');
  function send(message) {
    window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({
      session: CONFIG.session, chapterId: CONFIG.chapterId, contentHash: CONFIG.contentHash
    }, message)));
  }
  function maxScroll() { return Math.max(0, document.documentElement.scrollHeight - window.innerHeight); }
  function snapshot() {
    const visible = Array.from(root.querySelectorAll('[data-block]')).filter(function (element) {
      return element.getClientRects().length && element.getBoundingClientRect().height > 0;
    });
    const y = window.scrollY;
    let candidate = visible[0];
    // Prefer the deepest block intersecting the top reading line, then the next visible block.
    visible.forEach(function (element) {
      const rect = element.getBoundingClientRect();
      if (rect.top <= 2 && rect.bottom > 2) candidate = element;
    });
    if (!candidate || candidate.getBoundingClientRect().bottom <= 2) {
      candidate = visible.find(function (element) { return element.getBoundingClientRect().top >= 0; }) || visible[visible.length - 1];
    }
    if (!candidate) return null;
    return {
      chapterId: CONFIG.chapterId, contentHash: CONFIG.contentHash, blockId: candidate.id,
      offset: Math.max(0, -candidate.getBoundingClientRect().top),
      progression: maxScroll() ? Math.min(1, Math.max(0, y / maxScroll())) : 0,
      expandedSpoilers: Array.from(root.querySelectorAll('details[open]')).map(function (element) { return element.id; })
    };
  }
  function flush(reason) {
    if (timer) clearTimeout(timer);
    timer = null;
    if (!ready || !engaged || !dirty) return;
    const locator = snapshot();
    if (locator) send({ type: 'position', reason: reason, locator: locator });
    dirty = false;
  }
  function mark() {
    if (!ready || !engaged) return;
    dirty = true;
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () { flush('scroll'); }, 150);
  }
  function restore(locator) {
    if (!locator) { window.scrollTo(0, 0); return; }
    if (locator.contentHash === CONFIG.contentHash) {
      locator.expandedSpoilers.forEach(function (id) {
        const element = document.getElementById(id);
        if (element && element.tagName === 'DETAILS' && root.contains(element)) element.open = true;
      });
      const block = document.getElementById(locator.blockId);
      if (block && root.contains(block)) {
        let ancestor = block.parentElement;
        while (ancestor && ancestor !== root) {
          if (ancestor.tagName === 'DETAILS') {
            const summary = Array.from(ancestor.children).find(function (child) { return child.tagName === 'SUMMARY'; });
            if (!summary || !summary.contains(block)) ancestor.open = true;
          }
          ancestor = ancestor.parentElement;
        }
        const rect = block.getBoundingClientRect();
        window.scrollTo(0, Math.min(maxScroll(), window.scrollY + rect.top + Math.min(locator.offset, Math.max(0, rect.height - 1))));
        return;
      }
    }
    window.scrollTo(0, locator.progression * maxScroll());
  }
  function settle(locator) {
    const currentEpoch = ++epoch;
    ready = false;
    engaged = false;
    dirty = false;
    restore(locator);
    requestAnimationFrame(function () {
      restore(locator);
      requestAnimationFrame(function () {
        // Drain programmatic scroll/toggle events before admitting reading gestures.
        setTimeout(function () {
          if (currentEpoch !== epoch) return;
          ready = true;
          send({ type: 'ready' });
        }, 80);
      });
    });
  }
  function engage(event) { if (ready && event.isTrusted) engaged = true; }
  ['touchstart', 'pointerdown', 'wheel', 'keydown'].forEach(function (type) {
    document.addEventListener(type, engage, { passive: true });
  });
  window.addEventListener('scroll', mark, { passive: true });
  document.addEventListener('click', function (event) {
    const element = event.target instanceof Element ? event.target : event.target.parentElement;
    const anchor = element && element.closest('a');
    if (anchor) {
      event.preventDefault();
      if (ready && event.isTrusted && anchor.dataset.link) send({ type: 'link', linkId: anchor.dataset.link });
      return;
    }
    engage(event);
    if (element && element.closest('summary')) setTimeout(mark, 0);
  });
  document.addEventListener('visibilitychange', function () { if (document.hidden) flush('flush'); });
  window.addEventListener('pagehide', function () { flush('flush'); });
  window.StowawayReader = Object.freeze({
    flush: function () { flush('flush'); send({ type: 'flushed' }); },
    restyle: function (fontSize, theme) {
      if (!ready || !Number.isFinite(fontSize) || fontSize < 14 || fontSize > 32 ||
        (theme !== 'light' && theme !== 'dark')) return;
      const locator = snapshot();
      flush('flush');
      send({ type: 'layout-start' });
      document.documentElement.style.setProperty('--font-size', fontSize + 'px');
      document.documentElement.dataset.theme = theme;
      settle(locator);
    }
  });
  // A failed local image is a placeholder; it never initiates a remote retry.
  const images = Array.from(root.querySelectorAll('img'));
  function placeholder(image) {
    const text = document.createElement('span');
    text.textContent = '[Local image unavailable: ' + image.alt + ']';
    image.replaceWith(text);
  }
  images.forEach(function (image) { image.addEventListener('error', function () { placeholder(image); }); });
  function start() {
    images.forEach(function (image) { if (image.complete && !image.naturalWidth) placeholder(image); });
    settle(CONFIG.locator);
  }
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
})();
`;
