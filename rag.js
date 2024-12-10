import ollama from "ollama";
import * as p from "peer";
import fs from "fs";
import {ChromaClient} from "chromadb";
import {v4 as uuidv4} from 'uuid';

const envData=JSON.parse(fs.readFileSync('env.json'));
const baseDir=envData['baseDir'];
const modelV=envData['modelV'];
const embedModel=envData['embedModel'];
const embeddingsDir=baseDir+'/embeddings';

const chroma=new ChromaClient({path:"http://localhost:8000"});
const peerServer=p.PeerServer({port:7000,path:"/rag"});
peerServer.on('connection',(client)=>{
    console.log('opened');
    const tokens=JSON.parse(fs.readFileSync(baseDir+'/t.json'));
    if(client.id && tokens.findIndex(x=>x.t===client.id)>-1) {
        console.log('authenticated');
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
