// Explaining a page in plain words. Only the page's title and control labels go into the prompt,
// never anything typed into a field. That makes it safe to let the cloud answer when this laptop
// has no on-device model, so this is the one task that runs in "prefer on-device" mode.

const MAX_CONTROLS = 60;

export function explainPrompt(page, max = MAX_CONTROLS) {
  const list = page.elements
    .slice(0, max)
    .map((e) => `- ${e.role}: ${e.text}${e.section ? ` (under "${e.section}")` : ''}`)
    .join('\n');
  return `A person who is not used to computers has opened a web page. Explain it to them.

Page title: ${page.title || 'unknown'}
Buttons, links and fields on the page:
${list}

In two or three short sentences, say what this page is for and what it is asking the person to do.
Use simple everyday words. Mention only things that are in the list above. Do not give advice about what to choose.`;
}

/** What would be sent if the cloud answered: counts only, for the privacy line shown to the person. */
export function explainPayloadSummary(page, max = MAX_CONTROLS) {
  return { labels: Math.min(page.elements.length, max), typedValues: 0 };
}
