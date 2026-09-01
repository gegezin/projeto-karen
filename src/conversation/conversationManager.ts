/**
 * Conversation Manager - Sistema de diálogo contínuo com a Karen
 * Permite conversas bidirecionais onde a Karen pode iniciar tópicos
 */

import { KarenBrain } from '../gemini/karenbrain';

export interface ConversationTopic {
  id: string;
  type: 'greeting' | 'follow_up' | 'suggestion' | 'question' | 'notification' | 'casual';
  message: string;
  context?: string;
  priority: number; // 1-10, maior = mais urgente
  requiresResponse: boolean;
  suggestedResponses?: string[];
  timeout?: number; // ms para esperar resposta
}

export interface ConversationState {
  isActive: boolean;
  currentTopic: string | null;
  lastInteraction: Date;
  conversationHistory: Array<{
    speaker: 'user' | 'karen';
    message: string;
    timestamp: Date;
    topic?: string;
  }>;
  pendingResponse: boolean;
  silenceTimeout: number; // ms desde última interação
}

export interface ConversationContext {
  userMood?: 'happy' | 'neutral' | 'tired' | 'frustrated' | 'excited';
  currentActivity?: string;
  recentCommands: string[];
  sessionStartTime: Date;
  totalInteractions: number;
}

export class ConversationManager {
  private karenBrain: KarenBrain;
  private state: ConversationState;
  private context: ConversationContext;
  private topicQueue: ConversationTopic[] = [];
  private onKarenMessage: (message: string, topic?: string) => void;
  private onStateChange: (state: ConversationState) => void;
  private timers: NodeJS.Timeout[] = [];
  private isProcessing: boolean = false;

  // Tópicos predefinidos para iniciar conversas
  private predefinedTopics: ConversationTopic[] = [
    {
      id: 'greeting_morning',
      type: 'greeting',
      message: 'Bom dia! ☀️ Já tomou café? Como posso ajudar a começar o dia?',
      priority: 5,
      requiresResponse: true,
      suggestedResponses: ['Bom dia! Abre o Chrome pra mim', 'Ainda não, toma café comigo?', 'Bora trabalhar!']
    },
    {
      id: 'greeting_afternoon',
      type: 'greeting',
      message: 'Boa tarde! Como tá indo o dia?',
      priority: 5,
      requiresResponse: true,
      suggestedResponses: ['Boa! Tá tranquilo', 'Meio corrido, me ajuda?', 'Boa tarde!']
    },
    {
      id: 'greeting_evening',
      type: 'greeting',
      message: 'Boa noite! 🌙 Conseguiu fazer tudo que precisava hoje?',
      priority: 5,
      requiresResponse: true,
      suggestedResponses: ['Consegui! Agora é relaxar', 'Quase, me ajuda a terminar?', 'Ainda tem coisa pra fazer']
    },
    {
      id: 'check_in_general',
      type: 'follow_up',
      message: 'E aí, tudo certo? Tô aqui se precisar de alguma coisa!',
      priority: 3,
      requiresResponse: false
    },
    {
      id: 'suggest_break',
      type: 'suggestion',
      message: 'Você tá usando o computador faz um tempão... Que tal uma pausa? Posso tocar uma música relaxante ou abrir um vídeo engraçado!',
      priority: 4,
      requiresResponse: true,
      suggestedResponses: ['Boa ideia! Abre o Spotify', 'Não dá agora, tô ocupado', 'Toca algo relaxante']
    },
    {
      id: 'casual_weather',
      type: 'casual',
      message: 'Ei, vi que o tempo mudou lá fora. Preparado pra chuva? ☔',
      priority: 2,
      requiresResponse: false
    },
    {
      id: 'ask_about_day',
      type: 'question',
      message: 'Conta aí, como foi seu dia até agora?',
      priority: 3,
      requiresResponse: true,
      suggestedResponses: ['Foi ótimo!', 'Meio estressante', 'Normal, nada demais']
    },
    {
      id: 'gaming_suggestion',
      type: 'suggestion',
      message: 'Tô vendo que você gosta de jogar... Bora uma partidinha? Posso abrir seu jogo favorito! 🎮',
      priority: 4,
      requiresResponse: true,
      suggestedResponses: ['Bora! Abre o Steam', 'Não posso agora', 'Só mais tarde']
    },
    {
      id: 'productivity_check',
      type: 'follow_up',
      message: 'Tá conseguindo focar no que precisa fazer? Quer que eu feche algumas abas ou organize alguma coisa?',
      priority: 4,
      requiresResponse: true,
      suggestedResponses: ['Fecha o navegador pra mim', 'Tá de boa, obrigado!', 'Pode abrir o bloco de notas?']
    },
    {
      id: 'late_night',
      type: 'notification',
      message: 'Já tá tarde hein... 😴 Não vai dormir não? Quer que eu deixe o PC pronto pra quando você voltar?',
      priority: 6,
      requiresResponse: true,
      suggestedResponses: ['Tô indo já!', 'Só mais um pouquinho', 'Pode hibernar daqui a pouco']
    }
  ];

