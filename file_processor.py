"""
file_processor.py
─────────────────
PDF'ten metin çıkarma ve görsel işleme modülü.

Bağımlılıklar:
    pip install pypdf pillow
"""

import base64
import io
from PIL import Image
from pypdf import PdfReader


# ══════════════════════════════════════════════════════════════════════════════
# PDF → Metin
# ══════════════════════════════════════════════════════════════════════════════

def get_pdf_text(pdf_files: list) -> str:
    """
    Bir veya birden fazla PDF dosyasından tüm metni çıkarır.

    Args:
        pdf_files: Streamlit UploadedFile nesnelerinin listesi

    Returns:
        Birleştirilmiş ve temizlenmiş metin
    """
    full_text = ""

    for pdf_file in pdf_files:
        try:
            reader = PdfReader(pdf_file)
            for page_num, page in enumerate(reader.pages):
                page_text = page.extract_text()
                if page_text:
                    # Sayfa başlığı ekle — RAG'da kaynak takibi için faydalı
                    full_text += f"\n\n[Sayfa {page_num + 1}]\n{page_text}"
        except Exception as e:
            print(f"⚠️  '{getattr(pdf_file, 'name', 'PDF')}' okunamadı: {e}")
            continue

    return _clean_text(full_text)


def _clean_text(text: str) -> str:
    """
    PDF'ten çıkan gürültülü metni temizler.
    - Fazla boşluk/satır sonu
    - Bozuk encoding kalıntıları
    - Anlamsız tek karakterler
    """
    import re

    # 3'ten fazla art arda boş satırı 2'ye indir
    text = re.sub(r'\n{3,}', '\n\n', text)

    # Satır başı/sonu boşlukları temizle
    lines = [line.strip() for line in text.splitlines()]

    # Tek karakter satırları at (PDF'ten gelen çizgi/kutu kalıntıları)
    lines = [l for l in lines if len(l) != 1]

    # Tekrar birleştir
    text = "\n".join(lines)

    # Birden fazla boşluğu teke indir
    text = re.sub(r'[ \t]{2,}', ' ', text)

    return text.strip()


# ══════════════════════════════════════════════════════════════════════════════
# Görsel → Base64 bytes (Ollama vision için)
# ══════════════════════════════════════════════════════════════════════════════

def process_image(image_file) -> bytes:
    """
    Yüklenen görseli Ollama vision modeline gönderilebilir
    base64 formatına dönüştürür.

    Args:
        image_file: Streamlit UploadedFile nesnesi (jpg/png/jpeg)

    Returns:
        Base64 encoded bytes — ollama.chat() 'images' parametresine direkt verilir
    """
    try:
        image = Image.open(image_file)

        # RGBA veya diğer modları RGB'ye çevir (JPEG uyumluluğu)
        if image.mode not in ("RGB", "L"):
            image = image.convert("RGB")

        # Çok büyük görselleri küçült (vision model için yeterli, bellek dostu)
        max_size = (1280, 1280)
        image.thumbnail(max_size, Image.LANCZOS)

        # Bytes buffer'a kaydet
        buffer = io.BytesIO()
        image.save(buffer, format="JPEG", quality=85)
        buffer.seek(0)

        # Base64 encode
        encoded = base64.b64encode(buffer.read())
        return encoded

    except Exception as e:
        print(f"⚠️  Görsel işlenemedi: {e}")
        return b""


# ══════════════════════════════════════════════════════════════════════════════
# Yardımcı: Dosya bilgisi
# ══════════════════════════════════════════════════════════════════════════════

def get_pdf_page_count(pdf_file) -> int:
    """PDF'in sayfa sayısını döndürür. UI'da göstermek için kullanılabilir."""
    try:
        reader = PdfReader(pdf_file)
        return len(reader.pages)
    except Exception:
        return 0


def get_file_size_str(file) -> str:
    """Dosya boyutunu okunabilir formatta döndürür: '2.4 MB'"""
    try:
        size_bytes = file.size  # Streamlit UploadedFile özelliği
        if size_bytes < 1024:
            return f"{size_bytes} B"
        elif size_bytes < 1024 ** 2:
            return f"{size_bytes / 1024:.1f} KB"
        else:
            return f"{size_bytes / (1024 ** 2):.1f} MB"
    except Exception:
        return "? KB"