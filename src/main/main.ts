import { app, BrowserWindow, ipcMain, dialog, screen, nativeImage, Tray, Menu, globalShortcut, shell } from 'electron';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { PermissionManager } from '../permissions/permissionManager';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });
import { SystemAutomation } from '../automation/systemAutomation';
import { configManager } from '../config/configManager';
import { conversationHistory } from '../conversation/conversationHistory';
import { reminderController } from '../automation/reminders/reminderController';
import { gameModeController } from '../automation/gameMode/gameModeController';
import { KarenBrain } from '../gemini/karenbrain';
import { SpotifyManager } from '../integrations/spotify/spotifyManager';
import { ShortcutManager } from '../integrations/shortcuts/shortcutManager';
import { MinecraftManager } from '../integrations/minecraft/minecraftManager';
import { FileManager } from '../integrations/file-management/fileManager';
import { ScreenController } from '../automation/screen/screenController';

class IADesktopAssistant {
  private mainWindow: BrowserWindow | null = null;
  private tray: Tray | null = null;
  private karenBrain: KarenBrain;
  private permissionManager: PermissionManager;
  private systemAutomation: SystemAutomation;
  private spotifyManager: SpotifyManager;
  private isQuitting = false;
  private voiceActive = false;
  private globalShortcutEnabled = true;
  private devToolsOpen = false;
  private windowEventCleanup: (() => void) | null = null;

  constructor() {
    this.permissionManager = new PermissionManager();
    this.systemAutomation = new SystemAutomation();
    
    // Inicializar novos managers com credenciais de variáveis de ambiente
    const spotifyClientId = process.env.SPOTIFY_CLIENT_ID || '';
    const spotifyClientSecret = process.env.SPOTIFY_CLIENT_SECRET || '';
    const spotifyRedirectUri = process.env.SPOTIFY_REDIRECT_URI || 'http://127.0.0.1:8888/callback';
    
    if (!spotifyClientId || !spotifyClientSecret) {
      console.warn('⚠️ Spotify credentials not found in environment variables. Check .env file.');
    }
    
    this.spotifyManager = new SpotifyManager(
      spotifyClientId,
      spotifyClientSecret,
      spotifyRedirectUri
    );
    const shortcutManager = new ShortcutManager(this.systemAutomation, this.spotifyManager);
    const minecraftManager = new MinecraftManager();
    const fileManager = new FileManager();
    const screenController = new ScreenController();
    
    this.karenBrain = new KarenBrain(
      this.permissionManager, 
      this.systemAutomation,
      this.spotifyManager,
      shortcutManager,
      minecraftManager,
      fileManager,
      screenController
    );
    this.karenBrain.initialize();
    this.init();
  }

