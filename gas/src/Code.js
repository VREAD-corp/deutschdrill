/**
 * DeutschDrill backend: a Google Apps Script web app bound to its own Sheet.
 * Operator: READ FRANCE SAS (SIREN 988 741 773, Paris), run by Octave, an AI agent.
 * Separate from octave-checkout and from the Vread app: own script, own Sheet, own deployment.
 *
 * POST text/plain JSON (no CORS preflight):
 *   {action:'track', event, page, variant, currency, device, ref_domain, utm_source, utm_medium, utm_campaign}
 *       -> daily counters in the `Stats` tab. No IP (Apps Script never sees it), no user agent, no cookie,
 *          no identifier: whitelisted fields only, one counter row per day x page x event x variant x source.
 *   {action:'early', email, level, exam, exam_month, offer, plan, currency, variant, consent, hp, page, utm_source}
 *       -> one row in `EarlyAccess`. Nothing is charged: early-access list only, no payment exists.
 * GET ?action=ping            -> {ok:true}
 * GET ?action=init            -> first call creates the tabs and returns the stats key once.
 * GET ?action=stats&key=...   -> one day's counters + early-access count (key in Script Properties).
 */

var SITE_ = 'deutschdrill';
var TZ_ = 'Asia/Kolkata';
var STATS_HEADER_ = ['date', 'page', 'event', 'variant', 'currency', 'source', 'medium', 'campaign', 'count', 'mobile', 'desktop', 'updated_at'];
var STATS_KEYS_ = 8;
var EARLY_HEADER_ = ['at', 'email', 'level', 'exam', 'exam_month', 'offer', 'plan', 'currency', 'variant', 'price_shown', 'source', 'page', 'status'];
var EVENTS_ = ['view', 'cta_click', 'write_start', 'check_done', 'model_open', 'speak_start', 'rec_start', 'rec_done',
  'offer_view', 'currency_switch', 'form_start', 'form_submit', 'guide_view', 'outbound_official'];
var PAGES_ = ['/', '/a1.html', '/a2.html', '/b1.html', '/write.html', '/speak.html', '/exam-day-india.html',
  '/early-access.html', '/how-it-works.html', '/privacy.html', '/terms.html', '/legal.html', '/404.html'];
var VARIANTS_ = ['', 'p499', 'p799'];
var CURRENCIES_ = ['', 'inr', 'usd'];
var LEVELS_ = ['a1', 'a2', 'b1', 'b2', 'unsure'];
var EXAMS_ = ['goethe', 'telc', 'osd', 'other', 'unsure'];
var OFFERS_ = ['writing', 'speaking', 'both'];
var PLANS_ = ['monthly', 'pass3'];
var PRICES_ = {
  p499: { inr: { monthly: '₹499/month', pass3: '₹1,999 for 3 months' }, usd: { monthly: '$6/month', pass3: '$24 for 3 months' } },
  p799: { inr: { monthly: '₹799/month', pass3: '₹1,999 for 3 months' }, usd: { monthly: '$10/month', pass3: '$24 for 3 months' } }
};
var EMAIL_RE_ = /^[^\s@<>()",;:]{1,64}@[A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,}$/;
var OWN_HOSTS_ = ['outils.vread.fr', 'vread-corp.github.io'];

function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    if (p.action === 'init') {
      var props = PropertiesService.getScriptProperties();
      if (props.getProperty('STATS_KEY')) return json_({ ok: true, already: true });
      return json_({ ok: true, key: setup() });
    }
    if (p.action === 'stats') {
      var key = PropertiesService.getScriptProperties().getProperty('STATS_KEY');
      if (!key || p.key !== key) return json_({ ok: false, error: 'forbidden' });
      var d = /^\d{4}-\d{2}-\d{2}$/.test(p.date || '') ? p.date : today_();
      return json_({ ok: true, date: d, rows: statsOfDay_(d), early: earlyCount_() });
    }
    return json_({ ok: true, service: SITE_ });
  } catch (err) {
    console.error(String(err && err.stack || err));
    return json_({ ok: false, error: 'server' });
  }
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, error: 'bad_json' });
  }
  if (!body || typeof body !== 'object') return json_({ ok: false, error: 'bad_json' });
  try {
    if (body.action === 'track') return json_(track_(body));
    if (body.action === 'early') return json_(early_(body));
    return json_({ ok: false, error: 'unknown_action' });
  } catch (err) {
    if (err && err.user) return json_({ ok: false, error: err.code });
    console.error(String(err && err.stack || err));
    return json_({ ok: false, error: 'server' });
  }
}

/** Creates the tabs and a random stats key. Run once (also reachable via ?action=init on first call). */
function setup() {
  tab_('Stats', STATS_HEADER_);
  tab_('EarlyAccess', EARLY_HEADER_);
  var key = Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('STATS_KEY', key);
  return key;
}

/* ---------------- helpers ---------------- */

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function userError_(code) { var e = new Error(code); e.user = true; e.code = code; return e; }
function today_() { return Utilities.formatDate(new Date(), TZ_, 'yyyy-MM-dd'); }
function token_(v, max) { return v === undefined || v === null ? '' : String(v).toLowerCase().replace(/[^a-z0-9._ -]+/g, '').replace(/\s+/g, ' ').trim().slice(0, max); }
function pick_(v, list) { v = String(v === undefined || v === null ? '' : v).toLowerCase(); return list.indexOf(v) >= 0 ? v : ''; }
/** Neutralises spreadsheet formulas in user-supplied text. */
function txt_(v) { var s = String(v === undefined || v === null ? '' : v); return /^[=+\-@\t\r]/.test(s) ? "'" + s : s; }

