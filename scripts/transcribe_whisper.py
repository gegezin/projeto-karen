#!/usr/bin/env python3
"""
Transcrição de áudio usando faster-whisper (offline, gratuito).
Uso: python transcribe_whisper.py <caminho_do_audio>
Saída: JSON no stdout, no mesmo formato dos outros scripts do projeto.
"""

import sys
import json
import os


def respond(success, text=None, error=None, message=None):
    payload = {"success": success}
    if text is not None:
        payload["text"] = text
    if error is not None:
        payload["error"] = error
    if message is not None:
        payload["message"] = message
    print(json.dumps(payload, ensure_ascii=False))
    sys.exit(0)


try:
    from faster_whisper import WhisperModel
except ImportError:
    respond(False, error='missing_dependency', message='Pacote faster-whisper não encontrado. Instale com: pip install faster-whisper')

if len(sys.argv) < 2:
    respond(False, error='missing_argument', message='Caminho do arquivo de áudio não informado')

audio_path = sys.argv[1]
if not os.path.exists(audio_path):
    respond(False, error='file_not_found', message=f'Arquivo não encontrado: {audio_path}')

MODEL_SIZE = os.environ.get('WHISPER_MODEL_SIZE', 'small')

try:
    model = WhisperModel(MODEL_SIZE, device='cpu', compute_type='int8')
    segments, info = model.transcribe(audio_path, language='pt', beam_size=5)
    transcript = ' '.join(segment.text.strip() for segment in segments).strip()

    if not transcript:
        respond(False, error='empty_transcription', message='Não foi possível identificar fala no áudio')

    respond(True, text=transcript, message='Transcrição concluída')
except Exception as exc:
    respond(False, error='transcription_error', message=f'Erro no transcritor: {exc}')
