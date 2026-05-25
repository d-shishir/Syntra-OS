import json
import re
import logging
from openai import OpenAI
from ..config import settings

logger = logging.getLogger(__name__)

# Target schema definition prompts
INVOICE_PROMPT = """
You are a structured data extractor. You must analyze the text from a document and return only valid JSON matching this schema:
{
  "document_type": "invoice",
  "vendor": "Name of the issuing company/merchant",
  "amount": "Total final payment amount (string representation, e.g. '123.45')",
  "currency": "Three-letter currency code (e.g. USD, EUR, NPR)",
  "date": "Invoice issue date (YYYY-MM-DD format if possible, otherwise raw string)",
  "invoice_number": "Invoice reference number"
}
"""

GENERAL_PROMPT = """
You are a structured data extractor. You must analyze the text from a document and return only valid JSON matching this schema:
{
  "document_type": "general",
  "title": "A descriptive title of the document",
  "summary": "A concise paragraph summarizing the document contents",
  "key_points": [
    "Core point or takeaway 1",
    "Core point or takeaway 2",
    "Core point or takeaway 3"
  ]
}
"""

SYSTEM_INSTRUCTION = """
You are a strict JSON extraction microservice. 
Analyze the input document text and extract the data structure.
You must classify the document as either an 'invoice' (or receipt/bill) or a 'general' document, and output JSON matching the corresponding schema.

RULES:
- Output ONLY valid JSON.
- Do NOT wrap your response in markdown code blocks (no ```json).
- Do NOT provide explanations, descriptions, introductory text, or trailing notes.
- If a value cannot be found in the text, set it to null or an empty string.
"""

def attempt_json_repair(raw_text: str) -> dict:
    """
    Applies regex heuristics to repair common LLM JSON faults
    like trailing commas or markdown wraps.
    """
    clean = raw_text.strip()
    
    # Remove markdown code blocks if the LLM ignored rules
    if clean.startswith("```"):
        clean = re.sub(r"^```(?:json)?\n", "", clean)
        clean = re.sub(r"\n```$", "", clean)
        clean = clean.strip()
        
    try:
        return json.loads(clean)
    except json.JSONDecodeError:
        pass
        
    # Attempt to fix trailing commas before closing braces/brackets
    try:
        repaired = re.sub(r",\s*([\]}])", r"\1", clean)
        return json.loads(repaired)
    except json.JSONDecodeError as e:
        logger.error(f"Heuristics JSON repair failed: {str(e)}")
        raise ValueError(f"Returned content was not valid JSON and could not be repaired: {raw_text[:100]}...")

def extract_structured_data_live(text: str) -> dict:
    """
    Calls the OpenAI API with strict instructions and JSON mode validation.
    """
    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    
    # Heuristic classification for prompt tailoring
    is_invoice = any(term in text.lower() for term in ["invoice", "receipt", "bill", "amount due", "total due", "subtotal", "payment terms"])
    schema_prompt = INVOICE_PROMPT if is_invoice else GENERAL_PROMPT
    
    # Retry loop (up to 2 times)
    for attempt in range(1, 3):
        try:
            logger.info(f"LLM Extraction attempt {attempt} for model {settings.OPENAI_MODEL}")
            response = client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_INSTRUCTION + "\n\n" + schema_prompt},
                    {"role": "user", "content": f"Document text to extract:\n\n{text}"}
                ],
                temperature=0.0,
                response_format={"type": "json_object"}
            )
            
            raw_response = response.choices[0].message.content
            if not raw_response:
                raise ValueError("LLM returned an empty response.")
                
            return attempt_json_repair(raw_response)
            
        except Exception as err:
            logger.warning(f"Attempt {attempt} failed: {str(err)}")
            if attempt == 2:
                # Raise error to trigger fallback mechanism
                raise err

def extract_structured_data_mock(text: str) -> dict:
    """
    Generates realistic extracted JSON based on document text keywords.
    Ensures fully offline usability when API key is not configured.
    """
    logger.info("Executing structured extraction in MOCK mode.")
    
    # Heuristically parse for invoice features
    text_lower = text.lower()
    is_invoice = any(term in text_lower for term in ["invoice", "receipt", "bill", "amount", "total"])
    
    if is_invoice:
        # Extract vendor (simple parser)
        vendor = "Unknown Vendor"
        for line in text.split("\n"):
            if "bill to" in line.lower() or "invoice to" in line.lower():
                continue
            if any(v_term in line.lower() for v_term in ["ltd", "corp", "inc", "co.", "solutions", "enterprise"]):
                vendor = line.strip()
                break
        
        # Extract amounts
        amount = "0.00"
        currency = "USD"
        amount_matches = re.findall(r"(?:USD|NPR|EUR|\$|Rs\.?)\s*([\d,]+\.\d{2})", text)
        if amount_matches:
            amount = amount_matches[-1] # Pick the last matching amount (usually total)
        elif "$" in text:
            currency = "USD"
        
        # Date parser
        date_match = re.search(r"\b(\d{4}[-/]\d{2}[-/]\d{2})\b|\b(\w{3,9}\s\d{1,2},\s\d{4})\b", text)
        date_val = date_match.group(0) if date_match else "2026-05-25"
        
        # Invoice number parser
        inv_match = re.search(r"(?:invoice|inv|bill)\s*(?:no|num|#)?[:.\s]*([a-zA-Z0-9-]+)", text_lower)
        invoice_number = inv_match.group(1).upper() if inv_match else "INV-2026-001"
        
        return {
            "document_type": "invoice",
            "vendor": vendor,
            "amount": amount,
            "currency": currency,
            "date": date_val,
            "invoice_number": invoice_number
        }
    else:
        # Generate summary stats for general docs
        lines = [line.strip() for line in text.split("\n") if line.strip() and "---" not in line]
        title = lines[0] if lines else "Ingested PDF Document"
        
        # Fallback summary
        summary = text[:200].replace("\n", " ") + "..." if len(text) > 200 else text
        
        # Pick key sentences as bullet points
        sentences = [s.strip() for s in text.split(".") if len(s.strip()) > 20][:3]
        key_points = sentences if sentences else ["Document extracted cleanly.", "No RAG embeddings initialized yet."]
        
        return {
            "document_type": "general",
            "title": title,
            "summary": summary,
            "key_points": key_points
        }

def extract_structured_data(text: str) -> dict:
    """
    Entrypoint. Uses live OpenAI API if configured, otherwise mock engine.
    """
    if settings.OPENAI_API_KEY:
        try:
            return extract_structured_data_live(text)
        except Exception as e:
            logger.error(f"Live OpenAI extraction failed. Falling back to mock generator. Error: {str(e)}")
            return extract_structured_data_mock(text)
    else:
        return extract_structured_data_mock(text)
