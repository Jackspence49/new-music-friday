# New Music Friday

A Node.js application for tracking and managing new music releases.

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