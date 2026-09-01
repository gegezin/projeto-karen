import axios from 'axios';
import { writeFileSync } from 'fs';
import { join } from 'path';

export class WebScraper {
  private userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

  async scrapeUrl(url: string, options: ScrapingOptions = {}): Promise<ScrapingResult> {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': this.userAgent
        },
        timeout: options.timeout || 30000
      });

      const html = response.data;
      const title = this.extractTitle(html);
      const text = this.extractText(html);
      const links = this.extractLinks(html, url);
      const images = this.extractImages(html, url);
      const metadata = this.extractMetadata(html);

      const cleanedText = this.cleanText(text);
      const summary = this.generateSummary(cleanedText, options.summaryLength || 200);

      return {
        success: true,
        url,
        title,
        text: cleanedText,
        summary,
        links: links.slice(0, options.maxLinks || 20),
        images: images.slice(0, options.maxImages || 10),
        metadata,
        statusCode: response.status
      };
    } catch (error: any) {
      return {
        success: false,
        url,
        error: 'Erro ao fazer scraping: ' + error.message
      };
    }
  }

  async scrapeMultiple(urls: string[], options: ScrapingOptions = {}): Promise<ScrapingResult[]> {
    const results: ScrapingResult[] = [];

    for (const url of urls) {
      const result = await this.scrapeUrl(url, options);
      results.push(result);
    }

    return results;
  }

  async scrapeAndSave(url: string, outputPath: string, options: ScrapingOptions = {}): Promise<void> {
    const result = await this.scrapeUrl(url, options);

    if (result.success && result.text) {
      const content = `
URL: ${result.url}
Título: ${result.title}
Data: ${new Date().toISOString()}

=== CONTEÚDO ===
${result.text}

=== LINKS ===
${result.links?.map(l => l.url).join('\n') || ''}

=== METADADOS ===
${JSON.stringify(result.metadata, null, 2)}
`;

      writeFileSync(outputPath, content, 'utf-8');
    } else {
      throw new Error(result.error || 'Erro ao fazer scraping');
    }
  }

  private extractTitle(html: string): string {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return titleMatch ? titleMatch[1].trim() : '';
  }

  private extractText(html: string): string {
    let text = html;

    text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    text = text.replace(/<[^>]+>/g, ' ');
    text = text.replace(/\s+/g, ' ');
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");

    return text.trim();
  }

  private extractLinks(html: string, baseUrl: string): Link[] {
    const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi;
    const links: Link[] = [];
    let match;

    while ((match = linkRegex.exec(html)) !== null) {
      const href = match[1];
      const text = match[2].trim();
      const absoluteUrl = this.resolveUrl(href, baseUrl);

      if (absoluteUrl && this.isValidUrl(absoluteUrl)) {
        links.push({
          url: absoluteUrl,
          text: text || href
        });
      }
    }

    return links;
  }

  private extractImages(html: string, baseUrl: string): Image[] {
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    const images: Image[] = [];
    let match;

    while ((match = imgRegex.exec(html)) !== null) {
      const src = match[1];
      const absoluteUrl = this.resolveUrl(src, baseUrl);

      if (absoluteUrl && this.isValidUrl(absoluteUrl)) {
        const altMatch = match[0].match(/alt=["']([^"']*)["']/i);
        images.push({
          url: absoluteUrl,
          alt: altMatch ? altMatch[1] : ''
        });
      }
    }

    return images;
  }

  private extractMetadata(html: string): Metadata {
    const metadata: Metadata = {};

    const metaRegex = /<meta[^>]+name=["']([^"']+)["'][^>]+content=["']([^"']*)["'][^>]*>/gi;
    let match;

    while ((match = metaRegex.exec(html)) !== null) {
      metadata[match[1]] = match[2];
    }

    const ogRegex = /<meta[^>]+property=["']og:([^"']+)["'][^>]+content=["']([^"']*)["'][^>]*>/gi;
    
    while ((match = ogRegex.exec(html)) !== null) {
      metadata['og:' + match[1]] = match[2];
    }

    return metadata;
  }

  private cleanText(text: string): string {
    const lines = text.split('\n');
    const cleanedLines = lines
      .map(line => line.trim())
      .filter(line => line.length > 0);

    return cleanedLines.join('\n');
  }

  private generateSummary(text: string, maxLength: number): string {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim());
    
    if (sentences.length === 0) return text.substring(0, maxLength);
    
    let summary = '';
    let currentLength = 0;

    for (const sentence of sentences) {
      if (currentLength + sentence.length > maxLength) break;
      summary += sentence.trim() + '. ';
      currentLength += sentence.length;
    }

    return summary.trim() || text.substring(0, maxLength);
  }

  private resolveUrl(url: string, baseUrl: string): string | null {
    if (!url) return null;

    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    if (url.startsWith('//')) {
      const protocol = baseUrl.split(':')[0];
      return protocol + ':' + url;
    }

    if (url.startsWith('/')) {
      const base = new URL(baseUrl);
      return base.origin + url;
    }

    const base = new URL(baseUrl);
    return base.origin + '/' + url;
  }

  private isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  setUserAgent(userAgent: string): void {
    this.userAgent = userAgent;
  }
}

interface ScrapingOptions {
  timeout?: number;
  maxLinks?: number;
  maxImages?: number;
  summaryLength?: number;
}

interface ScrapingResult {
  success: boolean;
  url?: string;
  title?: string;
  text?: string;
  summary?: string;
  links?: Link[];
  images?: Image[];
  metadata?: Metadata;
  statusCode?: number;
  error?: string;
}

interface Link {
  url: string;
  text: string;
}

interface Image {
  url: string;
  alt: string;
}

interface Metadata {
  [key: string]: string;
}
