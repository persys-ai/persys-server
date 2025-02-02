import dotenv from 'dotenv';
import path from 'path';

// Load .env file
dotenv.config();

var config = {
  baseDir: process.env.BASE_DIR || '/data',
  host: process.env.HOST || 'localhost',
  modelV: process.env.MODEL_V || 'llama3.2:1b',
  embedModel: process.env.EMBED_MODEL || 'nomic-embed-text',
  port: parseInt(process.env.SERVER_PORT, 10) || 3000,
  chatPort: parseInt(process.env.CHAT_PORT) || 9000,
  ragPort: parseInt(process.env.RAG_PORT, 10) || 7000,
  monitorPort: parseInt(process.env.MONITOR_PORT, 10) || 4000,
  ollamaHost: process.env.OLLAMA_HOST || 'ollama',
  ollamaPort: parseInt(process.env.OLLAMA_PORT, 10) || 11434,
  chromaHost: process.env.CHROMA_HOST || 'chromadb',
  chromaPort: parseInt(process.env.CHROMA_PORT, 10) || 8000,
  deviceName:process.env.DEVICE_NAME || 'my-device',
  serialNumber:process.env.SERIAL_NUMBER || 'device-serial-no',
  publicKeyV:process.env.PUBLIC_KEY_VERSION || 'persys-pub-100.pem',
  firmwareVersion:process.env.FIRMWARE_VERSION || '1.0.1'
};

// Create a function to validate required env vars
const validateConfig = () => {
  const required = ['BASE_DIR', 'HOST', 'MODEL_V', 'EMBED_MODEL', 'SERVER_PORT'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};

const setConfig = (newConfig) => {
  config = { ...config, ...newConfig };
}

export { config, validateConfig, setConfig };
