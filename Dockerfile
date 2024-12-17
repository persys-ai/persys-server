FROM ubuntu:latest
WORKDIR /app

# node
RUN apt-get update
RUN apt-get install nodejs -y
RUN apt-get install npm -y
RUN apt-get install imagemagick -y
RUN apt-get install graphicsmagick -y

# pm2
RUN npm install pm2 -g

# copy persys
COPY . .

# environment variables
ENV BASE_DIR=/data \
    HOST=localhost \
    MODEL_V=llama3.2:3b \
    EMBED_MODEL=nomic-embed-text \
    PORT=3000

# install persys
RUN npm install

EXPOSE 3000
EXPOSE 4000
EXPOSE 7000
EXPOSE 9000

CMD ["sh","start.sh"]