/* DeutschDrill app: writing room, speaking room, early-access form.
   Texts and recordings stay in this browser. The only network calls are the anonymous counters
   (mesure.js, cro.js) and, if you submit it, the early-access form. */
(function () {
  'use strict';
  var D = window.DD || { writing: [], speaking: [] };
  var BASE = '/';
  var $ = function (id) { return document.getElementById(id); };
  var track = function (ev, extra) { if (window.ddTrack) window.ddTrack(ev, extra); };
  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { if (k === 'class') e.className = attrs[k]; else e.setAttribute(k, attrs[k]); });
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } return null; }
  function fmt(sec) { sec = Math.max(0, Math.round(sec)); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }
  function multiline(node, text) { node.textContent = ''; String(text).split('\n').forEach(function (line, i) { if (i) node.appendChild(el('br')); node.appendChild(document.createTextNode(line)); }); }

  /* ---------------- countdown timer ---------------- */
  var TIMERS = [];
  function Timer(display, onEnd) {
    var left = 0, total = 0, iv = null, self = this;
    TIMERS.push(this);
    this.set = function (sec) { this.stop(); total = left = sec; display.textContent = fmt(left); display.classList.remove('over'); };
    this.start = function () {
      if (iv) return; var t0 = Date.now(), from = left;
      iv = setInterval(function () {
        left = from - (Date.now() - t0) / 1000;
        display.textContent = fmt(left);
        if (left <= 0) { self.stop(); display.classList.add('over'); display.textContent = '0:00'; if (onEnd) onEnd(); }
      }, 250);
    };
    this.stop = function () { if (iv) clearInterval(iv); iv = null; };
    this.running = function () { return !!iv; };
    this.elapsed = function () { return total - left; };
  }

  /* ================================================================ writing room */
  function writeRoom() {
    var root = $('write-room'); if (!root) return;
    var id = (location.hash || '').slice(1);
    var task = D.writing.filter(function (t) { return t.id === id; })[0];
    if (!task) { $('room-missing').hidden = false; return; }
    $('room-missing').hidden = true; $('task-view').hidden = false;
    document.title = task.title + ' · ' + task.level + ' writing practice · DeutschDrill';
    $('t-meta').textContent = task.level + ' · ' + task.part + ' · ' + task.minutes + ' min suggested' + (task.kind === 'message' ? ' · ' + task.words[0] + '–' + task.words[1] + ' words' : '');
    $('t-title').textContent = task.title;
    multiline($('t-sit'), task.situation_de);
    $('t-sit-en').textContent = task.situation_en;
    $('t-back').href = BASE + task.level.toLowerCase() + '.html#' + task.id;
    var pts = $('t-points'); pts.textContent = '';
    task.points.forEach(function (p) { var li = el('li', { lang: 'de' }, p[0] + ' '); li.appendChild(el('span', { class: 'en', lang: 'en' }, p[1])); pts.appendChild(li); });
    var timer = new Timer($('timer'), function () { $('timer-note').textContent = 'Time is up. In the exam you would stop here. Finish your sentence and check.'; });
    timer.set(task.minutes * 60);
    $('timer-start').onclick = function () {
      if (timer.running()) { timer.stop(); this.textContent = 'Resume timer'; }
      else { timer.start(); this.textContent = 'Pause timer'; track('write_start'); }
    };
    $('timer-reset').onclick = function () { timer.set(task.minutes * 60); $('timer-start').textContent = 'Start timer'; $('timer-note').textContent = ''; };
    $('t-en-toggle').onclick = function () { var h = $('t-sit-en').hidden; $('t-sit-en').hidden = !h; this.textContent = h ? 'Hide English' : 'Show in English'; this.setAttribute('aria-expanded', String(h)); };
    multiline($('model-text'), task.model);
    var tips = $('model-tips'); tips.textContent = '';
    task.tips.forEach(function (t) { tips.appendChild(el('li', null, t)); });
    $('model').ontoggle = function () { if (this.open) track('model_open'); };

    // neighbours
    var same = D.writing.filter(function (t) { return t.level === task.level; });
    var i = same.indexOf(task);
    $('t-prev').hidden = i <= 0; if (i > 0) $('t-prev').href = '#' + same[i - 1].id;
    $('t-next').hidden = i >= same.length - 1; if (i < same.length - 1) $('t-next').href = '#' + same[i + 1].id;

    var key = 'dd-draft-' + task.id;
    if (task.kind === 'form') {
      $('text-mode').hidden = true; $('form-mode').hidden = false;
      var box = $('form-fields'); box.textContent = '';
      task.fields.forEach(function (f, n) {
        var wrap = el('p', { class: 'field' });
        var lab = el('label', { for: 'f' + n, lang: 'de' }, f[0]);
        if (f[1]) lab.appendChild(el('span', { class: 'en', lang: 'en' }, ' ' + f[1]));
        var inp = el('input', { id: 'f' + n, type: 'text', autocomplete: 'off', lang: 'de', spellcheck: 'false' });
        if (n === 0) { inp.value = f[2][0].replace(/\b\w/g, function (c) { return c.toUpperCase(); }); inp.readOnly = true; lab.appendChild(el('span', { class: 'en' }, ' (example)')); }
        wrap.appendChild(lab); wrap.appendChild(inp); box.appendChild(wrap);
      });
      $('form-check-btn').onclick = function () {
        var vals = task.fields.slice(1).map(function (f, n) { return $('f' + (n + 1)).value; });
        var res = window.DDCheck.checkForm(vals, task);
        var out = $('result'); out.hidden = false; out.textContent = '';
        var score = res.filter(function (r) { return r.ok; }).length;
        out.appendChild(el('h2', { id: 'result-title', tabindex: '-1' }, 'Your form: ' + score + ' of ' + res.length + ' fields correct'));
        var ul = el('ul', { class: 'checklist' });
        res.forEach(function (r) { var li = el('li', { class: r.ok ? 'ok' : 'bad' }, (r.ok ? '✓ ' : '✗ ') + r.label + ': ' + (r.value || '(empty)') + (r.ok ? '' : '  → expected: ' + r.expected)); ul.appendChild(li); });
        out.appendChild(ul);
        $('result-title').focus();
        track('check_done');
      };
      return;
    }
    $('text-mode').hidden = false; $('form-mode').hidden = true;
    var ta = $('answer');
    ta.value = store(key) || '';
    function wc() {
      var n = window.DDCheck.countWords(ta.value);
      $('wc').textContent = n + ' words · target ' + task.words[0] + '–' + task.words[1];
      $('wc').className = 'wc ' + (n < task.words[0] ? 'under' : n > task.words[1] ? 'over' : 'in');
    }
    ta.oninput = function () { wc(); store(key, ta.value); if (!timer.running() && timer.elapsed() === 0 && ta.value.length === 1) track('write_start'); };
    wc();
    $('clear-btn').onclick = function () { if (!ta.value || confirm('Delete your text for this task?')) { ta.value = ''; store(key, null); wc(); $('result').hidden = true; } };
    $('check-btn').onclick = function () { renderResult(window.DDCheck.check(ta.value, task), task); track('check_done'); };
  }

  function renderResult(r, task) {
    var out = $('result'); out.hidden = false; out.textContent = '';
    out.appendChild(el('h2', { id: 'result-title', tabindex: '-1' }, 'Self-check'));
    out.appendChild(el('p', { class: 'small' }, 'Rule-based, not a grade. It cannot judge meaning or style, and a flag means “look again”, not “wrong”.'));
    // 1 length
    var lenMsg = { empty: 'Write your text first.', 'far-short': 'Far too short. Under half the target can score 0 for the whole task.', short: 'A little short. Add a sentence to the weakest point.', ok: 'Length is in range.', long: 'A little long. That is usually fine, but more words means more chances for errors.', 'far-long': 'Much too long. Cut repetition; examiners do not reward extra length.' }[r.lengthState];
    var sec = section(out, '1. Length');
    sec.appendChild(el('p', { class: r.lengthState === 'ok' ? 'ok' : 'warn' }, r.words + ' words (target ' + r.range[0] + '–' + r.range[1] + '). ' + lenMsg));
    // 2 register
    if (r.register.length) {
      sec = section(out, task.register === 'forum' ? '2. Opinion text' : '2. Greeting, closing and “du / Sie”');
      var ul = el('ul', { class: 'checklist' });
      r.register.forEach(function (x) { ul.appendChild(el('li', { class: x.ok === true ? 'ok' : x.ok === false ? 'bad' : 'warn' }, (x.ok === true ? '✓ ' : x.ok === false ? '✗ ' : '? ') + x.label)); });
      sec.appendChild(ul);
    }
    // 3 points
    sec = section(out, '3. Content points: tick each one you really covered');
    sec.appendChild(el('p', { class: 'small' }, 'Each missing point costs a lot. “Found” only means we saw a likely keyword.'));
    var pl = el('ul', { class: 'checklist points-check' });
    r.points.forEach(function (p, i) {
      var li = el('li'); var id = 'pt' + i;
      var cb = el('input', { type: 'checkbox', id: id });
      var lab = el('label', { for: id, lang: 'de' }, p.de + ' ');
      lab.appendChild(el('span', { class: 'en', lang: 'en' }, p.en));
      li.appendChild(cb); li.appendChild(lab);
      li.appendChild(el('span', { class: p.hint ? 'hint ok' : 'hint warn' }, p.hint ? ' found: “' + p.matched.join('”, “') + '”' : ' not found: check this point'));
      pl.appendChild(li);
    });
    sec.appendChild(pl);
    // 4 connectors
    sec = section(out, '4. Connectors');
    var c = r.connectors;
    sec.appendChild(el('p', { class: c.found.length >= c.target ? 'ok' : 'warn' }, (c.found.length ? 'Used: ' + c.found.join(', ') + '. ' : 'None found. ') + (c.found.length >= c.target ? 'Good linking for ' + task.level + '.' : 'Aim for ' + c.target + ' or more at ' + task.level + '.')));
    if (task.level !== 'A1' && !c.subordinate.length) sec.appendChild(el('p', { class: 'warn' }, 'No “weil / dass / wenn” clause yet. One subordinate clause (verb at the end) shows ' + task.level + ' grammar.'));
    // 5 flags
    sec = section(out, '5. Possible errors (patterns common for Indian learners)');
    if (!r.flags.length) sec.appendChild(el('p', { class: 'ok' }, 'No pattern found. Still read the manual checklist below.'));
    r.flags.forEach(function (f) {
      var box = el('div', { class: 'flag' });
      box.appendChild(el('p', { class: 'flag-area' }, f.area));
      box.appendChild(el('p', null, f.msg));
      box.appendChild(el('p', { class: 'flag-hits', lang: 'de' }, 'In your text: “' + f.hits.join('”, “') + '”'));
      box.appendChild(el('p', { class: 'small', lang: 'de' }, 'Example: ' + f.fix));
      sec.appendChild(box);
    });
    // 6 manual
    sec = section(out, '6. Read once more for these');
    var man = ['Every noun: did you learn it with der / die / das? Check two you are unsure of.',
      'Verb in position 2 in every main clause; verb at the end after weil / dass / wenn.',
      'Nouns start with a capital letter; “Sie / Ihnen / Ihr” (polite you) too.',
      'ä, ö, ü, ß typed correctly (on Android, long-press a, o, u, s).',
      task.register === 'Sie' ? 'One register only: no “du / dein” in a formal e-mail.' : task.register === 'du' ? 'One register only: no “Sie / Ihnen” to a friend.' : 'Your opinion is clear in the first and last sentence.'];
    var ml = el('ul', { class: 'checklist' });
    man.forEach(function (m, i) { var li = el('li'); var cb = el('input', { type: 'checkbox', id: 'm' + i }); li.appendChild(cb); li.appendChild(el('label', { for: 'm' + i }, m)); ml.appendChild(li); });
    sec.appendChild(ml);
    var nx = el('p', { class: 'cta' });
    var a = el('a', { class: 'btn secondary', href: BASE + 'early-access.html', 'data-mesure': 'cta_click' }, 'Want detailed AI feedback on this text? Join early access');
    nx.appendChild(a); out.appendChild(nx);
    $('result-title').focus();
  }
  function section(out, title) { var s = el('section', { class: 'res-sec' }); s.appendChild(el('h3', null, title)); out.appendChild(s); return s; }

  /* ================================================================ speaking room */
  function speakRoom() {
    var root = $('speak-room'); if (!root) return;
    var id = (location.hash || '').slice(1);
    var p = D.speaking.filter(function (t) { return t.id === id; })[0];
    if (!p) { $('room-missing').hidden = false; return; }
    $('room-missing').hidden = true; $('task-view').hidden = false;
    document.title = p.title + ' · ' + p.level + ' speaking practice · DeutschDrill';
    $('t-meta').textContent = p.level + ' · ' + p.part;
    $('t-title').textContent = p.title;
    multiline($('t-task'), p.task_de);
    $('t-task-en').textContent = p.task_en;
    $('t-back').href = BASE + p.level.toLowerCase() + '.html#' + p.id;
    var cues = $('t-cues'); cues.textContent = '';
    p.cues.forEach(function (c) { cues.appendChild(el('li', { lang: 'de' }, c)); });
    var fol = $('t-followups'); fol.textContent = '';
    p.followups.forEach(function (q) { fol.appendChild(el('li', { lang: 'de' }, q)); });
    $('followups-box').hidden = !p.followups.length;
    multiline($('model-text'), p.model);
    var tips = $('model-tips'); tips.textContent = '';
    p.tips.forEach(function (t) { tips.appendChild(el('li', null, t)); });
    $('model').ontoggle = function () { if (this.open) track('model_open'); };
    $('t-en-toggle').onclick = function () { var h = $('t-task-en').hidden; $('t-task-en').hidden = !h; this.textContent = h ? 'Hide English' : 'Show in English'; this.setAttribute('aria-expanded', String(h)); };
    var same = D.speaking.filter(function (t) { return t.level === p.level; });
    var i = same.indexOf(p);
    $('t-prev').hidden = i <= 0; if (i > 0) $('t-prev').href = '#' + same[i - 1].id;
    $('t-next').hidden = i >= same.length - 1; if (i < same.length - 1) $('t-next').href = '#' + same[i + 1].id;

    var phase = $('phase'), clock = $('clock'), btn = $('go-btn'), skip = $('skip-btn');
    var state = 'idle';
    var prepT = new Timer(clock, function () { startSpeaking(); });
    var speakT = new Timer(clock, function () { finish(); });
    phase.textContent = p.prep >= 120 ? 'Preparation: ' + Math.round(p.prep / 60) + ' min (as in the exam)' : 'Read the card: ' + p.prep + ' s';
    clock.textContent = fmt(p.prep);
    btn.textContent = 'Start preparation';
    skip.hidden = true;
    btn.onclick = function () {
      if (state === 'idle') { state = 'prep'; prepT.set(p.prep); prepT.start(); btn.textContent = 'I am ready: start speaking'; skip.hidden = true; phase.textContent = 'Preparing… note keywords only.'; track('speak_start'); }
      else if (state === 'prep') { prepT.stop(); startSpeaking(); }
      else if (state === 'speak') { finish(); }
      else if (state === 'done') { reset(); }
    };
    function startSpeaking() {
      state = 'speak'; phase.textContent = 'Speak now: about ' + (p.speak >= 120 ? Math.round(p.speak / 60) + ' min' : p.speak + ' s');
      speakT.set(p.speak); speakT.start(); btn.textContent = 'Stop';
      if ($('rec-on').checked) Rec.start();
    }
    function finish() {
      speakT.stop(); prepT.stop(); state = 'done'; phase.textContent = 'Done. Listen back, then compare with the sample answer.';
      btn.textContent = 'Try again'; Rec.stop();
    }
    function reset() { state = 'idle'; prepT.set(p.prep); phase.textContent = 'Ready when you are.'; btn.textContent = 'Start preparation'; }
  }

  /* recorder: MediaRecorder, audio kept in memory only, never uploaded */
  var Rec = {
    rec: null, chunks: [], url: null, stream: null,
    supported: function () { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder); },
    start: function () {
      var self = this, status = $('rec-status');
      if (!this.supported()) { status.textContent = 'Recording is not supported in this browser. You can still use the timer.'; return; }
      this.clear();
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
        self.stream = stream; self.chunks = [];
        self.rec = new MediaRecorder(stream);
        self.rec.ondataavailable = function (e) { if (e.data && e.data.size) self.chunks.push(e.data); };
        self.rec.onstop = function () {
          var blob = new Blob(self.chunks, { type: self.rec.mimeType || 'audio/webm' });
          self.url = URL.createObjectURL(blob);
          var a = $('rec-audio'); a.src = self.url; a.hidden = false;
          var dl = $('rec-download'); dl.href = self.url; dl.download = 'deutschdrill-' + ((location.hash || '#rec').slice(1)) + (/(mp4|aac)/.test(blob.type) ? '.m4a' : /ogg/.test(blob.type) ? '.ogg' : '.webm'); dl.hidden = false;
          $('rec-delete').hidden = false;
          status.textContent = 'Recorded ' + Math.round(blob.size / 1024) + ' KB. It exists only in this tab: close the tab or press “Delete” and it is gone.';
          track('rec_done');
          stream.getTracks().forEach(function (t) { t.stop(); });
        };
        self.rec.start();
        status.textContent = '● Recording on this device…';
        track('rec_start');
      }).catch(function () { status.textContent = 'No microphone access. Allow it in your browser settings, or practise with the timer only.'; });
    },
    stop: function () { if (this.rec && this.rec.state !== 'inactive') this.rec.stop(); },
    clear: function () {
      if (this.url) URL.revokeObjectURL(this.url);
      this.url = null; this.chunks = [];
      var a = $('rec-audio'); if (a) { a.removeAttribute('src'); a.hidden = true; }
      if ($('rec-download')) { $('rec-download').hidden = true; $('rec-download').removeAttribute('href'); }
      if ($('rec-delete')) $('rec-delete').hidden = true;
    }
  };
  document.addEventListener('click', function (e) { if (e.target && e.target.id === 'rec-delete') { Rec.clear(); $('rec-status').textContent = 'Recording deleted.'; } });

  /* ================================================================ early access (fake door) */
  var PRICES = {
    p499: { inr: { monthly: '₹499', pass3: '₹1,999' }, usd: { monthly: '$6', pass3: '$24' } },
    p799: { inr: { monthly: '₹799', pass3: '₹1,999' }, usd: { monthly: '$10', pass3: '$24' } }
  };
  // Price arm: drawn by Octave cro.js (window.OCTAVE_XP 'price': once per tab, sessionStorage, ?p=499|799 forces one).
  function variant() {
    try { sessionStorage.removeItem('dd-v'); } catch (e) { /* old draw key, no longer used */ }
    var v = window.octaveCro && window.octaveCro.v('price');
    return PRICES[v] ? v : 'p799'; // without cro.js: the price printed in the page
  }
  function earlyPage() {
    var form = $('early-form'); if (!form) return;
    var v = variant(); window.DD_VARIANT = v;
    var cur = 'inr';
    function paint() {
      var P = PRICES[v][cur];
      document.querySelectorAll('[data-price]').forEach(function (n) { n.textContent = P[n.getAttribute('data-price')]; });
      document.querySelectorAll('[data-cur]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-cur') === cur)); });
      window.DD_CURRENCY = cur;
    }
    document.querySelectorAll('[data-cur]').forEach(function (b) {
      b.onclick = function () { cur = b.getAttribute('data-cur'); paint(); track('currency_switch'); };
    });
    paint();
    track('offer_view');
    var started = false;
    form.addEventListener('input', function () { if (!started) { started = true; track('form_start'); } });
    form.onsubmit = function (e) {
      e.preventDefault();
      var msg = $('form-msg'); msg.className = 'form-msg';
      var email = form.email.value.trim();
      var offer = (form.querySelector('input[name=offer]:checked') || {}).value;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { msg.textContent = 'Please enter a valid e-mail address.'; msg.className += ' bad'; form.email.focus(); return; }
      if (!offer) { msg.textContent = 'Please choose what you are interested in.'; msg.className += ' bad'; return; }
      if (!form.consent.checked) { msg.textContent = 'Please tick the consent box: we can only store your e-mail with your consent.'; msg.className += ' bad'; form.consent.focus(); return; }
      var body = {
        action: 'early', email: email, level: form.level.value, exam: form.exam.value, exam_month: form.exam_month.value,
        offer: offer, plan: (form.querySelector('input[name=plan]:checked') || {}).value || 'monthly', currency: cur, variant: v,
        consent: true, hp: form.website.value, page: location.pathname,
        utm_source: new URLSearchParams(location.search).get('utm_source') || ''
      };
      var btn = form.querySelector('button[type=submit]'); btn.disabled = true; msg.textContent = 'Sending…';
      fetch(D.endpoint, { method: 'POST', body: JSON.stringify(body), credentials: 'omit', headers: { 'Content-Type': 'text/plain;charset=utf-8' } })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (!j.ok) throw new Error(j.error || 'error');
          form.hidden = true; $('early-done').hidden = false; $('early-done').focus();
          track('form_submit');
          if (window.octaveCro && !body.hp) window.octaveCro.goal('waitlist');
        })
        .catch(function () { btn.disabled = false; msg.textContent = 'Sorry, that did not go through. Try again, or e-mail octave@vread.fr.'; msg.className += ' bad'; });
    };
  }

  function init() { writeRoom(); speakRoom(); earlyPage(); }
  window.addEventListener('hashchange', function () { TIMERS.forEach(function (t) { t.stop(); }); TIMERS = []; Rec.stop(); Rec.clear(); var r = $('result'); if (r) r.hidden = true; init(); window.scrollTo(0, 0); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
