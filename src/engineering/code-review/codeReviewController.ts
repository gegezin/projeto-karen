import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * CodeReviewController - Gerencia revisão automatizada de código
 * 
 * Esta classe fornece análise de código para identificar bugs, problemas de segurança,
 * gargalos de performance e sugerir refatorações com Clean Code.
 */
export class CodeReviewController {
  private ollama: any;

  constructor() {
    // Ollama será injetado via KarenBrain
  }

  /**
   * Analisa um arquivo de código e retorna revisão detalhada
   * @param filePath Caminho do arquivo a analisar
   * @param language Linguagem de programação
   * @returns Revisão do código
   */
  async reviewCodeFile(filePath: string, language: string = 'typescript'): Promise<CodeReviewResult> {
    try {
      const code = readFileSync(filePath, 'utf-8');
      return this.reviewCode(code, language, filePath);
    } catch (error: any) {
      return {
        success: false,
        error: 'Erro ao ler arquivo: ' + error.message
      };
    }
  }

  /**
   * Analisa código fornecido como string
   * @param code Código a analisar
   * @param language Linguagem de programação
   * @param fileName Nome do arquivo (opcional)
   * @returns Revisão do código
   */
  async reviewCode(code: string, language: string = 'typescript', fileName?: string): Promise<CodeReviewResult> {
    const issues: CodeIssue[] = [];
    const suggestions: string[] = [];
    const metrics: CodeMetrics = this.calculateMetrics(code, language);

    // Análise estática básica
    issues.push(...this.detectBugs(code, language));
    issues.push(...this.detectSecurityIssues(code, language));
    issues.push(...this.detectPerformanceIssues(code, language));
    suggestions.push(...this.suggestRefactoring(code, language));

    // Análise de estilo e Clean Code
    suggestions.push(...this.checkCleanCode(code, language));

    return {
      success: true,
      fileName: fileName || 'unknown',
      language,
      metrics,
      issues: issues.filter(i => i.severity !== 'info'),
      suggestions,
      summary: this.generateSummary(issues, suggestions, metrics)
    };
  }

  /**
   * Calcula métricas básicas do código
   */
  private calculateMetrics(code: string, language: string): CodeMetrics {
    const lines = code.split('\n');
    const totalLines = lines.length;
    const codeLines = lines.filter(line => line.trim() && !line.trim().startsWith('//') && !line.trim().startsWith('#') && !line.trim().startsWith('*')).length;
    const commentLines = lines.filter(line => line.trim().startsWith('//') || line.trim().startsWith('#') || line.trim().startsWith('*')).length;
    const blankLines = lines.filter(line => !line.trim()).length;

    // Contar funções/métodos
    const functionMatches = code.match(/function\s+\w+|const\s+\w+\s*=\s*\(|class\s+\w+|def\s+\w+/g) || [];
    const functionCount = functionMatches.length;

    // Complexidade ciclomática aproximada
    const complexityKeywords = code.match(/if|for|while|case|catch|&&|\|\|/g) || [];
    const cyclomaticComplexity = complexityKeywords.length + 1;

    return {
      totalLines,
      codeLines,
      commentLines,
      blankLines,
      functionCount,
      cyclomaticComplexity,
      commentRatio: codeLines > 0 ? (commentLines / codeLines) * 100 : 0
    };
  }

  /**
   * Detecta bugs comuns no código
   */
  private detectBugs(code: string, language: string): CodeIssue[] {
    const issues: CodeIssue[] = [];

    // Variáveis não utilizadas
    const unusedVars = code.match(/(?:const|let|var)\s+(\w+)\s*=/g);
    if (unusedVars) {
      unusedVars.forEach(match => {
        const varName = match.match(/(?:const|let|var)\s+(\w+)\s*=/)?.[1];
        if (varName && !code.includes(varName + '.') && !code.includes(varName + '[') && code.split(varName).length < 3) {
          issues.push({
            type: 'bug',
            severity: 'warning',
            message: 'Variável possivelmente não utilizada: ' + varName,
            line: this.findLineNumber(code, match)
          });
        }
      });
    }

    // Comparação de igualdade fraca
    if (code.includes('==') && !code.includes('===')) {
      issues.push({
        type: 'bug',
        severity: 'warning',
        message: 'Uso de == em vez de === pode causar bugs de coerção de tipo',
        line: this.findLineNumber(code, '==')
      });
    }

    // Missing return statements
    const functions = code.match(/(?:function\s+\w+|const\s+\w+\s*=\s*\([^)]*\)\s*=>)/g);
    if (functions) {
      functions.forEach(func => {
        const funcStart = code.indexOf(func);
        const funcBody = code.substring(funcStart, funcStart + 500);
        if (!funcBody.includes('return') && !funcBody.includes('void')) {
          issues.push({
            type: 'bug',
            severity: 'info',
            message: 'Função pode estar faltando return statement',
            line: this.findLineNumber(code, func)
          });
        }
      });
    }

    return issues;
  }

