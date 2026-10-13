#!/usr/bin/env python3
"""DeutschDrill static site builder (stdlib only).

Reads site.json, data/writing.py, data/speaking.py and content/*.html fragments (front matter in a
leading HTML comment), generates the three level pages (a1/a2/b1.html), wraps everything in one
layout and writes _site/ with sitemap.xml, robots.txt, 404.html and assets/data.js.
Placeholders usable in fragments: {{base}}, {{endpoint}}, {{contact}}, {{repo_url}}, {{updated}}.
"""
import hashlib
import html
import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
# Cache-busting for mesure.js: crawlers' renderers keep an old copy of the same URL.
MESURE_V = hashlib.sha256((ROOT / 'assets' / 'mesure.js').read_bytes()).hexdigest()[:8]
CRO_V = hashlib.sha256((ROOT / 'assets' / 'cro.js').read_bytes()).hexdigest()[:8]
# Octave cro.js (vendored byte-identical from octave-checkout): aggregate behaviour counters + A/B variants.
# Price test on the early-access page: one uniform draw per tab (sessionStorage), ?p=499|799 forces an arm.
OCTAVE_XP = [{"id": "price", "variants": ["p499", "p799"], "mode": "tab", "param": "p", "pages": "early-access"}]
# Primary CTAs for time-to-first-click: practice/early-access buttons, the form submit and the room actions.
CRO_CTA = "[data-mesure=cta_click],#early-form button[type=submit],#check-btn,#form-check-btn,#go-btn"
OUT = ROOT / "_site"
sys.path.insert(0, str(ROOT / "data"))
from writing import WRITING  # noqa: E402
from speaking import SPEAKING  # noqa: E402

E = html.escape
SITE = json.loads((ROOT / "site.json").read_text(encoding="utf-8"))
SITE["repo_url"] = "https://github.com/" + SITE["repo"]

GOETHE_IN = "https://www.goethe.de/ins/in/en/spr/prf.html"
SRC = {
    "a1_page": ("Goethe-Institut India, Goethe-Zertifikat A1: Start Deutsch 1", "https://www.goethe.de/ins/in/en/spr/prf/gzsd1.cfm"),
    "a1_desc": ("Goethe-Institut, “Prüfungsziele, Testbeschreibung A1: Start Deutsch 1” (PDF), writing p. 37, speaking pp. 45–52",
                "https://www.goethe.de/pro/relaunch/prf/en/Pruefungsziele_Testbeschreibung_A1_SD1.pdf"),
    "a2_page": ("Goethe-Institut India, Goethe-Zertifikat A2", "https://www.goethe.de/ins/in/en/spr/prf/gzsd2.cfm"),
    "a2_train": ("Goethe-Institut India, free A2 exam training (model test, PDF)", "https://www.goethe.de/ins/in/en/spr/prf/ueb/pa2.html"),
    "b1_page": ("Goethe-Institut India, Goethe-Zertifikat B1", "https://www.goethe.de/ins/in/en/spr/prf/gzb1.cfm"),
    "b1_train": ("Goethe-Institut India, free B1 exam training (model test, PDF)", "https://www.goethe.de/ins/in/en/spr/prf/ueb/pb1.html"),
    "b1_rules": ("Goethe-Institut, B1 terms and conditions for exam administration (PDF), §3 Speaking",
                 "https://www.goethe.de/pro/relaunch/prf/en/Durchfuehrungsbestimmungen_B1.pdf"),
    "telc_a1": ("telc, Start Deutsch 1 / telc Deutsch A1", "https://www.telc.net/en/language-examinations/certificate-exams/german/start-german1-telc-german-a1/"),
    "telc_a2": ("telc, Start Deutsch 2 / telc Deutsch A2", "https://www.telc.net/en/language-examinations/certificate-exams/german/start-german-2-telc-german-a2/"),
    "telc_b1": ("telc, Zertifikat Deutsch / telc Deutsch B1", "https://www.telc.net/en/language-examinations/certificate-exams/german/certificate-german-telc-german-b1/"),
}

