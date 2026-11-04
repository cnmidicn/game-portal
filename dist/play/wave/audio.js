import {Sound} from './soundtrack.js';
export class FlightSound extends Sound {
  event(e){
    if(e.type==='gate')super.event({type:'hit',x:e.x,kind:e.bonus?2:0,broken:true});
    if(e.type==='dash')super.event({type:e.perfect?'drive':'paddle',perfect:e.perfect,x:e.x});
    if(e.type==='shard')super.event({type:'pickup'});
    if(e.type==='crash')super.event({type:'lost'});
    if(e.type==='smash')super.event({type:'hit',x:e.x,kind:1,broken:true});
    if(e.type==='complete')super.event({type:'clear'});
    if(e.type==='near'&&this.active&&this.ctx?.state==='running')this.note(880,this.ctx.currentTime+.005,.1,.035,'sine');
    if(!this.active||this.ctx?.state!=='running')return;
    const t=this.ctx.currentTime+.005;
    if(e.type==='fire')this.note(e.weapon==='lance'?146.83:587.33,t,e.weapon==='lance'?.1:.045,e.weapon==='lance'?.022:.009,'triangle',-.15);
    if(e.type==='enemyHit')this.note(220,t,.1,.055,'triangle',e.x/9);
    if(e.type==='enemyKill'){this.impact(t,e.kind==='boss'?1.2:.45,e.kind==='boss'?.25:.12,e.x/9);this.note(55,t,.4,.2,'sine');[440,587.33,698.46].forEach((f,i)=>this.note(f,t+i*.05,.4,.05,'triangle',e.x/9));}
    if(e.type==='enemyCharge'&&e.boss){this.note(146.83,t,.3,.08,'triangle');this.note(220,t+.2,.3,.06,'triangle');}
    if(e.type==='enemyFire')this.note(98,t,.1,.045,'triangle');
    if(e.type==='counter')this.note(1174.66,t,.35,.07,'sine');
    if(e.type==='blast'){this.impact(t,.95,.22);this.note(36.71,t,.8,.28,'sine');[293.66,440,587.33,880].forEach((f,i)=>this.note(f,t+i*.055,.75,.065,'triangle',(i-1.5)*.3));}
    if(e.type==='laserWarning'){this.note(146.83,t,.18,.055,'triangle');this.note(293.66,t+.18,.22,.04,'sine');}
    if(e.type==='objective'||e.type==='upgraded')[349.23,440,587.33].forEach((f,i)=>this.note(f,t+i*.08,.5,.07,'sine'));
  }
}
