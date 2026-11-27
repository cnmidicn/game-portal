import * as T from './vendor/three.module.js';

// High-end underwater post pipeline: MSAA HDR scene, packed-depth prepass,
// screen-space ambient occlusion, three-scale cinematic bloom, radial water
// shafts, depth-aware absorption, ACES + filmic grading and fine grain.
const vertex='varying vec2 p;void main(){p=uv;gl_Position=vec4(position.xy,0.,1.);}';
const radiance='vec3 sane(vec3 c){return vec3(c.r>=0.?min(c.r,16.):0.,c.g>=0.?min(c.g,16.):0.,c.b>=0.?min(c.b,16.):0.);}';
const depthHelpers=`
#include <packing>
uniform sampler2D tDepth;
float readDepth(vec2 uv){return unpackRGBAToDepth(texture2D(tDepth,clamp(uv,vec2(0.),vec2(1.))));}
vec3 viewPosition(vec2 uv,float d,mat4 invProj){vec4 c=vec4(uv*2.-1.,d*2.-1.,1.);vec4 v=invProj*c;return v.xyz/v.w;}
`;

// A tiny filmic LUT: three rows of 256 samples, one per channel. It gives the
// high preset a consistent teal-shadow / warm-highlight grade without a large
// external .cube asset.
function makeFilmLUT() {
  const width = 256, height = 8;
  const data = new Uint8Array(width * height * 4);
  const curve = (x, row) => {
    const lifted = Math.pow(Math.min(1, Math.max(0, x)), row === 2 ? .94 : 1.06);
    const contrast = (lifted - .5) * 1.045 + .5;
    const tint = row === 0 ? -.012 : row === 2 ? .014 : .004;
    return Math.max(0, Math.min(255, Math.round((contrast + tint * (1 - contrast)) * 255)));
  };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    data[i] = curve(x / (width - 1), 0);
    data[i + 1] = curve(x / (width - 1), 1);
    data[i + 2] = curve(x / (width - 1), 2);
    data[i + 3] = 255;
  }
  const texture = new T.DataTexture(data, width, height, T.RGBAFormat);
  texture.minFilter = texture.magFilter = T.LinearFilter;
  texture.wrapS = texture.wrapT = T.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

