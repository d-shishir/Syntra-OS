import os
import sys
from dotenv import load_dotenv

# Load env file from backend/.env
load_dotenv("/Users/shishirlamichhane/Documents/Projects/AI DOCUMENT INGESTION SYSTEM/backend/.env")

from openai import OpenAI

# Add backend directory to sys.path
sys.path.append("/Users/shishirlamichhane/Documents/Projects/AI DOCUMENT INGESTION SYSTEM/backend")

from app.config import settings

print("OPENAI_API_KEY:", settings.OPENAI_API_KEY)
print("OPENAI_API_BASE:", settings.OPENAI_API_BASE)
print("OPENAI_MODEL:", settings.OPENAI_MODEL)

try:
    client = OpenAI(
        api_key=settings.OPENAI_API_KEY,
        base_url=settings.OPENAI_API_BASE
    )
    print("Sending test request to OpenRouter...")
    response = client.chat.completions.create(
        model=settings.OPENAI_MODEL,
        messages=[
            {"role": "user", "content": "hello"}
        ],
        temperature=0.0
    )
    print("Success! Response:")
    print(response.choices[0].message.content)
except Exception as e:
    print("Error calling OpenRouter:")
    print(e)
