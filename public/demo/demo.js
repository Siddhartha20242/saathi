// Practice site helper. Nothing here is real.
//   ?v=2  renames the labels
//   ?v=3  renames the labels and the internal names of the controls
const v = new URLSearchParams(location.search).get('v');
if (v) {
  document.querySelectorAll('[data-v2]').forEach((el) => {
    el.textContent = el.dataset.v2;
  });
  if (v === '3') {
    document.querySelectorAll('[data-v3name]').forEach((el) => {
      el.name = el.dataset.v3name;
    });
  }
  // Keep the variant while moving between pages.
  document.querySelectorAll('a[href]').forEach((a) => {
    const u = new URL(a.getAttribute('href'), location.href);
    if (u.origin === location.origin) {
      u.searchParams.set('v', v);
      a.setAttribute('href', u.pathname + u.search);
    }
  });
  document.querySelectorAll('form').forEach((f) => {
    const hidden = document.createElement('input');
    hidden.type = 'hidden';
    hidden.name = 'v';
    hidden.value = v;
    f.append(hidden);
  });
}
