import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game,BEAT} from '../dist/pulse/game.js';
import {readFileSync} from 'node:fs';
function fresh(){const g=new Game(()=>.42);g.start();g.launch();g.shields=0;g.events=[];return g;}
test('fixed timestep preserves trajectories across frame rates',()=>{
  const a=fresh(),b=fresh();for(let i=0;i<20;i++)a.advance(.1);for(let i=0;i<240;i++)b.advance(1/120);
  assert.equal(a.score,b.score);assert.deepEqual(a.balls,b.balls);assert.equal(a.lives,b.lives);assert.ok(Math.abs(a.time-b.time)<1e-7);
});
test('wall and crystal collisions reflect and score only once',()=>{
  const g=fresh();g.balls=[{x:7.69,y:6,vx:10,vy:10}];g.advance(.02);assert.ok(g.balls[0].vx<0);
  g.bricks=[{id:1,x:0,y:10,w:1.72,h:.88,hp:1,kind:0},{id:2,x:5,y:20,w:1.72,h:.88,hp:1,kind:0}];
  g.balls=[{x:0,y:9.2,vx:0,vy:14}];g.advance(.05);assert.equal(g.bricks[0].hp,0);assert.ok(g.balls[0].vy<0);assert.equal(g.score,100);
  g.advance(.1);assert.equal(g.score,100);
});
test('paddle timing rewards the beat and edge hits allow aiming',()=>{
  const g=fresh();g.time=BEAT-.01;g.balls=[{x:1,y:1.98,vx:0,vy:-12}];g.advance(.01);
  assert.ok(g.balls[0].vy>0);assert.ok(g.balls[0].vx>0);assert.equal(g.perfects,1);assert.equal(g.score,25);
});
test('last live ball consumes a life; ready cannot consume more lives',()=>{
  const g=fresh();g.balls=[{x:6,y:-.65,vx:0,vy:-14},{x:0,y:8,vx:2,vy:12}];g.advance(.02);assert.equal(g.lives,3);
  g.balls=[{x:6,y:-.65,vx:0,vy:-14}];g.advance(.02);assert.equal(g.lives,2);assert.equal(g.status,'ready');
  for(let i=0;i<10;i++)g.advance(.1);assert.equal(g.lives,2);assert.equal(g.launch(),true);assert.equal(g.launch(),false);
});
test('clear offers valid upgrades and starts an increasingly difficult new chapter',()=>{
  const g=fresh();g.bricks.forEach(b=>b.hp=0);g.advance(.01);assert.equal(g.status,'upgrade');assert.equal(g.choices.length,3);assert.equal(new Set(g.choices.map(c=>c.id)).size,3);
  assert.equal(g.choose('unknown'),false);const c=g.choices[0];assert.equal(g.choose(c.id),true);assert.equal(g.level,2);assert.equal(g.status,'ready');assert.ok(g.bricks.some(b=>b.hp>1));
});
test('chain is bounded and multiball launches only the unlocked count',()=>{
  const g=fresh();g.chain=3;g.bricks=[0,1,2].map((_,i)=>({id:i,x:i*2,y:10,hp:1,kind:0}));g.hit(g.bricks[0],1);assert.equal(g.bricks[1].hp,0);assert.equal(g.bricks[2].hp,1);
  g.status='ready';g.balls=[];g.multiball=3;g.launch();assert.equal(g.balls.length,3);
});
test('pause freezes physics and repeated misses eventually end a run',()=>{
  const g=fresh();g.pause();const t=g.time;g.advance(.1);assert.equal(g.time,t);g.resume();assert.equal(g.status,'playing');
  for(let i=0;i<3;i++){g.status='playing';g.balls=[{x:7,y:-.65,vx:0,vy:-14}];g.advance(.02);}assert.equal(g.status,'over');assert.equal(g.lives,0);
});
test('on-beat input fires a pulse and cannot be spammed for energy',()=>{
  const g=fresh();g.time=BEAT;const charge=g.charge;assert.equal(g.tap(),true);assert.equal(g.rhythmStreak,1);assert.equal(g.shots.length,1);assert.ok(g.charge>charge);
  const score=g.score;assert.equal(g.tap(),false);assert.equal(g.score,score);
  g.time=BEAT*1.5;assert.equal(g.tap(),false);assert.equal(g.rhythmStreak,0);assert.equal(g.shots.length,1);
});
test('judgment follows the music clock independently of simulation speed',()=>{
  const g=fresh();g.time=123;g.musicClock=()=>BEAT*4;assert.equal(g.tap(),true);assert.equal(g.rhythmHits,1);
});
test('rhythm pulse hits the aimed column and rhythm can save a falling ball',()=>{
  const g=fresh();g.bricks=[{id:1,x:0,y:8,w:2,h:1,hp:2,kind:0},{id:2,x:6,y:20,w:2,h:1,hp:1,kind:0}];g.bumpers=[];
  g.balls=[{x:0,y:3,vx:1,vy:-10}];g.time=BEAT;g.tap();assert.ok(g.balls[0].vy>0);
  for(let i=0;i<20;i++)g.advance(.01);assert.equal(g.bricks[0].hp,0);assert.equal(g.bricks[1].hp,1);
});
test('overdrive requires full charge, emits powered pulses, and expires',()=>{
  const g=fresh();assert.equal(g.overdrive(),false);g.charge=100;assert.equal(g.overdrive(),true);assert.equal(g.charge,0);assert.equal(g.overdrive(),false);
  g.step(.01);assert.ok(g.shots.some(s=>s.powered));g.driveLeft=.001;g.step(.01);assert.equal(g.driveLeft,0);
});
test('phrase rewards only once and starts the next distinct objective',()=>{
  const g=fresh();g.rhythmHits=6;const score=g.score;g.checkPhrase();assert.equal(g.score,score+600);assert.equal(g.phraseIndex,1);assert.equal(g.phrase.rhythm,false);g.checkPhrase();assert.equal(g.score,score+600);
});
test('a shield rescues one ball and a caught energy shard charges the reactor',()=>{
  const g=fresh();g.shields=1;g.balls=[{x:7,y:-.01,vx:0,vy:-12}];g.step(.01);assert.equal(g.shields,0);assert.ok(g.balls[0].vy>0);assert.equal(g.lives,3);
  const c=g.charge;g.pickups=[{x:0,y:1.9}];g.step(.01);assert.equal(g.charge,c+18);assert.equal(g.pickups.length,0);
});
test('moving formations stay inside rails and boss shield opens on the back four beats',()=>{
  const g=fresh();g.level=3;g.makeLevel();const boss=g.bricks.find(b=>b.boss);assert.ok(boss);
  g.time=BEAT*.1;g.step(.001);const hp=boss.hp;g.hit(boss,3);assert.equal(boss.hp,hp);
  g.time=BEAT*4.2;g.step(.001);g.hit(boss,3);assert.equal(boss.hp,hp-3);
  for(const b of g.bricks)assert.ok(Math.abs(b.x)+b.w/2<8);
});
test('the shipped original soundtrack has stereo music from the first beat and no clipping',()=>{
  const wav=readFileSync(new URL('../dist/pulse/assets/neon-resonance.wav',import.meta.url));
  assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.toString('ascii',8,12),'WAVE');
  assert.equal(wav.readUInt16LE(22),2);assert.equal(wav.readUInt32LE(24),44100);assert.equal(wav.readUInt16LE(34),16);
  const samples=(wav.length-44)/2;assert.ok(Math.abs(samples/(2*44100)-60)<.001);
  let energy=0,peak=0,initial=0;for(let i=0;i<samples;i++){const v=wav.readInt16LE(44+i*2)/32768;energy+=v*v;peak=Math.max(peak,Math.abs(v));if(i<44100)initial+=v*v;}
  assert.ok(Math.sqrt(energy/samples)>.15);assert.ok(Math.sqrt(initial/44100)>.08);assert.ok(peak<.98);
});
