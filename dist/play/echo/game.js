import * as THREE from 'three';
import { BEAT_SECONDS, STARTER_PADS, FIRST_COUNTDOWN, BREAK_SECONDS, COMBO_WINDOW, TOTAL_ENEMIES, comboAfterKill, waveReward, ENEMY_TYPES, WAVES, towerStats, planUpgrade, waveSummary, resultFor, forestForRound, planSupport, applyDamage, SUPPORT_COOLDOWN, FORESTS, creditEchoes, suggestUpgrade, canResonate, recordForestStars, RESONANCE_DAMAGE } from './rules.mjs';

const $=s=>document.querySelector(s), clamp=THREE.MathUtils.clamp;
let roundNumber=0;try{const stored=Number(localStorage.getItem('echo.round.v6')||0);roundNumber=Number.isFinite(stored)&&stored>=0?Math.floor(stored):0;}catch{}
const forest=forestForRound(roundNumber),nextForest=forestForRound(roundNumber+1);
let seed=8331+(roundNumber%3)*601;const rand=()=>{seed=seed*16807%2147483647;return(seed-1)/2147483646;};
const state={started:false,paused:false,ended:false,health:6,seeds:3,planted:0,wave:0,fighting:false,kills:0,time:0,points:0,escaped:0,upgrades:0,won:null,combo:0,maxCombo:0,comboAt:-999,multiplier:1,supportHits:0,perfectHits:0,supportReadyAt:0,forest:forest.id,resonanceWave:0,resonanceQueued:false,resonanceUntil:0,resonances:0,overflowScore:0};
const scene=new THREE.Scene();scene.background=new THREE.Color(forest.fog);scene.fog=new THREE.FogExp2(forest.fog,.014);
const camera=new THREE.PerspectiveCamera(66,innerWidth/innerHeight,.08,180);camera.rotation.order='YXZ';
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;$('#world').appendChild(renderer.domElement);

