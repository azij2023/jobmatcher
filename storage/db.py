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
            posted_at TEXT,
            hours_ago INTEGER,
            source_domain TEXT,
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

    # Safe column additions if table already exists
    try:
        c.execute("ALTER TABLE jobs ADD COLUMN posted_at TEXT")
    except Exception:
        pass
    try:
        c.execute("ALTER TABLE jobs ADD COLUMN hours_ago INTEGER")
    except Exception:
        pass
    try:
        c.execute("ALTER TABLE jobs ADD COLUMN source_domain TEXT")
    except Exception:
        pass

    c.execute(
        """
        INSERT OR REPLACE INTO jobs (url, title, company, score, tier, category, priority, posted_at, hours_ago, source_domain)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            job.get("url"),
            job.get("title"),
            job.get("company"),
            score,
            tier,
            category,
            priority,
            job.get("posted_at"),
            job.get("hours_ago"),
            job.get("source_domain")
        )
    )
    conn.commit()
    conn.close()
