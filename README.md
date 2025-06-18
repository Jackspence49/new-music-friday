# New Music Friday

A Node.js application for managing Spotify playlists and discovering new music.

## Project Structure

```
├── src/              # Source code
│   ├── config/       # Configuration files
│   ├── models/       # Database models
│   ├── services/     # Business logic
│   └── utils/        # Utility functions
├── .env.example      # Environment variables template
├── .eslintrc.json    # ESLint configuration
├── .prettierrc       # Prettier configuration
└── package.json      # Project dependencies
```

## Security

### Encryption Setup

The application uses AES-256-GCM encryption for sensitive data with the following security features:

- Secure key derivation using PBKDF2
- Random salt generation for each encryption
- Authentication tags to prevent tampering
- Secure IV generation
- Input validation and error handling

To set up encryption:

1. Generate a secure encryption key (at least 32 characters):
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. Add the encryption key to your `.env` file:
   ```env
   ENCRYPTION_KEY=your_generated_key
   ```

### Security Best Practices

- Never commit the `.env` file to version control
- Regularly rotate the encryption key
- Use different encryption keys for development and production
- Keep the encryption key secure and limit access to it
- Monitor for any encryption/decryption failures

## Spotify Authorization Setup

Before running the application, you need to complete the one-time Spotify authorization process. Follow these steps:

### 1. Create a Spotify Developer Application

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Log in with your Spotify account
3. Click "Create App"
4. Fill in the application details:
   - App name: "New Music Friday" (or your preferred name)
   - App description: Brief description of your app
   - Website: Your website (optional)
   - Redirect URI: `http://localhost:3000/callback` (or your preferred callback URL)
5. Accept the terms and create the application
6. Note down your Client ID and Client Secret

### 2. Configure Environment Variables

Create a `.env` file in the project root with the following variables:

```env
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
SPOTIFY_REDIRECT_URI=http://localhost:3000/callback
DB_HOST=localhost
DB_PORT=3306
DB_NAME=your_database_name
DB_USER=your_database_user
DB_PASSWORD=your_database_password
JWT_SECRET=your_jwt_secret
```

### 3. Run the Authorization Script

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the authorization script:
   ```bash
   node src/scripts/spotifyAuth.js
   ```

3. The script will:
   - Display an authorization URL
   - Open the URL in your browser
   - Log in to Spotify and authorize the application
   - Redirect you to the callback URL
   - Copy the authorization code from the URL
   - Paste the code into the terminal when prompted

4. The script will then:
   - Exchange the code for access and refresh tokens
   - Fetch your Spotify profile
   - Store your credentials securely in the database
   - Display confirmation of successful authorization

### Troubleshooting

If you encounter any issues during the authorization process:

1. **Invalid authorization code**: Make sure you're copying the entire code from the redirect URL
2. **Database connection errors**: Verify your database credentials and ensure MySQL is running
3. **Spotify API errors**: Check that your Client ID and Client Secret are correct
4. **Encryption errors**: Ensure your JWT_SECRET is set and is a secure random string

### Security Notes

- The refresh token is encrypted before storage using AES-256-GCM
- The encryption key is derived from your JWT_SECRET
- Never share your .env file or expose your credentials
- Regularly rotate your JWT_SECRET for enhanced security

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and fill in your environment variables
4. Start the development server:
   ```bash
   npm run dev
   ```

## Scripts

- `npm run dev`: Start development server
- `npm run lint`: Run ESLint
- `npm run format`: Format code with Prettier
- `npm test`: Run tests

## Environment Variables

See `.env.example` for all required environment variables. 