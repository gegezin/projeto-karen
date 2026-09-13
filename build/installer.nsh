!macro customInstall
  ; Instala a Ollama somente quando ela ainda nao estiver disponivel no PATH.
  nsExec::ExecToStack 'where ollama'
  Pop $0
  ${If} $0 != 0
    DetailPrint "Instalando Ollama..."
    ExecWait '"$INSTDIR\resources\ollama\OllamaSetup.exe" /S' $1
    ${If} $1 == 0
      DetailPrint "Ollama instalada."
    ${Else}
      DetailPrint "A instalacao da Ollama terminou com codigo $1."
    ${EndIf}
  ${Else}
    DetailPrint "Ollama ja esta instalada, pulando."
  ${EndIf}
!macroend
