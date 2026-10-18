# Cross-Site Resume and Profile Synchronization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Synchronize project ordering, author links, credentials, awards, teaching history, and patent details across P1, P2, and English/Korean Overleaf resumes.

**Architecture:** P1 remains the snapshot-first public content source, P2 receives only profile/publication-link changes, and P3 keeps independent English and Korean XeLaTeX entry points with shared layout primitives. Each repository gets its own regression checks and commit so unrelated dirty state cannot cross repository boundaries.

**Tech Stack:** JavaScript, JSON, Python unittest/Selenium, static HTML, LaTeX/XeLaTeX, Git/GitHub Pages, Overleaf Git.

**Spec:** `docs/superpowers/specs/2026-10-19-cross-site-resume-sync-design.md`

## Global Constraints

- P1 path: `/data/khkim/1_users/3_stair123/1_projects/01_git_homepage_projects/01_my_homepage/khkim1729.github.io`.
- P2 path: `/data/khkim/1_users/3_stair123/1_projects/01_git_homepage_projects/02_imsi_homepage/imsi`.
- P3 path: `/data/khkim/1_users/3_stair123/1_projects/01_git_homepage_projects/04_latex_mycv/02_core_overleaf_swe/core_overleaf_sw`.
- Preserve P1 `docs/Resume_KyeonghunKim.pdf` as an untracked user file.
- Preserve all unrelated P2 working-tree changes; stage explicit task-owned paths only.
- Never write either supplied access token into a tracked file, test fixture, log, or commit message.
- The KCA / Kyobo Life lecture date is `2026.04.21`.
- The Busan Metropolitan City Oct. 23, 2026 lecture is represented as completed.
- The patent registration date is `2026.08.27`.
- Sieun Hyeon's URL is `https://hyeonsieun.github.io/`.

## Review Focus

- Equal `sort_date` values must remain deterministic through the documented tie-breakers.
- Date strings containing multiple days or an ongoing range must not wrap outside the LaTeX right column.
- Korean credential names must come from `name_ko`/`level_ko`, not English transliteration.
- P2 author linking must not replace an internal IMSI profile link when one exists for another author.
- Remote Google Sheets refreshes must not erase P1's local award image or canonical date fields when the remote row omits them.

---

### Task 1: P1 Project Ordering and Sieun Hyeon Link

**Files:**
- Modify: `assets/js/portfolio-data.js`
- Modify: `assets/data/portfolio-data.json`
- Test: `tests/test_portfolio_data.py`
- Test: `tests/test_browser_smoke.py`

**Interfaces:**
- Consumes: project rows with `sort_date`, `display_order`, and localized titles; publication author text.
- Produces: deterministic newest-first project cards and external author links for `Sieun Hyeon`.

- [ ] **Step 1: Write failing tests**

Add assertions that rendered project dates are non-increasing, ties use `display_order` then title, and `Sieun Hyeon` resolves to `https://hyeonsieun.github.io/`.

- [ ] **Step 2: Run the targeted tests and verify failure**

Run: `python3 -m unittest tests.test_portfolio_data.PortfolioDataTests.test_projects_are_sorted_newest_first tests.test_portfolio_data.PortfolioDataTests.test_author_url_overrides_include_requested_profiles tests.test_browser_smoke.BrowserSmokeTests.test_projects_filter_counts_and_bilingual_detail_gallery`

Expected: failure because the explicit ordering contract and Sieun Hyeon override are missing.

- [ ] **Step 3: Implement the deterministic comparator and author URL**

Use descending ISO `sort_date`, ascending numeric `display_order`, then localized title. Add the author URL to the established external-author mapping and offline people snapshot as appropriate.

- [ ] **Step 4: Run the targeted tests and verify pass**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit Task 1**

Commit message: `fix: order projects and link Sieun Hyeon`.

### Task 2: P1 Award, Teaching, Credentials, and Patent Snapshot

**Files:**
- Modify: `assets/data/cv-content.json`
- Modify: `assets/data/portfolio-data.json`
- Create: `assets/img/portfolio/awards/2019-ksae-team-sv-bronze.png`
- Modify: `tests/test_portfolio_data.py`
- Modify: `tests/test_browser_smoke.py`

