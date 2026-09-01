import { BrowserWindow, dialog, ipcMain } from 'electron';
import * as path from 'path';

export interface PermissionRequest {
  action: string;
  details: any;
  timestamp: number;
  id: string;
}

export interface PermissionResponse {
  granted: boolean;
  expiresAt?: number;
  rememberChoice?: boolean;
}

export class PermissionManager {
  private pendingRequests: Map<string, (response: PermissionResponse) => void> = new Map();
  private rememberedChoices: Map<string, boolean> = new Map();

  // Ações que sempre requerem permissão (críticas)
  private criticalActions: string[] = [
    'file_delete',
    'file_delete_directory',
    'whatsapp_send',
    'whatsapp_broadcast'
  ];

  // Ações que podem ser permitidas automaticamente
  private autoAllowActions: string[] = [
    'mouse_get_position',
    'screen_get_resolution',
    'audio_get_volume',
    'process_list',
    'file_edit_code',
    'process_is_running',
    'file_exists',
    'file_list_directory',
    'screen_capture',
    'screen_capture_window',
    // Permitir fechar aplicativos sem confirmação
    'process_kill',
    'process_kill_by_name'
  ];

  constructor() {
    this.setupIPC();
  }

  /**
   * Verifica se uma ação requer permissão
   */
  requiresPermission(action: string): boolean {
    return this.criticalActions.includes(action);
  }

  /**
   * Verifica se ação é permitida automaticamente
   */
  isAutoAllowed(action: string): boolean {
    return this.autoAllowActions.includes(action);
  }

