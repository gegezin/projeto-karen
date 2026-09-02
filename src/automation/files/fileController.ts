import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { spawn } from 'child_process';
import { app } from 'electron';

const execAsync = promisify(exec);

export interface FileInfo {
  name: string;
  path: string;
  size: number;
  isDirectory: boolean;
  modifiedTime: Date;
  createdTime: Date;
}

/**
 * Configuração de segurança para acesso a arquivos
 * Define quais diretórios base são permitidos para operações de arquivo
 */
interface AllowedPathsConfig {
  /** Diretórios base permitidos (resolvidos absolutamente) */
  allowedBasePaths: string[];
  /** Se deve permitir acesso ao diretório do projeto atual */
  allowProjectDir: boolean;
  /** Se deve permitir acesso ao userData do Electron (configs, logs) */
  allowUserData: boolean;
  /** Se deve permitir acesso ao diretório home do usuário */
  allowHomeDir: boolean;
  /** Diretórios adicionais customizados permitidos */
  customAllowedPaths: string[];
}

const DEFAULT_ALLOWED_PATHS: AllowedPathsConfig = {
  allowedBasePaths: [],
  allowProjectDir: true,
  allowUserData: true,
  allowHomeDir: true,
  customAllowedPaths: [],
};

export class FileController {
  private allowedPathsConfig: AllowedPathsConfig;
  private resolvedAllowedPaths: string[] = [];

  constructor(config?: Partial<AllowedPathsConfig>) {
    this.allowedPathsConfig = { ...DEFAULT_ALLOWED_PATHS, ...config };
    this.initializeAllowedPaths();
  }

  /**
   * Inicializa e resolve todos os caminhos permitidos
   */
  private initializeAllowedPaths(): void {
    const paths: string[] = [];

    if (this.allowedPathsConfig.allowProjectDir) {
      // Diretório do projeto (onde está o package.json)
      paths.push(process.cwd());
      paths.push(path.join(process.cwd(), 'src'));
      paths.push(path.join(process.cwd(), 'dist'));
    }

    if (this.allowedPathsConfig.allowUserData) {
      try {
        const userDataPath = app.getPath('userData');
        paths.push(userDataPath);
      } catch {
        // app pode não estar disponível em alguns contextos
      }
    }

    if (this.allowedPathsConfig.allowHomeDir) {
      const homeDir = process.env.USERPROFILE || process.env.HOME;
      if (homeDir) {
        paths.push(homeDir);
      }
    }

    // Adicionar caminhos customizados
    paths.push(...this.allowedPathsConfig.customAllowedPaths);
    paths.push(...this.allowedPathsConfig.allowedBasePaths);

    // Resolver e normalizar todos os caminhos
    this.resolvedAllowedPaths = paths
      .map(p => path.resolve(p))
      .filter((p, i, arr) => arr.indexOf(p) === i); // Remove duplicatas

    console.log('📁 FileController - Diretórios permitidos:', this.resolvedAllowedPaths);
  }

  /**
   * Adiciona um diretório permitido customizado
   */
  addAllowedPath(dirPath: string): void {
    const resolved = path.resolve(dirPath);
    if (!this.resolvedAllowedPaths.includes(resolved)) {
      this.resolvedAllowedPaths.push(resolved);
      this.allowedPathsConfig.customAllowedPaths.push(dirPath);
      console.log('📁 FileController - Adicionado diretório permitido:', resolved);
    }
  }

