import {Game,BEAT,BPM} from './game.js';
import {Sound} from './audio.js';
import {Stage} from './scene.js';
const $=s=>document.querySelector(s),game=new Game(),sound=new Sound(game);
game.musicClock=()=>sound.position();
let stage,last=performance.now(),lastStatus='',best=0,feedbackTimer,starting=false,keys=new Set();
try{best=Number(localStorage.getItem('midi-pulse-best'))||0;}catch{}
$('#best').textContent=String(best).padStart(6,'0');
function feedback(text){$('#feedback').textContent=text;$('#feedback').classList.add('show');clearTimeout(feedbackTimer);feedbackTimer=setTimeout(()=>$('#feedback').classList.remove('show'),1400);}
function save(){if(game.score>best){best=game.score;try{localStorage.setItem('midi-pulse-best',String(best));}catch{}$('#best').textContent=String(best).padStart(6,'0');}}
function audioStart(){sound.start().then(()=>{$('#music-status').textContent='正在播放 · ORIGINAL SYNTHWAVE / 128 BPM';}).catch(()=>{feedback('音乐加载失败，请点声音按钮重试');$('#music-status').textContent='音乐未载入 · 点击声音按钮重试';});}
async function begin(){
  if(starting||!stage)return;starting=true;
  for(const d of document.querySelectorAll('dialog[open]'))d.close();
  $('#start').disabled=true;$('#start').innerHTML='正在开启声场 <span>♫</span>';
  try{await sound.init();}catch{feedback('音乐加载失败，请检查后重试');$('#start').disabled=false;$('#start').innerHTML='重新开启声场 <span>↗</span>';starting=false;return;}
  save();game.start();game.launch();game.previewAudio=false;document.body.classList.add('playing');$('#intro').inert=true;
  await sound.start();$('#music-status').textContent='正在播放 · ORIGINAL SYNTHWAVE / 128 BPM';$('#start').disabled=false;$('#start').innerHTML='进入律动 <span>↗</span>';
  if(document.hidden)pause();starting=false;
}
function pause(){game.pause();keys.clear();if(game.status==='paused'){sound.stop();if(!$('#pause-dialog').open)$('#pause-dialog').showModal();}}
function resume(){game.resume();$('#pause-dialog').close();audioStart();}
function sync(){
  const status=game.status;
  $('#score').textContent=String(game.score).padStart(6,'0');$('#round').textContent=`乐章 ${String(game.level).padStart(2,'0')}`;
  $('#lives').textContent=Array.from({length:game.lives},()=>'◇').join(' ');$('#lives').setAttribute('aria-label',`剩余 ${game.lives} 次生命`);
  $('#launch-hint').hidden=status!=='ready';$('#pause').disabled=!['playing','ready','paused'].includes(status);
  $('#rhythm-deck').hidden=status==='menu';$('#phrase-panel').hidden=status==='menu';
  const beatTime=game.beatTime(),phase=(beatTime%BEAT)/BEAT;
  $('#beat-count').textContent=Math.floor(beatTime/BEAT)%4+1;
  $('#pulse').style.setProperty('--phase',String(phase));
  $('#pulse').classList.toggle('on-beat',phase<.16||phase>.84);
  document.querySelectorAll('.beat-lamps i').forEach((e,i)=>e.classList.toggle('active',i===Math.floor(beatTime/BEAT)%4));
  document.querySelectorAll('.beat-road>i').forEach((e,i)=>{const relative=i-4-phase;e.style.transform=`translateX(${relative*42}px) rotate(45deg)`;e.style.opacity=String(Math.max(0,1-Math.abs(relative)/4));});
  $('#drive').disabled=game.charge<100||game.driveLeft>0||status!=='playing';
  $('#drive').classList.toggle('charged',game.charge>=100);$('#charge-bar').style.transform=`scaleX(${game.charge/100})`;
  $('#charge-label').textContent=game.driveLeft>0?`超载 ${game.driveLeft.toFixed(1)}s`:game.charge>=100?'按 E / 点击释放':`${Math.floor(game.charge)}% · 蓄能中`;
  document.body.classList.toggle('overdriving',game.driveLeft>0);
  $('#phrase-title').textContent=game.bricks.find(b=>b.boss&&b.hp>0)?`星核 ${game.bricks.find(b=>b.boss).hp} HP · ${Math.floor(beatTime/BEAT)%8>=4?'护盾开放！':'等待四拍窗口'}`:game.phrase.title;
  $('#phrase-progress').style.transform=`scaleX(${game.phrase.progress/game.phrase.target})`;$('#phrase-count').textContent=`${game.phrase.progress} / ${game.phrase.target} · 防坠护盾 ${game.shields}`;
  const combo=$('#combo');combo.style.display=game.combo>=2&&status!=='menu'?'block':'none';combo.querySelector('strong').textContent=game.combo;combo.querySelector('i').style.transform=`scaleX(${Math.max(0,game.comboLeft/5)})`;
  if(status!==lastStatus){
    if(status==='upgrade'){
      save();$('#choices').replaceChildren(...game.choices.map(c=>{
        const button=document.createElement('button');button.innerHTML=`<span aria-hidden="true">${c.icon}</span><b>${c.name}</b><small>${c.desc}</small>`;
        button.addEventListener('click',()=>{if(game.choose(c.id)){$('#upgrade').close();audioStart();feedback(`乐章 ${game.level} · ${c.name}`);}});return button;
      }));$('#upgrade').showModal();
      // Let the completion chord ring out, then hold the musical transport.
      setTimeout(()=>{if(game.status==='upgrade')sound.stop();},1100);
    }
    if(status==='over'){
      const isRecord=game.score>best;save();$('#final-score').textContent=game.score.toLocaleString();$('#final-combo').textContent=game.bestCombo;$('#final-level').textContent=game.level;
      $('#record-message').textContent=isRecord?'新的个人纪录。星云记住了你的回响。':'再一次出发，奏出不同的宇宙。';$('#over').showModal();
      setTimeout(()=>{if(game.status==='over')sound.stop();},900);
    }
    lastStatus=status;
  }
}
$('#start').addEventListener('click',begin);$('#restart').addEventListener('click',begin);$('#restart-pause').addEventListener('click',begin);
$('#resume').addEventListener('click',resume);$('#launch').addEventListener('click',()=>{if(game.launch())audioStart();});
$('#pulse').addEventListener('click',()=>{if(game.status==='ready'){game.launch();return;}game.tap();});$('#drive').addEventListener('click',()=>game.overdrive());
$('#audition').addEventListener('click',async()=>{if(game.previewAudio){sound.stop();game.previewAudio=false;$('#audition').textContent='♫ 先听音乐';return;}$('#audition').textContent='正在载入音乐…';try{await sound.start();game.previewAudio=true;$('#audition').textContent='Ⅱ 暂停试听';$('#music-status').textContent='正在试听 · ORIGINAL SYNTHWAVE / 128 BPM';}catch{$('#audition').textContent='♫ 点击重试';feedback('音乐未能载入，请重试');}});
$('#pause').addEventListener('click',()=>game.status==='paused'?resume():pause());
$('#sound').addEventListener('click',()=>{if(!sound.buffer&&game.status!=='menu'){audioStart();return;}const on=sound.toggle();$('#sound').textContent=`声音 ${on?'ON':'OFF'}`;$('#sound').setAttribute('aria-pressed',String(on));$('#sound').setAttribute('aria-label',on?'关闭声音':'开启声音');});
$('#volume').addEventListener('input',e=>sound.setVolume(Number(e.target.value)/100));
$('#full').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{feedback('当前预览不支持全屏，可在浏览器打开');}});
$('#pause-dialog').addEventListener('cancel',e=>{e.preventDefault();resume();});
for(const id of ['upgrade','over'])$('#'+id).addEventListener('cancel',e=>e.preventDefault());
document.addEventListener('keydown',e=>{
  if(e.target instanceof HTMLInputElement)return;
  if(e.target instanceof HTMLButtonElement&&e.code==='Enter')return;
  if(e.target instanceof HTMLButtonElement&&e.code==='Space'&&game.status==='menu')return;
  if(['ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();
  if(e.repeat)return;
  keys.add(e.code);
  if(e.code==='Space'&&game.status==='ready'){game.launch();audioStart();}
  else if(e.code==='Space'&&game.status==='playing')game.tap();
  if(e.code==='KeyE')game.overdrive();
  if((e.code==='KeyP'||e.code==='Escape')&&!document.querySelector('dialog[open]'))pause();
  else if(e.code==='KeyP'&&game.status==='paused')resume();
  if(e.code==='KeyM')$('#sound').click();
});
document.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();if(['playing','ready'].includes(game.status))pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&['playing','ready'].includes(game.status))pause();if(document.hidden&&game.previewAudio){sound.stop();game.previewAudio=false;$('#audition').textContent='♫ 先听音乐';}});
const canvas=$('#world');
canvas.addEventListener('pointermove',e=>{if(stage&&['playing','ready'].includes(game.status))game.move(stage.pointer(e.clientX,e.clientY));});
canvas.addEventListener('pointerdown',e=>{if(!stage)return;canvas.setPointerCapture(e.pointerId);if(game.status==='ready'){game.move(stage.pointer(e.clientX,e.clientY));game.launch();audioStart();}else if(game.status==='playing')game.tap();});
window.addEventListener('pagehide',()=>{save();sound.stop();});
try{stage=new Stage(canvas,game);canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();pause();$('#error').hidden=false;$('#error').textContent='图形上下文已暂停，请刷新页面重新进入星云。';});}
catch(error){$('#start').disabled=true;$('#error').hidden=false;$('#error').innerHTML='星云舞台需要支持 WebGL 2 的浏览器。<br>请开启浏览器硬件加速后重试。<br><a href="../">返回音乐宇宙 ↗</a>';console.error(error);}
function frame(now){
  const dt=Math.min((now-last)/1000,.1);last=now;
  if(keys.has('ArrowLeft')||keys.has('KeyA'))game.move(game.target-dt*19);
  if(keys.has('ArrowRight')||keys.has('KeyD'))game.move(game.target+dt*19);
  game.advance(dt);
  for(const e of game.events.splice(0)){
    stage?.event(e);sound.event(e);
    if(e.type==='paddle'&&e.perfect)feedback('PERFECT · 节拍共鸣 +25');
    if(e.type==='lost'){save();feedback(`星核坠落 · 还剩 ${game.lives} 次机会`);}
    if(e.type==='clear')feedback('乐章完成 · 让旋律继续');
    if(e.type==='rhythm'){feedback(e.good?`${e.grade} · 连续跟拍 ${e.streak}`:'跟着底鼓，等光环合拢');$('#pulse').classList.remove('hit');void $('#pulse').offsetWidth;$('#pulse').classList.add('hit');}
    if(e.type==='drive')feedback('OVERDRIVE · 星核超载！');
    if(e.type==='phrase')feedback('乐句达成 · 能量 +25');
    if(e.type==='shield')feedback('防坠护盾 · 再给你一次机会');
    if(e.type==='guard')feedback('星核护盾 · 等待后四拍开放');
  }
  const energy=sound.measure();if(stage)stage.audioEnergy=energy;
  if(sound.active&&sound.ctx?.state==='running'){
    const section=['启程','推进','悬停','爆发'][Math.floor((sound.position()%(128*BEAT))/(32*BEAT))];
    $('#music-status').textContent=!sound.enabled?'已静音 · M 恢复声音':sound.volume===0?'音量为零 · 拖动音量滑块':energy>.02?`声音播放中 · ${section} / 128 BPM`:'声场正在唤醒';
  }
  else if(game.status==='paused')$('#music-status').textContent='声场暂停 · 继续后恢复节拍';
  document.querySelectorAll('.bars i').forEach((bar,i)=>{bar.style.animation='none';bar.style.transform=`scaleY(${sound.active?Math.max(.12,(sound.spectrum?.[i*5+2]||0)/255):.12})`;});
  sync();stage?.update(dt);requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
