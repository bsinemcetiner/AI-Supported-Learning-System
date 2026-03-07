import base64
from PyPDF2 import PdfReader

def get_pdf_text(pdf_docs):
    """Extracts text content from uploaded PDF files."""
    text = ""
    for pdf in pdf_docs:
        pdf_reader = PdfReader(pdf)
        for page in pdf_reader.pages:
            text += page.extract_text()
    return text

def process_image(image_file):
    """Converts an uploaded image to a base64 string for the AI model."""
    if image_file is not None:
        return base64.b64encode(image_file.getvalue()).decode('utf-8')
    return None