# persys-server
Persys server. All services you need to run Persys locally.

Refer to the [main](https://github.com/persys-ai/persys) repo for contributions and other instructions.

This README is a work in progress, more instructions to come.


## Env

Change the env.json file to specify root directory and default model.
Please do this before running services.

Host name has been added to `env.json`.

## Installation

### Docker
Dockerfile now available.

Replace `src=/data` with your base directory from `env.json` like `src=/path/to/my/base/dir`. Do not set your base directory as the persys directory.

`cd` into the persys directory and:
```
docker build -t persys .
docker run -d -p 3000:3000 -p 4000:4000 -p 7000:7000 -p 9000:9000 --mount type=bind,src=/data,target=/data --name persys_img persys
```

If you do not have Chromadb installed
```
docker pull chromadb/chroma
docker run -d -p 8000:8000 --name chroma_img chromadb/chroma
```


If you do not have Ollama installed
```
docker pull ollama/ollama
docker run -d -v ollama:/root/.ollama -p 11434:11434 --name ollama_img ollama/ollama
docker exec -it ollama_img ollama pull llama3.2
docker exec -it ollama_img ollama pull llama3.2:1b
docker exec -it ollama_img ollama pull nomic-embed-text
```
Persys uses the default ollama port so no change needed.


### Without Dockerfile

#### Requirements

Only Linux is currently supported.

* `node`

* `ollama` (for chat and rag)

* `imagemagick` & `graphicsmagick` (for tesseract pdf conversions)

* `pm2` (manage services)

* `chromadb` (vector database)

---

## Main Files

* `server.js` main server file

* `stats.js` monitoring service

* `rag.js` rag stream service

* `chat.js` chat stream service