LEVELS = {
    "A1": {
        "slug": "a1.html",
        "title": "German A1 writing and speaking practice (Goethe/telc format)",
        "desc": "12 original A1 writing tasks with model answers and a self-check, 6 speaking prompts with a timer and a private recorder. Goethe A1 exam fee in India: ₹9,400.",
        "lead": "The Goethe-Institut lists A1 as the language certificate for the spousal reunification visa. The writing part takes 20 minutes; the speaking part is a group exam of about 15 minutes.",
        "writing_rows": [
            ["Part 1: form", "Fill in 5 missing details in a form, using a short text that explains the situation", "5 points, one per field"],
            ["Part 2: short message", "A note or e-mail of about 30 words that covers 3 given points, with a greeting and a closing", "10 points: up to 3 per content point, 1 for the text type. Spelling only costs points when it blocks understanding"],
        ],
        "writing_time": "20 minutes for both parts, no dictionary",
        "speaking_rows": [
            ["Part 1: introduce yourself", "Say who you are using keywords, spell a word, say a number", "about 80 seconds per candidate"],
            ["Part 2: ask and answer", "Ask a question with a word card on a topic and answer your partner's question", "about 60 seconds per candidate, two rounds"],
            ["Part 3: requests", "Make a request from a picture card and react to your partner's request", "about 60 seconds per candidate"],
        ],
        "speaking_note": "The examiners rate whether you are understood, not how many mistakes you make: a sentence with errors can get full points if the meaning is clear.",
        "telc": "telc's Start Deutsch 1 / telc Deutsch A1 has a 45-minute reading-and-writing block (3 reading parts and 2 writing parts) and a speaking part of about 15 minutes, usually with 4 candidates and no preparation time.",
        "sources": ["a1_page", "a1_desc", "telc_a1"],
    },
    "A2": {
        "slug": "a2.html",
        "title": "German A2 writing and speaking practice (Goethe/telc format)",
        "desc": "12 original A2 writing tasks (20–30 and 30–40 word messages) with model answers and a self-check, plus 6 speaking prompts with a timer. Goethe A2 fee in India: ₹10,600.",
        "lead": "At A2 you write two short messages in 30 minutes and speak with a partner for about 15 minutes. Both texts must cover three given points.",
        "writing_rows": [
            ["Part 1: informal message", "A text message or note to a friend, 20 to 30 words, covering 3 points", "Task completion, register, range and accuracy"],
            ["Part 2: semi-formal e-mail", "An e-mail to a colleague, landlord, teacher or office, 30 to 40 words, covering 3 points", "Same criteria. Under half the word count (fewer than 10 or 15 words) scores 0"],
        ],
        "writing_time": "30 minutes for both parts, no dictionary or phone",
        "speaking_rows": [
            ["Part 1: questions about you", "Ask your partner 4 questions with word cards and answer theirs", "pair exam"],
            ["Part 2: talk about your life", "Tell the examiner about your life using a card with 4 keywords", "about 1 to 2 minutes"],
            ["Part 3: plan something", "Find a time for an activity with your partner, using your own diary", "negotiate and agree"],
        ],
        "speaking_note": "The rating covers task completion, range and accuracy of language, and pronunciation.",
        "telc": "telc's Start Deutsch 2 / telc Deutsch A2 has a 50-minute reading-and-writing block (3 reading parts, 2 writing parts) and a speaking part of about 15 minutes, usually with 2 candidates and no preparation time.",
        "sources": ["a2_page", "a2_train", "telc_a2"],
    },
    "B1": {
        "slug": "b1.html",
        "title": "German B1 writing and speaking practice (Goethe/telc format)",
        "desc": "12 original B1 writing tasks (80-word e-mail, 80-word forum opinion, 40-word formal e-mail) and 6 speaking prompts with 15-minute preparation timer. Goethe B1 fee in India: ₹18,800.",
        "lead": "The Goethe-Institut lists B1 for the settlement permit and naturalisation, and for living, working or attending a preparatory college in Germany. The writing module takes 60 minutes; the speaking module is a pair exam of about 15 minutes after 15 minutes of preparation.",
        "writing_rows": [
            ["Task 1: informal e-mail", "About 80 words to a friend, covering 3 points (describe, give a reason, make a suggestion)", "20 minutes suggested"],
            ["Task 2: forum opinion", "About 80 words reacting to someone's comment on a topic", "25 minutes suggested"],
            ["Task 3: formal e-mail", "About 40 words to a teacher, manager, landlord or office, usually to apologise or ask for something", "15 minutes suggested"],
        ],
        "writing_time": "60 minutes for all three tasks, no dictionary. Criteria: task completion, coherence, vocabulary, structures. If task completion scores 0, the whole task scores 0",
        "speaking_rows": [
            ["Part 1: plan something together", "Make suggestions, react, agree on a plan with your partner (4 points to discuss)", "about 2 to 3 minutes"],
            ["Part 2: present a topic", "A short talk following 5 slides: introduce, your experience, your home country, pros and cons with your opinion, conclusion", "about 3 to 4 minutes per candidate"],
            ["Part 3: talk about the topic", "Answer the examiner's and your partner's questions on your talk and give feedback on theirs", "about 1 to 2 minutes per candidate"],
        ],
        "speaking_note": "You get 15 minutes of preparation and may use keyword notes. Criteria include task completion, interaction, coherence, vocabulary, structures and pronunciation; for Part 2 the rubric counts how many of the 5 slides you cover properly.",
        "telc": "telc's Zertifikat Deutsch / telc Deutsch B1 has one writing task (30 minutes) and a speaking part of about 15 minutes in pairs, after 20 minutes of preparation. Our Task 1 and Task 3 e-mails are good practice for it.",
        "sources": ["b1_page", "b1_train", "b1_rules", "telc_b1"],
    },
}

