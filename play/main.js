import {Game,STAGES,TRAITS,BIOMES,EVOLUTIONS} from './game.js';
import {Music} from './audio.js';
import {Ocean} from './scene.js';
import {FORMS,BADGES,normalizeArchive,recordRun,dailyBest,autoQuality} from './progression.js';
import {SPECIES,SYNERGIES,activeSynergies} from './ecology.js';
import {MORPHS} from './morphology.js';
import {periodFor,PERIODS,faunaNameFor} from './periods.js';
import {CHAPTERS,STRUCTURE_TYPES} from './world.js';
import {BOSSES} from './bosses.js';
import {dailyChallenge} from './random.js';
import {CheckpointStore,encodeRun,decodeRun} from './checkpoint.js';
import {runOptions,replayOptions} from './run-options.js';
import {SPECIALIZATIONS} from './evolution.js';
import {dailyRule} from './daily-rules.js';
import {energyTarget,beatPhase} from './rhythm.js';
import {measure} from './perf.js';
import {MODE_NAMES,PRIMARY_MODES,MORE_MODES,isMode,modeName} from './modes.js';
import {levelProgress,offlineGain,utc8Key,biomassCap,geneWeeklyCap,epochGoal,biomassToLevel,epochOf} from './growth.js';
import {waveForTime,hordeScore,hordeGrade,applyUpgrade,bestHordeUpgrade,HORDE_DURATION} from './horde.js';
import {LINEAGES,bestEvolution,evolutionNodeInfo,lineageFinalName,lineageOf,lineageStageName} from './lineages.js';