const hemi=new THREE.HemisphereLight(0xc2d5ec,0x343f35,1.55);scene.add(hemi);
const sun=new THREE.DirectionalLight(forest.sun,2.8);sun.position.set(-30,24,-38);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-32,right:32,top:34,bottom:-34,near:1,far:110});sun.shadow.normalBias=.045;sun.shadow.bias=-.0002;sun.target.position.set(0,0,-8);scene.add(sun,sun.target);
const moonFill=new THREE.DirectionalLight(0x8fb1df,.6);moonFill.position.set(16,30,15);scene.add(moonFill);
const cube=new THREE.BoxGeometry(1,1,1), materialCache=new Map();
function texture(kind){const c=document.createElement('canvas');c.width=c.height=32;const ctx=c.getContext('2d');const palettes={stone:['#a4a7a1','#8c9692','#bac0b4','#7b8885'],grass:['#81947a','#75896b','#91a07c','#697e67'],bark:['#7c6a56','#6b5a49','#91806a','#5c5043'],leaf:['#819a85','#6e8e78','#9aa88b','#5c806f'],plank:['#aa9576','#8b795f','#c0aa8a','#74654f'],dirt:['#8e8070','#7c6d60','#a0917e','#6f665b']};const p=palettes[kind]||palettes.stone;ctx.fillStyle=p[0];ctx.fillRect(0,0,32,32);for(let i=0;i<190;i++){ctx.fillStyle=p[Math.floor(rand()*4)];let x=Math.floor(rand()*16)*2,y=Math.floor(rand()*16)*2;ctx.fillRect(x,y,kind==='bark'?2:2+Math.floor(rand()*2)*2,kind==='bark'?4+rand()*10:2);}if(kind==='plank'){ctx.fillStyle='#695d4e';for(let y=0;y<32;y+=8){ctx.fillRect(0,y,32,1);ctx.fillRect((y*3)%29,y,1,8);}}if(kind==='stone'){ctx.fillStyle='#657570';ctx.fillRect(2,14,11,1);ctx.fillRect(12,14,1,7);ctx.fillRect(22,2,1,8);}const t=new THREE.CanvasTexture(c);t.magFilter=THREE.NearestFilter;t.minFilter=THREE.NearestMipmapLinearFilter;t.colorSpace=THREE.SRGBColorSpace;return t;}
const maps={};for(const k of ['stone','grass','bark','leaf','plank','dirt'])maps[k]=texture(k);
function mat(color,kind='',emit=0){const key=[color,kind,emit].join(':');if(!materialCache.has(key))materialCache.set(key,new THREE.MeshStandardMaterial({color,map:maps[kind]||null,roughness:.9,emissive:emit?color:0,emissiveIntensity:emit}));return materialCache.get(key);}
function box(parent,x,y,z,w,h,d,color,kind='',emit=0){const m=new THREE.Mesh(cube,mat(color,kind,emit));m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=!emit;m.receiveShadow=!emit;parent.add(m);return m;}
const staticWorld=new THREE.Group();scene.add(staticWorld);
function groundHeight(x,z){if(z>5&&z<11)return-.8;if(Math.abs(x)<9&&z>-46&&z<24)return 0;return Math.max(0,Math.floor((Math.sin(x*.16+z*.1)*1.2+Math.cos(z*.15)*1.1+Math.abs(x)*.038)*1.1));}
// True textured voxel terrain with distinct soil sides and grass caps.
const terrainMaterial=[mat(0xabb397,'dirt'),mat(0xabb397,'dirt'),mat(0xabc49c,'grass'),mat(0x8c9c82,'dirt'),mat(0xabb397,'dirt'),mat(0xabb397,'dirt')];
const terrain=new THREE.InstancedMesh(cube,terrainMaterial,8000),dummy=new THREE.Object3D(),color=new THREE.Color();let index=0;
for(let x=-45;x<45;x+=1.5)for(let z=-57;z<42;z+=1.5){const h=groundHeight(x,z),height=h+2;dummy.position.set(x,h-height/2-.08,z);dummy.scale.set(1.5,height,1.5);dummy.updateMatrix();terrain.setMatrixAt(index,dummy.matrix);color.setHSL(forest.grassHue+rand()*.035,.12+rand()*.08,.77+rand()*.12);terrain.setColorAt(index++,color);}
terrain.count=index;terrain.receiveShadow=true;scene.add(terrain);
// Small stone path, with a hand-built bridge over the stream.
for(let z=-44;z<24;z+=.85){if(z>4&&z<12)continue;for(let a=-1;a<=1;a++){const x=a*.72+Math.sin(z*.1)*.4;if(rand()>.17)box(staticWorld,x,.025,z,.66+rand()*.12,.07,.62+rand()*.13,rand()>.5?0xc2c2ac:0xa5b1a1,'stone');}}
for(let z=4;z<=12;z+=.47)box(staticWorld,0,.12,z,3.25,.24,.43,0xc5a77d,'plank');
for(const x of [-1.7,1.7]){box(staticWorld,x,.72,8,.13,.14,8.8,0xa88a62,'bark');for(const z of [4,6,8,10,12]){box(staticWorld,x,.29,z,.22,1.65,.22,0x9a8063,'bark');box(staticWorld,x,1.15,z,.32,.13,.32,0xd2bb91,'plank');}}
const skyUniform={top:{value:new THREE.Color(forest.top)},horizon:{value:new THREE.Color(forest.horizon)},night:{value:0}};
const sky=new THREE.Mesh(new THREE.SphereGeometry(140,32,20),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:skyUniform,vertexShader:'varying vec3 vWorld;void main(){vWorld=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform vec3 top;uniform vec3 horizon;uniform float night;varying vec3 vWorld;void main(){vec3 d=normalize(vWorld);float h=smoothstep(-.05,.65,d.y);vec3 c=mix(horizon,top,h);float glow=pow(max(0.,dot(d,normalize(vec3(-.48,.2,-1.)))),22.);c+=vec3(.4,.17,.04)*glow*(1.-night);gl_FragColor=vec4(c,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'}));sky.renderOrder=-10;scene.add(sky);
function glowTexture(){const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d'),g=ctx.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.1,'rgba(255,255,255,.65)');g.addColorStop(.35,'rgba(255,255,255,.15)');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);return new THREE.CanvasTexture(c);}
const glowMap=glowTexture();function glow(parent,x,y,z,size,tint,opacity=.7){const m=new THREE.Sprite(new THREE.SpriteMaterial({map:glowMap,color:tint,transparent:true,opacity,blending:THREE.AdditiveBlending,depthWrite:false}));m.position.set(x,y,z);m.scale.set(size,size,1);parent.add(m);return m;}
const moon=box(scene,-29,24,-82,4.5,4.5,.3,0xffe4bc,'',1.1);glow(scene,-29,24,-81,23,0xf8c59b,.28);
const starGeo=new THREE.BufferGeometry(),starArray=[];for(let i=0;i<550;i++){const a=rand()*Math.PI*2,y=20+rand()*85,r=85+rand()*25;starArray.push(Math.cos(a)*r,y,Math.sin(a)*r);}starGeo.setAttribute('position',new THREE.Float32BufferAttribute(starArray,3));const stars=new THREE.Points(starGeo,new THREE.PointsMaterial({color:0xe4e4db,size:.12,transparent:true,opacity:.65,depthWrite:false}));scene.add(stars);
for(let i=0;i<55;i++){const a=i/55*Math.PI*2,r=67+rand()*12,h=5+rand()*12;box(staticWorld,Math.sin(a)*r,h/2,Math.cos(a)*r,6+rand()*5,h,7+rand()*6,0x788b8a,'stone');}
// Water mixes dark reflections, slow ripples and a broken ribbon of moonlight.
const waterUniforms={time:{value:0},night:{value:0}};const water=new THREE.Mesh(new THREE.PlaneGeometry(100,6,1,1),new THREE.ShaderMaterial({uniforms:waterUniforms,transparent:true,vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 v;uniform float time;uniform float night;void main(){float wave=sin(v.y*120.+time*.7+sin(v.x*35.+time*.2)*2.)*.5+.5;float fine=sin(v.y*340.-time*.5+v.x*50.)*.5+.5;vec3 c=mix(vec3(.11,.23,.28),vec3(.25,.39,.42),wave*.25+fine*.08);float ribbon=exp(-pow((v.x-.32+sin(v.y*29.+time*.6)*.008)*17.,2.))*pow(wave,18.)*(.3+v.y*.4);c+=vec3(.8,.52,.25)*ribbon;c=mix(c,c*vec3(.7,.85,1.1),night);gl_FragColor=vec4(c,.96);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'}));water.rotation.x=-Math.PI/2;water.position.set(0,-.28,8);scene.add(water);
for(let i=0;i<120;i++){const x=-38+rand()*76,z=rand()>.5?4.7:11.3;if(Math.abs(x)<2.5)continue;const h=.15+rand()*.4;box(staticWorld,x,h/2-.12,z,.35+rand()*.7,h,.3+rand()*.55,0x9aaba0,'stone');if(i%3===0){box(staticWorld,x+.2,.38,z,.035,.8,.035,0xb4ad7b);box(staticWorld,x+.24,.85,z,.08,.22,.08,0xc4b384);}}
// Layered, irregular foliage and living ground cover instead of identical tree cones.
const trunks=[];function pine(x,z,scale=1){const y=groundHeight(x,z),g=new THREE.Group();g.position.set(x,y,z);const h=(6+rand()*4)*scale;box(g,0,h*.43,0,.48*scale,h*.86,.48*scale,0xa59177,'bark');for(let layer=0;layer<6;layer++){const w=(3.8-layer*.48)*scale,ly=h*.33+layer*.85*scale;box(g,0,ly,0,w,1.1*scale,w,new THREE.Color(forest.leaf).offsetHSL(0,0,layer*.014).getHex(),'leaf');for(let q=0;q<3;q++){const a=rand()*Math.PI*2;box(g,Math.cos(a)*w*.37,ly-.3,Math.sin(a)*w*.37,w*.4,.6*scale,w*.4,forest.leaf,'leaf');}}box(g,0,h*.33+5.5*scale,0,.5*scale,.8*scale,.5*scale,new THREE.Color(forest.leaf).offsetHSL(0,0,.12).getHex(),'leaf');staticWorld.add(g);trunks.push({x,z,r:.55*scale});}
for(let i=0;i<165;i++){const x=-42+rand()*84,z=-53+rand()*88;if(Math.abs(x)<8.5)continue;if(z>3&&z<13)continue;pine(x,z,.8+rand()*.7);}
// The trees nearest the player frame the clearing like a doorway.
for(const [x,z,s] of [[-7,17,1.5],[8,15,1.4],[-10,-2,1.7],[10,-7,1.5],[-9,-30,1.4],[9,-33,1.5]])pine(x,z,s);
const grassGeo=new THREE.BufferGeometry(),grassVertices=[],grassColors=[];
function blade(x,y,z,h,w,tint){const c=new THREE.Color(tint);for(const [a,b,d] of [[-w/2,0,0],[w/2,0,0],[0,h,.08],[-w/2,0,0],[0,h,.08],[w/2,0,0]]){grassVertices.push(x+a,y+b,z+d);grassColors.push(c.r,c.g,c.b);}}
for(let i=0;i<5500;i++){const x=-35+rand()*70,z=-48+rand()*77;if(Math.abs(x)<1.8||z>4.5&&z<11.5||Math.abs(x)<2.8&&z>-7&&z<-2)continue;const y=groundHeight(x,z);blade(x,y,z,.18+rand()*.45,.05+rand()*.1,[0x748a6e,0x9ba97b,0xa1b296,0x708b75][i%4]);if(i%20===0&&Math.abs(x)<12){box(staticWorld,x,y+.15,z,.12,.2,.12,0xd5c5a3,'',.1);box(staticWorld,x,y+.3,z,.27,.12,.27,i%40?0x88c4d0:0xdfac89,'',.25);}}
grassGeo.setAttribute('position',new THREE.Float32BufferAttribute(grassVertices,3));grassGeo.setAttribute('color',new THREE.Float32BufferAttribute(grassColors,3));grassGeo.computeVertexNormals();const grass=new THREE.Mesh(grassGeo,new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:1}));scene.add(grass);
// Fallen logs, mossy ruins and tiny traces of a lived-in woodland.
for(const [x,z] of [[-7,0],[9,-20],[-6,-32],[6,19]]){box(staticWorld,x,.42,z,3,.75,.8,0xb2a083,'bark');for(let j=0;j<4;j++)box(staticWorld,x-1+j*.55,.83,z,.5,.13,.65,0x899c70,'grass');}
for(const x of [-2.8,2.8]){for(let y=0;y<4;y++)box(staticWorld,x,y*.65+.3,-5,.8,.6,.9,0xaab5ac,'stone');box(staticWorld,x,2.9,-5,1.1,.25,1.1,0xb8c2ab,'stone');}
box(staticWorld,0,3.2,-5,6.5,.6,1,0x9caca2,'stone');box(staticWorld,-.7,3.58,-5,2.6,.2,1.1,0x7e9979,'grass');
const shrine=new THREE.Group();shrine.position.set(0,0,-4.8);scene.add(shrine);
box(shrine,0,.15,0,3.5,.3,3.5,0xa7b3a5,'stone');box(shrine,0,.4,0,2.5,.25,2.5,0xc6c8ad,'stone');box(shrine,0,.8,0,1.1,.7,1.1,0x879c8d,'stone');box(shrine,0,1.22,0,1.45,.15,1.45,0xd8c397,'plank');
const heart=new THREE.Group();heart.position.y=1.95;const heartGem=box(heart,0,0,0,.6,.6,.6,0xffdd9f,'',2.8);heartGem.rotation.set(Math.PI/4,0,Math.PI/4);shrine.add(heart);glow(heart,0,0,0,3.6,0xffcc8b,.48);const heartLight=new THREE.PointLight(0xffd298,18,14,2);heartLight.position.set(0,2,-4.8);scene.add(heartLight);
for(const x of [-1.65,1.65])for(const z of [-1.5,1.5]){box(shrine,x,.7,z,.25,1.2,.25,0xb9aa8d,'bark');box(shrine,x,1.3,z,.38,.2,.38,0xf4cc88,'',1.4);glow(shrine,x,1.4,z,1.4,0xffb966,.6);}
const lanterns=[];function lantern(x,z,h=1.5){const y=groundHeight(x,z);box(staticWorld,x,y+h/2,z,.15,h,.15,0x9f8b70,'bark');box(staticWorld,x,y+h,z,.55,.12,.55,0x8e795f,'plank');box(staticWorld,x,y+h+.25,z,.34,.4,.34,0xffd894,'',2);box(staticWorld,x,y+h+.5,z,.55,.12,.55,0x9e8663,'plank');glow(scene,x,y+h+.24,z,2.7,0xffc27d,.5);const light=new THREE.PointLight(0xffbd75,8,8,2);light.position.set(x,y+h+.3,z);scene.add(light);lanterns.push(light);}
for(const p of [[-2,4],[2,12],[-6,-12],[6,-23],[-3,18]])lantern(...p);
// Moss-covered instrument stones. Their location determines the note and beat.
const padPositions=[[-3.8,-2.5],[3.8,-2.5],[-4.7,-10],[4.7,-10],[-4.6,-17],[4.6,-17],[-4.2,-25],[4.2,-25]];
const pads=[],interactive=[];for(let i=0;i<padPositions.length;i++){const [x,z]=padPositions[i],g=new THREE.Group();g.position.set(x,0,z);scene.add(g);box(g,0,.13,0,1.6,.26,1.6,0x9aa99e,'stone');box(g,0,.31,0,1.22,.12,1.22,0xb2b9a3,'stone');box(g,-.5,.39,.4,.6,.08,.35,0x819577,'grass');box(g,.45,.39,-.4,.35,.08,.5,0x8d9e7a,'grass');const face=box(g,0,.4,0,.62,.055,.62,0xc2bfa0,'stone');for(let q=0;q<4;q++){const a=q*Math.PI/2;box(g,Math.sin(a)*.38,.45,Math.cos(a)*.38,.09,.03,.09,0xb4c5b0,'',.6);}const ghost=box(g,0,.92,0,.15,.15,.15,0xf2ce91,'',1.2);ghost.rotation.z=Math.PI/4;const aura=glow(g,0,.8,0,1.5,0xf1c98c,.35);const hitbox=new THREE.Mesh(new THREE.BoxGeometry(1.7,1.9,1.7),new THREE.MeshBasicMaterial({visible:false}));hitbox.position.set(x,.9,z);hitbox.userData.pad=i;scene.add(hitbox);interactive.push(hitbox);pads.push({group:g,x,z,index:i,active:false,level:0,ghost,aura,pulse:0,hitbox,top:null});}
const coreHit=new THREE.Mesh(new THREE.BoxGeometry(3.2,3,3.2),new THREE.MeshBasicMaterial({visible:false}));coreHit.position.set(0,1.5,-4.8);coreHit.userData.core=true;scene.add(coreHit);interactive.push(coreHit);
// Batch the entire textured environment by material, keeping thousands of cubes economical.
scene.updateMatrixWorld(true);const batches=new Map();staticWorld.traverse(m=>{if(!m.isMesh)return;const key=m.material.uuid;if(!batches.has(key))batches.set(key,{material:m.material,list:[]});batches.get(key).list.push(m);});for(const {material,list}of batches.values()){const b=new THREE.InstancedMesh(cube,material,list.length);list.forEach((m,i)=>b.setMatrixAt(i,m.matrixWorld));b.castShadow=!material.emissiveIntensity;b.receiveShadow=true;scene.add(b);}scene.remove(staticWorld);
// Airborne motes catch the last light; they become fireflies after dark.
const motesGeo=new THREE.BufferGeometry(),motesArray=new Float32Array(260*3);for(let i=0;i<260;i++){motesArray[i*3]=-18+rand()*36;motesArray[i*3+1]=.3+rand()*7;motesArray[i*3+2]=-36+rand()*58;}motesGeo.setAttribute('position',new THREE.BufferAttribute(motesArray,3));const motes=new THREE.Points(motesGeo,new THREE.PointsMaterial({map:glowMap,color:forest.mote,size:.13,transparent:true,opacity:.7,depthWrite:false,blending:THREE.AdditiveBlending}));scene.add(motes);
const lightShaft=new THREE.Mesh(new THREE.ConeGeometry(2.6,14,4,1,true),new THREE.MeshBasicMaterial({color:0xffdba9,transparent:true,opacity:.018,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}));lightShaft.position.set(-7,7,-16);lightShaft.rotation.z=-.32;scene.add(lightShaft);
// A visible hand and the small seed it carries anchor the camera in the world.
const hand=new THREE.Group();hand.scale.setScalar(.72);hand.position.set(.1,-.1,-.18);camera.add(hand);scene.add(camera);box(hand,.44,-.42,-.7,.18,.32,.2,0x8d6b50,'plank');box(hand,.43,-.25,-.66,.2,.2,.23,0xe0b38e);const held=box(hand,.43,-.1,-.67,.18,.18,.18,0xffdba0,'',1.6);held.rotation.set(.4,.5,.6);glow(hand,.43,-.1,-.67,.7,0xf4c380,.2);hand.visible=false;hand.traverse(m=>m.castShadow=false);
// Forest ambience, resonant plucks and physical footsteps share one soft mix.
let audio,master,ambience,noiseBuffer,muted=false,delay,reverb,windFilter;
function initAudio(){if(audio){audio.resume();return;}audio=new(window.AudioContext||window.webkitAudioContext)();master=audio.createGain();master.gain.value=.5;const compressor=audio.createDynamicsCompressor();compressor.threshold.value=-18;compressor.ratio.value=4;master.connect(compressor);compressor.connect(audio.destination);delay=audio.createDelay(1);delay.delayTime.value=.32;const feedback=audio.createGain();feedback.gain.value=.23;const wet=audio.createGain();wet.gain.value=.18;delay.connect(feedback);feedback.connect(delay);delay.connect(wet);wet.connect(master);const impulse=audio.createBuffer(2,audio.sampleRate*2.4,audio.sampleRate);for(let c=0;c<2;c++){const d=impulse.getChannelData(c);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,3);}reverb=audio.createConvolver();reverb.buffer=impulse;const room=audio.createGain();room.gain.value=.17;reverb.connect(room);room.connect(master);noiseBuffer=audio.createBuffer(1,audio.sampleRate*3,audio.sampleRate);const d=noiseBuffer.getChannelData(0);let previous=0;for(let i=0;i<d.length;i++){previous=(previous+.022*(Math.random()*2-1))/1.022;d[i]=previous*3.5;}const wind=audio.createBufferSource();wind.buffer=noiseBuffer;wind.loop=true;windFilter=audio.createBiquadFilter();windFilter.type='lowpass';windFilter.frequency.value=500;ambience=audio.createGain();ambience.gain.value=.28;wind.connect(windFilter);windFilter.connect(ambience);ambience.connect(master);wind.start();}
function tone(freq,duration=.9,volume=.2,pan=0,kind='sine'){if(!audio)return;const now=audio.currentTime,osc=audio.createOscillator(),g=audio.createGain(),p=audio.createStereoPanner();osc.type=kind;osc.frequency.value=freq;g.gain.setValueAtTime(0,now);g.gain.linearRampToValueAtTime(volume,now+.008);g.gain.exponentialRampToValueAtTime(.001,now+duration);osc.connect(g);g.connect(p);p.pan.value=clamp(pan,-.9,.9);p.connect(master);p.connect(delay);p.connect(reverb);osc.start(now);osc.stop(now+duration+.05);}
const keyShift=forest.pitch;
const frequencies=[293.66,349.23,392,440,523.25,587.33,440,349.23].map(f=>f*keyShift);
function note(pad,accent=1){const relative=new THREE.Vector3(pad.x,1,pad.z).sub(camera.position).applyQuaternion(camera.quaternion.clone().invert());const pan=clamp(relative.x/10,-.8,.8),distance=camera.position.distanceTo(new THREE.Vector3(pad.x,1,pad.z));const vol=clamp(1-distance/45,.25,1)*.16*accent;tone(frequencies[pad.index],1.3,vol,pan);tone(frequencies[pad.index]*2,.35,vol*.25,pan);}
function stepSound(){if(!audio)return;const now=audio.currentTime,n=audio.createBufferSource();n.buffer=noiseBuffer;const f=audio.createBiquadFilter(),g=audio.createGain();f.type='lowpass';f.frequency.value=player.z>4&&player.z<12?950:500;g.gain.setValueAtTime(.48,now);g.gain.exponentialRampToValueAtTime(.001,now+.11);n.connect(f);f.connect(g);g.connect(master);n.start(now,Math.random());n.stop(now+.13);tone(player.z>4&&player.z<12?95:65,.09,.07,0,'triangle');}
function toggleSound(){initAudio();muted=!muted;master.gain.setTargetAtTime(muted?0:.5,audio.currentTime,.1);$('#sound').textContent=muted?'♩':'♫';$('#sound').title=muted?'开启声音':'关闭声音';}
// A single verb: plant a light. Pitch, instrument and timing follow the stone.
let subtitleUntil=0,subtitleText='',awakened=false,prepTimer=0,nextNightTimer=0,phase=0,beatTimer=0,beat=0,plantKick=0,nightBlend=0;
function say(text,seconds=5){subtitleText=text;$('#subtitle').textContent=text;$('#subtitle').classList.add('show');subtitleUntil=state.time+seconds;}
function objective(num,title,text){$('#objective-number').textContent=String(num).padStart(2,'0');$('#objective-label').textContent=title;$('#objective-text').textContent=text;}
function updateHUD(){
  if(state.started)updateBuildGuide();
  const counter=$('#seeds'),previous=Number(counter.textContent);
  counter.textContent=state.seeds;
  if(state.started&&state.seeds>previous){$('.pocket').classList.remove('gained');void $('.pocket').offsetWidth;$('.pocket').classList.add('gained');}
  $('#heart-bars').innerHTML=Array.from({length:6},(_,i)=>`<i class="${i>=state.health?'empty':''}"></i>`).join('');
  $('#heart-number').textContent=state.health+' / 6';
}

function rewardText(reward){
  return [reward.received?'+'+reward.received+' 回响':'',reward.points?'+'+reward.points+' 分':''].filter(Boolean).join(' · ');
}
function grantEchoes(amount,position){
  const reward=creditEchoes(state.seeds,amount);state.seeds=reward.balance;state.points+=reward.points;state.overflowScore+=reward.points;
  if(position&&amount)floatText(rewardText(reward),position,true);
  updateHUD();return reward;
}
function activate(pad){if(pad.active){selectTower(pad);upgradeSelected();return;}if(state.planted<3&&!STARTER_PADS.includes(pad.index)){say('先点亮金色的三个位置。',3);return;}if(!awakened){say('先走近桥后的微光，唤醒林间之心。',4);return;}if(state.seeds<1){say('掌心暂时空了。让旋律击退暗影，回响就会回来。',4);return;}state.seeds--;state.planted++;pad.active=true;pad.level=1;renderer.shadowMap.needsUpdate=true;pad.ghost.visible=false;pad.aura.material.opacity=.6;const g=new THREE.Group();pad.group.add(g);pad.building=g;box(g,0,.57,0,.8,.3,.8,0x9ba997,'stone');box(g,0,.95,0,.5,.6,.5,0xb3a080,'plank');box(g,0,1.3,0,.8,.1,.8,0xd7b885,'plank');for(const x of [-.24,.24])box(g,x,1.05,.28,.07,.48,.07,0xe2cfa6);const gem=box(g,0,1.62,0,.36,.36,.36,pad.index%2?0xb9dfd5:0xffd69b,'',2.2);gem.rotation.set(.5,.3,.7);pad.top=gem;glow(g,0,1.6,0,2.1,pad.index%2?0xb7dece:0xfbd093,.38);pad.aura.position.y=1.25;pad.pulse=1;plantKick=1;note(pad,1.5);burst(new THREE.Vector3(pad.x,1.1,pad.z),0xffd69b,16);updateHUD();lastGuide='';updateBuildGuide();if(state.wave===0&&state.planted===3){prepTimer=FIRST_COUNTDOWN;say('好听！5 秒后，听听防线的力量。',4);}else say('共鸣音塔已建造 · 防线 '+state.planted+' / 8',2.5);}

function wake(){if(awakened){say('它在轻轻跳动。只要旋律还在，它就不怕黑。',4);return;}awakened=true;phase=1;prepTimer=0;heartLight.intensity=24;objective(2,'把光种在石头上','走近周围的微光石台，按 E 点亮。');say('它怕黑。为它留下一点声音吧。',6);for(let i=0;i<3;i++)setTimeout(()=>tone([293.66,440,587.33][i],2,.15),i*220);}
const effects=[],enemies=[];
function burst(pos,tint,count=8){for(let i=0;i<count;i++){const m=box(scene,pos.x,pos.y,pos.z,.055,.055,.055,tint,'',1.7);effects.push({mesh:m,life:.7,max:.7,velocity:new THREE.Vector3((rand()-.5)*2,rand()*2+.5,(rand()-.5)*2),shared:true});}}
function trail(from,to,tint){const delta=new THREE.Vector3().subVectors(to,from);const m=new THREE.Mesh(new THREE.BoxGeometry(.025,.025,delta.length()),new THREE.MeshBasicMaterial({color:tint,transparent:true,opacity:.8}));m.position.copy(from).add(to).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),delta.normalize());scene.add(m);effects.push({mesh:m,life:.16,max:.16});}
function pulseRing(pos,tint=0xffd69b){const geo=new THREE.RingGeometry(.5,.53,32);geo.rotateX(-Math.PI/2);const m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:tint,transparent:true,opacity:.6,side:THREE.DoubleSide,depthWrite:false}));m.position.copy(pos);m.position.y=.36;scene.add(m);effects.push({mesh:m,life:1,max:1,ring:true});}
function attack(pad){
  pad.pulse=1;note(pad);
  const stats=towerStats(pad.level);
  if(pad.level>1)tone(frequencies[pad.index]*.5,.6,.035);
  const list=enemies.filter(e=>e.hp>0&&e.mesh.position.distanceTo(new THREE.Vector3(pad.x,0,pad.z))<stats.range).sort((a,b)=>b.mesh.position.z-a.mesh.position.z);
  if(!list.length)return;
  const e=list[0];
  trail(new THREE.Vector3(pad.x,1.7,pad.z),e.mesh.position.clone().add(new THREE.Vector3(0,.6,0)),pad.level===3?0xffd69b:0xc9e6ce);
  damageEnemy(e,stats.damage);
}
function damageEnemy(e,amount,prefix='−'){
  const hit=applyDamage(e.hp,amount);if(!hit.applied)return false;
  e.hp=hit.hp;e.hit=.16;e.slow=.35;
  floatText(prefix+hit.applied,e.mesh.position.clone().add(new THREE.Vector3(0,1.6,0)));
  burst(e.mesh.position.clone().add(new THREE.Vector3(0,.6,0)),0xd3ddba,3);
  if(hit.killed){
    e.assist.hidden=true;
    const chain=comboAfterKill(state.combo,state.comboAt,state.time);
    state.combo=chain.count;state.comboAt=state.time;state.multiplier=chain.multiplier;state.maxCombo=Math.max(state.maxCombo,chain.count);
    state.kills++;state.points+=Math.round(e.points*chain.multiplier);
    const gain=(state.kills%2===0?1:0)+chain.reward;
    if(gain)grantEchoes(gain,e.mesh.position.clone().add(new THREE.Vector3(0,2,0)));
    if(chain.reward){tone(frequencies[chain.count%8]*2,.7,.045);say(chain.count+' 连奏！额外奖励已到账',2);}
    if(canResonate(chain.count,state.resonanceWave,state.wave)){state.resonanceWave=state.wave;state.resonanceQueued=true;}
    $('#combo-hud').classList.remove('popped');void $('#combo-hud').offsetWidth;$('#combo-hud').classList.add('popped');
    burst(e.mesh.position.clone().add(new THREE.Vector3(0,.7,0)),0xeec895,12);
  }
  return true;
}
function resonate(){
  if(!state.resonanceQueued||!state.fighting||state.ended||!enemies.some(e=>e.hp>0))return;
  state.resonanceQueued=false;state.resonanceUntil=state.time+2;state.resonances++;
  const center=new THREE.Vector3(0,2,-4.8);
  for(const p of pads.filter(p=>p.active)){
    p.pulse=1;trail(new THREE.Vector3(p.x,1.8,p.z),center,0xf2d698);pulseRing(new THREE.Vector3(p.x,0,p.z),0xcce9c0);
  }
  pulseRing(new THREE.Vector3(0,0,-4.8),0xffd69b);
  for(const e of enemies.filter(e=>e.hp>0)){
    trail(center,e.mesh.position.clone().add(new THREE.Vector3(0,.8,0)),0xe7dca9);damageEnemy(e,RESONANCE_DAMAGE,'共鸣 −');
  }
  tone(frequencies[0],1.4,.1);tone(frequencies[2],1.2,.075);tone(frequencies[4],1.5,.08);
  say('六连奏！全队共鸣，暗影受到 '+RESONANCE_DAMAGE+' 点伤害',3);
}
const assistGeometry=new THREE.BoxGeometry(1.3,1.7,1.4),assistMaterial=new THREE.MeshBasicMaterial({visible:false});
function supportEnemy(e){
  if(!state.started||state.paused||state.ended||!state.fighting||e.hp<=0)return;
  const shot=planSupport(state.time,state.supportReadyAt,beatTimer);if(!shot.allowed)return;
  state.supportReadyAt=shot.readyAt;state.supportHits++;if(shot.perfect){state.perfectHits++;state.points+=5;}
  const tint=shot.perfect?0xffd493:0xbadfd9,impact=e.mesh.position.clone().add(new THREE.Vector3(0,.7,0));
  trail(viewMode==='first'?camera.position.clone().add(new THREE.Vector3(.2,-.2,-.2)):new THREE.Vector3(0,2,-4.8),impact,tint);
  pulseRing(e.mesh.position,tint);burst(impact,tint,8);plantKick=.8;
  tone(frequencies[(state.supportHits+2)%8],.65,.13,0,'triangle');if(shot.perfect)tone(frequencies[(state.supportHits+2)%8]*2,.4,.06);
  damageEnemy(e,shot.damage,shot.perfect?'合拍 −':'♪ −');
}
function enemyAt(x,y){
  raycaster.setFromCamera(new THREE.Vector2(x/innerWidth*2-1,-y/innerHeight*2+1),camera);
  return raycaster.intersectObjects(enemies.filter(e=>e.hp>0).map(e=>e.hitbox),false)[0]?.object.userData.enemy||null;
}

