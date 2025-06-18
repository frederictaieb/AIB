from fastapi import UploadFile
from deepface import DeepFace
from PIL import Image
import numpy as np
import io
import uuid
import os
from fastapi.responses import FileResponse, StreamingResponse
from gtts import gTTS
import pyttsx3
from pydub import AudioSegment
from app.utils.logger import logger_init
import logging

logger = logging.getLogger(__name__)
logger_init()


def fer_score(file: UploadFile) -> dict:
    try:
        import numpy as np
        from PIL import Image
        import io
        from deepface import DeepFace

        image_bytes = file.file.read()
        pil_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        np_image = np.array(pil_image)

        result = DeepFace.analyze(np_image, actions=['emotion'], enforce_detection=True)
        emotions_raw = result[0]['emotion'] if isinstance(result, list) else result['emotion']

        # Convertir tous les scores en float natif (pas numpy.float32)
        emotions = {emotion: float(score) for emotion, score in emotions_raw.items()}

        weights = {
            "happy": 1.0,
            "neutral": 0.5,
            "surprise": 0.3,
            "sad": -1.0,
            "angry": -0.8,
            "fear": -0.6,
            "disgust": -0.7
        }

        raw_score = sum(emotions.get(emotion, 0) * weights.get(emotion, 0) for emotion in emotions)
        score = float(np.clip(((raw_score + 100) / 200) * 100, 0, 100))  # Assure que c'est bien un float natif

        return {
            "emotions": emotions,
            "score": score
        }

    except Exception as e:
        return {"error": str(e)}

def tts_google(text: str, lang: str = "fr"):
    filename = f"tts_{uuid.uuid4().hex}.mp3"
    tts = gTTS(text=text, lang=lang)
    tts.save(filename)

    def iterfile():
        with open(filename, mode="rb") as file_like:
            yield from file_like
        os.remove(filename)  # Supprime après lecture

    logger.info(f"TTS Google: {text} - {lang}")
    return StreamingResponse(iterfile(), media_type="audio/mpeg")

def tts_x3(text: str, lang: str = "fr"):
    wav_filename = f"tts_{uuid.uuid4().hex}.wav"
    mp3_filename = wav_filename.replace(".wav", ".mp3")

    engine = pyttsx3.init()
    voices = engine.getProperty('voices')
    if lang == "fr":
        fr_voice = next((v for v in voices if "fr" in v.languages or "French" in v.name), None)
        if fr_voice:
            engine.setProperty('voice', fr_voice.id)
    
    engine.save_to_file(text, wav_filename)
    engine.runAndWait()

    # Convert WAV to MP3
    sound = AudioSegment.from_wav(wav_filename)
    sound.export(mp3_filename, format="mp3")
    os.remove(wav_filename)

    def iterfile():
        with open(mp3_filename, mode="rb") as file_like:
            yield from file_like
        os.remove(mp3_filename)

    logger.info(f"TTS X3: {text} - {lang}")
    return StreamingResponse(iterfile(), media_type="audio/mpeg")