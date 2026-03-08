"""
tts_engine.py
─────────────
ElevenLabs Text-to-Speech entegrasyonu.

Kurulum:
    pip install elevenlabs

Kullanım:
    .env dosyasına ekle:
    ELEVENLABS_API_KEY=your_api_key_here
"""

import os
import re
from typing import Optional
from elevenlabs.client import ElevenLabs
from elevenlabs import VoiceSettings

# ── Stil bazlı ses ID'leri ─────────────────────────────────────────────────────
# ElevenLabs'ta beğendiğin seslerin ID'lerini buraya ekleyebilirsin
# Varsayılan sesler (ücretsiz planda çalışır):
STYLE_VOICE_MAP = {
    "Professional Tutor":   "21m00Tcm4TlvDq8ikWAM",  # Rachel — net, profesyonel
    "Funny YouTuber":       "AZnzlk1XvdvUeBnXmlld",  # Domi  — enerjik
    "Deep Scientist":       "ErXwobaYiN019PkySvjV",  # Antoni — derin, sakin
    "Simplified (for kids)":"pNInz6obpgDQGcFmaJgB",  # Adam  — yavaş, net
    "Exam Coach":           "21m00Tcm4TlvDq8ikWAM",  # Rachel
    "Storyteller":          "onwK4e9ZLuTAKqWW03F9",  # Daniel — anlatıcı
    "Socratic":             "ErXwobaYiN019PkySvjV",  # Antoni
}

DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"  # Rachel


def _get_client() -> ElevenLabs:
    api_key = os.getenv("ELEVENLABS_API_KEY", "")
    if not api_key:
        raise ValueError(
            "ELEVENLABS_API_KEY bulunamadı. "
            ".env dosyasına ELEVENLABS_API_KEY=... ekleyin."
        )
    return ElevenLabs(api_key=api_key)


def _clean_text_for_tts(text: str) -> str:
    """
    AI cevabındaki markdown, LaTeX ve kaynak etiketlerini
    TTS için temizler — sesli okumada anlamsız semboller çıkmasın.
    """
    # Kaynak bloğunu at (--- 📌 Kaynak: ...)
    text = re.sub(r'\n---\n.*?📌.*$', '', text, flags=re.DOTALL)

    # LaTeX math ifadelerini at
    text = re.sub(r'\$\$.*?\$\$', '', text, flags=re.DOTALL)
    text = re.sub(r'\$.*?\$', '', text)

    # Markdown bold/italic
    text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)
    text = re.sub(r'\*(.+?)\*', r'\1', text)

    # Markdown başlıklar
    text = re.sub(r'^#{1,6}\s+', '', text, flags=re.MULTILINE)

    # Kod blokları
    text = re.sub(r'```.*?```', '', text, flags=re.DOTALL)
    text = re.sub(r'`(.+?)`', r'\1', text)

    # Bağlantılar
    text = re.sub(r'\[(.+?)\]\(.+?\)', r'\1', text)

    # Fazla boşluk ve satır sonları
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = text.strip()

    return text


def generate_audio(
    text: str,
    teaching_style: str = "Professional Tutor",
    max_chars: int = 2500,
) -> Optional[bytes]:
    """
    Metni ElevenLabs ile sese çevirir.

    Args:
        text:            AI'ın ürettiği metin
        teaching_style:  Ses seçimi için öğretim stili
        max_chars:       Maksimum karakter (ücretsiz planda kota yönetimi)

    Returns:
        MP3 formatında ses verisi (bytes), hata durumunda None
    """
    try:
        client = _get_client()

        # Metni temizle
        clean = _clean_text_for_tts(text)

        # Çok uzunsa kırp
        if len(clean) > max_chars:
            clean = clean[:max_chars] + "..."

        if not clean.strip():
            return None

        voice_id = STYLE_VOICE_MAP.get(teaching_style, DEFAULT_VOICE_ID)

        audio = client.text_to_speech.convert(
            voice_id=voice_id,
            text=clean,
            model_id="eleven_multilingual_v2",   # Türkçe + İngilizce destekler
            voice_settings=VoiceSettings(
                stability=0.5,
                similarity_boost=0.75,
                style=0.0,
                use_speaker_boost=True,
            ),
            output_format="mp3_44100_128",
        )

        # Generator'ı bytes'a çevir
        audio_bytes = b"".join(audio)
        return audio_bytes

    except ValueError as e:
        print(f"TTS config hatası: {e}")
        return None
    except Exception as e:
        print(f"TTS hatası: {e}")
        return None