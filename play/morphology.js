import * as THREE from './vendor/three.module.js';
// 25-stage phylogeny. `stage` (0..4) stays untouched for gameplay/save compatibility;
// these are purely visual forms interpolated by mass. All names are palaeontological —
// the five legacy stage names were fully replaced per the user's decision.
export const MORPHS=[
  {name:'原核生命',hint:'太古宙 · 单膜单核',mass:8},
  {name:'刺胞动物',hint:'寒武纪 · 伞盖触手',mass:32},
  {name:'甲胄鱼',hint:'奥陶纪 · 骨质头甲',mass:100},
  {name:'鱼龙',hint:'三叠纪 · 长吻月牙尾',mass:280},
  {name:'巨齿鲨',hint:'中新世 · 巨颚',mass:700}
];
// Columns: name, era, mass, then anatomy weights (0..1.2). Whale forms keep cilia>0:
// the translucent glowing cell membrane is retained all the way to the largest form.
export const FORMS=[
  {name:'原核生命',era:'太古宙',mass:8,    tail:0,   wings:0,   fluke:0,   horn:0,   dorsal:0,  cilia:1,   armor:0,   jaw:0,    snout:0,   neck:0,   pleat:0},
  {name:'真核细胞',era:'古元古代',mass:11, tail:0,   wings:0,   fluke:0,   horn:0,   dorsal:0,  cilia:.88, armor:0,   jaw:0,    snout:0,   neck:0,   pleat:0},
  {name:'合胞原生生物',era:'新元古代',mass:15,tail:0,wings:0,   fluke:0,   horn:0,   dorsal:0,  cilia:.74, armor:0,   jaw:0,    snout:0,   neck:0,   pleat:0},
  {name:'海绵',era:'埃迪卡拉纪',mass:19,   tail:0,   wings:0,   fluke:0,   horn:0,   dorsal:0,  cilia:.6,  armor:.2,  jaw:0,    snout:0,   neck:0,   pleat:0},
  {name:'古杯动物',era:'寒武纪',mass:25,   tail:0,   wings:0,   fluke:0,   horn:.05,dorsal:0,  cilia:.5,  armor:.45, jaw:0,    snout:0,   neck:0,   pleat:0},
  {name:'刺胞动物',era:'寒武纪',mass:32,   tail:.12, wings:0,   fluke:0,   horn:0,   dorsal:0,  cilia:.42, armor:.05, jaw:0,    snout:0,   neck:0,   pleat:0},
  {name:'海口鱼',era:'寒武纪',mass:38,     tail:.28, wings:0,   fluke:.1, horn:0,   dorsal:.1, cilia:.3,  armor:0,   jaw:.05,  snout:.1,  neck:0,   pleat:0},
  {name:'三叶虫',era:'寒武纪',mass:45,     tail:.34, wings:.12, fluke:.1, horn:0,   dorsal:.2, cilia:0,   armor:.68, jaw:0,    snout:.1,  neck:.1,  pleat:0},
  {name:'奇虾',era:'寒武纪',mass:55,       tail:.44, wings:.38, fluke:.2, horn:.05,dorsal:.25,cilia:0,   armor:.35, jaw:.25,  snout:.15, neck:.15, pleat:0},
  {name:'鹦鹉螺',era:'奥陶纪',mass:70,     tail:.4,  wings:.3,  fluke:.15,horn:.15,dorsal:.15,cilia:.12,armor:.5,  jaw:.2,   snout:.6,  neck:.3,  pleat:0},
  {name:'甲胄鱼',era:'奥陶纪',mass:100,    tail:.5,  wings:.5,  fluke:.3, horn:0,   dorsal:.3, cilia:0,   armor:.92, jaw:.2,   snout:.2,  neck:.1,  pleat:0},
  {name:'邓氏鱼',era:'泥盆纪',mass:130,    tail:.55, wings:.45, fluke:.35,horn:0,   dorsal:.4, cilia:0,   armor:1,   jaw:.75,  snout:.3,  neck:.15, pleat:0},
  {name:'裂口鲨',era:'泥盆纪',mass:160,    tail:.68, wings:.72, fluke:.56,horn:0,   dorsal:.76,cilia:0,   armor:.15, jaw:.6,   snout:.45, neck:.15, pleat:0},
  {name:'腔棘鱼',era:'泥盆纪',mass:200,    tail:.64, wings:.6,  fluke:.54,horn:0,   dorsal:.6, cilia:0,   armor:.1,  jaw:.5,   snout:.4,  neck:.2,  pleat:0},
  {name:'旋齿鲨',era:'二叠纪',mass:240,    tail:.72, wings:.7,  fluke:.7, horn:.1,  dorsal:.8, cilia:0,   armor:.08, jaw:.95,  snout:.5,  neck:.18, pleat:0},
  {name:'鱼龙',era:'三叠纪',mass:280,      tail:.8,  wings:.85, fluke:.9, horn:0,   dorsal:.85,cilia:0,   armor:0,   jaw:.75,  snout:1,   neck:.2,  pleat:0},
  {name:'蛇颈龙',era:'侏罗纪',mass:330,    tail:.6,  wings:1,   fluke:.7, horn:0,   dorsal:.5, cilia:0,   armor:0,   jaw:.7,   snout:.8,  neck:1,   pleat:0},
  {name:'上龙',era:'侏罗纪',mass:400,      tail:.75, wings:.95, fluke:.8, horn:.12, dorsal:.7, cilia:0,   armor:.05, jaw:1,    snout:.85, neck:.4,  pleat:0},
  {name:'剑射鱼',era:'白垩纪',mass:480,    tail:.85, wings:.9,  fluke:.9, horn:.2,  dorsal:1,  cilia:0,   armor:.05, jaw:.9,   snout:1.1, neck:.2,  pleat:0},
  {name:'沧龙',era:'白垩纪',mass:580,      tail:.9,  wings:.95, fluke:1,  horn:.15, dorsal:.9, cilia:0,   armor:.1,  jaw:1,    snout:.9,  neck:.35, pleat:.1},
  {name:'巨齿鲨',era:'中新世',mass:700,    tail:1,   wings:1,   fluke:1,  horn:.4,  dorsal:1,  cilia:.05, armor:.1,  jaw:1,    snout:.8,  neck:.25, pleat:.2},
  {name:'大白鲨',era:'现代',mass:1000,     tail:.95, wings:.95, fluke:1,  horn:.3,  dorsal:1,  cilia:.08, armor:.06, jaw:1,    snout:.85, neck:.2,  pleat:.3},
  {name:'龙王鲸',era:'始新世',mass:1600,   tail:.82, wings:.75, fluke:1.1,horn:.25, dorsal:.55,cilia:.1,  armor:0,   jaw:.9,   snout:1.15,neck:.15, pleat:.55},
  {name:'抹香鲸',era:'现代',mass:2400,     tail:.85, wings:.7,  fluke:1.15,horn:.3, dorsal:.5, cilia:.12, armor:0,   jaw:.85,  snout:1.1, neck:.15, pleat:.65},
  {name:'蓝鲸',era:'现代',mass:3600,       tail:.8,  wings:.65, fluke:1.2,horn:.2,  dorsal:.4, cilia:.15, armor:0,   jaw:.8,   snout:1.2, neck:.1,  pleat:1}
];
// Distinct silhouettes for landmark fossils. Each signature peaks at its form index and
// fades over nearby forms via a gaussian, so the专属轮廓 slides in/out instead of popping.
// Peaks are exact form indices — mass now maps each fossil to its own index.
export const SIGNATURES=[
  {id:'trilobite',peak:7,spread:1.0},
  {id:'nautilus',peak:9,spread:1.0},
  {id:'plesiosaur',peak:16,spread:1.1},
  {id:'mosasaur',peak:19,spread:2.0},
  {id:'basilosaur',peak:22,spread:1.3}
];
export function signatureWeight(sig,form){const d=(form-sig.peak)/sig.spread;return Math.exp(-d*d*1.6);}
const KEYS=['tail','wings','fluke','horn','dorsal','cilia','armor','jaw','snout','neck','pleat'];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// Every fossil's own mass maps exactly to its own index (log interpolation between
// neighbours). The five gameplay thresholds are themselves milestone forms
// (8→0, 32→5, 100→10, 280→15, 700→20, 3600→24), so both goals hold at once.
const FORM_MASS=FORMS.map(f=>f.mass);
export function formIndexForMass(mass){
  const m=clamp(mass,FORM_MASS[0],FORM_MASS[FORM_MASS.length-1]);
  for(let i=0;i<FORM_MASS.length-1;i++){
    if(m<=FORM_MASS[i+1]){
      const t=Math.log(m/FORM_MASS[i])/Math.log(FORM_MASS[i+1]/FORM_MASS[i]);
      return i+t;
    }
  }
  return FORMS.length-1;
}
// Legacy stage 0..4 -> milestone form index, keeps preview buttons and bosses meaningful.
const STAGE_FORMS=[0,5,10,15,20];
export function stageToFormIndex(stage){return STAGE_FORMS[clamp(Math.round(stage),0,4)];}
// Blend the two neighbouring forms by the fractional index -> smooth, continuous growth.
export function formWeights(form){
  const i=clamp(form,0,FORMS.length-1),a=FORMS[Math.floor(i)],b=FORMS[Math.min(FORMS.length-1,Math.ceil(i))],t=i-Math.floor(i),out={};
  for(const k of KEYS)out[k]=a[k]+(b[k]-a[k])*t;
  out.name=t<.5?a.name:b.name;out.era=t<.5?a.era:b.era;
  return out;
}
function wingGeometry(side=1){
  const s=new THREE.Shape();s.moveTo(0,.5);s.bezierCurveTo(side*.5,.75,side*1.3,.65,side*1.9,-.2);s.quadraticCurveTo(side*1.4,-.1,side*.9,-.9);s.quadraticCurveTo(side*.4,-.65,0,-.5);
  const g=new THREE.ExtrudeGeometry(s,{depth:.055,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.035,bevelThickness:.025,curveSegments:10});g.rotateX(Math.PI/2);return g;
}
// ---- Signature anatomy builders: unique outlines for landmark fossils ----
function trilobiteShell(mat){
  const g=new THREE.Group();
  // Three longitudinal lobes made of overlapping articulated plates.
  for(const side of [-1,0,1]){
    for(let i=0;i<8;i++){
      const z=.95-i*.27,taper=1-Math.abs(z)*.35;
      const plate=new THREE.Mesh(new THREE.SphereGeometry(1,10,6),mat);
      plate.scale.set((side===0?.52:.34)*taper,.16,(.17)*taper);
      plate.position.set(side*(side===0?0:.42)*taper,.34,z);
      g.add(plate);
    }
  }
  // Head shield + tail pygidium.
  const head=new THREE.Mesh(new THREE.SphereGeometry(1,14,8),mat);head.scale.set(.85,.2,.42);head.position.set(0,.4,1.12);g.add(head);
  const tail=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),mat);tail.scale.set(.55,.16,.3);tail.position.set(0,.36,-1.12);g.add(tail);
  return g;
}
function nautilusShell(mat){
  const g=new THREE.Group();
  // Logarithmic spiral of widening chambers in the vertical plane.
  const chamberMat=new THREE.MeshStandardMaterial({color:0xdfe8cf,emissive:0x3c5a4e,emissiveIntensity:.3,roughness:.5,transparent:true,opacity:.8});
  let angle=0,radius=.16;
  for(let i=0;i<16;i++){
    const chamber=new THREE.Mesh(new THREE.TorusGeometry(radius,radius*.3,6,14),i%2?mat:chamberMat);
    chamber.position.set(Math.cos(angle)*radius*.7,.25+Math.sin(angle)*radius*.7,-.2);
    chamber.rotation.set(Math.PI/2,0,angle);
    g.add(chamber);angle+=.55;radius*=1.16;
  }
  // Tentacle crown at the opening.
  for(let i=0;i<8;i++){const a=i/8*Math.PI*2;const t=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0,0,.2),new THREE.Vector3(Math.cos(a)*.25,-.1,.5),new THREE.Vector3(Math.cos(a)*.4,-.2,.85)]),8,.028,4,false),mat);g.add(t);}
  return g;
}
function longNeck(mat){
  const g=new THREE.Group();
  // Barrel body with four broad paddles — the classic plesiosaur silhouette.
  const body=new THREE.Mesh(new THREE.SphereGeometry(1,16,10),mat);body.scale.set(.72,.42,1.05);body.position.set(0,0,-.15);g.add(body);
  const paddleMat=mat.clone();paddleMat.transparent=true;paddleMat.opacity=.8;
  for(const sx of [-1,1])for(const sz of [-1,1]){
    const paddle=new THREE.Mesh(new THREE.ConeGeometry(.3,1.5,4),paddleMat);
    paddle.position.set(sx*.9,-.1,sz*.65);paddle.rotation.z=sx*-Math.PI/2.3;paddle.rotation.x=sz*.3;
    paddle.scale.set(.55,1,.25);g.add(paddle);
  }
  // A long tapered neck reaching well ahead, with a small head.
  const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,.1,.7),new THREE.Vector3(0,.35,1.6),new THREE.Vector3(.05,.55,2.7),new THREE.Vector3(.1,.7,3.7)]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve,24,.17,8,false),mat));
  for(let i=1;i<=6;i++){const p=curve.getPoint(i/7),node=new THREE.Mesh(new THREE.SphereGeometry(1,10,6),mat);node.scale.setScalar(.2-i*.018);node.position.copy(p);g.add(node);}
  const head=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),mat);head.scale.set(.22,.17,.34);head.position.set(.1,.72,3.85);g.add(head);
  // Short tail.
  const tail=new THREE.Mesh(new THREE.ConeGeometry(.26,1.2,8),mat);tail.rotation.x=Math.PI/2;tail.position.set(0,0,-1.35);g.add(tail);
  return g;
}
function megaJawBody(mat){
  const g=new THREE.Group();
  // Elongated torso: a chain of narrowing segments stretching behind the head.
  for(let i=0;i<10;i++){const seg=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),mat);const k=i/9;seg.scale.set(.9-k*.5,.62-k*.3,.5);seg.position.set(0,0,.4-i*.42);g.add(seg);}
  // Massive articulated jaws: upper and lower arcs with visible teeth.
  const jawMat=new THREE.MeshStandardMaterial({color:0xe8f5da,emissive:0x3a5a48,emissiveIntensity:.35,roughness:.35,transparent:true,opacity:.9});
  for(const side of [1,-1]){
    const jaw=new THREE.Mesh(new THREE.TorusGeometry(.72,.09,6,20,Math.PI),jawMat);jaw.position.set(0,side>0?.2:-.18,1.0);jaw.rotation.set(Math.PI/2,0,side>0?0:Math.PI);g.add(jaw);
    for(let i=0;i<6;i++){const x=(i-2.5)*.22,tooth=new THREE.Mesh(new THREE.ConeGeometry(.05,.2,4),jawMat);tooth.position.set(x,side>0?.1:-.1,1.35-Math.abs(x)*.35);tooth.rotation.x=side>0?Math.PI:0;g.add(tooth);}
  }
  // Tail fluke.
  const fluke=new THREE.Mesh(new THREE.ConeGeometry(.7,1.6,3),mat);fluke.rotation.x=-Math.PI/2;fluke.position.set(0,-.05,-3.6);fluke.scale.set(1,.3,1);g.add(fluke);
  return g;
}
function basilosaurBody(mat){
  const g=new THREE.Group();
  // Long, snake-like body: a chain of bead-like vertebrae tapering to a small tail.
  for(let i=0;i<14;i++){const k=i/13,seg=new THREE.Mesh(new THREE.SphereGeometry(1,10,8),mat);seg.scale.set(.78-k*.5,.5-k*.28,.44);seg.position.set(0,0,.5-i*.5);g.add(seg);}
  // Small head at the front with a narrow snout.
  const head=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),mat);head.scale.set(.42,.32,.55);head.position.set(0,.05,1.15);g.add(head);
  const snout=new THREE.Mesh(new THREE.ConeGeometry(.26,1.0,8),mat);snout.rotation.x=Math.PI/2;snout.position.set(0,.02,1.75);g.add(snout);
  // Vestigial hind legs — the signature of Basilosaurus.
  for(const side of [-1,1]){
    const leg=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(side*.5,-.25,-2.0),new THREE.Vector3(side*.68,-.5,-2.2),new THREE.Vector3(side*.72,-.72,-2.45)]),8,.075,5,false),mat);g.add(leg);
    const foot=new THREE.Mesh(new THREE.SphereGeometry(1,8,6),mat);foot.scale.set(.13,.08,.18);foot.position.set(side*.72,-.74,-2.5);g.add(foot);
  }
  return g;
}
const SIGNATURE_BUILDERS={trilobite:trilobiteShell,nautilus:nautilusShell,plesiosaur:longNeck,mosasaur:megaJawBody,basilosaur:basilosaurBody};
export function createMorphology(bodyMaterial){
  const group=new THREE.Group(),sphere=new THREE.SphereGeometry(1,24,16),right=wingGeometry(1),left=wingGeometry(-1);
  const finMaterial=new THREE.MeshStandardMaterial({color:0x6cc3a6,emissive:0x143a30,emissiveIntensity:.25,roughness:.4,metalness:.1,transparent:true,opacity:.65,side:THREE.DoubleSide});
  const tailGeometry=new THREE.BufferGeometry(),tailRings=32,tailSides=12,indices=[];tailGeometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array((tailRings+1)*(tailSides+1)*3),3).setUsage(THREE.DynamicDrawUsage));for(let i=0;i<tailRings;i++)for(let j=0;j<tailSides;j++){const a=i*(tailSides+1)+j,b=a+tailSides+1;indices.push(a,b,a+1,b,b+1,a+1);}tailGeometry.setIndex(indices);const tail=new THREE.Mesh(tailGeometry,bodyMaterial);tail.frustumCulled=false;group.add(tail);
  const wings=new THREE.Group();for(const [index,geo]of [left,right].entries()){const wing=new THREE.Mesh(geo,finMaterial),side=index?1:-1;for(let j=0;j<3;j++){const curve=new THREE.QuadraticBezierCurve3(new THREE.Vector3(0,-.035,.25-j*.17),new THREE.Vector3(side*.8,-.035,.35-j*.3),new THREE.Vector3(side*(1.6-j*.32),-.035,-.15-j*.22));wing.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(18)),new THREE.LineBasicMaterial({color:0x306e5d,transparent:true,opacity:.45})));}wings.add(wing);}group.add(wings);
  const flukes=new THREE.Group();for(const geo of [left,right]){const m=new THREE.Mesh(geo,finMaterial);m.scale.setScalar(.45);flukes.add(m);}group.add(flukes);
  const horns=new THREE.Group();const hornMaterial=new THREE.MeshStandardMaterial({color:0xdaf5c8,emissive:0x346141,emissiveIntensity:.5,roughness:.3});
  for(const side of [-1,1]){const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(side*.45,.45,.45),new THREE.Vector3(side*.65,.8,.65),new THREE.Vector3(side*.7,1.15,.9)]),horn=new THREE.Mesh(new THREE.TubeGeometry(curve,12,.045,6,false),hornMaterial);horns.add(horn);}group.add(horns);
  const eyes=new THREE.Group(),eyeMaterial=new THREE.MeshBasicMaterial({color:0xdbffdc});for(const side of [-1,1]){const eye=new THREE.Mesh(sphere,eyeMaterial);eye.scale.set(.07,.04,.11);eye.position.set(side*.5,.35,.7);eyes.add(eye);}group.add(eyes);
  const dorsal=new THREE.Group();for(let i=0;i<4;i++){const m=new THREE.Mesh(new THREE.ConeGeometry(.18,.55,3),finMaterial);m.position.set(0,.45,-.6-i*.5);m.scale.z=1.6;dorsal.add(m);}group.add(dorsal);
  const cilia=new THREE.Group(),ciliaMat=new THREE.MeshBasicMaterial({color:0xa8f2d4,transparent:true,opacity:.5});for(let i=0;i<16;i++){const a=i/16*Math.PI*2,m=new THREE.Mesh(new THREE.ConeGeometry(.022,.34,4),ciliaMat);m.position.set(Math.cos(a)*.94,Math.sin(a*2)*.12,Math.sin(a)*.94);m.rotation.z=-Math.cos(a)*1.1;m.rotation.x=Math.sin(a)*1.1;cilia.add(m);}group.add(cilia);
  const armor=new THREE.Group(),armorMat=new THREE.MeshStandardMaterial({color:0xd3f0c5,emissive:0x2c5a48,emissiveIntensity:.35,roughness:.45,transparent:true,opacity:.7});for(let i=0;i<10;i++){const a=i/10*Math.PI*2,m=new THREE.Mesh(new THREE.IcosahedronGeometry(.24,0),armorMat);m.position.set(Math.cos(a)*.95,.08,Math.sin(a)*.95);m.scale.set(1,.65,.6);m.rotation.y=-a;armor.add(m);}group.add(armor);
  const jaw=new THREE.Group(),jawMat=new THREE.MeshStandardMaterial({color:0xe6f5d8,emissive:0x2c5a48,emissiveIntensity:.25,roughness:.4,transparent:true,opacity:.8});for(const side of [-1,1]){const m=new THREE.Mesh(new THREE.TorusGeometry(.52,.05,5,18,Math.PI),jawMat);m.position.set(0,side>0?.22:.02,.72);m.rotation.set(Math.PI/2,0,side>0?0:Math.PI);jaw.add(m);}group.add(jaw);
  const snout=new THREE.Mesh(new THREE.ConeGeometry(.32,1.1,8),bodyMaterial);snout.rotation.x=Math.PI/2;snout.position.set(0,0,1.05);group.add(snout);
  const neck=new THREE.Group();for(let i=0;i<5;i++){const m=new THREE.Mesh(sphere,bodyMaterial);m.scale.setScalar(.62-i*.07);m.position.set(0,-.04,-.9-i*.36);neck.add(m);}group.add(neck);
  const pleat=new THREE.Group(),pleatMat=new THREE.MeshBasicMaterial({color:0xbfe8d6,transparent:true,opacity:.32,side:THREE.DoubleSide,depthWrite:false});for(let i=0;i<7;i++){const side=i<4?1:-1,index=i<4?i:i-4,curve=new THREE.CatmullRomCurve3([new THREE.Vector3(side*(.12+index*.11),-.12,.72),new THREE.Vector3(side*(.18+index*.1),-.42,.45),new THREE.Vector3(side*(.14+index*.09),-.55,-.1)]);const m=new THREE.Mesh(new THREE.TubeGeometry(curve,10,.022,4,false),pleatMat);pleat.add(m);}group.add(pleat);
  const signatures={};for(const sig of SIGNATURES){const geo=SIGNATURE_BUILDERS[sig.id](bodyMaterial);signatures[sig.id]=geo;group.add(geo);}
  return{group,tail,tailRings,tailSides,wings,flukes,horns,eyes,dorsal,cilia,armor,jaw,snout,neck,pleat,signatures,finMaterial,weight:formWeights(0)};
}
// `form` is a continuous index across FORMS. Callers convert legacy stage via stageToFormIndex.
export function animateMorphology(m,form,t,moving=0){
  const s=formWeights(form);
  // Signature silhouettes take over near their landmark form; generic parts fade out.
  let sigStrength=0;
  for(const sig of SIGNATURES)sigStrength=Math.max(sigStrength,signatureWeight(sig,form));
  const generic=Math.max(0,1-Math.pow(sigStrength,.7)*1.25);
  const show=(obj,key,base=1)=>{const v=s[key]*generic;obj.visible=v>.02;obj.scale.setScalar(Math.max(.001,v*base));};
  const vis=(key)=>s[key]*generic>.02;
  m.tail.visible=vis('tail');m.flukes.visible=vis('fluke');m.wings.visible=vis('wings');m.horns.visible=vis('horn');m.eyes.visible=vis('tail')||vis('wings');m.dorsal.visible=vis('dorsal');
  show(m.cilia,'cilia');show(m.armor,'armor');show(m.jaw,'jaw');show(m.snout,'snout',.9);show(m.neck,'neck');show(m.pleat,'pleat');
  const length=(.4+s.tail*3.1)*generic,width=(.16+s.tail*.72)*generic;
  if(m.tail.visible){const p=m.tail.geometry.attributes.position;let index=0;for(let i=0;i<=m.tailRings;i++){const f=i/m.tailRings,rad=width*Math.pow(1-f*.93,.8),wave=Math.sin(t*(2+moving*.025)-f*3.5)*.18*f;for(let j=0;j<=m.tailSides;j++){const a=j/m.tailSides*Math.PI*2;p.setXYZ(index++,Math.cos(a)*rad+wave,Math.sin(a)*rad*.65,-.45-length*f);}}p.needsUpdate=true;m.tail.geometry.computeVertexNormals();}
  m.wings.children.forEach((wing,i)=>{wing.rotation.z=Math.sin(t*2+i*.2)*.075*(i?1:-1);wing.position.set(i?.3:-.3,-.12,s.wings>.6?-.2:0);wing.scale.setScalar((.6+s.wings*.55)*generic);});
  m.flukes.position.set(Math.sin(t*(2+moving*.025)-3.5)*.18,0,-length-.45);m.flukes.children.forEach(f=>f.scale.setScalar((.3+s.fluke*.55)*generic));m.flukes.rotation.z=Math.sin(t*2.2)*.07;
  m.dorsal.children.forEach((fin,i)=>fin.position.x=Math.sin(t*2-i*.7)*.08*i/3);
  m.neck.children.forEach((node,i)=>node.position.x=Math.sin(t*1.4-i*.5)*.08*(i+1)/5);
  m.pleat.children.forEach((p,i)=>p.rotation.y=Math.sin(t*1.6+i*.4)*.08);
  // Signature silhouettes fade in by gaussian weight around their landmark form.
  for(const sig of SIGNATURES){
    const w=signatureWeight(sig,form),geo=m.signatures[sig.id];
    geo.visible=w>.03;geo.scale.setScalar(Math.max(.001,w));
  }
  m.finMaterial.color.set(s.armor>.5?0xa8c47e:s.tail>.7?0x6ca7ad:0x6cc3a6);
  m.weight=s;
}
