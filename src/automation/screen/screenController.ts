import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { screen } from 'electron';

const screenshotDesktop: any = require('screenshot-desktop');
const execAsync = promisify(exec);

export interface ScreenResolution {
  width: number;
  height: number;
}

export class ScreenController {
  private tempDir: string;

  constructor() {
    this.tempDir = os.tmpdir();
  }

  private async runPowerShell(script: string): Promise<{ stdout: string; stderr: string }> {
    const scriptPath = path.join(this.tempDir, `script_${Date.now()}.ps1`);
    await fs.promises.writeFile(scriptPath, script, 'utf8');

    try {
      const result = await execAsync(`powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`);
      return result;
    } finally {
      await fs.promises.unlink(scriptPath).catch(() => {});
    }
  }

  /**
   * Captura screenshot da tela inteira
   */
  async captureScreen(): Promise<string> {
    try {
      console.log('📸 Capturando screenshot com screenshot-desktop...');
      const imageBuffer = await screenshotDesktop({ format: 'png' });
      if (!imageBuffer || imageBuffer.length === 0) {
        throw new Error('Screenshot retornou buffer vazio');
      }

      console.log('📸 Screenshot capturado com sucesso');
      return `data:image/png;base64,${imageBuffer.toString('base64')}`;
    } catch (error) {
      console.warn('⚠️ screenshot-desktop falhou, usando fallback PowerShell:', error);
      return this.captureScreenWithPowerShell();
    }
  }

  private async captureScreenWithPowerShell(): Promise<string> {
    const screenshotPath = path.join(this.tempDir, `screenshot_${Date.now()}.png`);
    await fs.promises.mkdir(this.tempDir, { recursive: true }).catch(() => {});

    const psScript = `
      Add-Type -AssemblyName System.Windows.Forms
      Add-Type -AssemblyName System.Drawing

      $screen = [System.Windows.Forms.Screen]::PrimaryScreen
      $width = $screen.Bounds.Width
      $height = $screen.Bounds.Height
      $left = $screen.Bounds.Left
      $top = $screen.Bounds.Top

      $bitmap = New-Object System.Drawing.Bitmap $width, $height
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      $graphics.CopyFromScreen($left, $top, 0, 0, $bitmap.Size)
      $bitmap.Save('${screenshotPath}', [System.Drawing.Imaging.ImageFormat]::Png)
      $graphics.Dispose()
      $bitmap.Dispose()

      if (Test-Path '${screenshotPath}') { Write-Output 'SUCCESS' } else { Write-Error 'FILE_NOT_CREATED' }
    `;

    await this.runPowerShell(psScript);
    if (!fs.existsSync(screenshotPath)) {
      throw new Error(`Arquivo de screenshot não foi criado: ${screenshotPath}`);
    }

    const imageBuffer = await fs.promises.readFile(screenshotPath);
    const base64 = imageBuffer.toString('base64');
    await fs.promises.unlink(screenshotPath).catch(() => {});
    return `data:image/png;base64,${base64}`;
  }

  /**
   * Captura screenshot de uma área específica
   */
  async captureArea(x: number, y: number, width: number, height: number): Promise<string> {
    try {
      const screenshotPath = path.join(this.tempDir, `screenshot_area_${Date.now()}.png`);
      
      const psScript = `
        Add-Type -AssemblyName System.Windows.Forms
        Add-Type -AssemblyName System.Drawing

        $bounds = New-Object System.Drawing.Rectangle(${x}, ${y}, ${width}, ${height})
        $bitmap = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
        $bitmap.Save('${screenshotPath}', [System.Drawing.Imaging.ImageFormat]::Png)
        $graphics.Dispose()
        $bitmap.Dispose()

        if (Test-Path '${screenshotPath}') { Write-Output 'SUCCESS' } else { Write-Error 'FILE_NOT_CREATED' }
      `;
      
      await this.runPowerShell(psScript);
      if (!fs.existsSync(screenshotPath)) {
        throw new Error(`Arquivo de screenshot não foi criado: ${screenshotPath}`);
      }
      const imageBuffer = await fs.promises.readFile(screenshotPath);
      const base64 = imageBuffer.toString('base64');
      await fs.promises.unlink(screenshotPath).catch(() => {});
      return `data:image/png;base64,${base64}`;
    } catch (error) {
      console.error('Erro ao capturar área:', error);
      throw error;
    }
  }

