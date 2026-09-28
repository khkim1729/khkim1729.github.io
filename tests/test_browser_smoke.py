import functools
import http.server
import json
import socket
import subprocess
import threading
import time
import unittest
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FIREFOX = Path("/snap/firefox/current/usr/lib/firefox/firefox")
GECKODRIVER = Path("/snap/firefox/current/usr/lib/firefox/geckodriver")


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, _format, *_args):
        pass


@unittest.skipUnless(FIREFOX.exists() and GECKODRIVER.exists(), "Firefox WebDriver is unavailable")
class BrowserSmokeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.web_port = free_port()
        cls.web_server = http.server.ThreadingHTTPServer(
            ("127.0.0.1", cls.web_port), functools.partial(QuietHandler, directory=str(ROOT))
        )
        threading.Thread(target=cls.web_server.serve_forever, daemon=True).start()
        cls.driver_port = free_port()
        cls.driver = subprocess.Popen(
            [str(GECKODRIVER), "--port", str(cls.driver_port)],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        cls.driver_url = f"http://127.0.0.1:{cls.driver_port}"
        deadline = time.time() + 15
        while time.time() < deadline:
            try:
                cls.request("GET", "/status")
                break
            except Exception:
                time.sleep(.1)
        response = cls.request("POST", "/session", {"capabilities": {"alwaysMatch": {
            "browserName": "firefox", "moz:firefoxOptions": {"binary": str(FIREFOX), "args": ["-headless"]}
        }}})
        cls.session_id = response["value"]["sessionId"]
        cls.request("POST", f"/session/{cls.session_id}/timeouts", {"script": 30000})

    @classmethod
    def tearDownClass(cls):
        if getattr(cls, "session_id", None):
            cls.request("DELETE", f"/session/{cls.session_id}")
        cls.driver.terminate()
        cls.web_server.shutdown()

    @classmethod
    def request(cls, method, path, payload=None):
        data = None if payload is None else json.dumps(payload).encode()
        request = urllib.request.Request(
            cls.driver_url + path, data=data, method=method,
            headers={"Content-Type": "application/json; charset=utf-8"},
        )
        with urllib.request.urlopen(request, timeout=35) as response:
            body = response.read()
        return json.loads(body) if body else {}

    def execute(self, script):
        return self.request(
            "POST", f"/session/{self.session_id}/execute/async", {"script": script, "args": []}
        )["value"]

    def test_fallback_renders_count_actions_media_and_korean(self):
        self.request("POST", f"/session/{self.session_id}/url", {
            "url": f"http://127.0.0.1:{self.web_port}/tests/fixtures/portfolio-render.html"
        })
        result = self.execute("""
          const done = arguments[arguments.length - 1];
          const deadline = Date.now() + 10000;
          (function poll() {
            const cards = [...document.querySelectorAll('.publication-card')];
            const text = document.body.innerText;
            if (cards.length && text.includes('Two Papers Accepted to NeurIPS 2026')) {
              done({
                cards: cards.length,
                count: document.querySelector('[data-publication-count]').innerText,
                labels: [...document.querySelectorAll('.publication-card .portfolio-chip')].map(x => x.innerText),
                images: document.querySelectorAll('.cv-entry-media img').length,
                text
              });
            } else if (Date.now() > deadline) done({error: text});
            else setTimeout(poll, 100);
          })();
        """)
        self.assertNotIn("error", result)
        self.assertIn(str(result["cards"]), result["count"])
        self.assertIn("GDrive", result["labels"])
        self.assertGreaterEqual(result["images"], 2)
        self.assertIn("Research Highlights", result["text"])
        self.assertIn("Volunteering & Giving", result["text"])
        self.assertNotIn("Lectures & Teaching", result["text"])

        korean = self.execute("""
          const done = arguments[arguments.length - 1];
          localStorage.setItem('language', 'kr');
          document.dispatchEvent(new CustomEvent('portfolio:languagechange'));
          setTimeout(() => done(document.body.innerText), 200);
        """)
        self.assertIn("연구 하이라이트", korean)
        self.assertIn("봉사 및 나눔", korean)
        self.assertNotIn("강의 및 교육", korean)

    def test_apps_script_learning_video_adapter_extracts_only_rich_text_links(self):
        self.request("POST", f"/session/{self.session_id}/url", {
            "url": f"http://127.0.0.1:{self.web_port}/tests/fixtures/apps-script-learning-videos.html"
        })
        result = self.execute("""
          const done = arguments[arguments.length - 1];
          const deadline = Date.now() + 10000;
          (function poll() {
            if (window.adapterResult) done(window.adapterResult);
            else if (window.adapterError) done({error: window.adapterError});
            else if (Date.now() > deadline) done({error: 'adapter timeout'});
            else setTimeout(poll, 50);
          })();
        """)
        self.assertNotIn("error", result)
        self.assertEqual(5, len(result))
        self.assertEqual(
            ["beta", "beta", "beta", "lambda", "lambda"],
            [row["series"] for row in result],
        )
        self.assertEqual(
            [
                "Beta Foundations", "Routing lecture", "Vision lecture",
                "https://youtu.be/CCCCCCCCCCC", "https://example.com/reading",
            ],
            [row["title"] for row in result],
        )
        self.assertEqual([1, 2, 3, 4, 5], [row["display_order"] for row in result])
        expected_keys = {
            "series", "series_label_en", "series_label_ko", "title", "url", "display_order"
        }
        self.assertTrue(all(set(row) == expected_keys for row in result))
        self.assertNotIn("Private Notes", json.dumps(result))


if __name__ == "__main__":
    unittest.main()
