The live collector extracts job requirements before applying the existing profile
scoring rules. Set `GROQ_API_KEY` in `.env` locally, or the GitHub Actions secret
of the same name. `GROQ_MODEL` defaults to `openai/gpt-oss-20b` on Groq.

`LLM_MAX_CALLS_PER_SYNC` defaults to 40 new requests per collection run. Cached
results do not count. Missing credentials, invalid responses, exhausted budgets,
and API failures use the heuristic parser. After an API failure, the remainder
of that run uses cached results or the fallback; the next run retries.

Validated LLM results are cached in `scratch/llm_analysis.sqlite3`, keyed by
title, full description, model, and extraction prompt. GitHub Actions restores
and saves that cache between runs. Scores are always recalculated against the
current profile. Job payloads include `analysis_method`, `analysis_model` (when
LLM analysed), `analysis_cached`, and extracted requirements. Existing published
listings acquire analysis metadata as they are collected again.

Learning roadmaps remain templates. Actual missing requirements from scoring
are preserved separately. Only job titles and descriptions are sent to Groq;
profile scoring runs locally.
