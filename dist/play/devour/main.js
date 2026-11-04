import {Game,STAGES,TRAITS,BIOMES,EVOLUTIONS} from './game.js';
import {Music} from './audio.js';
import {Ocean} from './scene.js';
import {FORMS,BADGES,normalizeArchive,recordRun,dailyBest} from './progression.js';
import {SPECIES,SYNERGIES,activeSynergies} from './ecology.js';
import {MORPHS} from './morphology.js';
import {CHAPTERS,STRUCTURE_TYPES} from './world.js';
import {BOSSES} from './bosses.js';
import {dailyChallenge} from './random.js';
import {CheckpointStore,encodeRun,decodeRun} from './checkpoint.js';
import {runOptions,replayOptions} from './run-options.js';
import {SPECIALIZATIONS} from './evolution.js';
import {dailyRule} from './daily-rules.js';
import {energyTarget,beatPhase} from './rhythm.js';

const $=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names={expedition:'三海远征',free:'自由探索',daily:'每日挑战'},difficulties={relaxed:'轻松',normal:'标准',master:'大师'};
let archive=normalizeArchive();try{archive=normalizeArchive(JSON.parse(localStorage.getItem('symphony-archive')||'{}'));}catch{}
const storage={getItem:k=>localStorage.getItem(k),setItem:(k,v)=>localStorage.setItem(k,v),removeItem:k=>localStorage.removeItem(k)};
const checkpoints=new CheckpointStore(storage);
let pending=checkpoints.load(),game=new Game(),ocean,previous=performance.now(),elapsed=0,lastUI=0,lastCheckpoint=0,starting=false,focusReturn=null,dialogEsc=null,toastTimer,unlockTimer;
let keys=new Set(),mouseTarget=null,dragging=false,stick={x:0,z:0},stickId=null,runUnlocks=[];
const fmtTime=t=>`${Math.floor(t/60).toString().padStart(2,'0')}:${Math.floor(t%60).toString().padStart(2,'0')}`;
const music=new Music(step=>{[...$('beat-strip').children].forEach((b,i)=>b.classList.toggle('on',i===step));if(ocean)ocean.beat.value=step%4===0?1:.35;document.querySelectorAll('.equalizer i').forEach((e,i)=>e.style.height=(5+(step*7+i*11)%23)+'px');});
music.volume=archive.volume;
function saveArchive(){try{localStorage.setItem('symphony-archive',JSON.stringify(archive));}catch{toast('浏览器存储暂不可用，本次仍可游玩');}}
function toast(text){$('toast').textContent=text;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2800);}
function announce(items){if(!items.length)return;runUnlocks.push(...items);$('unlock-notice').innerHTML='<small>NEW DISCOVERY / 新的生命回响</small>'+items.map(i=>esc(i.name)).join(' · ');$('unlock-notice').classList.add('visible');clearTimeout(unlockTimer);unlockTimer=setTimeout(()=>$('unlock-notice').classList.remove('visible'),5000);}
function record(){announce(recordRun(archive,game));saveArchive();}
function checkpoint(){if(game.status==='home')return;record();if(!checkpoints.save(game)&&!checkpoints.available)toast('自动保存不可用，请保留当前页面');}
function releaseInput(){keys.clear();dragging=false;mouseTarget=null;stickId=null;stick.x=stick.z=0;$('joystick-knob').style.transform='';}
function showDialog(html,onEscape=null,ending=false){
  focusReturn=document.activeElement;dialogEsc=onEscape;releaseInput();music.pause();$('dialog').innerHTML=html;$('dialog').scrollTop=0;$('overlay').classList.remove('hidden');$('overlay').classList.toggle('ending',ending);
  for(const id of ['home','hud','specimen'])$(id).inert=true;
  requestAnimationFrame(()=>$('dialog').querySelector('button:not(:disabled),input')?.focus());
}
function closeDialog(){for(const id of ['home','hud','specimen'])$(id).inert=false;$('overlay').classList.add('hidden');$('overlay').classList.remove('ending');dialogEsc=null;focusReturn?.focus();if(game.status==='playing')music.start(game.beatPosition);}
function returnTo(status){if(status==='paused'){game.status='playing';pause();}else{game.status=status;closeDialog();}}
function selectedBiome(){return archive.mode==='expedition'?'lagoon':archive.mode==='daily'?dailyChallenge().biome:archive.biome;}
function refreshHome(){
  pending=checkpoints.load();const mode=archive.mode,biome=selectedBiome(),daily=dailyChallenge();
  document.querySelectorAll('[data-mode]').forEach(b=>{const yes=b.dataset.mode===mode;b.classList.toggle('selected',yes);b.setAttribute('aria-pressed',String(yes));});
  document.querySelectorAll('[data-biome]').forEach((b,i)=>{const yes=b.dataset.biome===biome;b.classList.toggle('selected',yes);b.setAttribute('aria-pressed',String(yes));b.disabled=mode!=='free';b.querySelector('small').textContent=mode==='expedition'?['第一乐章','第二乐章','第三乐章'][i]:BIOMES[i].tag;});
  $('start-btn').innerHTML=(pending?'继续上次旅程':mode==='expedition'?'开启三海远征':mode==='daily'?'挑战今日潮汐':'潜入'+BIOMES.find(b=>b.id===biome).name)+' <span>↗</span>';
  $('new-run-btn').classList.toggle('hidden',!pending);$('new-run-btn').textContent='新开'+names[mode]+' ↗';$('home-guide').classList.toggle('hidden',!!pending);
  $('resume-meta').textContent=pending?`${names[pending.game.mode]} · ${pending.game.biome.name} · ${fmtTime(pending.game.time)}${pending.recovered?' · 已恢复备用存档':''}`:mode==='daily'?`${daily.key} · ${dailyRule(daily.rule).name} · 本机最佳 ${dailyBest(archive,daily.key,daily.rule)}`:mode==='expedition'?'保留进化跨越三海，直至生命之心。':'选择海域，自由成长并挑战守护者。';
  $('daily-note').classList.toggle('hidden',mode!=='daily');$('daily-note').textContent='今日规则 · '+dailyRule(daily.rule).desc;
  $('difficulty-btn').textContent='◉ '+(mode==='daily'?'每日固定标准':difficulties[archive.difficulty]+'难度');
  const form=FORMS.find(f=>f.id===archive.form&&f.unlock(archive))||FORMS[0];$('record').textContent=archive.runs?`已探索 ${archive.runs} 次 · 完成远征 ${archive.expeditions} 次 · ${form.name}`:'每一次进化，都留下新的回响。';
  $('location').textContent=BIOMES.find(b=>b.id===biome).en;$('seed-label').textContent='生命，从一个音符开始';updateChapters();
}
function home(){
  if(game.status!=='home')checkpoint();music.pause();game.reset(selectedBiome());releaseInput();document.body.classList.remove('playing');$('home').classList.remove('hidden');$('specimen').classList.remove('hidden');$('hud').classList.add('hidden');closeDialog();$('pause-btn').textContent='Ⅱ';$('track-name').firstChild.textContent=STAGES[0].track;$('music-status').textContent='点击开始，唤醒声音';refreshHome();
}
async function activateAudio(){try{await music.init();}catch{toast('声音未能启动，可点击右上角音符重试');}music.stage=game.stage;music.setBiome(game.biome);music.voices=new Set(game.synergies().map(s=>s.id));}
function mount(){releaseInput();lastCheckpoint=game.time;document.body.classList.add('playing');$('home').classList.add('hidden');$('specimen').classList.add('hidden');$('hud').classList.remove('hidden');closeDialog();$('pause-btn').textContent='Ⅱ';updateUI();}
async function startNew(selection=archive){
  if(!ocean||starting)return;starting=true;music.pause();checkpoints.clear();runUnlocks=[];const options=runOptions(selection?.mode?selection:archive),mode=options.mode,seed=options.seed||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
  archive.mode=mode;archive.biome=options.biome;if(mode!=='daily')archive.difficulty=options.difficulty;saveArchive();
  game.reset(options.biome,{...options,seed});game.runId=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);
  const form=mode==='daily'?FORMS[0]:FORMS.find(f=>f.id===archive.form&&f.unlock(archive))||FORMS[0];if(form.trait)game.traits.push(form.trait);if(form.trait==='shell'){game.maxHealth++;game.health=game.maxHealth;}
  game.status='briefing';mount();await activateAudio();starting=false;
  if(mode==='expedition')briefing();else{game.start();music.start(game.beatPosition);toast(mode==='daily'?game.rule().name+' · '+game.rule().desc:game.biome.desc);checkpoint();}
}
async function restore(){
  if(starting)return;const saved=checkpoints.load();if(!saved)return startNew();starting=true;game=saved.game;runUnlocks=[];const status=game.status;game.status='paused';mount();await activateAudio();starting=false;
  if(status==='evolution'){game.status=status;evolution();}else if(status==='interlude'){game.status=status;interlude();}else if(status==='victory'){game.status=status;end(true);}else resume();
  if(saved.recovered)toast('已从备用存档恢复旅程');
}
function briefing(){game.status='briefing';const c=CHAPTERS[game.chapter];showDialog(`<div class="eyebrow">${game.biome.en}</div><h2 id="dialog-title">${c.title}</h2><p>${c.intro}</p><div class="journey-cards">${CHAPTERS.map((x,i)=>`<div class="${i===game.chapter?'active':''}"><b>0${i+1}</b><span>${BIOMES[i].name}</span><small>${x.boss}</small></div>`).join('')}</div><p>移动寻找青绿食物。空格冲刺，进化后按 E 释放技能。<br>达到 100 μ 后寻找雷达上的 ◇ 回声核。</p><button class="primary" id="briefing-go">开始潜游 ↗</button>`);$('briefing-go').onclick=()=>{game.start();closeDialog();checkpoint();};checkpoint();}
function interlude(){
  const next=CHAPTERS[game.chapter+1];showDialog(`<div class="eyebrow">CHAPTER COMPLETE / 乐章完成</div><h2 id="dialog-title">${game.biome.name}，已记住你的声音。</h2><p>击败 ${BOSSES[game.biome.id].name} · 当前质量 ${Math.round(game.player.mass)} μ<br>下一海域保留体型与进化，修复全部护膜，再获得一次能力或分支专精选择。</p><div class="chapter-note"><b>${next.title}</b><p>${next.intro}</p></div><div class="dialog-actions"><button class="primary" id="chapter-go">进入${BIOMES[game.chapter+1].name} ↗</button><button class="text-btn" id="chapter-save">保存并回到起点</button></div>`);$('chapter-go').onclick=()=>{closeDialog();game.nextChapter();checkpoint();};$('chapter-save').onclick=home;checkpoint();
}
function pause(){if(game.status==='paused')return resume();if(game.status!=='playing')return;game.status='paused';$('pause-btn').textContent='▷';showDialog(`<div class="eyebrow">TAKE A BREATH</div><h2 id="dialog-title">让生命，慢下来。</h2><p>${names[game.mode]} · ${game.biome.name} · ${fmtTime(game.time)}<br>当前旅程会自动保存，可以下次继续。</p><div class="dialog-actions"><button class="primary" id="resume">继续探索 ↗</button><button class="text-btn" id="pause-settings">设置</button><button class="text-btn" id="quit">保存并返回</button></div>`,resume);$('resume').onclick=resume;$('quit').onclick=home;$('pause-settings').onclick=settings;checkpoint();}
function resume(){game.status='playing';$('pause-btn').textContent='Ⅱ';releaseInput();previous=performance.now();closeDialog();checkpoint();}
function evolution(){
  game.status='evolution';music.flourish();showDialog(`<div class="eyebrow">EVOLUTION / 新的生命可能</div><h2 id="dialog-title">${game.evoCount>=3?'让进化，走向自己的分支。':'选择你的进化。'}</h2><p>${game.evoCount>=3?'新旅程最多保有 4 种基础能力，旧版已获得能力保留。同一能力的两种专精只能选其一。':'选择会改变形态、操作和声音，并修复一层护膜。'}</p><div class="evolution-cards">${game.choices.map(t=>{const recipes=t.trait?[]:activeSynergies([...game.traits,t.id]).filter(s=>!game.hasSynergy(s.id));return`<button class="evo-card ${t.trait?'specialization':''}" data-trait="${t.id}"><span class="evo-icon">${t.icon}</span><b>${t.name}</b>${t.trait?`<em>${TRAITS.find(x=>x.id===t.trait).name} · 分支专精</em>`:''}<p>${t.desc}</p><small>${t.hint} ↗</small>${recipes.length?`<div class="recipe-preview">${recipes.map(s=>`<b>${s.icon} 激活 ${s.name}</b><span>${s.desc}</span>`).join('')}</div>`:''}</button>`;}).join('')}</div>`);
  $('dialog').querySelectorAll('[data-trait]').forEach(b=>b.onclick=()=>{if(game.evolve(b.dataset.trait)){closeDialog();music.flourish();ocean.ripple(game.player.x,game.player.z,game.player.radius);toast('生命分支 · '+EVOLUTIONS.find(t=>t.id===b.dataset.trait).name);checkpoint();}});checkpoint();
}
function end(won){
  record();if(['dead','complete','timeup'].includes(game.status))checkpoints.clear();else checkpoints.save(game);const complete=game.status==='complete',daily=game.mode==='daily',title=complete?'从一个音符，到一整个宇宙。':daily?'今日潮汐，留下你的回响。':won?'你，奏响了整片海。':'生命的回响，不会消失。';if(complete)music.ending();else music.flourish();
  showDialog(`<div class="eyebrow">${complete?'SYMPHONY OF LIFE / 三海远征完成':game.biome.en}</div><h2 id="dialog-title">${title}</h2>${complete?'<div class="ending-symbol">✦</div><p>从微小细胞到风暴中的巨兽，<br>你吞下恐惧，也唤醒了沉睡的声音。<br>三海的回响，终于成为同一首歌。</p>':''}<div class="result-stats"><div><strong>${Math.round(game.peakMass)} μ</strong><small>最高质量</small></div><div><strong>${fmtTime(game.time)}</strong><small>探索时间</small></div><div><strong>${game.score()}</strong><small>生命评分</small></div></div><p>吞噬 ${game.eaten} 次 · 最高连击 ×${game.bestCombo} · 完成 ${game.completedChallenges} 个愿望</p>${game.campaignHistory.length?`<div class="chapter-results">${game.campaignHistory.map(h=>`<span>✓ ${BIOMES.find(b=>b.id===h.biome).name} · ${fmtTime(h.time)}</span>`).join('')}</div>`:''}${runUnlocks.length?`<p class="unlock-summary">新回响：${[...new Set(runUnlocks.map(u=>esc(u.name)))].join(' · ')}</p>`:''}${complete?'<p>大师难度已解锁。尝试另一种分支专精，再谱写一次生命。<br><small>画面、模型与音乐均实时生成 · 谢谢你的演奏</small></p>':''}${daily?`<p>${esc(game.dailyKey)} · ${game.rule().name}<br>同规则本机最佳 ${dailyBest(archive,game.dailyKey,game.dailyRule)||game.score()} 分</p>`:''}<p class="build-summary">踩拍 ${game.rhythmHits} 次 · ${game.specializations.length?'本局专精：'+game.specializations.map(id=>SPECIALIZATIONS.find(s=>s.id===id).name).join('、'):'三海远征可选择分支专精'}</p><div class="dialog-actions"><button class="primary" id="replay">${complete?'再启远征':'再进化一次'} ↗</button>${game.mode==='free'&&won?'<button class="text-btn" id="continue">无尽挑战 ↗</button>':''}<button class="text-btn" id="end-home">回到起点</button></div>`,null,complete);
  $('replay').onclick=()=>startNew(replayOptions(game));$('end-home').onclick=()=>{if(['dead','complete','timeup'].includes(game.status))game.status='home';home();};if($('continue'))$('continue').onclick=()=>{game.continueEndless();closeDialog();checkpoint();toast('无尽挑战 · 每轮霸主与食物链继续增强');};
}
function guide(){
  if(!['home','playing','paused'].includes(game.status))return;const back=game.status;if(back==='playing')game.status='guide';
  showDialog(`<div class="eyebrow">FOLLOW THE SOUND</div><h2 id="dialog-title">跟随本能，自由生长。</h2><div class="guide-grid"><div><b>01 / 开始捕食</b><p>WASD、方向键或按住场景拖动；手机用摇杆。青绿可吞噬，蓝色需成长或破甲，珊瑚红要躲避。</p></div><div><b>02 / 规划进化</b><p>空格冲刺，E 放技能。32、100、280 μ 选择进化。巨口＋鳍翼能越级捕食；电流＋触须会连锁麻痹。</p></div><div><b>03 / 读懂生命</b><p>猎手蓄力时侧移，水母等脉冲散去，晶壳绕后或冲刺破甲。长大后捕食生物、珊瑚和沉船，微光的营养会逐渐降低。</p></div><div><b>04 / 三海远征</b><p>达到 100 μ 后收集三枚 ◇ 回声核。击败每海独立的霸主，保留进化继续远征，最终吞噬浮岛、风暴与生命之心。</p></div></div><p>底部光环亮起时吞噬可获得少量额外营养，每拍最多一次；连续踩拍触发八秒共鸣，技能恢复加快。<br>跨海可选择互斥专精，新旅程最多 4 种基础能力。每日挑战固定种子、标准起点与当日规则，五分钟结算。<br>Esc / P 暂停 · M 切换声音 · 暂停或离开时自动保存</p><button class="primary" id="guide-close">明白了 ↗</button>`,()=>returnTo(back));$('guide-close').onclick=()=>returnTo(back);
}
function settings(){
  if(!['home','playing','paused'].includes(game.status))return;const back=game.status;if(back==='playing')game.status='settings';
  showDialog(`<div class="eyebrow">MAKE THE OCEAN YOUR OWN</div><h2 id="dialog-title">调到舒服的频率。</h2><div class="settings-grid"><label for="volume">总音量 <span id="volume-value">${Math.round(archive.volume*100)}%</span><input id="volume" type="range" min="0" max="100" value="${Math.round(archive.volume*100)}"></label><div><label>画面质量</label><div class="settings-quality"><button data-quality="high" aria-pressed="${archive.quality==='high'}">精致 · 更多微光</button><button data-quality="low" aria-pressed="${archive.quality==='low'}">流畅 · 节省性能</button></div></div><small>流畅模式降低像素开销和环境微光数量。声音与画质偏好会保存。</small></div><button class="primary" id="settings-close">调整好了 ↗</button>`,()=>returnTo(back));
  $('volume').oninput=e=>{archive.volume=Number(e.target.value)/100;music.setVolume(archive.volume);$('volume-value').textContent=e.target.value+'%';saveArchive();};$('dialog').querySelectorAll('[data-quality]').forEach(b=>{b.classList.toggle('selected',b.dataset.quality===archive.quality);b.onclick=()=>{archive.quality=b.dataset.quality;ocean.setQuality(archive.quality);$('dialog').querySelectorAll('[data-quality]').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',String(x===b));});saveArchive();};});$('settings-close').onclick=()=>returnTo(back);
  const backup=document.createElement('div');backup.className='save-tools';backup.innerHTML='<label>旅程备份</label><div class="settings-quality"><button id="export-run">导出旅程</button><button id="import-run">导入旅程</button></div><small>导出当前断点；导入后可在其他浏览器继续。生命档案保留在本机。</small><input id="run-file" type="file" accept=".json,application/json" hidden>';$('dialog').querySelector('.settings-grid').append(backup);
  const exportable=()=>game.status==='home'?checkpoints.load()?.game:game;$('export-run').disabled=!encodeRun(exportable()||game);
  $('export-run').onclick=()=>{const text=encodeRun(exportable()||game);if(!text)return;const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='吞噬交响曲-旅程.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('旅程已导出');};
  $('import-run').onclick=()=>$('run-file').click();$('run-file').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>700000){toast('旅程文件过大，请选择有效备份');return;}const imported=decodeRun(await file.text());if(!imported){toast('旅程文件无效或已损坏，当前进度已保留');return;}showDialog(`<div class="eyebrow">CONTINUE YOUR SYMPHONY</div><h2 id="dialog-title">接续这段生命。</h2><p>${names[imported.game.mode]} · ${imported.game.biome.name}<br>${Math.round(imported.game.player.mass)} μ · ${fmtTime(imported.game.time)}<br>导入会替换当前旅程断点，已有生命档案保留。</p><div class="dialog-actions"><button class="primary" id="import-confirm">导入并继续 ↗</button><button class="text-btn" id="import-cancel">取消</button></div>`,()=>returnTo(back));$('import-cancel').onclick=()=>returnTo(back);$('import-confirm').onclick=()=>{if(!checkpoints.save(imported.game)){toast('存储不可用，未替换当前旅程');return;}restore();};};
}
function difficulty(){if(game.status!=='home'||archive.mode==='daily')return;showDialog(`<div class="eyebrow">CHOOSE YOUR RHYTHM</div><h2 id="dialog-title">选择自己的节奏。</h2><div class="difficulty-cards">${Object.entries(difficulties).map(([id,name])=>`<button data-difficulty="${id}" ${id==='master'&&archive.expeditions===0?'disabled':''}><b>${name}</b><p>${id==='relaxed'?'五层初始护膜，更适合探索和欣赏音乐。':id==='normal'?'三层初始护膜，观察预警，规划进化。':archive.expeditions?'更快的天敌与霸主，为新构筑准备的考验。':'完成一次三海远征后解锁。'}</p></button>`).join('')}</div><button class="text-btn" id="difficulty-close">返回</button>`,closeDialog);$('dialog').querySelectorAll('[data-difficulty]').forEach(b=>b.onclick=()=>{archive.difficulty=b.dataset.difficulty;saveArchive();closeDialog();refreshHome();});$('difficulty-close').onclick=closeDialog;}
function showArchive(){
  const forms=FORMS.map(f=>`<button class="archive-card ${archive.form===f.id?'selected':''} ${f.unlock(archive)?'':'locked'}" data-form="${f.id}" ${f.unlock(archive)?'':'disabled'}><span class="evo-icon">${f.icon}</span><b>${f.name}</b><p>${f.desc}</p><small>${f.unlock(archive)?archive.form===f.id?'✓ 下局使用':'点击选择':'待解锁 · '+f.condition}</small></button>`).join('');
  showDialog(`<div class="eyebrow">THE LIVING ARCHIVE</div><h2 id="dialog-title">每一次生命，都留下回响。</h2><p>探索 ${archive.runs} 次 · 完成远征 ${archive.expeditions} 次 · 最高 ${Math.round(archive.best)} μ · 最佳连击 ×${archive.bestCombo}</p><div class="archive-grid">${forms}</div><h3 class="archive-section-title">三海航迹</h3><div class="biome-records">${BIOMES.map(b=>`<div>${b.name}<small>征服 ${archive.biomes[b.id].wins} 次<br>最高 ${Math.round(archive.biomes[b.id].best)} μ</small></div>`).join('')}</div><h3 class="archive-section-title">生命徽章 ${BADGES.filter(b=>b.unlock(archive)).length} / ${BADGES.length}</h3><div class="badge-grid">${BADGES.map(b=>`<div class="badge ${b.unlock(archive)?'':'locked'}"><span>${b.icon}</span><b>${b.name}</b><small>${b.desc}</small></div>`).join('')}</div><h3 class="archive-section-title">进化组合 ${archive.synergies.length} / ${SYNERGIES.length}</h3><div class="recipe-grid">${SYNERGIES.map(s=>`<div class="recipe ${archive.synergies.includes(s.id)?'discovered':''}"><b>${s.icon} ${s.name} ${archive.synergies.includes(s.id)?'✓':''}</b><small>${s.traits.map(id=>TRAITS.find(t=>t.id===id).name).join(' ＋ ')}</small><p>${s.desc}</p></div>`).join('')}</div><h3 class="archive-section-title">分支专精 ${archive.specializations.length} / ${SPECIALIZATIONS.length}</h3><div class="recipe-grid">${SPECIALIZATIONS.map(s=>`<div class="recipe ${archive.specializations.includes(s.id)?'discovered':''}"><b>✧ ${s.name} ${archive.specializations.includes(s.id)?'✓':''}</b><small>${TRAITS.find(t=>t.id===s.trait).name} · 同族分支互斥</small><p>${s.desc}</p></div>`).join('')}</div><h3 class="archive-section-title">生物图鉴 ${archive.species.length} / 5</h3><div class="species-grid">${SPECIES.map(s=>`<div class="species ${archive.species.includes(s.id)?'discovered':''}"><b>${s.icon} ${s.name}</b><p>${s.detail}</p><small>${archive.species.includes(s.id)?'✓ 已捕食':'等待发现'}</small></div>`).join('')}</div><h3 class="archive-section-title">巨物图鉴 ${archive.structures.length} / 4</h3><div class="biome-records">${['reef','wreck','island','storm'].map(t=>`<div>${STRUCTURE_TYPES[t].icon} ${STRUCTURE_TYPES[t].name}<small>${archive.structures.includes(t)?'✓ 已吞噬':'成长后寻找'}</small></div>`).join('')}</div><p>档案与断点存档保存在当前浏览器。</p><button class="primary" id="archive-close">回到生命之海 ↗</button>`,closeDialog);
  $('dialog').querySelectorAll('[data-form]').forEach(b=>b.onclick=()=>{archive.form=b.dataset.form;saveArchive();showArchive();});$('archive-close').onclick=()=>{closeDialog();refreshHome();};
}
function updateChapters(){const stage=game.status==='home'?(ocean?.previewStage||0):game.stage;document.querySelectorAll('.chapter').forEach((e,i)=>{e.classList.toggle('active',i===stage);e.classList.toggle('done',i<stage);e.querySelector('span').firstChild.textContent=STAGES[i].name;});}
function target(){
  const p=game.player,near=items=>items.sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];
  if(game.mode==='expedition'&&game.bossDefeated&&game.chapter===2)return game.structures.find(s=>s.type==='heart');
  if(game.mode==='expedition'&&game.echoes<3&&game.stage>=2)return near(game.structures.filter(s=>s.type==='echo'));
  const boss=game.creatures.find(c=>c.boss);if(boss&&p.mass>=game.goalMass)return boss;
  if(game.stage>=3)return near(game.structures.filter(s=>game.canAbsorb(s)&&s.type!=='echo'));
  return null;
}
function updateUI(){
  const p=game.player,next=STAGES[game.stage+1],goal=game.mode==='expedition'&&game.chapter===2&&game.bossDefeated?3600:game.goalMass,start=game.stage<4?STAGES[game.stage].mass:game.chapter?CHAPTERS[game.chapter-1].goal:700,finish=next?.mass||goal;
  $('stage-title').textContent=STAGES[game.stage].name;$('mass').textContent=Math.round(p.mass)+' μ';$('growth-fill').style.width=Math.max(0,Math.min(100,(p.mass-start)/Math.max(1,finish-start)*100))+'%';$('next-stage').textContent=next?`下一形态 · ${next.mass} μ`:`目标质量 · ${goal} μ`;
  $('health').textContent='● '.repeat(Math.max(0,game.health))+'○ '.repeat(Math.max(0,game.maxHealth-game.health));$('health').setAttribute('aria-label',`护膜 ${game.health} / ${game.maxHealth}`);
  $('time').textContent=fmtTime(game.mode==='daily'?Math.max(0,300-game.time):game.time);$('time').nextElementSibling.textContent=game.mode==='daily'?'剩余时间':'存活时间';$('combo').textContent='×'+Math.max(1,game.combo);$('combo-label').textContent=game.mode==='daily'?`评分 ${game.score()}`:'吞噬连击';
  $('location').textContent=game.biome.en;$('seed-label').textContent=game.mode==='expedition'?CHAPTERS[game.chapter].title:names[game.mode];$('mode-title').textContent=names[game.mode];$('chapter-title').textContent=game.mode==='expedition'?`${game.chapter+1} / 3 · ${game.biome.name}`:game.mode==='daily'?'剩余时间 · '+game.dailyKey:game.endless?'无尽第 '+game.endlessWave+' 轮':game.biome.name;
  $('journey-progress').innerHTML=game.mode==='expedition'?CHAPTERS.map((c,i)=>`<i class="${i<game.campaignHistory.length?'done':i===game.chapter?'active':''}"></i>`).join(''):'';
  $('track-name').firstChild.textContent=STAGES[game.stage].track;$('music-status').textContent=music.muted?'声音已关闭':`${game.biome.bpm} BPM · ${game.stage+1} / 5 声部`;
  $('traits').innerHTML=game.traits.map(id=>`<span>${TRAITS.find(t=>t.id===id).name}</span>`).join('');const combinations=game.synergies(),branches=game.specializations.map(id=>SPECIALIZATIONS.find(s=>s.id===id));music.voices=new Set(combinations.map(s=>s.id));music.crescendo=game.crescendoTime>0;$('synergy-panel').classList.toggle('hidden',!combinations.length&&!branches.length);$('synergy-list').innerHTML=[...combinations.map(s=>`<div title="${s.desc}">${s.icon} ${s.name}</div>`),...branches.map(s=>`<div class="branch-tag" title="${s.desc}">✧ ${s.name}</div>`)].join('');
  document.body.classList.toggle('crescendo',game.crescendoTime>0);$('rhythm-text').textContent=game.crescendoTime>0?'共鸣高潮 · '+game.crescendoTime.toFixed(0)+'s':'踩拍共鸣 · '+game.rhythmEnergy+' / '+energyTarget(game);$('rhythm-fill').style.width=(game.crescendoTime>0?100:game.rhythmEnergy/energyTarget(game)*100)+'%';$('pulse-orb').classList.toggle('on',beatPhase(game)<.15||beatPhase(game)>.86);
  const encounter=game.creatures.filter(c=>!c.boss&&c.kind!==0&&Math.hypot(c.x-p.x,c.z-p.z)<p.radius+c.radius+13).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];$('encounter-tip').classList.toggle('hidden',!encounter);if(encounter){$('encounter-name').textContent=SPECIES[encounter.kind].icon+' '+SPECIES[encounter.kind].name;$('encounter-desc').textContent=SPECIES[encounter.kind].tip;}
  if(game.mode==='daily'){$('mission-text').textContent=game.rule().name+` · ${game.score()} 分`;$('mission-sub').textContent=game.rule().desc;}
  else if(game.mode==='expedition'&&game.chapter===2&&game.bossDefeated){$('mission-text').textContent='吞噬生命之心，完成三海交响';$('mission-sub').textContent='✦ 生命之心位于海域中央';}
  else if(game.mode==='expedition'&&game.stage>=2&&game.echoes<3){$('mission-text').textContent=`收集回声核 · ${game.echoes} / 3`;$('mission-sub').textContent='◇ 跟随指引，唤醒本海域的霸主';}
  else{$('mission-text').textContent=p.mass<goal?`继续捕食，成长至 ${next?.mass||goal} μ`:'抓住霸主破绽，吞噬奏响终章';$('mission-sub').textContent=game.stage>=3?'吞噬珊瑚、沉船与更大的生命':game.stage?'微光营养降低 · 捕食生物成长更快':'青绿可吞噬 · 蓝色需观察 · 珊瑚红需躲避';}
  const q=game.challenge;$('challenge-name').textContent=q.name;$('challenge-count').textContent=`${q.progress} / ${q.target}`;$('challenge-desc').textContent=q.desc;$('challenge-fill').style.width=q.progress/q.target*100+'%';$('challenge-reward').textContent=q.done?'✓ 愿望达成 · 护膜修复与营养雨':'完成奖励 · 修复护膜 + 营养雨';$('challenge').classList.toggle('completed',q.done);$('danger').classList.toggle('hidden',!game.danger);
  const boss=game.creatures.find(c=>c.boss),near=boss&&Math.hypot(boss.x-p.x,boss.z-p.z)<100;music.boss=!!near;$('boss-status').className='boss-status'+(near?' '+boss.state:' hidden');if(near){$('boss-status').querySelector('span').textContent='♛ '+BOSSES[boss.variant||'lagoon'].name;const open=game.canEat(boss);$('boss-state').textContent=open?'护壳破绽 · 可以吞噬':boss.state==='warning'?'正在蓄力！':boss.state==='charge'?'攻击！冲刺躲避':boss.state==='exposed'?'护壳打开 · 还需成长':'护壳闭合';$('boss-tip').textContent=open?'靠近，完成最后一次吞噬':BOSSES[boss.variant||'lagoon'].tip;if(open)$('boss-status').className='boss-status exposed';}
  $('dash-fill').style.height=game.dashCd/game.dashCooldown()*100+'%';$('dash-label').textContent=game.dashCd>0?game.dashCd.toFixed(1)+'s':'SPACE';const active=game.traits.includes('electric')||game.traits.includes('magnet');$('ability-btn').classList.toggle('hidden',!active);$('ability-name').textContent=game.traits.includes('electric')?'电流脉冲':'引力场';$('ability-label').textContent=game.abilityCd>0?game.abilityCd.toFixed(1)+'s':'E';$('ability-fill').style.height=game.abilityCd/game.abilityCooldown()*100+'%';
  const dest=target();$('target-guide').classList.toggle('hidden',!dest);if(dest){const dx=dest.x-p.x,dz=dest.z-p.z;$('target-arrow').style.transform=`rotate(${Math.atan2(dz,dx)*180/Math.PI}deg)`;$('target-name').textContent=(dest.boss?BOSSES[dest.variant].name:STRUCTURE_TYPES[dest.type].name)+' · '+Math.round(Math.hypot(dx,dz))+' m';}
  updateChapters();drawRadar();
}
const radar=$('minimap').getContext('2d');
function drawRadar(){const c=radar,p=game.player,scale=1/(1+p.radius/25);c.clearRect(0,0,160,160);c.strokeStyle='#a1dbbc28';for(const r of [28,53,75]){c.beginPath();c.arc(80,80,r,0,7);c.stroke();}for(const s of game.structures){let x=(s.x-p.x)*scale,z=(s.z-p.z)*scale,d=Math.hypot(x,z);if(d>72){if(!['echo','heart'].includes(s.type))continue;x*=72/d;z*=72/d;}c.fillStyle=['echo','heart'].includes(s.type)?s.type==='heart'?'#ffe2a0':'#d4fff2':game.canAbsorb(s)?'#8ed2aa':'#647e8b';c.save();c.translate(80+x,80+z);c.rotate(Math.PI/4);c.fillRect(-2,-2,4,4);c.restore();}for(const q of game.creatures){let x=(q.x-p.x)*scale,z=(q.z-p.z)*scale,d=Math.hypot(x,z);if(d>72){if(!q.boss)continue;x*=72/d;z*=72/d;}c.fillStyle=q.boss?'#ffd49a':game.canEat(q)?'#8ee8b6':game.isDangerous(q)?'#e89b85':'#82aec2';c.beginPath();c.arc(80+x,80+z,q.boss?4:2,0,7);c.fill();}c.fillStyle='#e0ffe8';c.beginPath();c.arc(80,80,3,0,7);c.fill();}
function events(){
  for(const e of game.events.splice(0)){
    if(e.type==='eat'){music.eat(e.kind,e.combo);ocean.burst(e.x,e.z,e.kind===3?0xffd08a:0xa8fbc5,Math.min(16,5+e.amount));}
    else if(e.type==='perfect'){ocean.ripple(game.player.x,game.player.z,game.player.radius,0xffe6a6);}
    else if(e.type==='crescendo'){music.signature('chorus');toast('共鸣高潮 · 八秒协奏，技能恢复加快');}
    else if(e.type==='rare'){ocean.burst(e.x,e.z,0xffe1a0,25);toast('稀有猎物 · 额外营养与评分');}
    else if(e.type==='stage'){music.stage=e.stage;music.flourish();ocean.ripple(game.player.x,game.player.z,game.player.radius);toast('新乐章 · '+STAGES[e.stage].name);checkpoint();}
    else if(e.type==='evolution')evolution();
    else if(e.type==='chapterComplete')interlude();
    else if(e.type==='chapter'){music.setBiome(game.biome);toast(CHAPTERS[game.chapter].title);}
    else if(e.type==='echo'){music.flourish();ocean.ripple(e.x,e.z,3);toast(`回声核已唤醒 · ${e.count} / 3`);checkpoint();}
    else if(e.type==='structure'){ocean.burst(e.x,e.z,STRUCTURE_TYPES[e.structureType]?.color||0xbef3d2,24);toast('吞噬 · '+STRUCTURE_TYPES[e.structureType]?.name);checkpoint();}
    else if(e.type==='finalHeart'){music.flourish();toast('三海归于寂静 · 回到中央，唤醒生命之心');checkpoint();}
    else if(e.type==='boss'){toast(BOSSES[game.biome.id].name+' 已现身');}
    else if(e.type==='bossWarning')toast(BOSSES[game.biome.id].tip);
    else if(e.type==='dailyBoss'){toast('守护者已吞噬 · 额外评分 +1000');checkpoint();}
    else if(e.type==='endlessWave'){toast('无尽挑战 · 第 '+e.wave+' 轮完成');checkpoint();}
    else if(e.type==='dash')ocean.ripple(game.player.x,game.player.z,game.player.radius);
    else if(e.type==='ability'){ocean.ripple(game.player.x,game.player.z,game.player.radius*3,e.electric?0x9bd6ff:0xb0ffd6);music.signature(e.electric?'storm':'chorus');}
    else if(e.type==='damage'){music.hit();ocean.shake=.3;ocean.burst(game.player.x,game.player.z,0xf0a58c,25);toast(e.cause==='jelly'?'水母脉冲！退到光环外':e.cause==='crystal'?'脉冲命中！冲刺离开预警区':'护膜受损 · 冲刺离开天敌');}
    else if(e.type==='challenge'){music.flourish();ocean.ripple(game.player.x,game.player.z,game.player.radius*2);toast('愿望达成 · '+e.name);checkpoint();}
    else if(e.type==='synergy'){music.signature(e.id);toast('生命协奏 · '+e.name);checkpoint();}
    else if(e.type==='hunterWarning')toast('尖喙猎手正在蓄力 · 向侧面游动');
    else if(e.type==='jellyWarning')toast('水母脉冲即将释放 · 拉开距离');
    else if(e.type==='chorus')ocean.ripple(game.player.x,game.player.z,game.player.radius,0xd3f1c0);
    else if(e.type==='reactor')ocean.ripple(game.player.x,game.player.z,game.player.radius*3,0x9bd8ff);
    else if(e.type==='repair')toast('消化完成 · 护膜修复');
    else if(e.type==='end')end(e.won);
  }
}
function input(){let x=0,z=0;if(keys.has('a')||keys.has('arrowleft'))x--;if(keys.has('d')||keys.has('arrowright'))x++;if(keys.has('w')||keys.has('arrowup'))z--;if(keys.has('s')||keys.has('arrowdown'))z++;if(stickId!==null){x=stick.x;z=stick.z;}else if(!x&&!z&&dragging&&mouseTarget){const dx=mouseTarget.x-game.player.x,dz=mouseTarget.z-game.player.z,d=Math.hypot(dx,dz);if(d>.4){x=dx/d*Math.min(1,d/3);z=dz/d*Math.min(1,d/3);}}return{x,z};}
function frame(now){const delta=Math.max(0,(now-previous)/1000),dt=Math.min(delta,.05);previous=now;elapsed+=dt;game.advance(delta,input());if(ocean){events();ocean.update(game,dt,elapsed);}if(now-lastUI>100&&game.status!=='home'){updateUI();lastUI=now;}if(game.status==='playing'&&game.time-lastCheckpoint>3){checkpoint();lastCheckpoint=game.time;}requestAnimationFrame(frame);}
try{
  ocean=new Ocean($('world'));ocean.setQuality(archive.quality);game.reset(selectedBiome());$('loading').classList.add('hidden');
  const canvas=ocean.renderer.domElement;canvas.addEventListener('pointerdown',e=>{if(game.status!=='playing')return;dragging=true;canvas.setPointerCapture(e.pointerId);const p=ocean.pointToWorld(e.clientX,e.clientY);if(p)mouseTarget={x:p.x,z:p.z};});canvas.addEventListener('pointermove',e=>{if(dragging){const p=ocean.pointToWorld(e.clientX,e.clientY);if(p)mouseTarget={x:p.x,z:p.z};}});for(const event of ['pointerup','pointercancel'])canvas.addEventListener(event,()=>{dragging=false;mouseTarget=null;});canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();if(game.status==='playing')pause();toast('图形连接中断，旅程已保存；重新加载可继续');});
}catch(error){$('loading').innerHTML='<span>三维场景未能启动</span><p>请使用支持 WebGL 的浏览器，并开启硬件加速。</p><button class="primary" onclick="location.reload()">重新加载</button>';console.error(error);}
$('start-btn').onclick=()=>pending?restore():startNew();$('new-run-btn').onclick=startNew;$('home-guide').onclick=guide;$('guide-btn').onclick=guide;$('settings-btn').onclick=settings;$('difficulty-btn').onclick=difficulty;$('pause-btn').onclick=pause;$('archive-btn').onclick=showArchive;$('dash-btn').onclick=()=>game.dash();$('ability-btn').onclick=()=>game.ability();
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{if(game.status!=='home')return;archive.mode=b.dataset.mode;saveArchive();game.reset(selectedBiome());refreshHome();});
document.querySelectorAll('[data-biome]').forEach(b=>b.onclick=()=>{if(game.status!=='home'||archive.mode!=='free')return;archive.biome=b.dataset.biome;saveArchive();game.reset(selectedBiome());refreshHome();});
document.querySelectorAll('[data-morph]').forEach(b=>b.onclick=()=>{if(game.status!=='home'||!ocean)return;const stage=Number(b.dataset.morph);ocean.previewStage=stage;$('morph-title').textContent='生命图谱 / '+MORPHS[stage].name;$('morph-hint').textContent=MORPHS[stage].hint;$('morph-mass').textContent=MORPHS[stage].mass+' μ · 点击下方预览进化';document.querySelectorAll('[data-morph]').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',String(x===b));});updateChapters();});
$('sound-btn').onclick=async()=>{try{await music.init();const muted=music.mute();$('sound-btn').textContent=muted?'♪̸':'♫';$('sound-btn').setAttribute('aria-label',muted?'开启声音':'关闭声音');if(game.status==='playing')music.start(game.beatPosition);}catch{toast('声音未能启动，请检查浏览器声音权限');}};
addEventListener('keydown',e=>{
  if(!$('overlay').classList.contains('hidden')){if(e.key==='Tab'){const list=[...$('dialog').querySelectorAll('button:not(:disabled),input')];if(list.length){if(e.shiftKey&&document.activeElement===list[0]){e.preventDefault();list.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===list.at(-1)){e.preventDefault();list[0].focus();}}}if(e.key==='Escape')dialogEsc?.();return;}
  const k=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();if(e.repeat)return;if(k==='escape'||k==='p')pause();else if(k===' ')game.dash();else if(k==='e')game.ability();else if(k==='m')$('sound-btn').click();else keys.add(k);
});addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
addEventListener('blur',()=>{releaseInput();if(game.status==='playing')pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&game.status==='playing')pause();});addEventListener('pagehide',checkpoint);
const joystick=$('joystick');function moveStick(e){const b=joystick.getBoundingClientRect(),dx=e.clientX-(b.left+b.width/2),dy=e.clientY-(b.top+b.height/2),d=Math.hypot(dx,dy),scale=d>39?39/d:1;stick.x=dx*scale/39;stick.z=dy*scale/39;$('joystick-knob').style.transform=`translate(${dx*scale}px,${dy*scale}px)`;}
joystick.addEventListener('pointerdown',e=>{if(game.status!=='playing')return;stickId=e.pointerId;joystick.setPointerCapture(e.pointerId);moveStick(e);});joystick.addEventListener('pointermove',e=>{if(e.pointerId===stickId)moveStick(e);});for(const e of ['pointerup','pointercancel'])joystick.addEventListener(e,()=>{stickId=null;stick.x=stick.z=0;$('joystick-knob').style.transform='';});
refreshHome();requestAnimationFrame(frame);
window.symphonySnapshot=()=>({status:game.status,mode:game.mode,chapter:game.chapter,mass:Math.round(game.player.mass),health:game.health,time:Math.round(game.time),traits:[...game.traits],echoes:game.echoes,structures:game.stats.structures,audio:music.ctx?.state||'not-started'});
