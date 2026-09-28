/**
 * Kyeonghun Kim portfolio read-only JSON API.
 *
 * Deploy as: Web app / Execute as me / Who has access: Anyone.
 * Do not place phone numbers or other private data in the public sheets.
 */
const SHEETS = {
  "01_Site_Config": "Site_Config",
  "02_Home_Sections": "Home_Sections",
  "05_People": "WEB_People",
  "06_CV_Content": "CV_Content",
  "07_Publications": "WEB_Publications",
  "08_Projects": "Projects",
  "09_Project_Content": "Project_Content",
  "10_Credentials": "Professional_Credentials",
  "11_News": "News",
  "12_Skills": "Skills",
  "Site_Config": "Site_Config",
  "Home_Sections": "Home_Sections",
  "WEB_People": "WEB_People",
  "CV_Content": "CV_Content",
  "WEB_Publications": "WEB_Publications",
  "Publications": "WEB_Publications",
  "Projects": "Projects",
  "Project_Content": "Project_Content",
  "Professional_Credentials": "Professional_Credentials",
  "News": "News",
  "Skills": "Skills"
};

const REQUIRED_HEADERS = {
  "WEB_Publications": [
    "Pub_ID", "Year", "Title", "Venue_Name", "Authors", "Spacer",
    "Project_Link", "GDrive_Link", "arXiv_Link", "Paper_Link", "Venue_Link",
    "Code", "Model", "Poster_Link", "Slides_link", "Cite",
    "In Google Scholar", "Cited at Least Once", "Notes", "Remarks"
  ]
};

function doGet(e) {
  const params = (e && e.parameter) || {};
  const requested = params.sheet || "Site_Config";
  const sheetName = SHEETS[requested];
  if (!sheetName) {
    return jsonResponse_({ok: false, error: "Unknown sheet", allowed: Object.keys(SHEETS)});
  }

  const lang = ["en", "ko", "all"].includes(params.lang) ? params.lang : "all";
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return jsonResponse_({ok: false, error: "Missing sheet: " + sheetName});

  const values = sheet.getDataRange().getDisplayValues();
  if (!values.length) return jsonResponse_({ok: true, sheet: sheetName, lang: lang, data: []});

  const headers = values.shift().map(String);
  const headerError = validateHeaders_(sheetName, headers);
  if (headerError) {
    return jsonResponse_({ok: false, sheet: sheetName, error: headerError});
  }
  let rows = values
    .filter(row => row.some(value => String(value).trim() !== ""))
    .map(row => rowToObject_(headers, row))
    .filter(row => visible_(row));

  rows = filterRows_(rows, params);
  rows = rows.map(row => localize_(publicColumns_(row), lang));

  const limit = Math.max(0, Number(params.limit || 0));
  if (limit) rows = rows.slice(0, limit);

  return jsonResponse_({
    ok: true,
    sheet: sheetName,
    lang: lang,
    count: rows.length,
    updated_at: new Date().toISOString(),
    data: rows
  });
}

function validateHeaders_(sheetName, headers) {
  const required = REQUIRED_HEADERS[sheetName] || [];
  const missing = required.filter(header => !headers.includes(header));
  return missing.length ? "Missing required columns: " + missing.join(", ") : "";
}

function rowToObject_(headers, row) {
  return headers.reduce((result, key, index) => {
    if (key) result[key] = row[index] || "";
    return result;
  }, {});
}

function publicColumns_(row) {
  return Object.keys(row).reduce((result, key) => {
    if (!/private/i.test(key)) result[key] = row[key];
    return result;
  }, {});
}

function visible_(row) {
  const key = Object.keys(row).find(k => /^(is_?visible)$/i.test(k));
  if (!key || row[key] === "") return true;
  return !/^(false|0|no|n)$/i.test(String(row[key]).trim());
}

function filterRows_(rows, params) {
  const aliases = {
    slug: ["slug"],
    project_id: ["project_id", "Project_ID"],
    pub_id: ["pub_id", "Pub_ID"],
    featured: ["featured_on_home", "Featured"]
  };
  Object.keys(aliases).forEach(param => {
    if (!params[param]) return;
    rows = rows.filter(row => aliases[param].some(key =>
      String(row[key] || "").toLowerCase() === String(params[param]).toLowerCase()
    ));
  });
  return rows;
}

function localize_(row, lang) {
  if (lang === "all") return row;
  const result = {};
  Object.keys(row).forEach(key => {
    if (/_en$/i.test(key) || /_ko$/i.test(key)) return;
    result[key] = row[key];
  });
  Object.keys(row).forEach(key => {
    const match = key.match(new RegExp("^(.*)_" + lang + "$", "i"));
    if (!match) return;
    const base = match[1];
    result[base] = row[key] || row[base + "_en"] || "";
  });
  return result;
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Portfolio")
    .addItem("Validate public sheets", "validatePortfolio")
    .addToUi();
}

function validatePortfolio() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const missing = [...new Set(Object.values(SHEETS))]
    .filter(name => !spreadsheet.getSheetByName(name));
  const headerErrors = Object.keys(REQUIRED_HEADERS).map(name => {
    const sheet = spreadsheet.getSheetByName(name);
    if (!sheet) return "";
    const width = Math.max(1, sheet.getLastColumn());
    const headers = sheet.getRange(1, 1, 1, width).getDisplayValues()[0].map(String);
    const error = validateHeaders_(name, headers);
    return error ? name + " — " + error : "";
  }).filter(Boolean);
  const problems = [];
  if (missing.length) problems.push("Missing sheets: " + missing.join(", "));
  problems.push.apply(problems, headerErrors);
  const message = problems.length
    ? problems.join("\n")
    : "All public sheets are ready. Re-deploy only when Code.gs changes; cell edits are live immediately.";
  SpreadsheetApp.getUi().alert(message);
}
