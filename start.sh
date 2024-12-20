if [ ! -f .env ]; then
    echo "Error: .env file not found"
    exit 1
fi

source .env

if [ -z "$BASE_DIR" ]; then
    echo "Error: BASE_DIR not set in .env file"
    exit 1
fi

pm2 start stats.js -o $BASE_DIR/logs/stats-out.log -e $BASE_DIR/logs/stats-err.log
pm2 start chat.js -o $BASE_DIR/logs/chat-out.log -e $BASE_DIR/logs/chat-err.log
pm2 start rag.js -o $BASE_DIR/logs/rag-out.log -e $BASE_DIR/logs/rag-err.log
pm2 save
node server.js > $BASE_DIR/logs/server-out.log 2> $BASE_DIR/logs/server-err.log