export class CinematicPass{
  constructor(renderer){
    this.renderer=renderer;this.mode='high';this.w=1;this.h=1;
    this.hdrType=renderer.extensions.has('EXT_color_buffer_float')?T.HalfFloatType:T.UnsignedByteType;
    const hdr=()=>new T.WebGLRenderTarget(1,1,{type:this.hdrType,format:T.RGBAFormat,minFilter:T.LinearFilter,magFilter:T.LinearFilter,depthBuffer:false});
    const ldr=()=>new T.WebGLRenderTarget(1,1,{type:T.UnsignedByteType,format:T.RGBAFormat,minFilter:T.LinearFilter,magFilter:T.LinearFilter,depthBuffer:false});
    this.sceneTarget=hdr();this.sceneTarget.depthBuffer=true;
    this.depthTarget=ldr();this.depthTarget.depthBuffer=true;
    this.bright=hdr();this.blurA=hdr();this.blurB=hdr();
    this.mip1=hdr();this.temp1=hdr();this.mip2=hdr();this.temp2=hdr();
    this.shafts=hdr();this.ao=ldr();this.aoTemp=ldr();
    this.final=ldr();this.historyA=ldr();this.historyB=ldr();this.historyIndex=0;
    this.prevCameraPosition=new T.Vector3();this.prevCameraQuaternion=new T.Quaternion();this.hasHistoryCamera=false;
    this.filmLUT=makeFilmLUT();
    this.depthMaterial=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking});
    this.scene=new T.Scene();this.camera=new T.OrthographicCamera(-1,1,1,-1,0,1);
    this.quad=new T.Mesh(new T.PlaneGeometry(2,2));this.quad.frustumCulled=false;this.scene.add(this.quad);
    const material=(uniforms,fragmentShader)=>new T.ShaderMaterial({uniforms,vertexShader:vertex,fragmentShader,depthTest:false,depthWrite:false,toneMapped:false});
    // TAA-lite resolve: neighbour-clamped history prevents the long smearing
    // typical of naive reprojection on mobile GPUs.
    this.copy=material({image:{value:null},history:{value:null},blend:{value:0},resolution:{value:new T.Vector2(1,1)}},`varying vec2 p;uniform sampler2D image;uniform sampler2D history;uniform float blend;uniform vec2 resolution;
      void main(){vec3 c=texture2D(image,p).rgb;if(blend<.001){gl_FragColor=vec4(c,1.);return;}vec2 s=1./resolution;
        vec3 mn=c,mx=c;for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec3 q=texture2D(image,p+vec2(float(x),float(y))*s).rgb;mn=min(mn,q);mx=max(mx,q);}
        vec3 h=clamp(texture2D(history,p).rgb,mn-.025,mx+.025);gl_FragColor=vec4(mix(c,h,blend),1.);}`);
    this.extract=material({image:{value:this.sceneTarget.texture},threshold:{value:1.1}},`varying vec2 p;uniform sampler2D image;uniform float threshold;${radiance}
      void main(){vec3 c=sane(texture2D(image,p).rgb);float l=max(c.r,max(c.g,c.b));float knee=clamp((l-threshold*.55)/(threshold*.9+.001),0.,1.);gl_FragColor=vec4(c*knee*knee,1.);}`);
    this.blur=material({image:{value:null},stepSize:{value:new T.Vector2()}},`varying vec2 p;uniform sampler2D image;uniform vec2 stepSize;void main(){
      vec3 c=texture2D(image,p).rgb*.227027;
      c+=(texture2D(image,p+stepSize*1.384615).rgb+texture2D(image,p-stepSize*1.384615).rgb)*.316216;
      c+=(texture2D(image,p+stepSize*3.230769).rgb+texture2D(image,p-stepSize*3.230769).rgb)*.070270;
      gl_FragColor=vec4(c,1.);}`);
    this.shaftMaterial=material({image:{value:this.bright.texture},sun:{value:new T.Vector2(.5,1.08)},strength:{value:.085}},`varying vec2 p;uniform sampler2D image;uniform vec2 sun;uniform float strength;
      void main(){vec2 dir=(p-sun)*.052;vec3 acc=vec3(0.);
        for(int i=0;i<16;i++){
          vec3 s=texture2D(image,clamp(p-dir*(float(i)/15.),vec2(0.),vec2(1.))).rgb;
          float hot=smoothstep(.9,2.1,max(s.r,max(s.g,s.b)));
          acc+=s*hot;
        }
        float fall=1.-smoothstep(.18,1.05,length(p-sun));float sky=smoothstep(.12,.72,p.y);
        gl_FragColor=vec4(acc*(1./16.)*fall*sky*strength,1.);}`);
    this.aoMaterial=material({
      tDepth:{value:this.depthTarget.texture},uProj:{value:new T.Matrix4()},uInvProj:{value:new T.Matrix4()},
      resolution:{value:new T.Vector2(1,1)},radius:{value:1.6},intensity:{value:.62},bias:{value:.035}
    },`varying vec2 p;uniform mat4 uProj;uniform mat4 uInvProj;uniform vec2 resolution;uniform float radius;uniform float intensity;uniform float bias;${depthHelpers}
      float hash(vec2 v){return fract(sin(dot(v,vec2(127.1,311.7)))*43758.5453);}
      void main(){
        float d=readDepth(p);if(d>.99995){gl_FragColor=vec4(1.);return;}
        vec3 origin=viewPosition(p,d,uInvProj);
        vec3 px=viewPosition(p+vec2(1./resolution.x,0.),readDepth(p+vec2(1./resolution.x,0.)),uInvProj)-origin;
        vec3 py=viewPosition(p+vec2(0.,1./resolution.y),readDepth(p+vec2(0.,1./resolution.y)),uInvProj)-origin;
        vec3 n=normalize(cross(px,py));if(n.z<0.)n=-n;
        float ang=hash(floor(p*resolution))*6.2831853;
        vec3 t=normalize(vec3(cos(ang),sin(ang),0.));t=normalize(t-n*dot(t,n));vec3 b=cross(n,t);
        float r=radius*(1.+clamp(-origin.z*.014,0.,5.));float occ=0.;
        for(int i=0;i<16;i++){
          float fi=float(i),a=fi*2.399963+ang,z=(fi+.5)/16.,rr=sqrt(max(0.,1.-z*z));
          vec3 dir=normalize(t*cos(a)*rr+b*sin(a)*rr+n*z);
          vec3 sp=origin+dir*r*(.35+.65*z);
          vec4 clip=uProj*vec4(sp,1.);vec2 suv=clip.xy/clip.w*.5+.5;
          if(suv.x<0.||suv.x>1.||suv.y<0.||suv.y>1.)continue;
          float sd=readDepth(suv);if(sd>.99995)continue;
          vec3 sv=viewPosition(suv,sd,uInvProj);
          float range=smoothstep(0.,r*2.,abs(origin.z-sv.z));
          occ+=(sv.z>=sp.z+bias?1.:0.)*range;
        }
        float ao=clamp(1.-occ*(1./16.)*intensity,0.,1.);
        gl_FragColor=vec4(ao,ao,ao,1.);}`);
    this.compose=material({
      image:{value:this.sceneTarget.texture},bloom0:{value:this.blurB.texture},bloom1:{value:this.mip1.texture},bloom2:{value:this.mip2.texture},
      shafts:{value:this.shafts.texture},ao:{value:this.ao.texture},lut:{value:this.filmLUT},
      tDepth:{value:this.depthTarget.texture},uInvProj:{value:new T.Matrix4()},
      resolution:{value:new T.Vector2(1,1)},exposure:{value:1.45},boost:{value:0},bass:{value:0},
      bloomStrength:{value:1.},aoStrength:{value:.72},underwater:{value:1.},vignette:{value:.22},grain:{value:.006},time:{value:0},
      motion:{value:0},dof:{value:0},motionBlur:{value:0},lensFlare:{value:0},filmLut:{value:1},
      focus:{value:34},sun:{value:new T.Vector2(.5,1.08)},waterTint:{value:new T.Color(0x0a2a34)},waterLayers:{value:2}
    },`varying vec2 p;uniform sampler2D image;uniform sampler2D bloom0;uniform sampler2D bloom1;uniform sampler2D bloom2;uniform sampler2D shafts;uniform sampler2D ao;uniform sampler2D lut;
      uniform vec2 resolution;uniform mat4 uInvProj;uniform float exposure;uniform float boost;uniform float bass;
      uniform float bloomStrength;uniform float aoStrength;uniform float underwater;uniform float vignette;uniform float grain;uniform float time;
      uniform float motion;uniform float dof;uniform float motionBlur;uniform float lensFlare;uniform float filmLut;
      uniform float focus;uniform vec2 sun;uniform vec3 waterTint;uniform float waterLayers;
      ${radiance}${depthHelpers}
      vec3 aces(vec3 x){x=clamp(x,vec3(0.),vec3(32.));return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
      void main(){
        vec2 fringe=(p-.5)*(.00065+boost*.0032);
        vec3 c=sane(texture2D(image,p).rgb);
        c.r=sane(texture2D(image,p+fringe).rgb).r;
        c.b=sane(texture2D(image,p-fringe).rgb).b;
        if(motionBlur>.01){vec3 mb=c;for(int i=1;i<=5;i++){float k=float(i)/5.;mb+=sane(texture2D(image,clamp(p+(p-.5)*motionBlur*k*.045,vec2(0.),vec2(1.))).rgb);}c=mb/6.;}
        vec3 bloom=texture2D(bloom0,p).rgb*.66+texture2D(bloom1,p).rgb*.26+texture2D(bloom2,p).rgb*.08;
        c+=bloom*(bloomStrength+boost*.16+bass*.07);
        if(lensFlare>.01){vec2 dir=(sun-p)*.10;vec3 flare=vec3(0.);for(int i=0;i<5;i++){float k=float(i)/4.;flare+=texture2D(bloom0,clamp(p+dir*k,vec2(0.),vec2(1.))).rgb*(1.-k*.7);vec2 ghost=clamp(vec2(1.)-p-dir*(k+.3),vec2(0.),vec2(1.));flare+=texture2D(bloom0,ghost).rgb*(1.-k)*.24;}c+=flare*lensFlare*.008;}
        c+=texture2D(shafts,p).rgb;
        c*=mix(1.,texture2D(ao,p).r,aoStrength);
        float d=readDepth(p);float dist=clamp(-viewPosition(p,d,uInvProj).z,0.,1800.);
        // Physical water absorption: red is eaten first, blue survives deepest.
        float absorb=(1.-exp(-dist*.00155))*underwater;
        float water=smoothstep(22.,520.,dist)*underwater;
        c.r*=mix(1.,.46,absorb);c.g*=mix(1.,.77,absorb);c.b*=mix(1.,1.05,absorb);
        vec3 inScatter=mix(vec3(.004,.026,.040),vec3(.012,.060,.098),smoothstep(80.,900.,dist));
        c+=inScatter*water*.9;
        if(waterLayers>.5){float haze=sin(p.x*23.+time*.11)*sin(p.y*17.-time*.07)+.6*sin((p.x+p.y)*11.+time*.05);c+=waterTint*water*(.00045*waterLayers)*(1.+.25*haze);}
        if(dof>.01){float coc=clamp(abs(dist-focus)/(focus*1.7),0.,1.)*dof;if(coc>.01){float r=coc*.0048;vec3 blur=sane(texture2D(image,p).rgb);blur+=sane(texture2D(image,clamp(p+vec2(r,0.),vec2(0.),vec2(1.))).rgb);blur+=sane(texture2D(image,clamp(p-vec2(r,0.),vec2(0.),vec2(1.))).rgb);blur+=sane(texture2D(image,clamp(p+vec2(0.,r),vec2(0.),vec2(1.))).rgb);blur+=sane(texture2D(image,clamp(p-vec2(0.,r),vec2(0.),vec2(1.))).rgb);blur+=sane(texture2D(image,clamp(p+vec2(r,r)*.7,vec2(0.),vec2(1.))).rgb);blur+=sane(texture2D(image,clamp(p-vec2(r,r)*.7,vec2(0.),vec2(1.))).rgb);c=mix(c,blur/7.,coc*.68);}}
        // Gentle local contrast keeps sediment grain and scan details readable
        // after bloom and scattering without haloing the silhouettes.
        vec3 neighbours=(texture2D(image,p+vec2(1./resolution.x,0.)).rgb+texture2D(image,p-vec2(1./resolution.x,0.)).rgb+
                         texture2D(image,p+vec2(0.,1./resolution.y)).rgb+texture2D(image,p-vec2(0.,1./resolution.y)).rgb)*.25;
        c=mix(c,c+(c-neighbours),.07*underwater);
        c=aces(c*exposure);
        float l=dot(c,vec3(.2126,.7152,.0722));
        c=mix(vec3(l),c,1.10);
        c=(c-.5)*1.065+.5;
        c+=vec3(0.,.007,.016)*(1.-l)*.55+vec3(.014,.005,0.)*smoothstep(.55,1.,l);
        if(filmLut>.5){vec3 graded=vec3(texture2D(lut,vec2(clamp(c.r,0.,1.),.0625)).r,texture2D(lut,vec2(clamp(c.g,0.,1.),.1875)).g,texture2D(lut,vec2(clamp(c.b,0.,1.),.3125)).b);c=mix(c,graded,filmLut);}
        c=clamp(c,0.,1.);
        c*=1.-smoothstep(.36,1.02,length((p-.5)*vec2(1.06,.94)))*vignette;
        float n=fract(sin(dot(p*resolution+time,vec2(12.9898,78.233)))*43758.5453);
        c+=(n-.5)*grain;
        gl_FragColor=vec4(clamp(c,0.,1.),1.);
        #include <colorspace_fragment>
      }`);
    this.setQuality('high');
  }
  setQuality(mode,preset=null){
    this.mode=['low','medium','high'].includes(mode)?mode:'high';
    this.preset=preset||{samples:this.mode==='high'?4:this.mode==='medium'?2:0,bloom:this.mode==='high'?.72:.45,ao:this.mode!=='low',underwater:this.mode==='high'?1:.6,vignette:this.mode==='high'?.30:.24,grain:this.mode==='high'?.012:.008,gtao:this.mode==='high',dof:false,motionBlur:false,taa:false,lensFlare:false,filmLut:this.mode!=='low',waterLayers:this.mode==='high'?3:2};
    const q=this.preset;
    const max=this.renderer.capabilities.maxSamples||0;
    const samples=Math.min(q.samples??0,max);
    if(this.sceneTarget.samples!==samples){this.sceneTarget.samples=samples;this.sceneTarget.dispose();}
    this.compose.uniforms.bloomStrength.value=q.bloom??0;
    this.aoMaterial.uniforms.radius.value=q.gtao?2.35:1.6;
    this.aoMaterial.uniforms.intensity.value=q.gtao?.62:q.ao?.30:0;
    this.compose.uniforms.aoStrength.value=q.gtao?.72:q.ao?.38:0;
    this.compose.uniforms.underwater.value=q.underwater??0;
    this.compose.uniforms.vignette.value=q.vignette??.24;
    this.compose.uniforms.grain.value=q.grain??.008;
    this.compose.uniforms.dof.value=q.dof?1:0;
    this.compose.uniforms.motionBlur.value=q.motionBlur?1:0;
    this.compose.uniforms.lensFlare.value=q.lensFlare?1:0;
    this.compose.uniforms.filmLut.value=q.filmLut?1:0;
    this.compose.uniforms.waterLayers.value=q.waterLayers??1;
    this.extract.uniforms.threshold.value=this.mode==='high'?1.05:1.25;
    this.shaftMaterial.uniforms.strength.value=this.mode==='high'?.10:.05;
    if(this.w>1)this.resize(this.w,this.h);
    return this.mode;
  }
  resize(w,h){
    this.w=Math.max(1,Math.round(w));this.h=Math.max(1,Math.round(h));
    const hw=Math.max(1,Math.floor(this.w/2)),hh=Math.max(1,Math.floor(this.h/2));
    const qw=Math.max(1,Math.floor(this.w/4)),qh=Math.max(1,Math.floor(this.h/4));
    const ew=Math.max(1,Math.floor(this.w/8)),eh=Math.max(1,Math.floor(this.h/8));
    this.sceneTarget.setSize(this.w,this.h);
    for(const t of [this.depthTarget,this.bright,this.blurA,this.blurB,this.shafts,this.ao,this.aoTemp])t.setSize(hw,hh);
    for(const t of [this.mip1,this.temp1])t.setSize(qw,qh);
    for(const t of [this.mip2,this.temp2])t.setSize(ew,eh);
    for(const t of [this.final,this.historyA,this.historyB])t.setSize(this.w,this.h);
    this.aoMaterial.uniforms.resolution.value.set(hw,hh);
    this.compose.uniforms.resolution.value.set(this.w,this.h);
    this.copy.uniforms.resolution.value.set(this.w,this.h);
  }
  pass(material,target){this.quad.material=material;this.renderer.setRenderTarget(target);this.renderer.render(this.scene,this.camera);}
  blurPass(source,target,x,y){this.blur.uniforms.image.value=source.texture;this.blur.uniforms.stepSize.value.set(x,y);this.pass(this.blur,target);}
  renderDepth(scene,camera){
    const r=this.renderer,bg=scene.background,fog=scene.fog,override=scene.overrideMaterial;
    const color=r.getClearColor(new T.Color()).clone(),alpha=r.getClearAlpha();
    // The AO prepass must see only solid surfaces. Translucent membranes,
    // sprites and particles would otherwise write huge flat depth rectangles
    // that turn into dark "buildings" after the SSAO compose.
    const hidden=[];
    scene.traverse(o=>{
      if(o===scene||!o.visible)return;
      const mats=Array.isArray(o.material)?o.material:[o.material];
      const skip=o.isPoints||o.isLine||o.isSprite||o.isLight||
        (o.isMesh&&mats.some(m=>m&&(m.transparent||m.depthWrite===false||m.opacity<1)));
      if(skip){hidden.push([o,o.visible]);o.visible=false;}
    });
    scene.background=null;scene.fog=null;scene.overrideMaterial=this.depthMaterial;
    r.setClearColor(0xffffff,1);r.setRenderTarget(this.depthTarget);r.clear();
    try{r.render(scene,camera);}finally{
      for(const [o,visible] of hidden)o.visible=visible;
      scene.background=bg;scene.fog=fog;scene.overrideMaterial=override;r.setClearColor(color,alpha);
    }
  }
  render(scene,camera,{boost=0,bass=0,sun=[.5,1.08],time=0,exposure=1.45,motion=0,
    dof=true,motionBlur=true,taa=true,lensFlare=true,filmLut=true,waterLayers=2,waterTint=null}={}){
    const r=this.renderer;
    r.setRenderTarget(this.sceneTarget);r.clear();r.render(scene,camera);
    this.renderDepth(scene,camera);
    this.pass(this.extract,this.bright);
    this.blurPass(this.bright,this.blurA,1.15/this.bright.width,0);
    this.blurPass(this.blurA,this.blurB,0,1.15/this.bright.height);
    this.blurPass(this.blurB,this.temp1,1.05/this.mip1.width,0);
    this.blurPass(this.temp1,this.mip1,0,1.05/this.mip1.height);
    this.blurPass(this.mip1,this.temp2,1.05/this.mip2.width,0);
    this.blurPass(this.temp2,this.mip2,0,1.05/this.mip2.height);
    this.shaftMaterial.uniforms.sun.value.set(sun[0],sun[1]);
    this.pass(this.shaftMaterial,this.shafts);
    this.aoMaterial.uniforms.uProj.value.copy(camera.projectionMatrix);
    this.aoMaterial.uniforms.uInvProj.value.copy(camera.projectionMatrixInverse);
    this.pass(this.aoMaterial,this.ao);
    this.blurPass(this.ao,this.aoTemp,1./this.ao.width,0);
    this.blurPass(this.aoTemp,this.ao,0,1./this.ao.height);
    const u=this.compose.uniforms;
    u.boost.value=boost;u.bass.value=bass;u.time.value=time;u.exposure.value=exposure;
    u.motion.value=motion;u.dof.value=dof?1:0;u.motionBlur.value=motionBlur?motion:0;
    u.lensFlare.value=lensFlare?1:0;u.filmLut.value=filmLut?1:0;u.waterLayers.value=waterLayers;
    u.sun.value.set(sun[0],sun[1]);
    if(waterTint)u.waterTint.value.copy(waterTint);
    u.uInvProj.value.copy(camera.projectionMatrixInverse);
    if(taa&&this.mode==='high'){
      this.pass(this.compose,this.final);
      const moved=this.hasHistoryCamera&&(camera.position.distanceToSquared(this.prevCameraPosition)>.0004||1-Math.abs(camera.quaternion.dot(this.prevCameraQuaternion))>.00002);
      const blend=moved?.045:.12;
      this.prevCameraPosition.copy(camera.position);this.prevCameraQuaternion.copy(camera.quaternion);this.hasHistoryCamera=true;
      const read=this.historyIndex?this.historyB:this.historyA;
      const write=this.historyIndex?this.historyA:this.historyB;
      this.copy.uniforms.image.value=this.final.texture;
      this.copy.uniforms.history.value=read.texture;
      this.copy.uniforms.blend.value=blend;
      this.pass(this.copy,write);
      this.copy.uniforms.image.value=write.texture;
      this.copy.uniforms.blend.value=0;
      this.pass(this.copy,null);
      this.historyIndex=1-this.historyIndex;
    }else{
      this.pass(this.compose,null);
    }
  }
}