  /**
   * Captura screenshot da janela ativa
   */
  async captureActiveWindow(): Promise<string> {
    try {
      const screenshotPath = path.join(this.tempDir, `screenshot_window_${Date.now()}.png`);
      
      const psScript = `
        Add-Type -AssemblyName System.Windows.Forms
        Add-Type -AssemblyName System.Drawing
        Add-Type @"
        using System;
        using System.Runtime.InteropServices;
        using System.Drawing;

        public class Win32 {
          [DllImport(\"user32.dll\")]
          public static extern IntPtr GetForegroundWindow();

          [DllImport(\"user32.dll\")]
          public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

          public struct RECT {
            public int Left, Top, Right, Bottom;
          }
        }
"@

        $hwnd = [Win32]::GetForegroundWindow()
        $rect = New-Object Win32+RECT
        [Win32]::GetWindowRect($hwnd, [ref]$rect)

        $width = $rect.Right - $rect.Left
        $height = $rect.Bottom - $rect.Top

        if ($width -gt 0 -and $height -gt 0) {
          $bitmap = New-Object System.Drawing.Bitmap($width, $height)
          $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
          $graphics.CopyFromScreen($rect.Left, $rect.Top, 0, 0, $bitmap.Size)
          $bitmap.Save('${screenshotPath}', [System.Drawing.Imaging.ImageFormat]::Png)
          $graphics.Dispose()
          $bitmap.Dispose()
          if (Test-Path '${screenshotPath}') { Write-Output 'SUCCESS' } else { Write-Error 'FILE_NOT_CREATED' }
        } else {
          Write-Error 'WINDOW_DIMENSIONS_INVALID'
        }
      `;
      
      await this.runPowerShell(psScript);
      if (!fs.existsSync(screenshotPath)) {
        throw new Error(`Arquivo de screenshot não foi criado: ${screenshotPath}`);
      }
      const imageBuffer = await fs.promises.readFile(screenshotPath);
      const base64 = imageBuffer.toString('base64');
      await fs.promises.unlink(screenshotPath).catch(() => {});
      return `data:image/png;base64,${base64}`;
    } catch (error) {
      console.error('Erro ao capturar janela ativa:', error);
      throw error;
    }
  }

  /**
   * Obtém resolução atual da tela
   */
  async getResolution(): Promise<ScreenResolution> {
    try {
      // Tentar usar Electron screen API (disponível no contexto main)
      if (screen && screen.getPrimaryDisplay) {
        const display = screen.getPrimaryDisplay();
        const { width, height } = display.size;
        return { width, height };
      }
      
      // Fallback: usar PowerShell se Electron não estiver disponível
      console.warn('⚠️ Electron screen API não disponível, usando PowerShell');
      return await this.getResolutionWithPowerShell();
    } catch (error) {
      console.warn('⚠️ Erro ao obter resolução via Electron, usando PowerShell:', error);
      try {
        return await this.getResolutionWithPowerShell();
      } catch (psError) {
        console.error('Erro ao obter resolução:', psError);
        return { width: 1920, height: 1080 };
      }
    }
  }

  private async getResolutionWithPowerShell(): Promise<ScreenResolution> {
    const psScript = `
      Add-Type -AssemblyName System.Windows.Forms
      $screen = [System.Windows.Forms.Screen]::PrimaryScreen
      Write-Output "$($screen.Bounds.Width),$($screen.Bounds.Height)"
    `;

    const { stdout } = await this.runPowerShell(psScript);
    const [width, height] = stdout.trim().split(',').map(Number);
    if (!width || !height) {
      throw new Error('Invalid resolution output');
    }
    return { width, height };
  }

