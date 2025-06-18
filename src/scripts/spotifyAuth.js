import readline from 'readline';
import { spotifyService } from '../services/spotifyService.js';
import { userModel } from '../models/User.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function main() {
  try {
    console.log('Starting Spotify authorization process...');
    
    // Get authorization URL
    const authUrl = spotifyService.getAuthorizationUrl();
    console.log('\nPlease follow these steps:');
    console.log('1. Visit this URL in your browser:');
    console.log(authUrl);
    console.log('\n2. After authorizing, you will be redirected to a URL that looks like:');
    console.log('http://127.0.0.1:3000/callback?code=YOUR_AUTHORIZATION_CODE');
    console.log('\n3. Copy the ENTIRE URL from your browser\'s address bar');
    
    // Get the full redirect URL from user
    const redirectUrl = await prompt('\nPaste the full redirect URL here: ');
    
    // Extract the code from the URL
    const url = new URL(redirectUrl);
    const code = url.searchParams.get('code');
    
    if (!code) {
      throw new Error('No authorization code found in the redirect URL');
    }
    
    // Exchange code for tokens
    console.log('\nExchanging authorization code for tokens...');
    const tokens = await spotifyService.exchangeCodeForTokens(code);
    
    // Get user profile using the access token directly
    console.log('\nFetching user profile...');
    const response = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${tokens.accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get user profile: ${response.statusText}`);
    }

    const profile = await response.json();
    
    // Calculate token expiry
    const tokenExpiresAt = new Date(Date.now() + (tokens.expiresIn * 1000));
    
    // Create/update user in database
    console.log('\nStoring user information...');
    await userModel.createOrUpdate(
      profile.id,
      profile.email,
      tokens.refreshToken,
      tokenExpiresAt,
      tokens.accessToken
    );
    
    console.log('\nAuthorization completed successfully!');
    console.log(`User ID: ${profile.id}`);
    console.log(`Email: ${profile.email}`);
    console.log(`Token expires at: ${tokenExpiresAt.toISOString()}`);
    
  } catch (error) {
    console.error('\nError during authorization:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Initialize database table and run the script
userModel.createTable()
  .then(() => main())
  .catch(error => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  }); 