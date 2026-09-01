/**
 * Gerenciador de Minecraft Local
 * Lê logs, mods e configs da instalação local do Minecraft
 */

import * as fs from 'fs';
import * as path from 'path';

export interface MinecraftCrashReport {
  timestamp: string;
  reason: string;
  modsInvolved: string[];
  stackTrace: string[];
}

export interface MinecraftMod {
  name: string;
  version: string;
  file: string;
  size: number;
}

export interface MinecraftConfig {
  file: string;
  settings: Record<string, any>;
}

export class MinecraftManager {
  private minecraftPath: string;

  constructor(minecraftPath?: string) {
    // Caminho padrão do Minecraft no Windows
    this.minecraftPath = minecraftPath || path.join(
      process.env.APPDATA || '',
      '.minecraft'
    );
  }

  /**
   * Definir caminho customizado do Minecraft
   */
  setMinecraftPath(path: string): void {
    this.minecraftPath = path;
  }

  /**
   * Ler arquivo de log mais recente
   */
  async readLatestLog(lines: number = 100): Promise<string[]> {
    try {
      const logPath = path.join(this.minecraftPath, 'logs', 'latest.log');
      
      if (!fs.existsSync(logPath)) {
        throw new Error('Arquivo de log não encontrado');
      }

      const content = fs.readFileSync(logPath, 'utf-8');
      const logLines = content.split('\n');
      
      // Retornar últimas N linhas
      return logLines.slice(-lines);
    } catch (error) {
      console.error('Erro ao ler log:', error);
      throw error;
    }
  }