function tab_(name, header) {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(header);
    sh.setFrozenRows(1);
  }
  return sh;
}

function rateOk_(bucket, perMinute) {
  var cache = CacheService.getScriptCache();
  var k = 'rl:' + bucket + ':' + Math.floor(Date.now() / 60000);
  var n = Number(cache.get(k) || 0);
  if (n >= perMinute) return false;
  cache.put(k, String(n + 1), 120);
  return true;
}

function page_(p) {
  var s = String(p || '/').toLowerCase().replace(/[?#].*$/, '').replace(/^\/deutschdrill/, '');
  s = s.replace(/\/index\.html$/, '/') || '/';
  return PAGES_.indexOf(s) >= 0 ? s : '(other)';
}

/* ---------------- tracking ---------------- */

function track_(req) {
  var event = String(req.event || '');
  if (EVENTS_.indexOf(event) < 0) throw userError_('bad_event');
  var ref = String(req.ref_domain || '').toLowerCase().replace(/^www\./, '');
  if (ref && !/^[a-z0-9.-]{1,100}$/.test(ref)) ref = '';
  if (OWN_HOSTS_.indexOf(ref) >= 0) ref = '(internal)';
  var hit = {
    date: today_(),
    page: page_(req.page),
    event: event,
    variant: pick_(req.variant, VARIANTS_),
    currency: pick_(req.currency, CURRENCIES_),
    source: token_(req.utm_source, 40) || ref || '(direct)',
    medium: token_(req.utm_medium, 30),
    campaign: token_(req.utm_campaign, 40),
    device: req.device === 'mobile' || req.device === 'desktop' ? req.device : ''
  };
  if (!rateOk_('track', 300)) return { ok: false, error: 'rate_limited' };
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) return { ok: false, error: "busy" };
  try { increment_(hit); } finally { lock.releaseLock(); }
  return { ok: true };
}

function increment_(h) {
  var sh = tab_('Stats', STATS_HEADER_);
  var keyCells = [h.date, h.page, h.event, h.variant, h.currency, h.source, h.medium, h.campaign];
  var key = keyCells.join('\u001f');
  var last = sh.getLastRow();
  var n = Math.min(Math.max(last - 1, 0), 3000);
  var rowNum = 0;
  if (n > 0) {
    var vals = sh.getRange(last - n + 1, 1, n, STATS_KEYS_).getDisplayValues();
    for (var i = vals.length - 1; i >= 0; i--) {
      if (vals[i][0] < h.date) break;
      if (vals[i].join('\u001f') === key) { rowNum = last - n + 1 + i; break; }
    }
  }
  var now = new Date().toISOString();
  if (!rowNum) {
    sh.appendRow(keyCells.map(txt_).concat([1, h.device === 'mobile' ? 1 : 0, h.device === 'desktop' ? 1 : 0, now]));
  } else {
    var r = sh.getRange(rowNum, STATS_KEYS_ + 1, 1, 4);
    var c = r.getValues()[0];
    r.setValues([[Number(c[0] || 0) + 1, Number(c[1] || 0) + (h.device === 'mobile' ? 1 : 0), Number(c[2] || 0) + (h.device === 'desktop' ? 1 : 0), now]]);
  }
}

function statsOfDay_(date) {
  var sh = tab_('Stats', STATS_HEADER_);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var n = Math.min(last - 1, 3000);
  var vals = sh.getRange(last - n + 1, 1, n, STATS_HEADER_.length).getDisplayValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    if (vals[i][0] !== date) continue;
    var o = {};
    STATS_HEADER_.forEach(function (k, j) { o[k] = j >= STATS_KEYS_ && j < STATS_KEYS_ + 3 ? Number(vals[i][j]) : vals[i][j]; });
    out.push(o);
  }
  return out;
}

/* ---------------- early access (fake door: no payment) ---------------- */

function early_(req) {
  if (req.hp) return { ok: true }; // honeypot: silently accept, store nothing
  var email = String(req.email || '').trim().slice(0, 254);
  if (!EMAIL_RE_.test(email)) throw userError_('bad_email');
  if (req.consent !== true && req.consent !== 'true') throw userError_('no_consent');
  var offer = pick_(req.offer, OFFERS_);
  if (!offer) throw userError_('bad_offer');
  var variant = pick_(req.variant, VARIANTS_) || 'p799';
  var currency = pick_(req.currency, CURRENCIES_) || 'inr';
  var plan = pick_(req.plan, PLANS_) || 'monthly';
  var month = /^\d{4}-\d{2}$/.test(String(req.exam_month || '')) ? String(req.exam_month) : '';
  if (!rateOk_('early', 30)) return { ok: false, error: 'rate_limited' };
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) return { ok: false, error: "busy" };
  try {
    var sh = tab_('EarlyAccess', EARLY_HEADER_);
    var status = 'new';
    var last = sh.getLastRow();
    if (last > 1) {
      var emails = sh.getRange(2, 2, last - 1, 1).getDisplayValues();
      for (var i = 0; i < emails.length; i++) if (emails[i][0].toLowerCase() === email.toLowerCase()) { status = 'duplicate'; break; }
    }
    sh.appendRow([new Date().toISOString(), txt_(email), pick_(req.level, LEVELS_), pick_(req.exam, EXAMS_), month, offer, plan,
      currency, variant, PRICES_[variant][currency][plan], token_(req.utm_source, 40) || '(direct)', page_(req.page), status]);
  } finally {
    lock.releaseLock();
  }
  return { ok: true };
}

function earlyCount_() {
  var sh = tab_('EarlyAccess', EARLY_HEADER_);
  return Math.max(sh.getLastRow() - 1, 0);
}
