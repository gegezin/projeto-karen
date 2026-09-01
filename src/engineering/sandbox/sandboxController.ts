import { execSync } from 'child_process';
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

/**
 * SandboxController - Gerencia execução segura de código em ambiente isolado
 * 
 * Esta classe fornece um ambiente seguro para execução de código Python gerado pela IA,
 * utilizando Docker para isolamento completo do sistema principal.
 */
export class SandboxController {
  private dockerImage: string = 'python:3.11-slim';
  private timeout: number = 30000; // 30 segundos
  private maxMemory: string = '512m';

  constructor() {
    this.verifyDockerInstallation();
  }

  /**
   * Verifica se o Docker está instalado e disponível
   */
  private verifyDockerInstallation(): void {
    try {
      execSync('docker --version', { stdio: 'pipe' });
      console.log('✅ Docker verificado e disponível');
    } catch (error) {
      throw new Error('Docker não está instalado ou não está disponível no PATH');
    }
  }

  /**
   * Executa código Python em container Docker isolado
   * @param code Código Python a ser executado
   * @param input Entrada opcional para o código (stdin)
   * @returns Resultado da execução com stdout, stderr e código de saída
   */
  async executePythonCode(code: string, input?: string): Promise<{
    success: boolean;
    stdout: string;
    stderr: string;
    exitCode: number;
    executionTime: number;
  }> {
    const sessionId = randomUUID();
    const scriptPath = join(__dirname, `temp_${sessionId}.py`);
    const startTime = Date.now();

    try {
      // Escrever código em arquivo temporário
      writeFileSync(scriptPath, code, 'utf-8');

      // Preparar comando Docker
      const dockerCmd = [
        'docker', 'run',
        '--rm',
        '--memory', this.maxMemory,
        '--cpus', '1',
        '--network', 'none', // Sem acesso à rede
        '--read-only', // Sistema de arquivos somente leitura (exceto tmpfs)
        '--tmpfs', '/tmp',
        '-v', `${scriptPath}:/app/script.py:ro`,
        '-w', '/app',
        this.dockerImage,
        'timeout', `${this.timeout / 1000}s`,
        'python3', 'script.py'
      ];

      // Executar com input se fornecido
      const options: any = {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: this.timeout,
        encoding: 'utf-8'
      };

      if (input) {
        options.input = input;
      }

      const stdout = execSync(dockerCmd.join(' '), options);
      const executionTime = Date.now() - startTime;

      return {
        success: true,
        stdout: stdout.toString(),
        stderr: '',
        exitCode: 0,
        executionTime
      };

    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      
      // Tratar diferentes tipos de erro
      if (error.killed) {
        return {
          success: false,
          stdout: '',
          stderr: 'Execução cancelada por timeout',
          exitCode: 124,
          executionTime
        };
      }

      return {
        success: false,
        stdout: error.stdout?.toString() || '',
        stderr: error.stderr?.toString() || error.message,
        exitCode: error.status || 1,
        executionTime
      };

    } finally {
      // Limpar arquivo temporário
      if (existsSync(scriptPath)) {
        try {
          unlinkSync(scriptPath);
        } catch (cleanupError) {
          console.warn('⚠️ Erro ao limpar arquivo temporário:', cleanupError);
        }
      }
    }
  }

  /**
   * Executa código JavaScript/TypeScript em ambiente isolado
   * @param código Código JavaScript/TypeScript a ser executado
   * @returns Resultado da execução
   */
  async executeJavaScriptCode(code: string): Promise<{
    success: boolean;
    result: any;
    error?: string;
  }> {
    try {
      // Usar vm2 ou similar para isolamento de JavaScript
      // Por enquanto, implementação básica com eval (NÃO SEGURO para produção)
      // TODO: Implementar com vm2 ou similar para isolamento real
      
      const result = eval(code);
      
      return {
        success: true,
        result
      };

    } catch (error: any) {
      return {
        success: false,
        result: null,
        error: error.message
      };
    }
  }

  /**
   * Valida código Python antes da execução
   * @param code Código Python a validar
   * @returns Objeto com validação e erros encontrados
   */
  validatePythonCode(code: string): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Verificações básicas de segurança
    const dangerousPatterns = [
      /import\s+os/,
      /import\s+subprocess/,
      /import\s+shutil/,
      /exec\s*\(/,
      /eval\s*\(/,
      /__import__\s*\(/,
      /open\s*\(/,
      /\.write\s*\(/,
      /\.read\s*\(/,
      /system\s*\(/,
      /popen\s*\(/,
      /socket\./,
      /requests\./,
      /urllib\./,
      /http\./,
      /ftp\./
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        errors.push(`Padrão perigoso detectado: ${pattern.source}`);
      }
    }

    // Avisos
    if (code.includes('while True:')) {
      warnings.push('Loop infinito detectado - pode causar timeout');
    }

    if (code.includes('import sys')) {
      warnings.push('Import de sys detectado - uso restrito');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Configura timeout para execução
   * @param ms Timeout em milissegundos
   */
  setTimeout(ms: number): void {
    this.timeout = ms;
  }

  /**
   * Configura limite de memória
   * @param limit Limite de memória (ex: '512m', '1g')
   */
  setMemoryLimit(limit: string): void {
    this.maxMemory = limit;
  }

  /**
   * Configura imagem Docker
   * @param image Nome da imagem Docker
   */
  setDockerImage(image: string): void {
    this.dockerImage = image;
  }
}
