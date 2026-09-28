# Learning Video Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Safely extract linked Beta Learning and Lambda Course videos from `DB_Publications` and render them as a polished, accessible Lectures-page gallery.

**Architecture:** Apps Script exposes a dedicated normalized `Learning_Videos` response and never serializes unrelated `DB_Publications` columns. A focused browser module validates YouTube URLs, renders grouped cards, and controls a privacy-enhanced modal without affecting the existing lecture-history renderer.

**Tech Stack:** Google Apps Script, vanilla JavaScript/CSS, Jekyll Markdown, Python `unittest`, headless Firefox.

**Spec:** `docs/superpowers/specs/2026-09-28-lectures-cv-publications-design.md`

## Global Constraints

- Public API output is limited to the two named Korean columns and normalized fields in the spec.
- Extract whole-cell links, partial Rich Text run links, and plain HTTPS URLs.
- Embed only valid `youtube.com` or `youtu.be` video URLs through `youtube-nocookie.com`.
- Existing lecture history remains usable if the video endpoint is absent or malformed.
- The user must redeploy `Code.gs` once after this change.

## Review Focus

- A cell with two linked Rich Text runs produces two ordered records.
- Duplicate URL in the same series is emitted once.
- Empty/missing source columns return an empty video list without exposing other fields.
- Shorts, `youtu.be`, watch, and embed URLs normalize to the same 11-character ID; malformed IDs are rejected.
- Modal close/Escape removes the iframe and stops playback.

---

### Task 1: Add the restricted Rich Text API adapter

**Files:**
- Modify: `tests/test_portfolio_data.py`
- Create: `tests/fixtures/apps-script-learning-videos.html`
- Modify: `tests/test_browser_smoke.py`
- Modify: `docs/google-sheets-code.gs`
- Modify: `docs/GOOGLE_SHEETS_QUICK_EDIT_KO.txt`

**Interfaces:**
- Consumes: sheet `DB_Publications`; headers `베타러닝 유튜브`, `람다코스 유튜브`.
- Produces: `GET ?sheet=Learning_Videos&lang=all` with `{ok, sheet: "Learning_Videos", count, data}` and records `{series, series_label_en, series_label_ko, title, url, display_order}`.

- [ ] **Step 1: Write failing adapter-behavior tests**

Load the real `.gs` source in a browser fixture and call `learningVideos_(fakeSheet)` with complete fake DisplayValue/`RichTextValue` objects. Assert whole-cell links, two partial linked runs, HTTPS fallback parsing, ordering, deduplication, and that no unrelated fake column appears in the returned records. Add a narrow static assertion only for the `doGet` route name because the Apps Script `ContentService` boundary cannot run in Firefox.

- [ ] **Step 2: Verify RED**

Run: `python3 -m unittest tests.test_browser_smoke.BrowserSmokeTests.test_apps_script_learning_video_adapter_extracts_only_rich_text_links tests.test_portfolio_data.PortfolioDataTests.test_learning_video_endpoint_is_restricted -v`

Expected: FAIL because `Learning_Videos` is unknown.

- [ ] **Step 3: Implement `learningVideos_(sheet)` and response branch**

Add focused helpers `richTextLinks_(value)`, `plainHttpsLinks_(text)`, and `learningVideos_(sheet)`. `doGet` must route `Learning_Videos` before the generic sheet serializer. Do not add `DB_Publications` itself to `SHEETS`.

- [ ] **Step 4: Update redeployment verification instructions**

Document the endpoint and expected restricted keys in the Korean quick guide.

- [ ] **Step 5: Run focused tests and commit**

```bash
python3 -m unittest tests.test_browser_smoke.BrowserSmokeTests.test_apps_script_learning_video_adapter_extracts_only_rich_text_links tests.test_portfolio_data.PortfolioDataTests.test_learning_video_endpoint_is_restricted -v
git add docs/google-sheets-code.gs docs/GOOGLE_SHEETS_QUICK_EDIT_KO.txt tests
git commit -m "feat: expose restricted learning video feed"
```

### Task 2: Render grouped video cards and modal

**Files:**
- Create: `assets/js/learning-videos.js`
- Create: `tests/fixtures/learning-videos-api.json`
- Create: `tests/fixtures/learning-videos-render.html`
- Modify: `lectures.md`
- Modify: `assets/css/portfolio-data.css`
- Modify: `_includes/footer-scripts.html`
- Modify: `assets/js/portfolio-data.js`
- Modify: `tests/test_browser_smoke.py`

**Interfaces:**
- Consumes: Task 1 normalized `Learning_Videos` records.
- Produces: `LearningVideos.youtubeVideoId(url): string|null`, `LearningVideos.render(root): Promise<void>`, and modal controls scoped to `[data-learning-videos]`.

- [ ] **Step 1: Write browser tests and fixtures**

Cover grouping, thumbnail host, title escaping, non-YouTube external fallback, EN/KO labels, modal `youtube-nocookie.com` URL, Escape close, iframe removal, duplicate URL suppression, and malformed-ID rejection.

- [ ] **Step 2: Verify RED**

Run: `python3 -m unittest tests.test_browser_smoke.BrowserSmokeTests.test_learning_video_gallery_groups_and_opens_safe_modal -v`

Expected: FAIL because the module and gallery do not exist.

- [ ] **Step 3: Implement the module and markup**

Add a `data-learning-videos` mount and accessible modal markup to `lectures.md`. Load the focused module after `portfolio-data.js`. Use `PortfolioData.getSheet('Learning_Videos')`; add the alias and expected sheet mapping to the shared loader.

- [ ] **Step 4: Add responsive styling**

Use the existing portfolio colors, a responsive card grid, 16:9 thumbnails, visible focus states, and a modal that fits mobile and desktop viewports.

- [ ] **Step 5: Run full P1 tests and commit**

```bash
python3 -m unittest discover -s tests -v
git add lectures.md assets/js/learning-videos.js assets/js/portfolio-data.js assets/css/portfolio-data.css _includes/footer-scripts.html tests
git commit -m "feat: add learning video gallery"
```
