import json
import re

URL_MAP = {
    "Swiggy": "https://www.linkedin.com/search/results/content/?keywords=%22Swiggy%22%20%22APM%22%20%22hiring%22&datePosted=%22past-24h%22&sortBy=%22date_posted%22",
    "Razorpay": "https://www.linkedin.com/search/results/content/?keywords=%22Razorpay%22%20%22BizOps%22%20%22hiring%22&datePosted=%22past-24h%22&sortBy=%22date_posted%22",
    "PhonePe": "https://www.linkedin.com/search/results/content/?keywords=%22PhonePe%22%20%22Data%20Scientist%22%20%22hiring%22&datePosted=%22past-24h%22&sortBy=%22date_posted%22",
    "Delhivery": "https://www.linkedin.com/search/results/content/?keywords=%22Delhivery%22%20%22Operations%20Research%22%20%22hiring%22&datePosted=%22past-24h%22&sortBy=%22date_posted%22",
    "Zepto": "https://www.linkedin.com/search/results/content/?keywords=%22Zepto%22%20%22Forecasting%22%20%22hiring%22&datePosted=%22past-24h%22&sortBy=%22date_posted%22",
    "Sarvam AI": "https://www.linkedin.com/search/results/content/?keywords=%22Sarvam%20AI%22%20%22research%20intern%22&datePosted=%22past-24h%22&sortBy=%22date_posted%22",
    "Flipkart": "https://www.linkedin.com/search/results/content/?keywords=%22Flipkart%22%20%22Applied%20Scientist%22%20%22hiring%22&datePosted=%22past-24h%22&sortBy=%22date_posted%22",
    "Groww": "https://www.linkedin.com/search/results/content/?keywords=%22Groww%22%20%22APM%22%20%22hiring%22&datePosted=%22past-24h%22&sortBy=%22date_posted%22",
    "CRED": "https://www.linkedin.com/search/results/content/?keywords=%22CRED%22%20%22Decision%20Scientist%22%20%22hiring%22&datePosted=%22past-24h%22&sortBy=%22date_posted%22",
    "Meesho": "https://www.linkedin.com/search/results/content/?keywords=%22Meesho%22%20%22Data%20Scientist%22%20%22hiring%22&datePosted=%22past-24h%22&sortBy=%22date_posted%22",
    "InMobi": "https://www.linkedin.com/search/results/content/?keywords=%22InMobi%22%20%22Optimization%22%20%22hiring%22&datePosted=%22past-24h%22&sortBy=%22date_posted%22",
    "Postman": "https://www.linkedin.com/search/results/content/?keywords=%22Postman%22%20%22ML%20Engineer%22%20%22hiring%22&datePosted=%22past-24h%22&sortBy=%22date_posted%22",
}

def update_json_file(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    updated_count = 0
    for j in data.get("jobs", []):
        if j.get("is_post"):
            comp = j.get("company")
            if comp in URL_MAP:
                j["url"] = URL_MAP[comp]
                updated_count += 1
                
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        
    print(f"Updated {updated_count} jobs in {filepath}")

def update_js_file(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    
    # Extract JSON part
    prefix = "window.JOB_MATCHER_DATA = "
    suffix = ";\n"
    if content.startswith(prefix):
        json_str = content[len(prefix):]
        if json_str.endswith(";\n"):
            json_str = json_str[:-2]
        elif json_str.endswith(";"):
            json_str = json_str[:-1]
            
        data = json.loads(json_str)
        updated_count = 0
        for j in data.get("jobs", []):
            if j.get("is_post"):
                comp = j.get("company")
                if comp in URL_MAP:
                    j["url"] = URL_MAP[comp]
                    updated_count += 1
                    
        new_content = f"{prefix}{json.dumps(data, indent=2, ensure_ascii=False)};\n"
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(new_content)
        print(f"Updated {updated_count} jobs in {filepath}")
    else:
        print(f"Prefix mismatch for {filepath}")

if __name__ == "__main__":
    update_json_file("data.json")
    update_json_file("docs/data.json")
    update_js_file("data.js")
    update_js_file("docs/data.js")
    print("Done updating json & js files.")
