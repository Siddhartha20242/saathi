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
  // Long pages (an encyclopedia article has about 4,000 links) are read in full: checking them takes
  // milliseconds, and a control at the very bottom, such as a footer link, must still be findable.
  const MAX_CONTROLS = 6000;
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

  // Rotating banners move on by themselves, so a slide that is showing when the page is read can be gone a
  // moment later. Their links are not offered as controls to point at.
  const MOVING = /(^|\s)(slide|slides|slider|carousel|swiper-slide|slick-slide|owl-item|rotator|marquee)(\s|$)/i;
  function inMovingBanner(el) {
    for (let n = el, i = 0; n && n !== document.body && i < 6; n = n.parentElement, i++) {
      const cls = typeof n.className === 'string' ? n.className : '';
      if (MOVING.test(cls) || /carousel|slide/i.test(n.getAttribute?.('aria-roledescription') || '')) return true;
    }
    return false;
  }

  function isVisible(el) {
    if (inMovingBanner(el)) return false;
    const r = el.getBoundingClientRect();
    // A speck of a few pixels is not something a person can press. (A real government portal has an 8-pixel
    // link in the corner of the page with the same address as a menu item; the guide pointed at it.)
    const smallest = el.matches('input[type="checkbox"], input[type="radio"]') ? 8 : 12;
    if (r.width < smallest || r.height < smallest) return false;
    // Off to the side of the page (a skip link, an off-canvas menu) is not something a person can see.
    if (r.right <= 0 || r.left >= Math.max(innerWidth, document.documentElement.scrollWidth)) return false;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
    // Greyed out, or switched off by the page, is not a control to point at. (aria-hidden is not tested: some sites
    // put it on things people can see and use, and it only means "leave this out for screen readers".)
    if (el.matches(':disabled') || el.getAttribute('aria-disabled') === 'true') return false;
    if (el.closest('[inert]')) return false;
    return true;
  }

  // The account corner of a page (an avatar menu that shows who is signed in) carries a person's name as its
  // label. Only controls in the page header whose own markup says "user", "account" or "profile" are flagged.
  const ACCT = /(^|[\s_-])(user|account|profile|avatar|member|username|signed|loggedin|customer)([\s_-]|$)/i;
  function inAccountArea(el) {
    if (!el.closest('header, nav, [role="banner"], [role="navigation"]')) return false;
    for (let n = el, i = 0; n && i < 4; n = n.parentElement, i++) {
      const cls = typeof n.className === 'string' ? n.className : '';
      if (ACCT.test(`${n.id || ''} ${cls} ${n.getAttribute('aria-label') || ''} ${n.getAttribute('data-testid') || ''}`)) return true;
    }
    return false;
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
  // Only addresses that say something. A link to the site's front page, to this same page, or a
  // script ("javascript:void(0)") would match too many controls to be a useful anchor.
  const hrefOf = (el, role) => {
    if (role !== 'link' || !el.getAttribute('href')) return '';
    try {
      const u = new URL(el.getAttribute('href'), location.href);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
      if (u.pathname === '/' || u.pathname === location.pathname) return '';
      return u.pathname.slice(0, 120);
    } catch {
      return '';
    }
  };
  // An internal name is only useful if it stays the same. Names that change on every page load
  // (generated by a framework) or contain long numbers are left out.
  const nameOf = (el) => {
    const name = clean(el.getAttribute('name') || el.id).slice(0, 60);
    return /radix|_R_|^:r|\d{4,}/i.test(name) ? '' : name;
  };

  let scanCount = 0;
  let scanId = '';
  let indexByKey = new Map(); // the position in the list of each label, so a repeated one can still be placed

  function scan() {
    const sectionOf = sectionFinder();
    const seen = new Map(); // key -> the element's entry, so a repeated label can be counted
    indexByKey = new Map();
    scanId = `${Date.now().toString(36)}-${++scanCount}`;
    lastScan = [];
    const elements = [];
    let truncated = false;
    for (const el of document.querySelectorAll(SELECTOR)) {
      if (elements.length >= MAX_CONTROLS) {
        truncated = true;
        break;
      }
      if (el.closest('[data-saathi]') || !isVisible(el) || el.disabled) continue;
      const role = roleOf(el);
      if (!role) continue;
      const text = labelOf(el, role);
      if (!text) continue;
      const section = sectionOf(el);
      // Two links with the same label under the same heading but different addresses are different controls
      // (three rows that each say "Edit"), so the address is part of the key. Same label and same address
      // is the same destination shown twice (a logo and a menu entry), listed once.
      const key = `${role}|${text}|${section}|${hrefOf(el, role)}`;
      if (seen.has(key)) {
        // The same label again under the same heading (three rows that each say "Edit"). It is listed once, and
        // marked, so the guide knows the label alone does not say which one it is and will not guess.
        seen.get(key).dups = (seen.get(key).dups ?? 1) + 1;
        continue;
      }
      indexByKey.set(key, lastScan.length);
      lastScan.push(el);
      const r = el.getBoundingClientRect();
      const inView = r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
      const entry = { role, text, section, href: hrefOf(el, role), name: nameOf(el), inView, acct: inAccountArea(el) };
      seen.set(key, entry);
      elements.push(entry);
    }
    return { scanId, title: clean(document.title), host: location.hostname, path: location.pathname, truncated, elements };
  }

  // ---------- Highlight ----------

  let box = null;
  let timer = null;
  let pressedAbort = null;

  function highlight(index, stepIndex, wantedScan) {
    // An index means something only for the scan it came from. After another scan, or in another tab, it would
    // point at a different control while the panel still names the old one.
    if (wantedScan && wantedScan !== scanId) return { error: 'The page changed since it was read. Try again.' };
    const el = lastScan[index];
    if (!el || !el.isConnected) return { error: 'That control is no longer on the page. Try again.' };
    // A slide in a rotating banner can be showing when the page is read and hidden a moment later. Outlining the
    // corner of the page where it used to be would mislead, so say so instead.
    if (!isVisible(el)) return { error: 'That control is not showing on the page right now. Try again.' };
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
      // If the control disappears (a banner slide moves on), hide the outline until it is back.
      box.style.display = r.width < 4 || r.height < 4 ? 'none' : '';
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
    scan(); // refreshes the list so the control's position on the page can be noted
    const text = labelOf(el, role);
    const section = sectionFinder()(el);
    const found = lastScan.indexOf(el);
    const step = {
      // A control that was collapsed into an earlier one with the same label is placed where that one is.
      at: Math.max(0, found >= 0 ? found : indexByKey.get(`${role}|${text}|${section}|${hrefOf(el, role)}`) ?? 0),
      role,
      text,
      section,
      page: location.pathname,
      href: hrefOf(el, role),
      name: nameOf(el),
      acct: inAccountArea(el),
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

  // The scam guard (guard-bundle.js, loaded just before this script) watches the page for scams.
  window.__saathiGuard?.start(chrome);

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.saathi === 'scan') sendResponse(scan());
    else if (msg?.saathi === 'highlight') sendResponse(highlight(msg.index, msg.stepIndex, msg.scanId));
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
