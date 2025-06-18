import { config } from '../config/config.js';
import crypto from 'crypto';
import { tokenService } from './tokenService.js';

class SpotifyService {
  constructor() {
    this.clientId = config.spotify.clientId;
    this.clientSecret = config.spotify.clientSecret;
    this.redirectUri = config.spotify.redirectUri;
  }

  getAuthorizationUrl() {
    const scope = 'user-read-private user-read-email playlist-read-private playlist-modify-public playlist-modify-private';
    const state = crypto.randomBytes(16).toString('hex');
    
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      scope: scope,
      redirect_uri: this.redirectUri,
      state: state
    });

    return `https://accounts.spotify.com/authorize?${params.toString()}`;
  }

  async exchangeCodeForTokens(code) {
    try {
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: this.redirectUri
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to exchange code: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in
      };
    } catch (error) {
      console.error('Error exchanging code for tokens:', error);
      throw error;
    }
  }

  async getUserProfile(spotifyId) {
    try {
      const accessToken = await tokenService.getValidAccessToken(spotifyId);
      
      const response = await fetch('https://api.spotify.com/v1/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get user profile: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting user profile:', error);
      throw error;
    }
  }

  // Add more Spotify API methods here, all using tokenService.getValidAccessToken()
  async getPlaylists(spotifyId) {
    try {
      const accessToken = await tokenService.getValidAccessToken(spotifyId);
      
      const response = await fetch('https://api.spotify.com/v1/me/playlists', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get playlists: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting playlists:', error);
      throw error;
    }
  }
}

export const spotifyService = new SpotifyService(); 