SCRIPTS = '<script src="{base}assets/check.js" defer></script>\n<script src="{base}assets/data.js" defer></script>\n<script src="{base}assets/app.js" defer></script>'


def fill(text):
    for k in ("base", "endpoint", "contact", "repo_url", "updated"):
        text = text.replace("{{" + k + "}}", SITE[k])
    return text


FM_RE = re.compile(r"\A\s*<!--(.*?)-->\s*", re.S)


def parse(path):
    raw = path.read_text(encoding="utf-8")
    m = FM_RE.match(raw)
    if not m:
        sys.exit(f"missing front matter: {path}")
    meta = {}
    for line in m.group(1).strip().splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            meta[k.strip()] = v.strip()
    for key in ("title", "description"):
        if not meta.get(key):
            sys.exit(f"missing {key}: {path}")
    return meta, raw[m.end():]


def layout(meta, body, rel):
    base = SITE["base"]
    page_url = SITE["origin"] + base + ("" if rel == "index.html" else rel)
    title = meta["title"]
    full = title if rel == "index.html" else f"{title} · DeutschDrill"
    nav = "\n".join(
        f'<li><a href="{base}{href}"{" aria-current=\"page\"" if href == rel else ""}>{E(label)}</a></li>'
        for label, href in SITE["nav"])
    jsonld = {
        "@context": "https://schema.org", "@type": meta.get("type", "WebPage"), "name": title,
        "description": meta["description"], "url": page_url, "inLanguage": "en-IN",
        "isAccessibleForFree": True, "dateModified": meta.get("updated", SITE["updated"]),
        "publisher": {"@type": "Organization", "name": "READ FRANCE SAS", "url": SITE["repo_url"]},
    }
    robots = '\n<meta name="robots" content="noindex">' if meta.get("noindex") == "yes" else ""
    scripts = SCRIPTS.format(base=base) if meta.get("app") == "yes" else ""
    return f"""<!doctype html>
<html lang="en-IN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{E(full)}</title>
<meta name="description" content="{E(meta['description'])}">
<link rel="canonical" href="{page_url}">{robots}
<meta property="og:type" content="website">
<meta property="og:site_name" content="DeutschDrill">
<meta property="og:title" content="{E(title)}">
<meta property="og:description" content="{E(meta['description'])}">
<meta property="og:url" content="{page_url}">
<meta property="og:locale" content="en_IN">
<meta property="og:image" content="{SITE['origin']}{base}assets/og.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="{SITE['accent']}">
<link rel="icon" href="{base}assets/icon.svg" type="image/svg+xml">
<link rel="stylesheet" href="{base}assets/style.css">
<script type="application/ld+json">{json.dumps(jsonld, ensure_ascii=False)}</script>
<script>window.OCTAVE_XP = {json.dumps(OCTAVE_XP)};</script>
<script src="{base}assets/cro.js?v={CRO_V}" data-site="deutschdrill" data-api="{SITE['endpoint']}" data-hosts="outils.vread.fr" data-cta="{CRO_CTA}" defer></script>
<script src="{base}assets/mesure.js?v={MESURE_V}" defer></script>
{scripts}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
<div class="wrap header-inner">
<a class="brand" href="{base}">Deutsch<span>Drill</span></a>
<nav aria-label="Main"><ul>
{nav}
</ul></nav>
</div>
</header>
<main id="main" class="wrap">
{body}
</main>
<footer class="site-footer">
<div class="wrap">
<p><strong>DeutschDrill</strong> is run by <strong>READ FRANCE SAS</strong> (SIREN 988 741 773, Paris, France) with Octave, an AI agent. Contact: <a href="mailto:{SITE['contact']}">{SITE['contact']}</a></p>
<p class="disclaimer">Not affiliated with, endorsed by or connected to the Goethe-Institut or telc gGmbH. “Goethe-Zertifikat” and “telc” are their owners' marks; we name them only to describe exam formats. All tasks here are original practice material, not real exam papers.</p>
<p><a href="{base}privacy.html">Privacy (DPDP Act and GDPR)</a> · <a href="{base}terms.html">Terms</a> · <a href="{base}legal.html">Legal notice</a> · <a href="{base}how-it-works.html">How it works and sources</a></p>
<p class="small">No cookies. Anonymous daily totals of visits and page use only. Your texts and recordings stay on your device.</p>
</div>
</footer>
</body>
</html>
"""


