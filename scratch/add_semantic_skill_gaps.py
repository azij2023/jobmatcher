import json

# Comprehensive Tier-specific Semantic Skill Gap Rules & Roadmaps
TIER_GAP_KNOWLEDGE = {
    1: {  # Applied ML / Research
        "pool": [
            {"skill": "PyTorch Distributed Training & PEFT", "impact": "High Impact", "category": "Deep Learning", "action": "Implement a modular LoRA / PEFT fine-tuning script in PyTorch on a Hugging Face dataset."},
            {"skill": "Vector Search & Embeddings (FAISS / Chroma)", "impact": "Medium Impact", "category": "RAG & Retrieval", "action": "Build a dense vector retrieval pipeline with cosine similarity & hybrid BM25 reranking."},
            {"skill": "LLM Evaluation Benchmarks & Guardrails", "impact": "High Impact", "category": "LLM Systems", "action": "Create an automated evaluation harness measuring BLEU/ROUGE, latency, and hallucination rates."}
        ],
        "default_missing": ["distributed_training", "vector_search", "eval_harness"],
        "roadmap": "Build an end-to-end multimodal or domain-specific LLM fine-tuning project on Hugging Face Spaces with a documented GitHub README and evaluation metrics.",
        "talk_track": "While I haven't trained billion-parameter foundation models across large GPU clusters, I have designed custom PyTorch training loops with mixed-precision, LoRA adapters, and rigorous validation."
    },
    2: {  # Data Science
        "pool": [
            {"skill": "Causal Inference & Uplift Modeling", "impact": "High Impact", "category": "Experimentation", "action": "Perform synthetic difference-in-differences or inverse probability weighting on a user churn dataset."},
            {"skill": "A/B Testing Power Analysis & Sample Sizing", "impact": "High Impact", "category": "Product Analytics", "action": "Simulate two-sample hypothesis testing in Python, calculating minimum detectable effect (MDE) and alpha/beta trade-offs."},
            {"skill": "Advanced Feature Engineering & Imbalance", "impact": "Medium Impact", "category": "Modeling", "action": "Implement SMOTE, Focal Loss, and Precision-Recall AUC curves for high-skew classification."}
        ],
        "default_missing": ["causal_inference", "power_analysis", "feature_stores"],
        "roadmap": "Construct an end-to-end user behavioral experiment simulation notebook in Python & SQL with synthetic A/B test results and statistical significance testing.",
        "talk_track": "I bridge the gap between predictive modeling and business impact by designing controlled hypothesis tests and estimating counterfactual treatment effects beyond standard correlation."
    },
    3: {  # Decision Science
        "pool": [
            {"skill": "Bayesian Modeling & Uncertainty Estimation", "impact": "High Impact", "category": "Statistical Science", "action": "Build a hierarchical Bayesian model in PyMC or Stan to estimate risk parameters with credible intervals."},
            {"skill": "Multi-Armed Bandits & Dynamic Pricing", "impact": "High Impact", "category": "Decision Optimization", "action": "Simulate Thompson Sampling vs Epsilon-Greedy allocation for conversion optimization in Python."},
            {"skill": "Quasi-Experimentation & Synthetic Controls", "impact": "Medium Impact", "category": "Analytics", "action": "Conduct an observational policy study using propensity score matching and regression discontinuity."}
        ],
        "default_missing": ["bayesian_modeling", "multi_armed_bandits", "synthetic_controls"],
        "roadmap": "Develop a decision-support dashboard evaluating trade-offs between false-positive risk and user retention with simulated ROI metrics.",
        "talk_track": "I focus on actionable decision analysis under uncertainty, using statistical hypothesis testing and trade-off matrices to translate raw numbers into executive recommendations."
    },
    4: {  # OR / Optimization
        "pool": [
            {"skill": "Vehicle Routing & Network Flow Formulations", "impact": "High Impact", "category": "Operations Research", "action": "Formulate a Capacitated Vehicle Routing Problem (CVRP) in PuLP or Google OR-Tools and visualize route costs."},
            {"skill": "Mixed Integer Linear Programming (MILP)", "impact": "High Impact", "category": "Mathematical Programming", "action": "Model a facility location and hub allocation problem with binary variables and capacity constraints."},
            {"skill": "Heuristic Algorithms & Metaheuristics", "impact": "Medium Impact", "category": "Algorithm Design", "action": "Implement simulated annealing or genetic algorithms for NP-hard scheduling bottlenecks."}
        ],
        "default_missing": ["milp_formulations", "cvrp_routing", "or_tools"],
        "roadmap": "Code a reproducible logistics network optimizer in Python with PuLP, benchmarking solver runtimes and constraint violations against baseline heuristics.",
        "talk_track": "My strength is translating complex real-world operational bottlenecks into mathematical linear and integer programs that solve efficiently within production bounds."
    },
    5: {  # Product / APM
        "pool": [
            {"skill": "Product Teardown & PRD Documentation", "impact": "High Impact", "category": "Product Thinking", "action": "Write a 3-page product requirements document (PRD) with user stories, acceptance criteria, and KPI definitions."},
            {"skill": "Telemetry Schema Design & Event Tracking", "impact": "High Impact", "category": "Product Analytics", "action": "Map out an event logging taxonomy (clickstream, funnel steps) and write SQL queries for conversion drop-offs."},
            {"skill": "User Journey Mapping & Prioritization", "impact": "Medium Impact", "category": "Execution", "action": "Score feature ideas using the RICE framework (Reach, Impact, Confidence, Effort) with explicit data justification."}
        ],
        "default_missing": ["prd_writing", "event_telemetry", "rice_prioritization"],
        "roadmap": "Publish a comprehensive 2-page teardown of a core consumer flow (e.g. Swiggy Instamart checkout or Groww onboarding) detailing telemetry tracking and metric trade-offs.",
        "talk_track": "I combine analytical rigor in SQL and metric decomposition with first-principles customer empathy to ruthlessly prioritize high-impact feature experiments."
    },
    6: {  # Strategy / Programs / BizOps
        "pool": [
            {"skill": "3-Statement Financial & Unit Economics Modeling", "impact": "High Impact", "category": "Financial Analysis", "action": "Build a dynamic Excel DCF / Unit Economics model tracking CAC, LTV, payback period, and contribution margin."},
            {"skill": "Market Sizing & TAM Estimation (Top-Down/Bottom-Up)", "impact": "Medium Impact", "category": "Market Intelligence", "action": "Calculate Total Addressable Market (TAM) for a new vertical with verifiable census and commerce benchmarks."},
            {"skill": "Executive Board Deck & Memo Synthesis", "impact": "High Impact", "category": "Executive Communication", "action": "Draft an executive 5-slide strategy proposal recommending a market expansion with risk mitigation scenarios."}
        ],
        "default_missing": ["unit_economics", "tam_market_sizing", "executive_memos"],
        "roadmap": "Create an end-to-end merchant growth unit economics model in Excel with automated sensitivity tables and a 5-slide strategy synthesis deck.",
        "talk_track": "I bridge data pipelines and executive decision-making by distilling complex transactional metrics into clear unit economics, sensitivity curves, and strategic board presentations."
    },
    7: {  # Forecasting
        "pool": [
            {"skill": "Hierarchical & Intermittent Time Series", "impact": "High Impact", "category": "Forecasting", "action": "Implement Croston's method or DeepAR on intermittent sparse retail demand in Python."},
            {"skill": "Prophet & SARIMAX Exogenous Regressors", "impact": "High Impact", "category": "Statistical Forecasting", "action": "Model demand seasonality with holiday calendars and price elasticity features in Prophet/Statsmodels."},
            {"skill": "Backtesting Cross-Validation & Metric Tuning", "impact": "Medium Impact", "category": "Model Validation", "action": "Set up expanding-window time series cross-validation and compute WAPE, MASE, and pinball loss."}
        ],
        "default_missing": ["hierarchical_forecasting", "sarimax_regressors", "backtesting_cv"],
        "roadmap": "Construct a rolling-origin time series evaluation notebook on retail SKU data comparing Prophet, LightGBM lag features, and ARIMA baselines.",
        "talk_track": "I prevent lookahead bias by enforcing strict temporal cross-validation and engineering calendar/lag regressors that capture demand spikes and supply bottlenecks."
    },
    8: {  # ML Engineering
        "pool": [
            {"skill": "FastAPI REST Serving & Latency Optimization", "impact": "High Impact", "category": "Model Serving", "action": "Wrap a scikit-learn or ONNX model in an async FastAPI service with request validation & batching."},
            {"skill": "Docker Containerization & Multi-Stage Builds", "impact": "High Impact", "category": "DevOps / Packaging", "action": "Write an optimized Dockerfile with minimal image size and non-root security principles."},
            {"skill": "Model Registry & Drift Monitoring (MLflow / Evidently)", "impact": "Medium Impact", "category": "MLOps", "action": "Track model artifacts in MLflow and log data drift metrics on incoming inference batches."}
        ],
        "default_missing": ["docker_containerization", "fastapi_serving", "mlflow_registry"],
        "roadmap": "Deploy a containerized model inference microservice on Render or AWS ECS with a health check endpoint, Swagger docs, and GitHub Actions CI/CD.",
        "talk_track": "I focus on the entire lifecycle of applied models, building production-ready FastAPI endpoints with Docker, automated schema validation, and health monitoring."
    },
    9: {  # Data Engineering Adjacent
        "pool": [
            {"skill": "dbt Transformations & Data Modeling", "impact": "High Impact", "category": "Analytics Engineering", "action": "Design a Kimball star-schema dimensional model with dbt staging, intermediate, and mart SQL models."},
            {"skill": "Workflow Orchestration (Airflow / Prefect)", "impact": "High Impact", "category": "Data Pipelines", "action": "Write an Airflow DAG that orchestrates data extraction, transformation, and automated schema tests."},
            {"skill": "Automated Data Quality & Schema Testing", "impact": "Medium Impact", "category": "Data Reliability", "action": "Implement dbt-expectations or Great Expectations tests verifying uniqueness, nullability, and referential integrity."}
        ],
        "default_missing": ["dbt_transformations", "dimensional_modeling", "airflow_dags"],
        "roadmap": "Build a modular dbt-core repository transforming raw event streams into dimensional star schema marts with automated data quality schema tests.",
        "talk_track": "I treat data as a software product, writing tested, version-controlled SQL models in dbt with dimensional star schemas that serve reliable reporting."
    }
}

