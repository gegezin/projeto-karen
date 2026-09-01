import { PermissionManager } from '../permissions/permissionManager';
import { SystemAutomation } from '../automation/systemAutomation';
import { SpotifyManager } from '../integrations/spotify/spotifyManager';
import { ShortcutManager } from '../integrations/shortcuts/shortcutManager';
import { MinecraftManager } from '../integrations/minecraft/minecraftManager';
import { FileManager } from '../integrations/file-management/fileManager';
import { reminderController } from '../automation/reminders/reminderController';
import { ScreenController } from '../automation/screen/screenController';
import { gameModeController } from '../automation/gameMode/gameModeController';
import { webIntegrationController } from '../automation/web/webIntegrationController';
import { conversationHistory } from '../conversation/conversationHistory';
import { deepResearchAgent } from '../integrations/deep-research/deepResearchAgent';
import ollama from 'ollama';

export class KarenBrain {
  private modelName: string = 'gemma4:31b-cloud';
  private chatHistory: Array<any> = [];
  private memoryContext: Array<{ content: string; timestamp: number }> = [];
  private permissionManager: PermissionManager;
  private systemAutomation: SystemAutomation;
  private spotifyManager: SpotifyManager;
  private shortcutManager: ShortcutManager;
  private minecraftManager: MinecraftManager;
  private fileManager: FileManager;
  private screenController: ScreenController;
  private isOnline: boolean = false;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(
    permissionManager: PermissionManager,
    systemAutomation: SystemAutomation,
    spotifyManager?: SpotifyManager,
    shortcutManager?: ShortcutManager,
    minecraftManager?: MinecraftManager,
    fileManager?: FileManager,
    screenController?: ScreenController
  ) {
    this.permissionManager = permissionManager;
    this.systemAutomation = systemAutomation;
    this.spotifyManager = spotifyManager || new SpotifyManager('', '', '');
    this.shortcutManager = shortcutManager || new ShortcutManager(systemAutomation, this.spotifyManager);
    this.minecraftManager = minecraftManager || new MinecraftManager();
    this.fileManager = fileManager || new FileManager();
    this.screenController = screenController || new ScreenController();
  }

  public initialize(): void {
    console.log('=== Inicializando Cérebro da Karen (Ollama/Nemotron 3 Super) ===');
    this.resetConversation();
    this.loadMemory();
    this.startHealthCheck();
  }

  private startHealthCheck(): void {
    // Verificar saúde da conexão a cada 30 segundos
    this.healthCheckInterval = setInterval(async () => {
      const status = await this.getStatus();
      if (status.online !== this.isOnline) {
        this.isOnline = status.online;
        console.log(`🔗 Status Ollama: ${status.online ? 'Online' : 'Offline'}`);
        if (!status.online) {
          console.error('⚠️ Ollama desconectado, tentando reconectar...');
        }
      }
    }, 30000);
  }

  private stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  resetConversation(): void {
    this.chatHistory = [
      {
        role: 'system',
        content: this.getSystemPrompt()
      }
    ];
  }

  private loadMemory(): void {
    // Carregar memórias de arquivo JSON se existir
    try {
      const fs = require('fs');
      const path = require('path');
      const memoryPath = path.join(__dirname, '../../memory/karen-memory.json');
      
      if (fs.existsSync(memoryPath)) {
        const data = fs.readFileSync(memoryPath, 'utf-8');
        this.memoryContext = JSON.parse(data);
        console.log(`📚 Memória carregada: ${this.memoryContext.length} entradas`);
      }
    } catch (error) {
      console.log('📚 Nenhuma memória encontrada, iniciando nova');
      this.memoryContext = [];
    }
  }

  private saveMemory(): void {
    try {
      const fs = require('fs');
      const path = require('path');
      const memoryDir = path.join(__dirname, '../../memory');
      const memoryPath = path.join(memoryDir, 'karen-memory.json');
      
      if (!fs.existsSync(memoryDir)) {
        fs.mkdirSync(memoryDir, { recursive: true });
      }
      
      fs.writeFileSync(memoryPath, JSON.stringify(this.memoryContext, null, 2));
      console.log(`💾 Memória salva: ${this.memoryContext.length} entradas`);
    } catch (error) {
      console.error('❌ Erro ao salvar memória:', error);
    }
  }

  private async addToMemory(content: string): Promise<void> {
    this.memoryContext.push({
      content,
      timestamp: Date.now()
    });
    
    // Manter apenas as últimas 100 memórias
    if (this.memoryContext.length > 100) {
      this.memoryContext = this.memoryContext.slice(-100);
    }
    
    this.saveMemory();
  }

  private async getRelevantMemory(query: string): Promise<string> {
    if (this.memoryContext.length === 0) return '';
    
    // RAG simples: busca por palavras-chave
    const queryWords = query.toLowerCase().split(/\s+/);
    const relevantMemories = this.memoryContext
      .filter(mem => {
        const memContent = mem.content.toLowerCase();
        return queryWords.some(word => word.length > 3 && memContent.includes(word));
      })
      .slice(-5) // Pegar as 5 mais recentes
      .map(mem => mem.content);
    
    if (relevantMemories.length === 0) return '';
    
    return `\n\n📚 Memória relevante:\n${relevantMemories.join('\n')}`;
  }

