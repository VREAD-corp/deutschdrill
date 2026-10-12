/*! DeutschDrill anonymous audience counter (same pattern as octave-checkout's mesure.js).
   No cookie, no identifier, no IP stored, credentials omitted. Respects Do Not Track and Global
   Privacy Control. Sends: page path, event name, referrer domain, utm_source/medium/campaign,
   device class (mobile/desktop), and on the early-access page the price arm and currency shown. */
((n, l, d) => {
  let ep = 'https://script.google.com/macros/s/AKfycbwYciG66y1Cc4kndgN7Zc71rnzKngdZsOYvK96VUPZqxiPDKW4DuSuYEoI-61Wwyv36/exec', q = new URLSearchParams(l.search), b, t;
  window.ddTrack = () => {};
  if (n.doNotTrack == '1' || n.globalPrivacyControl || l.hostname != 'outils.vread.fr' || !l.pathname.startsWith('/deutschdrill/')) return;
  b = { action: 'track', page: l.pathname, ref_domain: (d.referrer.split('/')[2] || ''), device: innerWidth < 768 ? 'mobile' : 'desktop' };
  for (const k of ['source', 'medium', 'campaign']) b['utm_' + k] = q.get('utm_' + k);
  t = (ev) => { b.event = ev; b.variant = window.DD_VARIANT || ''; b.currency = window.DD_CURRENCY || ''; try { fetch(ep, { method: 'POST', keepalive: !0, credentials: 'omit', redirect: 'manual', body: JSON.stringify(b) }).catch(() => 0); } catch (e) { /* ignore */ } };
  window.ddTrack = t;
  d.addEventListener('DOMContentLoaded', () => { t('view'); if (/exam-day-india/.test(l.pathname)) t('guide_view'); });
  d.addEventListener('click', (e) => { const a = e.target.closest && e.target.closest('a,button'); const h = a && a.dataset.mesure; if (h) t(h); }, !0);
  d.addEventListener('toggle', (e) => { const x = e.target; if (x.open && x.dataset && x.dataset.mesureOpen) t(x.dataset.mesureOpen); }, !0);
})(navigator, location, document);
