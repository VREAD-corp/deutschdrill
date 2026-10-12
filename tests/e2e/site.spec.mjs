import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const SHOTS = process.env.SHOTS_DIR || 'shots';
fs.mkdirSync(SHOTS, { recursive: true });
const shot = (page, name, info, full = true) => page.screenshot({ path: `${SHOTS}/${name}-${info.project.name}.png`, fullPage: full });
const Q = '?utm_source=e2e-test';
const PAGES = ['', 'a1.html', 'a2.html', 'b1.html', 'write.html', 'speak.html', 'exam-day-india.html', 'early-access.html', 'how-it-works.html', 'privacy.html', 'terms.html', 'legal.html'];

test('every page: footer identity, disclaimer, no horizontal scroll, no console errors', async ({ page }, info) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/script\.google\.com/.test(m.text()) && errors.push(m.text()));
  for (const p of PAGES) {
    await page.goto(p + Q);
    expect(await page.evaluate(() => document.documentElement.scrollWidth), p).toBeLessThanOrEqual(page.viewportSize().width);
    await expect(page.locator('footer')).toContainText('READ FRANCE SAS');
    await expect(page.locator('footer')).toContainText('988 741 773');
    await expect(page.locator('footer')).toContainText('octave@vread.fr');
    await expect(page.locator('footer .disclaimer')).toContainText('Not affiliated with');
    await expect(page.locator('h1')).toHaveCount(1);
    const name = p.replace('.html', '') || 'home';
    if (['home', 'b1', 'exam-day-india', 'early-access', 'a1'].includes(name)) await shot(page, name, info);
  }
  expect(errors).toEqual([]);
});

test('level pages list 12 writing tasks and 6 speaking prompts', async ({ page }) => {
  for (const lv of ['a1', 'a2', 'b1']) {
    await page.goto(lv + '.html' + Q);
    await expect(page.locator('article.task:not(.speak)')).toHaveCount(12);
    await expect(page.locator('article.task.speak')).toHaveCount(6);
  }
});

test('writing room: timer, live word count and self-check flags', async ({ page }, info) => {
  await page.goto('write.html' + Q + '#a2-w02');
  await expect(page.locator('#t-title')).toHaveText('Your friend is sick');
  await page.locator('#timer-start').click();
  await expect(page.locator('#timer-start')).toHaveText('Pause timer');
  await page.locator('#answer').fill('Hallo Julia,\nich habe gehört, dass du bist krank. Gute Besserung! Ich kann bringen Suppe. Morgen ich habe Zeit.\nLiebe Grüße\nRavi');
  await expect(page.locator('#wc')).toContainText('22 words');
  await page.locator('#check-btn').click();
  const res = page.locator('#result');
  await expect(res).toBeVisible();
  await expect(res).toContainText('After “weil / dass / wenn');
  await expect(res).toContainText('Verb in position 2');
  await expect(res).toContainText('infinitive goes to the end');
  await expect(res.locator('.points-check li')).toHaveCount(3);
  await page.locator('#model summary').click();
  await expect(page.locator('#model-text')).toContainText('Gute Besserung');
  await shot(page, 'write-room', info);
  // draft survives a reload (local storage only)
  await page.reload();
  await expect(page.locator('#answer')).toHaveValue(/dass du bist krank/);
  await page.locator('#t-next').click();
  await expect(page.locator('#t-title')).toHaveText('Invite a friend to a yoga class');
});

test('writing room: A1 form task is marked field by field', async ({ page }) => {
  await page.goto('write.html' + Q + '#a1-w11');
  for (const [i, v] of ['Indien', '53111 Bonn', '24', 'Krankenschwester', 'Abend'].entries()) await page.locator('#f' + (i + 1)).fill(v);
  await page.locator('#form-check-btn').click();
  await expect(page.locator('#result')).toContainText('5 of 5 fields correct');
  await page.locator('#f5').fill('Vormittag');
  await page.locator('#form-check-btn').click();
  await expect(page.locator('#result')).toContainText('4 of 5 fields correct');
});

test('speaking room: timers and local recording, nothing uploaded', async ({ page }, info) => {
  const external = [];
  page.on('request', (r) => {
    const u = r.url();
    if (u.startsWith('http://localhost') || u.startsWith('blob:') || u.startsWith('data:') || u.startsWith(page.context()._options?.baseURL || '~')) return;
    if (u.startsWith('https://outils.vread.fr/')) return; // same origin (live run)
    const body = r.postData() || '';
    // the only allowed outbound call is the anonymous counter: tiny JSON with action "track", never audio
    if (/script\.google\.com\/macros/.test(u) && body.includes('"action":"track"') && body.length < 800) return;
    external.push(r.method() + ' ' + u + ' ' + body.length);
  });
  await page.goto('speak.html' + Q + '#a1-s02');
  await expect(page.locator('#t-title')).toHaveText('Topic: food and drink');
  await page.locator('#go-btn').click();
  await expect(page.locator('#go-btn')).toHaveText('I am ready: start speaking');
  await page.locator('#go-btn').click();
  await expect(page.locator('#rec-status')).toContainText('Recording on this device', { timeout: 10000 });
  await page.waitForTimeout(1500);
  await page.locator('#go-btn').click();
  await expect(page.locator('#rec-audio')).toBeVisible();
  await expect(page.locator('#rec-download')).toBeVisible();
  await expect(page.locator('#rec-status')).toContainText('only in this tab');
  await shot(page, 'speak-room', info);
  await page.locator('#rec-delete').click();
  await expect(page.locator('#rec-audio')).toBeHidden();
  expect(external, 'no request other than the tiny anonymous counter may leave the page; audio never').toEqual([]);
});

test('early access: price arm, currency switch, consent required, posts to own endpoint', async ({ page }, info) => {
  let posted = null;
  await page.route(/script\.google\.com\/macros/, async (route) => {
    const body = route.request().postData() || '';
    if (body.includes('"action":"early"')) posted = JSON.parse(body);
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await page.goto('early-access.html?p=499&utm_source=e2e-test');
  await expect(page.locator('.price .amount').first()).toHaveText('₹499');
  await page.locator('[data-cur=usd]').click();
  await expect(page.locator('.price .amount').first()).toHaveText('$6');
  await expect(page.locator('.price .amount').nth(1)).toHaveText('$24');
  await expect(page.locator('main')).toContainText('No human examiner');
  await expect(page.locator('main')).toContainText('no payment is asked now');
  await page.locator('#email').fill('learner@example.com');
  await page.locator('#pl-p').check();
  await page.locator('button[type=submit]').click();
  await expect(page.locator('#form-msg')).toContainText('consent');
  expect(posted).toBeNull();
  await page.locator('#consent').check();
  await page.locator('button[type=submit]').click();
  await expect(page.locator('#early-done')).toBeVisible();
  expect(posted).toMatchObject({ action: 'early', email: 'learner@example.com', variant: 'p499', currency: 'usd', plan: 'pass3', offer: 'both', consent: true });
  await shot(page, 'early-done', info);
});
