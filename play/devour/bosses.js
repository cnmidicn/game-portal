export const BOSSES={
  lagoon:{name:'吞潮之喉',color:0xe5c19c,tip:'吸潮时保持距离，侧向避开冲撞后接近。'},
  tide:{name:'回旋鳐皇',color:0x99d4ef,tip:'连续两次冲撞，冲刺可穿过回旋波。'},
  crystal:{name:'晶冠古神',color:0xd9b6ee,tip:'离开脚下晶簇预警，躲过晶雨再接近。'}
};
export function tickBoss(g,c,dt){
  const p=g.player,d=Math.hypot(p.x-c.x,p.z-c.z),toward=Math.atan2(p.z-c.z,p.x-c.x),variant=c.variant||'lagoon',old=c.state;
  if(c.stun>0){c.state='exposed';c.clock=7;return{angle:toward,speed:0};}
  c.clock=(c.clock||0)+dt;const phase=c.clock%10;
  if(variant==='tide')c.state=phase<3?'guard':phase<4.2?'warning':phase<4.9?'charge':phase<5.6?'warning':phase<6.3?'charge':'exposed';
  else c.state=phase<4?'guard':phase<5.5?'warning':phase<6.3?'charge':'exposed';
  if(c.state==='warning'&&old!=='warning'){
    c.aim=toward;g.emit('bossWarning');
    if(variant==='tide')g.waves.push({id:g.allocateId(),type:'ring',x:c.x,z:c.z,radius:2,speed:10,life:6});
    if(variant==='crystal')for(let i=0;i<3;i++){const a=i*2.094;g.hazards.push({id:g.allocateId(),type:'mine',x:p.x+Math.cos(a)*(i?8:0),z:p.z+Math.sin(a)*(i?8:0),radius:5,age:0,life:3.3,state:'warning',strength:0});}
  }
  if(variant==='crystal'&&c.state==='charge'&&old!=='charge')for(let i=0;i<8;i++){const a=c.aim+i*Math.PI/4;g.waves.push({id:g.allocateId(),type:'bolt',x:c.x,z:c.z,vx:Math.cos(a)*13,vz:Math.sin(a)*13,radius:1,life:5});}
  let angle=toward,speed=d<65?3.4:2;
  if(c.state==='guard'&&variant==='tide'){angle=toward+Math.PI/2;speed=5;}
  if(c.state==='guard'&&variant==='lagoon'&&phase>2&&d<25&&d>.1){p.x+=(c.x-p.x)/d*2.4*dt;p.z+=(c.z-p.z)/d*2.4*dt;}
  if(c.state==='warning')speed=.1;
  else if(c.state==='charge'){angle=c.aim||0;speed=variant==='crystal'?0:24;}
  else if(c.state==='exposed')speed=.6;
  if(g.difficulty==='master')speed*=1.15;
  c.heading=angle;return{angle,speed};
}
