import * as THREE from './vendor/three.module.js';

export class Ocean {
  constructor(container){
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#061c23');this.scene.fog=new THREE.FogExp2('#061c23',.006);
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));this.renderer.setSize(innerWidth,innerHeight);this.renderer.outputColorSpace=THREE.SRGBColorSpace;container.appendChild(this.renderer.domElement);
    this.camera=new THREE.PerspectiveCamera(43,innerWidth/innerHeight,.1,700);this.camera.position.set(-11,40,30);this.target=new THREE.Vector3(-11,0,0);this.camera.lookAt(this.target);
    this.time={value:0};this.beat={value:0};this.entities=new Map();this.particles=[];this.ripples=[];this.hazardMeshes=new Map();this.shake=0;this.reducedMotion=matchMedia('(prefers-reduced-motion:reduce)').matches;
    this.sphere=new THREE.SphereGeometry(1,28,20);this.ico=new THREE.IcosahedronGeometry(1,1);this.torus=new THREE.TorusGeometry(1,.018,5,60);this.spikeGeo=new THREE.ConeGeometry(.3,1,5);this.hazardRingGeo=new THREE.RingGeometry(.85,1,64);
    this.scene.add(new THREE.HemisphereLight(0xc7fbe0,0x04272c,2));const sun=new THREE.DirectionalLight(0xd9ffe4,2);sun.position.set(-20,45,20);this.scene.add(sun);
    this.materials={player:this.cellMaterial('#a3f6cc'),edible:this.cellMaterial('#6ce6b6'),danger:this.cellMaterial('#ec977d'),equal:this.cellMaterial('#8dbed3'),boss:this.cellMaterial('#f2bc8b')};
    this.glowTexture=this.makeGlow();this.glowMaterials={};
    this.makeFloor();this.makeDust();this.makeFood();this.makeLandmarks();
    this.hero=this.makeCell('player',true);this.scene.add(this.hero);
    this.makeAnatomy();this.makeCurrents();this.bossArrow=new THREE.ArrowHelper(new THREE.Vector3(1,0,0),new THREE.Vector3(),24,0xffb294,3,2);this.bossArrow.visible=false;this.scene.add(this.bossArrow);
    this.trailGeometry=new THREE.BufferGeometry();this.trailGeometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(900),3));this.trailGeometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(900),3));this.trailGeometry.setAttribute('aSize',new THREE.Float32BufferAttribute(new Float32Array(300),1));
    this.trail=new THREE.Points(this.trailGeometry,this.pointMaterial());this.scene.add(this.trail);
    this.raycaster=new THREE.Raycaster();this.plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);this.pointer=new THREE.Vector3();
    addEventListener('resize',()=>{this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight);this.setQuality(this.quality||'high');});
  }
  setQuality(quality){this.quality=quality;const ratio=quality==='low'?Math.min(devicePixelRatio,1):Math.min(devicePixelRatio,1.7);this.renderer.setPixelRatio(ratio);this.dust.geometry.setDrawRange(0,quality==='low'?500:1500);for(const p of [this.foodPoints,this.trail])if(p?.material.uniforms?.uPixel)p.material.uniforms.uPixel.value=ratio;}
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
  cellMaterial(color){return new THREE.ShaderMaterial({uniforms:{uTime:this.time,uColor:{value:new THREE.Color(color)},uBeat:this.beat},vertexShader:`
    uniform float uTime; uniform float uBeat; varying vec3 vNormal; varying vec3 vView; varying vec3 vPos;
    void main(){vec3 p=position;float wave=sin(p.y*5.+uTime*1.7)*sin(p.x*4.+uTime*.8)*.035; p*=1.+wave+uBeat*.012;vec4 mv=modelViewMatrix*vec4(p,1.);vNormal=normalize(normalMatrix*normal);vView=-mv.xyz;vPos=position;gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`uniform vec3 uColor;uniform float uTime;varying vec3 vNormal;varying vec3 vView;varying vec3 vPos;
      void main(){vec3 n=normalize(vNormal);float facing=max(dot(n,normalize(vView)),0.);float rim=pow(1.-facing,2.3);float light=max(dot(n,normalize(vec3(-.5,1.,.7))),0.);float pattern=sin(vPos.x*19.+sin(vPos.z*13.+uTime*.5)*2.)*.5+.5;float speck=pow(pattern,9.)*.07;vec3 col=uColor*(.17+light*.32)+uColor*rim*1.3+vec3(.6,.85,.76)*pow(light,18.)*.7+uColor*speck;gl_FragColor=vec4(col,.74+rim*.23);}`,
    transparent:true,depthWrite:false});}
  glowMat(type){if(!this.glowMaterials[type])this.glowMaterials[type]=new THREE.SpriteMaterial({map:this.glowTexture,color:this.materials[type].uniforms.uColor.value,transparent:true,opacity:.5,blending:THREE.AdditiveBlending,depthWrite:false});return this.glowMaterials[type];}
  makeCell(type,hero=false,kind=0){
    const g=new THREE.Group();
    const glow=new THREE.Sprite(this.glowMat(type));glow.scale.set(5.5,5.5,1);glow.position.y=.1;g.add(glow);
    const shell=new THREE.Mesh(this.sphere,this.materials[type]);shell.scale.set(1,.8,1);g.add(shell);
    const core=new THREE.Mesh(this.ico,new THREE.MeshStandardMaterial({color:type==='player'?0xc1ffce:0x9adbb3,emissive:type==='player'?0x38885d:0x244e39,emissiveIntensity:.7,roughness:.25,metalness:.1}));core.scale.set(.34,.4,.34);core.position.y=.12;g.add(core);
    const ring=new THREE.Mesh(this.torus,new THREE.MeshBasicMaterial({color:this.materials[type].uniforms.uColor.value,transparent:true,opacity:.32}));ring.rotation.x=Math.PI/2+.2;ring.scale.setScalar(1.15);g.add(ring);
    const organelles=new THREE.Group();for(let i=0;i<5;i++){const b=new THREE.Mesh(this.ico,new THREE.MeshBasicMaterial({color:0xb4ffcd,transparent:true,opacity:.3}));b.scale.setScalar(.04+(i%3)*.02);b.position.set(Math.cos(i*2.4)*.6,Math.sin(i*3)*.35,Math.sin(i*2.4)*.6);organelles.add(b);}g.add(organelles);
    if(hero){const tails=new THREE.Group();for(let i=0;i<8;i++){const a=i/8*Math.PI*2;const points=[];for(let j=0;j<6;j++){const r=.88+j*.19;points.push(new THREE.Vector3(Math.cos(a+j*.08)*r,-.12-j*.09,Math.sin(a+j*.08)*r));}const curve=new THREE.CatmullRomCurve3(points);const tentacle=new THREE.Mesh(new THREE.TubeGeometry(curve,16,.013,4,false),new THREE.MeshBasicMaterial({color:0xa3f6cc,transparent:true,opacity:.38}));tails.add(tentacle);}g.add(tails);}
    const tails=hero?g.children[5]:null;
    if(kind===3||type==='boss'){const armor=new THREE.Group(),mat=new THREE.MeshBasicMaterial({color:type==='boss'?0xe8c398:0x9fcfc1,transparent:true,opacity:.45});for(let i=0;i<(type==='boss'?10:6);i++){const a=i/(type==='boss'?10:6)*Math.PI*2,m=new THREE.Mesh(this.spikeGeo,mat);m.position.set(Math.cos(a)*.95,.1,Math.sin(a)*.95);m.rotation.z=-Math.cos(a)*1.2;m.rotation.x=Math.sin(a)*1.2;m.scale.setScalar(.55);armor.add(m);}g.add(armor);}
    g.userData={type,shell,core,ring,organelles,tails};return g;
  }
  makeFloor(){
    const material=new THREE.ShaderMaterial({uniforms:{uTime:this.time,uBeat:this.beat,uDeep:{value:new THREE.Color(.014,.067,.084)},uShallow:{value:new THREE.Color(.021,.12,.131)},uFlow:{value:0}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`
      varying vec2 vUv;uniform float uTime;uniform float uBeat;uniform vec3 uDeep;uniform vec3 uShallow;uniform float uFlow;
      void main(){vec2 p=(vUv-.5)*650.;p.x+=uTime*uFlow*1.6;float w=sin(p.x*.11+sin(p.y*.09+uTime*.08)*2.)*sin(p.y*.13+sin(p.x*.08-uTime*.07)*2.);float c=pow(max(0.,1.-abs(w)),24.);float f=sin(p.x*.023+p.y*.017)*.5+.5;vec3 col=mix(uDeep,uShallow,f);col+=uShallow*c*.25;float ring=pow(max(0.,sin(length(p)*.31-uTime*.13)),45.)*.018;col+=vec3(.3,.6,.5)*ring;gl_FragColor=vec4(col,1.);}`});this.floorMaterial=material;
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(650,650),material);floor.rotation.x=-Math.PI/2;floor.position.y=-4;this.scene.add(floor);
    // A faint boundary communicates the finite sea before the player reaches it.
    const pts=[new THREE.Vector3(-184,-2,-184),new THREE.Vector3(184,-2,-184),new THREE.Vector3(184,-2,184),new THREE.Vector3(-184,-2,184),new THREE.Vector3(-184,-2,-184)];this.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0x488e75,transparent:true,opacity:.25})));
  }
  makeDust(){const count=1500,a=new Float32Array(count*3);for(let i=0;i<count;i++){a[i*3]=(Math.random()-.5)*450;a[i*3+1]=Math.random()*24-3;a[i*3+2]=(Math.random()-.5)*450;}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(a,3));this.dust=new THREE.Points(geo,new THREE.PointsMaterial({color:0x7bc9b1,size:.12,transparent:true,opacity:.35,depthWrite:false,blending:THREE.AdditiveBlending}));this.scene.add(this.dust);}
  pointMaterial(){return new THREE.ShaderMaterial({vertexColors:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{uPixel:{value:Math.min(devicePixelRatio,1.7)}},vertexShader:`attribute float aSize;varying vec3 vColor;uniform float uPixel;void main(){vColor=color;vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=clamp(aSize*480.*uPixel/-p.z,1.,70.);}`,fragmentShader:`varying vec3 vColor;void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;float a=pow(1.-d,2.5);gl_FragColor=vec4(vColor*(.65+pow(1.-d,8.)*1.8),a);}`});}
  makeFood(){this.foodGeometry=new THREE.BufferGeometry();this.foodGeometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(1500),3));this.foodGeometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(1500),3));this.foodGeometry.setAttribute('aSize',new THREE.Float32BufferAttribute(new Float32Array(500),1));this.foodPoints=new THREE.Points(this.foodGeometry,this.pointMaterial());this.foodPoints.frustumCulled=false;this.scene.add(this.foodPoints);}
  makeLandmarks(){
    this.landmarks=new THREE.Group();const geo=new THREE.ConeGeometry(.7,4,5),mat=new THREE.MeshStandardMaterial({color:0x174f4c,emissive:0x082e2a,roughness:.55,transparent:true,opacity:.5});
    for(let i=0;i<65;i++){const a=i*2.399,r=30+Math.sqrt(i/65)*145;const cluster=new THREE.Group();cluster.position.set(Math.cos(a)*r,-3.5,Math.sin(a)*r);for(let j=0;j<3;j++){const m=new THREE.Mesh(geo,mat);m.position.set(Math.sin(j*3)*1.2,1,Math.cos(j*3)*1.2);m.scale.setScalar(.5+((i+j)%4)*.4);m.rotation.z=(j-1)*.3;cluster.add(m);}this.landmarks.add(cluster);}this.scene.add(this.landmarks);
  }
  updateEnvironment(game,dt,t){
    const id=game.biome.id,settings=id==='tide'?[[.012,.044,.10],[.025,.09,.17]]:id==='crystal'?[[.055,.027,.075],[.12,.052,.16]]:[[.014,.067,.084],[.021,.12,.131]];
    const bg=new THREE.Color(game.biome.background);this.scene.background.lerp(bg,Math.min(1,dt*2));this.scene.fog.color.copy(this.scene.background);
    this.floorMaterial.uniforms.uDeep.value.lerp(new THREE.Color(...settings[0]),Math.min(1,dt*2));this.floorMaterial.uniforms.uShallow.value.lerp(new THREE.Color(...settings[1]),Math.min(1,dt*2));this.floorMaterial.uniforms.uFlow.value=id==='tide'?1:0;
    this.currents.visible=id==='tide';if(this.currents.visible){const p=this.currents.geometry.attributes.position;let index=0;
      for(let x=-4;x<=4;x++)for(let z=-4;z<=4;z++){const px=x*32,pz=z*32,v=game.currentAt(px,pz),a=Math.atan2(v.z,v.x),len=3.2+Math.sin(t+z)*.4,ex=px+Math.cos(a)*len,ez=pz+Math.sin(a)*len;for(const q of [[px,pz],[ex,ez],[ex,ez],[ex-Math.cos(a-.65),ez-Math.sin(a-.65)],[ex,ez],[ex-Math.cos(a+.65),ez-Math.sin(a+.65)]])p.setXYZ(index++,q[0],-2.8,q[1]);}
      this.currents.geometry.setDrawRange(0,index);p.needsUpdate=true;
    }
    const ids=new Set();for(const h of game.hazards){ids.add(h.id);let g=this.hazardMeshes.get(h.id);if(!g){g=new THREE.Group();const mat=new THREE.MeshStandardMaterial({color:0x9c80be,emissive:0x623b8d,emissiveIntensity:.6,metalness:.35,roughness:.2});for(let j=0;j<4;j++){const m=new THREE.Mesh(this.spikeGeo,mat);m.position.set(Math.sin(j*2)*1.2,-1+((j+1)%3)*.5,Math.cos(j*2)*1.2);m.scale.set(1.1,4+j*.4,1.1);m.rotation.z=(j-1.5)*.15;g.add(m);}const ring=new THREE.Mesh(this.hazardRingGeo,new THREE.MeshBasicMaterial({color:0xce9fff,transparent:true,opacity:.12,side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.scale.setScalar(h.radius);ring.position.y=-2;g.add(ring);g.userData={ring,mat};this.hazardMeshes.set(h.id,g);this.scene.add(g);}
      g.position.set(h.x,0,h.z);g.userData.ring.material.opacity=h.state==='idle'?.08:h.state==='warning'?.15+h.strength*.3:.65;g.userData.ring.scale.setScalar(h.radius*(h.state==='pulse'?1+Math.sin(t*15)*.04:1));g.userData.mat.emissiveIntensity=.4+h.strength*1.5;
    }
    for(const [id,g]of this.hazardMeshes)if(!ids.has(id)){this.scene.remove(g);g.userData.mat.dispose();g.userData.ring.material.dispose();this.hazardMeshes.delete(id);}
    const boss=game.creatures.find(c=>c.boss);this.bossArrow.visible=!!boss&&['warning','charge'].includes(boss.state);if(this.bossArrow.visible){this.bossArrow.position.set(boss.x,1,boss.z);this.bossArrow.setDirection(new THREE.Vector3(Math.cos(boss.aim||0),0,Math.sin(boss.aim||0)));}
  }
  burst(x,z,color=0xa1ffcb,count=12){const col=new THREE.Color(color);for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,v=1+Math.random()*4;this.particles.push({x,y:.5,z,vx:Math.cos(a)*v,vz:Math.sin(a)*v,vy:Math.random()*2,life:1,max:1,color:col});}if(this.particles.length>290)this.particles.splice(0,this.particles.length-290);}
  ripple(x,z,r=1,color=0xb8ffda){const m=new THREE.Mesh(this.torus,new THREE.MeshBasicMaterial({color,transparent:true,opacity:.7,depthWrite:false}));m.rotation.x=Math.PI/2;m.position.set(x,.3,z);this.scene.add(m);this.ripples.push({mesh:m,life:1,r});}
  pointToWorld(x,y){this.raycaster.setFromCamera(new THREE.Vector2(x/innerWidth*2-1,-y/innerHeight*2+1),this.camera);return this.raycaster.ray.intersectPlane(this.plane,this.pointer);}
  update(game,dt,t){
    this.time.value=t;this.beat.value*=Math.exp(-dt*7);const home=game.status==='home',p=game.player;
    this.updateEnvironment(game,dt,t);
    const desired=new THREE.Vector3(home?-11:p.x,0,home?0:p.z);this.target.lerp(desired,1-Math.exp(-dt*(home?2:5)));
    const distance=home?(innerWidth<600?39:36):25+p.radius*3.8;
    const cam=new THREE.Vector3(this.target.x,this.target.y+distance,this.target.z+distance*.66);this.camera.position.lerp(cam,1-Math.exp(-dt*3));this.shake=Math.max(0,this.shake-dt);if(this.shake>0&&!this.reducedMotion){this.camera.position.x+=Math.sin(t*65)*this.shake*.8;this.camera.position.z+=Math.cos(t*71)*this.shake*.8;}this.camera.lookAt(this.target);
    const r=home?(innerWidth<600?3:3.7):p.radius;
    this.hero.position.set(home?2:p.x,r*.25+Math.sin(t*1.6)*.1,home?-1:p.z);this.hero.scale.setScalar(r);if(home)this.hero.rotation.y=t*.12;else if(Math.hypot(p.vx,p.vz)>1){const heading=Math.atan2(p.vx,p.vz),diff=Math.atan2(Math.sin(heading-this.hero.rotation.y),Math.cos(heading-this.hero.rotation.y));this.hero.rotation.y+=diff*Math.min(1,dt*4);}
    const heroData=this.hero.userData;heroData.core.rotation.y=t*.4;heroData.ring.rotation.z=t*.13;
    this.materials.player.uniforms.uColor.value.set(game.traits.includes('electric')?'#9ed9f8':game.traits.includes('shell')?'#d0edc3':game.stage>=4?'#e0eeb1':'#a3f6cc');
    heroData.ring.visible=home||game.traits.includes('shell')||game.abilityTime>0;heroData.ring.scale.setScalar(game.abilityTime>0?1.8:1.15);
    heroData.tails.visible=home||game.stage>=1;heroData.tails.rotation.y=Math.sin(t*.7)*.1;
    heroData.tails.scale.setScalar(game.traits.includes('magnet')?1.4:1);heroData.shell.scale.set(1+game.stage*.035,.8+game.stage*.025,1+game.stage*.035);
    for(const [id,mesh]of Object.entries(this.anatomy))mesh.visible=!home&&game.traits.includes(id);
    this.anatomy.speed.visible=!home&&(game.traits.includes('speed')||game.stage>=2);this.anatomy.speed.scale.setScalar(game.traits.includes('speed')?1.2:.7);this.anatomy.speed.children.forEach((m,i)=>m.rotation.x=Math.sin(t*4+i)*.15);
    this.anatomy.electric.rotation.y=t*.7;this.anatomy.harmony.rotation.y=-t*.8;this.anatomy.mouth.scale.setScalar(1+Math.sin(t*3)*.1);
    this.hero.visible=game.invincible<=0||Math.floor(t*10)%2===0||home;
    const ids=new Set();for(const c of game.creatures){ids.add(c.id);let g=this.entities.get(c.id);const type=c.boss?'boss':game.canEat(c)?'edible':game.isDangerous(c)?'danger':'equal';
      if(!g){g=this.makeCell(type,c.boss,c.kind);this.entities.set(c.id,g);this.scene.add(g);}
      if(g.userData.type!==type){g.userData.type=type;g.userData.shell.material=this.materials[type];g.children[0].material=this.glowMat(type);g.userData.ring.material.color.copy(this.materials[type].uniforms.uColor.value);}
      const x=home?c.x*.65+5:c.x,z=home?c.z*.65:c.z;
      g.position.set(x,c.radius*.2+Math.sin(t+c.phase)*.3,z);g.scale.set(c.radius*(1+Math.sin(t*1.4+c.phase)*.03),c.radius*(c.kind===2?1.12:.85),c.radius*(c.kind===1?1.23:1));g.rotation.y=c.angle+Math.sin(t*.4+c.phase)*.1;
      g.userData.core.rotation.y=t*.2+c.phase;g.userData.ring.rotation.z=t*.08+c.phase;g.userData.ring.visible=c.boss||c.stun>0||c.kind===3;if(c.boss){g.userData.ring.material.color.set(game.canEat(c)?0xa4ffd0:c.state==='warning'||c.state==='charge'?0xffaa83:0xeac590);g.userData.ring.material.opacity=c.state==='warning'?.4+Math.sin(t*12)*.2:.4;g.userData.ring.scale.setScalar(c.state==='exposed'?1.4:1.15);}
      g.userData.shell.material.uniforms.uTime=this.time;
      if(home&&Math.hypot(x-2,z+1)<9)g.visible=false;else g.visible=true;
    }
    for(const [id,g]of this.entities)if(!ids.has(id)){this.scene.remove(g);this.entities.delete(id);this.disposeCell(g);}
    const pos=this.foodGeometry.attributes.position,col=this.foodGeometry.attributes.color,size=this.foodGeometry.attributes.aSize,colors=[[.5,1,.72],[.74,1,.75],[.43,.84,1],[1,.8,.45]];
    let i=0;for(const f of game.food.slice(0,500)){pos.setXYZ(i,f.x,.3+Math.sin(t+f.id)*.25,f.z);const c=colors[f.hue];col.setXYZ(i,...c);size.setX(i,(f.value===3?1.4:.85)*(1+Math.sin(t*2+f.id)*.15));i++;}
    this.foodGeometry.setDrawRange(0,i);pos.needsUpdate=col.needsUpdate=size.needsUpdate=true;
    if(!home&&Math.hypot(p.vx,p.vz)>2&&Math.random()<.65){this.particles.push({x:p.x,y:.3,z:p.z,vx:0,vz:0,vy:0,life:.8,max:.8,color:new THREE.Color(0x75e5bd)});}
    const tp=this.trailGeometry.attributes.position,tc=this.trailGeometry.attributes.color,ts=this.trailGeometry.attributes.aSize;
    this.particles=this.particles.filter(q=>q.life>0).slice(-300);i=0;for(const q of this.particles){q.life-=dt;q.x+=q.vx*dt;q.z+=q.vz*dt;q.y+=q.vy*dt;tp.setXYZ(i,q.x,q.y,q.z);tc.setXYZ(i,q.color.r,q.color.g,q.color.b);ts.setX(i,Math.max(0,q.life/q.max)*.8);i++;}this.trailGeometry.setDrawRange(0,i);tp.needsUpdate=tc.needsUpdate=ts.needsUpdate=true;
    this.ripples=this.ripples.filter(q=>{q.life-=dt*.9;if(q.life<=0){this.scene.remove(q.mesh);q.mesh.material.dispose();return false;}q.mesh.scale.setScalar(q.r+(1-q.life)*q.r*4);q.mesh.material.opacity=q.life*.6;return true;});
    this.dust.rotation.y=Math.sin(t*.008)*.04;this.renderer.render(this.scene,this.camera);
  }
  disposeCell(g){g.traverse(o=>{if(o.isMesh&&o.material&&!Object.values(this.materials).includes(o.material))o.material.dispose();});}
}
