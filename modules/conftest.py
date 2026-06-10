import os
import pytest

# Force offline/mock mode for tests by clearing OpenAI/OpenRouter API configurations
os.environ["OPENAI_API_KEY"] = ""
os.environ["OPENAI_API_BASE"] = ""