def src_links(keys):
    return " · ".join(f'<a href="{SRC[k][1]}" rel="noopener" data-mesure="outbound_official">{E(SRC[k][0])}</a>' for k in keys)


def table(head, rows, caption):
    th = "".join(f'<th scope="col">{E(h)}</th>' for h in head)
    tr = "".join("<tr>" + "".join(f"<td>{E(c)}</td>" for c in r) + "</tr>" for r in rows)
    return f'<div class="table-wrap"><table><caption>{E(caption)}</caption><thead><tr>{th}</tr></thead><tbody>{tr}</tbody></table></div>'


def de(text):
    return E(text).replace("\n", "<br>")


def writing_card(t):
    meta = f'{E(t["part"])} · {t["minutes"]} min'
    if t["kind"] == "message":
        meta += f' · {t["words"][0]}–{t["words"][1]} words' if t["level"] != "B1" else f' · about {80 if "Task 3" not in t["part"] else 40} words'
    pts = ""
    if t["points"]:
        pts = '<ul class="points" lang="de">' + "".join(f'<li>{E(p[0])} <span class="en" lang="en">{E(p[1])}</span></li>' for p in t["points"]) + "</ul>"
    if t["kind"] == "form":
        pts = '<ul class="points">' + "".join(f'<li><span lang="de">{E(f[0])}</span>{" <span class=en>" + E(f[1]) + "</span>" if f[1] else " (example)"}</li>' for f in t["fields"]) + "</ul>"
    return f"""<article class="task" id="{t['id']}">
<p class="task-meta">{meta}</p>
<h3>{E(t['title'])}</h3>
<p class="de" lang="de">{de(t['situation_de'])}</p>
<p class="en small">{E(t['situation_en'])}</p>
{pts}
<p class="task-actions"><a class="btn" href="{SITE['base']}write.html#{t['id']}" data-mesure="cta_click">Practise with timer and self-check</a></p>
<details id="model-{t['id']}" data-mesure-open="model_open"><summary>Model answer</summary><p class="model" lang="de">{de(t['model'])}</p>
<ul class="tips">{''.join('<li>' + E(x) + '</li>' for x in t['tips'])}</ul></details>
</article>"""


def speaking_card(s):
    cues = "".join(f"<li>{E(c)}</li>" for c in s["cues"])
    prep = f"{s['prep'] // 60} min preparation" if s["prep"] >= 120 else "no preparation in the exam"
    fol = ""
    if s["followups"]:
        fol = '<p class="small">Follow-up questions:</p><ul lang="de">' + "".join(f"<li>{E(q)}</li>" for q in s["followups"]) + "</ul>"
    return f"""<article class="task speak" id="{s['id']}">
<p class="task-meta">{E(s['part'])} · speak about {s['speak'] // 60 if s['speak'] >= 120 else s['speak']} {'min' if s['speak'] >= 120 else 's'} · {prep}</p>
<h3>{E(s['title'])}</h3>
<p class="de" lang="de">{de(s['task_de'])}</p>
<p class="en small">{E(s['task_en'])}</p>
<ul class="cues" lang="de">{cues}</ul>
<p class="task-actions"><a class="btn" href="{SITE['base']}speak.html#{s['id']}" data-mesure="cta_click">Practise: timer and private recorder</a></p>
<details id="model-{s['id']}" data-mesure-open="model_open"><summary>Sample answer</summary><p class="model" lang="de">{de(s['model'])}</p>{fol}
<ul class="tips">{''.join('<li>' + E(x) + '</li>' for x in s['tips'])}</ul></details>
</article>"""


