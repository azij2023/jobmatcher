import json
import re
from llm.groq_client import GroqClient

SYSTEM_PROMPT = """You are an expert AI talent recruiter and job parser.
Analyze the job description and extract key attributes into valid JSON.
Never include explanatory text outside of the JSON block.

Output JSON format:
{
    "role_type": "standardized role title",
    "role_category": "one of: Applied ML / Research, Data Science, Decision Science, OR / Optimization, ML Engineering, Forecasting, Product, Strategy / Programs, Data Engineering Adjacent, Other",
    "seniority": "one of: intern, fresher, junior, associate, mid, senior, lead, manager",
    "min_years_experience": integer or null (e.g. 0 for freshers/interns, 1 for 1+ years),
    "max_years_experience": integer or null,
    "required_skills": ["list", "of", "skills"],
    "nice_to_have": ["list", "of", "optional", "skills"],
    "domain": "primary domain/industry"
}
"""

KNOWN_SKILLS = [
    "python", "sql", "r", "c", "matlab", "pandas", "numpy", "scikit_learn",
    "matplotlib", "seaborn", "tensorflow", "pytorch", "mysql", "power_bi",
    "excel", "git", "docker", "fastapi", "aws", "gcp", "machine_learning",
    "deep_learning", "nlp", "llms", "agentic_ai", "operations_research",
    "linear_programming", "integer_programming", "optimization", "pulp",
    "time_series", "forecasting", "arima", "prophet", "xgboost",
    "ab_testing", "experimentation", "causal_inference", "decision_analysis",
    "product_analytics", "analytics_engineering", "dbt", "data_modeling", "etl"
]

class JobExtractor:
    def __init__(self, model: str = None):
        self.llm = GroqClient(model=model)

    def extract(self, text: str, title: str = "") -> dict:
        # Use Groq LLM if key is configured
        if self.llm.is_configured:
            try:
                prompt = f"Extract structured information from this job title: '{title}' and description:\n\n{text}"
                raw_output = self.llm.chat(SYSTEM_PROMPT, prompt)
                cleaned = raw_output.strip()
                if "```" in cleaned:
                    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", cleaned)
                    if match:
                        cleaned = match.group(1).strip()
                return json.loads(cleaned)
            except Exception as e:
                print(f"[!] Groq LLM extraction warning: {e}. Falling back to rule-based parser.")

        # Heuristic fallback parser
        return self._heuristic_extract(text, title=title)

    def _heuristic_extract(self, text: str, title: str = "") -> dict:
        t_lower = text.lower()
        title_lower = title.lower()

        # Seniority extraction - prioritize title indicators
        seniority = "junior"
        if any(w in title_lower for w in ["intern", "internship", "apprentice", "trainee"]):
            seniority = "intern"
        elif any(w in title_lower for w in ["fresher", "new grad", "graduate", "entry level", "entry-level", "early career"]):
            seniority = "fresher"
        elif any(w in title_lower for w in ["associate", "analyst", "coordinator", "specialist"]):
            seniority = "associate"
        elif any(w in title_lower for w in ["senior", "sr.", "sr ", "staff", "principal", "director", "head", "vp"]):
            seniority = "senior"
        elif any(w in t_lower for w in ["intern", "internship", "apprentice", "trainee"]):
            seniority = "intern"
        elif any(w in t_lower for w in ["associate", "analyst"]):
            seniority = "associate"

        # Years of experience extraction
        min_exp = 0
        exp_match = re.search(r"(\d+)\+?\s*(?:-\s*\d+)?\s*years?", t_lower)
        if exp_match:
            min_exp = int(exp_match.group(1))

        # Skill keyword scanning
        found_skills = []
        for s in KNOWN_SKILLS:
            pattern = rf"\b{re.escape(s.replace('_', ' '))}\b|\b{re.escape(s)}\b"
            if re.search(pattern, t_lower):
                found_skills.append(s)

        # Role Category detection using both title and body
        combined = f"{title_lower} {t_lower}"
        role_cat = "Data Science"
        if any(w in title_lower for w in ["applied scientist", "applied science", "ai agent", "applied ai", "ai research", "applied ml research", "applied ml intern", "research intern", "research scientist", "computer vision researcher", "researcher"]) or any(w in t_lower for w in ["applied scientist", "applied ml", "ml research", "research scientist"]):
            role_cat = "Applied Scientist / ML Research"
        elif any(w in title_lower for w in ["fresher data scientist", "fraud operations", "fraud analysis", "credit risk", "risk data science", "risk analytics", "data scientist", "data science"]):
            role_cat = "Data Science"
        elif any(w in title_lower for w in ["decision science analyst", "quantitative decision analyst", "benefits analyst", "decision scientist", "quantitative analyst"]) or any(w in t_lower for w in ["decision scientist", "decision analysis", "analytics scientist", "quantitative analyst"]):
            role_cat = "Decision Science"
        elif any(w in title_lower for w in ["network optimization", "operations research", "procurement", "optimization"]) or any(w in t_lower for w in ["operations research", "linear programming", "or scientist", "optimization scientist", "pulp"]):
            role_cat = "OR / Optimization"
        elif any(w in title_lower for w in ["ml engineer - fresher", "machine learning engineer - fresher", "ux & systems", "systems engineer", "ml engineer", "machine learning engineer"]) or any(w in t_lower for w in ["machine learning engineer", "ml engineer", "mlops"]):
            role_cat = "ML Engineering"
        elif any(w in title_lower for w in ["demand forecasting", "creative & communications", "talent analytics", "account specialist", "ads analytics", "forecasting", "demand planning"]) or any(w in t_lower for w in ["forecasting", "time series", "demand forecasting", "arima", "prophet"]):
            role_cat = "Forecasting"
        elif any(w in title_lower for w in ["apm intern", "video editor", "media intern", "product telemetry", "product research", "associate product manager", "apm", "product analyst"]) or any(w in t_lower for w in ["product analyst", "product manager", "user telemetry"]):
            role_cat = "Product"
        elif any(w in title_lower for w in ["strategy & operations", "recruiter", "verifications", "apprenticeship", "revenue operations", "operations associate", "employer brand", "coordinator", "customer success", "accounts payable", "strategy"]) or any(w in t_lower for w in ["strategy analyst", "business operations", "bizops", "program analyst", "revenue operations"]):
            role_cat = "Strategy / Programs"
        elif any(w in title_lower for w in ["etl trainee", "data engineer trainee", "data platform", "content & analytics", "data engineering", "software engineer intern"]) or any(w in t_lower for w in ["analytics engineer", "dbt", "data engineer", "data platform"]):
            role_cat = "Data Engineering Adjacent"

        return {
            "role_type": "standardized",
            "role_category": role_cat,
            "seniority": seniority,
            "min_years_experience": min_exp,
            "max_years_experience": min_exp + 2,
            "required_skills": found_skills[:8],
            "nice_to_have": found_skills[8:],
            "domain": "technology"
        }
