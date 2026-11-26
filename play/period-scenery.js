import * as THREE from './vendor/three.module.js';
import {loadCreature} from './creatures.js';
import {createDunkleosteus} from './prehistoric-fauna.js';
import {groundY} from './seabed.js';
// Ancient-ocean scenery: every visible animal, plant-like colony and rock is a
// real CC0/CC BY GLB. Geometry here is limited to light-water atmosphere; no
// procedural creatures or plants are used any more.
const rand=(i,s=1)=>{const x=Math.sin(i*127.1+s*311.7)*43758.5453;return x-Math.floor(x);};
const TAU=Math.PI*2;

function tintClone(root,color,amount=.55){
  const target=new THREE.Color(color);
  root.traverse(o=>{
    if(!o.isMesh||!o.material)return;
    const tint=m=>{
      const c=m.clone();
      if(c.color)c.color.lerp(target,amount);
      if(c.emissive){c.emissive.lerp(target,.32);c.emissiveIntensity=Math.max(.30,c.emissiveIntensity??0);}
      if('roughness' in c)c.roughness=Math.max(.6,c.roughness??.7);
      c.userData.ownedMaterial=true;
      return c;
    };
    o.material=Array.isArray(o.material)?o.material.map(tint):tint(o.material);
    o.userData.ownedMaterial=true;
  });
  return root;
}

function addModel(group,anim,name,x,z,opts={}){
  return loadCreature(name).then(model=>{
    if(!model||!group.parent)return null;
    const clone=model.clone(true),scale=opts.scale??1;
    clone.position.set(x,opts.y??groundY(x,z,(opts.lift??.55)*scale),z);
    clone.rotation.set(opts.rx??0,opts.ry??rand(opts.seed??x+z,7)*TAU,opts.rz??0);
    clone.scale.setScalar(scale);
    if(opts.tint)tintClone(clone,opts.tint.color,opts.tint.amount);
    else tintClone(clone,0x9cc9cf,.18);
    // keep sharedAsset flags intact: geometry/materials belong to the cache.
    group.add(clone);
    if(opts.anim){
      anim.push({mesh:clone,type:opts.anim,phase:rand(opts.seed??x+z,13)*TAU,
        baseY:clone.position.y,baseX:x,baseZ:z,speed:.4+rand(opts.seed??x+z,17)*.35});
    }
    return clone;
  });
}

function scatter(group,anim,name,count,opts={}){
  const jobs=[];
  for(let i=0;i<count;i++){
    const a=rand(i+1,opts.seed??3)*TAU;
    const r=(opts.minR??34)+rand(i+1,(opts.seed??3)+1)*((opts.maxR??190)-(opts.minR??34));
    const x=Math.cos(a)*r,z=Math.sin(a)*r;
    jobs.push(addModel(group,anim,name,x,z,{...opts,i,seed:(opts.seed??3)*100+i}));
  }
  return Promise.all(jobs);
}

function seafloorFauna(group,anim,count=2){
  scatter(group,anim,'cc0/starfish-pycnopodia',count,{minR:24,maxR:150,scale:.75,lift:.5,seed:41});
  scatter(group,anim,'cc0/urchin-plagiobrissus',count,{minR:30,maxR:160,scale:.55,lift:.45,seed:47});
}

function animateScenery(anim,t,dt){
  const step=Math.min(.05,dt||.016);
  for(const a of anim){
    if(a.type==='orbit'){
      a.mesh.rotation.y+=step*.12;
      a.mesh.position.y=a.baseY+Math.sin(t*.4+a.phase)*.28;
    }else if(a.type==='drift'){
      a.mesh.position.y=a.baseY+Math.sin(t*.62+a.phase)*.34;
      a.mesh.rotation.y+=step*.08;
    }else if(a.type==='sway'){
      a.mesh.rotation.z=Math.sin(t*.5+a.phase)*.045;
    }else if(a.type==='rest'){
      a.mesh.rotation.y+=step*.012;
    }else if(a.type==='fall'){
      a.mesh.rotation.z=Math.sin(t*.14+a.phase)*.008;
    }
  }
}

function vents(){
  const g=new THREE.Group(),anim=[];
  // Low mineral chimneys and microbial colonies: all CC0 photogrammetry.
  scatter(g,anim,'coast_rocks',7,{minR:28,maxR:150,scale:3.2,lift:.62,seed:11,tint:{color:0x5b4a32,amount:.45}});
  scatter(g,anim,'cc0/hydrozoan-crypthelia-viridis',4,{minR:24,maxR:110,scale:1.9,lift:.55,anim:'sway',seed:13,tint:{color:0x4c8a65,amount:.35}});
  scatter(g,anim,'cc0/crab',2,{minR:28,maxR:80,scale:.62,lift:.42,seed:19});
  seafloorFauna(g,anim,1);
  return {group:g,animate:(t,dt)=>animateScenery(anim,t,dt)};
}

