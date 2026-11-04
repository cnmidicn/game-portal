import {SYNERGIES} from './ecology.js';
import {SPECIALIZATIONS} from './evolution.js';
import {DAILY_RULES} from './daily-rules.js';
export const FORMS=[
  {id:'primordial',icon:'◉',name:'原初细胞',desc:'纯粹的生命起点。三次进化，自由决定成长方向。',unlock:()=>true,condition:'初始形态',trait:null},
  {id:'echo',icon:'♫',name:'回声细胞',desc:'自带和声共生：连击持续更久，质量收益增加。',unlock:a=>a.bestCombo>=25,condition:'达成一次 25 连击',trait:'harmony'},
  {id:'tide',icon:'➶',name:'潮汐细胞',desc:'自带流线鳍翼：更快游动，冲刺期间受到保护。',unlock:a=>a.best>=280,condition:'单局成长至 280 μ',trait:'speed'},
  {id:'crystal',icon:'⬡',name:'晶体细胞',desc:'自带晶体护膜：以四层护膜开始新的远征。',unlock:a=>a.wins>=1,condition:'首次吞噬海域霸主',trait:'shell'}
];
export const BADGES=[
  {id:'first',icon:'✧',name:'第一缕微光',desc:'首次成长至 32 μ',unlock:a=>a.best>=32},
  {id:'hunter',icon:'◈',name:'深蓝猎手',desc:'成长至 100 μ',unlock:a=>a.best>=100},
  {id:'giant',icon:'⬡',name:'深海巨兽',desc:'成长至 280 μ',unlock:a=>a.best>=280},
  {id:'king',icon:'♛',name:'海的指挥家',desc:'首次击败海域霸主',unlock:a=>a.wins>=1},
  {id:'chain',icon:'♫',name:'连锁共鸣',desc:'达成 25 连击',unlock:a=>a.bestCombo>=25},
  {id:'virtuoso',icon:'♬',name:'生命演奏家',desc:'达成 60 连击',unlock:a=>a.bestCombo>=60},
  {id:'collector',icon:'◎',name:'生命收藏家',desc:'收集全部 5 种生物',unlock:a=>a.species.length>=5},
  {id:'traveler',icon:'⌁',name:'三海旅人',desc:'探索全部 3 个海域',unlock:a=>a.visited.length>=3},
  {id:'quest',icon:'✦',name:'愿望收集者',desc:'累计完成 10 个局内挑战',unlock:a=>a.challenges>=10},
  {id:'lagoon',icon:'◉',name:'浅海之声',desc:'在微光浅海击败霸主',unlock:a=>(a.biomes.lagoon?.wins||0)>0},
  {id:'tides',icon:'➶',name:'逐浪之歌',desc:'在潮汐回廊击败霸主',unlock:a=>(a.biomes.tide?.wins||0)>0},
  {id:'abyss',icon:'⋄',name:'深渊回响',desc:'在晶簇深渊击败霸主',unlock:a=>(a.biomes.crystal?.wins||0)>0},
  {id:'fusion',icon:'✺',name:'生命协奏',desc:'发现第一种进化组合',unlock:a=>a.synergies.length>=1},
  {id:'composer',icon:'♬',name:'进化作曲家',desc:'发现 4 种不同进化组合',unlock:a=>a.synergies.length>=4},
  {id:'symphony',icon:'✦',name:'生命的终章',desc:'完成一次三海远征',unlock:a=>a.expeditions>=1},
  {id:'worldeater',icon:'⬡',name:'世界吞噬者',desc:'吞噬四类巨型目标',unlock:a=>a.structures.length>=4},
  {id:'daily',icon:'⌁',name:'潮汐见证者',desc:'完成一次五分钟每日挑战',unlock:a=>Object.values(a.daily).some(d=>d.survived)}
];
const finite=(v,floor=0)=>typeof v==='number'&&Number.isFinite(v)?Math.max(floor,v):floor;
export function normalizeArchive(raw={}){
  if(!raw||typeof raw!=='object')raw={};
  const a={best:finite(raw.best,8),runs:Math.floor(finite(raw.runs)),wins:Math.floor(finite(raw.wins)),bestCombo:Math.floor(finite(raw.bestCombo)),challenges:Math.floor(finite(raw.challenges)),species:[...new Set(Array.isArray(raw.species)?raw.species.filter(i=>Number.isInteger(i)&&i>=0&&i<=4):[])],visited:[...new Set(Array.isArray(raw.visited)?raw.visited.filter(i=>['lagoon','tide','crystal'].includes(i)):[])],form:FORMS.some(f=>f.id===raw.form)?raw.form:'primordial',biome:['lagoon','tide','crystal'].includes(raw.biome)?raw.biome:'lagoon',biomes:{},volume:typeof raw.volume==='number'?Math.min(1,Math.max(0,raw.volume)):.48,quality:raw.quality==='low'?'low':'high'};
  for(const id of ['lagoon','tide','crystal']){const b=raw.biomes?.[id]||{};a.biomes[id]={best:finite(b.best,8),wins:Math.floor(finite(b.wins)),runs:Math.floor(finite(b.runs))};}
  a.synergies=[...new Set(Array.isArray(raw.synergies)?raw.synergies.filter(id=>SYNERGIES.some(s=>s.id===id)):[])];
  a.specializations=[...new Set(Array.isArray(raw.specializations)?raw.specializations.filter(id=>SPECIALIZATIONS.some(s=>s.id===id)):[])];
  a.mode=['free','daily','expedition'].includes(raw.mode)?raw.mode:'expedition';a.difficulty=['normal','relaxed','master'].includes(raw.difficulty)?raw.difficulty:'normal';a.expeditions=Math.floor(finite(raw.expeditions));a.structures=[...new Set(Array.isArray(raw.structures)?raw.structures.filter(s=>['reef','wreck','island','storm'].includes(s)):[])];a.runIds=Array.isArray(raw.runIds)?raw.runIds.filter(id=>typeof id==='string'&&/^[a-zA-Z0-9-]{1,70}$/.test(id)).slice(-100):[];a.daily={};
  a.runLedgers={};for(const id of a.runIds){const l=raw.runLedgers?.[id]||{};a.runLedgers[id]={visited:Array.isArray(l.visited)?l.visited.filter(b=>['lagoon','tide','crystal'].includes(b)):[],bosses:{},challenges:finite(l.challenges),completed:!!l.completed};for(const b of ['lagoon','tide','crystal'])a.runLedgers[id].bosses[b]=Math.floor(finite(l.bosses?.[b]));}
  for(const [key,value]of Object.entries(raw.daily||{}).slice(-30))if(/^\d{4}-\d{2}-\d{2}$/.test(key)&&value&&typeof value==='object'){const scores={};for(const rule of DAILY_RULES)if(typeof value.scores?.[rule.id]==='number')scores[rule.id]=Math.round(finite(value.scores[rule.id]));if(!Object.keys(scores).length)scores.classic=Math.round(finite(value.score));a.daily[key]={score:Math.round(finite(value.score)),attempts:Math.floor(finite(value.attempts)),survived:!!value.survived,scores};}
  if(a.difficulty==='master'&&a.expeditions===0)a.difficulty='normal';
  if(!raw.biomes&&a.runs>0){a.biomes.lagoon={best:a.best,wins:a.wins,runs:a.runs};if(!a.visited.includes('lagoon'))a.visited.push('lagoon');}
  if(!FORMS.find(f=>f.id===a.form).unlock(a))a.form='primordial';return a;
}
export function unlocked(a){return [...FORMS.filter(f=>f.id!=='primordial'&&f.unlock(a)).map(f=>({key:'form:'+f.id,name:f.name,type:'新起始形态'})),...BADGES.filter(b=>b.unlock(a)).map(b=>({key:'badge:'+b.id,name:b.name,type:'新生命徽章'}))];}
export function recordRun(a,g){
  if(!g.runId||g.time<.5)return[];const old=new Set(unlocked(a).map(x=>x.key)),ids=['lagoon','tide','crystal'];
  if(g.mode==='daily')a.daily[g.dailyKey]??={score:0,attempts:0,survived:false};
  if(!a.runIds.includes(g.runId)){a.runIds.push(g.runId);a.runs++;if(g.mode==='daily')a.daily[g.dailyKey].attempts++;}
  while(a.runIds.length>100)delete a.runLedgers[a.runIds.shift()];
  const l=a.runLedgers[g.runId]??={visited:[],bosses:{lagoon:0,tide:0,crystal:0},challenges:0,completed:false},b=g.biome.id;
  if(!l.visited.includes(b)){l.visited.push(b);a.biomes[b].runs++;}a.visited=[...new Set([...a.visited,b])];
  a.best=Math.max(a.best,g.peakMass);a.bestCombo=Math.max(a.bestCombo,g.bestCombo);a.biomes[b].best=Math.max(a.biomes[b].best,g.player.mass);a.species=[...new Set([...a.species,...g.species])];a.synergies=[...new Set([...a.synergies,...g.seenSynergies])];a.structures=[...new Set([...a.structures,...g.collectedStructures])];a.specializations=[...new Set([...a.specializations,...(g.specializations||[])])];
  for(const id of ids){const total=g.mode==='expedition'?g.campaignHistory.filter(h=>h.biome===id).length:id===b?g.stats.bosses:0,delta=Math.max(0,total-(l.bosses[id]||0));a.wins+=delta;a.biomes[id].wins+=delta;l.bosses[id]=Math.max(l.bosses[id]||0,total);}
  a.challenges+=Math.max(0,g.completedChallenges-l.challenges);l.challenges=Math.max(l.challenges,g.completedChallenges);
  if(g.status==='complete'&&!l.completed){a.expeditions++;l.completed=true;}
  if(g.mode==='daily'){const d=a.daily[g.dailyKey];d.score=Math.max(d.score,g.score());d.scores??={};d.scores[g.dailyRule||'classic']=Math.max(d.scores[g.dailyRule||'classic']||0,g.score());if(g.status==='timeup')d.survived=true;}
  return unlocked(a).filter(x=>!old.has(x.key));
}
export function dailyBest(archive,key,rule){const entry=archive.daily[key];return entry?.scores?.[rule]||(rule==='classic'?entry?.score:0)||0;}
