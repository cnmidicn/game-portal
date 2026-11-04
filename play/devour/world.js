export const CHAPTERS=[
  {biome:'lagoon',title:'第一乐章 · 微光初生',goal:700,boss:'吞潮之喉',intro:'从一颗细胞开始，收集三枚回声核，唤醒并挑战浅海的守护者。'},
  {biome:'tide',title:'第二乐章 · 逐浪远征',goal:1600,boss:'回旋鳐皇',intro:'你已长成巨兽。穿过潮汐，吞噬珊瑚与沉船，躲开回旋鳐皇的双重冲撞。'},
  {biome:'crystal',title:'第三乐章 · 深渊终曲',goal:3200,boss:'晶冠古神',intro:'吞噬浮岛与风暴，在晶雨中寻找破绽，最终唤醒生命之心。'}
];
export const STRUCTURE_TYPES={
  reef:{name:'回声珊瑚',icon:'♧',color:0x77d3a8},wreck:{name:'沉睡船骸',icon:'▱',color:0xa9bdc1},island:{name:'悬浮礁岛',icon:'⬡',color:0xc4dfa9},storm:{name:'低鸣风暴',icon:'☁',color:0x9cb5ee},echo:{name:'回声核',icon:'◇',color:0xd2fff0},heart:{name:'生命之心',icon:'✦',color:0xffe3a5}
};
export function initWorld(g){
  g.structures=[];g.waves=[];g.echoes=0;g.bossDefeated=false;g.hazards=[];g.chapterTime=0;
  const chapter=g.mode==='expedition'?g.chapter:0,scale=chapter===0?1:chapter===1?3:6;
  for(let i=0;i<24;i++){const a=i*2.399+g.rnd(-.2,.2),r=28+Math.sqrt((i+1)/24)*120,type=i<14?'reef':i<20?'wreck':chapter>=1?'island':'reef',base=type==='reef'?[65,110,170,240][i%4]:type==='wreck'?[340,460,620][i%3]:[400,520,640][i%3],mass=base*scale;
    g.structures.push({id:g.allocateId(),type,x:Math.cos(a)*r,z:Math.sin(a)*r,mass,radius:Math.max(1.7,Math.sqrt(mass)*.13),phase:g.rnd(0,7)});
  }
  if(chapter>=2)for(let i=0;i<5;i++){const a=i*1.256+.6;g.structures.push({id:g.allocateId(),type:'storm',x:Math.cos(a)*100,z:Math.sin(a)*100,mass:2400+i*100,radius:9,phase:i});}
  if(g.dailyRule==='storms')for(let i=0;i<5;i++){const a=i*1.256;g.structures.push({id:g.allocateId(),type:'storm',x:Math.cos(a)*85,z:Math.sin(a)*85,mass:300+i*100,radius:5+i*.3,phase:i,orbit:a});}
  for(let i=0;i<3;i++){const a=i*Math.PI*2/3+g.rnd(-.25,.25),r=g.rnd(45,80);g.structures.push({id:g.allocateId(),type:'echo',x:Math.cos(a)*r,z:Math.sin(a)*r,mass:0,radius:2,phase:i*2.1});}
  if(g.mode==='expedition'&&chapter===2)g.structures.push({id:g.allocateId(),type:'heart',x:0,z:0,mass:3600,radius:7,phase:0});
  if(g.biome.id==='crystal')for(let i=0;i<13;i++){const a=i*2.4,r=21+Math.sqrt(i/13)*100;g.hazards.push({id:g.allocateId(),type:'crystal',x:Math.cos(a)*r,z:Math.sin(a)*r,radius:4+(i%3),offset:i*1.63,state:'idle',strength:0});}
  if(g.biome.id==='tide')for(let i=0;i<5;i++){const a=i*1.256;g.hazards.push({id:g.allocateId(),type:'whirlpool',x:Math.cos(a)*90,z:Math.sin(a)*90,radius:6,offset:i*2,state:'idle',strength:0});}
}
export function canAbsorbStructure(g,s){
  if(s.type==='echo')return g.stage>=2||g.mode==='expedition'&&g.chapter>0;
  if(s.type==='heart')return g.mode==='expedition'&&g.chapter===2&&g.bossDefeated&&g.echoes===3&&g.player.mass>=3600&&g.campaignHistory.length===3&&g.campaignHistory.every((h,i)=>h.biome===CHAPTERS[i].biome);
  return g.player.mass>s.mass*(g.specialized('mouth-crusher')?.85:g.traits.includes('mouth')?.95:1.1);
}
export function tickWorld(g,dt){
  g.chapterTime+=dt;
  for(const h of g.hazards){
    if(h.type==='mine'){h.age+=dt;h.state=h.age<1.5?'warning':'pulse';h.strength=Math.min(1,h.age/1.5);h.life-=dt;}
    else{const phase=(g.time+h.offset)%9;h.state=phase<5.5?'idle':phase<7.5?'warning':'pulse';h.strength=h.state==='warning'?(phase-5.5)/2:h.state==='pulse'?1:0;}
    const p=g.player,dx=h.x-p.x,dz=h.z-p.z,d=Math.hypot(dx,dz);
    if(h.type==='whirlpool'&&h.state!=='idle'&&d<h.radius+p.radius+10&&d>.1){const force=h.state==='pulse'?5:1.5;p.x+=dx/d*force*dt;p.z+=dz/d*force*dt;}
    if(h.state==='pulse'&&d<h.radius+p.radius*.45&&!(h.type==='whirlpool'&&g.dashTime>0))g.damage({...h,hazard:true});
    if(g.status!=='playing')return;
  }
  g.hazards=g.hazards.filter(h=>h.life===undefined||h.life>0);
  for(const w of g.waves){w.life-=dt;if(w.type==='ring')w.radius+=w.speed*dt;else{w.x+=w.vx*dt;w.z+=w.vz*dt;}const d=Math.hypot(g.player.x-w.x,g.player.z-w.z),hit=w.type==='ring'?Math.abs(d-w.radius)<g.player.radius*.42+1.2:d<g.player.radius*.55+1;if(hit&&g.dashTime<=0)g.damage({x:w.x,z:w.z,radius:2,hazard:true});if(g.status!=='playing')return;}
  g.waves=g.waves.filter(w=>w.life>0&&Math.abs(w.x)<210&&Math.abs(w.z)<210);
  for(let i=g.structures.length-1;i>=0;i--){const s=g.structures[i];if(s.orbit!==undefined){const a=s.orbit+g.time*.055;s.x=Math.cos(a)*85;s.z=Math.sin(a)*85;}const d=Math.hypot(s.x-g.player.x,s.z-g.player.z);if(s.type==='storm'){const phase=(g.time+s.phase)%8;s.state=phase<4.5?'idle':phase<6?'warning':'pulse';if(s.state==='pulse'&&!canAbsorbStructure(g,s)&&d<s.radius+g.player.radius*.4&&g.dashTime<=0)g.damage({...s,hazard:true});if(g.status!=='playing')return;}if(d>g.player.radius+s.radius*.45||!canAbsorbStructure(g,s))continue;
    g.structures.splice(i,1);g.stats.structures++;
    if(s.type==='echo'){g.echoes++;g.health=Math.min(g.maxHealth,g.health+1);g.emit('echo',{count:g.echoes,x:s.x,z:s.z});}
    else if(s.type==='heart'){g.won=true;g.status='complete';g.emit('end',{won:true,expeditionComplete:true});return;}
    else{g.collectedStructures.add(s.type);g.gain(s.mass*.25,s.x,s.z,3);g.emit('structure',{structureType:s.type,x:s.x,z:s.z});}
    if(g.status!=='playing')return;
  }
}
export function scoreFor(g){return Math.round(g.peakMass*2+g.stats.prey*12+g.stats.structures*30+g.bestCombo*3+g.completedChallenges*150+(g.bossDefeated?1000:0)+g.time+(g.rhythmHits||0)*5+(g.rareCaught||0)*30);}
