# Lectures, Publication Metadata, and CV Refresh Design

## Goal

Remove duplicated teaching content from the website CV page, add a safe video-learning experience to the dedicated Lectures page, and rebuild the LaTeX CV with current publication venues, paper links, books, teaching entries, and author links.

## Scope

This change covers:

- the P1 website and its read-only Apps Script API;
- the LaTeX CV in `04_latex_mycv/02_temp/swe_khkim_template_260928`;
- regenerated A4 PDF and Overleaf ZIP artifacts;
- P1 tests, deployment documentation, commit, and push.

It does not change P2 source code or rewrite Git history.

## Website CV and Lectures

`CV.md` will continue to use the shared `CV_Content` renderer but will exclude `section_id=lectures`. The dedicated `lectures.md` route remains the only website page that displays teaching entries.

The renderer will support an explicit `data-section-exclude` list in addition to the existing inclusion filter. This allows new CV sections to appear automatically while keeping lectures out of the CV page.

## Learning Video API

The repurposed `DB_Publications` sheet will be exposed only through a `Learning_Videos` API alias. The public API must not return unrelated columns from that sheet.

The Apps Script adapter will locate exactly these headers:

- `베타러닝 유튜브`
- `람다코스 유튜브`

For each non-empty cell it will extract:

- displayed text as the video title;
- a whole-cell hyperlink when present;
- hyperlinks attached to individual Rich Text runs;
- a plain YouTube URL from the displayed text as a final fallback.

The normalized response record is:

```text
series: beta_learning | lambda_course
series_label_ko: 베타러닝 | 람다코스
series_label_en: Beta Learning | Lambda Course
title: displayed linked text
url: extracted https URL
display_order: sheet row order and link order
```

Rows without an extracted URL are omitted. Only `youtube.com` and `youtu.be` URLs are rendered as embedded media. Other HTTPS URLs receive an external-link card.

## Lectures Video UI

The Lectures page will keep its current sheet-driven teaching history and append two video collections: Beta Learning and Lambda Course.

Each video card will include a YouTube thumbnail, course badge, title, and watch action. Selecting a YouTube card opens an accessible modal containing a privacy-enhanced `youtube-nocookie.com` iframe. Escape and the close controls dismiss the modal and remove the iframe so playback stops. Invalid or unavailable API data will not remove the normal lecture history; a concise empty state is shown instead.

## LaTeX Teaching and Volunteering

Teaching images will be removed. Teaching will be expanded into dated entries instead of a single 2023--2026 group:

- foundational teaching, 2018--2026;
- SK Telecom, Dec. 5--7, 2023;
- OUTTA AI Bootcamp, Jun. 2024--Aug. 2026;
- HUN Company, Apr. 2025;
- KCA / Kyobo Life, Apr. 2026;
- Busan Metropolitan City, Jul. 2026;
- Kookmin University AX-Startup Bootcamp, Aug. 29 and Sep. 1, 2026.

All volunteering images will be removed. Blood donation and NAVER Happy Bean recurring-donor text and links remain.

## Publication Refresh

The current P1 `WEB_Publications` response is the baseline for authors and verified paper/venue links. Explicit user corrections override the sheet.

The 2026--2027 list will apply these corrections:

- remove HERO;
- move Task-Side Geometry Shapes Terminal Class Geometry to ICML 2027, Under Review;
- keep both auditing papers as NeurIPS 2026 accepted papers and link their titles to the supplied Google Drive PDFs;
- mark Hierarchy-Aware Preference Optimization for Safe Korean Small Language Models as accepted at AACL-IJCNLP 2026 and link the available PDF;
- move TIME and DICE to ISBI 2027, Under Review;
- move SSDenoDet to ICLR 2027, Under Review;
- rename FBI to `FBI: A Framework for Benchmark Integrity to Verify Malicious Contamination in LLMs` and mark it NAACL, Under Review;
- move QDDPM to ISBI 2027, Under Review;
- move Period Deserts to ICML 2027, Under Review;
- keep When Time Hides Structure at AAAI, Under Review;
- adopt current sheet metadata for other 2026--2027 publications when it is newer than the existing CV.

No PDF link will be invented. A title remains plain text when neither the live sheet nor the user supplied a verified paper URL. Venue names link to the relevant official conference site when available.

The three AICAS 2026 papers will be marked Oral Presentation. Their titles retain the current paper/arXiv links, and the supplied Drive URLs appear as separate `[Slides]` actions:

- Adaptive Routing: `11g1b69jqqX7TpMbg11dJojTD_9Auczh-`
- Anatomy-Privileged Distillation: `1ozi0og_h0gvHr12OLttJmnCGjgzGkrjq`
- SpikeDS: `15M064sLWTgGlIMJndVM89ZzCAKcoHyln`

Junsu Lim links to `https://jsulim.github.io/CV/`. Yului Jeong links to `https://imsilab.github.io/imsi/authors/undergraduate_interns/yului-jeong/`. These links apply in Publications and Other Publications.

## Books and Other Publications

The current Other Publications section will be divided visually into Books and Conference Posters while retaining a single top-level section.

Books:

- *The Great White*, by Kyeonghun Kim under the pen name Sunyul Baek. It links to the supplied Drive file and briefly explains that its anonymized text was used as training/test material in the FBI contamination study. No publication year is shown because none was supplied.
- *Getting Started with Natural Language Processing*, scheduled for Jan. 2027.
- *Getting Started with Deep Learning*, scheduled for Jan. 2027.
- *Getting Started with Computer Vision*, scheduled for Jan. 2027.

The three educational books are listed as forthcoming from Hongneung Science Publishing and intended as textbooks for the Seoul National University OUTTA AI Bootcamp.

Conference-poster author names use available personal links, including Junsu Lim and Yului Jeong.

## Verification and Delivery

Website changes require failing regression tests before implementation. Tests will cover CV lecture exclusion, the restricted learning-video API contract, Rich Text link extraction logic represented in the Apps Script source contract, safe YouTube normalization, grouped rendering, and existing homepage behavior.

The LaTeX CV will be compiled twice with `latexmk`. Verification includes A4 dimensions, no overfull boxes, link/content checks, page rendering and visual inspection, and clean extraction/recompilation of the final Overleaf ZIP.

The final source and artifacts remain in `swe_khkim_template_260928`. P1 is pushed to `main` only after the full test suite passes and the remote branch is confirmed current.

Because `Code.gs` changes, the user must create a new Apps Script deployment version once after the Git push. Subsequent edits to the two video columns will be live without another deployment.
