// Original, procedural score: pentatonic melodies over a four-chord progression.
// All notes are scheduled against the audio clock, independently of frame rate.
// Adaptive score engine. The original procedural synth remains authoritative
// for note scheduling; an optional licensed-stem layer and an emotion-mixing
// layer are added on top without changing the documented Music API.
export class Music {
  constructor(onBeat){
    this.onBeat=onBeat;this.stage=0;this.step=0;this.muted=false;this.playing=false;this.timer=null;this.volume=.48;this.bpm=80;this.transpose=0;this.generation=0;this.voices=new Set();
    // Adaptive layer state (all inert until cue()/loadStems are used).
    this.state='home';this.emotion={intensity:0,wonder:.35,danger:0,triumph:0};this.emotionTarget={...this.emotion};
    this.cueLog=[];this.stems=null;this.stemGains={};this.stemMode=false;this.musicVolume=this.volume;this.sfxVolume=.7;this.uiVolume=.5;
    this.emotionClock=0;this.resyncThreshold=.125;this.debug={loadedStems:0,decodedBuffers:0,decodeErrors:0,activeNodes:0};
  }
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
    // Independent music / SFX / UI buses under the master, so volume can be
    // separated. SFX bus already exists; give it the sfx level and add UI.
    if(this.fxBus)this.fxBus.gain.value=this.sfxVolume;
    this.uiBus=c.createGain();this.uiBus.gain.value=this.uiVolume;this.uiBus.connect(this.master);
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

