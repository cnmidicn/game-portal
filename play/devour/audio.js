// Original, procedural score: pentatonic melodies over a four-chord progression.
// All notes are scheduled against the audio clock, independently of frame rate.
export class Music {
  constructor(onBeat){this.onBeat=onBeat;this.stage=0;this.step=0;this.muted=false;this.playing=false;this.timer=null;this.volume=.48;this.bpm=80;this.transpose=0;this.generation=0;this.voices=new Set();}
  setBiome(biome){this.biome=biome.id;this.bpm=biome.bpm;this.transpose=biome.root;if(this.delay)this.delay.delayTime.setTargetAtTime(30/this.bpm,this.ctx.currentTime,.1);}
  setVolume(value){this.volume=Math.min(1,Math.max(0,value));if(this.master)this.master.gain.setTargetAtTime(this.muted?0:this.volume,this.ctx.currentTime,.06);}
  async init(){
    if(this.ctx){if(this.ctx.state==='suspended')await this.ctx.resume();return;}
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
    this.ctx=new AC();const c=this.ctx;
    this.master=c.createGain();this.master.gain.value=this.volume;this.master.connect(c.destination);
    this.compressor=c.createDynamicsCompressor();this.compressor.threshold.value=-20;this.compressor.ratio.value=6;this.compressor.connect(this.master);this.musicBus=c.createGain();this.musicBus.gain.value=0;this.musicBus.connect(this.compressor);this.fxBus=c.createGain();this.fxBus.gain.value=.9;this.fxBus.connect(this.compressor);
    this.delay=c.createDelay(1);this.delay.delayTime.value=30/this.bpm;this.feedback=c.createGain();this.feedback.gain.value=.22;this.wet=c.createGain();this.wet.gain.value=.18;
    this.delay.connect(this.feedback);this.feedback.connect(this.delay);this.delay.connect(this.wet);this.wet.connect(this.musicBus);
    this.noise=c.createBuffer(1,c.sampleRate*.2,c.sampleRate);const d=this.noise.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
    await c.resume();
  }
  note(midi,time,duration=.5,type='sine',vol=.16,echo=true,fx=false){if(!this.ctx)return;const c=this.ctx,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.value=440*2**((midi-69)/12);g.gain.setValueAtTime(0,time);g.gain.linearRampToValueAtTime(vol,time+.018);g.gain.exponentialRampToValueAtTime(.001,time+duration);o.connect(g);g.connect(fx?this.fxBus:this.musicBus);if(echo)g.connect(this.delay);o.onended=()=>{o.disconnect();g.disconnect();};o.start(time);o.stop(time+duration+.05);}
  pad(root,t){for(const n of [root,root+7,root+14])this.note(n,t,3.6,'sine',.055);}
  kick(t){const c=this.ctx,o=c.createOscillator(),g=c.createGain();o.frequency.setValueAtTime(105,t);o.frequency.exponentialRampToValueAtTime(38,t+.18);g.gain.setValueAtTime(.37,t);g.gain.exponentialRampToValueAtTime(.001,t+.35);o.connect(g);g.connect(this.musicBus);o.onended=()=>{o.disconnect();g.disconnect();};o.start(t);o.stop(t+.36);}
  hat(t,accent=false){const c=this.ctx,s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();s.buffer=this.noise;f.type='highpass';f.frequency.value=accent?1600:7500;g.gain.setValueAtTime(accent?.1:.035,t);g.gain.exponentialRampToValueAtTime(.001,t+(accent?.14:.055));s.connect(f);f.connect(g);g.connect(this.musicBus);s.onended=()=>{s.disconnect();f.disconnect();g.disconnect();};s.start(t);s.stop(t+.18);}
  start(beatPosition=0){if(!this.ctx)return;this.playing=true;this.musicBus.gain.setTargetAtTime(1,this.ctx.currentTime,.08);if(this.timer)return;this.generation++;this.step=Math.ceil(beatPosition*4);this.beatOrigin=this.ctx.currentTime+.06-beatPosition*60/this.bpm;this.next=this.beatOrigin+this.step*15/this.bpm;this.timer=setInterval(()=>this.schedule(),25);}
  pause(){this.playing=false;this.generation++;clearInterval(this.timer);this.timer=null;if(this.musicBus)this.musicBus.gain.setTargetAtTime(0,this.ctx.currentTime,.06);}
  schedule(){if(!this.playing||this.ctx.state!=='running')return;const c=this.ctx;if(this.next<c.currentTime-.2)this.next=c.currentTime+.02;
    while(this.next<c.currentTime+.12){const s=this.step%16,bar=Math.floor(this.step/16),root=[45,41,48,43][Math.floor(bar/2)%4]+this.transpose,t=this.next;this.currentRoot=root;
      if(s===0)this.pad(root+12,t);
      if(s%4===0)this.note(root+24+[0,7,12,7][s/4],t,1.4,'sine',.09);
      if(this.stage>=1&&s%4===0)this.kick(t);
      if(this.stage>=1&&s%2===0)this.note(root+(s===8?7:0),t,.32,'triangle',.12,false);
      if(this.stage>=2&&s%2===0)this.hat(t,s===4||s===12);
      if(this.stage>=2&&[2,6,9,14].includes(s)){const scale=[0,3,5,7,10,12,15,17];this.note(root+24+scale[(bar*3+s)%scale.length],t,.65,'triangle',.065);}
      if(this.stage>=3&&s%2===1)this.note(root+36+[0,7,10,12,7,5,3,7][(s-1)/2],t,.3,'sine',.055);
      if(this.stage>=4&&s%4===2)this.note(root+19,t,.6,'triangle',.06);
      if(this.stage>=1&&s%2===0){const themes={lagoon:[[0,7,10,12,7,5,3,7],[12,10,7,5,7,3,0,7]],tide:[[0,5,7,12,10,7,5,3],[7,12,15,12,10,7,5,7]],crystal:[[12,7,3,0,7,10,5,3],[7,3,0,5,3,7,10,12]]},motif=(themes[this.biome]||themes.lagoon)[Math.floor(bar/4)%2];if(!(bar%8===7&&s>8))this.note(root+24+motif[s/2],t,.65,'sine',.04);}
      if(this.boss&&s%4===2)this.kick(t);
      if(this.crescendo&&s%2===1)this.note(root+36+[0,3,7,10,12,10,7,3][(s-1)/2],t,.25,'sine',.045);
      if(this.crescendo&&s%4===0)this.hat(t,true);
      if(this.voices.has('storm')&&s%4===2)this.note(root+36+[0,7,12,7][Math.floor(s/4)],t,.28,'sine',.035);
      if(this.voices.has('chorus')&&s===0)this.note(root+31,t,2.2,'sine',.04);
      if(this.voices.has('tempo')&&s%4===3)this.hat(t,false);
      if(this.voices.has('furnace')&&s===8)this.note(root-12,t,.7,'sine',.06,false);
      const beat=s,gen=this.generation;setTimeout(()=>{if(this.playing&&this.generation===gen)this.onBeat?.(beat);},Math.max(0,(t-c.currentTime)*1000));
      this.step++;this.next+=15/this.bpm;
    }
  }
  eat(kind=0,combo=1){if(!this.ctx||!this.playing)return;const note=(this.currentRoot||45)+24+[0,3,5,7,10,12][(kind+Math.floor(combo/3))%6];this.note(note,this.ctx.currentTime,.38,'sine',.095,true,true);}
  isOnBeat(){if(!this.ctx)return false;const phase=((this.ctx.currentTime-(this.beatOrigin||0))/(60/this.bpm)%1+1)%1;return Math.min(phase,1-phase)<.12;}
  flourish(){if(!this.ctx)return;[69,72,76,79,84].forEach((n,i)=>this.note(n+this.transpose,this.ctx.currentTime+i*.09,1.1,'sine',.13,true,true));}
  signature(id){if(!this.ctx)return;const notes={storm:[12,19,24,31],ambush:[0,7,12,19],chorus:[7,10,14,19],reactor:[0,12,7,19],furnace:[0,3,7,12],tempo:[0,7,10,12]}[id]||[0,7,12];notes.forEach((n,i)=>this.note((this.currentRoot||45)+12+n,this.ctx.currentTime+i*.1,.8,'sine',.1,true,true));}
  hit(){if(!this.ctx)return;this.note(35,this.ctx.currentTime,.4,'triangle',.2,false,true);}
  ending(){if(!this.ctx)return;const t=this.ctx.currentTime;[57,60,64,67,72,76,79,84].forEach((n,i)=>this.note(n,t+i*.18,4,'sine',.1,false,true));}
  mute(){this.muted=!this.muted;this.master?.gain.setTargetAtTime(this.muted?0:this.volume,this.ctx.currentTime,.08);return this.muted;}
}
