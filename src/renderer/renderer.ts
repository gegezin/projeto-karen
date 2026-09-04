// @ts-nocheck

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  imageData?: string;
}

class AppState {
  isLoading = false;
  ttsEnabled = false;
  messages: Array<Message> = [];
}

const state = new AppState();
let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let isRecording = false;

function getElectronAPI(): any {
  const api = (window as any).electronAPI;
  if (!api) {
    console.error('ElectronAPI não disponível. Verifique a configuração do Electron.');
    return null;
  }
  return api;
}

// ============ ELEMENTOS DOM ============

let el: {
  chatContainer: HTMLElement | null;
  messages: HTMLElement | null;
  welcomeMessage: HTMLElement | null;
  messageInput: HTMLTextAreaElement | null;
  btnSend: HTMLButtonElement | null;
  btnMic: HTMLButtonElement | null;
  btnScreenshot: HTMLButtonElement | null;
  btnClear: HTMLButtonElement | null;
  btnMinimize: HTMLButtonElement | null;
  btnClose: HTMLButtonElement | null;
  btnTtsToggle: HTMLButtonElement | null;
  btnAlwaysOnTop: HTMLButtonElement | null;
  btnFullscreen: HTMLButtonElement | null;
  statusDot: HTMLElement | null;
  statusText: HTMLElement | null;
  statusModel: HTMLElement | null;
  modelSelect: HTMLSelectElement | null;
  chipRow: HTMLElement | null;
};

function bindElements(): void {
  el = {
    chatContainer: document.getElementById('chat-container'),
    messages: document.getElementById('messages'),
    welcomeMessage: document.getElementById('welcome-message'),
    messageInput: document.getElementById('message-input') as HTMLTextAreaElement,
    btnSend: document.getElementById('btn-send') as HTMLButtonElement,
    btnMic: document.getElementById('btn-mic') as HTMLButtonElement,
    btnScreenshot: document.getElementById('btn-screenshot') as HTMLButtonElement,
    btnClear: document.getElementById('btn-clear') as HTMLButtonElement,
    btnMinimize: document.getElementById('btn-minimize') as HTMLButtonElement,
    btnClose: document.getElementById('btn-close') as HTMLButtonElement,
    btnTtsToggle: document.getElementById('btn-tts-toggle') as HTMLButtonElement,
    btnAlwaysOnTop: document.getElementById('btn-always-on-top') as HTMLButtonElement,
    btnFullscreen: document.getElementById('btn-fullscreen') as HTMLButtonElement,
    statusDot: document.getElementById('status-dot'),
    statusText: document.getElementById('status-text'),
    statusModel: document.getElementById('status-model'),
    modelSelect: document.getElementById('model-select') as HTMLSelectElement,
    chipRow: document.getElementById('chip-row'),
  };

  const missing = Object.entries(el).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length > 0) {
    console.warn('Elementos não encontrados no DOM:', missing.join(', '));
  }
}

// ============ INICIALIZAÇÃO ============

document.addEventListener('DOMContentLoaded', () => {
  bindElements();
  setupEventListeners();
  setupAutoResize();
  setupModelPicker();
  refreshStatus();
  setInterval(refreshStatus, 15000);
});

