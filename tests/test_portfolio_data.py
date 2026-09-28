import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CONTENT_MODEL_URL = "https://docs.google.com/spreadsheets/d/160B7eluBKDU2f8tFonL6resy1zAnTPkPVd0_BeBwMLE/edit?usp=sharing"
PUBLICATION_HEADERS = [
    "Pub_ID", "Year", "Title", "Venue_Name", "Authors", "Spacer",
    "Project_Link", "GDrive_Link", "arXiv_Link", "Paper_Link", "Venue_Link",
    "Code", "Model", "Poster_Link", "Slides_link", "Cite",
    "In Google Scholar", "Cited at Least Once", "Notes", "Remarks",
]


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

    def test_remote_publications_are_schema_validated_before_cache_replacement(self):
        source = (ROOT / "assets/js/portfolio-data.js").read_text(encoding="utf-8")
        self.assertIn("PUBLICATION_HEADERS", source)
        self.assertIn("validateRemoteRows", source)
        self.assertIn("Invalid WEB_Publications schema", source)

    def test_author_url_overrides_include_hospital_profiles(self):
        source = (ROOT / "assets/js/portfolio-data.js").read_text(encoding="utf-8")
        self.assertIn("medDrSeq=274", source)
        self.assertIn("medDrSeq=286", source)

    def test_private_content_model_workbook_is_not_published(self):
        self.assertFalse((ROOT / "docs/Portfolio_Website_Content_Model.xlsx").exists())
        ignored = (ROOT / ".gitignore").read_text(encoding="utf-8")
        self.assertIn("docs/Portfolio_Website_Content_Model.xlsx", ignored)

    def test_apps_script_aliases_and_validates_web_publications(self):
        source = (ROOT / "docs/google-sheets-code.gs").read_text(encoding="utf-8")
        self.assertIn('"07_Publications": "WEB_Publications"', source)
        self.assertIn('"Publications": "WEB_Publications"', source)
        self.assertNotIn('"DB_Publications": "DB_Publications"', source)
        self.assertIn("validateHeaders_", source)
        self.assertIn("Missing required columns", source)
        for header in PUBLICATION_HEADERS:
            self.assertIn(f'"{header}"', source)

    def test_korean_quick_guide_covers_copy_personal_and_redeployment(self):
        guide = (ROOT / "docs/GOOGLE_SHEETS_QUICK_EDIT_KO.txt").read_text(encoding="utf-8")
        self.assertIn("A:T", guide)
        self.assertIn("PERSONAL", guide)
        self.assertIn("새 버전", guide)
        self.assertIn("WEB_Publications", guide)

    def test_cv_content_covers_research_patent_teaching_and_volunteering(self):
        rows = json.loads((ROOT / "assets/data/cv-content.json").read_text(encoding="utf-8"))
        text = json.dumps(rows, ensure_ascii=False)
        for required in (
            "Two Papers Accepted to NeurIPS 2026",
            "10-3010471-0000",
            "Registered Patent",
            "Korean Red Cross Blood Services",
            "2020.10.08",
            "2021.08.21",
            "NAVER Happy Bean",
            "NAVER Corp",
            "SK Telecom",
            "OUTTA AI Bootcamp",
            "KCA / Kyobo Life",
            "Busan Metropolitan City",
            "Kookmin University AX-Startup Bootcamp",
            "2026.08.29 and 2026.09.01",
        ):
            self.assertIn(required, text)
        image_rows = [row for row in rows if row.get("image_url")]
        self.assertGreaterEqual(len(image_rows), 6)
        for row in image_rows:
            self.assertTrue((ROOT / row["image_url"].lstrip("/")).is_file(), row["image_url"])

    def test_home_and_cv_use_bilingual_sheet_renderer_with_media(self):
        index = (ROOT / "index.md").read_text(encoding="utf-8")
        javascript = (ROOT / "assets/js/portfolio-data.js").read_text(encoding="utf-8")
        self.assertIn("data-portfolio-cv", index)
        self.assertIn("data-section-filter", index)
        self.assertNotIn("## Teaching & Mentoring", index)
        self.assertIn("sectionFilter", javascript)
        self.assertIn("image_url", javascript)
        self.assertIn("portfolio:languagechange", javascript)

    def test_publication_note_links_the_content_model(self):
        source = (ROOT / "publication.md").read_text(encoding="utf-8")
        self.assertIn('Portfolio_Website_Content_Model', source)
        self.assertIn(f'href="{CONTENT_MODEL_URL}"', source)
        self.assertNotIn('href="/docs/Portfolio_Website_Content_Model.xlsx"', source)
        self.assertNotIn('data-content-model-link', source)

        payload = json.loads((ROOT / "assets/data/portfolio-data.json").read_text(encoding="utf-8"))
        config = {row["config_key"]: row for row in payload["sheets"]["Site_Config"]}
        self.assertEqual(CONTENT_MODEL_URL, config["content_model_url"]["value_en"])
        self.assertEqual(CONTENT_MODEL_URL, config["content_model_url"]["value_ko"])

    def test_lectures_has_a_dedicated_navigation_page_backed_by_cv_content(self):
        config = (ROOT / "_config.yml").read_text(encoding="utf-8")
        page = (ROOT / "lectures.md").read_text(encoding="utf-8")
        self.assertIn('Lectures: "lectures"', config)
        self.assertIn('data-portfolio-cv', page)
        self.assertIn('data-section-filter="lectures"', page)
        self.assertIn('portfolio-data.js', (ROOT / "_includes/footer-scripts.html").read_text(encoding="utf-8"))

    def test_cv_page_excludes_lectures_without_hardcoding_other_sections(self):
        page = (ROOT / "CV.md").read_text(encoding="utf-8")
        javascript = (ROOT / "assets/js/portfolio-data.js").read_text(encoding="utf-8")
        self.assertIn('data-section-exclude="lectures"', page)
        self.assertNotIn('data-section-filter=', page)
        self.assertIn("sectionExclude", javascript)


if __name__ == "__main__":
    unittest.main()
