// Unit tests for the rule-based self-check: every model answer must pass cleanly, and typical
// learner errors must be flagged. Run: node --test tests/unit/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const C = require('../../assets/check.js');
const root = new URL('../../', import.meta.url).pathname;
const data = JSON.parse(execFileSync('python3', ['-c', 'import sys,json;sys.path.insert(0,"data");from writing import WRITING;from speaking import SPEAKING;print(json.dumps({"w":WRITING,"s":SPEAKING}))'], { cwd: root }));

test('12 writing tasks and 6 speaking prompts per level, unique ids', () => {
  for (const lv of ['A1', 'A2', 'B1']) {
    assert.equal(data.w.filter((t) => t.level === lv).length, 12, lv);
    assert.equal(data.s.filter((t) => t.level === lv).length, 6, lv);
  }
  const ids = [...data.w, ...data.s].map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
});

for (const t of data.w.filter((x) => x.kind === 'message')) {
  test(`model answer passes its own self-check: ${t.id}`, () => {
    const r = C.check(t.model, t);
    assert.equal(r.lengthState, 'ok', `${t.id}: ${r.words} words, range ${t.words}`);
    assert.deepEqual(r.flags.map((f) => f.id + ': ' + f.hits.join(' | ')), [], t.id);
    assert.deepEqual(r.register.filter((x) => x.ok !== true).map((x) => x.label), [], t.id);
    assert.deepEqual(r.points.filter((p) => !p.hint).map((p) => p.de), [], t.id);
    if (t.level === 'B1' && !t.part.startsWith('Task 3')) assert.ok(r.connectors.found.length >= 3, `${t.id} connectors ${r.connectors.found}`);
  });
}

test('speaking model answers trigger no error flag', () => {
  for (const s of data.s) {
    const r = C.check(s.model.replace(/\(.*?\)/g, ''), { level: s.level, register: 'none', words: [0, 9999], points: [] });
    assert.deepEqual(r.flags.map((f) => f.id + ': ' + f.hits.join(' | ')), [], s.id);
  }
});

test('form tasks: model values are accepted, wrong ones rejected', () => {
  for (const t of data.w.filter((x) => x.kind === 'form')) {
    const good = t.fields.slice(1).map((f) => f[2][0]);
    assert.ok(C.checkForm(good, t).every((x) => x.ok), t.id);
    assert.ok(C.checkForm(good.map(() => 'xyz'), t).every((x) => !x.ok), t.id);
  }
});

const BAD = [
  ['v2-inversion', 'Hallo Sara,\nheute ich gehe ins Kino.'],
  ['v2-inversion', 'Leider ich kann nicht kommen.'],
  ['sub-clause', 'Ich komme nicht, weil ich bin krank.'],
  ['sub-clause', 'Ich glaube, dass er ist müde.'],
  ['modal-infinitive', 'Ich kann sprechen Deutsch.'],
  ['verb-final-main', 'Ich Deutsch lerne.'],
  ['article-masc', 'Ich habe das Termin vergessen.'],
  ['article-fem', 'Das Wohnung ist schön.'],
  ['article-neut', 'Die Problem ist groß.'],
  ['dative-prep', 'Ich wohne mit meine Familie.'],
  ['dative-prep', 'Ich fahre mit die Bahn.'],
  ['accusative-prep', 'Das ist für meinem Bruder.'],
  ['perfekt-sein', 'Ich habe nach Berlin gefahren.'],
  ['age-haben', 'Ich habe 25 Jahre.'],
  ['zu-hause', 'Ich gehe jetzt zu Hause.'],
  ['job-article', 'Ich bin ein Ingenieur.'],
  ['seit-plural', 'Ich lerne seit zwei Jahre Deutsch.'],
  ['nicht-ein', 'Ich habe nicht ein Auto.'],
  ['comma-sub', 'Ich lerne Deutsch weil ich in Deutschland arbeiten möchte.'],
  ['lowercase-noun', 'Ich habe morgen eine prüfung.'],
];
for (const [id, text] of BAD) {
  test(`flags ${id}: ${text}`, () => {
    const r = C.check(text, { level: 'A2', register: 'none', words: [0, 99], points: [] });
    assert.ok(r.flags.some((f) => f.id === id), `${id} not flagged; got ${r.flags.map((f) => f.id)}`);
  });
}

const GOOD = [
  'Ich möchte heute essen gehen.', 'Ich komme um 18 Uhr zu Hause an.', 'Wir treffen uns seit ein paar Wochen.',
  'Es ist wichtig, pünktlich zu sein.', 'Ich habe das Auto in die Garage gefahren.', 'Die Zimmer sind groß.',
  'Ich kann sprechen und schreiben.', 'Mit ein bisschen Glück klappt es.', 'Ich bin um 6 Uhr nach Hause gegangen.',
];
test('does not flag correct sentences', () => {
  for (const g of GOOD) {
    const r = C.check(g, { level: 'B1', register: 'none', words: [0, 99], points: [] });
    assert.deepEqual(r.flags.map((f) => f.id), g.includes('Auto in die Garage') ? ['perfekt-sein'] : [], g);
  }
});

test('modal rule catches other common verbs but not "möchte essen gehen"', () => {
  const t = { level: 'A2', register: 'none', words: [0, 99], points: [] };
  assert.ok(C.check('Ich kann bringen Suppe.', t).flags.some((f) => f.id === 'modal-infinitive'));
  assert.ok(C.check('Ich will arbeiten in Deutschland.', t).flags.some((f) => f.id === 'modal-infinitive'));
  assert.ok(!C.check('Wir können einen Kuchen backen.', t).flags.length);
});