**Interfaces:**
- Consumes: canonical teaching list and visible `Professional_Credentials` rows.
- Produces: snapshot-first bilingual CV content with newest-first teaching, KSAE award, media, and registered-patent date.

- [ ] **Step 1: Write failing data and browser tests**

Assert all 12 canonical teaching entries and exact dates, descending order, KCA date `2026.04.21`, completed Oct. 23 entry, KSAE event facts and local image, lightbox rendering, and patent date `2026.08.27`.

- [ ] **Step 2: Run targeted tests and verify failure**

Run: `python3 -m unittest tests.test_portfolio_data.PortfolioDataTests.test_cv_content_has_canonical_teaching_award_and_patent_dates tests.test_browser_smoke.BrowserSmokeTests.test_fallback_renders_count_actions_media_and_korean`

Expected: failure on missing detailed entries, award media, and patent date.

- [ ] **Step 3: Add bilingual snapshot rows and copy the supplied award image**

Use stable IDs, ISO-sortable dates where available, existing lightbox media fields, and exact English/Korean copy. Keep the full credential snapshot newest-first and separate award records from licenses/scores.

- [ ] **Step 4: Run targeted tests and verify pass**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Run full P1 suite and commit**

Run: `python3 -m unittest discover -s tests -v`.

Expected: all tests PASS.

Commit message: `feat: expand awards teaching and patent history`.

### Task 3: P2 Publication Link and Kyeonghun Profile Sync

**Files:**
- Modify: the established author-link mapping source identified by the P2 tests/rendering code.
- Modify: `authors/research_assistants/kyeonghun-kim/index.html`
- Modify: `data/kyeonghun-credentials.json` if it is the established profile data source.
- Modify: `tests/test_requested_site_content.py`
- Modify: `tests/test_browser_smoke.py`

**Interfaces:**
- Consumes: canonical teaching/patent facts from the spec and P2 publication author names.
- Produces: external Sieun Hyeon publication link and synchronized Kyeonghun Kim profile content.

- [ ] **Step 1: Write failing P2 tests**

Assert the Sieun Hyeon URL, 12 teaching entries with exact dates and counts, KCA date `Apr. 21, 2026`, Busan Oct. 23 entry without planned/forthcoming wording, and patent registration date `Aug. 27, 2026`.

- [ ] **Step 2: Run targeted P2 tests and verify failure**

Run: `python3 -m unittest tests.test_requested_site_content tests.test_browser_smoke -v`.

Expected: failure on missing link/date/content assertions.

- [ ] **Step 3: Implement only task-owned P2 source changes**

Follow the existing publication author-link and Kyeonghun profile patterns. Do not modify unrelated profiles or stage bulk `_site` output.

- [ ] **Step 4: Run full P2 test suite and verify pass**

Run: `python3 -m unittest discover -s tests -v`.

Expected: all tests PASS.

- [ ] **Step 5: Commit with explicit paths only**

Review `git diff --name-only --cached` before committing. Commit message: `feat: synchronize Kyeonghun profile details`.

### Task 4: English Overleaf Resume Content

**Files:**
- Modify: `src/lectures.tex`
- Modify: `src/patents.tex`
- Modify: `src/publications.tex` and/or other author-bearing section files containing Sieun Hyeon.
- Create: `src/credentials.tex`
- Create: `src/awards.tex`
- Modify: `resume_khkim.tex`
- Create: `tests/test_resume_content.py`

**Interfaces:**
- Consumes: P1 visible credential snapshot, canonical teaching list, KSAE award, patent metadata.
- Produces: newest-first English resume sections with stable links and compact A4-safe dates.

- [ ] **Step 1: Write failing resume-content tests**

Assert all canonical dates/order, KCA Apr. 21 date, Sieun Hyeon hyperlinks, patent date, KSAE award, and all visible credentials with escaped LaTeX-safe text.

- [ ] **Step 2: Run tests and verify failure**

Run: `python3 -m unittest discover -s tests -v`.

Expected: failure because the new sections and exact entries are absent.

- [ ] **Step 3: Implement English TeX sections**

