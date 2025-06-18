import dotenv from 'dotenv';
import { config } from './config/config.js';

// Load environment variables
dotenv.config();

// Initialize application
const startApp = async () => {
  try {
    // Log startup information
    console.log(`Starting application in ${process.env.NODE_ENV || 'development'} mode`);
    console.log(`Server will run on port ${process.env.PORT || 3000}`);
    
    // TODO: Initialize database connection
    // TODO: Set up Spotify API client
    // TODO: Configure email service
    // TODO: Set up scheduled tasks
    
  } catch (error) {
    console.error('Failed to start application:', error);
    process.exit(1);
  }
};

// Start the application
startApp(); 