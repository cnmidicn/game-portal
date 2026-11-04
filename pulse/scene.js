import * as T from '../symphony/vendor/three.module.js';
import {BEAT} from './game.js';
const colors=[0x86ffe0,0xb59aff,0xffce95];
export class Stage {
  constructor(canvas,game){
    this.game=game;this.canvas=canvas;this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
    this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.1;
    this.scene=new T.Scene();this.scene.background=new T.Color(0x050914);this.scene.fog=new T.FogExp2(0x050914,.011);
    this.camera=new T.PerspectiveCamera(45,1,.1,220);
    this.scene.add(new T.HemisphereLight(0x9ab5ff,0x131530,2.1));
    const light=new T.DirectionalLight(0xc4faff,3);light.position.set(-4,15,8);this.scene.add(light);
    const violet=new T.PointLight(0x9466ff,100,40);violet.position.set(0,7,-9);this.scene.add(violet);
    this.pulseLight=new T.PointLight(0x89ffe3,15,30);this.pulseLight.position.set(0,5,5);this.scene.add(this.pulseLight);
    this.glowTexture=this.makeGlow();this.effects=[];this.brickMeshes=new Map();this.ballMeshes=[];this.trails=[];this.clock=0;this.audioEnergy=0;this.shake=0;
    this.buildSpace();this.buildTable();this.buildImmersion();this.buildBloom();
    this.ray=new T.Raycaster();this.plane=new T.Plane(new T.Vector3(0,1,0),-.55);this.point=new T.Vector3();
    this.resize();this.resizeHandler=()=>this.resize();window.addEventListener('resize',this.resizeHandler);
  }
  makeGlow(){const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d'),g=x.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.1,'rgba(255,255,255,.6)');g.addColorStop(.4,'rgba(255,255,255,.12)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,128,128);return new T.CanvasTexture(c);}
  glow(color,size,opacity=.5){const m=new T.SpriteMaterial({map:this.glowTexture,color,transparent:true,opacity,blending:T.AdditiveBlending,depthWrite:false});const s=new T.Sprite(m);s.scale.set(size,size,1);return s;}
  mesh(geo,color,emissive=0,intensity=0){return new T.Mesh(geo,new T.MeshStandardMaterial({color,metalness:.65,roughness:.25,emissive,emissiveIntensity:intensity}));}
  line(points,color,opacity=.7){const g=new T.BufferGeometry().setFromPoints(points.map(p=>new T.Vector3(...p)));return new T.Line(g,new T.LineBasicMaterial({color,transparent:true,opacity}));}
  ring(radius,color){const m=new T.Mesh(new T.TorusGeometry(radius,.018,6,160),new T.MeshBasicMaterial({color,transparent:true,opacity:.55,blending:T.AdditiveBlending,depthWrite:false}));return m;}
  buildSpace(){
    const sky=new T.Mesh(new T.SphereGeometry(115,24,16),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{},vertexShader:'varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:`
      varying vec3 direction;
      float hash(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
      float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
      float fbm(vec3 p){float v=0.0,a=.5;for(int i=0;i<4;i++){v+=noise(p)*a;p=p*2.03+3.1;a*=.5;}return v;}
      void main(){vec3 d=normalize(direction);float n=fbm(d*4.0+1.7);float wisps=pow(fbm(d*8.0+vec3(n*3.0)),3.0);float band=exp(-pow((d.x*.45+d.y*.75+.1)*2.5,2.0));vec3 purple=vec3(.12,.045,.24);vec3 teal=vec3(.015,.15,.19);vec3 color=vec3(.003,.006,.016)+mix(purple,teal,smoothstep(-.4,.5,d.x))*wisps*band*.95;gl_FragColor=vec4(color,1.0);
      #include <colorspace_fragment>
      }`}));this.scene.add(sky);
    const positions=[],sizes=1500;
    for(let i=0;i<sizes;i++)positions.push((Math.random()-.5)*150,(Math.random()-.25)*70,-15-Math.random()*90);
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));
    this.stars=new T.Points(geo,new T.PointsMaterial({color:0xbacfee,size:.13,transparent:true,opacity:.9,depthWrite:false}));this.scene.add(this.stars);
    this.nebula=[];
    for(const [x,y,z,size,color] of [[-18,2,-47,80,0x35246d],[19,7,-55,75,0x16506b],[1,15,-65,70,0x334466],[-6,-2,-30,40,0x22215a]]){const s=this.glow(color,size,.45);s.position.set(x,y,z);this.scene.add(s);this.nebula.push(s);}
    this.planet=new T.Group();this.planet.position.set(19,-14,-37);
    const orb=this.mesh(new T.SphereGeometry(7,48,32),0x10172d,0x151d39,.4);this.planet.add(orb);
    const halo=this.glow(0x6686e6,22,.6);halo.position.z=-1;this.planet.add(halo);
    const ring=this.ring(10.8,0x9e96dd);ring.rotation.x=1.22;ring.rotation.y=.22;this.planet.add(ring);
    const ring2=this.ring(11.2,0x6373b2);ring2.rotation.copy(ring.rotation);this.planet.add(ring2);this.scene.add(this.planet);
    this.orbits=[];
    for(let i=0;i<3;i++){const r=this.ring(18+i*2.7,i===1?0x806ab4:0x437583);r.rotation.x=-Math.PI/2;r.position.set(0,-2-i*.45,-2);r.material.opacity=.16;this.scene.add(r);this.orbits.push(r);}
  }
  buildTable(){
    this.table=new T.Group();this.scene.add(this.table);
    const base=this.mesh(new T.BoxGeometry(17,.65,24.4),0x0b1427,0x0d2035,.5);base.position.set(0,-.7,-.5);this.table.add(base);
    const under=this.mesh(new T.BoxGeometry(16.65,.23,24.1),0x172437,0x346b7b,.7);under.position.set(0,-1.18,-.5);this.table.add(under);
    const surface=new T.Mesh(new T.PlaneGeometry(16,23),new T.MeshStandardMaterial({color:0x0c1a2b,metalness:.75,roughness:.28,transparent:true,opacity:.92}));surface.rotation.x=-Math.PI/2;surface.position.z=-.5;surface.position.y=-.34;this.table.add(surface);
    // The luminous playfield is framed in world space, not painted over the canvas.
    for(let i=0;i<=16;i++)this.table.add(this.line([[i-8,-.32,11],[i-8,-.32,-12]],0x5b8caa,i%4===0?.16:.06));
    for(let i=0;i<=23;i++)this.table.add(this.line([[-8,-.32,11-i],[8,-.32,11-i]],0x5b8caa,i%4===0?.16:.06));
    const edge=[[-8,.12,11],[-8,.12,-12],[8,.12,-12],[8,.12,11]];
    this.table.add(this.line(edge,0x86ffe0,.85));
    this.table.add(this.line([[-8.35,-.7,11.5],[-8.35,-.7,-12.5],[8.35,-.7,-12.5],[8.35,-.7,11.5]],0x8d76c9,.65));
    for(const side of [-1,1]){
      const rail=this.mesh(new T.BoxGeometry(.16,.5,23),0x254353,0x508b9b,.6);rail.position.set(side*8,-.05,-.5);this.table.add(rail);
      for(let i=0;i<12;i++){const dot=this.mesh(new T.BoxGeometry(.08,.055,.45),0xb9ffea,0x7effe0,2.5);dot.position.set(side*8.02,.23,10-i*1.9);this.table.add(dot);}
    }
    this.table.add(this.line([[-7.7,-.25,10.3],[7.7,-.25,10.3]],0xcb759c,.3));
    this.centerRing=this.ring(3.15,0x6f9eb3);this.centerRing.rotation.x=-Math.PI/2;this.centerRing.position.set(0,-.29,3);this.centerRing.material.opacity=.15;this.table.add(this.centerRing);
    const inner=this.ring(2.8,0x6f9eb3);inner.rotation.x=-Math.PI/2;inner.position.set(0,-.29,3);inner.material.opacity=.08;this.table.add(inner);
    this.paddle=new T.Group();
    const body=this.mesh(new T.CapsuleGeometry(.18,2.7,6,18),0xd5fff1,0x6df4d1,1.4);body.rotation.z=Math.PI/2;this.paddle.add(body);
    const paddleGlow=this.glow(0x63ffdb,5,.55);paddleGlow.position.y=.12;this.paddle.add(paddleGlow);
    this.paddle.position.set(0,.45,9.4);this.table.add(this.paddle);
    this.energyBars=[];
    for(let side of [-1,1])for(let i=0;i<24;i++){
      const bar=this.mesh(new T.BoxGeometry(.13,.1,.5),0x5adbc7,0x4cbaa9,1);bar.position.set(side*9.3,-.7,10-i*.93);this.scene.add(bar);this.energyBars.push({bar,i,side});
    }
    this.syncBricks();
  }
  buildImmersion(){
    const grid=new T.GridHelper(180,90,0x5768b4,0x1b4562);grid.position.set(0,-3,-32);grid.material.transparent=true;grid.material.opacity=.32;this.scene.add(grid);
    this.arches=[];
    for(let i=0;i<8;i++){
      const z=-13-i*8,points=[[-17,-2,z],[-17,5,z],[-11,12,z],[0,15,z],[11,12,z],[17,5,z],[17,-2,z]];
      const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)),false,'centripetal');
      const arch=new T.Mesh(new T.TubeGeometry(curve,32,.045,5,false),new T.MeshBasicMaterial({color:i%2?0xe278f5:0x51dfee,transparent:true,opacity:.6,blending:T.AdditiveBlending}));
      this.scene.add(arch);this.arches.push(arch);
    }
    this.portal=new T.Group();this.portal.position.set(0,1,-24);
    this.portalRings=[];
    for(let i=0;i<4;i++){
      const ring=new T.Mesh(new T.TorusGeometry(5.5+i*.65,.035+i*.008,6,128),new T.MeshBasicMaterial({color:i%2?0xc28aff:0x74eaff,transparent:true,opacity:.65,blending:T.AdditiveBlending}));
      ring.rotation.z=i*.4;this.portal.add(ring);this.portalRings.push(ring);
    }
    const portalGlow=this.glow(0x5850d9,28,.9);portalGlow.position.z=-.2;this.portal.add(portalGlow);
    this.portalCore=new T.Mesh(new T.IcosahedronGeometry(2,1),new T.MeshBasicMaterial({color:0x87e7f7,wireframe:true,transparent:true,opacity:.5}));this.portal.add(this.portalCore);
    for(let i=0;i<32;i++){
      const a=i/32*Math.PI*2,r=6.1;const tick=new T.Mesh(new T.BoxGeometry(.05,.38,.06),new T.MeshBasicMaterial({color:i%4===0?0xf5b6ff:0x77dcff,transparent:true,opacity:.65}));tick.position.set(Math.cos(a)*r,Math.sin(a)*r,0);tick.rotation.z=a-Math.PI/2;this.portal.add(tick);
    }
    this.scene.add(this.portal);
    this.towers=[];
    const towerGeo=new T.BoxGeometry(.5,1,.55);
    for(const side of [-1,1])for(let i=0;i<28;i++){
      const height=1.5+((i*17)%11)*.6;
      const tower=this.mesh(towerGeo,0x182b43,i%3?0x268aac:0x9455ad,.8);tower.position.set(side*(12+(i%3)*2.5),-2+height/2,13-i*2.2);tower.scale.y=height;this.scene.add(tower);
      const top=this.glow(i%3?0x50d9f5:0xd889ff,2,.3);top.position.set(tower.position.x,-2+height,tower.position.z);this.scene.add(top);this.towers.push({tower,top,height,i});
    }
    this.beatStrips=[];
    for(let i=0;i<4;i++){const line=this.line([[-7.85,-.24,0],[7.85,-.24,0]],0x78f7ed,.3);this.table.add(line);this.beatStrips.push(line);}
    this.paddleRing=this.ring(1.2,0x86ffe0);this.paddleRing.rotation.x=-Math.PI/2;this.paddleRing.position.set(0,.02,9.3);this.table.add(this.paddleRing);
    this.shield=this.line([[-7.9,.15,11],[7.9,.15,11]],0xffb8ed,.85);this.table.add(this.shield);
    this.bumperMeshes=[];
    for(let i=0;i<2;i++){
      const group=new T.Group(),color=i?0xff91d7:0x7fdaff;
      const ring=new T.Mesh(new T.TorusGeometry(.61,.1,10,40),new T.MeshStandardMaterial({color,emissive:color,emissiveIntensity:1.7,metalness:.7,roughness:.2}));ring.rotation.x=-Math.PI/2;group.add(ring);
      const core=this.mesh(new T.OctahedronGeometry(.4),0x192d46,color,.65);group.add(core);group.add(this.glow(color,3,.4));this.table.add(group);this.bumperMeshes.push(group);
    }
    this.shotMeshes=[];this.pickupMeshes=[];
    this.speedLines=[];
    for(let i=0;i<30;i++){
      const x=(i%2?-1:1)*(10+(i%7)*2.3),y=-1+(i%5)*2.5;
      const line=this.line([[x,y,0],[x,y,-3-(i%4)]],i%3?0x69d4f0:0xdd8dff,.2);line.position.z=-80+i*3;this.scene.add(line);this.speedLines.push(line);
    }
  }
  syncBricks(){
    for(const mesh of this.brickMeshes.values()){this.table.remove(mesh);mesh.traverse(n=>{if(n.geometry&&!n.isSprite&&![this.brickGeometry,this.capGeometry,this.edgeGeometry].includes(n.geometry))n.geometry.dispose();if(n.material)n.material.dispose();});}
    this.brickMeshes.clear();
    this.brickGeometry??=new T.OctahedronGeometry(.82);
    this.capGeometry??=new T.IcosahedronGeometry(.29,0);
    this.edgeGeometry??=new T.EdgesGeometry(this.brickGeometry);
    for(const b of this.game.bricks){
      const group=new T.Group(),c=colors[b.kind];group.position.set(b.x,.65,11-b.y);
      const block=this.mesh(this.brickGeometry,c,c,.65);block.material.transparent=true;block.material.opacity=.48;block.material.roughness=.12;block.scale.set(1,.8,.7);group.add(block);
      const cap=this.mesh(this.capGeometry,0xeaffff,c,2.1);cap.position.y=.05;group.add(cap);
      // Corner rails and a recessed center give the crystals a sculpted silhouette.
      const outline=new T.LineSegments(this.edgeGeometry,new T.LineBasicMaterial({color:c,transparent:true,opacity:.7}));group.add(outline);
      const light=this.glow(c,2.8,.16);light.position.y=.2;group.add(light);
      if(b.boss){group.scale.set(1.9,1.9,1.2);const shield=this.ring(1.1,0xe783ff);shield.rotation.x=-Math.PI/2;group.add(shield);group.userData.shield=shield;}
      Object.assign(group.userData,{brick:b,block,cap,flash:0});this.table.add(group);this.brickMeshes.set(b.id,group);
    }
  }
  buildBloom(){
    // A restrained, single-pass glow keeps geometry legible at mobile resolutions.
    this.target=new T.WebGLRenderTarget(1,1,{depthBuffer:true});
    this.postScene=new T.Scene();this.postCamera=new T.OrthographicCamera(-1,1,1,-1,0,1);
    this.postMaterial=new T.ShaderMaterial({uniforms:{image:{value:this.target.texture},resolution:{value:new T.Vector2(1,1)},strength:{value:.65},aberration:{value:0}},vertexShader:'varying vec2 uvp; void main(){uvp=uv;gl_Position=vec4(position,1.0);}',fragmentShader:`
      uniform sampler2D image; uniform vec2 resolution; uniform float strength; uniform float aberration; varying vec2 uvp;
      void main(){vec3 base=texture2D(image,uvp).rgb;vec2 chroma=(uvp-.5)*aberration/resolution; base.r=texture2D(image,uvp+chroma).r;base.b=texture2D(image,uvp-chroma).b;vec3 bloom=vec3(0.0);
      for(int x=-2;x<=2;x++){for(int y=-2;y<=2;y++){vec2 offset=vec2(float(x),float(y))*3.0/resolution;vec3 c=texture2D(image,uvp+offset).rgb;float brightness=max(c.r,max(c.g,c.b));bloom+=c*smoothstep(.55,1.0,brightness)/25.0;}}
      vec3 result=base+bloom*strength;float v=1.0-.25*length((uvp-.5)*1.3);gl_FragColor=vec4(result*v,1.0);
      #include <colorspace_fragment>
      }`,depthTest:false,depthWrite:false});
    this.postScene.add(new T.Mesh(new T.PlaneGeometry(2,2),this.postMaterial));
  }
  resize(){
    const w=innerWidth,h=innerHeight;this.renderer.setSize(w,h);this.camera.aspect=w/h;
    const mobile=w/h<.8;
    this.camera.fov=mobile?53:44;
    const factor=mobile?Math.max(1,.46/(w/h)):1;
    this.camera.position.set(0,mobile?44*factor:27,mobile?16*factor:25);this.camera.lookAt(0,0,-1);this.camera.updateProjectionMatrix();
    const px=this.renderer.getPixelRatio();this.target?.setSize(Math.round(w*px),Math.round(h*px));this.postMaterial?.uniforms.resolution.value.set(w*px,h*px);
  }
  pointer(clientX,clientY){
    const r=this.canvas.getBoundingClientRect();this.ray.setFromCamera(new T.Vector2((clientX-r.left)/r.width*2-1,-(clientY-r.top)/r.height*2+1),this.camera);
    if(this.ray.ray.intersectPlane(this.plane,this.point))return this.point.x;
    return this.game.target;
  }
  burst(x,y,color,amount=14){
    const positions=[],vel=[];
    for(let i=0;i<amount;i++){positions.push(x,.7,11-y);vel.push((Math.random()-.5)*7,Math.random()*5+1,(Math.random()-.5)*7);}
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
    const obj=new T.Points(geometry,new T.PointsMaterial({map:this.glowTexture,color,size:.32,transparent:true,opacity:1,depthWrite:false,blending:T.AdditiveBlending}));
    this.scene.add(obj);this.effects.push({obj,vel,life:.85,max:.85,type:'particles'});
    const ring=this.ring(.4,color);ring.rotation.x=-Math.PI/2;ring.position.set(x,.3,11-y);ring.material.opacity=.9;this.scene.add(ring);this.effects.push({obj:ring,life:.65,max:.65,type:'ring'});
  }
  event(e){
    if(e.type==='level')this.syncBricks();
    if(e.type==='hit'){
      const m=this.brickMeshes.get(e.id);
      if(m){m.userData.flash=1;if(e.broken)m.visible=false;}
      this.burst(e.x,e.y,colors[e.kind],e.broken?28:7);this.pulseLight.intensity=60;this.shake=Math.max(this.shake,e.broken?.045:.015);
    }
    if(e.type==='paddle'){this.burst(e.x,e.y,e.perfect?0xffe1a7:0x9cffe0,e.perfect?18:5);}
    if(e.type==='chain'){
      const line=this.line([[e.x,.9,11-e.y],[(e.x+e.toX)/2+.3,1.4,11-(e.y+e.toY)/2],[e.toX,.9,11-e.toY]],0xc9afff,1);
      this.scene.add(line);this.effects.push({obj:line,life:.3,max:.3,type:'line'});
    }
    if(e.type==='clear')for(let i=0;i<5;i++)this.burst((Math.random()-.5)*12,8+Math.random()*12,colors[i%3],25);
    if(e.type==='rhythm'&&e.good){this.burst(e.x,e.y,0x8ffff4,18);this.pulseLight.intensity=85;this.shake=.06;}
    if(['drive','phrase'].includes(e.type)){for(let i=0;i<6;i++)this.burst((i-2.5)*2.5,12,0xe9b8ff,20);this.shake=.12;}
    if(['bumper','pickup','shield','save'].includes(e.type))this.burst(e.x,e.y,e.type==='shield'?0xff9bdc:0x9dedff,16);
  }
  update(dt){
    this.clock+=dt;const g=this.game,t=this.clock,playing=g.status!=='menu';
    const introOffset=innerWidth>900&&!playing?-3.8:g.paddle*.025;
    this.shake*=Math.exp(-dt*12);const tremor=this.reduced?0:this.shake;
    this.camera.lookAt(introOffset+Math.sin(t*80)*tremor,Math.cos(t*67)*tremor,-1);this.camera.updateMatrixWorld();
    if(!this.reduced){this.stars.rotation.y=Math.sin(t*.025)*.025;this.planet.rotation.y=t*.015;}
    const musicTime=playing||g.previewAudio?g.beatTime():t,phase=(musicTime%BEAT)/BEAT;
    const pulse=playing?Math.pow(1-phase,3):.3+Math.sin(t*1.6)*.1;
    const drive=g.driveLeft>0,energy=Math.max(pulse*.3,this.audioEnergy);
    const theme=[[0x45b9dd,0xb568ee],[0x6ce6b8,0xe9a264],[0x7476f1,0xd64a94]][(g.level-1)%3];
    for(let i=0;i<this.arches.length;i++){const a=this.arches[i];a.material.opacity=.15+Math.pow(.5+.5*Math.cos(i*.6-musicTime/BEAT),4)*(.4+energy*.5);a.material.color.setHex(drive?(i%2?0xff75d7:0xbffff2):theme[i%2]);}
    for(let i=0;i<this.portalRings.length;i++){const r=this.portalRings[i];r.rotation.z=(this.reduced?0:t*.07)*(i%2?-1:1);r.rotation.y=Math.sin(t*.2+i)*.15;r.scale.setScalar(1+pulse*.025);r.material.opacity=.4+energy*.5;}
    this.portalCore.rotation.y=this.reduced?0:t*.22;this.portalCore.rotation.z=this.reduced?0:t*.1;this.portalCore.scale.setScalar(1+(this.reduced?0:pulse*.18));
    for(const {tower,top,height,i} of this.towers){tower.scale.y=height*(.65+energy*(.3+.35*Math.sin(i*.8+t)));top.position.y=-2+tower.scale.y;tower.position.y=-2+tower.scale.y/2;top.material.opacity=.15+energy*.4;}
    for(let i=0;i<this.speedLines.length;i++){const line=this.speedLines[i];if(!this.reduced)line.position.z+=dt*(drive?32:9);if(line.position.z>20)line.position.z=-80;line.material.opacity=drive?.55:.18;}
    for(let i=0;i<this.beatStrips.length;i++){const s=this.beatStrips[i];s.position.z=-12+((musicTime/BEAT+i)%4)/4*23;s.material.opacity=.08+pulse*.17;}
    this.paddleRing.position.x=g.paddle;this.paddleRing.scale.setScalar(.7+(1-phase)*1.1);this.paddleRing.material.opacity=.1+pulse*.6;
    this.shield.visible=g.shields>0;this.shield.material.opacity=.45+pulse*.3;
    for(let i=0;i<this.bumperMeshes.length;i++){const m=this.bumperMeshes[i],b=g.bumpers[i];m.position.set(b.x,.5,11-b.y);m.children[1].rotation.y=t*.8;m.children[1].rotation.z=t*.4;m.children[0].material.emissiveIntensity=1.3+energy;}
    this.syncObjects(g.shots,this.shotMeshes,'shot');this.syncObjects(g.pickups,this.pickupMeshes,'pickup');
    this.pulseLight.intensity+=(12+pulse*12-this.pulseLight.intensity)*Math.min(1,dt*5);
    this.paddle.position.x=g.paddle;this.paddle.scale.x=g.width/3.1;
    this.paddle.children[0].material.emissiveIntensity=1.1+pulse*.6;
    for(const {bar,i,side} of this.energyBars){const height=.08+(.5+.5*Math.sin(i*.7+t*(this.reduced?0:2.4)+side))*(.2+energy*1.1+(drive?.7:0));bar.scale.y=height*6;bar.material.emissiveIntensity=.7+pulse;}
    for(const m of this.brickMeshes.values()){
      const u=m.userData;if(!m.visible)continue;
      u.flash=Math.max(0,u.flash-dt*4);u.cap.material.emissiveIntensity=1+u.flash*2+pulse*.25;
      m.position.x=u.brick.x;m.position.z=11-u.brick.y;u.block.rotation.y=Math.sin(t*.4+u.brick.id)*.25;u.cap.rotation.y=t*.5;
      if(u.shield){u.shield.visible=!u.brick.open;u.shield.rotation.z=t;u.block.material.opacity=u.brick.open?.7:.35;}
      m.position.y=.65+(this.reduced?0:Math.sin(t*1.3+u.brick.x*.3+u.brick.y*.2)*.055);
      u.block.material.emissiveIntensity=.35+(u.brick.hp-1)*.3;
    }
    const ballData=g.balls.length?g.balls:(['menu','ready'].includes(g.status)?[{x:g.paddle,y:2.35}]:[]);
    while(this.ballMeshes.length<ballData.length){
      const group=new T.Group();const orb=new T.Mesh(new T.SphereGeometry(.27,20,16),new T.MeshBasicMaterial({color:0xeafffa}));group.add(orb);group.add(this.glow(0x95ffe5,2.3,.65));this.table.add(group);this.ballMeshes.push(group);
    }
    for(let i=0;i<this.ballMeshes.length;i++){
      const m=this.ballMeshes[i],b=ballData[i];m.visible=Boolean(b);if(!b)continue;m.position.set(b.x,.65,11-b.y);
      if(g.status==='playing'&&!this.reduced){const trail=this.glow(0x87ffe0,.75,.4);trail.position.copy(m.position);this.scene.add(trail);this.trails.push({obj:trail,life:.24,max:.24});}
    }
    for(let i=this.effects.length-1;i>=0;i--){const e=this.effects[i];e.life-=dt;
      if(e.life<=0){this.scene.remove(e.obj);e.obj.geometry.dispose();e.obj.material.dispose();this.effects.splice(i,1);continue;}
      e.obj.material.opacity=e.life/e.max*.7;
      if(e.type==='particles'){const p=e.obj.geometry.attributes.position;for(let j=0;j<p.count;j++){e.vel[j*3+1]-=dt*6;p.array[j*3]+=e.vel[j*3]*dt;p.array[j*3+1]+=e.vel[j*3+1]*dt;p.array[j*3+2]+=e.vel[j*3+2]*dt;}p.needsUpdate=true;}
      if(e.type==='ring')e.obj.scale.setScalar(1+(1-e.life/e.max)*5);
    }
    for(let i=this.trails.length-1;i>=0;i--){const e=this.trails[i];e.life-=dt;if(e.life<=0){this.scene.remove(e.obj);e.obj.material.dispose();this.trails.splice(i,1);}else{e.obj.material.opacity=e.life/e.max*.3;e.obj.scale.setScalar(e.life/e.max*.8);}}
    this.postMaterial.uniforms.strength.value=.65+energy*.25+(drive?.35:0);
    this.postMaterial.uniforms.aberration.value=this.reduced?0:(drive?3:0)+this.shake*15;
    this.renderer.setRenderTarget(this.target);this.renderer.render(this.scene,this.camera);this.renderer.setRenderTarget(null);this.renderer.render(this.postScene,this.postCamera);
  }
  syncObjects(data,meshes,type){
    while(meshes.length<data.length){
      const group=new T.Group();
      const mesh=type==='shot'?new T.Mesh(new T.BoxGeometry(.09,.08,1.2),new T.MeshBasicMaterial({color:0xabfff2})):this.mesh(new T.OctahedronGeometry(.25),0xffc5ed,0xff83d7,1.6);
      group.add(mesh);group.add(this.glow(type==='shot'?0x81ffdf:0xff98de,type==='shot'?1.8:2.5,.5));this.table.add(group);meshes.push(group);
    }
    for(let i=0;i<meshes.length;i++){const m=meshes[i],d=data[i];m.visible=Boolean(d);if(d){m.position.set(d.x,.7,11-d.y);if(type==='pickup')m.children[0].rotation.y=this.clock*2;}}
  }
}
