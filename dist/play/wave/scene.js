import * as T from './vendor/three.module.js';
import {BEAT,SECTIONS} from './game.js';
import {createRidge,Landscape} from './environment.js';
import {CameraRig} from './camera.js';
import {prepareMaterials} from './materials.js';
import {CinematicPass} from './cinematic.js';
import {PulseScenery} from './pulse-scenery.js';
export class FlightScene {
  constructor(canvas,game){
    this.game=game;this.canvas=canvas;this.clock=0;this.energy=0;this.audio={bass:0,mid:0,high:0,impact:0};this.shake=0;this.bank=0;this.effects=[];this.entities=new Map();this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.1;
    this.scene=new T.Scene();this.scene.fog=new T.FogExp2(0x14213e,.004);this.camera=new T.PerspectiveCamera(70,1,.1,800);this.scene.add(this.camera);
    let savedView='chase';try{savedView=localStorage.getItem('game-wave-camera')||'chase';}catch{}this.cameraRig=new CameraRig(savedView);
    this.scene.add(new T.HemisphereLight(0xc2dafa,0x10243b,1.25));const sun=new T.DirectionalLight(0xffe3cb,3);sun.position.set(-25,45,-60);this.scene.add(sun);
    this.shipLight=new T.PointLight(0x77ffdf,18,12);this.scene.add(this.shipLight);
    this.texture=this.makeGlow();this.glowMaterials=new Map();this.explosions=[];this.makeWorld();this.landscape=new Landscape(this);this.makeShip();this.makeCockpit();this.makeAssets();this.makeCombatAssets();prepareMaterials(this);this.scenery=new PulseScenery(this);this.makePost();this.resize();window.addEventListener('resize',()=>this.resize());
  }
  makeGlow(){const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d'),g=ctx.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.12,'rgba(255,255,255,.7)');g.addColorStop(.4,'rgba(255,255,255,.12)');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);return new T.CanvasTexture(c);}
  glow(color,size){if(!this.glowMaterials.has(color))this.glowMaterials.set(color,new T.SpriteMaterial({map:this.texture,color,transparent:true,opacity:.6,blending:T.AdditiveBlending,depthWrite:false}));const s=new T.Sprite(this.glowMaterials.get(color));s.scale.set(size,size,1);return s;}
  line(points,color,opacity=.6){return new T.Line(new T.BufferGeometry().setFromPoints(points.map(v=>new T.Vector3(...v))),new T.LineBasicMaterial({color,transparent:true,opacity,blending:T.AdditiveBlending,depthWrite:false}));}
  makeWorld(){
    this.skyMaterial=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{time:{value:0},top:{value:new T.Color(0x0c1538)},horizon:{value:new T.Color(0x7c4a79)},aura:{value:new T.Color(0x386f8b)}},vertexShader:'varying vec3 dir;void main(){dir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:`
      varying vec3 dir;uniform float time;uniform vec3 top;uniform vec3 horizon;uniform vec3 aura;
      float hash(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
      float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
      void main(){vec3 d=normalize(dir);float h=max(0.,d.y);vec3 col=mix(horizon,top,smoothstep(0.,.55,h));float n=noise(d*7.+time*.004)*.6+noise(d*18.)*.3;float cloud=pow(n,4.)*2.;float band=exp(-pow((d.y-.2-sin(d.x*4.+time*.015)*.13)*5.,2.));col+=aura*cloud*band;float star=pow(hash(floor(d*950.)),220.)*smoothstep(.2,.6,h);col+=vec3(.7,.85,1.)*star*.35;gl_FragColor=vec4(col,1.);
      #include <colorspace_fragment>
      }`});this.scene.add(new T.Mesh(new T.SphereGeometry(600,32,20),this.skyMaterial));
    this.sunMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{color:{value:new T.Color(0xffadbb)},time:{value:0},visibility:{value:1}},vertexShader:'varying vec2 p;void main(){p=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:`varying vec2 p;uniform vec3 color;uniform float time;uniform float visibility;void main(){float r=length(p);float a=1.-smoothstep(.96,1.,r);float stripe=step(.14,fract((p.y+.1)*14.));vec3 c=mix(vec3(1.,.26,.18),mix(color,vec3(1.,.85,.57),.75),p.y*.5+.5);gl_FragColor=vec4(c*1.6,a*visibility);
      #include <colorspace_fragment>
      }`});this.sun=new T.Mesh(new T.PlaneGeometry(85,85),this.sunMaterial);this.sun.position.set(0,34,-340);this.scene.add(this.sun);const halo=this.glow(0xffbc99,170);halo.position.set(0,33,-343);this.scene.add(halo);this.sunHalo=halo;
    const seaGeo=new T.PlaneGeometry(650,1100,110,160);seaGeo.rotateX(-Math.PI/2);
    this.seaMaterial=new T.ShaderMaterial({uniforms:{time:{value:0},travel:{value:0},pulse:{value:0},biome:{value:new T.Vector4(1,0,0,0)},tint:{value:new T.Color(0x57c7d3)},fogColor:{value:new T.Color(0x49406c)}},vertexShader:`uniform float time;uniform float travel;uniform vec4 biome;varying vec3 world;void main(){vec3 p=position;float wave=(sin(p.x*.17+time*.9)*.32+sin((p.z-travel*.12)*.19+time)*.23)*biome.x;p.y+=wave;vec4 w=modelMatrix*vec4(p,1.);world=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,fragmentShader:`
      varying vec3 world;uniform float time;uniform float travel;uniform float pulse;uniform vec4 biome;uniform vec3 tint;uniform vec3 fogColor;
      float grid(vec2 p){vec2 q=abs(fract(p-.5)-.5)/max(fwidth(p),vec2(.001));return 1.-min(min(q.x,q.y),1.);}
      void main(){float depth=max(0.,-world.z);vec2 p=vec2(world.x,world.z-travel);float g=grid(p/6.);float fine=grid(p/1.5)*.12;float u=world.x*.7+sin(world.z*.09-time*.45),v=world.z*.9+sin(world.x*.3)+time*1.4;vec3 normal=normalize(vec3(-.08*cos(world.x*.17+time*.9)-.035*cos(u*3.),1.,-.08*cos(world.z*.19-travel*.025+time)-.045*cos(v*2.)));vec3 eye=normalize(cameraPosition-world);vec3 light=normalize(vec3(0.,.18,-1.));float fresnel=pow(1.-max(0.,dot(normal,eye)),4.);float spec=pow(max(0.,dot(reflect(-light,normal),eye)),95.);float broad=pow(max(0.,dot(reflect(-light,normal),eye)),9.);float depthTint=.5+.5*sin(world.z*.08+sin(world.x*.21)+time*.6);vec3 water=mix(vec3(.004,.022,.036),vec3(.065,.105,.15),fresnel)+vec3(.55,.22,.16)*broad*.26+vec3(1.7,.83,.4)*spec*.9;water+=tint*depthTint*.016;float swell=pow(.5+.5*sin(v*.65+sin(u)),10.);water+=tint*swell*.025;vec3 road=vec3(.008,.017,.04)+tint*(g*.18+fine*.1)*(1.+pulse*.45);vec3 voidSea=vec3(.003,.012,.024)+tint*g*.06;vec3 col=water*biome.x+road*biome.y+voidSea*biome.z+(road*.5)*biome.w;float lane=exp(-abs(abs(world.x)-9.)*5.);col+=tint*lane*(.08+biome.y*.3+biome.w*.25+pulse*.08);float fog=1.-exp(-depth*.007);col=mix(col,fogColor*.4,fog*.8);gl_FragColor=vec4(col,1.);
      #include <colorspace_fragment>
      }`});this.sea=new T.Mesh(seaGeo,this.seaMaterial);this.sea.position.set(0,-1.2,-400);this.scene.add(this.sea);
    this.mountains=new T.InstancedMesh(createRidge(),new T.MeshStandardMaterial({color:0x7890a8,vertexColors:true,emissive:0x10213a,emissiveIntensity:.18,metalness:.15,roughness:.8}),80);this.scene.add(this.mountains);
    this.mountainEdges=new T.InstancedMesh(this.mountains.geometry,new T.MeshBasicMaterial({color:0x87a9d2,wireframe:true,transparent:true,opacity:.02} ),80);this.scene.add(this.mountainEdges);
    this.pillars=new T.InstancedMesh(new T.BoxGeometry(1,1,1),new T.MeshStandardMaterial({color:0x203550,emissive:0x237b8c,emissiveIntensity:.65,roughness:.3,metalness:.7}),40);this.scene.add(this.pillars);
    this.pillarLights=new T.InstancedMesh(new T.BoxGeometry(.07,1,1.05),new T.MeshBasicMaterial({color:0x8af6e6}),40);this.scene.add(this.pillarLights);
    this.dummy=new T.Object3D();this.rush=new Float32Array(65*6);this.rushSeeds=[];
    for(let i=0;i<65;i++)this.rushSeeds.push({x:(i%2?1:-1)*(9+((i*17)%35)),y:-.5+((i*13)%30),z:-((i*31)%220)});
    const rg=new T.BufferGeometry();rg.setAttribute('position',new T.BufferAttribute(this.rush,3));this.rushMesh=new T.LineSegments(rg,new T.LineBasicMaterial({color:0xb7e8f7,transparent:true,opacity:.15,blending:T.AdditiveBlending,depthWrite:false}));this.scene.add(this.rushMesh);
  }
  makeShip(){
    this.ship=new T.Group();this.scene.add(this.ship);
    const body=new T.Mesh(new T.ConeGeometry(.25,1.9,5),new T.MeshStandardMaterial({color:0xd6eff9,metalness:.75,roughness:.2,emissive:0x203d52,emissiveIntensity:.4}));body.rotation.x=-Math.PI/2;this.ship.add(body);
    const wingGeo=new T.BufferGeometry();wingGeo.setAttribute('position',new T.Float32BufferAttribute([-1.2,-.02,.65,-.16,.02,-.6,-.15,.06,.85, 1.2,-.02,.65,.15,.06,.85,.16,.02,-.6],3));wingGeo.computeVertexNormals();const wings=new T.Mesh(wingGeo,new T.MeshStandardMaterial({color:0xbad3e7,emissive:0x142b4c,emissiveIntensity:.6,metalness:.8,roughness:.25,side:T.DoubleSide}));this.ship.add(wings);
    for(const s of [-1,1]){this.ship.add(this.line([[s*1.2,0,.65],[s*.16,.05,-.6],[s*.15,.1,.85]],0x8effe3,1));const engine=this.glow(0x76ffe4,1.25);engine.position.set(s*.35,0,.65);this.ship.add(engine);}
    this.canopy=new T.Mesh(new T.SphereGeometry(.2,12,8),new T.MeshBasicMaterial({color:0x7dffe5}));this.canopy.scale.set(.7,.7,1.8);this.canopy.position.set(0,.17,-.23);this.ship.add(this.canopy);
    this.exhaust=new T.Mesh(new T.ConeGeometry(.19,1.5,8),new T.MeshBasicMaterial({color:0x91ffe7,transparent:true,opacity:.6,blending:T.AdditiveBlending,depthWrite:false}));this.exhaust.rotation.x=Math.PI/2;this.exhaust.position.set(0,0,1.35);this.ship.add(this.exhaust);
    this.ship.add(this.glow(0x80ffe6,2.4));
  }
  makeAssets(){
    this.gateGeo=new T.TorusGeometry(1,.052,8,64);this.innerGeo=new T.TorusGeometry(.91,.012,4,64);this.gateMat=new T.MeshBasicMaterial({color:0x76ffeb});this.goldMat=new T.MeshBasicMaterial({color:0xffd18f});
    this.gateInnerMat=new T.MeshBasicMaterial({color:0xa6fff8,transparent:true,opacity:.4});this.gateFill=new T.MeshBasicMaterial({color:0x9cfff0,transparent:true,opacity:.035,side:T.DoubleSide,depthWrite:false});this.circleGeo=new T.CircleGeometry(.98,40);
    this.crystalGeo=new T.OctahedronGeometry(1);this.crystalMat=new T.MeshStandardMaterial({color:0x482951,emissive:0xff436f,emissiveIntensity:1,metalness:.5,roughness:.25});this.crystalWire=new T.MeshBasicMaterial({color:0xff88b0,wireframe:true});
    this.shardGeo=new T.OctahedronGeometry(.15);this.shardMat=new T.MeshBasicMaterial({color:0xb0fff3});
  }
  get viewMode(){return this.cameraRig.mode;}
  setView(mode){
    if(!this.cameraRig.setMode(mode))return false;
    try{localStorage.setItem('game-wave-camera',mode);}catch{}return true;
  }
  makeCockpit(){
    this.cockpit=new T.Group();this.camera.add(this.cockpit);this.cockpitMaterials=[];
    const material=(color,opacity=1)=>{const m=new T.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,fog:false});m.userData.baseOpacity=opacity;this.cockpitMaterials.push(m);return m;};
    const dark=material(0x06101b,.97),metal=material(0x244354,.9),light=material(0x93f4df,.65);
    const rail=(points,radius,mat)=>{const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(p[0],p[1],-1.2)));const m=new T.Mesh(new T.TubeGeometry(curve,24,radius,6,false),mat);this.cockpit.add(m);};
    for(const side of [-1,1]){
      rail([[side*1.1,-.85],[side*.91,-.4],[side*.96,.18],[side*.88,.72],[side*.7,1.04]],.027,dark);
      rail([[side*1.08,-.84],[side*.9,-.4],[side*.95,.18],[side*.87,.72],[side*.69,1.04]],.004,light);
      const console=new T.Mesh(new T.BoxGeometry(.4,.15,.06),dark);console.position.set(side*.51,-.8,-1.2);console.rotation.z=side*-.13;this.cockpit.add(console);
      const screen=new T.Mesh(new T.PlaneGeometry(.25,.054),material(0x47c9ba,.3));screen.position.set(side*.5,-.78,-1.158);screen.rotation.z=side*-.13;this.cockpit.add(screen);
      rail([[side*.93,-.73],[side*.6,-.87],[side*.2,-.94]],.018,metal);
    }
    rail([[-.7,1.04],[0,1.13],[.7,1.04]],.025,dark);
    rail([[-1.05,-.83],[-.55,-1.03],[0,-1.08],[.55,-1.03],[1.05,-.83]],.045,dark);
    const nose=new T.Mesh(new T.ConeGeometry(.075,.23,3),metal);nose.rotation.z=Math.PI;nose.position.set(0,-.95,-1.13);this.cockpit.add(nose);
    this.cockpit.visible=false;
  }
  makeCombatAssets(){
    this.enemyBodyGeo=new T.OctahedronGeometry(.7);this.enemyEngineGeo=new T.CylinderGeometry(.27,.38,1.7,10);this.enemyEyeGeo=new T.SphereGeometry(.22,14,10);this.bossBlockGeo=new T.BoxGeometry(1,1,1);this.armorRingGeo=new T.TorusGeometry(1.45,.055,6,48);this.bulletGeo=new T.SphereGeometry(.18,10,8);this.laserGeo=new T.BoxGeometry(.085,.085,2.6);
    this.enemyWingGeo=new T.BufferGeometry();this.enemyWingGeo.setAttribute('position',new T.Float32BufferAttribute([-2.1,0,-.6,-.35,.08,1,-.25,.04,-1.1,2.1,0,-.6,.25,.04,-1.1,.35,.08,1],3));this.enemyWingGeo.computeVertexNormals();
    this.enemyHullMat=new T.MeshStandardMaterial({color:0x556a84,metalness:.45,roughness:.34,emissive:0x27283b,emissiveIntensity:.5,side:T.DoubleSide});this.enemyTrimMat=new T.MeshBasicMaterial({color:0xf78bab});
    this.enemyBoltMat=new T.MeshBasicMaterial({color:0xff71b0});this.playerBoltMat=new T.MeshBasicMaterial({color:0x9cfff1});this.missileMat=new T.MeshBasicMaterial({color:0xffdeb0});
    this.sharedGeometry=new Set([this.gateGeo,this.innerGeo,this.circleGeo,this.crystalGeo,this.shardGeo,this.enemyBodyGeo,this.enemyEngineGeo,this.enemyEyeGeo,this.bossBlockGeo,this.armorRingGeo,this.bulletGeo,this.laserGeo,this.enemyWingGeo]);
    this.gunHeat=0;
    this.drones=new T.Group();this.scene.add(this.drones);for(const side of [-1,1]){const body=new T.Mesh(new T.IcosahedronGeometry(.19,0),this.enemyHullMat);body.position.x=side*.9;this.drones.add(body);const glow=this.glow(0x8dffe8,.9);glow.position.copy(body.position);this.drones.add(glow);}
    for(const side of [-1,1]){const cannon=new T.Mesh(new T.CylinderGeometry(.045,.065,.7,8),new T.MeshStandardMaterial({color:0x527389,metalness:.8,roughness:.25}));cannon.rotation.x=Math.PI/2;cannon.position.set(side*.45,-.07,-.45);this.ship.add(cannon);}
    const fin=new T.Mesh(new T.ConeGeometry(.13,.65,3),this.enemyHullMat);fin.position.set(0,.34,.45);this.ship.add(fin);
  }
  createEnemy(e){
    const group=new T.Group(),boss=e.kind==='boss',inter=e.kind==='interceptor';group.userData.ownedMaterials=[];
    const body=new T.Mesh(this.enemyBodyGeo,this.enemyHullMat);body.scale.set(boss?3.3:.7,boss?1.9:.7,boss?4.5:1.5);group.add(body);
    const wings=new T.Mesh(this.enemyWingGeo,this.enemyHullMat);wings.scale.set(boss?4.2:inter?1.8:1.4,boss?1.7:1,boss?2:1);group.add(wings);
    for(const side of [-1,1]){
      const engine=new T.Mesh(this.enemyEngineGeo,this.enemyHullMat);engine.rotation.x=Math.PI/2;engine.position.set(side*(boss?4.3:1.1),0,boss?-.6:-.3);engine.scale.setScalar(boss?1.7:.65);group.add(engine);
      const light=this.glow(0xff668e,boss?3:1.2);light.position.set(engine.position.x,0,boss?.6:.3);group.add(light);
      const strip=this.line([[side*(boss?8.8:inter?3.75:2.95),.02,boss?-1.2:-.6],[side*(boss?1.2:.35),.12,boss?2:1]],0xff8db1,.85);group.add(strip);group.userData.ownedMaterials.push(strip.material);
    }
    const eyeMat=new T.MeshBasicMaterial({color:0xffa2bf});const core=new T.Mesh(this.enemyEyeGeo,eyeMat);core.position.z=boss?2.2:1;core.scale.setScalar(boss?3.7:1);group.add(core);group.userData.core=core;group.userData.ownedMaterials.push(eyeMat);
    const glow=this.glow(boss?0xff9cda:0xff698d,boss?4:2);glow.position.z=boss?2.1:1;group.add(glow);
    if(boss){const ring=new T.Mesh(this.armorRingGeo,this.enemyTrimMat);ring.position.z=1.2;group.add(ring);group.userData.shield=ring;const ring2=new T.Mesh(this.armorRingGeo,this.enemyTrimMat);ring2.scale.setScalar(1.3);ring2.rotation.y=.5;ring2.position.z=.9;group.add(ring2);group.userData.ring=ring2;
      for(const side of [-1,1])for(let i=0;i<3;i++){const gun=new T.Mesh(this.enemyEngineGeo,this.enemyHullMat);gun.rotation.x=Math.PI/2;gun.position.set(side*(2.5+i*1.5),-.35,.7);gun.scale.set(.65,.9,.65);group.add(gun);const port=new T.Mesh(this.enemyEyeGeo,this.enemyTrimMat);port.position.set(gun.position.x,-.35,1.5);port.scale.setScalar(.65);group.add(port);}
      const bridge=new T.Mesh(this.enemyBodyGeo,this.enemyHullMat);bridge.position.set(0,1.1,-1.4);bridge.scale.set(1.6,1.9,2);group.add(bridge);
      for(const side of [-1,1]){const fin=new T.Mesh(this.enemyEngineGeo,this.enemyHullMat);fin.position.set(side*2.1,1.2,-1.5);fin.scale.set(.7,1.4,.7);group.add(fin);}
      for(const side of [-1,1]){const armor=new T.Mesh(this.bossBlockGeo,this.enemyHullMat);armor.position.set(side*4.4,.1,-1);armor.scale.set(3.6,1.35,3.2);group.add(armor);const window=new T.Mesh(this.bossBlockGeo,this.enemyTrimMat);window.position.set(side*4.4,.24,.63);window.scale.set(2.6,.12,.04);group.add(window);}
    }
    const positions=new Float32Array(6),geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(positions,3));const warning=new T.Line(geo,new T.LineBasicMaterial({color:0xff6b9c,transparent:true,opacity:.5,blending:T.AdditiveBlending,depthWrite:false}));group.add(warning);group.userData.warning=warning;group.userData.ownedMaterials.push(warning.material);
    const aim=new T.Mesh(this.gateGeo,new T.MeshBasicMaterial({color:0xff698d,transparent:true,opacity:.5,depthWrite:false}));aim.scale.setScalar(.9);group.add(aim);group.userData.aim=aim;group.userData.ownedMaterials.push(aim.material);
    return group;
  }
  createEntity(kind,data){
    const group=kind==='enemy'?this.createEnemy(data):new T.Group();
    if(kind==='gate'){
      const ring=new T.Mesh(this.gateGeo,data.bonus?this.goldMat:this.gateMat);group.add(ring);group.add(new T.Mesh(this.innerGeo,this.gateInnerMat));group.add(new T.Mesh(this.circleGeo,this.gateFill));
      const glow=this.glow(data.bonus?0xffbb69:0x5efcde,4.2);group.add(glow);group.scale.setScalar(data.r);
      for(let i=0;i<4;i++){const tick=new T.Mesh(new T.BoxGeometry(.045,.15,.04),data.bonus?this.goldMat:this.gateMat);const a=i*Math.PI/2;tick.position.set(Math.cos(a)*1.12,Math.sin(a)*1.12,0);tick.rotation.z=a-Math.PI/2;group.add(tick);}
    }
    if(kind==='obstacle'){const block=new T.Mesh(this.crystalGeo,this.crystalMat);block.scale.set(.95,1.3,.8);group.add(block);const edge=new T.Mesh(this.crystalGeo,this.crystalWire);edge.scale.copy(block.scale).multiplyScalar(1.015);group.add(edge);group.add(this.glow(0xff507b,3));group.scale.setScalar(data.r);}
    if(kind==='shard'){group.add(new T.Mesh(this.shardGeo,this.shardMat));group.add(this.glow(0x7cffe7,1.25));}
    if(kind==='playerShot'){group.add(new T.Mesh(this.laserGeo,data.piercing?this.missileMat:this.playerBoltMat));group.add(this.glow(data.piercing?0xffd9a4:0x8affed,data.piercing?1.8:1));}
    if(kind==='laser'){
      const mat=new T.MeshBasicMaterial({color:0xff477f,transparent:true,opacity:.08,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide}),wall=new T.Mesh(new T.BoxGeometry(1.64,6.5,42),mat);group.add(wall);group.userData.ownedMaterials=[mat];group.userData.wall=wall;
      const beam=new T.Group();for(const x of [-.82,.82])for(const y of [-3.25,3.25]){const rail=new T.Mesh(new T.BoxGeometry(.08,.08,42),this.enemyBoltMat);rail.position.set(x,y,0);beam.add(rail);}group.add(beam);group.userData.beam=beam;
    }
    if(kind==='enemyShot'){group.add(new T.Mesh(this.bulletGeo,this.enemyBoltMat));group.add(this.glow(0xff619c,1.8));}
    this.scene.add(group);return group;
  }
  updateEntities(travel){
    const wanted=new Set(),g=this.game;
    const add=(key,kind,data,z)=>{
      if(z < -240||z>18)return;
      wanted.add(key);let entity=this.entities.get(key);if(!entity){entity=this.createEntity(kind,data);this.entities.set(key,entity);}
      entity.position.set(data.x,data.y,z);
      if(kind==='obstacle')entity.rotation.y=this.clock*.35+data.id;
      if(kind==='shard')entity.rotation.y=this.clock;
      if(kind==='gate')entity.rotation.z=Math.sin(this.clock*.7+data.x)*.06;
      if(kind==='laser'){const active=g.time>=data.warnUntil;entity.userData.wall.material.opacity=active?.075:.02+(.5+.5*Math.sin(this.clock*14))*.025;entity.userData.beam.visible=active;}
      if(kind==='enemy'){
        entity.rotation.z=Math.sin(this.clock+data.id)*(data.kind==='boss'?.025:.16);
        entity.userData.core.material.color.setHex(data.flash>0?0xffffff:data.kind==='boss'&&data.open?0x8bffe1:0xff9bb7);
        if(entity.userData.shield){entity.userData.shield.visible=!data.open;entity.userData.shield.rotation.z=this.clock*.5;entity.userData.ring.rotation.z=-this.clock*.3;}
        const warning=entity.userData.warning,aim=entity.userData.aim;warning.visible=Boolean(data.telegraph);aim.visible=Boolean(data.telegraph)&&this.cameraRig.weights.cockpit<.6;
        if(data.telegraph){const p=warning.geometry.attributes.position;p.array.set([0,0,1,data.telegraph.x-data.x,data.telegraph.y-data.y,6-data.z]);p.needsUpdate=true;aim.position.set(data.telegraph.x-data.x,data.telegraph.y-data.y,6-data.z);aim.material.opacity=.3+Math.sin(this.clock*12)*.15;}
      }
    };
    for(const group of g.groups){if(group.done)continue;for(let i=0;i<group.options.length;i++){const gate=group.options[i];add(`g${group.id}/${i}`,'gate',gate,6-(group.distance-travel));}}
    for(const o of g.obstacles)if(!o.done)add(`o${o.id}`,'obstacle',o,6-(o.distance-travel));
    for(const p of g.pickups)if(!p.done)add(`p${p.id}`,'shard',p,6-(p.distance-travel));
    for(const e of g.enemies)if(e.active&&!e.dead)add(`e${e.id}`,'enemy',e,e.z);
    for(const s of g.playerShots)if(!(this.cameraRig.weights.cockpit>.7&&s.z>2.2))add(`s${s.id}`,'playerShot',s,s.z);
    for(const s of g.enemyShots)add(`b${s.id}`,'enemyShot',s,s.z);
    for(const l of g.lasers)add(`l${l.id}`,'laser',l,-10);
    for(const [key,obj] of this.entities)if(!wanted.has(key)){this.scene.remove(obj);obj.traverse(n=>{if(n.geometry&&!n.isSprite&&!this.sharedGeometry.has(n.geometry))n.geometry.dispose();});for(const m of obj.userData.ownedMaterials||[])m.dispose();this.entities.delete(key);}
  }
  burst(x,y,color,count=36,z=6){
    const p=[],v=[];for(let i=0;i<count;i++){p.push(x,y,z);const angle=Math.random()*Math.PI*2,speed=2+Math.random()*8;v.push(Math.cos(angle)*speed,Math.sin(angle)*speed,Math.random()*9);}
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));const points=new T.Points(geo,new T.PointsMaterial({map:this.texture,color,size:.22,transparent:true,opacity:1,blending:T.AdditiveBlending,depthWrite:false}));this.scene.add(points);this.effects.push({obj:points,v,life:.8,max:.8});
  }
  event(e){
    if(e.type==='gate'){this.burst(e.x,e.y,e.bonus?0xffd59a:0xa3ffe9,e.boosted?65:30);this.shake=e.boosted?.035:.012;}
    if(e.type==='smash'){this.burst(e.x,e.y,0xff91cb,65);this.shake=.045;}
    if(e.type==='crash'){this.burst(e.x,e.y,0xff6e94,24);this.shake=.12;}
    if(e.type==='dash')this.shake=e.perfect?.035:.018;
    if(e.type==='fire')this.gunHeat=.1;
    if(e.type==='enemyHit')this.burst(e.x,e.y,0xffb7ce,7,e.z);
    if(e.type==='enemyKill'){this.burst(e.x,e.y,e.kind==='boss'?0xffdca9:0xffa9ca,e.kind==='boss'?160:65,e.z);this.explode(e);this.shake=e.kind==='boss'?.1:.035;}
    if(e.type==='blast'){this.explode({x:e.x,y:e.y,z:-5,kind:'boss'});this.shake=.075;}
    if(e.type==='reflect')this.burst(e.x,e.y,0xb4fff0,16);
  }
  explode(e){
    const group=new T.Group();group.position.set(e.x,e.y,e.z);const large=e.kind==='boss';
    const core=new T.Mesh(new T.SphereGeometry(.4,16,12),new T.MeshBasicMaterial({color:0xffe9bd,transparent:true,opacity:.95,blending:T.AdditiveBlending,depthWrite:false}));group.add(core);
    const ring=new T.Mesh(new T.TorusGeometry(.7,.045,5,64),new T.MeshBasicMaterial({color:0xffbd8e,transparent:true,opacity:.8,blending:T.AdditiveBlending,depthWrite:false}));group.add(ring);
    const chunks=[];for(let i=0;i<(large?24:12);i++){const mesh=new T.Mesh(new T.TetrahedronGeometry(.13+Math.random()*.13),new T.MeshStandardMaterial({color:0x4b6177,metalness:.6,roughness:.35,emissive:0xff7548,emissiveIntensity:.5}));group.add(mesh);chunks.push({mesh,v:new T.Vector3((Math.random()-.5)*14,(Math.random()-.3)*12,(Math.random()-.5)*12)});}
    this.scene.add(group);this.explosions.push({group,core,ring,chunks,life:1.4,max:1.4,large});
  }
  makePost(){this.post=new CinematicPass(this.renderer);}
  resize(){const w=innerWidth,h=innerHeight;this.mobile=w/h<.8;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();const p=this.renderer.getPixelRatio();this.post.resize(Math.round(w*p),Math.round(h*p));}
  pointer(x,y){return {x:(x/innerWidth*2-1)*8.2,y:1+(1-y/innerHeight)*5};}
  update(dt){
    this.clock+=dt;const g=this.game,t=this.clock,menu=g.status==='menu',travel=menu?(t*9)%35:g.distance,section=SECTIONS[g.section];
    const phase=((menu?t:g.time)%BEAT)/BEAT,pulse=Math.pow(1-phase,4),boost=g.dashLeft>0||g.blastLeft>.7;
    const color=new T.Color(section.color),sky=new T.Color(section.sky);
    this.landscape.update(dt,travel);const biome=this.landscape.weights;this.scenery.update(dt,travel,pulse);
    this.skyMaterial.uniforms.time.value=t;this.skyMaterial.uniforms.aura.value.lerp(color.clone().multiplyScalar(.22),Math.min(1,dt*.5));this.sunMaterial.uniforms.color.value.lerp(sky,Math.min(1,dt*.4));
    this.seaMaterial.uniforms.time.value=t;this.seaMaterial.uniforms.travel.value=travel;this.seaMaterial.uniforms.pulse.value=pulse*.2+this.audio.bass*.65+this.audio.impact*.15;this.seaMaterial.uniforms.tint.value.lerp(color,Math.min(1,dt));this.seaMaterial.uniforms.fogColor.value.lerp(sky.clone().multiplyScalar(.25),Math.min(1,dt*.5));
    for(let i=0;i<80;i++){
      const side=i%2?-1:1,z=18-((i*37+travel)%700),height=(5+(i*17)%27)*(biome.x*.3+biome.y*1.1+biome.z*.8+biome.w*.4),width=4+(i*7)%12;
      const hover=biome.z*(5+Math.sin(i+t*.15)*3)+biome.w*8,margin=12+width*1.42+(i%5)*7+biome.x*5;
      this.dummy.position.set(side*margin,-2+hover,z);this.dummy.scale.set(width,height,width*.8);this.dummy.rotation.y=i*.4;this.dummy.updateMatrix();this.mountains.setMatrixAt(i,this.dummy.matrix);this.mountainEdges.setMatrixAt(i,this.dummy.matrix);
    }this.mountains.instanceMatrix.needsUpdate=true;this.mountainEdges.instanceMatrix.needsUpdate=true;
    for(let i=0;i<40;i++){
      const z=18-((i*23+travel)%450),h=(2+(i*7)%13)*(biome.y*1.2+biome.w*.6+.03),x=(i%2?-1:1)*(11+(i%3)*4);
      this.dummy.position.set(x,h/2-1.5,z);this.dummy.rotation.set(0,0,0);this.dummy.scale.set(1.3,h,1.3);this.dummy.updateMatrix();this.pillars.setMatrixAt(i,this.dummy.matrix);this.pillarLights.setMatrixAt(i,this.dummy.matrix);
    }this.pillars.instanceMatrix.needsUpdate=true;this.pillarLights.instanceMatrix.needsUpdate=true;this.pillarLights.material.color.copy(color);this.pillars.visible=this.pillarLights.visible=biome.y+biome.w>.05;this.pillarLights.material.color.multiplyScalar(1.1+(this.reduced?0:this.audio.bass*.5));
    const desiredBank=(g.targetX-g.x)*-.2;this.bank+=(desiredBank-this.bank)*Math.min(1,dt*7);this.shake*=Math.exp(-dt*9);const shake=this.reduced?0:this.shake;
    this.ship.position.set(g.x,g.y,6);this.ship.rotation.z=this.reduced?0:Math.max(-.55,Math.min(.55,this.bank));this.ship.rotation.x=(g.targetY-g.y)*.055;
    this.drones.visible=g.weapon==='drone'&&g.status!=='menu';this.drones.position.set(g.x,g.y+.4,6.2);this.drones.rotation.z=Math.sin(t*2)*.14;
    const pose=this.cameraRig.update(dt,g,{mobile:this.mobile,boost,reduced:this.reduced});
    this.ship.visible=pose.showShip&&!(g.shieldTime>0&&Math.floor(t*10)%2===0);this.exhaust.scale.y=boost?3.2:1+pulse*.35;this.exhaust.material.opacity=boost?.95:.5;
    this.shipLight.position.copy(this.ship.position);this.shipLight.intensity=boost?35:13+this.audio.bass*9;
    const impulse=shake*(1-pose.cockpit*.6);this.camera.position.set(pose.position[0]+Math.sin(t*73)*impulse,pose.position[1]+Math.cos(t*67)*impulse,pose.position[2]);
    this.camera.up.set(this.reduced?0:Math.sin(this.bank*pose.roll),1,0);this.camera.lookAt(...pose.lookAt);
    if(Math.abs(this.camera.fov-pose.fov)>.001){this.camera.fov=pose.fov;this.camera.updateProjectionMatrix();}
    this.cockpit.visible=pose.cockpit>.5;
    if(this.cockpit.visible){const extent=Math.tan(this.camera.fov*Math.PI/360)*1.2;this.cockpit.scale.set(extent*this.camera.aspect,extent,1);const fade=Math.min(1,(pose.cockpit-.5)*2);for(const m of this.cockpitMaterials)m.opacity=m.userData.baseOpacity*fade;}
    this.camera.updateMatrixWorld();this.updateEntities(travel);
    const target=g.enemies.find(e=>e.id===g.targetEnemyId&&e.active&&!e.dead);
    const sight=new T.Vector3(g.x,g.y,target?.z??-50).project(this.camera);this.aimScreen={x:(sight.x*.5+.5)*innerWidth,y:(-.5*sight.y+.5)*innerHeight};
    this.gunHeat=Math.max(0,this.gunHeat-dt);this.canopy.material.color.setHex(this.gunHeat>0?0xf5fff5:0x7dffe5);
    if(target){const p=new T.Vector3(target.x,target.y,target.z).project(this.camera);this.targetInfo={x:(p.x*.5+.5)*innerWidth,y:(-.5*p.y+.5)*innerHeight,visible:p.z<1&&Math.abs(p.x)<.95&&Math.abs(p.y)<.9,locked:Math.hypot(g.x-target.x,g.y-target.y)<(target.kind==='boss'?1.65:1.05),enemy:target};}else this.targetInfo=null;
    for(let i=0;i<this.rushSeeds.length;i++){const s=this.rushSeeds[i];s.z+=dt*g.speed*(boost?2.4:1);if(s.z>17)s.z=-220;const k=i*6;this.rush[k]=s.x;this.rush[k+1]=s.y;this.rush[k+2]=s.z;this.rush[k+3]=s.x;this.rush[k+4]=s.y;this.rush[k+5]=s.z-(boost?12:3);}
    this.rushMesh.geometry.attributes.position.needsUpdate=true;this.rushMesh.material.opacity=boost?.55:.1;
    for(let i=this.effects.length-1;i>=0;i--){const e=this.effects[i];e.life-=dt;if(e.life<=0){this.scene.remove(e.obj);e.obj.geometry.dispose();e.obj.material.dispose();this.effects.splice(i,1);continue;}e.obj.material.opacity=e.life/e.max;const p=e.obj.geometry.attributes.position;for(let j=0;j<p.count;j++){p.array[j*3]+=e.v[j*3]*dt;p.array[j*3+1]+=e.v[j*3+1]*dt;p.array[j*3+2]+=e.v[j*3+2]*dt;}p.needsUpdate=true;}
    for(let i=this.explosions.length-1;i>=0;i--){const e=this.explosions[i];e.life-=dt;if(e.life<=0){this.scene.remove(e.group);e.group.traverse(m=>{m.geometry?.dispose();m.material?.dispose();});this.explosions.splice(i,1);continue;}const age=e.max-e.life;e.core.scale.setScalar(1+Math.min(age,.5)*(e.large?18:9));e.core.material.opacity=Math.max(0,1-age*2.5);e.ring.scale.setScalar(1+age*(e.large?15:8));e.ring.material.opacity=Math.max(0,.8-age*.8);for(const c of e.chunks){c.v.y-=dt*3;c.mesh.position.addScaledVector(c.v,dt);c.mesh.rotation.x+=dt*2;c.mesh.rotation.y+=dt*3;c.mesh.material.emissiveIntensity=Math.max(0,e.life/e.max*.5);}}
    this.post.render(this.scene,this.camera,{boost:boost&&!this.reduced?1:0,bass:this.reduced?0:this.audio.bass});
  }
}
