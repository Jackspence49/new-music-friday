import { spotifyService } from './spotifyService.js';
import { userModel } from '../models/User.js';
import { Encryption } from '../utils/encryption.js';

class TokenService {
  constructor() {
    this.tokenCache = new Map(); // In-memory cache for active tokens
  }

  async getValidAccessToken(spotifyId) {
    try {
      // Check if we have a valid cached token
      const cachedToken = this.tokenCache.get(spotifyId);
      if (cachedToken && cachedToken.expiresAt > Date.now()) {
        return cachedToken.accessToken;
      }

      // Get user from database
      const user = await userModel.findBySpotifyId(spotifyId);
      if (!user) {
        throw new Error(`No user found for Spotify ID: ${spotifyId}`);
      }

      // Refresh the token
      const tokens = await this.refreshToken(user.refreshToken);
      
      // Update cache
      this.tokenCache.set(spotifyId, {
        accessToken: tokens.accessToken,
        expiresAt: Date.now() + (tokens.expiresIn * 1000)
      });

      // Update database with new refresh token if it was refreshed
      if (tokens.refreshToken !== user.refreshToken) {
        await userModel.createOrUpdate(spotifyId, user.email, tokens.refreshToken);
      }

      return tokens.accessToken;
    } catch (error) {
      console.error(`Error getting valid access token for user ${spotifyId}:`, error);
      throw error;
    }
  }

  async refreshToken(refreshToken) {
    try {
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(
            `${spotifyService.clientId}:${spotifyService.clientSecret}`
          ).toString('base64')}`
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        })
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Token refresh failed:', error);
        throw new Error(`Token refresh failed: ${error.error_description || error.error}`);
      }

      const data = await response.json();
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken, // Spotify may not return a new refresh token
        expiresIn: data.expires_in
      };
    } catch (error) {
      console.error('Error refreshing token:', error);
      throw error;
    }
  }

  clearTokenCache(spotifyId) {
    this.tokenCache.delete(spotifyId);
  }
}

export const tokenService = new TokenService(); 