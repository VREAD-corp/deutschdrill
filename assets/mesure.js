/*! DeutschDrill anonymous audience counter (same pattern as octave-checkout's mesure.js).
   No cookie, no identifier, no IP stored, credentials omitted. Respects Do Not Track and Global
   Privacy Control. Sends: page path, event name, referrer domain, utm_source/medium/campaign,
   device class (mobile/desktop), and on the early-access page the price arm and currency shown.
   Not visits: our own tests (?octave_notrack=1, remembered in this browser; =0 clears it), automated browsers
   (navigator.webdriver) and crawlers/headless browsers (user agent checked here, never sent). Their hits carry
   `excluded: reason` and land in a separate counter. A prerendered page counts only once actually opened. */
((n, l, d) => {
  let ep = 'https://script.google.com/macros/s/AKfycbwYciG66y1Cc4kndgN7Zc71rnzKngdZsOYvK96VUPZqxiPDKW4DuSuYEoI-61Wwyv36/exec', q = new URLSearchParams(l.search), b, t;
  window.ddTrack = () => {};
  if (n.doNotTrack == '1' || n.globalPrivacyControl || l.hostname != 'outils.vread.fr' || !l.pathname.startsWith('/deutschdrill/')) return;
  let x = '', s;
  try { s = localStorage; if (q.has('octave_notrack')) q.get('octave_notrack') == '1' ? s.setItem('octave_notrack', '1') : s.removeItem('octave_notrack'); if (s.getItem('octave_notrack') == '1') x = 'notrack'; } catch (e) { /* ignore */ }
  x = x || (q.get('octave_notrack') == '1' ? 'notrack' : n.webdriver ? 'webdriver'
    : /bot\b|crawl|spider|slurp|headless|lighthouse|pagespeed|inspectiontool|googleother|mediapartners|bingpreview|phantom|puppeteer|playwright|selenium/i.test(n.userAgent || '') ? 'bot' : '');
  b = { action: 'track', page: l.pathname, ref_domain: (d.referrer.split('/')[2] || ''), device: innerWidth < 768 ? 'mobile' : 'desktop' };
  for (const k of ['source', 'medium', 'campaign']) b['utm_' + k] = q.get('utm_' + k);
  if (x) b.excluded = x;
  t = (ev) => { b.event = ev; b.variant = window.DD_VARIANT || ''; b.currency = window.DD_CURRENCY || ''; try { fetch(ep, { method: 'POST', keepalive: !0, credentials: 'omit', redirect: 'manual', body: JSON.stringify(b) }).catch(() => 0); } catch (e) { /* ignore */ } };
  window.ddTrack = t;
  const go = () => { t('view'); if (/exam-day-india/.test(l.pathname)) t('guide_view'); };
  d.addEventListener('DOMContentLoaded', () => {
    if (d.prerendering) d.addEventListener('prerenderingchange', go, { once: true });
    else if (d.visibilityState == 'prerender') { const w = () => { if (d.visibilityState != 'prerender') { d.removeEventListener('visibilitychange', w); go(); } }; d.addEventListener('visibilitychange', w); }
    else go();
  });
  d.addEventListener('click', (e) => { const a = e.target.closest && e.target.closest('a,button'); const h = a && a.dataset.mesure; if (h) t(h); }, !0);
  d.addEventListener('toggle', (e) => { const x = e.target; if (x.open && x.dataset && x.dataset.mesureOpen) t(x.dataset.mesureOpen); }, !0);
})(navigator, location, document);
