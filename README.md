# persys-server
Persys server. All services you need to run Persys locally.

Refer to the [main](https://github.com/persys-ai/persys) repo for contributions and other instructions.

This README is a work in progress, more instructions to come.
There will be a docker image too, if you create one based on this repo, open a pull request.


## Env

Change the env.json file to specify root directory and default model.
Please do this before running services.


## Requirements

Only Linux is currently supported.

* `node`

* `ollama` (for chat and rag)

* `imagemagick` & `graphicsmagick` (for tesseract pdf conversions)

* `pm2` (manage services)

* `chromadb` (vector database)


## Main Files

* `server.js` main server file

* `stats.js` monitoring service

* `rag.js` rag stream service

* `chat.js` chat stream service
