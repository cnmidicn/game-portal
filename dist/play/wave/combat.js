const BEAT=60/128;
export function resetCombat(g){
  g.combatEnabled=true;g.enemies=[];g.playerShots=[];g.enemyShots=[];g.lasers=[];g.enemyKills=0;g.bossKills=0;g.combatIndex=0;g.bossIndex=0;g.shotId=0;g.lastFireBeat=-1;g.targetEnemyId=null;
}
function makeEnemy(g,kind,spawnAt,id){
  const boss=kind==='boss',hp=boss?64+Math.floor(spawnAt/60)*12:kind==='interceptor'?5:3;
  return {id,kind,spawnAt,duration:boss?30:kind==='interceptor'?6.5:8,hp,maxHp:hp,baseX:boss?0:Math.sin(id*2.1)*4.6,baseY:boss?3.3:2.3+(id%3)*.9,x:0,y:3,z:-180,prevX:0,prevY:3,prevZ:-180,active:false,dead:false,open:!boss,nextAttack:spawnAt+(boss?2:2.5),telegraph:null,exposedUntil:0,flash:0,lastBlocked:-10,attackCount:0,phase:1};
}
function generate(g){
  const until=g.time+8;
  while(2.2+g.combatIndex*BEAT*10<until){
    const id=g.combatIndex++,at=2.2+id*BEAT*10,local=at%60;
    if(local>43||local<1.5)continue;
    g.enemies.push(makeEnemy(g,id%3===1?'interceptor':'scout',at,id));
  }
  while(g.bossIndex*60+47<until){const cycle=g.bossIndex++;g.enemies.push(makeEnemy(g,'boss',cycle*60+47,10000+cycle));}
}
export function damageEnemy(g,e,damage,piercing=false){
  if(!e||e.dead||!e.active)return false;
  if(e.kind==='boss'&&!e.open&&!piercing){if(g.time-e.lastBlocked>.3){g.events.push({type:'armor',id:e.id,x:e.x,y:e.y,z:e.z});e.lastBlocked=g.time;}return false;}
  e.hp=Math.max(0,e.hp-damage);e.flash=.14;
  if(piercing&&e.kind==='boss')e.exposedUntil=g.time+BEAT*2;
  g.events.push({type:'enemyHit',id:e.id,x:e.x,y:e.y,z:e.z,kind:e.kind});
  if(e.hp===0){
    e.dead=true;g.enemyKills++;const boss=e.kind==='boss',score=boss?2400:e.kind==='interceptor'?500:300;g.score+=score;g.energy=Math.min(100,g.energy+(boss?40:13));
    if(boss){g.bossKills++;g.health=Math.min(5,g.health+2);}
    g.combo++;g.comboTime=8;g.bestCombo=Math.max(g.bestCombo,g.combo);g.resonance=Math.min(100,g.resonance+18);
    g.events.push({type:'enemyKill',id:e.id,x:e.x,y:e.y,z:e.z,kind:e.kind,score});
  }
  return true;
}
function hurt(g,x,y){if(g.shieldTime>0||g.dashLeft>0)return;g.health--;g.combo=0;g.shieldTime=1.5;g.events.push({type:'crash',x,y,cause:'enemy'});}
export function counterPulse(g,perfect){
  if(!g.combatEnabled||!perfect)return;
  const targets=g.enemies.filter(e=>e.active&&!e.dead&&e.z<5&&e.z>-170).sort((a,b)=>Math.hypot(g.x-a.x,g.y-a.y)-Math.hypot(g.x-b.x,g.y-b.y));
  for(const target of targets.slice(0,3+g.mods.counter)){
    g.playerShots.push({id:g.shotId++,x:g.x,y:g.y,z:5,prevZ:5,damage:3+g.mods.counter,piercing:true,targetId:target.id,life:2.5});
  }
  for(const shot of g.enemyShots)if(shot.z>-22){shot.dead=true;g.score+=10;}
  if(targets.length){g.counterBursts++;g.events.push({type:'counter',count:Math.min(3+g.mods.counter,targets.length)});}
}
export function updateCombat(g,dt){
  if(!g.combatEnabled)return;
  generate(g);
  for(const e of g.enemies){
    e.prevX=e.x;e.prevY=e.y;e.prevZ=e.z;e.flash=Math.max(0,e.flash-dt);
    if(e.dead||g.time<e.spawnAt)continue;
    const age=g.time-e.spawnAt,boss=e.kind==='boss',inter=e.kind==='interceptor';
    if(age>e.duration){e.dead=true;g.events.push({type:'enemyEscape',kind:e.kind});continue;}
    if(!e.active){e.active=true;g.events.push({type:'enemyEnter',kind:e.kind,id:e.id});}
    e.x=e.baseX+Math.sin(age*(inter?1.8:.8)+e.id)* (boss?2:inter?1.8:1.1);
    e.y=e.baseY+Math.sin(age*1.1+e.id*.4)*(boss?.5:.65);
    if(age<1.5)e.z=-180+(age/1.5)*(boss?162:inter?148:130);
    else if(boss)e.z=-20+Math.sin(age*.5)*2;
    else if(inter)e.z=age<4?-32+Math.sin(age*1.7)*7:-32+(age-4)*27;
    else e.z=age<5?-50+Math.sin(age)*6:-50-(age-5)*65;
    e.open=!boss||Math.floor(g.time/BEAT)%8>=4||g.time<e.exposedUntil;
    if(boss){const phase=e.hp/e.maxHp>.6?1:e.hp/e.maxHp>.25?2:3;if(phase!==e.phase){e.phase=phase;g.events.push({type:'bossPhase',phase});}}
    e.state=age<1.5?'approach':inter&&age>=4?'dive':age>5&&!boss?'retreat':e.telegraph?'charging':'patrol';
    if(e.prevZ<6&&e.z>=6&&Math.hypot(g.x-e.x,g.y-e.y)<1.2){if(g.dashLeft>0)damageEnemy(g,e,10,true);else hurt(g,e.x,e.y);}
    if(age>1.6&&age<e.duration-1.5&&!e.telegraph&&g.time>=e.nextAttack){
      const pattern=boss&&e.phase===2?'lasers':boss&&e.phase===3?'wall':'fan';
      e.telegraph={x:g.x,y:g.y,fireAt:g.time+(boss?BEAT*2.4:BEAT*1.5),pattern};e.nextAttack=g.time+(boss?BEAT*4.5:BEAT*7);
      g.events.push({type:'enemyCharge',id:e.id,boss,pattern});
    }
    if(e.telegraph&&g.time>=e.telegraph.fireAt){
      const aim=e.telegraph,offsets=boss?[-2.4,-1.2,0,1.2,2.4]:inter?[-.7,.7]:[0];e.attackCount=(e.attackCount||0)+1;
      if(aim.pattern==='lasers'){
        const safe=[-4,0,4][e.attackCount%3];for(const x of [-4,0,4])if(x!==safe)g.lasers.push({id:g.shotId++,x,y:3.2,z:e.z,warnUntil:g.time+BEAT*2,until:g.time+BEAT*3.1,halfWidth:.82});
        g.events.push({type:'laserWarning',safe});
      }else if(aim.pattern==='wall'){
        for(const x of [-6,-3,0,3,6])for(const y of [1.2,3.2,5.2]){
          if(Math.hypot(x-aim.x,y-aim.y)<2.3)continue;const travel=.85;
          g.enemyShots.push({id:g.shotId++,x:e.x,y:e.y,z:e.z,prevZ:e.z,vx:(x-e.x)/travel,vy:(y-e.y)/travel,vz:(6-e.z)/travel,dead:false,life:2,radius:.32});
        }
      }else for(const offset of offsets){
        const dx=aim.x+offset-e.x,dy=aim.y-e.y,dz=6-e.z,length=Math.hypot(dx,dy,dz),speed=boss?65:72;
        g.enemyShots.push({id:g.shotId++,x:e.x,y:e.y,z:e.z,prevZ:e.z,vx:dx/length*speed,vy:dy/length*speed,vz:dz/length*speed,dead:false,life:4});
      }
      e.telegraph=null;g.events.push({type:'enemyFire',id:e.id,boss});
    }
  }
  const active=g.enemies.filter(e=>e.active&&!e.dead&&e.z<4&&e.z>-180);
  const fireBeat=Math.floor(g.time/(BEAT/(2+Math.min(2,g.mods.rapid))));
  if(fireBeat!==g.lastFireBeat){
    g.lastFireBeat=fireBeat;
    if(active.length){
      const damage=(g.weapon==='lance'?2:1)*(1+g.mods.power*.5),spread=g.weapon==='scatter'?[-8,0,8]:[0];
      for(const vx of spread)g.playerShots.push({id:g.shotId++,x:g.x,y:g.y,z:5,prevZ:5,damage,vx,penetrating:g.weapon==='lance',hitIds:[],life:2.1});g.events.push({type:'fire',weapon:g.weapon});
    }
  }
  const droneBeat=Math.floor(g.time/BEAT);
  if(g.weapon==='drone'&&droneBeat!==g.lastDroneBeat){g.lastDroneBeat=droneBeat;const target=active.slice().sort((a,b)=>Math.hypot(g.x-a.x,g.y-a.y)-Math.hypot(g.x-b.x,g.y-b.y))[0];if(target)g.playerShots.push({id:g.shotId++,x:g.x+Math.sin(g.time*3),y:g.y+.6,z:5,prevZ:5,targetId:target.id,damage:1.2*(1+g.mods.power*.5),drone:true,life:2.5});}
  for(const shot of g.playerShots){
    shot.prevZ=shot.z;shot.prevX=shot.x;shot.prevY=shot.y;shot.life-=dt;
    shot.x+=(shot.vx||0)*dt;
    const target=shot.targetId!==undefined?active.find(e=>e.id===shot.targetId):null;
    if(target){const dz=Math.max(1,Math.abs(shot.z-target.z)),amount=Math.min(1,dt*145/dz);shot.x+=(target.x-shot.x)*amount;shot.y+=(target.y-shot.y)*amount;}
    shot.z-=dt*(shot.piercing?160:145);
    for(const e of active){
      if(e.dead||shot.hitIds?.includes(e.id))continue;const before=shot.prevZ-e.prevZ,after=shot.z-e.z;
      if(before>=0&&after<=0){const fraction=before/Math.max(.001,before-after),x=shot.prevX+(shot.x-shot.prevX)*fraction,y=shot.prevY+(shot.y-shot.prevY)*fraction;
        if(Math.hypot(x-e.x,y-e.y)<(e.kind==='boss'?1.65:1.05)){damageEnemy(g,e,shot.damage,shot.piercing);if(shot.penetrating){shot.hitIds??=[];shot.hitIds.push(e.id);}else shot.dead=true;break;}
      }
    }
  }
  for(const shot of g.enemyShots){
    shot.prevZ=shot.z;shot.prevX=shot.x;shot.prevY=shot.y;shot.x+=shot.vx*dt;shot.y+=shot.vy*dt;shot.z+=shot.vz*dt;shot.life-=dt;
    if(!shot.dead&&shot.prevZ<=6&&shot.z>=6){
      const fraction=(6-shot.prevZ)/Math.max(.001,shot.z-shot.prevZ),x=shot.prevX+(shot.x-shot.prevX)*fraction,y=shot.prevY+(shot.y-shot.prevY)*fraction;
      if(Math.hypot(x-g.x,y-g.y)<.45+(shot.radius||.25)){if(g.dashLeft>0){g.score+=30;g.events.push({type:'reflect',x,y});}else hurt(g,x,y);shot.dead=true;}
    }
  }
  g.playerShots=g.playerShots.filter(s=>!s.dead&&s.life>0&&s.z>-250);g.enemyShots=g.enemyShots.filter(s=>!s.dead&&s.life>0&&s.z<18);
  for(const laser of g.lasers)if(g.time>=laser.warnUntil&&g.time<laser.until&&Math.abs(g.x-laser.x)<laser.halfWidth)hurt(g,g.x,g.y);
  g.lasers=g.lasers.filter(l=>g.time<l.until);
  g.enemies=g.enemies.filter(e=>!e.dead||g.time-e.spawnAt<e.duration+.5);
  const target=active.filter(e=>!e.dead).sort((a,b)=>Math.hypot(g.x-a.x,g.y-a.y)-Math.hypot(g.x-b.x,g.y-b.y))[0];g.targetEnemyId=target?.id??null;
}
