import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';

const execAsync = promisify(exec);

interface AppConfig {
  name: string;
  paths: string[];
  arguments: string[];
}

interface AppsConfig {
  apps: { [key: string]: AppConfig };
  aliases: { [key: string]: string };
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cmd?: string;
  cpu?: number;
  memory?: number;
}

export class ProcessController {
  private appsConfig: AppsConfig | null = null;
  private configPath: string;

  constructor() {
    this.configPath = path.join(process.cwd(), 'apps-config.json');
    this.loadAppsConfig();
  }

  /**
   * Carrega configuração de aplicativos do JSON
   */
  private loadAppsConfig(): void {
    const possiblePaths = [
      path.join(process.cwd(), 'apps-config.json'),
      path.join(__dirname, '..', '..', '..', 'apps-config.json'),
      path.join(__dirname, '..', '..', '..', '..', 'apps-config.json'),
      'C:\\Users\\gegef\\.vscode\\ia-assistant\\apps-config.json',
    ];

    for (const configPath of possiblePaths) {
      if (fs.existsSync(configPath)) {
        try {
          const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          this.appsConfig = configData;
          console.log('✅ Configuração de apps carregada:', configPath);
          return;
        } catch (e) {
          console.log('⚠️ Erro ao carregar apps-config.json:', e);
        }
      }
    }
    console.log('⚠️ apps-config.json não encontrado, usando método padrão');
  }

  /**
   * Expande variáveis de ambiente no caminho
   */
  private expandPath(filePath: string): string {
    return filePath
      .replace(/%USERNAME%/g, process.env.USERNAME || '')
      .replace(/%APPDATA%/g, process.env.APPDATA || '')
      .replace(/%LOCALAPPDATA%/g, process.env.LOCALAPPDATA || '')
      .replace(/%windir%/g, process.env.windir || '')
      .replace(/%TEMP%/g, process.env.TEMP || '');
  }

  /**
   * Resolve caminhos com wildcard (*)
   */
  private resolveWildcardPath(pattern: string): string | null {
    const expandedPath = this.expandPath(pattern);
    
    if (!pattern.includes('*')) {
      return fs.existsSync(expandedPath) ? expandedPath : null;
    }

    // Resolver wildcard
    const parts = expandedPath.split('\\');
    let currentPath = parts[0];
    
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      
      if (part.includes('*')) {
        // Encontrar diretório correspondente ao padrão
        if (!fs.existsSync(currentPath)) return null;
        
        const entries = fs.readdirSync(currentPath);
        const regex = new RegExp('^' + part.replace(/\*/g, '.*') + '$');
        const match = entries.find(e => regex.test(e));
        
        if (!match) return null;
        currentPath = path.join(currentPath, match);
      } else {
        currentPath = path.join(currentPath, part);
      }
    }
    