  /**
   * Solicita permissão ao usuário
   */
  async requestPermission(
    action: string, 
    details: any, 
    parentWindow: BrowserWindow
  ): Promise<boolean> {
    // Verificar se já existe escolha lembrada
    const cacheKey = this.getCacheKey(action, details);
    if (this.rememberedChoices.has(cacheKey)) {
      return this.rememberedChoices.get(cacheKey)!;
    }

    // Permitir automaticamente ações seguras
    if (this.isAutoAllowed(action)) {
      return true;
    }

    // Criar janela de permissão
    return new Promise((resolve) => {
      const requestId = this.generateRequestId();
      
      // Criar janela modal com segurança adequada
      const permissionWindow = new BrowserWindow({
        parent: parentWindow,
        modal: true,
        width: 500,
        height: 400,
        resizable: false,
        minimizable: false,
        maximizable: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          preload: path.join(__dirname, '../main/preload.js')
        },
        show: false
      });

      // HTML da janela de permissão
      const htmlContent = this.createPermissionHTML(action, details, requestId);
      
      permissionWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

      permissionWindow.once('ready-to-show', () => {
        permissionWindow.show();
      });

      // Configurar handler para resposta
      this.pendingRequests.set(requestId, (response: PermissionResponse) => {
        permissionWindow.close();
        
        if (response.rememberChoice) {
          this.rememberedChoices.set(cacheKey, response.granted);
        }
        
        resolve(response.granted);
      });

      // Timeout de segurança (60 segundos)
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          permissionWindow.close();
          this.pendingRequests.delete(requestId);
          resolve(false);
        }
      }, 60000);
    });
  }

  /**
   * Gera HTML da janela de permissão
   */
  private createPermissionHTML(action: string, details: any, requestId: string): string {
    const actionDescriptions: Record<string, string> = {
      'file_delete': 'Deletar arquivo',
      'file_delete_directory': 'Deletar pasta',
      'file_edit_code': 'Editar arquivo de código',
      'process_kill': 'Encerrar processo',
      'process_kill_by_name': 'Encerrar programa',
      'mouse_move': 'Mover mouse',
      'mouse_click': 'Clicar com mouse',
      'keyboard_type': 'Digitar texto',
      'audio_set_volume': 'Alterar volume',
      'screen_set_resolution': 'Alterar resolução',
      'whatsapp_send': 'Enviar mensagem WhatsApp',
      'whatsapp_broadcast': 'Enviar mensagem em massa',
      'file_write': 'Escrever em arquivo',
      'file_copy': 'Copiar arquivo',
      'file_rename': 'Renomear arquivo',
      'process_start': 'Iniciar programa',
      'system_execute_powershell': 'Executar comando PowerShell',
      'system_execute_cmd': 'Executar comando CMD'
    };

    const description = actionDescriptions[action] || action;
    const detailsJson = JSON.stringify(details, null, 2);
    const isCritical = this.criticalActions.includes(action);

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Solicitação de Permissão</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          .container {
            background: white;
            border-radius: 16px;
            padding: 30px;
            max-width: 450px;
            width: 100%;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          }
          .icon {
            width: 60px;
            height: 60px;
            background: ${isCritical ? '#ef4444' : '#f59e0b'};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 20px;
            font-size: 28px;
          }
          h2 {
            text-align: center;
            color: #1f2937;
            margin-bottom: 10px;
            font-size: 20px;
          }
          .warning {
            text-align: center;
            color: ${isCritical ? '#ef4444' : '#f59e0b'};
            font-weight: 600;
            margin-bottom: 20px;
            font-size: 14px;
          }
          .details {
            background: #f3f4f6;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 20px;
            font-family: monospace;
            font-size: 12px;
            max-height: 150px;
            overflow-y: auto;
            white-space: pre-wrap;
            word-break: break-all;
          }
          .checkbox-container {
            display: flex;
            align-items: center;
            margin-bottom: 20px;
            gap: 8px;
          }
          .checkbox-container input[type="checkbox"] {
            width: 18px;
            height: 18px;
            cursor: pointer;
          }
          .checkbox-container label {
            color: #4b5563;
            font-size: 14px;
            cursor: pointer;
          }
          .buttons {
            display: flex;
            gap: 12px;
          }
          button {
            flex: 1;
            padding: 12px 20px;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          }
          .btn-allow {
            background: #10b981;
            color: white;
          }
          .btn-allow:hover {
            background: #059669;
          }
          .btn-deny {
            background: #ef4444;
            color: white;
          }
          .btn-deny:hover {
            background: #dc2626;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">${isCritical ? '⚠️' : '🔒'}</div>
          <h2>${description}</h2>
          <div class="warning">${isCritical ? '⚠️ AÇÃO CRÍTICA - Requer sua aprovação' : '🔒 Ação que requer permissão'}</div>
          <div class="details">${detailsJson}</div>
          <div class="checkbox-container">
            <input type="checkbox" id="remember" />
            <label for="remember">Lembrar minha escolha para ações similares</label>
          </div>
          <div class="buttons">
            <button class="btn-deny" onclick="respond(false)">Negar</button>
            <button class="btn-allow" onclick="respond(true)">Permitir</button>
          </div>
        </div>
        
        <script>
          const { ipcRenderer } = require('electron');
          
          function respond(granted) {
            const remember = document.getElementById('remember').checked;
            ipcRenderer.send('permission-response', {
              requestId: '${requestId}',
              granted,
              rememberChoice: remember
            });
          }
        </script>
      </body>
      </html>
    `;
  }

  /**
   * Configura handlers IPC
   */
  private setupIPC(): void {
    ipcMain.on('permission-response', (event, data: {
      requestId: string;
      granted: boolean;
      rememberChoice: boolean;
    }) => {
      const resolver = this.pendingRequests.get(data.requestId);
      if (resolver) {
        resolver({
          granted: data.granted,
          rememberChoice: data.rememberChoice
        });
        this.pendingRequests.delete(data.requestId);
      }
    });
  }

  /**
   * Gera chave de cache para lembrar escolhas
   */
  private getCacheKey(action: string, details: any): string {
    // Simplificar detalhes para chave
    const simplified = typeof details === 'object' 
      ? JSON.stringify(details).substring(0, 100)
      : String(details);
    return `${action}:${simplified}`;
  }

  /**
   * Gera ID único para request
   */
  private generateRequestId(): string {
    return `perm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Limpa escolhas lembradas
   */
  clearRememberedChoices(): void {
    this.rememberedChoices.clear();
  }

  /**
   * Adiciona ação à lista de críticas
   */
  addCriticalAction(action: string): void {
    if (!this.criticalActions.includes(action)) {
      this.criticalActions.push(action);
    }
  }

  /**
   * Remove ação da lista de críticas
   */
  removeCriticalAction(action: string): void {
    this.criticalActions = this.criticalActions.filter(a => a !== action);
  }
}
