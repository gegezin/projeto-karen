import { contextBridge, ipcRenderer } from 'electron';

// Expõe a API para a janela do navegador (renderer.ts)
contextBridge.exposeInMainWorld('electronAPI', {
  sendMessage: (message: string) => ipcRenderer.invoke('send-message', message),
  getScreenshot: () => ipcRenderer.invoke('get-screenshot'),
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  hideWindow: () => ipcRenderer.send('hide-window'),
  showWindow: () => ipcRenderer.send('show-window'),
  toggleAlwaysOnTop: () => ipcRenderer.send('toggle-always-on-top'),
  onNewChat: (callback: () => void) => ipcRenderer.on('new-chat', () => callback()),
  onPermissionRequest: (callback: (data: any) => void) => ipcRenderer.on('permission-request', (event, data) => callback(data)),
  getKarenStatus: () => ipcRenderer.invoke('get-karen-status'),
  
  // History
  saveMessageToHistory: (role: string, content: string) => ipcRenderer.send('save-message-to-history', role, content),
  getHistoryStats: () => ipcRenderer.invoke('get-history-stats'),
  searchHistory: (query: string) => ipcRenderer.invoke('search-history', query),
  exportHistoryToMarkdown: () => ipcRenderer.invoke('export-history-markdown'),
  clearHistory: () => ipcRenderer.invoke('clear-history'),
  
  // Reminders
  createReminder: (title: string, timeMs: number, description?: string, repeat?: 'daily' | 'weekly' | 'once') => 
    ipcRenderer.invoke('create-reminder', title, timeMs, description, repeat),
  removeReminder: (id: string) => ipcRenderer.invoke('remove-reminder', id),
  getReminders: () => ipcRenderer.invoke('get-reminders'),
  clearAllReminders: () => ipcRenderer.invoke('clear-all-reminders'),
  parseReminderCommand: (text: string) => ipcRenderer.invoke('parse-reminder-command', text),
  
  // Game Mode
  activateGameMode: (gameName: string, keepApps?: string[]) => ipcRenderer.invoke('activate-game-mode', gameName, keepApps),
  deactivateGameMode: () => ipcRenderer.invoke('deactivate-game-mode'),
  getGameModeStatus: () => ipcRenderer.invoke('get-game-mode-status'),
  closeAppsByName: (appNames: string[]) => ipcRenderer.invoke('close-apps-by-name', appNames),
  getRunningHeavyApps: () => ipcRenderer.invoke('get-running-heavy-apps'),
  onShowNotification: (callback: (data: { title: string; description: string }) => void) => 
    ipcRenderer.on('show-notification', (event, data) => callback(data)),
  
  // Fragmented Messages
  onKarenMessageBlock: (callback: (data: { block: string; index: number; total: number; isLast: boolean }) => void) => 
    ipcRenderer.on('karen-message-block', (event, data) => callback(data)),
  
  // Spotify Authentication
  spotifyGenerateAuthUrl: () => ipcRenderer.invoke('spotify-generate-auth-url'),
  spotifyReceiveAuthCode: (code: string) => ipcRenderer.invoke('spotify-receive-auth-code', code),
  spotifyCheckAuth: () => ipcRenderer.invoke('spotify-check-auth')
});