  constructor(
    karenBrain: KarenBrain,
    onKarenMessage: (message: string, topic?: string) => void,
    onStateChange?: (state: ConversationState) => void
  ) {
    this.karenBrain = karenBrain;
    this.onKarenMessage = onKarenMessage;
    this.onStateChange = onStateChange || (() => {});
    
    this.state = {
      isActive: false,
      currentTopic: null,
      lastInteraction: new Date(),
      conversationHistory: [],
      pendingResponse: false,
      silenceTimeout: 0
    };

    this.context = {
      recentCommands: [],
      sessionStartTime: new Date(),
      totalInteractions: 0
    };

    this.startSilenceTimer();
  }

  /**
   * Inicia o modo conversa
   */
  startConversation(): void {
    this.state.isActive = true;
    this.state.lastInteraction = new Date();
    
    // Enviar saudação inicial baseada no horário
    const greeting = this.getTimeBasedGreeting();
    this.sendKarenMessage(greeting, 'initial_greeting');
    
    this.updateState();
    console.log('💬 Modo conversa iniciado');
  }

  /**
   * Pausa o modo conversa
   */
  pauseConversation(): void {
    this.state.isActive = false;
    this.clearTimers();
    this.updateState();
    console.log('💬 Modo conversa pausado');
  }

  /**
   * Retoma o modo conversa
   */
  resumeConversation(): void {
    this.state.isActive = true;
    this.startSilenceTimer();
    this.updateState();
    console.log('💬 Modo conversa retomado');
  }

  /**
   * Processa mensagem do usuário no contexto da conversa
   */
  async processUserMessage(message: string): Promise<string> {
    // Atualizar estado
    this.state.lastInteraction = new Date();
    this.state.pendingResponse = false;
    this.context.totalInteractions++;
    this.context.recentCommands.push(message);
    
    // Manter apenas últimos 10 comandos
    if (this.context.recentCommands.length > 10) {
      this.context.recentCommands.shift();
    }

    // Adicionar ao histórico
    this.addToHistory('user', message);

    // Detectar humor do usuário
    this.detectUserMood(message);

    // Se estava esperando resposta de um tópico, marcar como respondido
    if (this.state.currentTopic) {
      console.log(`✅ Tópico ${this.state.currentTopic} respondido`);
      this.state.currentTopic = null;
    }

    this.updateState();

    // Se não está no modo conversa ativo, apenas processar normalmente
    if (!this.state.isActive) {
      return '';
    }

    // Gerar follow-up se apropriado
    await this.generateFollowUp(message);

    return '';
  }

  /**
   * A Karen inicia um tópico de conversa
   */
  async initiateTopic(topicId?: string): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      let topic: ConversationTopic | null;

      if (topicId) {
        topic = this.predefinedTopics.find(t => t.id === topicId) || null;
      } else {
        // Selecionar tópico baseado no contexto
        topic = this.selectAppropriateTopic();
      }

      // Se não encontrou tópico específico, usar fallback
      if (!topic && this.predefinedTopics.length > 0) {
        topic = this.predefinedTopics[0];
      }