function setupEventListeners(): void {
  el.messageInput?.addEventListener('input', updateSendButton);
  el.messageInput?.addEventListener('keydown', handleInputKeydown);
  el.messageInput?.addEventListener('paste', handlePaste);
  el.btnSend?.addEventListener('click', sendMessage);
  el.btnMic?.addEventListener('click', toggleRecording);
  el.btnScreenshot?.addEventListener('click', attachScreenshot);
  el.btnClear?.addEventListener('click', clearChat);
  el.btnTtsToggle?.addEventListener('click', () => {
    state.ttsEnabled = !state.ttsEnabled;
    el.btnTtsToggle?.classList.toggle('active', state.ttsEnabled);
    if (!state.ttsEnabled) {
      getElectronAPI()?.stopSpeaking?.();
    }
    showToast(state.ttsEnabled ? '🔊 Karen vai falar as respostas' : '🔇 Voz desativada');
  });

  el.btnMinimize?.addEventListener('click', () => getElectronAPI()?.minimizeWindow());
  el.btnClose?.addEventListener('click', () => getElectronAPI()?.hideWindow());
  el.btnAlwaysOnTop?.addEventListener('click', () => {
    getElectronAPI()?.toggleAlwaysOnTop();
    el.btnAlwaysOnTop?.classList.toggle('active');
  });

  el.btnFullscreen?.addEventListener('click', async () => {
    try {
      const fullscreen = await getElectronAPI()?.toggleFullscreen?.();
      updateFullscreenButton(!!fullscreen);
    } catch {
      showToast('Não foi possível alternar a tela cheia');
    }
  });

  getElectronAPI()?.onFullscreenStateChanged?.((fullscreen: boolean) => {
    updateFullscreenButton(fullscreen);
  });

  el.chipRow?.addEventListener('click', (e: MouseEvent) => {
    const chip = (e.target as HTMLElement).closest<HTMLElement>('[data-command]');
    if (!chip) return;
    insertCommand(chip.dataset.command || '');
  });

  const api = getElectronAPI();
  api?.onKarenMessageBlock?.((data: { block: string }) => {
    addMessage('assistant', data.block);
  });
  api?.onNewChat?.(() => clearChat());
}

function updateFullscreenButton(fullscreen: boolean): void {
  el.btnFullscreen?.classList.toggle('active', fullscreen);
  el.btnFullscreen?.setAttribute('aria-label', fullscreen ? 'Sair da tela cheia' : 'Tela cheia');
  el.btnFullscreen?.setAttribute('title', fullscreen ? 'Sair da tela cheia' : 'Tela cheia');
}

async function toggleRecording(): Promise<void> {
  if (isRecording) {
    mediaRecorder?.stop();
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      isRecording = false;
      el.btnMic?.classList.remove('recording');
      stream.getTracks().forEach(track => track.stop());

      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      const arrayBuffer = await audioBlob.arrayBuffer();

      showToast('🎙️ Transcrevendo...');
      const result = await getElectronAPI()?.transcribeAudio?.(arrayBuffer);

      if (result?.success && result.text) {
        if (el.messageInput) {
          el.messageInput.value = result.text;
          updateSendButton();
          el.messageInput.focus();
        }
      } else {
        showToast(`⚠️ ${result?.error || 'Não consegui entender o áudio'}`);
      }
    };

    mediaRecorder.start();
    isRecording = true;
    el.btnMic?.classList.add('recording');
    showToast('🎙️ Gravando... clique de novo para parar');
  } catch (error) {
    showToast('❌ Não consegui acessar o microfone');
  }
}

async function setupModelPicker(): Promise<void> {
  const api = getElectronAPI();
  if (!el.modelSelect || !api?.getAvailableModels) return;

  const models = await api.getAvailableModels();
  el.modelSelect.innerHTML = '';

  for (const model of models) {
    const option = document.createElement('option');
    option.value = model.name;
    option.textContent = model.label;
    el.modelSelect.appendChild(option);
  }

  const status = await api.getKarenStatus?.();
  if (status?.model) el.modelSelect.value = status.model;

  el.modelSelect.addEventListener('change', async () => {
    const result = await api.setKarenModel?.(el.modelSelect!.value);
    if (!result?.success) {
      showToast('Não foi possível trocar o modelo');
      return;
    }
    setStatus(false, result.model);
    showToast(`Modelo alterado: ${result.model}`);
  });
}

