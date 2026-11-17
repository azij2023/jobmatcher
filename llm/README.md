The live collector extracts job requirements before applying the existing profile
scoring rules. Set `GROQ_API_KEY` in `.env` locally, or the GitHub Actions secret
of the same name. `GROQ_MODEL` defaults to `openai/gpt-oss-20b` on Groq.

`LLM_MAX_CALLS_PER_SYNC` defaults to 3 new requests per collection run.
`LLM_BACKFILL_CALLS_PER_SYNC` defaults to 3 requests for saved fallback listings,
ordered by full-time status and profile match tier. Cached results do not count.
These small batches avoid the Groq rate limit observed with larger runs. Missing
credentials, invalid responses, exhausted budgets, and API failures use the
heuristic parser. Invalid model output does not stop other AI attempts. After
an API failure, the remainder of that run uses cached results or the fallback;
the next run retries.

Validated LLM results are cached in `scratch/llm_analysis.sqlite3`, keyed by
title, full description, model, and extraction prompt. GitHub Actions restores
and saves that cache between runs. Scores are always recalculated against the
current profile. Job payloads include `analysis_method`, `analysis_model` (when
LLM analysed), `analysis_cached`, and extracted requirements. Existing published
saved fallback listings acquire AI analysis in later feed syncs.

Learning roadmaps remain templates. Actual missing requirements from scoring
are preserved separately. Only job titles and descriptions are sent to Groq;
profile scoring runs locally.
