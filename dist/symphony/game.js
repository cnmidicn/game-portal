export const STAGES = [
  { name:'原初细胞', mass:8, track:'原初 · Primordial', en:'THE PRIMORDIAL SEA' },
  { name:'微光生命', mass:32, track:'微光 · First Light', en:'THE LUMINOUS GARDEN' },
  { name:'深蓝猎手', mass:100, track:'潮汐 · Tidal Motion', en:'THE BLUE FRONTIER' },
  { name:'深海巨兽', mass:280, track:'深渊 · Into the Abyss', en:'THE SILENT ABYSS' },
  { name:'海域霸主', mass:700, track:'交响 · Symphony of Life', en:'THE LEVIATHAN REALM' }
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
const CHALLENGES=[
  {id:'combo',name:'连锁共鸣',desc:'连续吞噬，达成 15 连击',target:15},
  {id:'food',name:'微光采集者',desc:'收集 35 颗营养微光',target:35},
  {id:'prey',name:'食物链跃迁',desc:'吞噬 6 只小型生物',target:6},
  {id:'dash',name:'逐浪而行',desc:'使用 4 次冲刺',target:4},
  {id:'survive',name:'生命的韧性',desc:'继续存活 45 秒',target:45}
];
let uid=0;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const radiusFor=m=>.85*Math.sqrt(m/8);
export class Game {
  constructor(random=Math.random){this.random=random;this.reset();}
  reset(biome='lagoon'){
    this.biome=BIOMES.find(b=>b.id===biome)||BIOMES[0];this.hazards=[];
    this.status='home';this.player={x:0,z:0,mass:8,radius:radiusFor(8),vx:0,vz:0};
    this.food=[];this.creatures=[];this.effects=[];this.events=[];this.time=0;this.stage=0;
    this.health=3;this.maxHealth=3;this.invincible=0;this.dashCd=0;this.dashTime=0;this.abilityCd=0;this.abilityTime=0;
    this.traits=[];this.evoCount=0;this.choices=[];this.combo=0;this.comboTime=0;this.bestCombo=0;this.eaten=0;this.species=new Set();this.spawnClock=0;this.won=false;this.danger=false;this.peakMass=8;this.endless=false;
    this.stats={food:0,prey:0,dash:0};this.completedChallenges=0;this.challengeIndex=0;this.challengeOrder=this.shuffle(CHALLENGES);this.challenge=null;this.challengeWait=0;this.nextChallenge();
    for(let i=0;i<240;i++)this.spawnFood(i<170?35:135);
    for(let i=0;i<40;i++)this.spawnCreature(true);
    // An inviting, immediately readable trail in front of the starting cell.
    for(let i=0;i<18;i++){let a=i*.65;this.food.push({id:++uid,x:Math.sin(a)*(3+i*.34),z:-3-i*.68,value:1,hue:i%4});}
    if(this.biome.id==='crystal')for(let i=0;i<13;i++){const a=i*2.4,r=21+Math.sqrt(i/13)*100;this.hazards.push({id:++uid,x:Math.cos(a)*r,z:Math.sin(a)*r,radius:4+(i%3),offset:i*1.63,state:'idle',strength:0});}
  }
  emit(type,data={}){this.events.push({type,...data});}
  rnd(a,b){return a+(b-a)*this.random();}
  shuffle(items){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
  nextChallenge(){const template=this.challengeOrder[this.challengeIndex++%this.challengeOrder.length];this.challenge={...template,progress:0,done:false,baseline:template.id==='survive'?this.time:this.stats[template.id]||0};}
  checkChallenge(){const q=this.challenge;if(!q||q.done)return;const value=q.id==='combo'?this.combo:q.id==='survive'?this.time-q.baseline:(this.stats[q.id]||0)-q.baseline;q.progress=Math.min(q.target,Math.floor(value));if(q.progress<q.target)return;q.done=true;this.completedChallenges++;this.challengeWait=5;this.health=Math.min(this.maxHealth,this.health+1);for(let i=0;i<18;i++)this.spawnFood(this.player.radius+7);this.emit('challenge',{name:q.name});}
  currentAt(x,z){if(this.biome.id!=='tide')return{x:0,z:0};return{x:Math.sin(z*.035+this.time*.12)*2.8,z:Math.cos(x*.035-this.time*.1)*2.1};}
  start(){this.status='playing';this.emit('start');}
  spawnFood(range=55){
    const a=this.rnd(0,Math.PI*2),r=Math.sqrt(this.random())*range,p=this.player;
    this.food.push({id:++uid,x:clamp(p.x+Math.cos(a)*r,-175,175),z:clamp(p.z+Math.sin(a)*r,-175,175),value:this.random()<(this.biome.id==='lagoon'?.12:.22)?3:1,hue:Math.floor(this.rnd(0,4))});
  }
  spawnCreature(initial=false){
    const p=this.player,a=this.rnd(0,Math.PI*2);
    const ceiling=this.endless?1800:560;
    const tiers=initial?[4,5,6,11,17,28,42,70]:[Math.max(4,p.mass*.2),p.mass*.38,p.mass*.6,p.mass*1.3,p.mass*1.8].map(m=>Math.min(ceiling,m));
    const mass=tiers[Math.floor(this.random()*tiers.length)],r=this.rnd(initial?(mass>p.mass?38:10):26,initial?(mass>p.mass?95:50):76);
    this.creatures.push({id:++uid,x:clamp(p.x+Math.cos(a)*r,-170,170),z:clamp(p.z+Math.sin(a)*r,-170,170),mass,radius:radiusFor(mass),angle:this.rnd(0,7),phase:this.rnd(0,7),kind:Math.floor(this.rnd(0,4)),stun:0,boss:false});
  }
  canEat(c){return (!c.boss||(this.player.mass>=700&&(c.state==='exposed'||c.stun>0)))&&this.player.mass>c.mass*(this.traits.includes('mouth')?1.02:1.18);}
  isDangerous(c){return c.boss?!this.canEat(c):c.mass>this.player.mass*1.18;}
  dash(){if(this.status!=='playing'||this.dashCd>0)return false;this.dashTime=.45;this.dashCd=this.traits.includes('speed')?2.8:4;this.stats.dash++;this.checkChallenge();this.emit('dash');return true;}
  ability(){
    if(this.status!=='playing'||this.abilityCd>0)return false;
    const electric=this.traits.includes('electric'),magnet=this.traits.includes('magnet');if(!electric&&!magnet)return false;
    this.abilityCd=8;this.abilityTime=2.5;this.emit('ability',{electric});
    if(electric)for(const c of this.creatures)if(Math.hypot(c.x-this.player.x,c.z-this.player.z)<this.player.radius*4+9)c.stun=4;
    return true;
  }
  gain(amount,x,z,kind=0){
    this.combo=this.comboTime>0?this.combo+1:1;this.comboTime=this.traits.includes('harmony')?5:3;
    this.bestCombo=Math.max(this.bestCombo,this.combo);this.eaten++;
    const bonus=this.traits.includes('harmony')?1.2:1;
    const assimilation=1/(1+Math.pow(Math.max(0,this.player.mass-700)/400,2));
    this.player.mass+=amount*bonus*assimilation;this.peakMass=Math.max(this.peakMass,this.player.mass);this.player.radius=radiusFor(this.player.mass);
    this.emit('eat',{x,z,amount,kind,combo:this.combo});
    while(this.stage<4&&this.player.mass>=STAGES[this.stage+1].mass){this.stage++;this.emit('stage',{stage:this.stage});}
    if(this.stage>this.evoCount&&this.evoCount<3&&this.status==='playing'){
      this.choices=this.shuffle(TRAITS.filter(t=>!this.traits.includes(t.id))).slice(0,3);
      this.status='evolution';this.emit('evolution');
    }
    this.checkChallenge();
  }
  evolve(id){
    if(this.status!=='evolution'||!this.choices.some(t=>t.id===id))return false;
    this.traits.push(id);this.evoCount++;if(id==='shell'){this.maxHealth++;this.health=this.maxHealth;}
    this.health=Math.min(this.maxHealth,this.health+1);this.invincible=3;this.status='playing';this.emit('evolved',{id});
    // Large gains can cross more than one evolution threshold; offer the rest in order.
    if(this.stage>this.evoCount&&this.evoCount<3){this.choices=this.shuffle(TRAITS.filter(t=>!this.traits.includes(t.id))).slice(0,3);this.status='evolution';this.emit('evolution');}
    return true;
  }
  damage(c){
    if(this.invincible>0||(this.dashTime>0&&this.traits.includes('speed')))return;
    this.health--;this.player.mass=Math.max(8,this.player.mass*.88);this.player.radius=radiusFor(this.player.mass);this.invincible=3;this.combo=0;this.comboTime=0;
    const a=Math.atan2(this.player.z-c.z,this.player.x-c.x);this.player.x=clamp(this.player.x+Math.cos(a)*(c.radius+5),-180,180);this.player.z=clamp(this.player.z+Math.sin(a)*(c.radius+5),-180,180);c.stun=2;
    this.emit('damage',{cause:c.hazard?'crystal':'creature'});if(this.health<=0){this.status='dead';this.emit('end',{won:false});}
  }
  update(dt,input={x:0,z:0}){
    if(this.status!=='playing')return;dt=Math.min(dt,.05);this.time+=dt;this.spawnClock+=dt;
    if(this.challenge?.done){this.challengeWait-=dt;if(this.challengeWait<=0)this.nextChallenge();}this.checkChallenge();
    for(const k of ['invincible','dashCd','dashTime','abilityCd','abilityTime','comboTime'])this[k]=Math.max(0,this[k]-dt);
    if(this.comboTime===0)this.combo=0;
    const p=this.player,n=Math.hypot(input.x,input.z),speed=(10+p.radius*.35)*(this.traits.includes('speed')?1.22:1)*(this.dashTime>0?2.8:1);
    const tx=n>.01?input.x/Math.max(1,n)*speed:0,tz=n>.01?input.z/Math.max(1,n)*speed:0;
    p.vx+=(tx-p.vx)*Math.min(1,dt*8);p.vz+=(tz-p.vz)*Math.min(1,dt*8);const current=this.currentAt(p.x,p.z);p.x=clamp(p.x+(p.vx+current.x)*dt,-180,180);p.z=clamp(p.z+(p.vz+current.z)*dt,-180,180);
    const mouth=this.traits.includes('mouth')?1.3:1,magnet=this.traits.includes('magnet');
    for(let i=this.food.length-1;i>=0;i--){const f=this.food[i],dx=p.x-f.x,dz=p.z-f.z,d=Math.hypot(dx,dz);
      if(this.biome.id==='tide'){const flow=this.currentAt(f.x,f.z);f.x=clamp(f.x+flow.x*dt,-178,178);f.z=clamp(f.z+flow.z*dt,-178,178);}
      if((magnet||this.abilityTime>0)&&d<p.radius+6+(this.abilityTime>0?9:0)&&d>.05){const pull=Math.min(d,dt*(this.abilityTime>0?25:10));f.x+=dx/d*pull;f.z+=dz/d*pull;}
      if(d<p.radius*mouth+.4){this.food.splice(i,1);this.stats.food++;this.gain(f.value,f.x,f.z,f.hue);if(this.status!=='playing')break;}
    }
    if(this.status!=='playing')return;
    this.danger=false;
    for(const h of this.hazards){const phase=(this.time+h.offset)%9;h.state=phase<5.5?'idle':phase<7.5?'warning':'pulse';h.strength=h.state==='warning'?(phase-5.5)/2:h.state==='pulse'?1:0;
      if(h.state==='pulse'&&Math.hypot(p.x-h.x,p.z-h.z)<h.radius+p.radius*.45)this.damage({...h,hazard:true});if(this.status!=='playing')return;}
    for(let i=this.creatures.length-1;i>=0;i--){const c=this.creatures[i];c.stun=Math.max(0,c.stun-dt);
      if(c.boss){c.clock=(c.clock||0)+dt;const phase=c.clock%10,old=c.state;c.state=phase<4?'guard':phase<5.5?'warning':phase<6.3?'charge':'exposed';if(c.state==='warning'&&old!=='warning'){c.aim=Math.atan2(p.z-c.z,p.x-c.x);this.emit('bossWarning');}}
      const dx=p.x-c.x,dz=p.z-c.z,d=Math.hypot(dx,dz),edible=this.canEat(c),dangerous=this.isDangerous(c);
      if(dangerous&&d<c.radius+p.radius+13)this.danger=true;
      let a=c.angle+Math.sin(this.time*.45+c.phase)*.7,cs=2.6+Math.min(c.radius*.16,3);
      if(d<20+c.radius+p.radius&&c.stun===0){if(dangerous){a=Math.atan2(dz,dx);cs*=1.55;}else if(edible){a=Math.atan2(-dz,-dx);cs*=1.2;}}
      if(c.boss){a=Math.atan2(dz,dx);cs=d<65?3.4:2;if(c.state==='warning')cs=.1;else if(c.state==='charge'){a=c.aim||0;cs=24;}else if(c.state==='exposed')cs=.6;}
      if(c.stun>0)cs*=.08;
      if(this.abilityTime>0&&magnet&&edible&&d<p.radius+19){a=Math.atan2(dz,dx);cs=22;}
      c.x+=Math.cos(a)*cs*dt;c.z+=Math.sin(a)*cs*dt;
      if(Math.abs(c.x)>177||Math.abs(c.z)>177){c.angle+=Math.PI;c.x=clamp(c.x,-176,176);c.z=clamp(c.z,-176,176);}
      if(edible&&d<p.radius*mouth+c.radius*.35){this.creatures.splice(i,1);this.species.add(c.kind);this.stats.prey++;this.gain(Math.max(2,c.mass*.18),c.x,c.z,c.kind);this.emit('prey',{boss:c.boss});
        if(c.boss&&!this.won){this.won=true;this.status='victory';this.emit('end',{won:true});}
        if(this.status!=='playing')break;
      }else if(dangerous&&d<(p.radius+c.radius)*.8)this.damage(c);
      if(this.status!=='playing')break;
    }
    if(this.status!=='playing')return;
    if(this.spawnClock>1){this.spawnClock=0;
      this.food=this.food.filter(f=>Math.hypot(f.x-p.x,f.z-p.z)<110);
      for(let i=0;i<16&&this.food.length<300;i++)this.spawnFood(35+p.radius*2);
      this.creatures=this.creatures.filter(c=>c.boss||Math.hypot(c.x-p.x,c.z-p.z)<120);
      while(this.creatures.length<42)this.spawnCreature();
      if(this.stage>=3&&!this.creatures.some(c=>c.boss)&&!this.won){const a=this.rnd(0,7);this.creatures.push({id:++uid,x:clamp(p.x+Math.cos(a)*48,-165,165),z:clamp(p.z+Math.sin(a)*48,-165,165),mass:560,radius:radiusFor(560),angle:a,phase:0,kind:4,stun:0,boss:true,clock:0,state:'guard'});this.emit('boss');}
    }
  }
}
