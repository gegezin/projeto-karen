/**
 * Gerenciador de Atalhos Globais e Modos
 * Permite criar modos personalizados (Dev, Gamer, etc.) com automações
 */

export interface ShortcutAction {
  type: 'open_app' | 'run_command' | 'spotify_playlist' | 'spotify_pause' | 'spotify_resume' | 'spotify_next' | 'spotify_previous' | 'set_volume' | 'wait';
  params: any;
}

export interface ShortcutMode {
  name: string;
  description: string;
  actions: ShortcutAction[];
}

export class ShortcutManager {
  private modes: Map<string, ShortcutMode> = new Map();
  private systemAutomation: any;
  private spotifyManager: any;

  constructor(systemAutomation: any, spotifyManager: any = null) {
    this.systemAutomation = systemAutomation;
    this.spotifyManager = spotifyManager;
    this.initializeDefaultModes();
  }

  /**
   * Inicializar modos padrão
   */
  private initializeDefaultModes(): void {
    // Modo Dev
    this.modes.set('dev', {
      name: 'Modo Dev',
      description: 'Abre VS Code, terminal e inicia playlist de foco',
      actions: [
        { type: 'open_app', params: { name: 'code' } },
        { type: 'wait', params: { seconds: 2 } },
        { type: 'open_app', params: { name: 'terminal' } },
        { type: 'spotify_playlist', params: { playlistName: 'playlist modo dev' } }
      ]
    });

    // Modo Gamer
    this.modes.set('gamer', {
      name: 'Modo Gamer',
      description: 'Fecha apps pesados, abre launcher e inicia playlist gamer',
      actions: [
        { type: 'set_volume', params: { volume: 80 } },
        { type: 'spotify_playlist', params: { playlistName: 'Gaming' } },
        { type: 'open_app', params: { name: 'steam' } }
      ]
    });

    // Modo Relax
    this.modes.set('relax', {
      name: 'Modo Relax',
      description: 'Pausa música, ajusta volume para baixo',
      actions: [
        { type: 'set_volume', params: { volume: 30 } },
        { type: 'spotify_playlist', params: { playlistName: 'Relax' } }
      ]
    });

    // Modo Foco
    this.modes.set('focus', {
      name: 'Modo Foco',
      description: 'Fecha apps distrativos, inicia playlist de foco',
      actions: [
        { type: 'set_volume', params: { volume: 50 } },
        { type: 'spotify_playlist', params: { playlistName: 'Deep Focus' } }
      ]
    });
  }

  /**
   * Executar um modo específico
   */
  async executeMode(modeName: string): Promise<boolean> {
    const mode = this.modes.get(modeName.toLowerCase());
    
    if (!mode) {
      console.error(`Modo "${modeName}" não encontrado`);
      return false;
    }

    console.log(`Executando modo: ${mode.name}`);
    
    try {
      for (const action of mode.actions) {
        await this.executeAction(action);
      }
      
      console.log(`Modo "${mode.name}" executado com sucesso`);
      return true;
    } catch (error) {
      console.error(`Erro ao executar modo "${mode.name}":`, error);
      return false;
    }
  }

  /**
   * Executar uma ação individual
   */
  private async executeAction(action: ShortcutAction): Promise<void> {
    switch (action.type) {
      case 'open_app':
        await this.systemAutomation.executeAction('process_open', {
          name: action.params.name
        });
        break;

      case 'run_command':
        // Implementar execução de comando
        console.log(`Executando comando: ${action.params.command}`);
        break;

      case 'spotify_playlist':
        if (this.spotifyManager) {
          console.log(`Iniciando playlist: ${action.params.playlistName}`);
          const playlist = await this.spotifyManager.searchPlaylist(action.params.playlistName);
          if (playlist) {
            await this.spotifyManager.playPlaylist(playlist.uri);
          } else {
            console.error(`Playlist "${action.params.playlistName}" não encontrada`);
          }
        } else {
          console.log('SpotifyManager não disponível');
        }
        break;

      case 'set_volume':
        // Implementar ajuste de volume
        console.log(`Ajustando volume para: ${action.params.volume}`);
        break;

      case 'wait':
        await new Promise(resolve => setTimeout(resolve, action.params.seconds * 1000));
        break;

      default:
        console.warn(`Tipo de ação desconhecido: ${action.type}`);
    }
  }

  /**
   * Criar um novo modo customizado
   */
  createMode(mode: ShortcutMode): void {
    this.modes.set(mode.name.toLowerCase(), mode);
    console.log(`Modo "${mode.name}" criado`);
  }

  /**
   * Listar todos os modos disponíveis
   */
  listModes(): ShortcutMode[] {
    return Array.from(this.modes.values());
  }

  /**
   * Obter detalhes de um modo específico
   */
  getMode(modeName: string): ShortcutMode | null {
    return this.modes.get(modeName.toLowerCase()) || null;
  }

  /**
   * Remover um modo
   */
  removeMode(modeName: string): boolean {
    return this.modes.delete(modeName.toLowerCase());
  }

  /**
   * Executar ações rápidas (atalhos)
   */
  async quickAction(action: string): Promise<boolean> {
    const quickActions: Record<string, ShortcutAction[]> = {
      'pause_music': [
        { type: 'spotify_pause', params: {} }
      ],
      'resume_music': [
        { type: 'spotify_resume', params: {} }
      ],
      'next_track': [
        { type: 'spotify_next', params: {} }
      ],
      'volume_up': [
        { type: 'set_volume', params: { volume: 80 } }
      ],
      'volume_down': [
        { type: 'set_volume', params: { volume: 30 } }
      ]
    };

    const actions = quickActions[action];
    if (!actions) {
      console.error(`Ação rápida "${action}" não encontrada`);
      return false;
    }

    try {
      for (const act of actions) {
        await this.executeAction(act);
      }
      return true;
    } catch (error) {
      console.error(`Erro ao executar ação rápida "${action}":`, error);
      return false;
    }
  }
}
