import { execSync } from 'child_process';
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * SchedulerController - Gerencia agendamento e execução de tarefas
 * 
 * Esta classe fornece um sistema de agendamento dinâmico para executar scripts
 * em horários específicos, utilizando cron jobs ou agendamento baseado em tempo.
 */
export class SchedulerController {
  private scheduledTasks: Map<string, ScheduledTask> = new Map();
  private cronJobs: Map<string, any> = new Map();
  private tasksFile: string;

  constructor() {
    this.tasksFile = join(__dirname, '../../memory/scheduled-tasks.json');
    this.loadTasks();
  }

  /**
   * Carrega tarefas agendadas do arquivo JSON
   */
  private loadTasks(): void {
    try {
      if (existsSync(this.tasksFile)) {
        const data = readFileSync(this.tasksFile, 'utf-8');
        const tasks = JSON.parse(data);
        
        for (const [id, task] of Object.entries(tasks)) {
          this.scheduledTasks.set(id, task as ScheduledTask);
        }
        
        console.log('Tarefas agendadas carregadas:', this.scheduledTasks.size);
      }
    } catch (error) {
      console.log('Nenhuma tarefa agendada encontrada');
      this.scheduledTasks = new Map();
    }
  }

  /**
   * Salva tarefas agendadas no arquivo JSON
   */
  private saveTasks(): void {
    try {
      const tasks: Record<string, ScheduledTask> = {};
      
      for (const [id, task] of this.scheduledTasks.entries()) {
        tasks[id] = task;
      }
      
      writeFileSync(this.tasksFile, JSON.stringify(tasks, null, 2));
      console.log('Tarefas agendadas salvas:', this.scheduledTasks.size);
    } catch (error) {
      console.error('Erro ao salvar tarefas:', error);
    }
  }

  /**
   * Agenda uma nova tarefa
   * @param task Dados da tarefa a ser agendada
   * @returns ID da tarefa agendada
   */
  scheduleTask(task: Omit<ScheduledTask, 'id' | 'createdAt' | 'status'>): string {
    const id = 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    const scheduledTask: ScheduledTask = {
      ...task,
      id,
      createdAt: new Date().toISOString(),
      status: 'pending'
    };
    
    this.scheduledTasks.set(id, scheduledTask);
    this.saveTasks();
    
    console.log('Tarefa agendada:', id, task.name);
    return id;
  }

  /**
   * Agenda tarefa com expressão cron
   * @param name Nome da tarefa
   * @param command Comando a ser executado
   * @param cronExpression Expressão cron (ex: "0 9 * * *" para todos os dias às 9h)
   * @returns ID da tarefa agendada
   */
  scheduleCronTask(
    name: string,
    command: string,
    cronExpression: string,
    description?: string
  ): string {
    return this.scheduleTask({
      name,
      command,
      type: 'cron',
      schedule: cronExpression,
      description
    });
  }

  /**
   * Agenda tarefa para execução única em data específica
   * @param name Nome da tarefa
   * @param command Comando a ser executado
   * @param executeAt Data/hora de execução (ISO string)
   * @returns ID da tarefa agendada
   */
  scheduleOneTimeTask(
    name: string,
    command: string,
    executeAt: string,
    description?: string
  ): string {
    return this.scheduleTask({
      name,
      command,
      type: 'one-time',
      schedule: executeAt,
      description
    });
  }

  /**
   * Agenda tarefa recorrente com intervalo
   * @param name Nome da tarefa
   * @param command Comando a ser executado
   * @param interval Intervalo em milissegundos
   * @returns ID da tarefa agendada
   */
  scheduleRecurringTask(
    name: string,
    command: string,
    interval: number,
    description?: string
  ): string {
    return this.scheduleTask({
      name,
      command,
      type: 'recurring',
      schedule: interval.toString(),
      description
    });
  }

