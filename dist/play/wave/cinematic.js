import * as T from './vendor/three.module.js';
const vertex='varying vec2 p;void main(){p=uv;gl_Position=vec4(position.xy,0.,1.);}';
/** Linear HDR scene → bright extraction → separable blur → one display transform. */
export class CinematicPass {
  constructor(renderer){
    this.renderer=renderer;const type=renderer.extensions.has('EXT_color_buffer_float')?T.HalfFloatType:T.UnsignedByteType;
    const target=()=>new T.WebGLRenderTarget(1,1,{type,depthBuffer:false});
    this.sceneTarget=target();this.sceneTarget.depthBuffer=true;this.sceneTarget.samples=Math.min(2,renderer.capabilities.maxSamples);this.bright=target();this.a=target();this.b=target();
    this.scene=new T.Scene();this.camera=new T.OrthographicCamera(-1,1,1,-1,0,1);this.quad=new T.Mesh(new T.PlaneGeometry(2,2));this.quad.frustumCulled=false;this.scene.add(this.quad);
    const material=(uniforms,fragmentShader)=>new T.ShaderMaterial({uniforms,vertexShader:vertex,fragmentShader,depthTest:false,depthWrite:false,toneMapped:false});
    this.extract=material({image:{value:this.sceneTarget.texture}},`varying vec2 p;uniform sampler2D image;void main(){vec3 c=texture2D(image,p).rgb;float l=max(c.r,max(c.g,c.b));float knee=clamp((l-.65)/.7,0.,1.);gl_FragColor=vec4(c*knee*knee,1.);}`);
    this.blur=material({image:{value:null},stepSize:{value:new T.Vector2()}},`varying vec2 p;uniform sampler2D image;uniform vec2 stepSize;void main(){vec3 c=texture2D(image,p).rgb*.227027;c+=(texture2D(image,p+stepSize*1.384615).rgb+texture2D(image,p-stepSize*1.384615).rgb)*.316216;c+=(texture2D(image,p+stepSize*3.230769).rgb+texture2D(image,p-stepSize*3.230769).rgb)*.070270;gl_FragColor=vec4(c,1.);}`);
    this.compose=material({image:{value:this.sceneTarget.texture},bloom:{value:this.b.texture},resolution:{value:new T.Vector2()},boost:{value:0},bass:{value:0}},`varying vec2 p;uniform sampler2D image;uniform sampler2D bloom;uniform vec2 resolution;uniform float boost;uniform float bass;
      vec3 aces(vec3 x){x=clamp(x,vec3(0.),vec3(32.));return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
      void main(){vec2 offset=(p-.5)*boost*1.4/resolution;vec3 c=texture2D(image,p).rgb;c.r=texture2D(image,p+offset).r;c.b=texture2D(image,p-offset).b;vec3 glow=texture2D(bloom,p).rgb;c+=glow*(.27+boost*.12+bass*.055);c*=1.-smoothstep(.3,.88,length((p-.5)*vec2(1.,.85)))*.22;c=aces(c*1.08);gl_FragColor=vec4(c,1.);
      #include <colorspace_fragment>
      }`);
  }
  resize(w,h){this.w=Math.max(1,Math.round(w/4));this.h=Math.max(1,Math.round(h/4));this.sceneTarget.setSize(w,h);for(const t of [this.bright,this.a,this.b])t.setSize(this.w,this.h);this.compose.uniforms.resolution.value.set(w,h);}
  pass(material,target){this.quad.material=material;this.renderer.setRenderTarget(target);this.renderer.render(this.scene,this.camera);}
  render(scene,camera,{boost=0,bass=0}={}){
    this.renderer.setRenderTarget(this.sceneTarget);this.renderer.render(scene,camera);this.pass(this.extract,this.bright);
    this.blur.uniforms.image.value=this.bright.texture;this.blur.uniforms.stepSize.value.set(1.2/this.w,0);this.pass(this.blur,this.a);
    this.blur.uniforms.image.value=this.a.texture;this.blur.uniforms.stepSize.value.set(0,1.2/this.h);this.pass(this.blur,this.b);
    this.blur.uniforms.image.value=this.b.texture;this.blur.uniforms.stepSize.value.set(2.4/this.w,0);this.pass(this.blur,this.a);
    this.blur.uniforms.image.value=this.a.texture;this.blur.uniforms.stepSize.value.set(0,2.4/this.h);this.pass(this.blur,this.b);
    this.compose.uniforms.boost.value=boost;this.compose.uniforms.bass.value=bass;this.pass(this.compose,null);
  }
}
