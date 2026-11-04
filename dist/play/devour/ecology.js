export const SPECIES=[
  {id:0,name:'微光孢子',icon:'◉',tip:'温和漂游，适合优先捕食。',detail:'追逐附近营养，遇到更大的生命会缓慢逃开。'},
  {id:1,name:'尖喙猎手',icon:'➶',tip:'蓄力时侧移，避开直线突袭。',detail:'体型占优时锁定方向，短暂蓄力后高速突进。吞噬小猎手可缩短冲刺冷却。'},
  {id:2,name:'脉冲水母',icon:'◎',tip:'等脉冲散去，或用电流麻痹。',detail:'环形光晕预告脉冲。释放期间不能直接吞噬，麻痹可中断保护。捕食后缩短技能冷却。'},
  {id:3,name:'晶壳细胞',icon:'⬡',tip:'绕后捕食，或用冲刺、电流破甲。',detail:'正面晶甲阻挡吞噬，背部柔软。体型充分占优的巨口也能破甲。捕食可积累护膜修复。'},
  {id:4,name:'海域霸主',icon:'♛',tip:'避开攻击，趁破绽接近。',detail:'各海域有独立霸主与攻击方式。达到本海域目标质量，在护壳暴露或麻痹期间吞噬；远征需要依次征服三海。'}
];
export const SYNERGIES=[
  {id:'storm',name:'电磁风暴',icon:'ϟ',traits:['magnet','electric'],desc:'电流范围 +30%，麻痹会向附近生物连锁传播。'},
  {id:'ambush',name:'掠食突袭',icon:'➶',traits:['mouth','speed'],desc:'冲刺期间可吞噬略大于自己的普通生物，并直接破甲。'},
  {id:'chorus',name:'共鸣潮汐',icon:'♫',traits:['magnet','harmony'],desc:'每达成 10 连击，生成一小片额外营养；触发间隔 5 秒。'},
  {id:'reactor',name:'反应护甲',icon:'⬡',traits:['shell','electric'],desc:'受伤时自动释放电流，麻痹附近天敌，为撤离争取时间。'},
  {id:'furnace',name:'消化熔炉',icon:'◈',traits:['mouth','shell'],desc:'每吞噬 6 只普通生物，修复一层护膜。'},
  {id:'tempo',name:'疾速乐章',icon:'♬',traits:['speed','harmony'],desc:'冲刺中每次吞噬返还 0.3 秒冲刺冷却，并延长连击。'}
];
export function activeSynergies(traits){return SYNERGIES.filter(s=>s.traits.every(t=>traits.includes(t)));}
export function rearIsOpen(player,c){const direction=c.heading??c.angle??0,angle=Math.atan2(player.z-c.z,player.x-c.x);return Math.cos(angle-direction)<-.15;}
export function preyOpen(game,c){
  if(c.boss)return game.player.mass>=(c.requiredMass||game.goalMass||700)&&(c.state==='exposed'||c.stun>0);
  if(c.stun>0)return true;
  if(c.kind===2&&c.state==='pulse')return false;
  if(c.kind===3)return game.dashTime>0||rearIsOpen(game.player,c)||(game.traits.includes('mouth')&&game.player.mass>c.mass*(game.specialized?.('mouth-crusher')?1.18:1.65));
  return true;
}
export function creatureMotion(game,c,dt){
  c.age=(c.age||0)+dt;
  const p=game.player,dx=p.x-c.x,dz=p.z-c.z,d=Math.hypot(dx,dz),bigger=c.mass>p.mass*1.18;
  let angle=c.angle+Math.sin(game.time*.45+c.phase)*.7,speed=2.6+Math.min(c.radius*.16,3),facing=null;
  if(c.kind===0){speed*=.75;c.grazeCd=Math.max(0,(c.grazeCd||0)-dt);if(c.grazeCd===0){c.grazeCd=.8;let best=12;c.graze=null;for(const f of game.food){const dist=Math.hypot(f.x-c.x,f.z-c.z);if(dist<best){best=dist;c.graze=f;}}}if(c.graze)angle=Math.atan2(c.graze.z-c.z,c.graze.x-c.x);if(bigger===false&&d<p.radius+c.radius+14){angle=Math.atan2(-dz,-dx);speed*=1.3;}}
  else if(c.kind===1){
    c.attackClock=Math.max(0,(c.attackClock||0)-dt);
    if(c.state==='warning'){
      if(c.attackClock<=0){c.state='charge';c.attackClock=.6;}
    }else if(c.state==='charge'){
      if(c.attackClock<=0){c.state='rest';c.attackClock=2.4;}
    }else if(bigger&&d<24+c.radius+p.radius&&c.attackClock<=0){c.state='warning';c.attackClock=.85;c.aim=Math.atan2(dz,dx);if(game.noticeCd<=0){game.emit('hunterWarning');game.noticeCd=3;}}
    if(c.state==='warning'){angle=c.aim;speed=.15;}
    else if(c.state==='charge'){angle=c.aim;speed=17;}
    else if(d<22+c.radius+p.radius){angle=Math.atan2(dz,dx)+(bigger?0:Math.PI);speed*=bigger?1.1:1.5;}
  }else if(c.kind===2){
    const phase=(c.age+((c.phase||0)%4))%8,old=c.state;c.state=phase<5?'drift':phase<6.4?'warning':'pulse';speed*=.45;
    if(c.state==='warning'&&old!=='warning'&&d<p.radius+c.radius+12&&game.noticeCd<=0){game.emit('jellyWarning');game.noticeCd=3;}
  }else if(c.kind===3){speed*=bigger?.85:.35;facing=c.heading??c.angle;if(d<22+c.radius+p.radius){const target=Math.atan2(dz,dx),diff=Math.atan2(Math.sin(target-facing),Math.cos(target-facing));facing+=Math.max(-dt*.9,Math.min(dt*.9,diff));}angle=facing+(bigger?0:Math.PI);}
  else if(d<20+c.radius+p.radius){angle=Math.atan2(dz,dx)+(bigger?0:Math.PI);speed*=bigger?1.55:1.2;}
  if(c.stun>0){speed*=.08;if(c.kind===1){c.state='rest';c.attackClock=2.4;}}
  c.heading=facing??angle;return{angle,speed};
}
