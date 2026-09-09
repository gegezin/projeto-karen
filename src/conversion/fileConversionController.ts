import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import * as XLSX from 'xlsx';
import { BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { PDFParse } from 'pdf-parse';
import { getPandocPath, getSevenZipPath } from '../main/binaryPaths';

const execAsync = promisify(exec);

const IMAGE_FORMATS = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'tiff', 'avif', 'svg'];
const DOCUMENT_FORMATS = ['md', 'html', 'htm', 'docx', 'odt', 'rtf', 'epub', 'txt', 'tex'];
const SPREADSHEET_FORMATS = ['csv', 'xlsx', 'xls', 'ods', 'tsv'];
const ARCHIVE_FORMATS = ['zip', '7z', 'tar', 'gz', 'bz2', 'rar'];

export interface ConversionResult {
  success: boolean;
  outputPath?: string;
  error?: string;
}

export class FileConversionController {
  private sevenZipPath: string | null = null;

  constructor() {
    this.locateSevenZip();
  }

  private locateSevenZip(): void {
    const candidates = [
      getSevenZipPath(),
      'C:\\Program Files\\7-Zip\\7z.exe',
      'C:\\Program Files (x86)\\7-Zip\\7z.exe',
      '7z'
    ];

    for (const candidate of candidates) {
      if (candidate === '7z' || fs.existsSync(candidate)) {
        this.sevenZipPath = candidate;
        return;
      }
    }

    console.warn('⚠️ 7-Zip não encontrado. Conversão de arquivos compactados ficará indisponível.');
  }

  async convert(inputPath: string, targetFormat: string, outputPath?: string): Promise<ConversionResult> {
    try {
      if (!fs.existsSync(inputPath)) {
        return { success: false, error: `Arquivo de origem não encontrado: ${inputPath}` };
      }

      const fromExt = path.extname(inputPath).slice(1).toLowerCase();
      const toExt = targetFormat.replace(/^\./, '').toLowerCase();
      const finalOutputPath = outputPath || inputPath.replace(/\.[^.]+$/, `.${toExt}`);

      await fs.promises.mkdir(path.dirname(finalOutputPath), { recursive: true });

      if (IMAGE_FORMATS.includes(fromExt) && IMAGE_FORMATS.includes(toExt) && toExt !== 'svg') {
        await this.convertImage(inputPath, finalOutputPath, toExt);
        return { success: true, outputPath: finalOutputPath };
      }
      if (IMAGE_FORMATS.includes(fromExt) && toExt === 'ico') {
        await this.convertImageToIco(inputPath, finalOutputPath);
        return { success: true, outputPath: finalOutputPath };
      }
      if (SPREADSHEET_FORMATS.includes(fromExt) && SPREADSHEET_FORMATS.includes(toExt)) {
        await this.convertSpreadsheet(inputPath, finalOutputPath);
        return { success: true, outputPath: finalOutputPath };
      }
      if (ARCHIVE_FORMATS.includes(fromExt) && ARCHIVE_FORMATS.includes(toExt)) {
        await this.convertArchive(inputPath, finalOutputPath, toExt);
        return { success: true, outputPath: finalOutputPath };
      }
      if (toExt === 'pdf' && DOCUMENT_FORMATS.includes(fromExt)) {
        await this.convertToPdf(inputPath, finalOutputPath, fromExt);
        return { success: true, outputPath: finalOutputPath };
      }
      if (fromExt === 'pdf' && DOCUMENT_FORMATS.includes(toExt)) {
        await this.convertFromPdf(inputPath, finalOutputPath, toExt);
        return { success: true, outputPath: finalOutputPath };
      }
      if (DOCUMENT_FORMATS.includes(fromExt) && DOCUMENT_FORMATS.includes(toExt)) {
        await this.convertDocument(inputPath, finalOutputPath);
        return { success: true, outputPath: finalOutputPath };
      }

      return {
        success: false,
        error: `Conversão de .${fromExt} para .${toExt} não é suportada. ${this.getSupportedConversions().join(' | ')}`
      };
    } catch (error: any) {
      console.error('❌ Erro na conversão de arquivo:', error);
      return { success: false, error: error.message || String(error) };
    }
  }

