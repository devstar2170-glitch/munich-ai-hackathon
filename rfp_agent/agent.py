from __future__ import annotations

import json
import os
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Optional

from google import genai
from google.genai import types

from .document_loader import load_document
from .models import RFPAnalysis, RFPPartA, RFPPartB, RFPPartC
from .prompts import (
    ANALYSIS_PROMPT,
    ANALYSIS_PROMPT_A,
    ANALYSIS_PROMPT_B,
    ANALYSIS_PROMPT_C,
    MERGE_PROMPT,
    SYSTEM_PROMPT,
)

# Gemini 2.0 Flash has a 1M token context; ~4 chars/token → ~700K chars safe limit per call
_MAX_CHARS_PER_CALL = 700_000


class RFPAnalysisAgent:
    """Analyzes RFP documents and extracts structured intelligence.

    Output is a validated RFPAnalysis object ready for downstream agents:
    - skills_required → Planning Agent (employee matching)
    - requirements → Response Agent (proposal drafting)
    - risks + pitfalls → Risk/Bid team
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "gemini-2.5-flash",
    ):
        key = api_key or os.getenv("GEMINI_API_KEY")
        if not key:
            raise ValueError(
                "Gemini API key is required. Set GEMINI_API_KEY env var or pass api_key=..."
            )

        self._client = genai.Client(api_key=key)
        self._model_name = model

        _base = dict(
            system_instruction=SYSTEM_PROMPT,
            response_mime_type="application/json",
            temperature=0.1,
            thinking_config=types.ThinkingConfig(thinking_budget=0),
        )
        # Full-schema config (used for chunked merge and vision fallback)
        self._gen_config = types.GenerateContentConfig(
            **_base,
            response_schema=RFPAnalysis,
            max_output_tokens=65536,
        )
        # Per-part configs for parallel analysis
        self._gen_config_a = types.GenerateContentConfig(
            **_base, response_schema=RFPPartA, max_output_tokens=32768
        )
        self._gen_config_b = types.GenerateContentConfig(
            **_base, response_schema=RFPPartB, max_output_tokens=16384
        )
        self._gen_config_c = types.GenerateContentConfig(
            **_base, response_schema=RFPPartC, max_output_tokens=16384
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def analyze_file(self, file_path: str) -> RFPAnalysis:
        """Analyze an RFP from a file path (PDF, DOCX, TXT, MD)."""
        path = Path(file_path)

        # Extract text locally first — much faster than Gemini's vision pipeline.
        # Fall back to native PDF (vision) only for scanned PDFs with no extractable text.
        text, _ = load_document(file_path)
        if text.strip():
            return self.analyze_text(text)

        if path.suffix.lower() == ".pdf":
            print(f"[info] No text extracted from {path.name}, falling back to Gemini vision pipeline")
            return self._analyze_pdf_native(path)

        raise ValueError(f"Could not extract any text from {file_path}")

    def analyze_text(self, rfp_text: str) -> RFPAnalysis:
        """Analyze raw RFP text. Handles documents of any length via chunking."""
        if len(rfp_text) <= _MAX_CHARS_PER_CALL:
            return self._call_model_parallel(rfp_text)
        return self._analyze_chunked(rfp_text)

    def to_planning_agent_payload(self, analysis: RFPAnalysis) -> dict:
        """Return a slimmed-down payload optimized for the Planning Agent.

        The Planning Agent receives this and matches skills against the
        internal employee skills database.
        """
        return {
            "rfp_title": analysis.rfp_title,
            "client_name": analysis.client_name,
            "submission_deadline": analysis.submission_deadline,
            "project_duration": analysis.project_duration,
            "skills_required": [s.model_dump() for s in analysis.skills_required],
            "estimated_team_size": analysis.estimated_team_size,
            "high_priority_requirements": [
                r.model_dump()
                for r in analysis.requirements
                if r.priority == "high" and r.is_mandatory
            ],
            "dependencies": [d.model_dump() for d in analysis.dependencies],
            "compliance_norms": [c.model_dump() for c in analysis.compliance_norms],
        }

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _call_model_parallel(self, rfp_content: str) -> RFPAnalysis:
        """Run 3 focused extraction calls in parallel, then combine into RFPAnalysis."""
        print("[info] Running parallel extraction (3 concurrent Gemini calls)...")

        def call_a() -> RFPPartA:
            r = self._client.models.generate_content(
                model=self._model_name,
                contents=ANALYSIS_PROMPT_A.format(rfp_content=rfp_content),
                config=self._gen_config_a,
            )
            return RFPPartA(**json.loads(r.text))

        def call_b() -> RFPPartB:
            r = self._client.models.generate_content(
                model=self._model_name,
                contents=ANALYSIS_PROMPT_B.format(rfp_content=rfp_content),
                config=self._gen_config_b,
            )
            return RFPPartB(**json.loads(r.text))

        def call_c() -> RFPPartC:
            r = self._client.models.generate_content(
                model=self._model_name,
                contents=ANALYSIS_PROMPT_C.format(rfp_content=rfp_content),
                config=self._gen_config_c,
            )
            return RFPPartC(**json.loads(r.text))

        with ThreadPoolExecutor(max_workers=3) as pool:
            fa = pool.submit(call_a)
            fb = pool.submit(call_b)
            fc = pool.submit(call_c)
            part_a = fa.result()
            part_b = fb.result()
            part_c = fc.result()

        print("[info] Parallel extraction complete. Combining parts...")
        return RFPAnalysis(
            rfp_title=part_a.rfp_title,
            client_name=part_a.client_name,
            rfp_summary=part_a.rfp_summary,
            project_scope=part_a.project_scope,
            submission_deadline=part_a.submission_deadline,
            project_duration=part_a.project_duration,
            estimated_team_size=part_a.estimated_team_size,
            budget_constraints=part_a.budget_constraints,
            requirements=part_a.requirements,
            key_evaluation_criteria=part_a.key_evaluation_criteria,
            skills_required=part_b.skills_required,
            deadlines=part_b.deadlines,
            dependencies=part_b.dependencies,
            risks=part_c.risks,
            compliance_norms=part_c.compliance_norms,
            pitfalls=part_c.pitfalls,
            analysis_notes=part_c.analysis_notes,
            confidence_score=part_c.confidence_score,
        )

    def _analyze_pdf_native(self, path: Path) -> RFPAnalysis:
        """Upload PDF to Gemini Files API for native multi-modal understanding."""
        print(f"[info] Uploading PDF to Gemini Files API: {path.name}")
        uploaded = self._client.files.upload(
            file=path,
            config=types.UploadFileConfig(mime_type="application/pdf", display_name=path.name),
        )

        prompt = ANALYSIS_PROMPT.replace(
            "\n\n---\n\nRFP DOCUMENT:\n\n{rfp_content}",
            "",
        ) + "\n\nThe RFP document is attached above."

        response = self._client.models.generate_content(
            model=self._model_name,
            contents=[uploaded, prompt],
            config=self._gen_config,
        )
        return self._parse_response(response.text)

    def _call_model(self, rfp_content: str) -> RFPAnalysis:
        prompt = ANALYSIS_PROMPT.format(rfp_content=rfp_content)
        response = self._client.models.generate_content(
            model=self._model_name,
            contents=prompt,
            config=self._gen_config,
        )
        return self._parse_response(response.text)

    def _analyze_chunked(self, rfp_text: str) -> RFPAnalysis:
        """Split large documents into overlapping chunks, analyze each, then merge."""
        chunks = self._split_chunks(rfp_text)
        print(f"[info] Document split into {len(chunks)} chunks for analysis")

        partial_results = []
        for i, chunk in enumerate(chunks):
            print(f"[info] Analyzing chunk {i + 1}/{len(chunks)}...")
            labeled = f"[DOCUMENT PART {i + 1} of {len(chunks)}]\n\n{chunk}"
            partial = self._call_model(labeled)
            partial_results.append(partial.model_dump())

        if len(partial_results) == 1:
            return RFPAnalysis(**partial_results[0])

        return self._merge_partial_analyses(partial_results)

    def _merge_partial_analyses(self, partials: list[dict]) -> RFPAnalysis:
        print("[info] Merging partial analyses...")
        prompt = MERGE_PROMPT.format(partial_analyses=json.dumps(partials, indent=2))
        response = self._client.models.generate_content(
            model=self._model_name,
            contents=prompt,
            config=self._gen_config,
        )
        return self._parse_response(response.text)

    def _parse_response(self, raw: str) -> RFPAnalysis:
        try:
            data = json.loads(raw)
            return RFPAnalysis(**data)
        except (json.JSONDecodeError, Exception) as e:
            # Try to extract JSON if wrapped in markdown code fence
            import re
            match = re.search(r"```(?:json)?\s*(\{.*\})\s*```", raw, re.DOTALL)
            if match:
                data = json.loads(match.group(1))
                return RFPAnalysis(**data)
            raise ValueError(f"Failed to parse model response: {e}\n\nRaw:\n{raw[:500]}")

    def _split_chunks(self, text: str, overlap_chars: int = 2000) -> list[str]:
        """Split on paragraph boundaries with overlap to avoid cutting context."""
        paragraphs = text.split("\n\n")
        chunks: list[str] = []
        current: list[str] = []
        current_len = 0

        for para in paragraphs:
            para_len = len(para)
            if current_len + para_len > _MAX_CHARS_PER_CALL and current:
                chunks.append("\n\n".join(current))
                # Keep last few paragraphs as overlap context for next chunk
                overlap = []
                overlap_len = 0
                for p in reversed(current):
                    if overlap_len + len(p) > overlap_chars:
                        break
                    overlap.insert(0, p)
                    overlap_len += len(p)
                current = overlap + [para]
                current_len = overlap_len + para_len
            else:
                current.append(para)
                current_len += para_len

        if current:
            chunks.append("\n\n".join(current))

        return chunks
