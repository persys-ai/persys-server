import dotenv from 'dotenv';
import path from 'path';

// Load .env file
dotenv.config();

var config = {
  baseDir: process.env.BASE_DIR || '/data',
  host: process.env.HOST || 'localhost',
  modelV: process.env.MODEL_V || 'llama3.2:3b',
  embedModel: process.env.EMBED_MODEL || 'nomic-embed-text',
  port: parseInt(process.env.PORT, 10) || 3000,
  chromaHost: process.env.CHROMA_HOST || 'localhost',
  chromaPort: parseInt(process.env.CHROMA_PORT, 10) || 8000,
  deviceName:process.env.DEVICE_NAME || 'my-device',
  serialNumber:process.env.SERIAL_NUMBER || 'device-serial-no',
  publicKeyV:process.env.PUBLIC_KEY_VERSION || 'persys-pub-100.pem',
  firmwareVersion:process.env.FIRMWARE_VERSION || '1.0.1'
};

// Create a function to validate required env vars
const validateConfig = () => {
  const required = ['BASE_DIR', 'HOST', 'MODEL_V', 'EMBED_MODEL', 'PORT'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};

const setConfig = (newConfig) => {
  config = { ...config, ...newConfig };
}

export { config, validateConfig, setConfig };