  /**
   * Valida se um caminho está dentro dos diretórios permitidos
   * Proteção contra Path Traversal (ex: ../../etc/passwd)
   */
  private validatePath(filePath: string, operation: string): string {
    const resolvedPath = path.resolve(filePath);
    
    // Verificar se o caminho resolvido está dentro de algum diretório permitido
    const isAllowed = this.resolvedAllowedPaths.some(allowedPath => {
      // Normalizar para comparação (Windows: case-insensitive)
      const normalizedAllowed = allowedPath.toLowerCase();
      const normalizedResolved = resolvedPath.toLowerCase();
      
      // Verificar se é exatamente o diretório ou está dentro dele
      return normalizedResolved === normalizedAllowed || 
             normalizedResolved.startsWith(normalizedAllowed + path.sep);
    });

    if (!isAllowed) {
      const errorMsg = `🚫 ACESSO NEGADO (Path Traversal): ${operation} - Caminho "${resolvedPath}" não está em diretórios permitidos`;
      console.error(errorMsg);
      console.error('📁 Diretórios permitidos:', this.resolvedAllowedPaths);
      throw new Error(`Acesso negado: operação "${operation}" não permitida fora dos diretórios autorizados`);
    }

    return resolvedPath;
  }

  /**
   * Lê o conteúdo de um arquivo
   */
  async readFile(filePath: string): Promise<string> {
    try {
      const safePath = this.validatePath(filePath, 'readFile');
      return await fs.promises.readFile(safePath, 'utf-8');
    } catch (error) {
      console.error('Erro ao ler arquivo:', error);
      throw error;
    }
  }

  /**
   * Lê arquivo como buffer (para arquivos binários)
   */
  async readFileBuffer(filePath: string): Promise<Buffer> {
    try {
      const safePath = this.validatePath(filePath, 'readFileBuffer');
      return await fs.promises.readFile(safePath);
    } catch (error) {
      console.error('Erro ao ler arquivo binário:', error);
      throw error;
    }
  }

  /**
   * Escreve conteúdo em um arquivo
   */
  async writeFile(filePath: string, content: string): Promise<void> {
    try {
      const safePath = this.validatePath(filePath, 'writeFile');
      const dir = path.dirname(safePath);
      
      // Criar diretório se não existir
      await fs.promises.mkdir(dir, { recursive: true });
      
      await fs.promises.writeFile(safePath, content, 'utf-8');
    } catch (error) {
      console.error('Erro ao escrever arquivo:', error);
      throw error;
    }
  }

  /**
   * Anexa conteúdo a um arquivo
   */
  async appendFile(filePath: string, content: string): Promise<void> {
    try {
      const safePath = this.validatePath(filePath, 'appendFile');
      await fs.promises.appendFile(safePath, content, 'utf-8');
    } catch (error) {
      console.error('Erro ao anexar ao arquivo:', error);
      throw error;
    }
  }

  /**
   * Cria ou edita um arquivo de código
   */
  async editCodeFile(filePath: string, operations: Array<{ action: 'replace' | 'insert' | 'delete'; lineStart?: number; lineEnd?: number; content?: string; search?: string }>): Promise<void> {
    try {
      let content = '';
      
      // Ler arquivo existente ou criar novo
      try {
        content = await this.readFile(filePath);
      } catch {
        // Arquivo não existe, será criado
      }

      let lines = content.split('\n');

      for (const op of operations) {
        switch (op.action) {
          case 'replace':
            if (op.search) {
              // Replace por busca de texto
              content = content.replace(op.search, op.content || '');
              lines = content.split('\n');
            } else if (op.lineStart !== undefined && op.lineEnd !== undefined) {
              // Replace por linhas
              const newLines = op.content?.split('\n') || [];
              lines.splice(op.lineStart - 1, op.lineEnd - op.lineStart + 1, ...newLines);
            }
            break;

          case 'insert':
            if (op.lineStart !== undefined) {
              const insertLines = op.content?.split('\n') || [];
              lines.splice(op.lineStart - 1, 0, ...insertLines);
            }
            break;

          case 'delete':
            if (op.lineStart !== undefined && op.lineEnd !== undefined) {
              lines.splice(op.lineStart - 1, op.lineEnd - op.lineStart + 1);
            }
            break;
        }
      }

      await this.writeFile(filePath, lines.join('\n'));
    } catch (error) {
      console.error('Erro ao editar arquivo:', error);
      throw error;
    }
  }

