import SpotifyWebApi from 'spotify-web-api-node';
import { config } from '../config/config.js';

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

export { spotifyApi }; 