  /**
   * Define resolução da tela (Windows)
   */
  async setResolution(width: number, height: number, refreshRate: number = 60): Promise<void> {
    try {
      const psScript = `
        $pinvokeCode = @'
        using System;
        using System.Runtime.InteropServices;

        namespace Resolution {
          [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
          public struct DEVMODE {
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst=32)]
            public string dmDeviceName;
            public short dmSpecVersion;
            public short dmDriverVersion;
            public short dmSize;
            public short dmDriverExtra;
            public int dmFields;
            public int dmPositionX;
            public int dmPositionY;
            public int dmDisplayOrientation;
            public int dmDisplayFixedOutput;
            public short dmColor;
            public short dmDuplex;
            public short dmYResolution;
            public short dmTTOption;
            public short dmCollate;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst=32)]
            public string dmFormName;
            public short dmLogPixels;
            public int dmBitsPerPel;
            public int dmPelsWidth;
            public int dmPelsHeight;
            public int dmDisplayFlags;
            public int dmDisplayFrequency;
            public int dmICMMethod;
            public int dmICMIntent;
            public int dmMediaType;
            public int dmDitherType;
            public int dmReserved1;
            public int dmReserved2;
            public int dmPanningWidth;
            public int dmPanningHeight;
          }

          class NativeMethods {
            [DllImport("user32.dll")]
            public static extern int EnumDisplaySettings(string deviceName, int modeNum, ref DEVMODE devMode);

            [DllImport("user32.dll")]
            public static extern int ChangeDisplaySettings(ref DEVMODE devMode, int flags);

            public const int ENUM_CURRENT_SETTINGS = -1;
            public const int CDS_UPDATEREGISTRY = 0x01;
            public const int CDS_TEST = 0x02;
            public const int DISP_CHANGE_SUCCESSFUL = 0;
          }
        }
'@

        Add-Type $pinvokeCode

        $devmode = New-Object Resolution.DEVMODE
        $devmode.dmSize = [System.Runtime.InteropServices.Marshal]::SizeOf($devmode)
        [Resolution.NativeMethods]::EnumDisplaySettings($null, [Resolution.NativeMethods]::ENUM_CURRENT_SETTINGS, [ref]$devmode)

        $devmode.dmPelsWidth = ${width}
        $devmode.dmPelsHeight = ${height}
        $devmode.dmDisplayFrequency = ${refreshRate}
        $devmode.dmFields = 0x00080000 -bor 0x00100000 -bor 0x00400000

        $result = [Resolution.NativeMethods]::ChangeDisplaySettings([ref]$devmode, [Resolution.NativeMethods]::CDS_UPDATEREGISTRY)

        if ($result -eq 0) { Write-Output 'SUCCESS' } else { Write-Output "FAILED: $result" }
      `;
      
      const { stdout } = await this.runPowerShell(psScript);
      if (!stdout.includes('SUCCESS')) {
        throw new Error(`Falha ao alterar resolução: ${stdout}`);
      }
    } catch (error) {
      console.error('Erro ao definir resolução:', error);
      throw error;
    }
  }

  /**
   * Lista resoluções disponíveis
   */
  async listAvailableResolutions(): Promise<ScreenResolution[]> {
    try {
      const psScript = `
        Add-Type -AssemblyName System.Windows.Forms
        $resolutions = @()
        foreach ($screen in [System.Windows.Forms.Screen]::AllScreens) {
          $resolutions += "$($screen.Bounds.Width)x$($screen.Bounds.Height)"
        }
        $resolutions -join ";"
      `;

      const { stdout } = await this.runPowerShell(psScript);
      return stdout
        .trim()
        .split(';')
        .map((res) => res.trim())
        .filter(Boolean)
        .map((res) => {
          const [width, height] = res.split('x').map(Number);
          return { width, height };
        });
    } catch (error) {
      console.error('Erro ao listar resoluções:', error);
      return [{ width: 1920, height: 1080 }];
    }
  }

  /**
   * Bloquear tela (Win+L)
   */
  async lockScreen(): Promise<void> {
    try {
      await execAsync('rundll32.exe user32.dll,LockWorkStation');
    } catch (error) {
      console.error('Erro ao bloquear tela:', error);
      throw error;
    }
  }

  /**
   * Colocar monitor em standby
   */
  async turnOffDisplay(): Promise<void> {
    try {
      const psScript = `
        Add-Type -AssemblyName System.Windows.Forms
        Add-Type @'
        using System;
        using System.Runtime.InteropServices;
        public static class Power {
          [DllImport("kernel32.dll")]
          public static extern uint SetThreadExecutionState(uint esFlags);
        }
'@
        [Power]::SetThreadExecutionState(0x80000002)
      `;
      
      await this.runPowerShell(psScript);
    } catch (error) {
      console.error('Erro ao desligar display:', error);
      throw error;
    }
  }

  /**
   * Acordar monitor
   */
  async turnOnDisplay(): Promise<void> {
    try {
      const psScript = `
        Add-Type -AssemblyName System.Windows.Forms
        Add-Type -AssemblyName System.Drawing
        Add-Type @'
        using System;
        using System.Runtime.InteropServices;
        public static class Power {
          [DllImport("kernel32.dll")]
          public static extern uint SetThreadExecutionState(uint esFlags);
        }
'@
        [Power]::SetThreadExecutionState(0x80000000)

        $x = [System.Windows.Forms.Cursor]::Position.X
        $y = [System.Windows.Forms.Cursor]::Position.Y
        [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($x + 1, $y)
        Start-Sleep -Milliseconds 50
        [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($x, $y)
      `;
      
      await this.runPowerShell(psScript);
    } catch (error) {
      console.error('Erro ao acordar display:', error);
      throw error;
    }
  }
}
