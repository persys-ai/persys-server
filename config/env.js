import dotenv from 'dotenv';
import path from 'path';

// Load .env file
dotenv.config();

const config = {
  baseDir: process.env.BASE_DIR || '/data',
  host: process.env.HOST || 'localhost',
  modelV: process.env.MODEL_V || 'llama2',
  embedModel: process.env.EMBED_MODEL || 'nomic-embed-text',
  port: parseInt(process.env.PORT, 10) || 3000
};

// Create a function to validate required env vars
const validateConfig = () => {
  const required = ['BASE_DIR', 'HOST'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};

export { config, validateConfig };