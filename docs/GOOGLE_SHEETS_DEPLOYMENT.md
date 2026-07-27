# Portfolio Google Sheets deployment

The workbook is designed so that the first 14 columns of IMSI Lab's
`WEB_Publications` tab can be pasted directly into `DB_Publications`.
Additional portfolio-only fields begin at column O.

## Upload and deploy

1. Upload `Portfolio_Website_Content_Model.xlsx` to Google Drive.
2. Open it with Google Sheets and confirm that `WEB_Publications` is populated
   from `DB_Publications`.
3. Open **Extensions → Apps Script**.
4. Replace the editor contents with [google-sheets-code.gs](google-sheets-code.gs).
5. Select **Deploy → New deployment → Web app**.
6. Use **Execute as: Me** and **Who has access: Anyone**.
7. Copy the URL ending in `/exec`.
8. Set `portfolio_api_url` in `_config.yml` to that URL.

Cell edits are served immediately. A new deployment is only needed when
`Code.gs` itself changes.

## Browser checks

```text
.../exec?sheet=07_Publications&lang=en
.../exec?sheet=07_Publications&lang=ko
.../exec?sheet=07_Publications&lang=all
.../exec?sheet=08_Projects&lang=en
.../exec?sheet=08_Projects&lang=en&slug=3d-lldm
.../exec?sheet=09_Project_Content&lang=ko&project_id=PROJ_3DLLDM
```

The API removes any column containing `private`; credential numbers therefore
remain in the maintenance workbook and are not published.

## Editing rules

- Publications: edit `DB_Publications`; keep `Pub_ID` unique.
- IMSI import: paste `WEB_Publications!A:N` into `DB_Publications!A:N`.
- Korean text: optional. Empty Korean values fall back to English.
- Projects: use public HTTPS URLs in `cover_image_url`.
- Project details: add ordered blocks in `Project_Content`.
- Visibility: set `Is_Visible`/`is_visible` to false to hide a row.

GitHub Pages also contains `assets/data/portfolio-data.json`. It is an offline
fallback used when Apps Script is unavailable; regenerate it with:

```bash
python3 scripts/build_content_model.py \
  --imsi /path/to/latest-imsi-export.xlsx \
  --credentials /path/to/KHKIM_Certifications_Licenses.xlsx \
  --output docs/Portfolio_Website_Content_Model.xlsx \
  --json-output assets/data/portfolio-data.json
```
