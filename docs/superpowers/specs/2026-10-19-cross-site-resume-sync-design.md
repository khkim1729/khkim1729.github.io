# Cross-Site Resume and Profile Synchronization Design

## Objective

Keep Kyeonghun Kim's personal website, IMSI Lab profile, and English/Korean Overleaf resumes consistent for project ordering, author links, credentials, awards, teaching history, and patent registration details.

## Repositories

- P1: `khkim1729.github.io`
- P2: `imsi`
- P3: `core_overleaf_sw`

Existing unrelated and generated changes in P2 must be preserved. Only task-owned source files and tests may be staged. The untracked P1 file `docs/Resume_KyeonghunKim.pdf` must remain untouched.

## Canonical Content Decisions

### Project ordering

P1 project cards are sorted by `sort_date` descending. `display_order` is used only as a deterministic tie-breaker, followed by title.

### Author links

Every visible occurrence of `Sieun Hyeon` in P1 publications, P2 publications, and the Overleaf resume links to `https://hyeonsieun.github.io/`. Existing author-profile behavior remains unchanged for other authors.

### KSAE award

Add the 2019 KSAE Formula Student EV Division Bronze Award earned with Hankyong National University's Team-SV. The website entry includes the event dates (Aug. 16–18, 2019), Saemangeum Gunsan Auto Racing Park, 102 universities, 195 teams, approximately 2,600 participants, and the EV bronze result. The public image is copied from the supplied source into a stable portfolio award asset path and displayed through the existing lightbox. Resume entries use a concise one-line version.

### Teaching history

All teaching entries use exact dates and descending chronological order. The canonical entries are:

1. Busan Metropolitan City — Generative AI for Work Efficiency, Oct. 23, 2026, 30 learners.
2. Kookmin University AX-Startup Bootcamp, Aug. 29 and Sep. 1, 2026, 28 learners.
3. Busan Metropolitan City — Public-Data Ideation, Jul. 1, 2026, 36 learners.
4. KCA / Kyobo Life — AX Insights and Prompt Engineering, Apr. 21, 2026, 37 learners.
5. SNU OUTTA AI Bootcamp, Jun. 1, 2024–Aug. 30, 2026, 3,000+ cumulative learners.
6. TOEFL instruction, Oct. 5, 2023–Dec. 30, 2025, 20 learners.
7. HUN Company — Practical AI and ChatGPT for Planners, Apr. 25, 2025, 20 learners.
8. TOEIC instruction, Aug. 23, 2020–Feb. 16, 2024, 100 learners.
9. SK Telecom — Stable Diffusion, Dec. 5–7, 2023, 33 learners.
10. EASY AI at The Joeun Computer Academy, Jun. 8–Aug. 30, 2023, 35 learners.
11. Fitness instruction, Dec. 10, 2017–Jun. 17, 2021, 2,302,547 cumulative YouTube views.
12. Python instruction, Mar. 2, 2018–Present, 5,000+ cumulative learners.

The Oct. 23 lecture is presented as completed, without a forthcoming label. Website descriptions may be fuller than resume descriptions, but dates, audience counts, and institutions must match.

### Credentials and awards

Use the currently visible Google Sheets-backed credential snapshot, ordered by date descending. Korean credential names and levels must use their Korean fields rather than machine-translating English labels. Awards are separated from professional credentials in the resumes when their record is an award rather than a license or score.

### Patent

The hyperspectral-image refinement patent shows registration date `2026.08.27`, registration number `10-3010471-0000`, inventors, and assignee `GNEWSOFT Co., Ltd.` consistently in P1, P2, and both resumes.

## P1 Design

- Keep the current snapshot-first Google Sheets architecture.
- Extend the local CV snapshot with detailed awards, teaching records, and patent date so initial rendering is complete before remote synchronization.
- Add regression tests for project date ordering, Sieun Hyeon's author link, teaching dates/order, the KSAE image, and patent date.
- Reuse the existing accessible media lightbox for the award image.

## P2 Design

- Add Sieun Hyeon to the author-link mapping used by publication rendering.
- Update Kyeonghun Kim's profile source content with the canonical teaching and patent data.
- Do not stage unrelated working-tree changes or bulk-generated `_site` files unless the repository's established deployment contract explicitly requires a generated counterpart.

## P3 Design

- Keep `resume_khkim.tex` as the English entry point.
- Add `resume_khkim_ko.tex` as an independent Korean entry point using XeLaTeX-compatible Korean typography.
- Use separate Korean section files where translated copy differs, while sharing layout commands where safe.
- Rebuild `src/lectures.tex` in descending order with exact dates.
- Add credentials and awards sections sourced from the visible website snapshot.
- Add the patent registration date and Sieun Hyeon links.
- Compile both entry points and inspect logs for overfull boxes, missing glyphs, missing references, and fatal errors.
- Store the Overleaf access token only in the local Git remote configuration; never place it in tracked files, logs, or commit messages.

## Verification

- P1: run the complete Python and headless-browser test suite.
- P2: run its complete Python/headless-browser suite and source-content assertions.
- P3: compile both PDFs with XeLaTeX/latexmk, assert output files exist, and scan logs for layout or glyph warnings.
- Run `git diff --check` in all three repositories.
- Commit and push each repository separately, staging only task-owned files.
