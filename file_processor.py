import base64
import fitz
from PIL import Image
import io


def get_pdf_text(pdf_docs):
    text = ""
    for pdf in pdf_docs:
        pdf_bytes = pdf.getvalue()
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        for page in doc:
            page_text = page.get_text("text") or ""
            text += page_text + "\n"
    return text.strip()


def process_image(image_file):
    if image_file is not None:
        image = Image.open(image_file)

        if image.mode != "RGB":
            image = image.convert("RGB")

        max_size = (1024, 1024)
        image.thumbnail(max_size)

        buffer = io.BytesIO()
        image.save(buffer, format="JPEG", quality=85)

        return base64.b64encode(buffer.getvalue()).decode("utf-8")

    return None