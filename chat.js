import {Ollama} from "ollama";
import * as p from "peer";
import fs from "fs";
import { config, validateConfig } from './config/env.js';

validateConfig();

const chatPort=config.chatPort;
const baseDir=config.baseDir;
const ollamaHost=config.ollamaHost;
const ollamaPort=config.ollamaPort;
const modelV=config.modelV;
const chatDir=baseDir+'/chat';
const limiter=-4;

const ollama=new Ollama({host:'http://'+ollamaHost+':'+ollamaPort});
const peerServer=p.PeerServer({port:chatPort,path:"/chat"});
peerServer.on('connection',(client) => {
    const tokens=JSON.parse(fs.readFileSync(baseDir+'/t.json'));
    if(client.id && tokens.findIndex(x=>x.t===client.id)>-1) {
        let chats=JSON.parse(fs.readFileSync(chatDir+'/chats.json'));
        let chatSession=chats[chats.findIndex(x=>x.active===1)];
        //
        fs.readFile(chatDir+'/session_'+chatSession.id+'.json', (err, content) => {
            if(!err) {
                let history=JSON.parse(content);
                let context=[];
                context=history.slice(limiter);
                let reply='';
                ollama.chat({model:modelV,messages:context,keep_alive:-1,stream:true,options:{verbose:true}}).then(
                    async(stream)=>{
                        for await(const chunk of stream) {
                            reply=reply+chunk.message.content;
                            client.send({content:chunk.message.content,done:chunk.done});
                            // save history
                            if(chunk.done) {
                                history.push({role:'assistant',content:reply});
                                fs.writeFileSync(chatDir+'/session_'+chatSession.id+'.json',JSON.stringify(history));
                                //
                                if(chatSession.name.split(' ').indexOf('Untitled')>-1) {
                                    chats[chats.findIndex(x=>x.id===chatSession.id)].name=history[0].content;
                                    fs.writeFileSync(chatDir+'/chats.json',JSON.stringify(chats));
                                }
                            }
                        }
                    }
                )
            }
        });
    }
});
