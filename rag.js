import {Ollama} from "ollama";
import * as p from "peer";
import fs from "fs";
import {ChromaClient} from "chromadb";
import {v4 as uuidv4} from 'uuid';
import { config, validateConfig } from './config/env.js';

validateConfig();

const ragPort=config.ragPort;
const baseDir=config.baseDir;
const modelV=config.modelV;
const ollamaHost=config.ollamaHost;
const ollamaPort=config.ollamaPort;
const embedModel=config.embedModel;
const chromaHost=config.chromaHost;
const chromaPort=config.chromaPort;
const embeddingsDir=baseDir+'/embeddings';

const ollama=new Ollama({host:'http://'+ollamaHost+':'+ollamaPort});
const chroma=new ChromaClient({path:"http://"+chromaHost+":"+chromaPort});
const peerServer=p.PeerServer({port:ragPort,path:"/rag"});
peerServer.on('connection',(client)=>{
    const tokens=JSON.parse(fs.readFileSync(baseDir+'/t.json'));
    if(client.id && tokens.findIndex(x=>x.t===client.id)>-1) {
        let reply='';
        //
        let settings=JSON.parse(fs.readFileSync(embeddingsDir+'/embeddings.json'));
        let activeEmbedding=settings[settings.findIndex(x=>x.active===1)];
        let embeddingPayload=JSON.parse(fs.readFileSync(embeddingsDir+'/'+activeEmbedding.name+'.embedding'));
        let prompt=embeddingPayload.prompt;
        //
        async function createCollection() {
            //await chroma.reset()
            return await chroma.createCollection({name:uuidv4()});
        }
        createCollection().then(collection=>{
            async function addToCollection() {
                for(let i=0;i<embeddingPayload.data.length;i++) {
                    await collection.add({
                        ids: ["id-"+i.toString()],
                        embeddings: [embeddingPayload.data[i].vector],
                        documents: [embeddingPayload.data[i].document]
                    });
                }
                return collection;
            }
            addToCollection().then(collection=>{
                //
                async function embedQuery() {
                    return {collection:collection,em:await ollama.embeddings({model:embedModel,prompt:prompt})};
                }
                embedQuery().then(result=>{
                    async function query() {
                        return await result.collection.query({
                            queryEmbeddings:[result.em.embedding],
                            nResults:1
                        });
                    }
                    query()
                        .then(queryData=>{
                            ollama.generate({model:modelV,prompt:"Using this data: "+queryData['documents'][0][0]+". Respond to this prompt: "+prompt,stream:true}).then(
                                async(stream)=>{
                                    for await(const chunk of stream) {
                                        reply=reply+chunk.response;
                                        client.send({content:chunk.response,done:chunk.done});
                                        // save history
                                        if(chunk.done) {
                                        }
                                    }
                                }
                            );
                        })
                        .catch((err)=>{
                            console.log(err);
                        });
                    //
                });
                //
            });
        });
    }
});
