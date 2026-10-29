# Publication Presentation Video Design

## Intent

Keep the portfolio publication archive compatible with the 21-column A:U
`WEB_Publications` sheet and expose a YouTube presentation link when the
`Presentation_Video` cell is populated.

## Approach

Extend the existing publication normalization and action renderer instead of
adding a separate video data source. Accept both `Slides_Link` and the legacy
`Slides_link`, render `Presentation` immediately after `Slides`, and omit the
action when its URL is empty. Keep the offline JSON snapshot and Apps Script
source on the same A:U contract so saved-content rendering remains valid.

## Constraints

- Presentation URLs are read dynamically from Google Sheets, never hardcoded.
- Existing publication actions and Cite behavior remain unchanged.
- External presentation links open in a new tab with `noopener`.
- The deployed Apps Script currently returns the new field; its checked-in
  source must be updated before any future Apps Script redeployment.
