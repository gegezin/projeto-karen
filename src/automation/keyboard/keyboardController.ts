import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface KeyCombination {
  keys: string[];
}

export class KeyboardController {
  private keyMap: Record<string, number> = {
    'backspace': 0x08,
    'tab': 0x09,
    'enter': 0x0D,
    'shift': 0x10,
    'ctrl': 0x11,
    'alt': 0x12,
    'pause': 0x13,
    'capslock': 0x14,
    'esc': 0x1B,
    'space': 0x20,
    'pageup': 0x21,
    'pagedown': 0x22,
    'end': 0x23,
    'home': 0x24,
    'left': 0x25,
    'up': 0x26,
    'right': 0x27,
    'down': 0x28,
    'insert': 0x2D,
    'delete': 0x2E,
    '0': 0x30, '1': 0x31, '2': 0x32, '3': 0x33, '4': 0x34,
    '5': 0x35, '6': 0x36, '7': 0x37, '8': 0x38, '9': 0x39,
    'a': 0x41, 'b': 0x42, 'c': 0x43, 'd': 0x44, 'e': 0x45,
    'f': 0x46, 'g': 0x47, 'h': 0x48, 'i': 0x49, 'j': 0x4A,
    'k': 0x4B, 'l': 0x4C, 'm': 0x4D, 'n': 0x4E, 'o': 0x4F,
    'p': 0x50, 'q': 0x51, 'r': 0x52, 's': 0x53, 't': 0x54,
    'u': 0x55, 'v': 0x56, 'w': 0x57, 'x': 0x58, 'y': 0x59,
    'z': 0x5A,
    'f1': 0x70, 'f2': 0x71, 'f3': 0x72, 'f4': 0x73, 'f5': 0x74,
    'f6': 0x75, 'f7': 0x76, 'f8': 0x77, 'f9': 0x78, 'f10': 0x79,
    'f11': 0x7A, 'f12': 0x7B,
  };

  /**
   * Digita um texto
   */
  async typeText(text: string): Promise<void> {
    try {
      // Escapar caracteres especiais para PowerShell
      const escapedText = text
        .replace(/`/g, '``')
        .replace(/"/g, '`"')
        .replace(/\$/g, '`$');

      const psScript = `
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.SendKeys]::SendWait("${escapedText}")
      `;
      
      await execAsync(`powershell.exe -Command "${psScript}"`);
    } catch (error) {
      console.error('Erro ao digitar texto:', error);
      throw error;
    }
  }

  /**
   * Pressiona uma tecla ou combinação
   */
  async pressKey(...keys: string[]): Promise<void> {
    try {
      const keyString = keys.map(k => {
        const lowerKey = k.toLowerCase();
        if (lowerKey === 'ctrl') return '^';
        if (lowerKey === 'alt') return '%';
        if (lowerKey === 'shift') return '+';
        if (lowerKey === 'win') return '#';
        return `{${lowerKey}}`;
      }).join('');

      const escapedKeyString = keyString
        .replace(/`/g, '``')
        .replace(/"/g, '`"')
        .replace(/\$/g, '`$');

      const psScript = `
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.SendKeys]::SendWait("${escapedKeyString}")
      `;
      
      await execAsync(`powershell.exe -Command "${psScript}"`);
    } catch (error) {
      console.error('Erro ao pressionar tecla:', error);
      throw error;
    }
  }

  /**
   * Pressiona e segura uma tecla
   */
  async keyDown(key: string): Promise<void> {
    try {
      const psScript = `
        $signature = @'
        [DllImport("user32.dll", SetLastError = true)]
        static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
'@
        $kbd = Add-Type -MemberDefinition $signature -Name "KeybdEvent" -PassThru
        $kbd::keybd_event(${this.getKeyCode(key)}, 0, 0, 0)
      `;
      
      await execAsync(`powershell.exe -Command "${psScript}"`);
    } catch (error) {
      console.error('Erro ao pressionar tecla:', error);
      throw error;
    }
  }

  /**
   * Solta uma tecla
   */
  async keyUp(key: string): Promise<void> {
    try {
      const psScript = `
        $signature = @'
        [DllImport("user32.dll", SetLastError = true)]
        static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
'@
        $kbd = Add-Type -MemberDefinition $signature -Name "KeybdEvent" -PassThru
        $kbd::keybd_event(${this.getKeyCode(key)}, 0, 0x00000002, 0)
      `;
      
      await execAsync(`powershell.exe -Command "${psScript}"`);
    } catch (error) {
      console.error('Erro ao soltar tecla:', error);
      throw error;
    }
  }

  /**
   * Atalhos comuns
   */
  async copy(): Promise<void> {
    await this.pressKey('ctrl', 'c');
  }

  async paste(): Promise<void> {
    await this.pressKey('ctrl', 'v');
  }

  async cut(): Promise<void> {
    await this.pressKey('ctrl', 'x');
  }

  async selectAll(): Promise<void> {
    await this.pressKey('ctrl', 'a');
  }

  async undo(): Promise<void> {
    await this.pressKey('ctrl', 'z');
  }

  async redo(): Promise<void> {
    await this.pressKey('ctrl', 'y');
  }

  async save(): Promise<void> {
    await this.pressKey('ctrl', 's');
  }

  async closeWindow(): Promise<void> {
    await this.pressKey('alt', 'f4');
  }

  async switchWindow(): Promise<void> {
    await this.pressKey('alt', 'tab');
  }

  async openTaskManager(): Promise<void> {
    await this.pressKey('ctrl', 'shift', 'esc');
  }

  async screenshot(): Promise<void> {
    await this.pressKey('win', 'shift', 's');
  }

  /**
   * Obter código da tecla
   */
  private getKeyCode(key: string): number {
    const lowerKey = key.toLowerCase();
    return this.keyMap[lowerKey] || lowerKey.charCodeAt(0);
  }

  /**
   * Pressionar sequência de teclas rapidamente
   */
  async hotkey(keys: string[]): Promise<void> {
    await this.pressKey(...keys);
  }
}
