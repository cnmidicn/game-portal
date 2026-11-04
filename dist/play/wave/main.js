import {Flight,BEAT,SECTIONS,DURATION} from './game.js';
import {FlightScene} from './scene.js';
import {FlightSound} from './audio.js';
import {musicState} from './soundtrack.js';
import {CAMERA_VIEWS} from './camera.js';
import {WEAPONS,missionState} from './progression.js';
const $=s=>document.querySelector(s),game=new Flight(),sound=new FlightSound(game),keys=new Set();
game.musicClock=()=>sound.position();
let stage,last=performance.now(),status='',starting=false,upgrading=false,feedbackTimer,chapterTimer,flash=0,best=0,selectedWeapon='scatter';
try{const stored=localStorage.getItem('game-wave-weapon');if(WEAPONS.some(w=>w.id===stored))selectedWeapon=stored;}catch{}game.weapon=selectedWeapon;
try{best=Number(localStorage.getItem('midi-drift-best'))||0;}catch{}
function save(){if(game.score>best){best=game.score;try{localStorage.setItem('midi-drift-best',String(best));}catch{}}}
function message(text){$('#feedback').textContent=text;$('#feedback').classList.add('show');clearTimeout(feedbackTimer);feedbackTimer=setTimeout(()=>$('#feedback').classList.remove('show'),1050);}
function selectView(id){if(!stage?.setView(id))return;message(`${CAMERA_VIEWS.find(v=>v.id===id).label}视角 · V 切换`);syncView();}
function syncView(){
  const mode=stage?.viewMode||'chase';document.body.dataset.view=mode;
  document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===mode)));
  $('#pause-view-name').textContent=CAMERA_VIEWS.find(v=>v.id===mode).label;
  $('#view-dock').hidden=game.status==='menu';$('#cockpit-data').hidden=mode!=='cockpit'||game.status==='menu';
  $('#cockpit-speed').textContent=Math.round(game.speed*3.6);$('#cockpit-altitude').textContent=(game.y+1.2).toFixed(1);
}
function showChapter(section){const data=SECTIONS[section];$('#chapter-card small').textContent=`0${section+1} / ${data.en}`;$('#chapter-card strong').textContent=data.name;$('#chapter-card>span').textContent=['穿越潮汐，留意巡逻机','进入峡谷，拦截机正在俯冲','浮岛与极光之下，寻找安全航线','敌方旗舰接近 · 准备重拍反击'][section];$('#chapter-card').classList.add('show');clearTimeout(chapterTimer);chapterTimer=setTimeout(()=>$('#chapter-card').classList.remove('show'),2700);}
async function begin(){
  if(starting||!stage)return;starting=true;
  $('#start').disabled=true;$('#start').innerHTML='正在唤醒声场 <span>♫</span>';
  try{
    await sound.init();for(const d of document.querySelectorAll('dialog[open]'))d.close();save();
    game.start(Date.now()%4294967296,selectedWeapon);keys.clear();clearTimeout(feedbackTimer);$('#feedback').classList.remove('show');$('#feedback').textContent='';flash=0;$('#intro').hidden=true;document.body.classList.add('flying');
    await sound.start();if(document.hidden)pause();
  }catch(e){message('音乐未能载入，请点击重试');console.error(e);}
  finally{starting=false;$('#start').disabled=false;$('#start').innerHTML='突破封锁 <span>↗</span>';}
}
async function refit(id){
  if(upgrading||game.status!=='refit')return;upgrading=true;
  try{await sound.init();if(game.chooseUpgrade(id)){$('#refit').close();keys.clear();await sound.start();if(document.hidden)pause();}}
  catch{message('声场未能恢复，请重试');}finally{upgrading=false;}
}
function pause(){if(game.status!=='playing')return;game.pause();sound.stop();keys.clear();$('#pause-dialog').showModal();}
async function resume(){if(game.status!=='paused')return;try{await sound.start();game.resume();$('#pause-dialog').close();}catch{message('声场未能恢复，请重试');}}
async function continueFlight(){if(game.status!=='complete')return;try{await sound.start();game.continue();$('#result').close();message('无尽远航 · 护盾 +2');}catch{message('声场未能恢复，请重试');}}
function sync(){
  syncView();
  const live=game.status!=='menu';$('#hud').hidden=!live;$('#drive-control').hidden=!live;$('#aim').hidden=!live;$('#pause').disabled=!['playing','paused'].includes(game.status);
  $('#score').textContent=String(game.score).padStart(6,'0');const rank=game.combo>=15?'S':game.combo>=8?'A':game.combo>=4?'B':'C';$('#combo').textContent=game.combo>=2?`RANK ${rank} · ${game.combo} 连击 ×${1+Math.floor(Math.min(game.combo,30)/5)}`:'猎杀机群，积累连击';$('#combo').dataset.rank=rank;
  const section=SECTIONS[game.section];$('#chapter').textContent=section.name;$('#chapter-en').textContent=section.en;
  $('#health').textContent=Array.from({length:game.health},()=>'◇').join(' ');$('#health').setAttribute('aria-label',`剩余 ${game.health} 层护盾`);
  $('#distance').textContent=`${Math.floor(game.distance).toLocaleString()} m`;const total=Math.floor(game.time),clock=`${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;$('#time').textContent=game.endless?`${clock} / ∞`:game.time>=60?`加时追击 ${Math.ceil(75-game.time)}s`:`${clock} / 01:00`;
  const beatTime=sound.active?sound.position():game.time,phase=(beatTime%BEAT)/BEAT;$('#dash').style.setProperty('--phase',String(phase));$('#dash').classList.toggle('on-beat',phase<.18||phase>.82);$('#dash').disabled=game.energy<15||game.status!=='playing';
  $('#energy-bar').style.transform=`scaleX(${game.energy/100})`;$('#energy-label').textContent=game.dashLeft>0?'HYPERDRIVE':`${Math.floor(game.energy)}% ENERGY`;
  $('#blast').disabled=game.resonance<100||game.status!=='playing'||game.blastCooldown>0;$('#blast').classList.toggle('ready',game.resonance>=100);$('#blast-label').textContent=game.resonance>=100?'按 E / 点击释放':`${Math.floor(game.resonance)}% · 蓄能中`;$('#blast-charge').style.transform=`scaleX(${game.resonance/100})`;
  const mission=missionState(game);$('#mission-title').textContent=mission.title;$('#mission-count').textContent=`${Math.min(mission.value,mission.target)} / ${mission.target}`;$('#mission-progress').style.transform=`scaleX(${Math.min(1,mission.value/mission.target)})`;$('#weapon-name').textContent=WEAPONS.find(w=>w.id===game.weapon)?.name||'脉冲炮';
  document.querySelectorAll('[data-weapon]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.weapon===selectedWeapon)));
  document.querySelectorAll('.beat-ticks i').forEach((el,i)=>el.classList.toggle('active',i===Math.floor(beatTime/BEAT)%4));
  $('#progress i').style.transform=`scaleX(${game.endless?(game.time%DURATION)/DURATION:Math.min(1,game.time/DURATION)})`;document.body.classList.toggle('boosting',game.dashLeft>0);
  $('#combat-hud').hidden=!live;const enemies=game.enemies.filter(e=>e.active&&!e.dead);$('#threat-count').textContent=enemies.length?`${enemies.length} 个敌方目标`:'空域安全';$('#kill-count').textContent=`击落 ${game.enemyKills}`;
  const boss=enemies.find(e=>e.kind==='boss');document.body.classList.toggle('boss-encounter',Boolean(boss));$('#boss-hud').hidden=!boss||!live;if(boss){$('#boss-hp').style.transform=`scaleX(${boss.hp/boss.maxHp})`;$('#boss-state').textContent=boss.open?'弱点开放 · 集中火力':'护盾闭合 · 重拍可穿透';}
  const warning=enemies.some(e=>e.telegraph)||game.lasers.length;$('#danger-warning').hidden=!warning||game.status!=='playing';$('#danger-warning').textContent=game.lasers.length?'激光封路 · 寻找未亮起的通道':boss?.phase===3?'密集弹幕 · 保持在预警缺口':'锁定来袭 · 横移规避';
  const target=stage?.targetInfo;$('#target-lock').hidden=!live||!target?.visible||game.status!=='playing';
  if(stage?.aimScreen){$('#aim').style.left=`${stage.aimScreen.x}px`;$('#aim').style.top=`${stage.aimScreen.y}px`;}document.body.classList.toggle('targeted',Boolean(target?.locked));
  if(target?.visible){const e=target.enemy;$('#target-lock').style.left=`${target.x}px`;$('#target-lock').style.top=`${target.y}px`;$('#target-lock').classList.toggle('locked',target.locked);$('#target-name').textContent=e.kind==='boss'?'旗舰机芯':e.kind==='interceptor'?'拦截机':'巡逻机';$('#target-hp').style.transform=`scaleX(${e.hp/e.maxHp})`;$('#target-state').textContent=target.locked?'已对准 · 自动开火':'调整机身瞄准';}
  if(status!==game.status){
    if(game.status==='refit'){
      keys.clear();sound.stop();$('#upgrade-choices').replaceChildren(...game.upgradeChoices.map((u,i)=>{const b=document.createElement('button');b.innerHTML=`<small>0${i+1} / UPGRADE</small><span>${u.icon}</span><b>${u.name}</b><p>${u.desc}</p>`;b.addEventListener('click',()=>refit(u.id));return b;}));$('#refit').showModal();
    }
    if(['complete','over'].includes(game.status)){
      save();const complete=game.status==='complete';$('#result-kicker').textContent=complete?'BLOCKADE BROKEN':'OPERATION INCOMPLETE';$('#result-title').textContent=complete?'封锁已解除。':'下一次，换种打法。';
      $('#final-score').textContent=game.score.toLocaleString();$('#final-gates').textContent=game.gates;$('#final-perfects').textContent=game.perfects;$('#final-kills').textContent=game.enemyKills;$('#result-text').textContent=`${game.failureReason||`航行 ${Math.floor(game.distance).toLocaleString()} 米`} · 最高 ${game.bestCombo} 连击 · ${game.bossKills?'旗舰已击落 · ':''}本机最高 ${best.toLocaleString()} 分。${complete?'继续远航会恢复两层护盾。':'不同的初始武器与强化，会改变下一次航程。'}`;
      $('#continue').hidden=!complete;$('#result').showModal();const endedGeneration=sound.generation;setTimeout(()=>{if(!starting&&sound.generation===endedGeneration&&['complete','over'].includes(game.status))sound.stop();},700);
    }
    status=game.status;
  }
}
$('#start').addEventListener('click',begin);$('#restart').addEventListener('click',begin);$('#restart-pause').addEventListener('click',begin);$('#resume').addEventListener('click',resume);$('#continue').addEventListener('click',continueFlight);
$('#pause').addEventListener('click',()=>game.status==='paused'?resume():pause());$('#dash').addEventListener('click',()=>game.dash());
$('#blast').addEventListener('click',()=>game.blast());document.querySelectorAll('[data-weapon]').forEach(b=>b.addEventListener('click',()=>{selectedWeapon=b.dataset.weapon;game.weapon=selectedWeapon;try{localStorage.setItem('game-wave-weapon',selectedWeapon);}catch{}}));
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>selectView(b.dataset.view)));
$('#sound').addEventListener('click',()=>{const on=sound.toggle();$('#sound').textContent=on?'♫ ON':'♫ OFF';$('#sound').setAttribute('aria-pressed',String(on));$('#sound').setAttribute('aria-label',on?'静音':'开启声音');});
$('#volume').addEventListener('input',e=>sound.setVolume(Number(e.target.value)/100));
$('#fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{message('当前预览不支持全屏，可在浏览器打开');}});
$('#pause-dialog').addEventListener('cancel',e=>{e.preventDefault();resume();});$('#result').addEventListener('cancel',e=>e.preventDefault());
$('#refit').addEventListener('cancel',e=>e.preventDefault());
document.addEventListener('keydown',e=>{
  if(e.target instanceof HTMLInputElement)return;
  if(game.status==='refit'&&['Digit1','Digit2','Digit3'].includes(e.code)&&!e.repeat){e.preventDefault();const u=game.upgradeChoices[Number(e.code.at(-1))-1];if(u)refit(u.id);return;}
  if(e.code==='KeyV'&&!e.repeat){e.preventDefault();const index=CAMERA_VIEWS.findIndex(v=>v.id===stage?.viewMode);selectView(CAMERA_VIEWS[(index+1)%CAMERA_VIEWS.length].id);return;}
  if(e.code==='KeyP'&&game.status==='paused'){e.preventDefault();resume();return;}
  if(document.querySelector('dialog[open]'))return;
  if(game.status!=='playing')return;
  if(['Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code))e.preventDefault();if(e.repeat)return;
  keys.add(e.code);if(e.code==='Space')game.dash();if(e.code==='KeyE')game.blast();if(['KeyP','Escape'].includes(e.code))pause();if(e.code==='KeyM')$('#sound').click();
});
document.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});window.addEventListener('pagehide',()=>{save();sound.stop();});
const canvas=$('#world');
function steer(e){if(!stage||game.status!=='playing')return;const target=stage.pointer(e.clientX,e.clientY);game.move(target.x,target.y);$('#aim').style.left=`${e.clientX}px`;$('#aim').style.top=`${e.clientY}px`;}
canvas.addEventListener('pointermove',steer);canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);steer(e);});
try{stage=new FlightScene(canvas,game);canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();pause();$('#error').hidden=false;$('#error').textContent='图形上下文已暂停。请刷新页面重新启航。';});}
catch(e){$('#error').hidden=false;$('#error').textContent='这个飞行世界需要 WebGL 2。请开启浏览器硬件加速后刷新。';$('#start').disabled=true;console.error(e);}
function frame(now){
  const dt=Math.min((now-last)/1000,.1);last=now;
  if(game.status==='playing'){
    const horizontal=(keys.has('ArrowRight')||keys.has('KeyD')?1:0)-(keys.has('ArrowLeft')||keys.has('KeyA')?1:0),vertical=(keys.has('ArrowUp')||keys.has('KeyW')?1:0)-(keys.has('ArrowDown')||keys.has('KeyS')?1:0);
    if(horizontal||vertical)game.move(game.targetX+horizontal*dt*10,game.targetY+vertical*dt*5);
    game.advance(sound.active?Math.max(0,sound.position()-game.time):dt);
  }
  for(const e of game.events.splice(0)){
    stage?.event(e);sound.event(e);
    if(e.type==='section')showChapter(e.section);
    if(e.type==='gate'){message(e.bonus?`冒险航线 +${e.score}`:e.boosted?`跃迁穿环 +${e.score}`:`穿环 +${e.score}${e.combo>=3?' · '+e.combo+' 连环':''}`);flash=Math.max(flash,e.boosted?.1:.035);$('#flash').style.background='#a6ffed';}
    if(e.type==='dash'){message(e.perfect?'PERFECT · 重拍跃迁':'跃迁 · 下一拍会更有力');flash=.045;$('#flash').style.background='#abf3ff';}
    if(e.type==='smash'){message('击碎阻碍 +180');flash=.1;$('#flash').style.background='#f7a9e4';}
    if(e.type==='crash'){message(e.cause==='enemy'?'护盾受损 · 横移躲避敌方火力':'护盾受损 · 避开红色晶体');flash=.18;$('#flash').style.background='#ff679b';}
    if(e.type==='near')message('擦身而过 +60');if(e.type==='empty')message('能量不足 · 穿环或等待充能');
    if(e.type==='enemyEnter'&&e.kind==='boss')message('守关旗舰出现 · 重拍追踪炮可穿透护盾');
    else if(e.type==='enemyEnter'&&game.time<4)message('发现巡逻机 · 移动机身瞄准');
    if(e.type==='enemyKill'){message(e.kind==='boss'?`旗舰击破 +${e.score} · 护盾 +2`:`敌机击落 +${e.score}`);if(e.kind==='boss'){flash=.12;$('#flash').style.background='#ffe2a8';}}
    if(e.type==='counter')message(`重拍反击 · ${e.count} 枚追踪脉冲`);
    if(e.type==='reflect')message('跃迁格挡 +30');
    if(e.type==='blast'){message('RESONANCE BREAK · 共鸣爆破');flash=.075;$('#flash').style.background='#fff0c8';}
    if(e.type==='objective')message('战术目标完成 · 护盾与能量恢复');
    if(e.type==='upgraded')message('强化已生效 · 继续突破');
    if(e.type==='bossPhase')message(e.phase===2?'旗舰切换攻势 · 激光封路':'旗舰进入过载 · 寻找弹幕缺口');
    if(e.type==='laserWarning')message(e.safe===0?'中间通道安全 · 保持居中':e.safe<0?'左侧通道安全 · 向左规避':'右侧通道安全 · 向右规避');
  }
  flash*=Math.exp(-dt*7);$('#flash').style.opacity=String(flash);
  const energy=sound.measure();if(stage){stage.energy=energy;stage.audio=sound.levels;stage.spectrum=sound.spectrum;}
  if(sound.active&&sound.ctx?.state==='running')$('#music-status').textContent=!sound.enabled?'静音 · M 恢复':sound.volume===0?'音量为零':energy>.02?`${musicState(game).label} · 128 BPM`:'声场正在唤醒';else if(game.status==='paused')$('#music-status').textContent='飞行与音乐已暂停';
  document.querySelectorAll('.equalizer i').forEach((el,i)=>el.style.transform=`scaleY(${Math.max(.12,(sound.spectrum?.[i*4+2]||0)/255)})`);
  sync();stage?.update(dt);requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
