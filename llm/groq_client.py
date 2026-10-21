import os
import json
import urllib.request
import urllib.error
from dotenv import load_dotenv

load_dotenv()

class GroqClient:
    def __init__(self, model: str = None):
        api_key = os.getenv("GROQ_API_KEY", "").strip()
        self.api_key = api_key
        # openai/gpt-oss-20b is fast (1-2s) and reliable on this key
        self.model = model or os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")
        self.is_configured = bool(api_key and not api_key.startswith("your_"))

    def chat(self, system_prompt: str, user_prompt: str) -> str:
        if not self.is_configured:
            raise RuntimeError("GROQ_API_KEY is not configured with a valid key in .env")

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "User-Agent": "TargetMatchAI/1.0 (Mozilla/5.0 Windows NT 10.0)"
        }
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": 0.1
        }

        req = urllib.request.Request(
            "https://api.groq.com/openai/v1/chat/completions",
            headers=headers,
            data=json.dumps(payload).encode("utf-8")
        )

        try:
            with urllib.request.urlopen(req, timeout=25) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                return data["choices"][0]["message"]["content"]
        except urllib.error.HTTPError as e:
            # Fallback to 20b if 120b rate-limits or is busy
            if self.model != "openai/gpt-oss-20b":
                payload["model"] = "openai/gpt-oss-20b"
                req = urllib.request.Request(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers=headers,
                    data=json.dumps(payload).encode("utf-8")
                )
                with urllib.request.urlopen(req, timeout=25) as resp2:
                    data2 = json.loads(resp2.read().decode("utf-8"))
                    return data2["choices"][0]["message"]["content"]
            raise e
