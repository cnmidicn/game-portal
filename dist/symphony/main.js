import {Game,STAGES,TRAITS,BIOMES} from './game.js';
import {Music} from './audio.js';
import {Ocean} from './scene.js';
import {FORMS,BADGES,normalizeArchive,unlocked} from './progression.js';

const $=id=>document.getElementById(id),game=new Game();
let ocean,previous=performance.now(),elapsed=0,lastUI=0,toastTimer,overlayReturn='home',lastFocus;
let keys=new Set(),mouseTarget=null,dragging=false,stick={x:0,z:0},stickId=null;
let archive=normalizeArchive();
try{archive=normalizeArchive(JSON.parse(localStorage.getItem('symphony-archive')||'{}'));}catch{}
let runRecord={counted:false,won:false,challenges:0},runUnlocks=[],lastCheckpoint=0,unlockTimer;
const music=new Music(step=>{
  const bars=$('beat-strip').children;for(let i=0;i<bars.length;i++)bars[i].classList.toggle('on',i===step);
  if(ocean)ocean.beat.value=step%4===0?1:.35;
  document.querySelectorAll('.equalizer i').forEach((e,i)=>e.style.height=(5+((step*7+i*11)%23))+'px');
});
music.volume=archive.volume;
try{ocean=new Ocean($('world'));ocean.setQuality(archive.quality);game.reset(archive.biome);$('loading').classList.add('hidden');}catch(error){
  $('loading').innerHTML='<span>三维场景未能启动</span><p style="font-size:12px;letter-spacing:0">请使用支持 WebGL 的浏览器，并开启硬件加速。</p><button class="primary" onclick="location.reload()">重新加载</button>';console.error(error);
}
function fmtTime(t){return `${Math.floor(t/60).toString().padStart(2,'0')}:${Math.floor(t%60).toString().padStart(2,'0')}`;}
function saveArchive(){try{localStorage.setItem('symphony-archive',JSON.stringify(archive));}catch{}}
function announce(items){if(!items.length)return;clearTimeout(unlockTimer);$('unlock-notice').replaceChildren();const small=document.createElement('small');small.textContent=items.some(i=>i.key.startsWith('form:'))?'NEW LIFE FORM / 新生命形态':'LIFE ACHIEVEMENT / 生命徽章';$('unlock-notice').append(small,document.createTextNode(items.map(i=>i.name).join(' · ')));$('unlock-notice').classList.add('visible');unlockTimer=setTimeout(()=>$('unlock-notice').classList.remove('visible'),5500);}
function recordProgress(){
  if(!runRecord.counted&&game.time<.5)return;
  const old=new Set(unlocked(archive).map(i=>i.key)),b=archive.biomes[game.biome.id];
  if(!runRecord.counted){archive.runs++;b.runs++;runRecord.counted=true;}
  archive.best=Math.max(archive.best,game.peakMass);archive.bestCombo=Math.max(archive.bestCombo,game.bestCombo);b.best=Math.max(b.best,game.peakMass);
  archive.species=[...new Set([...archive.species,...game.species])];archive.visited=[...new Set([...archive.visited,game.biome.id])];
  archive.challenges+=Math.max(0,game.completedChallenges-runRecord.challenges);runRecord.challenges=game.completedChallenges;
  if(game.won&&!runRecord.won){archive.wins++;b.wins++;runRecord.won=true;}
  const fresh=unlocked(archive).filter(i=>!old.has(i.key));runUnlocks.push(...fresh);announce(fresh);saveArchive();
}
function showRecord(){const form=FORMS.find(f=>f.id===archive.form&&f.unlock(archive))||FORMS[0];$('record').textContent=archive.runs?`已探索 ${archive.runs} 次 · 最高 ${Math.round(archive.best)} μ · 起始形态：${form.name}`:'';}
function selectBiome(id){if(game.status!=='home')return;const b=BIOMES.find(b=>b.id===id);if(!b)return;archive.biome=id;game.reset(id);saveArchive();updateBiomePicker();}
function updateBiomePicker(){document.querySelectorAll('[data-biome]').forEach(btn=>{const selected=btn.dataset.biome===archive.biome;btn.classList.toggle('selected',selected);btn.setAttribute('aria-pressed',String(selected));});$('location').textContent=game.biome.en;$('start-btn').innerHTML='潜入'+game.biome.name+' <span>↗</span>';}
function showArchive(){
  showDialog(`<div class="eyebrow">THE LIVING ARCHIVE</div><h2 id="dialog-title">每一次生命，都留下回响。</h2><div class="archive-summary">探索 ${archive.runs} 次 · 海域征服 ${archive.wins} 次 · 最高质量 ${Math.round(archive.best)} μ · 最佳连击 ×${archive.bestCombo}</div><div class="archive-grid">${FORMS.map(f=>`<button class="archive-card ${archive.form===f.id?'selected':''} ${f.unlock(archive)?'':'locked'}" data-form="${f.id}" ${f.unlock(archive)?'':'disabled'}><span class="evo-icon">${f.icon}</span><b>${f.name}</b><p>${f.desc}</p><small>${f.unlock(archive)?(archive.form===f.id?'✓ 已选择 · 下局使用':'已解锁 · 点击选择'):'待解锁 · '+f.condition}</small></button>`).join('')}</div><h3 class="archive-section-title">三海航迹</h3><div class="biome-records">${BIOMES.map(b=>`<div>${b.name}<small>${archive.visited.includes(b.id)?'已探索':'等待发现'} · 征服 ${archive.biomes[b.id].wins} 次<br>最高 ${Math.round(archive.biomes[b.id].best)} μ</small></div>`).join('')}</div><h3 class="archive-section-title">生命徽章 ${BADGES.filter(b=>b.unlock(archive)).length} / ${BADGES.length}</h3><div class="badge-grid">${BADGES.map(b=>`<div class="badge ${b.unlock(archive)?'':'locked'}"><span>${b.icon}</span><b>${b.name}</b><small>${b.desc}</small></div>`).join('')}</div><div class="codex-list">生物图鉴 ${archive.species.length} / 5<br>${['微光孢子','游弋虫','水母幼体','晶壳细胞','海域霸主'].map((name,i)=>archive.species.includes(i)?'◉ '+name:'○ 未发现').join('　')}</div><p>档案自动保存在当前浏览器。新形态提供一种起始特性，途中仍可选择三次进化。</p><button id="archive-close" class="primary">回到生命之海 ↗</button>`);
  $('dialog').querySelectorAll('[data-form]').forEach(b=>b.onclick=()=>{archive.form=b.dataset.form;saveArchive();showArchive();showRecord();});$('archive-close').onclick=()=>{closeDialog();showRecord();};
}
showRecord();updateBiomePicker();
function toast(text){$('toast').textContent=text;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2600);}
function showDialog(html){lastFocus=document.activeElement;$('dialog').innerHTML=html;$('dialog').scrollTop=0;$('overlay').classList.remove('hidden');$('home').inert=true;$('hud').inert=true;keys.clear();dragging=false;mouseTarget=null;stickId=null;stick.x=stick.z=0;$('joystick-knob').style.transform='';music.pause();requestAnimationFrame(()=>$('dialog').querySelector('button:not(:disabled),input')?.focus());}
function closeDialog(){$('overlay').classList.add('hidden');$('home').inert=false;$('hud').inert=false;lastFocus?.focus();if(game.status==='playing')music.start();}
async function start(){
  if(!ocean)return;music.pause();game.reset(archive.biome);game.start();keys.clear();mouseTarget=null;dragging=false;stickId=null;stick.x=stick.z=0;runRecord={counted:false,won:false,challenges:0};runUnlocks=[];lastCheckpoint=0;
  const form=FORMS.find(f=>f.id===archive.form&&f.unlock(archive))||FORMS[0];if(form.trait)game.traits.push(form.trait);if(form.trait==='shell')game.health=game.maxHealth=4;
  document.body.classList.add('playing');$('home').classList.add('hidden');$('specimen').classList.add('hidden');$('hud').classList.remove('hidden');$('overlay').classList.add('hidden');
  $('home').inert=false;$('hud').inert=false;$('pause-btn').textContent='Ⅱ';
  $('control-hint').innerHTML='<kbd>WASD</kbd> / 拖动移动 <span>·</span> <kbd>SPACE</kbd> 冲刺';
  music.stage=0;music.step=0;music.setBiome(game.biome);try{await music.init();if(game.status==='playing')music.start();}catch{toast('声音暂时未能启动，可点击右上角音符重试');}
  $('seed-label').textContent=game.biome.name+' · 随机进化';toast(game.biome.desc);updateUI();
}
function home(){if(game.status!=='home')recordProgress();game.reset(archive.biome);document.body.classList.remove('playing');$('home').classList.remove('hidden');$('specimen').classList.remove('hidden');$('hud').classList.add('hidden');$('overlay').classList.add('hidden');$('home').inert=false;$('hud').inert=false;music.pause();music.stage=0;keys.clear();mouseTarget=null;dragging=false;stickId=null;stick.x=stick.z=0;$('seed-label').textContent='生命，从一个音符开始';$('track-name').firstChild.textContent=STAGES[0].track;$('music-status').textContent='点击开始，唤醒声音';$('pause-btn').textContent='Ⅱ';showRecord();updateBiomePicker();updateChapters();}
function pause(){if(game.status==='playing'){game.status='paused';$('pause-btn').textContent='▷';showDialog(`<div class="eyebrow">TAKE A BREATH</div><h2 id="dialog-title">让生命，慢下来。</h2><p>海洋与音乐正在等待你。</p><div class="dialog-actions"><button class="primary" id="resume">继续探索 ↗</button><button class="text-btn" id="quit">回到起点</button></div>`);$('resume').onclick=resume;$('quit').onclick=home;}else if(game.status==='paused')resume();}
function resume(){game.status='playing';$('pause-btn').textContent='Ⅱ';closeDialog();}
function returnTo(status){if(status==='paused'){game.status='playing';pause();}else{game.status=status;closeDialog();}}
function settings(){
  if(!['home','playing','paused'].includes(game.status))return;
  const back=game.status;if(back==='playing')game.status='settings';
  showDialog(`<div class="eyebrow">MAKE THE OCEAN YOUR OWN</div><h2 id="dialog-title">调到舒服的频率。</h2><div class="settings-grid"><label for="volume">音乐音量 <span id="volume-value">${Math.round(archive.volume*100)}%</span><input id="volume" type="range" min="0" max="100" step="1" value="${Math.round(archive.volume*100)}"></label><div><label>画面质量</label><div class="settings-quality"><button data-quality="high" class="${archive.quality==='high'?'selected':''}" aria-pressed="${archive.quality==='high'}">精致 · 更多微光</button><button data-quality="low" class="${archive.quality==='low'?'selected':''}" aria-pressed="${archive.quality==='low'}">流畅 · 节省性能</button></div></div><small>流畅模式降低渲染分辨率与环境粒子数量，不影响玩法与音乐。偏好会自动保存。</small></div><button id="settings-close" class="primary">调整好了 ↗</button>`);
  $('volume').oninput=e=>{archive.volume=Number(e.target.value)/100;music.setVolume(archive.volume);$('volume-value').textContent=e.target.value+'%';saveArchive();};
  $('dialog').querySelectorAll('[data-quality]').forEach(btn=>btn.onclick=()=>{archive.quality=btn.dataset.quality;ocean?.setQuality(archive.quality);$('dialog').querySelectorAll('[data-quality]').forEach(b=>{b.classList.toggle('selected',b===btn);b.setAttribute('aria-pressed',String(b===btn));});saveArchive();});
  $('settings-close').onclick=()=>returnTo(back);
}
function guide(){
  if(!['home','playing','paused'].includes(game.status))return;overlayReturn=game.status;if(game.status==='playing')game.status='guide';
  showDialog(`<div class="eyebrow">A SMALL GUIDE TO A BIG WORLD</div><h2 id="dialog-title">跟随本能，自由生长。</h2><p>自由吞噬，每次成长都会加入音乐。左侧的生命愿望提供额外目标。</p><div class="guide-grid"><div><b>01 / 游向微光</b><p>WASD、方向键或按住场景拖动。手机使用左下摇杆。青绿可吞噬，蓝色势均力敌，珊瑚红需要躲避。</p></div><div><b>02 / 抓住进化</b><p>空格冲刺；在 32、100、280 μ 选择进化。主动技能按 E 释放。完成生命愿望会修复护膜并降下营养雨。</p></div><div><b>03 / 探索三海</b><p>浅海平静，潮汐会推动你与食物，深渊晶簇在紫色光环蓄满后释放伤害脉冲。看到预警，及时离开。</p></div><div><b>04 / 奏响终章</b><p>成长到 700 μ。霸主会蓄力、沿预告方向冲撞，随后露出破绽；趁此时靠近吞噬。生物电流也能制造破绽。</p></div></div><p>Esc 暂停 · M 切换声音 · 设置中可调整音量与画质<br>每片海域有独立记录。25 连击、280 μ、首次胜利可解锁新的起始形态。</p><button id="guide-close" class="primary">${overlayReturn==='home'?'明白了':'回到海洋'} ↗</button>`);
  $('guide-close').onclick=()=>returnTo(overlayReturn);
}
function evolution(){
  music.flourish();const n=game.evoCount+1;
  showDialog(`<div class="eyebrow">EVOLUTION ${String(n).padStart(2,'0')} / 生命的新可能</div><h2 id="dialog-title">选择你的进化。</h2><p>每一次选择，都让你成为不同的生命。选择后修复一层护膜。</p><div class="evolution-cards">${game.choices.map(t=>`<button class="evo-card" data-trait="${t.id}"><span class="evo-icon">${t.icon}</span><b>${t.name}</b><p>${t.desc}</p><small>${t.hint} ↗</small></button>`).join('')}</div>`);
  $('dialog').querySelectorAll('[data-trait]').forEach(b=>b.onclick=()=>{if(game.evolve(b.dataset.trait)){closeDialog();ocean.ripple(game.player.x,game.player.z,game.player.radius);music.flourish();toast(`已进化 · ${TRAITS.find(t=>t.id===b.dataset.trait).name}`);updateUI();}});
}
function end(won){
  recordProgress();
  if(won)music.flourish();
  showDialog(`<div class="eyebrow">${game.biome.en}</div><h2 id="dialog-title">${won?'你，奏响了整片海。':'生命的回响，不会消失。'}</h2><p>${won?'这片海已记住你的旋律。下一片海，等待新的生命。':'带着这次的经验，再选择一条不同的进化之路。'}</p><div class="result-stats"><div><strong>${Math.round(game.peakMass)} μ</strong><small>最高质量</small></div><div><strong>${fmtTime(game.time)}</strong><small>探索时间</small></div><div><strong>×${game.bestCombo}</strong><small>最高连击</small></div></div><p>吞噬 ${game.eaten} 次 · 完成 ${game.completedChallenges} 个愿望 · 档案已保存</p>${runUnlocks.length?`<p class="unlock-summary">新收获：${runUnlocks.map(u=>u.name).join(' · ')}</p>`:''}<div class="dialog-actions"><button id="replay" class="primary">再进化一次 ↗</button>${won?'<button id="next-biome" class="text-btn">前往下一海域 ↗</button><button id="continue" class="text-btn">继续自由探索</button>':''}<button id="end-home" class="text-btn">回到起点</button></div>`);
  $('replay').onclick=start;$('end-home').onclick=home;if(won){$('continue').onclick=()=>{game.endless=true;game.status='playing';game.invincible=4;closeDialog();toast('自由探索已开启 · 创造新的质量纪录');updateUI();};$('next-biome').onclick=()=>{archive.biome=BIOMES[(BIOMES.findIndex(b=>b.id===game.biome.id)+1)%BIOMES.length].id;saveArchive();start();};}
}
function updateChapters(){document.querySelectorAll('.chapter').forEach((e,i)=>{e.classList.toggle('active',i===game.stage);e.classList.toggle('done',i<game.stage);});}
function updateUI(){
  const s=STAGES[game.stage],p=game.player,next=STAGES[game.stage+1];
  $('stage-title').textContent=s.name;$('mass').textContent=`${Math.round(p.mass)} μ`;
  $('growth-fill').style.width=(next?Math.max(0,Math.min(100,(p.mass-s.mass)/(next.mass-s.mass)*100)):100)+'%';
  $('next-stage').textContent=next?`下一次进化 · ${next.mass} μ`:'进化完成 · 挑战海域霸主';
  $('health').textContent='● '.repeat(Math.max(0,game.health))+'○ '.repeat(game.maxHealth-Math.max(0,game.health));
  $('time').textContent=fmtTime(game.time);$('combo').textContent=`×${Math.max(1,game.combo)}`;$('combo-label').textContent=game.combo>9?'连锁共鸣':'吞噬连击';
  $('location').textContent=game.biome.en;$('track-name').firstChild.textContent=s.track;
  $('music-status').textContent=music.muted?'声音已关闭':`${game.biome.bpm} BPM · ${game.stage+1} / 5 声部`;
  $('traits').innerHTML=game.traits.map(id=>`<span>${TRAITS.find(t=>t.id===id).name}</span>`).join('');
  if(game.endless){$('mission-text').textContent='自由探索 · 创造新的生命纪录';$('mission-sub').textContent=`历史最高 ${Math.round(Math.max(archive.best,game.peakMass))} μ · 已吞噬 ${game.eaten} 次`;}
  else if(game.stage>=4){$('mission-text').textContent='等待霸主破绽，吞噬奏响终章';$('mission-sub').textContent='冲撞后护壳打开 · 电流也能制造破绽';}
  else{$('mission-text').textContent=game.stage===0?'吞噬微光，成长至 32 μ':`继续捕食，成长至 ${next.mass} μ`;$('mission-sub').textContent=game.stage>=3?'海域霸主已出现 · 先成长，再挑战':'青绿可吞噬 · 蓝色势均力敌 · 珊瑚红需躲避';}
  $('danger').classList.toggle('hidden',!game.danger);
  const q=game.challenge;$('challenge-name').textContent=q.name;$('challenge-count').textContent=`${q.progress} / ${q.target}`;$('challenge-desc').textContent=q.desc;$('challenge-fill').style.width=(q.progress/q.target*100)+'%';$('challenge-reward').textContent=q.done?'✓ 愿望达成 · 护膜已修复，营养雨已降临':'完成奖励 · 修复护膜 + 营养雨';$('challenge').classList.toggle('completed',q.done);
  const boss=game.creatures.find(c=>c.boss),near=boss&&Math.hypot(boss.x-p.x,boss.z-p.z)<90;
  $('boss-status').className='boss-status'+(near?' '+boss.state:' hidden');if(near){const exposed=game.canEat(boss);$('boss-state').textContent=exposed?'护壳破绽 · 可以吞噬':boss.state==='warning'?'正在蓄力！':boss.state==='charge'?'冲撞！侧向躲避':boss.state==='exposed'?'护壳打开 · 还需成长':'护壳闭合';$('boss-tip').textContent=exposed?'靠近霸主，完成最后一次吞噬':p.mass<700?'先成长至 700 μ，再抓住机会':'避开冲撞，趁破绽接近';if(exposed)$('boss-status').className='boss-status exposed';}
  $('dash-fill').style.height=(game.dashCd/(game.traits.includes('speed')?2.8:4)*100)+'%';$('dash-label').textContent=game.dashCd>0?game.dashCd.toFixed(1)+'s':'SPACE';
  const active=game.traits.includes('electric')||game.traits.includes('magnet');$('ability-btn').classList.toggle('hidden',!active);$('ability-name').textContent=game.traits.includes('electric')?'电流脉冲':'引力场';$('ability-label').textContent=game.abilityCd>0?game.abilityCd.toFixed(1)+'s':'E';$('ability-fill').style.height=(game.abilityCd/8*100)+'%';
  updateChapters();drawRadar();
}
const rc=$('minimap').getContext('2d');
function drawRadar(){const c=rc,p=game.player;c.clearRect(0,0,160,160);c.strokeStyle='#a1dbbc28';c.lineWidth=1;for(const r of [28,53,75]){c.beginPath();c.arc(80,80,r,0,Math.PI*2);c.stroke();}c.beginPath();c.moveTo(80,5);c.lineTo(80,155);c.moveTo(5,80);c.lineTo(155,80);c.stroke();
  for(const h of game.hazards){const dx=(h.x-p.x)*1.15,dz=(h.z-p.z)*1.15;if(Math.hypot(dx,dz)<72){c.strokeStyle=h.state==='idle'?'#956fb66a':'#d9abfb';c.beginPath();c.arc(80+dx,80+dz,h.radius*.65,0,7);c.stroke();}}
  for(const q of game.creatures){let dx=(q.x-p.x)*1.15,dz=(q.z-p.z)*1.15,d=Math.hypot(dx,dz);if(d>72){if(!q.boss)continue;dx*=72/d;dz*=72/d;}c.fillStyle=q.boss?'#ffd49a':game.canEat(q)?'#8ee8b6':game.isDangerous(q)?'#e89b85':'#82aec2';c.beginPath();c.arc(80+dx,80+dz,q.boss?4:2,0,7);c.fill();}
  c.fillStyle='#e0ffe8';c.beginPath();c.arc(80,80,3,0,7);c.fill();
}
function handleEvents(){
  const events=game.events.splice(0);
  for(const e of events){
    if(e.type==='eat'){music.eat(e.kind,e.combo);ocean.burst(e.x,e.z,e.kind===3?0xffd08a:0xa8fbc5,Math.min(16,5+e.amount));
      if(e.combo>4&&music.isOnBeat()&&e.combo%5===0)toast(`PERFECT · 连锁共鸣 ×${e.combo}`);
    }else if(e.type==='stage'){music.stage=e.stage;music.flourish();ocean.ripple(game.player.x,game.player.z,game.player.radius,0xb7ffcf);toast(`新乐章 · ${STAGES[e.stage].name}`);}
    else if(e.type==='evolution')evolution();
    else if(e.type==='dash'){ocean.ripple(game.player.x,game.player.z,game.player.radius);}
    else if(e.type==='ability'){ocean.ripple(game.player.x,game.player.z,game.player.radius*3,e.electric?0x9bc9ff:0xa7ffd0);music.note(81,music.ctx?.currentTime||0,.8,'sine',.12);}
    else if(e.type==='damage'){music.hit();ocean.shake=.3;ocean.burst(game.player.x,game.player.z,0xf0a58c,25);toast(e.cause==='crystal'?'晶簇脉冲！护膜受损':'护膜受损 · 冲刺离开天敌');}
    else if(e.type==='boss')toast('深海传来低鸣 · 海域霸主已现身');
    else if(e.type==='bossWarning')toast('霸主正在蓄力 · 向侧面冲刺');
    else if(e.type==='challenge'){music.flourish();ocean.ripple(game.player.x,game.player.z,game.player.radius*2);toast(`愿望达成 · ${e.name} · 护膜修复`);recordProgress();}
    if(['stage','prey'].includes(e.type))recordProgress();
    if(e.type==='end')end(e.won);
  }
}
function input(){let x=0,z=0;if(keys.has('a')||keys.has('arrowleft'))x--;if(keys.has('d')||keys.has('arrowright'))x++;if(keys.has('w')||keys.has('arrowup'))z--;if(keys.has('s')||keys.has('arrowdown'))z++;
  if(stickId!==null){x=stick.x;z=stick.z;}else if(!x&&!z&&dragging&&mouseTarget){const dx=mouseTarget.x-game.player.x,dz=mouseTarget.z-game.player.z,d=Math.hypot(dx,dz);if(d>.4){x=dx/d*Math.min(1,d/3);z=dz/d*Math.min(1,d/3);}}
  return {x,z};
}
function frame(now){const dt=Math.min((now-previous)/1000,.05);previous=now;elapsed+=dt;
  game.update(dt,input());if(ocean){handleEvents();ocean.update(game,dt,elapsed);}
  if(now-lastUI>100&&game.status!=='home'){updateUI();lastUI=now;}
  if(game.status==='playing'&&game.time-lastCheckpoint>10){recordProgress();lastCheckpoint=game.time;}
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
$('start-btn').onclick=start;$('home-guide').onclick=guide;$('guide-btn').onclick=guide;$('pause-btn').onclick=pause;$('archive-btn').onclick=showArchive;$('settings-btn').onclick=settings;
document.querySelectorAll('[data-biome]').forEach(btn=>btn.onclick=()=>selectBiome(btn.dataset.biome));
$('dash-btn').onclick=()=>game.dash();$('ability-btn').onclick=()=>game.ability();
$('sound-btn').onclick=async()=>{try{await music.init();const muted=music.mute();$('sound-btn').textContent=muted?'♪̸':'♫';$('sound-btn').setAttribute('aria-label',muted?'开启声音':'关闭声音');if(game.status==='playing')music.start();updateUI();}catch{toast('无法启动音频，请检查浏览器声音权限');}};
addEventListener('keydown',e=>{
  if(!$('overlay').classList.contains('hidden')){if(e.key==='Tab'){const list=[...$('dialog').querySelectorAll('button:not(:disabled),input')];if(list.length){if(e.shiftKey&&document.activeElement===list[0]){e.preventDefault();list.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===list.at(-1)){e.preventDefault();list[0].focus();}}}if(e.key==='Escape'){const close=$('settings-close')||$('guide-close')||$('archive-close');if(close)close.click();else if(game.status==='paused')resume();}return;}
  const k=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();if(e.repeat)return;
  if(k==='escape'||k==='p')pause();else if(k===' ')game.dash();else if(k==='e')game.ability();else if(k==='m')$('sound-btn').click();else keys.add(k);
});
addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
addEventListener('blur',()=>{keys.clear();dragging=false;stickId=null;stick.x=stick.z=0;$('joystick-knob').style.transform='';if(game.status==='playing')pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&game.status==='playing'){recordProgress();pause();}});
addEventListener('pagehide',()=>{if(game.status!=='home')recordProgress();});
if(ocean){const canvas=ocean.renderer.domElement;canvas.addEventListener('pointerdown',e=>{if(game.status!=='playing')return;dragging=true;canvas.setPointerCapture(e.pointerId);const p=ocean.pointToWorld(e.clientX,e.clientY);if(p){mouseTarget={x:p.x,z:p.z};ocean.ripple(p.x,p.z,.35);}});canvas.addEventListener('pointermove',e=>{if(dragging){const p=ocean.pointToWorld(e.clientX,e.clientY);if(p)mouseTarget={x:p.x,z:p.z};}});const stop=()=>{dragging=false;mouseTarget=null;};canvas.addEventListener('pointerup',stop);canvas.addEventListener('pointercancel',stop);}
const joystick=$('joystick');
function moveStick(e){const b=joystick.getBoundingClientRect(),dx=e.clientX-(b.left+b.width/2),dy=e.clientY-(b.top+b.height/2),d=Math.hypot(dx,dy),scale=d>39?39/d:1;stick.x=dx*scale/39;stick.z=dy*scale/39;$('joystick-knob').style.transform=`translate(${dx*scale}px,${dy*scale}px)`;}
joystick.addEventListener('pointerdown',e=>{if(game.status!=='playing')return;stickId=e.pointerId;joystick.setPointerCapture(e.pointerId);moveStick(e);});joystick.addEventListener('pointermove',e=>{if(e.pointerId===stickId)moveStick(e);});const releaseStick=()=>{stickId=null;stick.x=stick.z=0;$('joystick-knob').style.transform='';};joystick.addEventListener('pointerup',releaseStick);joystick.addEventListener('pointercancel',releaseStick);
// Read-only snapshot for diagnosing player reports without exposing game controls.
window.symphonySnapshot=()=>({status:game.status,mass:Math.round(game.player.mass),stage:game.stage,health:game.health,time:Math.round(game.time),traits:[...game.traits],eaten:game.eaten,food:game.food.length,creatures:game.creatures.length,audio:music.ctx?.state||'not-started'});
