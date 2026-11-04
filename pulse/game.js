export const BPM = 128;
export const BEAT = 60 / BPM;
export const UPGRADES = [
  {id:'wide', icon:'↔', name:'引力光翼', desc:'挡板加宽 22%，更从容地接住回响。'},
  {id:'multi', icon:'◌', name:'双星共鸣', desc:'每次发球增加一颗球，最多同时三球。'},
  {id:'power', icon:'ϟ', name:'晶体穿透', desc:'碰撞伤害 +1，更快击碎坚硬水晶。'},
  {id:'chain', icon:'⌁', name:'雷鸣连锁', desc:'击碎水晶时，向附近另一块传递伤害。'},
  {id:'slow', icon:'◎', name:'时间涟漪', desc:'球速降低 12%，最低降至初始速度的 70%。'},
  {id:'life', icon:'♡', name:'星光修复', desc:'恢复一次生命，最多储存五次。'},
];
export class Game {
  constructor(random = Math.random) { this.random = random; this.reset(); }
  reset() {
    this.status='menu'; this.score=0; this.level=1; this.lives=3; this.time=0;
    this.combo=0; this.bestCombo=0; this.comboLeft=0; this.paddle=0; this.target=0;
    this.width=3.1; this.speedFactor=1; this.damage=1; this.multiball=1; this.chain=0;
    this.balls=[]; this.events=[]; this.accumulator=0; this.totalHits=0; this.perfects=0;
    this.charge=25;this.driveLeft=0;this.rhythmStreak=0;this.rhythmHits=0;this.lastTapBeat=-1;this.lastTapTime=-1;
    this.shots=[];this.pickups=[];this.shields=1;this.lastBeat=-1;this.readyTime=0;this.broken=0;
    this.phraseIndex=0;this.newPhrase();
    this.makeLevel();
  }
  makeLevel() {
    this.bricks=[]; let id=0;
    const rows=Math.min(4+Math.floor((this.level-1)/3),6);
    for(let row=0;row<rows;row++) for(let col=0;col<7;col++) {
      if((row+col+this.level)%7===0)continue;
      const hp=1+Math.floor((this.level-1)/3)+(row<2 && this.level>1?1:0);
      const x=(col-3)*1.97,y=20.4-row*1.65-(this.level%3===2?Math.abs(col-3)*.48:0);
      this.bricks.push({id:id++,x,y,baseX:x,baseY:y,row,w:1.65,h:.95,hp,maxHp:hp,kind:(col+row+this.level-1)%3,moving:row%2===0});
    }
    this.bumpers=[{x:-3.8,y:8.8,r:.63,side:-1},{x:3.8,y:8.8,r:.63,side:1}];
    if(this.level%3===0)this.bricks.push({id:999,x:0,y:21,baseX:0,baseY:21,w:3.2,h:1.3,hp:10+this.level,maxHp:10+this.level,kind:1,boss:true});
    this.shields=Math.max(1,this.shields);this.shots=[];this.pickups=[];
    this.events.push({type:'level'});
  }
  start() { this.reset(); this.status='ready'; }
  launch() {
    if(this.status!=='ready') return false;
    const speed=this.speed();
    for(let i=0;i<this.multiball;i++) {
      const angle=(i-(this.multiball-1)/2)*.32+.1;
      this.balls.push({x:this.paddle,y:2.2,vx:Math.sin(angle)*speed,vy:Math.cos(angle)*speed});
    }
    this.status='playing'; this.events.push({type:'launch'}); return true;
  }
  speed() { return Math.min(11.8+this.level*.5,18)*this.speedFactor; }
  beatTime(){return this.musicClock?this.musicClock():this.time;}
  newPhrase(){
    const rhythm=this.phraseIndex%2===0;
    this.phrase={rhythm,title:rhythm?'跟拍 6 次 · 点亮声场':'击碎 8 枚晶体 · 完成乐句',target:rhythm?6:8,baseline:rhythm?this.rhythmHits:this.broken,start:this.time,progress:0};
  }
  checkPhrase(){
    const p=this.phrase;p.progress=Math.min(p.target,(p.rhythm?this.rhythmHits:this.broken)-p.baseline);
    if(p.progress>=p.target){this.score+=600;this.charge=Math.min(100,this.charge+25);this.events.push({type:'phrase',title:p.title});this.phraseIndex++;this.newPhrase();}
    else if(this.time-p.start>BEAT*32){this.phraseIndex++;this.newPhrase();}
  }
  tap(){
    if(this.status!=='playing')return false;
    const t=this.beatTime(),beat=Math.round(t/BEAT),error=Math.abs(t-beat*BEAT);
    if(t-this.lastTapTime<.12||beat===this.lastTapBeat)return false;
    this.lastTapTime=t;
    if(error>.115){this.rhythmStreak=0;this.events.push({type:'rhythm',grade:'偏拍',good:false,x:this.paddle,y:1.6});return false;}
    this.lastTapBeat=beat;this.rhythmHits++;this.rhythmStreak++;this.charge=Math.min(100,this.charge+(error<.055?10:7));
    this.score+=error<.055?50:25;
    this.shots.push({x:this.paddle,y:2.1,damage:this.damage+1,powered:this.driveLeft>0});
    for(const b of this.balls)if(b.y<5&&b.vy<0){b.vy=Math.abs(b.vy);b.y=Math.max(2.1,b.y);this.events.push({type:'save',x:b.x,y:b.y});}
    this.events.push({type:'rhythm',grade:error<.055?'PERFECT':'GOOD',good:true,x:this.paddle,y:1.6,streak:this.rhythmStreak});
    this.checkPhrase();return true;
  }
  overdrive(){
    if(this.status!=='playing'||this.charge<100||this.driveLeft>0)return false;
    this.charge=0;this.driveLeft=BEAT*12;
    this.events.push({type:'drive'});return true;
  }
  move(x) { this.target=Math.max(-7.65+this.width/2,Math.min(7.65-this.width/2,x)); }
  pause() { if(['playing','ready'].includes(this.status)){this.resumeStatus=this.status;this.status='paused';} }
  resume() { if(this.status==='paused') this.status=this.resumeStatus; }
  advance(dt) {
    if(!['playing','ready'].includes(this.status)) {this.accumulator=0;return;}
    this.accumulator+=Math.max(0,Math.min(dt,.15));
    while(this.accumulator>=1/240) {this.step(1/240);this.accumulator-=1/240;if(!['playing','ready'].includes(this.status)){this.accumulator=0;break;}}
  }
  step(dt) {
    this.time+=dt;
    const beatTime=this.beatTime(),beat=Math.floor(beatTime/BEAT);
    if(beat!==this.lastBeat){this.lastBeat=beat;this.events.push({type:'beat',beat});if(this.driveLeft>0)this.shots.push({x:this.paddle,y:2.1,damage:this.damage+2,powered:true});}
    this.driveLeft=Math.max(0,this.driveLeft-dt);
    this.paddle+=(this.target-this.paddle)*(1-Math.exp(-22*dt));
    this.comboLeft-=dt;if(this.comboLeft<=0)this.combo=0;
    if(this.status!=='playing'){this.readyTime+=dt;if(this.readyTime>2){this.readyTime=0;this.launch();}return;}
    for(const brick of this.bricks){
      if(brick.baseX!==undefined){brick.x=brick.baseX+(brick.moving?Math.sin(beatTime/BEAT*.7+brick.row*1.4)*.65:0);}
      if(brick.boss)brick.open=this.driveLeft>0||beat%8>=4;
    }
    for(const b of this.bumpers){b.x=b.side*(3.8+Math.sin(beatTime/BEAT*.45)*.55);b.y=8.8+Math.cos(beatTime/BEAT*.5)*.6;}
    this.checkPhrase();
    for(const ball of this.balls) {
      const oldY=ball.y;
      ball.x+=ball.vx*dt;ball.y+=ball.vy*dt;
      if(ball.x < -7.7 || ball.x > 7.7){ball.x=Math.max(-7.7,Math.min(7.7,ball.x));ball.vx*=-1;this.events.push({type:'wall',x:ball.x,y:ball.y});}
      if(ball.y>22.7){ball.y=22.7;ball.vy=-Math.abs(ball.vy);}
      if(ball.vy<0 && oldY>=1.95 && ball.y<=1.95 && Math.abs(ball.x-this.paddle)<this.width/2+.25){
        ball.y=1.96;
        const relative=Math.max(-1,Math.min(1,(ball.x-this.paddle)/(this.width/2)));
        const angle=relative*1.04, speed=this.speed();
        ball.vx=Math.sin(angle)*speed;ball.vy=Math.cos(angle)*speed;
        const phase=beatTime%BEAT,perfect=Math.min(phase,BEAT-phase)<.105;
        if(perfect){this.score+=25;this.perfects++;this.comboLeft=5;}
        this.events.push({type:'paddle',perfect,x:ball.x,y:1.6});
      }
      for(const bumper of this.bumpers){
        const dx=ball.x-bumper.x,dy=ball.y-bumper.y,dist=Math.hypot(dx,dy);
        if(dist<bumper.r+.28&&dist>.001){
          const nx=dx/dist,ny=dy/dist,dot=ball.vx*nx+ball.vy*ny;
          ball.x=bumper.x+nx*(bumper.r+.29);ball.y=bumper.y+ny*(bumper.r+.29);
          if(dot<0){ball.vx-=2*dot*nx;ball.vy-=2*dot*ny;if(Math.abs(ball.vy)<3)ball.vy=ball.vy<0?-3:3;this.score+=15;this.charge=Math.min(100,this.charge+2);this.events.push({type:'bumper',x:bumper.x,y:bumper.y});}
        }
      }
      for(const brick of this.bricks) {
        if(brick.hp<=0)continue;
        const dx=ball.x-brick.x,dy=ball.y-brick.y;
        const px=brick.w/2+.28-Math.abs(dx),py=brick.h/2+.28-Math.abs(dy);
        if(px<=0||py<=0)continue;
        if(this.driveLeft<=0){
          if(px<py){ball.x+=Math.sign(dx||1)*px;ball.vx=Math.abs(ball.vx)*(dx<0?-1:1);}
          else {ball.y+=Math.sign(dy||1)*py;ball.vy=Math.abs(ball.vy)*(dy<0?-1:1);}
        }
        this.hit(brick,this.damage+(this.driveLeft>0?2:0));
        break;
      }
      if(ball.y<0&&ball.vy<0&&this.shields>0){this.shields--;ball.y=.3;ball.vy=Math.abs(ball.vy);this.events.push({type:'shield',x:ball.x,y:0});}
    }
    for(const shot of this.shots){
      shot.y+=dt*33;
      const brick=this.bricks.filter(b=>b.hp>0&&Math.abs(shot.x-b.x)<b.w/2+.2&&Math.abs(shot.y-b.y)<b.h/2+.45).sort((a,b)=>a.y-b.y)[0];
      if(brick){this.hit(brick,shot.damage);shot.y=30;if(shot.powered)for(const b of this.bricks.filter(b=>b.hp>0&&Math.hypot(b.x-brick.x,b.y-brick.y)<3))this.hit(b,1,true);}
    }
    this.shots=this.shots.filter(s=>s.y<24);
    for(const p of this.pickups){p.y-=dt*4;if(p.y<2&&p.y>1&&Math.abs(p.x-this.paddle)<this.width/2+.6){p.y=-10;this.charge=Math.min(100,this.charge+18);this.score+=100;this.events.push({type:'pickup',x:p.x,y:1.7});}}
    this.pickups=this.pickups.filter(p=>p.y>-.5);
    this.balls=this.balls.filter(b=>b.y>-.7);
    if(this.bricks.every(b=>b.hp<=0)) {
      this.balls=[];this.status='upgrade';this.score+=250*this.level;
      const shuffled=[...UPGRADES];
      for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
      this.choices=shuffled.slice(0,3);
      this.events.push({type:'clear'});return;
    }
    if(!this.balls.length){
      this.lives--;this.combo=0;this.comboLeft=0;
      this.readyTime=0;
      this.status=this.lives>0?'ready':'over';this.events.push({type:this.lives>0?'lost':'over'});
    }
  }
  hit(brick,damage,chained=false) {
    if(brick.hp<=0)return;
    if(brick.boss&&!brick.open){if(!this.events.some(e=>e.type==='guard'))this.events.push({type:'guard',x:brick.x,y:brick.y});return;}
    brick.hp=Math.max(0,brick.hp-damage);this.totalHits++;
    this.charge=Math.min(100,this.charge+(brick.hp===0?3:1));
    if(brick.hp===0){this.broken++;if(this.random()<.2&&this.pickups.length<6)this.pickups.push({x:brick.x,y:brick.y});}
    this.combo++;this.comboLeft=5;this.bestCombo=Math.max(this.bestCombo,this.combo);
    this.score+=(brick.hp===0?100:30)*(1+Math.floor(Math.min(this.combo,40)/5));
    this.events.push({type:'hit',id:brick.id,x:brick.x,y:brick.y,kind:brick.kind,broken:brick.hp===0,combo:this.combo});
    if(!chained&&brick.hp===0&&this.chain){
      const nearby=this.bricks.filter(b=>b.hp>0&&Math.hypot(b.x-brick.x,b.y-brick.y)<3.5).sort((a,b)=>Math.hypot(a.x-brick.x,a.y-brick.y)-Math.hypot(b.x-brick.x,b.y-brick.y));
      for(const next of nearby.slice(0,Math.min(this.chain,3))){this.events.push({type:'chain',x:brick.x,y:brick.y,toX:next.x,toY:next.y});this.hit(next,1,true);}
    }
  }
  choose(id) {
    if(this.status!=='upgrade'||!this.choices.some(c=>c.id===id))return false;
    if(id==='wide')this.width=Math.min(6,this.width*1.22);
    if(id==='multi')this.multiball=Math.min(3,this.multiball+1);
    if(id==='power')this.damage++;
    if(id==='chain')this.chain++;
    if(id==='slow')this.speedFactor=Math.max(.7,this.speedFactor*.88);
    if(id==='life')this.lives=Math.min(5,this.lives+1);
    this.level++;this.makeLevel();this.status='ready';this.readyTime=0;this.combo=0;this.comboLeft=0;this.move(this.target);return true;
  }
}
