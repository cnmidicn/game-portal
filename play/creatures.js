import * as THREE from './vendor/three.module.js';
import {makeCreatureLOD} from './lod.js';
// Creative Commons GLB creatures, loaded lazily and cached. See ASSET-CREDITS.md.
// Falls back to null when a model is missing so the procedural geometry still works.
const cache=new Map(),pending=new Map();

// One shared micro-detail pair supplies subtle normal/roughness variation to
// every scanned asset that shipped without those maps. It is procedural, tiny
// and only used to keep PBR highlights from reading as flat plastic.
let microTextures=null;
function microDetail(){
  if(microTextures)return microTextures;
  const size=64,nData=new Uint8Array(size*size*4),rData=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(y*size+x)*4,u=x/size*Math.PI*2,v=y/size*Math.PI*2;
    const ridge=Math.sin(u*11+Math.sin(v*4)*.9)*Math.cos(v*9);
    nData[i]=128+ridge*14;nData[i+1]=128+Math.sin(v*13+u*3)*12;nData[i+2]=250;nData[i+3]=255;
    const rough=176+ridge*22+Math.sin(u*5-v*7)*10;
    rData[i]=rData[i+1]=rData[i+2]=Math.max(96,Math.min(230,rough));rData[i+3]=255;
  }
  const make=(data)=>{const t=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(5,5);t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t;};
  microTextures={normal:make(nData),roughness:make(rData)};
  return microTextures;
}

function addVertexAO(root){
  const seen=new Set();
  root.traverse(o=>{
    if(!o.isMesh||!o.geometry||seen.has(o.geometry))return;
    seen.add(o.geometry);
    const pos=o.geometry.attributes.position;
    if(!pos)return;
    o.geometry.computeBoundingBox();
    const box=o.geometry.boundingBox,min=box.min.y,span=Math.max(.001,box.max.y-min);
    let color=o.geometry.attributes.color;
    if(!color){color=new THREE.Float32BufferAttribute(new Float32Array(pos.count*3),3);o.geometry.setAttribute('color',color);}
    for(let i=0;i<pos.count;i++){
      const h=(pos.getY(i)-min)/span;
      const ao=.72+.28*Math.min(1,Math.max(0,h));
      color.setXYZ(i,color.getX(i)*ao,color.getY(i)*ao,color.getZ(i)*ao);
    }
    color.needsUpdate=true;
    for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m)m.vertexColors=true;
  });
}

