# persys-server
Persys server. All services you need to run Persys locally.

Refer to the [main](https://github.com/persys-ai/persys) repo for contributions and other instructions.

## Environment Setup

1. Copy the example environment file to create your local configuration:
```bash
cp .env.example .env
```

2. Configure the following environment variables in your `.env` file:
- `BASE_DIR`: Base directory for data storage (e.g., /data)
- `HOST`: Host address (default: localhost)
- `MODEL_V`: Model version (default: llama2)
- `EMBED_MODEL`: Embedding model name (default: nomic-embed-text)
- `PORT`: Server port (default: 3000)

**Important**: Set up your environment variables before running any services.

## Installation

### Docker
Dockerfile available.

When using Docker, you can either:
1. Set environment variables in your `.env` file
2. Pass them directly to the container using `-e` flags

#### Data & File Storage
Replace `/path/to/data` with your desired base directory (e.g., `/home/username/persys-data` or wherever else you'd like to keep it). Do not set your base directory as the persys directory. This is where persys will keep all of your stuff.

```bash
docker build -t persys .
docker run -d \
  -p 3000:3000 -p 4000:4000 -p 7000:7000 -p 9000:9000 \
  --mount type=bind,src=/path/to/data,target=/data \
  -e BASE_DIR=/data \
  -e HOST=localhost \
  --name persys_img persys
```

If you do not have Chromadb installed:
```bash
docker pull chromadb/chroma
docker run -d -p 8000:8000 --name chroma_img chromadb/chroma
```

If you do not have Ollama installed:
```bash
docker pull ollama/ollama
docker run -d -v ollama:/root/.ollama -p 11434:11434 --name ollama_img ollama/ollama
docker exec -it ollama_img ollama pull llama3.2
docker exec -it ollama_img ollama pull llama3.2:1b
docker exec -it ollama_img ollama pull nomic-embed-text
```
Persys uses the default ollama port so no change needed.

### Without Docker

#### Requirements

Only Linux is currently supported.

* `node`
* `ollama` (for chat and rag)
* `imagemagick` & `graphicsmagick` (for tesseract pdf conversions)
* `pm2` (manage services)
* `chromadb` (vector database)

For local development:
1. Install dependencies: `npm install`
2. Set up your `.env` file as described above
3. Start the services: `npm start`

## Main Files

* `server.js` main server file
* `stats.js` monitoring service
* `rag.js` rag stream service
* `chat.js` chat stream service