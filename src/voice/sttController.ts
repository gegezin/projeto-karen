import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export class SttController {
  private scriptPath: string;
  private readonly pythonCandidates = ['python', 'python3', 'py'];

  constructor() {
    this.scriptPath = path.join(process.cwd(), 'scripts', 'transcribe_whisper.py');
  }

  /**
   * Recebe o áudio gravado (buffer) e retorna o texto transcrito.
   */
  async transcribe(audioBuffer: Buffer, extension: string = 'webm'): Promise<{ success: boolean; text?: string; error?: string }> {
    const tempPath = path.join(os.tmpdir(), `karen-stt-${Date.now()}.${extension}`);

    try {
      await fs.promises.writeFile(tempPath, audioBuffer);
      return await this.runWithFallback(tempPath);
    } finally {
      fs.promises.unlink(tempPath).catch(() => {});
    }
  }

  private async runWithFallback(audioPath: string): Promise<{ success: boolean; text?: string; error?: string }> {
    let lastError = 'Nenhum interpretador Python encontrado';

    for (const command of this.pythonCandidates) {
      const result = await this.runPython(command, audioPath);
      if (result.success) return result;

      if (result.error && !result.error.includes('ENOENT')) return result;
      lastError = result.error || lastError;
    }

    return { success: false, error: lastError };
  }

  private runPython(command: string, audioPath: string): Promise<{ success: boolean; text?: string; error?: string }> {
    return new Promise((resolve) => {
      const py = spawn(command, [this.scriptPath, audioPath]);
      let stdout = '';
      let stderr = '';

      py.stdout.on('data', (data) => { stdout += data.toString(); });
      py.stderr.on('data', (data) => { stderr += data.toString(); });

      py.on('close', () => {
        try {
          const result = JSON.parse(stdout.trim());
          if (!result.success) {
            console.error(`❌ STT (${command}) falhou:`, result.error, result.message, stderr);
          }
          resolve(result);
        } catch {
          resolve({ success: false, error: `Falha ao interpretar saída do Python (${command}): ${stderr || stdout}` });
        }
      });

      py.on('error', (err: any) => {
        resolve({ success: false, error: err.code || err.message || String(err) });
      });
    });
  }
}
