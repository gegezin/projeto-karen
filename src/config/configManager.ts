/**
 * Gerenciador de configuração da aplicação
 * Salva configurações em arquivo JSON no APPDATA do usuário
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

interface AppConfig {
  apiKey?: string;
  theme?: string;
  voiceEnabled?: boolean;
  modelName?: string;
  lastUpdate?: string;
}

export class ConfigManager {
  private configPath: string;
  private config: AppConfig = {};

  constructor() {
    // Usar userData do Electron (APPDATA no Windows)
    const userDataPath = app.getPath('userData');
    this.configPath = path.join(userDataPath, 'karen-config.json');
    this.loadConfig();
  }

  /**
   * Carrega configurações do arquivo
   */
  private loadConfig(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        this.config = JSON.parse(data);
        console.log('✅ Configurações carregadas de:', this.configPath);
      } else {
        console.log('ℹ️ Arquivo de configuração não existe, criando novo:', this.configPath);
        this.saveConfig();
      }
    } catch (error) {
      console.error('❌ Erro ao carregar configurações:', error);
      this.config = {};
    }
  }

  /**
   * Salva configurações no arquivo
   */
  private saveConfig(): void {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
      console.log('💾 Configurações salvas em:', this.configPath);
    } catch (error) {
      console.error('❌ Erro ao salvar configurações:', error);
    }
  }

  /**
   * Obtém valor de uma configuração
   */
  get<T extends keyof AppConfig>(key: T): AppConfig[T] {
    return this.config[key];
  }

  /**
   * Define valor de uma configuração
   */
  set<T extends keyof AppConfig>(key: T, value: AppConfig[T]): void {
    this.config[key] = value;
    this.config.lastUpdate = new Date().toISOString();
    this.saveConfig();
  }

  /**
   * Obtém a API Key
   */
  getApiKey(): string | undefined {
    return this.config.apiKey;
  }

  /**
   * Salva a API Key
   */
  setApiKey(apiKey: string): void {
    this.set('apiKey', apiKey);
  }

  /**
   * Remove a API Key
   */
  clearApiKey(): void {
    delete this.config.apiKey;
    this.saveConfig();
  }

  /**
   * Retorna todas as configurações
   */
  getAll(): AppConfig {
    return { ...this.config };
  }
}

// Instância singleton
export const configManager = new ConfigManager();
