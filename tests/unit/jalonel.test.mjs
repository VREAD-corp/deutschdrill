// Jalonel brand separation: the served sources and the own Apps Script carry no Vread / reading-site reference,
// the contact is contact@jalonel.com, and every e-mail the script may send replies to it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const SERVED = ['assets', 'content', 'build.py'];
const TEXT = /\.(html|mjs|js|css|json|txt|xml|webmanifest|svg|py|md)$/;
function files(p) {
  const abs = path.join(root, p);
  if (!fs.existsSync(abs)) return [];
  if (fs.statSync(abs).isFile()) return [abs];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap((d) => files(path.join(p, d.name)));
}
const gasFiles = () => files('gas/src').filter((f) => f.endsWith('.js'));

test('served sources: no Vread, no octave@vread.fr, no outils.vread.fr / vread-corp.github.io host', () => {
  const list = SERVED.flatMap(files).filter((f) => TEXT.test(f));
  assert.ok(list.length > 3, 'served sources found');
  for (const f of list) assert.doesNotMatch(fs.readFileSync(f, 'utf8'), /vread/i, path.relative(root, f));
});

test('the contact address is contact@jalonel.com', () => {
  const all = SERVED.flatMap(files).filter((f) => TEXT.test(f)).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  assert.match(all, /contact@jalonel\.com/);
});

test('Apps Script: no Vread host, own hosts = the Jalonel host only, every e-mail replies to contact@jalonel.com', () => {
  for (const f of gasFiles()) {
    const src = fs.readFileSync(f, 'utf8');
    assert.doesNotMatch(src, /vread/i, path.relative(root, f));
    const sends = src.match(/(MailApp|GmailApp)\.sendEmail\([\s\S]*?\}\s*\)/g) || [];
    for (const s of sends) assert.match(s, /replyTo:\s*['"]contact@jalonel\.com['"]|replyTo:\s*[A-Z_.]*REPLY_TO/, path.relative(root, f) + ': ' + s.slice(0, 80));
    assert.doesNotMatch(src, /(MailApp|GmailApp)\.sendEmail\(\s*['"]/, 'sendEmail(recipient, subject, body) form cannot carry replyTo');
  }
  const code = fs.readFileSync(path.join(root, 'gas/src/Code.js'), 'utf8');
  assert.match(code, /OWN_HOSTS_ = \['deutschdrill\.jalonel\.com'\]/);
});