  /**
   * Cria um diretório
   */
  async createDirectory(dirPath: string): Promise<void> {
    try {
      const safePath = this.validatePath(dirPath, 'createDirectory');
      await fs.promises.mkdir(safePath, { recursive: true });
    } catch (error) {
      console.error('Erro ao criar diretório:', error);
      throw error;
    }
  }

  /**
   * Deleta um arquivo
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      const safePath = this.validatePath(filePath, 'deleteFile');
      await fs.promises.unlink(safePath);
    } catch (error) {
      console.error('Erro ao deletar arquivo:', error);
      throw error;
    }
  }

  /**
   * Deleta um diretório
   */
  async deleteDirectory(dirPath: string, recursive: boolean = false): Promise<void> {
    try {
      const safePath = this.validatePath(dirPath, 'deleteDirectory');
      await fs.promises.rm(safePath, { recursive, force: true });
    } catch (error) {
      console.error('Erro ao deletar diretório:', error);
      throw error;
    }
  }

  /**
   * Renomeia/move um arquivo ou diretório
   */
  async rename(oldPath: string, newPath: string): Promise<void> {
    try {
      const safeOldPath = this.validatePath(oldPath, 'rename (source)');
      const safeNewPath = this.validatePath(newPath, 'rename (dest)');
      await fs.promises.rename(safeOldPath, safeNewPath);
    } catch (error) {
      console.error('Erro ao renomear:', error);
      throw error;
    }
  }

  /**
   * Copia um arquivo
   */
  async copyFile(sourcePath: string, destPath: string): Promise<void> {
    try {
      const safeSource = this.validatePath(sourcePath, 'copyFile (source)');
      const safeDest = this.validatePath(destPath, 'copyFile (dest)');
      
      // Criar diretório de destino se não existir
      await fs.promises.mkdir(path.dirname(safeDest), { recursive: true });
      
      await fs.promises.copyFile(safeSource, safeDest);
    } catch (error) {
      console.error('Erro ao copiar arquivo:', error);
      throw error;
    }
  }

  /**
   * Lista conteúdo de um diretório
   */
  async listDirectory(dirPath: string): Promise<FileInfo[]> {
    try {
      const safePath = this.validatePath(dirPath, 'listDirectory');
      const entries = await fs.promises.readdir(safePath, { withFileTypes: true });
      
      const fileInfos: FileInfo[] = [];
      
      for (const entry of entries) {
        const fullPath = path.join(safePath, entry.name);
        const stats = await fs.promises.stat(fullPath);
        
        fileInfos.push({
          name: entry.name,
          path: fullPath,
          size: stats.size,
          isDirectory: entry.isDirectory(),
          modifiedTime: stats.mtime,
          createdTime: stats.birthtime
        });
      }
      
      return fileInfos;
    } catch (error) {
      console.error('Erro ao listar diretório:', error);
      throw error;
    }
  }

  /**
   * Verifica se arquivo existe
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      const safePath = this.validatePath(filePath, 'fileExists');
      await fs.promises.access(safePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Busca arquivos recursivamente
   */
  async searchFiles(dirPath: string, pattern: string): Promise<string[]> {
    try {
      const safePath = this.validatePath(dirPath, 'searchFiles');
      const results: string[] = [];
      
      const search = async (currentPath: string) => {
        const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name);
          
          if (entry.isDirectory()) {
            await search(fullPath);
          } else if (entry.name.toLowerCase().includes(pattern.toLowerCase())) {
            results.push(fullPath);
          }
        }
      };
      
