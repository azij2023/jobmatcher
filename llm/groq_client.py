import os
from dotenv import load_dotenv
try:
    from groq import Groq
except ImportError:
    Groq = None

load_dotenv()

class GroqClient:
    def __init__(self, model: str = None):
        api_key = os.getenv("GROQ_API_KEY")
        self.is_configured = bool(api_key and not api_key.startswith("your_") and Groq is not None)
        self.model = model or os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")

        if self.is_configured:
            self.client = Groq(api_key=api_key)
        else:
            self.client = None

    def chat(self, system_prompt: str, user_prompt: str) -> str:
        if not self.is_configured or not self.client:
            raise RuntimeError("GROQ_API_KEY is not configured with a valid key in .env")

        completion = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.1
        )

        return completion.choices[0].message.content
