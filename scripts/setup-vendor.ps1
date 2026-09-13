# Script de preparação da pasta vendor/ - baixa e configura Python,
# Pandoc, 7-Zip e o instalador da Ollama automaticamente.
# Uso: .\scripts\setup-vendor.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$vendorPath = Join-Path $root "vendor"

Write-Host "=== Preparando vendor/ para build da Karen ===" -ForegroundColor Cyan

# ---------- Python embutido + faster-whisper ----------
$pythonDir = Join-Path $vendorPath "python"
if (Test-Path (Join-Path $pythonDir "python.exe")) {
    Write-Host "[1/4] Python já preparado, pulando." -ForegroundColor Yellow
} else {
    Write-Host "[1/4] Baixando Python embutido..." -ForegroundColor Green
    New-Item -ItemType Directory -Force -Path $pythonDir | Out-Null
    $pyZip = Join-Path $env:TEMP "python-embed.zip"
    Invoke-WebRequest -Uri "https://www.python.org/ftp/python/3.12.7/python-3.12.7-embed-amd64.zip" -OutFile $pyZip
    Expand-Archive -Path $pyZip -DestinationPath $pythonDir -Force
    Remove-Item $pyZip

    Write-Host "      Habilitando site-packages..." -ForegroundColor Green
    $pthFile = Get-ChildItem -Path $pythonDir -Filter "python3*._pth" | Select-Object -First 1
    (Get-Content $pthFile.FullName) -replace '^#import site', 'import site' | Set-Content $pthFile.FullName

    Write-Host "      Instalando pip..." -ForegroundColor Green
    $getPip = Join-Path $env:TEMP "get-pip.py"
    Invoke-WebRequest -Uri "https://bootstrap.pypa.io/get-pip.py" -OutFile $getPip
    & "$pythonDir\python.exe" $getPip
    Remove-Item $getPip

    Write-Host "      Instalando faster-whisper (pode demorar alguns minutos)..." -ForegroundColor Green
    & "$pythonDir\python.exe" -m pip install faster-whisper --quiet
}

# ---------- Pandoc ----------
$pandocDir = Join-Path $vendorPath "pandoc"
if (Test-Path (Join-Path $pandocDir "pandoc.exe")) {
    Write-Host "[2/4] Pandoc já preparado, pulando." -ForegroundColor Yellow
} else {
    Write-Host "[2/4] Baixando Pandoc..." -ForegroundColor Green
    New-Item -ItemType Directory -Force -Path $pandocDir | Out-Null
    $pandocZip = Join-Path $env:TEMP "pandoc.zip"
    $pandocVersion = "3.5"
    Invoke-WebRequest -Uri "https://github.com/jgm/pandoc/releases/download/$pandocVersion/pandoc-$pandocVersion-windows-x86_64.zip" -OutFile $pandocZip
    $extractTemp = Join-Path $env:TEMP "pandoc-extract"
    Expand-Archive -Path $pandocZip -DestinationPath $extractTemp -Force
    $pandocExe = Get-ChildItem -Path $extractTemp -Filter "pandoc.exe" -Recurse | Select-Object -First 1
    Copy-Item $pandocExe.FullName -Destination $pandocDir
    Remove-Item $pandocZip
    Remove-Item $extractTemp -Recurse -Force
}

# ---------- 7-Zip standalone ----------
$sevenZipDir = Join-Path $vendorPath "7zip"
if (Test-Path (Join-Path $sevenZipDir "7za.exe")) {
    Write-Host "[3/4] 7-Zip já preparado, pulando." -ForegroundColor Yellow
} else {
    Write-Host "[3/4] Baixando 7-Zip standalone..." -ForegroundColor Green
    New-Item -ItemType Directory -Force -Path $sevenZipDir | Out-Null
    $sevenZipArchive = Join-Path $env:TEMP "7zr-extra.7z"
    Invoke-WebRequest -Uri "https://www.7-zip.org/a/7z2408-extra.7z" -OutFile $sevenZipArchive
    # 7za.exe não existe ainda no sistema pra extrair o próprio pacote -
    # usamos o Expand-Archive não funciona com .7z, então baixamos o 7za.exe
    # solto de um mirror direto em vez de extrair do pacote "extra".
    Remove-Item $sevenZipArchive -ErrorAction SilentlyContinue
    Invoke-WebRequest -Uri "https://www.7-zip.org/a/7za920.zip" -OutFile (Join-Path $env:TEMP "7za.zip")
    Expand-Archive -Path (Join-Path $env:TEMP "7za.zip") -DestinationPath (Join-Path $env:TEMP "7za-extract") -Force
    Copy-Item (Join-Path $env:TEMP "7za-extract\7za.exe") -Destination $sevenZipDir
    Remove-Item (Join-Path $env:TEMP "7za.zip")
    Remove-Item (Join-Path $env:TEMP "7za-extract") -Recurse -Force
}

# ---------- Ollama installer ----------
$ollamaDir = Join-Path $vendorPath "ollama"
if (Test-Path (Join-Path $ollamaDir "OllamaSetup.exe")) {
    Write-Host "[4/4] Instalador da Ollama já preparado, pulando." -ForegroundColor Yellow
} else {
    Write-Host "[4/4] Baixando instalador da Ollama..." -ForegroundColor Green
    New-Item -ItemType Directory -Force -Path $ollamaDir | Out-Null
    Invoke-WebRequest -Uri "https://ollama.com/download/OllamaSetup.exe" -OutFile (Join-Path $ollamaDir "OllamaSetup.exe")
}

Write-Host ""
Write-Host "=== vendor/ pronta! Pode rodar 'npm run dist' agora. ===" -ForegroundColor Cyan