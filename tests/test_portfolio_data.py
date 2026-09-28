import json
import unittest
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PUBLICATION_HEADERS = [
    "Pub_ID", "Year", "Title", "Venue_Name", "Authors", "Spacer",
    "Project_Link", "GDrive_Link", "arXiv_Link", "Paper_Link", "Venue_Link",
    "Code", "Model", "Poster_Link", "Slides_link", "Cite",
    "In Google Scholar", "Cited at Least Once", "Notes", "Remarks",
]


def workbook_sheet_names_and_headers(path, wanted):
    ns = {
        "x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
        "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
        "p": "http://schemas.openxmlformats.org/package/2006/relationships",
    }
    with zipfile.ZipFile(path) as archive:
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        targets = {rel.attrib["Id"]: rel.attrib["Target"] for rel in relationships}
        sheets = {
            sheet.attrib["name"]: targets[sheet.attrib[f"{{{ns['r']}}}id"]]
            for sheet in workbook.findall("x:sheets/x:sheet", ns)
        }
        shared = []
        if "xl/sharedStrings.xml" in archive.namelist():
            strings = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            shared = ["".join(node.itertext()) for node in strings.findall("x:si", ns)]
        target = sheets[wanted]
        target = target.lstrip("/") if target.startswith("/") else "xl/" + target.lstrip("/")
        sheet_xml = ET.fromstring(archive.read(target))
        first_row = sheet_xml.find("x:sheetData/x:row", ns)
        headers = []
        for cell in first_row.findall("x:c", ns):
            if cell.attrib.get("t") == "inlineStr":
                headers.append("".join(cell.find("x:is", ns).itertext()))
            else:
                value = cell.findtext("x:v", default="", namespaces=ns)
                headers.append(shared[int(value)] if cell.attrib.get("t") == "s" else value)
        return list(sheets), headers


class PortfolioDataTests(unittest.TestCase):
    def test_builder_and_fallback_use_exact_a_to_t_publication_schema(self):
        source = (ROOT / "scripts/build_content_model.py").read_text(encoding="utf-8")
        for header in PUBLICATION_HEADERS:
            self.assertIn(f'"{header}"', source)
        payload = json.loads((ROOT / "assets/data/portfolio-data.json").read_text(encoding="utf-8"))
        rows = payload["sheets"]["Publications"]
        self.assertGreater(len(rows), 0)
        self.assertEqual(PUBLICATION_HEADERS, list(rows[0].keys()))
        self.assertTrue(all("Kyeonghun Kim" in row["Authors"] for row in rows))

    def test_publication_renderer_has_all_actions_and_result_count(self):
        source = (ROOT / "assets/js/portfolio-data.js").read_text(encoding="utf-8")
        self.assertIn("expectedApiSheets", source)
        self.assertIn("Publications: 'WEB_Publications'", source)
        for label in ("Project", "GDrive", "arXiv", "Paper", "Venue", "Code", "Model", "Poster", "Slides", "Cite"):
            self.assertIn(f"'{label}'", source)
        self.assertIn("data-publication-count", source)
        self.assertIn("Kyeonghun Kim", source)
        self.assertNotIn("const titleLink =", source)

    def test_author_url_overrides_include_hospital_profiles(self):
        source = (ROOT / "assets/js/portfolio-data.js").read_text(encoding="utf-8")
        self.assertIn("medDrSeq=274", source)
        self.assertIn("medDrSeq=286", source)

    def test_workbook_web_publications_is_a_to_t_and_db_copy_is_removed(self):
        names, headers = workbook_sheet_names_and_headers(
            ROOT / "docs/Portfolio_Website_Content_Model.xlsx", "WEB_Publications"
        )
        self.assertNotIn("DB_Publications", names)
        self.assertEqual(PUBLICATION_HEADERS, headers)


if __name__ == "__main__":
    unittest.main()
