import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface MousePosition {
  x: number;
  y: number;
}

export class MouseController {
  /**
   * Move o mouse para uma posição específica
   */
  async moveTo(x: number, y: number): Promise<void> {
    try {
      // Usar PowerShell para mover o mouse (Windows)
      const psScript = `
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x}, ${y})
      `;
      await execAsync(`powershell.exe -Command "${psScript}"`);
    } catch (error) {
      console.error('Erro ao mover mouse:', error);
      throw error;
    }
  }

  /**
   * Clica em uma posição específica
   */
  async click(x?: number, y?: number, button: 'left' | 'right' | 'middle' = 'left'): Promise<void> {
    try {
      if (x !== undefined && y !== undefined) {
        await this.moveTo(x, y);
      }

      const buttonMap = {
        left: 'Left',
        right: 'Right',
        middle: 'Middle'
      };

      const psScript = `
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.MouseButtons]::${buttonMap[button]}
        # Simular clique
        $signature = @'
        [DllImport("user32.dll",CharSet=CharSet.Auto, CallingConvention=CallingConvention.StdCall)]
        public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, int dwExtraInfo);
'@
        $SendMouseClick = Add-Type -MemberDefinition $signature -Name "Win32MouseClick" -PassThru
        $SendMouseClick::mouse_event(0x00000002, 0, 0, 0, 0)
        $SendMouseClick::mouse_event(0x00000004, 0, 0, 0, 0)
      `;
      
      await execAsync(`powershell.exe -Command "${psScript}"`);
    } catch (error) {
      console.error('Erro ao clicar:', error);
      throw error;
    }
  }

  /**
   * Duplo clique
   */
  async doubleClick(x?: number, y?: number): Promise<void> {
    await this.click(x, y);
    await new Promise(resolve => setTimeout(resolve, 100));
    await this.click();
  }

  /**
   * Clique com botão direito
   */
  async rightClick(x?: number, y?: number): Promise<void> {
    await this.click(x, y, 'right');
  }

  /**
   * Arrastar (drag and drop)
   */
  async drag(fromX: number, fromY: number, toX: number, toY: number): Promise<void> {
    try {
      const psScript = `
        Add-Type -AssemblyName System.Windows.Forms
        
        # Mover para posição inicial e pressionar
        [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${fromX}, ${fromY})
        
        Start-Sleep -Milliseconds 100
        
        $signature = @'
        [DllImport("user32.dll",CharSet=CharSet.Auto, CallingConvention=CallingConvention.StdCall)]
        public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, int dwExtraInfo);
'@
        $mouse_event = Add-Type -MemberDefinition $signature -Name "Win32MouseEvent" -PassThru
        
        # Botão esquerdo down
        $mouse_event::mouse_event(0x00000002, 0, 0, 0, 0)
        
        Start-Sleep -Milliseconds 100
        
        # Mover para posição final
        [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${toX}, ${toY})
        
        Start-Sleep -Milliseconds 100
        
        # Botão esquerdo up
        $mouse_event::mouse_event(0x00000004, 0, 0, 0, 0)
      `;
      
      await execAsync(`powershell.exe -Command "${psScript}"`);
    } catch (error) {
      console.error('Erro ao arrastar:', error);
      throw error;
    }
  }

  /**
   * Scroll
   */
  async scroll(amount: number, direction: 'up' | 'down' = 'down'): Promise<void> {
    try {
      const scrollAmount = direction === 'down' ? -amount : amount;
      
      const psScript = `
        $signature = @'
        [DllImport("user32.dll",CharSet=CharSet.Auto, CallingConvention=CallingConvention.StdCall)]
        public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, int dwExtraInfo);
'@
        $mouse_event = Add-Type -MemberDefinition $signature -Name "Win32MouseScroll" -PassThru
        $mouse_event::mouse_event(0x00000800, 0, 0, ${scrollAmount}, 0)
      `;
      
      await execAsync(`powershell.exe -Command "${psScript}"`);
    } catch (error) {
      console.error('Erro ao scrollar:', error);
      throw error;
    }
  }

  /**
   * Obter posição atual do mouse
   */
  async getPosition(): Promise<MousePosition> {
    try {
      const psScript = `
        Add-Type -AssemblyName System.Windows.Forms
        $pos = [System.Windows.Forms.Cursor]::Position
        Write-Output "$($pos.X),$($pos.Y)"
      `;
      
      const { stdout } = await execAsync(`powershell.exe -Command "${psScript}"`);
      const [x, y] = stdout.trim().split(',').map(Number);
      return { x, y };
    } catch (error) {
      console.error('Erro ao obter posição:', error);
      return { x: 0, y: 0 };
    }
  }

  /**
   * Configurar DPI do mouse (Windows)
   */
  async setMouseDPI(dpi: number): Promise<void> {
    try {
      // Nota: Alterar DPI real do mouse requer drivers específicos do fabricante
      // Aqui configuramos a sensibilidade do Windows
      const sensitivity = Math.min(20, Math.max(1, Math.round(dpi / 800)));
      
      const psScript = `
        $path = 'HKCU:\\Control Panel\\Mouse'
        Set-ItemProperty -Path $path -Name MouseSpeed -Value "${sensitivity}"
      `;
      
      await execAsync(`powershell.exe -Command "${psScript}"`);
    } catch (error) {
      console.error('Erro ao configurar DPI:', error);
      throw error;
    }
  }
}
