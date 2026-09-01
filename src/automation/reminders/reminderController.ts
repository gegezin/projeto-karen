/**
 * Controller de Lembretes e Alarmes
 * Gerencia lembretes temporizados com notificações
 */

import { Notification } from 'electron';

export interface Reminder {
  id: string;
  title: string;
  description?: string;
  timestamp: number;
  createdAt: number;
  repeat?: 'daily' | 'weekly' | 'once';
  completed: boolean;
}

export class ReminderController {
  private reminders: Map<string, Reminder> = new Map();
  private checkInterval: any = null;
  private readonly CHECK_INTERVAL_MS = 10000; // Verifica a cada 10 segundos

  constructor() {
    this.startReminderChecker();
  }

  /**
   * Cria um novo lembrete
   */
  createReminder(title: string, timeMs: number, description?: string, repeat?: 'daily' | 'weekly' | 'once'): Reminder {
    const id = `reminder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();
    
    const reminder: Reminder = {
      id,
      title,
      description,
      timestamp: now + timeMs,
      createdAt: now,
      repeat: repeat || 'once',
      completed: false
    };

    this.reminders.set(id, reminder);
    console.log(`⏰ Lembrete criado: "${title}" em ${this.formatTime(timeMs)}`);
    
    return reminder;
  }

  /**
   * Cria lembrete para horário específico
   */
  createReminderForTime(title: string, targetTime: Date, description?: string): Reminder | null {
    const now = new Date();
    const target = new Date(targetTime);
    
    // Se o horário já passou hoje, assume amanhã
    if (target < now) {
      target.setDate(target.getDate() + 1);
    }
    
    const timeMs = target.getTime() - now.getTime();
    
    if (timeMs < 0) {
      console.log('❌ Horário já passou');
      return null;
    }

    return this.createReminder(title, timeMs, description);
  }

  /**
   * Cria lembrete diário para horário específico
   */
  createDailyReminder(title: string, hour: number, minute: number, description?: string): Reminder {
    const now = new Date();
    const target = new Date();
    target.setHours(hour, minute, 0, 0);
    
    // Se já passou hoje, começa amanhã
    if (target <= now) {
      target.setDate(target.getDate() + 1);
    }
    
    const timeMs = target.getTime() - now.getTime();
    return this.createReminder(title, timeMs, description, 'daily');
  }

  /**
   * Remove um lembrete
   */
  removeReminder(id: string): boolean {
    const removed = this.reminders.delete(id);
    if (removed) {
      console.log(`🗑️ Lembrete ${id} removido`);
    }
    return removed;
  }

  /**
   * Lista todos os lembretes ativos
   */
  getAllReminders(): Reminder[] {
    return Array.from(this.reminders.values())
      .filter(r => !r.completed)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Obtém próximos lembretes
   */
  getUpcomingReminders(limit: number = 5): Reminder[] {
    const now = Date.now();
    return this.getAllReminders()
      .filter(r => r.timestamp > now)
      .slice(0, limit);
  }

  /**
   * Cancela todos os lembretes
   */
  clearAllReminders(): void {
    this.reminders.clear();
    console.log('🧹 Todos os lembretes cancelados');
  }

  /**
   * Inicia o verificador de lembretes
   */
  private startReminderChecker(): void {
    if (this.checkInterval) return;
    
    this.checkInterval = setInterval(() => {
      this.checkReminders();
    }, this.CHECK_INTERVAL_MS);
    
    console.log('⏰ Verificador de lembretes iniciado');
  }

  /**
   * Para o verificador
   */
  stopReminderChecker(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('⏰ Verificador de lembretes parado');
    }
  }

  /**
   * Verifica e dispara lembretes
   */
  private checkReminders(): void {
    const now = Date.now();
    
    this.reminders.forEach((reminder, id) => {
      if (reminder.completed) return;
      
      if (now >= reminder.timestamp) {
        this.triggerReminder(reminder);
        
        if (reminder.repeat === 'daily') {
          // Reagendar para amanhã
          reminder.timestamp = now + (24 * 60 * 60 * 1000);
          reminder.completed = false;
          console.log(`🔄 Lembrete diário reagendado para amanhã`);
        } else if (reminder.repeat === 'weekly') {
          // Reagendar para próxima semana
          reminder.timestamp = now + (7 * 24 * 60 * 60 * 1000);
          reminder.completed = false;
          console.log(`🔄 Lembrete semanal reagendado`);
        } else {
          reminder.completed = true;
        }
      }
    });
  }

  /**
   * Dispara notificação do lembrete
   */
  private triggerReminder(reminder: Reminder): void {
    console.log(`🔔 LEMBRETE: ${reminder.title}`);
    
    // Notificação nativa do Windows
    try {
      const notification = new Notification({
        title: '⏰ Karen - Lembrete',
        body: reminder.title,
        icon: undefined,
        timeoutType: 'never'
      });
      
      notification.show();
    } catch (error) {
      console.log('⚠️ Notificação nativa falhou:', error);
    }
  }

  /**
   * Formata tempo em string legível
   */
  private formatTime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}min`;
    if (minutes > 0) return `${minutes}min`;
    return `${seconds}s`;
  }

