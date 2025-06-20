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

  /**
   * Fetch all tracks from a playlist, handling pagination and normalization.
   * @param {string} spotifyUserId - The Spotify user ID (to get access token)
   * @param {string} playlistId - The Spotify playlist ID
   * @returns {Promise<Array>} Array of normalized track objects, or null if inaccessible
   */
  async getAllPlaylistTracks(spotifyUserId, playlistId) {
    try {
      const accessToken = await tokenService.getValidAccessToken(spotifyUserId);
      let url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`;
      let allTracks = [];
      while (url) {
        const response = await fetch(url, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (response.status === 404 || response.status === 403) {
          console.error(`[ERROR][FETCH] Playlist not accessible: ${playlistId} for user ${spotifyUserId}`);
          return null;
        }
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          console.error(`[RATE LIMIT] Hit rate limit for playlist ${playlistId}. Retry-After: ${retryAfter}`);
          return null;
        }
        if (!response.ok) {
          console.error(`[ERROR][FETCH] Failed to fetch tracks for playlist ${playlistId}: ${response.statusText}`);
          return null;
        }
        const data = await response.json();
        if (Array.isArray(data.items)) {
          for (const item of data.items) {
            if (!item.track) continue;
            allTracks.push({
              track_id: item.track.id,
              track_name: item.track.name,
              artist_names: item.track.artists.map(a => a.name).join(', '),
              added_at: item.added_at
            });
          }
        }
        url = data.next;
      }
      console.log(`[SUCCESS][FETCH] Fetched ${allTracks.length} tracks from playlist ${playlistId}`);
      return allTracks;
    } catch (error) {
      console.error(`[ERROR][FETCH] Exception fetching tracks for playlist ${playlistId}:`, error);
      return null;
    }
  }
}

export const spotifyService = new SpotifyService(); 