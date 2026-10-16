#!/usr/bin/env python3
"""Static checks on _site/ (stdlib only). Exit 1 on any failure.
- every page: lang, <title>, meta description, canonical, exactly one <h1>, footer identity and disclaimer
- every internal link and asset resolves to a built file; #anchors exist on level pages
- no third-party scripts except none; no http:// links; sitemap lists indexable pages
- no mention suggesting affiliation ("official partner", "authorised by")
"""
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

OUT = Path(__file__).resolve().parent.parent / "_site"
BASE = "/"
errors = []


class P(HTMLParser):
    def __init__(self):
        super().__init__()
        self.h1 = 0; self.links = []; self.ids = set(); self.scripts = []; self.lang = None; self.canon = None; self.desc = None; self.noindex = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if "id" in a: self.ids.add(a["id"])
        if tag == "html": self.lang = a.get("lang")
        if tag == "h1": self.h1 += 1
        if tag == "a" and a.get("href"): self.links.append(a["href"])
        if tag == "link" and a.get("rel") == "canonical": self.canon = a.get("href")
        if tag == "link" and a.get("href") and a.get("rel") in ("stylesheet", "icon"): self.links.append(a["href"])
        if tag == "script" and a.get("src"): self.scripts.append(a["src"])
        if tag == "meta" and a.get("name") == "description": self.desc = a.get("content")
        if tag == "meta" and a.get("name") == "robots" and "noindex" in (a.get("content") or ""): self.noindex = True


pages = {}
for f in sorted(OUT.glob("*.html")):
    txt = f.read_text(encoding="utf-8")
    p = P(); p.feed(txt); pages[f.name] = (p, txt)
    if p.lang != "en-IN": errors.append(f"{f.name}: lang")
    if p.h1 != 1: errors.append(f"{f.name}: {p.h1} h1")
    if not p.desc or len(p.desc) > 200: errors.append(f"{f.name}: description missing or > 200 chars ({len(p.desc or '')})")
    if not p.canon: errors.append(f"{f.name}: canonical")
    for k in ("A Jalonel brand", "https://jalonel.com/en/", "octave@vread.fr", "Not affiliated with"):
        if k not in txt: errors.append(f"{f.name}: footer lacks {k}")
    if re.search(r"official partner|authori[sz]ed by goethe|in cooperation with goethe|goethe-approved", txt, re.I): errors.append(f"{f.name}: affiliation wording")
    if "http://" in txt.replace("http://www.sitemaps.org", ""): errors.append(f"{f.name}: http:// link")
    for s in p.scripts:
        if not s.startswith(BASE): errors.append(f"{f.name}: third-party script {s}")
    # Octave cro.js on every page, after its OCTAVE_XP config and before any script that reads the price arm
    cro = [i for i, s in enumerate(p.scripts) if s.startswith(BASE + "assets/cro.js?v=")]
    app = [i for i, s in enumerate(p.scripts) if s.startswith(BASE + "assets/app.js")]
    if len(cro) != 1: errors.append(f"{f.name}: cro.js tag missing")
    elif app and app[0] < cro[0]: errors.append(f"{f.name}: cro.js after app.js")
    xp = txt.find("window.OCTAVE_XP = ")
    if xp < 0 or xp > txt.find("assets/cro.js"): errors.append(f"{f.name}: OCTAVE_XP must precede cro.js")
    if 'data-site="deutschdrill"' not in txt or 'type="module" src="/assets/cro.js' in txt or 'data-hosts="deutschdrill.jalonel.com outils.vread.fr"' not in txt: errors.append(f"{f.name}: cro.js attributes")

for name, (p, txt) in pages.items():
    for href in p.links:
        u = urlparse(href)
        if u.scheme in ("http", "https", "mailto"):
            continue
        path = u.path
        if not path:
            if u.fragment and u.fragment not in p.ids and name not in ("write.html", "speak.html"):
                errors.append(f"{name}: missing anchor #{u.fragment}")
            continue
        if not path.startswith(BASE): errors.append(f"{name}: relative link {href}"); continue
        rel = path[len(BASE):] or "index.html"
        if not (OUT / rel).exists(): errors.append(f"{name}: broken link {href}"); continue
        if u.fragment and rel in pages and rel not in ("write.html", "speak.html") and u.fragment not in pages[rel][0].ids:
            errors.append(f"{name}: missing anchor {href}")

sm = (OUT / "sitemap.xml").read_text()
for name, (p, _) in pages.items():
    loc = "https://deutschdrill.jalonel.com" + BASE + ("" if name == "index.html" else name)
    if not p.noindex and f"<loc>{loc}</loc>" not in sm: errors.append(f"sitemap lacks {name}")
    if p.noindex and f"<loc>{loc}</loc>" in sm: errors.append(f"sitemap lists noindex {name}")

if (OUT / "assets" / "cro.js").read_bytes() != (OUT.parent / "assets" / "cro.js").read_bytes(): errors.append("_site cro.js differs")
if '"id": "price", "variants": ["p499", "p799"], "mode": "tab", "param": "p", "pages": "early-access"' not in pages["early-access.html"][1]:
    errors.append("early-access.html: price experiment config")

if errors:
    print("\n".join(errors)); sys.exit(1)
print(f"site OK: {len(pages)} pages")