const beats=[5,1,3,7,4,0,2,6];
function musicalBeat(){
  const index=beats[beat%8],p=pads[index];
  if(p.active)attack(p);
  document.querySelectorAll('#beat-dots i').forEach((el,i)=>{el.classList.toggle('current',i===index);el.classList.toggle('active',pads[i].active);});
  if(beat%4===0){tone(73.42,.4,.075,0,'triangle');heart.scale.setScalar(1.08);}
  beat++;
}

let spawned=0,spawnTimer=0,waveElapsed=0,waveEscapesAtStart=0,waveKillsAtStart=0,rewardUntil=0;const nightNames=['第一夜 · 风停了','第二夜 · 林子深处','最后一夜 · 天亮之前'];
function startNight(){if(state.fighting||state.ended||state.wave>=WAVES.length)return;nextNightTimer=0;prepTimer=0;state.wave++;state.resonanceQueued=false;state.combo=0;state.multiplier=1;state.comboAt=-999;waveEscapesAtStart=state.escaped;waveKillsAtStart=state.kills;$('#wave-reward').hidden=true;state.fighting=true;phase=2;spawned=0;spawnTimer=0;waveElapsed=0;$('#chapter').textContent=nightNames[state.wave-1];$('#chapter-sub').textContent=forest.name+' · 点暗影可以支援';objective(4,'有东西正穿过森林','音石会随旋律驱散暗影。寻找还没点亮的石台。');say(state.wave===1?'风停了。可你的旋律，没有停。':state.wave===2?'黑暗又近了一些。把剩下的光种下吧。':'再坚持一会儿。山那边，快有光了。',6);}
function spawn(){
  const type=WAVES[state.wave-1].enemies[spawned],spec=ENEMY_TYPES[type],g=new THREE.Group();
  const body=box(g,0,.55,0,.55,.55,.85,spec.color,'stone');body.material=body.material.clone();
  box(g,0,.8,.5,.53,.5,.5,spec.color,'stone');
  for(const x of [-.18,.18])box(g,x,1.13,.45,.16,.2,.18,spec.color);
  for(const x of [-.15,.15])box(g,x,.86,.76,.065,.06,.02,type==='runner'?0xffc78b:type==='brute'?0xd5baff:0xccebd0,'',2.5);
  const legs=[];for(const x of [-.22,.22])for(const z of [-.25,.3])legs.push(box(g,x,.18,z,.15,.36,.16,0x3e4c55,'stone'));
  box(g,0,.68,-.55,.17,.16,type==='runner'?.75:.45,spec.color,'stone');
  if(type==='brute'||type==='boss'){box(g,0,.78,-.05,.75,.25,.9,0x8d839b,'stone');box(g,0,1.06,-.2,.35,.2,.55,0xa99fb0,'stone');}
  if(type==='boss'){for(const x of [-.25,0,.25])box(g,x,1.27,.38,.12,.22,.15,0xffd19a,'',1.1);say('最后的巨影来了！点音塔升级，一起放大声音。',4);}
  if(state.wave===1&&spawned===0)say('点一下暗影，弹个音帮帮音塔！',4);
  g.scale.setScalar(spec.scale);g.position.set((rand()-.5)*1.2,0,-38);scene.add(g);
  const bar=new THREE.Group();bar.position.y=1.65;
  const bg=new THREE.Mesh(new THREE.PlaneGeometry(.9,.07),new THREE.MeshBasicMaterial({color:0x203132,depthTest:false}));bar.add(bg);
  const hpFill=new THREE.Mesh(new THREE.PlaneGeometry(.86,.04),new THREE.MeshBasicMaterial({color:type==='brute'?0xc6aed8:type==='runner'?0xe7bc85:0xb4d2b4,depthTest:false}));hpFill.position.z=.01;bar.add(hpFill);g.add(bar);
  const enemy={mesh:g,bar,hpFill,body,type,points:spec.points,baseScale:spec.scale,maxHp:spec.hp,hp:spec.hp,speed:spec.speed,legs,offset:rand()*10,hit:0,slow:0};
  const hitbox=new THREE.Mesh(assistGeometry,assistMaterial);hitbox.position.y=.8;hitbox.userData.enemy=enemy;g.add(hitbox);enemy.hitbox=hitbox;
  const assist=document.createElement('button');assist.className='support-target';assist.setAttribute('aria-label','弹奏支援：'+spec.name);assist.title='点一下，弹奏支援';assist.onclick=()=>supportEnemy(enemy);$('#enemy-targets').appendChild(assist);enemy.assist=assist;
  enemies.push(enemy);spawned++;
}
function removeEnemy(enemy){
  scene.remove(enemy.mesh);enemy.assist.remove();enemy.body.material.dispose();
  for(const mesh of enemy.bar.children){mesh.geometry.dispose();mesh.material.dispose();}
}

