import json

def sort_all_data():
    files = ["data.json", "docs/data.json"]
    for fpath in files:
        with open(fpath, "r", encoding="utf-8") as f:
            d = json.load(f)
        
        # Sort jobs: primary key hours_ago (asc - latest first), secondary key score (desc)
        d["jobs"].sort(key=lambda x: (x.get("hours_ago", 999), -x.get("score", 0)))
        
        with open(fpath, "w", encoding="utf-8") as f:
            json.dump(d, f, indent=2, ensure_ascii=False)
        print(f"Sorted jobs in {fpath}: latest ({d['jobs'][0]['hours_ago']}h ago, {d['jobs'][0]['company']}) to farthest ({d['jobs'][-1]['hours_ago']}h ago, {d['jobs'][-1]['company']})")

    # Update JS files
    js_files = ["data.js", "docs/data.js"]
    for jpath in js_files:
        with open("data.json", "r", encoding="utf-8") as f:
            d = json.load(f)
        js_content = f"window.JOB_MATCHER_DATA = {json.dumps(d, indent=2, ensure_ascii=False)};\n"
        with open(jpath, "w", encoding="utf-8") as f:
            f.write(js_content)
        print(f"Synchronized {jpath}")

if __name__ == "__main__":
    sort_all_data()
