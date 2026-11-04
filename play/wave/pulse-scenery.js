import * as T from './vendor/three.module.js';
/** Decorative geometry stays outside the playable corridor. Instancing bounds draw calls. */
export class PulseScenery {
  constructor(stage){
    this.stage=stage;this.dummy=new T.Object3D();this.color=new T.Color();
    this.cityMaterial=new T.ShaderMaterial({uniforms:{tint:{value:new T.Color(0x70deeb)},bass:{value:0},fogColor:{value:new T.Color(0x183444)}},vertexShader:`varying vec2 uvw;varying vec3 norm;varying float depth;varying float seed;varying float floors;void main(){uvw=uv;norm=normal;seed=instanceMatrix[3].x;floors=length(instanceMatrix[1].xyz)*1.8;vec4 w=modelMatrix*instanceMatrix*vec4(position,1.);depth=length(cameraPosition-w.xyz);gl_Position=projectionMatrix*viewMatrix*w;}`,fragmentShader:`varying vec2 uvw;varying vec3 norm;varying float depth;varying float seed;varying float floors;uniform vec3 tint;uniform vec3 fogColor;uniform float bass;
      float hash(vec2 q){return fract(sin(dot(q,vec2(127.1,311.7)))*43758.5453);}
      void main(){vec2 cells=vec2(uvw.x*6.,uvw.y*floors);vec2 f=fract(cells);float panes=smoothstep(.13,.22,f.x)*smoothstep(.87,.78,f.x)*smoothstep(.12,.27,f.y)*smoothstep(.78,.65,f.y);float lit=step(.38,hash(floor(cells)+seed));float side=.6+abs(norm.x)*.25+max(norm.y,0.)*.35;vec3 col=vec3(.017,.032,.055)*side;col+=tint*panes*lit*(.2+bass*.22);float edge=pow(abs(uvw.x-.5)*2.,35.);col+=tint*edge*.09;col=mix(col,fogColor,1.-exp(-depth*.0028));gl_FragColor=vec4(col,1.);}`});
    this.city=new T.InstancedMesh(new T.BoxGeometry(1,1,1),this.cityMaterial,56);this.city.frustumCulled=false;stage.scene.add(this.city);
    this.roofs=new T.InstancedMesh(new T.CylinderGeometry(.45,.6,.09,4),new T.MeshStandardMaterial({color:0x567486,roughness:.4,metalness:.7}),56);this.roofs.frustumCulled=false;stage.scene.add(this.roofs);
    this.beaconMaterial=new T.MeshBasicMaterial({color:0x7effdf});this.beacons=new T.InstancedMesh(new T.SphereGeometry(.13,6,4),this.beaconMaterial,56);this.beacons.frustumCulled=false;stage.scene.add(this.beacons);
    // Suspended transit rings and deck supports provide a readable sense of scale.
    this.stations=[];
    const hull=new T.MeshStandardMaterial({color:0x294453,metalness:.7,roughness:.38,emissive:0x0b2637,emissiveIntensity:.3});
    for(let i=0;i<6;i++){
      const group=new T.Group();const span=new T.Mesh(new T.BoxGeometry(64,1,3),hull);span.position.y=23;group.add(span);
      for(const side of [-1,1]){const tower=new T.Mesh(new T.BoxGeometry(2,24,4),hull);tower.position.set(side*29,10,0);group.add(tower);const strip=new T.Mesh(new T.BoxGeometry(.12,25,.12),this.beaconMaterial);strip.position.set(side*28,10,2.1);group.add(strip);}
      const ring=new T.Mesh(new T.TorusGeometry(8,.12,8,80),hull);ring.position.y=20;group.add(ring);const line=new T.Mesh(new T.TorusGeometry(7.8,.035,5,80),this.beaconMaterial);line.position.set(0,20,.15);group.add(line);stage.scene.add(group);this.stations.push(group);
    }
    // Two soft volumetric sheets at the corridor edges, never across the aiming area.
    this.shaftMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,uniforms:{strength:{value:0},tint:{value:new T.Color(0x83d8ec)}},vertexShader:'varying vec2 p;void main(){p=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 p;uniform float strength;uniform vec3 tint;void main(){float a=pow(sin(p.x*3.14159),4.)*pow(sin(p.y*3.14159),.6);gl_FragColor=vec4(tint,a*strength);}'});
    this.shafts=[];for(let i=0;i<8;i++){const m=new T.Mesh(new T.PlaneGeometry(7,95),this.shaftMaterial);m.rotation.z=(i%2?1:-1)*.2;m.position.set((i%2?-1:1)*(26+i*2),28,-45-i*45);stage.scene.add(m);this.shafts.push(m);}
    // A distant ringed world, shaded in 3D, with procedural banding and atmospheric rim.
    this.planet=new T.Group();this.planet.position.set(112,105,-425);const globe=new T.Mesh(new T.SphereGeometry(49,64,40),new T.ShaderMaterial({vertexShader:'varying vec3 n;varying vec3 local;varying vec3 eye;void main(){local=position;n=normalize(normalMatrix*normal);vec4 v=modelViewMatrix*vec4(position,1.);eye=normalize(-v.xyz);gl_Position=projectionMatrix*v;}',fragmentShader:'varying vec3 n;varying vec3 local;varying vec3 eye;void main(){float bands=.5+.5*sin(local.y*.3+sin(local.x*.1)*.7);float light=pow(max(0.,dot(normalize(n),normalize(vec3(-.8,.6,.4)))),.6);vec3 c=mix(vec3(.065,.13,.18),vec3(.38,.48,.51),bands)*(.035+light*.8);float rim=pow(1.-max(0.,dot(normalize(n),normalize(eye))),4.);c+=vec3(.16,.48,.6)*rim*.8;gl_FragColor=vec4(c,1.);}'}));this.planet.add(globe);
    const rings=new T.Mesh(new T.RingGeometry(63,88,128),new T.MeshBasicMaterial({color:0x89b6c4,side:T.DoubleSide,transparent:true,opacity:.21,depthWrite:false}));rings.rotation.set(-1.1,.15,-.3);this.planet.add(rings);stage.scene.add(this.planet);
    this.spectrum=new T.InstancedMesh(new T.BoxGeometry(.32,1,.32),new T.MeshBasicMaterial({color:0x8dffe5}),64);this.spectrum.frustumCulled=false;stage.scene.add(this.spectrum);
  }
  update(dt,travel,pulse){
    const s=this.stage,w=s.landscape.weights,a=s.audio||{bass:0,mid:0,high:0,impact:0},time=s.clock;
    this.color.setHex([0x80dcd8,0xec9bd2,0x74f9e2,0xffbf8d][s.game.section]);this.cityMaterial.uniforms.tint.value.lerp(this.color,Math.min(1,dt));this.cityMaterial.uniforms.bass.value=a.bass;this.cityMaterial.uniforms.fogColor.value.copy(s.scene.fog.color).multiplyScalar(.45);
    this.beaconMaterial.color.copy(this.color).multiplyScalar(1.2+(s.reduced?0:a.impact*.3));
    const strength=w.x*.55+w.y+w.z*.2+w.w*.75;
    this.city.visible=this.roofs.visible=this.beacons.visible=strength>.05;
    for(let i=0;i<56;i++){
      const side=i%2?-1:1,row=Math.floor(i/2),x=side*(31+(row%4)*17),z=30-((row*37+Math.floor(row/4)*29+travel*.85)%720),h=(8+(i*13)%37)*strength,width=3+(i*7)%7;
      this.dummy.position.set(x,h/2-1.4,z);this.dummy.rotation.set(0,(i%3)*.14,0);this.dummy.scale.set(width,h,width*.8);this.dummy.updateMatrix();this.city.setMatrixAt(i,this.dummy.matrix);
      this.dummy.position.y=h-1.2;this.dummy.scale.set(width*1.1,1,width*.9);this.dummy.updateMatrix();this.roofs.setMatrixAt(i,this.dummy.matrix);
      this.dummy.position.y=h+.2;this.dummy.scale.setScalar(1);this.dummy.updateMatrix();this.beacons.setMatrixAt(i,this.dummy.matrix);
    }for(const m of [this.city,this.roofs,this.beacons])m.instanceMatrix.needsUpdate=true;
    for(let i=0;i<this.stations.length;i++){const group=this.stations[i];group.visible=w.x+w.y+w.w>.1;group.position.set(0,w.z*8,30-((i*132+travel)%790));}
    this.shaftMaterial.uniforms.tint.value.copy(this.color);this.shaftMaterial.uniforms.strength.value=(.025+a.mid*.025)*(1-w.w);
    this.planet.visible=w.x+w.z>.08;this.planet.rotation.y=time*.007;this.planet.position.y=105+w.z*18;
    for(let i=0;i<64;i++){
      const side=i%2?-1:1,k=Math.floor(i/2),frequency=s.spectrum?.[2+k*2]/255||0,h=.4+frequency*5+(s.reduced?0:pulse*.25);
      this.dummy.position.set(side*10.5,-1+h*.5,15-((k*7+travel)%224));this.dummy.rotation.set(0,0,0);this.dummy.scale.set(1,h,1);this.dummy.updateMatrix();this.spectrum.setMatrixAt(i,this.dummy.matrix);
    }this.spectrum.instanceMatrix.needsUpdate=true;this.spectrum.material.color.copy(this.color).multiplyScalar(.8);this.spectrum.visible=s.game.status!=='menu';
  }
}