def level_page(level):
    L = LEVELS[level]
    w = [t for t in WRITING if t["level"] == level]
    s = [t for t in SPEAKING if t["level"] == level]
    fee = {"A1": "₹9,400", "A2": "₹10,600", "B1": "₹18,800 for all four modules, or ₹4,700 per module"}[level]
    body = f"""<p class="eyebrow">Level {level} · writing and speaking</p>
<h1>German {level} writing and speaking practice in the exam format</h1>
<p class="lead">{E(L['lead'])}</p>
<p class="jump"><a href="#writing">12 writing tasks</a> · <a href="#speaking">6 speaking prompts</a> · <a href="#format">exam format and sources</a> · Goethe-Institut fee in India: <strong>{fee}</strong> incl. 18% GST (<a href="{SITE['base']}exam-day-india.html#fees">details</a>)</p>
<h2 id="writing" data-section="writing">12 original writing tasks</h2>
<p>Each task has a timer, a live word count and a rule-based self-check. Your text never leaves your browser.</p>
{''.join(writing_card(t) for t in w)}
<h2 id="speaking" data-section="speaking">6 original speaking prompts</h2>
<p>Each prompt has a preparation timer, a speaking timer and a recorder that keeps the audio on your device. Listen back and compare with the sample answer.</p>
{''.join(speaking_card(x) for x in s)}
<h2 id="format" data-section="format">The exam format these tasks follow</h2>
{table(['Writing', 'What you do', 'Scoring / time'], L['writing_rows'], 'Goethe-Zertifikat ' + level + ', writing (' + L['writing_time'] + ')')}
{table(['Speaking', 'What you do', 'Time'], L['speaking_rows'], 'Goethe-Zertifikat ' + level + ', speaking')}
<p>{E(L['speaking_note'])}</p>
<p><strong>telc:</strong> {E(L['telc'])}</p>
<p class="sources small">Sources, read on 13 October 2026: {src_links(L['sources'])}. Formats can change, so check the official page before you book.</p>
<div class="note"><p>These are practice tasks written by DeutschDrill. They follow the published task types, timings and word counts but are not taken from any exam. For real sample papers, use the free official model tests linked above.</p></div>
<p class="cta" data-section="early-access"><a class="btn secondary" href="{SITE['base']}early-access.html" data-mesure="cta_click">Want feedback on your writing? Join the early-access list</a></p>
"""
    meta = {"title": L["title"], "description": L["desc"], "type": "LearningResource"}
    return meta, body


def main():
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    shutil.copytree(ROOT / "assets", OUT / "assets")
    data = {"writing": WRITING, "speaking": SPEAKING, "endpoint": SITE["endpoint"]}
    (OUT / "assets" / "data.js").write_text("window.DD=" + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
    pages = []
    items = []
    for src in sorted((ROOT / "content").glob("*.html")):
        meta, body = parse(src)
        items.append((src.name, meta, body))
    for level in LEVELS:
        meta, body = level_page(level)
        items.append((LEVELS[level]["slug"], meta, body))
    for rel, meta, body in items:
        page = fill(layout(meta, fill(body), rel))
        (OUT / rel).write_text(page, encoding="utf-8")
        if meta.get("noindex") != "yes":
            loc = SITE["origin"] + SITE["base"] + ("" if rel == "index.html" else rel)
            pages.append((loc, meta.get("updated", SITE["updated"])))
    sm = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    sm += [f"<url><loc>{loc}</loc><lastmod>{mod}</lastmod></url>" for loc, mod in sorted(pages)]
    sm.append("</urlset>")
    (OUT / "sitemap.xml").write_text("\n".join(sm) + "\n", encoding="utf-8")
    (OUT / "robots.txt").write_text(f"User-agent: *\nAllow: /\n\nSitemap: {SITE['origin']}{SITE['base']}sitemap.xml\n", encoding="utf-8")
    (OUT / ".nojekyll").write_text("", encoding="utf-8")
    key = (ROOT / "indexnow.key").read_text().strip() if (ROOT / "indexnow.key").exists() else ""
    if key:
        (OUT / f"{key}.txt").write_text(key, encoding="utf-8")
    print(f"built {len(items)} pages into {OUT}")


if __name__ == "__main__":
    main()