function nightCleared(){
  state.fighting=false;state.resonanceQueued=false;
  const reward=waveReward(state.escaped-waveEscapesAtStart,state.health),healed=reward.health-state.health;
  const credited=grantEchoes(reward.seeds,new THREE.Vector3(0,3.5,-4.8));state.health=reward.health;updateHUD();
  if(state.wave===3){finish(true);return;}
  nextNightTimer=BREAK_SECONDS;phase=1;clearSelection();
  $('#chapter').textContent='漂亮，继续！';$('#chapter-sub').textContent='点击已有音塔，直接升级';
  $('#reward-tag').textContent=credited.overflow?'回响满了，也有收获！':reward.perfect?'完美守住！':'好样的，守住了！';
  $('#reward-title').textContent='第 '+state.wave+' 波搞定';
  $('#reward-detail').textContent=rewardText(credited)+(healed?' · 核心 +1':'')+' · 点推荐音塔升级';
  $('#wave-reward').hidden=false;rewardUntil=state.time+2.5;
  tone(frequencies[0],1.1,.1);tone(frequencies[4],1.2,.08);
  say(rewardText(credited)+' · 点金色推荐，升一级！',3);
}

function finish(won){
  if(state.ended)return;
  state.ended=true;state.won=won;state.fighting=false;phase=won?3:2;keys.clear();document.exitPointerLock?.();clearSelection();
  const result=resultFor({won,health:state.health,points:state.points,kills:state.kills,duration:state.time,escaped:state.escaped,maxCombo:state.maxCombo});
  let best=0;try{best=Number(localStorage.getItem('echo.best-score.v6.'+forest.id)||0);if(!Number.isFinite(best))best=0;if(won&&result.score>best){best=result.score;localStorage.setItem('echo.best-score.v6.'+forest.id,String(best));}}catch{}
  let previousStars={};try{previousStars=JSON.parse(localStorage.getItem('echo.forest-stars')||'{}');}catch{}
  const stars=recordForestStars(previousStars,forest.id,result.stars);
  if(won)try{localStorage.setItem('echo.forest-stars',JSON.stringify(stars));}catch{}
  const completed=Object.values(stars).filter(n=>n>0).length;
  $('#forest-stamps').innerHTML='<small>三片原野 · 已守护 '+completed+' / 3</small><div>'+FORESTS.map(f=>'<span class="'+(f.id===forest.id?'current':'')+'"><b>'+f.name+'</b><em>'+Array.from({length:3},(_,i)=>i<stars[f.id]?'★':'☆').join('')+'</em></span>').join('')+'</div>';
  $('#ending-title').innerHTML=won?'天亮了。<br>你的歌，还在林间。':'风吹散了最后的微光。';
  $('#ending-tag').textContent=won?'THE WOODS REMEMBER':'THE WOODS WILL WAIT';
  $('#ending-stars').innerHTML=Array.from({length:3},(_,i)=>`<span class="${i>=result.stars?'dim':''}">★</span>`).join('');
  $('#ending-stars').setAttribute('aria-label',won?result.stars+' 星守护':'守护未完成');
  $('#ending-description').textContent=won?'你守住了'+forest.name+'。下一次，去'+nextForest.name+'听听新的旋律。':'下次试着点一下暗影，弹奏支援。也可以再升级前排音塔。';$('#again').textContent='去'+nextForest.name+'，再来一局 ↗';
  $('#ending-stats').innerHTML=`<div><b>${result.score}</b><span>守护得分</span></div><div><b>${result.kills} / ${TOTAL_ENEMIES}</b><span>驱散暗影</span></div><div><b>${result.health} / 6</b><span>核心完整</span></div>`;
  $('#best-score').textContent='共鸣 '+state.resonances+' 次 · 最高 '+state.maxCombo+' 连奏 · 合拍 '+state.perfectHits+' 次 · 用时 '+clockText(result.duration)+' · 本林最佳 '+best+' 分';
  setTimeout(()=>$('#ending').showModal(),won?1800:900);
  if(won){tone(frequencies[0],2,.12);tone(frequencies[2],2,.07);tone(frequencies[4],2,.08);}$('#wave-reward').hidden=true;
  say(won?'三波已守住。听，鸟儿醒了。':'核心已失守。下一次，让前排的声音更有力量。',6);
}