function trilobite(){
  const g=new THREE.Group(),anim=[];
  scatter(g,anim,'trilobite',6,{minR:18,maxR:110,scale:2.2,lift:.16,anim:'rest',seed:23});
  scatter(g,anim,'anomalocaris',2,{minR:24,maxR:60,y:3.2,scale:2.6,anim:'orbit',seed:29});
  scatter(g,anim,'cc0/coral-goniastrea',2,{minR:28,maxR:100,scale:1.35,lift:.55,seed:31});
  scatter(g,anim,'cc0/coral-porites-lobata',2,{minR:32,maxR:110,scale:1.3,lift:.55,seed:37});
  seafloorFauna(g,anim,2);
  return {group:g,animate:(t,dt)=>animateScenery(anim,t,dt)};
}

function reef(){
  const g=new THREE.Group(),anim=[];
  loadCreature('dunkleosteus').then(model=>{
    if(!model||!g.parent)return;
    for(let i=0;i<2;i++){
      const a=i*Math.PI+.7,r=20+i*11,fish=model.clone(true);
      fish.position.set(Math.cos(a)*r,2.4+i*.9,Math.sin(a)*r);
      fish.rotation.y=a;fish.scale.setScalar(2.2+i*.25);g.add(fish);
      anim.push({mesh:fish,type:'orbit',phase:i*2.1,baseY:fish.position.y});
    }
  }).catch(()=>{
    for(let i=0;i<2;i++){
      const fish=createDunkleosteus(),a=i*Math.PI+.7,r=20+i*11;
      fish.position.set(Math.cos(a)*r,2.4+i*.9,Math.sin(a)*r);
      fish.rotation.y=a;fish.scale.setScalar(2.2);g.add(fish);
      anim.push({mesh:fish,type:'orbit',phase:i*2.1,baseY:fish.position.y});
    }
  });
  scatter(g,anim,'cc0/real-latimeria_chalumnae',2,{minR:28,maxR:70,scale:1.7,anim:'drift',seed:43});
  scatter(g,anim,'cc0/real-carcharodon_carcharias',1,{minR:56,maxR:86,scale:2.2,anim:'orbit',seed:47});
  ['cc0/coral-goniastrea','cc0/coral-porites-lobata','cc0/coral-acropora','cc0/coral-madrepora','cc0/coral-pavonia','cc0/coral-manopora']
    .forEach((name,idx)=>scatter(g,anim,name,1,{minR:26,maxR:110,scale:2.1+idx*.1,lift:.58,seed:53+idx}));
  scatter(g,anim,'cc0/hydrozoan-distichopora-borealis',3,{minR:30,maxR:100,scale:1.9,lift:.55,anim:'sway',seed:61});
  seafloorFauna(g,anim,2);
  return {group:g,animate:(t,dt)=>animateScenery(anim,t,dt)};
}

function ammonite(){
  const g=new THREE.Group(),anim=[];
  scatter(g,anim,'coast_rocks',4,{minR:36,maxR:140,scale:3.6,lift:.62,seed:67});
  scatter(g,anim,'ammonite',6,{minR:18,maxR:90,scale:2.2,lift:.5,anim:'drift',seed:71});
  scatter(g,anim,'mosasaur',1,{minR:46,maxR:72,scale:2.6,y:4.2,anim:'orbit',seed:73});
  scatter(g,anim,'cc0/real-galeocerdo_cuvier',1,{minR:60,maxR:88,scale:2.0,y:5.4,anim:'orbit',seed:79});
  scatter(g,anim,'cc0/hydrozoan-distichopora-violacea',4,{minR:28,maxR:110,scale:1.8,lift:.55,anim:'sway',seed:83});
  seafloorFauna(g,anim,2);
  return {group:g,animate:(t,dt)=>animateScenery(anim,t,dt)};
}

