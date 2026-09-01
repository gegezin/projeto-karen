/**
 * Gerenciador de histórico de conversas
 * Salva conversas em arquivo JSON para persistência
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export interface MessageEntry {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  date: string; // YYYY-MM-DD para facilitar busca
}

export interface ConversationSession {
  id: string;
  date: string;
  title: string;
  messages: MessageEntry[];
  lastUpdate: string;
}

export class ConversationHistoryManager {
  private historyPath: string;
  private sessionsPath: string;
  private currentSession: ConversationSession | null = null;
  private maxHistoryDays = 30; // Manter histórico dos últimos 30 dias

  constructor() {
    const userDataPath = app.getPath('userData');
    this.historyPath = path.join(userDataPath, 'conversations');
    this.sessionsPath = path.join(this.historyPath, 'sessions');
    this.ensureDirectories();
    this.loadOrCreateSession();
  }

  private ensureDirectories(): void {
    try {
      if (!fs.existsSync(this.historyPath)) {
        fs.mkdirSync(this.historyPath, { recursive: true });
      }
      if (!fs.existsSync(this.sessionsPath)) {
        fs.mkdirSync(this.sessionsPath, { recursive: true });
      }
    } catch (error) {
      console.error('❌ Erro ao criar diretórios de histórico:', error);
    }
  }

  private loadOrCreateSession(): void {
    const today = new Date().toISOString().split('T')[0];
    const sessionFile = path.join(this.sessionsPath, `${today}.json`);

    try {
      if (fs.existsSync(sessionFile)) {
        const data = fs.readFileSync(sessionFile, 'utf-8');
        this.currentSession = JSON.parse(data);
        console.log('✅ Sessão de hoje carregada:', this.currentSession?.messages.length || 0, 'mensagens');
      } else {
        this.createNewSession(today);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar sessão:', error);
      this.createNewSession(today);
    }
  }

  private createNewSession(date: string): void {
    this.currentSession = {
      id: `session_${Date.now()}`,
      date: date,
      title: `Conversa de ${new Date().toLocaleDateString('pt-BR')}`,
      messages: [],
      lastUpdate: new Date().toISOString()
    };
    this.saveCurrentSession();
    console.log('✅ Nova sessão criada para hoje');
  }

  private saveCurrentSession(): void {
    if (!this.currentSession) return;

    try {
      const sessionFile = path.join(this.sessionsPath, `${this.currentSession.date}.json`);
      this.currentSession.lastUpdate = new Date().toISOString();
      fs.writeFileSync(sessionFile, JSON.stringify(this.currentSession, null, 2), 'utf-8');
    } catch (error) {
      console.error('❌ Erro ao salvar sessão:', error);
    }
  }

  /**
   * Adiciona uma mensagem ao histórico atual
   */
  addMessage(role: 'user' | 'assistant', content: string): void {
    if (!this.currentSession) {
      this.loadOrCreateSession();
    }

    const message: MessageEntry = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      role,
      content,
      timestamp: new Date().toISOString(),
      date: new Date().toISOString().split('T')[0]
    };

    this.currentSession?.messages.push(message);
    this.saveCurrentSession();

    // Limitar tamanho da sessão atual (últimas 100 mensagens)
    if (this.currentSession && this.currentSession.messages.length > 100) {
      this.currentSession.messages = this.currentSession.messages.slice(-100);
      this.saveCurrentSession();
    }
  }

  /**
   * Obtém todas as mensagens da sessão atual
   */
  getCurrentSessionMessages(): MessageEntry[] {
    return this.currentSession?.messages || [];
  }

  /**
   * Obtém histórico das últimas N mensagens
   */
  getRecentMessages(count: number = 10): MessageEntry[] {
    const messages = this.currentSession?.messages || [];
    return messages.slice(-count);
  }

  /**
   * Busca mensagens por palavra-chave
   */
  searchMessages(query: string): MessageEntry[] {
    const messages = this.currentSession?.messages || [];
    const lowerQuery = query.toLowerCase();
    return messages.filter(msg => 
      msg.content.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Busca avançada em todas as sessões (últimos 30 dias)
   */
  searchAllSessions(query: string, days: number = 30): MessageEntry[] {
    const results: MessageEntry[] = [];
    const lowerQuery = query.toLowerCase();
    const today = new Date();

    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const sessionFile = path.join(this.sessionsPath, `${dateStr}.json`);

      try {
        if (fs.existsSync(sessionFile)) {
          const data = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
          const matchingMessages = data.messages?.filter((msg: MessageEntry) => 
            msg.content.toLowerCase().includes(lowerQuery)
          ) || [];
          results.push(...matchingMessages);
        }
      } catch (error) {
        console.error(`❌ Erro ao buscar em sessão ${dateStr}:`, error);
      }
    }

    return results;
  }

  /**
   * Busca por código no histórico (para resgatar backups)
   */
  searchCode(query: string): MessageEntry[] {
    const results = this.searchAllSessions(query, 30);
    // Priorizar mensagens que contêm blocos de código
    return results.filter(msg => 
      msg.content.includes('```') || 
      msg.content.includes('const ') || 
      msg.content.includes('function ') ||
      msg.content.includes('class ') ||
      msg.content.includes('import ')
    );
  }

  /**
   * Busca por contexto (combina múltiplas palavras-chave)
   */
  searchByContext(keywords: string[]): MessageEntry[] {
    const messages = this.searchAllSessions(keywords[0], 30);
    return messages.filter(msg => {
      const content = msg.content.toLowerCase();
      return keywords.every(keyword => content.includes(keyword.toLowerCase()));
    });
  }

  /**
   * Obtém sessões dos últimos dias
   */
  getRecentSessions(days: number = 7): ConversationSession[] {
    const sessions: ConversationSession[] = [];
    const today = new Date();

    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const sessionFile = path.join(this.sessionsPath, `${dateStr}.json`);

      try {
        if (fs.existsSync(sessionFile)) {
          const data = fs.readFileSync(sessionFile, 'utf-8');
          sessions.push(JSON.parse(data));
        }
      } catch (error) {
        console.error(`❌ Erro ao carregar sessão ${dateStr}:`, error);
      }
    }

    return sessions;
  }

  /**
   * Obtém estatísticas do histórico
   */
  getStats(): { totalSessions: number; totalMessages: number; storageSize: string } {
    try {
      const files = fs.readdirSync(this.sessionsPath).filter(f => f.endsWith('.json'));
      let totalMessages = 0;
      let totalSize = 0;

      files.forEach(file => {
        const filePath = path.join(this.sessionsPath, file);
        const stats = fs.statSync(filePath);
        totalSize += stats.size;

        try {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          totalMessages += data.messages?.length || 0;
        } catch (e) {}
      });

      return {
        totalSessions: files.length,
        totalMessages,
        storageSize: `${(totalSize / 1024).toFixed(2)} KB`
      };
    } catch (error) {
      return { totalSessions: 0, totalMessages: 0, storageSize: '0 KB' };
    }
  }

  /**
   * Limpa histórico antigo (mais de X dias)
   */
  cleanupOldHistory(): void {
    try {
      const files = fs.readdirSync(this.sessionsPath).filter(f => f.endsWith('.json'));
      const today = new Date();
      let deletedCount = 0;

      files.forEach(file => {
        const filePath = path.join(this.sessionsPath, file);
        const stats = fs.statSync(filePath);
        const daysDiff = Math.floor((today.getTime() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24));

        if (daysDiff > this.maxHistoryDays) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      });

      if (deletedCount > 0) {
        console.log(`🧹 ${deletedCount} sessões antigas removidas`);
      }
    } catch (error) {
      console.error('❌ Erro ao limpar histórico:', error);
    }
  }

  /**
   * Exporta histórico para Markdown
   */
  exportToMarkdown(): string {
    if (!this.currentSession || this.currentSession.messages.length === 0) {
      return '# Histórico de Conversa\n\nNenhuma mensagem encontrada.';
    }

    let markdown = `# ${this.currentSession.title}\n\n`;
    markdown += `**Data:** ${new Date(this.currentSession.date).toLocaleDateString('pt-BR')}\n\n`;
    markdown += `---\n\n`;

    this.currentSession.messages.forEach(msg => {
      const time = new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const role = msg.role === 'user' ? '👤 Você' : '🤖 Karen';
      markdown += `**${role}** (${time}):\n${msg.content}\n\n`;
    });

    return markdown;
  }

  /**
   * Limpa a sessão atual
   */
  clearCurrentSession(): void {
    if (this.currentSession) {
      this.currentSession.messages = [];
      this.saveCurrentSession();
    }
  }
}

// Instância singleton
export const conversationHistory = new ConversationHistoryManager();