  /**
   * Parse de comandos de lembrete natural
   * Ex: "me lembre em 30 minutos", "alarme às 15h", "todo dia às 9h"
   */
  parseReminderCommand(text: string): { title: string; timeMs: number; repeat?: 'daily' | 'weekly' | 'once' } | null {
    const lower = text.toLowerCase();
    
    // Padrões comuns
    const patterns = [
      // "me lembre de [título] em [X] minutos/horas"
      {
        regex: /(?:me\s+)?lembre(?:-me)?\s+(?:de\s+)?(.+?)\s+em\s+(\d+)\s*(minutos?|mins?|horas?|hrs?|segundos?)/i,
        handler: (match: RegExpMatchArray) => {
          const title = match[1].trim();
          const value = parseInt(match[2]);
          const unit = match[3].toLowerCase();
          
          let ms = 0;
          if (unit.startsWith('min')) ms = value * 60 * 1000;
          else if (unit.startsWith('hora') || unit.startsWith('hr')) ms = value * 60 * 60 * 1000;
          else if (unit.startsWith('segundo')) ms = value * 1000;
          
          return { title, timeMs: ms };
        }
      },
      // "me avise em [X] minutos para [título]"
      {
        regex: /(?:me\s+)?avise\s+em\s+(\d+)\s*(minutos?|mins?|horas?|hrs?)\s+(?:para\s+)?(.+)/i,
        handler: (match: RegExpMatchArray) => {
          const value = parseInt(match[1]);
          const unit = match[2].toLowerCase();
          const title = match[3].trim();
          
          let ms = 0;
          if (unit.startsWith('min')) ms = value * 60 * 1000;
          else ms = value * 60 * 60 * 1000;
          
          return { title, timeMs: ms };
        }
      },
      // "alarme às [HH:MM]"
      {
        regex: /alarme\s+(?:às?|as)\s+(\d{1,2})[:h]?(\d{0,2})\s*(?:para\s+)?(.+)?/i,
        handler: (match: RegExpMatchArray) => {
          const hour = parseInt(match[1]);
          const minute = parseInt(match[2] || '0');
          const title = (match[3] || 'Alarme').trim();
          
          const target = new Date();
          target.setHours(hour, minute, 0, 0);
          
          let ms = target.getTime() - Date.now();
          if (ms < 0) ms += 24 * 60 * 60 * 1000; // Amanhã
          
          return { title, timeMs: ms };
        }
      },
      // "todo dia às [HH:MM]"
      {
        regex: /todo\s+dia\s+(?:às?|as)\s+(\d{1,2})[:h]?(\d{0,2})\s*(?:para\s+)?(.+)?/i,
        handler: (match: RegExpMatchArray) => {
          const hour = parseInt(match[1]);
          const minute = parseInt(match[2] || '0');
          const title = (match[3] || 'Lembrete diário').trim();
          
          const target = new Date();
          target.setHours(hour, minute, 0, 0);
          
          let ms = target.getTime() - Date.now();
          if (ms < 0) ms += 24 * 60 * 60 * 1000;
          
          return { title, timeMs: ms, repeat: 'daily' as const };
        }
      }
    ];

    for (const pattern of patterns) {
      const match = lower.match(pattern.regex);
      if (match) {
        return pattern.handler(match);
      }
    }

    return null;
  }
}

// Instância singleton
export const reminderController = new ReminderController();
