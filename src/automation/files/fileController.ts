import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { spawn } from 'child_process';

const execAsync = promisify(exec);

export interface FileInfo {
  name: string;
  path: string;
  size: number;
  isDirectory: boolean;
  modifiedTime: Date;
  createdTime: Date;
}

export class FileController {
  /**
   * Lê o conteúdo de um arquivo
   */
  async readFile(filePath: string): Promise<string> {
    try {
      const resolvedPath = path.resolve(filePath);
      return await fs.promises.readFile(resolvedPath, 'utf-8');
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
      const resolvedPath = path.resolve(filePath);
      return await fs.promises.readFile(resolvedPath);
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
      const resolvedPath = path.resolve(filePath);
      const dir = path.dirname(resolvedPath);
      
      // Criar diretório se não existir
      await fs.promises.mkdir(dir, { recursive: true });
      
      await fs.promises.writeFile(resolvedPath, content, 'utf-8');
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
      const resolvedPath = path.resolve(filePath);
      await fs.promises.appendFile(resolvedPath, content, 'utf-8');
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
      const resolvedPath = path.resolve(dirPath);
      await fs.promises.mkdir(resolvedPath, { recursive: true });
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
      const resolvedPath = path.resolve(filePath);
      await fs.promises.unlink(resolvedPath);
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
      const resolvedPath = path.resolve(dirPath);
      await fs.promises.rm(resolvedPath, { recursive, force: true });
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
      const resolvedOldPath = path.resolve(oldPath);
      const resolvedNewPath = path.resolve(newPath);
      await fs.promises.rename(resolvedOldPath, resolvedNewPath);
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
      const resolvedSource = path.resolve(sourcePath);
      const resolvedDest = path.resolve(destPath);
      
      // Criar diretório de destino se não existir
      await fs.promises.mkdir(path.dirname(resolvedDest), { recursive: true });
      
      await fs.promises.copyFile(resolvedSource, resolvedDest);
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
      const resolvedPath = path.resolve(dirPath);
      const entries = await fs.promises.readdir(resolvedPath, { withFileTypes: true });
      
      const fileInfos: FileInfo[] = [];
      
      for (const entry of entries) {
        const fullPath = path.join(resolvedPath, entry.name);
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
      const resolvedPath = path.resolve(filePath);
      await fs.promises.access(resolvedPath);
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
      const resolvedPath = path.resolve(dirPath);
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
      
      await search(resolvedPath);
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
      
      await search(dirPath);
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
      const resolvedPath = path.resolve(filePath);
      const stats = await fs.promises.stat(resolvedPath);
      
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
      const resolvedPath = path.resolve(dirPath);
      await execAsync(`explorer.exe "${resolvedPath}"`);
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
      const resolvedPath = path.resolve(filePath);
      spawn(`"${resolvedPath}"`, [], { shell: true, detached: true });
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
