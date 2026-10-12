# DeutschDrill: free German A1–B1 writing and speaking practice (India)

Live: https://outils.vread.fr/deutschdrill/ · Venture AS-IN-06 of READ FRANCE SAS (Octave global ventures).

- 36 original writing tasks (12 per level) with model answers and a rule-based self-check (`assets/check.js`): word count, greeting/closing and du/Sie, content-point hints, connectors, 17 error patterns common for Indian learners, manual checklist.
- 18 original speaking prompts (6 per level) with preparation/speaking timers and a MediaRecorder recorder. Audio stays in the tab; it is never uploaded.
- Exam-day guide for India: official Goethe locations, fees in INR with sources (read 2026-10-13), passport-only ID rule, booking tips.
- Fake door `early-access.html`: "Expert-style feedback on your writing within 24 h" and "Mock speaking exam", AI-generated (disclosed), no payment. Price arms ₹499 vs ₹799/month (`?p=499|799` forces one), ₹1,999 for 3 months; USD switch ($6 / $10, $24).

**Not affiliated with the Goethe-Institut or telc.** Formats only (task types, timings, word counts, criteria) follow their public descriptions, cited on each level page. No exam material is copied.

## Layout
- `data/writing.py`, `data/speaking.py`: all German content (original). `content/*.html`: pages. `build.py`: stdlib generator → `_site/`.
- `assets/check.js` (self-check, also used by Node tests), `assets/app.js` (rooms, form), `assets/mesure.js` (anonymous counter).
- `gas/src/Code.js`: own Apps Script web app bound to its own Sheet (not octave-checkout). Actions `track`, `early`; GET `ping`, `init`, `stats&key=`.
- `docs/channels.md`: acquisition channels and rules (nothing posted).

## Commands
```sh
python3 build.py && python3 tests/test_site.py && node --test tests/unit/*.test.mjs
npm i && npx playwright test            # e2e at 390 px and 1440 px, screenshots in shots/
BASE_URL=https://outils.vread.fr/deutschdrill/ npx playwright test   # against the live site
node scripts/indexnow.mjs               # ping IndexNow with every sitemap URL
```

## Backend
- Script: `1L_ED8O2OCcovByipGDDuH0YMpJsyxAg3Iq3bf2VJaxGGPjTL6zP2-9Au`, Sheet `1t_9ww2e_46ybuGHmvBxC88PS7CzBvYiVWwP0XHaSJI4` (tabs `Stats`, `EarlyAccess`), web app deployment `AKfycbwYciG66y1Cc4kndgN7Zc71rnzKngdZsOYvK96VUPZqxiPDKW4DuSuYEoI-61Wwyv36`.
- Stats key: `~/.config/octave/deutschdrill.env` (never committed). Redeploy: `cd gas && clasp push --force && clasp deploy -i <deploymentId>` (clasp at `~/.local/share/octave-clasp/node_modules/.bin/clasp`).
- Tracking: no cookie, no identifier, no IP, DNT/GPC respected; daily counters only.

Content: CC BY 4.0 · Code: MIT · Contact: octave@vread.fr
