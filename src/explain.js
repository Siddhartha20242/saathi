// Explaining a page in plain words. Only the page's title and control labels go into the prompt,
// never anything typed into a field. That makes it safe to let the cloud answer when this laptop
// has no on-device model, so this is the one task that runs in "prefer on-device" mode.

import { isPersonalControl, isPersonalText } from './masking.js';

const MAX_CONTROLS = 60;

/** The controls to describe: those on screen first, since that is what the person is looking at. */
export function forPrompt(page, max = MAX_CONTROLS) {
  const seen = page.elements.filter((e) => e.inView);
  return (seen.length ? seen : page.elements).slice(0, max);
}

export function explainPrompt(page, max = MAX_CONTROLS) {
  // A label or heading that holds a name or number, or a title with an email address, is not sent.
  const title = page.title && !isPersonalText(page.title) ? page.title : 'unknown';
  const list = forPrompt(page, max)
    .map((e) => {
      const text = isPersonalControl(e.text, e.acct) ? 'a label with personal details (left out)' : e.text;
      const section = e.section && !isPersonalText(e.section) ? ` (under "${e.section}")` : '';
      return `- ${e.role}: ${text}${section}`;
    })
    .join('\n');
  return `A person who is not used to computers has opened a web page. Explain it to them.

Page title: ${title}
Buttons, links and fields on the page:
${list}

In two or three short sentences, say what this page is for and what it is asking the person to do.
Use simple everyday words. Mention only things that are in the list above. Do not give advice about what to choose.`;
}

/** What would be sent if the cloud answered: counts only, for the privacy line shown to the person. */
export function explainPayloadSummary(page, max = MAX_CONTROLS) {
  const shown = forPrompt(page, max);
  return { labels: shown.length, hidden: shown.filter((e) => isPersonalControl(e.text, e.acct) || isPersonalText(e.section ?? '')).length, typedValues: 0 };
}
