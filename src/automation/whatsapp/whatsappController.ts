import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface WhatsAppStatus {
  connected: boolean;
  qrCode?: string;
  error?: string;
}

export interface WhatsAppMessage {
  to: string;
  message: string;
}

export class WhatsAppController {
  private isConnected = false;
  private browserProcess: any = null;

  /**
   * Obtém status da conexão WhatsApp
   */
  async getStatus(): Promise<WhatsAppStatus> {
    return {
      connected: this.isConnected
    };
  }

  /**
   * Inicia WhatsApp Web
   */
  async startWhatsApp(): Promise<void> {
    try {
      // Abrir WhatsApp Web no navegador padrão
      await execAsync('start "" "https://web.whatsapp.com"');
      
      // Aguardar alguns segundos
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      this.isConnected = true;
    } catch (error) {
      console.error('Erro ao iniciar WhatsApp:', error);
      throw error;
    }
  }

  /**
   * Abre chat com contato específico
   */
  async openChat(phoneNumber: string): Promise<void> {
    try {
      // Formatar número (remover não-numéricos)
      const cleanNumber = phoneNumber.replace(/\D/g, '');
      
      // Criar URL do WhatsApp com número
      const waUrl = `https://wa.me/${cleanNumber}`;
      
      await execAsync(`start "" "${waUrl}"`);
      
      // Aguardar carregamento
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (error) {
      console.error('Erro ao abrir chat:', error);
      throw error;
    }
  }

  /**
   * Envia mensagem via WhatsApp Web
   * Nota: Isso requer automação da UI pois não há API oficial
   */
  async sendMessage(contact: string, message: string): Promise<boolean> {
    try {
      // Abrir chat
      await this.openChat(contact);
      
      // Aguardar interface carregar
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Usar PowerShell para automação da UI
      const escapedMessage = message
        .replace(/`/g, '``')
        .replace(/"/g, '`"');

      const psScript = `
        Add-Type -AssemblyName System.Windows.Forms
        
        # Aguardar janela carregar
        Start-Sleep -Milliseconds 2000
        
        # Clicar na caixa de texto (aproximação)
        # Posição típica da caixa de mensagem no WhatsApp Web
        [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(800, 900)
        
        Start-Sleep -Milliseconds 500
        
        # Clicar
        $signature = @'
        [DllImport("user32.dll",CharSet=CharSet.Auto, CallingConvention=CallingConvention.StdCall)]
        public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, int dwExtraInfo);
'@
        $mouse_event = Add-Type -MemberDefinition $signature -Name "Win32MouseEvent" -PassThru
        $mouse_event::mouse_event(0x00000002, 0, 0, 0, 0)
        $mouse_event::mouse_event(0x00000004, 0, 0, 0, 0)
        
        Start-Sleep -Milliseconds 500
        
        # Digitar mensagem
        [System.Windows.Forms.SendKeys]::SendWait("${escapedMessage}")
        
        Start-Sleep -Milliseconds 500
        
        # Pressionar Enter
        [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
      `;
      
      await execAsync(`powershell.exe -Command "${psScript}"`);
      
      return true;
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      return false;
    }
  }

  /**
   * Envia mensagem para múltiplos contatos
   */
  async sendBroadcastMessage(contacts: string[], message: string): Promise<{ [contact: string]: boolean }> {
    const results: { [contact: string]: boolean } = {};
    
    for (const contact of contacts) {
      results[contact] = await this.sendMessage(contact, message);
      // Aguardar entre mensagens para não ser bloqueado
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    return results;
  }

  /**
   * Verifica se WhatsApp Web está aberto
   */
  async isWhatsAppRunning(): Promise<boolean> {
    try {
      const psScript = `
        $process = Get-Process | Where-Object {$_.MainWindowTitle -like "*WhatsApp*"} | Select-Object -First 1
        if ($process) { Write-Output "RUNNING" } else { Write-Output "NOT_RUNNING" }
      `;
      
      const { stdout } = await execAsync(`powershell.exe -Command "${psScript}"`);
      return stdout.trim() === 'RUNNING';
    } catch (error) {
      return false;
    }
  }

  /**
   * Fecha WhatsApp Web
   */
  async closeWhatsApp(): Promise<void> {
    try {
      const psScript = `
        Get-Process | Where-Object {$_.MainWindowTitle -like "*WhatsApp*"} | Stop-Process -Force
      `;
      
      await execAsync(`powershell.exe -Command "${psScript}"`);
      this.isConnected = false;
    } catch (error) {
      console.error('Erro ao fechar WhatsApp:', error);
    }
  }

  /**
   * Alternativa: Usar WhatsApp Desktop App
   */
  async openWhatsAppDesktop(): Promise<void> {
    try {
      // Tentar abrir WhatsApp Desktop
      await execAsync('start "" "whatsapp:"');
    } catch (error) {
      // Fallback para web
      await this.startWhatsApp();
    }
  }
}
