// "I'm stuck" help: the person sends the names of the buttons and boxes on their page to a helper's
// phone. The helper taps the right one and it lights up on the person's screen.
// Only labels travel. A page is never sent as a picture or as text, and nothing typed is read.

import { maskText } from './masking.js';

export const MAX_HELP_CONTROLS = 100;
export const MAX_NOTE = 100;

/**
 * The controls to share, in the same order as the scan so a helper's tap maps back to the same
 * control. A label that holds a personal detail (a name, number or address) is left out.
 */
export function controlsForHelp(elements, max = MAX_HELP_CONTROLS) {
  return elements.slice(0, max).map((e) => {
    const text = String(e.text ?? '').slice(0, 80);
    const personal = text !== '' && maskText(text).items.length > 0;
    return { role: String(e.role ?? 'button'), text: personal ? '' : text, section: String(e.section ?? '').slice(0, 80), personal };
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

export const cleanNote = (note) => String(note ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NOTE);

/** An open request that has not run out of time. */
export function isLive(request, now = Date.now()) {
  if (!request || request.status === 'closed') return false;
  const ms = request.expiresAt?.toMillis?.() ?? request.expiresAt?.seconds * 1000 ?? Infinity;
  return !(ms < now);
}
