import http from "node:http";
import url from "url";
import fs from "fs";
import path from "path";
import os from "os";
import {Ollama} from "ollama";
import formidable from "formidable";
import mime from "mime";
import {v4 as uuidv4} from 'uuid';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import moment from 'moment';
import zipper from 'zip-local';
import { exec } from 'child_process';
import tesseract from "node-tesseract-ocr";
import { fromPath } from "pdf2pic";
import pdf from 'pdf-page-counter';
import { config, validateConfig } from './config/env.js';

validateConfig();

const server = http.createServer((req, res)=>{
    const baseDir=config.baseDir;
    const saltRounds=10;
    let body = '';
    let r={error:'',data:''}
    let url=new URL("http://"+os.hostname()+":3000/"+req.url);
    let s=url.searchParams;
    const uploadMaxFileSize=9000*1024*1024; // 9gb
    //
    if(req.url.split('/')[1]==='authenticate') {
        req.on('data', (chunk) => {
            body+=chunk;
        });
        req.on('end', () => {
            let payload=JSON.parse(body);
            let passcode=payload.passcode;
            let hashedPasscode=JSON.parse(fs.readFileSync(baseDir+'/p.json'))['p'];
            bcrypt.compare(passcode,hashedPasscode,(err,result)=>{
                if(result) {
                    if(!fs.existsSync(baseDir+'/t.json')) fs.writeFileSync(baseDir+'/t.json','[]');
                    let tokens=JSON.parse(fs.readFileSync(baseDir+'/t.json'));
                    let t=crypto.createHash('sha256').update(Math.random().toString()).digest('hex');
                    tokens.push({id:uuidv4(),t:t,timestamp:moment().unix(),alive:1});
                    fs.writeFileSync(baseDir+'/t.json',JSON.stringify(tokens));
                    r.data=t;
                }
                else {
                    r.error='Wrong passcode.';
                }
                res.writeHead(200,{'Content-Type':'application/json'});
                res.write(JSON.stringify(r));
                return res.end();
            });
        });
    }
    else {
        let tokens=JSON.parse(fs.readFileSync(baseDir+'/t.json'));
        if((req.headers['public-token'] && tokens.findIndex(x=>x.t===req.headers['public-token'])>-1) || (s.get('publicToken') && tokens.findIndex(x=>x.t===s.get('publicToken'))>-1)) {
            const host=config.host;
            let modelV=config.modelV;
            let embedModel=config.embedModel;
            //
            let chatDir=baseDir+'/chat';
            let filesDir=baseDir+'/files';
            let tempDir=baseDir+'/temp';
            let embeddingsDir=baseDir+'/embeddings';
            let settingsDir=baseDir+'/settings';
            let firmwareDir=baseDir+'/firmware';
            let logsDir=baseDir+'/logs';
            let appsDir=baseDir+'/apps';
            //
            if(!fs.existsSync(baseDir)) fs.mkdirSync(baseDir);
            //
            // chat
            if(!fs.existsSync(chatDir)) fs.mkdirSync(chatDir);
            if(!fs.existsSync(chatDir+'/chats.json') || fs.readFileSync(chatDir+'/chats.json')==='') fs.writeFile(chatDir+'/chats.json','[]',()=>{});
            if(!fs.existsSync(chatDir+'/personalities.json') || fs.readFileSync(chatDir+'/personalities.json')==='') fs.writeFile(chatDir+'/personalities.json',JSON.stringify([{id:"default",name:"PERSYS","active":1,"system":"Your name is Persys and you are a virtual personal assistant. Be brief in your answers."}]),()=>{});
            //
            // main files dir
            if(!fs.existsSync(filesDir)) fs.mkdirSync(filesDir);
            //
            // temp dir for zip downloads and pdf conversions
            if(!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
            //
            // embeddings dir
            if(!fs.existsSync(embeddingsDir)) fs.mkdirSync(embeddingsDir);
            if(!fs.existsSync(embeddingsDir+'/embeddings.json') || fs.readFileSync(embeddingsDir+'/embeddings.json')==='') fs.writeFileSync(embeddingsDir+'/embeddings.json','[]');
            //
            // settings dir
            if(!fs.existsSync(settingsDir)) fs.mkdirSync(settingsDir);
            if(!fs.existsSync(settingsDir+'/settings.json') || fs.readFileSync(settingsDir+'/settings.json')==='') fs.writeFileSync(settingsDir+'/settings.json',JSON.stringify({wallpapers:[{name:'default_wallpaper.jpg',active:1,default:1}]}));
            if(!fs.existsSync(settingsDir+'/wallpapers')) fs.mkdirSync(settingsDir+'/wallpapers');
            if(!fs.existsSync(settingsDir+'/wallpapers/default_wallpaper.jpg')) fs.copyFileSync('default_wallpaper.jpg',settingsDir+'/wallpapers/default_wallpaper.jpg');
            //
            // firmware update dir
            if(!fs.existsSync(firmwareDir)) fs.mkdirSync(firmwareDir);
            // logs dir
            if(!fs.existsSync(logsDir)) fs.mkdirSync(logsDir);
            //
            // apps dir
            if(!fs.existsSync(appsDir)) fs.mkdirSync(appsDir);
            if(!fs.existsSync(appsDir+'/todo.json') || fs.readFileSync(appsDir+'/todo.json')==='') fs.writeFile(appsDir+'/todo.json','[]',()=>{});
            if(!fs.existsSync(appsDir+'/cardclip.json') || fs.readFileSync(appsDir+'/cardclip.json')==='') fs.writeFile(appsDir+'/cardclip.json',JSON.stringify([{id:'default',firstName:'Persys Support',lastName:'', phone:'', email:'support@persys.ai',thumb:false}]),()=>{});
            if(!fs.existsSync(appsDir+'/cardclip')) fs.mkdirSync(appsDir+'/cardclip');
            if(!fs.existsSync(appsDir+'/paper')) fs.mkdirSync(appsDir+'/paper');
            //
            //
            const ollama=new Ollama({host:'http://'+host+':11434'});
            //
            //
            if(req.url.split('/')[1]==='sessions') {
                if(req.url.split('/')[2]==='logout') {
                    let tokens=JSON.parse(fs.readFileSync(baseDir+'/t.json'));
                    tokens.splice(tokens.findIndex(x=>x.id===req.headers['public-token']),1);
                    fs.writeFile(baseDir+'/t.json',JSON.stringify(tokens),(err) => {
                        if(!err) {
                            r.data='deleted';
                        }
                        else {
                            r.error='Could not log out.';
                        }
                        res.writeHead(200, {'Content-Type': 'application/json'});
                        res.write(JSON.stringify(r));
                        return res.end();
                    });
                }
                else if(req.url.split('/')[2]==='all') {
                    let tokens=JSON.parse(fs.readFileSync(baseDir+'/t.json'));
                    for(let i=0;i<tokens.length;i++) {
                        if(req.headers['public-token']===tokens[i].t) tokens[i].current=true;
                        tokens[i].t='';
                    }
                    r.data=tokens;
                    res.writeHead(200, {'Content-Type': 'application/json'});
                    res.write(JSON.stringify(r));
                    return res.end();
                }
                else if(req.url.split('/')[2]==='delete') {
                    req.on('data', (chunk) => {
                        body+=chunk;
                    });
                    req.on('end', () => {
                        let payload=JSON.parse(body);
                        let tokens=JSON.parse(fs.readFileSync(baseDir+'/t.json'));
                        tokens.splice(tokens.findIndex(x=>x.id===payload.id),1);
                        fs.writeFile(baseDir+'/t.json',JSON.stringify(tokens),(err) => {
                            if(!err) {
                                r.data='deleted';
                            }
                            else {
                                r.error='Could not delete session.';
                            }
                            res.writeHead(200,{'Content-Type':'application/json'});
                            res.write(JSON.stringify(r));
                            return res.end();
                        });
                    });
                }
            }
            //
            // about
            if(req.url.split('/')[1]==='about') {
                let about=JSON.parse(fs.readFileSync('about.json'));
                about.firmwareVersion=JSON.parse(fs.readFileSync('version.json')).version;
                r.data=about;
                res.writeHead(200,{'Content-Type':'application/json'});
                res.write(JSON.stringify(r));
                return res.end();
            }
            //
            // file system endpoints
            else if(req.url.split('/')[1]==='files') {
                if(req.url.split('/')[2]==='get') {
                    req.on('data', (chunk) => {
                        body+=chunk;
                    });
                    req.on('end', () => {
                        let payload=JSON.parse(body);
                        fs.readdir(filesDir+payload.path, (err, files) => {
                            let filesPacket=[];
                            files.forEach((fileItem,i)=>{
                                fs.stat(filesDir+'/'+payload.path+'/'+fileItem,(err,stats)=>{
                                    filesPacket.push({name:fileItem,isDirectory:stats.isDirectory(),mime:mime.getType(filesDir+'/'+payload.path+'/'+fileItem)});
                                    if(i===files.length-1) {
                                        if(!err) r.data=filesPacket;
                                        else r.error=err;
                                        res.writeHead(200, {'Content-Type': 'application/json'});
                                        res.write(JSON.stringify(r));
                                        return res.end();
                                    }
                                });
                            });
                        });
                    });
                }
                else if(req.url.split('/')[2]==='upload') {
                    let form=formidable({maxFileSize:uploadMaxFileSize});
                    form.parse(req, (err, fields, files)=>{
                        let fileContent=fs.readFileSync(files.file[0].filepath);
                        fs.writeFile(filesDir+'/'+fields.path+'/'+fields.fileName,fileContent,(err)=>{
                            if(!err) {
                                r.data='uploaded';
                            }
                            else {
                                r.error=err;
                            }
                            res.writeHead(200, {'Content-Type': 'application/json'});
                            res.write(JSON.stringify(r));
                            return res.end();
                        });
                    });
                }
                else if(req.url.split('/')[2]==='new-folder') {
                    req.on('data', (chunk) => {
                        body+=chunk;
                    });
                    req.on('end', () => {
                        let payload=JSON.parse(body);
                        if(!fs.existsSync(filesDir+payload.path+'/'+payload.folderName)){
                            fs.mkdirSync(filesDir+payload.path+'/'+payload.folderName);
                            res.writeHead(200, {'Content-Type': 'application/json'});
                            r.data='created';
                            res.write(JSON.stringify(r));
                            return res.end();
                        }
                    });
                }
                else if(req.url.split('/')[2]==='rename') {
                    req.on('data', (chunk) => {
                        body+=chunk;
                    });
                    req.on('end', () => {
                        let payload=JSON.parse(body);
                        if(fs.existsSync(filesDir+payload.path+'/'+payload.file.name)) {
                            fs.rename(filesDir+payload.path+'/'+payload.file.name,filesDir+payload.path+'/'+payload.newName,(err)=>{
                                if(!err) {
                                    res.writeHead(200, {'Content-Type': 'application/json'});
                                    r.data='renamed';
                                    res.write(JSON.stringify(r));
                                    return res.end();
                                }
                                else {
                                    res.writeHead(200, {'Content-Type': 'application/json'});
                                    r.error='Error renaming object';
                                    res.write(JSON.stringify(r));
                                    return res.end();
                                }
                            });
                        }
                    });
                }
                else if(req.url.split('/')[2]==='delete') {
                    req.on('data', (chunk) => {
                        body+=chunk;
                    });
                    req.on('end', () => {
                        let payload=JSON.parse(body);
                        if(fs.existsSync(filesDir+payload.path+'/'+payload.file.name)){
                            if(payload.file.isDirectory) {
                                fs.rmdir(filesDir+payload.path+'/'+payload.file.name,(err)=>{
                                    if(!err) {
                                        res.writeHead(200, {'Content-Type': 'application/json'});
                                        r.data='deleted';
                                        res.write(JSON.stringify(r));
                                        return res.end();
                                    }
                                    else {
                                        res.writeHead(200, {'Content-Type': 'application/json'});
                                        r.error='Error deleting folder';
                                        res.write(JSON.stringify(r));
                                        return res.end();
                                    }
                                });
                            }
                            else {
                                fs.unlink(filesDir+payload.path+'/'+payload.file.name,(err)=>{
                                    if(!err) {
                                        res.writeHead(200, {'Content-Type': 'application/json'});
                                        r.data='deleted';
                                        res.write(JSON.stringify(r));
                                        return res.end();
                                    }
                                    else {
                                        res.writeHead(200, {'Content-Type': 'application/json'});
                                        r.error='Error deleting file';
                                        res.write(JSON.stringify(r));
                                        return res.end();
                                    }
                                });
                            }
                        }
                    });
                }
                else if(req.url.split('/')[2]==='plaintext') {
                    req.on('data',(chunk)=>{
                        body+=chunk;
                    });
                    req.on('end', () => {
                        let payload=JSON.parse(body);
                        if(fs.existsSync(filesDir+payload.path+'/'+payload.file.name)){
                            fs.readFile(filesDir+payload.path+'/'+payload.file.name,(err,content)=>{
                                let buff=new Buffer(content);
                                r.data=btoa(buff.toString());
                                res.writeHead(200,{'Content-Type':'application/json'});
                                res.write(JSON.stringify(r));
                                return res.end();
                            });
                        }
                    });
                }
                else if(req.url.split('/')[2]==='list-objects') {
                    req.on('data', (chunk) => {
                        body+=chunk;
                    });
                    req.on('end', () => {
                        let payload=JSON.parse(body);
                        let indexed=[];
                        function walk(dir) {
                            let items=fs.readdirSync(dir);
                            if(items && items.length>0) {
                                items.forEach((item)=>{
                                    let stats=fs.statSync(path.join(dir,item));
                                    if(stats.isDirectory()) walk(path.join(dir,item));
                                    else {
                                        let filePath=path.join(dir,item);
                                        if(payload.type.indexOf(path.extname(item).toLowerCase())>-1) indexed.push({name:item,mime:mime.getType(filePath),path:filePath});
                                    }
                                });
                            }
                        }
                        walk(filesDir);
                        res.writeHead(200, {'Content-Type': 'application/json'});
                        r.data=indexed;
                        res.write(JSON.stringify(r));
                        return res.end();
                    });
                }
                else if(req.url.split('/')[2]==='stream') {
                    let fileName=decodeURIComponent(s.get('fileName'))
                    let basePath=decodeURIComponent(s.get('path'));
                    let fullPath=decodeURIComponent(s.get('fullPath'));
                    let srcPath;
                    if(s.get('fullPath')) srcPath=fullPath;
                    else srcPath=filesDir+basePath+'/'+fileName;
                    let buffer=fs.readFileSync(srcPath);
                    let stats=fs.statSync(srcPath);
                    res.writeHead(200,{
                        'Content-Type':mime.getType(srcPath),
                        'Content-Length':stats.size,
                    });
                    res.write(buffer);
                    return res.end();
                }
                else if(req.url.split('/')[2]==='download') {
                    let fileName=decodeURIComponent(s.get('fileName'))
                    let basePath=decodeURIComponent(s.get('path'));
                    let fullPath=decodeURIComponent(s.get('fullPath'));
                    let srcPath;
                    if(s.get('fullPath')) srcPath=fullPath;
                    else srcPath=filesDir+basePath+'/'+fileName;
                    let stats=fs.statSync(srcPath);
                    if(stats.isDirectory()) {
                        zipper.zip(srcPath,(error,zipped)=>{
                            if(!error) {
                                zipped.compress();
                                zipped.save(tempDir+'/'+fileName+'.zip',(error)=>{
                                    if(!error) {
                                        let buffer=fs.readFileSync(tempDir+'/'+fileName+'.zip');
                                        res.writeHead(200,{
                                            'Content-Type':mime.getType(tempDir+'/'+fileName+'.zip'),
                                            "Content-Disposition":"attachment;filename="+fileName+'.zip',
                                            'Content-Length':buffer.length,
                                        });
                                        res.write(buffer);
                                        return res.end();
                                    }
                                });
                            }
                        });
                    }
                    else {
                        let buffer=fs.readFileSync(srcPath);
                        res.writeHead(200,{
                            'Content-Type':mime.getType(srcPath),
                            "Content-Disposition":"attachment;filename="+fileName,
                            'Content-Length':buffer.length,
                        });
                        res.write(buffer);
                        return res.end();
                    }
                }
            }
            //
            // chat endpoints
            else if(req.url.split('/')[1]==='chat') {
                if(req.url.split('/')[2]==='get') {
                    fs.readFile(chatDir+'/chats.json', (err, content) => {
                        if(!err) {
                            res.writeHead(200, {'Content-Type': 'application/json'});
                            r.data=JSON.parse(content);
                            res.write(JSON.stringify(r));
                            return res.end();
                        }
                        else {
                            res.writeHead(200, {'Content-Type': 'application/json'});
                            r.error='Chats not found. Create a new one.';
                            res.write(JSON.stringify(r));
                            return res.end();
                        }
                    });
                }
                else if(req.url.split('/')[2]==='create') {
                    let chats=JSON.parse(fs.readFileSync(chatDir+'/chats.json'));
                    let session={id:uuidv4(),name:'Untitled Chat',active:1};
                    chats.push(session);
                    fs.writeFileSync(chatDir+'/session_'+session.id+'.json','[]');
                    fs.writeFile(chatDir+'/chats.json',JSON.stringify(chats),(err) => {
                        if(!err) {
                            res.writeHead(200, {'Content-Type': 'application/json'});
                            r.data='created';
                            res.write(JSON.stringify(r));
                            return res.end();
                        }
                        else {
                            res.writeHead(200, {'Content-Type': 'application/json'});
                            r.error='Could not create chat session.';
                            res.write(JSON.stringify(r));
                            return res.end();
                        }
                    });
                }
                else if(req.url.split('/')[2]==='activate') {
                    req.on('data', (chunk) => {
                        body+=chunk;
                    });
                    req.on('end', () => {
                        let payload=JSON.parse(body);
                        let chats=JSON.parse(fs.readFileSync(chatDir+'/chats.json'));
                        for(let i=0;i<chats.length;i++) {
                            chats[i].active=0;
                        }
                        chats[chats.findIndex(x=>x.id===payload.id)].active=1;
                        fs.writeFile(chatDir+'/chats.json', JSON.stringify(chats),(err) => {
                            if(!err) r.data='activated';
                            else r.error='Could not activate chat session.';
                            res.writeHead(200, {'Content-Type': 'application/json'});
                            res.write(JSON.stringify(r));
                            return res.end();
                        });
                    });
                }
                else if(req.url.split('/')[2]==='history') {
                    req.on('data', (chunk) => {
                        body+=chunk;
                    });
                    req.on('end', () => {
                        let payload=JSON.parse(body);
                        fs.readFile(chatDir+'/session_'+payload.id+'.json', (err, content) => {
                            if(!err) {
                                res.writeHead(200, {'Content-Type': 'application/json'});
                                r.data=JSON.parse(content);
                                res.write(JSON.stringify(r));
                                return res.end();
                            }
                            else {
                                res.writeHead(200, {'Content-Type': 'application/json'});
                                r.error='Chat history not found.';
                                res.write(JSON.stringify(r));
                                return res.end();
                            }
                        });
                    });
                }
                else if(req.url.split('/')[2]==='save') {
                    req.on('data', (chunk) => {
                        body+=chunk;
                    });
                    req.on('end', () => {
                        let payload=JSON.parse(body);
                        fs.writeFile(chatDir+'/session_'+payload.id+'.json',JSON.stringify(payload.history), (err) => {
                            if(!err) {
                                res.writeHead(200, {'Content-Type': 'application/json'});
                                r.data='saved';
                                res.write(JSON.stringify(r));
                                return res.end();
                            }
                            else {
                                res.writeHead(200, {'Content-Type': 'application/json'});
                                r.error='Chat history could not be saved.';
                                res.write(JSON.stringify(r));
                                return res.end();
                            }
                        });
                    });
                }
                else if(req.url.split('/')[2]==='rename') {
                    req.on('data', (chunk) => {
                        body+=chunk;
                    });
                    req.on('end', () => {
                        let payload=JSON.parse(body);
                        let chats=JSON.parse(fs.readFileSync(chatDir+'/chats.json'));
                        chats[chats.findIndex(x=>x.id===payload.id)].name=payload.name;
                        fs.writeFile(chatDir+'/chats.json', JSON.stringify(chats),(err) => {
                            if(!err) {
                                res.writeHead(200, {'Content-Type': 'application/json'});
                                r.data='reamed';
                                res.write(JSON.stringify(r));
                                return res.end();
                            }
                            else {
                                res.writeHead(200, {'Content-Type': 'application/json'});
                                r.error='Could not rename chat session.';
                                res.write(JSON.stringify(r));
                                return res.end();
                            }
                        });
                    });
                }
                else if(req.url.split('/')[2]==='delete') {
                    req.on('data', (chunk) => {
                        body+=chunk;
                    });
                    req.on('end', () => {
                        let payload=JSON.parse(body);
                        let chats=JSON.parse(fs.readFileSync(chatDir+'/chats.json'));
                        chats.splice(chats.findIndex(x=>x.id===payload.id),1);
                        fs.writeFile(chatDir+'/chats.json', JSON.stringify(chats),(err) => {
                            if(!err) {
                                fs.unlinkSync(chatDir+'/session_'+payload.id+'.json');
                                r.data='deleted';
                            }
                            else {
                                r.error='Could not delete chat session.';
                            }
                            res.writeHead(200, {'Content-Type': 'application/json'});
                            res.write(JSON.stringify(r));
                            return res.end();
                        });
                    });
                }
            }
            else if(req.url.split('/')[1]==='personalities') {
                if(req.url.split('/')[2]==='get') {
                    fs.readFile(chatDir+'/personalities.json', (err, content) => {
                        if(!err) {
                            res.writeHead(200, {'Content-Type': 'application/json'});
                            r.data=JSON.parse(content);
                            res.write(JSON.stringify(r));
                            return res.end();
                        }
                        else {
                            res.writeHead(200, {'Content-Type': 'application/json'});
                            r.error='Could not access personalities.';
                            res.write(JSON.stringify(r));
                            return res.end();
                        }
                    });
                }
                else if(req.url.split('/')[2]==='create') {
                    req.on('data', (chunk) => {
                        body+=chunk;
                    });
                    req.on('end', () => {
                        let payload=JSON.parse(body);
                        let personalities=JSON.parse(fs.readFileSync(chatDir+'/personalities.json'));
                        personalities.push({id:uuidv4(),name:payload.name,active:1,system:payload.system});
                        let modelfile=`
                        FROM `+modelV+`
                        SYSTEM "`+payload.system+`"
                        `;
                        ollama.create({model:modelV,modelfile:modelfile});
                        fs.writeFile(chatDir+'/personalities.json', JSON.stringify(personalities),(err) => {
                            if(!err) {
                                res.writeHead(200, {'Content-Type': 'application/json'});
                                r.data='created';
                                res.write(JSON.stringify(r));
                                return res.end();
                            }
                            else {
                                res.writeHead(200, {'Content-Type': 'application/json'});
                                r.error='Could not create AI personality.';
                                res.write(JSON.stringify(r));
                                return res.end();
                            }
                        });
                    });
                }
                else if(req.url.split('/')[2]==='activate') {
                    req.on('data', (chunk) => {
                        body+=chunk;
                    });
                    req.on('end', () => {
                        let payload=JSON.parse(body);
                        let personalities=JSON.parse(fs.readFileSync(chatDir+'/personalities.json'));
                        for(let i=0;i<personalities.length;i++) {
                            personalities[i].active=0;
                        }
                        let pIndex=personalities.findIndex(x=>x.id===payload.id);
                        personalities[pIndex].active=1;
                        let modelfile=`
                        FROM `+modelV+`
                        SYSTEM "`+personalities[pIndex].system+`"
                        `;
                        ollama.create({model:modelV,modelfile:modelfile});
                        fs.writeFile(chatDir+'/personalities.json', JSON.stringify(personalities),(err) => {
                            if(!err) {
                                res.writeHead(200, {'Content-Type': 'application/json'});
                                r.data='activated';
                                res.write(JSON.stringify(r));
                                return res.end();
                            }
                            else {
                                res.writeHead(200, {'Content-Type': 'application/json'});
                                r.error='Could not activate AI personality.';
                                res.write(JSON.stringify(r));
                                return res.end();
                            }
                        });
                    });
                }
                else if(req.url.split('/')[2]==='update') {
                    req.on('data', (chunk) => {
                        body+=chunk;
                    });
                    req.on('end', () => {
                        let payload=JSON.parse(body);
                        let personalities=JSON.parse(fs.readFileSync(chatDir+'/personalities.json'));
                        if(payload.id==='default') {
                            res.writeHead(200, {'Content-Type': 'application/json'});
                            r.error='Default personality cannot be updated.';
                            res.write(JSON.stringify(r));
                            return res.end();
                        }
                        let pIndex=personalities.findIndex(x=>x.id===payload.id);
                        personalities[pIndex].name=payload.name;
                        personalities[pIndex].system=payload.system;
                        fs.writeFile(chatDir+'/personalities.json', JSON.stringify(personalities),(err) => {
                            if(!err) {
                                res.writeHead(200, {'Content-Type': 'application/json'});
                                r.data='created';
                                res.write(JSON.stringify(r));
                                return res.end();
                            }
                            else {
                                res.writeHead(200, {'Content-Type': 'application/json'});
                                r.error='Could not update AI personality.';
                                res.write(JSON.stringify(r));
                                return res.end();
                            }
                        });
                    });
                }
                else if(req.url.split('/')[2]==='delete') {
                    req.on('data', (chunk) => {
                        body+=chunk;
                    });
                    req.on('end', () => {
                        let payload=JSON.parse(body);
                        if(payload.id==='default') {
                            res.writeHead(200, {'Content-Type': 'application/json'});
                            r.error='Default personality cannot be deleted.';
                            res.write(JSON.stringify(r));
                            return res.end();
                        }
                        let personalities=JSON.parse(fs.readFileSync(chatDir+'/personalities.json'));
                        personalities.splice(personalities.findIndex(x=>x.id===payload.id),1);
                        fs.writeFile(chatDir+'/personalities.json', JSON.stringify(personalities),(err) => {
                            if(!err) {
                                res.writeHead(200, {'Content-Type': 'application/json'});
                                r.data='deleted';
                                res.write(JSON.stringify(r));
                                return res.end();
                            }
                            else {
                                res.writeHead(200, {'Content-Type': 'application/json'});
                                r.error='Could not delete AI personality.';
                                res.write(JSON.stringify(r));
                                return res.end();
                            }
                        });
                    });
                }
            }
            //
            // embeddings endpoint
            else if(req.url.split('/')[1]==='embeddings') {
                if(req.url.split('/')[2]==='create') {
                    req.on('data',(chunk)=>{
                        body+=chunk;
                    });
                    req.on('end',()=>{
                        let payload=JSON.parse(body);
                        let settings=JSON.parse(fs.readFileSync(embeddingsDir+'/embeddings.json'));
                        if((settings.findIndex(x=>x.name===payload.name)>-1 && settings[settings.findIndex(x=>x.name===payload.name)].md5!==crypto.createHash('md5').update(JSON.stringify(payload.content)).digest('hex')) || settings.findIndex(x=>x.name===payload.name)===-1){
                            async function embed() {
                                let vector={data:[],prompt:''};
                                for(let i=0;i<payload.content.length;i++) {
                                    let v=await ollama.embeddings({model:embedModel,prompt:payload.content[i]});
                                    vector.data.push({vector:v.embedding,document:payload.content[i]});
                                }
                                return vector;
                            }
                            embed().then(result =>{
                                fs.writeFileSync(embeddingsDir+'/'+payload.name+'.embedding',JSON.stringify(result));
                                if(settings.findIndex(x=>x.name===payload.name)>-1) {
                                    settings[settings.findIndex(x=>x.name===payload.name)].active=1;
                                    settings[settings.findIndex(x=>x.name===payload.name)].md5=crypto.createHash('md5').update(JSON.stringify(payload.content)).digest('hex');
                                }
                                else settings.push({name:payload.name,active:1,md5:crypto.createHash('md5').update(JSON.stringify(payload.content)).digest('hex')});
                                fs.writeFileSync(embeddingsDir+'/embeddings.json',JSON.stringify(settings));
                                res.writeHead(200,{'Content-Type': 'application/json'});
                                r.data='embedded';
                                res.write(JSON.stringify(r));
                                return res.end();
                            });
                        }
                        else {
                            res.writeHead(200,{'Content-Type': 'application/json'});
                            r.data='already embedded';
                            res.write(JSON.stringify(r));
                            return res.end();
                        }
                    });
                }
                else if(req.url.split('/')[2]==='rag') {
                    req.on('data',(chunk)=>{
                        body+=chunk;
                    });
                    req.on('end',()=>{
                        let payload=JSON.parse(body);
                        let settings=JSON.parse(fs.readFileSync(embeddingsDir+'/embeddings.json'));
                        let emPath=embeddingsDir+'/'+payload.name+'.embedding';
                        if(fs.existsSync(emPath)) {
                            let embeddedFile=JSON.parse(fs.readFileSync(emPath));
                            embeddedFile.prompt=payload.input;
                            for(let i=0;i<settings.length;i++) {
                                settings[i].active=0;
                            }
                            settings[settings.findIndex(x=>x.name===payload.name)].active=1;
                            fs.writeFileSync(embeddingsDir+'/embeddings.json',JSON.stringify(settings));
                            //
                            fs.writeFile(emPath,JSON.stringify(embeddedFile),(err)=>{
                                if(!err) {
                                    r.data='Saved';
                                }
                                else {
                                    r.error='Could not save prompt.';
                                }
                                res.writeHead(200, {'Content-Type': 'application/json'});
                                res.write(JSON.stringify(r));
                                return res.end();
                            });
                        }
                        else {
                            r.error='Embedding does not exist.';
                            res.writeHead(200, {'Content-Type': 'application/json'});
                            res.write(JSON.stringify(r));
                            return res.end();
                        }
                    });
                }
            }
            //
            // models
            else if(req.url.split('/')[1]==='models') {
                if(req.url.split('/')[2]==='ps') {
                    async function ps() {
                        return await ollama.ps();
                    }
                    ps().then(models=>{
                        res.writeHead(200, {'Content-Type': 'application/json'});
                        r.data=models.models;
                        res.write(JSON.stringify(r));
                        return res.end();
                    });
                }
                else if(req.url.split('/')[2]==='list') {
                    async function list() {
                        return await ollama.list();
                    }
                    list().then(models=>{
                        res.writeHead(200, {'Content-Type': 'application/json'});
                        r.data=models.models;
                        res.write(JSON.stringify(r));
                        return res.end();
                    });
                }
                else if(req.url.split('/')[2]==='stop') {
                    req.on('data',(chunk)=>{
                        body+=chunk;
                    });
                    req.on('end',()=>{
                        let payload=JSON.parse(body);
                        exec('ollama stop '+payload.name);
                        res.writeHead(200,{'Content-Type': 'application/json'});
                        r.data='stopped';
                        res.write(JSON.stringify(r));
                        return res.end();
                    });
                }
                else if(req.url.split('/')[2]==='create') {
                    req.on('data',(chunk)=>{
                        body+=chunk;
                    });
                    req.on('end',()=>{
                        let payload=JSON.parse(body);
                        let personalities=JSON.parse(fs.readFileSync(chatDir+'/personalities.json'));
                        let activePersonality=personalities[personalities.findIndex(x=>x.active===1)];
                        let modelfile=`
                            FROM `+payload.name+`
                            SYSTEM "`+activePersonality.system+`"
                            `;
                        async function create() {
                            await ollama.create({model:payload.name,modelfile:modelfile});
                            if(payload.details.family==='llama') await ollama.generate({model:payload.name,prompt:'.'});
                        }
                        create()
                            .then(()=>{
                            if(payload.details.family==='llama') {
                                let newEnvData=envData;
                                newEnvData.modelV=payload.name;
                                fs.writeFile('env.json',JSON.stringify(newEnvData),(err)=>{
                                    if(!err) r.data='started';
                                    else r.error='error starting';
                                    res.writeHead(200, {'Content-Type': 'application/json'});
                                    res.write(JSON.stringify(r));
                                    return res.end();
                                });
                            }
                            else {
                                r.data='started';
                                res.writeHead(200, {'Content-Type': 'application/json'});
                                res.write(JSON.stringify(r));
                                return res.end();
                            }
                        })
                            .catch((err)=>{
                                r.data=err;
                                res.writeHead(200, {'Content-Type': 'application/json'});
                                res.write(JSON.stringify(r));
                                return res.end();
                            });
                    });
                }
            }
            //
            // settings
            else if(req.url.split('/')[1]==='settings') {
                if(req.url.split('/')[2]==='update-passcode') {
                    req.on('data', (chunk) => {
                        body+=chunk;
                    });
                    req.on('end', () => {
                        let payload=JSON.parse(body);
                        let currentPasscode=payload.currentPasscode;
                        let newPasscode=payload.newPasscode;
                        let passcodeFile=JSON.parse(fs.readFileSync(baseDir+'/p.json'));
                        let hashedPasscode=passcodeFile['p'];
                        bcrypt.compare(currentPasscode,hashedPasscode,(err,result)=>{
                            if(result) {
                                bcrypt.hash(newPasscode,saltRounds,(err,hash)=>{
                                    passcodeFile.p=hash;
                                    fs.writeFile(baseDir+'/p.json',JSON.stringify(passcodeFile),(err)=>{
                                        if(!err) {
                                            r.data='updated';
                                        }
                                        else {
                                            r.error='Could not update passcode.';
                                        }
                                        res.writeHead(200,{'Content-Type': 'application/json'});
                                        res.write(JSON.stringify(r));
                                        return res.end();
                                    });
                                });
                            }
                            else {
                                res.writeHead(200, {'Content-Type': 'application/json'});
                                r.error='Current passcode is wrong.';
                                res.write(JSON.stringify(r));
                                return res.end();
                            }
                        });
                    });
                }
                else if(req.url.split('/')[2]==='upload-firmware') {
                    let form=formidable();
                    form.parse(req, (err,fields,files)=>{
                        bcrypt.compare(fields.passcode[0],JSON.parse(fs.readFileSync(baseDir+'/p.json'))['p'],(err,result)=>{
                            if(result) {
                                let fileContent=fs.readFileSync(files.file[0].filepath);
                                fs.writeFile(firmwareDir+'/persys-pkg.zip',fileContent,(err)=>{
                                    if(!err) {
                                        exec('sh update.sh',(err,stdout,stderr)=>{
                                            if(!stderr) r.data=stdout;
                                            else r.error=stderr;
                                            res.writeHead(200, {'Content-Type': 'application/json'});
                                            res.write(JSON.stringify(r));
                                            return res.end();
                                        });
                                    }
                                    else {
                                        r.error=err;
                                        res.writeHead(200, {'Content-Type': 'application/json'});
                                        res.write(JSON.stringify(r));
                                        return res.end();
                                    }
                                });
                            }
                            else {
                                r.error='Passcode is incorrect';
                                res.writeHead(200, {'Content-Type': 'application/json'});
                                res.write(JSON.stringify(r));
                                return res.end();
                            }
                        });
                    });
                }
                else if(req.url.split('/')[2]==='restart-services') {
                    exec('sh restart.sh',(err,stdout,stderr)=>{
                        r.data='restarted';
                        res.writeHead(200,{'Content-Type':'application/json'});
                        res.write(JSON.stringify(r));
                        return res.end();
                    });
                }
            }
            else if(req.url.split('/')[1]==='wallpapers') {
                if(req.url.split('/')[2]==='current') {
                    let settings=JSON.parse(fs.readFileSync(settingsDir+'/settings.json'));
                    let activeWallpaper=settings.wallpapers[settings.wallpapers.findIndex(x=>x.active===1)].name;
                    let buffer=fs.readFileSync(settingsDir+'/wallpapers/'+activeWallpaper);
                    res.writeHead(200, {
                        'Content-Type':mime.getType(settingsDir+'/'+activeWallpaper),
                        "Content-Disposition": "attachment;filename="+activeWallpaper,
                        'Content-Length': buffer.length,
                    });
                    res.write(buffer);
                    return res.end();
                }
                else if(req.url.split('/')[2]==='get') {
                    let fileName=decodeURIComponent(s.get('fileName'))
                    let buffer=fs.readFileSync(settingsDir+'/wallpapers/'+fileName);
                    res.writeHead(200, {
                        'Content-Type':mime.getType(settingsDir+'/wallpapers/'+fileName),
                        "Content-Disposition": "attachment;filename="+settingsDir+'/wallpapers/'+fileName,
                        'Content-Length': buffer.length,
                    });
                    res.write(buffer);
                    return res.end();
                }
                else if(req.url.split('/')[2]==='list') {
                    let settings=JSON.parse(fs.readFileSync(settingsDir+'/settings.json'));
                    r.data=settings.wallpapers;
                    res.writeHead(200, {'Content-Type': 'application/json'});
                    res.write(JSON.stringify(r));
                    return res.end();
                }
                else if(req.url.split('/')[2]==='upload') {
                    let settings=JSON.parse(fs.readFileSync(settingsDir+'/settings.json'));
                    //
                    let form=formidable();
                    form.parse(req, (err,fields,files)=>{
                        let fileContent=fs.readFileSync(files.file[0].filepath);
                        fs.writeFile(settingsDir+'/wallpapers/'+fields.fileName[0],fileContent,(err)=>{
                            if(!err) {
                                for(let i=0;i<settings.wallpapers.length;i++) {
                                    settings.wallpapers[i].active=0;
                                }
                                settings.wallpapers.push({name:fields.fileName[0],active:1,default:0});
                                fs.writeFileSync(settingsDir+'/settings.json',JSON.stringify(settings));
                                r.data='uploaded';
                            }
                            else {
                                r.error=err;
                            }
                            res.writeHead(200, {'Content-Type': 'application/json'});
                            res.write(JSON.stringify(r));
                            return res.end();
                        });
                    });
                }
                else if(req.url.split('/')[2]==='activate') {
                    req.on('data', (chunk) => {
                        body+=chunk;
                    });
                    req.on('end', () => {
                        let payload=JSON.parse(body);
                        let settings=JSON.parse(fs.readFileSync(settingsDir+'/settings.json'));
                        for(let i=0;i<settings.wallpapers.length;i++) {
                            settings.wallpapers[i].active=0;
                        }
                        settings.wallpapers[settings.wallpapers.findIndex(x=>x.name===payload.name)].active=1;
                        fs.writeFile(settingsDir+'/settings.json', JSON.stringify(settings),(err) => {
                            if(!err) {
                                r.data='activated';
                            }
                            else {
                                r.error='Could not activate wallpaper.';
                            }
                            res.writeHead(200, {'Content-Type': 'application/json'});
                            res.write(JSON.stringify(r));
                            return res.end();
                        });
                    });
                }
                else if(req.url.split('/')[2]==='delete') {
                    req.on('data', (chunk) => {
                        body+=chunk;
                    });
                    req.on('end', () => {
                        let payload=JSON.parse(body);
                        let settings=JSON.parse(fs.readFileSync(settingsDir+'/settings.json'));
                        let delIndex=settings.wallpapers.findIndex(x=>x.name===payload.name);
                        // do not delete default wallpaper
                        if(settings.wallpapers[delIndex].default===1) {
                            r.error='Could not delete default wallpaper.';
                            res.writeHead(200, {'Content-Type': 'application/json'});
                            res.write(JSON.stringify(r));
                            return res.end();
                        }
                        // if wallpaper being deleted is currently active, make default active
                        if(settings.wallpapers[delIndex].active===1) {
                            settings.wallpapers[settings.wallpapers.findIndex(x=>x.default===1)].active=1;
                        }
                        settings.wallpapers.splice(delIndex,1);
                        fs.writeFile(settingsDir+'/settings.json',JSON.stringify(settings),(err) => {
                            if(!err) {
                                fs.unlinkSync(settingsDir+'/wallpapers/'+payload.name);
                                r.data='deleted';
                            }
                            else {
                                r.error='Could not delete wallpaper.';
                            }
                            res.writeHead(200, {'Content-Type': 'application/json'});
                            res.write(JSON.stringify(r));
                            return res.end();
                        });
                    });
                }
            }
            else if(req.url.split('/')[1]==='stl-render') {
                let srcPath='device.stl';
                let buffer=fs.readFileSync(srcPath);
                res.writeHead(200, {
                    'Content-Type':mime.getType(srcPath),
                    "Content-Disposition": "attachment;filename=device.stl",
                    'Content-Length':buffer.length,
                });
                res.write(buffer);
                return res.end();
            }
            //
            // apps
            else if(req.url.split('/')[1]==='todo') {
                if(req.url.split('/')[2]==='get') {
                    req.on('data', (chunk) => {
                        body+=chunk;
                    });
                    req.on('end', () => {
                        fs.readFile(appsDir+'/todo.json', (err, content) => {
                            if(!err) {
                                res.writeHead(200, {'Content-Type': 'application/json'});
                                r.data=JSON.parse(content);
                                res.write(JSON.stringify(r));
                                return res.end();
                            }
                            else {
                                res.writeHead(200, {'Content-Type': 'application/json'});
                                r.error='To-do not found. Create a new one.';
                                res.write(JSON.stringify(r));
                                return res.end();
                            }
                        });
                    });
                }
                else if(req.url.split('/')[2]==='create') {
                    req.on('data', (chunk) => {
                        body+=chunk;
                    });
                    req.on('end', () => {
                        let payload=JSON.parse(body);
                        let todoList=JSON.parse(fs.readFileSync(appsDir+'/todo.json'));
                        todoList.push({id:uuidv4(),checked:false,text:payload.text,date:payload.date});
                        fs.writeFile(appsDir+'/todo.json',JSON.stringify(todoList),(err) => {
                            if(!err) {
                                res.writeHead(200, {'Content-Type': 'application/json'});
                                r.data='created';
                                res.write(JSON.stringify(r));
                                return res.end();
                            }
                            else {
                                res.writeHead(200, {'Content-Type': 'application/json'});
                                r.error='Could not create to-do item.';
                                res.write(JSON.stringify(r));
                                return res.end();
                            }
                        });
                    });
                }
                else if(req.url.split('/')[2]==='update') {
                    req.on('data', (chunk) => {
                        body+=chunk;
                    });
                    req.on('end', () => {
                        let payload=JSON.parse(body);
                        let todoList=JSON.parse(fs.readFileSync(appsDir+'/todo.json'));
                        let tIndex=todoList.findIndex(x=>x.id===payload.id);
                        todoList[tIndex].checked=payload.checked;
                        todoList[tIndex].text=payload.text;
                        if(todoList) {
                            fs.writeFile(appsDir+'/todo.json', JSON.stringify(todoList),(err) => {
                                if(!err) {
                                    res.writeHead(200, {'Content-Type': 'application/json'});
                                    r.data='created';
                                    res.write(JSON.stringify(r));
                                    return res.end();
                                }
                                else {
                                    res.writeHead(200, {'Content-Type': 'application/json'});
                                    r.error='Could not update to-do item.';
                                    res.write(JSON.stringify(r));
                                    return res.end();
                                }
                            });
                        }
                    });
                }
                else if(req.url.split('/')[2]==='delete') {
                    req.on('data', (chunk) => {
                        body+=chunk;
                    });
                    req.on('end', () => {
                        let payload=JSON.parse(body);
                        let todoList=JSON.parse(fs.readFileSync(appsDir+'/todo.json'));
                        todoList.splice(todoList.findIndex(x=>x.id===payload.id),1);
                        fs.writeFile(appsDir+'/todo.json', JSON.stringify(todoList),(err) => {
                            if(!err) {
                                res.writeHead(200, {'Content-Type': 'application/json'});
                                r.data='deleted';
                                res.write(JSON.stringify(r));
                                return res.end();
                            }
                            else {
                                res.writeHead(200, {'Content-Type': 'application/json'});
                                r.error='Could not delete to-do list.';
                                res.write(JSON.stringify(r));
                                return res.end();
                            }
                        });
                    });
                }
            }
            else if(req.url.split('/')[1]==='cardclip') {
                if(req.url.split('/')[2]==='get') {
                    req.on('data', (chunk) => {
                        body+=chunk;
                    });
                    req.on('end', () => {
                        fs.readFile(appsDir+'/cardclip.json', (err, content) => {
                            if(!err) {
                                res.writeHead(200, {'Content-Type': 'application/json'});
                                r.data=JSON.parse(content);
                                res.write(JSON.stringify(r));
                                return res.end();
                            }
                            else {
                                res.writeHead(200, {'Content-Type': 'application/json'});
                                r.error='Cardclip not found. Create a new one.';
                                res.write(JSON.stringify(r));
                                return res.end();
                            }
                        });
                    });
                }
                else if(req.url.split('/')[2]==='create') {
                    req.on('data', (chunk) => {
                        body+=chunk;
                    });
                    req.on('end', () => {
                        let payload=JSON.parse(body);
                        payload.id=uuidv4();
                        let cardclip=JSON.parse(fs.readFileSync(appsDir+'/cardclip.json'));
                        cardclip.push(payload);
                        fs.writeFile(appsDir+'/cardclip.json',JSON.stringify(cardclip),(err) => {
                            if(!err) {
                                res.writeHead(200, {'Content-Type': 'application/json'});
                                r.data=payload;
                                res.write(JSON.stringify(r));
                                return res.end();
                            }
                            else {
                                res.writeHead(200, {'Content-Type': 'application/json'});
                                r.error='Could not create card.';
                                res.write(JSON.stringify(r));
                                return res.end();
                            }
                        });
                    });
                }
                else if(req.url.split('/')[2]==='update') {
                    req.on('data', (chunk) => {
                        body+=chunk;
                    });
                    req.on('end', () => {
                        let payload=JSON.parse(body);
                        let cardclip=JSON.parse(fs.readFileSync(appsDir+'/cardclip.json'));
                        let cIndex=cardclip.findIndex(x=>x.id===payload.id);
                        cardclip[cIndex]=payload;
                        if(cardclip) {
                            fs.writeFile(appsDir+'/cardclip.json',JSON.stringify(cardclip),(err) => {
                                if(!err) {
                                    res.writeHead(200, {'Content-Type': 'application/json'});
                                    r.data='updated';
                                    res.write(JSON.stringify(r));
                                    return res.end();
                                }
                                else {
                                    res.writeHead(200, {'Content-Type': 'application/json'});
                                    r.error='Could not update card.';
                                    res.write(JSON.stringify(r));
                                    return res.end();
                                }
                            });
                        }
                    });
                }
                else if(req.url.split('/')[2]==='delete') {
                    req.on('data', (chunk) => {
                        body+=chunk;
                    });
                    req.on('end', () => {
                        let payload=JSON.parse(body);
                        let cardclip=JSON.parse(fs.readFileSync(appsDir+'/cardclip.json'));
                        cardclip.splice(cardclip.findIndex(x=>x.id===payload.id),1);
                        fs.writeFile(appsDir+'/cardclip.json',JSON.stringify(cardclip),(err) => {
                            if(!err) {
                                res.writeHead(200, {'Content-Type': 'application/json'});
                                r.data='deleted';
                                res.write(JSON.stringify(r));
                                return res.end();
                            }
                            else {
                                res.writeHead(200, {'Content-Type': 'application/json'});
                                r.error='Could not delete card.';
                                res.write(JSON.stringify(r));
                                return res.end();
                            }
                        });
                    });
                }
                else if(req.url.split('/')[2]==='upload-thumb') {
                    let form=formidable();
                    form.parse(req,(err,fields,files)=>{
                        //
                        let cardclip=JSON.parse(fs.readFileSync(appsDir+'/cardclip.json'));
                        let idd=fields.id[0];
                        let cIndex=cardclip.findIndex(x=>x.id===idd);
                        let permPath='card_thumb_'+fields.id+path.extname(fields.fileName[0]);
                        cardclip[cIndex].thumb=permPath;
                        fs.writeFileSync(appsDir+'/cardclip.json',JSON.stringify(cardclip));
                        //
                        fs.writeFile(appsDir+'/cardclip/'+permPath,fs.readFileSync(files.file[0].filepath),(err)=>{
                            if(!err) {
                                res.writeHead(200, {'Content-Type': 'application/json'});
                                r.data=cardclip[cIndex];
                                res.write(JSON.stringify(r));
                                return res.end();
                            }
                            else {
                                res.writeHead(200, {'Content-Type': 'application/json'});
                                r.error=err;
                                res.write(JSON.stringify(r));
                                return res.end();
                            }
                        });
                    });
                }
                else if(req.url.split('/')[2]==='get-thumb') {
                    let cardclip=JSON.parse(fs.readFileSync(appsDir+'/cardclip.json'));
                    let cardId=decodeURIComponent(s.get('cardId'))
                    let srcPath=appsDir+'/cardclip/'+cardclip[cardclip.findIndex(x=>x.id===cardId)].thumb;
                    let buffer=fs.readFileSync(srcPath);
                    res.writeHead(200,{
                        'Content-Type':mime.getType(srcPath),
                        'Content-Length':buffer.length,
                    });
                    res.write(buffer);
                    return res.end();
                }
            }
            else if(req.url.split('/')[1]==='paper') {
                if(req.url.split('/')[2]==='get') {
                    req.on('data',(chunk)=>{
                        body+=chunk;
                    });
                    req.on('end',()=>{
                        let payload=JSON.parse(body);
                        if(fs.existsSync(filesDir+'/'+payload.name)) {
                            fs.readFile(filesDir+'/'+payload.name,(err,content)=>{
                                if(!err) {
                                    r.data=JSON.parse(content);
                                }
                                else {
                                    r.error='Could not retrieve Paper.';
                                }
                                res.writeHead(200,{'Content-Type':'application/json'});
                                res.write(JSON.stringify(r));
                                return res.end();
                            });
                        }
                    });
                }
                else if(req.url.split('/')[2]==='create') {
                    req.on('data',(chunk)=>{
                        body+=chunk;
                    });
                    req.on('end',()=>{
                        let payload=JSON.parse(body);
                        fs.writeFile(filesDir+'/'+payload.name+'.paper',JSON.stringify(payload.content),(err)=>{
                            if(!err) {
                                r.data='created';
                            }
                            else {
                                r.error='Could not create Paper.';
                            }
                            res.writeHead(200,{'Content-Type':'application/json'});
                            res.write(JSON.stringify(r));
                            return res.end();
                        });
                    });
                }
                else if(req.url.split('/')[2]==='update') {
                    req.on('data',(chunk)=>{
                        body+=chunk;
                    });
                    req.on('end',()=>{
                        let payload=JSON.parse(body);
                        if(JSON.stringify(payload.content)) {
                            fs.writeFile(filesDir+'/'+payload.name,JSON.stringify(payload.content),(err)=>{
                            if(!err) {
                                r.data='updated';
                            }
                            else {
                                r.error='Could not update Paper.';
                            }
                            res.writeHead(200,{'Content-Type':'application/json'});
                            res.write(JSON.stringify(r));
                            return res.end();
                        });
                        }
                    });
                }
                else if(req.url.split('/')[2]==='delete') {
                    req.on('data', (chunk) => {
                        body+=chunk;
                    });
                    req.on('end', () => {
                        let payload=JSON.parse(body);
                        if(fs.existsSync(filesDir+'/'+payload.name)) {
                            fs.unlink(filesDir+'/'+payload.name,(err)=>{
                                if(!err) {
                                    r.data='deleted';
                                }
                                else {
                                    r.error='Error deleting file';
                                }
                                res.writeHead(200, {'Content-Type': 'application/json'});
                                res.write(JSON.stringify(r));
                                return res.end();
                            });
                        }
                    });
                }
                else if(req.url.split('/')[2]==='upload-asset') {
                    let form=formidable();
                    form.parse(req, (err,fields,files)=>{
                        let fileContent=fs.readFileSync(files.file[0].filepath);
                        let permPath=uuidv4()+path.extname(fields.fileName[0]);
                        let fileMime=mime.getType(files.file[0].filepath)
                        fs.writeFile(appsDir+'/paper/'+permPath,fileContent,(err)=>{
                            if(!err) {
                                r.data={fileName:permPath,fileMime:fileMime};
                            }
                            else {
                                r.error=err;
                            }
                            res.writeHead(200, {'Content-Type': 'application/json'});
                            res.write(JSON.stringify(r));
                            return res.end();
                        });
                    });
                }
                else if(req.url.split('/')[2]==='get-asset') {
                    let fileName=decodeURIComponent(s.get('fileName'))
                    let srcPath=appsDir+'/paper/'+fileName;
                    let buffer=fs.readFileSync(srcPath);
                    res.writeHead(200,{
                        'Content-Type':mime.getType(srcPath),
                        //"Content-Disposition":"attachment;filename="+fileName,
                        'Content-Length':buffer.length,
                    });
                    res.write(buffer);
                    return res.end();
                }
                else if(req.url.split('/')[2]==='delete-asset') {
                    req.on('data',(chunk)=>{
                        body+=chunk;
                    });
                    req.on('end',()=>{
                        let payload=JSON.parse(body);
                        if(fs.existsSync(appsDir+'/paper/'+payload.fileName)) {
                            fs.unlink(appsDir+'/paper/'+payload.fileName,(err)=>{
                                if(!err) {
                                    r.data='deleted';
                                }
                                else {
                                    r.error='Error deleting paper asset.';
                                }
                                res.writeHead(200,{'Content-Type':'application/json'});
                                res.write(JSON.stringify(r));
                                return res.end();
                            });
                        }
                    });
                }
            }
            else if(req.url.split('/')[1]==='library') {
                if(req.url.split('/')[2]==='extract') {
                    req.on('data',(chunk)=>{
                        body+=chunk;
                    });
                    req.on('end',()=>{
                        let payload=JSON.parse(body);
                        if(fs.existsSync(tempDir+'/'+payload.name+'.'+payload.page+'.txt')) {
                            fs.readFile(tempDir+'/'+payload.name+'.'+payload.page+'.txt',(err,content)=>{
                                if(!err) r.data=new Buffer(content).toString();
                                else r.err=err;
                                res.writeHead(200,{'Content-Type':'application/json'});
                                res.write(JSON.stringify(r));
                                return res.end();
                            });
                        }
                        else if(fs.existsSync(tempDir+'/'+payload.name+'.'+payload.page+'.png')) {
                            tesseract.recognize(tempDir+'/'+payload.name+'.'+payload.page+'.png',{lang:"eng",oem:1,psm:3,})
                                .then((text)=>{
                                    fs.writeFile(tempDir+'/'+payload.name+'.'+payload.page+'.txt',text,(err)=>{
                                        r.data=text;
                                        res.writeHead(200,{'Content-Type':'application/json'});
                                        res.write(JSON.stringify(r));
                                        return res.end();
                                    });
                                })
                                .catch((error) => {
                                    r.error=error;
                                    res.writeHead(200,{'Content-Type':'application/json'});
                                    res.write(JSON.stringify(r));
                                    return res.end();
                                });
                        }
                        else {
                            let convert=fromPath(payload.path, {density:100, saveFilename:payload.name, savePath:tempDir, format:"png", width:1000, preserveAspectRatio:true});
                            convert(payload.page,{responseType:"image"})
                                .then((resolve) => {
                                    tesseract.recognize(tempDir+'/'+resolve.name, {lang: "eng", oem: 1, psm: 3,})
                                        .then((text) => {
                                            fs.writeFile(tempDir+'/'+payload.name+'.'+payload.page+'.txt',text,(err)=>{
                                                r.data=text;
                                                res.writeHead(200,{'Content-Type':'application/json'});
                                                res.write(JSON.stringify(r));
                                                return res.end();
                                            });
                                        })
                                        .catch((error) => {
                                            r.error=error;
                                            res.writeHead(200,{'Content-Type':'application/json'});
                                            res.write(JSON.stringify(r));
                                            return res.end();
                                        });
                                })
                                .catch((err)=>{
                                    r.error=err;
                                    res.writeHead(200,{'Content-Type':'application/json'});
                                    res.write(JSON.stringify(r));
                                    return res.end();
                                });
                        }
                    });
                }
                else if(req.url.split('/')[2]==='pages') {
                    req.on('data',(chunk)=>{
                        body+=chunk;
                    });
                    req.on('end',()=>{
                        let payload=JSON.parse(body);
                        let dataBuffer=fs.readFileSync(payload.path);
                        pdf(dataBuffer)
                            .then((data)=>{
                                r.data=data.numpages;
                                res.writeHead(200,{'Content-Type':'application/json'});
                                res.write(JSON.stringify(r));
                                return res.end();
                            })
                            .catch((err)=>{
                                r.data=err;
                                res.writeHead(200,{'Content-Type':'application/json'});
                                res.write(JSON.stringify(r));
                                return res.end();
                        });
                    });
                }
            }
            //
        }
        else {
            res.writeHead(200, {'Content-Type': 'application/json'});
            r.error='You need to log in.';
            res.write(JSON.stringify(r));
            return res.end();
        }
    }
});

const port=3000;
server.listen(port);
server.requestTimeout=1010000;
server.headersTimeout=1010000;
server.keepAliveTimeout=1000000;
server.timeout=1000000;
console.log('PERSYS is running');