import tempfile
import os
from pathlib import Path


class OCRService:
    def extract_text(self, file_bytes: bytes, filename: str) -> str:
        suffix = Path(filename).suffix.lower()

        if suffix != ".pdf":
            return file_bytes.decode("utf-8", errors="ignore")

        try:
            import fitz  # pymupdf
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                tmp.write(file_bytes)
                tmp_path = tmp.name

            try:
                doc = fitz.open(tmp_path)
                pages = []
                for page in doc:
                    text = page.get_text("text")
                    if text.strip():
                        pages.append(text)
                doc.close()
                return "\n\n".join(pages)
            finally:
                os.unlink(tmp_path)

        except ImportError:
            # pymupdf yoksa basit fallback
            return file_bytes.decode("utf-8", errors="ignore")


ocr_service = OCRService()