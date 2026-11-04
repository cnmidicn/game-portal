import {BEAT} from './game.js';
const chords=[[146.83,174.61,220,261.63],[130.81,164.81,196,246.94],[116.54,146.83,174.61,220],[130.81,155.56,196,233.08]];
const scale=[293.66,349.23,392,440,523.25,587.33,698.46,783.99];
export class Sound {
  constructor(game){this.game=game;this.enabled=true;this.volume=.65;this.active=false;this.step=0;}
  async init(){
    if(!this.ctx){
      const C=window.AudioContext||window.webkitAudioContext;
      if(!C)throw Error('当前浏览器不支持 Web Audio');
      this.ctx=new C();const c=this.ctx;
      this.master=c.createGain();this.master.gain.value=this.volume;
      this.compressor=c.createDynamicsCompressor();this.compressor.threshold.value=-19;this.compressor.ratio.value=5;
      this.master.connect(this.compressor);this.compressor.connect(c.destination);
      this.dry=c.createGain();this.dry.gain.value=.7;this.dry.connect(this.master);
      const impulse=c.createBuffer(2,c.sampleRate*2.7,c.sampleRate);
      for(let ch=0;ch<2;ch++){const a=impulse.getChannelData(ch);for(let i=0;i<a.length;i++)a[i]=(Math.random()*2-1)*Math.pow(1-i/a.length,3)*.45;}
      this.reverb=c.createConvolver();this.reverb.buffer=impulse;
      const wet=c.createGain();wet.gain.value=.27;this.reverb.connect(wet);wet.connect(this.master);
      this.noise=c.createBuffer(1,c.sampleRate*.15,c.sampleRate);const d=this.noise.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
    }
    await this.ctx.resume();
  }
  async start(){
    await this.init();this.active=true;this.anchor=this.ctx.currentTime-this.game.time;
    this.step=Math.ceil(this.game.time/(BEAT/2));clearInterval(this.timer);
    this.master.gain.setTargetAtTime(this.enabled?this.volume:0,this.ctx.currentTime,.08);
    this.tick();this.timer=setInterval(()=>this.tick(),25);
  }
  stop(){this.active=false;clearInterval(this.timer);if(this.ctx)this.ctx.suspend();}
  setVolume(v){this.volume=v;this.sync();}
  toggle(){this.enabled=!this.enabled;this.sync();return this.enabled;}
  sync(){if(this.ctx)this.master.gain.setTargetAtTime(this.enabled?this.volume:0,this.ctx.currentTime,.05);}
  note(freq,t,duration=.5,vol=.07,type='sine',pan=0){
    const c=this.ctx,o=c.createOscillator(),g=c.createGain(),p=c.createStereoPanner();
    o.type=type;o.frequency.value=freq;p.pan.value=Math.max(-1,Math.min(1,pan));
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+.014);g.gain.exponentialRampToValueAtTime(.0001,t+duration);
    o.connect(g);g.connect(p);p.connect(this.dry);p.connect(this.reverb);o.start(t);o.stop(t+duration+.04);
    o.onended=()=>{o.disconnect();g.disconnect();p.disconnect();};
  }
  kick(t){
    const c=this.ctx,o=c.createOscillator(),g=c.createGain();o.frequency.setValueAtTime(135,t);o.frequency.exponentialRampToValueAtTime(43,t+.15);
    g.gain.setValueAtTime(.36,t);g.gain.exponentialRampToValueAtTime(.0001,t+.26);o.connect(g);g.connect(this.dry);o.start(t);o.stop(t+.28);o.onended=()=>{o.disconnect();g.disconnect();};
  }
  hat(t,vol=.025){const c=this.ctx,s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();s.buffer=this.noise;f.type='highpass';f.frequency.value=6500;g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0001,t+.07);s.connect(f);f.connect(g);g.connect(this.dry);s.start(t);s.stop(t+.08);s.onended=()=>{s.disconnect();f.disconnect();g.disconnect();};}
  tick(){
    if(!this.active||this.ctx.state!=='running')return;
    const now=this.ctx.currentTime;
    if(this.anchor+this.step*BEAT/2<now-.1)this.step=Math.ceil((now-this.anchor)/(BEAT/2));
    while(this.anchor+this.step*BEAT/2<now+.12){
      const t=Math.max(now+.005,this.anchor+this.step*BEAT/2),s=this.step;
      const chord=chords[Math.floor(s/32)%4],energy=Math.min(1,this.game.combo/16+.15*this.game.level);
      if(s%2===0)this.kick(t);
      if(s%8===4){this.hat(t,.07);this.note(174.61,t,.14,.055,'triangle');}
      if(s%2===1||energy>.4)this.hat(t,.014+energy*.023);
      if(s%8===0)chord.forEach((f,i)=>this.note(f,t+i*.017,BEAT*4.7,.028,'sine',(i-1.5)*.35));
      if(s%4===0)this.note(chord[0]/2,t,BEAT*.85,.16,'sine');
      if(energy>.35&&s%2===0)this.note(scale[(s/2+Math.floor(s/8))%scale.length],t,BEAT*.7,.023+energy*.025,'triangle',Math.sin(s)*.5);
      if(energy>.8&&s%2===1)this.note(scale[(s+3)%8]*2,t,.22,.025,'sine',-.4);
      this.step++;
    }
  }
  event(e){
    if(!this.active||!this.ctx||this.ctx.state!=='running')return;
    const now=this.ctx.currentTime;
    if(e.type==='hit'){
      const t=Math.max(now+.006,this.anchor+Math.ceil((now-this.anchor)/(BEAT/4))*BEAT/4);
      const f=scale[(Math.round(e.x+7)+e.kind*2)%8];
      this.note(f,t,e.broken?.8:.32,e.broken?.105:.06,e.kind===1?'triangle':'sine',e.x/9);
      if(e.broken)this.note(f*2,t,.4,.025,'sine',e.x/9);
    }
    if(e.type==='paddle'){this.note(e.perfect?587.33:146.83,now+.005,e.perfect?.5:.14,e.perfect?.09:.055,'sine',e.x/9);}
    if(e.type==='clear')[293.66,349.23,440,587.33].forEach((f,i)=>this.note(f,now+i*.12,1.6,.1,'sine',(i-1.5)*.3));
    if(e.type==='lost'||e.type==='over')this.note(73.42,now+.01,.9,.12,'triangle');
  }
}
