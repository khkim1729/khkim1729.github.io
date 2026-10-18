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

    def test_offline_snapshot_contains_current_publications_and_learning_videos(self):
        payload = json.loads((ROOT / "assets/data/portfolio-data.json").read_text(encoding="utf-8"))
        self.assertEqual(50, len(payload["sheets"]["Publications"]))
        self.assertEqual(20, len(payload["sheets"]["Learning_Videos"]))
        self.assertEqual(43, len(json.loads(
            (ROOT / "assets/data/cv-content.json").read_text(encoding="utf-8")
        )))

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

    def test_learning_video_endpoint_is_restricted(self):
        source = (ROOT / "docs/google-sheets-code.gs").read_text(encoding="utf-8")
        guide = (ROOT / "docs/GOOGLE_SHEETS_QUICK_EDIT_KO.txt").read_text(encoding="utf-8")
        self.assertIn('requested === "Learning_Videos"', source)
        self.assertIn('getSheetByName("Learning_Videos")', source)
        self.assertNotIn('"DB_Publications": "DB_Publications"', source)
        self.assertIn("베타러닝 유튜브", source)
        self.assertIn("람다코스 유튜브", source)
        self.assertIn("Learning_Videos&lang=all", guide)
        self.assertIn("Learning_Videos 전체를 공개하지", guide)

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
        source = (ROOT / "publications" / "index.html").read_text(encoding="utf-8")
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

    def test_cv_media_uses_an_accessible_in_page_lightbox(self):
        javascript = (ROOT / "assets/js/portfolio-data.js").read_text(encoding="utf-8")
        page = (ROOT / "_includes/footer-scripts.html").read_text(encoding="utf-8")
        self.assertIn("data-cv-media", javascript)
        self.assertIn("openMediaModal", javascript)
        self.assertIn("data-portfolio-media-modal", page)
        self.assertIn('aria-modal="true"', page)

    def test_learning_video_gallery_exposes_filters_counts_and_modal_title(self):
        javascript = (ROOT / "assets/js/learning-videos.js").read_text(encoding="utf-8")
        page = (ROOT / "lectures.md").read_text(encoding="utf-8")
        for required in ("learning-video-filter", "learning-video-count", "dataset.videoTitle"):
            self.assertIn(required, javascript)
        self.assertIn("data-learning-video-modal-title", page)

    def test_cv_page_excludes_lectures_without_hardcoding_other_sections(self):
        page = (ROOT / "CV.md").read_text(encoding="utf-8")
        javascript = (ROOT / "assets/js/portfolio-data.js").read_text(encoding="utf-8")
        self.assertIn('data-section-exclude="lectures"', page)
        self.assertNotIn('data-section-filter=', page)
        self.assertIn("sectionExclude", javascript)

    def test_project_snapshot_has_seventeen_projects_and_two_local_media_for_every_project(self):
        payload = json.loads((ROOT / "assets/data/project-showcase.json").read_text(encoding="utf-8"))
        projects = payload["projects"]
        content = payload["content"]
        self.assertEqual(17, len(projects))
        self.assertEqual(17, len({row["project_id"] for row in projects}))
        self.assertTrue(all(row.get("categories") for row in projects))
        self.assertTrue(all(row.get("sort_date") for row in projects))
        self.assertTrue(all(row.get("cover_image_url", "").startswith("/assets/") for row in projects))
        for project in projects:
            self.assertGreaterEqual(len(project.get("scope_metrics", [])), 3, project["project_id"])
            for metric in project["scope_metrics"]:
                self.assertTrue(metric.get("value"), project["project_id"])
                self.assertTrue(metric.get("label_en"), project["project_id"])
                self.assertTrue(metric.get("label_ko"), project["project_id"])
            self.assertGreaterEqual(len(project.get("role_en", "")), 40, project["project_id"])
            self.assertGreaterEqual(len(project.get("role_ko", "")), 20, project["project_id"])
            self.assertGreaterEqual(len(project.get("contribution_en", "")), 100, project["project_id"])
            self.assertGreaterEqual(len(project.get("contribution_ko", "")), 50, project["project_id"])
            project_content = [row for row in content if row["project_id"] == project["project_id"]]
            self.assertGreaterEqual(len(project_content), 3, project["project_id"])
            self.assertGreaterEqual(
                sum(len(row.get("content_en", "")) for row in project_content), 650, project["project_id"]
            )
            self.assertGreaterEqual(
                sum(len(row.get("content_ko", "")) for row in project_content), 300, project["project_id"]
            )
        media_by_project = {
            project["project_id"]: set([
                project["cover_image_url"],
                *[
                row["media_url"] for row in content
                if row["project_id"] == project["project_id"] and row.get("media_url")
                ]
            ])
            for project in projects
        }
        self.assertTrue(all(len(paths) >= 2 for paths in media_by_project.values()), media_by_project)
        for paths in media_by_project.values():
            for media_url in paths:
                self.assertTrue(media_url.startswith("/assets/"), media_url)
                self.assertTrue((ROOT / media_url.lstrip("/")).is_file(), media_url)

        slugs = {row["slug"] for row in projects}
        self.assertEqual({
            "3d-lldm", "time", "mathena", "maesil", "cotta", "lucas", "cipher",
            "portfolio", "rag-chatbot", "dewarpnext", "hyperspectral-ocr",
            "medical-document-ai", "document-validation", "neurips-correlated-failures",
            "neurips-capsule-vision", "hierarchy-aware-preference-optimization",
            "fbi-benchmark-integrity",
        }, slugs)

    def test_project_page_has_shareable_detail_route_and_requested_categories(self):
        page = (ROOT / "projects" / "index.html").read_text(encoding="utf-8")
        detail = (ROOT / "projects" / "detail" / "index.html").read_text(encoding="utf-8")
        javascript = (ROOT / "assets" / "js" / "portfolio-data.js").read_text(encoding="utf-8")
        self.assertIn("data-portfolio-projects", page)
        self.assertIn("data-portfolio-project-detail", detail)
        self.assertIn("/projects/detail/?project=", javascript)
        self.assertIn('href="/projects/"', javascript)
        self.assertNotIn("/project/detail/?project=", javascript)
        self.assertIn("sort_date", javascript)
        self.assertIn("data-project-filter-count", javascript)
        self.assertIn("project-scope-metrics", javascript)
        self.assertIn("project-role-callout", javascript)
        self.assertIn("Project_Content", javascript)
        for category in (
            "All", "Medical AI", "Computer Vision", "GenAI", "LLM & NLP",
            "Document AI", "ML & DL", "Software", "Research",
        ):
            self.assertIn(category, javascript)

    def test_plural_portfolio_routes_are_canonical_and_legacy_routes_redirect(self):
        config = (ROOT / "_config.yml").read_text(encoding="utf-8")
        self.assertIn('Publications: "publications"', config)
        self.assertIn('Projects: "projects"', config)
        self.assertTrue((ROOT / "publications" / "index.html").is_file())
        self.assertTrue((ROOT / "projects" / "index.html").is_file())
        self.assertTrue((ROOT / "projects" / "detail" / "index.html").is_file())
        self.assertIn("/publications/", (ROOT / "publication.md").read_text(encoding="utf-8"))
        self.assertIn("/projects/", (ROOT / "project" / "index.html").read_text(encoding="utf-8"))
        legacy_detail = (ROOT / "project" / "detail" / "index.html").read_text(encoding="utf-8")
        self.assertIn("/projects/detail/", legacy_detail)
        self.assertIn("location.search", legacy_detail)


if __name__ == "__main__":
    unittest.main()
