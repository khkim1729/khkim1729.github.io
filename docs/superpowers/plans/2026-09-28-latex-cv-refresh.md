# LaTeX CV Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce an image-free, date-specific A4 CV with current 2026--2027 publication metadata, four books, verified links, and a reproducible Overleaf package.

**Architecture:** Keep the existing LaTeX section structure and wrapping-safe commands. Add a small source-contract test suite for content corrections, then compile and visually inspect the actual PDF; the live P1 `WEB_Publications` snapshot supplies baseline metadata and explicit user corrections take precedence.

**Tech Stack:** LaTeX/pdfLaTeX, `latexmk`, Python `unittest`, Poppler rendering, ZIP.

**Spec:** `docs/superpowers/specs/2026-09-28-lectures-cv-publications-design.md`

## Global Constraints

- Work in `/data/khkim/1_users/3_stair123/1_projects/01_git_homepage_projects/04_latex_mycv/02_temp/swe_khkim_template_260928`.
- Final PDF must be A4 and contain no overfull boxes.
- Teaching and volunteering sections contain no images.
- Do not invent paper URLs; leave titles unlinked when no verified PDF exists.
- User corrections override the live sheet.
- Preserve author ordering and bold Kyeonghun Kim.

## Review Focus

- URL characters such as `#`, `_`, and `&` compile without breaking `hyperref`.
- Long titles and author lists wrap inside A4 width.
- A moved paper appears once, under the correct year and venue.
- Removed HERO title is absent from both source and extracted PDF text.
- Final ZIP compiles in a clean directory without relying on files outside the package.

---

### Task 1: Expand teaching and remove CV images

**Files:**
- Create: `tests/test_cv_content.py`
- Modify: `src/lectures.tex`
- Modify: `src/volunteering.tex`
- Modify: `resume_khkim.tex` only if image-only packages become unused.

**Interfaces:**
- Produces: seven dated teaching entries and two text-only volunteering entries.

- [ ] **Step 1: Write failing source-contract tests**

Assert these seven exact date/organization pairs, absence of `includegraphics` in both files, absence of the grouped `Professional AI Training` heading, and retention of Red Cross/NAVER links:

- foundational university-level instruction, 2018--2026;
- SK Telecom, Dec. 5--7, 2023;
- SNU OUTTA AI Bootcamp, Jun. 2024--Aug. 2026;
- HUN Company, Apr. 2025;
- KCA / Kyobo Life, Apr. 2026;
- Busan Metropolitan City, Jul. 2026;
- Kookmin University AX-Startup Bootcamp, Aug. 29 and Sep. 1, 2026.

- [ ] **Step 2: Verify RED**

Run: `python3 -m unittest tests.test_cv_content.CVContentTests.test_teaching_is_dated_and_all_resume_images_are_removed -v`

- [ ] **Step 3: Rewrite the two sections**

Use one compact `resumeProjectHeading` per teaching engagement. Remove every image block while preserving concise achievement text.

- [ ] **Step 4: Run focused test and compile**

Run: `python3 -m unittest tests.test_cv_content -v && latexmk -pdf -interaction=nonstopmode -halt-on-error resume_khkim.tex`

Expected: tests pass and PDF compiles.

### Task 2: Rebuild 2026--2027 publications

**Files:**
- Modify: `tests/test_cv_content.py`
- Modify: `src/publications.tex`

**Interfaces:**
- Consumes: live P1 publication snapshot and the explicit corrections in the spec.
- Produces: a deduplicated 2026--2027 LaTeX publication list with paper, venue, code, poster, and slide actions.

- [ ] **Step 1: Add failing metadata tests**

Assert all corrected title/venue/status pairs, both supplied NeurIPS Drive IDs, AACL acceptance, HERO absence, and the three exact AICAS slide IDs. Assert Junsu Lim and Yului Jeong author URLs.

- [ ] **Step 2: Verify RED**

Run: `python3 -m unittest tests.test_cv_content.CVContentTests.test_2026_2027_publications_match_verified_metadata -v`

- [ ] **Step 3: Replace the 2026--2027 blocks**

Use current sheet metadata for other papers. Apply the explicit overrides and author links. Link venues to official conference pages and titles only to verified PDFs/arXiv pages.

- [ ] **Step 4: Run tests, compile, and inspect PDF text**

Run: `python3 -m unittest tests.test_cv_content -v && latexmk -pdf -interaction=nonstopmode -halt-on-error resume_khkim.tex && pdftotext resume_khkim.pdf - | rg 'ICML 2027|NeurIPS 2026|AACL|ISBI 2027|ICLR 2027'`

Expected: all corrected venues appear; HERO does not.

### Task 3: Add four books and linked poster coauthors

**Files:**
- Modify: `tests/test_cv_content.py`
- Modify: `src/other_publications.tex`

**Interfaces:**
- Produces: Books and Conference Posters subsections inside Other Publications.

- [ ] **Step 1: Add failing book and author-link tests**

Assert The Great White Drive ID, pen name Sunyul Baek, FBI dataset note, three exact English textbook titles, Jan. 2027, Hongneung Science Publishing, OUTTA use, and Junsu/Yului URLs.

- [ ] **Step 2: Verify RED**

Run: `python3 -m unittest tests.test_cv_content.CVContentTests.test_books_and_other_publications_are_complete_and_linked -v`

- [ ] **Step 3: Rewrite Other Publications**

Create compact year/subsection labels. Link every author for whom a verified personal URL is available without linking unknown authors.

- [ ] **Step 4: Run all CV tests and compile twice**

Run: `python3 -m unittest discover -s tests -v && latexmk -pdf -interaction=nonstopmode -halt-on-error resume_khkim.tex`

Expected: tests and compilation pass.

### Task 4: Visual QA and package delivery

**Files:**
- Replace: `Kyeonghun_Kim_CV.pdf`
- Replace: `Kyeonghun_Kim_CV_Overleaf.zip`
- Modify: `README.md` only if build instructions change.

**Interfaces:**
- Produces: self-contained A4 PDF and Overleaf ZIP.

- [ ] **Step 1: Verify layout diagnostics**

Run `pdfinfo`, scan `resume_khkim.log` for overfull boxes, and render every page with `pdftoppm`.

- [ ] **Step 2: Visually inspect every rendered page**

Check clipping, isolated headings, crowded entries, image absence, and balanced whitespace. Adjust only layout settings needed to correct observed defects, recompiling after each change.

- [ ] **Step 3: Rebuild artifacts**

Copy the final PDF to `Kyeonghun_Kim_CV.pdf`. Create `Kyeonghun_Kim_CV_Overleaf.zip` from `README.md`, LaTeX sources, required assets, and the final PDF, excluding auxiliary files and removed teaching/volunteering images.

- [ ] **Step 4: Clean-room validation**

Extract the ZIP into a fresh `mktemp -d` directory, compile there, verify A4 dimensions and no overfull boxes, then remove only that temporary directory.

- [ ] **Step 5: Final P1 verification and push**

In P1 run `python3 -m unittest discover -s tests -v`, `git diff --check`, fetch `origin`, verify no remote divergence, and push `main`. Confirm the official Pages workflow and live `/CV`, `/lectures`, and `/publication` routes.