function shoal(){
  const g=new THREE.Group(),anim=[];
  scatter(g,anim,'coast_rocks',3,{minR:48,maxR:150,scale:3.2,lift:.62,seed:89});
  scatter(g,anim,'cc0/whale',1,{minR:70,maxR:100,scale:3.6,y:6.5,anim:'orbit',seed:97});
  scatter(g,anim,'cc0/real-mobula_birostris',1,{minR:44,maxR:74,scale:2.7,y:5.0,anim:'orbit',seed:101});
  scatter(g,anim,'cc0/dolphin',1,{minR:54,maxR:84,scale:2.0,y:4.6,anim:'orbit',seed:103});
  scatter(g,anim,'cc0/real-thunnus_albacares',4,{minR:38,maxR:90,scale:1.3,anim:'orbit',seed:107});
  scatter(g,anim,'cc0/hydrozoan-crypthelia-viridis',3,{minR:36,maxR:110,scale:2.0,lift:.55,anim:'sway',seed:109});
  seafloorFauna(g,anim,2);
  return {group:g,animate:(t,dt)=>animateScenery(anim,t,dt)};
}

function whalefall(){
  const g=new THREE.Group(),anim=[];
  // Two real whale models resting on the abyssal floor, bleached to bone.
  scatter(g,anim,'cc0/whale',2,{minR:30,maxR:84,scale:3.0,lift:.42,rz:-Math.PI/2,anim:'fall',
    seed:113,tint:{color:0xd9d6c8,amount:.62}});
  ['cc0/real-himantolophus_groenlandicus','cc0/real-macropinna_microstoma','cc0/real-anoplogaster_cornuta','cc0/crab']
    .forEach((name,idx)=>scatter(g,anim,name,1,{minR:30,maxR:72,scale:idx===3?.8:1.45,
      lift:.45,anim:idx===3?'rest':'drift',seed:127+idx}));
  seafloorFauna(g,anim,2);
  // Sparse marine snow: atmosphere, not scenery.
  const count=90,pos=new Float32Array(count*3);
  for(let i=0;i<count;i++){pos[i*3]=(rand(i,211)-.5)*620;pos[i*3+1]=(rand(i,213)-.5)*26;pos[i*3+2]=(rand(i,217)-.5)*620;}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
  const snow=new THREE.Points(geo,new THREE.PointsMaterial({color:0xa8cfe0,size:.16,transparent:true,opacity:.14,depthWrite:false,blending:THREE.AdditiveBlending}));
  g.add(snow);
  return {group:g,animate:(t,dt)=>animateScenery(anim,t,dt)};
}

const BUILDERS={vents,trilobite,reef,ammonite,shoal,whalefall};
// Two or three readable near-field specimens per era. They are real GLBs and
// stay sparse; the rest of the sea remains deliberately open water.
const HERO={
  vents:[['coast_rocks',-16,-8,{scale:3.8,lift:.62}],['cc0/hydrozoan-crypthelia-viridis',14,10,{scale:2.6,lift:.55}]],
  trilobite:[['trilobite',-15,-8,{scale:3.6,lift:.16}],['anomalocaris',-11,13,{scale:3.0,y:4.2}]],
  reef:[['dunkleosteus',-16,-10,{scale:3.2,y:3.2}],['cc0/coral-acropora',14,-8,{scale:2.8,lift:.58}],['cc0/hydrozoan-distichopora-borealis',12,12,{scale:2.4,lift:.55}]],
  ammonite:[['ammonite',-15,-8,{scale:3.4,lift:.5}],['ammonite',13,-11,{scale:3.1,lift:.5}],['mosasaur',-19,10,{scale:3.2,y:5.2}]],
  shoal:[['cc0/whale',-21,-14,{scale:4.2,y:7.2}],['cc0/real-mobula_birostris',16,-8,{scale:3.2,y:5.2}]],
  whalefall:[['cc0/whale',-16,-10,{scale:3.8,lift:.42,rz:-Math.PI/2,tint:{color:0xd9d6c8,amount:.62}}]]
};
export function buildPeriodScenery(period){
  const build=BUILDERS[period.scene]||reef,result=build(period);
  for(const [name,x,z,opts] of HERO[period.scene]||[])addModel(result.group,[],name,x,z,opts);
  result.group.userData.disposable=true;
  return result;
}
export function disposeScenery(result){
  if(!result)return;
  const mats=new Set(),geos=new Set();
  result.group.traverse(o=>{
    if(o.userData.ownedMaterial&&o.material){
      for(const m of (Array.isArray(o.material)?o.material:[o.material]))mats.add(m);
    }
    if(o.userData.sharedAsset)return;
    if(o.material){for(const m of (Array.isArray(o.material)?o.material:[o.material]))mats.add(m);}
    if(o.geometry)geos.add(o.geometry);
  });
  for(const m of mats)m.dispose();
  for(const geo of geos)geo.dispose();
  result.group.parent?.remove(result.group);
}
