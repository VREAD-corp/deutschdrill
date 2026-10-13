// assets/mesure.js in a fake browser: crawlers, automated browsers, our tests (octave_notrack) and prerendered
// pages never count as visits, and the user agent is never sent. Run: node --test tests/unit/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src = fs.readFileSync(new URL('../../assets/mesure.js', import.meta.url), 'utf8');
const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const GOOGLEBOT = 'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.7390.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

function run({ ua = CHROME, webdriver = false, search = '', store = {}, prerendering = false, visibility = 'visible', dnt = '' } = {}) {
  const sent = [], listeners = {};
  const doc = {
    referrer: 'https://www.google.com/', prerendering, visibilityState: visibility,
    addEventListener: (k, f) => { (listeners[k] ||= []).push(f); }, removeEventListener: (k, f) => { listeners[k] = (listeners[k] || []).filter((g) => g !== f); },
  };
  const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  const ctx = {
    navigator: { userAgent: ua, webdriver, doNotTrack: dnt }, document: doc, localStorage: ls, innerWidth: 1200, URLSearchParams, JSON,
    location: { hostname: 'outils.vread.fr', pathname: '/deutschdrill/exam-day-india.html', search },
    fetch: (u, o) => { sent.push(JSON.parse(o.body)); assert.equal(o.credentials, 'omit'); return Promise.resolve(); },
  };
  ctx.window = ctx;
  vm.runInNewContext(src, ctx);
  const fire = (k) => (listeners[k] || []).slice().forEach((f) => f({}));
  fire('DOMContentLoaded');
  return { sent, store, fire, doc };
}
const events = (r) => r.sent.map((b) => b.event);

test('a normal visit is counted, without the user agent', () => {
  const r = run();
  assert.deepEqual(events(r), ['view', 'guide_view']);
  assert.ok(r.sent.every((b) => !('excluded' in b)));
  assert.ok(!JSON.stringify(r.sent).includes('Chrome'));
});

test('webdriver, crawlers and headless browsers are flagged, never counted', () => {
  assert.ok(run({ webdriver: true }).sent.every((b) => b.excluded === 'webdriver'));
  assert.ok(run({ ua: GOOGLEBOT }).sent.every((b) => b.excluded === 'bot'));
  assert.ok(!JSON.stringify(run({ ua: GOOGLEBOT }).sent).includes('Googlebot'));
  assert.ok(run({ ua: CHROME.replace('Chrome/', 'HeadlessChrome/') }).sent.every((b) => b.excluded === 'bot'));
});

test('octave_notrack=1 (query, remembered; or localStorage) flags our tests; =0 clears it', () => {
  let r = run({ search: '?octave_notrack=1' });
  assert.ok(r.sent.length && r.sent.every((b) => b.excluded === 'notrack'));
  assert.equal(r.store.octave_notrack, '1');
  assert.ok(run({ store: { octave_notrack: '1' } }).sent.every((b) => b.excluded === 'notrack'));
  r = run({ search: '?octave_notrack=0', store: { octave_notrack: '1' } });
  assert.ok(r.sent.every((b) => !('excluded' in b)) && !('octave_notrack' in r.store));
});

test('Do Not Track sends nothing; prerendered pages count only once opened', () => {
  assert.equal(run({ dnt: '1' }).sent.length, 0);
  let r = run({ prerendering: true });
  assert.equal(r.sent.length, 0);
  r.fire('prerenderingchange');
  assert.deepEqual(events(r), ['view', 'guide_view']);
  r = run({ visibility: 'prerender' });
  assert.equal(r.sent.length, 0);
  r.doc.visibilityState = 'visible'; r.fire('visibilitychange'); r.fire('visibilitychange');
  assert.equal(events(r).filter((e) => e === 'view').length, 1);
});
