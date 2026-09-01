import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync, renameSync, unlinkSync, existsSync } from 'fs';
import { join, extname, basename } from 'path';
import { PDFDocument } from 'pdf-lib';

export class FileManager {
  private supportedExtensions = ['.pdf', '.txt', '.jpg', '.jpeg', '.png', '.gif', '.doc', '.docx', '.xls', '.xlsx', '.csv'];

  scanDirectory(dirPath: string, recursive: boolean = true): FileInfo[] {
    const files: FileInfo[] = [];

    if (!existsSync(dirPath)) {
      throw new Error('Diretório não encontrado: ' + dirPath);
    }

    const scan = (path: string) => {
      try {
        const items = readdirSync(path);

        for (const item of items) {
          const fullPath = join(path, item);
          
          try {
            const stats = statSync(fullPath);

            if (stats.isDirectory() && recursive) {
              scan(fullPath);
            } else if (stats.isFile() && this.supportedExtensions.includes(extname(item).toLowerCase())) {
              files.push({
                name: item,
                path: fullPath,
                extension: extname(item),
                size: stats.size,
                createdAt: stats.birthtime,
                modifiedAt: stats.mtime,
                type: this.getFileType(extname(item))
              });
            }
          } catch (error: any) {
            // Skip files/directories that can't be accessed (EPERM, ENOENT, etc.)
            console.log(`⚠️ Pulando ${fullPath}: ${error.message}`);
          }
        }
      } catch (error: any) {
        // Skip directories that can't be read
        console.log(`⚠️ Não foi possível ler ${path}: ${error.message}`);
      }
    };

    scan(dirPath);
    return files;
  }

  async readFileContent(filePath: string): Promise<string> {
    const ext = extname(filePath).toLowerCase();

    switch (ext) {
      case '.txt':
        return readFileSync(filePath, 'utf-8');
      case '.pdf':
        return await this.extractPDFText(filePath);
      case '.csv':
        return readFileSync(filePath, 'utf-8');
      default:
        throw new Error('Tipo de arquivo não suportado para leitura: ' + ext);
    }
  }

  private async extractPDFText(filePath: string): Promise<string> {
    try {
      const pdfBytes = readFileSync(filePath);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const pageCount = pdfDoc.getPageCount();
      
      return 'PDF com ' + pageCount + ' página(s). Extração de texto requer biblioteca adicional (pdf-parse)';
    } catch (error) {
      return 'Erro ao extrair texto do PDF: ' + error;
    }
  }

  organizeByDate(sourceDir: string, targetDir: string): OrganizationResult {
    const files = this.scanDirectory(sourceDir, false);
    let organized = 0;
    let errors = 0;

    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }

    for (const file of files) {
      try {
        const date = file.modifiedAt;
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const dateDir = join(targetDir, year.toString(), month);

        if (!existsSync(dateDir)) {
          mkdirSync(dateDir, { recursive: true });
        }

        const newPath = join(dateDir, file.name);
        renameSync(file.path, newPath);
        organized++;
      } catch (error) {
        errors++;
      }
    }

    return { organized, errors, total: files.length };
  }

  organizeByType(sourceDir: string, targetDir: string): OrganizationResult {
    const files = this.scanDirectory(sourceDir, false);
    let organized = 0;
    let errors = 0;

    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }

    for (const file of files) {
      try {
        const typeDir = join(targetDir, file.type);

        if (!existsSync(typeDir)) {
          mkdirSync(typeDir, { recursive: true });
        }

        const newPath = join(typeDir, file.name);
        renameSync(file.path, newPath);
        organized++;
      } catch (error) {
        errors++;
      }
    }

    return { organized, errors, total: files.length };
  }

  organizeByContext(sourceDir: string, targetDir: string, keywords: Record<string, string[]>): OrganizationResult {
    const files = this.scanDirectory(sourceDir, false);
    let organized = 0;
    let errors = 0;
    let uncategorized = 0;

    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }

    const uncategorizedDir = join(targetDir, 'outros');
    if (!existsSync(uncategorizedDir)) {
      mkdirSync(uncategorizedDir, { recursive: true });
    }

    for (const file of files) {
      try {
        let categorized = false;
        const content = this.tryReadFileContent(file.path);

        for (const [category, words] of Object.entries(keywords)) {
          for (const word of words) {
            if (file.name.toLowerCase().includes(word.toLowerCase()) || 
                content.toLowerCase().includes(word.toLowerCase())) {
              const categoryDir = join(targetDir, category);
              
              if (!existsSync(categoryDir)) {
                mkdirSync(categoryDir, { recursive: true });
              }

              const newPath = join(categoryDir, file.name);
              renameSync(file.path, newPath);
              organized++;
              categorized = true;
              break;
            }
          }

          if (categorized) break;
        }

        if (!categorized) {
          const newPath = join(uncategorizedDir, file.name);
          renameSync(file.path, newPath);
          uncategorized++;
        }
      } catch (error) {
        errors++;
      }
    }

    return { organized, errors, total: files.length, uncategorized };
  }

  private tryReadFileContent(filePath: string): string {
    try {
      const ext = extname(filePath).toLowerCase();
      if (ext === '.txt' || ext === '.csv') {
        return readFileSync(filePath, 'utf-8');
      }
      return '';
    } catch {
      return '';
    }
  }

  private getFileType(extension: string): string {
    const types: Record<string, string> = {
      '.pdf': 'documentos',
      '.txt': 'textos',
      '.doc': 'documentos',
      '.docx': 'documentos',
      '.jpg': 'imagens',
      '.jpeg': 'imagens',
      '.png': 'imagens',
      '.gif': 'imagens',
      '.xls': 'planilhas',
      '.xlsx': 'planilhas',
      '.csv': 'planilhas'
    };
    return types[extension] || 'outros';
  }

  deleteDuplicates(dirPath: string): { deleted: number; duplicates: string[] } {
    const files = this.scanDirectory(dirPath, false);
    const hashMap: Map<string, string[]> = new Map();
    const duplicates: string[] = [];

    for (const file of files) {
      try {
        const content = readFileSync(file.path);
        const hash = this.simpleHash(content);

        if (hashMap.has(hash)) {
          hashMap.get(hash)!.push(file.path);
          duplicates.push(file.path);
        } else {
          hashMap.set(hash, [file.path]);
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }

    let deleted = 0;
    for (const paths of hashMap.values()) {
      if (paths.length > 1) {
        for (let i = 1; i < paths.length; i++) {
          try {
            unlinkSync(paths[i]);
            deleted++;
          } catch (error) {
            // Skip deletion errors
          }
        }
      }
    }

    return { deleted, duplicates };
  }

  private simpleHash(content: Buffer): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }
}

interface FileInfo {
  name: string;
  path: string;
  extension: string;
  size: number;
  createdAt: Date;
  modifiedAt: Date;
  type: string;
}

interface OrganizationResult {
  organized: number;
  errors: number;
  total: number;
  uncategorized?: number;
}
