import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

/**
 * DocumentationGenerator - Gera documentação e testes unitários automaticamente
 * 
 * Esta classe analisa código Python/TypeScript e gera docstrings e arquivos de testes
 * utilizando análise estática e padrões de documentação.
 */
export class DocumentationGenerator {
  /**
   * Gera docstrings para um arquivo Python
   * @param filePath Caminho do arquivo Python
   * @returns Código com docstrings adicionadas
   */
  generatePythonDocstrings(filePath: string): string {
    const code = readFileSync(filePath, 'utf-8');
    return this.addPythonDocstrings(code);
  }

  /**
   * Gera JSDoc para um arquivo TypeScript/JavaScript
   * @param filePath Caminho do arquivo TypeScript/JavaScript
   * @returns Código com JSDoc adicionado
   */
  generateJSDoc(filePath: string): string {
    const code = readFileSync(filePath, 'utf-8');
    return this.addJSDoc(code);
  }

  /**
   * Gera arquivo de testes pytest para código Python
   * @param sourceFilePath Caminho do arquivo fonte
   * @param testFilePath Caminho do arquivo de teste
   */
  generatePytestTests(sourceFilePath: string, testFilePath: string): void {
    const code = readFileSync(sourceFilePath, 'utf-8');
    const tests = this.generatePythonTests(code, sourceFilePath);
    writeFileSync(testFilePath, tests, 'utf-8');
  }

  /**
   * Gera arquivo de testes Jest para código TypeScript/JavaScript
   * @param sourceFilePath Caminho do arquivo fonte
   * @param testFilePath Caminho do arquivo de teste
   */
  generateJestTests(sourceFilePath: string, testFilePath: string): void {
    const code = readFileSync(sourceFilePath, 'utf-8');
    const tests = this.generateTypeScriptTests(code, sourceFilePath);
    writeFileSync(testFilePath, tests, 'utf-8');
  }

  /**
   * Adiciona docstrings Python ao código
   */
  private addPythonDocstrings(code: string): string {
    const lines = code.split('\n');
    const result: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      result.push(line);

      // Detectar definição de função
      const funcMatch = line.match(/def\s+(\w+)\s*\(([^)]*)\)\s*(->\s*\w+)?\s*:/);
      if (funcMatch) {
        const funcName = funcMatch[1];
        const params = funcMatch[2];
        const docstring = this.generatePythonFunctionDocstring(funcName, params);
        
        // Adicionar docstring na próxima linha
        if (i + 1 < lines.length && !lines[i + 1].trim().startsWith('"""')) {
          result.push('    """' + docstring + '"""');
        }
      }

