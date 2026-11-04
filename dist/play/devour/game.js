import {SYNERGIES,activeSynergies,preyOpen,creatureMotion} from './ecology.js';
import {SeededRandom} from './random.js';
import {CHAPTERS,initWorld,tickWorld,canAbsorbStructure,scoreFor} from './world.js';
import {tickBoss} from './bosses.js';
import {SPECIALIZATIONS,specializationChoices} from './evolution.js';
import {rhythmReward} from './rhythm.js';
import {dailyRule,ruleForDate} from './daily-rules.js';
export const STAGES = [
  { name:'原初细胞', mass:8, track:'原初 · Primordial', en:'THE PRIMORDIAL SEA' },
  { name:'流光幼体', mass:32, track:'微光 · First Light', en:'THE LUMINOUS GARDEN' },
  { name:'星翼猎手', mass:100, track:'潮汐 · Tidal Motion', en:'THE BLUE FRONTIER' },
  { name:'深渊游龙', mass:280, track:'深渊 · Into the Abyss', en:'THE SILENT ABYSS' },
  { name:'交响巨兽', mass:700, track:'交响 · Symphony of Life', en:'THE LEVIATHAN REALM' }
];
export const TRAITS = [
  {id:'mouth',icon:'◈',name:'巨口进化',desc:'吞噬范围 +30%。可以吞下接近自身体型的生物。',hint:'被动 · 正面吞噬'},
  {id:'magnet',icon:'◎',name:'引力触须',desc:'自动吸引周围营养。按 E 展开引力场，拖近猎物。',hint:'主动 · E 引力场'},
  {id:'electric',icon:'ϟ',name:'生物电流',desc:'按 E 释放电流，麻痹附近天敌，争取逃生或捕食时间。',hint:'主动 · E 电流脉冲'},
  {id:'speed',icon:'➶',name:'流线鳍翼',desc:'游动速度 +22%，冲刺恢复加快，冲刺期间获得保护。',hint:'被动 · 灵活游动'},
  {id:'harmony',icon:'♫',name:'和声共生',desc:'连击持续更久，吞噬获得的质量 +20%。',hint:'被动 · 加速成长'},
  {id:'shell',icon:'⬡',name:'晶体护膜',desc:'立即修复全部护膜，并增加一层护膜上限。',hint:'被动 · 生存保护'}
];
export const BIOMES = [
  {id:'lagoon',name:'微光浅海',en:'THE LUMINOUS LAGOON',tag:'舒缓探索',desc:'平静水域，适合熟悉吞噬与进化。',color:'#a9f5cb',background:'#061c23',floor:'#103c3a',bpm:80,root:0},
  {id:'tide',name:'潮汐回廊',en:'THE TIDAL PASSAGE',tag:'顺流捕食',desc:'利用流动的海流，追逐丰盛的营养带。',color:'#91d8f4',background:'#081a30',floor:'#123c62',bpm:88,root:2},
  {id:'crystal',name:'晶簇深渊',en:'THE CRYSTAL ABYSS',tag:'危险与馈赠',desc:'晶簇蓄力后释放脉冲；紫色预警时远离。',color:'#d5b6f8',background:'#1b142c',floor:'#422853',bpm:92,root:-2}
];
export const EVOLUTIONS=[...TRAITS,...SPECIALIZATIONS];
const CHALLENGES=[
  {id:'combo',name:'连锁共鸣',desc:'连续吞噬，达成 15 连击',target:15},
  {id:'food',name:'微光采集者',desc:'收集 35 颗营养微光',target:35},
  {id:'prey',name:'食物链跃迁',desc:'吞噬 6 只小型生物',target:6},
  {id:'dash',name:'逐浪而行',desc:'使用 4 次冲刺',target:4},
  {id:'survive',name:'生命的韧性',desc:'继续存活 45 秒',target:45}
];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const radiusFor=m=>Math.min(28,.85*Math.sqrt(m/8));
export class Game {
  constructor(random=Math.random){this.externalRandom=random;this.random=random;this.reset();}
  reset(biome='lagoon',options={}){
    this.sceneEpoch=(this.sceneEpoch||0)+1;
    this.mode=['expedition','daily','free'].includes(options.mode)?options.mode:'free';this.difficulty=['relaxed','master'].includes(options.difficulty)?options.difficulty:'normal';this.seed=options.seed===undefined?null:String(options.seed);this.rng=this.seed===null?null:new SeededRandom(this.seed);this.random=this.rng?()=>this.rng.next():this.externalRandom;this.uid=0;
    this.chapter=0;this.goalMass=700;this.campaignHistory=[];this.dailyKey=options.dailyKey||'';this.dailyLimit=300;this.endlessWave=0;this.waveTime=0;this.collectedStructures=new Set();
    this.dailyRule=this.mode==='daily'?(options.dailyRule?dailyRule(options.dailyRule):ruleForDate(this.dailyKey)).id:'classic';this.rareCaught=0;
    this.runId='';this.ledger={counted:false,challenges:0,bosses:{lagoon:0,tide:0,crystal:0},visited:[],completed:false};
    this.biome={...(BIOMES.find(b=>b.id===biome)||BIOMES[0])};if(this.rule().bpm)this.biome.bpm=this.rule().bpm;this.hazards=[];
    this.status='home';this.player={x:0,z:0,mass:8,radius:radiusFor(8),vx:0,vz:0};
    this.food=[];this.creatures=[];this.effects=[];this.events=[];this.time=0;this.stage=0;this.accumulator=0;
    this.health=this.difficulty==='relaxed'?5:3;this.maxHealth=this.health;this.invincible=0;this.dashCd=0;this.dashTime=0;this.abilityCd=0;this.abilityTime=0;
    this.traits=[];this.evoCount=0;this.choices=[];this.combo=0;this.comboTime=0;this.bestCombo=0;this.eaten=0;this.species=new Set();this.spawnClock=0;this.won=false;this.danger=false;this.peakMass=8;this.endless=false;
    this.specializations=[];this.legacyEvolution=false;this.beatPosition=0;this.lastRhythmBeat=0;this.rhythmEnergy=0;this.rhythmHits=0;this.rhythmBonus=0;this.crescendoTime=0;
    this.stats={food:0,prey:0,dash:0,normalPrey:0,shells:0,structures:0,bosses:0};this.noticeCd=0;this.chorusCd=0;this.seenSynergies=new Set();this.completedChallenges=0;this.challengeIndex=0;this.challengeOrder=this.shuffle(CHALLENGES);this.challenge=null;this.challengeWait=0;this.nextChallenge();
    for(let i=0;i<240;i++)this.spawnFood(i<170?35:135);
    for(let i=0;i<40;i++)this.spawnCreature(true);
    // An inviting, immediately readable trail in front of the starting cell.
    for(let i=0;i<18;i++){let a=i*.65;this.food.push({id:this.allocateId(),x:Math.sin(a)*(3+i*.34),z:-3-i*.68,value:1,hue:i%4});}
    initWorld(this);
  }
  allocateId(){return ++this.uid;}
  emit(type,data={}){this.events.push({...data,type});}
  rnd(a,b){return a+(b-a)*this.random();}
  shuffle(items){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
  nextChallenge(){const template=this.challengeOrder[this.challengeIndex++%this.challengeOrder.length];this.challenge={...template,progress:0,done:false,baseline:template.id==='survive'?this.time:this.stats[template.id]||0};}
  checkChallenge(){const q=this.challenge;if(!q||q.done)return;const value=q.id==='combo'?this.combo:q.id==='survive'?this.time-q.baseline:(this.stats[q.id]||0)-q.baseline;q.progress=Math.min(q.target,Math.floor(value));if(q.progress<q.target)return;q.done=true;this.completedChallenges++;this.challengeWait=5;const bloom=this.specialized('harmony-bloom');this.health=Math.min(this.maxHealth,this.health+(bloom?2:1));for(let i=0;i<(bloom?30:18);i++)this.spawnFood(this.player.radius+7);this.emit('challenge',{name:q.name});}
  rule(){return dailyRule(this.dailyRule);}
  currentAt(x,z){if(this.biome.id!=='tide')return{x:0,z:0};const power=this.rule().current;return{x:Math.sin(z*.035+this.time*.12)*2.8*power,z:Math.cos(x*.035-this.time*.1)*2.1*power};}
  start(){this.status='playing';this.emit('start');}
  spawnFood(range=55){
    const a=this.rnd(0,Math.PI*2),r=Math.sqrt(this.random())*range,p=this.player;
    this.food.push({id:this.allocateId(),x:clamp(p.x+Math.cos(a)*r,-175,175),z:clamp(p.z+Math.sin(a)*r,-175,175),value:this.random()<(this.dailyRule==='bloom'?.42:this.biome.id==='lagoon'?.12:.22)?3:1,hue:Math.floor(this.rnd(0,4))});
  }
  spawnCreature(initial=false){
    const p=this.player,a=this.rnd(0,Math.PI*2);
    const ceiling=this.endless?Math.max(1800,p.mass*1.5):this.goalMass*.8;
    const tiers=initial?[4,5,6,11,17,28,42,70]:[Math.max(4,p.mass*.2),p.mass*.38,p.mass*.6,p.mass*1.3,p.mass*1.8].map(m=>Math.min(ceiling,m));
    const mass=tiers[Math.floor(this.random()*tiers.length)],r=this.rnd(initial?(mass>p.mass?38:10):26,initial?(mass>p.mass?95:50):76);
    this.creatures.push({id:this.allocateId(),x:clamp(p.x+Math.cos(a)*r,-170,170),z:clamp(p.z+Math.sin(a)*r,-170,170),mass,radius:radiusFor(mass),angle:this.rnd(0,7),phase:this.rnd(0,8),kind:Math.floor(this.rnd(0,4)),stun:0,boss:false,state:'drift',attackClock:0});
    if(this.rule().rare&&this.random()<this.rule().rare)this.creatures.at(-1).rare=true;
  }
  canAbsorb(s){return canAbsorbStructure(this,s);}
  score(){return scoreFor(this);}
  spawnBoss(){const a=this.rnd(0,7),p=this.player,mass=this.goalMass*.8;this.creatures.push({id:this.allocateId(),x:clamp(p.x+Math.cos(a)*48,-165,165),z:clamp(p.z+Math.sin(a)*48,-165,165),mass,radius:radiusFor(mass),angle:a,phase:0,kind:4,stun:0,boss:true,variant:this.biome.id,requiredMass:this.goalMass,clock:0,state:'guard'});this.emit('boss');}
  finishBoss(){
    this.bossDefeated=true;this.stats.bosses++;
    if(this.mode==='expedition'){
      this.campaignHistory.push({biome:this.biome.id,time:this.chapterTime,mass:this.player.mass,traits:[...this.traits]});
      if(this.chapter<2){this.status='interlude';this.emit('chapterComplete',{chapter:this.chapter});}
      else{this.creatures=[];this.hazards=[];this.waves=[];this.emit('finalHeart');}
    }else if(this.mode==='daily'){this.won=true;this.emit('dailyBoss');}
    else if(this.endless){this.endlessWave++;this.waveTime=0;this.goalMass=Math.max(700,this.player.mass*.9);this.emit('endlessWave',{wave:this.endlessWave});}
    else{this.won=true;this.status='victory';this.emit('end',{won:true});}
  }
  nextChapter(){
    if(this.mode!=='expedition'||this.status!=='interlude'||this.chapter>=2)return false;
    this.chapter++;this.sceneEpoch++;this.biome=BIOMES.find(b=>b.id===CHAPTERS[this.chapter].biome);this.goalMass=CHAPTERS[this.chapter].goal;this.health=this.maxHealth;this.invincible=5;this.player.x=this.player.z=this.player.vx=this.player.vz=0;this.food=[];this.creatures=[];this.spawnClock=0;initWorld(this);
    for(let i=0;i<160;i++)this.spawnFood(i<80?45:130);for(let i=0;i<18;i++)this.spawnCreature();
    this.status='playing';this.emit('chapter',{chapter:this.chapter});this.offerEvolution(true);return true;
  }
  specialized(id){return this.specializations.includes(id);}
  offerEvolution(crossChapter=false){const base=this.traits.length<(this.legacyEvolution?6:4)?this.shuffle(TRAITS.filter(t=>!this.traits.includes(t.id))):[];this.choices=crossChapter?this.shuffle([...base.slice(0,1),...this.shuffle(specializationChoices(this)).slice(0,3)]).slice(0,3):base.slice(0,3);if(this.choices.length){this.status='evolution';this.emit('evolution');}}
  dashCooldown(){return this.specialized('speed-blink')?2.1:this.specialized('speed-current')?3.4:this.traits.includes('speed')?2.8:4;}
  abilityCooldown(){return this.specialized('electric-capacitor')?5:this.specialized('magnet-vortex')?10:8;}
  continueEndless(){if(this.mode!=='free'||this.status!=='victory')return false;this.endless=true;this.endlessWave=1;this.waveTime=0;this.invincible=4;this.status='playing';return true;}
  hasSynergy(id){const recipe=SYNERGIES.find(s=>s.id===id);return !!recipe&&recipe.traits.every(t=>this.traits.includes(t));}
  synergies(){return activeSynergies(this.traits);}
  refreshSynergies(){for(const s of this.synergies())if(!this.seenSynergies.has(s.id)){this.seenSynergies.add(s.id);this.emit('synergy',{id:s.id,name:s.name});}}
  massFits(c){const ratio=this.dashTime>0&&this.hasSynergy('ambush')&&!c.boss ? .85 : this.traits.includes('mouth')?1.02:1.18;return this.player.mass>c.mass*ratio;}
  canEat(c){return this.massFits(c)&&preyOpen(this,c);}
  isDangerous(c){if(c.stun>0)return false;return c.boss?!this.canEat(c):(c.kind===2&&c.state==='pulse')||(!this.canEat(c)&&c.mass>this.player.mass*1.18);}
  pulse(radius,seconds,chain=false){const p=this.player,visited=new Set(),queue=this.creatures.filter(c=>Math.hypot(c.x-p.x,c.z-p.z)<radius);for(let i=0;i<queue.length;i++){const c=queue[i];if(visited.has(c))continue;visited.add(c);c.stun=Math.max(c.stun||0,c.boss?Math.min(seconds,1.8):seconds);if(chain)for(const n of this.creatures)if(!visited.has(n)&&Math.hypot(n.x-c.x,n.z-c.z)<7+c.radius+n.radius&&!queue.includes(n))queue.push(n);}this.waves=this.waves.filter(w=>w.type==='ring'?Math.abs(Math.hypot(w.x-p.x,w.z-p.z)-w.radius)>radius:Math.hypot(w.x-p.x,w.z-p.z)>radius);return visited.size;}
  harvest(c){
    if(c.boss)return;this.stats.normalPrey++;let heal=false;
    if(c.kind===1)this.dashCd=Math.max(0,this.dashCd-1.25);
    if(c.kind===2)this.abilityCd=Math.max(0,this.abilityCd-2);
    if(c.kind===3){this.stats.shells++;if(this.stats.shells%3===0)heal=true;}
    if(this.hasSynergy('furnace')&&this.stats.normalPrey%6===0)heal=true;
    if(heal&&this.health<this.maxHealth){this.health++;this.emit('repair');}
  }
  dash(){if(this.status!=='playing'||this.dashCd>0)return false;this.dashTime=this.specialized('speed-blink')?.3:this.specialized('speed-current')?.6:.45;this.dashCd=this.dashCooldown();this.stats.dash++;this.checkChallenge();this.emit('dash');return true;}
  ability(){
    if(this.status!=='playing'||this.abilityCd>0)return false;
    const electric=this.traits.includes('electric'),magnet=this.traits.includes('magnet');if(!electric&&!magnet)return false;
    this.abilityCd=this.abilityCooldown();this.abilityTime=2.5;this.emit('ability',{electric});
    if(electric)this.pulse((this.player.radius*4+9)*(this.hasSynergy('storm')?1.3:1)*(this.specialized('electric-chain')?1.35:this.specialized('electric-capacitor')?.8:1),4,this.hasSynergy('storm')||this.specialized('electric-chain'));
    return true;
  }
  gain(amount,x,z,kind=0){
    this.combo=this.comboTime>0?this.combo+1:1;this.comboTime=this.specialized('harmony-resonance')?8:this.traits.includes('harmony')?5:3;
    this.bestCombo=Math.max(this.bestCombo,this.combo);this.eaten++;
    const bonus=this.specialized('harmony-bloom')?1.3:this.traits.includes('harmony')?1.2:1;
    amount+=rhythmReward(this,amount);
    const assimilation=1/(1+Math.pow(Math.max(0,this.player.mass-this.goalMass)/Math.max(400,this.goalMass*.5),2));
    this.player.mass+=amount*bonus*assimilation;this.peakMass=Math.max(this.peakMass,this.player.mass);this.player.radius=radiusFor(this.player.mass);
    this.emit('eat',{x,z,amount,kind,combo:this.combo});
    if(this.hasSynergy('tempo')&&this.dashTime>0){this.dashCd=Math.max(0,this.dashCd-.3);this.comboTime+=1;}
    if(this.hasSynergy('chorus')&&this.combo%10===0&&this.chorusCd<=0){this.chorusCd=5;for(let i=0;i<8;i++)this.spawnFood(this.player.radius+7);this.emit('chorus');}
    while(this.stage<4&&this.player.mass>=STAGES[this.stage+1].mass){this.stage++;this.emit('stage',{stage:this.stage});}
    if(this.stage>this.evoCount&&this.evoCount<3&&this.status==='playing'){
      this.offerEvolution();
    }
    this.checkChallenge();
  }
  evolve(id){
    if(this.status!=='evolution'||!this.choices.some(t=>t.id===id))return false;
    const specialization=SPECIALIZATIONS.find(s=>s.id===id);if(specialization){if(!specializationChoices(this).some(s=>s.id===id))return false;this.specializations.push(id);}else{if(this.traits.includes(id)||this.traits.length>=(this.legacyEvolution?6:4))return false;this.traits.push(id);}this.evoCount++;if(id==='shell'||id==='shell-bastion'){this.maxHealth=Math.min(10,this.maxHealth+(id==='shell'?1:2));this.health=this.maxHealth;}
    this.health=Math.min(this.maxHealth,this.health+1);this.invincible=3;this.status='playing';this.emit('evolved',{id});
    this.dashCd=Math.min(this.dashCd,this.dashCooldown());this.abilityCd=Math.min(this.abilityCd,this.abilityCooldown());
    this.refreshSynergies();
    // Large gains can cross more than one evolution threshold; offer the rest in order.
    if(this.stage>this.evoCount&&this.evoCount<3)this.offerEvolution();
    return true;
  }
  damage(c){
    if(this.invincible>0||(this.dashTime>0&&this.traits.includes('speed')))return;
    this.health--;this.player.mass=Math.max(8,this.player.mass*.88);this.player.radius=radiusFor(this.player.mass);this.invincible=this.specialized('shell-echo')?4:3;this.combo=0;this.comboTime=0;
    const a=Math.atan2(this.player.z-c.z,this.player.x-c.x);this.player.x=clamp(this.player.x+Math.cos(a)*(c.radius+5),-180,180);this.player.z=clamp(this.player.z+Math.sin(a)*(c.radius+5),-180,180);c.stun=2;
    if(this.hasSynergy('reactor')){this.pulse(this.player.radius*3+8,3);this.emit('reactor');}
    this.emit('damage',{cause:c.hazard?'crystal':c.kind===2&&c.state==='pulse'?'jelly':'creature'});if(this.health<=0){this.status='dead';this.emit('end',{won:false});}
  }
  advance(dt,input={x:0,z:0}){
    if(this.status!=='playing'){this.accumulator=0;return;}
    this.accumulator+=Math.max(0,Math.min(dt,.25));
    while(this.accumulator>=1/60&&this.status==='playing'){this.accumulator-=1/60;this.update(1/60,input);}
    if(this.status!=='playing')this.accumulator=0;
  }
  update(dt,input={x:0,z:0}){
    if(this.status!=='playing')return;dt=Math.min(dt,.05);this.time+=dt;this.spawnClock+=dt;this.waveTime+=dt;
    this.beatPosition+=dt*this.biome.bpm/60;this.crescendoTime=Math.max(0,this.crescendoTime-dt);if(this.beatPosition-this.lastRhythmBeat>4)this.rhythmEnergy=0;
    if(this.mode==='daily'&&this.time>=this.dailyLimit){this.time=this.dailyLimit;this.status='timeup';this.emit('end',{won:true,daily:true});return;}
    if(this.challenge?.done){this.challengeWait-=dt;if(this.challengeWait<=0)this.nextChallenge();}this.checkChallenge();
    for(const k of ['invincible','dashCd','dashTime','abilityCd','abilityTime','comboTime','noticeCd','chorusCd'])this[k]=Math.max(0,this[k]-dt*(this.crescendoTime>0&&['dashCd','abilityCd'].includes(k)?1.25:1));
    if(this.comboTime===0)this.combo=0;
    const p=this.player,n=Math.hypot(input.x,input.z),speed=(10+p.radius*.35)*(this.traits.includes('speed')?1.22:1)*(this.specialized('speed-current')?1.15:1)*(this.specialized('shell-bastion')?.9:1)*(this.dashTime>0?(this.specialized('speed-blink')?3.4:2.8):1);
    const tx=n>.01?input.x/Math.max(1,n)*speed:0,tz=n>.01?input.z/Math.max(1,n)*speed:0;
    p.vx+=(tx-p.vx)*Math.min(1,dt*8);p.vz+=(tz-p.vz)*Math.min(1,dt*8);const current=this.currentAt(p.x,p.z);p.x=clamp(p.x+(p.vx+current.x)*dt,-180,180);p.z=clamp(p.z+(p.vz+current.z)*dt,-180,180);
    const mouth=this.traits.includes('mouth')?1.3:1,magnet=this.traits.includes('magnet');
    for(let i=this.food.length-1;i>=0;i--){const f=this.food[i],dx=p.x-f.x,dz=p.z-f.z,d=Math.hypot(dx,dz);
      if(this.biome.id==='tide'){const flow=this.currentAt(f.x,f.z);f.x=clamp(f.x+flow.x*dt,-178,178);f.z=clamp(f.z+flow.z*dt,-178,178);}
      if((magnet||this.abilityTime>0)&&d<p.radius+3+(this.specialized('magnet-orbit')?7:0)+(this.abilityTime>0?(this.specialized('magnet-vortex')?21:9):0)&&d>.05){const pull=Math.min(d,dt*(this.abilityTime>0?16:this.specialized('magnet-orbit')?9:6));f.x+=dx/d*pull;f.z+=dz/d*pull;}
      if(d<p.radius*mouth+.4){this.food.splice(i,1);this.stats.food++;const nutrition=[1,.55,.22,.1,.08][this.stage]*(this.specialized('mouth-feast')?.8:1);this.gain(f.value*nutrition,f.x,f.z,f.hue);if(this.status!=='playing')break;}
    }
    if(this.status!=='playing')return;
    this.danger=false;
    tickWorld(this,dt);if(this.status!=='playing')return;
    for(let i=this.creatures.length-1;i>=0;i--){const c=this.creatures[i];c.stun=Math.max(0,c.stun-dt);
      const dx=p.x-c.x,dz=p.z-c.z,d=Math.hypot(dx,dz);
      const motion=c.boss?tickBoss(this,c,dt):creatureMotion(this,c,dt);let a=motion.angle,cs=motion.speed*(this.difficulty==='master'&&!c.boss?1.18:1)*(!c.boss?this.rule().enemy:1);
      const edible=this.canEat(c),dangerous=this.isDangerous(c);if(dangerous&&d<c.radius+p.radius+13)this.danger=true;
      if(this.abilityTime>0&&magnet&&edible&&d<p.radius+(this.specialized('magnet-vortex')?31:19)){a=Math.atan2(dz,dx);cs=this.specialized('magnet-vortex')?30:22;}
      c.x+=Math.cos(a)*cs*dt;c.z+=Math.sin(a)*cs*dt;
      if(Math.abs(c.x)>177||Math.abs(c.z)>177){c.angle+=Math.PI;c.x=clamp(c.x,-176,176);c.z=clamp(c.z,-176,176);}
      if(edible&&d<p.radius*mouth+c.radius*.35){this.creatures.splice(i,1);this.species.add(c.kind);this.stats.prey++;if(c.rare){this.rareCaught++;this.emit('rare',{x:c.x,z:c.z});}this.gain(Math.max(2,c.mass*.18)*(!c.boss&&this.specialized('mouth-feast')?1.25:1)*(c.rare?1.6:1),c.x,c.z,c.kind);this.harvest(c);this.emit('prey',{boss:c.boss});
        if(c.boss){this.finishBoss();break;}
        if(this.status!=='playing')break;
      }else if(dangerous&&d<(c.kind===2&&c.state==='pulse'?p.radius+c.radius*1.8:(p.radius+c.radius)*.8))this.damage(c);
      if(this.status!=='playing')break;
    }
    if(this.status!=='playing')return;
    if(this.spawnClock>1&&!(this.mode==='expedition'&&this.chapter===2&&this.bossDefeated)){this.spawnClock=0;
      this.food=this.food.filter(f=>Math.hypot(f.x-p.x,f.z-p.z)<110);
      for(let i=0;i<16&&this.food.length<300;i++)this.spawnFood(35+p.radius*2);
      this.creatures=this.creatures.filter(c=>c.boss||Math.hypot(c.x-p.x,c.z-p.z)<120);
      const population=this.stage>=3?18:this.stage>=2?28:42;
      if(this.creatures.length>population+1){const bosses=this.creatures.filter(c=>c.boss),others=this.creatures.filter(c=>!c.boss).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z));this.creatures=[...bosses,...others.slice(0,population-bosses.length)];}
      while(this.creatures.length<population)this.spawnCreature();
      const echoGate=this.mode!=='expedition'||this.echoes===3;
      if(this.player.mass>=this.goalMass*.4&&echoGate&&!this.creatures.some(c=>c.boss)&&(!this.bossDefeated||this.endless&&this.waveTime>=30)){this.spawnBoss();}
    }
  }
}
