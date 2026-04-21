import tempfile
import os
from pathlib import Path


class OCRService:
    def __init__(self):
        self._manager = None

    @property
    def manager(self):
        # Lazy load — ilk kullanımda yükle, her seferinde değil
        if self._manager is None:
            from chandra.model import InferenceManager
            self._manager = InferenceManager(method="hf")
        return self._manager

    def extract_text(self, file_bytes: bytes, filename: str) -> str:
        suffix = Path(filename).suffix.lower()

        if suffix != ".pdf":
            # PDF değilse direkt decode et (txt, md vs.)
            return file_bytes.decode("utf-8", errors="ignore")

        # PDF'i geçici dosyaya yaz, Chandra okusun
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(file_bytes)
            tmp_path = tmp.name

        try:
            from chandra.input import load_pdf_images
            images = load_pdf_images(tmp_path)
            results = self.manager.generate(images)
            return "\n\n".join([r.markdown for r in results])
        finally:
            os.unlink(tmp_path)


ocr_service = OCRService()