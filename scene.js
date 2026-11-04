import * as THREE from './vendor/three.module.js';
import {createEcho,createWave} from './world-models.js';
export const experience={energy:0,soundOn:false,world:0,warp:0};
let applyTransition=(index,onReveal)=>{experience.world=index;onReveal();return Promise.resolve()};
export function transitionTo(index,onReveal){return applyTransition(index,onReveal)}
const canvas=document.querySelector('#scene');
try{
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(40,1,.1,100);camera.position.set(0,0,12);const worldStage=new THREE.Group();scene.add(worldStage);const root=new THREE.Group();worldStage.add(root);
scene.add(new THREE.HemisphereLight(0xc5c4ff,0x080822,1.5));const light=new THREE.PointLight(0x96bcff,45,20);light.position.set(1,4,5);scene.add(light);const violet=new THREE.PointLight(0xb987ff,38,15);violet.position.set(7,-.5,3);scene.add(violet);const warm=new THREE.PointLight(0xb2a5ff,25,15);warm.position.set(0,-2,3);scene.add(warm);
const uniforms={uTime:{value:0},uEnergy:{value:0},uWarp:{value:0}};

// Screen-space nebula field: distant clouds stay behind the interactive planet.
const nebulaUniforms={uTime:uniforms.uTime,uAspect:{value:innerWidth/innerHeight},uTint:{value:new THREE.Color('#bdb4ff')},uWarp:uniforms.uWarp};
const nebula=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.ShaderMaterial({
 uniforms:nebulaUniforms,depthTest:false,depthWrite:false,
 vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,.999,1.);}`,
 fragmentShader:`
 precision highp float;
 uniform float uTime;uniform float uAspect;uniform vec3 uTint;uniform float uWarp;varying vec2 vUv;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
 float fbm(vec2 p){float v=0.,a=.5;mat2 r=mat2(.8,-.6,.6,.8);for(int i=0;i<5;i++){v+=noise(p)*a;p=r*p*2.04+vec2(8.3);a*=.5;}return v;}
 void main(){
 vec2 p=(vUv-.5)*vec2(uAspect,1.)*2.;
 float t=uTime*.006;
 float n=fbm(p*2.3+vec2(t,-t*.6));
 float wisps=fbm(p*5.+n*2.+vec2(-t,t));
 float axis=p.y-.32*p.x+.08+(n-.5)*.38;
 float band=exp(-axis*axis*5.);
 float strands=pow(max(0.,n*.65+wisps*.45),2.);
 vec3 c=vec3(.005,.007,.023);
 vec3 blue=vec3(.055,.10,.27),purple=vec3(.19,.065,.28);
 float hue=smoothstep(-1.,1.4,p.x+wisps);
 c+=mix(blue,purple,hue)*band*strands*1.8;
 c+=vec3(.09,.045,.16)*pow(n,3.)*.7;
 float dust=fbm(p*9.+vec2(4.,1.));
 c*=1.-smoothstep(.49,.77,dust)*band*.45;
 float core=exp(-length((p-vec2(.62,.1))*vec2(.7,1.8))*1.8);
 c+=vec3(.08,.055,.14)*core*wisps;
 c+=uTint*band*strands*.027;
 float radius=length((vUv-vec2(.72,.5))*vec2(uAspect,1.));
 float angle=atan(vUv.y-.5,(vUv.x-.72)*uAspect);
 c+=uTint*uWarp*(.035/(.12+radius)+pow(sin(angle*35.+uTime*.8)*.5+.5,18.)*.13);
 gl_FragColor=vec4(c,1.);
 }`
}));nebula.frustumCulled=false;nebula.renderOrder=-100;scene.add(nebula);

const vertex=`
uniform float uTime;uniform float uEnergy;varying vec3 vNormal;varying vec3 vPosition;varying vec3 vWorld;
void main(){vec3 p=position;float wave=sin(p.x*3.2+uTime*.6)*sin(p.y*3.6-uTime*.45)*sin(p.z*3.4+uTime*.3);p+=normal*wave*(.09+uEnergy*.14);vPosition=p;vec4 world=modelMatrix*vec4(p,1.);vWorld=world.xyz;vNormal=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*world;}`;
const fragment=`
uniform float uTime;uniform float uEnergy;varying vec3 vNormal;varying vec3 vPosition;varying vec3 vWorld;
void main(){vec3 n=normalize(vNormal),view=normalize(cameraPosition-vWorld);float rim=pow(1.-abs(dot(n,view)),2.4);float glow=pow(max(0.,dot(n,normalize(vec3(-.5,.8,1.)))),8.);float flow=sin(vPosition.y*15.+sin(vPosition.x*4.+uTime*.25)*1.3+uTime*.35)*.5+.5;float strands=pow(flow,22.);float nebula=sin(vPosition.x*2.-uTime*.16)*sin(vPosition.y*3.+uTime*.12)*.5+.5;vec3 deep=vec3(.025,.025,.11);vec3 c=mix(deep,vec3(.10,.11,.32),nebula*.75);c+=vec3(.40,.49,.96)*rim*1.3;c+=vec3(.68,.73,1.)*glow*.7;c+=vec3(.17,.16,.48)*strands*(.3+rim);float purple=pow(max(0.,dot(n,normalize(vec3(1.,-.3,.5)))),6.);c+=vec3(.37,.14,.52)*purple;float pearl=pow(max(0.,dot(n,normalize(vec3(-.4,.7,.7)))),45.);c+=vec3(.83,.83,1.)*pearl;c*=1.+uEnergy*.5;gl_FragColor=vec4(c,.92);}`;
const orb=new THREE.Mesh(new THREE.SphereGeometry(1.72,96,64),new THREE.ShaderMaterial({uniforms,vertexShader:vertex,fragmentShader:fragment,transparent:true}));root.add(orb);
function glowTexture(){const c=document.createElement('canvas');c.width=c.height=128;const cx=c.getContext('2d'),g=cx.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(188,193,255,1)');g.addColorStop(.15,'rgba(145,145,255,.6)');g.addColorStop(.45,'rgba(104,88,220,.12)');g.addColorStop(1,'rgba(55,40,150,0)');cx.fillStyle=g;cx.fillRect(0,0,128,128);return new THREE.CanvasTexture(c)}
const glowMap=glowTexture();const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:glowMap,color:0x7a65dc,transparent:true,opacity:.23,blending:THREE.AdditiveBlending,depthWrite:false}));halo.scale.set(7,7,1);halo.position.z=-1;root.add(halo);
const inner=new THREE.Mesh(new THREE.IcosahedronGeometry(.38,3),new THREE.MeshStandardMaterial({color:0xb5bbf8,roughness:.12,metalness:.8,emissive:0x393781,emissiveIntensity:1}));inner.position.set(-.22,.1,1.4);root.add(inner);
const innerGlow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowMap,transparent:true,opacity:.65,blending:THREE.AdditiveBlending,depthWrite:false}));innerGlow.scale.set(1.3,1.3,1.3);innerGlow.position.copy(inner.position);root.add(innerGlow);
const shell=new THREE.Mesh(new THREE.SphereGeometry(1.77,64,40),new THREE.ShaderMaterial({uniforms,vertexShader:vertex,fragmentShader:`varying vec3 vNormal;varying vec3 vWorld;void main(){float f=pow(1.-abs(dot(normalize(vNormal),normalize(cameraPosition-vWorld))),4.);gl_FragColor=vec4(.61,.70,1.,f*.24);}`,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));root.add(shell);
const rings=[];function makeRing(radius,thin,color,rotation){const g=new THREE.Group();g.rotation.set(...rotation);root.add(g);const ring=new THREE.Mesh(new THREE.TorusGeometry(radius,thin,12,200),new THREE.MeshStandardMaterial({color,metalness:.82,roughness:.25,emissive:color,emissiveIntensity:.12}));g.add(ring);rings.push(g);return g}
const r1=makeRing(2.42,.018,0xb5b9e9,[1.06,.24,-.3]);const r2=makeRing(2.8,.009,0x9d7cbd,[.34,-.55,.5]);makeRing(2.15,.009,0xc9c2ef,[.42,.72,-.3]);
const bars=new THREE.Group();r1.add(bars);const barMaterial=new THREE.MeshStandardMaterial({color:0xbcc8ff,emissive:0x6664d9,emissiveIntensity:.5,metalness:.5,roughness:.3});const barCount=96,barMesh=new THREE.InstancedMesh(new THREE.BoxGeometry(.024,1,.027),barMaterial,barCount);bars.add(barMesh);const matrix=new THREE.Object3D();
const satellites=[];for(let i=0;i<9;i++){const angle=i*2.399;const m=new THREE.Mesh(new THREE.SphereGeometry(.05+(i%3)*.04,20,16),new THREE.MeshStandardMaterial({color:i%3===0?0xbf99de:0x9db2e7,metalness:.9,roughness:.17,emissive:0x3c4789,emissiveIntensity:.3}));m.userData={angle,r:2.42+(i%3)*.23,speed:.07+(i%4)*.02};root.add(m);satellites.push(m);}
function musicalNote(x,y,z,scale,rot){const g=new THREE.Group(),mat=new THREE.MeshStandardMaterial({color:0xc5c6f1,roughness:.22,metalness:.8,emissive:0x2d2b60});function m(geo,p){const o=new THREE.Mesh(geo,mat);o.position.set(...p);g.add(o);return o}const head=m(new THREE.SphereGeometry(.14,24,16),[0,0,0]);head.scale.set(1.2,.65,1);m(new THREE.CylinderGeometry(.022,.022,.65,12),[.12,.29,0]);const flag=m(new THREE.TorusGeometry(.16,.027,8,24,1.8),[.27,.52,0]);flag.rotation.z=-.5;g.position.set(x,y,z);g.scale.setScalar(scale);g.rotation.z=rot;root.add(g);return g}const n1=musicalNote(-2.4,1.3,.4,.85,-.2),n2=musicalNote(2.55,-1.0,.7,.65,.2);

const dustCount=4800,positions=new Float32Array(dustCount*3),sizes=new Float32Array(dustCount),starColors=new Float32Array(dustCount*3),phases=new Float32Array(dustCount);
for(let i=0;i<dustCount;i++){
 const band=i>3200,x=(Math.random()-.5)*65;
 positions[i*3]=x;positions[i*3+1]=band?x*.24+(Math.random()-.5)*5:(Math.random()-.5)*40;positions[i*3+2]=-6-Math.random()*32;
 sizes[i]=Math.random()<.012?7+Math.random()*3:1.7+Math.random()*3;phases[i]=Math.random()*6.28;
 const color=new THREE.Color(i%13===0?0xf3d5bc:i%3===0?0xb7b2ff:0xbfd9ff);
 starColors[i*3]=color.r;starColors[i*3+1]=color.g;starColors[i*3+2]=color.b;
}
const dustGeometry=new THREE.BufferGeometry();dustGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));dustGeometry.setAttribute('aSize',new THREE.BufferAttribute(sizes,1));dustGeometry.setAttribute('aColor',new THREE.BufferAttribute(starColors,3));dustGeometry.setAttribute('aPhase',new THREE.BufferAttribute(phases,1));
const dust=new THREE.Points(dustGeometry,new THREE.ShaderMaterial({
 uniforms:{uTime:uniforms.uTime},
 vertexShader:`attribute float aSize;attribute vec3 aColor;attribute float aPhase;uniform float uTime;varying float vOpacity;varying vec3 vColor;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=max(1.5,aSize*(32./-mv.z));vOpacity=.65+.35*(sin(aPhase+uTime*.45)*.5+.5);vColor=aColor;}`,
 fragmentShader:`varying float vOpacity;varying vec3 vColor;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;float a=pow(1.-d*2.,1.25);gl_FragColor=vec4(mix(vColor,vec3(1.),a*.55),a*vOpacity);}`,
 transparent:true,depthWrite:false,blending:THREE.AdditiveBlending
}));scene.add(dust);

const echoWorld=createEcho(glowMap),waveWorld=createWave(glowMap);const worldGroups=[root,echoWorld.group,waveWorld.group];worldStage.add(echoWorld.group,waveWorld.group);echoWorld.group.visible=false;waveWorld.group.visible=false;
const themeColors=[new THREE.Color('#bdb4ff'),new THREE.Color('#e9d7a0'),new THREE.Color('#9ee6ff')];
const ambientColors=[new THREE.Color('#a7b8ff'),new THREE.Color('#dbce9c'),new THREE.Color('#98dcff')];
const shockMaterial=new THREE.MeshBasicMaterial({color:0xc6c1ff,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending});
const shock=new THREE.Mesh(new THREE.TorusGeometry(1,.025,8,128),shockMaterial);scene.add(shock);shock.visible=false;
const streakCount=850,streakPositions=new Float32Array(streakCount*6),tails=new Float32Array(streakCount*2);
for(let i=0;i<streakCount;i++){const x=(Math.random()-.5)*40,y=(Math.random()-.5)*25,z=-5-Math.random()*30;for(let j=0;j<2;j++){streakPositions.set([x,y,z],i*6+j*3);tails[i*2+j]=j;}}
const streakGeometry=new THREE.BufferGeometry();streakGeometry.setAttribute('position',new THREE.BufferAttribute(streakPositions,3));streakGeometry.setAttribute('aTail',new THREE.BufferAttribute(tails,1));
const streaks=new THREE.LineSegments(streakGeometry,new THREE.ShaderMaterial({uniforms:{uWarp:uniforms.uWarp,uTime:uniforms.uTime,uTint:nebulaUniforms.uTint},vertexShader:`attribute float aTail;uniform float uWarp;uniform float uTime;varying float vAlpha;void main(){vec3 p=position;p.z=mod(p.z+uTime*20.,35.)-35.;p.z+=aTail*uWarp*8.;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;vAlpha=(.1+aTail*.6)*uWarp;}`,fragmentShader:`uniform vec3 uTint;varying float vAlpha;void main(){gl_FragColor=vec4(mix(uTint,vec3(1.),.3),vAlpha*.7);}`,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));scene.add(streaks);streaks.visible=false;
let travel=null;
applyTransition=(index,onReveal)=>new Promise(resolve=>{
 targetRotation=0;
 if(reduced){experience.world=index;worldGroups.forEach((g,i)=>{g.visible=i===index;g.scale.setScalar(1);g.position.z=0;g.rotation.y=0});onReveal();resolve();return;}
 if(index===experience.world){onReveal();resolve();return;}
 if(travel){travel.resolve();travel=null;}
 travel={from:experience.world,to:index,start:performance.now(),duration:reduced?180:1550,revealed:false,onReveal,resolve};
});
function updateTravel(ms){
 let warp=0;const selected=worldGroups[experience.world];
 if(travel){const p=Math.min(1,Math.max(0,(ms-travel.start)/travel.duration));warp=reduced?0:Math.sin(p*Math.PI)**2;
 if(p<.43){const q=p/.43;worldGroups[travel.from].scale.setScalar(Math.max(.03,1-q*q*.97));worldGroups[travel.from].position.z=-q*5;worldGroups[travel.from].rotation.y=q*.9;}
 else{if(!travel.revealed){travel.revealed=true;worldGroups[travel.from].visible=false;worldGroups[travel.from].position.z=0;worldGroups[travel.from].rotation.y=0;worldGroups[travel.from].scale.setScalar(1);experience.world=travel.to;worldGroups[travel.to].visible=true;travel.onReveal();}
 const q=(p-.43)/.57;const grow=1-Math.pow(1-q,3)+Math.sin(q*Math.PI)*.08;worldGroups[travel.to].scale.setScalar(Math.max(.02,grow));worldGroups[travel.to].rotation.y=-Math.pow(1-q,2)*1.2;worldGroups[travel.to].position.z=-(1-q)*3;}
 camera.fov=40+warp*9;camera.updateProjectionMatrix();
 shock.visible=!reduced;shock.position.copy(worldStage.position);shock.material.color.copy(themeColors[travel.to]);shock.scale.setScalar(.4+p*10);shock.material.opacity=Math.sin(p*Math.PI)*.32;
 if(p>=1){worldGroups[travel.to].scale.setScalar(1);worldGroups[travel.to].rotation.y=0;worldGroups[travel.to].position.z=0;const done=travel.resolve;travel=null;shock.visible=false;done();}
 }
 experience.warp=warp;uniforms.uWarp.value=warp;streaks.visible=warp>.01;nebulaUniforms.uTint.value.lerp(themeColors[experience.world],.035);light.color.lerp(ambientColors[experience.world],.025);
}

let pointer={x:0,y:0},targetRotation=0,rotation=0,pulse=0,mobile=false;const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
function resize(){const rect=canvas.getBoundingClientRect();mobile=rect.width<760;renderer.setSize(rect.width,rect.height,false);camera.aspect=rect.width/rect.height;camera.updateProjectionMatrix();worldStage.position.set(mobile?0:3.05,mobile?-1.65:.65,0);worldStage.scale.setScalar(mobile?.6:1);nebulaUniforms.uAspect.value=camera.aspect;}new ResizeObserver(resize).observe(canvas);resize();
window.addEventListener('pointermove',e=>{pointer.x=e.clientX/innerWidth-.5;pointer.y=e.clientY/innerHeight-.5;},{passive:true});function stir(){targetRotation+=Math.PI*.55;pulse=1}document.querySelector('#orbit').addEventListener('click',stir);canvas.addEventListener('pointerdown',stir);let started=0;canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();canvas.hidden=true;document.querySelector('.fallback').hidden=false;document.body.classList.add('no-webgl')});
renderer.setAnimationLoop(ms=>{if(document.hidden)return;if(!started)started=ms;const t=reduced?0:(ms-started)*.001;uniforms.uTime.value=t;const energy=experience.energy;uniforms.uEnergy.value=energy;pulse*=.96;rotation+=(targetRotation-rotation)*.025;worldStage.rotation.y=rotation+(reduced?0:Math.sin(t*.12)*.12)+pointer.x*.08;worldStage.rotation.x=pointer.y*.035;orb.rotation.y=t*.055;shell.rotation.y=-t*.025;inner.rotation.set(t*.15,t*.2,0);halo.material.opacity=.18+energy*.25+pulse*.08;const breathing=1+(reduced?0:Math.sin(t*.7)*.015)+energy*.07+pulse*.03;orb.scale.setScalar(breathing);shell.scale.setScalar(breathing);r1.rotation.z=-.3+t*.04;r2.rotation.z=.5-t*.02;for(let i=0;i<barCount;i++){const a=i/barCount*Math.PI*2;const h=.04+Math.pow((Math.sin(i*.48+t*1.7)*.5+.5),3)*(.12+energy*.8)+pulse*.1;matrix.position.set(Math.cos(a)*2.42,Math.sin(a)*2.42,0);matrix.rotation.z=a-Math.PI/2;matrix.scale.set(1,h,1);matrix.updateMatrix();barMesh.setMatrixAt(i,matrix.matrix)}barMesh.instanceMatrix.needsUpdate=true;for(const m of satellites){const d=m.userData,a=d.angle+t*d.speed;m.position.set(Math.cos(a)*d.r,Math.sin(a)*d.r*.55,Math.sin(a)*1.2)}n1.position.y=1.3+Math.sin(t*.5)*.12;n2.position.y=-1+Math.sin(t*.6+1)*.15;dust.rotation.y=t*.0008;camera.position.x+=(pointer.x*.25-camera.position.x)*.015;camera.position.y+=(-pointer.y*.12-camera.position.y)*.015;camera.lookAt(0,0,0);echoWorld.tick(t,energy);waveWorld.tick(t,energy);updateTravel(ms);renderer.render(scene,camera)});
}catch(error){console.warn('3D scene unavailable',error.message);canvas.hidden=true;document.querySelector('.fallback').hidden=false;document.body.classList.add('no-webgl')}
