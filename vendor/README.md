# Binários redistribuíveis

Essas pastas precisam ser preenchidas antes de rodar `npm run dist`
(gerar o instalador autocontido). Elas ficam fora do Git de propósito -
são binários de terceiros, grandes demais pra versionar.

## Preparação automática (recomendado)

Na raiz do projeto:

```powershell
.\scripts\setup-vendor.ps1
```

Esse script baixa e configura tudo sozinho: Python + faster-whisper,
Pandoc, 7-Zip e o instalador da Ollama.

## Preparação manual (se preferir, ou se o script falhar em algo)

Consulte `PROMPT_INSTALADOR_DEPENDENCIAS.md` e
`PROMPT_INSTALAR_OLLAMA_MODELOS.md` pra o procedimento passo a passo de
cada binário.