  private async convertImage(inputPath: string, outputPath: string, toExt: string): Promise<void> {
    const format: any = toExt === 'jpg' ? 'jpeg' : toExt;
    await sharp(inputPath).toFormat(format).toFile(outputPath);
  }

  private async convertImageToIco(inputPath: string, outputPath: string): Promise<void> {
    const sizes = [16, 32, 48, 64, 128, 256];
    const buffers = await Promise.all(
      sizes.map(size => sharp(inputPath).resize(size, size).png().toBuffer())
    );
    await fs.promises.writeFile(outputPath, await pngToIco(buffers));
  }

  private async convertSpreadsheet(inputPath: string, outputPath: string): Promise<void> {
    const workbook = XLSX.readFile(inputPath);
    XLSX.writeFile(workbook, outputPath);
  }

  private async runPandoc(inputPath: string, outputPath: string, extraArgs: string[] = []): Promise<void> {
    const args = [`"${inputPath}"`, '-o', `"${outputPath}"`, ...extraArgs].join(' ');
    try {
      await execAsync(`"${getPandocPath()}" ${args}`);
    } catch (error: any) {
      if (error.code === 'ENOENT' || error.message?.includes('not recognized')) {
        throw new Error('Pandoc não encontrado. Instale-o e reinicie o app.');
      }
      throw error;
    }
  }

  private async convertDocument(inputPath: string, outputPath: string): Promise<void> {
    await this.runPandoc(inputPath, outputPath);
  }

  private async convertToPdf(inputPath: string, outputPath: string, fromExt: string): Promise<void> {
    let htmlPath = inputPath;
    let tempHtml: string | null = null;

    if (fromExt !== 'html' && fromExt !== 'htm') {
      tempHtml = path.join(os.tmpdir(), `karen-conv-${Date.now()}.html`);
      await this.runPandoc(inputPath, tempHtml, ['--standalone']);
      htmlPath = tempHtml;
    }

    const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
    try {
      await win.loadFile(htmlPath);
      const pdfBuffer = await win.webContents.printToPDF({});
      await fs.promises.writeFile(outputPath, pdfBuffer);
    } finally {
      win.close();
      if (tempHtml) fs.promises.unlink(tempHtml).catch(() => {});
    }
  }

  private async convertFromPdf(inputPath: string, outputPath: string, toExt: string): Promise<void> {
    const parser = new PDFParse({ data: await fs.promises.readFile(inputPath) });
    const data = await parser.getText();
    await parser.destroy();
    if (toExt === 'txt') {
      await fs.promises.writeFile(outputPath, data.text, 'utf-8');
      return;
    }

    const tempTxt = path.join(os.tmpdir(), `karen-conv-${Date.now()}.txt`);
    await fs.promises.writeFile(tempTxt, data.text, 'utf-8');
    try {
      await this.runPandoc(tempTxt, outputPath);
    } finally {
      fs.promises.unlink(tempTxt).catch(() => {});
    }
  }

  private async convertArchive(inputPath: string, outputPath: string, toExt: string): Promise<void> {
    if (!this.sevenZipPath) {
      throw new Error('7-Zip não encontrado. Instale-o e reinicie o app.');
    }

    const tempDir = path.join(os.tmpdir(), `karen-extract-${Date.now()}`);
    await fs.promises.mkdir(tempDir, { recursive: true });
    try {
      await execAsync(`"${this.sevenZipPath}" x "${inputPath}" -o"${tempDir}" -y`);
      const typeFlag = toExt === 'zip' ? 'zip' : toExt === '7z' ? '7z' : toExt === 'tar' ? 'tar' : 'zip';
      await execAsync(`"${this.sevenZipPath}" a -t${typeFlag} "${outputPath}" "${path.join(tempDir, '*')}"`);
    } finally {
      fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  getSupportedConversions(): string[] {
    return [
      `Imagens entre si: ${IMAGE_FORMATS.filter(format => format !== 'svg').join(', ')} (svg só como entrada)`,
      'Imagem para .ico',
      `Documentos entre si: ${DOCUMENT_FORMATS.join(', ')}`,
      'Qualquer documento para .pdf, e .pdf para qualquer documento (texto puro, sem preservar layout visual original)',
      `Planilhas entre si: ${SPREADSHEET_FORMATS.join(', ')}`,
      `Arquivos compactados entre si: ${ARCHIVE_FORMATS.join(', ')}`
    ];
  }
}
