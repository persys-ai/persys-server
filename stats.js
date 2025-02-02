import * as p from "peer";
import fs from "fs";
import disk from "diskusage";
import osUtils from 'os-utils';
import { config, validateConfig } from './config/env.js';

validateConfig();

const monitorPort=config.monitorPort;
const baseDir=config.baseDir;
const peerServer=p.PeerServer({port:monitorPort,path:"/stats"});

peerServer.on('connection',(client) => {
    const tokens=JSON.parse(fs.readFileSync(baseDir+'/t.json'));
    if(client.id && tokens.findIndex(x=>x.t===client.id)>-1) {
        setInterval(()=>{
            disk.check(baseDir, (err, stats) => {
                osUtils.cpuUsage((s)=>{
                    client.send({cpu:s,totalMem:osUtils.totalmem(),freeMem:osUtils.freemem(),disk:stats});
                });
            });
        },500);
    }
});