const $=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names={...MODE_NAMES},difficulties={relaxed:'轻松',normal:'标准',master:'大师'};
let archive=normalizeArchive();try{archive=normalizeArchive(JSON.parse(localStorage.getItem('symphony-archive')||'{}'));}catch{}
const storage={getItem:k=>localStorage.getItem(k),setItem:(k,v)=>localStorage.setItem(k,v),removeItem:k=>localStorage.removeItem(k)};
const checkpoints=new CheckpointStore(storage);
let pending=checkpoints.load(),game=new Game(),ocean,previous=performance.now(),elapsed=0,lastUI=0,lastCheckpoint=0,starting=false,focusReturn=null,dialogEsc=null,toastTimer,unlockTimer;
let keys=new Set(),mouseTarget=null,dragging=false,stick={x:0,z:0},stickId=null,runUnlocks=[],viewDrag=null,touchRotate=null;
const VIEW_NAMES={follow:'跟随视角',orbit:'环绕视角',first:'第一视角'};
const urlParams=new URLSearchParams(location.search);
const musicDebug=urlParams.get('debugmusic')==='1';let lastMusicDbg=0;
if(musicDebug){const el=document.getElementById('music-debug');if(el)el.classList.remove('hidden');}
let touchEnabled=false,touchZoomApplied=false;
function applyTouchMode(){
  const pref=archive.touchMode||'auto';
  touchEnabled=urlParams.get('mobile')==='1'||pref==='on'||(pref==='auto'&&(matchMedia('(pointer:coarse)').matches||innerWidth<=760));
  document.documentElement.classList.toggle('touch-mode',touchEnabled);
  document.documentElement.classList.toggle('one-hand',touchEnabled&&archive.oneHand!=='off');
  document.documentElement.classList.toggle('hand-left',archive.oneHand==='left');
  document.documentElement.classList.toggle('hand-right',archive.oneHand==='right');
  ocean?.setMobile(touchEnabled);
  if(touchEnabled&&!touchZoomApplied&&ocean&&!urlParams.has('zoom')){
    ocean.setZoom(.5);ocean.zoom=ocean.zoomTarget;ocean.zoomSnap=true;touchZoomApplied=true;
  }
  if(!touchEnabled)touchZoomApplied=false;
}
function qualityLabel(){
  if((archive.qualityMode||'auto')==='auto')return '自动 · '+(archive.quality==='high'?'极致真实':'流畅');
  return ({low:'流畅',medium:'均衡',high:'极致真实'})[archive.quality]||'自动';
}
function setQualityChoice(choice){
  if(choice==='auto'){archive.qualityMode='auto';archive.quality=autoQuality();}
  else if(['low','medium','high'].includes(choice)){archive.qualityMode='manual';archive.quality=choice;}
  else return;
  autoDegraded=false;
  ocean?.setQuality(archive.quality);
  saveArchive();refreshHome();
  toast('画质 · '+(choice==='auto'?'自动':qualityLabel()));
}
function setView(mode){if(!ocean)return;const next=mode?ocean.setView(mode):ocean.cycleView();if($('view-btn'))$('view-btn').textContent=({follow:'◎',orbit:'◐',first:'◉'})[next];toast('视角 · '+VIEW_NAMES[next]+(next==='follow'?' · 拖动仍可引导移动':' · 拖动旋转视角'));}
const fmtTime=t=>`${Math.floor(t/60).toString().padStart(2,'0')}:${Math.floor(t%60).toString().padStart(2,'0')}`;
const music=new Music(step=>{[...$('beat-strip').children].forEach((b,i)=>b.classList.toggle('on',i===step));if(ocean)ocean.beat.value=step%4===0?1:.35;document.querySelectorAll('.equalizer i').forEach((e,i)=>e.style.height=(5+(step*7+i*11)%23)+'px');});
music.volume=archive.volume;
function saveArchive(){try{localStorage.setItem('symphony-archive',JSON.stringify(archive));}catch{toast('浏览器存储暂不可用，本次仍可游玩');}}
function toast(text,kind=''){
  const rail=$('toast');if(!rail)return;
  const chip=document.createElement('div');chip.className='toast-chip in'+(kind?' '+kind:'');chip.textContent=text;
  rail.prepend(chip);while(rail.children.length>3)rail.lastElementChild.remove();
  const life=kind==='warn'?3800:kind==='lineage'?4200:2800;
  setTimeout(()=>{chip.classList.add('out');setTimeout(()=>chip.remove(),340);},life);
}
function announce(items){if(!items.length)return;runUnlocks.push(...items);$('unlock-notice').innerHTML='<small>NEW DISCOVERY / 新的生命回响</small>'+items.map(i=>esc(i.name)).join(' · ');$('unlock-notice').classList.add('visible');clearTimeout(unlockTimer);unlockTimer=setTimeout(()=>$('unlock-notice').classList.remove('visible'),5000);}
function record(){announce(recordRun(archive,game));saveArchive();}
function checkpoint(){if(game.status==='home')return;record();if(!checkpoints.save(game)&&!checkpoints.available)toast('自动保存不可用，请保留当前页面');}
function releaseInput(){keys.clear();dragging=false;mouseTarget=null;viewDrag=null;touchRotate=null;stickId=null;stick.x=stick.z=0;$('joystick-knob').style.transform='';}
function showDialog(html,onEscape=null,ending=false){
  focusReturn=document.activeElement;dialogEsc=onEscape;releaseInput();music.pause();$('dialog').innerHTML=html;$('dialog').scrollTop=0;$('overlay').classList.remove('hidden');$('overlay').classList.toggle('ending',ending);
  for(const id of ['home','hud','specimen'])$(id).inert=true;
  requestAnimationFrame(()=>$('dialog').querySelector('button:not(:disabled),input')?.focus());
}
function closeDialog(){for(const id of ['home','hud','specimen'])$(id).inert=false;$('overlay').classList.add('hidden');$('overlay').classList.remove('ending');dialogEsc=null;focusReturn?.focus();if(game.status==='playing')music.start(game.beatPosition);}
function returnTo(status){if(status==='paused'){game.status='playing';pause();}else{game.status=status;closeDialog();}}
function selectedBiome(){return (archive.mode==='expedition'||archive.mode==='survival')?'lagoon':archive.mode==='daily'||archive.mode==='horde'?dailyChallenge().biome:archive.biome;}
function refreshHome(){
  pending=checkpoints.load();const mode=archive.mode,biome=selectedBiome(),daily=dailyChallenge();
  // Primary cards: survival / horde; continue card only when a save exists.
  document.querySelectorAll('#mode-picker [data-mode]').forEach(b=>{
    const key=b.dataset.mode==='continue'?'continue':b.dataset.mode;
    const yes=key==='continue'?false:key===mode;
    b.classList.toggle('selected',yes);b.setAttribute('aria-pressed',String(yes));
  });
  const cont=$('continue-card');if(cont)cont.classList.toggle('available',!!pending);
  if($('continue-meta')&&pending)$('continue-meta').textContent=`${names[pending.game.mode]} · ${fmtTime(pending.game.time)}`;
  // Legacy modes inside the folded panel.
  document.querySelectorAll('#legacy-modes [data-mode]').forEach(b=>{const yes=b.dataset.mode===mode;b.classList.toggle('selected',yes);});
  document.querySelectorAll('[data-biome]').forEach((b,i)=>{const yes=b.dataset.biome===biome;b.classList.toggle('selected',yes);b.setAttribute('aria-pressed',String(yes));b.disabled=!(mode==='free'||mode==='survival');b.querySelector('small').textContent=mode==='expedition'?['第一乐章','第二乐章','第三乐章'][i]:BIOMES[i].tag;});
  const startLabel=mode==='survival'?'开始深海长歌':mode==='horde'?'进入潮汐围猎':mode==='expedition'?'开启三海远征':mode==='daily'?'挑战今日潮汐':'潜入'+BIOMES.find(b=>b.id===biome).name;
  $('start-btn').innerHTML=startLabel+' <span>↗</span>';
  $('new-run-btn').classList.toggle('hidden',!pending);$('new-run-btn').textContent='新开'+names[mode]+' ↗';$('home-guide').classList.toggle('hidden',!!pending);
  const lp=levelProgress(archive.biomass||0);
  $('resume-meta').textContent=pending?`${names[pending.game.mode]} · ${pending.game.biome.name} · ${fmtTime(pending.game.time)}${pending.recovered?' · 已恢复备用存档':''}`:mode==='survival'?`生命等级 ${lp.level} · 生物质 ${archive.biomass||0} / 下级 ${lp.need} · 每局上限 ${biomassCap(lp.level)}`:mode==='horde'?`本机最佳 ${archive.hordeBestScore||0} 分 · 最高第 ${archive.hordeBestWave||0} 波 · 4 分钟一局`:mode==='daily'?`${daily.key} · ${dailyRule(daily.rule).name} · 本机最佳 ${dailyBest(archive,daily.key,daily.rule)}`:mode==='expedition'?'保留进化跨越三海，直至生命之心。':'选择海域，自由成长并挑战守护者。';
  $('daily-note').classList.toggle('hidden',mode!=='daily');$('daily-note').textContent='今日规则 · '+dailyRule(daily.rule).desc;
  $('difficulty-btn').textContent='◉ '+(mode==='daily'?'每日固定标准':difficulties[archive.difficulty]+'难度');
  $('quality-btn').textContent='◉ 画质 · '+qualityLabel();
  const form=FORMS.find(f=>f.id===archive.form&&f.unlock(archive))||FORMS[0];
  $('record').textContent=`生命等级 ${lp.level} · 纪元 ${archive.epoch||0}：${epochGoal(archive.epoch||0)} · 探索 ${archive.runs} 次 · ${form.name}`;
  $('location').textContent=BIOMES.find(b=>b.id===biome).en;$('seed-label').textContent='生命，从一个音符开始';updateChapters();
}
function home(){
  if(game.status!=='home')checkpoint();music.pause();game.reset(selectedBiome(),{mode:archive.mode,lifeLevel:archive.lifeLevel||0});releaseInput();document.body.classList.remove('playing');$('home').classList.remove('hidden');$('specimen').classList.remove('hidden');$('hud').classList.add('hidden');closeDialog();$('pause-btn').textContent='Ⅱ';$('track-name').firstChild.textContent=STAGES[0].track;$('music-status').textContent='点击开始，唤醒声音';refreshHome();
}
async function activateAudio(){
  try{await music.init();}catch{toast('声音未能启动，可点击右上角音符重试');return;}
  music.stage=game.stage;music.setBiome(game.biome);music.voices=new Set(game.synergies().map(s=>s.id));
  music.setMusicVolume?.(archive.musicVolume??archive.volume);music.setSfxVolume?.(archive.sfxVolume??.7);music.setUiVolume?.(archive.uiVolume??.5);
  music.cue?.({type:'modeChanged',mode:game.mode});music.setState?.('playing');
  // Licensed CC0 stems are loaded lazily on first gesture; failure keeps the procedural score.
  if(!window.__stemsTried){window.__stemsTried=true;music.loadStems?.().catch(()=>{});}
}
function mount(){game.mobileAssist=touchEnabled;game.assistAim=touchEnabled&&game.mode==='horde';releaseInput();lastCheckpoint=game.time;document.body.classList.add('playing');$('home').classList.add('hidden');$('specimen').classList.add('hidden');$('hud').classList.remove('hidden');closeDialog();$('pause-btn').textContent='Ⅱ';updateUI();}
async function startNew(selection=archive){
  if(!ocean||starting)return;starting=true;music.pause();checkpoints.clear();runUnlocks=[];
  const sel=selection?.mode?selection:archive;
  const options=runOptions({...sel,lifeLevel:sel.mode==='survival'?(archive.lifeLevel||0):sel.lifeLevel},dailyChallenge());
  const mode=options.mode,seed=options.seed||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
  archive.mode=mode;archive.biome=options.biome;if(!['daily','horde'].includes(mode))archive.difficulty=options.difficulty;saveArchive();
  game.reset(options.biome,{...options,seed});game.runId=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);
  const form=['daily','horde','survival'].includes(mode)?FORMS[0]:FORMS.find(f=>f.id===archive.form&&f.unlock(archive))||FORMS[0];if(form.trait)game.traits.push(form.trait);if(form.trait==='shell'){game.maxHealth++;game.health=game.maxHealth;}
  game.status='briefing';mount();await activateAudio();starting=false;
  if(mode==='expedition')briefing();else{game.status='playing';music.start(game.beatPosition);toast(mode==='horde'?'潮汐围猎 · 敌群正在逼近':mode==='daily'?game.rule().name+' · '+game.rule().desc:mode==='survival'?'深海长歌 · 这可能是你玩了数月的旅程':game.biome.desc);checkpoint();}
}
async function restore(){
  if(starting)return;const saved=checkpoints.load();if(!saved)return startNew();starting=true;game=saved.game;runUnlocks=[];const status=game.status;game.status='paused';mount();await activateAudio();starting=false;
  if(status==='evolution'){game.status=status;evolution();}else if(status==='interlude'){game.status=status;interlude();}else if(status==='hordeUpgrade'){game.status=status;hordeUpgrade();}else if(status==='victory'){game.status=status;end(true);}else resume();
  if(saved.recovered)toast('已从备用存档恢复旅程');
}
function briefing(){game.status='briefing';const c=CHAPTERS[game.chapter];showDialog(`<div class="eyebrow">${game.biome.en}</div><h2 id="dialog-title">${c.title}</h2><p>${c.intro}</p><div class="journey-cards">${CHAPTERS.map((x,i)=>`<div class="${i===game.chapter?'active':''}"><b>0${i+1}</b><span>${BIOMES[i].name}</span><small>${x.boss}</small></div>`).join('')}</div><p>移动寻找青绿食物。空格冲刺，进化后按 E 释放技能。<br>达到 100 μ 后寻找雷达上的 ◇ 回声核。</p><button class="primary" id="briefing-go">开始潜游 ↗</button>`);$('briefing-go').onclick=()=>{game.start();closeDialog();checkpoint();};checkpoint();}
function interlude(){
  const next=CHAPTERS[game.chapter+1];showDialog(`<div class="eyebrow">CHAPTER COMPLETE / 乐章完成</div><h2 id="dialog-title">${game.biome.name}，已记住你的声音。</h2><p>击败 ${BOSSES[game.biome.id].name} · 当前质量 ${Math.round(game.player.mass)} μ<br>下一海域保留体型与进化，修复全部护膜，再获得一次能力或分支专精选择。</p><div class="chapter-note"><b>${next.title}</b><p>${next.intro}</p></div><div class="dialog-actions"><button class="primary" id="chapter-go">进入${BIOMES[game.chapter+1].name} ↗</button><button class="text-btn" id="chapter-save">保存并回到起点</button></div>`);$('chapter-go').onclick=()=>{closeDialog();game.nextChapter();checkpoint();};$('chapter-save').onclick=home;checkpoint();
}
function pause(){if(game.status==='paused')return resume();if(game.status!=='playing')return;game.status='paused';$('pause-btn').textContent='▷';showDialog(`<div class="eyebrow">TAKE A BREATH</div><h2 id="dialog-title">让生命，慢下来。</h2><p>${names[game.mode]} · ${game.biome.name} · ${fmtTime(game.time)}<br>当前旅程会自动保存，可以下次继续。</p><div class="dialog-actions"><button class="primary" id="resume">继续探索 ↗</button><button class="text-btn" id="pause-settings">设置</button><button class="text-btn" id="quit">保存并返回</button></div>`,resume);$('resume').onclick=resume;$('quit').onclick=home;$('pause-settings').onclick=settings;checkpoint();}
function resume(){game.status='playing';$('pause-btn').textContent='Ⅱ';releaseInput();previous=performance.now();closeDialog();checkpoint();}
function autoEvolution(){
  const node=bestEvolution(game,game.choices);if(!node||!game.evolve(node.id))return;
  music.flourish();ocean.ripple(game.player.x,game.player.z,game.player.radius);
  const name=node.name||EVOLUTIONS.find(t=>t.id===node.id)?.name||node.id;
  toast('自动进化 · '+name+(lineageStageName(game)?'｜'+lineageStageName(game):''),'lineage');checkpoint();
}
function evolution(){
  if(game.status!=='evolution')return;
  if(archive.autoUpgrade){autoEvolution();return;}
  game.status='evolution';music.flourish();
  const current=lineageFinalName(game)||'尚未分化';
  const cards=game.choices.map(t=>{
    const info=evolutionNodeInfo(t.id,game);
    const recipes=t.trait?[]:activeSynergies([...game.traits,t.id]).filter(s=>!game.hasSynergy(s.id));
    return `<button class="evo-card ${t.trait?'specialization':''}" data-trait="${t.id}">${info?`<em class="lineage-tag" style="--lineage:${info.color}">${info.icon} ${esc(info.lineage)} · ${info.rank}${info.isApex?' · 终局':''}</em>`:''}<span class="evo-icon">${t.icon}</span><b>${t.name}</b>${t.trait?`<em>${TRAITS.find(x=>x.id===t.trait).name} · 分支专精</em>`:''}<p>${t.desc}</p><small>${t.hint} ↗</small>${info?`<div class="lineage-path">${info.isApex?'终局形态':'下一形态'} · ${esc(info.stage)}${info.current?' ｜ 当前 '+esc(info.current):''}</div>`:''}${recipes.length?`<div class="recipe-preview">${recipes.map(s=>`<b>${s.icon} 激活 ${s.name}</b><span>${s.desc}</span>`).join('')}</div>`:''}</button>`;
  }).join('');
  showDialog(`<div class="eyebrow">EVOLUTION / 新的生命可能</div><h2 id="dialog-title">让进化，走向自己的分支。</h2><p>当前路线 · ${esc(current)}。连续选择同一路线会解锁完整的生物学分支，最终化为不同生物；也可以在设置中开启自动最优选择。</p><div class="evolution-cards">${cards}</div>`);
  $('dialog').querySelectorAll('[data-trait]').forEach(b=>b.onclick=()=>{if(game.evolve(b.dataset.trait)){closeDialog();music.flourish();ocean.ripple(game.player.x,game.player.z,game.player.radius);toast('生命分支 · '+(EVOLUTIONS.find(t=>t.id===b.dataset.trait)?.name||b.dataset.trait),'lineage');checkpoint();}});checkpoint();
}
function end(won){
  const mode=game.mode,horde=mode==='horde',survival=mode==='survival',daily=mode==='daily',complete=game.status==='complete';
  const unlocks=record();if(['dead','complete','timeup'].includes(game.status))checkpoints.clear();else checkpoints.save(game);
  saveArchive();
  music.cue?.({type:won?'victory':'dead',reason:game.mode});
  if(complete)music.ending();else if(horde||won)music.flourish();else music.hit();
  const score=horde?hordeScore(game):game.score();
  const title=complete?'从一个音符，到一整个宇宙。':horde?'潮汐退去，而你仍在浪尖。':survival?(won?'这段长歌，还在继续。':'一次沉睡，不会终结整首歌。'):daily?'今日潮汐，留下你的回响。':won?'你，奏响了整片海。':'生命的回响，不会消失。';
  // Reward summary line: survival grants permanent biomass/genes; horde grants score only.
  let rewardLine='';
  if(survival){const r=game.settleSurvival?game.settleSurvival():null;const lp=levelProgress(archive.biomass||0);rewardLine=`<p class="unlock-summary">永久收获 · 生物质 +${r?r.biomass:0} · 基因样本 +${r?r.gene:0}｜生命等级 ${lp.level} · 纪元 ${archive.epoch||0}：${esc(epochGoal(archive.epoch||0))}</p>`;}
  if(horde)rewardLine=`<p class="unlock-summary">围猎评分 ${score} · 评级 ${hordeGrade(score)} · 最高第 ${game.hordeWave} 波（不计入长期解锁）</p>`;
  const statMass=horde?game.hordeWave+' 波':Math.round(game.peakMass)+' μ';
  showDialog(`<div class="eyebrow">${complete?'SYMPHONY OF LIFE / 三海远征完成':horde?'TIDAL HORDE / 潮汐围猎结算':survival?'DEEP SONG / 深海长歌':game.biome.en}</div><h2 id="dialog-title">${title}</h2>${complete?'<div class="ending-symbol">✦</div><p>从微小细胞到风暴中的巨兽，<br>你吞下恐惧，也唤醒了沉睡的声音。<br>三海的回响，终于成为同一首歌。</p>':''}<div class="result-stats"><div><strong>${statMass}</strong><small>${horde?'抵达波次':'最高质量'}</small></div><div><strong>${fmtTime(game.time)}</strong><small>${horde?'存活时间':'探索时间'}</small></div><div><strong>${score}</strong><small>${horde?'围猎评分':'生命评分'}</small></div></div><p>吞噬 ${game.eaten} 次 · 最高连击 ×${game.bestCombo} · 完成 ${game.completedChallenges} 个愿望</p>${rewardLine}${game.campaignHistory.length?`<div class="chapter-results">${game.campaignHistory.map(h=>`<span>✓ ${BIOMES.find(b=>b.id===h.biome).name} · ${fmtTime(h.time)}</span>`).join('')}</div>`:''}${unlocks.length?`<p class="unlock-summary">新回响：${[...new Set(unlocks.map(u=>esc(u.name)))].join(' · ')}</p>`:''}${daily?`<p>${esc(game.dailyKey)} · ${game.rule().name}<br>同规则本机最佳 ${dailyBest(archive,game.dailyKey,game.dailyRule)||score} 分</p>`:''}<p class="build-summary">踩拍 ${game.rhythmHits} 次 · ${lineageFinalName(game)?'终局形态 · '+esc(lineageFinalName(game))+' · ':''}${game.specializations.length?'本局专精：'+game.specializations.map(id=>SPECIALIZATIONS.find(s=>s.id===id).name).join('、'):survival?'每一次长歌都让你更强':'三海远征可选择分支专精'}</p><div class="dialog-actions"><button class="primary" id="replay">${horde?'再围猎一局':survival?'再启长歌':complete?'再启远征':'再进化一次'} ↗</button>${game.mode==='free'&&won?'<button class="text-btn" id="continue">无尽挑战 ↗</button>':''}<button class="text-btn" id="end-home">回到起点</button></div>`,null,complete);
  $('replay').onclick=()=>startNew(replayOptions(game));$('end-home').onclick=()=>{if(['dead','complete','timeup'].includes(game.status))game.status='home';home();};if($('continue'))$('continue').onclick=()=>{game.continueEndless();closeDialog();checkpoint();toast('无尽挑战 · 每轮霸主与食物链继续增强');};
}
function guide(){
  if(!['home','playing','paused'].includes(game.status))return;const back=game.status;if(back==='playing')game.status='guide';
  showDialog(`<div class="eyebrow">FOLLOW THE SOUND</div><h2 id="dialog-title">跟随本能，自由生长。</h2><div class="guide-grid"><div><b>01 / 开始捕食</b><p>WASD、方向键或按住场景拖动；手机用摇杆。青绿可吞噬，蓝色需成长或破甲，珊瑚红要躲避。</p></div><div><b>02 / 规划进化</b><p>空格冲刺，E 放技能。32、100、280 μ 选择进化。巨口＋鳍翼能越级捕食；电流＋触须会连锁麻痹。</p></div><div><b>03 / 读懂生命</b><p>猎手蓄力时侧移，水母等脉冲散去，晶壳绕后或冲刺破甲。长大后捕食生物、珊瑚和沉船，微光的营养会逐渐降低。</p></div><div><b>04 / 三海远征</b><p>达到 100 μ 后收集三枚 ◇ 回声核。击败每海独立的霸主，保留进化继续远征，最终吞噬浮岛、风暴与生命之心。</p></div></div><p>底部光环亮起时吞噬可获得少量额外营养，每拍最多一次；连续踩拍触发八秒共鸣，技能恢复加快。<br>连续选择同一路线会解锁终局生物；设置里可开启自动最优升级，省去三选一。跨海可选择互斥专精，新旅程最多 4 种基础能力。每日挑战固定种子、标准起点与当日规则，五分钟结算。<br>拖动鼠标或手指可旋转三维视角（首次拖动自动进入环绕视角）；按 V 或点右上角 ◎ 在跟随／环绕／第一视角间切换，1/2/3 直接选择；右键拖动、双指平移也可旋转。滚轮、双指捏合或 + / - 拉近拉远 · Esc / P 暂停 · M 切换声音 · 暂停或离开时自动保存</p><button class="primary" id="guide-close">明白了 ↗</button>`,()=>returnTo(back));$('guide-close').onclick=()=>returnTo(back);
}
function hordeUpgrade(){
  if(!game.hordeChoices||!game.hordeChoices.length){game.status='playing';return;}
  game.status='hordeUpgrade';
  if(archive.autoUpgrade){
    const pick=bestHordeUpgrade(game,game.hordeChoices);
    if(pick&&game.chooseHordeUpgrade(pick.id)){music.flourish();ocean.ripple(game.player.x,game.player.z,game.player.radius*2);checkpoint();}
    else game.status='playing';
    return;
  }
  const cards=game.hordeChoices.map(u=>{
    const path=LINEAGES.find(l=>l.id===u.lineage);
    return `<button class="evo-card" data-upgrade="${u.id}">${path?`<em class="lineage-tag" style="--lineage:${path.color}">${path.icon} ${path.name} · 路线强化</em>`:''}<span class="evo-icon">${u.icon}</span><b>${u.name}</b><p>${u.desc}</p><small>本局限时生效 ↗</small></button>`;
  }).join('');
  showDialog(`<div class="eyebrow">TIDAL SURGE / 第 ${game.hordeWave} 波完成</div><h2 id="dialog-title">选择一次潮汐馈赠。</h2><p>馈赠会沿着你的进化路线出现，也会根据当前危险程度调整权重。可在设置中开启自动最优选择。</p><div class="evolution-cards">${cards}</div>`);
  $('dialog').querySelectorAll('[data-upgrade]').forEach(b=>b.onclick=()=>{game.chooseHordeUpgrade(b.dataset.upgrade);closeDialog();music.flourish();ocean.ripple(game.player.x,game.player.z,game.player.radius*2);toast('潮汐馈赠 · '+b.querySelector('b').textContent,'lineage');checkpoint();});
  checkpoint();
}
function quality(){
  if(!['home','playing','paused'].includes(game.status))return;
  const back=game.status;if(back==='playing')game.status='settings';
  const choices=[
    ['auto','自动','按设备性能自动选择精致或流畅','◇'],
    ['high','极致真实','LOD 海床与生物、PBR 微细节与角膜高光、分级软阴影、GTAO、景深、运动模糊、TAA、镜头眩光与电影 LUT','✦'],
    ['medium','均衡','保留核心光影与光束，降低后处理开销','◐'],
    ['low','流畅','关闭后处理并精简远景，适合手机与低性能设备','▷']
  ];
  const selected=id=>(archive.qualityMode||'auto')==='auto'?id==='auto':id===archive.quality;
  showDialog(`<div class="eyebrow">RENDER PRESET / 画面设置</div><h2 id="dialog-title">让海洋运行在舒服的画质。</h2><div class="difficulty-cards">${choices.map(([id,name,desc,icon])=>`<button data-quality-choice="${id}" class="${selected(id)?'selected':''}"><b>${icon} ${name}</b><p>${desc}</p></button>`).join('')}</div><p>当前实际画质：${qualityLabel()}。选择会立即生效并保存；也可用网址参数 <code>?quality=auto|high|medium|low</code> 覆盖。</p><button class="primary" id="quality-close">返回 ↗</button>`,()=>returnTo(back));
  $('dialog').querySelectorAll('[data-quality-choice]').forEach(b=>b.onclick=()=>{setQualityChoice(b.dataset.qualityChoice);returnTo(back);});
  $('quality-close').onclick=()=>returnTo(back);
}
function settings(){
  if(!['home','playing','paused'].includes(game.status))return;const back=game.status;if(back==='playing')game.status='settings';
  showDialog(`<div class="eyebrow">MAKE THE OCEAN YOUR OWN</div><h2 id="dialog-title">调到舒服的频率。</h2><div class="settings-grid"><label for="volume">总音量 <span id="volume-value">${Math.round(archive.volume*100)}%</span><input id="volume" type="range" min="0" max="100" value="${Math.round(archive.volume*100)}"></label><label for="music-volume">音乐 <span id="music-volume-value">${Math.round((archive.musicVolume??archive.volume)*100)}%</span><input id="music-volume" type="range" min="0" max="100" value="${Math.round((archive.musicVolume??archive.volume)*100)}"></label><label for="sfx-volume">音效 <span id="sfx-volume-value">${Math.round((archive.sfxVolume??.7)*100)}%</span><input id="sfx-volume" type="range" min="0" max="100" value="${Math.round((archive.sfxVolume??.7)*100)}"></label><label for="ui-volume">界面 <span id="ui-volume-value">${Math.round((archive.uiVolume??.5)*100)}%</span><input id="ui-volume" type="range" min="0" max="100" value="${Math.round((archive.uiVolume??.5)*100)}"></label><div><label>画面质量</label><div class="settings-quality"><button data-quality-setting="auto">自动</button><button data-quality-setting="high">极致真实</button><button data-quality-setting="medium">均衡</button><button data-quality-setting="low">流畅</button></div></div><div><label>触控布局</label><div class="settings-quality"><button data-touch-mode="auto">自动</button><button data-touch-mode="on">开启</button><button data-touch-mode="off">关闭</button></div></div><div><label>单手模式</label><div class="settings-quality"><button data-hand="off">关闭</button><button data-hand="left">左手</button><button data-hand="right">右手</button></div></div><div><label>升级选择</label><div class="settings-quality"><button data-auto-upgrade="off">手动选择</button><button data-auto-upgrade="on">自动最优</button></div><small>开启后，进化与潮汐馈赠会自动按当前路线、危险程度与成长收益选择，不再弹出三选一。</small></div><small>极致真实启用 LOD 位移海床、PBR 微细节与角膜高光、分级软阴影、GTAO、景深、运动模糊、TAA、镜头眩光、电影 LUT 与自适应曝光；均衡保留核心光影与 LUT；流畅关闭后处理。加 ?debugperf=1 可查看实时性能。触控布局自动识别手机，也可用 ?mobile=1 预览。</small></div><button class="primary" id="settings-close">调整好了 ↗</button>`,()=>returnTo(back));
  $('volume').oninput=e=>{archive.volume=Number(e.target.value)/100;music.setVolume(archive.volume);$('volume-value').textContent=e.target.value+'%';saveArchive();};
  for(const [id,key,setter] of [['music-volume','musicVolume','setMusicVolume'],['sfx-volume','sfxVolume','setSfxVolume'],['ui-volume','uiVolume','setUiVolume']]){
    const el=$(id);if(!el)continue;el.oninput=e=>{archive[key]=Number(e.target.value)/100;music[setter]?.(archive[key]);$(id+'-value').textContent=e.target.value+'%';saveArchive();};
  }
  $('dialog').querySelectorAll('[data-quality-setting]').forEach(b=>{const id=b.dataset.qualitySetting,active=(archive.qualityMode||'auto')==='auto'?id==='auto':id===archive.quality;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));b.onclick=()=>{setQualityChoice(id);b.parentElement.querySelectorAll('button').forEach(x=>{x.classList.remove('selected');x.setAttribute('aria-pressed','false');});b.classList.add('selected');b.setAttribute('aria-pressed','true');};});
  $('dialog').querySelectorAll('[data-touch-mode]').forEach(b=>{const id=b.dataset.touchMode,active=(archive.touchMode||'auto')===id;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));b.onclick=()=>{archive.touchMode=id;saveArchive();applyTouchMode();b.parentElement.querySelectorAll('button').forEach(x=>{x.classList.remove('selected');x.setAttribute('aria-pressed','false');});b.classList.add('selected');b.setAttribute('aria-pressed','true');toast('触控布局 · '+({auto:'自动',on:'开启',off:'关闭'})[id]);};});
  $('dialog').querySelectorAll('[data-hand]').forEach(b=>{const id=b.dataset.hand,active=(archive.oneHand||'off')===id;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));b.onclick=()=>{archive.oneHand=id;saveArchive();applyTouchMode();b.parentElement.querySelectorAll('button').forEach(x=>{x.classList.remove('selected');x.setAttribute('aria-pressed','false');});b.classList.add('selected');b.setAttribute('aria-pressed','true');toast('单手模式 · '+({off:'关闭',left:'左手',right:'右手'})[id]);};});
  $('dialog').querySelectorAll('[data-auto-upgrade]').forEach(b=>{const id=b.dataset.autoUpgrade,active=!!archive.autoUpgrade===(id==='on');b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));b.onclick=()=>{archive.autoUpgrade=id==='on';saveArchive();b.parentElement.querySelectorAll('button').forEach(x=>{x.classList.remove('selected');x.setAttribute('aria-pressed','false');});b.classList.add('selected');b.setAttribute('aria-pressed','true');toast('升级选择 · '+(archive.autoUpgrade?'自动最优':'手动选择'));};});
  $('settings-close').onclick=()=>returnTo(back);
  const backup=document.createElement('div');backup.className='save-tools';backup.innerHTML='<label>旅程备份</label><div class="settings-quality"><button id="export-run">导出旅程</button><button id="import-run">导入旅程</button></div><small>导出当前断点；导入后可在其他浏览器继续。生命档案保留在本机。</small><input id="run-file" type="file" accept=".json,application/json" hidden>';$('dialog').querySelector('.settings-grid').append(backup);
  const exportable=()=>game.status==='home'?checkpoints.load()?.game:game;$('export-run').disabled=!encodeRun(exportable()||game);
  $('export-run').onclick=()=>{const text=encodeRun(exportable()||game);if(!text)return;const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='吞噬交响曲-旅程.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('旅程已导出');};
  $('import-run').onclick=()=>$('run-file').click();$('run-file').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>700000){toast('旅程文件过大，请选择有效备份');return;}const imported=decodeRun(await file.text());if(!imported){toast('旅程文件无效或已损坏，当前进度已保留');return;}showDialog(`<div class="eyebrow">CONTINUE YOUR SYMPHONY</div><h2 id="dialog-title">接续这段生命。</h2><p>${names[imported.game.mode]} · ${imported.game.biome.name}<br>${Math.round(imported.game.player.mass)} μ · ${fmtTime(imported.game.time)}<br>导入会替换当前旅程断点，已有生命档案保留。</p><div class="dialog-actions"><button class="primary" id="import-confirm">导入并继续 ↗</button><button class="text-btn" id="import-cancel">取消</button></div>`,()=>returnTo(back));$('import-cancel').onclick=()=>returnTo(back);$('import-confirm').onclick=()=>{if(!checkpoints.save(imported.game)){toast('存储不可用，未替换当前旅程');return;}restore();};};
}
function difficulty(){if(game.status!=='home'||archive.mode==='daily')return;showDialog(`<div class="eyebrow">CHOOSE YOUR RHYTHM</div><h2 id="dialog-title">选择自己的节奏。</h2><div class="difficulty-cards">${Object.entries(difficulties).map(([id,name])=>`<button data-difficulty="${id}" ${id==='master'&&archive.expeditions===0?'disabled':''}><b>${name}</b><p>${id==='relaxed'?'五层初始护膜，更适合探索和欣赏音乐。':id==='normal'?'三层初始护膜，观察预警，规划进化。':archive.expeditions?'更快的天敌与霸主，为新构筑准备的考验。':'完成一次三海远征后解锁。'}</p></button>`).join('')}</div><button class="text-btn" id="difficulty-close">返回</button>`,closeDialog);$('dialog').querySelectorAll('[data-difficulty]').forEach(b=>b.onclick=()=>{archive.difficulty=b.dataset.difficulty;saveArchive();closeDialog();refreshHome();});$('difficulty-close').onclick=closeDialog;}
function showArchive(){
  const forms=FORMS.map(f=>`<button class="archive-card ${archive.form===f.id?'selected':''} ${f.unlock(archive)?'':'locked'}" data-form="${f.id}" ${f.unlock(archive)?'':'disabled'}><span class="evo-icon">${f.icon}</span><b>${f.name}</b><p>${f.desc}</p><small>${f.unlock(archive)?archive.form===f.id?'✓ 下局使用':'点击选择':'待解锁 · '+f.condition}</small></button>`).join('');
  showDialog(`<div class="eyebrow">THE LIVING ARCHIVE</div><h2 id="dialog-title">每一次生命，都留下回响。</h2><p>探索 ${archive.runs} 次 · 完成远征 ${archive.expeditions} 次 · 最高 ${Math.round(archive.best)} μ · 最佳连击 ×${archive.bestCombo}</p><div class="archive-grid">${forms}</div><h3 class="archive-section-title">三海航迹</h3><div class="biome-records">${BIOMES.map(b=>`<div>${b.name}<small>征服 ${archive.biomes[b.id].wins} 次<br>最高 ${Math.round(archive.biomes[b.id].best)} μ</small></div>`).join('')}</div><h3 class="archive-section-title">生命徽章 ${BADGES.filter(b=>b.unlock(archive)).length} / ${BADGES.length}</h3><div class="badge-grid">${BADGES.map(b=>`<div class="badge ${b.unlock(archive)?'':'locked'}"><span>${b.icon}</span><b>${b.name}</b><small>${b.desc}</small></div>`).join('')}</div><h3 class="archive-section-title">进化组合 ${archive.synergies.length} / ${SYNERGIES.length}</h3><div class="recipe-grid">${SYNERGIES.map(s=>`<div class="recipe ${archive.synergies.includes(s.id)?'discovered':''}"><b>${s.icon} ${s.name} ${archive.synergies.includes(s.id)?'✓':''}</b><small>${s.traits.map(id=>TRAITS.find(t=>t.id===id).name).join(' ＋ ')}</small><p>${s.desc}</p></div>`).join('')}</div><h3 class="archive-section-title">进化路线 ${archive.lineages.length} / ${LINEAGES.length}</h3><div class="lineage-grid">${LINEAGES.map(l=>`<div class="lineage-card ${archive.lineages.includes(l.id)?'discovered':''}" style="--lineage:${l.color}"><b>${l.icon} ${l.name}</b><small>${archive.lineages.includes(l.id)?'✓ '+l.stageNames[2]:'待解锁 · '+l.desc}</small></div>`).join('')}</div><h3 class="archive-section-title">分支专精 ${archive.specializations.length} / ${SPECIALIZATIONS.length}</h3><div class="recipe-grid">${SPECIALIZATIONS.map(s=>`<div class="recipe ${archive.specializations.includes(s.id)?'discovered':''}"><b>✧ ${s.name} ${archive.specializations.includes(s.id)?'✓':''}</b><small>${TRAITS.find(t=>t.id===s.trait).name} · 同族分支互斥</small><p>${s.desc}</p></div>`).join('')}</div><h3 class="archive-section-title">生物图鉴 ${archive.species.length} / 5</h3><div class="species-grid">${SPECIES.map(s=>`<div class="species ${archive.species.includes(s.id)?'discovered':''}"><b>${s.icon} ${s.name}</b><p>${s.detail}</p><small>${archive.species.includes(s.id)?'✓ 已捕食':'等待发现'}</small></div>`).join('')}</div><h3 class="archive-section-title">巨物图鉴 ${archive.structures.length} / 4</h3><div class="biome-records">${['reef','wreck','island','storm'].map(t=>`<div>${STRUCTURE_TYPES[t].icon} ${STRUCTURE_TYPES[t].name}<small>${archive.structures.includes(t)?'✓ 已吞噬':'成长后寻找'}</small></div>`).join('')}</div><p>档案与断点存档保存在当前浏览器。</p><button class="primary" id="archive-close">回到生命之海 ↗</button>`,closeDialog);
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
  const era=periodFor(game);
  $('stage-title').textContent=era.name;$('mass').textContent=Math.round(p.mass)+' μ';$('growth-fill').style.width=Math.max(0,Math.min(100,(p.mass-start)/Math.max(1,finish-start)*100))+'%';$('next-stage').textContent=next?`下一形态 · ${next.mass} μ`:`目标质量 · ${goal} μ`;
  $('health').textContent='● '.repeat(Math.max(0,game.health))+'○ '.repeat(Math.max(0,game.maxHealth-game.health));$('health').setAttribute('aria-label',`护膜 ${game.health} / ${game.maxHealth}`);
  const timed=game.mode==='daily'||game.mode==='horde',left=game.mode==='daily'?Math.max(0,300-game.time):Math.max(0,HORDE_DURATION-game.time);
  $('time').textContent=fmtTime(timed?left:game.time);$('time').nextElementSibling.textContent=timed?'剩余时间':'存活时间';$('combo').textContent='×'+Math.max(1,game.combo);$('combo-label').textContent=game.mode==='horde'?`评分 ${hordeScore(game)}`:game.mode==='daily'?`评分 ${game.score()}`:'吞噬连击';
  $('location').textContent=era.en+' · '+era.era;$('seed-label').textContent=game.mode==='expedition'?CHAPTERS[game.chapter].title:names[game.mode];$('mode-title').textContent=names[game.mode];$('chapter-title').textContent=game.mode==='expedition'?`${game.chapter+1} / 3 · ${game.biome.name}`:game.mode==='daily'?'剩余时间 · '+game.dailyKey:game.mode==='horde'?`第 ${game.hordeWave} / 6 波 · ${waveForTime(game.time)}`:game.mode==='survival'?`生命等级 ${archive.lifeLevel||0} · 慢慢变强`:game.endless?'无尽第 '+game.endlessWave+' 轮':game.biome.name;
  $('journey-progress').innerHTML=game.mode==='expedition'?CHAPTERS.map((c,i)=>`<i class="${i<game.campaignHistory.length?'done':i===game.chapter?'active':''}"></i>`).join(''):'';
  $('track-name').firstChild.textContent=STAGES[game.stage].track;$('music-status').textContent=music.muted?'声音已关闭':`${game.biome.bpm} BPM · ${game.stage+1} / 5 声部`;
  const lineageLabel=lineageStageName(game),lineageData=LINEAGES.find(l=>l.id===lineageOf(game));$('traits').innerHTML=[...game.traits.map(id=>`<span>${TRAITS.find(t=>t.id===id).name}</span>`),...(lineageLabel?[`<span class="lineage-chip">${lineageData?.icon||'✧'} ${esc(lineageLabel)}</span>`]:[])].join('');const combinations=game.synergies(),branches=game.specializations.map(id=>SPECIALIZATIONS.find(s=>s.id===id));music.voices=new Set(combinations.map(s=>s.id));music.crescendo=game.crescendoTime>0;$('synergy-panel').classList.toggle('hidden',!combinations.length&&!branches.length);$('synergy-list').innerHTML=[...combinations.map(s=>`<div title="${s.desc}">${s.icon} ${s.name}</div>`),...branches.map(s=>`<div class="branch-tag" title="${s.desc}">✧ ${s.name}</div>`)].join('');
  document.body.classList.toggle('crescendo',game.crescendoTime>0);$('rhythm-text').textContent=game.crescendoTime>0?'共鸣高潮 · '+game.crescendoTime.toFixed(0)+'s':'踩拍共鸣 · '+game.rhythmEnergy+' / '+energyTarget(game);$('rhythm-fill').style.width=(game.crescendoTime>0?100:game.rhythmEnergy/energyTarget(game)*100)+'%';$('pulse-orb').classList.toggle('on',beatPhase(game)<.15||beatPhase(game)>.86);
  const encounter=game.creatures.filter(c=>!c.boss&&c.kind!==0&&Math.hypot(c.x-p.x,c.z-p.z)<p.radius+c.radius+13).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];$('encounter-tip').classList.toggle('hidden',!encounter);if(encounter){$('encounter-name').textContent=SPECIES[encounter.kind].icon+' '+faunaNameFor(era,encounter.kind);$('encounter-desc').textContent=era.story+' · '+SPECIES[encounter.kind].tip;}
  if(game.mode==='horde'){$('mission-text').textContent=`撑过 ${HORDE_DURATION} 秒 · 当前 ${hordeScore(game)} 分`;$('mission-sub').textContent='敌人从四周涌来 · 吞噬、冲刺、技能清场';}
  else if(game.mode==='survival'){$('mission-text').textContent=p.mass<goal?`慢慢成长至 ${next?.mass||goal} μ`:'寻找守护者，收获永久生物质';$('mission-sub').textContent=`本局结束可转化永久成长 · 基因样本每周上限 ${geneWeeklyCap()}`;}
  else if(game.mode==='daily'){$('mission-text').textContent=game.rule().name+` · ${game.score()} 分`;$('mission-sub').textContent=game.rule().desc;}
  else if(game.mode==='expedition'&&game.chapter===2&&game.bossDefeated){$('mission-text').textContent='吞噬生命之心，完成三海交响';$('mission-sub').textContent='✦ 生命之心位于海域中央';}
  else if(game.mode==='expedition'&&game.stage>=2&&game.echoes<3){$('mission-text').textContent=`收集回声核 · ${game.echoes} / 3`;$('mission-sub').textContent='◇ 跟随指引，唤醒本海域的霸主';}
  else{$('mission-text').textContent=p.mass<goal?`继续捕食，成长至 ${next?.mass||goal} μ`:'抓住霸主破绽，吞噬奏响终章';$('mission-sub').textContent=game.stage>=3?'吞噬珊瑚、沉船与更大的生命':game.stage?'微光营养降低 · 捕食生物成长更快':'青绿可吞噬 · 蓝色需观察 · 珊瑚红需躲避';}
  const q=game.challenge;$('challenge-name').textContent=q.name;$('challenge-count').textContent=`${q.progress} / ${q.target}`;$('challenge-desc').textContent=q.desc;$('challenge-fill').style.width=q.progress/q.target*100+'%';$('challenge-reward').textContent=q.done?'✓ 愿望达成 · 护膜修复与营养雨':'完成奖励 · 修复护膜 + 营养雨';$('challenge').classList.toggle('completed',q.done);$('danger').classList.toggle('hidden',!game.danger);
  const boss=game.creatures.find(c=>c.boss),near=boss&&Math.hypot(boss.x-p.x,boss.z-p.z)<100;music.boss=!!near;$('boss-status').className='boss-status'+(near?' '+boss.state:' hidden');if(near){$('boss-status').querySelector('span').textContent='♛ '+BOSSES[boss.variant||'lagoon'].name;const open=game.canEat(boss);$('boss-state').textContent=open?'护壳破绽 · 可以吞噬':boss.state==='warning'?'正在蓄力！':boss.state==='charge'?'攻击！冲刺躲避':boss.state==='exposed'?'护壳打开 · 还需成长':'护壳闭合';$('boss-tip').textContent=open?'靠近，完成最后一次吞噬':BOSSES[boss.variant||'lagoon'].tip;if(open)$('boss-status').className='boss-status exposed';}
  $('dash-fill').style.height=game.dashCd/game.dashCooldown()*100+'%';$('dash-label').textContent=game.dashCd>0?game.dashCd.toFixed(1)+'s':'SPACE';const active=game.traits.includes('electric')||game.traits.includes('magnet');$('ability-btn').classList.toggle('hidden',!active);$('mobile-ability').classList.toggle('hidden',!active);$('ability-name').textContent=game.traits.includes('electric')?'电流脉冲':'引力场';$('mobile-ability-name').textContent=game.traits.includes('electric')?'电流脉冲':'引力场';$('ability-label').textContent=game.abilityCd>0?game.abilityCd.toFixed(1)+'s':'E';$('ability-fill').style.height=game.abilityCd/game.abilityCooldown()*100+'%';
  const dest=target();$('target-guide').classList.toggle('hidden',!dest);if(dest){const dx=dest.x-p.x,dz=dest.z-p.z;$('target-arrow').style.transform=`rotate(${Math.atan2(dz,dx)*180/Math.PI}deg)`;$('target-name').textContent=(dest.boss?BOSSES[dest.variant].name:STRUCTURE_TYPES[dest.type].name)+' · '+Math.round(Math.hypot(dx,dz))+' m';}
  updateChapters();drawRadar();
}
const radar=$('minimap').getContext('2d');
function drawRadar(){const c=radar,p=game.player,scale=1/(1+p.radius/25);c.clearRect(0,0,160,160);c.strokeStyle='#a1dbbc28';for(const r of [28,53,75]){c.beginPath();c.arc(80,80,r,0,7);c.stroke();}for(const s of game.structures){let x=(s.x-p.x)*scale,z=(s.z-p.z)*scale,d=Math.hypot(x,z);if(d>72){if(!['echo','heart'].includes(s.type))continue;x*=72/d;z*=72/d;}c.fillStyle=['echo','heart'].includes(s.type)?s.type==='heart'?'#ffe2a0':'#d4fff2':game.canAbsorb(s)?'#8ed2aa':'#647e8b';c.save();c.translate(80+x,80+z);c.rotate(Math.PI/4);c.fillRect(-2,-2,4,4);c.restore();}for(const q of game.creatures){let x=(q.x-p.x)*scale,z=(q.z-p.z)*scale,d=Math.hypot(x,z);if(d>72){if(!q.boss)continue;x*=72/d;z*=72/d;}c.fillStyle=q.boss?'#ffd49a':game.canEat(q)?'#8ee8b6':game.isDangerous(q)?'#e89b85':'#82aec2';c.beginPath();c.arc(80+x,80+z,q.boss?4:2,0,7);c.fill();}c.fillStyle='#e0ffe8';c.beginPath();c.arc(80,80,3,0,7);c.fill();}
function events(){
  for(const e of game.events.splice(0)){
    if(ocean?.vfx)ocean.vfx.event(e.type,game);
    if(e.type==='eat'){music.eat(e.kind,e.combo);music.cue?.({type:'comboChanged',combo:e.combo});ocean.engulf(e.x,e.z,game.player.x,game.player.z,e.kind===3?0xffd08a:0xa8fbc5);}
    else if(e.type==='perfect'){ocean.ripple(game.player.x,game.player.z,game.player.radius,0xffe6a6);}
    else if(e.type==='crescendo'){music.signature('chorus');toast('共鸣高潮 · 八秒协奏，技能恢复加快');}
    else if(e.type==='rare'){ocean.burst(e.x,e.z,0xffe1a0,25);toast('稀有猎物 · 额外营养与评分');}
    else if(e.type==='stage'){music.stage=e.stage;music.cue?.({type:'stageUp',stage:e.stage});music.flourish();ocean.ripple(game.player.x,game.player.z,game.player.radius);ocean.molt();ocean.periodOverride=-1;ocean.applyPeriod(e.stage);toast('地质时期 · '+periodFor(game).name+'｜'+periodFor(game).story);checkpoint();}
    else if(e.type==='evolution')evolution();
    else if(e.type==='chapterComplete')interlude();
    else if(e.type==='chapter'){music.setBiome(game.biome);toast(CHAPTERS[game.chapter].title);}
    else if(e.type==='echo'){music.flourish();ocean.ripple(e.x,e.z,3);toast(`回声核已唤醒 · ${e.count} / 3`);checkpoint();}
    else if(e.type==='structure'){ocean.burst(e.x,e.z,STRUCTURE_TYPES[e.structureType]?.color||0xbef3d2,24);toast('吞噬 · '+STRUCTURE_TYPES[e.structureType]?.name);checkpoint();}
    else if(e.type==='finalHeart'){music.flourish();toast('三海归于寂静 · 回到中央，唤醒生命之心');checkpoint();}
    else if(e.type==='hordeWave'){music.cue?.({type:'comboChanged',combo:game.combo});music.flourish();ocean.ripple(game.player.x,game.player.z,game.player.radius*2,0x9bd6ff);toast('第 '+e.wave+' 波 · 敌人正在逼近','warn');if(game.status==='hordeUpgrade')hordeUpgrade();}
    else if(e.type==='hordeUpgrade'){music.cue?.({type:'stageUp',stage:game.hordeWave});toast('潮汐馈赠 · '+e.label);}
    else if(e.type==='hordePulse')ocean.ripple(game.player.x,game.player.z,game.player.radius*3,0x9bd6ff);
    else if(e.type==='boss'){music.cue?.({type:'bossStarted',variant:game.biome.id});toast(BOSSES[game.biome.id].name+' 已现身');}
    else if(e.type==='bossWarning')toast(BOSSES[game.biome.id].tip);
    else if(e.type==='dailyBoss'){toast('守护者已吞噬 · 额外评分 +1000');checkpoint();}
    else if(e.type==='endlessWave'){toast('无尽挑战 · 第 '+e.wave+' 轮完成');checkpoint();}
    else if(e.type==='dash')ocean.ripple(game.player.x,game.player.z,game.player.radius);
    else if(e.type==='ability'){ocean.ripple(game.player.x,game.player.z,game.player.radius*3,e.electric?0x9bd6ff:0xb0ffd6);music.signature(e.electric?'storm':'chorus');}
    else if(e.type==='damage'){music.hit();music.cue?.({type:'damaged',cause:e.cause});ocean.shake=.3;ocean.burst(game.player.x,game.player.z,0xf0a58c,25);toast(e.cause==='jelly'?'水母脉冲！退到光环外':e.cause==='crystal'?'脉冲命中！冲刺离开预警区':'护膜受损 · 冲刺离开天敌','warn');}
    else if(e.type==='challenge'){music.flourish();ocean.ripple(game.player.x,game.player.z,game.player.radius*2);toast('愿望达成 · '+e.name);checkpoint();}
    else if(e.type==='synergy'){music.signature(e.id);toast('生命协奏 · '+e.name);checkpoint();}
    else if(e.type==='hunterWarning')toast('尖喙猎手正在蓄力 · 向侧面游动','warn');
    else if(e.type==='jellyWarning')toast('水母脉冲即将释放 · 拉开距离','warn');
    else if(e.type==='chorus')ocean.ripple(game.player.x,game.player.z,game.player.radius,0xd3f1c0);
    else if(e.type==='reactor')ocean.ripple(game.player.x,game.player.z,game.player.radius*3,0x9bd8ff);
    else if(e.type==='repair')toast('消化完成 · 护膜修复');
    else if(e.type==='end')end(e.won);
  }
}
function input(){let x=0,z=0;if(keys.has('a')||keys.has('arrowleft'))x--;if(keys.has('d')||keys.has('arrowright'))x++;if(keys.has('w')||keys.has('arrowup'))z--;if(keys.has('s')||keys.has('arrowdown'))z++;if(stickId!==null){x=stick.x;z=stick.z;}else if(!x&&!z&&dragging&&mouseTarget){const dx=mouseTarget.x-game.player.x,dz=mouseTarget.z-game.player.z,d=Math.hypot(dx,dz);if(d>.4){x=dx/d*Math.min(1,d/3);z=dz/d*Math.min(1,d/3);}}return{x,z};}
let slowFrames=0,autoDegraded=false;
function frame(now){const delta=Math.max(0,(now-previous)/1000),dt=Math.min(delta,.05);previous=now;elapsed+=dt;game.advance(delta,input());
  let renderMs=0;if(ocean){events();const measured=measure(()=>ocean.update(game,dt,elapsed));renderMs=measured.ms;ocean.perf.sample(delta,renderMs,ocean.renderer.info);}
  if(game.status==='playing'&&music.ctx){
    music.tickEmotion?.(dt);
    music.cue?.({type:'dangerChanged',level:game.danger?1:0});
    if(music.resyncIfDrifted?.(game.beatPosition))music.debug.resynced=(music.debug.resynced||0)+1;
  }
  if(now-lastUI>100&&game.status!=='home'){updateUI();lastUI=now;}
  if(musicDebug&&now-lastMusicDbg>250){lastMusicDbg=now;const d=music.debugState?.()||{};$('music-debug').textContent=`CUE ${d.cue||'-'} · INT ${d.emotion?.intensity?.toFixed(2)} WON ${d.emotion?.wonder?.toFixed(2)} DNG ${d.emotion?.danger?.toFixed(2)} TRI ${d.emotion?.triumph?.toFixed(2)} · PHASE ${music.audioPhase?.(game.beatPosition)?.toFixed(3)} · STEMS ${d.loadedStems||0} · SYNC ${music.debug?.resynced||0}`;}
  if(game.status==='playing'&&game.time-lastCheckpoint>3){checkpoint();lastCheckpoint=game.time;}
  if(ocean&&!autoDegraded&&game.status==='playing'&&archive.qualityMode!=='manual'){
    const recommend=ocean.perf.recommend(ocean.quality);
    if(recommend){autoDegraded=true;slowFrames=ocean.perf.stats().slow;archive.quality=recommend;ocean.setQuality(recommend);saveArchive();toast(`检测到帧率偏低 · 已自动切换到${{low:'流畅',medium:'均衡',high:'极致真实'}[recommend]}模式`);}
  }
  requestAnimationFrame(frame);}
