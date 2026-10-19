import ast
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
    def test_cv_page_exposes_english_and_korean_drive_folders(self):
        page = (ROOT / "CV.md").read_text(encoding="utf-8")
        self.assertIn('data-cv-download="en"', page)
        self.assertIn('data-cv-download="ko"', page)
        self.assertIn("1U5ENrltXZDs5EobbmH_y6YenByKtdjZx", page)
        self.assertIn("1UPX3vLzKza-hmvgMHZKkdo47UIrC-MHz", page)
        self.assertEqual(2, page.count('target="_blank"'))

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
        self.assertEqual(61, len(json.loads(
            (ROOT / "assets/data/cv-content.json").read_text(encoding="utf-8")
        )))

    def test_cv_research_metrics_are_bilingual_and_replace_the_long_summary(self):
        rows = json.loads((ROOT / "assets/data/cv-content.json").read_text(encoding="utf-8"))
        snapshot = json.loads((ROOT / "assets/data/portfolio-data.json").read_text(encoding="utf-8"))
        metrics = sorted(
            [row for row in rows if row.get("section_id") == "research_metrics"],
            key=lambda row: int(row["display_order"]),
        )
        self.assertEqual(rows, snapshot["sheets"]["CV_Content"])
        self.assertEqual("Research at a Glance", metrics[0]["section_title_en"])
        self.assertEqual("연구 성과 한눈에 보기", metrics[0]["section_title_ko"])
        self.assertEqual([
            ("NeurIPS 2026", "2"), ("MICCAI Workshops", "2"),
            ("AAAI Workshop", "1"), ("ISBI Oral", "3"),
            ("IEEE MedAI", "1"), ("AICAS Oral", "3"),
            ("APCCAS", "4"), ("NVIDIA GTC Posters", "3"),
            ("AACL-IJCNLP", "1"),
        ], [(row["title_en"], row["period_en"]) for row in metrics])
        self.assertTrue(all(row["entry_type"] == "research_metric" for row in metrics))
        content = json.dumps(rows, ensure_ascii=False)
        self.assertNotIn("Research portfolio also includes", content)
        self.assertNotIn("MICCAI Workshop 2편, ISBI 구두발표 3편", content)

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

    def test_author_url_overrides_include_requested_profiles(self):
        source = (ROOT / "assets/js/portfolio-data.js").read_text(encoding="utf-8")
        payload = json.loads((ROOT / "assets/data/portfolio-data.json").read_text(encoding="utf-8"))
        sieun = next(row for row in payload["sheets"]["DB_People"] if row.get("Name_EN") == "Sieun Hyeon")
        self.assertIn("'Sieun Hyeon': 'https://hyeonsieun.github.io/'", source)
        self.assertEqual("https://hyeonsieun.github.io/", sieun["Primary_URL"])

    def test_projects_are_sorted_newest_first(self):
        source = (ROOT / "assets/js/portfolio-data.js").read_text(encoding="utf-8")
        self.assertIn("function compareProjects", source)
        self.assertIn("String(b.sort_date || '').localeCompare(String(a.sort_date || ''))", source)
        self.assertIn("Number(a.display_order || 0) - Number(b.display_order || 0)", source)
        self.assertIn("localized(a, 'title', lang).localeCompare(localized(b, 'title', lang))", source)

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
            "Aug. 29, 2026 and Sep. 1, 2026",
        ):
            self.assertIn(required, text)
        image_rows = [row for row in rows if row.get("image_url")]
        self.assertGreaterEqual(len(image_rows), 6)
        for row in image_rows:
            for image_url in row["image_url"].split("|"):
                self.assertTrue((ROOT / image_url.lstrip("/")).is_file(), image_url)

    def test_cv_content_has_canonical_teaching_award_and_patent_dates(self):
        builder_tree = ast.parse((ROOT / "scripts/build_content_model.py").read_text(encoding="utf-8"))
        header_assignment = next(
            node for node in builder_tree.body
            if isinstance(node, ast.Assign)
            and any(isinstance(target, ast.Name) and target.id == "CV_CONTENT_HEADERS" for target in node.targets)
        )
        self.assertIn("sort_date", ast.literal_eval(header_assignment.value))
        rows = json.loads((ROOT / "assets/data/cv-content.json").read_text(encoding="utf-8"))
        snapshot = json.loads((ROOT / "assets/data/portfolio-data.json").read_text(encoding="utf-8"))
        self.assertEqual(rows, snapshot["sheets"]["CV_Content"])
        lectures = sorted(
            [row for row in rows if row.get("section_id") == "lectures"],
            key=lambda row: row["sort_date"], reverse=True,
        )
        self.assertEqual(12, len(lectures))
        self.assertEqual([
            "CV_LEC_001", "CV_LEC_008", "CV_LEC_007", "CV_LEC_003", "CV_LEC_006",
            "CV_LEC_005", "CV_LEC_012", "CV_LEC_004", "CV_LEC_009",
            "CV_LEC_002", "CV_LEC_011", "CV_LEC_010",
        ], [row["content_id"] for row in lectures])
        by_id = {row["content_id"]: row for row in rows}
        expected_periods = {
            "CV_LEC_001": ("Mar. 2, 2018 – Present", "2018년 3월 2일 – 현재"),
            "CV_LEC_002": ("Dec. 5, 2023 – Dec. 7, 2023", "2023년 12월 5일 – 2023년 12월 7일"),
            "CV_LEC_003": ("Jun. 1, 2024 – Aug. 30, 2026", "2024년 6월 1일 – 2026년 8월 30일"),
            "CV_LEC_004": ("Apr. 25, 2025", "2025년 4월 25일"),
            "CV_LEC_005": ("Apr. 21, 2026", "2026년 4월 21일"),
            "CV_LEC_006": ("Jul. 1, 2026", "2026년 7월 1일"),
            "CV_LEC_007": ("Aug. 29, 2026 and Sep. 1, 2026", "2026년 8월 29일 및 2026년 9월 1일"),
            "CV_LEC_008": ("Oct. 23, 2026", "2026년 10월 23일"),
            "CV_LEC_009": ("Aug. 23, 2020 – Feb. 16, 2024", "2020년 8월 23일 – 2024년 2월 16일"),
            "CV_LEC_010": ("Dec. 10, 2017 – Jun. 17, 2021", "2017년 12월 10일 – 2021년 6월 17일"),
            "CV_LEC_011": ("Jun. 8, 2023 – Aug. 30, 2023", "2023년 6월 8일 – 2023년 8월 30일"),
            "CV_LEC_012": ("Oct. 5, 2023 – Dec. 30, 2025", "2023년 10월 5일 – 2025년 12월 30일"),
        }
        for content_id, (period_en, period_ko) in expected_periods.items():
            self.assertEqual(period_en, by_id[content_id]["period_en"])
            self.assertEqual(period_ko, by_id[content_id]["period_ko"])
        self.assertEqual("Oct. 23, 2026", by_id["CV_LEC_008"]["period_en"])
        self.assertEqual("생성형 AI 활용 업무 효율화 및 공공행정 실무 교육", by_id["CV_LEC_008"]["subtitle_ko"])
        self.assertNotIn("forthcoming", json.dumps(by_id["CV_LEC_008"]).lower())
        self.assertEqual("", by_id["CV_LEC_008"]["image_url"])
        self.assertEqual("Aug. 16–18, 2019", by_id["CV_AWD_001"]["period_en"])
        self.assertEqual("", by_id["CV_AWD_001"]["image_url"])
        award_path = "/assets/img/portfolio/awards/2019-ksae-team-sv-bronze.png"
        self.assertIn(f"[bronze in the EV division]({award_path})", by_id["CV_AWD_001"]["description_en"])
        self.assertIn(f"[EV 부문 동상]({award_path})", by_id["CV_AWD_001"]["description_ko"])
        self.assertTrue((ROOT / award_path.lstrip("/")).is_file())
        self.assertEqual("Aug. 27, 2026", by_id["CV_PAT_001"]["period_en"])
        self.assertEqual("2026년 8월 27일", by_id["CV_PAT_001"]["period_ko"])
        self.assertIn("Registration date: Aug. 27, 2026", by_id["CV_PAT_001"]["description_en"])
        self.assertIn("특허등록일: 2026년 8월 27일", by_id["CV_PAT_001"]["description_ko"])
        for filename in ("assets/data/cv-content.json", "assets/data/portfolio-data.json"):
            text = (ROOT / filename).read_text(encoding="utf-8")
            for required in ("2,302,547", "5,000+", "3,000+", "102 universities", "10-3010471-0000"):
                self.assertIn(required, text)

    def test_cv_research_history_has_advisors_hardware_labs_and_public_media(self):
        rows = json.loads((ROOT / "assets/data/cv-content.json").read_text(encoding="utf-8"))
        by_id = {row["content_id"]: row for row in rows}
        research = [row for row in rows if row.get("section_id") == "research"]

        self.assertEqual(["CV_RES_001", "CV_RES_004", "CV_RES_002", "CV_RES_003"],
                         [row["content_id"] for row in research])
        medical = by_id["CV_RES_001"]
        self.assertIn("Advisors: Prof. Nam-joon Kim; Prof. Hyuk-Jae Lee; Woo Kyoung Jeong, Radiologist (SMC)",
                      medical["subtitle_en"])
        self.assertIn("Jetson Thor", medical["description_en"])
        self.assertIn("RTX 5090", medical["description_en"])
        self.assertEqual("https://imsilab.github.io/imsi/", medical["link_url"])

        imocap = by_id["CV_RES_002"]
        apc = by_id["CV_RES_003"]
        aise = by_id["CV_RES_004"]
        self.assertEqual("AISE Lab, Kookmin University", aise["title_en"])
        self.assertEqual("Sep. 1, 2022 – Aug. 5, 2024", aise["period_en"])
        self.assertEqual("Prof. Soo-Yeon Yoon|mailto:1104py@kookmin.ac.kr", aise["related_links"])
        self.assertIn("TimeYOLO", aise["description_en"])
        self.assertIn("Prompt-Guided Image Generation", aise["description_en"])
        self.assertEqual("https://sites.google.com/view/imocap/home", imocap["link_url"])
        self.assertEqual("https://sites.google.com/view/apcl", apc["link_url"])
        self.assertIn("Prof. Jung Keun Lee", imocap["subtitle_en"])
        self.assertIn("Prof. Kwang-Seok Oh", apc["subtitle_en"])
        self.assertEqual("", apc["image_url"])
        award_path = "/assets/img/portfolio/awards/2019-ksae-team-sv-bronze.png"
        self.assertIn(f"[the Bronze Award]({award_path})", apc["description_en"])
        self.assertTrue((ROOT / award_path.lstrip("/")).is_file(), award_path)
        image_paths = imocap["image_url"].split("|")
        self.assertEqual(2, len(image_paths))
        for image_path in image_paths:
            self.assertTrue((ROOT / image_path.lstrip("/")).is_file(), image_path)

    def test_home_and_cv_use_bilingual_sheet_renderer_with_media(self):
        index = (ROOT / "index.md").read_text(encoding="utf-8")
        javascript = (ROOT / "assets/js/portfolio-data.js").read_text(encoding="utf-8")
        self.assertIn("data-portfolio-cv", index)
        self.assertIn("data-section-filter", index)
        self.assertIn("research_metrics", index)
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
