#!/usr/bin/env python3
"""Generate lightweight, public-safe SVG diagrams for portfolio case studies."""

from html import escape
from pathlib import Path


OUTPUT = Path(__file__).resolve().parents[1] / "assets/img/portfolio/projects/generated"

VISUALS = {
    "maesil-learning.svg": ("MAESIL / MAEgic", "SELF-SUPERVISED MEDICAL IMAGING", ["Unlabelled volumes", "Patch masking", "MAE reconstruction", "Task transfer"], "Pretrain once · evaluate representations across downstream tasks"),
    "lucas-cover.svg": ("LUCAS", "MULTI-PHASE CEUS ANALYSIS", ["Arterial phase", "Portal phase", "Late phase", "Lesion decision"], "Temporal enhancement patterns become a structured learning signal"),
    "lucas-analysis.svg": ("Phase-aware review", "ULTRASOUND WORKFLOW", ["Align phases", "Crop lesion ROI", "Encode dynamics", "Inspect errors"], "Case-level review connects predictions to enhancement trajectories"),
    "portfolio-cover.svg": ("Research Portfolio", "BILINGUAL · DATA-DRIVEN · TESTED", ["Google Sheets", "Validated cache", "Static renderer", "GitHub Pages"], "Fast first paint with background content synchronization"),
    "portfolio-architecture.svg": ("Content architecture", "MAINTAINABLE PUBLICATION SYSTEM", ["Edit source", "Validate schema", "Cache snapshot", "Render EN / KO"], "Search, filters, author links, media and browser regression tests"),
    "rag-chatbot-evaluation.svg": ("Grounded response loop", "RAG CHATBOT", ["Retrieve Top-5", "Build context", "Generate answer", "Store history"], "Cosine retrieval and conversation memory keep answers traceable"),
    "dewarpnext-recovery.svg": ("Failure recovery", "DOCUMENT RECTIFICATION", ["Detect boundary", "Check corners", "Manual adjust", "Warp perspective"], "An interactive fallback handles incomplete automatic contours"),
    "hyperspectral-quality.svg": ("Scientific OCR QA", "LEGACY PAPER DIGITIZATION", ["Reading order", "Technical terms", "Tables & figures", "Source trace"], "Every structured record retains a path back to the scan"),
    "medical-document-schema.svg": ("Schema-first extraction", "MEDICAL DOCUMENT AI", ["OCR + layout", "VLM fields", "PII redaction", "Validated JSON"], "Spatial evidence, semantic extraction and privacy checks in one flow"),
    "document-validation-report.svg": ("Validation report", "LIGHTWEIGHT DOCUMENT QA", ["File integrity", "Format rules", "Text checks", "Human review"], "Pass · warning · error results include location and evidence"),
    "neurips-correlated-cover.svg": ("Correlated Failures", "NEURIPS 2026 · ACCEPTED", ["Encoder pool", "Frozen features", "Decoder seeds", "Co-failure audit"], "Auditing whether model diversity is real at the failure level"),
    "neurips-correlated-evidence.svg": ("Finite-pool audit", "MEDICAL SEGMENTATION", ["Functional floor", "Same bundle", "Cross bundle", "Spatial evidence"], "Task rows, uncertainty intervals and robustness diagnostics"),
    "neurips-capsule-cover.svg": ("Capsule Vision Audit", "NEURIPS 2026 · ACCEPTED", ["Multi-hash scan", "Pixel confirmation", "Split audit", "Sensitivity test"], "Detecting re-exposure and source-channel dependence in benchmarks"),
    "neurips-capsule-evidence.svg": ("Benchmark integrity", "DATASET AUDITING", ["pHash + dHash", "PDQ control", "NCC verification", "Negative controls"], "Operational thresholds separate near-duplicates from controls"),
    "hapo-cover.svg": ("Hierarchy-Aware Preference", "AACL-IJCNLP 2026 · ACCEPTED", ["Korean prompts", "Risk hierarchy", "Preference pairs", "Safe SLM"], "Safety alignment that preserves linguistic and task utility"),
    "hapo-pipeline.svg": ("KoSCoPe pipeline", "KOREAN SAFETY ALIGNMENT", ["Multi-teacher data", "Harm curriculum", "Preference optimize", "Safety evaluate"], "Structured supervision connects severity, competence and response quality"),
    "fbi-cover.svg": ("FBI", "NAACL 2027 · UNDER REVIEW", ["Key benchmark", "Permute options", "Probe model", "Verify signal"], "Benchmark integrity through keyed option-order fingerprints"),
    "fbi-protocol.svg": ("Contamination protocol", "LLM BENCHMARK AUDITING", ["Private key", "Canary variants", "Statistical test", "Audit report"], "A lightweight verification layer for suspicious benchmark exposure"),
}


def render(title, kicker, steps, footer):
    cards = []
    for index, step in enumerate(steps):
        x = 68 + index * 240
        cards.append(
            f'<g><rect x="{x}" y="270" width="200" height="118" rx="20" fill="#ffffff" fill-opacity=".08" stroke="#ffffff" stroke-opacity=".2"/>'
            f'<circle cx="{x + 30}" cy="302" r="15" fill="#54d6c5"/><text x="{x + 30}" y="308" text-anchor="middle" class="number">{index + 1}</text>'
            f'<text x="{x + 24}" y="350" class="step">{escape(step)}</text></g>'
        )
        if index < len(steps) - 1:
            cards.append(f'<path d="M{x + 205} 329 H{x + 229}" stroke="#54d6c5" stroke-width="4" stroke-linecap="round"/>')
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="620" viewBox="0 0 1100 620" role="img" aria-label="{escape(title)} diagram">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#071c35"/><stop offset=".55" stop-color="#123c5d"/><stop offset="1" stop-color="#176b72"/></linearGradient><radialGradient id="glow"><stop stop-color="#54d6c5" stop-opacity=".28"/><stop offset="1" stop-color="#54d6c5" stop-opacity="0"/></radialGradient></defs>
  <style>.kicker{{font:700 18px Arial,sans-serif;letter-spacing:3px;fill:#79eadb}}.title{{font:700 48px Arial,sans-serif;fill:#fff}}.step{{font:600 19px Arial,sans-serif;fill:#fff}}.number{{font:700 14px Arial,sans-serif;fill:#06253a}}.footer{{font:400 19px Arial,sans-serif;fill:#cce9ef}}</style>
  <rect width="1100" height="620" rx="32" fill="url(#bg)"/><circle cx="960" cy="95" r="250" fill="url(#glow)"/>
  <text x="68" y="92" class="kicker">{escape(kicker)}</text><text x="68" y="170" class="title">{escape(title)}</text>
  {''.join(cards)}
  <rect x="68" y="454" width="924" height="88" rx="20" fill="#031421" fill-opacity=".48"/><text x="96" y="507" class="footer">{escape(footer)}</text>
</svg>'''


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for filename, values in VISUALS.items():
        (OUTPUT / filename).write_text(render(*values), encoding="utf-8")


if __name__ == "__main__":
    main()
