// Checks the Firestore security rules against the live project, with two different anonymous users.
//
// How to run: open https://paperwork-decoder.web.app/panel.html in Chrome, open the browser console,
// paste this whole file and press Enter, then read `window.__R` once it finishes (a few seconds).
// It uses a test group (ZZTEST22) and deletes what it creates. Expected: every line starts with "ok".

window.__R = null;
window.__err = null;

(async () => {
  try {
    const u1 = window.__saathi.user; // the panel's own anonymous user
    const tok1 = await u1.getIdToken();
    // A second, separate anonymous user, so "someone else" is a real different account.
    const su = await (
      await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${u1.auth.config.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnSecureToken: true }),
      })
    ).json();
    const tok2 = su.idToken;
    const uid1 = u1.uid;
    const uid2 = su.localId;

    const DB = 'projects/paperwork-decoder/databases/(default)/documents';
    // Plain values to Firestore's typed REST format.
    const v = (x) =>
      x === null ? { nullValue: null }
      : x && x.__ts ? { timestampValue: x.__ts }
      : typeof x === 'string' ? { stringValue: x }
      : typeof x === 'number' ? { integerValue: String(x) }
      : Array.isArray(x) ? { arrayValue: { values: x.map(v) } }
      : typeof x === 'object' ? { mapValue: { fields: Object.fromEntries(Object.entries(x).map(([k, y]) => [k, v(y)])) } }
      : { booleanValue: x };
    const fields = (o) => Object.fromEntries(Object.entries(o).map(([k, y]) => [k, v(y)]));

    const commit = async (tok, writes) =>
      (
        await fetch(`https://firestore.googleapis.com/v1/${DB}:commit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
          body: JSON.stringify({ writes }),
        })
      ).status;
    const create = (path, body, tok = tok1) =>
      commit(tok, [{
        update: { name: `${DB}/${path}`, fields: fields(body) },
        updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
        currentDocument: { exists: false },
      }]);
    const update = (path, body, mask, tok) =>
      commit(tok, [{
        update: { name: `${DB}/${path}`, fields: fields(body) },
        updateMask: { fieldPaths: mask },
        currentDocument: { exists: true },
      }]);
    const del = (path, tok) => commit(tok, [{ delete: `${DB}/${path}` }]);
    const read = async (path, tok) =>
      (await fetch(`https://firestore.googleapis.com/v1/${DB}/${path}`, { headers: tok ? { Authorization: `Bearer ${tok}` } : {} })).status;

    const R = [];
    const t = (name, got, want) => R.push({ name, got, want, ok: got === want });
    const G = 'ZZTEST22';
    const ts = () => ({ __ts: new Date(Date.now() + 3600e3).toISOString() });
    const controls = [
      { role: 'button', text: 'A', section: 'x', personal: false },
      { role: 'link', text: 'B', section: 'x', personal: false },
    ];

    // Live help requests.
    const H = `groups/${G}/help/`;
    const help = (over = {}) => ({ title: 'Test', host: 'a.example', controls, pick: null, note: '', status: 'open', createdBy: uid1, expiresAt: ts(), ...over });
    const answer = ['pick', 'note', 'status'];
    t('help: valid create by user 1', await create(`${H}h1`, help()), 200);
    t('help: create with an extra field is refused', await create(`${H}h2`, help({ extra: 'x' })), 403);
    t('help: create naming someone else as creator is refused', await create(`${H}h3`, help({ createdBy: uid2 })), 403);
    t('help: create with a pick already set is refused', await create(`${H}h4`, help({ pick: 0 })), 403);
    t('help: create already closed is refused', await create(`${H}h5`, help({ status: 'closed' })), 403);
    t('help: create with a note is refused', await create(`${H}h6`, help({ note: 'hi' })), 403);
    t('help: another user may set pick, note, status', await update(`${H}h1`, { pick: 1, note: 'the second one', status: 'answered' }, answer, tok2), 200);
    t('help: another user changing the controls is refused', await update(`${H}h1`, { controls: [{ role: 'button', text: 'Z', section: '', personal: false }] }, ['controls'], tok2), 403);
    t('help: pick outside the list is refused', await update(`${H}h1`, { pick: 5, note: '', status: 'answered' }, answer, tok2), 403);
    t('help: note over 100 characters is refused', await update(`${H}h1`, { pick: 0, note: 'x'.repeat(101), status: 'answered' }, answer, tok2), 403);
    t('help: setting status back to open is refused', await update(`${H}h1`, { pick: 0, note: '', status: 'open' }, answer, tok2), 403);
    t('help: another user deleting is refused', await del(`${H}h1`, tok2), 403);
    t('help: reading without signing in is refused', await read(`${H}h1`, null), 403);
    t('help: a group code of the wrong length is refused', await read('groups/SHORT/help/h1', tok1), 403);
    t('help: the creator deleting works', await del(`${H}h1`, tok1), 200);

    // Scam alerts.
    const A = `groups/${G}/alerts/`;
    const alert = (over = {}) => ({ host: 'fake.example', brand: 'Some Bank', level: 'stop', reasons: ['pretends'], createdBy: uid1, expiresAt: ts(), ...over });
    t('alert: valid create by user 1', await create(`${A}a1`, alert()), 200);
    t('alert: create with an extra field is refused', await create(`${A}a2`, alert({ url: 'https://x' })), 403);
    t('alert: create naming someone else as creator is refused', await create(`${A}a3`, alert({ createdBy: uid2 })), 403);
    t('alert: create with an unknown level is refused', await create(`${A}a4`, alert({ level: 'panic' })), 403);
    t('alert: create with 9 reasons is refused', await create(`${A}a5`, alert({ reasons: Array(9).fill('urgency') })), 403);
    t('alert: a message alert (kind message) is accepted', await create(`${A}a6`, alert({ kind: 'message', host: 'message' })), 200);
    t('alert: an unknown kind is refused', await create(`${A}a7`, alert({ kind: 'weird' })), 403);
    t('alert: a message alert with a text field is refused', await create(`${A}a8`, alert({ kind: 'message', text: 'the whole message' })), 403);
    t('alert: any edit is refused', await update(`${A}a1`, { brand: 'Other' }, ['brand'], tok1), 403);
    t('alert: reading without signing in is refused', await read(`${A}a1`, null), 403);
    t('alert: another user deleting is refused', await del(`${A}a1`, tok2), 403);
    t('alert: the creator deleting works', await del(`${A}a1`, tok1), 200);
    await del(`${A}a6`, tok1);

    // Check-ins.
    const C = `groups/${G}/checkins/`;
    const checkin = (over = {}) => ({ title: 'Pay bill', steps: 5, createdBy: uid1, expiresAt: ts(), ...over });
    t('checkin: valid create by user 1', await create(`${C}c1`, checkin()), 200);
    t('checkin: create with an extra field is refused', await create(`${C}c2`, checkin({ host: 'bank.example' })), 403);
    t('checkin: create naming someone else as creator is refused', await create(`${C}c3`, checkin({ createdBy: uid2 })), 403);
    t('checkin: create with an empty title is refused', await create(`${C}c4`, checkin({ title: '' })), 403);
    t('checkin: create with 41 steps is refused', await create(`${C}c5`, checkin({ steps: 41 })), 403);
    t('checkin: create with steps as text is refused', await create(`${C}c6`, checkin({ steps: 'five' })), 403);
    t('checkin: any edit is refused', await update(`${C}c1`, { title: 'Changed' }, ['title'], tok1), 403);
    t('checkin: reading without signing in is refused', await read(`${C}c1`, null), 403);
    t('checkin: another user deleting is refused', await del(`${C}c1`, tok2), 403);
    t('checkin: the creator deleting works', await del(`${C}c1`, tok1), 200);

    // Saved paths.
    const P =`groups/${G}/paths/`;
    const path = (over = {}) => ({
      title: 'Pay bill', host: 'a.example',
      steps: [{ role: 'button', text: 'Pay', section: '', page: '/', href: '', name: '' }],
      translations: {}, createdBy: uid1, ...over,
    });
    t('path: valid create by user 1', await create(`${P}p1`, path()), 200);
    t('path: create with no steps is refused', await create(`${P}p2`, path({ steps: [] })), 403);
    t('path: create with an extra field is refused', await create(`${P}p3`, path({ extra: 1 })), 403);
    t('path: create naming someone else as creator is refused', await create(`${P}p4`, path({ createdBy: uid2 })), 403);
    t('path: create with 41 steps is refused', await create(`${P}p5`, path({ steps: Array.from({ length: 41 }, () => ({ role: 'button', text: 'x' })) })), 403);
    t('path: any edit is refused, even by the creator', await update(`${P}p1`, { title: 'Changed' }, ['title'], tok1), 403);
    t('path: another user deleting is refused', await del(`${P}p1`, tok2), 403);
    t('path: the creator deleting works', await del(`${P}p1`, tok1), 200);
    t('anything outside groups is refused', await read('other/doc', tok1), 403);

    window.__R = {
      passed: R.filter((x) => x.ok).length,
      total: R.length,
      failures: R.filter((x) => !x.ok),
      all: R.map((x) => `${x.ok ? 'ok  ' : 'FAIL'} ${x.name} (${x.got})`),
    };
  } catch (e) {
    window.__err = String(e);
  }
})();