try{
  ocean=new Ocean($('world'));ocean.setQuality(archive.quality);window.ocean=ocean;window.game=game;
  ocean.perf.attachHud(document.body);ocean.perf.setHud(urlParams.get('debugperf')==='1');
  const urlZoom=Number(urlParams.get('zoom'));if(urlZoom>0)ocean.setZoom(urlZoom);if(urlParams.get('zoomSnap')==='1'){ocean.zoom=ocean.zoomTarget;ocean.zoomSnap=true;}
  applyTouchMode();
  const urlQuality=urlParams.get('quality');if(['auto','high','medium','low'].includes(urlQuality)){if(urlQuality==='auto'){archive.qualityMode='auto';archive.quality=autoQuality();}else{archive.qualityMode='manual';archive.quality=urlQuality;}ocean.setQuality(archive.quality);}
  const urlView=urlParams.get('view');if(['follow','orbit','first'].includes(urlView)){ocean.setView(urlView);if($('view-btn'))$('view-btn').textContent=({follow:'◎',orbit:'◐',first:'◉'})[urlView];}
  const urlPeriod=Number(urlParams.get('period'));if(urlPeriod>=0&&urlPeriod<=5){ocean.periodOverride=urlPeriod;ocean.applyPeriod(urlPeriod);}
  game.reset(selectedBiome(),{mode:archive.mode,lifeLevel:archive.lifeLevel||0});$('loading').classList.add('hidden');
  // Offline biomass accrues since the last claim (max 8h). Clock rollback is flagged, never rewarded.
  try{
    const gain=offlineGain(archive.lastOfflineClaimAt,Date.now(),archive.lifeLevel||0);
    archive.lastOfflineClaimAt=Date.now();
    if(gain.anomaly){archive.clockAnomaly=true;}
    else if(gain.biomass>0){archive.biomass=(archive.biomass||0)+gain.biomass;archive.lifeLevel=biomassToLevel(archive.biomass);archive.epoch=epochOf(archive.lifeLevel);setTimeout(()=>toast(`离线回归 · 潮汐带来 ${gain.biomass} 生物质`),1200);}
    saveArchive();
  }catch{}
  // Debug/screenshot helper: ?autostart=1 enters play directly for headless capture.
  if(urlParams.get('autostart')==='1'&&game.status==='home'){
    const urlMode=urlParams.get('mode');archive.mode=(urlMode&&isMode(urlMode))?urlMode:'free';archive.biome=urlParams.get('biome')||'lagoon';
    game.reset(selectedBiome(),{mode:archive.mode,lifeLevel:archive.lifeLevel||0});game.start();
    if(urlParams.get('period')!==null&&urlPeriod>=0){ocean.periodOverride=urlPeriod;ocean.applyPeriod(urlPeriod);}
    mount();
  }
  const canvas=ocean.renderer.domElement;
  const touches=new Map();let pinchDist=0,pinchMid=null;
  canvas.addEventListener('wheel',e=>{e.preventDefault();ocean.adjustZoom(e.deltaY*.0012*Math.max(.4,ocean.zoomTarget));}, {passive:false});
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  canvas.addEventListener('pointerdown',e=>{
    canvas.setPointerCapture(e.pointerId);
    touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(touches.size===2){const [a,b]=[...touches.values()];pinchDist=Math.hypot(a.x-b.x,a.y-b.y);pinchMid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};dragging=false;viewDrag=null;mouseTarget=null;touchRotate=null;return;}
    if(game.status!=='playing')return;
    // Dragging always rotates the camera. In classic follow mode the first drag lifts
    // into orbit view automatically; WASD / the on-screen joystick drive movement.
    viewDrag={id:e.pointerId,x:e.clientX,y:e.clientY,originX:e.clientX,originY:e.clientY,autoOrbit:ocean.viewMode==='follow'};
    dragging=false;mouseTarget=null;
  });
  canvas.addEventListener('pointermove',e=>{
    if(touches.has(e.pointerId))touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(touches.size===2){
      const [a,b]=[...touches.values()],d=Math.hypot(a.x-b.x,a.y-b.y),mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
      if(pinchDist)ocean.adjustZoom((pinchDist-d)*.004*Math.max(.4,ocean.zoomTarget));pinchDist=d;
      // Two-finger pan rotates the view (works in every mode).
      if(pinchMid)ocean.rotateView(mid.x-pinchMid.x,mid.y-pinchMid.y);
      pinchMid=mid;return;
    }
    if(viewDrag&&viewDrag.id===e.pointerId){
      if(viewDrag.autoOrbit&&Math.hypot(e.clientX-viewDrag.originX,e.clientY-viewDrag.originY)>6){viewDrag.autoOrbit=false;setView('orbit');}
      if(ocean.viewMode!=='follow')ocean.rotateView(e.clientX-viewDrag.x,e.clientY-viewDrag.y);
      viewDrag.x=e.clientX;viewDrag.y=e.clientY;return;
    }
    if(dragging){const p=ocean.pointToWorld(e.clientX,e.clientY);if(p)mouseTarget={x:p.x,z:p.z};}
  });
  for(const event of ['pointerup','pointercancel'])canvas.addEventListener(event,e=>{touches.delete(e.pointerId);if(touches.size<2){pinchDist=0;pinchMid=null;}if(viewDrag?.id===e.pointerId)viewDrag=null;dragging=false;mouseTarget=null;});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();if(game.status==='playing')pause();toast('图形连接中断，旅程已保存；重新加载可继续');});
}catch(error){$('loading').innerHTML='<span>三维场景未能启动</span><p>请使用支持 WebGL 的浏览器，并开启硬件加速。</p><button class="primary" onclick="location.reload()">重新加载</button>';console.error(error);}
$('start-btn').onclick=()=>startNew();$('new-run-btn').onclick=()=>startNew();$('home-guide').onclick=guide;$('guide-btn').onclick=guide;$('settings-btn').onclick=settings;$('difficulty-btn').onclick=difficulty;$('quality-btn').onclick=quality;$('pause-btn').onclick=pause;$('archive-btn').onclick=showArchive;$('dash-btn').onclick=()=>game.dash();$('ability-btn').onclick=()=>game.ability();$('mobile-dash').onclick=()=>game.dash();$('view-btn').onclick=()=>setView();
// Mobile ability: short tap casts; holding 250ms previews the pulse radius first.
let abilityHold=null,abilityPreview=false;
const abilityBtn=$('mobile-ability');
abilityBtn.addEventListener('pointerdown',e=>{e.preventDefault();abilityPreview=false;clearTimeout(abilityHold);abilityHold=setTimeout(()=>{abilityPreview=true;const r=(game.player.radius*4+9)*(game.hasSynergy?.('storm')?1.3:1);ocean?.ripple?.(game.player.x,game.player.z,r,0x9bd6ff);toast('技能范围 · 松开释放');},250);});
for(const ev of ['pointerup','pointercancel'])abilityBtn.addEventListener(ev,e=>{e.preventDefault();clearTimeout(abilityHold);if(game.status==='playing')game.ability();abilityPreview=false;});
$('continue-card').onclick=()=>{if(game.status!=='home')return;if(pending)restore();else toast('还没有可继续的旅程');};
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{if(game.status!=='home')return;const m=b.dataset.mode;if(m==='continue')return;archive.mode=m;saveArchive();game.reset(selectedBiome(),{mode:m,lifeLevel:archive.lifeLevel||0});refreshHome();});
document.querySelectorAll('[data-biome]').forEach(b=>b.onclick=()=>{if(game.status!=='home'||archive.mode!=='free')return;archive.biome=b.dataset.biome;saveArchive();game.reset(selectedBiome());refreshHome();});
document.querySelectorAll('[data-morph]').forEach(b=>b.onclick=()=>{if(game.status!=='home'||!ocean)return;const stage=Number(b.dataset.morph);ocean.previewStage=stage;ocean.periodOverride=-1;ocean.applyPeriod(stage);$('morph-title').textContent='生命图谱 / '+MORPHS[stage].name;$('morph-hint').textContent=MORPHS[stage].hint+' · '+PERIODS[stage].story;$('morph-mass').textContent=MORPHS[stage].mass+' μ · 点击下方预览进化';document.querySelectorAll('[data-morph]').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',String(x===b));});updateChapters();});
$('sound-btn').onclick=async()=>{try{await music.init();const muted=music.mute();$('sound-btn').textContent=muted?'♪̸':'♫';$('sound-btn').setAttribute('aria-label',muted?'开启声音':'关闭声音');if(game.status==='playing')music.start(game.beatPosition);}catch{toast('声音未能启动，请检查浏览器声音权限');}};
addEventListener('keydown',e=>{
  if(!$('overlay').classList.contains('hidden')){if(e.key==='Tab'){const list=[...$('dialog').querySelectorAll('button:not(:disabled),input')];if(list.length){if(e.shiftKey&&document.activeElement===list[0]){e.preventDefault();list.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===list.at(-1)){e.preventDefault();list[0].focus();}}}if(e.key==='Escape')dialogEsc?.();return;}
  const k=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();if(e.repeat)return;
  if(k==='+'||k==='='||k==='-'||k==='_'){ocean?.adjustZoom((k==='+'||k==='='?-.12:.12)*Math.max(.4,ocean?.zoomTarget||1));return;}
  if(k==='v'){setView();return;}
  if(k==='1'){setView('follow');return;}if(k==='2'){setView('orbit');return;}if(k==='3'){setView('first');return;}
  if(k==='escape'||k==='p')pause();else if(k===' ')game.dash();else if(k==='e')game.ability();else if(k==='m')$('sound-btn').click();else keys.add(k);
});addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
addEventListener('resize',()=>applyTouchMode());
addEventListener('blur',()=>{releaseInput();if(game.status==='playing')pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&game.status==='playing')pause();});addEventListener('pagehide',checkpoint);
const joystick=$('joystick');function moveStick(e){const b=joystick.getBoundingClientRect(),dx=e.clientX-(b.left+b.width/2),dy=e.clientY-(b.top+b.height/2),d=Math.hypot(dx,dy),scale=d>39?39/d:1;stick.x=dx*scale/39;stick.z=dy*scale/39;$('joystick-knob').style.transform=`translate(${dx*scale}px,${dy*scale}px)`;}
joystick.addEventListener('pointerdown',e=>{if(game.status!=='playing')return;stickId=e.pointerId;joystick.setPointerCapture(e.pointerId);moveStick(e);});joystick.addEventListener('pointermove',e=>{if(e.pointerId===stickId)moveStick(e);});for(const e of ['pointerup','pointercancel'])joystick.addEventListener(e,()=>{stickId=null;stick.x=stick.z=0;$('joystick-knob').style.transform='';});
refreshHome();requestAnimationFrame(frame);
window.symphonySnapshot=()=>({status:game.status,mode:game.mode,chapter:game.chapter,mass:Math.round(game.player.mass),health:game.health,time:Math.round(game.time),traits:[...game.traits],echoes:game.echoes,structures:game.stats.structures,audio:music.ctx?.state||'not-started'});