  // ----- Adaptive layer ---------------------------------------------------
  setMusicVolume(v){this.musicVolume=Math.min(1,Math.max(0,v));if(this.musicBus)this.musicBus.gain.setTargetAtTime(this.state==='playing'?this.musicVolume:0,this.ctx.currentTime,.06);}
  setSfxVolume(v){this.sfxVolume=Math.min(1,Math.max(0,v));if(this.fxBus)this.fxBus.gain.setTargetAtTime(this.sfxVolume,this.ctx.currentTime,.06);}
  setUiVolume(v){this.uiVolume=Math.min(1,Math.max(0,v));if(this.uiBus)this.uiBus.gain.setTargetAtTime(this.uiVolume,this.ctx.currentTime,.06);}
  // Cue contract: gameplay emits named events; the score reacts on the audio clock.
  cue(event={}){
    const type=event.type||'unknown';this.cueLog.push({type,t:this.ctx?.currentTime||0});if(this.cueLog.length>200)this.cueLog.shift();
    const e=this.emotionTarget;
    switch(type){
      case 'modeChanged': this.state=event.mode==='home'?'home':'playing'; if(event.mode==='horde')e.intensity=.7; break;
      case 'biomeEntered': e.wonder=Math.min(1,(e.wonder||0)+.35); break;
      case 'stageUp': e.triumph=Math.min(1,(e.triumph||0)+.5); e.intensity=Math.min(1,(e.intensity||0)+.3); this.stage=Math.max(this.stage,event.stage||0); break;
      case 'comboChanged': e.intensity=Math.min(1,Math.max(e.intensity||0,Math.min(1,(event.combo||0)/25))); break;
      case 'dangerChanged': {const d=Math.min(1,Math.max(0,event.level||0));this.dangerActive=this.dangerActive?d>=.4:d>=.6;e.danger=this.dangerActive?Math.max(.4,d):d;break;} // hysteresis 0.6/0.4
      case 'bossStarted': e.danger=1;e.intensity=1;this.boss=true;this.dangerActive=true; break;
      case 'bossDefeated': e.triumph=1;e.danger=0;this.boss=false;this.dangerActive=false;this.flourish(); break;
      case 'hordeWave': e.intensity=Math.min(1,.5+(event.wave||1)*.08); break;
      case 'damaged': e.danger=Math.max(e.danger||0,.6);this.hit(); break;
      case 'dead': this.setState('ending'); break;
      case 'victory': e.triumph=1;this.setState('ending');this.ending(); break;
      case 'unlocked': this.flourish(); break;
      default: break;
    }
    this.applyStemMix();
    return type;
  }
  setState(state){
    if(!['home','briefing','playing','paused','evolution','dialog','ending','background'].includes(state))return this.state;
    this.state=state;const t=this.ctx?.currentTime||0,gain=this.musicBus?.gain;
    const target=state==='playing'?this.musicVolume:state==='home'?this.musicVolume*.7:state==='paused'||state==='dialog'||state==='background'?this.musicVolume*.25:state==='ending'?0:this.musicVolume*.5;
    if(gain){gain.cancelScheduledValues?.(t);gain.setTargetAtTime(target,t,state==='ending'?1:.3);}
    this.applyStemMix();return state;
  }
  // Single authoritative clock: re-anchor beat scheduling to AudioContext time.
  resync(beatPosition){
    if(!this.ctx)return 0;this.beatPosition=beatPosition;
    this.beatOrigin=this.ctx.currentTime+.06-beatPosition*60/this.bpm;
    this.step=Math.ceil(beatPosition*4);this.next=this.beatOrigin+this.step*15/this.bpm;
    return this.beatOrigin;
  }
  audioPhase(beatPosition){
    if(!this.ctx||!this.beatOrigin)return 0;
    const audio=((this.ctx.currentTime-this.beatOrigin)*this.bpm/60)%1;
    const game=(beatPosition||0)%1;
    let diff=audio-game;diff=((diff+.5)%1+1)%1-.5;return diff;
  }
  resyncIfDrifted(beatPosition){
    const diff=this.audioPhase(beatPosition);
    if(Math.abs(diff)>this.resyncThreshold){this.resync(beatPosition);return true;}
    return false;
  }
  // EMA-smooth the emotion vector; called by the scheduler tick (frame-rate independent enough).
  tickEmotion(dt=.016){
    const tau=.5,a=1-Math.exp(-Math.min(dt,.1)/tau);
    for(const key of ['intensity','wonder','danger','triumph'])this.emotion[key]+=(this.emotionTarget[key]-this.emotion[key])*a;
    this.emotionClock+=dt;
  }
  // Lazy, region-scoped licensed stem decks. Uses WebAudio buffers; decoding is
  // on demand and capped so mobile memory stays bounded. No-op outside browsers.
  async loadStems(base='assets/audio/',moods=null){
    if(!this.ctx||typeof fetch!=='function')return false;
    const list=moods||['home','explore','growth','danger','boss','victory'];
    this.stems=this.stems||{};this.stemGains=this.stemGains||{};
    for(const mood of list){
      if(this.stems[mood])continue;
      try{
        const res=await fetch(base+mood+'.mp3');if(!res.ok){this.debug.decodeErrors++;continue;}
        const buf=await res.arrayBuffer();const audio=await this.ctx.decodeAudioData(buf.slice(0));
        const src=this.ctx.createBufferSource(),g=this.ctx.createGain();
        src.buffer=audio;src.loop=true;g.gain.value=0;
        src.connect(g);g.connect(this.musicBus||this.compressor||this.master);
        src.start(0);this.stems[mood]={src,gain:g};this.stemGains[mood]=0;
        this.debug.decodedBuffers++;
      }catch{this.debug.decodeErrors++;}
    }
    this.stemMode=Object.keys(this.stems).length>0;this.debug.loadedStems=Object.keys(this.stems).length;
    if(this.stemMode)this.applyStemMix();
    return this.stemMode;
  }
  // Map the emotion/state vector to a single dominant stem with crossfade.
  applyStemMix(){
    if(!this.stemMode||!this.stems)return;
    const e=this.emotion;let mood='explore';
    if(this.state==='home')mood='home';
    else if(this.state==='ending')mood=(e.triumph||0)>.5?'victory':'home';
    else if(e.danger>.6)mood='danger';
    else if((e.intensity||0)>.72||this.boss)mood='boss';
    else if(e.triumph>.55||(e.intensity||0)>.45)mood='growth';
    else if((e.wonder||0)>.5)mood='explore';
    const t=this.ctx?.currentTime||0,cap=matchMedia?.('(pointer:coarse)')?4:8;
    let active=0;
    for(const [key,deck] of Object.entries(this.stems)){
      const target=key===mood&&this.state!=='paused'&&this.state!=='background'?Math.min(.55,.42*(this.musicVolume||.5)):0;
      if(target>0&&active>=cap){deck.gain.gain.setTargetAtTime(0,t,.8);continue;}
      if(target>0)active++;
      deck.gain.gain.setTargetAtTime(target,t,1.2);this.stemGains[key]=target;
    }
  }
  debugState(){return{state:this.state,cue:this.cueLog.at(-1)?.type||null,emotion:{...this.emotion},stemGains:{...this.stemGains},...this.debug};}
}
