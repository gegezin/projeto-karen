import { spawn } from 'child_process';
import { BrowserWindow } from 'electron';

export interface ModelPullProgress {
  status: string;
  percent?: number;
}

export async function isModelAvailable(modelName: string): Promise<boolean> {
  if (modelName.endsWith(':cloud')) {
    return true;
  }

  return new Promise((resolve) => {
    const proc = spawn('ollama', ['list']);
    let stdout = '';

    proc.stdout.on('data', data => { stdout += data.toString(); });
    proc.on('close', () => resolve(stdout.split(/\r?\n/).some(line => line.startsWith(modelName))));
    proc.on('error', () => resolve(false));
  });
}

export function pullModel(modelName: string, mainWindow: BrowserWindow | null): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const proc = spawn('ollama', ['pull', modelName]);
    let stderr = '';

    proc.stdout.on('data', data => {
      const status = data.toString().trim();
      if (status) mainWindow?.webContents.send('model-pull-progress', { status });
    });
    proc.stderr.on('data', data => { stderr += data.toString(); });

    proc.on('close', exitCode => {
      if (exitCode === 0) {
        resolve({ success: true });
      } else {
        resolve({ success: false, error: stderr || `Processo saiu com código ${exitCode}` });
      }
    });
    proc.on('error', err => resolve({ success: false, error: err.message }));
  });
}
