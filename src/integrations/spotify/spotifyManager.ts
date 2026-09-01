/**
 * Gerenciador de Integração Spotify
 * Controla reprodução, playlists e informações de música via API Spotify
 */

import SpotifyWebApi from 'spotify-web-api-node';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export interface SpotifyTrack {
  name: string;
  artist: string;
  album: string;
  uri: string;
  duration_ms: number;
}

export interface SpotifyPlaylist {
  name: string;
  uri: string;
  tracks: number;
}

export class SpotifyManager {
  private spotifyApi: SpotifyWebApi;
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private isAuthenticated: boolean = false;
  private scopes = ['user-read-playback-state', 'user-modify-playback-state', 'user-read-currently-playing', 'playlist-read-private', 'playlist-modify-public', 'playlist-modify-private'];
  private tokenFilePath: string;

  constructor(
    clientId: string,
    clientSecret: string,
    redirectUri: string = 'http://127.0.0.1:8888/callback'
  ) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
    
    this.spotifyApi = new SpotifyWebApi({
      clientId: clientId,
      clientSecret: clientSecret,
      redirectUri: redirectUri
    });

    // Caminho para salvar tokens
    const userDataPath = app.getPath('userData');
    this.tokenFilePath = path.join(userDataPath, 'spotify-tokens.json');

