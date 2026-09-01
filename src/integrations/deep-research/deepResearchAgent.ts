/**
 * Agente de Pesquisa Autônomo (Deep Research)
 * Navega por múltiplas fontes para encontrar soluções unificadas
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

export interface ResearchSource {
  url: string;
  title: string;
  content: string;
  relevance: number;
  timestamp: string;
}

export interface ResearchResult {
  query: string;
  sources: ResearchSource[];
  summary: string;
  solution: string;
  confidence: number;
}

export class DeepResearchAgent {
  private maxSources = 5;
  private maxDepth = 2;
  private visitedUrls = new Set<string>();

  /**
   * Pesquisa profunda sobre um tópico
   */
  async deepResearch(query: string): Promise<ResearchResult> {
    console.log(`🔍 Iniciando pesquisa profunda: ${query}`);
    
    const sources: ResearchSource[] = [];
    
    // 1. Busca inicial no Google/DuckDuckGo
    const initialResults = await this.searchWeb(query);
    console.log(`📊 ${initialResults.length} resultados iniciais encontrados`);
    
    // 2. Extrair conteúdo das fontes principais
    for (const result of initialResults.slice(0, this.maxSources)) {
      if (this.visitedUrls.size >= this.maxSources) break;
      
      try {
        const content = await this.extractContent(result.url);
        if (content) {
          sources.push({
            url: result.url,
            title: result.title,
            content,
            relevance: this.calculateRelevance(query, content),
            timestamp: new Date().toISOString()
          });
          this.visitedUrls.add(result.url);
        }
      } catch (error) {
        console.log(`⚠️ Erro ao extrair ${result.url}:`, error);
      }
    }
    
    // 3. Cruzar informações e gerar solução
    const summary = this.generateSummary(sources);
    const solution = this.generateSolution(sources, query);
    const confidence = this.calculateConfidence(sources);
    
    return {
      query,
      sources,
      summary,
      solution,
      confidence
    };
  }

  /**
   * Busca na web (usando DuckDuckGo API)
   */
  private async searchWeb(query: string): Promise<Array<{ url: string; title: string }>> {
    try {
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=0`;
      const response = await axios.get(url);
      
      const results: Array<{ url: string; title: string }> = [];
      
      if (response.data.RelatedTopics) {
        response.data.RelatedTopics.forEach((topic: any) => {
          if (topic.FirstURL && topic.Text) {
            results.push({
              url: topic.FirstURL,
              title: topic.Text
            });
          }
        });
      }
      
      return results;
    } catch (error) {
      console.error('❌ Erro na busca web:', error);
      return [];
    }
  }

  /**
   * Extrai conteúdo de uma página
   */
  private async extractContent(url: string): Promise<string> {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      });
      
      const $ = cheerio.load(response.data);
      
      // Remover scripts e estilos
      $('script, style, nav, footer, header, aside').remove();
      
      // Extrair texto principal
      const text = $('body').text()
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 5000); // Limitar tamanho
      
      return text;
    } catch (error) {
      console.error(`❌ Erro ao extrair conteúdo de ${url}:`, error);
      return '';
    }
  }

  /**
   * Calcula relevância do conteúdo para a query
   */
  private calculateRelevance(query: string, content: string): number {
    const queryWords = query.toLowerCase().split(' ');
    const contentLower = content.toLowerCase();
    
    let matches = 0;
    queryWords.forEach(word => {
      if (contentLower.includes(word)) matches++;
    });
    
    return matches / queryWords.length;
  }

  /**
   * Gera resumo das fontes
   */
  private generateSummary(sources: ResearchSource[]): string {
    if (sources.length === 0) return 'Nenhuma fonte encontrada.';
    
    let summary = `Analisadas ${sources.length} fontes:\n`;
    sources.forEach((source, index) => {
      summary += `${index + 1}. ${source.title} (relevância: ${(source.relevance * 100).toFixed(0)}%)\n`;
    });
    
    return summary;
  }

  /**
   * Gera solução unificada
   */
  private generateSolution(sources: ResearchSource[], query: string): string {
    if (sources.length === 0) return 'Não foi possível encontrar uma solução.';
    
    // Ordenar por relevância
    const sorted = sources.sort((a, b) => b.relevance - a.relevance);
    
    // Combinar informações das fontes mais relevantes
    const topSources = sorted.slice(0, 3);
    let solution = `Solução baseada em ${topSources.length} fontes mais relevantes:\n\n`;
    
    topSources.forEach((source, index) => {
      solution += `Fonte ${index + 1}: ${source.title}\n`;
      solution += `${source.content.substring(0, 500)}...\n\n`;
    });
    
    return solution;
  }

  /**
   * Calcula confiança da solução
   */
  private calculateConfidence(sources: ResearchSource[]): number {
    if (sources.length === 0) return 0;
    
    const avgRelevance = sources.reduce((sum, s) => sum + s.relevance, 0) / sources.length;
    return Math.min(avgRelevance * 1.5, 1); // Boost se tiver múltiplas fontes
  }

  /**
   * Pesquisa específica para bugs de Minecraft
   */
  async researchMinecraftBug(bugDescription: string): Promise<ResearchResult> {
    const query = `Minecraft bug ${bugDescription} fix solution`;
    return this.deepResearch(query);
  }

  /**
   * Pesquisa específica para compatibilidade de mods
   */
  async researchModCompatibility(modName: string, minecraftVersion: string): Promise<ResearchResult> {
    const query = `${modName} minecraft ${minecraftVersion} compatibility issue`;
    return this.deepResearch(query);
  }
}

export const deepResearchAgent = new DeepResearchAgent();
