// This is the only script embedded in the reader. Never accept source script or eval messages.
export const POSITION_BRIDGE = String.raw`
(function () {
  'use strict';
  let ready = false;
  let interactionEnabled = true;
  let engaged = false;
  let dirty = false;
  let timer = null;
  let epoch = 0;
  let readEndSent = false;
  let readingGesture = null;
  const root = document.getElementById('chapter');
  // Index static content once. Text/inline media belong to their nearest block;
  // broad wrappers containing only other blocks have no reading content of their own.
  const readingBlocks = [];
  function collectReadingBlocks(node, owner) {
    if (node.nodeType === 3) {
      if (owner && node.textContent.trim()) owner.content.push(node);
      return;
    }
    if (node.nodeType !== 1) return;
    if (node.hasAttribute('data-block')) {
      if (owner) owner.nested = true;
      owner = { element: node, content: [], nested: false };
      readingBlocks.push(owner);
    }
    if (owner && (node.tagName === 'IMG' || node.tagName === 'HR')) owner.content.push(node);
    Array.from(node.childNodes).forEach(function (child) { collectReadingBlocks(child, owner); });
  }
  collectReadingBlocks(root, null);
  function send(message) {
    window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({
      session: CONFIG.session, chapterId: CONFIG.chapterId, contentHash: CONFIG.contentHash
    }, message)));
  }
  function maxScroll() { return Math.max(0, document.documentElement.scrollHeight - window.innerHeight); }
  // Completion is a live-layout observation, never a locator/progression guess.
  // A scroll needs a recent trusted scrolling input with unchanged geometry.
  function readEnd() {
    if (!ready || !interactionEnabled || readEndSent || maxScroll() - window.scrollY > 24) return;
    readEndSent = true;
    readingGesture = null;
    send({ type: 'read-end' });
  }
  function invalidateGesture() { readingGesture = null; }
  function readingInput(event) {
    if (!ready || !interactionEnabled || !event.isTrusted || readEndSent || !root.contains(event.target)) return;
    const element = event.target instanceof Element ? event.target : event.target.parentElement;
    // Following links and changing spoiler geometry are separate deliberate actions.
    if (element && element.closest('a, summary')) { invalidateGesture(); return; }
    if (event.type === 'keydown' && !['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'End', 'Home', ' '].includes(event.key)) return;
    if (['touchmove', 'wheel', 'keydown'].includes(event.type)) {
      readingGesture = { height: document.documentElement.scrollHeight, viewport: window.innerHeight,
        expires: performance.now() + 1200 };
    }
    readEnd();
  }
  function readingScroll() {
    if (!readingGesture || performance.now() > readingGesture.expires ||
      readingGesture.height !== document.documentElement.scrollHeight || readingGesture.viewport !== window.innerHeight) {
      invalidateGesture(); return;
    }
    readEnd();
  }
  function snapshot() {
    const y = window.scrollY;
    let intersecting = null, next = null, previous = null;
    readingBlocks.forEach(function (block) {
      const element = block.element;
      if (!block.content.length || !element.getClientRects().length) return;
      const bounds = element.getBoundingClientRect();
      if (bounds.height <= 0) return;
      // A mixed container remains eligible at its OWN text, not at a gap inside
      // its child blocks. Leaf prose/images need only one bounding-box read.
      const rects = block.nested ? block.content.flatMap(function (node) {
        if (node.nodeType === 1) return Array.from(node.getClientRects());
        const range = document.createRange();
        range.selectNodeContents(node);
        return Array.from(range.getClientRects());
      }) : [bounds];
      rects.forEach(function (rect) {
        if (rect.height <= 0) return;
        const sample = { element: element, rect: rect };
        if (rect.top <= 2 && rect.bottom > 2) intersecting = sample;
        else if (rect.top > 2 && (!next || rect.top < next.rect.top)) next = sample;
        else if (rect.bottom <= 2 && (!previous || rect.bottom >= previous.rect.bottom)) previous = sample;
      });
    });
    const selected = intersecting || next || previous;
    if (!selected) return null;
    const candidate = selected.element;
    return {
      chapterId: CONFIG.chapterId, contentHash: CONFIG.contentHash, blockId: candidate.id,
      offset: Math.max(0, (selected === next ? selected.rect.top : 0) - candidate.getBoundingClientRect().top),
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
    if (!ready || !interactionEnabled || !engaged) return;
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
    invalidateGesture();
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
  function engage(event) { if (ready && interactionEnabled && event.isTrusted) engaged = true; }
  ['touchstart', 'pointerdown', 'wheel', 'keydown'].forEach(function (type) {
    document.addEventListener(type, engage, { passive: true });
  });
  ['touchmove', 'touchend', 'wheel', 'keydown', 'click'].forEach(function (type) {
    document.addEventListener(type, readingInput, { passive: true });
  });
  window.addEventListener('scroll', mark, { passive: true });
  window.addEventListener('scroll', readingScroll, { passive: true });
  window.addEventListener('resize', invalidateGesture, { passive: true });
  document.addEventListener('click', function (event) {
    const element = event.target instanceof Element ? event.target : event.target.parentElement;
    const anchor = element && element.closest('a');
    if (anchor) {
      event.preventDefault();
      if (ready && interactionEnabled && event.isTrusted && anchor.dataset.link) send({ type: 'link', linkId: anchor.dataset.link });
      return;
    }
    engage(event);
    if (element && element.closest('summary')) setTimeout(mark, 0);
  });
  document.addEventListener('visibilitychange', function () { if (document.hidden) flush('flush'); });
  window.addEventListener('pagehide', function () { flush('flush'); });
  window.StowawayReader = Object.freeze({
    setInteractionEnabled: function (enabled) { interactionEnabled = enabled === true; invalidateGesture(); },
    prepareForExit: function (handoffId) {
      if (typeof handoffId !== 'string' || !/^[A-Za-z0-9:-]{1,100}$/.test(handoffId)) return;
      interactionEnabled = false;
      invalidateGesture();
      flush('flush');
      // Earlier messages and this acknowledgement use the same ordered bridge.
      send({ type: 'quiesced', handoffId: handoffId });
    },
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
  images.forEach(function (image) {
    image.addEventListener('load', invalidateGesture);
    image.addEventListener('error', function () { invalidateGesture(); placeholder(image); });
  });
  function start() {
    images.forEach(function (image) { if (image.complete && !image.naturalWidth) placeholder(image); });
    settle(CONFIG.locator);
  }
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
})();
`;