// First-person movement has weight, a breathing idle, and a bridge you can actually cross.
const player=new THREE.Vector3(0,1.72,1.5),keys=new Set();let yaw=0,pitch=-.02,targetYaw=0,targetPitch=-.02,drag=null,dragMoved=false,lastPointer=null,footDistance=0,motion=0,walkPhase=0;
function start(){if(state.started)return;state.started=true;try{localStorage.setItem('echo.round.v6',String(roundNumber+1));}catch{}$('#intro').classList.add('dismissed');$('#intro').inert=true;$('#hud').hidden=false;initAudio();wake();setView('overview',false);say('点亮这三个金色位置。放心，准备好才开打。',4);updateHUD();renderer.domElement.focus();}

renderer.domElement.tabIndex=0;renderer.domElement.style.outline='none';
function blocked(x,z){if(Math.abs(x)>14||z>23||z<-35)return true;if(z>4.5&&z<11.5&&Math.abs(x)>1.35)return true;if(Math.hypot(x,z+4.8)<1.65)return true;for(const p of pads)if(Math.hypot(x-p.x,z-p.z)<.95)return true;return trunks.some(t=>Math.hypot(x-t.x,z-t.z)<t.r+.22);}
const raycaster=new THREE.Raycaster();let focused=null,focusDistance=999;
function targetAt(x=innerWidth/2,y=innerHeight/2){raycaster.setFromCamera(new THREE.Vector2(x/innerWidth*2-1,-y/innerHeight*2+1),camera);const hits=raycaster.intersectObjects(interactive,false);for(const h of hits){if(viewMode==='overview'||h.distance<5.2)return h.object;}return null;}
function updateInteraction(){focused=targetAt();if(!focused){let nearest=3.3;for(const p of pads){const dist=Math.hypot(player.x-p.x,player.z-p.z);if(dist<nearest){nearest=dist;focused=p.hitbox;}}if(!awakened&&Math.hypot(player.x,player.z+4.8)<4)focused=coreHit;}
 const show=focused&&(!focused.userData.core||!awakened);$('#interaction').hidden=!show;document.body.classList.toggle('aiming',!!show);if(show){const isCore=focused.userData.core;const active=!isCore&&pads[focused.userData.pad].active;$('#interaction-title').textContent=isCore?'林间之心':active?(pads[focused.userData.pad].level===3?'已满级音塔':'直接升级音塔'):'建造音塔';$('#interaction-sub').textContent=isCore?'把掌心贴近这团微光':active?(pads[focused.userData.pad].level===3?'这座已经很有力量，试试另一座':'按 E 升级 · 消耗 '+(pads[focused.userData.pad].level+1)+' 回响'):state.seeds?'消耗 1 回响 · 自动演奏与攻击':'等待旋律带回新的回响';}}
function interact(object=focused){if(!state.started||state.paused||state.ended||!object)return;if(object.userData.core)wake();else activate(pads[object.userData.pad]);}
renderer.domElement.addEventListener('pointerdown',e=>{if(e.button!==0||!state.started||state.paused)return;drag={x:e.clientX,y:e.clientY};dragMoved=false;lastPointer={x:e.clientX,y:e.clientY};renderer.domElement.setPointerCapture(e.pointerId);});
renderer.domElement.addEventListener('pointermove',e=>{if(!state.started||state.paused)return;const locked=document.pointerLockElement===renderer.domElement;if(viewMode==='overview'){if(drag){const dx=e.clientX-lastPointer.x,dy=e.clientY-lastPointer.y;if(Math.abs(e.clientX-drag.x)+Math.abs(e.clientY-drag.y)>5)dragMoved=true;orbitYaw-=dx*.004;orbitPitch=clamp(orbitPitch+dy*.003,.55,1.35);lastPointer={x:e.clientX,y:e.clientY};}return;}if(locked||drag){const dx=locked?e.movementX:e.clientX-lastPointer.x,dy=locked?e.movementY:e.clientY-lastPointer.y;if(drag&&Math.abs(e.clientX-drag.x)+Math.abs(e.clientY-drag.y)>5)dragMoved=true;targetYaw-=dx*.0025;targetPitch=clamp(targetPitch-dy*.0022,-1.25,1.15);lastPointer={x:e.clientX,y:e.clientY};}});
renderer.domElement.addEventListener('pointerup',e=>{if(drag&&!dragMoved){const picked=targetAt(e.clientX,e.clientY)||(viewMode==='first'?focused:null);const enemy=enemyAt(e.clientX,e.clientY);if(enemy)supportEnemy(enemy);else if(picked)interact(picked);else if(viewMode==='overview')clearSelection();}drag=null;});renderer.domElement.addEventListener('pointercancel',()=>drag=null);renderer.domElement.addEventListener('dblclick',e=>{if(viewMode==='first'&&state.started&&!state.paused&&!enemyAt(e.clientX,e.clientY))renderer.domElement.requestPointerLock?.()?.catch(()=>say('按住鼠标拖动，也能环视森林。',3));});renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
renderer.domElement.addEventListener('wheel',e=>{if(viewMode==='overview'&&state.started){e.preventDefault();orbitDistance=clamp(orbitDistance+e.deltaY*.025,28,65);}},{passive:false});

