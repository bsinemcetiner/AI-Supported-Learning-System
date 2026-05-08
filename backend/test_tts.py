import httpx
import os
from dotenv import load_dotenv

load_dotenv('.env')
key = os.getenv('ELEVENLABS_API_KEY')
print(f"Key: {key[:10]}...")

resp = httpx.post(
    'https://api.elevenlabs.io/v1/text-to-speech/spa9IALJDrGWqKYWII2J/stream',
    headers={'xi-api-key': key, 'Content-Type': 'application/json'},
    json={
        'text': 'Hello',
        'model_id': 'eleven_multilingual_v2',
        'voice_settings': {'stability': 0.5, 'similarity_boost': 0.75}
    }
)
print(f"Status: {resp.status_code}")
print(f"Response: {resp.text[:300]}")