    return fs.existsSync(currentPath) ? currentPath : null;
  }

  /**
   * Encontra caminho válido para um app
   */
  private findAppPath(appName: string): string | null {
    if (!this.appsConfig) return null;

    // Verificar aliases
    const normalizedName = appName.toLowerCase().trim();
    const targetApp = this.appsConfig.aliases[normalizedName] || normalizedName;
    
    const appConfig = this.appsConfig.apps[targetApp];
    if (!appConfig) return null;

    // Tentar cada caminho
    for (const appPath of appConfig.paths) {
      const resolvedPath = this.resolveWildcardPath(appPath);
      if (resolvedPath) {
        console.log(`✅ App encontrado: ${appConfig.name} em ${resolvedPath}`);
        return resolvedPath;
      }
    }

    console.log(`❌ App não encontrado: ${appConfig.name}`);
    return null;
  }

  /**
   * Lista todos os processos em execução
   */
  async listProcesses(): Promise<ProcessInfo[]> {
    try {
      const psScript = `
        Get-Process | Select-Object Id, ProcessName, Path | ConvertTo-Json
      `;
      
      const { stdout } = await execAsync(`powershell.exe -Command "${psScript}"`);
      const processes = JSON.parse(stdout);
      
      return processes.map((p: any) => ({
        pid: p.Id,
        name: p.ProcessName,
        cmd: p.Path
      }));
    } catch (error) {
      console.error('Erro ao listar processos:', error);
      return [];
    }
  }

  /**
   * Inicia um programa
   */
  async startProgram(programPath: string, args: string[] = []): Promise<number> {
    try {
      const resolvedPath = path.resolve(programPath);
      const child = spawn(resolvedPath, args, {
        detached: true,
        stdio: 'ignore'
      });
      
      child.unref();
      return child.pid || 0;
    } catch (error) {
      console.error('Erro ao iniciar programa:', error);
      throw error;
    }
  }

  /**
   * Abre um programa pelo nome (ex: wordpad, chrome)
   * Tenta primeiro usar o apps-config.json, depois fallback para comando start
   */
  async openProgram(programName: string): Promise<void> {
    try {
      // Tentar encontrar no apps-config.json primeiro
      const appPath = this.findAppPath(programName);
      
      if (appPath && fs.existsSync(appPath)) {
        const normalizedName = programName.toLowerCase().trim();
        const targetApp = this.appsConfig?.aliases[normalizedName] || normalizedName;
        const appConfig = this.appsConfig?.apps[targetApp];
        const args = appConfig?.arguments || [];
        
        // Usar spawn para não bloquear
        const child = spawn(appPath, args, {
          detached: true,
          stdio: 'ignore'
        });
        child.unref();
        
        console.log(`✅ Programa aberto via apps-config: ${appPath}`);
        return;
      }
      
      // Fallback: usar comando start (mais confiável)
      console.log(`🚀 Usando comando start para: ${programName}`);
      exec(`start "" "${programName}"`, (error) => {
        if (!error) {
          console.log(`✅ Programa aberto via comando start: ${programName}`);
        } else {
          console.error('❌ Erro ao abrir programa:', error);
        }
      });
    } catch (error) {
      console.error('❌ Erro ao abrir programa:', error);
      throw error;
    }
  }

  /**
   * Retorna lista de aplicativos disponíveis
   */
  getAvailableApps(): string[] {
    if (!this.appsConfig) return [];
    
    const apps = Object.keys(this.appsConfig.apps);
    const aliases = Object.keys(this.appsConfig.aliases);
    
    return [...new Set([...apps, ...aliases])].sort();
  }

  /**
   * Verifica se um app está disponível
   */
  isAppAvailable(appName: string): boolean {
    return !!this.findAppPath(appName);
  }

  /**
   * Abre um arquivo com o programa padrão
   */
  async openFile(filePath: string): Promise<void> {
    try {
      const resolvedPath = path.resolve(filePath);
      await execAsync(`start "" "${resolvedPath}"`);
    } catch (error) {
      console.error('Erro ao abrir arquivo:', error);
      throw error;
    }
  }

  /**
   * Abre uma URL no navegador padrão
   */
  async openURL(url: string): Promise<void> {
    try {
      await execAsync(`start "" "${url}"`);
    } catch (error) {
      console.error('Erro ao abrir URL:', error);
      throw error;
    }
  }

  /**
   * Encerra um processo pelo PID
   */
  async killProcess(pid: number, force: boolean = false): Promise<boolean> {
    try {
      const forceFlag = force ? '-Force' : '';
      const psScript = `Stop-Process -Id ${pid} ${forceFlag}`;
      
      await execAsync(`powershell.exe -Command "${psScript}"`);
      return true;
    } catch (error) {
      console.error('Erro ao encerrar processo:', error);
      return false;
    }
  }

  /**
   * Encerra um processo pelo nome
   */
  async killProcessByName(processName: string, force: boolean = false): Promise<boolean> {
    try {
      const forceFlag = force ? '-Force' : '';
      const psScript = `Stop-Process -Name "${processName}" ${forceFlag}`;
      
      await execAsync(`powershell.exe -Command "${psScript}"`);
      return true;
    } catch (error) {
      console.error('Erro ao encerrar processo:', error);
      return false;
    }
  }

  /**
   * Encontra processos por nome
   */
  async findProcess(processName: string): Promise<ProcessInfo[]> {
    try {
      const psScript = `
        Get-Process -Name "${processName}" -ErrorAction SilentlyContinue | 
        Select-Object Id, ProcessName, Path | ConvertTo-Json
      `;
      
      const { stdout } = await execAsync(`powershell.exe -Command "${psScript}"`);
      
      if (!stdout.trim()) {
        return [];
      }
      
      const processes = JSON.parse(stdout);
      const processArray = Array.isArray(processes) ? processes : [processes];
      
      return processArray.map((p: any) => ({
        pid: p.Id,
        name: p.ProcessName,
        cmd: p.Path
      }));
    } catch (error) {
      console.error('Erro ao encontrar processo:', error);
      return [];
    }
  }

  /**
   * Verifica se um processo está em execução
   */
  async isProcessRunning(processName: string): Promise<boolean> {
    const processes = await this.findProcess(processName);
    return processes.length > 0;
  }

  /**
   * Maximiza uma janela
   */
  async maximizeWindow(windowTitle: string): Promise<void> {
    try {
      const psScript = `
        $process = Get-Process | Where-Object {$_.MainWindowTitle -like "*${windowTitle}*"} | Select-Object -First 1
        if ($process) {
          $sig = @'
          [DllImport("user32.dll")]
          public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
'@
          $ShowWindow = Add-Type -MemberDefinition $sig -Name "Win32ShowWindow" -PassThru
          $ShowWindow::ShowWindow($process.MainWindowHandle, 3)  # SW_MAXIMIZE
        }
      `;
      
      await execAsync(`powershell.exe -Command "${psScript}"`);
    } catch (error) {
      console.error('Erro ao maximizar janela:', error);
      throw error;
    }
  }

  /**
   * Minimiza uma janela
   */
  async minimizeWindow(windowTitle: string): Promise<void> {
    try {
      const psScript = `
        $process = Get-Process | Where-Object {$_.MainWindowTitle -like "*${windowTitle}*"} | Select-Object -First 1
        if ($process) {
          $sig = @'
          [DllImport("user32.dll")]
          public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
'@
          $ShowWindow = Add-Type -MemberDefinition $sig -Name "Win32ShowWindow" -PassThru
          $ShowWindow::ShowWindow($process.MainWindowHandle, 6)  # SW_MINIMIZE
        }
      `;
      
      await execAsync(`powershell.exe -Command "${psScript}"`);
    } catch (error) {
      console.error('Erro ao minimizar janela:', error);
      throw error;
    }
  }

  /**
   * Restaura uma janela
   */
  async restoreWindow(windowTitle: string): Promise<void> {
    try {
      const psScript = `
        $process = Get-Process | Where-Object {$_.MainWindowTitle -like "*${windowTitle}*"} | Select-Object -First 1
        if ($process) {
          $sig = @'
          [DllImport("user32.dll")]
          public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
'@
          $ShowWindow = Add-Type -MemberDefinition $sig -Name "Win32ShowWindow" -PassThru
          $ShowWindow::ShowWindow($process.MainWindowHandle, 9)  # SW_RESTORE
        }
      `;
      
      await execAsync(`powershell.exe -Command "${psScript}"`);
    } catch (error) {
      console.error('Erro ao restaurar janela:', error);
      throw error;
    }
  }

  /**
   * Foca uma janela
   */
  async focusWindow(windowTitle: string): Promise<void> {
    try {
      const psScript = `
        $process = Get-Process | Where-Object {$_.MainWindowTitle -like "*${windowTitle}*"} | Select-Object -First 1
        if ($process) {
          $sig = @'
          [DllImport("user32.dll")]
          public static extern bool SetForegroundWindow(IntPtr hWnd);
          [DllImport("user32.dll")]
          public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
          [DllImport("user32.dll")]
          public static extern bool IsIconic(IntPtr hWnd);
'@
          $user32 = Add-Type -MemberDefinition $sig -Name "Win32Focus" -PassThru
          
          if ($user32::IsIconic($process.MainWindowHandle)) {
            $user32::ShowWindow($process.MainWindowHandle, 9)
          }
          $user32::SetForegroundWindow($process.MainWindowHandle)
        }
      `;
      
      await execAsync(`powershell.exe -Command "${psScript}"`);
    } catch (error) {
      console.error('Erro ao focar janela:', error);
      throw error;
    }
  }

  /**
   * Lista janelas abertas
   */
  async listWindows(): Promise<Array<{ title: string; pid: number; name: string }>> {
    try {
      const psScript = `
        Get-Process | Where-Object {$_.MainWindowTitle -ne ""} | 
        Select-Object MainWindowTitle, Id, ProcessName | ConvertTo-Json
      `;
      
      const { stdout } = await execAsync(`powershell.exe -Command "${psScript}"`);
      
      if (!stdout.trim()) {
        return [];
      }
      
      const windows = JSON.parse(stdout);
      const windowArray = Array.isArray(windows) ? windows : [windows];
      
      return windowArray.map((w: any) => ({
        title: w.MainWindowTitle,
        pid: w.Id,
        name: w.ProcessName
      }));
    } catch (error) {
      console.error('Erro ao listar janelas:', error);
      return [];
    }
  }

  /**
   * Executa um comando PowerShell
   */
  async executePowerShell(command: string): Promise<{ stdout: string; stderr: string }> {
    try {
      const { stdout, stderr } = await execAsync(`powershell.exe -Command "${command}"`);
      return { stdout, stderr };
    } catch (error: any) {
      return { stdout: '', stderr: error.message };
    }
  }

  /**
   * Executa um comando CMD
   */
  async executeCMD(command: string): Promise<{ stdout: string; stderr: string }> {
    try {
      const { stdout, stderr } = await execAsync(command);
      return { stdout, stderr };
    } catch (error: any) {
      return { stdout: '', stderr: error.message };
    }
  }
}
