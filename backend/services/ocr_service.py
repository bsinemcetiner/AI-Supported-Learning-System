import os
import tempfile
from pathlib import Path
from functools import lru_cache


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


@lru_cache(maxsize=1)
def get_easyocr_reader():
    """
    EasyOCR reader modelini sadece bir kere yükler.
    Böylece her image upload edildiğinde model baştan yüklenmez.
    """
    import easyocr

    return easyocr.Reader(["en"], gpu=False)


class OCRService:
    def extract_text(self, file_bytes: bytes, filename: str) -> str:
        suffix = Path(filename).suffix.lower()

        if suffix == ".pdf":
            return self._extract_text_from_pdf(file_bytes)

        if suffix in IMAGE_EXTENSIONS:
            return self._extract_text_from_image(file_bytes)

        return file_bytes.decode("utf-8", errors="ignore")

    def _extract_text_from_pdf(self, file_bytes: bytes) -> str:
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

                extracted_text = "\n\n".join(pages).strip()

                if not extracted_text:
                    return "No readable text was detected in the PDF."

                return extracted_text

            finally:
                os.unlink(tmp_path)

        except ImportError:
            return file_bytes.decode("utf-8", errors="ignore")

    def _extract_text_from_image(self, file_bytes: bytes) -> str:
        """
        Image dosyasından text çıkarmak için:
        1. Dosyayı OpenCV image formatına çevirir.
        2. Görseli OCR için temizler.
        3. EasyOCR ile yazıyı okur.
        """

        import cv2
        import numpy as np

        image_array = np.frombuffer(file_bytes, dtype=np.uint8)
        image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)

        if image is None:
            return "Invalid image file."

        processed_image = self._preprocess_image_for_ocr(image)

        reader = get_easyocr_reader()

        results = reader.readtext(
            processed_image,
            detail=0,
            paragraph=True
        )

        extracted_text = "\n".join(results).strip()

        if not extracted_text:
            return "No readable text was detected in the image."

        return extracted_text

    def _preprocess_image_for_ocr(self, image):
        """
        OpenCV ile görseli OCR için daha okunabilir hale getirir.
        """

        import cv2

        # 1. Renkli görseli gri tona çeviriyoruz.
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

        # 2. Görsel çok küçükse büyütüyoruz.
        # Küçük yazıları OCR daha zor okur.
        height, width = gray.shape

        if width < 1000:
            scale_ratio = 1000 / width
            new_width = int(width * scale_ratio)
            new_height = int(height * scale_ratio)

            gray = cv2.resize(
                gray,
                (new_width, new_height),
                interpolation=cv2.INTER_CUBIC
            )

        # 3. Hafif gürültü temizleme.
        denoised = cv2.fastNlMeansDenoising(
            gray,
            None,
            10,
            7,
            21
        )

        # 4. Yazı ile arka planı ayırma.
        _, thresholded = cv2.threshold(
            denoised,
            0,
            255,
            cv2.THRESH_BINARY + cv2.THRESH_OTSU
        )

        return thresholded


ocr_service = OCRService()