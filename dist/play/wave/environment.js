import * as T from './vendor/three.module.js';
export function createRidge(){
  const n=22,vertices=[],indices=[],colors=[],uv=[];
  for(let z=0;z<=n;z++)for(let x=0;x<=n;x++){
    const px=x/n*2-1,pz=z/n*2-1,edge=Math.max(0,1-Math.pow(Math.abs(px),1.5))*Math.max(0,1-Math.pow(Math.abs(pz),1.7));
    const ridge=.5+.19*Math.sin(px*8+pz*3)+.13*Math.cos(pz*12-px*4)+.08*Math.sin(px*23+pz*19),height=edge*Math.max(.1,ridge)*1.7;
    vertices.push(px,height,pz);uv.push(x/n*3,z/n*3);const c=new T.Color().setRGB(.2+height*.18,.25+height*.2,.35+height*.23);colors.push(c.r,c.g,c.b);
  }
  for(let z=0;z<n;z++)for(let x=0;x<n;x++){const i=z*(n+1)+x;indices.push(i,i+n+1,i+1,i+1,i+n+1,i+n+2);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
const skyColors=[0x172746,0x0d102e,0x071f2e,0x130b2b],horizons=[0xa16479,0x332450,0x176778,0x6d3c60];
export class Landscape {
  constructor(stage){
    this.stage=stage;this.weights=new T.Vector4(1,0,0,0);this.targetWeights=new T.Vector4();const scene=stage.scene;
    this.moon=new T.Group();this.moon.position.set(-100,64,-330);
    this.moon.add(new T.Mesh(new T.SphereGeometry(24,48,32),new T.MeshStandardMaterial({color:0x536d8c,roughness:.75,metalness:.1,emissive:0x15223f,emissiveIntensity:.4})));
    const atmosphere=new T.Mesh(new T.SphereGeometry(25,40,24),new T.ShaderMaterial({transparent:true,side:T.BackSide,depthWrite:false,vertexShader:'varying vec3 normalW;varying vec3 eye;void main(){vec4 w=modelMatrix*vec4(position,1.);normalW=normalize(mat3(modelMatrix)*normal);eye=normalize(cameraPosition-w.xyz);gl_Position=projectionMatrix*viewMatrix*w;}',fragmentShader:'varying vec3 normalW;varying vec3 eye;void main(){float rim=pow(1.-abs(dot(normalize(normalW),normalize(eye))),3.);gl_FragColor=vec4(.3,.65,1.,rim*.65);}'}));this.moon.add(atmosphere);
    const ring=new T.Mesh(new T.TorusGeometry(36,.14,6,128),new T.MeshBasicMaterial({color:0x9bbee7,transparent:true,opacity:.4}));ring.rotation.x=1.2;ring.rotation.y=.35;this.moon.add(ring);scene.add(this.moon);
    this.auroras=[];
    for(let i=0;i<3;i++){
      const material=new T.ShaderMaterial({transparent:true,side:T.DoubleSide,depthWrite:false,blending:T.AdditiveBlending,uniforms:{time:{value:0},strength:{value:0},offset:{value:i*1.8}},vertexShader:'varying vec2 p;uniform float time;uniform float offset;void main(){p=uv;vec3 pos=position;pos.y+=sin(pos.x*.023+time*.15+offset)*12.;gl_Position=projectionMatrix*modelViewMatrix*vec4(pos,1.);}',fragmentShader:`varying vec2 p;uniform float time;uniform float strength;uniform float offset;void main(){float wave=.43+sin(p.x*7.+time*.12+offset)*.12+sin(p.x*17.+offset)*.035;float curtain=exp(-abs(p.y-wave)*10.)*smoothstep(.06,.3,p.y);float filaments=.3+.7*pow(.5+.5*sin(p.x*650.+sin(p.x*37.)*3.+time*.15),2.);float edge=smoothstep(0.,.1,p.x)*smoothstep(1.,.9,p.x);vec3 c=mix(vec3(.12,.95,.75),vec3(.52,.3,.95),smoothstep(.25,.75,p.y));gl_FragColor=vec4(c*1.1,curtain*filaments*edge*strength);
          #include <colorspace_fragment>
        }`});
      const mesh=new T.Mesh(new T.PlaneGeometry(340,100,80,2),material);mesh.position.set((i-1)*35,52+i*16,-150-i*80);mesh.rotation.y=(i-1)*.2;scene.add(mesh);this.auroras.push(mesh);
    }
    this.tunnel=[];
    for(let i=0;i<20;i++){
      const ring=new T.Mesh(new T.TorusGeometry(14,.07,6,64),new T.MeshBasicMaterial({color:i%3?0xffbb9d:0xf495d7,transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false}));ring.scale.y=.75;scene.add(ring);this.tunnel.push(ring);
    }
    this.arches=[];
    for(let i=0;i<8;i++){
      const points=[];for(let j=0;j<=40;j++){const a=j/40*Math.PI;points.push(new T.Vector3(Math.cos(a)*19,Math.sin(a)*22-1,0));}
      const arch=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),40,.12,6,false),new T.MeshStandardMaterial({color:0x386e7a,emissive:0x4ccabf,emissiveIntensity:.7,transparent:true,opacity:0,metalness:.6,roughness:.3}));scene.add(arch);this.arches.push(arch);
    }
    this.vortex=new T.Group();this.vortex.position.set(0,16,-300);
    for(let i=0;i<5;i++){const ring=new T.Mesh(new T.TorusGeometry(19+i*8,.12+i*.03,5,128),new T.MeshBasicMaterial({color:i%2?0xffc3a6:0xe699e8,transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false}));ring.rotation.y=i*.17;ring.rotation.x=i*.08;this.vortex.add(ring);}scene.add(this.vortex);
    const tubeGeo=new T.CylinderGeometry(20,20,600,48,1,true);tubeGeo.rotateX(Math.PI/2);
    this.tube=new T.Mesh(tubeGeo,new T.ShaderMaterial({side:T.BackSide,transparent:true,depthWrite:false,uniforms:{travel:{value:0},strength:{value:0}},vertexShader:'varying vec2 p;void main(){p=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec2 p;uniform float travel;uniform float strength;void main(){float bands=pow(abs(sin(p.y*314.+travel*.025)),42.);float rails=pow(abs(sin(p.x*37.699)),65.);float cells=.5+.5*sin(p.y*140.+p.x*25.-travel*.02);vec3 c=vec3(.008,.005,.025)+vec3(.13,.045,.13)*(bands*.3+rails*.5)+vec3(.035,.012,.05)*cells;gl_FragColor=vec4(c,strength*.96);
      #include <colorspace_fragment>
      }`}));this.tube.position.set(0,5,-230);scene.add(this.tube);
    const positions=[];for(let i=0;i<240;i++)positions.push((Math.sin(i*47)*.5)*180,2+(i*17)%65,-(i*43)%400);
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));this.motes=new T.Points(geo,new T.PointsMaterial({map:stage.texture,size:.5,color:0xa3fff0,transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false}));scene.add(this.motes);
  }
  update(dt,travel){
    const stage=this.stage,time=stage.clock,section=stage.game.section;
    this.targetWeights.set(0,0,0,0);this.targetWeights.setComponent(section,1);this.weights.lerp(this.targetWeights,Math.min(1,dt*1.2));
    const w=this.weights;stage.seaMaterial.uniforms.biome.value.copy(w);stage.skyMaterial.uniforms.top.value.lerp(new T.Color(skyColors[section]),Math.min(1,dt*.8));stage.skyMaterial.uniforms.horizon.value.lerp(new T.Color(horizons[section]),Math.min(1,dt*.8));
    stage.sun.material.opacity=1;stage.sunMaterial.uniforms.visibility.value=w.x+w.y*.15;stage.sun.scale.setScalar(.8+w.x*.2);stage.sunHalo.visible=w.x>.1;this.moon.visible=w.y+w.z>.1;this.moon.position.x=-100+w.z*55;this.moon.position.y=64+w.z*5;
    for(let i=0;i<this.auroras.length;i++){const m=this.auroras[i];m.material.uniforms.time.value=time;m.material.uniforms.strength.value=w.z*.65+w.x*.06;m.visible=w.z+w.x*.1>.04;}
    for(let i=0;i<this.tunnel.length;i++){const ring=this.tunnel[i];ring.visible=w.w>.025;ring.position.set(0,5,22-((i*25+travel)%480));ring.rotation.z=(stage.reduced?0:time*.05)+i*.23;ring.material.opacity=w.w*(.4+.18*Math.sin(time*2+i));}
    for(let i=0;i<this.arches.length;i++){const arch=this.arches[i];arch.visible=w.z>.025;arch.position.z=18-((i*60+travel)%480);arch.material.opacity=w.z*.8;}
    this.vortex.visible=w.w>.025;this.vortex.rotation.z=stage.reduced?0:time*.08;for(let i=0;i<this.vortex.children.length;i++)this.vortex.children[i].material.opacity=w.w*(.45-i*.045);
    this.tube.visible=w.w>.025;this.tube.material.uniforms.strength.value=w.w;this.tube.material.uniforms.travel.value=travel;
    this.motes.material.opacity=w.z*.5+w.w*.4;this.motes.position.z=travel%100;
  }
}
