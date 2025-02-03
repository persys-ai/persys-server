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
cp persys-server/.env.example persys-server/.env
```

2. Copy the hashed default password file to your data directory. **This is required.** Enter `persys` is the password. You can change it in your settings tab "gear icon".
```bash
cp p.json.example /path/to/data/p.json
```

3. Configure the following environment variables in your `.env` file:
- `DATA_PATH`: [IMPORTANT] This is the path in your machine where you want your data to persist. **Important**: You need to specify this.
- `BASE_DIR`: Base directory for data storage *inside* the container (default: "/data"), you probably don't need to change this unless you really need to.
- `HOST`: Host address, find yours with `hostname` or `echo $HOST` (default: "localhost"). 
- `MODEL_V`: Model version (default: "llama3.2:1b")
- `EMBED_MODEL`: Embedding model name (default: "nomic-embed-text")
- `SERVER_PORT`: Main server REST API port. Default is `3000`.
- `CHAT_PORT`: The port number for the chat application `chat.js`. Default is `9000`.
- `RAG_PORT`: The port number for the Retrieval Augmentation Generation application `rag.js`. Default is `7000`.
- `MONITOR_PORT`: The port number for the system monitor `stats.js` application (will be renamed to `monitor.js` eventually).
- `OLLAMA_HOST`: Ollama host. No need to change unless you have conflicts. Default is `ollama`.
- `OLLAMA_PORT`: Ollama port. No need to change unless you have conflicts. Default is `11434`.
- `CHROMA_HOST`: ChromaDB host. No need to change unless you have conflicts. Default is `chromadb`.
- `CHROMA_PORT`: ChromaDB port. No need to change unless you have conflicts. Default is `8000`.
- `CHAT_LIMITER`: Used for low ram devices. Limits session history to 4 exchanges for performance.
- `DEVICE_NAME`: [COMMERCIAL] (default: "my-device"). Needed for shipped devices.
- `SERIAL_NUMBER`: [COMMERCIAL] (default: "000-fff-000-fff"). Needed for shipped devices.
- `PUBLIC_KEY_VERSION`: [COMMERCIAL] (default: "1.0.0"). Needed for shipped devices.
- `FIRMWARE_VERSION`: [COMMERCIAL] (default: "1.0.1"). Needed for shipped devices.

[IMPORTANT] Set up your environment variables before running any services.
[COMMERCIAL] For shipped devices, you do not need to modify these, don't delete them though.

## Installation

### Compose File
Compose file using target file `-f` found inside the cloned repo `persys-server`.
The compose file will run the following images: `persys-server`, `ollama/ollama` and `chromadb/chroma`.
The `compose.yaml` file will use the `.env` file you copied from the Environments section above.

**Important**: Before you use the `docker compose` command, modify your `.env` file, namely the `DATA_PATH` variable. This is where your data will persist outside of the container.
This can be any folder you create on your machine.

```bash
docker build -t persys-server persys-server
docker pull ollama/ollama # if you do not have ollama already
docker pull chromadb/chroma # if you do not have chromadb already
docker compose -f persys-server/compose.yaml up -d

curl http://localhost:11434/api/pull -d '{"model":"llama3.2:1b"}' #if you have no models installed (pulling will be added to persys-client soon)
```

### Docker Image
Dockerfile is available for easy setup to run `persys-server` as a container.

When using Docker, you can either:
1. Set environment variables in your `.env` file
2. Pass them directly to the container using `-e` flags

#### Data & File Storage
Build images. If you downloaded the repo using `git clone` then your directory will be `persys-server`. Build the image the directory.
```bash
docker build -t persys-server persys-server
docker pull ollama/ollama # if you do not have ollama already
docker pull chromadb/chroma # if you do not have chromadb already
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

### Without Docker

#### Requirements

* `node`
* `ollama` (for chat and rag)
* `imagemagick` & `graphicsmagick` (for tesseract pdf conversions)
* `pm2` (manage services)
* `chromadb` (vector database)
* `tesseract-ocr` (read image text)

For local development:
1. Install dependencies: `npm install`
2. Set up your `.env` file as described above
3. Start the services: `npm start`

## Main Files

* `server.js` main server file
* `stats.js` monitoring service
* `rag.js` rag stream service
* `chat.js` chat stream service