function pause(){if(!state.started||state.ended)return;state.paused=true;keys.clear();document.exitPointerLock?.();document.body.classList.add('paused');$('#pause-dialog').showModal();if(audio)master.gain.setTargetAtTime(0,audio.currentTime,.15);}
function resume(){state.paused=false;$('#pause-dialog').close();document.body.classList.remove('paused');if(audio)master.gain.setTargetAtTime(muted?0:.5,audio.currentTime,.15);renderer.domElement.focus();}
$('#pause-dialog').addEventListener('cancel',e=>{e.preventDefault();resume();});$('#ending').addEventListener('cancel',e=>e.preventDefault());$('#enter').onclick=start;$('#sound').onclick=toggleSound;$('#pause').onclick=pause;$('#resume').onclick=resume;$('#again').onclick=$('#reset').onclick=()=>location.reload();
addEventListener('keydown',e=>{if($('dialog[open]'))return;if(e.code==='KeyV'&&!e.repeat){e.preventDefault();toggleView();}if(e.code==='KeyE'){e.preventDefault();if(!e.repeat)interact();}if(e.code==='Escape'&&document.pointerLockElement!==renderer.domElement)pause();if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();keys.add(e.code);});addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>keys.clear());document.addEventListener('visibilitychange',()=>{keys.clear();if(document.hidden&&state.started&&!state.ended&&!state.paused)pause();});
// Both views share the same world, towers, timer and player position.
let viewMode='overview',orbitYaw=.18,orbitPitch=.95,orbitDistance=49;
const overviewTarget=new THREE.Vector3(0,0,-16);
const avatar=new THREE.Group();box(avatar,0,.74,0,.45,.6,.3,0x829b89,'plank');box(avatar,0,1.3,0,.42,.43,.4,0xdfb995);box(avatar,0,1.54,0,.45,.12,.43,0x685b4a,'bark');for(const x of [-.12,.12])box(avatar,x,.22,0,.17,.44,.22,0x536575);for(const x of [-.33,.33])box(avatar,x,.79,0,.18,.5,.22,0x96a98d);avatar.visible=false;scene.add(avatar);
function setView(mode,notify=true){viewMode=mode;keys.clear();drag=null;document.exitPointerLock?.();document.body.classList.toggle('overview',mode==='overview');document.body.classList.toggle('first-person',mode==='first');camera.fov=mode==='overview'?50:66;camera.updateProjectionMatrix();scene.fog.density=mode==='overview'?.007:.014;renderer.toneMappingExposure=mode==='overview'?1.25:1.1;$('#view-toggle').innerHTML=(mode==='overview'?'◎ 俯瞰建造':'◉ 第一人称')+' <kbd>V</kbd>';$('#view-toggle').setAttribute('aria-label',mode==='overview'?'切换到第一人称':'切换到俯瞰建造');$('#view-notice').textContent=mode==='overview'?'俯瞰建造 · 拖动环视 · 滚轮缩放':'第一人称 · WASD 行走 · 拖动环视';$('.walk-help').innerHTML=mode==='overview'?'<span><kbd>V</kbd> 第一人称</span><span><kbd>拖动 / 滚轮</kbd> 调整视角</span><span><kbd>点击虚影</kbd> 建造</span>':'<span><kbd>V</kbd> 俯瞰建造</span><span><kbd>WASD</kbd> 行走</span><span><kbd>E / 点击</kbd> 建造</span>';if(mode==='overview'){camera.position.set(overviewTarget.x+Math.sin(orbitYaw)*Math.cos(orbitPitch)*orbitDistance,Math.sin(orbitPitch)*orbitDistance,overviewTarget.z+Math.cos(orbitYaw)*Math.cos(orbitPitch)*orbitDistance);camera.lookAt(overviewTarget);}else{camera.position.copy(player);camera.rotation.set(pitch,yaw,0,'YXZ');}camera.updateMatrixWorld(true);if(state.started)updateMarkers();if(notify)say(mode==='overview'?'俯瞰建造：点击金色虚影即可建造。':'第一人称：靠近标记石台，按 E 建造。',3);}
function toggleView(){if(!state.started){start();return;}if(!state.paused)setView(viewMode==='overview'?'first':'overview');}
$('#view-toggle').onclick=toggleView;$('#send-wave').onclick=()=>{if(state.started&&!state.paused&&!state.ended&&!state.fighting&&state.planted>=3)startNight();};
const recommended=STARTER_PADS,padMarkers=[];
const ghostMaterial=new THREE.MeshStandardMaterial({color:0xf4d095,emissive:0xb79354,emissiveIntensity:.3,transparent:true,opacity:.2,depthWrite:false,roughness:.6});
const edgeMaterial=new THREE.LineBasicMaterial({color:0xffd496,transparent:true,opacity:.65});
const edgeGeometry=new THREE.EdgesGeometry(cube);
for(const p of pads){const preview=new THREE.Group();p.group.add(preview);for(const [y,w,h]of [[.75,.65,.7],[1.18,1,.12],[1.52,.38,.38]]){const m=new THREE.Mesh(cube,ghostMaterial);m.position.y=y;m.scale.set(w,h,w);preview.add(m);const edge=new THREE.LineSegments(edgeGeometry,edgeMaterial);edge.position.copy(m.position);edge.scale.copy(m.scale);preview.add(edge);}p.preview=preview;const wrap=document.createElement('div');wrap.className='world-marker';const button=document.createElement('button');button.className='pad-marker';button.setAttribute('aria-label',`建造第 ${p.index+1} 座共鸣音塔，消耗 1 回响`);button.onclick=()=>{if(!state.started||state.paused||state.ended)return;if(viewMode==='first'&&Math.hypot(player.x-p.x,player.z-p.z)>5.2){say('走近标记石台后，按 E 建造。',3);return;}activate(p);};button.onmouseenter=()=>showRange(p);button.onmouseleave=()=>{rangeUntil=state.time+.2;};wrap.appendChild(button);$('#world-markers').appendChild(wrap);padMarkers.push({wrap,button,pad:p});}
function placeLabel(text,position,enemy=false){const wrap=document.createElement('div');wrap.className='world-marker';const el=document.createElement('div');el.className='place-marker'+(enemy?' enemy':'');el.textContent=text;wrap.appendChild(el);$('#world-markers').appendChild(wrap);return {wrap,position};}
const placeLabels=[placeLabel('◇ 保护核心',new THREE.Vector3(0,4,-4.8)),placeLabel('↓ 敌人入口',new THREE.Vector3(0,1.8,-39),true)];
const rangeRing=new THREE.Mesh(new THREE.RingGeometry(12.88,13,64),new THREE.MeshBasicMaterial({color:0xd4e5bd,transparent:true,opacity:.27,side:THREE.DoubleSide,depthWrite:false}));rangeRing.rotation.x=-Math.PI/2;rangeRing.visible=false;scene.add(rangeRing);let rangeUntil=0;
function showRange(p){if(viewMode!=='overview')return;rangeRing.position.set(p.x,.16,p.z);rangeRing.scale.setScalar(p.active?towerStats(p.level).range/13:1);rangeRing.visible=true;rangeUntil=state.time+4;}
// A few arrows give the route a readable direction before any enemies arrive.
for(const z of [-38,-31,-23,-15])for(const side of [-1,1]){const a=box(scene,side*.23,.12,z,.08,.035,.7,0xd9b77c,'',.3);a.rotation.y=-side*.7;}
for(const x of [-1.8,1.8]){box(scene,x,1.2,-43,.55,2.4,.6,0x65747b,'stone');box(scene,x,2.5,-43,.65,.18,.7,0xb9987e,'plank');glow(scene,x,2.5,-43,2.5,0xe6a077,.35);}
let lastGuide='',lastWaveText='';
function updateBuildGuide(){
  const initial=state.planted<3,p=selectedTower===null?null:pads[selectedTower];
  const key=[state.fighting,state.wave,initial,state.planted,state.seeds,selectedTower,p?.level,viewMode,state.ended].join(':');
  if(key===lastGuide)return;lastGuide=key;
  $('#build-guide').classList.toggle('tower-selected',!!p);$('#upgrade-actions').hidden=true;
  $('#tower-context').textContent=p?'越高，声音越有力':'只需点击';
  $('#tower-title').textContent=p?'音塔 · '+['','I','II','III'][p.level]:'点亮音塔';
  $('#tower-price').textContent=p?(p.level===3?'已满级':'↑ ◇ '+(p.level+1)):'◇ 1';
  $('#tower-stats').innerHTML=p?'伤害 '+towerStats(p.level).damage+' · 射程 '+towerStats(p.level).range+' 米':'点空位建造<br>再点音塔，就能升级';
  $('#build-instruction').textContent=p?(p.level===3?'这座已满级，点另一座试试':state.seeds>=p.level+1?'再点这座音塔，直接升级':'打怪会带回回响，很快就能升级'):initial?'点亮三个金色位置就开打':suggestUpgrade(pads,state.seeds)!==null?'只看金色推荐，先升这一座':'等音塔打怪，回响会回来';
  $('#build-goal').textContent=initial?'先点三下':'你的乐队';$('#build-count').textContent=initial?state.planted+' / 3':state.planted+' 座音塔';
  document.querySelectorAll('#build-slots i').forEach((el,i)=>el.classList.toggle('done',i<state.planted));
  if(state.ended)return;
  if(initial)objective(1,'点亮三个音塔','准备好才开打，不用赶时间。');
  else if(state.fighting)objective(2,state.wave===3?'最后一波，放大声音！':'一边打怪，一边变强','点暗影可以支援，点金色箭头可以升级。');
  else objective(3,state.wave===0?'准备好了，马上开打':'奖励到账，升一级！','再点已有音塔，就能升级。');
}

