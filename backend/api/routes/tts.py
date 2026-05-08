from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import httpx
import os

from core.auth import get_current_user

router = APIRouter(prefix="/tts", tags=["tts"])

ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")

TONE_VOICE_MAP = {
    "Friendly Mentor":      "XfNU2rGpBa01ckF309OY",
    "Professional Tutor":   "L3NacDtfFuYL0m0wJjjq",
    "Simplified Explainer": "UQoLnPXvf18gaKpLzfb8",
    "Encouraging Coach":    "g14YnDYCsy3k7XLlcKlO",
    "default":              "spa9IALJDrGWqKYWII2J",
}

class TTSRequest(BaseModel):
    text: str
    tone: str = "Professional Tutor"

@router.post("/speak")
async def speak(body: TTSRequest):
    if not ELEVENLABS_API_KEY:
        raise HTTPException(status_code=500, detail="ELEVENLABS_API_KEY not set")

    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text is empty")

    if len(text) > 5000:
        text = text[:5000]

    voice_id = TONE_VOICE_MAP.get(body.tone, TONE_VOICE_MAP["default"])
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream"

    print(f"[TTS] voice_id={voice_id}, text_len={len(text)}, key_set={bool(ELEVENLABS_API_KEY)}")

    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
    }
    payload = {
        "text": text,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=60, verify=False) as client:
            resp = await client.post(url, headers=headers, json=payload)
        print(f"[TTS] status={resp.status_code}, body={resp.text[:300]}")
    except Exception as e:
        print(f"[TTS] Exception: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail="ElevenLabs error: " + resp.text)

    return StreamingResponse(
        iter([resp.content]),
        media_type="audio/mpeg",
        headers={"Content-Disposition": "inline; filename=speech.mp3"},
    )
