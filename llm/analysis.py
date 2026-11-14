"""Cache successful extractions; always calculate profile scores separately."""
import hashlib
import json
import os
import sqlite3
from contextlib import closing
from pathlib import Path

from llm.job_extractor import JobExtractor, SYSTEM_PROMPT


class JobAnalyzer:
    def __init__(self, cache_path=None, extractor=None, max_calls=None):
        self.extractor = extractor or JobExtractor()
        self.cache_path = Path(cache_path or Path(__file__).resolve().parents[1] / "scratch" / "llm_analysis.sqlite3")
        self.max_calls = max_calls if max_calls is not None else int(os.getenv("LLM_MAX_CALLS_PER_SYNC", "40"))
        self.calls = 0
        self.failed = False

    def analyze(self, title, description):
        key = hashlib.sha256(json.dumps(
            [SYSTEM_PROMPT, self.extractor.llm.model, title, description], ensure_ascii=False
        ).encode()).hexdigest()
        try:
            self.cache_path.parent.mkdir(parents=True, exist_ok=True)
            with closing(sqlite3.connect(self.cache_path, timeout=10)) as db:
                db.execute("CREATE TABLE IF NOT EXISTS analyses (key TEXT PRIMARY KEY, payload TEXT NOT NULL)")
                db.commit()
                row = db.execute("SELECT payload FROM analyses WHERE key = ?", (key,)).fetchone()
            if row:
                result = json.loads(row[0])
                validated = self.extractor._validate(result)
                validated.update(analysis_method="llm", analysis_model=result["analysis_model"], analysis_cached=True)
                return validated
        except (OSError, sqlite3.Error, ValueError, KeyError):
            pass  # A cache failure must not stop collection.

        if self.extractor.llm.is_configured and not self.failed and self.calls < self.max_calls:
            self.calls += 1
            result = self.extractor.extract(description, title=title)
            if result["analysis_method"] == "llm":
                try:
                    with closing(sqlite3.connect(self.cache_path, timeout=10)) as db:
                        db.execute("INSERT OR REPLACE INTO analyses VALUES (?, ?)", (key, json.dumps(result)))
                        db.commit()
                except sqlite3.Error:
                    pass
            else:
                self.failed = True  # Avoid repeated timeouts/rate limits this run.
        else:
            result = self.extractor._heuristic_extract(description, title=title)
            result["analysis_method"] = "fallback"
        result["analysis_cached"] = False
        return result
