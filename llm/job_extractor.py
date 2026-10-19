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

    def extract(self, text: str) -> dict:
        # Use Groq LLM if key is configured
        if self.llm.is_configured:
            try:
                prompt = f"Extract structured information from this job description:\n\n{text}"
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
        return self._heuristic_extract(text)

    def _heuristic_extract(self, text: str) -> dict:
        t_lower = text.lower()

        # Seniority extraction
        seniority = "junior"
        if any(w in t_lower for w in ["intern", "internship"]):
            seniority = "intern"
        elif any(w in t_lower for w in ["fresher", "new grad", "graduate", "entry level", "entry-level"]):
            seniority = "fresher"
        elif any(w in t_lower for w in ["associate"]):
            seniority = "associate"
        elif any(w in t_lower for w in ["senior", "lead", "staff", "principal", "manager"]):
            seniority = "senior"

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

        # Role Category detection (order matters: specific phrases before generic ones)
        role_cat = "Data Science"
        if any(w in t_lower for w in ["operations research", "linear programming", "or scientist", "optimization scientist", "pulp"]):
            role_cat = "OR / Optimization"
        elif any(w in t_lower for w in ["decision scientist", "decision analysis", "analytics scientist"]):
            role_cat = "Decision Science"
        elif any(w in t_lower for w in ["applied scientist", "applied ml", "ml research", "research scientist"]):
            role_cat = "Applied ML / Research"
        elif any(w in t_lower for w in ["forecasting", "time series", "demand forecasting", "arima", "prophet"]):
            role_cat = "Forecasting"
        elif any(w in t_lower for w in ["machine learning engineer", "ml engineer", "mlops"]):
            role_cat = "ML Engineering"
        elif any(w in t_lower for w in ["associate product manager", "apm", "product analyst", "product manager"]):
            role_cat = "Product"
        elif any(w in t_lower for w in ["strategy analyst", "business operations", "bizops", "program analyst"]):
            role_cat = "Strategy / Programs"
        elif any(w in t_lower for w in ["analytics engineer", "dbt", "data engineer"]):
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
