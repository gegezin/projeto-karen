/**
 * Modo Gamer - Otimização para jogos
 * Fecha aplicativos pesados e abre o jogo solicitado
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';

const execAsync = promisify(exec);

export interface GameModeConfig {
  gameName: string;
  closeApps: string[];
  optimizeSettings: boolean;
}

export interface GameModeResult {
  success: boolean;
  closedApps: string[];
  openedGame: boolean;
  errors: string[];
  message: string;
}

// Lista de aplicativos pesados para fechar no modo gamer
const HEAVY_APPS = [
  // Navegadores
  'chrome.exe',
  'msedge.exe',
  'firefox.exe',
  'opera.exe',
  'brave.exe',
  // Comunicação
  'Discord.exe',
  'WhatsApp.exe',
  'Telegram.exe',
  'Slack.exe',
  'Teams.exe',
  // Música/Streaming
  'Spotify.exe',
  'vlc.exe',
  // Launchers de jogos (opcional - manter apenas o necessário)
  'EpicGamesLauncher.exe',
  'Origin.exe',
  'Battle.net.exe',
  // Outros
  'obs64.exe', // OBS - opcional
  'streamlabs obs.exe',
  // IDEs (pesados)
  'Code.exe', // VS Code
  'devenv.exe', // Visual Studio
  'idea64.exe', // IntelliJ
  'studio64.exe', // Android Studio
];

// Mapeamento de nomes amigáveis para executáveis
const APP_NAME_MAP: { [key: string]: string[] } = {
  'chrome': ['chrome.exe'],
  'edge': ['msedge.exe'],
  'firefox': ['firefox.exe'],
  'navegador': ['chrome.exe', 'msedge.exe', 'firefox.exe'],
  'discord': ['Discord.exe'],
  'whatsapp': ['WhatsApp.exe'],
  'spotify': ['Spotify.exe'],
  'vscode': ['Code.exe'],
  'windsurf': ['windsurf.exe'],
  'cursor': ['Cursor.exe'],
  'obs': ['obs64.exe'],
  'epic': ['EpicGamesLauncher.exe'],
  'steam': ['steam.exe'],
  'battle.net': ['Battle.net.exe'],
  'origin': ['Origin.exe'],
  'teams': ['Teams.exe'],
  'slack': ['Slack.exe'],
  'telegram': ['Telegram.exe'],
  'zoom': ['Zoom.exe'],
  'twitch': ['Twitch.exe'],
  'valorant': ['VALORANT-Win64-Shipping.exe', 'RiotClientServices.exe'],
  'vava': ['VALORANT-Win64-Shipping.exe', 'RiotClientServices.exe'],
};

export class GameModeController {
  private isActive = false;
  private currentGame: string | null = null;

  /**
   * Ativa o modo gamer
   */
  async activate(gameName: string, keepApps: string[] = []): Promise<GameModeResult> {
    console.log(`\n🎮 ========== ATIVANDO MODO GAMER ==========`);
    console.log(`🎮 Jogo solicitado: ${gameName}`);
    console.log(`🎮 Apps para manter: ${keepApps.join(', ') || 'nenhum'}`);
    
    const result: GameModeResult = {
      success: false,
      closedApps: [],
      openedGame: false,
      errors: [],
      message: ''
    };

    try {
      // 1. Fechar aplicativos pesados
      console.log(`\n📌 Etapa 1: Fechando apps pesados...`);
      const closed = await this.closeHeavyApps(keepApps);
      result.closedApps = closed;
      console.log(`✅ Etapa 1 concluída: ${closed.length} apps fechados`);

      // 2. Tentar abrir o jogo
      console.log(`\n📌 Etapa 2: Abrindo jogo ${gameName}...`);
      const gameOpened = await this.openGame(gameName);
      result.openedGame = gameOpened;
      console.log(`✅ Etapa 2 concluída: jogo ${gameOpened ? 'aberto' : 'não aberto'}`);
      
      if (gameOpened) {
        this.isActive = true;
        this.currentGame = gameName;
        result.success = true;
        result.message = `🎮 Modo Gamer ativado! ${gameName} está aberto. ${closed.length} apps fechados.`;
      } else {
        result.message = `⚠️ Modo Gamer ativado, mas não consegui abrir ${gameName}. Tente abrir manualmente.`;
      }

    } catch (error) {
      result.errors.push(String(error));
      result.message = `❌ Erro no Modo Gamer: ${error}`;
    }

    return result;
  }

  /**
   * Fecha aplicativos pesados (otimizado)
   */
  private async closeHeavyApps(keepApps: string[]): Promise<string[]> {
    const closed: string[] = [];
    
    console.log(`🔍 Verificando apps pesados para fechar...`);
    console.log(`📋 Lista de apps pesados: ${HEAVY_APPS.join(', ')}`);
    
    // Apps para manter abertos (case insensitive)
    const keepLower = keepApps.map(a => a.toLowerCase());
    
    // Verificar todos os apps em paralelo
    const checkPromises = HEAVY_APPS.map(async (appExe) => {
      const appName = appExe.replace('.exe', '').toLowerCase();
      
      // Verificar se deve manter
      if (keepLower.some(keep => appName.includes(keep) || keep.includes(appName))) {
        console.log(`⏭️ Mantendo ${appExe} (na lista de keep)`);
        return null;
      }

      try {
        // Verificar se está rodando
        console.log(`🔍 Verificando se ${appExe} está rodando...`);
        const { stdout } = await execAsync(`tasklist /FI "IMAGENAME eq ${appExe}" /FO CSV /NH`).catch(() => ({ stdout: '' }));
        
        console.log(`📊 Tasklist result for ${appExe}: ${stdout}`);
        
        if (stdout && stdout.includes(appExe)) {
          console.log(`✅ ${appExe} encontrado! Fechando...`);
          // Fechar sem bloqueio
          exec(`taskkill /F /IM ${appExe}`, (error) => {
            if (!error) {
              console.log(`🔒 Fechado: ${appExe}`);
            } else {
              console.error(`❌ Erro ao fechar ${appExe}:`, error);
            }
          });
          return appExe.replace('.exe', '');
        } else {
          console.log(`⏭️ ${appExe} não está rodando`);
        }
      } catch (error) {
        console.error(`❌ Erro ao verificar ${appExe}:`, error);
      }
      return null;
    });

    // Aguardar todas as verificações (não os fechamentos)
    const results = await Promise.all(checkPromises);
    
    // Coletar apps que foram fechados
    results.forEach(result => {
      if (result) {
        closed.push(result);
      }
    });
    
    console.log(`🔒 Total de apps fechados: ${closed.length} - ${closed.join(', ')}`);

    return closed;
  }

  /**
   * Abre o jogo solicitado via apps-config.json ou comando shell
   */
  private async openGame(gameName: string): Promise<boolean> {
    try {
      console.log(`🎮 Abrindo jogo: ${gameName}`);
      
      // 1. Tentar carregar apps-config.json
      const configPath = path.join(process.cwd(), 'apps-config.json');
      console.log(`🔍 Procurando apps-config em: ${configPath}`);
      
      if (fs.existsSync(configPath)) {
        const configData = fs.readFileSync(configPath, 'utf-8');
        const config = JSON.parse(configData);
        
        // Verificar aliases
        const normalizedName = gameName.toLowerCase().trim();
        const targetApp = config.aliases?.[normalizedName] || normalizedName;
        console.log(`🔍 App normalizado: ${targetApp}`);
        
        // Verificar se existe no apps
        const appConfig = config.apps?.[targetApp];
        
        if (appConfig && appConfig.paths && appConfig.paths.length > 0) {
          // Encontrar primeiro caminho existente
          for (const appPath of appConfig.paths) {
            if (fs.existsSync(appPath)) {
              console.log(`✅ Caminho encontrado: ${appPath}`);
              
              // Abrir com spawn para não bloquear
              const args = appConfig.arguments || [];
              const child = spawn(appPath, args, {
                detached: true,
                stdio: 'ignore'
              });
              child.unref();
              
              console.log(`🚀 Jogo iniciado via apps-config: ${appPath} ${args.join(' ')}`);
              return true;
            } else {
              console.log(`⏭️ Caminho não existe: ${appPath}`);
            }
          }
          console.log(`⚠️ Nenhum caminho válido encontrado em apps-config`);
        } else {
          console.log(`⚠️ App não encontrado em apps-config`);
        }
      } else {
        console.log(`⚠️ apps-config.json não encontrado`);
      }
      
      // 2. Fallback: usar comando start
      console.log(`� Usando comando start como fallback`);
      exec(`start "" "${gameName}"`, (error) => {
        if (error) {
          console.error(`❌ Erro ao abrir jogo ${gameName}:`, error);
        } else {
          console.log(`✅ Jogo iniciado via start: ${gameName}`);
        }
      });
      
      return true;
    } catch (error) {
      console.error(`❌ Erro ao abrir jogo ${gameName}:`, error);
      return false;
    }
  }

  /**
   * Fechar aplicativos específicos por nome (otimizado)
   */
  async closeAppsByName(appNames: string[]): Promise<string[]> {
    const closed: string[] = [];
    
    // Executar todos os fechamentos em paralelo
    const closePromises = appNames.map(async (appName) => {
      // Validar se appName é válido
      if (!appName || typeof appName !== 'string') {
        console.log(`⚠️ Nome de app inválido: ${appName}`);
        return null;
      }
      
      const executables = APP_NAME_MAP[appName.toLowerCase()];
      
      if (executables) {
        // Fechar todos os executáveis relacionados
        const execPromises = executables.map(exe => 
          new Promise<boolean>((resolve) => {
            exec(`taskkill /F /IM ${exe}`, (error) => {
              if (!error) {
                console.log(`🔒 Fechado: ${appName} (${exe})`);
                resolve(true);
              } else {
                resolve(false);
              }
            });
          })
        );
        
        // Aguardar qualquer um ter sucesso
        const results = await Promise.all(execPromises);
        if (results.some(r => r)) {
          return appName;
        }
      } else {
        // Tentar pelo nome exato
        return new Promise<string | null>((resolve) => {
          exec(`taskkill /F /IM ${appName}.exe`, (error) => {
            if (!error) {
              console.log(`🔒 Fechado: ${appName}`);
              resolve(appName);
            } else {
              resolve(null);
            }
          });
        });
      }
      
      return null;
    });

    // Aguardar todas as tentativas
    const results = await Promise.all(closePromises);
    
    // Coletar apps fechados
    results.forEach(result => {
      if (result) {
        closed.push(result);
      }
    });
    
    return closed;
  }

  /**
   * Desativa o modo gamer
   */
  deactivate(): void {
    this.isActive = false;
    this.currentGame = null;
    console.log('🎮 Modo Gamer desativado');
  }

  /**
   * Verifica se está ativo
   */
  isGameModeActive(): boolean {
    return this.isActive;
  }

  /**
   * Retorna jogo atual
   */
  getCurrentGame(): string | null {
    return this.currentGame;
  }

  /**
   * Lista aplicativos pesados em execução (otimizado)
   */
  async getRunningHeavyApps(): Promise<string[]> {
    // Verificar todos os apps em paralelo
    const checkPromises = HEAVY_APPS.map(async (appExe) => {
      try {
        const { stdout } = await execAsync(`tasklist /FI "IMAGENAME eq ${appExe}" /FO CSV /NH`).catch(() => ({ stdout: '' }));
        if (stdout && stdout.includes(appExe)) {
          return appExe.replace('.exe', '');
        }
      } catch (e) {}
      return null;
    });

    // Aguardar todas as verificações
    const results = await Promise.all(checkPromises);
    
    // Filtrar resultados não nulos
    return results.filter(app => app !== null) as string[];
  }

  /**
   * Parse de comandos de modo gamer
   */
  parseGameModeCommand(text: string): { action: 'activate' | 'close' | 'status'; gameName?: string; keepApps?: string[] } | null {
    const lower = text.toLowerCase();
    
    // Padrões para ativar modo gamer
    const activatePatterns = [
      /modo\s*gamer\s+(\w+)/i,
      /ativar\s+modo\s*gamer/i,
      /modo\s*jogo\s+(\w+)/i,
      /jogar\s+(\w+)\s+(?:no\s+)?modo\s*gamer/i,
      /abrir\s+(\w+)\s+(?:no\s+)?modo\s*gamer/i,
    ];
    
    for (const pattern of activatePatterns) {
      const match = lower.match(pattern);
      if (match) {
        return {
          action: 'activate',
          gameName: match[1] || 'jogo',
          keepApps: []
        };
      }
    }
    
    // Padrão para fechar apps
    if (lower.includes('fechar') && (lower.includes('apps') || lower.includes('aplicativos'))) {
      return { action: 'close' };
    }
    
    // Status
    if (lower.includes('status') && lower.includes('gamer')) {
      return { action: 'status' };
    }
    
    return null;
  }
}

// Instância singleton
export const gameModeController = new GameModeController();