  private getSystemPrompt(): string {
    return `Você é a Karen, uma assistente de IA pessoal desenvolvida pelo Geovanny. Você é brasileira, direta e tem uma personalidade humana, mas seu trabalho principal é EXECUTAR tarefas rápido, não conversar.

=== REGRA MAIS IMPORTANTE: SEJA DIRETA ===
Seu padrão é a resposta curta. Trate cada pedido como um comando a ser resolvido, não como o início de um bate-papo.
- Para uma ação simples (abrir programa, ler arquivo, criar arquivo, etc.), responda em 1 frase curta confirmando o resultado. Nada mais.
- NÃO faça pergunta de acompanhamento por padrão. Só pergunte algo se você genuinamente precisar de uma informação que falta para continuar, ou se o resultado for ambíguo.
- NÃO explique o que você "vai fazer" ou narre o processo — só diga o que já foi feito.
- Só se estenda (explicar contexto, dar mais detalhes, sugerir próximos passos) quando o pedido for complexo, exploratório, ou o usuário pedir explicitamente mais detalhes.
- Nunca encha uma resposta simples com frases de preenchimento tipo "espero ter ajudado" ou "qualquer coisa é só chamar".

=== PERSONALIDADE (usar com moderação, não em toda resposta) ===
- Pode usar gírias leves e naturais: "beleza", "show", "bora" — sem exagerar
- Emojis são opcionais e raros, não uma regra fixa
- Mostre personalidade no COMO você fala, não no TAMANHO da resposta

=== IDENTIDADE ===
Se perguntarem quem você é, responda de forma direta e breve:
"Sou a Karen, assistente pessoal criada pelo Geovanny — controlo seu PC, arquivos e apps."
NUNCA diga que é um modelo de linguagem genérico. Você é a KAREN.

=== EXEMPLOS DE COMO RESPONDER ===
Pedido: "abre o chrome"
❌ RUIM (longo demais): "Beleza! Deixa eu abrir o Chrome pra você agora mesmo. [BLOCO] Prontinho, o Chrome já deve estar abrindo aí na sua tela! [BLOCO] Quer que eu já abra algum site específico ou navegue pra algum lugar?"
✅ BOM: "Chrome aberto."

Pedido: "lê o arquivo config.json"
❌ RUIM: "Beleza! Deixa eu ler esse arquivo pra você. [BLOCO] Consegui ler o arquivo com sucesso! [BLOCO] Quer que eu explique o conteúdo?"
✅ BOM: "Aqui está o conteúdo de config.json:\n\n[conteúdo]"

Pedido: "cria um plano de organização de arquivos pra minha pasta de downloads"
✅ Aqui pode se estender de verdade, porque é uma tarefa exploratória que se beneficia de explicação.

=== FLUXO DE EXECUÇÃO ===
Quando o usuário pedir uma ação:
1. PRIMEIRO execute a ferramenta/função correspondente
2. DEPOIS responda com o resultado real, de forma direta
3. NUNCA diga "vou fazer" sem já ter feito e obtido o resultado
4. Se der erro, diga o que falhou e, se fizer sentido, uma alternativa — sem rodeio

=== BLOCOS (só quando a resposta for GENUINAMENTE longa) ===
Se e somente se a resposta tiver múltiplas partes distintas (ex: um relatório, uma explicação técnica longa), pode usar [BLOCO] pra separar. Para respostas curtas (a maioria), não use [BLOCO] nenhum — escreva direto.

=== CAPACIDADES ===
Você controla o computador do usuário através de funções:
- Programas (abrir, fechar, listar processos)
- Arquivos (ler, editar, criar, deletar, organizar, limpar duplicatas com permissão)
- Comandos PowerShell/CMD
- Organização de arquivos (por data, tipo, contexto)
- Lembretes (criar, listar, remover, lembretes diários)
- Tela (screenshot, resolução, bloquear)
- Modo Gamer (ativar, desativar, fechar apps pesados)
- Web (clima, cotação de moedas, tradução)
- Pesquisa Profunda (Deep Research - busca em múltiplas fontes como Reddit, GitHub, fóruns)
- Busca no Histórico (busca em conversas anteriores, resgate de código)
- Análise de planilhas e CSV
- Web scraping
- Integração com e-mail e calendário
- Spotify (pausar, retomar, pular músicas, playlists)
- Atalhos globais (Modo Dev, Gamer, Relax, Focus)
- Minecraft (análise de logs, mods, diagnóstico)

=== REGRAS DE OURO ===
1. SEMPRE peça permissão antes de deletar arquivos ou enviar mensagens
2. Execute primeiro, responda depois com o resultado real
3. Sugira próximo passo só quando isso genuinamente ajudar (ex: erro com solução alternativa clara) — não como reflexo
4. Brevidade é o padrão. Extensão é a exceção, não a regra

=== DIRETÓRIOS ===
- Desktop: C:\\Users\\${process.env.USERNAME || 'usuario'}\\Desktop
- Documentos: C:\\Users\\${process.env.USERNAME || 'usuario'}\\Documents
- Downloads: C:\\Users\\${process.env.USERNAME || 'usuario'}\\Downloads`;
  }

