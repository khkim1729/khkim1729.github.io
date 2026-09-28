# P1 CV Lecture Separation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep all future CV sections visible while removing the duplicated `lectures` section from the website CV page.

**Architecture:** Extend the shared CV renderer with an exclusion filter that composes with the existing inclusion filter. Configure only `CV.md` to exclude lectures; the dedicated Lectures route continues using the inclusion filter.

**Tech Stack:** Jekyll Markdown, vanilla JavaScript, Python `unittest`, headless Firefox.

**Spec:** `docs/superpowers/specs/2026-09-28-lectures-cv-publications-design.md`

## Global Constraints

- Do not modify or commit the user-owned `docs/Resume_KyeonghunKim.pdf`.
- The dedicated `/lectures` page remains the only website route that renders `section_id=lectures`.
- EN/KO switching and remote `CV_Content` refresh must preserve the filter.

## Review Focus

- Inclusion and exclusion supplied together: exclusion wins.
- Empty exclusion value: all otherwise eligible sections render.
- Remote `portfolio:dataupdated` event: excluded lectures do not reappear.
- Language switch: section filtering does not change.
- Newly added CV section: appears automatically without editing `CV.md`.

---

### Task 1: Add CV section exclusion

**Files:**
- Modify: `tests/test_portfolio_data.py`
- Modify: `tests/fixtures/portfolio-render.html`
- Modify: `tests/test_browser_smoke.py`
- Modify: `assets/js/portfolio-data.js`
- Modify: `CV.md`

**Interfaces:**
- Consumes: `data-portfolio-cv`, optional `data-section-filter`.
- Produces: optional `data-section-exclude="lectures,other"`; exclusion wins over inclusion.

- [ ] **Step 1: Write the failing tests**

Add `test_cv_page_excludes_lectures_without_hardcoding_other_sections` and a browser assertion that a fixture with `data-section-exclude="lectures"` contains Research Highlights and Volunteering but not Lectures & Teaching in both languages.

- [ ] **Step 2: Run tests and verify RED**

Run: `python3 -m unittest tests.test_portfolio_data.PortfolioDataTests.test_cv_page_excludes_lectures_without_hardcoding_other_sections tests.test_browser_smoke.BrowserSmokeTests.test_fallback_renders_count_actions_media_and_korean -v`

Expected: FAIL because exclusion is unsupported and `CV.md` has no exclusion attribute.

- [ ] **Step 3: Implement exclusion**

In `renderCV(root)`, parse `root.dataset.sectionExclude` into a `Set`. Filter visible rows by inclusion first and exclusion second. Add `data-section-exclude="lectures"` to `CV.md`.

- [ ] **Step 4: Run focused and full tests**

Run: `python3 -m unittest discover -s tests -v`

Expected: all tests pass, with no lectures on the exclusion fixture.

- [ ] **Step 5: Commit**

```bash
git add CV.md assets/js/portfolio-data.js tests
git commit -m "fix: separate lectures from website CV"
```
