// Runs in the open web page. It does four things when the side panel asks:
//   scan        - list the page's controls (kind, label, nearest heading, link address, internal name)
//   highlight   - outline one of them, and tell the panel when it is pressed
//   recordStart - report each control the helper presses or clicks into
//   recordStop  - stop reporting
// It never reads what is typed into a field, and it never clicks or submits anything.

(() => {
  if (window.__saathiLoaded) return;
  window.__saathiLoaded = true;

  const SELECTOR =
    'a[href], button, input, select, textarea, summary, [role="button"], [role="link"], [role="tab"], [role="menuitem"]';
  const MAX_CONTROLS = 150;
  let lastScan = [];
  let recording = false;

  const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const tell = (message) => {
    try {
      chrome.runtime.sendMessage(message, () => void chrome.runtime.lastError);
    } catch {
      // the panel is closed
    }
  };

  function isVisible(el) {
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    const s = getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
  }

  function roleOf(el) {
    const tag = el.tagName.toLowerCase();
    const type = (el.getAttribute('type') || '').toLowerCase();
    if (tag === 'a' || el.getAttribute('role') === 'link') return 'link';
    if (tag === 'select') return 'select';
    if (tag === 'textarea') return 'field';
    if (tag === 'input') {
      if (type === 'hidden') return null;
      if (['submit', 'button', 'reset', 'image'].includes(type)) return 'button';
      if (['checkbox', 'radio'].includes(type)) return 'checkbox';
      return 'field';
    }
    return 'button';
  }

  // Text of a <label> without the text of any control nested inside it.
  function labelText(label) {
    const copy = label.cloneNode(true);
    copy.querySelectorAll('select, input, textarea, button').forEach((n) => n.remove());
    return clean(copy.textContent);
  }

  function labelOf(el, role) {
    const aria = clean(el.getAttribute('aria-label'));
    if (aria) return aria;
    const ids = el.getAttribute('aria-labelledby');
    if (ids) {
      const text = clean(ids.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' '));
      if (text) return text;
    }
    if (role === 'field' || role === 'select' || role === 'checkbox') {
      // Labels and hints only. The field's value is never read.
      if (el.labels?.length) {
        const text = labelText(el.labels[0]);
        if (text) return text;
      }
      return clean(el.getAttribute('placeholder')) || clean(el.getAttribute('title')) || clean(el.getAttribute('name'));
    }
    const tag = el.tagName.toLowerCase();
    if (tag === 'input') return clean(el.value) || clean(el.getAttribute('title')) || clean(el.getAttribute('alt'));
    return clean(el.innerText) || clean(el.getAttribute('title')) || clean(el.querySelector('img[alt]')?.getAttribute('alt'));
  }

  function sectionFinder() {
    const headings = [...document.querySelectorAll('h1, h2, h3, h4, legend, [role="heading"]')].filter(isVisible);
    return (el) => {
      if (el.closest('nav, header, [role="navigation"], [role="banner"]')) return 'Menu';
      if (el.closest('footer, [role="contentinfo"]')) return 'Footer';
      let found = '';
      for (const h of headings) {
        // Stop at the first heading that comes after the control.
        if (h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING) break;
        found = clean(h.textContent);
      }
      return found;
    };
  }

  // Where a link goes (path only) and the control's internal name. Neither holds anything typed.
  const hrefOf = (el, role) => {
    if (role !== 'link' || !el.getAttribute('href')) return '';
    try {
      return new URL(el.getAttribute('href'), location.href).pathname.slice(0, 120);
    } catch {
      return '';
    }
  };
  const nameOf = (el) => clean(el.getAttribute('name') || el.id).slice(0, 60);

  function scan() {
    const sectionOf = sectionFinder();
    const seen = new Set();
    lastScan = [];
    const elements = [];
    for (const el of document.querySelectorAll(SELECTOR)) {
      if (elements.length >= MAX_CONTROLS) break;
      if (el.closest('[data-saathi]') || !isVisible(el) || el.disabled) continue;
      const role = roleOf(el);
      if (!role) continue;
      const text = labelOf(el, role);
      if (!text) continue;
      const section = sectionOf(el);
      const key = `${role}|${text}|${section}`;
      if (seen.has(key)) continue; // the same link repeated in a menu is listed once
      seen.add(key);
      lastScan.push(el);
      elements.push({ role, text, section, href: hrefOf(el, role), name: nameOf(el) });
    }
    return { title: clean(document.title), host: location.hostname, path: location.pathname, elements };
  }

  // ---------- Highlight ----------

  let box = null;
  let timer = null;
  let pressedAbort = null;

  function highlight(index, stepIndex) {
    const el = lastScan[index];
    if (!el || !el.isConnected) return { error: 'That control is no longer on the page. Try again.' };
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });

    box?.remove();
    clearInterval(timer);
    pressedAbort?.abort();
    box = document.createElement('div');
    box.setAttribute('data-saathi', 'highlight');
    Object.assign(box.style, {
      position: 'fixed',
      zIndex: '2147483647',
      pointerEvents: 'none',
      border: '4px solid #e0a11b',
      borderRadius: '8px',
      boxShadow: '0 0 0 4px rgba(224,161,27,0.35), 0 0 0 9999px rgba(0,0,0,0.25)',
      transition: 'all 120ms ease-out',
    });
    document.documentElement.append(box);

    const place = () => {
      if (!el.isConnected) return stop();
      const r = el.getBoundingClientRect();
      Object.assign(box.style, {
        left: `${r.left - 6}px`,
        top: `${r.top - 6}px`,
        width: `${r.width + 12}px`,
        height: `${r.height + 12}px`,
      });
    };
    const stop = () => {
      clearInterval(timer);
      box?.remove();
      box = null;
    };
    place();
    timer = setInterval(place, 100);
    setTimeout(stop, 20000);

    // Tell the panel when the person presses it, so it can move on. Fields and lists wait for "Next".
    const role = roleOf(el);
    if (stepIndex !== undefined && (role === 'button' || role === 'link' || role === 'checkbox')) {
      pressedAbort = new AbortController();
      el.addEventListener(
        'click',
        () => {
          stop();
          tell({ saathi: 'clicked', stepIndex });
        },
        { capture: true, once: true, signal: pressedAbort.signal },
      );
    }

    // Is something on top of it, such as a pop-up notice? (Checked where the control is now.)
    const r = el.getBoundingClientRect();
    const inView = r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth;
    let covered = false;
    if (inView) {
      box.style.display = 'none';
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      box.style.display = '';
      covered = Boolean(top) && top !== el && !el.contains(top) && !top.contains(el);
    }
    return { ok: true, covered };
  }

  // ---------- Recording ----------

  function report(el, role) {
    const step = {
      role,
      text: labelOf(el, role),
      section: sectionFinder()(el),
      page: location.pathname,
      href: hrefOf(el, role),
      name: nameOf(el),
    };
    tell({ saathi: 'recorded', step });
  }

  const controlOf = (target) => target?.closest?.(SELECTOR) ?? null;
  let lastFocused = null;

  addEventListener(
    'click',
    (ev) => {
      if (!recording) return;
      const el = controlOf(ev.target);
      if (!el || el.closest('[data-saathi]') || !isVisible(el)) return;
      const role = roleOf(el);
      // Boxes and lists are recorded when focused, not when clicked.
      if (role && role !== 'field' && role !== 'select') report(el, role);
    },
    true,
  );

  addEventListener(
    'focusin',
    (ev) => {
      if (!recording) return;
      const el = ev.target;
      if (!el?.matches?.('input, select, textarea') || el === lastFocused) return;
      const role = roleOf(el);
      if (role === 'field' || role === 'select') {
        lastFocused = el;
        report(el, role);
      }
    },
    true,
  );

  // A page loaded while the helper is recording: ask the panel whether to keep recording.
  try {
    chrome.runtime.sendMessage({ saathi: 'hello' }, (res) => {
      void chrome.runtime.lastError;
      if (res?.recording) recording = true;
    });
  } catch {
    // the panel is closed
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.saathi === 'scan') sendResponse(scan());
    else if (msg?.saathi === 'highlight') sendResponse(highlight(msg.index, msg.stepIndex));
    else if (msg?.saathi === 'recordStart') {
      recording = true;
      lastFocused = null;
      sendResponse({ ok: true });
    } else if (msg?.saathi === 'recordStop') {
      recording = false;
      sendResponse({ ok: true });
    }
    return false;
  });
})();
