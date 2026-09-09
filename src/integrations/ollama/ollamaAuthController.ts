import { spawn } from 'child_process';

export interface OllamaSignInResult {
  success: boolean;
  alreadySignedIn?: boolean;
  message: string;
}

export class OllamaAuthController {
  async signIn(): Promise<OllamaSignInResult> {
    return new Promise((resolve) => {
      const proc = spawn('ollama', ['signin']);
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', data => { stdout += data.toString(); });
      proc.stderr.on('data', data => { stderr += data.toString(); });

      proc.on('close', exitCode => {
        const output = `${stdout}\n${stderr}`.toLowerCase();
        if (output.includes('already signed in') || output.includes('já autenticado')) {
          resolve({ success: true, alreadySignedIn: true, message: 'Você já está conectado à Ollama Cloud.' });
          return;
        }
        if (exitCode === 0 || output.includes('signed in') || output.includes('success')) {
          resolve({ success: true, message: 'Conectado à Ollama Cloud com sucesso!' });
          return;
        }
        resolve({ success: false, message: `Não consegui conectar à Ollama Cloud. Saída: ${stdout || stderr || 'nenhuma'}` });
      });

      proc.on('error', err => {
        resolve({ success: false, message: `Comando "ollama" não encontrado. A Ollama está instalada e no PATH? Erro: ${err.message}` });
      });
    });
  }

  async checkSignedIn(): Promise<boolean> {
    const result = await this.signIn();
    return result.success;
  }
}