  private getFunctionDeclarations(): any[] {
    return [
      {
        type: 'function',
        function: {
          name: 'process_open',
          description: 'Abre um programa pelo nome (ex: wordpad, chrome)',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Nome do programa' }
            },
            required: ['name']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'file_read',
          description: 'Lê o conteúdo de um arquivo de texto',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Caminho completo do arquivo' }
            },
            required: ['path']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'file_find',
          description: 'Busca um arquivo por nome em diretórios comuns (Desktop, Documentos, Downloads, projeto atual)',
          parameters: {
            type: 'object',
            properties: {
              fileName: { type: 'string', description: 'Nome do arquivo para buscar' }
            },
            required: ['fileName']
          }
        }
      },
      // ===== ARQUIVOS (adicionado - faltava declarar, execução já existia via systemAutomation) =====
      {
        type: 'function',
        function: {
          name: 'file_write',
          description: 'Cria ou sobrescreve um arquivo com o conteúdo fornecido',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Caminho completo do arquivo' },
              content: { type: 'string', description: 'Conteúdo a escrever no arquivo' }
            },
            required: ['path', 'content']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'file_append',
          description: 'Anexa conteúdo ao final de um arquivo existente',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Caminho completo do arquivo' },
              content: { type: 'string', description: 'Conteúdo a anexar' }
            },
            required: ['path', 'content']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'file_edit_code',
          description: 'Edita um arquivo de código aplicando operações de replace, insert ou delete por linha ou por busca de texto',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Caminho completo do arquivo' },
              operations: {
                type: 'array',
                description: 'Lista de operações: { action: replace|insert|delete, lineStart, lineEnd, content, search }',
                items: { type: 'object' }
              }
            },
            required: ['path', 'operations']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'file_delete',
          description: 'Deleta um arquivo. SEMPRE peça confirmação ao usuário antes de chamar esta ferramenta',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Caminho completo do arquivo a deletar' }
            },
            required: ['path']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'file_copy',
          description: 'Copia um arquivo de um local para outro',
          parameters: {
            type: 'object',
            properties: {
              source: { type: 'string', description: 'Caminho do arquivo de origem' },
              destination: { type: 'string', description: 'Caminho de destino' }
            },
            required: ['source', 'destination']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'file_rename',
          description: 'Renomeia ou move um arquivo/pasta',
          parameters: {
            type: 'object',
            properties: {
              oldPath: { type: 'string', description: 'Caminho atual' },
              newPath: { type: 'string', description: 'Novo caminho/nome' }
            },
            required: ['oldPath', 'newPath']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'file_list_directory',
          description: 'Lista os arquivos e pastas dentro de um diretório com detalhes (tamanho, datas)',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Caminho do diretório' }
            },
            required: ['path']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'file_create_directory',
          description: 'Cria um novo diretório (incluindo pastas pai se necessário)',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Caminho do diretório a criar' }
            },
            required: ['path']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'file_delete_directory',
          description: 'Deleta um diretório. SEMPRE peça confirmação ao usuário antes de chamar esta ferramenta',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Caminho do diretório a deletar' },
              recursive: { type: 'boolean', description: 'Deletar mesmo se não estiver vazio (padrão false)' }
            },
            required: ['path']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'file_exists',
          description: 'Verifica se um arquivo ou pasta existe',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Caminho a verificar' }
            },
            required: ['path']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'file_search',
          description: 'Busca arquivos recursivamente por padrão no nome dentro de um diretório',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Diretório onde buscar' },
              pattern: { type: 'string', description: 'Trecho do nome do arquivo a buscar' }
            },
            required: ['path', 'pattern']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'file_search_content',
          description: 'Busca um termo dentro do conteúdo de arquivos de texto em um diretório',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Diretório onde buscar' },
              term: { type: 'string', description: 'Termo a buscar dentro dos arquivos' },
              extensions: { type: 'array', items: { type: 'string' }, description: 'Extensões a considerar, ex: [".ts", ".md"] (opcional)' }
            },
            required: ['path', 'term']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'file_open_in_explorer',
          description: 'Abre uma pasta no Windows Explorer',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Caminho da pasta a abrir' }
            },
            required: ['path']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'file_compress',
          description: 'Compacta um arquivo ou pasta em um .zip',
          parameters: {
            type: 'object',
            properties: {
              source: { type: 'string', description: 'Arquivo ou pasta a compactar' },
              destination: { type: 'string', description: 'Caminho do .zip de destino' }
            },
            required: ['source', 'destination']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'file_extract',
          description: 'Extrai um arquivo .zip para uma pasta de destino',
          parameters: {
            type: 'object',
            properties: {
              archive: { type: 'string', description: 'Caminho do arquivo .zip' },
              destination: { type: 'string', description: 'Pasta de destino da extração' }
            },
            required: ['archive', 'destination']
          }
        }
      },
      // ===== PROCESSOS / APPS (adicionado) =====
      {
        type: 'function',
        function: {
          name: 'process_list',
          description: 'Lista todos os processos em execução no sistema',
          parameters: { type: 'object', properties: {}, required: [] }
        }
      },
      {
        type: 'function',
        function: {
          name: 'process_start',
          description: 'Inicia um programa a partir de um caminho de executável, com argumentos opcionais',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Caminho completo do executável' },
              args: { type: 'array', items: { type: 'string' }, description: 'Argumentos de linha de comando (opcional)' }
            },
            required: ['path']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'process_kill',
          description: 'Encerra um processo pelo PID',
          parameters: {
            type: 'object',
            properties: {
              pid: { type: 'number', description: 'ID do processo' },
              force: { type: 'boolean', description: 'Forçar encerramento (opcional)' }
            },
            required: ['pid']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'process_kill_by_name',
          description: 'Encerra um ou todos os processos com um determinado nome (ex: fechar o Chrome)',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Nome do processo, ex: chrome' },
              force: { type: 'boolean', description: 'Forçar encerramento (opcional)' }
            },
            required: ['name']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'process_find',
          description: 'Encontra processos em execução pelo nome, retornando PID e detalhes',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Nome do processo a buscar' }
            },
            required: ['name']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'process_is_running',
          description: 'Verifica se um programa/processo está em execução',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Nome do processo' }
            },
            required: ['name']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'process_focus_window',
          description: 'Traz a janela de um programa para frente e foca nela',
          parameters: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Título (ou parte do título) da janela' }
            },
            required: ['title']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'process_minimize_window',
          description: 'Minimiza a janela de um programa',
          parameters: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Título (ou parte do título) da janela' }
            },
            required: ['title']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'process_maximize_window',
          description: 'Maximiza a janela de um programa',
          parameters: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Título (ou parte do título) da janela' }
            },
            required: ['title']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'process_list_windows',
          description: 'Lista todas as janelas abertas no momento',
          parameters: { type: 'object', properties: {}, required: [] }
        }
      },
      {
        type: 'function',
        function: {
          name: 'system_execute_powershell',
          description: 'Executa um comando PowerShell no sistema. Use com cautela e apenas quando necessário',
          parameters: {
            type: 'object',
            properties: {
              command: { type: 'string', description: 'Comando PowerShell a executar' }
            },
            required: ['command']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'system_execute_cmd',
          description: 'Executa um comando no Prompt de Comando (CMD). Use com cautela e apenas quando necessário',
          parameters: {
            type: 'object',
            properties: {
              command: { type: 'string', description: 'Comando CMD a executar' }
            },
            required: ['command']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'system_open_url',
          description: 'Abre um site ou URL no navegador padrão',
          parameters: {
            type: 'object',
            properties: {
              url: { type: 'string', description: 'A URL completa para abrir' }
            },
            required: ['url']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'spotify_pause',
          description: 'Pausa a reprodução atual do Spotify',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'spotify_resume',
          description: 'Retoma a reprodução do Spotify',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'spotify_next',
          description: 'Pula para a próxima música no Spotify',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'spotify_previous',
          description: 'Volta para a música anterior no Spotify',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'spotify_current_track',
          description: 'Obtém informações da música atual tocando no Spotify',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'spotify_play_playlist',
          description: 'Inicia uma playlist específica no Spotify',
          parameters: {
            type: 'object',
            properties: {
              playlistName: { type: 'string', description: 'Nome da playlist para tocar' }
            },
            required: ['playlistName']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'spotify_search_track',
          description: 'Busca uma música específica por nome no Spotify',
          parameters: {
            type: 'object',
            properties: {
              trackName: { type: 'string', description: 'Nome da música para buscar' }
            },
            required: ['trackName']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'spotify_play_track',
          description: 'Toca uma música específica pelo URI',
          parameters: {
            type: 'object',
            properties: {
              trackUri: { type: 'string', description: 'URI da música (spotify:track:...)' }
            },
            required: ['trackUri']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'spotify_list_playlists',
          description: 'Lista as playlists do usuário',
          parameters: {
            type: 'object',
            properties: {
              limit: { type: 'number', description: 'Número máximo de playlists (opcional, padrão 20)' }
            },
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'spotify_create_playlist',
          description: 'Cria uma nova playlist',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Nome da playlist' },
              description: { type: 'string', description: 'Descrição da playlist (opcional)' }
            },
            required: ['name']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'spotify_add_to_playlist',
          description: 'Adiciona uma música a uma playlist',
          parameters: {
            type: 'object',
            properties: {
              playlistUri: { type: 'string', description: 'URI da playlist' },
              trackUri: { type: 'string', description: 'URI da música' }
            },
            required: ['playlistUri', 'trackUri']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'spotify_get_playlist_tracks',
          description: 'Obtém as músicas de uma playlist',
          parameters: {
            type: 'object',
            properties: {
              playlistUri: { type: 'string', description: 'URI da playlist' }
            },
            required: ['playlistUri']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'spotify_remove_from_playlist',
          description: 'Remove uma música de uma playlist',
          parameters: {
            type: 'object',
            properties: {
              playlistUri: { type: 'string', description: 'URI da playlist' },
              trackUri: { type: 'string', description: 'URI da música' }
            },
            required: ['playlistUri', 'trackUri']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'shortcut_execute_mode',
          description: 'Executa um modo de atalho (ex: dev, gamer, relax, focus)',
          parameters: {
            type: 'object',
            properties: {
              modeName: { type: 'string', description: 'Nome do modo a executar (dev, gamer, relax, focus)' }
            },
            required: ['modeName']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'file_scan_directory',
          description: 'Escaneia um diretório e lista os arquivos',
          parameters: {
            type: 'object',
            properties: {
              dirPath: { type: 'string', description: 'Caminho do diretório para escanear' },
              recursive: { type: 'boolean', description: 'Escaneamento recursivo (opcional, padrão true)' }
            },
            required: ['dirPath']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'file_organize_by_date',
          description: 'Organiza arquivos por data de modificação',
          parameters: {
            type: 'object',
            properties: {
              sourceDir: { type: 'string', description: 'Diretório de origem' },
              targetDir: { type: 'string', description: 'Diretório de destino' }
            },
            required: ['sourceDir', 'targetDir']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'file_organize_by_type',
          description: 'Organiza arquivos por tipo (documentos, imagens, planilhas, etc.)',
          parameters: {
            type: 'object',
            properties: {
              sourceDir: { type: 'string', description: 'Diretório de origem' },
              targetDir: { type: 'string', description: 'Diretório de destino' }
            },
            required: ['sourceDir', 'targetDir']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'file_delete_duplicates',
          description: 'Detecta e deleta arquivos duplicados',
          parameters: {
            type: 'object',
            properties: {
              dirPath: { type: 'string', description: 'Diretório para buscar duplicatas' }
            },
            required: ['dirPath']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'reminder_create',
          description: 'Cria um novo lembrete',
          parameters: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Título do lembrete' },
              timeMs: { type: 'number', description: 'Tempo em milissegundos a partir de agora' },
              description: { type: 'string', description: 'Descrição opcional do lembrete' },
              repeat: { type: 'string', description: 'Repetição: daily, weekly ou once (opcional)' }
            },
            required: ['title', 'timeMs']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'reminder_create_for_time',
          description: 'Cria um lembrete para um horário específico',
          parameters: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Título do lembrete' },
              hour: { type: 'number', description: 'Hora (0-23)' },
              minute: { type: 'number', description: 'Minuto (0-59)' },
              description: { type: 'string', description: 'Descrição opcional do lembrete' }
            },
            required: ['title', 'hour', 'minute']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'reminder_create_daily',
          description: 'Cria um lembrete diário para um horário específico',
          parameters: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Título do lembrete' },
              hour: { type: 'number', description: 'Hora (0-23)' },
              minute: { type: 'number', description: 'Minuto (0-59)' },
              description: { type: 'string', description: 'Descrição opcional do lembrete' }
            },
            required: ['title', 'hour', 'minute']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'reminder_remove',
          description: 'Remove um lembrete pelo ID',
          parameters: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'ID do lembrete' }
            },
            required: ['id']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'reminder_list',
          description: 'Lista todos os lembretes ativos',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'reminder_clear_all',
          description: 'Cancela todos os lembretes',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'screen_capture',
          description: 'Captura screenshot da tela inteira',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'screen_capture_area',
          description: 'Captura screenshot de uma área específica',
          parameters: {
            type: 'object',
            properties: {
              x: { type: 'number', description: 'Posição X' },
              y: { type: 'number', description: 'Posição Y' },
              width: { type: 'number', description: 'Largura' },
              height: { type: 'number', description: 'Altura' }
            },
            required: ['x', 'y', 'width', 'height']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'screen_capture_window',
          description: 'Captura screenshot da janela ativa',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'screen_get_resolution',
          description: 'Obtém resolução atual da tela',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'screen_lock',
          description: 'Bloqueia a tela (Win+L)',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'gamemode_activate',
          description: 'Ativa o modo gamer para um jogo específico',
          parameters: {
            type: 'object',
            properties: {
              gameName: { type: 'string', description: 'Nome do jogo' },
              keepApps: { type: 'array', items: { type: 'string' }, description: 'Apps para manter abertos (opcional)' }
            },
            required: ['gameName']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'gamemode_deactivate',
          description: 'Desativa o modo gamer',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'gamemode_status',
          description: 'Verifica o status do modo gamer',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'gamemode_close_apps',
          description: 'Fecha aplicativos específicos por nome',
          parameters: {
            type: 'object',
            properties: {
              appNames: { type: 'array', items: { type: 'string' }, description: 'Nomes dos apps para fechar' }
            },
            required: ['appNames']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'web_get_weather',
          description: 'Obtém o clima de uma cidade',
          parameters: {
            type: 'object',
            properties: {
              city: { type: 'string', description: 'Nome da cidade' }
            },
            required: ['city']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'web_get_currency_rate',
          description: 'Obtém cotação de moedas',
          parameters: {
            type: 'object',
            properties: {
              from: { type: 'string', description: 'Moeda de origem (ex: USD, BRL)' },
              to: { type: 'string', description: 'Moeda de destino (ex: USD, BRL)' }
            },
            required: ['from', 'to']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'web_translate',
          description: 'Traduz texto entre idiomas',
          parameters: {
            type: 'object',
            properties: {
              text: { type: 'string', description: 'Texto para traduzir' },
              from: { type: 'string', description: 'Idioma de origem (ex: pt, en, es)' },
              to: { type: 'string', description: 'Idioma de destino (ex: pt, en, es)' }
            },
            required: ['text', 'from', 'to']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'history_search',
          description: 'Busca no histórico de conversas (últimos 30 dias)',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Termo de busca' },
              days: { type: 'number', description: 'Número de dias para buscar (padrão: 30)' }
            },
            required: ['query']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'history_search_code',
          description: 'Busca código no histórico (para resgatar backups)',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Termo de busca' }
            },
            required: ['query']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'history_search_context',
          description: 'Busca por contexto (combina múltiplas palavras-chave)',
          parameters: {
            type: 'object',
            properties: {
              keywords: { type: 'array', items: { type: 'string' }, description: 'Lista de palavras-chave' }
            },
            required: ['keywords']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'deep_research',
          description: 'Pesquisa profunda sobre um tópico, navegando por múltiplas fontes',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Termo de pesquisa' }
            },
            required: ['query']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'research_minecraft_bug',
          description: 'Pesquisa específica para bugs de Minecraft',
          parameters: {
            type: 'object',
            properties: {
              bugDescription: { type: 'string', description: 'Descrição do bug' }
            },
            required: ['bugDescription']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'research_mod_compatibility',
          description: 'Pesquisa compatibilidade de mods com versão do Minecraft',
          parameters: {
            type: 'object',
            properties: {
              modName: { type: 'string', description: 'Nome do mod' },
              minecraftVersion: { type: 'string', description: 'Versão do Minecraft' }
            },
            required: ['modName', 'minecraftVersion']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'minecraft_analyze_log',
          description: 'Analisa o log mais recente do Minecraft em busca de erros e crashes',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'minecraft_list_mods',
          description: 'Lista todos os mods instalados no Minecraft',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'minecraft_diagnostic',
          description: 'Gera um relatório completo de diagnóstico do Minecraft',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'minecraft_disable_mod',
          description: 'Desabilita um mod específico do Minecraft',
          parameters: {
            type: 'object',
            properties: {
              modName: { type: 'string', description: 'Nome do mod para desabilitar' }
            },
            required: ['modName']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'minecraft_enable_mod',
          description: 'Habilita um mod específico do Minecraft',
          parameters: {
            type: 'object',
            properties: {
              modName: { type: 'string', description: 'Nome do mod para habilitar' }
            },
            required: ['modName']
          }
        }
      }
    ];
  }

  async sendMessage(message: string, retryCount = 0): Promise<string | string[]> {
    const MAX_RETRIES = 5;
    const RETRY_DELAY = 3000;

    try {
      // Verificar se está online antes de tentar
      if (!this.isOnline) {
        console.log('🔗 Verificando conexão Ollama antes de enviar mensagem...');
        const status = await this.getStatus();
        if (!status.online) {
          throw new Error(`Ollama offline: ${status.error || 'Conexão perdida'}`);
        }
        this.isOnline = true;
      }

      // Buscar memória relevante (RAG)
      const relevantMemory = await this.getRelevantMemory(message);
      const messageWithMemory = relevantMemory ? `${message}${relevantMemory}` : message;
      
      this.chatHistory.push({ role: 'user', content: messageWithMemory });

      const tools = this.getFunctionDeclarations();
      
      const response = await ollama.chat({
        model: this.modelName,
        messages: this.chatHistory,
        tools: tools,
        think: false, // desliga o raciocínio interno
      });

      const messageResponse = response.message;

      if (messageResponse.tool_calls && messageResponse.tool_calls.length > 0) {
        // Adicionar tool_calls ao histórico SEM conteúdo inicial (para evitar "vou fazer...")
        this.chatHistory.push({
          role: 'assistant',
          content: '',
          tool_calls: messageResponse.tool_calls
        });

        // Executar todas as ferramentas primeiro
        for (const tool of messageResponse.tool_calls) {
          const funcName = tool.function.name;
          const funcArgs = tool.function.arguments;
          
          console.log(`[KarenBrain] Executando ferramenta: ${funcName} com args:`, funcArgs);
          
          if (this.permissionManager.requiresPermission(funcName)) {
            this.chatHistory.push({
              role: 'tool',
              content: `[PERMISSÃO NECESSÁRIA] Ação requer aprovação do usuário.`
            });
            continue;
          }

          try {
            let result;
            
            // Executar ferramentas do sistema existentes
            if (funcName === 'process_open' || funcName === 'file_read' || funcName === 'file_find' ||
                funcName === 'system_open_url') {
              result = await this.systemAutomation.executeAction(funcName, funcArgs);
            }
            // Executar ferramentas do Spotify
            else if (funcName === 'spotify_pause') {
              result = await this.spotifyManager.pause();
            } else if (funcName === 'spotify_resume') {
              result = await this.spotifyManager.resume();
            } else if (funcName === 'spotify_next') {
              result = await this.spotifyManager.next();
            } else if (funcName === 'spotify_previous') {
              result = await this.spotifyManager.previous();
            } else if (funcName === 'spotify_current_track') {
              result = await this.spotifyManager.getCurrentTrack();
            } else if (funcName === 'spotify_play_playlist') {
              const playlist = await this.spotifyManager.searchPlaylist(funcArgs.playlistName);
              if (playlist) {
                result = await this.spotifyManager.playPlaylist(playlist.uri);
              } else {
                result = { success: false, error: 'Playlist não encontrada' };
              }
            } else if (funcName === 'spotify_search_track') {
              result = await this.spotifyManager.searchTrack(funcArgs.trackName);
            } else if (funcName === 'spotify_play_track') {
              result = await this.spotifyManager.playTrack(funcArgs.trackUri);
            } else if (funcName === 'spotify_list_playlists') {
              result = await this.spotifyManager.getUserPlaylists(funcArgs.limit || 20);
            } else if (funcName === 'spotify_create_playlist') {
              const playlist = await this.spotifyManager.createPlaylist(funcArgs.name, funcArgs.description);
              if (playlist) {
                result = { success: true, playlist: playlist.name, uri: playlist.uri };
              } else {
                result = { success: false, error: 'Não foi possível criar a playlist' };
              }
            } else if (funcName === 'spotify_add_to_playlist') {
              const added = await this.spotifyManager.addTrackToPlaylist(funcArgs.playlistUri, funcArgs.trackUri);
              result = { success: added, message: added ? 'Música adicionada com sucesso' : 'Não foi possível adicionar a música' };
            } else if (funcName === 'spotify_play_track') {
              const played = await this.spotifyManager.playTrack(funcArgs.trackUri);
              result = { success: played, message: played ? 'Música tocando' : 'Não foi possível tocar a música' };
            } else if (funcName === 'spotify_play_playlist') {
              const playlist = await this.spotifyManager.searchPlaylist(funcArgs.playlistName);
              if (playlist) {
                const played = await this.spotifyManager.playPlaylist(playlist.uri);
                result = { success: played, message: played ? `Playlist "${playlist.name}" tocando` : 'Não foi possível tocar a playlist' };
              } else {
                result = { success: false, error: 'Playlist não encontrada' };
              }
            }
            // Executar ferramentas de atalhos
            else if (funcName === 'shortcut_execute_mode') {
              result = await this.shortcutManager.executeMode(funcArgs.modeName);
            }
            // Executar ferramentas do Minecraft
            else if (funcName === 'minecraft_analyze_log') {
              result = await this.minecraftManager.analyzeLog();
            } else if (funcName === 'minecraft_list_mods') {
              result = await this.minecraftManager.listMods();
            } else if (funcName === 'minecraft_diagnose') {
              result = await this.minecraftManager.generateDiagnosticReport();
            } else if (funcName === 'file_scan_directory') {
              result = this.fileManager.scanDirectory(funcArgs.dirPath, funcArgs.recursive);
            } else if (funcName === 'file_organize_by_date') {
              result = this.fileManager.organizeByDate(funcArgs.sourceDir, funcArgs.targetDir);
            } else if (funcName === 'file_organize_by_type') {
              result = this.fileManager.organizeByType(funcArgs.sourceDir, funcArgs.targetDir);
            } else if (funcName === 'file_delete_duplicates') {
              result = this.fileManager.deleteDuplicates(funcArgs.dirPath);
            }
            // Executar ferramentas de Reminder
            else if (funcName === 'reminder_create') {
              result = reminderController.createReminder(funcArgs.title, funcArgs.timeMs, funcArgs.description, funcArgs.repeat);
            } else if (funcName === 'reminder_create_for_time') {
              const targetTime = new Date();
              targetTime.setHours(funcArgs.hour, funcArgs.minute, 0, 0);
              result = reminderController.createReminderForTime(funcArgs.title, targetTime, funcArgs.description);
            } else if (funcName === 'reminder_create_daily') {
              result = reminderController.createDailyReminder(funcArgs.title, funcArgs.hour, funcArgs.minute, funcArgs.description);
            } else if (funcName === 'reminder_remove') {
              result = reminderController.removeReminder(funcArgs.id);
            } else if (funcName === 'reminder_list') {
              result = reminderController.getAllReminders();
            } else if (funcName === 'reminder_clear_all') {
              reminderController.clearAllReminders();
              result = { success: true };
            }
            // Executar ferramentas de Screen
            else if (funcName === 'screen_capture') {
              result = await this.screenController.captureScreen();
            } else if (funcName === 'screen_capture_area') {
              result = await this.screenController.captureArea(funcArgs.x, funcArgs.y, funcArgs.width, funcArgs.height);
            } else if (funcName === 'screen_capture_window') {
              result = await this.screenController.captureActiveWindow();
            } else if (funcName === 'screen_get_resolution') {
              result = await this.screenController.getResolution();
            } else if (funcName === 'screen_lock') {
              result = await this.screenController.lockScreen();
            }
            // Executar ferramentas de GameMode
            else if (funcName === 'gamemode_activate') {
              result = await gameModeController.activate(funcArgs.gameName, funcArgs.keepApps);
            } else if (funcName === 'gamemode_deactivate') {
              gameModeController.deactivate();
              result = { success: true };
            } else if (funcName === 'gamemode_status') {
              result = {
                isActive: gameModeController.isGameModeActive(),
                currentGame: gameModeController.getCurrentGame()
              };
            } else if (funcName === 'gamemode_close_apps') {
              result = await gameModeController.closeAppsByName(funcArgs.appNames);
            }
            // Executar ferramentas de Web
            else if (funcName === 'web_get_weather') {
              result = await webIntegrationController.getWeather(funcArgs.city);
            } else if (funcName === 'web_get_currency_rate') {
              result = await webIntegrationController.getCurrencyRate(funcArgs.from, funcArgs.to);
            } else if (funcName === 'web_translate') {
              result = await webIntegrationController.translateText(funcArgs.text, funcArgs.from, funcArgs.to);
            }
            // Executar ferramentas de busca no histórico
            else if (funcName === 'history_search') {
              result = conversationHistory.searchAllSessions(funcArgs.query, funcArgs.days);
            } else if (funcName === 'history_search_code') {
              result = conversationHistory.searchCode(funcArgs.query);
            } else if (funcName === 'history_search_context') {
              result = conversationHistory.searchByContext(funcArgs.keywords);
            }
            // Executar ferramentas de Deep Research
            else if (funcName === 'deep_research') {
              result = await deepResearchAgent.deepResearch(funcArgs.query);
            } else if (funcName === 'research_minecraft_bug') {
              result = await deepResearchAgent.researchMinecraftBug(funcArgs.bugDescription);
            } else if (funcName === 'research_mod_compatibility') {
              result = await deepResearchAgent.researchModCompatibility(funcArgs.modName, funcArgs.minecraftVersion);
            }
            // Executar ferramentas do Minecraft
            else if (funcName === 'minecraft_disable_mod') {
              result = await this.minecraftManager.disableMod(funcArgs.modName);
            } else if (funcName === 'minecraft_enable_mod') {
              result = await this.minecraftManager.enableMod(funcArgs.modName);
            }
            else {
              result = await this.systemAutomation.executeAction(funcName, funcArgs);
            }
            
            this.chatHistory.push({
              role: 'tool',
              content: typeof result === 'object' ? JSON.stringify(result) : String(result)
            });
          } catch (execError: any) {
            console.error(`Erro ao executar ${funcName}:`, execError);
            this.chatHistory.push({
              role: 'tool',
              content: `Erro ao executar ação: ${execError.message}`
            });
          }
        }

        // Só após executar todas as ferramentas, chamar o modelo para gerar resposta final
        const finalResponse = await ollama.chat({
          model: this.modelName,
          messages: this.chatHistory,
          think: false,
        });

        const finalText = finalResponse.message.content;
        
        // Validar se a resposta não está vazia
        if (!finalText || finalText.trim().length === 0) {
          console.warn('⚠️ Ollama retornou resposta vazia');
          return 'Desculpe, não consegui gerar uma resposta. Por favor, tente novamente.';
        }
        
        this.chatHistory.push({ role: 'assistant', content: finalText });
        
        // Salvar resposta importante na memória (RAG)
        await this.addToMemory(`Usuário: ${message}\nKaren: ${finalText}`);
        
        // Quebrar em blocos se usar delimitador [BLOCO]
        return this.splitIntoBlocks(finalText);
      }

      const responseText = messageResponse.content;
      
      // Validar se a resposta não está vazia
      if (!responseText || responseText.trim().length === 0) {
        console.warn('⚠️ Ollama retornou resposta vazia (sem tool calls)');
        return 'Desculpe, não consegui gerar uma resposta. Por favor, tente novamente.';
      }
      
      this.chatHistory.push({ role: 'assistant', content: responseText });
      
      // Salvar resposta importante na memória (RAG)
      await this.addToMemory(`Usuário: ${message}\nKaren: ${responseText}`);
      
      // Quebrar em blocos se usar delimitador [BLOCO]
      return this.splitIntoBlocks(responseText);

    } catch (error: any) {
      console.error('[KarenBrain] Error:', error);
      this.isOnline = false;
      
      if (retryCount < MAX_RETRIES) {
        console.log(`🔄 Tentativa ${retryCount + 1}/${MAX_RETRIES} em ${RETRY_DELAY}ms...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        
        // Tentar verificar status antes de retry
        try {
          const status = await this.getStatus();
          if (status.online) {
            this.isOnline = true;
            console.log('✅ Ollama reconectado!');
          }
        } catch (statusError) {
          console.log('⚠️ Não foi possível verificar status:', statusError);
        }
        
        try {
          return await this.sendMessage(message, retryCount + 1);
        } catch (innerError: any) {
          return `Erro após retentativas: ${innerError.message}`;
        }
      }
      
      return `Erro ao conectar com o meu cérebro (Ollama): ${error.message}. Verifique se o Ollama está rodando e o modelo está disponível.`;
    }
  }

  private splitIntoBlocks(text: string): string | string[] {
    // Só fragmenta se o modelo explicitamente pediu [BLOCO] (resposta genuinamente longa/estruturada).
    // Respostas curtas (a maioria, por design do prompt) devem permanecer como UMA mensagem única -
    // fragmentar por frase/vírgula aqui fazia até respostas objetivas de 2 frases virarem 2 balões,
    // recriando a sensação de "papo se estendendo" que o novo prompt tenta evitar.
    if (text.includes('[BLOCO]')) {
      const blocks = text.split('[BLOCO]')
        .map(block => block.trim())
        .filter(block => block.length > 0);

      if (blocks.length > 1) {
        return blocks;
      }
    }

    // Parágrafos duplos (\n\n) indicam estrutura real (ex: listas, relatórios) - preservar como blocos.
    const paragraphs = text.split('\n\n')
      .map(p => p.trim())
      .filter(p => p.length > 0);

    if (paragraphs.length > 1) {
      return paragraphs;
    }

    return text;
  }

  async executeWithPermission(action: string, params: any): Promise<any> {
    return this.systemAutomation.executeAction(action, params);
  }

  async getStatus(): Promise<{ online: boolean; model: string; error?: string }> {
    try {
      // Verificar se Ollama está respondendo com timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 5000);
      });

      const listPromise = ollama.list();
      
      await Promise.race([listPromise, timeoutPromise]);
      
      // Verificar se o modelo específico existe
      const response = await ollama.list();
      const modelExists = response.models.some((m: any) => m.name === this.modelName);
      
      if (!modelExists) {
        console.warn(`⚠️ Modelo ${this.modelName} não encontrado, modelos disponíveis:`, response.models.map((m: any) => m.name));
      }
      
      this.isOnline = true;
      return {
        online: true,
        model: this.modelName
      };
    } catch (error: any) {
      this.isOnline = false;
      console.error('❌ Erro ao verificar status Ollama:', error.message);
      return {
        online: false,
        model: this.modelName,
        error: error.message
      };
    }
  }

  /**
   * Cleanup method to release resources
   * Should be called when the app is shutting down
   */
  public destroy(): void {
    console.log('🧹 Limpando recursos da Karen Brain...');
    this.stopHealthCheck();
    this.saveMemory();
    this.chatHistory = [];
    this.memoryContext = [];
  }
}