def enrich_job_semantic_gaps(job):
    tier = job.get("tier", 2)
    knowledge = TIER_GAP_KNOWLEDGE.get(tier, TIER_GAP_KNOWLEDGE[2])
    
    matched = job.get("matched_skills", [])
    
    # Filter gaps so they don't duplicate matched skills
    gaps = []
    missing_skill_names = []
    
    for item in knowledge["pool"]:
        skill_clean = item["skill"].lower()
        if not any(m in skill_clean for m in matched):
            gaps.append(item)
            missing_skill_names.append(item["skill"].split("(")[0].strip())
            
    if not gaps:
        gaps = knowledge["pool"][:2]
        missing_skill_names = [k["skill"].split("(")[0].strip() for k in gaps]
        
    # Fit percentage
    core_fit_pct = max(70, min(95, int(job.get("score", 0.85) * 100)))
    gap_pct = 100 - core_fit_pct
    
    # Customized company advice
    comp = job.get("company", "the company")
    role = job.get("title", "this role")
    roadmap = f"For {comp}'s {role}: {knowledge['roadmap']}"
    
    job["missing_skills"] = missing_skill_names
    job["semantic_skill_gap"] = {
        "fit_percentage": f"{core_fit_pct}% Core Match",
        "gap_percentage": f"{gap_pct}% Skill Gap",
        "gaps": gaps,
        "bridge_roadmap": roadmap,
        "interview_talk_track": knowledge["talk_track"]
    }
    return job

def run_enrichment():
    files = ["data.json", "docs/data.json"]
    for fpath in files:
        with open(fpath, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        for j in data["jobs"]:
            enrich_job_semantic_gaps(j)
            
        with open(fpath, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"Enriched semantic skill gaps in {fpath}")

    # Synchronize JS files
    with open("data.json", "r", encoding="utf-8") as f:
        data = json.load(f)
    js_content = f"window.JOB_MATCHER_DATA = {json.dumps(data, indent=2, ensure_ascii=False)};\n"
    
    for jpath in ["data.js", "docs/data.js"]:
        with open(jpath, "w", encoding="utf-8") as f:
            f.write(js_content)
        print(f"Synchronized {jpath}")

if __name__ == "__main__":
    run_enrichment()