function addCornealGleam(root,name){
  if(!name.startsWith('cc0/real-')&&!name.includes('mosasaur'))return;
  const box=new THREE.Box3().setFromObject(root),size=box.getSize(new THREE.Vector3());
  if(!Number.isFinite(size.x)||size.x<.01)return;
  const mat=new THREE.MeshBasicMaterial({color:0xeaffff,transparent:true,opacity:.24,blending:THREE.AdditiveBlending,depthWrite:false});
  const geo=new THREE.SphereGeometry(1,8,6);
  for(const side of [-1,1]){
    const gleam=new THREE.Mesh(geo,mat);
    gleam.position.set(side*size.x*.16,box.max.y-size.y*.28,box.max.z-size.z*.04);
    gleam.scale.setScalar(Math.max(size.x,size.y,size.z)*.018);
    gleam.userData.sharedAsset=true;gleam.userData.cornealGleam=true;
    root.add(gleam);
  }
}
export const CREATURE_MODELS={
  trilobite:'trilobite',anomalocaris:'anomalocaris',ammonite:'ammonite',
  nautilus:'nautilus',dunkleosteus:'dunkleosteus',megalodon:'megalodon',
  mosasaur:'mosasaur',plesiosaur:'plesiosaur',basilosaurus:'basilosaurus',
  shark:'shark',coelacanth:'coelacanth',jellyfish:'jellyfish'
};
// Load a creature GLB. Names prefixed "cc0/" resolve under assets/creatures/cc0/
// for legally-sourced Creative Commons models (see ASSET-CREDITS.md).
export function loadCreature(name){
  // Always return a Promise: callers use .then(), and a cached wrapper returned
  // directly would throw on repeat period loads.
  if(cache.has(name))return Promise.resolve(cache.get(name));
  if(pending.has(name))return pending.get(name);
  const path=name.startsWith('cc0/')?`./assets/creatures/${name}.glb`:`./assets/creatures/${name}.glb`;
  const promise=new Promise(resolve=>{
    import('./vendor/loaders/GLTFLoader.js').then(({GLTFLoader})=>{
      const loader=new GLTFLoader();
      loader.load(path,gltf=>{
        const root=gltf.scene;
        // Normalize scale/orientation: centre on origin and fit within ~2 units.
        const box=new THREE.Box3().setFromObject(root),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
        const max=Math.max(size.x,size.y,size.z)||1,k=2/max;
        root.position.sub(center);root.scale.setScalar(k);
        // Mark cached asset meshes so period/scene disposal never frees the
        // shared geometry and materials still used by other instances.
        root.traverse(o=>{
          o.userData.sharedAsset=true;
          if(!o.isMesh)return;
          o.castShadow=true;o.receiveShadow=true;
          if(name==='coast_rocks'&&o.geometry?.attributes?.color){
            const colors=o.geometry.attributes.color;
            for(let i=0;i<colors.array.length;i++)colors.array[i]*=.48;
            colors.needsUpdate=true;
          }
          if(!o.material)return;
          const jelly=name.includes('jellyfish'),rock=name==='coast_rocks';
          const eye=/eye|cornea|pupil|lens/i.test(`${o.name||''} ${o.material?.name||''}`);
          const detail=microDetail();
          for(const m of (Array.isArray(o.material)?o.material:[o.material])){
            if('roughness' in m)m.roughness=eye?.075:jelly?.14:rock?.96:Math.max(.24,Math.min(.56,m.roughness??.46));
            if('metalness' in m)m.metalness=jelly||rock||eye?0:Math.min(.18,m.metalness??0);
            if('envMapIntensity' in m)m.envMapIntensity=eye?2.1:jelly?1.6:rock?.55:1.35;
            if('clearcoat' in m){m.clearcoat=eye?.95:jelly?.32:.26;m.clearcoatRoughness=eye?.06:jelly?.18:.24;}
            if(!eye&&!jelly&&o.geometry?.attributes?.uv){
              if(!m.normalMap){m.normalMap=detail.normal;if(m.normalScale)m.normalScale.set(.18,.18);}
              if(!m.roughnessMap)m.roughnessMap=detail.roughness;
            }
            if(eye&&m.color)m.color.lerp(new THREE.Color(0xffffff),.22);
            if(rock&&m.color)m.color.multiplyScalar(.52);
            if(jelly){m.side=THREE.DoubleSide;if('transmission' in m)m.transmission=.18;}
            m.needsUpdate=true;
          }
        });
        addVertexAO(root);
        addCornealGleam(root,name);
        const wrapper=makeCreatureLOD(root,name);wrapper.userData.model=root;wrapper.userData.ready=true;
        cache.set(name,wrapper);resolve(wrapper);
      },undefined,()=>{cache.set(name,null);resolve(null);});
    }).catch(()=>{cache.set(name,null);resolve(null);});
  });
  pending.set(name,promise);return promise;
}
export function hasCreature(name){return cache.get(name)?.userData?.ready===true;}

// Period-accurate fauna for the free-swimming life forms. kind 0 grazer,
// 1 hunter, 2 pulsing drifter, 3 armoured, 4 apex. Every entry is a real
// photographed/scanned model from ASSET-CREDITS.md — no procedural stand-ins.
const PERIOD_FAUNA={
  0:['cc0/real-sardina_pilchardus','cc0/real-gadus_morhua','cc0/jellyfish-real','cc0/real-raja_clavata','cc0/real-galeocerdo_cuvier','cc0/real-myctophum_punctatum','cc0/real-clupea_harengus'],
  1:['cc0/real-chaetodon_auriga','cc0/real-latimeria_chalumnae','cc0/jellyfish-real','cc0/real-ostracion_cubicum','cc0/real-pterois_volitans','cc0/real-lutjanus_kasmira','cc0/real-chauliodus_sloani'],
  2:['cc0/real-zebrasoma_flavescens','cc0/real-pagrus_major','cc0/jellyfish-real','cc0/real-hippocampus_kuda','cc0/real-thunnus_albacares','cc0/real-paracanthurus_hepatus','cc0/real-synchiropus_splendidus'],
  3:['cc0/real-clupea_harengus','cc0/real-sebastes_norvegicus','cc0/jellyfish-real','cc0/real-diodon_holocanthus','cc0/real-carcharodon_carcharias','cc0/real-anoplogaster_cornuta','cc0/real-makaira_nigricans'],
  4:['cc0/real-sardina_pilchardus','cc0/real-scomber_scombrus','cc0/jellyfish-real','cc0/real-mola_mola','cc0/real-prionace_glauca','cc0/real-coryphaena_hippurus','cc0/real-istiophorus_platypterus'],
  5:['cc0/real-katsuwonus_pelamis','cc0/real-salmo_salar','cc0/jellyfish-real','cc0/real-mobula_birostris','cc0/real-xiphias_gladius','cc0/real-myctophum_punctatum','cc0/real-zanclus_cornutus']
};
export function faunaModelFor(kind,periodIndex=0){
  const row=PERIOD_FAUNA[Math.max(0,Math.min(5,periodIndex|0))];
  return row[Math.max(0,Math.min(row.length-1,kind|0))]||row[0];
}
