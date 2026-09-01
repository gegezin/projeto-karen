#!/usr/bin/env python3
"""
Speech Recognition Helper
Captura áudio do microfone e transcreve para texto usando SpeechRecognition
"""

import sys
import json
import speech_recognition as sr
from datetime import datetime

def capture_and_transcribe(language='pt-BR', timeout=10, phrase_time_limit=None):
    """
    Captura áudio do microfone e transcreve usando Google Speech Recognition
    
    Args:
        language: Código da linguagem (pt-BR, en-US, etc)
        timeout: Tempo máximo em segundos para detectar fala inicial
        phrase_time_limit: Tempo máximo da frase em segundos
    
    Returns:
        dict com resultado
    """
    try:
        # Inicializar reconhecedor
        recognizer = sr.Recognizer()
        
        print(f"🎤 Inicializando microfone...", file=sys.stderr)
        
        # Usar microfone padrão
        with sr.Microphone() as source:
            # Calibrar para ruído ambiente
            print(f"🎤 Calibrando para ruído ambiente (2 segundos)...", file=sys.stderr)
            recognizer.adjust_for_ambient_noise(source, duration=2)
            
            print(f"🎤 Escutando ({timeout}s timeout)...", file=sys.stderr)
            
            # Capturar áudio
            try:
                audio = recognizer.listen(
                    source, 
                    timeout=timeout,
                    phrase_time_limit=phrase_time_limit or timeout
                )
            except sr.WaitTimeoutError:
                print(f"❌ Timeout: nenhuma fala detectada", file=sys.stderr)
                return {
                    "success": False,
                    "error": "timeout",
                    "message": "Nenhuma fala detectada no tempo limite"
                }
        
        print(f"🎤 Áudio capturado, transcodificando...", file=sys.stderr)
        
        # Transcrever usando Google Speech Recognition
        try:
            text = recognizer.recognize_google(audio, language=language)
            
            result = {
                "success": True,
                "text": text,
                "language": language,
                "confidence": 0.95,
                "timestamp": datetime.now().isoformat()
            }
            
            print(f"✅ Transcrição: {text}", file=sys.stderr)
            return result
            
        except sr.UnknownValueError:
            print(f"❌ Áudio não compreendido", file=sys.stderr)
            return {
                "success": False,
                "error": "unknown_audio",
                "message": "Não foi possível compreender o áudio"
            }
        except sr.RequestError as e:
            print(f"❌ Erro na requisição: {e}", file=sys.stderr)
            return {
                "success": False,
                "error": "request_error",
                "message": f"Erro ao acessar serviço de reconhecimento: {str(e)}"
            }
    
    except Exception as e:
        print(f"❌ Erro geral: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        return {
            "success": False,
            "error": "general_error",
            "message": str(e)
        }

if __name__ == "__main__":
    # Parse arguments
    language = sys.argv[1] if len(sys.argv) > 1 else 'pt-BR'
    timeout = int(sys.argv[2]) if len(sys.argv) > 2 else 10
    
    result = capture_and_transcribe(language=language, timeout=timeout)
    
    # Saída em JSON
    print(json.dumps(result))
