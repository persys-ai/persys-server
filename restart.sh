#!/bin/bash
cd /home/persys/server || exit
pm2 restart server.js > out.log 2> /dev/null
pm2 restart chat.js > out.log 2> /dev/null
pm2 restart rag.js > out.log 2> /dev/null
pm2 restart stats.js > out.log 2> /dev/null
pm2 save > out.log 2> /dev/null