Keep teaching entries newest-first by latest activity date. Use concise bullets, nonbreaking dates, and the established `resumeProjectHeading`/`resumeSubheading` macros.

- [ ] **Step 4: Run content tests and compile English PDF**

Run: `python3 -m unittest discover -s tests -v && latexmk -xelatex -interaction=nonstopmode -halt-on-error resume_khkim.tex`.

Expected: tests PASS and `resume_khkim.pdf` exists.

- [ ] **Step 5: Inspect the log**

Run: `rg -n "Overfull|Underfull|Missing character|LaTeX Error|Undefined control sequence" resume_khkim.log`.

Expected: no overfull box, missing glyph, or fatal LaTeX error attributable to the new content.

- [ ] **Step 6: Commit Task 4**

Commit message: `feat: refresh English resume content`.

### Task 5: Korean Overleaf Resume

**Files:**
- Create: `resume_khkim_ko.tex`
- Create: `src/heading_ko.tex`
- Create: Korean section files required for natural Korean copy.
- Modify: `tests/test_resume_content.py`

**Interfaces:**
- Consumes: English resume structure and canonical bilingual facts.
- Produces: independent XeLaTeX Korean resume PDF with correct Korean credential names.

- [ ] **Step 1: Write failing Korean resume tests**

Assert Korean entry point, Korean font package/configuration, Korean section inclusions, Korean credential names/levels, canonical dates, KSAE award, and patent date.

- [ ] **Step 2: Run tests and verify failure**

Run: `python3 -m unittest discover -s tests -v`.

Expected: failure because `resume_khkim_ko.tex` and translated sections do not exist.

- [ ] **Step 3: Implement Korean entry point and sections**

Use XeLaTeX-compatible Korean typography and reuse only layout macros that are language-neutral. Keep publication titles in their official English form while translating section labels and descriptive copy naturally.

- [ ] **Step 4: Compile and verify Korean PDF**

Run: `python3 -m unittest discover -s tests -v && latexmk -xelatex -interaction=nonstopmode -halt-on-error resume_khkim_ko.tex`.

Expected: tests PASS and `resume_khkim_ko.pdf` exists.

- [ ] **Step 5: Inspect Korean log and PDF metadata**

Run: `rg -n "Overfull|Missing character|LaTeX Error|Undefined control sequence" resume_khkim_ko.log` and `pdfinfo resume_khkim_ko.pdf`.

Expected: no overflow, missing glyph, or fatal error; A4 page size.

- [ ] **Step 6: Commit Task 5**

Commit message: `feat: add Korean resume edition`.

### Task 6: Final Verification and Three-Repository Push

**Files:**
- Verify all task-owned files in P1, P2, and P3.
- Local-only update: P3 `.git/config` Overleaf remote URL.

**Interfaces:**
- Consumes: committed task changes in all repositories.
- Produces: verified GitHub Pages updates and Overleaf remote update.

- [ ] **Step 1: Run all repository checks fresh**

P1: `python3 -m unittest discover -s tests -v && git diff --check`.

P2: `python3 -m unittest discover -s tests -v && git diff --check`.

P3: `python3 -m unittest discover -s tests -v && latexmk -xelatex -interaction=nonstopmode -halt-on-error resume_khkim.tex && latexmk -xelatex -interaction=nonstopmode -halt-on-error resume_khkim_ko.tex && git diff --check`.

Expected: all commands exit 0.

- [ ] **Step 2: Audit staged/tracked paths and secret absence**

Confirm P1's user PDF and unrelated P2 paths remain unstaged. Search tracked diffs for `ghp_` and `olp_`; expected: no matches.

- [ ] **Step 3: Configure the P3 remote locally**

Set the supplied Overleaf token only in `.git/config`, verify the displayed remote with credentials redacted, and never print the token.

- [ ] **Step 4: Push P1, P2, and P3**

Push each current branch to its configured origin. Use interactive credential entry where needed so secrets are not embedded in shell history.

- [ ] **Step 5: Verify remote heads and deployments**

Compare local/remote SHAs. Confirm both GitHub Pages workflows succeed and the live P1/P2 assets contain the new dates/link. Confirm the Overleaf remote head matches P3 local HEAD.
