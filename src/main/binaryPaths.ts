import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

function resolveBundled(devRelativePath: string, prodRelativePath: string): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, prodRelativePath);
  }
  return path.join(process.cwd(), devRelativePath);
}

export function getPythonExePath(): string {
  return resolveBundled('vendor/python/python.exe', 'python/python.exe');
}

export function getPandocPath(): string {
  return resolveBundled('vendor/pandoc/pandoc.exe', 'pandoc/pandoc.exe');
}

export function getSevenZipPath(): string {
  return resolveBundled('vendor/7zip/7za.exe', '7zip/7za.exe');
}

export function getTranscriptionScriptPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'scripts', 'transcribe_whisper.py')
    : path.join(process.cwd(), 'scripts', 'transcribe_whisper.py');
}

export function verifyBundledBinaries(): void {
  const checks: Array<[string, string]> = [
    ['Python', getPythonExePath()],
    ['Pandoc', getPandocPath()],
    ['7-Zip', getSevenZipPath()]
  ];

  for (const [name, binPath] of checks) {
    if (!fs.existsSync(binPath)) {
      console.warn(`⚠️ ${name} não encontrado no caminho esperado: ${binPath}`);
    } else {
      console.log(`✅ ${name} localizado: ${binPath}`);
    }
  }
}