    // Carregar tokens salvos se existirem
    this.loadSavedTokens();
  }

  /**
   * Carregar tokens salvos do arquivo
   */
  private loadSavedTokens(): void {
    try {
      if (fs.existsSync(this.tokenFilePath)) {
        const tokens = JSON.parse(fs.readFileSync(this.tokenFilePath, 'utf-8'));
        if (tokens.accessToken) {
          this.spotifyApi.setAccessToken(tokens.accessToken);
          this.isAuthenticated = true;
          console.log('Tokens do Spotify carregados do arquivo');
        }
        if (tokens.refreshToken) {
          this.spotifyApi.setRefreshToken(tokens.refreshToken);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar tokens salvos:', error);
    }
  }

  /**
   * Salvar tokens no arquivo
   */
  private saveTokens(accessToken: string, refreshToken: string): void {
    try {
      const tokens = {
        accessToken,
        refreshToken,
        timestamp: Date.now()
      };
      fs.writeFileSync(this.tokenFilePath, JSON.stringify(tokens, null, 2));
      console.log('Tokens do Spotify salvos no arquivo');
    } catch (error) {
      console.error('Erro ao salvar tokens:', error);
    }
  }

  /**
   * Gera URL de autorização OAuth2
   */
  generateAuthUrl(): string {
    const authorizeURL = this.spotifyApi.createAuthorizeURL(this.scopes, 'karen-assistant-state');
    console.log('=== ASSISTENTE KAREN IA ===');
    console.log('Acesse o link abaixo no seu navegador para autorizar o app:');
    console.log(authorizeURL);
    return authorizeURL;
  }

  /**
   * Recebe código de autorização e obtém tokens
   */
  async receiveAuthorizationCode(code: string): Promise<boolean> {
    try {
      const data = await this.spotifyApi.authorizationCodeGrant(code);
      
      console.log('Token de Acesso obtido com sucesso!');
      
      // Define os tokens no cliente do Spotify
      const accessToken = data.body['access_token'];
      const refreshToken = data.body['refresh_token'];
      
      this.spotifyApi.setAccessToken(accessToken);
      this.spotifyApi.setRefreshToken(refreshToken);
      this.isAuthenticated = true;

      // Salvar tokens no arquivo para persistência
      this.saveTokens(accessToken, refreshToken);

      // Testando se funciona
      const playback = await this.spotifyApi.getMyCurrentPlaybackState();
      if (playback.body && playback.body.is_playing) {
        console.log(`Tocando agora: ${playback.body.item?.name}`);
      } else {
        console.log('Conectado! Mas não há nada tocando no momento.');
      }

      return true;
    } catch (error) {
      console.error('Erro ao registrar o token:', error);
      return false;
    }
  }

  /**
   * Verifica se está autenticado
   */
  checkAuth(): boolean {
    return this.isAuthenticated;
  }

  /**
   * Renova o access token usando refresh token
   */
  async refreshAccessToken(): Promise<boolean> {
    try {
      const data = await this.spotifyApi.refreshAccessToken();
      const newAccessToken = data.body['access_token'];
      
      this.spotifyApi.setAccessToken(newAccessToken);
      this.isAuthenticated = true;
      
      // Salvar novo access token (refresh token permanece o mesmo)
      const currentRefreshToken = this.spotifyApi.getRefreshToken();
      if (currentRefreshToken) {
        this.saveTokens(newAccessToken, currentRefreshToken);
      }
      
      console.log('Access token renovado com sucesso');
      return true;
    } catch (error) {
      console.error('Erro ao renovar access token:', error);
      return false;
    }
  }

  /**
   * Executa ação com renovação automática de token
   */
  private async executeWithRefresh<T>(action: () => Promise<T>): Promise<T | null> {
    try {
      return await action();
    } catch (error: any) {
      // Se erro for 401 (token expirado), tenta renovar
      if (error.statusCode === 401 || error.message?.includes('expired')) {
        console.log('Token expirado, tentando renovar...');
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          return await action();
        }
      }
      throw error;
    }
  }

  /**
   * Pausar reprodução atual
   */
  async pause(): Promise<boolean> {
    if (!this.isAuthenticated) {
      console.error('Não autenticado com Spotify');
      return false;
    }

    try {
      await this.executeWithRefresh(() => this.spotifyApi.pause());
      return true;
    } catch (error) {
      console.error('Erro ao pausar:', error);
      return false;
    }
  }

  /**
   * Retomar reprodução
   */
  async resume(): Promise<boolean> {
    if (!this.isAuthenticated) {
      console.error('Não autenticado com Spotify');
      return false;
    }

    try {
      await this.executeWithRefresh(() => this.spotifyApi.play());
      return true;
    } catch (error) {
      console.error('Erro ao retomar:', error);
      return false;
    }
  }

  /**
   * Pular para próxima música
   */
  async next(): Promise<boolean> {
    if (!this.isAuthenticated) {
      console.error('Não autenticado com Spotify');
      return false;
    }

    try {
      await this.executeWithRefresh(() => this.spotifyApi.skipToNext());
      return true;
    } catch (error) {
      console.error('Erro ao pular:', error);
      return false;
    }
  }

  /**
   * Pular para música anterior
   */
  async previous(): Promise<boolean> {
    if (!this.isAuthenticated) {
      console.error('Não autenticado com Spotify');
      return false;
    }

    try {
      await this.executeWithRefresh(() => this.spotifyApi.skipToPrevious());
      return true;
    } catch (error) {
      console.error('Erro ao voltar:', error);
      return false;
    }
  }

  /**
   * Obter música atual
   */
  async getCurrentTrack(): Promise<SpotifyTrack | null> {
    if (!this.isAuthenticated) {
      console.error('Não autenticado com Spotify');
      return null;
    }

    try {
      const playback = await this.executeWithRefresh(() => this.spotifyApi.getMyCurrentPlayingTrack());
      
      if (!playback || !playback.body || !playback.body.item) {
        return null;
      }

      const item = playback.body.item as any;
      return {
        name: item.name,
        artist: item.artists.map((a: any) => a.name).join(', '),
        album: item.album.name,
        uri: item.uri,
        duration_ms: item.duration_ms
      };
    } catch (error) {
      console.error('Erro ao obter música atual:', error);
      return null;
    }
  }

  /**
   * Buscar música por nome
   */
  async searchTrack(name: string): Promise<SpotifyTrack | null> {
    if (!this.isAuthenticated) {
      console.error('Não autenticado com Spotify');
      return null;
    }

    try {
      const data = await this.executeWithRefresh(() => this.spotifyApi.searchTracks(name, { limit: 1 }));
      
      if (!data || !data.body.tracks || data.body.tracks.items.length === 0) {
        return null;
      }

      const track = data.body.tracks.items[0];
      return {
        name: track.name,
        artist: track.artists.map((a: any) => a.name).join(', '),
        album: track.album.name,
        uri: track.uri,
        duration_ms: track.duration_ms
      };
    } catch (error) {
      console.error('Erro ao buscar música:', error);
      return null;
    }
  }

  /**
   * Tocar música específica
   */
  async playTrack(trackUri: string): Promise<boolean> {
    if (!this.isAuthenticated) {
      console.error('Não autenticado com Spotify');
      return false;
    }

    try {
      await this.executeWithRefresh(() => this.spotifyApi.play({ uris: [trackUri] }));
      return true;
    } catch (error) {
      console.error('Erro ao tocar música:', error);
      return false;
    }
  }

  /**
   * Buscar playlist por nome
   */
  async searchPlaylist(name: string): Promise<SpotifyPlaylist | null> {
    if (!this.isAuthenticated) {
      console.error('Não autenticado com Spotify');
      return null;
    }

    try {
      const data = await this.executeWithRefresh(() => this.spotifyApi.searchPlaylists(name, { limit: 1 }));
      
      if (!data || !data.body.playlists || data.body.playlists.items.length === 0) {
        return null;
      }

      const playlist = data.body.playlists.items[0];
      return {
        name: playlist.name,
        uri: playlist.uri,
        tracks: playlist.tracks.total
      };
    } catch (error) {
      console.error('Erro ao buscar playlist:', error);
      return null;
    }
  }

  /**
   * Iniciar playlist específica
   */
  async playPlaylist(playlistUri: string): Promise<boolean> {
    if (!this.isAuthenticated) {
      console.error('Não autenticado com Spotify');
      return false;
    }

    try {
      await this.executeWithRefresh(() => this.spotifyApi.play({ context_uri: playlistUri }));
      return true;
    } catch (error) {
      console.error('Erro ao iniciar playlist:', error);
      return false;
    }
  }

  /**
   * Ajustar volume (0-100)
   */
  async setVolume(volume: number): Promise<boolean> {
    if (!this.isAuthenticated) {
      console.error('Não autenticado com Spotify');
      return false;
    }

    if (volume < 0 || volume > 100) {
      console.error('Volume deve estar entre 0 e 100');
      return false;
    }

    try {
      await this.executeWithRefresh(() => this.spotifyApi.setVolume(volume));
      return true;
    } catch (error) {
      console.error('Erro ao ajustar volume:', error);
      return false;
    }
  }

  /**
   * Obter status do player
   */
  async getPlayerStatus(): Promise<{ isPlaying: boolean; track: SpotifyTrack | null }> {
    const track = await this.getCurrentTrack();
    
    try {
      const playback = await this.executeWithRefresh(() => this.spotifyApi.getMyCurrentPlaybackState());
      return {
        isPlaying: playback ? playback.body.is_playing : false,
        track
      };
    } catch (error) {
      console.error('Erro ao obter status:', error);
      return { isPlaying: false, track };
    }
  }

  /**
   * Listar playlists do usuário
   */
  async getUserPlaylists(limit: number = 20): Promise<SpotifyPlaylist[]> {
    if (!this.isAuthenticated) {
      console.error('Não autenticado com Spotify');
      return [];
    }

    try {
      const data = await this.executeWithRefresh(() => this.spotifyApi.getUserPlaylists({ limit }));
      
      if (!data || !data.body.items) {
        return [];
      }

      return data.body.items.map((playlist: any) => ({
        name: playlist.name,
        uri: playlist.uri,
        tracks: playlist.tracks.total
      }));
    } catch (error) {
      console.error('Erro ao listar playlists:', error);
      return [];
    }
  }

  /**
   * Criar nova playlist
   */
  async createPlaylist(name: string, description: string = ''): Promise<SpotifyPlaylist | null> {
    if (!this.isAuthenticated) {
      console.error('Não autenticado com Spotify');
      return null;
    }

    try {
      const user = await this.executeWithRefresh(() => this.spotifyApi.getMe());
      if (!user || !user.body || !user.body.id) {
        console.error('Erro ao obter ID do usuário');
        return null;
      }
      
      const userId = user.body.id;
      
      const data: any = await this.executeWithRefresh(() => 
        (this.spotifyApi.createPlaylist as any)(userId, name, { description, public: false })
      );
      
      if (!data || !data.body) {
        console.error('Erro ao criar playlist: resposta vazia');
        return null;
      }
      
      return {
        name: data.body.name,
        uri: data.body.uri,
        tracks: 0
      };
    } catch (error) {
      console.error('Erro ao criar playlist:', error);
      return null;
    }
  }

  /**
   * Adicionar música à playlist
   */
  async addTrackToPlaylist(playlistUri: string, trackUri: string): Promise<boolean> {
    if (!this.isAuthenticated) {
      console.error('Não autenticado com Spotify');
      return false;
    }

    try {
      await this.executeWithRefresh(() => 
        this.spotifyApi.addTracksToPlaylist(playlistUri, [trackUri])
      );
      return true;
    } catch (error) {
      console.error('Erro ao adicionar música à playlist:', error);
      return false;
    }
  }

  /**
   * Obter músicas de uma playlist
   */
  async getPlaylistTracks(playlistUri: string): Promise<SpotifyTrack[]> {
    if (!this.isAuthenticated) {
      console.error('Não autenticado com Spotify');
      return [];
    }

    try {
      const data = await this.executeWithRefresh(() => 
        this.spotifyApi.getPlaylistTracks(playlistUri)
      );
      
      if (!data || !data.body.items) {
        return [];
      }

      return data.body.items.map((item: any) => ({
        name: item.track.name,
        artist: item.track.artists.map((a: any) => a.name).join(', '),
        album: item.track.album.name,
        uri: item.track.uri,
        duration_ms: item.track.duration_ms
      }));
    } catch (error) {
      console.error('Erro ao obter músicas da playlist:', error);
      return [];
    }
  }

  /**
   * Remover música da playlist
   */
  async removeTrackFromPlaylist(playlistUri: string, trackUri: string): Promise<boolean> {
    if (!this.isAuthenticated) {
      console.error('Não autenticado com Spotify');
      return false;
    }

    try {
      // Primeiro, obter as músicas da playlist para encontrar a posição
      const tracks = await this.getPlaylistTracks(playlistUri);
      const trackIndex = tracks.findIndex(t => t.uri === trackUri);
      
      if (trackIndex === -1) {
        console.error('Música não encontrada na playlist');
        return false;
      }

      // Remover usando a posição
      await this.executeWithRefresh(() => 
        this.spotifyApi.removeTracksFromPlaylist(playlistUri, [{ uri: trackUri, positions: [trackIndex] }])
      );
      return true;
    } catch (error) {
      console.error('Erro ao remover música da playlist:', error);
      return false;
    }
  }
}
