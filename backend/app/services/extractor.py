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
  "vendor_name": "Name of the issuing company/merchant",
  "invoice_number": "Invoice reference number",
  "currency": "Three-letter currency code (e.g. USD, EUR, NPR)",
  "subtotal": "Subtotal amount before tax (string representation, e.g. '100.00')",
  "tax_amount": "Tax amount (string representation, e.g. '15.00')",
  "total_amount": "Total final payment amount including tax (string representation, e.g. '115.00')",
  "due_date": "Invoice due date (YYYY-MM-DD format)",
  "payment_terms": "Terms of payment (e.g., Net 30, Due on Receipt)"
}
"""

PAYROLL_PROMPT = """
You are a structured data extractor. You must analyze the text from a document and return only valid JSON matching this schema:
{
  "document_type": "payroll",
  "employee_name": "Name of the employee",
  "salary": "Basic salary amount (string representation, e.g. '5000.00')",
  "deductions": [
    {
      "name": "Name of deduction (e.g. Tax, Health Insurance)",
      "amount": "Deduction amount (string representation, e.g. '250.00')"
    }
  ],
  "net_pay": "Net payment amount after all deductions (string representation, e.g. '4750.00')",
  "payment_date": "Date of payment (YYYY-MM-DD format)"
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
You must classify the document as either an 'invoice' (or receipt/bill), 'payroll' record, or a 'general' document, and output JSON matching the corresponding schema.

RULES:
- Output ONLY valid JSON.
- Do NOT wrap your response in markdown code blocks (no ```json).
- Do NOT provide explanations, descriptions, introductory text, or trailing notes.
- If a value cannot be found in the text, set it to null or an empty string/list.
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
    client = OpenAI(
        api_key=settings.OPENAI_API_KEY,
        base_url=settings.OPENAI_API_BASE
    )
    
    # Heuristic classification for prompt tailoring
    text_lower = text.lower()
    is_payroll = any(term in text_lower for term in ["payroll", "salary", "payslip", "pay stub", "net pay", "deductions", "employee name", "earnings statement"])
    is_invoice = any(term in text_lower for term in ["invoice", "receipt", "bill", "amount due", "total due", "subtotal", "payment terms"])
    
    if is_payroll:
        schema_prompt = PAYROLL_PROMPT
    elif is_invoice:
        schema_prompt = INVOICE_PROMPT
    else:
        schema_prompt = GENERAL_PROMPT
    
    # Retry loop (up to 2 times)
    for attempt in range(1, 3):
        try:
            logger.info(f"LLM Extraction attempt {attempt} for model {settings.OPENAI_MODEL}")
            try:
                # Attempt with structured outputs (JSON Mode)
                response = client.chat.completions.create(
                    model=settings.OPENAI_MODEL,
                    messages=[
                        {"role": "system", "content": SYSTEM_INSTRUCTION + "\n\n" + schema_prompt},
                        {"role": "user", "content": f"Document text to extract:\n\n{text}"}
                    ],
                    temperature=0.0,
                    response_format={"type": "json_object"}
                )
            except Exception as json_mode_err:
                # Fallback: some free models (e.g. on OpenRouter) do not support response_format parameter
                logger.warning(f"JSON Mode not supported by endpoint, retrying without response_format: {str(json_mode_err)}")
                response = client.chat.completions.create(
                    model=settings.OPENAI_MODEL,
                    messages=[
                        {"role": "system", "content": SYSTEM_INSTRUCTION + "\n\n" + schema_prompt},
                        {"role": "user", "content": f"Document text to extract:\n\n{text}"}
                    ],
                    temperature=0.0
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
    
    text_lower = text.lower()
    is_payroll = any(term in text_lower for term in ["payroll", "salary", "payslip", "pay stub", "net pay", "deductions", "employee name", "earnings statement"])
    is_invoice = any(term in text_lower for term in ["invoice", "receipt", "bill", "amount", "total", "subtotal"])
    
    def extract_first_decimal(line_str: str) -> str:
        # Matches numbers like 10000.00, 1,500.00, 992211, etc.
        m = re.search(r"\b\d+(?:,\d{3})*(?:\.\d{2})?\b", line_str)
        if m:
            return m.group(0).replace(",", "")
        return ""
        
    if is_payroll:
        # Extract employee name
        employee_name = "John Miller"
        for line in text.split("\n"):
            if "employee" in line.lower() or "name" in line.lower():
                if ":" in line:
                    employee_name = line.split(":")[-1].strip()
                    break
        
        salary = "4500.00"
        net_pay = "3950.00"
        
        for line in text.split("\n"):
            line_l = line.lower()
            if "salary" in line_l or "basic" in line_l:
                val = extract_first_decimal(line)
                if val: salary = val
            elif "net" in line_l:
                val = extract_first_decimal(line)
                if val: net_pay = val
                
        deductions = [
            {"name": "Tax", "amount": "400.00"},
            {"name": "Health Insurance", "amount": "150.00"}
        ]
        
        # Parse deductions if they exist in the text
        parsed_deductions = []
        for line in text.split("\n"):
            line_l = line.lower()
            if "tax" in line_l and "deduct" in line_l or "tax" in line_l and any(term in line_l for term in ["federal", "state", "income"]):
                val = extract_first_decimal(line)
                if val: parsed_deductions.append({"name": "Tax", "amount": val})
            elif "health" in line_l or "insurance" in line_l:
                val = extract_first_decimal(line)
                if val: parsed_deductions.append({"name": "Insurance", "amount": val})
        if parsed_deductions:
            deductions = parsed_deductions
            
        # Date
        date_match = re.search(r"\b(\d{4}[-/]\d{2}[-/]\d{2})\b", text)
        payment_date = date_match.group(0) if date_match else "2026-05-26"
        
        return {
            "document_type": "payroll",
            "employee_name": employee_name,
            "salary": salary,
            "deductions": deductions,
            "net_pay": net_pay,
            "payment_date": payment_date
        }
        
    elif is_invoice:
        # Extract vendor (simple parser)
        vendor = "Unknown Vendor"
        for line in text.split("\n"):
            if "bill to" in line.lower() or "invoice to" in line.lower():
                continue
            if any(v_term in line.lower() for v_term in ["ltd", "corp", "inc", "co.", "solutions", "enterprise", "inc.", "corporation", "limited"]):
                vendor = line.strip()
                break
        
        # Extract amounts
        subtotal = "0.00"
        tax_amount = "0.00"
        total_amount = "0.00"
        currency = "USD"
        
        for line in text.split("\n"):
            line_l = line.lower()
            if "subtotal" in line_l:
                val = extract_first_decimal(line)
                if val: subtotal = val
            elif "tax" in line_l:
                val = extract_first_decimal(line)
                if val: tax_amount = val
            elif "total" in line_l or "amount" in line_l:
                # Avoid matching invoice number, date or phone numbers
                if not any(term in line_l for term in ["number", "no", "date", "phone", "fax"]):
                    val = extract_first_decimal(line)
                    if val: total_amount = val
                    
        if "$" in text or "usd" in text_lower:
            currency = "USD"
        elif "eur" in text_lower or "€" in text:
            currency = "EUR"
        
        # Date parser
        date_match = re.search(r"\b(\d{4}[-/]\d{2}[-/]\d{2})\b|\b(\w{3,9}\s\d{1,2},\s\d{4})\b", text)
        due_date = date_match.group(0) if date_match else "2026-06-25"
        
        # Invoice number parser
        inv_match = re.search(r"(?:invoice|inv|bill)\s*(?:no|num|#)?[:.\s]*([a-zA-Z0-9-]+)", text_lower)
        invoice_number = inv_match.group(1).upper() if inv_match else "INV-2026-001"
        
        payment_terms = "Net 30"
        if "due on receipt" in text_lower:
            payment_terms = "Due on Receipt"
            
        return {
            "document_type": "invoice",
            "vendor_name": vendor,
            "invoice_number": invoice_number,
            "currency": currency,
            "subtotal": subtotal,
            "tax_amount": tax_amount,
            "total_amount": total_amount,
            "due_date": due_date,
            "payment_terms": payment_terms
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
            res = extract_structured_data_live(text)
            res["extraction_method"] = "live"
            return res
        except Exception as e:
            logger.error(f"Live OpenAI extraction failed. Falling back to mock generator. Error: {str(e)}")
            res = extract_structured_data_mock(text)
            res["extraction_method"] = "mock"
            return res
    else:
        res = extract_structured_data_mock(text)
        res["extraction_method"] = "mock"
        return res