function clockText(seconds){const n=Math.max(0,Math.ceil(seconds));return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');}
function updateWaveStatus(){
  const nextWave=Math.min(3,state.fighting?state.wave:state.wave+1),wave=WAVES[nextWave-1],initial=state.planted<3;
  let caption,main,detail;
  if(state.ended){caption='守护结束';main=state.won?'天亮了！':'再试一次';detail='最高 '+state.maxCombo+' 连奏';}
  else if(initial){caption='点亮三个音塔';main=state.planted+' / 3';detail='点三个金色位置，准备好才开打';}
  else if(state.fighting){caption='第 '+state.wave+' 波 / 3';main='还剩 '+Math.max(0,wave.enemies.length-(state.kills-waveKillsAtStart)-(state.escaped-waveEscapesAtStart))+' 只';detail='已击退 '+(state.kills-waveKillsAtStart)+' / '+wave.enemies.length;}
  else{caption=state.wave===0?'第一波，马上来':'下一波，马上来';main=clockText(state.wave===0?prepTimer:nextNightTimer);detail='点音塔直接升级，声音更有力';}
  const key=[caption,main,detail,nextWave,state.planted,state.ended].join(':');if(key===lastWaveText)return;lastWaveText=key;
  $('#wave-caption').textContent=caption;$('#countdown').textContent=main;$('#wave-detail').textContent=detail;$('#wave-number').textContent=nextWave+' / 3';
  $('#wave-preview').textContent=initial||state.ended?'':nextWave===1?'音塔会自己演奏打怪':nextWave===2?'疾影跑得快，重影更耐打':'最后会有一只巨影！';
  $('#wave-status').classList.toggle('combat',state.fighting||state.ended);$('#wave-status').classList.toggle('danger',!initial&&!state.fighting&&!state.ended&&(state.wave===0?prepTimer:nextNightTimer)<=3);
  $('#send-wave').disabled=initial||state.ended||state.fighting;$('#send-wave').hidden=initial||state.ended||state.fighting;
  $('#send-wave').textContent='现在就开打 ↗';
}

function markerPosition(wrap,position){const p=position.clone().project(camera);const visible=p.z>-1&&p.z<1&&Math.abs(p.x)<1.1&&Math.abs(p.y)<1.1;wrap.classList.toggle('hidden',!visible);if(visible){wrap.style.left=(p.x*.5+.5)*innerWidth+'px';wrap.style.top=(-p.y*.5+.5)*innerHeight+'px';}}
function updateMarkers(){const suggestion=suggestUpgrade(pads,state.seeds);for(const {wrap,button,pad:p} of padMarkers){const unlocked=state.planted>=3||STARTER_PADS.includes(p.index);p.preview.visible=!p.active&&unlocked;const distance=Math.hypot(player.x-p.x,player.z-p.z);const visible=unlocked&&(viewMode==='overview'||distance<10);wrap.style.display=visible?'':'none';if(!visible)continue;const rec=recommended.indexOf(p.index);button.disabled=state.ended;button.className='pad-marker'+(p.active?' built':rec>=0&&state.planted<3?' recommended':'')+(p.level>1?' upgraded':'')+(p.index===selectedTower?' selected':'');
button.setAttribute('aria-label',p.active?`升级第 ${p.index+1} 座共鸣音塔，当前 ${p.level} 级`:`建造第 ${p.index+1} 座共鸣音塔，消耗 1 回响`);
const affordable=p.active&&p.level<3&&state.seeds>=p.level+1;button.classList.toggle('can-upgrade',affordable&&p.index===suggestion);button.classList.toggle('upgrade-ready',affordable);
const label=p.active?(p.level<3?(p.index===suggestion?'推荐 ↑<small>':'↑ 升级<small>')+['','I','II','III'][p.level]+' → '+['','I','II','III'][p.level+1]+' · ◇ '+(p.level+1)+'</small>':'♫ 满级 III'):(state.planted<3?'<span class="recommend">点亮 '+(rec+1)+'</span>':'')+'＋ 音塔'+(state.planted<3?'':'<small>◇ 1</small>');if(button.innerHTML!==label)button.innerHTML=label;markerPosition(wrap,new THREE.Vector3(p.x,p.active?2.3:2.1,p.z));}for(const label of placeLabels){label.wrap.style.display=viewMode==='overview'?'':'none';if(viewMode==='overview')markerPosition(label.wrap,label.position);}if(selectedTower!==null){const p=pads[selectedTower];rangeRing.visible=viewMode==='overview';rangeRing.position.set(p.x,.16,p.z);rangeRing.scale.setScalar(towerStats(p.level).range/13);}else if(rangeUntil<state.time)rangeRing.visible=false;}
let selectedTower=null;
const floatingTexts=[];
for(let i=0;i<8;i++)$('#beat-dots').appendChild(document.createElement('i'));
function floatText(text,position,reward=false){
  if(floatingTexts.length>=30){floatingTexts.shift().el.remove();}
  const el=document.createElement('span');el.className='battle-float'+(reward?' reward':'');el.textContent=text;$('#battle-floats').appendChild(el);
  floatingTexts.push({el,position:position.clone(),life:1.1,max:1.1});
}
function updateFloatingTexts(dt){
  for(let i=floatingTexts.length-1;i>=0;i--){const f=floatingTexts[i];f.life-=dt;if(f.life<=0){f.el.remove();floatingTexts.splice(i,1);continue;}const p=f.position.clone().add(new THREE.Vector3(0,(1-f.life/f.max)*1.3,0)).project(camera);f.el.style.display=p.z<1&&p.z>-1?'':'none';f.el.style.left=(p.x*.5+.5)*innerWidth+'px';f.el.style.top=(-p.y*.5+.5)*innerHeight+'px';f.el.style.opacity=Math.min(1,f.life/.25);}
}
function selectTower(pad){
  if(!pad.active||state.ended||state.paused)return;
  selectedTower=pad.index;lastGuide='';showRange(pad);updateBuildGuide();
}
function clearSelection(){selectedTower=null;lastGuide='';rangeRing.visible=false;rangeUntil=0;if(state.started)updateBuildGuide();}
function upgradeSelected(){
  if(selectedTower===null||state.ended||state.paused)return;
  const p=pads[selectedTower],transaction=planUpgrade(p.level,state.seeds);
  if(!transaction.allowed){say(transaction.reason==='max'?'音塔已达到 III 级。':'回响不足。击败暗影后再来升级。',3);return;}
  state.seeds=transaction.balance;p.level=transaction.level;state.upgrades++;
  for(const side of [-1,1]){box(p.building,side*.48,1.1+(p.level-2)*.4,0,.13,.6,.13,p.level===3?0xffd79d:0xb8dec7,'',.7);}
  box(p.building,0,1.42+(p.level-2)*.18,0,1+(p.level-2)*.25,.075,1+(p.level-2)*.25,p.level===3?0xf3ce98:0xafd3bc,'plank',.2);
  p.pulse=1;pulseRing(new THREE.Vector3(p.x,.4,p.z));burst(new THREE.Vector3(p.x,1.8,p.z),0xffd79d,12);note(p,1.5);renderer.shadowMap.needsUpdate=true;
  lastGuide='';updateHUD();floatText('升级 '+['','I','II','III'][p.level],new THREE.Vector3(p.x,2.6,p.z),true);
  say('音塔升至 '+['','I','II','III'][p.level]+' 级 · 伤害 '+towerStats(p.level).damage,3);
}
$('#upgrade-tower').onclick=upgradeSelected;$('#clear-selection').onclick=clearSelection;
function updateJuice(){
  resonate();
  const ready=state.time>=state.supportReadyAt;
  $('#support-meter').hidden=!state.fighting||state.ended;
  $('#support-ready').style.width=clamp((1-(state.supportReadyAt-state.time)/SUPPORT_COOLDOWN)*100,0,100)+'%';
  const hint=state.fighting&&!state.ended?(ready?'♪ 点暗影，弹奏支援':'♪ 余音回响…'):'林间合奏';
  if($('#music-action').textContent!==hint)$('#music-action').textContent=hint;
  for(const e of enemies){
    const projected=e.mesh.position.clone().add(new THREE.Vector3(0,.8*e.baseScale,0)).project(camera);
    e.assist.hidden=e.hp<=0||state.ended||projected.z>1||projected.z< -1||Math.abs(projected.x)>1||Math.abs(projected.y)>1;
    e.assist.style.left=(projected.x*.5+.5)*innerWidth+'px';e.assist.style.top=(-projected.y*.5+.5)*innerHeight+'px';
    e.assist.classList.toggle('cooling',!ready);e.assist.classList.toggle('teaching',state.wave===1&&waveElapsed<5);
    e.assist.style.setProperty('--target-size',e.type==='boss'?'40px':'29px');
  }
  const life=COMBO_WINDOW-(state.time-state.comboAt),show=state.combo>=2&&life>0&&!state.ended;
  $('#combo-hud').hidden=!show;
  if(show){$('#combo-count').textContent=state.combo;$('#combo-bonus').textContent=state.time<state.resonanceUntil?'♪ 全队共鸣爆发':'得分 ×'+state.multiplier;$('#combo-life').style.width=clamp(life/COMBO_WINDOW*100,0,100)+'%';}
  $('#combo-hud').classList.toggle('resonating',state.time<state.resonanceUntil&&!state.ended);
  if(!$('#wave-reward').hidden&&state.time>=rewardUntil)$('#wave-reward').hidden=true;
  const boss=enemies.find(e=>e.type==='boss'&&e.hp>0);$('#boss-hud').hidden=!boss||state.ended;
  if(boss){$('#boss-number').textContent=Math.max(0,boss.hp)+' / '+boss.maxHp;$('#boss-life').style.width=clamp(boss.hp/boss.maxHp*100,0,100)+'%';}
}
let time=0,last=performance.now(),birdTimer=8;const nightFog=new THREE.Color(0x263e51),dayFog=new THREE.Color(forest.fog),nightTop=new THREE.Color(0x11223d),dayTop=new THREE.Color(forest.top),nightHorizon=new THREE.Color(0x627d87),dayHorizon=new THREE.Color(forest.horizon),dawnTop=new THREE.Color(0x647b8c),dawnHorizon=new THREE.Color(0xffcaaa);
function animate(){requestAnimationFrame(animate);const now=performance.now(),dt=Math.min((now-last)/1000,.1);last=now;if(state.paused){renderer.render(scene,camera);return;}time+=dt;if(state.started&&!state.ended)state.time+=dt;
 if(!state.started){camera.position.set(.4+Math.sin(time*.08)*.25,2.0,16.2);camera.rotation.set(-.015,-.055+Math.sin(time*.06)*.02,0,'YXZ');}else if(viewMode==='overview'){
 camera.position.set(overviewTarget.x+Math.sin(orbitYaw)*Math.cos(orbitPitch)*orbitDistance,Math.sin(orbitPitch)*orbitDistance,overviewTarget.z+Math.cos(orbitYaw)*Math.cos(orbitPitch)*orbitDistance);camera.lookAt(overviewTarget);avatar.visible=true;avatar.position.set(player.x,player.y-1.72,player.z);avatar.rotation.y=yaw;hand.visible=false;$('#interaction').hidden=true;
 }else{let move=new THREE.Vector3();if(!state.ended){if(keys.has('KeyW')||keys.has('ArrowUp'))move.z-=1;if(keys.has('KeyS')||keys.has('ArrowDown'))move.z+=1;if(keys.has('KeyA'))move.x-=1;if(keys.has('KeyD'))move.x+=1;if(keys.has('ArrowLeft'))targetYaw+=dt*1.1;if(keys.has('ArrowRight'))targetYaw-=dt*1.1;}move.normalize();const speed=3.5,dx=(move.x*Math.cos(yaw)+move.z*Math.sin(yaw))*dt*speed,dz=(-move.x*Math.sin(yaw)+move.z*Math.cos(yaw))*dt*speed;if(!blocked(player.x+dx,player.z))player.x+=dx;if(!blocked(player.x,player.z+dz))player.z+=dz;const moving=move.lengthSq()>0;motion=THREE.MathUtils.lerp(motion,moving?1:0,dt*8);walkPhase+=dt*8*motion;if(moving){footDistance+=Math.hypot(dx,dz);if(footDistance>.95){stepSound();footDistance=0;}}yaw=THREE.MathUtils.lerp(yaw,targetYaw,Math.min(1,dt*13));pitch=THREE.MathUtils.lerp(pitch,targetPitch,Math.min(1,dt*13));const h=groundHeight(player.x,player.z);player.y=THREE.MathUtils.lerp(player.y,1.72+Math.max(0,h),Math.min(1,dt*8));camera.position.set(player.x,player.y+Math.sin(walkPhase)*.035*motion+Math.sin(time*1.5)*.007,player.z);camera.rotation.set(pitch,yaw+Math.sin(walkPhase*.5)*.002*motion,Math.sin(walkPhase*.5)*.004*motion,'YXZ');hand.position.y=-.12+Math.sin(walkPhase)*.016*motion-plantKick*.07;hand.rotation.x=-plantKick*.25;plantKick=Math.max(0,plantKick-dt*3);held.rotation.y=time*.4;held.visible=state.seeds>0;avatar.visible=false;hand.visible=true;updateInteraction();}
 if(state.started){updateBuildGuide();updateWaveStatus();updateMarkers();updateFloatingTexts(dt);updateJuice();}

 const nightTarget=state.ended&&phase===3?-1:state.fighting?1:awakened?.35:0;nightBlend=THREE.MathUtils.lerp(nightBlend,nightTarget,dt*(state.ended&&state.won?1.1:.14));if(nightBlend>=0){scene.fog.color.copy(dayFog).lerp(nightFog,nightBlend);skyUniform.top.value.copy(dayTop).lerp(nightTop,nightBlend);skyUniform.horizon.value.copy(dayHorizon).lerp(nightHorizon,nightBlend);hemi.intensity=1.55-nightBlend*.65;sun.intensity=2.8-nightBlend*2.15;}else{const dawn=-nightBlend;scene.fog.color.copy(dayFog).lerp(new THREE.Color(0xa5b0a0),dawn);skyUniform.top.value.copy(dayTop).lerp(dawnTop,dawn);skyUniform.horizon.value.copy(dayHorizon).lerp(dawnHorizon,dawn);sun.intensity=2.8+dawn;hemi.intensity=1.55+dawn*.3;}skyUniform.night.value=Math.max(0,nightBlend);waterUniforms.time.value=time;waterUniforms.night.value=Math.max(0,nightBlend);stars.material.opacity=.35+Math.max(0,nightBlend)*.6;motes.position.y=Math.sin(time*.2)*.15;lightShaft.material.opacity=.018*(1-Math.max(0,nightBlend));
 heartGem.rotation.y=time*.35;heart.position.y=1.95+Math.sin(time*1.5)*.06;heart.scale.lerp(new THREE.Vector3(1,1,1),dt*5);heartLight.intensity=(awakened?20:12)+Math.sin(time*2)*1.5;for(let i=0;i<lanterns.length;i++)lanterns[i].intensity=7.5+Math.sin(time*7+i)*.6;
 for(const p of pads){p.pulse=Math.max(0,p.pulse-dt*2.8);p.ghost.rotation.y=time*.5;p.ghost.position.y=.9+Math.sin(time*1.5+p.index)*.09;if(p.top){p.top.rotation.y=time*.5;p.top.position.y=1.62+Math.sin(time*2+p.index)*.05+p.pulse*.1;}p.aura.material.opacity=(p.active?.4:.2)+p.pulse*.35;p.aura.scale.setScalar((p.active?2.3:1.6)+p.pulse*.5);}
 if(state.started&&!state.ended){if(subtitleUntil&&state.time>subtitleUntil){$('#subtitle').classList.remove('show');subtitleUntil=0;}if(awakened){beatTimer-=dt;if(beatTimer<=0){musicalBeat();beatTimer=BEAT_SECONDS;}if(state.wave===0&&!state.fighting&&state.planted>=3){prepTimer-=dt;if(prepTimer<=0)startNight();}if(nextNightTimer>0){nextNightTimer-=dt;if(nextNightTimer<=0)startNight();}}
 if(state.fighting){waveElapsed+=dt;spawnTimer-=dt;const total=WAVES[state.wave-1].enemies.length;if(spawned<total&&spawnTimer<=0){spawn();spawnTimer=WAVES[state.wave-1].interval;}for(let i=enemies.length-1;i>=0;i--){const e=enemies[i];if(e.hp<=0){removeEnemy(e);enemies.splice(i,1);continue;}e.slow=Math.max(0,e.slow-dt);e.hit=Math.max(0,e.hit-dt);e.mesh.position.z+=e.speed*(e.slow>0?.6:1)*dt;e.mesh.position.x=Math.sin(e.mesh.position.z*.1)*.3;e.mesh.position.y=Math.abs(Math.sin(time*6+e.offset))*.025;e.legs.forEach((l,j)=>l.rotation.x=Math.sin(time*7+e.offset+j*2)*.4);e.mesh.scale.y=e.baseScale*(1+e.hit*.7);e.body.material.emissive.setHex(e.hit>0?0xd7c49c:0x000000);e.body.material.emissiveIntensity=e.hit>0?.8:0;e.bar.quaternion.copy(camera.quaternion);e.hpFill.scale.x=Math.max(0,e.hp/e.maxHp);e.hpFill.position.x=-.38*(1-e.hpFill.scale.x);if(e.mesh.position.z>-5.7){state.health--;state.escaped++;state.combo=0;state.multiplier=1;floatText('核心 −1',new THREE.Vector3(0,3.5,-4.8));say('核心受到攻击 · 剩余 '+state.health+' / 6',3);burst(new THREE.Vector3(0,1.9,-4.8),0xffb18c,18);$('#damage').classList.add('hit');setTimeout(()=>$('#damage').classList.remove('hit'),450);removeEnemy(e);enemies.splice(i,1);tone(55,.6,.18,0,'triangle');updateHUD();if(state.health<=0){finish(false);break;}}}if(spawned>=total&&enemies.length===0&&!state.ended)nightCleared();$('#night-progress i').style.width=clamp((state.kills+state.escaped)/TOTAL_ENEMIES*100,0,100)+'%';}
 birdTimer-=dt;if(birdTimer<0&&!state.fighting){tone(1400+rand()*500,.15,.012,-.7);setTimeout(()=>tone(1800,.16,.009,.6),180);birdTimer=9+rand()*12;}}
 for(let i=effects.length-1;i>=0;i--){const e=effects[i];e.life-=dt;if(e.life<=0){scene.remove(e.mesh);if(!e.shared){e.mesh.geometry.dispose();e.mesh.material.dispose();}effects.splice(i,1);continue;}if(e.velocity){e.velocity.y-=dt*2;e.mesh.position.addScaledVector(e.velocity,dt);e.mesh.scale.setScalar(.055*(.5+e.life/e.max*.5));}else if(e.ring){e.mesh.scale.setScalar(1+(1-e.life/e.max)*3);e.mesh.material.opacity=e.life/e.max*.5;}else e.mesh.material.opacity=e.life/e.max*.8;}
 if(state.ended&&phase===3){$('#night-progress i').style.width='100%';$('#chapter').textContent='晨光初现';$('#chapter-sub').textContent='森林记住了你的声音';}renderer.render(scene,camera);if(new URLSearchParams(location.search).has('qa'))document.body.dataset.frame=JSON.stringify({...state,viewMode,prepTimer,nextNightTimer,spawned,awakened,activePads:pads.filter(p=>p.active).length,towerLevels:pads.map(p=>p.level),selectedTower,enemyDetails:enemies.map(e=>({type:e.type,hp:e.hp,z:Number(e.mesh.position.z.toFixed(2))})),enemies:enemies.length,position:player.toArray(),time});}
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
document.title='回响原野 · '+forest.name;$('#chapter').textContent=forest.name;$('#chapter-sub').textContent='三下点亮，守过黑夜';$('#intro .eyebrow').innerHTML='<span></span>'+forest.tag;document.body.dataset.forest=forest.id;
updateHUD();animate();setTimeout(()=>{$('#loading').style.opacity=0;setTimeout(()=>$('#loading').remove(),1000);},250);
window.resonance={snapshot:()=>({...state,viewMode,prepTimer,nextNightTimer,spawned,awakened,activePads:pads.filter(p=>p.active).length,towerLevels:pads.map(p=>p.level),selectedTower,enemyDetails:enemies.map(e=>({type:e.type,hp:e.hp,z:Number(e.mesh.position.z.toFixed(2))})),enemies:enemies.length,position:player.toArray(),renderCalls:renderer.info.render.calls})};
