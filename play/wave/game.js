import {resetCombat,updateCombat,counterPulse,damageEnemy} from './combat.js';
import {resetProgression,updateProgression,chooseUpgrade,WEAPONS} from './progression.js';
export const BPM=128,BEAT=60/BPM,DURATION=60;
export const SECTIONS=[
  {name:'浮光之海',en:'SEA OF LIGHT',speed:40,color:0x55f4de,sky:0xfe9cb6},
  {name:'霓虹峡谷',en:'NEON CANYON',speed:49,color:0xff8ad9,sky:0x9a87ff},
  {name:'极光回廊',en:'AURORA PASSAGE',speed:35,color:0x8cffee,sky:0x59cec9},
  {name:'跃迁时刻',en:'HYPERDRIVE',speed:59,color:0xffcd83,sky:0xf67ec1},
];
export function distanceAt(time){
  let total=0,remaining=Math.max(0,time);
  for(let i=0;remaining>0;i++){const duration=Math.min(15,remaining);total+=duration*SECTIONS[i%4].speed;remaining-=duration;}
  return total;
}
function seeded(seed){let v=seed>>>0;return ()=>{v+=0x6D2B79F5;let t=Math.imul(v^v>>>15,1|v);t^=t+Math.imul(t^t>>>7,61|t);return ((t^t>>>14)>>>0)/4294967296;};}
export class Flight {
  constructor(seed=20261104){this.seed=seed;this.reset(seed);}
  reset(seed=this.seed){
    this.seed=seed;this.random=seeded(seed);this.status='menu';this.time=0;this.distance=0;this.x=0;this.y=2.7;this.targetX=0;this.targetY=2.7;
    this.score=0;this.combo=0;this.bestCombo=0;this.energy=100;this.health=5;this.shieldTime=0;this.dashLeft=0;this.perfects=0;this.gates=0;this.missed=0;this.nearMisses=0;this.shards=0;
    this.events=[];this.groups=[];this.obstacles=[];this.pickups=[];this.endless=false;this.generated=0;this.obstacleId=0;this.pickupId=0;this.lastTap=-100;this.lastBeat=-1;this.lastSection=-1;this.accumulator=0;
    resetCombat(this);resetProgression(this);this.generate(18);
  }
  get driveLeft(){return this.dashLeft;}
  get section(){return !this.endless&&this.time>=60&&this.bossKills===0&&this.combatEnabled?3:Math.floor(this.time/15)%4;}
  get cycle(){return Math.floor(this.time/60);}
  get speed(){return SECTIONS[Math.floor(this.time/15)%4].speed;}
  start(seed=this.seed,weapon='pulse'){this.reset(seed);if(WEAPONS.some(w=>w.id===weapon))this.weapon=weapon;this.status='playing';}
  chooseUpgrade(id){return chooseUpgrade(this,id);}
  blast(){
    if(this.status!=='playing'||this.resonance<100||this.blastCooldown>0)return false;
    this.resonance=0;this.blasts++;this.blastLeft=1.2;this.blastCooldown=2.5;
    for(const e of this.enemies)if(e.active&&!e.dead&&e.z>-190&&e.z<6)damageEnemy(this,e,6+this.mods.power,true);
    this.enemyShots=[];this.lasers=[];this.shieldTime=Math.max(this.shieldTime,1);this.events.push({type:'blast',x:this.x,y:this.y});return true;
  }
  move(x,y=this.targetY){this.targetX=Math.max(-7.4,Math.min(7.4,x));this.targetY=Math.max(.9,Math.min(5.8,y));}
  generate(until){
    while(this.generated*BEAT*2+BEAT*4<until){
      const i=this.generated++,at=(4+i*2)*BEAT,cycle=Math.floor(at/60),rnd=this.random;
      const x=Math.sin(i*.7)*4.6+(rnd()-.5)*1.1,y=2.7+Math.sin(i*.48)*1.45;
      const options=[{x,y,r:1.5,bonus:false}];
      if(i>3&&i%5===4)options.push({x:x>0?x-4.6:x+4.6,y:Math.min(5.5,y+.6),r:1.05,bonus:true});
      this.groups.push({id:i,at,distance:distanceAt(at),options,done:false});
      if(i>3&&i%3!==0){
        const obstacleAt=at-BEAT;
        let ox=i%4===1&&i>9?Math.sin((i-1)*.7)*4.6:x+(x>0?-3.3:3.3);
        ox=Math.max(-6.6,Math.min(6.6,ox));
        this.obstacles.push({id:this.obstacleId++,at:obstacleAt,distance:distanceAt(obstacleAt),x:ox,y:i%4===1?y:2.8+(rnd()-.5)*2,r:.88+Math.min(.35,cycle*.08),done:false});
      }
      if(i>0){
        const prevX=Math.sin((i-1)*.7)*4.6,prevY=2.7+Math.sin((i-1)*.48)*1.45;
        for(let j=1;j<=3;j++){const f=j/4,t=at-BEAT*2+f*BEAT*2;this.pickups.push({id:this.pickupId++,at:t,distance:distanceAt(t),x:prevX+(x-prevX)*f,y:prevY+(y-prevY)*f,done:false});}
      }
    }
  }
  dash(){
    if(this.status!=='playing'||this.dashLeft>0)return false;
    const t=this.musicClock?this.musicClock():this.time;
    if(t-this.lastTap<BEAT*.65)return false;
    const error=Math.abs(t-Math.round(t/BEAT)*BEAT),perfect=error<=.105,cost=(perfect?15:25)*(1-this.mods.reactor*.12);
    if(this.energy<cost){this.events.push({type:'empty'});return false;}
    this.lastTap=t;this.energy-=cost;this.dashLeft=perfect?.72:.42;
    if(perfect){this.perfects++;this.score+=50;}
    counterPulse(this,perfect);
    this.events.push({type:'dash',perfect,x:this.x,y:this.y});return true;
  }
  pause(){if(this.status==='playing'){this.status='paused';this.accumulator=0;}}
  resume(){if(this.status==='paused')this.status='playing';}
  continue(){if(this.status!=='complete')return false;this.endless=true;this.status='playing';this.health=Math.min(5,this.health+2);this.energy=100;return true;}
  advance(dt){
    if(this.status!=='playing'){this.accumulator=0;return;}
    this.accumulator+=Math.min(.3,Math.max(0,dt));
    while(this.accumulator+1e-9>=1/120){this.step(1/120);this.accumulator-=1/120;if(this.status!=='playing'){this.accumulator=0;break;}}
  }
  step(dt){
    const previousTime=this.time;this.time+=dt;this.distance=distanceAt(this.time);
    this.x+=(this.targetX-this.x)*(1-Math.exp(-11*dt));this.y+=(this.targetY-this.y)*(1-Math.exp(-9*dt));
    this.energy=Math.min(100,this.energy+dt*(9+this.mods.reactor*3));this.dashLeft=Math.max(0,this.dashLeft-dt);this.shieldTime=Math.max(0,this.shieldTime-dt);
    const beat=Math.floor(this.time/BEAT);
    if(beat!==this.lastBeat){this.events.push({type:'beat',beat});this.lastBeat=beat;}
    if(this.section!==this.lastSection){this.events.push({type:'section',section:this.section});this.lastSection=this.section;}
    this.generate(this.time+14);
    updateCombat(this,dt);
    for(const group of this.groups){
      if(group.done||group.at>this.time)continue;
      group.done=true;
      const option=group.options.find(g=>Math.hypot(this.x-g.x,this.y-g.y)<g.r+.18);
      if(option){
        this.gates++;this.combo++;this.comboTime=8;this.resonance=Math.min(100,this.resonance+(option.bonus?12:6));this.bestCombo=Math.max(this.bestCombo,this.combo);const boosted=this.dashLeft>0;
        const earned=(option.bonus?220:100)*(1+Math.floor(Math.min(this.combo,30)/5))*(boosted?2:1);
        this.score+=earned;this.energy=Math.min(100,this.energy+(option.bonus?16:9));
        this.events.push({type:'gate',id:group.id,x:option.x,y:option.y,bonus:option.bonus,boosted,score:earned,combo:this.combo});
      }else{this.missed++;this.events.push({type:'miss',id:group.id});}
    }
    for(const obstacle of this.obstacles){
      if(obstacle.done||obstacle.at>this.time)continue;obstacle.done=true;
      const dist=Math.hypot(this.x-obstacle.x,this.y-obstacle.y);
      if(dist<obstacle.r+.4){
        if(this.dashLeft>0){this.score+=180;this.events.push({type:'smash',id:obstacle.id,x:obstacle.x,y:obstacle.y});}
        else if(this.shieldTime<=0){this.health--;this.combo=0;this.shieldTime=1.5;this.events.push({type:'crash',id:obstacle.id,x:obstacle.x,y:obstacle.y});}
      }else if(dist<obstacle.r+1.3){this.score+=60;this.nearMisses++;this.events.push({type:'near',id:obstacle.id});}
    }
    for(const p of this.pickups){
      if(p.done||p.at>this.time)continue;p.done=true;
      if(Math.hypot(this.x-p.x,this.y-p.y)<1.25){this.shards++;this.score+=15;this.energy=Math.min(100,this.energy+3);this.events.push({type:'shard',id:p.id,x:p.x,y:p.y});}
    }
    this.groups=this.groups.filter(g=>g.at>this.time-2);this.obstacles=this.obstacles.filter(g=>g.at>this.time-2);this.pickups=this.pickups.filter(g=>g.at>this.time-1);
    if(this.health<=0){this.status='over';this.events.push({type:'over'});}
    else if(!this.endless&&this.time+1e-7>=DURATION&&(!this.combatEnabled||this.bossKills>0)){if(this.time<DURATION+.01){this.time=DURATION;this.distance=distanceAt(DURATION);}this.status='complete';this.events.push({type:'complete'});}
    else if(!this.endless&&this.time>=75){this.failureReason='旗舰未被击破，封锁仍在持续';this.status='over';this.events.push({type:'over'});}
    if(this.status==='playing')updateProgression(this,dt);
  }
}
