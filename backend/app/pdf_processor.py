import io
import pdfplumber
import logging

logger = logging.getLogger(__name__)

def extract_text_from_pdf(file_bytes: bytes) -> str:
    """
    Extracts plain text from PDF byte content using pdfplumber.
    Includes fallback cleanings and structures pages gracefully.
    """
    extracted_text = []
    
    try:
        # Wrap bytes in a file-like stream
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            for page_num, page in enumerate(pdf.pages, 1):
                page_text = page.extract_text(layout=False) # Keep clean stream
                if page_text:
                    extracted_text.append(page_text.strip())
                else:
                    # Log or placeholder for scanned/blank pages
                    logger.warning(f"No extractable text found on page {page_num}")
                    extracted_text.append(f"[Page {page_num} is blank or scanned]")
                    
        # Join pages with separator
        full_text = "\n\n--- Page Break ---\n\n".join(extracted_text)
        
        if not full_text.strip() or full_text == "[Page 1 is blank or scanned]":
            raise ValueError("No readable text could be extracted from this PDF. It might be scanned or corrupted.")
            
        return full_text
        
    except Exception as e:
        logger.error(f"Failed to process PDF: {str(e)}")
        raise e
