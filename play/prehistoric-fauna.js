import * as THREE from './vendor/three.module.js';
// Detailed procedural reconstructions used as fallback when GLB assets fail to load.
// These are far more anatomically specific than the generic cell+parts morphology.

export function createDunkleosteus(){
  const g=new THREE.Group();
  const armor=new THREE.MeshStandardMaterial({color:0x7b8d8a,emissive:0x243835,emissiveIntensity:.35,roughness:.42,metalness:.22,transparent:true,opacity:.94});
  const plate=new THREE.MeshStandardMaterial({color:0xa8b8a4,emissive:0x30483f,emissiveIntensity:.3,roughness:.35,metalness:.28,transparent:true,opacity:.96});
  const body=new THREE.MeshStandardMaterial({color:0x4d6b67,emissive:0x182e2c,emissiveIntensity:.3,roughness:.55,transparent:true,opacity:.85});
  const eyeMat=new THREE.MeshStandardMaterial({color:0xe8f5d8,emissive:0x688850,emissiveIntensity:.7,roughness:.2});
  // Streamlined torso, tapering to the tail.
  for(let i=0;i<12;i++){
    const k=i/11,seg=new THREE.Mesh(new THREE.SphereGeometry(1,14,10),body);
    seg.scale.set(.95-k*.6,.62-k*.35,.55);seg.position.set(0,-k*.06,.7-i*.42);g.add(seg);
  }
  // Massive armored head shield: overlapping bony plates.
  const head=new THREE.Mesh(new THREE.SphereGeometry(1,18,14),armor);
  head.scale.set(1.15,.9,1.05);head.position.set(0,.08,1.5);g.add(head);
  const crest=new THREE.Mesh(new THREE.SphereGeometry(1,14,10),plate);
  crest.scale.set(1.1,.22,.72);crest.position.set(0,.72,1.45);g.add(crest);
  for(const side of [-1,1]){
    const cheek=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),plate);
    cheek.scale.set(.32,.6,.75);cheek.position.set(side*.92,.05,1.45);g.add(cheek);
    const eye=new THREE.Mesh(new THREE.SphereGeometry(.16,12,8),eyeMat);
    eye.position.set(side*.82,.42,1.95);g.add(eye);
    // Blade-like bony jaws instead of teeth — the signature of Dunkleosteus.
    const blade=new THREE.Mesh(new THREE.ConeGeometry(.22,1.45,4),plate);
    blade.rotation.x=Math.PI/2;blade.position.set(side*.38,-.32,2.15);blade.scale.z=.35;g.add(blade);
  }
  const jaw=new THREE.Mesh(new THREE.TorusGeometry(.62,.13,6,18,Math.PI),plate);
  jaw.position.set(0,-.3,1.85);jaw.rotation.set(Math.PI/2,0,0);g.add(jaw);
  // Thoracic armour rings.
  for(let i=0;i<4;i++){
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.9-i*.12,.1,6,16),plate);
    ring.rotation.x=Math.PI/2;ring.position.set(0,0,.5-i*.42);g.add(ring);
  }
  // Dorsal fin and tail.
  const dorsal=new THREE.Mesh(new THREE.ConeGeometry(.4,1.3,3),body);
  dorsal.position.set(0,.62,-1.2);dorsal.scale.z=1.6;g.add(dorsal);
  const tail=new THREE.Mesh(new THREE.ConeGeometry(.72,1.9,3),body);
  tail.rotation.x=-Math.PI/2;tail.position.set(0,0,-4.35);tail.scale.set(1,.3,1);g.add(tail);
  return g;
}

export function createMosasaur(){
  const g=new THREE.Group();
  const skin=new THREE.MeshStandardMaterial({color:0x3f6f70,emissive:0x142f31,emissiveIntensity:.32,roughness:.55,transparent:true,opacity:.9});
  const belly=new THREE.MeshStandardMaterial({color:0x9fb8a6,emissive:0x324a40,emissiveIntensity:.25,roughness:.6,transparent:true,opacity:.85});
  const teeth=new THREE.MeshStandardMaterial({color:0xe8f0d8,emissive:0x5a7050,emissiveIntensity:.4,roughness:.3});
  const eyeMat=new THREE.MeshStandardMaterial({color:0xf0e0a0,emissive:0x8a7a30,emissiveIntensity:.7,roughness:.2});
  // Long sinuous body: tapering vertebrae chain.
  for(let i=0;i<18;i++){
    const k=i/17,seg=new THREE.Mesh(new THREE.SphereGeometry(1,12,10),skin);
    const w=.85-Math.sin(k*Math.PI)*.18-k*.42;
    seg.scale.set(w,.52-k*.22,.5);seg.position.set(Math.sin(k*3)*.28,k*.12,.9-i*.48);g.add(seg);
    const vent=new THREE.Mesh(new THREE.SphereGeometry(1,10,8),belly);
    vent.scale.set(w*.7,.2,.42);vent.position.set(Math.sin(k*3)*.28,-.28+k*.1,.9-i*.48);g.add(vent);
  }
  // Enormous elongated jaws with conical teeth.
  const skull=new THREE.Mesh(new THREE.SphereGeometry(1,16,12),skin);
  skull.scale.set(.62,.5,1.5);skull.position.set(0,.12,1.7);g.add(skull);
  const upper=new THREE.Mesh(new THREE.ConeGeometry(.42,2.6,8),skin);
  upper.rotation.x=Math.PI/2;upper.position.set(0,.02,3.0);upper.scale.z=.5;g.add(upper);
  const lower=new THREE.Mesh(new THREE.ConeGeometry(.38,2.4,8),belly);
  lower.rotation.x=Math.PI/2;lower.position.set(0,-.35,2.95);lower.scale.z=.5;g.add(lower);
  for(const side of [-1,1]){
    const eye=new THREE.Mesh(new THREE.SphereGeometry(.13,10,8),eyeMat);
    eye.position.set(side*.46,.32,2.15);g.add(eye);
    for(let i=0;i<8;i++){
      const tooth=new THREE.Mesh(new THREE.ConeGeometry(.07,.32,5),teeth);
      tooth.position.set(side*(.28-i*.02),-.12,1.9+i*.28);tooth.rotation.x=Math.PI;g.add(tooth);
    }
  }
  // Four paddle-like flippers.
  for(const sx of [-1,1])for(const sz of [1,-1]){
    const flipper=new THREE.Mesh(new THREE.ConeGeometry(.34,1.9,6),skin);
    flipper.position.set(sx*.85,-.2,sz>0?-.2:-3.2);
    flipper.rotation.z=sx*-Math.PI/2.4;flipper.rotation.x=sz*.3;
    flipper.scale.set(.7,1,.3);g.add(flipper);
  }
  // Fish-like vertical tail fluke.
  const fluke=new THREE.Mesh(new THREE.ConeGeometry(.9,2.2,3),skin);
  fluke.rotation.x=-Math.PI/2;fluke.position.set(0,.1,-8.4);fluke.scale.set(1,.35,1);g.add(fluke);
  return g;
}
