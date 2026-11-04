import {BEAT} from './game.js';
const scale=[293.66,349.23,392,440,523.25,587.33,698.46,783.99];
export function musicState(game){
  const boss=game.enemies?.find(e=>e.active&&!e.dead&&e.kind==='boss');
  const threats=game.enemies?.filter(e=>e.active&&!e.dead).length||0,boost=game.dashLeft>0;
  return {combat:boss?.phase===3 ? .95 : boss ? .78 : threats ? .38 : .04,cutoff:boost?19000:boss?17500:game.section===2?11200:16000,
    label:boss?'ECLIPSE / 旗舰决战':['DEPARTURE / 浮光序曲','PURSUIT / 峡谷追击','AURORA / 极光回响','ASSAULT / 突破封锁'][game.section||0]};
}
export class Sound {
  constructor(game){this.game=game;this.enabled=true;this.volume=.82;this.active=false;this.step=0;this.loading=null;this.energy=0;this.generation=0;this.levels={bass:0,mid:0,high:0,impact:0};}
  async init(){
    if(!this.ctx){
      const C=window.AudioContext||window.webkitAudioContext;
      if(!C)throw Error('当前浏览器不支持 Web Audio');
      this.ctx=new C();const c=this.ctx;
      this.master=c.createGain();this.master.gain.value=this.volume;
      this.compressor=c.createDynamicsCompressor();this.compressor.threshold.value=-9;this.compressor.ratio.value=3;this.compressor.attack.value=.008;this.compressor.release.value=.2;
      this.analyser=c.createAnalyser();this.analyser.fftSize=512;this.analyser.minDecibels=-88;this.analyser.maxDecibels=-12;this.analyser.smoothingTimeConstant=.55;this.spectrum=new Uint8Array(256);
      this.master.connect(this.compressor);this.compressor.connect(this.analyser);this.analyser.connect(c.destination);
      this.dry=c.createGain();this.dry.gain.value=.7;this.dry.connect(this.master);
      this.musicGain=c.createGain();this.musicGain.gain.value=.86;
      this.filter=c.createBiquadFilter();this.filter.type='lowpass';this.filter.frequency.value=18000;
      this.bassEQ=c.createBiquadFilter();this.bassEQ.type='lowshelf';this.bassEQ.frequency.value=110;this.bassEQ.gain.value=2;
      this.musicGain.connect(this.bassEQ);this.bassEQ.connect(this.filter);this.filter.connect(this.master);
      this.combatGain=c.createGain();this.combatGain.gain.value=0;this.combatGain.connect(this.musicGain);
      this.delay=c.createDelay(1);this.delay.delayTime.value=BEAT*.75;
      const feedback=c.createGain();feedback.gain.value=.23;this.delay.connect(feedback);feedback.connect(this.delay);
      const wet=c.createGain();wet.gain.value=.2;this.delay.connect(wet);wet.connect(this.master);
    }
    await this.ctx.resume();
    if(!this.buffer){
      if(!this.loading)this.loading=Promise.all(['neon-resonance.wav','combat-pulse.wav'].map(async file=>{
        const r=await fetch(new URL(`./assets/${file}`,import.meta.url));if(!r.ok)throw Error('音乐文件未能加载');return this.ctx.decodeAudioData(await r.arrayBuffer());
      })).then(([base,combat])=>{this.buffer=base;this.combatBuffer=combat;}).catch(e=>{this.loading=null;throw e;});
      await this.loading;
    }
  }
  async start(){
    const generation=++this.generation;
    await this.init();
    if(generation!==this.generation)return;
    for(const source of [this.source,this.combatSource])if(source){try{source.stop();}catch{}source.disconnect();}
    const c=this.ctx,when=c.currentTime;this.anchor=when-this.game.time;this.active=true;
    this.source=c.createBufferSource();this.source.buffer=this.buffer;this.source.loop=true;this.source.connect(this.musicGain);
    this.source.start(when,this.game.time%this.buffer.duration);
    this.combatSource=c.createBufferSource();this.combatSource.buffer=this.combatBuffer;this.combatSource.loop=true;this.combatSource.connect(this.combatGain);
    this.combatSource.start(when,this.game.time%this.combatBuffer.duration);
    this.step=Math.ceil(this.game.time/(BEAT/2));clearInterval(this.timer);
    this.master.gain.setTargetAtTime(this.enabled?this.volume:0,c.currentTime,.05);
    this.timer=setInterval(()=>this.tick(),25);this.tick();
  }
  position(){return this.active&&this.ctx?.state==='running'?this.ctx.currentTime-this.anchor:this.game.time;}
  stop(){this.generation++;this.active=false;clearInterval(this.timer);if(this.ctx)this.ctx.suspend();}
  setVolume(v){this.volume=v;this.sync();}
  toggle(){this.enabled=!this.enabled;this.sync();return this.enabled;}
  sync(){if(this.ctx)this.master.gain.setTargetAtTime(this.enabled?this.volume:0,this.ctx.currentTime,.04);}
  measure(){
    if(!this.active||this.ctx.state!=='running'){this.energy*=.92;for(const k in this.levels)this.levels[k]*=.9;return this.energy;}
    this.analyser.getByteFrequencyData(this.spectrum);
    const bin=this.ctx.sampleRate/this.analyser.fftSize,band=(lo,hi)=>{let sum=0,n=0;for(let i=Math.max(1,Math.floor(lo/bin));i<=Math.min(this.spectrum.length-1,Math.ceil(hi/bin));i++){sum+=this.spectrum[i]/255;n++;}return sum/Math.max(1,n);};
    const bass=band(35,180),mid=band(250,2200),high=band(3500,11000);
    this.levels.impact=Math.max(this.levels.impact*.86,Math.min(1,Math.max(0,bass-this.levels.bass)*3));
    this.levels.bass+=(bass-this.levels.bass)*.32;this.levels.mid+=(mid-this.levels.mid)*.22;this.levels.high+=(high-this.levels.high)*.25;
    this.energy+=((bass*.55+mid*.35+high*.1)-this.energy)*.3;return this.energy;
  }
  note(freq,t,duration=.35,vol=.12,type='sine',pan=0){
    const c=this.ctx,o=c.createOscillator(),g=c.createGain(),p=c.createStereoPanner();
    o.type=type;o.frequency.value=freq;p.pan.value=Math.max(-1,Math.min(1,pan));
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+duration);
    o.connect(g);g.connect(p);p.connect(this.dry);p.connect(this.delay);o.start(t);o.stop(t+duration+.04);
    o.onended=()=>{o.disconnect();g.disconnect();p.disconnect();};
  }
  impact(t,duration=.5,volume=.13,pan=0){
    const c=this.ctx;
    if(!this.noise){this.noise=c.createBuffer(1,c.sampleRate*2,c.sampleRate);const data=this.noise.getChannelData(0);let low=0;for(let i=0;i<data.length;i++){low=low*.94+(Math.random()*2-1)*.06;data[i]=low*3;}}
    const source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain(),panner=c.createStereoPanner();source.buffer=this.noise;filter.type='lowpass';filter.frequency.setValueAtTime(3200,t);filter.frequency.exponentialRampToValueAtTime(75,t+duration);panner.pan.value=Math.max(-1,Math.min(1,pan));
    gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(volume,t+.008);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);source.connect(filter);filter.connect(gain);gain.connect(panner);panner.connect(this.dry);source.start(t);source.stop(t+duration+.03);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();panner.disconnect();};
  }
  tick(){
    if(!this.active||this.ctx.state!=='running')return;
    const now=this.ctx.currentTime;
    const mix=musicState(this.game);this.filter.frequency.setTargetAtTime(mix.cutoff,now,.15);this.combatGain.gain.setTargetAtTime(mix.combat,now,.22);
    if(this.anchor+this.step*BEAT/2<now-.1)this.step=Math.ceil((now-this.anchor)/(BEAT/2));
    while(this.anchor+this.step*BEAT/2<now+.1){
      const t=Math.max(now+.005,this.anchor+this.step*BEAT/2),s=this.step;
      if(this.game.dashLeft>0)this.note(scale[(s*3)%8]*2,t,BEAT*.6,.035,'triangle',Math.sin(s)*.6);
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
