import * as THREE from './vendor/three.module.js';
import {createMorphology,animateMorphology,formIndexForMass,stageToFormIndex,formWeights,FORMS,SIGNATURES,signatureWeight} from './morphology.js';
import {lineageFormBias} from './lineages.js';
import {WorldScene} from './world-scene.js';
import {CinematicPass} from './cinematic.js';
import {PERIODS,periodFor,periodIndexFor,FAUNA_TINTS,FOOD_TINTS} from './periods.js';
import {buildPeriodScenery,disposeScenery} from './period-scenery.js';
import {CAMBRIAN,MESOZOIC,MODERN,ENVIRONMENT,SEABED} from './backdrops.js';
import {loadCreature,faunaModelFor} from './creatures.js';
import {makeSeabedGeometry,makeSeabedTiles,updateSeabedTiles,loadSeabedTextures,blankSeabedTextures,groundY} from './seabed.js';
import {resolveQuality} from './quality.js';
import {PerfMonitor} from './perf.js';
import {updateCreatureLOD} from './lod.js';
import {CreatureAnimator,creatureAnimationState} from './animation.js';
import {WaterOptics} from './water.js';
import {CinematicVFX} from './vfx.js';

export class Ocean {
  constructor(container){
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#03121c');this.scene.fog=new THREE.FogExp2('#03121c',.0011);
    this.zoom=1;this.zoomTarget=1;this.mobile=false;this.desiredBackgroundIntensity=.76;
    // Camera view modes: follow (top-down), orbit (drag to rotate), first (inside the cell).
    this.viewMode='follow';this.orbitYaw=.9;this.orbitPitch=.42;this.firstPitch=-.12;this.orbitDistance=1;this.viewSnap=false;
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.setSize(innerWidth,innerHeight);this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;container.appendChild(this.renderer.domElement);
    // AAA-grade HDR pipeline: MSAA, multi-scale bloom, depth AO, water shafts,
    // depth absorption, ACES tone mapping and filmic colour grading.
    this.reducedMotion=matchMedia('(prefers-reduced-motion:reduce)').matches;
    this.cinematic=new CinematicPass(this.renderer);this.cinematic.setQuality('high');this.cinematic.resize(innerWidth,innerHeight);
    this.postEnabled=!this.reducedMotion;
    this.perf=new PerfMonitor();this.animator=new CreatureAnimator();this.vfx=new CinematicVFX(this.scene);
    this.exposureCurrent=1.42;this.animationTime=0;
    this.camera=new THREE.PerspectiveCamera(46,innerWidth/innerHeight,.1,2600);this.camera.position.set(-11,40,30);this.target=new THREE.Vector3(-11,0,0);this.camera.lookAt(this.target);
    this.time={value:0};this.beat={value:0};this.entities=new Map();this.particles=[];this.ripples=[];this.hazardMeshes=new Map();this.shake=0;
    this.sphere=new THREE.SphereGeometry(1,64,48);this.ico=new THREE.IcosahedronGeometry(1,3);this.torus=new THREE.TorusGeometry(1,.016,6,80);this.spikeGeo=new THREE.ConeGeometry(.3,1,6);this.hazardRingGeo=new THREE.RingGeometry(.85,1,80);
    // Layered cinematic lighting: sky bounce, key sunlight, cool fill and warm rim.
    this.scene.add(new THREE.HemisphereLight(0xb6ecd9,0x0d3a42,1.55));
    const sun=new THREE.DirectionalLight(0xe6fff0,2.6);sun.position.set(-20,52,20);sun.castShadow=true;
    sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-70;sun.shadow.camera.right=70;sun.shadow.camera.top=70;sun.shadow.camera.bottom=-70;sun.shadow.camera.near=1;sun.shadow.camera.far=190;sun.shadow.bias=-.00045;sun.shadow.normalBias=.035;sun.shadow.radius=2.5;
    this.scene.add(sun);this.scene.add(sun.target);this.sun=sun;
    // A second, wider shadow frustum acts as a cheap far cascade so distant
    // reefs still cast grounded shadows without the cost of full CSM splits.
    const sunFar=new THREE.DirectionalLight(0xbfe9df,.42);sunFar.position.set(-52,86,44);sunFar.castShadow=false;
    sunFar.shadow.mapSize.set(1024,1024);sunFar.shadow.camera.left=-240;sunFar.shadow.camera.right=240;sunFar.shadow.camera.top=240;sunFar.shadow.camera.bottom=-240;sunFar.shadow.camera.near=1;sunFar.shadow.camera.far=420;sunFar.shadow.bias=-.0008;sunFar.shadow.normalBias=.06;sunFar.shadow.radius=3.5;
    this.scene.add(sunFar);this.scene.add(sunFar.target);this.sunFar=sunFar;
    const fill=new THREE.DirectionalLight(0x64b8dc,1.25);fill.position.set(25,12,-30);this.scene.add(fill);
    const rim=new THREE.DirectionalLight(0x9affd8,1.0);rim.position.set(0,-6,18);this.scene.add(rim);
    // Soft camera-side water light: lifts near scanned models out of the deep
    // without washing out the open water or adding another shadow pass.
    this.localLight=new THREE.PointLight(0x9fd8ef,160,90,2);this.localLight.position.set(0,14,6);this.scene.add(this.localLight);
    // Procedural environment map gives every material real reflections without external assets.
    this.scene.environment=this.makeEnvironment();if('environmentIntensity' in this.scene)this.scene.environmentIntensity=1.35;
    this.materials={player:this.cellMaterial('#a3f6cc'),edible:this.cellMaterial('#6ce6b6'),danger:this.cellMaterial('#ec977d'),equal:this.cellMaterial('#8dbed3'),boss:this.cellMaterial('#f2bc8b')};
    this.glowTexture=this.makeGlow();this.glowMaterials={};this.faunaTintColors=FAUNA_TINTS.map(t=>new THREE.Color(t.color));this.foodTintColors=FOOD_TINTS.map(c=>new THREE.Color(...c));
    this.makeFloor();this.makeDust();this.makeFood();this.makeLandmarks();this.worldScene=new WorldScene(this.scene,this.glowTexture);
    this.lightShafts=this.makeLightShafts();this.scene.add(this.lightShafts);
    this.currentPeriod=-1;this.periodScenery=null;this.periodOverride=-1;
    this.applyPeriod(0);
    this.hero=this.makeCell('player',true);this.scene.add(this.hero);this.previewStage=0;this.morph=createMorphology(this.materials.player);this.hero.add(this.morph.group);
    this.makeAnatomy();this.makeCurrents();this.bossArrow=new THREE.ArrowHelper(new THREE.Vector3(1,0,0),new THREE.Vector3(),24,0xffb294,3,2);this.bossArrow.visible=false;this.scene.add(this.bossArrow);
    this.trailGeometry=new THREE.BufferGeometry();this.trailGeometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(900),3));this.trailGeometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(900),3));this.trailGeometry.setAttribute('aSize',new THREE.Float32BufferAttribute(new Float32Array(300),1));
    this.trail=new THREE.Points(this.trailGeometry,this.pointMaterial());this.scene.add(this.trail);
    this.raycaster=new THREE.Raycaster();this.plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);this.pointer=new THREE.Vector3();
    addEventListener('resize',()=>{this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight);this.cinematic.resize(innerWidth,innerHeight);this.setQuality(this.quality||'high');});
  }
  loadBackdrop(p){
    if(!p.backdrop)return;
    const data={cambrian:CAMBRIAN,mesozoic:MESOZOIC,modern:MODERN}[p.backdrop.split('/').pop().replace('.webp','')];
    if(!data)return;
    if(!this.backdropCache)this.backdropCache=new Map();
    if(!this.backdropCache.has(data)){
      const img=new Image();
      const tex=new THREE.Texture(img);
      tex.colorSpace=THREE.SRGBColorSpace;
      tex.mapping=THREE.EquirectangularReflectionMapping;
      img.onload=()=>{
        tex.needsUpdate=true;
        if(this.period?.backdrop===p.backdrop){
          this.scene.background=tex;
          this.scene.backgroundIntensity=this.desiredBackgroundIntensity??.76;
        }
      };
      img.src=data;
      this.backdropCache.set(data,tex);
    }
    const tex=this.backdropCache.get(data);
    const apply=()=>{
      if(this.period?.backdrop!==p.backdrop)return;
      if(tex.image?.naturalWidth){
        this.scene.background=tex;
        this.scene.backgroundIntensity=this.desiredBackgroundIntensity??.76;
      }
    };
    apply();
    if(!tex.image?.naturalWidth){this.scene.background=new THREE.Color(p.background);}
  }
  applyPeriod(index){
    const p=PERIODS[Math.max(0,Math.min(PERIODS.length-1,index))];
    if(this.currentPeriod===index)return;
    this.currentPeriod=index;this.period=p;
    this.loadBackdrop(p);
    if(this.periodScenery)disposeScenery(this.periodScenery);
    this.periodScenery=buildPeriodScenery(p);this.scene.add(this.periodScenery.group);
    if(this.quality==='low')this.periodScenery.group.visible=true;
    // Immediate palette snap on switch; updateEnvironment keeps it blended afterwards.
    if(!this.scene.background?.isTexture)this.scene.background=new THREE.Color(p.background);
    this.scene.fog.color.set(p.background);
    this.floorMaterial.uniforms.uDeep.value.setRGB(...p.deep);
    this.floorMaterial.uniforms.uShallow.value.setRGB(...p.shallow);
    // Sediment chemistry changes with the era: iron-rich green, carbonate
    // cream, volcanic grey or cold abyssal blue rather than one shared sand.
    this.floorMaterial.uniforms.uTint.value.setRGB(...(p.seabedTint||[1,1,1]));
    const sediment=p.sediment||{};
    const sedimentKeys=['uSediment0','uSediment1','uSediment2','uSediment3'];
    ['sand','silt','rock','mat'].forEach((key,i)=>{
      const value=sediment[key]||[1,1,1];
      this.floorMaterial.uniforms[sedimentKeys[i]].value.setRGB(...value);
    });
    if(this.sun)this.sun.color.setHex(p.key);
    if(this.sunFar)this.sunFar.color.setHex(p.key).lerp(new THREE.Color(0x8fc7d8),.55);
    if(this.water)this.water.update(p,0,.5,this.qualityPreset);
    if(this.dust?.material?.color)this.dust.material.color.setHex(p.dust);
  }
  setMobile(enabled){
    this.mobile=!!enabled;
    this.camera.far=this.mobile?1800:2600;
    this.camera.updateProjectionMatrix();
    if(this.quality)this.setQuality(this.quality);
    return this.mobile;
  }
  setQuality(quality){
    if(!['low','medium','high'].includes(quality))quality='high';
    this.quality=quality;
    const preset=this.qualityPreset=resolveQuality(quality,this.mobile,devicePixelRatio||1);
    const low=quality==='low';
    this.renderer.setPixelRatio(preset.ratio);
    this.dust.geometry.setDrawRange(0,preset.dust);
    this.landmarks.visible=!low;
    for(const s of this.fishSchools)s.mesh.visible=!low;
    for(const b of this.bubbles)b.mesh.visible=!low;
    // Keep real creature scenery even in low mode: only distant dressing is culled.
    if(this.periodScenery)this.periodScenery.group.visible=true;
    for(const p of [this.foodPoints,this.trail])if(p?.material.uniforms?.uPixel)p.material.uniforms.uPixel.value=preset.ratio;
    this.cinematic.setQuality(quality,preset);
    this.postEnabled=preset.post&&!this.reducedMotion;
    this.renderer.shadowMap.enabled=preset.shadowMap>0;this.renderer.shadowMap.needsUpdate=true;
    const maxShadow=this.renderer.capabilities.maxTextureSize||2048;
    for(const light of [this.sun,this.sunFar]){
      if(!light)continue;
      const size=light===this.sunFar?0:Math.min(maxShadow,preset.shadowMap);
      light.castShadow=size>0;
      if(size>0&&light.shadow.mapSize.x!==size){light.shadow.mapSize.set(size,size);if(light.shadow.map){light.shadow.map.dispose();light.shadow.map=null;}}
      light.shadow.needsUpdate=true;
    }
    if(this.shadowCatcher)this.shadowCatcher.visible=!low;
    // Wide scene-space beam quads read as a hard horizontal band; the filmic
    // radial shafts in CinematicPass replace them at all quality levels.
    this.lightShafts.visible=false;
    this.caustics.repeat.set(preset.causticsRepeat,preset.causticsRepeat);
    this.desiredBackgroundIntensity=preset.backgroundIntensity;
    if(this.scene.background?.isTexture)this.scene.backgroundIntensity=this.desiredBackgroundIntensity;
    this.toneExposure=preset.toneExposure;this.exposureCurrent=preset.toneExposure;
    if(this.water)this.water.update(this.period||PERIODS[0],0,.5,preset);
    return this.quality;
  }
  makeAnatomy(){
    const anatomy={};const mat=color=>new THREE.MeshBasicMaterial({color,transparent:true,opacity:.65,depthWrite:false});
    const fins=new THREE.Group();for(const side of [-1,1]){const fin=new THREE.Mesh(new THREE.ConeGeometry(.45,1.8,3),mat(0x92e9cd));fin.position.set(side*.95,-.1,.3);fin.rotation.z=side*-1.05;fin.scale.z=.16;fins.add(fin);}this.hero.add(fins);anatomy.speed=fins;
    const armor=new THREE.Group();for(let i=0;i<10;i++){const a=i/10*Math.PI*2,m=new THREE.Mesh(this.spikeGeo,mat(0xd3f0c5));m.position.set(Math.cos(a)*.98,.05,Math.sin(a)*.98);m.rotation.z=-Math.cos(a)*1.2;m.rotation.x=Math.sin(a)*1.2;m.scale.setScalar(.5);armor.add(m);}this.hero.add(armor);anatomy.shell=armor;
    const electric=new THREE.Group();for(let i=0;i<3;i++){const m=new THREE.Mesh(this.torus,mat(0x99d9ff));m.scale.setScalar(1.2+i*.13);m.rotation.set(Math.PI*.3+i,0,i);electric.add(m);}this.hero.add(electric);anatomy.electric=electric;
    const harmony=new THREE.Group();for(let i=0;i<5;i++){const m=new THREE.Mesh(this.ico,mat(0xd1f5b4));m.scale.setScalar(.09);m.position.set(Math.cos(i*1.256)*1.45,.25,Math.sin(i*1.256)*1.45);harmony.add(m);}this.hero.add(harmony);anatomy.harmony=harmony;
    const mouth=new THREE.Mesh(new THREE.TorusGeometry(.45,.075,6,36),mat(0xe0ffd4));mouth.rotation.x=Math.PI/2;mouth.position.y=.77;this.hero.add(mouth);anatomy.mouth=mouth;this.anatomy=anatomy;
  }
  makeCurrents(){const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(1800),3));this.currents=new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:0x69c3e9,transparent:true,opacity:.19,depthWrite:false}));this.currents.frustumCulled=false;this.scene.add(this.currents);}
  makeGlow(){const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d'),g=ctx.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,255,255,.7)');g.addColorStop(.18,'rgba(255,255,255,.3)');g.addColorStop(.5,'rgba(255,255,255,.07)');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);return new THREE.CanvasTexture(c);}
  makeEnvironment(){
    // Real CC0 underwater HDRI (Poly Haven / ushaka_sea_world_aquarium) drives
    // physically-based reflections on every creature and the water floor.
    // A procedural gradient is kept as an instant fallback while the image decodes.
    const size=128,c=document.createElement('canvas');c.width=size;c.height=size;const ctx=c.getContext('2d');
    const g=ctx.createLinearGradient(0,0,0,size);g.addColorStop(0,'#baf6e2');g.addColorStop(.35,'#4a9ba0');g.addColorStop(.6,'#124a55');g.addColorStop(1,'#04252c');ctx.fillStyle=g;ctx.fillRect(0,0,size,size);
    for(let i=0;i<26;i++){const x=Math.random()*size,y=Math.random()*size*.55,r=2+Math.random()*10,rg=ctx.createRadialGradient(x,y,0,x,y,r);rg.addColorStop(0,'rgba(220,255,240,.55)');rg.addColorStop(1,'rgba(220,255,240,0)');ctx.fillStyle=rg;ctx.fillRect(x-r,y-r,r*2,r*2);}
    const fallback=new THREE.CanvasTexture(c);fallback.mapping=THREE.EquirectangularReflectionMapping;fallback.colorSpace=THREE.SRGBColorSpace;
    const img=new Image();
    img.onload=()=>{
      const tex=new THREE.Texture(img);tex.mapping=THREE.EquirectangularReflectionMapping;tex.colorSpace=THREE.SRGBColorSpace;tex.needsUpdate=true;
      this.scene.environment=tex;
    };
    img.src=ENVIRONMENT;
    return fallback;
  }
  makeCaustics(){
    const size=256,c=document.createElement('canvas');c.width=c.height=size;const ctx=c.getContext('2d'),img=ctx.createImageData(size,size),d=img.data;
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const u=x/size*Math.PI*2,v=y/size*Math.PI*2;
      // Thin refracted caustic web instead of broad bright blobs: two
      // interfering wave fields thresholded to narrow bright veins.
      const a=Math.sin(u*4+Math.sin(v*2.5)*1.7)+Math.sin(v*5+Math.sin(u*3.5)*1.5)+Math.sin((u-v)*3.2);
      const b=Math.sin(u*9-v*7)+Math.sin(v*8+u*5)*.6;
      const n=Math.min(1,Math.pow(Math.max(0,1-Math.abs(a)*.32),14)*.9+Math.pow(Math.max(0,1-Math.abs(b)*.45),20)*.5);
      const k=(y*size+x)*4;d[k]=180*n;d[k+1]=255*n;d[k+2]=220*n;d[k+3]=255;
    }
    ctx.putImageData(img,0,0);const tex=new THREE.CanvasTexture(c);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(9,9);return tex;
  }
  makeLightShafts(){
    // Soft volumetric shafts: wide, edge-faded quads instead of hard cones.
    // Alpha is Gaussian across the width and fades with depth, so orbiting the
    // camera never reveals a triangular wedge.
    const group=new THREE.Group();
    const material=new THREE.ShaderMaterial({
      uniforms:{uTime:this.time,uTint:{value:new THREE.Color(0xb9f4e6)},uStrength:{value:.05}},
      vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`uniform float uTime;uniform vec3 uTint;uniform float uStrength;varying vec2 vUv;
        void main(){float across=pow(sin(vUv.x*3.14159265),3.0);float depth=pow(vUv.y,1.35)*smoothstep(0.0,.18,vUv.y);float shimmer=.78+.22*sin(uTime*.42+vUv.x*8.0+vUv.y*3.0);float alpha=across*depth*shimmer*uStrength;if(alpha<.001)discard;gl_FragColor=vec4(uTint,alpha);}`,
      transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
    for(let i=0;i<6;i++){
      const beam=new THREE.Mesh(new THREE.PlaneGeometry(10+i*1.6,86),material);
      const a=i/6*6.28+.4,r=20+i*11;
      beam.position.set(Math.cos(a)*r,18,Math.sin(a)*r);
      beam.rotation.y=a+.35;
      beam.userData.primary=i%2===0;
      group.add(beam);
    }
    return group;
  }
  cellMaterial(color){
    const mat=new THREE.ShaderMaterial({uniforms:{uTime:this.time,uColor:{value:new THREE.Color(color)},uBeat:this.beat,uHero:{value:0}},vertexShader:`
      uniform float uTime; uniform float uBeat; varying vec3 vNormal; varying vec3 vView; varying vec3 vPos; varying vec3 vWorld;
      void main(){vec3 p=position;float wave=sin(p.y*5.+uTime*1.7)*sin(p.x*4.+uTime*.8)*.035;p*=1.+wave+uBeat*.012;vec4 mv=modelViewMatrix*vec4(p,1.);vNormal=normalize(normalMatrix*normal);vView=-mv.xyz;vPos=position;vWorld=(modelMatrix*vec4(p,1.)).xyz;gl_Position=projectionMatrix*mv;}`,
      fragmentShader:`uniform vec3 uColor;uniform float uTime;uniform float uBeat;uniform float uHero;
        varying vec3 vNormal;varying vec3 vView;varying vec3 vPos;varying vec3 vWorld;
        void main(){
          vec3 n=normalize(vNormal),v=normalize(vView);
          float facing=max(dot(n,v),0.),fresnel=pow(1.-facing,3.);
          vec3 lightDir=normalize(vec3(-.5,1.,.7));float light=max(dot(n,lightDir),0.);
          float back=max(dot(-n,lightDir),0.);
          // Faint cytoplasm flow + organelle specks, richer on the hero cell.
          float flow=sin(vPos.x*13.+sin(vPos.z*9.+uTime*.6)*2.+uTime*.4)*.5+.5;
          float veins=pow(flow,7.)*.05*(.4+uHero);
          vec3 cell=vec3(vPos.x*11.,vPos.y*13.,vPos.z*10.);
          float speck=pow(max(0.,sin(cell.x+uTime)*sin(cell.y-uTime*.7)*sin(cell.z+uTime*.4)),12.)*.08*(.3+uHero);
          // Fbm-like cytoplasm: layered noise gives the membrane organic depth.
          float noise=sin(vPos.x*7.+uTime*.3)*sin(vPos.y*9.-uTime*.2)*sin(vPos.z*8.+uTime*.25);
          noise+=.5*sin(vPos.x*15.-uTime*.4)*sin(vPos.z*13.+uTime*.3);
          float grain=smoothstep(-.4,1.1,noise);
          // Fake subsurface: light bleeding through the thin membrane on the dark side.
          vec3 sss=uColor*back*.32+uColor*pow(1.-facing,1.6)*.22;
          vec3 col=uColor*(.11+light*.26)+sss+uColor*fresnel*1.15;
          col*=mix(vec3(.84),vec3(1.12),grain);
          col+=vec3(.72,.92,.82)*pow(light,34.)*1.1;
          col+=uColor*(veins+speck);
          col+=uColor*uBeat*.06*uHero;
          gl_FragColor=vec4(col,clamp(.48+fresnel*.46+uHero*.06,0.,1.));
        }`,
      transparent:true,depthWrite:false});
    this.cellMaterials??=[];this.cellMaterials.push(mat);return mat;
  }
  glowMat(type){if(!this.glowMaterials[type])this.glowMaterials[type]=new THREE.SpriteMaterial({map:this.glowTexture,color:this.materials[type].uniforms.uColor.value,transparent:true,opacity:.5,blending:THREE.AdditiveBlending,depthWrite:false});return this.glowMaterials[type];}
  makeCell(type,hero=false,kind=0,variant='lagoon',hue=0){
    if(hero){const m=this.materials[type];if(m?.uniforms?.uHero)m.uniforms.uHero.value=1;}
    const tint=this.faunaTintColors?.[hue%this.faunaTintColors.length]||new THREE.Color(0x9adbb3);
    const coreTint=tint.clone().lerp(new THREE.Color(0xffffff),.28);
    const g=new THREE.Group();
    const glow=new THREE.Sprite(this.glowMat(type));glow.scale.set(5.5,5.5,1);glow.position.y=.1;g.add(glow);
    const shell=new THREE.Mesh(this.sphere,this.materials[type]);shell.scale.set(1,.8,1);g.add(shell);
    const core=new THREE.Mesh(this.ico,new THREE.MeshStandardMaterial({color:type==='player'?0xc1ffce:coreTint,emissive:type==='player'?0x38885d:tint.clone().multiplyScalar(.32),emissiveIntensity:.7,roughness:.22,metalness:.12,envMapIntensity:1.35}));core.scale.set(.34,.4,.34);core.position.y=.12;core.castShadow=true;g.add(core);
    const ring=new THREE.Mesh(this.torus,new THREE.MeshBasicMaterial({color:type==='player'?this.materials[type].uniforms.uColor.value:tint,transparent:true,opacity:.32}));ring.rotation.x=Math.PI/2+.2;ring.scale.setScalar(1.15);g.add(ring);
    const organelles=new THREE.Group();for(let i=0;i<5;i++){const b=new THREE.Mesh(this.ico,new THREE.MeshBasicMaterial({color:0xb4ffcd,transparent:true,opacity:.3}));b.scale.setScalar(.04+(i%3)*.02);b.position.set(Math.cos(i*2.4)*.6,Math.sin(i*3)*.35,Math.sin(i*2.4)*.6);organelles.add(b);}g.add(organelles);
    if(hero){const tails=new THREE.Group();for(let i=0;i<8;i++){const a=i/8*Math.PI*2;const points=[];for(let j=0;j<6;j++){const r=.88+j*.19;points.push(new THREE.Vector3(Math.cos(a+j*.08)*r,-.12-j*.09,Math.sin(a+j*.08)*r));}const curve=new THREE.CatmullRomCurve3(points);const tentacle=new THREE.Mesh(new THREE.TubeGeometry(curve,16,.013,4,false),new THREE.MeshBasicMaterial({color:0xa3f6cc,transparent:true,opacity:.38}));tails.add(tentacle);}g.add(tails);}
    const tails=hero?g.children[5]:null;
    if(!hero&&kind===1){const beak=new THREE.Mesh(this.spikeGeo,ring.material);beak.rotation.x=Math.PI/2;beak.position.z=1.15;beak.scale.set(.5,1.3,.5);g.add(beak);}
    if(!hero&&kind===3){this.shieldGeometry??=new THREE.TorusGeometry(.96,.06,6,24,Math.PI);const shield=new THREE.Mesh(this.shieldGeometry,new THREE.MeshBasicMaterial({color:0xd6e7b4,transparent:true,opacity:.65}));shield.rotation.x=Math.PI/2;shield.position.y=.16;g.add(shield);}
    if(kind===3||type==='boss'){const armor=new THREE.Group(),mat=new THREE.MeshBasicMaterial({color:type==='boss'?0xe8c398:0x9fcfc1,transparent:true,opacity:.45});for(let i=0;i<(type==='boss'?10:6);i++){const a=i/(type==='boss'?10:6)*Math.PI*2,m=new THREE.Mesh(this.spikeGeo,mat);m.position.set(Math.cos(a)*.95,.1,Math.sin(a)*.95);m.rotation.z=-Math.cos(a)*1.2;m.rotation.x=Math.sin(a)*1.2;m.scale.setScalar(.55);armor.add(m);}g.add(armor);}
    let faunaSlot=null;
    if(!hero){faunaSlot=new THREE.Group();faunaSlot.position.y=.05;g.add(faunaSlot);g.userData.fauna=faunaSlot;
      const modelName=type==='boss'?(variant==='tide'?'cc0/real-carcharodon_carcharias':variant==='crystal'?'cc0/real-himantolophus_groenlandicus':'cc0/real-mosasaur'):faunaModelFor(kind,this.currentPeriod);
      loadCreature(modelName).then(model=>{
        if(!model||!g.parent||!faunaSlot)return;
        const clone=model.clone(true);clone.rotation.y=-Math.PI/2;clone.scale.setScalar(type==='boss'?1.75:1.35);
        if(type!=='boss'&&tint)clone.traverse(o=>{
          if(!o.isMesh||!o.material||o.userData.cornealGleam)return;
          const tinted=m=>{const c=m.clone();if(c.color)c.color.lerp(tint,.26);return c;};
          o.material=Array.isArray(o.material)?o.material.map(tinted):tinted(o.material);
          o.userData.sharedAsset=false;
        });
        faunaSlot.add(clone);shell.visible=false;core.visible=false;organelles.visible=false;glow.visible=false;
      });
    }
    let bossMorph=null,orbs=null;if(type==='boss'&&variant==='tide'){bossMorph=createMorphology(this.materials.boss);g.add(bossMorph.group);}if(type==='boss'&&variant==='crystal'){orbs=new THREE.Group();for(let i=0;i<3;i++){const m=new THREE.Mesh(this.ico,new THREE.MeshStandardMaterial({color:0xd9b6ee,emissive:0x7847a0,emissiveIntensity:.7,roughness:.2}));m.position.set(Math.cos(i*2.094)*1.5,.5,Math.sin(i*2.094)*1.5);m.scale.set(.17,.4,.17);orbs.add(m);}g.add(orbs);}g.userData={type,shell,core,ring,organelles,tails,bossMorph,orbs,fauna:faunaSlot,creatureKind:kind};return g;
  }
  makeFloor(){
    this.caustics=this.makeCaustics();
    this.water=new WaterOptics(this.scene,this.caustics);this.water.bindCinematic(this.cinematic);
    const blank=blankSeabedTextures();
    const material=new THREE.ShaderMaterial({
      uniforms:{
        uTime:this.time,uBeat:this.beat,
        uFogColor:{value:new THREE.Color('#051820')},uFogDensity:{value:.0011},
        uDeep:{value:new THREE.Color(.006,.034,.060)},uShallow:{value:new THREE.Color(.014,.072,.118)},
        uTint:{value:new THREE.Color(1,1,1)},uSunDir:{value:new THREE.Vector3(-.4,.8,.35).normalize()},
        uSediment0:{value:new THREE.Color(.94,.86,.68)},uSediment1:{value:new THREE.Color(.64,.72,.80)},
        uSediment2:{value:new THREE.Color(.52,.58,.70)},uSediment3:{value:new THREE.Color(.62,.84,.70)},
        uFlow:{value:0},uBackdrop:{value:null},uBackdropMix:{value:0},
        uAlbedo:{value:blank.albedo},uNormalMap:{value:blank.normal},uRoughness:{value:blank.roughness},
        uCaustics:{value:this.caustics}
      },
      vertexShader:`
        attribute vec3 color;
        attribute float aSlope;
        attribute float aBiome;
        varying vec3 vColor;
        varying vec2 vUv;
        varying vec3 vWorld;
        varying vec3 vNormalW;
        varying float vHeight;
        varying float vFogDepth;
        varying float vSlope;
        varying float vBiome;
        void main(){
          vColor=color;vUv=uv;vSlope=aSlope;vBiome=aBiome;
          vec4 world=modelMatrix*vec4(position,1.0);
          vWorld=world.xyz;vNormalW=normalize(mat3(modelMatrix)*normal);vHeight=position.y;
          vec4 mvPosition=viewMatrix*world;
          vFogDepth=-mvPosition.z;
          gl_Position=projectionMatrix*mvPosition;
        }`,
      fragmentShader:`
        varying vec3 vColor;varying vec2 vUv;varying vec3 vWorld;varying vec3 vNormalW;varying float vHeight;varying float vFogDepth;varying float vSlope;varying float vBiome;
        uniform float uTime;uniform float uBeat;uniform float uFlow;uniform float uBackdropMix;
        uniform vec3 uDeep;uniform vec3 uShallow;uniform vec3 uTint;uniform vec3 uSunDir;
        uniform vec3 uSediment0;uniform vec3 uSediment1;uniform vec3 uSediment2;uniform vec3 uSediment3;
        uniform vec3 uFogColor;uniform float uFogDensity;
        uniform sampler2D uCaustics;uniform sampler2D uBackdrop;
        uniform sampler2D uAlbedo;uniform sampler2D uNormalMap;uniform sampler2D uRoughness;
        void main(){
          // Two rotated samples of CC0 Poly Haven sediment kill visible tiling.
          vec2 uv0=vWorld.xz*.024;
          vec2 uv1=uv0*2.17+vec2(.37,.21);
          vec3 sand=texture2D(uAlbedo,uv0).rgb*.70+texture2D(uAlbedo,uv1).rgb*.30;
          // Substrate splatting: the same CC0 sediment map is re-tinted into
          // anoxic silt, exposed rock and microbial mat by the biome attribute.
          float sandW=1.-smoothstep(.20,.48,vBiome);
          float siltW=smoothstep(.35,.68,vBiome)*(1.-smoothstep(1.18,1.72,vBiome));
          float rockW=smoothstep(1.32,1.78,vBiome);
          float matW=smoothstep(2.32,2.78,vBiome);
          float subTotal=max(.001,sandW+siltW+rockW+matW);
          vec3 substrate=(sand*uSediment0*sandW+sand*uSediment1*siltW+sand*uSediment2*rockW+sand*uSediment3*matW)/subTotal;
          vec3 n0=texture2D(uNormalMap,uv0).rgb*2.-1.;
          vec3 n1=texture2D(uNormalMap,uv1).rgb*2.-1.;
          vec3 nt=normalize(vec3(n0.xy+n1.xy*.42,n0.z+n1.z));
          vec3 base=normalize(vNormalW);
          vec3 tangent=normalize(vec3(1.,0.,0.));
          vec3 bitangent=normalize(cross(base,tangent));
          if(length(bitangent)<.01)bitangent=vec3(0.,0.,1.);
          vec3 N=normalize(base*nt.z+tangent*nt.x+bitangent*nt.y);
          vec3 L=normalize(uSunDir),V=normalize(cameraPosition-vWorld),H=normalize(L+V);
          float rough=texture2D(uRoughness,uv0).r;
          rough=mix(rough,.96,rockW/subTotal);rough=mix(rough,.88,siltW/subTotal);rough=mix(rough,.72,matW/subTotal);
          float ndl=max(dot(N,L),0.);
          float spec=pow(max(dot(N,H),0.),mix(96.,14.,rough))*(1.-rough)*.42;
          float crest=smoothstep(-5.4,-2.4,vHeight);
          vec3 water=mix(uDeep*7.5,uShallow*6.2,crest);
          vec3 col=substrate*water*(.48+ndl*.95)*uTint*vColor;
          col+=vec3(.66,.88,.82)*spec*.32;
          float ripple=sin(vWorld.x*.42+sin(vWorld.z*.12)*1.7+uTime*.035)*sin(vWorld.z*.21-uTime*.02);
          col*=1.+ripple*.012;
          // Refracted caustic web, projected in world space so dunes stay legible.
          vec2 cuv=vWorld.xz*.018+vec2(uTime*.009,uTime*.006);
          float caust=texture2D(uCaustics,cuv).g*.64+texture2D(uCaustics,cuv*1.47-vec2(uTime*.006,0.)).g*.36;
          float mask=smoothstep(.32,.94,caust)*(.25+.75*ndl);
          col+=mix(uDeep,uShallow,.82)*mask*.26*(.8+uBeat*.2);
          float stream=pow(max(0.,sin(vWorld.x*.006+uTime*.11+sin(vWorld.z*.004)*2.)),24.)*.02*uFlow;
          col+=vec3(.12,.28,.26)*stream;
          if(uBackdropMix>.001){
            vec3 photo=texture2D(uBackdrop,vec2(vUv.x*1.08-.04,1.-vUv.y*1.08+.04)).rgb;
            col=mix(col,photo*(.72+caust*.28),uBackdropMix*.78);
          }
          col*=1.-(1.-smoothstep(-5.8,-2.8,vHeight))*.12;
          float fogFactor=1.-exp(-uFogDensity*uFogDensity*vFogDepth*vFogDepth);
          col=mix(col,uFogColor,clamp(fogFactor,0.,1.));
          gl_FragColor=vec4(col,1.);
        }`
    });
    this.floorMaterial=material;
    const maps=loadSeabedTextures(this.renderer.capabilities.getMaxAnisotropy?.()||8);
    for(const key of ['albedo','normal','roughness'])material.uniforms[key==='normal'?'uNormalMap':key==='albedo'?'uAlbedo':'uRoughness'].value=maps[key];
    const tiles=makeSeabedTiles(1100,160);tiles.traverse(o=>{if(o.isMesh){o.material=material;o.receiveShadow=true;}});this.scene.add(tiles);this.floor=tiles;this.floorAnchor={x:0,z:0};
    // Contact shadows reuse the displaced surface so rocks and scanned fauna sit
    // in the hollows instead of hovering over a flat invisible plane.
    const catcherGeometry=makeSeabedGeometry(1100,128);
    const catcher=new THREE.Mesh(catcherGeometry,new THREE.ShadowMaterial({color:0x001820,opacity:.42,depthWrite:false}));catcher.receiveShadow=true;catcher.renderOrder=1;this.scene.add(catcher);this.shadowCatcher=catcher;
    // No boundary line: the seabed now recentres around the player instead of
    // ending at a fixed rectangle.
  }
  makeDust(){
    const count=700,a=new Float32Array(count*3),c=new Float32Array(count*3);
    for(let i=0;i<count;i++){const r=Math.sqrt(Math.random())*900,ang=Math.random()*Math.PI*2;a[i*3]=Math.cos(ang)*r;a[i*3+1]=Math.random()*44-4;a[i*3+2]=Math.sin(ang)*r;const tone=.45+Math.random()*.45;c[i*3]=.18*tone;c[i*3+1]=.44*tone;c[i*3+2]=.44*tone;}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(a,3));geo.setAttribute('color',new THREE.BufferAttribute(c,3));
    this.dust=new THREE.Points(geo,new THREE.PointsMaterial({vertexColors:true,size:.085,transparent:true,opacity:.07,depthWrite:false,blending:THREE.AdditiveBlending,sizeAttenuation:true}));this.scene.add(this.dust);
  }
  pointMaterial(){return new THREE.ShaderMaterial({vertexColors:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{uPixel:{value:Math.min(devicePixelRatio,1.7)}},vertexShader:`attribute float aSize;varying vec3 vColor;uniform float uPixel;void main(){vColor=color;vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=clamp(aSize*480.*uPixel/-p.z,1.,70.);}`,fragmentShader:`varying vec3 vColor;void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;float a=pow(1.-d,2.5);gl_FragColor=vec4(vColor*(.42+pow(1.-d,8.)*1.15),a*.72);}`});}
  makeFood(){this.foodGeometry=new THREE.BufferGeometry();this.foodGeometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(1500),3));this.foodGeometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(1500),3));this.foodGeometry.setAttribute('aSize',new THREE.Float32BufferAttribute(new Float32Array(500),1));this.foodPoints=new THREE.Points(this.foodGeometry,this.pointMaterial());this.foodPoints.frustumCulled=false;this.scene.add(this.foodPoints);}
  makeLandmarks(){
    this.landmarks=new THREE.Group();this.seaweed=[];this.fishSchools=[];this.bubbles=[];this.fishModels=[];this.wrapItems=[];
    // Real CC0 photogrammetry rocks: fewer, farther apart, more open water.
    loadCreature('coast_rocks').then(model=>{
      if(!model)return;
      for(let i=0;i<14;i++){
        const a=i*2.399,r=52+Math.sqrt(i/14)*205,x=Math.cos(a)*r,z=Math.sin(a)*r;
        const rock=model.clone(true);rock.rotation.set(0,a*.7,0);
        const scale=1.25+Math.random()*1.9;rock.scale.setScalar(scale);
        rock.position.set(x,groundY(x,z,scale*.62),z);this.landmarks.add(rock);this.wrapItems.push({mesh:rock,lift:scale*.62,seed:i});
      }
    });
    // Small carbonate rubble and shell hash scattered over the real relief.
    // Instanced so hundreds of fragments cost one draw call even at max quality.
    const rubbleGeo=new THREE.IcosahedronGeometry(1,1);
    const rubbleMat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.94,metalness:0,flatShading:true});
    const rubble=new THREE.InstancedMesh(rubbleGeo,rubbleMat,90);
    const dummy=new THREE.Object3D(),rubbleTone=[new THREE.Color(0x4f5f5c),new THREE.Color(0x6d746a),new THREE.Color(0x3f5a5c),new THREE.Color(0x8a8574)];
    for(let i=0;i<90;i++){
      const a=i*2.39996,r=38+Math.sqrt(Math.random())*190,x=Math.cos(a)*r,z=Math.sin(a)*r;
      const s=.05+Math.random()*.19;
      dummy.position.set(x,groundY(x,z,s*.42),z);
      dummy.rotation.set(Math.random()*3,Math.random()*6.28,Math.random()*3);
      dummy.scale.set(s*(1+Math.random()*.9),s*(.38+Math.random()*.35),s*(1+Math.random()*.7));
      dummy.updateMatrix();rubble.setMatrixAt(i,dummy.matrix);
      rubble.setColorAt(i,rubbleTone[i%rubbleTone.length].clone().multiplyScalar(.32+Math.random()*.28));
    }
    rubble.instanceMatrix.needsUpdate=true;rubble.castShadow=true;rubble.receiveShadow=true;this.landmarks.add(rubble);
    // Smithsonian CC0 branching hydrozoan scans stand in for former kelp ribbons.
    const flora=['cc0/hydrozoan-distichopora-borealis','cc0/hydrozoan-distichopora-violacea','cc0/hydrozoan-crypthelia-viridis'];
    flora.forEach((name,idx)=>loadCreature(name).then(model=>{
      if(!model)return;
      for(let g=0;g<2;g++){
        const a=(g+idx*.31)*2.399,r=52+Math.sqrt(g/2)*185;
        const x=Math.cos(a)*r+(Math.random()-.5)*6,z=Math.sin(a)*r+(Math.random()-.5)*6;
        const plant=model.clone(true);plant.rotation.y=Math.random()*6.28;
        const scale=1.2+Math.random()*1.5;plant.scale.setScalar(scale);
        plant.position.set(x,groundY(x,z,scale*.55),z);this.landmarks.add(plant);
        this.seaweed.push({mesh:plant,phase:Math.random()*6.28,x,z});this.wrapItems.push({mesh:plant,lift:scale*.55,seed:idx*7+g+40});
      }
    }));
    // Real Smithsonian coral scans; sparse colonies read better in deep water.
    const coralSpecies=['cc0/coral-acropora','cc0/coral-madrepora','cc0/coral-goniastrea','cc0/coral-pavonia','cc0/coral-porites-lobata','cc0/coral-manopora'];
    coralSpecies.forEach((name,idx)=>loadCreature(name).then(model=>{
      if(!model)return;
      for(let k=0;k<1;k++){
        const a=(k+idx*.17)*2.399+1.1,r=58+idx*31,x=Math.cos(a)*r,z=Math.sin(a)*r;
        const colony=model.clone(true);colony.rotation.y=Math.random()*6.28;
        const scale=1.5+Math.random()*1.2;colony.scale.setScalar(scale);
        colony.position.set(x,groundY(x,z,scale*.58),z);this.landmarks.add(colony);this.wrapItems.push({mesh:colony,lift:scale*.58,seed:idx*2+k+80});
      }
    }));
    // Distant fish schools: fewer, farther out and dimmer to keep the sea open.
    for(let s=0;s<2;s++){
      const count=18+Math.floor(Math.random()*12),pos=new Float32Array(count*3);
      for(let i=0;i<count;i++){pos[i*3]=(Math.random()-.5)*14;pos[i*3+1]=(Math.random()-.5)*5;pos[i*3+2]=(Math.random()-.5)*14;}
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
      const pts=new THREE.Points(geo,new THREE.PointsMaterial({color:s%2?0x9fe8d6:0x9fd8f0,size:.38,transparent:true,opacity:.45,depthWrite:false,blending:THREE.AdditiveBlending}));
      const angle=Math.random()*6.28,radius=96+s*38;pts.position.set(Math.cos(angle)*radius,5+Math.random()*10,Math.sin(angle)*radius);
      this.scene.add(pts);this.fishSchools.push({mesh:pts,angle,radius,speed:.005+Math.random()*.005,y:pts.position.y});
      const species=['cc0/real-chaetodon_auriga','cc0/real-zebrasoma_flavescens','cc0/real-pomacanthus_imperator','cc0/real-thunnus_albacares','cc0/real-sardina_pilchardus','cc0/real-mobula_birostris'][s%6];
      loadCreature(species).then(model=>{
        if(!model||!pts.parent)return;
        for(let k=0;k<1;k++){
          const fish=model.clone(true),a=k*3.141+Math.random(),rr=3+Math.random()*6;
          fish.position.set(Math.cos(a)*rr,(Math.random()-.5)*3,Math.sin(a)*rr);
          fish.rotation.y=a;fish.scale.setScalar(.3+Math.random()*.18);pts.add(fish);
          this.fishModels.push({mesh:fish,spin:a,phase:Math.random()*6.28,base:fish.position.clone()});
        }
      });
    }
    // A few bubble streams: enough for motion, not a wall of particles.
    const bubbleGeo=new THREE.SphereGeometry(1,8,6);
    const bubbleMat=new THREE.MeshBasicMaterial({color:0xc8f5ff,transparent:true,opacity:.2,depthWrite:false,blending:THREE.AdditiveBlending});
    for(let i=0;i<4;i++){
      const a=Math.random()*6.28,r=42+Math.random()*150,x=Math.cos(a)*r,z=Math.sin(a)*r;
      for(let j=0;j<2;j++){const b=new THREE.Mesh(bubbleGeo,bubbleMat);const s=.12+Math.random()*.26;b.scale.setScalar(s);b.position.set(x+(Math.random()-.5)*3,-3+Math.random()*24,z+(Math.random()-.5)*3);this.scene.add(b);this.bubbles.push({mesh:b,baseX:b.position.x,baseZ:b.position.z,speed:.6+Math.random()*1.2,phase:Math.random()*6.28});}
    }
    // CC0 crabs shelter among the rocks on the sea floor.
    loadCreature('cc0/crab').then(model=>{
      if(!model)return;
      for(let i=0;i<3;i++){
        const a=i*2.399,r=48+Math.sqrt(i/3)*165,crab=model.clone(true);
        const scale=.45+Math.random()*.3;crab.scale.setScalar(scale);
        const x=Math.cos(a)*r,z=Math.sin(a)*r;
        crab.position.set(x,groundY(x,z,scale*.42),z);crab.rotation.y=a;this.landmarks.add(crab);this.wrapItems.push({mesh:crab,lift:scale*.42,seed:i+120});
      }
    });
    this.scene.add(this.landmarks);
  }
  // Keep decoration near the action without ever showing a world edge. Each
  // scanned landmark is recycled around the player when it falls too far behind.
  wrapLandmarks(px,pz){
    const range=340;
    for(const item of this.wrapItems||[]){
      const m=item.mesh;if(!m)continue;
      if(Math.abs(m.position.x-px)<range&&Math.abs(m.position.z-pz)<range)continue;
      const a=item.seed*2.399963+pz*.0011+px*.0007,r=150+((item.seed*47)%190);
      const x=px+Math.cos(a)*r,z=pz+Math.sin(a)*r;
      m.position.set(x,groundY(x,z,item.lift||0),z);
    }
  }
  followOcean(px,pz){
    const tileSize=this.floor.userData.tileSize;
    const ax=Math.round(px/tileSize)*tileSize,az=Math.round(pz/tileSize)*tileSize;
    if(ax!==this.floorAnchor.x||az!==this.floorAnchor.z){
      this.floorAnchor={x:ax,z:az};
      updateSeabedTiles(this.floor,ax,az);
      this.shadowCatcher.geometry.dispose();
      this.shadowCatcher.geometry=makeSeabedGeometry(1100,96,ax,az);
      this.shadowCatcher.position.set(ax,0,az);
    }
    this.dust.position.set(px,0,pz);
    this.lightShafts.position.set(px,0,pz);
  }
  updateEnvironment(game,dt,t){
    const player=game.player;
    this.followOcean(player.x,player.z);
    this.wrapLandmarks(player.x,player.z);
    if(this.localLight)this.localLight.position.set(player.x,14,player.z+6);
    const period=periodFor(game);
    const wanted=this.periodOverride>=0?this.periodOverride:periodIndexFor(game);
    if(wanted!==this.currentPeriod)this.applyPeriod(wanted);
    if(this.periodScenery?.group.visible)this.periodScenery.animate(t,dt);
    // Animate the living sea: swaying kelp, circling schools, rising bubbles.
    for(const k of this.seaweed)k.mesh.rotation.z=Math.sin(t*.7+k.phase)*.055;
    for(const s of this.fishSchools){s.angle+=s.speed*dt;s.mesh.position.x=player.x+Math.cos(s.angle)*s.radius;s.mesh.position.z=player.z+Math.sin(s.angle)*s.radius;s.mesh.position.y=s.y+Math.sin(t*.4+s.angle)*1.2;s.mesh.rotation.y=-s.angle;}
    for(const f of this.fishModels){f.spin+=dt*.65;f.mesh.position.set(f.base.x+Math.cos(f.spin)*1.4,f.base.y+Math.sin(t*1.5+f.phase)*.35,f.base.z+Math.sin(f.spin)*1.4);f.mesh.rotation.y=-f.spin;}
    for(const b of this.bubbles){let y=b.mesh.position.y+b.speed*dt*3;if(y>24)y=-4;if(Math.abs(b.baseX-player.x)>240||Math.abs(b.baseZ-player.z)>240){const a=(b.phase+player.x*.001+player.z*.0007)%6.28;b.baseX=player.x+Math.cos(a)*120;b.baseZ=player.z+Math.sin(a)*120;}b.mesh.position.set(b.baseX+Math.sin(t*.8+b.phase)*.6,y,b.baseZ);}
    const id=game.biome.id;
    // The geological era owns the palette; the biome shifts water and sediment
    // separately so tidal violet and crystal blue remain visually distinct.
    const waterTint=game.biome?.waterTint||[1,1,1],floorTint=game.biome?.floorTint||[1,1,1];
    const bg=new THREE.Color(period.background).multiply(new THREE.Color(...waterTint));
    if(!this.scene.background?.isTexture)this.scene.background.lerp(bg,Math.min(1,dt*2));
    this.scene.fog.color.lerp(bg,Math.min(1,dt*2));
    const floorGain=this.quality==='low'?3.0:this.quality==='medium'?2.45:2.15;
    this.floorMaterial.uniforms.uDeep.value.lerp(new THREE.Color(period.deep[0]*floorTint[0]*floorGain,period.deep[1]*floorTint[1]*floorGain,period.deep[2]*floorTint[2]*floorGain),Math.min(1,dt*3));
    this.floorMaterial.uniforms.uShallow.value.lerp(new THREE.Color(period.shallow[0]*floorTint[0]*floorGain,period.shallow[1]*floorTint[1]*floorGain,period.shallow[2]*floorTint[2]*floorGain),Math.min(1,dt*3));
    const bed=period.seabedTint||[1,1,1];
    this.floorMaterial.uniforms.uTint.value.lerp(new THREE.Color(bed[0]*floorTint[0],bed[1]*floorTint[1],bed[2]*floorTint[2]),Math.min(1,dt*4));
    this.floorMaterial.uniforms.uFlow.value=id==='tide'?1:0;
    // Era light colours drift slowly towards the period's key/fill palette.
    if(this.sun)this.sun.color.lerp(new THREE.Color(period.key),Math.min(1,dt));
    if(this.sunFar)this.sunFar.color.lerp(new THREE.Color(period.key).lerp(new THREE.Color(0x8fc7d8),.55),Math.min(1,dt));
    if(this.water){this.water.update(period,t,dt,this.qualityPreset);this.water.bindCinematic(this.cinematic);}
    this.currents.visible=id==='tide';if(this.currents.visible){const attr=this.currents.geometry.attributes.position;let index=0;
      for(let x=-4;x<=4;x++)for(let z=-4;z<=4;z++){const px=player.x+x*32,pz=player.z+z*32,v=game.currentAt(px,pz),a=Math.atan2(v.z,v.x),len=3.2+Math.sin(t+z)*.4,ex=px+Math.cos(a)*len,ez=pz+Math.sin(a)*len;for(const q of [[px,pz],[ex,ez],[ex,ez],[ex-Math.cos(a-.65),ez-Math.sin(a-.65)],[ex,ez],[ex-Math.cos(a+.65),ez-Math.sin(a+.65)]])attr.setXYZ(index++,q[0],-2.8,q[1]);}
      this.currents.geometry.setDrawRange(0,index);attr.needsUpdate=true;
    }
    const ids=new Set();for(const h of game.hazards){ids.add(h.id);let g=this.hazardMeshes.get(h.id);if(!g){g=new THREE.Group();const water=h.type==='whirlpool',mat=new THREE.MeshStandardMaterial({color:water?0x75bcdc:0x9c80be,emissive:water?0x245c79:0x623b8d,emissiveIntensity:.6,metalness:.35,roughness:.2});if(!water)for(let j=0;j<4;j++){const m=new THREE.Mesh(this.spikeGeo,mat);m.position.set(Math.sin(j*2)*1.2,-1+((j+1)%3)*.5,Math.cos(j*2)*1.2);m.scale.set(1.1,4+j*.4,1.1);m.rotation.z=(j-1.5)*.15;g.add(m);}const ring=new THREE.Mesh(this.hazardRingGeo,new THREE.MeshBasicMaterial({color:water?0x9ad9f1:0xce9fff,transparent:true,opacity:.12,side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.scale.setScalar(h.radius);ring.position.y=-2;g.add(ring);g.userData={ring,mat};this.hazardMeshes.set(h.id,g);this.scene.add(g);}
      g.position.set(h.x,0,h.z);g.userData.ring.material.opacity=h.state==='idle'?.08:h.state==='warning'?.15+h.strength*.3:.65;g.userData.ring.scale.setScalar(h.radius*(h.state==='pulse'?1+Math.sin(t*15)*.04:1));g.userData.mat.emissiveIntensity=.4+h.strength*1.5;
    }
    for(const [id,g]of this.hazardMeshes)if(!ids.has(id)){this.scene.remove(g);g.userData.mat.dispose();g.userData.ring.material.dispose();this.hazardMeshes.delete(id);}
    const boss=game.creatures.find(c=>c.boss);this.bossArrow.visible=!!boss&&boss.variant!=='crystal'&&boss.stun<=0&&['warning','charge'].includes(boss.state);if(this.bossArrow.visible){this.bossArrow.position.set(boss.x,1,boss.z);this.bossArrow.setDirection(new THREE.Vector3(Math.cos(boss.aim||0),0,Math.sin(boss.aim||0)));}
  }
  burst(x,z,color=0xa1ffcb,count=12){const col=new THREE.Color(color);for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,v=1+Math.random()*4;this.particles.push({x,y:.5,z,vx:Math.cos(a)*v,vz:Math.sin(a)*v,vy:Math.random()*2,life:1,max:1,color:col});}if(this.particles.length>290)this.particles.splice(0,this.particles.length-290);}
  ripple(x,z,r=1,color=0xb8ffda){const m=new THREE.Mesh(this.torus,new THREE.MeshBasicMaterial({color,transparent:true,opacity:.7,depthWrite:false}));m.rotation.x=Math.PI/2;m.position.set(x,.3,z);this.scene.add(m);this.ripples.push({mesh:m,life:1,r});}
  // Phagocytosis: draw food inward toward the cell core, then a soft membrane ripple.
  engulf(x,z,targetX,targetZ,color=0xa8fbc5){
    const col=new THREE.Color(color);this.engulfs??=[];
    for(let i=0;i<9;i++){this.particles.push({x,y:.4,z,vx:0,vz:0,vy:0,life:.55,max:.55,color:col,pull:[targetX,targetZ],seed:i*.7});}
    if(this.particles.length>300)this.particles.splice(0,this.particles.length-300);
    const m=new THREE.Mesh(this.torus,new THREE.MeshBasicMaterial({color,transparent:true,opacity:.85,depthWrite:false}));m.rotation.x=Math.PI/2;m.position.set(targetX,.32,targetZ);m.scale.setScalar(.4);this.scene.add(m);this.ripples.push({mesh:m,life:1,r:.4,grow:2.2});
  }
  // Milestone transmutation: a bright band sweeps over the cell.
  molt(){this.moltTime=1.2;}
  pointToWorld(x,y){this.raycaster.setFromCamera(new THREE.Vector2(x/innerWidth*2-1,-y/innerHeight*2+1),this.camera);return this.raycaster.ray.intersectPlane(this.plane,this.pointer);}
  // Zoom out to survey the whole sea, or dive right into the cell. 0.25 … 6.5.
  setZoom(value){this.zoomTarget=Math.max(.25,Math.min(6.5,value));return this.zoomTarget;}
  adjustZoom(delta){return this.setZoom(this.zoomTarget+delta);}
  // Cycle the camera through third-person follow → orbit → first-person.
  cycleView(){const modes=['follow','orbit','first'];this.viewMode=modes[(modes.indexOf(this.viewMode)+1)%modes.length];this.viewSnap=true;return this.viewMode;}
  setView(mode){if(['follow','orbit','first'].includes(mode)){if(mode!==this.viewMode)this.viewSnap=true;this.viewMode=mode;}return this.viewMode;}
  // Drag deltas (pixels) rotate the orbit/first-person camera. Touch and mouse share this path.
  rotateView(dx,dy){if(this.viewMode==='follow')return false;this.orbitYaw-=dx*.0055;const key=this.viewMode==='first'?'firstPitch':'orbitPitch',lo=this.viewMode==='first'?-1.1:-.15,hi=this.viewMode==='first'?1.0:1.48;this[key]=Math.max(lo,Math.min(hi,this[key]-dy*.0045));return true;}
  update(game,dt,t){
    if(this.lastGame!==game||this.lastEpoch!==game.sceneEpoch){for(const g of this.entities.values()){this.scene.remove(g);this.disposeCell(g);}this.entities.clear();for(const g of this.hazardMeshes.values()){this.scene.remove(g);g.userData.mat.dispose();g.userData.ring.material.dispose();}this.hazardMeshes.clear();this.worldScene.reset();this.lastGame=game;this.lastEpoch=game.sceneEpoch;this.particles=[];}
    this.time.value=t;this.beat.value*=Math.exp(-dt*7);const home=game.status==='home',p=game.player,formBias=home?0:lineageFormBias(game);
    this.updateEnvironment(game,dt,t);
    this.worldScene.update(game,dt,t);
    const desired=new THREE.Vector3(home?(this.mobile?-2:-11):p.x,0,home?0:p.z);this.target.lerp(desired,1-Math.exp(-dt*(home?2:5)));
    // Keep the shadow frustum tight around the action for crisp contact shadows.
    if(this.sun){this.sun.target.position.copy(this.target);this.sun.position.set(this.target.x-35,70,this.target.z+35);this.sun.target.updateMatrixWorld();this.floorMaterial.uniforms.uSunDir.value.copy(this.sun.position).sub(this.target).normalize();}
    if(this.sunFar){this.sunFar.target.position.copy(this.target);this.sunFar.position.set(this.target.x-52,86,this.target.z+44);this.sunFar.target.updateMatrixWorld();}
    const livingForm=home?stageToFormIndex(this.previewStage):formIndexForMass(p.mass)+formBias;
    const camFactor=5+(livingForm/(FORMS.length-1))*3.5;
    this.zoom+=(this.zoomTarget-this.zoom)*Math.min(1,dt*5);
    const baseDistance=home?(this.mobile?44:42):(34+p.radius*camFactor)*(this.mobile&&game.stage>=2?Math.max(1,.85/this.camera.aspect):1);
    const distance=baseDistance*this.zoom;
    this.scene.fog.density=(home?.0011:.0011/(1+p.radius*.12))/this.zoom*(this.period?.fog||.002)/.0018;
    this.floorMaterial.uniforms.uFogColor.value.copy(this.scene.fog.color);
    this.floorMaterial.uniforms.uFogDensity.value=this.scene.fog.density;
    // Camera modes: follow (classic top-down), orbit (drag to rotate around the player),
    // first (see through the player cell). Drag/zoom behaviour is driven by main.js.
    const cam=new THREE.Vector3(),look=new THREE.Vector3();
    if(this.viewSnap&&this.viewMode==='first'&&!home){
      const heading=Math.hypot(p.vx,p.vz)>1?Math.atan2(p.vx,p.vz):this.hero.rotation.y;
      if(Number.isFinite(heading))this.orbitYaw=heading;
    }
    if(!home&&this.viewMode==='first'){
      const cp=Math.cos(this.firstPitch),sp=Math.sin(this.firstPitch);
      const dx=Math.sin(this.orbitYaw)*cp,dz=Math.cos(this.orbitYaw)*cp;
      cam.set(p.x,p.radius*.25+Math.sin(t*1.6)*.12,p.z);
      look.set(p.x+dx*20,cam.y+sp*20,p.z+dz*20);
      const fov=Math.max(34,Math.min(96,72/Math.sqrt(this.zoom)));
      if(Math.abs(this.camera.fov-fov)>.05){this.camera.fov=fov;this.camera.updateProjectionMatrix();}
    }else if(!home&&this.viewMode==='orbit'){
      const cp=Math.cos(this.orbitPitch),sp=Math.sin(this.orbitPitch);
      cam.set(this.target.x+Math.sin(this.orbitYaw)*cp*distance,this.target.y+sp*distance,this.target.z+Math.cos(this.orbitYaw)*cp*distance);
      look.copy(this.target);
      if(this.camera.fov!==46){this.camera.fov=46;this.camera.updateProjectionMatrix();}
    }else{
      cam.set(this.target.x,this.target.y+distance,this.target.z+distance*.66);
      look.copy(this.target);
      if(this.camera.fov!==46){this.camera.fov=46;this.camera.updateProjectionMatrix();}
    }
    this.camera.position.lerp(cam,1-Math.exp(-dt*(this.viewMode==='first'?7:3)));
    if(this.zoomSnap||this.viewSnap){this.camera.position.copy(cam);this.zoomSnap=false;this.viewSnap=false;}
    this.shake=Math.max(0,this.shake-dt);if(this.shake>0&&!this.reducedMotion){this.camera.position.x+=Math.sin(t*65)*this.shake*.8;this.camera.position.z+=Math.cos(t*71)*this.shake*.8;}this.camera.lookAt(look);
    this.vfx.update(dt);
    const lodBias=this.qualityPreset?.lodBias??0;
    this.scene.traverse(o=>{if(o.userData.lodWrapper)updateCreatureLOD(o,this.camera,lodBias);});
    const morphStage=home?this.previewStage:game.stage;
    const form=home?stageToFormIndex(this.previewStage):formIndexForMass(p.mass)+formBias,fw=formWeights(form);
    const mobileHome=home&&this.mobile,r=home?(mobileHome?1.75:3.7)*(morphStage>=3?.73:1):p.radius;
    this.hero.position.set(home?(mobileHome?-4.5:2):p.x,r*.25+Math.sin(t*1.6)*.1,home?(mobileHome?11:-1):p.z);this.hero.scale.setScalar(r);if(home)this.hero.rotation.y=mobileHome?Math.sin(t*.15)*.1:Math.PI/2+Math.sin(t*.15)*.08;else if(Math.hypot(p.vx,p.vz)>1){const heading=Math.atan2(p.vx,p.vz),diff=Math.atan2(Math.sin(heading-this.hero.rotation.y),Math.cos(heading-this.hero.rotation.y));this.hero.rotation.y+=diff*Math.min(1,dt*4);}
    const heroData=this.hero.userData;heroData.core.rotation.y=t*.4;heroData.ring.rotation.z=t*.13;
    const baseColor=fw.armor>.5?'#d3e8b8':fw.snout>.7?'#cfe7d8':fw.tail>.7?'#a9dfe4':fw.cilia>.3?'#a3f6cc':'#9ef0d2';
    this.materials.player.uniforms.uColor.value.set(game.crescendoTime>0?'#ffe7b0':game.traits.includes('electric')?'#9ed9f8':game.traits.includes('shell')?'#d0edc3':baseColor);
    heroData.ring.visible=home||game.traits.includes('shell')||game.abilityTime>0;heroData.ring.scale.setScalar(game.abilityTime>0?1.8:1.15);
    heroData.tails.visible=(home&&fw.cilia>.2)||game.traits.includes('magnet');heroData.tails.rotation.y=Math.sin(t*.7)*.1;
    heroData.tails.scale.setScalar(game.traits.includes('magnet')?1.4:Math.max(.001,fw.cilia));
    // Cell shape stretches towards the current form; organelles multiply and glow with mass.
    // Signature fossils keep a smaller cell body so their unique outline stays readable.
    const sigStrength=Math.max(0,...SIGNATURES.map(s=>signatureWeight(s,form)));
    const bodyScale=Math.max(.42,1-sigStrength*.62);
    const shape=new THREE.Vector3((1+fw.snout*.28)*bodyScale,(.8-fw.dorsal*.12)*bodyScale,(1+fw.tail*.2)*bodyScale);heroData.shell.scale.lerp(shape,Math.min(1,dt*5));
    animateMorphology(this.morph,form,t,Math.hypot(p.vx,p.vz));
    const progress=form/(FORMS.length-1);
    const organelles=heroData.organelles.children;for(let k=0;k<organelles.length;k++){const on=k<Math.min(organelles.length,2+Math.round(progress*3)),pulse=1+Math.sin(t*2+k)*.12;organelles[k].visible=on;organelles[k].scale.setScalar((.045+(k%3)*.022)*pulse);organelles[k].material.opacity=.25+progress*.5;}
    heroData.core.scale.set(.34+.06*progress,.4+.05*progress,.34+.06*progress);heroData.core.material.emissiveIntensity=.7+Math.sin(t*2.4)*.12;
    if(this.moltTime>0){this.moltTime-=dt;const k=1-Math.abs(this.moltTime-.6)/.6;heroData.shell.material.uniforms.uBeat.value=Math.max(heroData.shell.material.uniforms.uBeat.value,Math.max(0,k)*1.6);if(this.moltTime<=0)this.moltTime=0;}
    for(const [id,mesh]of Object.entries(this.anatomy))mesh.visible=!home&&game.traits.includes(id);
    this.anatomy.speed.visible=!home&&game.traits.includes('speed');this.anatomy.speed.scale.setScalar(1.2);this.anatomy.speed.children.forEach((m,i)=>m.rotation.x=Math.sin(t*4+i)*.15);
    this.anatomy.electric.rotation.y=t*.7;this.anatomy.harmony.rotation.y=-t*.8;this.anatomy.mouth.scale.setScalar(1+Math.sin(t*3)*.1);
    // In first-person the camera sits inside the cell, so hide its body to keep the view clear.
    this.hero.visible=(this.viewMode!=='first'||home)&&(game.invincible<=0||Math.floor(t*10)%2===0||home);
    const ids=new Set();for(const c of game.creatures){ids.add(c.id);let g=this.entities.get(c.id);const type=c.boss?'boss':game.canEat(c)?'edible':game.isDangerous(c)?'danger':'equal';
      if(!g){g=this.makeCell(type,c.boss,c.kind,c.variant,c.hue||0);this.entities.set(c.id,g);this.scene.add(g);}
      if(g.userData.type!==type){g.userData.type=type;g.userData.shell.material=this.materials[type];g.children[0].material=this.glowMat(type);g.userData.ring.material.color.copy(this.materials[type].uniforms.uColor.value);if(!c.boss)g.userData.ring.material.color.lerp(this.faunaTintColors[(c.hue||0)%this.faunaTintColors.length],.6);}
      const x=home?c.x*.65+5:c.x,z=home?c.z*.65:c.z;
      g.position.set(x,c.radius*.2+Math.sin(t+c.phase)*.3,z);g.scale.set(c.radius*(c.kind===1?.65:1)*(1+Math.sin(t*1.4+c.phase)*.03),c.radius*(c.kind===2?.65:.85),c.radius*(c.kind===1?1.4:1));g.rotation.y=Math.PI/2-(c.heading??c.angle);g.userData.shell.scale.y=c.kind===2?.48:.8;
      g.userData.core.rotation.y=t*.2+c.phase;g.userData.ring.rotation.z=t*.08+c.phase;g.userData.ring.visible=c.boss||c.stun>0||c.kind===3;if(c.boss){g.userData.ring.material.color.set(game.canEat(c)?0xa4ffd0:c.state==='warning'||c.state==='charge'?0xffaa83:0xeac590);g.userData.ring.material.opacity=c.state==='warning'?.4+Math.sin(t*12)*.2:.4;g.userData.ring.scale.setScalar(c.state==='exposed'?1.4:1.15);}
      else if(c.kind===2){g.userData.ring.visible=true;g.userData.ring.material.color.set(c.stun>0?0xa4e7ff:c.state==='pulse'?0xffbcad:c.state==='warning'?0xf1c992:0x97cfd1);g.userData.ring.material.opacity=c.state==='pulse'?.8:c.state==='warning'?.45:.17;g.userData.ring.scale.setScalar(c.state==='pulse'?1.8:1.2);}
      else if(c.kind===1&&c.state==='warning'){g.userData.ring.visible=true;g.userData.ring.material.color.set(0xffb58c);g.userData.ring.material.opacity=.5+Math.sin(t*16)*.2;}
      if(c.rare){g.userData.core.material.color.set(0xffdc8c);g.userData.ring.visible=true;g.userData.ring.material.color.set(0xffd68b);g.userData.ring.material.opacity=.5;}
      g.userData.shell.material.uniforms.uTime=this.time;
      this.animator.apply(g,creatureAnimationState(c),t,dt);
      if(c.boss){this.materials.boss.uniforms.uColor.value.set(c.variant==='tide'?'#99d4ef':c.variant==='crystal'?'#d9b6ee':'#e8bd92');if(g.userData.bossMorph){animateMorphology(g.userData.bossMorph,stageToFormIndex(2)+.4,t,4);g.userData.bossMorph.finMaterial.color.set(0x72b5cd);g.userData.shell.scale.set(.8,.5,1);}if(g.userData.orbs)g.userData.orbs.rotation.y=t*.8;}
      if(home&&Math.hypot(x-2,z+1)<9)g.visible=false;else g.visible=true;
    }
    for(const [id,g]of this.entities)if(!ids.has(id)){this.scene.remove(g);this.entities.delete(id);this.disposeCell(g);}
    const pos=this.foodGeometry.attributes.position,col=this.foodGeometry.attributes.color,size=this.foodGeometry.attributes.aSize;
    let i=0;for(const f of game.food.slice(0,500)){pos.setXYZ(i,f.x,.3+Math.sin(t+f.id)*.25,f.z);const c=FOOD_TINTS[f.hue%FOOD_TINTS.length];col.setXYZ(i,c[0],c[1],c[2]);size.setX(i,(f.value===3?1.4:.85)*(1+Math.sin(t*2+f.id)*.15));i++;}
    this.foodGeometry.setDrawRange(0,i);pos.needsUpdate=col.needsUpdate=size.needsUpdate=true;
    if(!home&&Math.hypot(p.vx,p.vz)>2&&Math.random()<.65){this.particles.push({x:p.x,y:.3,z:p.z,vx:0,vz:0,vy:0,life:.8,max:.8,color:new THREE.Color(0x75e5bd)});}
    const tp=this.trailGeometry.attributes.position,tc=this.trailGeometry.attributes.color,ts=this.trailGeometry.attributes.aSize;
    this.particles=this.particles.filter(q=>q.life>0).slice(-300);i=0;for(const q of this.particles){q.life-=dt;if(q.pull){const dx=q.pull[0]-q.x,dz=q.pull[1]-q.z,k=Math.min(1,dt*(7+(1-q.life/q.max)*16));q.x+=dx*k;q.z+=dz*k;q.y=Math.max(.1,q.y-dt*.4);}else{q.x+=q.vx*dt;q.z+=q.vz*dt;q.y+=q.vy*dt;}tp.setXYZ(i,q.x,q.y,q.z);tc.setXYZ(i,q.color.r,q.color.g,q.color.b);ts.setX(i,Math.max(0,q.life/q.max)*(q.pull?1.1:.8));i++;}this.trailGeometry.setDrawRange(0,i);tp.needsUpdate=tc.needsUpdate=ts.needsUpdate=true;
    this.ripples=this.ripples.filter(q=>{q.life-=dt*.9;if(q.life<=0){this.scene.remove(q.mesh);q.mesh.material.dispose();return false;}q.mesh.scale.setScalar(q.r+(1-q.life)*q.r*(q.grow||4));q.mesh.material.opacity=q.life*.6;return true;});
    this.dust.rotation.y=Math.sin(t*.008)*.04;
    this.lightShafts.rotation.y=Math.sin(t*.03)*.06;
    if(this.lightShafts.children[0])this.lightShafts.children[0].material.uniforms.uStrength.value=(this.viewMode==='first'?.026:this.viewMode==='orbit'?.014:.006)+this.beat.value*.005;
    if(this.postEnabled){
      const preset=this.qualityPreset||{};
      const boost=Math.min(.6,this.beat.value*.3+(game.crescendoTime>0?.25:0)+(this.vfx?.flashValue||0));
      const bass=Math.min(.6,game.crescendoTime>0?.4:0);
      const speed=Math.hypot(p.vx||0,p.vz||0);
      const motion=Math.min(1,Math.max(0,(speed-14)/44)+(game.dashCd>0?.28:0));
      const targetExposure=(this.toneExposure||1.42)*(1+(preset.adaptiveExposure?Math.max(-.1,Math.min(.12,(22-speed)*.003)):0));
      this.exposureCurrent+=(targetExposure-this.exposureCurrent)*Math.min(1,dt*1.8);
      this.camera.updateMatrixWorld();
      const clip=this.sun.position.clone().project(this.camera);
      const sun=[Math.max(-.25,Math.min(1.25,clip.x*.5+.5)),Math.max(.82,Math.min(1.35,clip.y*.5+.5))];
      this.cinematic.render(this.scene,this.camera,{boost,bass,sun,time:t,exposure:this.exposureCurrent,motion,
        dof:!!preset.dof,motionBlur:!!preset.motionBlur,taa:!!preset.taa,lensFlare:!!preset.lensFlare,filmLut:!!preset.filmLut,
        waterLayers:preset.waterLayers||1,waterTint:this.water?.scattering});
    }else{
      // Direct rendering has no ACES compose pass; lift the linear HDR values so
      // low-quality mode stays readable instead of appearing almost black.
      const prev=this.renderer.toneMapping;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=this.toneExposure||1.4;
      this.renderer.render(this.scene,this.camera);this.renderer.toneMapping=prev;
    }
  }
  disposeCell(g){const mats=new Set(),geos=new Set(),shared=new Set([this.sphere,this.ico,this.torus,this.spikeGeo,this.shieldGeometry]);g.traverse(o=>{if(o.userData.sharedAsset)return;if(o.isMesh&&o.material&&!Object.values(this.materials).includes(o.material))mats.add(o.material);if(o.geometry&&!shared.has(o.geometry))geos.add(o.geometry);});for(const m of mats)m.dispose();for(const geo of geos)geo.dispose();}
}
