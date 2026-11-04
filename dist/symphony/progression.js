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
  {id:'abyss',icon:'⋄',name:'深渊回响',desc:'在晶簇深渊击败霸主',unlock:a=>(a.biomes.crystal?.wins||0)>0}
];
const finite=(v,floor=0)=>typeof v==='number'&&Number.isFinite(v)?Math.max(floor,v):floor;
export function normalizeArchive(raw={}){
  if(!raw||typeof raw!=='object')raw={};
  const a={best:finite(raw.best,8),runs:Math.floor(finite(raw.runs)),wins:Math.floor(finite(raw.wins)),bestCombo:Math.floor(finite(raw.bestCombo)),challenges:Math.floor(finite(raw.challenges)),species:[...new Set(Array.isArray(raw.species)?raw.species.filter(i=>Number.isInteger(i)&&i>=0&&i<=4):[])],visited:[...new Set(Array.isArray(raw.visited)?raw.visited.filter(i=>['lagoon','tide','crystal'].includes(i)):[])],form:FORMS.some(f=>f.id===raw.form)?raw.form:'primordial',biome:['lagoon','tide','crystal'].includes(raw.biome)?raw.biome:'lagoon',biomes:{},volume:typeof raw.volume==='number'?Math.min(1,Math.max(0,raw.volume)):.48,quality:raw.quality==='low'?'low':'high'};
  for(const id of ['lagoon','tide','crystal']){const b=raw.biomes?.[id]||{};a.biomes[id]={best:finite(b.best,8),wins:Math.floor(finite(b.wins)),runs:Math.floor(finite(b.runs))};}
  if(!raw.biomes&&a.runs>0){a.biomes.lagoon={best:a.best,wins:a.wins,runs:a.runs};if(!a.visited.includes('lagoon'))a.visited.push('lagoon');}
  if(!FORMS.find(f=>f.id===a.form).unlock(a))a.form='primordial';return a;
}
export function unlocked(a){return [...FORMS.filter(f=>f.id!=='primordial'&&f.unlock(a)).map(f=>({key:'form:'+f.id,name:f.name,type:'新起始形态'})),...BADGES.filter(b=>b.unlock(a)).map(b=>({key:'badge:'+b.id,name:b.name,type:'新生命徽章'}))];}
