// gas/src/Code.js + Cro.js routing in a fake Apps Script runtime: cro batches go to Cro.js before the host's own
// track validation, `action` is read from the body or the query string, CRO reads need the key.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

const read = (f) => fs.readFileSync(new URL('../../gas/src/' + f, import.meta.url), 'utf8');
function gas(props = {}) {
  const ctx = {
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (s) => ({ setMimeType: () => ({ body: JSON.parse(s) }) }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] ?? null, setProperty: (k, v) => { props[k] = v; } }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    CacheService: { getScriptCache: () => ({ get: () => null, put: () => {} }) },
    Utilities: { formatDate: () => '2026-10-13', getUuid: () => 'x', DigestAlgorithm: {}, Charset: {},
      computeDigest: (a, t) => Array.from(crypto.createHash('sha256').update(t).digest()) },
    SpreadsheetApp: { getActive: () => { throw new Error('no sheet in this test'); } },
    console,
  };
  vm.runInNewContext(read('Code.js') + '\n' + read('Cro.js'), ctx);
  const post = (body, parameter = {}) => ctx.doPost({ postData: { contents: JSON.stringify(body) }, parameter }).body;
  const get = (parameter) => ctx.doGet({ parameter }).body;
  return { ctx, post, get, props };
}

test('cro batches go to Cro.js (body or query action); unknown site is refused', () => {
  const { post } = gas();
  const batch = { kind: 'cro', v: 2, site: 'nope', page: '/', e: [['pv', '', '']] };
  assert.deepEqual(post({ action: 'track', ...batch }, { action: 'track' }), { ok: false, error: 'bad_request' });
  assert.deepEqual(post(batch, { action: 'track' }), { ok: false, error: 'bad_request' });
});

test('host settings: site, experiment whitelist and page names of the Stats tab', () => {
  const { ctx } = gas();
  assert.deepEqual(JSON.parse(JSON.stringify({ s: ctx.CRO_SITES_, x: ctx.CRO_EXPERIMENTS_ })), { s: ['deutschdrill'], x: { price: ['p499', 'p799'] } });
  assert.equal(ctx.CRO_TZ_, 'Asia/Kolkata');
  assert.equal(ctx.croPageOf_('deutschdrill', '/deutschdrill/early-access.html?p=499'), '/early-access.html');
  assert.equal(ctx.croPageOf_('deutschdrill', '/deutschdrill/'), '/');
  assert.equal(ctx.croPageOf_('deutschdrill', '/early-access.html?p=499'), '/early-access.html');
  assert.equal(ctx.croPageOf_('deutschdrill', '/'), '/');
  assert.equal(ctx.croPageOf_('deutschdrill', '/deutschdrill/wp-admin.php'), '(other)');
  const b = ctx.croValidate_({ site: 'deutschdrill', v: 2, page: '/deutschdrill/early-access.html', device: 'mobile',
    e: [['pv', '', ''], ['xp', 'price', 'p499.n'], ['xp', 'price', 'p799.waitlist'], ['xp', 'price', 'p999.n'], ['xp', 'other', 'a.n']] });
  assert.deepEqual(JSON.parse(JSON.stringify(b.exp)), [['price', 'p499', 'n'], ['price', 'p799', 'waitlist']]);
  assert.equal(b.dropped, 2);
});

test('cro reads need the key; cro_init validates it; the host track and early actions are unchanged', () => {
  const { post, get } = gas();
  assert.deepEqual(post({ action: 'cro', key: 'x'.repeat(40) }), { ok: false, error: 'forbidden' });
  assert.deepEqual(get({ action: 'cro', key: 'x'.repeat(40) }), { ok: false, error: 'forbidden' });
  assert.deepEqual(post({ action: 'cro_init', key: 'short' }), { ok: false, error: 'bad_request' });
  assert.deepEqual(post({ action: 'cro_init', key: 'k'.repeat(40) }), { ok: true, set: true });
  assert.deepEqual(post({ action: 'cro_init', key: 'j'.repeat(40) }), { ok: true, already: true, match: false });
  assert.deepEqual(post({ action: 'track', event: 'nope' }), { ok: false, error: 'bad_event' });
  assert.deepEqual(post({ action: 'early', email: 'bad' }), { ok: false, error: 'bad_email' });
  assert.deepEqual(post({ action: 'other' }), { ok: false, error: 'unknown_action' });
  assert.deepEqual(get({ action: 'stats', key: 'k' }), { ok: false, error: 'forbidden' });
});
