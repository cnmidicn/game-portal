import * as THREE from './vendor/three.module.js';
export const MORPHS=[
  {name:'原初细胞',hint:'柔软细胞膜 · 单核生命',mass:8},
  {name:'流光幼体',hint:'尾部萌生 · 开始主动游猎',mass:32},
  {name:'星翼猎手',hint:'翼鳍展开 · 掠过微光海床',mass:100},
  {name:'深渊游龙',hint:'节状长躯 · 拨动深海潮汐',mass:280},
  {name:'交响巨兽',hint:'冠角与巨鳍 · 生命的终章',mass:700}
];
function wingGeometry(side=1){
  const s=new THREE.Shape();s.moveTo(0,.5);s.bezierCurveTo(side*.5,.75,side*1.3,.65,side*1.9,-.2);s.quadraticCurveTo(side*1.4,-.1,side*.9,-.9);s.quadraticCurveTo(side*.4,-.65,0,-.5);
  const g=new THREE.ExtrudeGeometry(s,{depth:.055,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.035,bevelThickness:.025,curveSegments:10});g.rotateX(Math.PI/2);return g;
}
export function createMorphology(bodyMaterial){
  const group=new THREE.Group(),sphere=new THREE.SphereGeometry(1,18,12),right=wingGeometry(1),left=wingGeometry(-1);
  const finMaterial=new THREE.MeshStandardMaterial({color:0x6cc3a6,emissive:0x143a30,emissiveIntensity:.25,roughness:.4,metalness:.1,transparent:true,opacity:.65,side:THREE.DoubleSide});
  const tailGeometry=new THREE.BufferGeometry(),tailRings=32,tailSides=12,indices=[];tailGeometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array((tailRings+1)*(tailSides+1)*3),3).setUsage(THREE.DynamicDrawUsage));for(let i=0;i<tailRings;i++)for(let j=0;j<tailSides;j++){const a=i*(tailSides+1)+j,b=a+tailSides+1;indices.push(a,b,a+1,b,b+1,a+1);}tailGeometry.setIndex(indices);const tail=new THREE.Mesh(tailGeometry,bodyMaterial);tail.frustumCulled=false;group.add(tail);
  const wings=new THREE.Group();for(const [index,geo]of [left,right].entries()){const wing=new THREE.Mesh(geo,finMaterial),side=index?1:-1;for(let j=0;j<3;j++){const curve=new THREE.QuadraticBezierCurve3(new THREE.Vector3(0,-.035,.25-j*.17),new THREE.Vector3(side*.8,-.035,.35-j*.3),new THREE.Vector3(side*(1.6-j*.32),-.035,-.15-j*.22));wing.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(18)),new THREE.LineBasicMaterial({color:0x306e5d,transparent:true,opacity:.45})));}wings.add(wing);}group.add(wings);
  const flukes=new THREE.Group();for(const geo of [left,right]){const m=new THREE.Mesh(geo,finMaterial);m.scale.setScalar(.45);flukes.add(m);}group.add(flukes);
  const horns=new THREE.Group();const hornMaterial=new THREE.MeshStandardMaterial({color:0xdaf5c8,emissive:0x346141,emissiveIntensity:.5,roughness:.3});
  for(const side of [-1,1]){const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(side*.45,.45,.45),new THREE.Vector3(side*.65,.8,.65),new THREE.Vector3(side*.7,1.15,.9)]),horn=new THREE.Mesh(new THREE.TubeGeometry(curve,12,.045,6,false),hornMaterial);horns.add(horn);}group.add(horns);
  const eyes=new THREE.Group(),eyeMaterial=new THREE.MeshBasicMaterial({color:0xdbffdc});for(const side of [-1,1]){const eye=new THREE.Mesh(sphere,eyeMaterial);eye.scale.set(.07,.04,.11);eye.position.set(side*.5,.35,.7);eyes.add(eye);}group.add(eyes);
  const dorsal=new THREE.Group();for(let i=0;i<4;i++){const m=new THREE.Mesh(new THREE.ConeGeometry(.18,.55,3),finMaterial);m.position.set(0,.45,-.6-i*.5);m.scale.z=1.6;dorsal.add(m);}group.add(dorsal);
  return{group,tail,tailRings,tailSides,wings,flukes,horns,eyes,dorsal,finMaterial};
}
export function animateMorphology(m,stage,t,moving=0){
  m.tail.visible=stage>=1;m.wings.visible=stage===2||stage===4;m.horns.visible=stage===4;m.eyes.visible=stage>=1;m.dorsal.visible=stage>=3;m.flukes.visible=stage>=1;
  const length=stage===1?1.8:stage===2?1.25:stage===3?3.1:3.5,width=stage===1?.38:stage===2?.2:stage===3?.65:.85;
  if(stage>=1){const p=m.tail.geometry.attributes.position;let index=0;for(let i=0;i<=m.tailRings;i++){const f=i/m.tailRings,s=width*Math.pow(1-f*.93,.8),wave=Math.sin(t*(2+moving*.025)-f*3.5)*.18*f;for(let j=0;j<=m.tailSides;j++){const a=j/m.tailSides*Math.PI*2;p.setXYZ(index++,Math.cos(a)*s+wave,Math.sin(a)*s*.65,-.45-length*f);}}p.needsUpdate=true;m.tail.geometry.computeVertexNormals();}
  m.wings.scale.setScalar(stage===4?1.12:1);m.wings.children.forEach((w,i)=>{w.rotation.z=Math.sin(t*2+i*.2)*.075*(i?1:-1);w.position.set(i?.3:-.3,-.12,stage===4?-.2:0);});
  m.flukes.position.set(Math.sin(t*(2+moving*.025)-3.5)*.18,0,-length-.45);m.flukes.scale.setScalar(stage===1?.45:stage===2?.35:stage===3?.65:.85);m.flukes.rotation.z=Math.sin(t*2.2)*.07;
  m.dorsal.children.forEach((fin,i)=>fin.position.x=Math.sin(t*2-i*.7)*.08*i/3);
  m.finMaterial.color.set(stage===4?0xa8c47e:stage===3?0x6ca7ad:0x6cc3a6);
}
