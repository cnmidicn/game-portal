import {cp,access,mkdir,readFile,writeFile,rm,lstat} from 'node:fs/promises';
import path from 'node:path';import {fileURLToPath} from 'node:url';
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),workspace=path.dirname(project),play=path.join(project,'dist','play');
const projects=[['devour','game-devour'],['echo','game-echo'],['wave','game-wave']];
for(const [id,name]of projects){
 const source=path.resolve(workspace,name,'dist'),target=path.resolve(play,id);
 if(path.dirname(target)!==play||path.dirname(path.dirname(source))!==workspace)throw Error('Unexpected game snapshot path');
 await access(path.join(source,'index.html'));
 const existing=await lstat(target).catch(error=>{if(error.code!=='ENOENT')throw error;return null});
 if(existing?.isSymbolicLink())throw Error('Game snapshot destination must not be a symbolic link');
 // Only replace the validated generated snapshot; independent source projects stay intact.
 await rm(target,{recursive:true,force:true});
 await mkdir(target,{recursive:true});await cp(source,target,{recursive:true,force:true});
 const entry=path.join(target,'index.html');let html=await readFile(entry,'utf8');
 html=html.replaceAll('WORLD 002',id==='wave'?'WORLD 003':'WORLD 002');
 html=html.replaceAll('href="https://midi.cn/"','href="../../"');
 if(!html.includes('返回靡靡之音'))html=html.replace('</body>','<a href="../../" aria-label="返回靡靡之音" style="position:fixed;left:16px;bottom:16px;z-index:9999;padding:9px 13px;border:1px solid #ffffff30;border-radius:20px;background:#080d22b8;color:#dfe7ff;text-decoration:none;font:10px system-ui;backdrop-filter:blur(8px)">← 靡靡之音</a></body>');
 else html=html.replace('href="../" aria-label="返回靡靡之音"','href="../../" aria-label="返回靡靡之音"');
 html=html.replaceAll('href="../../"','href="../../#'+id+'"');
 await writeFile(entry,html);console.log('Synced '+name+' → dist/play/'+id)
}
const assets=path.join(project,'dist','assets');await mkdir(assets,{recursive:true});
for(const [from,to]of [['game-devour/qa/tide-desktop.jpg','devour.jpg'],['game-echo/artifacts/echo-v4-play.png','echo.png'],['game-wave/previews/drift-aurora-v2.jpg','wave.jpg']])await cp(path.join(workspace,from),path.join(assets,to));
console.log('Game screenshots synced.');
