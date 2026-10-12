// Pings IndexNow (api.indexnow.org, shared with Bing, Yandex, Seznam, Naver…) with every URL of the live sitemap.
// The key file is published at <base>/<key>.txt by build.py. Usage: node scripts/indexnow.mjs
import fs from 'node:fs';
const key = fs.readFileSync(new URL('../indexnow.key', import.meta.url), 'utf8').trim();
const base = 'https://outils.vread.fr/deutschdrill/';
const sm = await (await fetch(base + 'sitemap.xml')).text();
const urlList = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const kf = await fetch(base + key + '.txt');
if (!kf.ok || (await kf.text()).trim() !== key) throw new Error('key file not live yet: ' + base + key + '.txt');
const r = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: 'outils.vread.fr', key, keyLocation: base + key + '.txt', urlList }),
});
console.log('IndexNow', r.status, r.statusText, urlList.length, 'URLs');
