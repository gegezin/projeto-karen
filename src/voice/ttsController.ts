import { EdgeTTS } from 'node-edge-tts';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export class TtsController {
  private voice: string;

  constructor() {
    this.voice = process.env.TTS_VOICE_NAME || 'pt-BR-FranciscaNeural';
  }

  async speak(text: string): Promise<{ success: boolean; audioDataUrl?: string; error?: string }> {
    const cleanText = text
      .replace(/```[\s\S]*?```/g, 'trecho de código omitido.')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/[*_#>]/g, '')
      .trim();

    if (!cleanText) {
      return { success: false, error: 'Texto vazio' };
    }

    const tempPath = path.join(os.tmpdir(), `karen-tts-${Date.now()}.mp3`);

    try {
      const tts = new EdgeTTS({
        voice: this.voice,
        lang: 'pt-BR'
      });

      await tts.ttsPromise(cleanText, tempPath);

      const audioBuffer = await fs.promises.readFile(tempPath);
      return {
        success: true,
        audioDataUrl: `data:audio/mpeg;base64,${audioBuffer.toString('base64')}`
      };
    } catch (error: any) {
      console.error('❌ Erro no Edge TTS:', error);
      return { success: false, error: error.message || String(error) };
    } finally {
      fs.promises.unlink(tempPath).catch(() => {});
    }
  }

  stop(): void {
    // A reprodução é controlada pelo elemento Audio no renderer.
  }
}
