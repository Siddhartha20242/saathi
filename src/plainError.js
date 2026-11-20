// Turns a technical error into one plain sentence for the person. The raw error is kept in the browser console.

export function plainError(err) {
  const m = `${err?.name ?? ''} ${err?.code ?? ''} ${err?.message ?? err ?? ''}`;
  if (/\b429\b|quota|rate.?limit|resource.?exhausted|too many requests/i.test(m)) {
    return "Saathi's free limit for today is used up. Try again tomorrow, or ask your family.";
  }
  if (/app.?check|token.*invalid|\b401\b/i.test(m)) return 'Saathi could not confirm this device. Reload the page and try again.';
  if (/permission.?denied|insufficient permissions|missing or insufficient|\b403\b/i.test(m)) {
    return 'That did not work. Check the family code, or ask your family.';
  }
  if (/offline|network|failed to fetch|unavailable|no internet|load failed/i.test(m)) return 'No internet right now. Check the connection and try again.';
  if (/timed? ?out|took too long|timeout/i.test(m)) return 'That took too long. Try again.';
  return 'Something went wrong. Try again, or ask your family.';
}