function setupAutoResize(): void {
  const textarea = el.messageInput;
  if (!textarea) return;
  textarea.addEventListener('input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  });
}

function insertCommand(command: string): void {
  if (!el.messageInput) return;
  el.messageInput.value = command;
  el.messageInput.focus();
  updateSendButton();
}
(window as any).insertCommand = insertCommand;

// ============ STATUS ============

async function refreshStatus(): Promise<void> {
  try {
    const api = getElectronAPI();
    const status = await api?.getKarenStatus?.();
    setStatus(!!status?.online, status?.model);
  } catch {
    setStatus(false);
  }
}

function setStatus(online: boolean, model?: string): void {
  el.statusDot?.classList.toggle('online', online);
  el.statusDot?.classList.toggle('offline', !online);
  if (el.statusText) el.statusText.textContent = online ? 'online' : 'offline';
  if (el.statusModel) el.statusModel.textContent = model || 'sem modelo';
}

// ============ ENVIO DE MENSAGEM ============

function updateSendButton(): void {
  const hasText = !!el.messageInput?.value.trim().length;
  if (el.btnSend) el.btnSend.disabled = !hasText || state.isLoading;
}

function handleInputKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function setLoading(loading: boolean): void {
  state.isLoading = loading;
  if (loading) {
    showThinkingIndicator();
  } else {
    hideThinkingIndicator();
  }
  updateSendButton();
}

async function sendMessage(): Promise<void> {
  const message = el.messageInput?.value.trim();
  if (!message || state.isLoading) return;

  addMessage('user', message);
  el.messageInput!.value = '';
  el.messageInput!.style.height = 'auto';
  updateSendButton();
  hideWelcome();
  setLoading(true);

  try {
    const api = getElectronAPI();
    if (!api?.sendMessage) throw new Error('ElectronAPI não disponível');

    const response = await api.sendMessage(message);

    if (response.success && response.isFragmented) {
      // blocos já foram enviados via onKarenMessageBlock
    } else if (response.success && response.response?.trim()) {
      addMessage('assistant', response.response);
    } else if (!response.success) {
      addMessage('assistant', `❌ Erro: ${response.error || 'Falha na comunicação'}`);
    } else {
      addMessage('assistant', 'Desculpe, não consegui gerar uma resposta. Tenta de novo?');
    }
  } catch (error) {
    addMessage('assistant', `❌ Erro: ${(error as Error).message}`);
  } finally {
    setLoading(false);
  }
}

// ============ ANEXOS ============

async function attachScreenshot(): Promise<void> {
  try {
    const api = getElectronAPI();
    const screenshot = await api?.getScreenshot?.();
    if (screenshot) {
      hideWelcome();
      addMessage('user', '[Screenshot anexada]', screenshot);
      showToast('📸 Screenshot anexado');
    } else {
      showToast('⚠️ Não consegui capturar a tela');
    }
  } catch (error) {
    showToast('❌ Erro ao capturar screenshot');
  }
}

function handlePaste(e: ClipboardEvent): void {
  const items = e.clipboardData?.items;
  if (!items) return;

  for (const item of items) {
    if (item.type.indexOf('image') === -1) continue;
    const file = item.getAsFile();
    if (!file) continue;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      hideWelcome();
      addMessage('user', '[Imagem colada]', base64);
    };
    reader.readAsDataURL(file);
    e.preventDefault();
  }
}

// ============ RENDERIZAÇÃO DE MENSAGENS ============

function hideWelcome(): void {
  if (el.welcomeMessage) el.welcomeMessage.style.display = 'none';
}