  private init(): void {
    app.whenReady().then(() => {
      this.createWindow();
      this.createTray();
      this.setupIPC();
      this.setupGlobalShortcuts();
    });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createWindow();
      }
    });

    app.on('before-quit', () => {
      this.isQuitting = true;
      this.cleanupWindowEvents();
      this.karenBrain.destroy();
    });
  }

  private createWindow(): void {
    // Limpar listeners da janela anterior se existir
    this.cleanupWindowEvents();
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    this.mainWindow = new BrowserWindow({
      width: 450,
      height: 700,
      x: width - 470,
      y: 50,
      alwaysOnTop: true,
      skipTaskbar: false,
      frame: false,
      transparent: true,
      resizable: true,
      minimizable: true,
      maximizable: false,
      closable: true,
      fullscreenable: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
        sandbox: true
      }
    });

    this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

    // Configurar event listeners com cleanup automático
    this.setupWindowEventListeners();
  }

  /**
   * Configura todos os event listeners da janela com cleanup automático
   * Previne memory leaks ao recriar/fechar a janela
   */
  private setupWindowEventListeners(): void {
    const cleanupFunctions: Array<() => void> = [];

    // Helper simples para adicionar listener com cleanup
    const addListener = (
      target: BrowserWindow | Electron.WebContents,
      event: string,
      handler: (...args: any[]) => void
    ) => {
      const listenerTarget = target as unknown as {
        on: (eventName: string, listener: (...args: any[]) => void) => void;
        off: (eventName: string, listener: (...args: any[]) => void) => void;
      };
      listenerTarget.on(event, handler);
      cleanupFunctions.push(() => listenerTarget.off(event, handler));
    };

    const win = this.mainWindow!;
    const wc = win.webContents;

    // DevTools desativado - usar F12 para abrir quando necessário
    // wc.openDevTools();

    // Atalho F12 para abrir/fechar DevTools
    addListener(wc, 'before-input-event', (event: Electron.Event, input: Electron.Input) => {
      if (input.key === 'F12') {
        wc.toggleDevTools();
        event.preventDefault();
      } else if (input.key === 'Escape' && win.isFullScreen()) {
        win.setFullScreen(false);
        event.preventDefault();
      }
    });

    addListener(wc, 'devtools-opened', () => {
      console.log('🛠️ DevTools aberto');
      this.devToolsOpen = true;
    });

    addListener(wc, 'devtools-closed', () => {
      console.log('🛠️ DevTools fechado');
      this.devToolsOpen = false;
    });

    addListener(wc, 'render-process-gone', (_event: Electron.Event, details: Electron.RenderProcessGoneDetails) => {
      console.error('🔥 Render process gone:', details);
      if (this.mainWindow) {
        this.mainWindow.show();
        this.mainWindow.focus();
      }
    });

    addListener(win, 'unresponsive', () => {
      console.warn('⚠️ Janela não respondeu (unresponsive)');
    });

    addListener(win, 'close', (event: Electron.Event) => {
      const devToolsOpen = wc.isDevToolsOpened();
      if (!this.isQuitting && devToolsOpen) {
        console.log('⛔ DevTools aberto, não fechar/ocultar janela.');
        event.preventDefault();
        win.focus();
        return;
      }

      if (!this.isQuitting && !this.voiceActive) {
        event.preventDefault();
        win.hide();
      }

      if (!this.isQuitting && this.voiceActive) {
        console.log('⛔ Tentativa de fechar janela durante gravação de voz. Mantendo aberta.');
        event.preventDefault();
      }
    });

    addListener(win, 'blur', () => {
      console.log('🪟 BrowserWindow perdeu foco - voiceActive:', this.voiceActive);
      if (this.voiceActive) {
        setTimeout(() => {
          if (this.mainWindow && this.voiceActive) {
            console.log('🎙️ Recuperando foco da janela durante voz ativa');
            this.mainWindow.focus();
          }
        }, 100);
      }
    });

    addListener(win, 'focus', () => {
      console.log('🪟 BrowserWindow ganhou foco');
    });

    addListener(win, 'minimize', () => {
      const devToolsOpen = wc.isDevToolsOpened();
      console.log('🪟 BrowserWindow minimizada - devToolsOpen:', devToolsOpen, 'voiceActive:', this.voiceActive);
      if (devToolsOpen) {
        console.log('🛠️ DevTools aberto durante minimização, restaurando janela...');
        setTimeout(() => {
          if (this.mainWindow) {
            this.mainWindow.restore();
            this.mainWindow.focus();
            console.log('🛠️ Janela restaurada após minimização com DevTools aberto');
          }
        }, 100);
        return;
      }

      if (this.voiceActive) {
        console.log('🎙️ Janela minimizada durante voz ativa, restaurando...');
        setTimeout(() => {
          if (this.mainWindow && this.voiceActive) {
            this.mainWindow.restore();
            this.mainWindow.focus();
            console.log('🎙️ Janela restaurada após minimização durante voz ativa');
          }
        }, 100);
      }
    });

    addListener(win, 'hide', () => {
      const devToolsOpen = wc.isDevToolsOpened();
      console.log('🪟 BrowserWindow escondida - devToolsOpen:', devToolsOpen);
      if (devToolsOpen) {
        console.log('🛠️ DevTools aberto, restaurando janela imediatamente');
        win.show();
        win.focus();
      }
    });

    addListener(win, 'restore', () => {
      console.log('🪟 BrowserWindow restaurada');
    });

    addListener(win, 'hide', () => {
      console.log('🪟 BrowserWindow escondida');
    });

    addListener(win, 'show', () => {
      console.log('🪟 BrowserWindow mostrada');
    });

    // Armazenar função de cleanup
    this.windowEventCleanup = () => {
      console.log('🧹 Limpando event listeners da janela...');
      cleanupFunctions.forEach(cleanup => cleanup());
      cleanupFunctions.length = 0;
    };
  }

  /**
   * Limpa todos os event listeners da janela
   */
  private cleanupWindowEvents(): void {
    if (this.windowEventCleanup) {
      this.windowEventCleanup();
      this.windowEventCleanup = null;
    }
  }

  private createTray(): void {
    // Criar ícone padrão (pode ser substituído por um arquivo .ico)
    const icon = nativeImage.createFromNamedImage('TemplateImage', [0, 0, 0, 0]);
    const resizedIcon = icon.resize({ width: 16, height: 16 });
    this.tray = resizedIcon ? new Tray(resizedIcon) : new Tray(icon);
    
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Abrir Assistente', click: () => this.mainWindow?.show() },
      { label: 'Nova Conversa', click: () => this.startNewChat() },
      { type: 'separator' },
      { label: 'Configurações', click: () => this.openSettings() },
      { type: 'separator' },
      { label: 'Sair', click: () => { this.isQuitting = true; app.quit(); } }
    ]);

    this.tray.setToolTip('IA Desktop Assistant');
    this.tray.setContextMenu(contextMenu);
    
    this.tray.on('click', () => {
      const devToolsOpen = this.mainWindow?.webContents.isDevToolsOpened();
      console.log('Tray click detectado - voiceActive:', this.voiceActive, 'window visible:', this.mainWindow?.isVisible(), 'devToolsOpen:', devToolsOpen);
      if (this.voiceActive) {
        console.log('⛔ Tentativa de esconder janela via tray durante gravação de voz. Ignorado.');
        return;
      }
      if (devToolsOpen && this.mainWindow?.isVisible()) {
        console.log('⛔ DevTools aberto, mantendo janela visível para evitar desconexão.');
        return;
      }

      if (this.mainWindow?.isVisible()) {
        console.log('Escondendo janela via tray');
        this.mainWindow.hide();
      } else {
        console.log('Mostrando janela via tray');
        this.mainWindow?.show();
      }
    });
  }

  private setupIPC(): void {
    ipcMain.handle('get-available-models', () => {
      return this.karenBrain.getAvailableModels();
    });

    ipcMain.handle('set-karen-model', (_event, modelName: unknown) => {
      if (typeof modelName !== 'string') {
        return { success: false, error: 'Modelo inválido' };
      }

      const success = this.karenBrain.setModelName(modelName);
      return success
        ? { success: true, model: this.karenBrain.getModelName() }
        : { success: false, error: 'Modelo não permitido' };
    });

    ipcMain.handle('open-external-url', async (_event, rawUrl: unknown) => {
      if (typeof rawUrl !== 'string') {
        return { success: false, error: 'URL inválida' };
      }

      try {
        const url = new URL(rawUrl);
        if (!['http:', 'https:'].includes(url.protocol)) {
          return { success: false, error: 'Apenas URLs HTTP e HTTPS são permitidas' };
        }

        await shell.openExternal(url.toString());
        return { success: true };
      } catch {
        return { success: false, error: 'URL inválida' };
      }
    });

    ipcMain.handle('send-message', async (event, message: string) => {
      try {
        // Input validation
        if (!message || typeof message !== 'string') {
          console.error('❌ Invalid message type or empty message');
          return { success: false, error: 'Mensagem inválida ou vazia' };
        }
        
        // Sanitize message - limit length to prevent DOS
        const sanitizedMessage = message.trim().slice(0, 10000);
        if (sanitizedMessage.length === 0) {
          console.error('❌ Message is empty after sanitization');
          return { success: false, error: 'Mensagem vazia' };
        }
        
        console.log('📨 Mensagem recebida no main:', sanitizedMessage.substring(0, 100));
        const response = await this.karenBrain.sendMessage(sanitizedMessage);
        console.log('📬 Resposta do karenBrain:', typeof response, Array.isArray(response) ? `Array[${response.length}]` : response);
        
        // Validar se a resposta não está vazia ou undefined
        if (!response) {
          console.error('❌ Resposta vazia/undefined do karenBrain');
          return { success: false, error: 'Resposta vazia do modelo' };
        }
        
        // Se resposta é array de blocos, enviar sequencialmente
        if (Array.isArray(response)) {
          console.log('📦 Enviando', response.length, 'blocos');
          
          // Validar se o array não está vazio
          if (response.length === 0) {
            console.error('❌ Array de resposta vazio');
            return { success: false, error: 'Resposta vazia do modelo' };
          }
          
          for (let i = 0; i < response.length; i++) {
            console.log(`📦 Enviando bloco ${i + 1}/${response.length}:`, response[i]?.substring(0, 50) || '(vazio)');
            event.sender.send('karen-message-block', {
              block: response[i],
              index: i,
              total: response.length,
              isLast: i === response.length - 1
            });
            
            // Delay entre blocos para simular digitação humana (500-1500ms)
            if (i < response.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
            }
          }
          console.log('✅ Todos os blocos enviados');
          return { success: true, response: response.join('\n\n'), isFragmented: true };
        }
        
        // Validar se a resposta string não está vazia
        if (typeof response === 'string' && response.trim().length === 0) {
          console.error('❌ Resposta string vazia do karenBrain');
          return { success: false, error: 'Resposta vazia do modelo' };
        }
        
        console.log('📄 Resposta não fragmentada:', response.substring(0, 100));
        return { success: true, response, isFragmented: false };
      } catch (error) {
        console.error('❌ Erro no handler send-message:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('get-karen-status', () => {
      return this.karenBrain.getStatus();
    });

    ipcMain.handle('toggle-fullscreen', (event) => {
      if (!this.mainWindow || this.mainWindow.isDestroyed()) {
        return false;
      }

      const nextState = !this.mainWindow.isFullScreen();
      this.mainWindow.setFullScreen(nextState);
      event.sender.send('fullscreen-state-changed', nextState);
      return nextState;
    });


    // Handlers de voz removidos - funções não implementadas

    // Spotify Authentication
    ipcMain.handle('spotify-generate-auth-url', () => {
      return this.spotifyManager.generateAuthUrl();
    });

    ipcMain.handle('spotify-receive-auth-code', async (event, code: string) => {
      try {
        const success = await this.spotifyManager.receiveAuthorizationCode(code);
        return { success };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('spotify-check-auth', () => {
      return this.spotifyManager.checkAuth();
    });

    // Verificar status do WhatsApp
    ipcMain.handle('get-whatsapp-status', async () => {
      return await this.systemAutomation.whatsapp.getStatus();
    });

    // Solicitar permissão ao usuário
    ipcMain.handle('request-permission', async (event, action: string, details: any) => {
      return await this.permissionManager.requestPermission(action, details, this.mainWindow!);
    });


    // Obter screenshot
    ipcMain.handle('get-screenshot', async () => {
      return await this.systemAutomation.screen.captureScreen();
    });

    // Minimizar janela
    ipcMain.on('minimize-window', () => {
      this.mainWindow?.minimize();
    });

    // Fechar para bandeja
    ipcMain.on('hide-window', () => {
      const devToolsOpen = this.mainWindow?.webContents.isDevToolsOpened();
      console.log('IPC hide-window chamado - voiceActive:', this.voiceActive, 'devToolsOpen:', devToolsOpen);
      if (this.voiceActive) {
        console.log('⛔ Tentativa de esconder janela durante gravação de voz. Ignorado.');
        return;
      }
      if (devToolsOpen) {
        console.log('⛔ DevTools aberto, não ocultar janela para evitar desconexão.');
        return;
      }
      console.log('Executando hide() da janela');
      this.mainWindow?.hide();
    });

    // Mostrar janela
    ipcMain.on('show-window', () => {
      console.log('IPC show-window chamado');
      if (this.mainWindow?.isMinimized()) {
        this.mainWindow.restore();
        console.log('🛠️ Restaurando janela minimizada antes de mostrar');
      }
      this.mainWindow?.show();
      this.mainWindow?.focus();
    });

    // Atualizar estado de voz ativo
    ipcMain.handle('set-voice-active', async (event, active: boolean) => {
      console.log(`🎙️ set-voice-active chamado com active=${active}, voiceActive atual=${this.voiceActive}`);
      this.voiceActive = active;
      console.log(`🎙️ Estado de voz atualizado: ${active ? 'ativo' : 'inativo'}`);

      // Controlar atalho global durante gravação de voz
      if (active && this.globalShortcutEnabled) {
        globalShortcut.unregister('CommandOrControl+Shift+K');
        this.globalShortcutEnabled = false;
        console.log('⌨️ Atalho global desabilitado durante gravação de voz');
      } else if (!active && !this.globalShortcutEnabled) {
        const registered = globalShortcut.register('CommandOrControl+Shift+K', () => {
          if (this.mainWindow) {
            const devToolsOpen = this.mainWindow.webContents.isDevToolsOpened();
            if (this.mainWindow.isVisible() && devToolsOpen) {
              console.log('⛔ Atalho global de ocultar janela ignorado porque DevTools está aberto.');
            } else if (this.mainWindow.isVisible()) {
              this.mainWindow.hide();
              console.log('⌨️ Janela ocultada via atalho');
            } else {
              this.mainWindow.show();
              this.mainWindow.focus();
              console.log('⌨️ Janela exibida via atalho');
            }
          }
        });
        if (registered) {
          this.globalShortcutEnabled = true;
          console.log('⌨️ Atalho global reabilitado após gravação de voz');
        }
      }

      // Garantir que a janela não seja escondida/minimizada durante voz ativa
      if (active && this.mainWindow) {
        if (!this.mainWindow.isVisible() || this.mainWindow.isMinimized()) {
          console.log('🎙️ Restaurando janela porque voz está ativa');
          if (this.mainWindow.isMinimized()) {
            this.mainWindow.restore();
          }
          this.mainWindow.show();
          this.mainWindow.focus();
        }
      }

      // Quando voz é desativada, garantir que a janela esteja visível e focada
      if (!active && this.mainWindow) {
        console.log('🎙️ Voz desativada, garantindo que janela esteja visível');
        if (this.mainWindow.isMinimized()) {
          console.log('🎙️ Janela está minimizada, restaurando...');
          this.mainWindow.restore();
        }
        if (!this.mainWindow.isVisible()) {
          console.log('🎙️ Janela não está visível, mostrando...');
          this.mainWindow.show();
        }
        if (!this.mainWindow.isFocused()) {
          console.log('🎙️ Janela não está focada, focando...');
          this.mainWindow.focus();
        }
      }

      return true;
    });

    // Toggle always on top
    ipcMain.on('toggle-always-on-top', () => {
      const isAlwaysOnTop = this.mainWindow?.isAlwaysOnTop();
      this.mainWindow?.setAlwaysOnTop(!isAlwaysOnTop);
    });

    // ============ HISTÓRICO DE CONVERSAS ============
    
    // Salvar mensagem no histórico
    ipcMain.on('save-message-to-history', (event, role: string, content: string) => {
      conversationHistory.addMessage(role as 'user' | 'assistant', content);
    });

    // Obter estatísticas do histórico
    ipcMain.handle('get-history-stats', () => {
      return conversationHistory.getStats();
    });

    // Buscar no histórico
    ipcMain.handle('search-history', (event, query: string) => {
      return conversationHistory.searchMessages(query);
    });

    // Exportar histórico para Markdown
    ipcMain.handle('export-history-markdown', () => {
      return conversationHistory.exportToMarkdown();
    });

    // Limpar histórico
    ipcMain.handle('clear-history', () => {
      conversationHistory.clearCurrentSession();
      return true;
    });

    // ============ SISTEMA DE LEMBRETES ============
    
    // Criar lembrete
    ipcMain.handle('create-reminder', (event, title: string, timeMs: number, description?: string, repeat?: 'daily' | 'weekly' | 'once') => {
      const reminder = reminderController.createReminder(title, timeMs, description, repeat);
      return reminder;
    });

    // Criar lembrete diário
    ipcMain.handle('create-daily-reminder', (event, title: string, hour: number, minute: number, description?: string) => {
      const reminder = reminderController.createDailyReminder(title, hour, minute, description);
      return reminder;
    });

    // Remover lembrete
    ipcMain.handle('remove-reminder', (event, id: string) => {
      return reminderController.removeReminder(id);
    });

    // Listar lembretes
    ipcMain.handle('get-reminders', () => {
      return reminderController.getAllReminders();
    });

    // Obter próximos lembretes
    ipcMain.handle('get-upcoming-reminders', (event, limit?: number) => {
      return reminderController.getUpcomingReminders(limit);
    });

    // Limpar todos os lembretes
    ipcMain.handle('clear-all-reminders', () => {
      reminderController.clearAllReminders();
      return true;
    });

    // Parse de comando de lembrete
    ipcMain.handle('parse-reminder-command', (event, text: string) => {
      return reminderController.parseReminderCommand(text);
    });

    // ============ MODO GAMER ============
    
    // Ativar modo gamer
    ipcMain.handle('activate-game-mode', async (event, gameName: string, keepApps?: string[]) => {
      const result = await gameModeController.activate(gameName, keepApps);
      return result;
    });

    // Desativar modo gamer
    ipcMain.handle('deactivate-game-mode', () => {
      gameModeController.deactivate();
      return true;
    });

    // Verificar status do modo gamer
    ipcMain.handle('get-game-mode-status', () => {
      return {
        active: gameModeController.isGameModeActive(),
        currentGame: gameModeController.getCurrentGame()
      };
    });

    // Fechar aplicativos específicos
    ipcMain.handle('close-apps-by-name', async (event, appNames: string[]) => {
      const closed = await gameModeController.closeAppsByName(appNames);
      return closed;
    });

    // Listar apps pesados em execução
    ipcMain.handle('get-running-heavy-apps', async () => {
      const apps = await gameModeController.getRunningHeavyApps();
      return apps;
    });

    // Parse de comando modo gamer
    ipcMain.handle('parse-game-mode-command', (event, text: string) => {
      return gameModeController.parseGameModeCommand(text);
    });
  }

  private setupGlobalShortcuts(): void {
    // Atalho global Ctrl+Shift+K para abrir/fechar o assistente
    try {
      const shortcut = 'CommandOrControl+Shift+K';
      const registered = globalShortcut.register(shortcut, () => {
        if (this.mainWindow) {
          const devToolsOpen = this.mainWindow.webContents.isDevToolsOpened();
          if (this.mainWindow.isVisible() && devToolsOpen) {
            console.log('⛔ Atalho global de ocultar janela ignorado porque DevTools está aberto.');
          } else if (this.mainWindow.isVisible()) {
            this.mainWindow.hide();
            console.log('⌨️ Janela ocultada via atalho');
          } else {
            this.mainWindow.show();
            this.mainWindow.focus();
            console.log('⌨️ Janela exibida via atalho');
          }
        }
      });

      if (registered) {
        console.log(`✅ Atalho global registrado: ${shortcut}`);
      } else {
        console.warn(`❌ Falha ao registrar atalho global: ${shortcut}`);
      }
    } catch (error) {
      console.error('❌ Erro ao configurar atalhos globais:', error);
    }
  }

  private startNewChat(): void {
    this.karenBrain.resetConversation();
    this.mainWindow?.webContents.send('new-chat');
  }

  private openSettings(): void {
    // Criar janela de configurações
  }
}

new IADesktopAssistant();