      await search(safePath);
      return results;
    } catch (error) {
      console.error('Erro ao buscar arquivos:', error);
      return [];
    }
  }

  /**
   * Encontra arquivo por nome em diretórios comuns
   */
  async findFile(fileName: string): Promise<string | null> {
    const searchPaths = [
      process.cwd(),
      path.join(process.cwd(), 'src'),
      path.join(process.cwd(), 'dist'),
      'C:\\Users\\gegef\\.vscode\\ia-assistant',
    ];

    for (const searchPath of searchPaths) {
      try {
        // Verificar se o diretório existe antes de buscar
        if (!fs.existsSync(searchPath)) {
          continue;
        }
        
        const results = await this.searchFiles(searchPath, fileName);
        if (results.length > 0) {
          console.log(`Arquivo encontrado: ${results[0]}`);
          return results[0];
        }
      } catch (error) {
        // Continua para o próximo caminho
        console.log(`Erro ao buscar em ${searchPath}:`, error);
        continue;
      }
    }

    return null;
  }

  /**
   * Busca conteúdo dentro de arquivos
   */
  async searchInFiles(dirPath: string, searchTerm: string, extensions: string[] = ['.txt', '.js', '.ts', '.json', '.md']): Promise<Array<{ file: string; line: number; content: string }>> {
    const results: Array<{ file: string; line: number; content: string }> = [];
    
    try {
      const safePath = this.validatePath(dirPath, 'searchInFiles');
      
      const search = async (currentPath: string) => {
        const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name);
          
          if (entry.isDirectory()) {
            await search(fullPath);
          } else if (extensions.includes(path.extname(entry.name).toLowerCase())) {
            try {
              const content = await this.readFile(fullPath);
              const lines = content.split('\n');
              
              lines.forEach((line, index) => {
                if (line.toLowerCase().includes(searchTerm.toLowerCase())) {
                  results.push({
                    file: fullPath,
                    line: index + 1,
                    content: line.trim()
                  });
                }
              });
            } catch {
              // Ignora arquivos que não conseguir ler
            }
          }
        }
      };
      
      await search(safePath);
    } catch (error) {
      console.error('Erro ao buscar em arquivos:', error);
    }
    
    return results;
  }

  /**
   * Obtém estatísticas de arquivo
   */
  async getFileStats(filePath: string): Promise<{
    size: number;
    created: Date;
    modified: Date;
    accessed: Date;
    isFile: boolean;
    isDirectory: boolean;
  }> {
    try {
      const safePath = this.validatePath(filePath, 'getFileStats');
      const stats = await fs.promises.stat(safePath);
      
      return {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        accessed: stats.atime,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory()
      };
    } catch (error) {
      console.error('Erro ao obter estatísticas:', error);
      throw error;
    }
  }

  /**
   * Abre pasta no Explorer
   */
  async openInExplorer(dirPath: string): Promise<void> {
    try {
      const safePath = this.validatePath(dirPath, 'openInExplorer');
      await execAsync(`explorer.exe "${safePath}"`);
    } catch (error) {
      console.error('Erro ao abrir Explorer:', error);
      throw error;
    }
  }

  /**
   * Executa um arquivo (com o programa associado)
   */
  async executeFile(filePath: string): Promise<void> {
    try {
      const safePath = this.validatePath(filePath, 'executeFile');
      spawn(`"${safePath}"`, [], { shell: true, detached: true });
    } catch (error) {
      console.error('Erro ao executar arquivo:', error);
      throw error;
    }
  }

  /**
   * Compacta arquivos (usando PowerShell)
   */
  async compressFiles(sourcePath: string, destPath: string): Promise<void> {
    try {
      const resolvedSource = path.resolve(sourcePath);
      const resolvedDest = path.resolve(destPath);
      
      const psScript = `Compress-Archive -Path "${resolvedSource}" -DestinationPath "${resolvedDest}" -Force`;
      await execAsync(`powershell.exe -Command "${psScript}"`);
    } catch (error) {
      console.error('Erro ao compactar:', error);
      throw error;
    }
  }

  /**
   * Descompacta arquivo
   */
  async extractArchive(archivePath: string, destPath: string): Promise<void> {
    try {
      const resolvedArchive = path.resolve(archivePath);
      const resolvedDest = path.resolve(destPath);
      
      const psScript = `Expand-Archive -Path "${resolvedArchive}" -DestinationPath "${resolvedDest}" -Force`;
      await execAsync(`powershell.exe -Command "${psScript}"`);
    } catch (error) {
      console.error('Erro ao extrair:', error);
      throw error;
    }
  }
}
