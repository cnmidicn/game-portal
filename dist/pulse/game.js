export const BPM = 96;
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
    this.makeLevel();
  }
  makeLevel() {
    this.bricks=[]; let id=0;
    const rows=Math.min(5+Math.floor((this.level-1)/2),8);
    for(let row=0;row<rows;row++) for(let col=0;col<7;col++) {
      if(this.level>1 && (row+col+this.level)%9===0) continue;
      const hp=1+Math.floor((this.level-1)/3)+(row<2 && this.level>1?1:0);
      this.bricks.push({id:id++,x:(col-3)*2.04,y:20.5-row*1.34,w:1.72,h:.88,hp,maxHp:hp,kind:(col+row+this.level-1)%3});
    }
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
  speed() { return Math.min(13.5+this.level*.65,21)*this.speedFactor; }
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
    this.paddle+=(this.target-this.paddle)*(1-Math.exp(-22*dt));
    this.comboLeft-=dt;if(this.comboLeft<=0)this.combo=0;
    if(this.status!=='playing') return;
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
        const phase=this.time%BEAT,perfect=Math.min(phase,BEAT-phase)<.105;
        if(perfect){this.score+=25;this.perfects++;this.comboLeft=5;}
        this.events.push({type:'paddle',perfect,x:ball.x,y:1.6});
      }
      for(const brick of this.bricks) {
        if(brick.hp<=0)continue;
        const dx=ball.x-brick.x,dy=ball.y-brick.y;
        const px=brick.w/2+.28-Math.abs(dx),py=brick.h/2+.28-Math.abs(dy);
        if(px<=0||py<=0)continue;
        if(px<py){ball.x+=Math.sign(dx||1)*px;ball.vx=Math.abs(ball.vx)*(dx<0?-1:1);}
        else {ball.y+=Math.sign(dy||1)*py;ball.vy=Math.abs(ball.vy)*(dy<0?-1:1);}
        this.hit(brick,this.damage);
        break;
      }
    }
    this.balls=this.balls.filter(b=>b.y>-.7);
    if(this.bricks.every(b=>b.hp<=0)) {
      this.balls=[];this.status='upgrade';this.score+=250*this.level;
      this.choices=[...UPGRADES].sort(()=>this.random()-.5).slice(0,3);
      this.events.push({type:'clear'});return;
    }
    if(!this.balls.length){
      this.lives--;this.combo=0;this.comboLeft=0;
      this.status=this.lives>0?'ready':'over';this.events.push({type:this.lives>0?'lost':'over'});
    }
  }
  hit(brick,damage,chained=false) {
    if(brick.hp<=0)return;
    brick.hp=Math.max(0,brick.hp-damage);this.totalHits++;
    this.combo++;this.comboLeft=5;this.bestCombo=Math.max(this.bestCombo,this.combo);
    this.score+=(brick.hp===0?100:30)*(1+Math.floor(Math.min(this.combo,40)/5));
    this.events.push({type:'hit',x:brick.x,y:brick.y,kind:brick.kind,broken:brick.hp===0,combo:this.combo});
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
    this.level++;this.makeLevel();this.status='ready';this.combo=0;this.comboLeft=0;this.move(this.target);return true;
  }
}
