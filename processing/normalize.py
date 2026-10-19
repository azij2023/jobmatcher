LOCATION_MAP = {
    "bengaluru": "bangalore",
    "gurugram": "gurgaon",
    "calcutta": "kolkata",
    "bombay": "mumbai",
    "madras": "chennai",
    "new delhi": "delhi",
    "remote - india": "remote_india",
    "remote india": "remote_india",
    "india (remote)": "remote_india"
}

SENIORITY_MAP = {
    "intern": "intern",
    "internship": "intern",
    "apprentice": "intern",
    "fresher": "fresher",
    "trainee": "trainee",
    "graduate": "graduate",
    "new grad": "new_grad",
    "early career": "early_career",
    "entry level": "entry_level",
    "entry-level": "entry_level",
    "entry": "entry_level",
    "junior": "junior",
    "jr": "junior",
    "jr.": "junior",
    "associate": "associate",
    "mid": "mid",
    "mid-level": "mid",
    "senior": "senior",
    "sr": "senior",
    "sr.": "senior",
    "staff": "staff",
    "principal": "principal",
    "lead": "lead",
    "manager": "manager"
}

SKILL_SYNONYMS = {
    # AI / ML
    "machine learning": "machine_learning",
    "ml": "machine_learning",
    "applied ml": "applied_machine_learning",
    "applied machine learning": "applied_machine_learning",
    "deep learning": "deep_learning",
    "dl": "deep_learning",
    "natural language processing": "nlp",
    "nlp": "nlp",
    "large language models": "llms",
    "llm": "llms",
    "llms": "llms",
    "ai agents": "agentic_ai",
    "agentic ai": "agentic_ai",
    "llm agents": "agentic_ai",
    "tool using llms": "tool_using_llms",
    "scikit-learn": "scikit_learn",
    "sklearn": "scikit_learn",
    "tf": "tensorflow",
    
    # Optimization / OR
    "operations research": "operations_research",
    "or": "operations_research",
    "linear programming": "linear_programming",
    "integer programming": "integer_programming",
    "mixed integer programming": "integer_programming",
    "milp": "integer_programming",
    "mathematical optimization": "optimization",
    "convex optimization": "optimization",
    "google or-tools": "or_tools",
    "or-tools": "or_tools",

    # Forecasting & Time Series
    "time series": "time_series",
    "time-series": "time_series",
    "time series analysis": "time_series",
    "demand forecasting": "forecasting",
    "time series forecasting": "forecasting",

    # Experimentation & Decision Science
    "a/b testing": "ab_testing",
    "ab testing": "ab_testing",
    "hypothesis testing": "ab_testing",
    "experimentation": "experimentation",
    "causal inference": "causal_inference",
    "decision analysis": "decision_analysis",
    "product analytics": "product_analytics",

    # Data & Analytics Engineering
    "analytics engineering": "analytics_engineering",
    "powerbi": "power_bi",
    "power bi": "power_bi",
    "etl pipeline": "etl",
    "etl pipelines": "etl"
}

def normalize_location(location: str) -> str:
    loc = location.lower().strip()
    return LOCATION_MAP.get(loc, loc)

def normalize_seniority(seniority: str) -> str:
    sen = seniority.lower().strip()
    return SENIORITY_MAP.get(sen, sen)

def normalize_skills(skills: list[str]) -> list[str]:
    out = []
    for s in skills:
        s = s.lower().strip()
        out.append(SKILL_SYNONYMS.get(s, s.replace(" ", "_").replace("-", "_")))
    return list(dict.fromkeys(out))