      // Detectar definição de classe
      const classMatch = line.match(/class\s+(\w+)\s*(\([^)]*\))?\s*:/);
      if (classMatch) {
        const className = classMatch[1];
        const docstring = this.generatePythonClassDocstring(className);
        
        if (i + 1 < lines.length && !lines[i + 1].trim().startsWith('"""')) {
          result.push('    """' + docstring + '"""');
        }
      }
    }

    return result.join('\n');
  }

  /**
   * Adiciona JSDoc ao código TypeScript/JavaScript
   */
  private addJSDoc(code: string): string {
    const lines = code.split('\n');
    const result: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detectar definição de função
      const funcMatch = line.match(/(?:function|const|let)\s+(\w+)\s*(?:=\s*)?\(([^)]*)\)(?:\s*:\s*(\w+))?/);
      if (funcMatch) {
        const funcName = funcMatch[1];
        const params = funcMatch[2];
        const returnType = funcMatch[3];
        const jsdoc = this.generateJSDocComment(funcName, params, returnType);
        
        // Adicionar JSDoc antes da função
        if (i === 0 || !lines[i - 1].trim().startsWith('*')) {
          result.push(jsdoc);
        }
      }

      // Detectar definição de classe
      const classMatch = line.match(/class\s+(\w+)/);
      if (classMatch) {
        const className = classMatch[1];
        const jsdoc = this.generateJSDocClassComment(className);
        
        if (i === 0 || !lines[i - 1].trim().startsWith('*')) {
          result.push(jsdoc);
        }
      }

      result.push(line);
    }

    return result.join('\n');
  }

  /**
   * Gera docstring para função Python
   */
  private generatePythonFunctionDocstring(funcName: string, params: string): string {
    const paramList = params.split(',').map(p => p.trim()).filter(p => p);
    const paramDocs = paramList.map(p => {
      const [name, ...rest] = p.split('=');
      return name.trim() + ': Parâmetro ' + (rest.length > 0 ? 'com valor padrão' : '');
    }).join('\n        ');

    return `
    ${funcName} - Descrição da função
    
    Args:
        ${paramDocs || 'Nenhum parâmetro'}
    
    Returns:
        Resultado da função
    
    Raises:
        Possíveis exceções
    `;
  }

  /**
   * Gera docstring para classe Python
   */
  private generatePythonClassDocstring(className: string): string {
    return `
    ${className} - Descrição da classe
    
    Atributos:
        Atributos da classe
    
    Métodos:
        Métodos da classe
    `;
  }

  /**
   * Gera comentário JSDoc para função
   */
  private generateJSDocComment(funcName: string, params: string, returnType?: string): string {
    const paramList = params.split(',').map(p => p.trim()).filter(p => p);
    const paramDocs = paramList.map(p => {
      const [name, ...rest] = p.split(':');
      return ` * @param {${rest[0] || 'any'}} ${name.trim()} - Parâmetro`;
    }).join('\n');

    return `/**
 * ${funcName} - Descrição da função
 *${paramDocs}
 * @returns {${returnType || 'any'}} Resultado da função
 */`;
  }

  /**
   * Gera comentário JSDoc para classe
   */
  private generateJSDocClassComment(className: string): string {
    return `/**
 * ${className} - Descrição da classe
 */`;
  }

  /**
   * Gera testes pytest para código Python
   */
  private generatePythonTests(code: string, sourceFilePath: string): string {
    const functions = this.extractPythonFunctions(code);
    const classes = this.extractPythonClasses(code);
    const moduleName = sourceFilePath.split('/').pop()?.replace('.py', '') || 'module';

    let tests = `import pytest
from ${moduleName} import ${functions.join(', ')}

`;

    // Gerar testes para funções
    functions.forEach(func => {
      tests += `
def test_${func}():
    """Teste para função ${func}"""
    # Arrange
    input_data = None
    
    # Act
    result = ${func}(input_data)
    
    # Assert
    assert result is not None
`;
    });

    // Gerar testes para classes
    classes.forEach(cls => {
      tests += `
def test_${cls.toLowerCase()}():
    """Teste para classe ${cls}"""
    instance = ${cls}()
    assert instance is not None
`;
    });

    return tests;
  }

  /**
   * Gera testes Jest para código TypeScript/JavaScript
   */
  private generateTypeScriptTests(code: string, sourceFilePath: string): string {
    const functions = this.extractTSFunctions(code);
    const classes = this.extractTSClasses(code);
    const moduleName = sourceFilePath.split('/').pop()?.replace('.ts', '') || 'module';

    let tests = `import { ${functions.join(', ')} } from './${moduleName}';

describe('${moduleName}', () => {
`;

    // Gerar testes para funções
    functions.forEach(func => {
      tests += `  describe('${func}', () => {
    it('should execute correctly', () => {
      // Arrange
      const input = null;
      
      // Act
      const result = ${func}(input);
      
      // Assert
      expect(result).toBeDefined();
    });
  });

`;
    });

    // Gerar testes para classes
    classes.forEach(cls => {
      tests += `  describe('${cls}', () => {
    it('should create instance', () => {
      const instance = new ${cls}();
      expect(instance).toBeDefined();
    });
  });

`;
    });

    tests += '});';

    return tests;
  }

  /**
   * Extrai nomes de funções Python
   */
  private extractPythonFunctions(code: string): string[] {
    const matches = code.match(/def\s+(\w+)\s*\(/g) || [];
    return matches.map(m => m.replace('def ', '').replace('(', ''));
  }

  /**
   * Extrai nomes de classes Python
   */
  private extractPythonClasses(code: string): string[] {
    const matches = code.match(/class\s+(\w+)/g) || [];
    return matches.map(m => m.replace('class ', ''));
  }

  /**
   * Extrai nomes de funções TypeScript/JavaScript
   */
  private extractTSFunctions(code: string): string[] {
    const matches = code.match(/(?:function|const|let)\s+(\w+)\s*(?:=\s*)?\(/g) || [];
    return matches.map(m => {
      const match = m.match(/(?:function|const|let)\s+(\w+)/);
      return match ? match[1] : '';
    }).filter(n => n);
  }

  /**
   * Extrai nomes de classes TypeScript/JavaScript
   */
  private extractTSClasses(code: string): string[] {
    const matches = code.match(/class\s+(\w+)/g) || [];
    return matches.map(m => m.replace('class ', ''));
  }
}
