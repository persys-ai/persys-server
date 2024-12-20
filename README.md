# persys-server
Persys server. All services you need to run Persys locally.

Refer to the [main](https://github.com/persys-ai/persys) repo for contributions and other instructions.

This README is a work in progress, more instructions to come.

## Download
Download the `persys-server` code base.
```bash
git clone https://github.com/persys-ai/persys-server.git
```

## Environment Setup

1. Copy the example environment file to create your local configuration:
```bash
cp .env.example .env
```

2. Copy the hashed default password file to your data directory. **This is required.** Enter `persys` is the password. You can change it in your settings tab "gear icon".
```bash
cp p.json.example /path/to/data/p.json
```

3. Configure the following environment variables in your `.env` file:
- `BASE_DIR`: Base directory for data storage (default: "/data")
- `HOST`: Host address, find yours with `hostname` or `echo $HOST` (default: "hostname") **Important**: Change this to your hostname. 
- `MODEL_V`: Model version (default: "llama3.2:3b")
- `EMBED_MODEL`: Embedding model name (default: "nomic-embed-text")
- `PORT`: Server port (default: 3000)
- `DEVICE_NAME`: [COMMERCIAL] (default: "my-device")
- `SERIAL_NUMBER`: [COMMERCIAL] (default: "000-fff-000-fff")
- `PUBLIC_KEY_VERSION`: [COMMERCIAL] (default: "1.0.0")
- `FIRMWARE_VERSION`: [COMMERCIAL] (default: "1.0.1")

**Important**: Set up your environment variables before running any services.
[COMMERCIAL] tags are for shipped devices, you do not need to modify these.

## Installation

### Compose File
Compose file using target file `-f` found inside the cloned repo `persys-server`.
The compose file will run the following images: `persys-server`, `ollama/ollama` and `chromadb/chroma`.
If you're already running Ollama and/or ChromaDB, you can use just run the `persys-server` Docker image instead using the provided Dockerfile.
The `compose.yaml` file will use the `.env` file you copied from the Environments section above.
```bash
docker compose -f persys-server/compose.yaml up -d
```

### Docker Image
Dockerfile is available for easy setup to run `persys-server` as a container.

When using Docker, you can either:
1. Set environment variables in your `.env` file
2. Pass them directly to the container using `-e` flags

#### Data & File Storage
Replace `/path/to/data` with your desired base directory (e.g., `/home/username/persys-data` or wherever else you'd like to keep it). Do not set your base directory as the persys directory. This is where persys will keep all of your stuff.

Build images. If you downloaded the repo using `git clone` then your directory will be `persys-server`. Build the image the directory.
```bash
docker build -t persys-server persys-server
```

With `--env-file` option to let Docker know which environment file to use.
```bash
docker run -d \
  -p 3000:3000 -p 4000:4000 -p 7000:7000 -p 9000:9000 \
  --mount type=bind,src=/path/to/data,target=/data \
  --env-file=.env
  persys-server

```

Or with individual `-e` options to specify out environment variables.
```bash
docker run -d \
  -p 3000:3000 -p 4000:4000 -p 7000:7000 -p 9000:9000 \
  --mount type=bind,src=/path/to/data,target=/data \
  -e BASE_DIR=/data \
  -e HOST=localhost \
  persys-server
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
Persys uses the default Ollama port so no change needed.

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