  /**
   * Executa uma tarefa agendada
   * @param taskId ID da tarefa
   * @returns Resultado da execução
   */
  async executeTask(taskId: string): Promise<{
    success: boolean;
    output: string;
    error?: string;
  }> {
    const task = this.scheduledTasks.get(taskId);
    
    if (!task) {
      return {
        success: false,
        output: '',
        error: 'Tarefa não encontrada'
      };
    }

    try {
      task.status = 'running';
      task.lastRun = new Date().toISOString();
      this.saveTasks();

      const output = execSync(task.command, {
        encoding: 'utf-8',
        stdio: 'pipe'
      });

      task.status = 'completed';
      task.runCount = (task.runCount || 0) + 1;
      this.saveTasks();

      return {
        success: true,
        output
      };

    } catch (error: any) {
      task.status = 'failed';
      task.error = error.message;
      this.saveTasks();

      return {
        success: false,
        output: '',
        error: error.message
      };
    }
  }

  /**
   * Cancela uma tarefa agendada
   * @param taskId ID da tarefa
   * @returns Sucesso da operação
   */
  cancelTask(taskId: string): boolean {
    const task = this.scheduledTasks.get(taskId);
    
    if (!task) {
      return false;
    }

    task.status = 'cancelled';
    this.saveTasks();
    
    console.log('Tarefa cancelada:', taskId);
    return true;
  }

  /**
   * Remove uma tarefa permanentemente
   * @param taskId ID da tarefa
   * @returns Sucesso da operação
   */
  deleteTask(taskId: string): boolean {
    const deleted = this.scheduledTasks.delete(taskId);
    
    if (deleted) {
      this.saveTasks();
      console.log('Tarefa removida:', taskId);
    }
    
    return deleted;
  }

  /**
   * Lista todas as tarefas agendadas
   * @param status Filtrar por status (opcional)
   * @returns Lista de tarefas
   */
  listTasks(status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'): ScheduledTask[] {
    const tasks = Array.from(this.scheduledTasks.values());
    
    if (status) {
      return tasks.filter(task => task.status === status);
    }
    
    return tasks;
  }

  /**
   * Obtém detalhes de uma tarefa específica
   * @param taskId ID da tarefa
   * @returns Dados da tarefa ou null
   */
  getTask(taskId: string): ScheduledTask | null {
    return this.scheduledTasks.get(taskId) || null;
  }

  /**
   * Atualiza uma tarefa existente
   * @param taskId ID da tarefa
   * @param updates Dados a atualizar
   * @returns Sucesso da operação
   */
  updateTask(taskId: string, updates: Partial<ScheduledTask>): boolean {
    const task = this.scheduledTasks.get(taskId);
    
    if (!task) {
      return false;
    }

    Object.assign(task, updates);
    this.saveTasks();
    
    console.log('Tarefa atualizada:', taskId);
    return true;
  }

  /**
   * Limpa tarefas concluídas antigas
   * @param daysOld Remover tarefas completadas há mais de X dias
   * @returns Número de tarefas removidas
   */
  cleanupOldTasks(daysOld: number = 30): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    let removed = 0;
    
    for (const [id, task] of this.scheduledTasks.entries()) {
      if (task.status === 'completed' || task.status === 'cancelled') {
        const lastRun = task.lastRun ? new Date(task.lastRun) : new Date(task.createdAt);
        
        if (lastRun < cutoffDate) {
          this.scheduledTasks.delete(id);
          removed++;
        }
      }
    }
    
    if (removed > 0) {
      this.saveTasks();
      console.log('Tarefas antigas removidas:', removed);
    }
    
    return removed;
  }
}

interface ScheduledTask {
  id: string;
  name: string;
  command: string;
  type: 'cron' | 'one-time' | 'recurring';
  schedule: string; // cron expression, ISO date, or interval in ms
  description?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  createdAt: string;
  lastRun?: string;
  runCount?: number;
  error?: string;
}