  /**
   * Analisar log em busca de erros e crashes
   */
  async analyzeLog(): Promise<{
    errors: string[];
    warnings: string[];
    crashReports: MinecraftCrashReport[];
    modErrors: Map<string, number>;
  }> {
    try {
      const logLines = await this.readLatestLog(500);
      const errors: string[] = [];
      const warnings: string[] = [];
      const crashReports: MinecraftCrashReport[] = [];
      const modErrors = new Map<string, number>();

      for (const line of logLines) {
        // Detectar erros
        if (line.includes('[ERROR]')) {
          errors.push(line);
          
          // Extrair nome do mod se possível
          const modMatch = line.match(/\[([^\]]+)\]/);
          if (modMatch) {
            const modName = modMatch[1];
            modErrors.set(modName, (modErrors.get(modName) || 0) + 1);
          }
        }

        // Detectar warnings
        if (line.includes('[WARN]')) {
          warnings.push(line);
        }

        // Detectar crash reports
        if (line.includes('Crash Report') || line.includes('Exception')) {
          const crash: MinecraftCrashReport = {
            timestamp: new Date().toISOString(),
            reason: line,
            modsInvolved: [],
            stackTrace: []
          };
          crashReports.push(crash);
        }
      }

      return { errors, warnings, crashReports, modErrors };
    } catch (error) {
      console.error('Erro ao analisar log:', error);
      throw error;
    }
  }

  /**
   * Listar mods instalados
   */
  async listMods(): Promise<MinecraftMod[]> {
    try {
      const modsPath = path.join(this.minecraftPath, 'mods');
      
      if (!fs.existsSync(modsPath)) {
        throw new Error('Diretório de mods não encontrado');
      }

      const files = fs.readdirSync(modsPath);
      const mods: MinecraftMod[] = [];

      for (const file of files) {
        if (file.endsWith('.jar') || file.endsWith('.jar.disabled')) {
          const filePath = path.join(modsPath, file);
          const stats = fs.statSync(filePath);
          
          // Extrair nome e versão do arquivo
          const nameMatch = file.match(/^(.+?)-(\d+[\d.]+)\.jar/);
          const name = nameMatch ? nameMatch[1] : file.replace('.jar', '').replace('.jar.disabled', '');
          const version = nameMatch ? nameMatch[2] : 'unknown';

          mods.push({
            name,
            version,
            file,
            size: stats.size
          });
        }
      }

      return mods.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error('Erro ao listar mods:', error);
      throw error;
    }
  }

  /**
   * Ler configuração do Minecraft
   */
  async readConfig(configFile: string = 'options.txt'): Promise<MinecraftConfig> {
    try {
      const configPath = path.join(this.minecraftPath, configFile);
      
      if (!fs.existsSync(configPath)) {
        throw new Error(`Arquivo de configuração ${configFile} não encontrado`);
      }

      const content = fs.readFileSync(configPath, 'utf-8');
      const settings: Record<string, any> = {};

      // Parsear arquivo de configuração (key:value)
      for (const line of content.split('\n')) {
        if (line.includes(':')) {
          const [key, value] = line.split(':');
          settings[key.trim()] = value.trim();
        }
      }

      return {
        file: configFile,
        settings
      };
    } catch (error) {
      console.error('Erro ao ler configuração:', error);
      throw error;
    }
  }

  /**
   * Obter informações do sistema para diagnóstico
   */
  async getSystemInfo(): Promise<{
    javaVersion: string;
    allocatedMemory: string;
    os: string;
  }> {
    try {
      // Ler informações do launcher profile
      const launcherProfilesPath = path.join(this.minecraftPath, 'launcher_profiles.json');
      
      if (!fs.existsSync(launcherProfilesPath)) {
        return {
          javaVersion: 'unknown',
          allocatedMemory: 'unknown',
          os: process.platform
        };
      }

      const content = fs.readFileSync(launcherProfilesPath, 'utf-8');
      const profiles = JSON.parse(content);

      // Extrair informações do Java se disponível
      let javaVersion = 'unknown';
      let allocatedMemory = 'unknown';

      // Tentar obter versão do Java
      try {
        const { execSync } = require('child_process');
        const javaVersionOutput = execSync('java -version').toString();
        const versionMatch = javaVersionOutput.match(/version "(\d+[\d.]*)"/);
        if (versionMatch) {
          javaVersion = versionMatch[1];
        }
      } catch (e) {
        // Java não encontrado no PATH
      }

      return {
        javaVersion,
        allocatedMemory,
        os: process.platform
      };
    } catch (error) {
      console.error('Erro ao obter informações do sistema:', error);
      return {
        javaVersion: 'unknown',
        allocatedMemory: 'unknown',
        os: process.platform
      };
    }
  }

  /**
   * Gerar relatório de diagnóstico
   */
  async generateDiagnosticReport(): Promise<string> {
    try {
      const logAnalysis = await this.analyzeLog();
      const mods = await this.listMods();
      const systemInfo = await this.getSystemInfo();

      let report = '=== RELATÓRIO DE DIAGNÓSTICO MINECRAFT ===\n\n';
      
      report += '=== INFORMAÇÕES DO SISTEMA ===\n';
      report += `Java Version: ${systemInfo.javaVersion}\n`;
      report += `OS: ${systemInfo.os}\n`;
      report += `Allocated Memory: ${systemInfo.allocatedMemory}\n\n`;
      
      report += '=== MODS INSTALADOS ===\n';
      report += `Total: ${mods.length} mods\n`;
      mods.forEach(mod => {
        report += `- ${mod.name} (${mod.version}) - ${this.formatSize(mod.size)}\n`;
      });
      report += '\n';
      
      report += '=== ANÁLISE DE LOG ===\n';
      report += `Erros encontrados: ${logAnalysis.errors.length}\n`;
      report += `Warnings encontrados: ${logAnalysis.warnings.length}\n`;
      report += `Crash reports: ${logAnalysis.crashReports.length}\n\n`;
      
      if (logAnalysis.modErrors.size > 0) {
        report += '=== MODS COM ERROS ===\n';
        for (const [mod, count] of logAnalysis.modErrors) {
          report += `- ${mod}: ${count} erros\n`;
        }
        report += '\n';
      }
      
      if (logAnalysis.errors.length > 0) {
        report += '=== ÚLTIMOS ERROS ===\n';
        logAnalysis.errors.slice(-5).forEach(error => {
          report += `${error}\n`;
        });
      }

      return report;
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      throw error;
    }
  }

  /**
   * Formatar tamanho do arquivo
   */
  private formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  }

  /**
   * Desabilitar mod específico
   */
  async disableMod(modName: string): Promise<boolean> {
    try {
      const modsPath = path.join(this.minecraftPath, 'mods');
      const files = fs.readdirSync(modsPath);
      
      for (const file of files) {
        if (file.includes(modName) && file.endsWith('.jar')) {
          const oldPath = path.join(modsPath, file);
          const newPath = path.join(modsPath, file + '.disabled');
          fs.renameSync(oldPath, newPath);
          console.log(`Mod ${modName} desabilitado`);
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Erro ao desabilitar mod:', error);
      return false;
    }
  }

  /**
   * Habilitar mod específico
   */
  async enableMod(modName: string): Promise<boolean> {
    try {
      const modsPath = path.join(this.minecraftPath, 'mods');
      const files = fs.readdirSync(modsPath);
      
      for (const file of files) {
        if (file.includes(modName) && file.endsWith('.jar.disabled')) {
          const oldPath = path.join(modsPath, file);
          const newPath = path.join(modsPath, file.replace('.disabled', ''));
          fs.renameSync(oldPath, newPath);
          console.log(`Mod ${modName} habilitado`);
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Erro ao habilitar mod:', error);
      return false;
    }
  }
}
