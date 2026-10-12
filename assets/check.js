/* DeutschDrill self-check: rule-based, runs only in the browser (or in Node for tests).
   Nothing is sent anywhere. It checks length, register, connectors, content-point hints and a
   short list of error patterns that we see often in learners whose first languages put the verb
   last (Hindi, Marathi, Tamil, Malayalam, Telugu, Kannada …) and have no articles.
   The patterns are deliberately narrow: a flag means "look again", not "this is wrong". */
(function (root) {
  'use strict';

  var LETTER = 'a-zäöüß';
  function words(text) {
    return (text.match(/[A-Za-zÄÖÜäöüß0-9][A-Za-zÄÖÜäöüß0-9'’.\-]*/g) || []).filter(function (w) { return /[A-Za-zÄÖÜäöüß0-9]/.test(w); });
  }
  function countWords(text) { return words(text).length; }
  // word-boundary helper that understands umlauts (JS \b does not)
  function wb(src) { return '(?:^|[^' + LETTER + 'A-ZÄÖÜ])(?:' + src + ')(?=$|[^' + LETTER + 'A-ZÄÖÜ])'; }
  function rx(src, flags) { return new RegExp(wb(src), flags || 'i'); }

  var CONNECTORS = {
    A1: ['und', 'aber', 'oder', 'dann', 'auch', 'leider'],
    A2: ['und', 'aber', 'oder', 'dann', 'denn', 'weil', 'dass', 'wenn', 'deshalb', 'zuerst', 'danach', 'später', 'leider', 'dafür'],
    B1: ['weil', 'dass', 'wenn', 'obwohl', 'damit', 'denn', 'deshalb', 'deswegen', 'trotzdem', 'außerdem', 'aber', 'sondern', 'zum Beispiel', 'erstens', 'zweitens', 'meiner Meinung nach', 'einerseits', 'andererseits', 'danach', 'als', 'bevor', 'nachdem', 'während', 'also', 'natürlich', 'zuerst', 'dann', 'falls', 'statt']
  };
  var CONNECTOR_TARGET = { A1: 2, A2: 3, B1: 5 };
  var SUBORDINATORS = ['weil', 'dass', 'wenn', 'obwohl', 'damit', 'als', 'bevor', 'nachdem', 'während', 'falls', 'ob'];

  // ---- nouns with a fixed gender whose singular form is never correct with these articles
  var MASC = ['Termin', 'Kurs', 'Bahnhof', 'Tag', 'Geburtstag', 'Monat', 'Urlaub', 'Arzt', 'Beruf', 'Chef', 'Kollege', 'Zug', 'Bus', 'Schlüssel', 'Balkon', 'Supermarkt', 'Park', 'Platz', 'Vorschlag', 'Unterricht', 'Ausflug', 'Kaffee', 'Tee', 'Reis'];
  var FEM = ['Wohnung', 'Arbeit', 'Stadt', 'Familie', 'Zeit', 'Prüfung', 'Woche', 'Schule', 'Firma', 'Stelle', 'Einladung', 'Party', 'Feier', 'Küche', 'Miete', 'Adresse', 'Nachricht', 'Heizung', 'Hausaufgabe', 'Sprache', 'Reise', 'Frage', 'Antwort', 'Lösung', 'Meinung', 'Ausbildung', 'Universität', 'Uni', 'Praxis', 'Bahn', 'Straße', 'Mutter', 'Schwester', 'Tochter'];
  var NEUT = ['Problem', 'Visum', 'Büro', 'Krankenhaus', 'Geschenk', 'Jahr', 'Auto', 'Zimmer', 'Wetter', 'Essen', 'Fest', 'Kind', 'Haus', 'Wochenende', 'Studium', 'Hotel', 'Restaurant', 'Kino', 'Museum', 'Handy', 'Paket', 'Geld', 'Formular', 'Fahrrad', 'Land', 'Mädchen'];
  // (Zimmer, Mädchen: plural form = singular, so "die Zimmer" is fine; we skip "die" for them.)
  var NEUT_SAME_PLURAL = ['Zimmer', 'Mädchen', 'Essen', 'Wochenende'];

  function list(a) { return a.join('|'); }

  var RULES = [
    {
      id: 'v2-inversion', area: 'Word order',
      re: new RegExp('(?:^|[.!?]\\s+|\\n)(Heute|Morgen|Gestern|Dann|Danach|Deshalb|Deswegen|Leider|Jetzt|Später|Vielleicht|Trotzdem|Außerdem|Am (?:Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag|Wochenende|Abend|Morgen)|Im (?:Sommer|Winter|Mai|Juni|Juli|August|Dezember|Januar))\\s*,?\\s+(ich|du|er|sie|es|wir|ihr|man)\\s+(?!und)([' + LETTER + ']+)', 'gi'),
      msg: 'Verb in position 2: when a time word or “deshalb / leider / dann” comes first, the verb comes next and the subject moves behind it.',
      fix: 'Heute ich gehe … → Heute gehe ich …'
    },
    {
      id: 'sub-clause', area: 'Word order',
      re: rx('(weil|dass|wenn|obwohl|ob|damit|nachdem|bevor)\\s+(ich|du|er|sie|es|wir|ihr|man|mein\\w*|dein\\w*|der|die|das)\\s+(bin|bist|ist|sind|seid|habe|hast|hat|haben|habt|kann|kannst|können|muss|musst|müssen|will|willst|wollen|möchte|möchtest|möchten|werde|wirst|wird|werden|gehe|gehst|geht|gehen|komme|kommst|kommt|kommen|arbeite|arbeitest|arbeitet|arbeiten|wohne|wohnst|wohnt|wohnen|lerne|lernst|lernt|lernen|fahre|fährst|fährt|fahren)\\s+[' + LETTER + 'A-ZÄÖÜ0-9]+', 'gi'),
      msg: 'After “weil / dass / wenn / obwohl …” the conjugated verb goes to the END of the clause.',
      fix: '…, weil ich bin krank. → …, weil ich krank bin.'
    },
    {
      id: 'modal-infinitive', area: 'Word order',
      re: rx('(kann|kannst|können|könnt|muss|musst|müssen|müsst|will|willst|wollen|möchte|möchtest|möchten|darf|darfst|dürfen|soll|sollst|sollen)\\s+(sprechen|gehen|kommen|machen|arbeiten|lernen|besuchen|kaufen|fahren|schreiben|sehen|essen|trinken|spielen|helfen|bezahlen|schicken|treffen|wohnen|bringen|mitbringen|kochen|lesen|schlafen|bleiben|nehmen|geben|finden|suchen|fragen|sagen|zeigen|warten|reisen|fliegen|studieren|telefonieren|anrufen|abholen|mitkommen|einkaufen|feiern|tanzen|laufen|schwimmen|verstehen|erklären|beginnen|anfangen|aufstehen|holen|mieten|bestellen|buchen|leben|werden|machen|üben|wiederholen|verdienen|bekommen|kennenlernen|zahlen|senden|erzählen)\\s+(?!und\\b|oder\\b|aber\\b|[' + LETTER + ']+en(?:[^' + LETTER + ']|$))[' + LETTER + 'A-ZÄÖÜ0-9]+', 'gi'),
      msg: 'With “kann / muss / möchte …” the infinitive goes to the end of the sentence.',
      fix: 'Ich kann sprechen Deutsch. → Ich kann Deutsch sprechen.'
    },
    {
      id: 'verb-final-main', area: 'Word order',
      re: new RegExp('(?:^|[.!?]\\s+|\\n)(Ich|Wir)\\s+(Deutsch|Englisch|Tee|Kaffee|Reis|nach|jeden|heute|morgen)(?:\\s+[^.!?\\n]{0,30}?)?\\s+(lerne|lernen|trinke|trinken|esse|essen|gehe|gehen|fahre|fahren|wohne|wohnen|arbeite|arbeiten)[.!?]', 'g'),
      msg: 'In a main clause the verb is in position 2, not at the end (Hindi/Tamil/Malayalam order is subject–object–verb).',
      fix: 'Ich Deutsch lerne. → Ich lerne Deutsch.'
    },
    {
      id: 'article-masc', area: 'Articles',
      re: rx('(das)\\s+(' + list(MASC) + ')', 'gi'),
      msg: 'Gender: this noun is masculine (der / den / dem / ein / einen).',
      fix: 'das Termin → der Termin'
    },
    {
      id: 'article-fem', area: 'Articles',
      re: rx('(das|den|dem|des|einen|einem)\\s+(' + list(FEM) + ')', 'gi'),
      msg: 'Gender: this noun is feminine (die / der / eine / einer).',
      fix: 'das Wohnung → die Wohnung, mit einem Familie → mit einer Familie'
    },
    {
      id: 'article-neut', area: 'Articles',
      re: rx('(der|den|einen|eine)\\s+(' + list(NEUT.filter(function (n) { return NEUT_SAME_PLURAL.indexOf(n) < 0; })) + ')|(die)\\s+(' + list(NEUT.filter(function (n) { return NEUT_SAME_PLURAL.indexOf(n) < 0; })) + ')', 'gi'),
      msg: 'Gender: this noun is neuter (das / dem / ein / einem).',
      fix: 'die Problem → das Problem, einen Geschenk → ein Geschenk'
    },
    {
      id: 'dative-prep', area: 'Cases',
      re: rx('(mit|zu|von|bei|aus|nach|seit)\\s+(die|das|mein|meine|dein|deine|sein|seine|unser|unsere|ein(?!\\s+(?:paar|bisschen|wenig)(?:[^' + LETTER + ']|$))|eine)', 'gi'),
      skipMatch: /^zu\s+sein$/i,
      msg: 'Dative after mit, zu, von, bei, aus, nach, seit: dem / der / einem / einer / meinem / meiner.',
      fix: 'mit meine Familie → mit meiner Familie, zu die Arbeit → zur Arbeit'
    },
    {
      id: 'accusative-prep', area: 'Cases',
      re: rx('(für|ohne|gegen|durch|um)\\s+(dem|einem|meinem|deinem|seinem|unserem|meiner|deiner|einer)', 'gi'),
      msg: 'Accusative after für, ohne, gegen, durch, um: den / die / das / einen / meinen.',
      fix: 'für meinem Bruder → für meinen Bruder'
    },
    {
      id: 'perfekt-sein', area: 'Verbs',
      re: rx('(habe|hast|hat|haben|habt)\\s+(?:[' + LETTER + 'A-ZÄÖÜ0-9]+\\s+){0,6}?(gegangen|gefahren|gekommen|geflogen|geblieben|gewesen|passiert|aufgestanden|angekommen|umgezogen|gelaufen|geworden|eingeschlafen)', 'gi'),
      msg: 'Movement and change verbs form the Perfekt with “sein”, not “haben” (exception: with an object, “Ich habe das Auto gefahren”).',
      fix: 'Ich habe nach Berlin gefahren. → Ich bin nach Berlin gefahren.'
    },
    {
      id: 'age-haben', area: 'Indian-English and calques',
      re: rx('(ich|er|sie|du)\\s+(habe|hat|hast)\\s+\\d+\\s+Jahre', 'gi'),
      msg: 'Age uses “sein” in German.',
      fix: 'Ich habe 25 Jahre. → Ich bin 25 Jahre alt.'
    },
    {
      id: 'zu-hause', area: 'Indian-English and calques',
      re: rx('(gehe|gehst|geht|gehen|fahre|fährst|fährt|fahren|komme|kommst|kommt|kommen|fliege|fliegt|fliegen)\\s+(?:[' + LETTER + 'A-ZÄÖÜ0-9]+\\s+){0,4}?zu\\s+Hause(?!\\s+an(?:[^' + LETTER + ']|$))', 'gi'),
      msg: 'Going home = “nach Hause”. Being at home = “zu Hause”.',
      fix: 'Ich gehe zu Hause. → Ich gehe nach Hause.'
    },
    {
      id: 'job-article', area: 'Indian-English and calques',
      re: rx('(bin|bist|ist|sind|werde|wirst|wird|werden)\\s+(ein|eine)\\s+(Ingenieur|Ingenieurin|Krankenschwester|Krankenpfleger|Krankenpflegerin|Pflegefachfrau|Pflegefachmann|Pflegekraft|Student|Studentin|Lehrer|Lehrerin|Arzt|Ärztin|Informatiker|Informatikerin|Softwareentwickler|Softwareentwicklerin|Programmierer|Programmiererin|Elektriker|Koch|Köchin|Buchhalter|Buchhalterin)(?=[^' + LETTER + ']|$)', 'gi'),
      msg: 'No article before a job or nationality after “sein / werden”.',
      fix: 'Ich bin ein Ingenieur. → Ich bin Ingenieur.'
    },
    {
      id: 'seit-plural', area: 'Cases',
      re: rx('seit\\s+(?:zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|\\d+)\\s+(Jahre|Monate|Tage)', 'gi'),
      msg: '“seit” takes the dative: Jahren, Monaten, Tagen.',
      fix: 'seit zwei Jahre → seit zwei Jahren'
    },
    {
      id: 'nicht-ein', area: 'Negation',
      re: rx('nicht\\s+(ein|eine|einen)\\s+[A-ZÄÖÜ][' + LETTER + ']*', 'g'),
      msg: 'To negate a noun with “ein”, use “kein / keine / keinen”.',
      fix: 'Ich habe nicht ein Auto. → Ich habe kein Auto.'
    },
    {
      id: 'comma-sub', area: 'Punctuation',
      re: new RegExp('[' + LETTER + 'A-ZÄÖÜ0-9)]\\s+(weil|dass|obwohl|damit|nachdem)\\s', 'g'),
      skipIf: /(und|oder|aber|so|ohne|statt|als|sondern|nur|auch)\s+(weil|dass|obwohl|damit|nachdem)\s$/i,
      msg: 'German puts a comma before “weil / dass / obwohl / damit / nachdem” when they start a clause.',
      fix: 'Ich lerne Deutsch weil … → Ich lerne Deutsch, weil …'
    },
    {
      id: 'lowercase-noun', area: 'Spelling',
      re: rx('(arbeit|wohnung|familie|termin|prüfung|stadt|woche|zeit|kurs|deutschkurs|wetter|problem|geschenk|einladung|geburtstag|freund|freundin|kollege|kollegin|chef|chefin|schwester|bruder|eltern|krankenhaus|visum|urlaub)', 'g'),
      caseSensitive: true,
      msg: 'German nouns start with a capital letter.',
      fix: 'die arbeit → die Arbeit'
    }
  ];

  function findAll(rule, text) {
    var hits = [];
    var re = new RegExp(rule.re.source, rule.caseSensitive ? 'g' : (rule.re.flags.indexOf('i') >= 0 ? 'gi' : 'g'));
    var m;
    while ((m = re.exec(text)) !== null) {
      var s = m[0].replace(/^[^A-Za-zÄÖÜäöüß0-9]+/, '').trim();
      if (rule.skipIf) {
        var before = text.slice(Math.max(0, m.index - 12), m.index + m[0].length);
        if (rule.skipIf.test(before)) { if (m.index === re.lastIndex) re.lastIndex++; continue; }
      }
      if (rule.skipMatch && rule.skipMatch.test(s)) { if (m.index === re.lastIndex) re.lastIndex++; continue; }
      hits.push(s.slice(0, 60));
      if (m.index === re.lastIndex) re.lastIndex++;
    }
    return hits;
  }

  function registerCheck(text, register) {
    var out = [];
    var t = text.trim();
    var first = (t.split(/\n/)[0] || '').trim();
    var lower = t.toLowerCase();
    if (register === 'du') {
      if (!/^(liebe|lieber|hallo|hi|hey|servus|moin)\b/i.test(first)) out.push({ ok: false, label: 'Informal greeting (Liebe … / Lieber … / Hallo …)' });
      else out.push({ ok: true, label: 'Informal greeting' });
      if (!/(viele grüße|liebe grüße|bis bald|bis morgen|bis samstag|bis sonntag|bis dann|gruß|dein |deine |lg\b|tschüss|alles liebe)/i.test(lower) && !/\n\s*[A-ZÄÖÜ][a-zäöüß]+\s*$/.test(t)) out.push({ ok: false, label: 'Closing (Viele Grüße / Bis bald) and your name' });
      else out.push({ ok: true, label: 'Closing and name' });
      if (/(^|[^a-zäöüß])(Sie|Ihnen|Ihr|Ihre|Ihren)(?=[^a-zäöüß]|$)/.test(t.replace(/^[^\n]*\n/, '').replace(/(^|[.!?]\s+|\n)(Sie|Ihr|Ihre)\b/g, '$1'))) out.push({ ok: false, label: 'You write to a friend: use “du / dir / dich / dein”, not “Sie / Ihnen / Ihr”' });
    } else if (register === 'Sie') {
      if (!/^(sehr geehrte|sehr geehrter|liebe frau|lieber herr|liebe familie|guten tag|hallo frau|hallo herr)/i.test(first)) out.push({ ok: false, label: 'Formal greeting (Sehr geehrte … / Liebe Frau …)' });
      else out.push({ ok: true, label: 'Formal greeting' });
      if (!/(mit freundlichen grüßen|freundliche grüße|viele grüße|beste grüße|herzliche grüße)/i.test(lower)) out.push({ ok: false, label: 'Formal closing (Mit freundlichen Grüßen)' });
      else out.push({ ok: true, label: 'Formal closing' });
      if (/(^|[^a-zäöüß])(du|dich|dir|dein|deine|deinen|deinem|deiner|kannst|hast|bist|willst|möchtest)(?=[^a-zäöüß]|$)/i.test(t)) out.push({ ok: false, label: 'You write formally: use “Sie / Ihnen / Ihr”, not “du / dir / dein”' });
      if (/[a-zäöüß,]\s(ihnen|ihre|ihren|ihrem)(?=[^a-zäöüß]|$)/.test(t)) out.push({ ok: null, label: 'Polite “Ihnen / Ihr / Ihre” is written with a capital I (check: did you mean “them / her”?)' });
    } else if (register === 'forum') {
      if (!/(ich finde|ich glaube|ich denke|meiner meinung nach|ich bin der meinung|ich sehe das|ich teile|ich verstehe|ich bin (nicht )?(seiner|ihrer|ganz) meinung)/i.test(lower)) out.push({ ok: false, label: 'An opinion phrase (Ich finde … / Meiner Meinung nach …)' });
      else out.push({ ok: true, label: 'Opinion phrase' });
    }
    return out;
  }

  function connectorCheck(text, level) {
    var found = [];
    (CONNECTORS[level] || CONNECTORS.A2).forEach(function (c) {
      if (rx(c.replace(/ /g, '\\s+'), 'i').test(text)) found.push(c);
    });
    var sub = SUBORDINATORS.filter(function (c) { return rx(c, 'i').test(text); });
    return { found: found, target: CONNECTOR_TARGET[level] || 3, subordinate: sub };
  }

  function pointHints(text, points) {
    var lower = text.toLowerCase();
    return (points || []).map(function (p) {
      var stems = p[2] || [];
      var hit = stems.filter(function (s) { return lower.indexOf(s) >= 0; });
      return { de: p[0], en: p[1], hint: hit.length > 0, matched: hit.slice(0, 3) };
    });
  }

  function check(text, task) {
    var level = task.level;
    var n = countWords(text);
    var range = task.words || [0, 0];
    var lengthState = n === 0 ? 'empty' : n < range[0] * 0.5 ? 'far-short' : n < range[0] ? 'short' : n > range[1] * 1.5 ? 'far-long' : n > range[1] ? 'long' : 'ok';
    var flags = [];
    RULES.forEach(function (r) {
      var hits = findAll(r, text);
      if (hits.length) flags.push({ id: r.id, area: r.area, msg: r.msg, fix: r.fix, hits: hits });
    });
    var sentences = text.split(/[.!?]+\s/).filter(function (s) { return s.trim().length > 0; });
    var avg = sentences.length ? Math.round(n / sentences.length) : 0;
    return {
      words: n, range: range, lengthState: lengthState,
      register: registerCheck(text, task.register),
      connectors: connectorCheck(text, level),
      points: pointHints(text, task.points),
      flags: flags,
      avgSentence: avg
    };
  }

  function normalise(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').replace(/[.,;:!]+$/, '').trim(); }
  function checkForm(values, task) {
    return task.fields.slice(1).map(function (f, i) {
      var v = normalise(values[i]);
      var ok = f[2].some(function (a) { return normalise(a) === v; });
      return { label: f[0], value: values[i] || '', ok: ok, expected: f[2][0] };
    });
  }

  var api = { check: check, checkForm: checkForm, countWords: countWords, RULES: RULES, CONNECTORS: CONNECTORS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DDCheck = api;
})(typeof window !== 'undefined' ? window : this);
