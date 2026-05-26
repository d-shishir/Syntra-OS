import hashlib
import random
import math
import logging
from openai import OpenAI
from ..config import settings

logger = logging.getLogger(__name__)

def generate_openai_embedding(text: str) -> list[float]:
    """
    Calls the live OpenAI Embeddings API to generate a vector for the text.
    """
    model = settings.OPENAI_EMBEDDING_MODEL
    if "openrouter" in settings.OPENAI_API_BASE.lower() and "/" not in model:
        model = f"openai/{model}"

    client = OpenAI(
        api_key=settings.OPENAI_API_KEY,
        base_url=settings.OPENAI_API_BASE
    )
    response = client.embeddings.create(
        input=[text.replace("\n", " ")],
        model=model
    )
    return response.data[0].embedding

def generate_mock_embedding(text: str) -> list[float]:
    """
    Generates a deterministic 768-dimensional mock vector using pure Python.
    It splits the text into lowercase words, seeds random number generators,
    and normalizes the vector.
    """
    dimensions = 768
    vector = [0.0] * dimensions
    
    # Clean text and split to tokens
    words = [w.strip().lower() for w in text.split() if len(w.strip()) > 2]
    
    if not words:
        # Fallback seeded vector for empty inputs
        h = hashlib.md5(text.encode('utf-8')).hexdigest()
        seed = int(h, 16) % 1000
        rng = random.Random(seed)
        vec = [rng.gauss(0.0, 1.0) for _ in range(dimensions)]
        # Normalize
        sq_sum = sum(x*x for x in vec)
        magnitude = math.sqrt(sq_sum)
        return [x / magnitude for x in vec]
        
    for word in words:
        # Hash each word to find specific dimensions it contributes to
        h = hashlib.md5(word.encode('utf-8')).hexdigest()
        seed = int(h, 16) % 100000
        rng = random.Random(seed)
        
        # Add normal noise contribution for this token
        for i in range(dimensions):
            vector[i] += rng.gauss(0.0, 1.0)
            
    # Normalize the vector to unit length
    sq_sum = sum(x*x for x in vector)
    norm = math.sqrt(sq_sum)
    
    if norm > 0:
        return [x / norm for x in vector]
    else:
        val = 1.0 / math.sqrt(dimensions)
        return [val] * dimensions

def get_embedding_with_method(text: str) -> tuple[list[float], str]:
    """
    Entrypoint: calls OpenAI if key is present, otherwise falls back to mock generator.
    Returns a tuple of (embedding_vector, method) where method is 'live' or 'mock'.
    """
    if settings.OPENAI_API_KEY:
        try:
            return generate_openai_embedding(text), "live"
        except Exception as e:
            logger.error(f"Failed to generate OpenAI embedding. Falling back to Mock: {str(e)}")
            return generate_mock_embedding(text), "mock"
    else:
        return generate_mock_embedding(text), "mock"

def get_embedding(text: str) -> list[float]:
    """
    Entrypoint: calls OpenAI if key is present, otherwise falls back to mock generator.
    """
    vector, _ = get_embedding_with_method(text)
    return vector