  /**
   * Detecta problemas de segurança
   */
  private detectSecurityIssues(code: string, language: string): CodeIssue[] {
    const issues: CodeIssue[] = [];

    const securityPatterns = [
      { pattern: /eval\s*\(/, message: 'Uso de eval() é perigoso e pode levar a injeção de código' },
      { pattern: /innerHTML\s*=/, message: 'Uso de innerHTML pode levar a XSS se não sanitizado' },
      { pattern: /document\.write\s*\(/, message: 'document.write() pode sobrescrever o documento e é perigoso' },
      { pattern: /exec\s*\(/, message: 'exec() pode executar comandos arbitrários' },
      { pattern: /subprocess\./, message: 'Uso de subprocess requer validação cuidadosa de entrada' },
      { pattern: /os\.system\s*\(/, message: 'os.system() pode executar comandos arbitrários' },
      { pattern: /shell\s*=\s*true/, message: 'shell=true em subprocess é perigoso' },
      { pattern: /password\s*=/i, message: 'Senha em código fonte - use variáveis de ambiente' },
      { pattern: /api[_-]?key\s*=/i, message: 'API key em código fonte - use variáveis de ambiente' },
      { pattern: /secret\s*=/i, message: 'Segredo em código fonte - use variáveis de ambiente' }
    ];

    securityPatterns.forEach(({ pattern, message }) => {
      const match = code.match(pattern);
      if (match) {
        issues.push({
          type: 'security',
          severity: 'high',
          message: message,
          line: this.findLineNumber(code, match[0])
        });
      }
    });

    return issues;
  }

  /**
   * Detecta problemas de performance
   */
  private detectPerformanceIssues(code: string, language: string): CodeIssue[] {
    const issues: CodeIssue[] = [];

    // Loops aninhados profundos
    const nestedLoops = code.match(/for\s*\([^)]*\)\s*\{[\s\S]{0,500}for\s*\(/g);
    if (nestedLoops && nestedLoops.length > 0) {
      issues.push({
        type: 'performance',
        severity: 'warning',
        message: 'Loops aninhados podem causar problemas de performance O(n²)',
        line: this.findLineNumber(code, nestedLoops[0])
      });
    }

    // Operações em loop
    if (code.includes('.forEach') && code.includes('.map') && code.includes('.filter')) {
      issues.push({
        type: 'performance',
        severity: 'info',
        message: 'Múltiplas operações de array podem ser combinadas em uma única passagem',
        line: this.findLineNumber(code, '.forEach')
      });
    }

    // Criação de objetos em loop
    if (code.match(/for\s*\([^)]*\)\s*\{[\s\S]{0,200}new\s+\w+/)) {
      issues.push({
        type: 'performance',
        severity: 'warning',
        message: 'Criação de objetos dentro de loops pode causar GC pressure',
        line: this.findLineNumber(code, 'new ')
      });
    }

    return issues;
  }

  /**
   * Sugere refatorações
   */
  private suggestRefactoring(code: string, language: string): string[] {
    const suggestions: string[] = [];

    // Funções longas
    const lines = code.split('\n');
    if (lines.length > 50) {
      suggestions.push('Considere dividir funções longas em funções menores e mais focadas');
    }

    // Duplicação de código
    const repeatedPatterns = this.findRepeatedPatterns(code);
    if (repeatedPatterns.length > 0) {
      suggestions.push('Código duplicado detectado. Considere extrair para funções auxiliares');
    }

    // Nomes de variáveis curtos
    const shortVars = code.match(/\b[a-z]\b/g);
    if (shortVars && shortVars.length > 5) {
      suggestions.push('Use nomes de variáveis mais descritivos (evite single-letter variables)');
    }

    // Magic numbers
    const numbers = code.match(/\b\d{2,}\b/g);
    if (numbers && numbers.length > 3) {
      suggestions.push('Considere extrair números mágicos para constantes nomeadas');
    }

    return suggestions;
  }

  /**
   * Verifica princípios de Clean Code
   */
  private checkCleanCode(code: string, language: string): string[] {
    const suggestions: string[] = [];

    // Nomes descritivos
    const badNames = code.match(/\b(data|temp|info|obj|item|val)\b/g);
    if (badNames && badNames.length > 3) {
      suggestions.push('Use nomes mais descritivos em vez de nomes genéricos como "data", "temp", "info"');
    }

    // Funções com muitos parâmetros
    const longParams = code.match(/\([^)]{100,}\)/g);
    if (longParams) {
      suggestions.push('Funções com muitos parâmetros podem ser refatoradas usando objetos de configuração');
    }

    // Comentários desnecessários
    const commentLines = code.split('\n').filter(line => line.trim().startsWith('//') || line.trim().startsWith('#'));
    if (commentLines.length > code.split('\n').length * 0.3) {
      suggestions.push('Muitos comentários podem indicar código complexo. Considere refatorar para código auto-explicativo');
    }

    return suggestions;
  }

  /**
   * Encontra padrões repetidos no código
   */
  private findRepeatedPatterns(code: string): string[] {
    const lines = code.split('\n');
    const patterns: Map<string, number> = new Map();
    
    for (let i = 0; i < lines.length - 2; i++) {
      const pattern = lines[i] + lines[i + 1] + lines[i + 2];
      patterns.set(pattern, (patterns.get(pattern) || 0) + 1);
    }
    
    return Array.from(patterns.entries())
      .filter(([_, count]) => count > 1)
      .map(([pattern, _]) => pattern);
  }

  /**
   * Encontra o número da linha de um padrão no código
   */
  private findLineNumber(code: string, pattern: string): number {
    const lines = code.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(pattern)) {
        return i + 1;
      }
    }
    return 0;
  }

  /**
   * Gera resumo da revisão
   */
  private generateSummary(issues: CodeIssue[], suggestions: string[], metrics: CodeMetrics): string {
    const criticalIssues = issues.filter(i => i.severity === 'high').length;
    const warnings = issues.filter(i => i.severity === 'warning').length;
    
    let summary = `Análise concluída. `;
    summary += `Métricas: ${metrics.totalLines} linhas, ${metrics.functionCount} funções, complexidade ${metrics.cyclomaticComplexity}. `;
    
    if (criticalIssues > 0) {
      summary += `${criticalIssues} problema(s) crítico(s) encontrado(s). `;
    }
    
    if (warnings > 0) {
      summary += `${warnings} aviso(s) encontrado(s). `;
    }
    
    if (suggestions.length > 0) {
      summary += `${suggestions.length} sugestão(ões) de melhoria. `;
    }
    
    if (criticalIssues === 0 && warnings === 0) {
      summary += 'Código parece estar em bom estado.';
    }
    
    return summary;
  }
}

interface CodeReviewResult {
  success: boolean;
  fileName?: string;
  language?: string;
  metrics?: CodeMetrics;
  issues?: CodeIssue[];
  suggestions?: string[];
  summary?: string;
  error?: string;
}

interface CodeIssue {
  type: 'bug' | 'security' | 'performance' | 'style';
  severity: 'high' | 'warning' | 'info';
  message: string;
  line: number;
}

interface CodeMetrics {
  totalLines: number;
  codeLines: number;
  commentLines: number;
  blankLines: number;
  functionCount: number;
  cyclomaticComplexity: number;
  commentRatio: number;
}
