# Novas Integrações da Karen

Este documento descreve as novas funcionalidades de qualidade de vida, lazer e comandos práticos adicionadas à Karen.

## 🎵 Integração Spotify

### Funcionalidades
- Pausar/retomar reprodução
- Pular música (próxima/anterior)
- Obter informações da música atual
- Iniciar playlists específicas

### Como Usar
Converse com a Karen usando comandos naturais:
- "Pausa a música"
- "Qual música está tocando?"
- "Pula para a próxima"
- "Toca a playlist de foco"
- "Inicia a playlist Gaming"
- "Busca a música Sagrado Profano"
- "Toca a música Sagrado Profano"

### Configuração
Para usar o Spotify, você precisa configurar as credenciais OAuth2:
1. Crie um app em [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Obtenha Client ID e Client Secret
3. Configure o Redirect URI como `http://127.0.0.1:8888/callback`
4. Atualize as credenciais no `main.ts`:
```typescript
this.spotifyManager = new SpotifyManager(
  'SEU_CLIENT_ID',
  'SEU_CLIENT_SECRET',
  'http://127.0.0.1:8888/callback'
);
```

### Autenticação OAuth2
O sistema usa fluxo OAuth2 completo com a biblioteca `spotify-web-api-node`:

**Passo 1: Gerar URL de autorização**
```typescript
const url = await window.electronAPI.spotifyGenerateAuthUrl();
console.log(url); // URL para acessar no navegador
```

**Passo 2: Acessar URL no navegador**
- Abra a URL retornada no navegador
- Faça login no Spotify
- Autorize o app Karen Assistant

**Passo 3: Copiar código de autorização**
- O navegador redirecionará para `http://127.0.0.1:8888/callback?code=...`
- Copie o código após `?code=`

**Passo 4: Enviar código para o app**
```typescript
const result = await window.electronAPI.spotifyReceiveAuthCode('SEU_CODIGO');
if (result.success) {
  console.log('Autenticado com sucesso!');
}
```

**Verificar autenticação**
```typescript
const isAuth = await window.electronAPI.spotifyCheckAuth();
console.log('Autenticado:', isAuth);
```

## ⚡ Atalhos Globais (Modos)

### Modos Disponíveis
- **Modo Dev**: Abre VS Code, terminal e inicia playlist de foco
- **Modo Gamer**: Fecha apps pesados, abre launcher e inicia playlist gamer
- **Modo Relax**: Ajusta volume para baixo, inicia playlist relax
- **Modo Foco**: Fecha apps distrativos, inicia playlist de foco

### Como Usar
- "Ativa o modo dev"
- "Vamos para o modo gamer"
- "Quero entrar no modo relax"
- "Modo foco"

### Criar Modos Personalizados
Você pode criar modos customizados no `ShortcutManager`:
```typescript
this.modes.set('meu-modo', {
  name: 'Meu Modo',
  description: 'Descrição do modo',
  actions: [
    { type: 'open_app', params: { name: 'app-name' } },
    { type: 'spotify_playlist', params: { playlistName: 'Playlist' } }
  ]
});
```

## 🎮 Minecraft Local

### Funcionalidades
- Análise de logs em busca de erros e crashes
- Listagem de mods instalados
- Relatório completo de diagnóstico
- Habilitar/desabilitar mods

### Como Usar
- "Analisa o log do Minecraft"
- "Lista todos os mods instalados"
- "Gera um relatório de diagnóstico do Minecraft"
- "Desabilita o mod [nome]"
- "Habilita o mod [nome]"

### Caminho do Minecraft
Por padrão, o sistema busca em:
- Windows: `%APPDATA%\.minecraft`
- Você pode configurar um caminho customizado:
```typescript
const minecraftManager = new MinecraftManager('C:/caminho/customizado');
```

### Relatório de Diagnóstico
O relatório inclui:
- Informações do sistema (Java, OS, memória)
- Lista de mods instalados
- Análise de logs (erros, warnings, crashes)
- Mods com mais erros
- Últimos erros encontrados

## 📝 Exemplos de Conversação

### Spotify
```
Você: Qual música está tocando?
Karen: Está tocando "Bohemian Rhapsody" de Queen no álbum "A Night at the Opera"

Você: Pula para a próxima
Karen: Pronto, pulando para a próxima música 🎵
```

### Atalhos
```
Você: Ativa o modo dev
Karen: Abrindo VS Code e terminal... Iniciando playlist de foco... Modo dev ativado! 💻
```

### Minecraft
```
Você: Analisa o log do Minecraft
Karen: Analisando log... Encontrei 5 erros e 2 warnings. O mod "OptiFine" teve 3 erros. Último erro: NullPointerException em BlockRenderer.java
```

## 🔧 Configuração Avançada

### Spotify OAuth2
Para autenticação completa com OAuth2, implemente o fluxo no `SpotifyManager.authenticate()`:
1. Redirecionar usuário para URL de autorização
2. Receber código de autorização via callback
3. Trocar código por access token
4. Salvar refresh token para renovação automática

### Customizar Modos
Edite o método `initializeDefaultModes()` no `ShortcutManager` para adicionar ou modificar modos.

### Caminho do Minecraft
Use `minecraftManager.setMinecraftPath('caminho')` para definir um caminho customizado.

## 🚀 Próximos Passos

- [ ] Implementar autenticação OAuth2 completa do Spotify
- [ ] Adicionar mais comandos de controle do Spotify (volume, shuffle, repeat)
- [ ] Criar interface visual para configurar modos
- [ ] Adicionar suporte a múltiplos perfis do Minecraft
- [ ] Implementar sugestões automáticas de mods baseadas em logs

## 📚 Arquivos Criados

- `src/integrations/spotify/spotifyManager.ts` - Gerenciador Spotify
- `src/integrations/shortcuts/shortcutManager.ts` - Gerenciador de atalhos
- `src/integrations/minecraft/minecraftManager.ts` - Gerenciador Minecraft
- Atualizações em `src/gemini/karenbrain.ts` - Novas ferramentas registradas
- Atualizações em `src/main/main.ts` - Instanciação dos novos managers
