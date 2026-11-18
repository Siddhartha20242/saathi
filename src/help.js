// "I'm stuck" help: the person sends the names of the buttons and boxes on their page to a helper's
// phone. The helper taps the right one and it lights up on the person's screen.
// Only labels travel. A page is never sent as a picture or as text, and nothing typed is read.

import { maskText, isPersonalControl, isPersonalText } from './masking.js';

export const MAX_HELP_CONTROLS = 100;
export const MAX_NOTE = 100;

/**
 * The controls to share. On a long page these are the controls on screen (what the person is looking
 * at), up to `max`, in page order; on a short page, all of them. Each carries `at`, its position in the
 * scan, so the helper's tap maps back to the same control. A label that holds a personal detail
 * (a name, number or address) is left out.
 */
export function controlsForHelp(elements, max = MAX_HELP_CONTROLS) {
  const wanted = [];
  if (elements.length <= max) elements.forEach((e, at) => wanted.push({ e, at }));
  else {
    const onScreen = elements.map((e, at) => ({ e, at })).filter(({ e }) => e.inView);
    (onScreen.length ? onScreen : elements.map((e, at) => ({ e, at }))).slice(0, max).forEach((x) => wanted.push(x));
  }
  return wanted.map(({ e, at }) => {
    const text = String(e.text ?? '').slice(0, 80);
    const personal = isPersonalControl(text, e.acct);
    const section = String(e.section ?? '').slice(0, 80);
    return { at, role: String(e.role ?? 'button'), text: personal ? '' : text, section: isPersonalText(section) ? '' : section, personal };
  });
}

/** Controls grouped under their headings, keeping each control's position for the tap. */
export function groupBySection(controls) {
  const groups = [];
  const byName = new Map();
  controls.forEach((c, index) => {
    const name = c.section || 'This page';
    if (!byName.has(name)) {
      const group = { section: name, items: [] };
      byName.set(name, group);
      groups.push(group);
    }
    byName.get(name).items.push({ index, role: c.role, text: c.text, personal: Boolean(c.personal) });
  });
  return groups;
}

const KIND = { button: 'Button', link: 'Link', field: 'Box to type in', select: 'List', checkbox: 'Tick box' };
export const kindWord = (role) => KIND[role] ?? 'Button';

/** What the person is told before anything is sent. */
export function helpPreview(controls, host) {
  const hidden = controls.filter((c) => c.personal).length;
  return `${controls.length} names of buttons and boxes from ${host}${
    hidden ? ` (${hidden} with personal details left out)` : ''
  }. Anything you typed: none. Pictures of the page: none.`;
}

/** The page title sent with a help request. A title can hold an email address or a name ("Inbox (ram@gmail.com)"). */
export const cleanTitle = (title, host) => {
  const t = String(title ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
  return t && !isPersonalText(t) ? t : String(host ?? '').slice(0, 80);
};

export const cleanNote = (note) => String(note ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NOTE);

/** An open request that has not run out of time. */
export function isLive(request, now = Date.now()) {
  if (!request || request.status === 'closed') return false;
  const ms = request.expiresAt?.toMillis?.() ?? request.expiresAt?.seconds * 1000 ?? Infinity;
  return !(ms < now);
}
