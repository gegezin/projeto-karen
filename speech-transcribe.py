#!/usr/bin/env python3
import sys
import os
import json
import wave
import audioop


def respond(success, text=None, error=None, message=None):
    payload = {"success": success}
    if text is not None:
        payload["text"] = text
    if error is not None:
        payload["error"] = error
    if message is not None:
        payload["message"] = message
    print(json.dumps(payload))
    sys.exit(0)


try:
    from vosk import Model, KaldiRecognizer
except ImportError:
    respond(False, error='missing_dependency', message='Pacote vosk não encontrado. Instale com pip install vosk')

if len(sys.argv) < 2:
    respond(False, error='missing_argument', message='Caminho do arquivo de áudio não informado')

audio_path = sys.argv[1]
if not os.path.exists(audio_path):
    respond(False, error='file_not_found', message=f'Arquivo não encontrado: {audio_path}')

model_path = os.environ.get('VOSK_MODEL_PATH') or os.path.join(os.path.dirname(__file__), 'models', 'vosk-model-small-pt-0.3')
if not os.path.exists(model_path):
    respond(False, error='model_not_found', message=f'Modelo Vosk não encontrado em {model_path}. Defina VOSK_MODEL_PATH ou baixe um modelo compatível.')

try:
    wf = wave.open(audio_path, 'rb')
except Exception as exc:
    respond(False, error='invalid_audio', message=f'Erro ao abrir WAV: {exc}')

if wf.getcomptype() != 'NONE':
    respond(False, error='compressed_audio', message='Arquivo WAV compactado não é suportado')

channels = wf.getnchannels()
sampwidth = wf.getsampwidth()
samplerate = wf.getframerate()

try:
    model = Model(model_path)
    recognizer = KaldiRecognizer(model, samplerate)
    recognizer.SetWords(False)

    text_parts = []
    while True:
        data = wf.readframes(4000)
        if len(data) == 0:
            break
        if channels > 1:
            data = audioop.tomono(data, sampwidth, [0.5] * channels)
        if recognizer.AcceptWaveform(data):
            result = json.loads(recognizer.Result())
            if 'text' in result:
                text_parts.append(result['text'])

    final_result = json.loads(recognizer.FinalResult())
    if 'text' in final_result:
        text_parts.append(final_result['text'])

    transcript = ' '.join([part for part in text_parts if part]).strip()
    respond(True, text=transcript, message='Transcrição concluída')
except Exception as exc:
    respond(False, error='transcription_error', message=f'Erro no transcritor: {exc}')
