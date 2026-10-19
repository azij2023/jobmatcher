import sqlite3

def init_db():
    conn = sqlite3.connect("jobs.db")
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS jobs (
            url TEXT PRIMARY KEY,
            title TEXT,
            company TEXT,
            score REAL,
            tier INTEGER,
            category TEXT,
            priority TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

def save_job(job: dict, scored_result):
    conn = sqlite3.connect("jobs.db")
    c = conn.cursor()

    if isinstance(scored_result, (int, float)):
        score = float(scored_result)
        tier, category, priority = None, None, None
    elif isinstance(scored_result, dict):
        score = scored_result.get("final_score", 0.0)
        tier = scored_result.get("tier")
        category = scored_result.get("category")
        priority = scored_result.get("priority")
    else:
        score, tier, category, priority = 0.0, None, None, None

    c.execute(
        """
        INSERT OR REPLACE INTO jobs (url, title, company, score, tier, category, priority)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (job.get("url"), job.get("title"), job.get("company"), score, tier, category, priority)
    )
    conn.commit()
    conn.close()
