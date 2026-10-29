# Publication Presentation Video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render sheet-provided presentation videos in P1 publications while preserving all existing actions.

**Architecture:** Update the existing publication schema, normalizer, and action renderer. Keep the Apps Script contract, offline snapshot, tests, and editing documentation aligned with A:U.

**Tech Stack:** JavaScript, Google Apps Script, Jekyll, Python unittest, Firefox WebDriver

**Spec:** `docs/superpowers/specs/2026-10-29-publication-presentation-video-design.md`

## Global Constraints

- Do not hardcode YouTube URLs.
- Place Presentation after Slides and before Cite.
- Preserve backward compatibility with `Slides_link`.

## Review Focus

- A row with a video renders Presentation in a new tab.
- A row without a video does not render Presentation.
- Slides and Cite retain their behavior and order.
- Both current and legacy slide headers normalize correctly.
- Offline fallback remains valid when the remote API is unavailable.

### Task 1: A:U publication contract and renderer

**Files:**
- Modify: `tests/test_portfolio_data.py`
- Modify: `tests/test_browser_smoke.py`
- Modify: `assets/js/portfolio-data.js`

- [ ] Add failing schema and browser assertions.
- [ ] Run targeted tests and confirm the missing feature fails.
- [ ] Add normalization and Presentation action rendering.
- [ ] Run targeted tests and confirm they pass.

### Task 2: Saved data and Apps Script contract

**Files:**
- Modify: `assets/data/portfolio-data.json`
- Modify: `scripts/build_content_model.py`
- Modify: `docs/google-sheets-code.gs`
- Modify: `docs/GOOGLE_SHEETS_DEPLOYMENT.md`
- Modify: `docs/GOOGLE_SHEETS_QUICK_EDIT_KO.txt`

- [ ] Migrate the saved publication rows to the A:U key order.
- [ ] Update builder and Apps Script required headers.
- [ ] Update A:T editing references to A:U.
- [ ] Run the full test suite.

### Task 3: Deploy both sites

- [ ] Verify scoped diffs and full tests in P1 and P2.
- [ ] Commit only task-related files in each repository.
- [ ] Push both `main` branches and verify remote commit IDs.
