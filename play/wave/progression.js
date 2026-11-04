export const WEAPONS=[
  {id:'scatter',name:'裂光散射',icon:'⋔',desc:'三线齐射，适合横扫机群。'},
  {id:'lance',name:'重型磁轨',icon:'ϟ',desc:'双倍单发伤害，可贯穿敌机。'},
  {id:'drone',name:'回声僚机',icon:'◈',desc:'僚机自动追击，飞行更从容。'},
];
export const UPGRADES=[
  {id:'power',name:'高能弹芯',icon:'ϟ',desc:'主炮基础伤害增加 50%。'},
  {id:'counter',name:'反击增幅',icon:'⌁',desc:'追踪反击伤害 +1，额外锁定一个目标。'},
  {id:'reactor',name:'超导回路',icon:'◎',desc:'跃迁消耗降低，燃料恢复更快。'},
  {id:'repair',name:'装甲重构',icon:'◇',desc:'恢复两层护盾，充满跃迁燃料。'},
  {id:'rapid',name:'脉冲超频',icon:'»',desc:'主炮射速提升，爆破充能加快。'},
];
export function resetProgression(g){
  g.weapon='pulse';g.mods={power:0,counter:0,reactor:0,rapid:0};g.resonance=40;g.blasts=0;g.blastLeft=0;g.blastCooldown=0;g.counterBursts=0;g.comboTime=0;
  g.missionIndex=0;g.missionsCompleted=0;g.refitEnabled=true;g.refitCount=0;g.upgradeChoices=[];g.lastDroneBeat=-1;g.failureReason='';
}
export function missionState(g){
  const missions=[{title:'清除前哨 · 击落 2 架敌机',value:g.enemyKills,target:2},{title:'夺取主动 · 完成 3 次重拍反击',value:g.counterBursts,target:3},{title:'解除封锁 · 击破守关旗舰',value:g.bossKills,target:1}];
  return missions[g.missionIndex]||{title:g.endless?'自由狩猎 · 挑战更高战绩':'封锁已解除 · 飞向撤离点',value:1,target:1};
}
export function updateProgression(g,dt){
  g.comboTime=Math.max(0,g.comboTime-dt);if(g.comboTime<=0)g.combo=0;
  g.resonance=Math.min(100,g.resonance+dt*(1.6+g.mods.rapid*.4));g.blastLeft=Math.max(0,g.blastLeft-dt);g.blastCooldown=Math.max(0,g.blastCooldown-dt);
  const mission=missionState(g);
  if(g.missionIndex<3&&mission.value>=mission.target){
    g.missionIndex++;g.missionsCompleted++;g.score+=400;g.resonance=Math.min(100,g.resonance+25);if(g.health>0)g.health=Math.min(5,g.health+1);
    g.events.push({type:'objective',title:mission.title});
  }
  const checkpoint=18+Math.floor(g.refitCount/2)*60+(g.refitCount%2)*17;
  if(g.refitEnabled&&g.status==='playing'&&g.health>0&&g.time>=checkpoint&&g.time<60*(1+Math.floor(g.refitCount/2))){
    const pool=UPGRADES.filter(u=>u.id==='repair'||g.mods[u.id]<(u.id==='rapid'?2:3));
    for(let i=pool.length-1;i>0;i--){const j=Math.floor(g.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
    g.upgradeChoices=pool.slice(0,3);g.refitCount++;g.status='refit';g.events.push({type:'refit'});
  }
}
export function chooseUpgrade(g,id){
  if(g.status!=='refit'||!g.upgradeChoices.some(u=>u.id===id))return false;
  if(id==='repair'){g.health=Math.min(5,g.health+2);g.energy=100;}else g.mods[id]=Math.min(id==='rapid'?2:3,g.mods[id]+1);
  g.upgradeChoices=[];g.status='playing';g.events.push({type:'upgraded',id});return true;
}
