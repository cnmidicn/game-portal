import {Game,BIOMES,TRAITS,EVOLUTIONS} from './game.js';
import {SPECIALIZATIONS} from './evolution.js';
import {DAILY_RULES} from './daily-rules.js';
import {SeededRandom,hashSeed} from './random.js';
import {STRUCTURE_TYPES} from './world.js';
const terminal=new Set(['dead','complete','timeup']);
export function encodeRun(game){
  if(game.status==='home'||terminal.has(game.status))return null;
  const model={};for(const [key,value]of Object.entries(game)){if(['externalRandom','random','rng','events','effects','biome'].includes(key))continue;model[key]=value instanceof Set?[...value]:value;}
  model.biome=game.biome.id;model.rngState=game.rng?.state??null;model.status=['evolution','interlude','victory'].includes(game.status)?game.status:'paused';
  model.creatures=game.creatures.map(c=>{const{graze,...rest}=c;return{...rest,grazeId:graze?.id??null};});
  const payload=JSON.stringify(model);return JSON.stringify({kind:'symphony-run',version:3,savedAt:Date.now(),checksum:hashSeed(payload),payload});
}
function safeNumbers(value,depth=0){if(depth>12)return false;if(typeof value==='number')return Number.isFinite(value)&&Math.abs(value)<1e12;if(value===null||typeof value==='string'||typeof value==='boolean')return true;if(Array.isArray(value))return value.length<=1000&&value.every(v=>safeNumbers(v,depth+1));if(typeof value==='object')return Object.keys(value).length<100&&Object.entries(value).every(([k,v])=>!['__proto__','constructor','prototype'].includes(k)&&safeNumbers(v,depth+1));return false;}
export function decodeRun(text){
  try{
    if(typeof text!=='string'||text.length>700000)return null;const envelope=JSON.parse(text);if(envelope.kind!=='symphony-run'||![2,3].includes(envelope.version)||typeof envelope.payload!=='string'||hashSeed(envelope.payload)!==envelope.checksum)return null;
    const m=JSON.parse(envelope.payload);if(!safeNumbers(m)||!['free','daily','expedition'].includes(m.mode)||!BIOMES.some(b=>b.id===m.biome)||!['paused','evolution','interlude','victory'].includes(m.status))return null;
    if(!m.player||m.player.mass<8||Math.abs(m.player.x)>190||Math.abs(m.player.z)>190||m.health<1||m.health>10||m.maxHealth<m.health||m.maxHealth>10||m.stage<0||m.stage>4||m.chapter<0||m.chapter>2||m.time<0||m.time>360000||m.uid<0)return null;
    for(const [key,max]of [['food',500],['creatures',100],['structures',80],['hazards',100],['waves',150]])if(!Array.isArray(m[key])||m[key].length>max||m[key].some(o=>!o||typeof o.x!=='number'||typeof o.z!=='number'||Math.abs(o.x)>500||Math.abs(o.z)>500))return null;
    if(m.structures.some(s=>!STRUCTURE_TYPES[s.type])||m.waves.some(w=>!['ring','bolt'].includes(w.type))||!Array.isArray(m.traits)||new Set(m.traits).size!==m.traits.length||m.traits.some(id=>!TRAITS.some(t=>t.id===id)))return null;
    if(!Array.isArray(m.choices)||m.choices.some(c=>!EVOLUTIONS.some(t=>t.id===c.id))||m.status==='evolution'&&m.choices.length===0)return null;
    if(m.dailyKey&&!/^\d{4}-\d{2}-\d{2}$/.test(m.dailyKey))return null;
    const game=new Game();game.reset(m.biome,{mode:m.mode,difficulty:m.difficulty,seed:m.seed??undefined,dailyKey:m.dailyKey});
    if(envelope.version===2){for(const key of ['rareCaught','legacyEvolution','beatPosition','lastRhythmBeat','rhythmEnergy','rhythmHits','rhythmBonus','crescendoTime','specializations'])m[key]=game[key];m.dailyRule='classic';m.legacyEvolution=true;m.beatPosition=m.time*game.biome.bpm/60;}
    if(!DAILY_RULES.some(r=>r.id===m.dailyRule)||!Array.isArray(m.specializations)||new Set(m.specializations).size!==m.specializations.length||m.specializations.some(id=>!SPECIALIZATIONS.some(s=>s.id===id&&m.traits.includes(s.trait)))||new Set(m.specializations.map(id=>SPECIALIZATIONS.find(s=>s.id===id)?.trait)).size!==m.specializations.length)return null;
    for(const [key,value]of Object.entries(game)){if(typeof value==='number'&&typeof m[key]!=='number'||typeof value==='boolean'&&typeof m[key]!=='boolean')return null;}
    if(!['normal','relaxed','master'].includes(m.difficulty)||typeof m.runId!=='string'||m.runId.length>70||!m.stats||!m.challenge||!Array.isArray(m.challengeOrder)||!Array.isArray(m.campaignHistory))return null;
    for(const key of ['x','z','mass','radius','vx','vz'])if(typeof m.player[key]!=='number')return null;
    if(m.player.radius<=0||m.player.radius>40||m.player.mass>1e8||Object.keys(game.stats).some(k=>typeof m.stats[k]!=='number'))return null;
    const questIds=['combo','food','prey','dash','survive'];if(!questIds.includes(m.challenge.id)||['progress','target','baseline'].some(k=>typeof m.challenge[k]!=='number')||m.challenge.target<=0||m.challengeOrder.some(q=>!questIds.includes(q.id)))return null;
    if(m.campaignHistory.length>3||m.campaignHistory.some(h=>!BIOMES.some(b=>b.id===h.biome))||m.food.some(f=>typeof f.value!=='number')||m.creatures.some(c=>!Number.isInteger(c.kind)||c.kind<0||c.kind>4||typeof c.mass!=='number'||c.mass<=0||typeof c.radius!=='number'||c.radius<=0||c.boss&&!BIOMES.some(b=>b.id===c.variant)))return null;
    for(const key of ['species','seenSynergies','collectedStructures'])if(!Array.isArray(m[key]))return null;
    for(const key of Object.keys(game))if(!['random','externalRandom','rng','biome','events','effects'].includes(key)&&Object.hasOwn(m,key))game[key]=m[key];
    game.biome={...BIOMES.find(b=>b.id===m.biome)};if(game.rule().bpm)game.biome.bpm=game.rule().bpm;game.seenSynergies=new Set(m.seenSynergies);game.collectedStructures=new Set(m.collectedStructures);game.species=new Set(m.species);game.events=[];game.effects=[];
    game.choices=m.choices.map(c=>EVOLUTIONS.find(t=>t.id===c.id));
    if(m.seed!==null){game.rng=new SeededRandom(m.seed,m.rngState);game.random=()=>game.rng.next();}
    for(const c of game.creatures){c.graze=game.food.find(f=>f.id===c.grazeId)||null;delete c.grazeId;}
    return{game,savedAt:envelope.savedAt};
  }catch{return null;}
}
export class CheckpointStore{
  constructor(storage){this.storage=storage;this.available=true;}
  save(game){try{const text=encodeRun(game);if(!text){this.clear();return true;}const previous=this.storage.getItem('symphony-run');if(previous&&decodeRun(previous))this.storage.setItem('symphony-run-backup',previous);this.storage.setItem('symphony-run',text);return true;}catch{this.available=false;return false;}}
  load(){try{const current=this.storage.getItem('symphony-run'),decoded=decodeRun(current);if(decoded)return{...decoded,recovered:false};const backup=decodeRun(this.storage.getItem('symphony-run-backup'));return backup?{...backup,recovered:true}:null;}catch{this.available=false;return null;}}
  clear(){try{this.storage.removeItem('symphony-run');this.storage.removeItem('symphony-run-backup');}catch{this.available=false;}}
}
