import { readFileSync } from 'fs';
import { join } from 'path';

export class SpreadsheetAnalyzer {
  async analyzeCSV(filePath: string): Promise<AnalysisResult> {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        throw new Error('Arquivo CSV vazio');
      }

      const headers = this.parseCSVLine(lines[0]);
      const data = lines.slice(1).map(line => this.parseCSVLine(line));
      
      const columnTypes = this.detectColumnTypes(headers, data);
      const statistics = this.calculateStatistics(headers, data, columnTypes);
      const summary = this.generateSummary(headers, data, statistics);

      return {
        success: true,
        headers,
        rowCount: data.length,
        columnCount: headers.length,
        columnTypes,
        statistics,
        summary,
        data: data.slice(0, 10)
      };
    } catch (error: any) {
      return {
        success: false,
        error: 'Erro ao analisar CSV: ' + error.message
      };
    }
  }

  async queryCSV(filePath: string, query: string): Promise<QueryResult> {
    try {
      const analysis = await this.analyzeCSV(filePath);
      
      if (!analysis.success || !analysis.data || !analysis.headers || !analysis.columnTypes) {
        throw new Error('Não foi possível ler os dados');
      }

      const headers = analysis.headers;
      const data = analysis.data;
      const columnTypes = analysis.columnTypes;
      const lowerQuery = query.toLowerCase();
      let results: any[] = [];
      let explanation = '';

      if (lowerQuery.includes('quantas linhas') || lowerQuery.includes('total de linhas')) {
        results = [{ metric: 'total_linhas', value: analysis.rowCount }];
        explanation = 'Total de linhas no arquivo: ' + analysis.rowCount;
      } else if (lowerQuery.includes('quantas colunas') || lowerQuery.includes('total de colunas')) {
        results = [{ metric: 'total_colunas', value: analysis.columnCount }];
        explanation = 'Total de colunas no arquivo: ' + analysis.columnCount;
      } else if (lowerQuery.includes('média') || lowerQuery.includes('media')) {
        const numericColumns = headers.filter((h, i) => 
          columnTypes[i] === 'number'
        );
        
        if (numericColumns.length > 0) {
          const means = numericColumns.map(col => {
            const idx = headers.indexOf(col);
            const values = data.map(row => parseFloat(row[idx])).filter(v => !isNaN(v));
            const mean = values.reduce((a, b) => a + b, 0) / values.length;
            return { column: col, mean: mean.toFixed(2) };
          });
          results = means;
          explanation = 'Média das colunas numéricas';
        }
      } else if (lowerQuery.includes('soma') || lowerQuery.includes('total')) {
        const numericColumns = headers.filter((h, i) => 
          columnTypes[i] === 'number'
        );
        
        if (numericColumns.length > 0) {
          const sums = numericColumns.map(col => {
            const idx = headers.indexOf(col);
            const values = data.map(row => parseFloat(row[idx])).filter(v => !isNaN(v));
            const sum = values.reduce((a, b) => a + b, 0);
            return { column: col, sum: sum.toFixed(2) };
          });
          results = sums;
          explanation = 'Soma das colunas numéricas';
        }
      } else if (lowerQuery.includes('max') || lowerQuery.includes('maior') || lowerQuery.includes('máximo')) {
        const numericColumns = headers.filter((h, i) => 
          columnTypes[i] === 'number'
        );
        
        if (numericColumns.length > 0) {
          const maxes = numericColumns.map(col => {
            const idx = headers.indexOf(col);
            const values = data.map(row => parseFloat(row[idx])).filter(v => !isNaN(v));
            const max = Math.max(...values);
            return { column: col, max };
          });
          results = maxes;
          explanation = 'Valores máximos das colunas numéricas';
        }
      } else if (lowerQuery.includes('min') || lowerQuery.includes('menor') || lowerQuery.includes('mínimo')) {
        const numericColumns = headers.filter((h, i) => 
          columnTypes[i] === 'number'
        );
        
        if (numericColumns.length > 0) {
          const mins = numericColumns.map(col => {
            const idx = headers.indexOf(col);
            const values = data.map(row => parseFloat(row[idx])).filter(v => !isNaN(v));
            const min = Math.min(...values);
            return { column: col, min };
          });
          results = mins;
          explanation = 'Valores mínimos das colunas numéricas';
        }
      } else {
        explanation = 'Query não reconhecida. Tente perguntar sobre: total de linhas, média, soma, máximo, mínimo';
      }

      return {
        success: true,
        results,
        explanation
      };
    } catch (error: any) {
      return {
        success: false,
        error: 'Erro ao processar query: ' + error.message
      };
    }
  }

  async filterCSV(filePath: string, filters: Record<string, any>): Promise<FilterResult> {
    try {
      const analysis = await this.analyzeCSV(filePath);
      
      if (!analysis.success || !analysis.data || !analysis.headers) {
        throw new Error('Não foi possível ler os dados');
      }

      const headers = analysis.headers;
      const data = analysis.data;
      const filteredData = data.filter(row => {
        return Object.entries(filters).every(([column, value]) => {
          const colIndex = headers.indexOf(column);
          if (colIndex === -1) return false;
          
          const cellValue = row[colIndex];
          
          if (typeof value === 'string' && value.includes('>')) {
            const numValue = parseFloat(value.replace('>', '').trim());
            return parseFloat(cellValue) > numValue;
          } else if (typeof value === 'string' && value.includes('<')) {
            const numValue = parseFloat(value.replace('<', '').trim());
            return parseFloat(cellValue) < numValue;
          } else if (typeof value === 'string' && value.includes('=')) {
            return cellValue === value.replace('=', '').trim();
          } else {
            return cellValue.toString().toLowerCase().includes(value.toString().toLowerCase());
          }
        });
      });

      return {
        success: true,
        filteredRows: filteredData.length,
        totalRows: analysis.rowCount,
        data: filteredData
      };
    } catch (error: any) {
      return {
        success: false,
        error: 'Erro ao filtrar dados: ' + error.message
      };
    }
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }

  private detectColumnTypes(headers: string[], data: string[][]): string[] {
    return headers.map((_, colIndex) => {
      const values = data.map(row => row[colIndex]).filter(v => v);
      
      if (values.length === 0) return 'unknown';
      
      const numericCount = values.filter(v => !isNaN(parseFloat(v))).length;
      const dateCount = values.filter(v => !isNaN(Date.parse(v))).length;
      
      if (numericCount / values.length > 0.8) return 'number';
      if (dateCount / values.length > 0.8) return 'date';
      return 'string';
    });
  }

  private calculateStatistics(headers: string[], data: string[][], columnTypes: string[]): ColumnStatistics[] {
    return headers.map((header, index) => {
      const values = data.map(row => row[index]).filter(v => v);
      const type = columnTypes[index];

      if (type === 'number') {
        const numericValues = values.map(v => parseFloat(v)).filter(v => !isNaN(v));
        const sum = numericValues.reduce((a, b) => a + b, 0);
        const mean = sum / numericValues.length;
        const sorted = [...numericValues].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        const min = Math.min(...numericValues);
        const max = Math.max(...numericValues);

        return {
          column: header,
          type,
          count: numericValues.length,
          sum: sum.toFixed(2),
          mean: mean.toFixed(2),
          median: median.toFixed(2),
          min,
          max
        };
      }

      const uniqueValues = [...new Set(values)];
      const valueCounts: Record<string, number> = {};
      
      values.forEach(v => {
        valueCounts[v] = (valueCounts[v] || 0) + 1;
      });

      return {
        column: header,
        type,
        count: values.length,
        unique: uniqueValues.length,
        topValues: Object.entries(valueCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([value, count]) => ({ value, count }))
      };
    });
  }

  private generateSummary(headers: string[], data: string[][], statistics: ColumnStatistics[]): string {
    let summary = 'Análise do CSV:\n';
    summary += '- Total de linhas: ' + data.length + '\n';
    summary += '- Total de colunas: ' + headers.length + '\n';
    summary += '- Colunas: ' + headers.join(', ') + '\n\n';
    
    summary += 'Estatísticas por coluna:\n';
    statistics.forEach(stat => {
      summary += '\n' + stat.column + ' (' + stat.type + '):\n';
      summary += '  - Registros: ' + stat.count + '\n';
      
      if (stat.type === 'number') {
        summary += '  - Média: ' + stat.mean + '\n';
        summary += '  - Mínimo: ' + stat.min + '\n';
        summary += '  - Máximo: ' + stat.max + '\n';
      } else {
        summary += '  - Valores únicos: ' + stat.unique + '\n';
        if (stat.topValues && stat.topValues.length > 0) {
          summary += '  - Valores mais frequentes: ' + 
            stat.topValues.map(v => v.value + ' (' + v.count + ')').join(', ') + '\n';
        }
      }
    });

    return summary;
  }
}

interface AnalysisResult {
  success: boolean;
  headers?: string[];
  rowCount?: number;
  columnCount?: number;
  columnTypes?: string[];
  statistics?: ColumnStatistics[];
  summary?: string;
  data?: string[][];
  error?: string;
}

interface QueryResult {
  success: boolean;
  results?: any[];
  explanation?: string;
  error?: string;
}

interface FilterResult {
  success: boolean;
  filteredRows?: number;
  totalRows?: number;
  data?: string[][];
  error?: string;
}

interface ColumnStatistics {
  column: string;
  type: string;
  count: number;
  sum?: string;
  mean?: string;
  median?: string;
  min?: number;
  max?: number;
  unique?: number;
  topValues?: Array<{ value: string; count: number }>;
}
