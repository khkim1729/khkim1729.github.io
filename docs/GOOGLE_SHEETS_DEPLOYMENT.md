# Portfolio Google Sheets deployment

The workbook uses the same A:T publication schema as IMSI Lab. Copy the entire
`WEB_Publications!A:T` range into this workbook's `WEB_Publications!A:T`.

## Upload and deploy

1. Upload your private `Portfolio_Website_Content_Model.xlsx` backup to Google Drive. Keep the XLSX outside this public repository.
2. Open it with Google Sheets and confirm that `WEB_Publications` is populated.
3. Open **Extensions → Apps Script**.
4. Replace the editor contents with [google-sheets-code.gs](google-sheets-code.gs).
5. For the first deployment, select **Deploy → New deployment → Web app**.
6. Use **Execute as: Me** and **Who has access: Anyone**.
7. After changing `Code.gs`, select **Deploy → Manage deployments → Edit**,
   choose **New version**, and deploy it. Saving the editor alone does not update
   an existing `/exec` deployment.
8. Copy the URL ending in `/exec`.
9. Set `portfolio_api_url` in `_config.yml` to that URL.

Cell edits are served immediately. A new deployment is only needed when
`Code.gs` itself changes.

The publication check must report `"sheet":"WEB_Publications"` and
`"ok":true`:

```text
.../exec?sheet=07_Publications&lang=all
```

## Browser checks

```text
.../exec?sheet=07_Publications&lang=en
.../exec?sheet=07_Publications&lang=ko
.../exec?sheet=07_Publications&lang=all
.../exec?sheet=08_Projects&lang=en
.../exec?sheet=08_Projects&lang=en&slug=3d-lldm
.../exec?sheet=09_Project_Content&lang=ko&project_id=PROJ_3DLLDM
.../exec?sheet=10_Credentials&lang=all
.../exec?sheet=Site_Config&lang=all
.../exec?sheet=06_CV_Content&lang=all
```

The API publishes `khkim1729@gmail.com` from `Site_Config` and publishes
`credential_number`/`verification_id` for the credentials table. Do not add a
phone-number column or any other private contact data to a public sheet.

## Editing rules

- Publications: edit `WEB_Publications`; keep `Pub_ID` unique.
- IMSI backup: paste the IMSI roster's `WEB_Publications!A:T` into
  `WEB_Publications!A:T` without changing the header row.
- Personal-only papers: enter the exact token `PERSONAL` in `Remarks`. P1 keeps
  Kyeonghun Kim's rows; P2 hides rows carrying this token.
- Korean text: optional. Empty Korean values fall back to English.
- CV: edit `CV_Content`; each row is one CV entry. Use line breaks in
  `description_en`/`description_ko` to create bullet points. The EN/KO switch
  redraws every CV section from these localized columns.
- Projects: use public HTTPS URLs in `cover_image_url`.
- Project details: add ordered blocks in `Project_Content`.
- Visibility: set `Is_Visible`/`is_visible` to false to hide a row.

GitHub Pages also contains `assets/data/portfolio-data.json`. It is an offline
fallback used when Apps Script is unavailable; regenerate it with:

```bash
python3 scripts/build_content_model.py \
  --imsi /path/to/latest-imsi-export.xlsx \
  --credentials /path/to/KHKIM_Certifications_Licenses.xlsx \
  --output ../Portfolio_Website_Content_Model.xlsx \
  --json-output assets/data/portfolio-data.json
```

For the short Korean editing checklist, see
`docs/GOOGLE_SHEETS_QUICK_EDIT_KO.txt`.
