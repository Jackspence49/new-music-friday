import SpotifyWebApi from 'spotify-web-api-node';
import { config } from '../config/config.js';
import { tokenService } from './tokenService.js';

// Initialize Spotify API client
const spotifyApi = new SpotifyWebApi({
  clientId: config.spotify.clientId,
  clientSecret: config.spotify.clientSecret,
  redirectUri: config.spotify.redirectUri,
});

// Get new releases
export const getNewReleases = async (limit = 20) => {
  try {
    const response = await spotifyApi.getNewReleases({ limit });
    return response.body.albums.items;
  } catch (error) {
    console.error('Error fetching new releases:', error);
    throw error;
  }
};

// Search for tracks
export const searchTracks = async (query, limit = 20) => {
  try {
    const response = await spotifyApi.searchTracks(query, { limit });
    return response.body.tracks.items;
  } catch (error) {
    console.error('Error searching tracks:', error);
    throw error;
  }
};

// Set access token
export const setAccessToken = (token) => {
  spotifyApi.setAccessToken(token);
};

/**
 * Create a playlist for a user.
 * @param {string} spotifyUserId - The Spotify user ID
 * @param {string} name - The playlist name
 * @param {object} options - Playlist options (public, description)
 * @returns {Promise<object>} The created playlist object
 */
export const createUserPlaylist = async (spotifyUserId, name, options = {}) => {
  try {
    const accessToken = await tokenService.getValidAccessToken(spotifyUserId);
    spotifyApi.setAccessToken(accessToken);
    const response = await spotifyApi.createPlaylist(name, options);
    return response.body;
  } catch (error) {
    console.error('[SPOTIFY][CREATE PLAYLIST] Error:', error);
    throw error;
  }
};

/**
 * Remove all tracks from a playlist (clear playlist).
 * @param {string} spotifyUserId - The Spotify user ID
 * @param {string} playlistId - The Spotify playlist ID
 * @returns {Promise<void>}
 */
export const clearPlaylistTracks = async (spotifyUserId, playlistId) => {
  try {
    const accessToken = await tokenService.getValidAccessToken(spotifyUserId);
    spotifyApi.setAccessToken(accessToken);
    // Get all track URIs in the playlist
    const tracks = await spotifyApi.getPlaylistTracks(playlistId, { fields: 'items(track(uri))', limit: 100 });
    const uris = tracks.body.items.map(item => item.track && item.track.uri).filter(Boolean);
    if (uris.length === 0) return;
    // Remove in batches of 100
    for (let i = 0; i < uris.length; i += 100) {
      const batch = uris.slice(i, i + 100).map(uri => ({ uri }));
      await spotifyApi.removeTracksFromPlaylist(playlistId, batch);
    }
  } catch (error) {
    console.error('[SPOTIFY][CLEAR PLAYLIST] Error:', error);
    throw error;
  }
};

/**
 * Add tracks to a playlist in batches.
 * @param {string} spotifyUserId - The Spotify user ID
 * @param {string} playlistId - The Spotify playlist ID
 * @param {string[]} trackUris - Array of Spotify track URIs
 * @returns {Promise<void>}
 */
export const addTracksToPlaylist = async (spotifyUserId, playlistId, trackUris) => {
  try {
    const accessToken = await tokenService.getValidAccessToken(spotifyUserId);
    spotifyApi.setAccessToken(accessToken);
    for (let i = 0; i < trackUris.length; i += 100) {
      const batch = trackUris.slice(i, i + 100);
      await spotifyApi.addTracksToPlaylist(playlistId, batch);
    }
  } catch (error) {
    console.error('[SPOTIFY][ADD TRACKS] Error:', error);
    throw error;
  }
};

/**
 * Update playlist name and/or description.
 * @param {string} spotifyUserId - The Spotify user ID
 * @param {string} playlistId - The Spotify playlist ID
 * @param {object} options - { name, description }
 * @returns {Promise<void>}
 */
export const updatePlaylistDetails = async (spotifyUserId, playlistId, options) => {
  try {
    const accessToken = await tokenService.getValidAccessToken(spotifyUserId);
    spotifyApi.setAccessToken(accessToken);
    await spotifyApi.changePlaylistDetails(playlistId, options);
  } catch (error) {
    console.error('[SPOTIFY][UPDATE PLAYLIST DETAILS] Error:', error);
    throw error;
  }
};

export { spotifyApi }; 