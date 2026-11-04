import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const base=path.resolve('dist');
http.createServer(async(req,res)=>{try{let p=path.resolve(base,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(p!==base&&!p.startsWith(base+path.sep)){res.writeHead(403).end();return}if(!path.extname(p))p=path.join(p,'index.html');const b=await readFile(p);res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'})[path.extname(p)]||'application/octet-stream');res.end(b)}catch{res.writeHead(404).end('Not found')}}).listen(4190,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4190'));
