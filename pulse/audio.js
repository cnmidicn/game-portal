import {BEAT} from './game.js';
const scale=[293.66,349.23,392,440,523.25,587.33,698.46,783.99];
export class Sound {
  constructor(game){this.game=game;this.enabled=true;this.volume=.82;this.active=false;this.step=0;this.loading=null;this.energy=0;this.generation=0;}
  async init(){
    if(!this.ctx){
      const C=window.AudioContext||window.webkitAudioContext;
      if(!C)throw Error('当前浏览器不支持 Web Audio');
      this.ctx=new C();const c=this.ctx;
      this.master=c.createGain();this.master.gain.value=this.volume;
      this.compressor=c.createDynamicsCompressor();this.compressor.threshold.value=-12;this.compressor.ratio.value=4;
      this.analyser=c.createAnalyser();this.analyser.fftSize=256;this.spectrum=new Uint8Array(128);
      this.master.connect(this.compressor);this.compressor.connect(this.analyser);this.analyser.connect(c.destination);
      this.dry=c.createGain();this.dry.gain.value=.7;this.dry.connect(this.master);
      this.musicGain=c.createGain();this.musicGain.gain.value=.86;
      this.filter=c.createBiquadFilter();this.filter.type='lowpass';this.filter.frequency.value=18000;
      this.musicGain.connect(this.filter);this.filter.connect(this.master);
      this.delay=c.createDelay(1);this.delay.delayTime.value=BEAT*.75;
      const feedback=c.createGain();feedback.gain.value=.23;this.delay.connect(feedback);feedback.connect(this.delay);
      const wet=c.createGain();wet.gain.value=.2;this.delay.connect(wet);wet.connect(this.master);
    }
    await this.ctx.resume();
    if(!this.buffer){
      if(!this.loading)this.loading=fetch(new URL('./assets/neon-resonance.wav',import.meta.url)).then(r=>{if(!r.ok)throw Error('音乐文件未能加载');return r.arrayBuffer();}).then(b=>this.ctx.decodeAudioData(b)).then(b=>{this.buffer=b;}).catch(e=>{this.loading=null;throw e;});
      await this.loading;
    }
  }
  async start(){
    const generation=++this.generation;
    await this.init();
    if(generation!==this.generation)return;
    if(this.source){try{this.source.stop();}catch{}this.source.disconnect();}
    const c=this.ctx;this.anchor=c.currentTime-this.game.time;this.active=true;
    this.source=c.createBufferSource();this.source.buffer=this.buffer;this.source.loop=true;this.source.connect(this.musicGain);
    this.source.start(c.currentTime,this.game.time%this.buffer.duration);
    this.step=Math.ceil(this.game.time/(BEAT/2));clearInterval(this.timer);
    this.master.gain.setTargetAtTime(this.enabled?this.volume:0,c.currentTime,.05);
    this.timer=setInterval(()=>this.tick(),25);this.tick();
  }
  position(){return this.active&&this.ctx?.state==='running'?this.ctx.currentTime-this.anchor:this.game.time;}
  stop(){this.generation++;this.active=false;clearInterval(this.timer);if(this.ctx)this.ctx.suspend();}
  setVolume(v){this.volume=v;this.sync();}
  toggle(){this.enabled=!this.enabled;this.sync();return this.enabled;}
  sync(){if(this.ctx)this.master.gain.setTargetAtTime(this.enabled?this.volume:0,this.ctx.currentTime,.04);}
  measure(){if(!this.active||this.ctx.state!=='running'){this.energy*=.92;return this.energy;}this.analyser.getByteFrequencyData(this.spectrum);let sum=0;for(let i=1;i<20;i++)sum+=this.spectrum[i];this.energy+=(sum/(19*255)-this.energy)*.3;return this.energy;}
  note(freq,t,duration=.35,vol=.12,type='sine',pan=0){
    const c=this.ctx,o=c.createOscillator(),g=c.createGain(),p=c.createStereoPanner();
    o.type=type;o.frequency.value=freq;p.pan.value=Math.max(-1,Math.min(1,pan));
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+duration);
    o.connect(g);g.connect(p);p.connect(this.dry);p.connect(this.delay);o.start(t);o.stop(t+duration+.04);
    o.onended=()=>{o.disconnect();g.disconnect();p.disconnect();};
  }
  tick(){
    if(!this.active||this.ctx.state!=='running')return;
    const now=this.ctx.currentTime;
    this.filter.frequency.setTargetAtTime(this.game.driveLeft>0?20000:15000,now,.15);
    if(this.anchor+this.step*BEAT/2<now-.1)this.step=Math.ceil((now-this.anchor)/(BEAT/2));
    while(this.anchor+this.step*BEAT/2<now+.1){
      const t=Math.max(now+.005,this.anchor+this.step*BEAT/2),s=this.step;
      if(this.game.driveLeft>0)this.note(scale[(s*3)%8]*2,t,BEAT*.8,.065,'triangle',Math.sin(s)*.5);
      this.step++;
    }
  }
  event(e){
    if(!this.active||!this.ctx||this.ctx.state!=='running')return;
    const now=this.ctx.currentTime;
    if(e.type==='hit'){
      const t=Math.max(now+.003,this.anchor+Math.ceil((now-this.anchor)/(BEAT/4))*BEAT/4);
      const f=scale[(Math.round(e.x+7)+e.kind*2)%8];
      this.note(f,t,e.broken?.6:.2,e.broken?.13:.07,e.kind===1?'triangle':'sine',e.x/9);
      if(e.broken)this.note(f*2,t,.3,.035,'sine',e.x/9);
    }
    if(e.type==='rhythm'){
      if(e.good){this.note(73.42,now+.003,.2,.28,'sine');[293.66,349.23,440].forEach(f=>this.note(f,now+.003,.23,.065,'triangle',e.x/9));}
      else this.note(130.81,now+.003,.08,.03,'sine');
    }
    if(e.type==='bumper')this.note(e.x<0?587.33:783.99,now+.005,.35,.1,'sine',e.x/6);
    if(e.type==='paddle')this.note(e.perfect?587.33:146.83,now+.003,e.perfect?.4:.12,e.perfect?.1:.06,'sine',e.x/9);
    if(['clear','phrase','drive'].includes(e.type)){
      [293.66,349.23,440,587.33,698.46].forEach((f,i)=>this.note(f,now+i*BEAT/4,.9,.11,'triangle',(i-2)*.2));
      if(e.type==='drive'){this.note(36.71,now,.8,.35,'sine');this.musicGain.gain.setValueAtTime(.7,now);this.musicGain.gain.linearRampToValueAtTime(.95,now+BEAT);}
    }
    if(e.type==='pickup')this.note(1174.66,now+.003,.3,.08,'sine');
    if(e.type==='shield')this.note(220,now+.003,.45,.14,'triangle');
    if(e.type==='lost'||e.type==='over')this.note(73.42,now+.01,.8,.13,'triangle');
  }
}