function addMessage(role: 'user' | 'assistant', content: string, imageData?: string): void {
  const timestamp = new Date();

  const entry = document.createElement('div');
  entry.className = `entry ${role}`;

  const tag = document.createElement('div');
  tag.className = 'entry-tag';
  tag.innerHTML = `<span class="entry-tag-dot"></span><span>${role === 'user' ? 'você' : 'karen'}</span>`;

  const body = document.createElement('div');
  body.className = 'entry-body';

  if (imageData) {
    const img = document.createElement('img');
    img.src = imageData;
    img.className = 'entry-image';
    body.appendChild(img);
  }

  const textEl = document.createElement('div');
  textEl.innerHTML = formatMessage(content);
  body.appendChild(textEl);

  if (role === 'assistant') {
    if (state.ttsEnabled) {
      getElectronAPI()?.speak?.(content).then((result: any) => {
        if (result?.success && result.audioDataUrl) {
          const audio = new Audio(result.audioDataUrl);
          audio.play().catch(() => {
            showToast('⚠️ Não consegui reproduzir o áudio');
          });
        } else if (result?.error) {
          showToast(`⚠️ Erro na voz: ${result.error}`);
        }
      });
    }

    const actions = document.createElement('div');
    actions.className = 'message-actions';

    const copyButton = document.createElement('button');
    copyButton.className = 'message-action';
    copyButton.type = 'button';
    copyButton.title = 'Copiar mensagem';
    copyButton.setAttribute('aria-label', 'Copiar mensagem');
    copyButton.textContent = 'Copiar';
    copyButton.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(content);
        copyButton.textContent = 'Copiado';
        setTimeout(() => { copyButton.textContent = 'Copiar'; }, 1500);
      } catch {
        showToast('Não foi possível copiar a mensagem');
      }
    });
    actions.appendChild(copyButton);
    body.appendChild(actions);

    body.querySelectorAll<HTMLAnchorElement>('a[data-external-url]').forEach((link) => {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        getElectronAPI()?.openExternalUrl?.(link.dataset.externalUrl || link.href);
      });
    });
  }

  const time = document.createElement('div');
  time.className = 'entry-time';
  time.textContent = formatTime(timestamp);

  entry.appendChild(tag);
  entry.appendChild(body);
  entry.appendChild(time);

  el.messages?.appendChild(entry);
  if (el.chatContainer) el.chatContainer.scrollTop = el.chatContainer.scrollHeight;

  state.messages.push({ role, content, timestamp, imageData });

  try {
    getElectronAPI()?.saveMessageToHistory?.(role, content);
  } catch {
    // histórico é best-effort, não bloqueia a UI
  }
}

function showThinkingIndicator(): void {
  hideThinkingIndicator();
  const entry = document.createElement('div');
  entry.className = 'entry assistant';
  entry.id = 'thinking-entry';
  entry.innerHTML = `
    <div class="entry-tag"><span class="entry-tag-dot"></span><span>karen</span></div>
    <div class="entry-body thinking">
      <div class="thinking-dots"><span></span><span></span><span></span></div>
    </div>
  `;
  el.messages?.appendChild(entry);
  if (el.chatContainer) el.chatContainer.scrollTop = el.chatContainer.scrollHeight;
}

function hideThinkingIndicator(): void {
  document.getElementById('thinking-entry')?.remove();
}

function formatMessage(content: string): string {
  let formatted = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  formatted = formatted.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
  formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
  formatted = formatted.replace(/\n/g, '<br>');

  // Renderiza somente links HTTP(S) como links clicáveis.
  formatted = formatted.replace(
    /https?:\/\/[^\s<>"']+/g,
    (url) => {
      const cleanUrl = url.replace(/[),.;!?]+$/g, '');
      const trailing = url.slice(cleanUrl.length);
      const escapedUrl = cleanUrl.replace(/&amp;/g, '&');
      return `<a href="${cleanUrl}" data-external-url="${escapedUrl}" rel="noreferrer">${cleanUrl}</a>${trailing}`;
    }
  );

  formatted = formatted.replace(
    /\[PERMISSÃO NECESSÁRIA\](.*?)(?=<br><br>|$)/gs,
    '<div class="permission-callout"><strong>⚠️ Permissão necessária</strong>$1</div>'
  );

  formatted = formatted.replace(
    /❌ Erro:(.*?)(?=<br>|$)/g,
    '<span class="error-text">❌ Erro:$1</span>'
  );

  return formatted;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function clearChat(): void {
  if (el.messages) el.messages.innerHTML = '';
  state.messages = [];
  if (el.welcomeMessage) el.welcomeMessage.style.display = 'flex';
  showToast('🗑️ Conversa limpa');
}

// ============ TOAST ============

function showToast(message: string): void {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastOut 0.25s ease forwards';
    setTimeout(() => toast.remove(), 250);
  }, 2800);
}
