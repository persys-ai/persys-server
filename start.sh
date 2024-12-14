pm2 start stats.js -o /data/logs/stats-out.log -e /data/logs/stats-err.log
pm2 start chat.js -o /data/logs/chat-out.log -e /data/logs/chat-err.log
pm2 start rag.js -o /data/logs/rag-out.log -e /data/logs/rag-err.log
pm2 save
node server.js