      if (topic) {
        this.state.currentTopic = topic.id;
        this.state.pendingResponse = topic.requiresResponse;
        
        // Personalizar mensagem baseada no contexto
        const personalizedMessage = await this.personalizeMessage(topic.message);
        
        this.sendKarenMessage(personalizedMessage, topic.id);
        
        // Se precisa de resposta, iniciar timer de timeout
        if (topic.requiresResponse && topic.timeout) {
          this.startResponseTimeout(topic.timeout);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Gera follow-up baseado na mensagem do usuário
   */
  private async generateFollowUp(userMessage: string): Promise<void> {
    // Não gerar follow-up para comandos diretos
    if (this.isDirectCommand(userMessage)) {
      return;
    }

    // Decidir se deve fazer follow-up (30% de chance)
    if (Math.random() > 0.3) {
      return;
    }

    // Aguardar um momento antes do follow-up (parece mais natural)
    await this.delay(2000);

    // Gerar follow-up contextual usando Gemini
    const followUpPrompt = `O usuário disse: "${userMessage}"

Como Karen, gere uma resposta natural de follow-up que continue a conversa. Pode ser:
- Uma pergunta relacionada ao que ele disse
- Uma sugestão de algo relacionado
- Um comentário simpático
- Uma transição suave para outro assunto

Responda de forma natural, curta e amigável, como em uma conversa entre amigos.`;

    try {
      const followUpResult = await this.karenBrain.sendMessage(followUpPrompt);
    let followUp: string = '';
    if (followUpResult) {
      if (Array.isArray(followUpResult)) {
        followUp = followUpResult.join('\n\n');
      } else {
        followUp = followUpResult;
      }
    }

    if (followUp && !followUp.includes('Erro')) {    const _innerResponse = await this.karenBrain.sendMessage(followUpPrompt);
    let followUp: string = '';
    if (_innerResponse) {
      if (Array.isArray(_innerResponse)) {
        followUp = _innerResponse.join('\n\n');
      } else {
        followUp = _innerResponse;
      }
    }

    if (followUp && !followUp.includes('Erro')) {
      this.sendKarenMessage(followUp, 'generated_follow_up');
    }
      this.sendKarenMessage(followUp, 'generated_follow_up');
    }
    } catch (error) {
      console.log('Erro ao gerar follow-up:', error);
    }
  }

  /**
   * Seleciona tópico apropriado baseado no contexto
   */
  private selectAppropriateTopic(): ConversationTopic | null {
    const hour = new Date().getHours();
    const availableTopics: ConversationTopic[] = [];

    // Filtrar tópicos por contexto
    for (const topic of this.predefinedTopics) {
      let score = topic.priority;

      // Verificar horário apropriado
      if (topic.id === 'greeting_morning' && (hour < 6 || hour > 11)) continue;
      if (topic.id === 'greeting_afternoon' && (hour < 12 || hour > 17)) continue;
      if (topic.id === 'greeting_evening' && (hour < 18 || hour > 23)) continue;
      if (topic.id === 'late_night' && hour < 23) continue;

      // Aumentar score baseado em contexto
      if (topic.id === 'gaming_suggestion' && this.context.recentCommands.some(c => 
        c.includes('jogo') || c.includes('steam') || c.includes('jogar'))) {
        score += 3;
      }

      if (topic.id === 'suggest_break' && this.getSessionDuration() > 2 * 60 * 60 * 1000) { // 2 horas
        score += 4;
      }

      availableTopics.push({ ...topic, priority: score });
    }

    // Ordenar por prioridade e retornar o melhor
    availableTopics.sort((a, b) => b.priority - a.priority);
    
    // Retornar o primeiro ou null se não houver nenhum
    return availableTopics.length > 0 ? availableTopics[0] : null;
  }

  /**
   * Personaliza mensagem baseada no contexto
   */
  private async personalizeMessage(message: string): Promise<string> {
    const name = process.env.USERNAME || '';
    
    // Substituir placeholders
    let personalized = message
      .replace(/\{nome\}/g, name)
      .replace(/\{horas\}/g, new Date().getHours().toString());

    // Adicionar contexto de humor
    if (this.context.userMood === 'tired') {
      personalized += ' (Parece que você tá cansado, então vou ser breve!)';
    } else if (this.context.userMood === 'excited') {
      personalized = personalized.replace(/\?$/g, '! 🎉');
    }

    return personalized;
  }

  /**
   * Detecta humor do usuário pela mensagem
   */
  private detectUserMood(message: string): void {
    const lower = message.toLowerCase();
    
    if (lower.includes('cansado') || lower.includes('exausto') || lower.includes('sono')) {
      this.context.userMood = 'tired';
    } else if (lower.includes('put') || lower.includes('merda') || lower.includes('droga') || lower.includes('odeio')) {
      this.context.userMood = 'frustrated';
    } else if (lower.includes('legal') || lower.includes('massa') || lower.includes('show') || lower.includes('amo')) {
      this.context.userMood = 'excited';
    } else if (lower.includes('triste') || lower.includes('chateado')) {
      this.context.userMood = 'neutral';
    } else {
      this.context.userMood = 'happy';
    }
  }

  /**
   * Verifica se é comando direto (sem conversa)
   */
  private isDirectCommand(message: string): boolean {
    const commandPatterns = [
      /^(abre|abra|abrir|execute|rode|inicia|start)/i,
      /^(fecha|feche|fecha|fecha|close|kill)/i,
      /^(clica|clique|click|move)/i,
      /^(digita|digite|type)/i,
      /^(captura|screenshot|print)/i,
      /^(aumenta|diminui|mute|volume)/i,
      /^\/(.*)/  // comandos com /
    ];

    return commandPatterns.some(pattern => pattern.test(message));
  }

  /**
   * Envia mensagem da Karen
   */
  private sendKarenMessage(message: string, topic?: string): void {
    this.addToHistory('karen', message, topic);
    this.onKarenMessage(message, topic);
    this.state.lastInteraction = new Date();
    this.updateState();
  }

  /**
   * Adiciona ao histórico
   */
  private addToHistory(speaker: 'user' | 'karen', message: string, topic?: string): void {
    this.state.conversationHistory.push({
      speaker,
      message,
      timestamp: new Date(),
      topic
    });

    // Limitar histórico
    if (this.state.conversationHistory.length > 50) {
      this.state.conversationHistory.shift();
    }
  }

  /**
   * Timer para detectar silêncio e iniciar conversa
   */
  private startSilenceTimer(): void {
    const checkInterval = setInterval(() => {
      if (!this.state.isActive) return;

      const now = new Date();
      const silenceTime = now.getTime() - this.state.lastInteraction.getTime();
      this.state.silenceTimeout = silenceTime;

      // Se silêncio > 5 minutos e não está esperando resposta, iniciar tópico
      if (silenceTime > 5 * 60 * 1000 && !this.state.pendingResponse && !this.isProcessing) {
        // Só iniciar se tiver interação recente (sessão ativa)
        if (this.getSessionDuration() < 30 * 60 * 1000) { // 30 minutos de sessão
          this.initiateTopic();
        }
      }

      this.updateState();
    }, 10000); // Checar a cada 10 segundos

    this.timers.push(checkInterval);
  }

  /**
   * Timer para timeout de resposta
   */
  private startResponseTimeout(timeout: number): void {
    const timeoutTimer = setTimeout(() => {
      if (this.state.pendingResponse && this.state.currentTopic) {
        // Usuário não respondeu no tempo esperado
        this.sendKarenMessage(
          'Sem problema! Quando quiser conversar é só chamar. Tô por aqui! 👋',
          'timeout_response'
        );
        this.state.pendingResponse = false;
        this.state.currentTopic = null;
        this.updateState();
      }
    }, timeout);

    this.timers.push(timeoutTimer);
  }

  /**
   * Obtém saudação baseada no horário
   */
  private getTimeBasedGreeting(): string {
    const hour = new Date().getHours();
    const name = process.env.USERNAME || '';
    
    if (hour >= 5 && hour < 12) {
      return `Bom dia${name ? ', ' + name : ''}! ☀️ Que bom te ver! Como posso fazer seu dia melhor hoje?`;
    } else if (hour >= 12 && hour < 18) {
      return `Boa tarde${name ? ', ' + name : ''}! Como tá indo? Precisa de ajuda com alguma coisa?`;
    } else if (hour >= 18 && hour < 23) {
      return `Boa noite${name ? ', ' + name : ''}! 🌙 Como foi seu dia?`;
    } else {
      return `Ei${name ? ', ' + name : ''}! Já tá tarde... 😴 Tá precisando de alguma coisa ou só não consegue dormir?`;
    }
  }

  /**
   * Duração da sessão em ms
   */
  private getSessionDuration(): number {
    return new Date().getTime() - this.context.sessionStartTime.getTime();
  }

  /**
   * Atualiza estado e notifica listeners
   */
  private updateState(): void {
    this.onStateChange({ ...this.state });
  }

  /**
   * Limpa todos os timers
   */
  private clearTimers(): void {
    this.timers.forEach(timer => clearInterval(timer));
    this.timers = [];
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Obtém histórico de conversa formatado
   */
  getFormattedHistory(): string {
    return this.state.conversationHistory
      .map(h => `${h.speaker === 'karen' ? 'Karen' : 'Você'}: ${h.message}`)
      .join('\n\n');
  }

  /**
   * Obtém estatísticas da conversa
   */
  getStats(): {
    totalMessages: number;
    karenMessages: number;
    userMessages: number;
    sessionDuration: number;
    currentMood: string;
  } {
    return {
      totalMessages: this.state.conversationHistory.length,
      karenMessages: this.state.conversationHistory.filter(h => h.speaker === 'karen').length,
      userMessages: this.state.conversationHistory.filter(h => h.speaker === 'user').length,
      sessionDuration: this.getSessionDuration(),
      currentMood: this.context.userMood || 'neutral'
    };
  }

  /**
   * Destrói o manager e limpa recursos
   */
  destroy(): void {
    this.clearTimers();
    this.state.isActive = false;
  }
}

export const createConversationManager = (
  karenBrain: KarenBrain,
  onKarenMessage: (message: string, topic?: string) => void,
  onStateChange?: (state: ConversationState) => void
) => new ConversationManager(karenBrain, onKarenMessage, onStateChange);
