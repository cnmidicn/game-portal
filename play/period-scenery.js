import * as THREE from './vendor/three.module.js';
import {loadCreature} from './creatures.js';
import {createDunkleosteus} from './prehistoric-fauna.js';
import {groundY} from './seabed.js';
// Procedural, era-specific scenery. Each builder returns a Group plus an `animate(t,beat)`
// callback; swapping periods disposes the old group and rebuilds the new one.
const rand=(i,s=1)=>{const x=Math.sin(i*127.1+s*311.7)*43758.5453;return x-Math.floor(x);};
const ring=(r=1,color=0x9ff5dd,opacity=.4)=>new THREE.Mesh(
  new THREE.TorusGeometry(r,.02,4,32),new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending}));

function vents(period){
  const g=new THREE.Group(),anim=[];
  const glow=new THREE.MeshStandardMaterial({color:0xffa05a,emissive:0xff6a20,emissiveIntensity:1.1,roughness:.6,transparent:true,opacity:.85});
  const mat=new THREE.MeshBasicMaterial({color:0xffb878,transparent:true,opacity:.22,depthWrite:false,blending:THREE.AdditiveBlending});
  // Real CC0 photogrammetry rocks replace the former tapered cone chimneys.
  loadCreature('coast_rocks').then(model=>{
    if(!model||!g.parent)return;
    for(let i=0;i<16;i++){
      const a=rand(i)*6.28,r=32+rand(i,2)*190,x=Math.cos(a)*r,z=Math.sin(a)*r;
      const rock=model.clone(true);rock.rotation.set(0,rand(i,6)*6.28,0);
      const scale=2.4+rand(i,3)*2.6;rock.scale.setScalar(scale);
      rock.position.set(x,groundY(x,z,scale*.62),z);g.add(rock);
    }
  });
  for(let i=0;i<16;i++){
    const a=rand(i)*6.28,r=32+rand(i,2)*190,x=Math.cos(a)*r,z=Math.sin(a)*r;
    const floor=groundY(x,z);
    const vent=new THREE.Mesh(new THREE.SphereGeometry(.5,10,8),glow);vent.position.set(x,floor+1.2+rand(i,7)*3,z);g.add(vent);
    // Rising mineral smoke plume.
    for(let j=0;j<3;j++){const puff=new THREE.Mesh(new THREE.SphereGeometry(.9+j*.5,8,6),mat.clone());puff.position.set(x,floor+2+j*2,z);g.add(puff);anim.push({mesh:puff,base:x,z,phase:rand(i*9+j)*6.28,speed:.5+rand(i*7+j)*.6,type:'smoke'});}
    // Microbial mat carpeting the actual seabed relief.
    const matDisc=new THREE.Mesh(new THREE.CircleGeometry(3+rand(i,8)*4,16),new THREE.MeshBasicMaterial({color:period.kelp,transparent:true,opacity:.28,side:THREE.DoubleSide,depthWrite:false}));
    matDisc.rotation.x=-Math.PI/2;matDisc.position.set(x,floor+.06,z);g.add(matDisc);
  }
  addSeafloorFauna(g,3);
  // Vent crabs clustered around the mineral chimneys.
  loadCreature('cc0/crab').then(model=>{
    if(!model||!g.parent)return;
    for(let i=0;i<7;i++){
      const a=rand(i,19)*6.28,r=32+rand(i,23)*140,crab=model.clone(true);
      const scale=.5+rand(i,29)*.3;crab.scale.setScalar(scale);
      const x=Math.cos(a)*r,z=Math.sin(a)*r;
      crab.position.set(x,groundY(x,z,scale*.42),z);crab.rotation.y=a;g.add(crab);
    }
  });
  return {group:g,animate:(t)=>{for(const a of anim){const p=(t*a.speed+a.phase)%6;a.mesh.position.y=-1+p*1.4;a.mesh.scale.setScalar(.5+p*.5);a.mesh.material.opacity=Math.max(0,.22-p*.035);}}};
}

function trilobite(period){
  const g=new THREE.Group(),anim=[];
  // CC0 trilobite fossil model gliding through the near field.
  loadCreature('trilobite').then(model=>{
    if(!model)return;
    for(let i=0;i<3;i++){
      const a=i/3*6.28+.4,r=20+i*7,clone=model.clone(true);
      clone.position.set(Math.cos(a)*r,-1.4+i*.5,Math.sin(a)*r);
      clone.rotation.y=a;clone.scale.setScalar(1.6+i*.25);g.add(clone);
      anim.push({mesh:clone,phase:i*1.4,type:'drift'});
    }
  });
  // Anomalocaris: the Cambrian apex predator circling the trilobite beds.
  loadCreature('anomalocaris').then(model=>{
    if(!model)return;
    for(let i=0;i<2;i++){
      const a=i*3.14+1.1,r=26+i*12,clone=model.clone(true);
      clone.position.set(Math.cos(a)*r,2+i*2,Math.sin(a)*r);
      clone.rotation.y=a;clone.scale.setScalar(2.2+i*.5);g.add(clone);
      anim.push({mesh:clone,phase:i*2.1,type:'hunter'});
    }
  });
  const shellMat=new THREE.MeshStandardMaterial({color:0x8fb98a,emissive:0x2c4e3a,emissiveIntensity:.4,roughness:.6,transparent:true,opacity:.85});
  for(let i=0;i<22;i++){
    const a=rand(i)*6.28,r=30+rand(i,2)*190,x=Math.cos(a)*r,z=Math.sin(a)*r;
    // Trilobite: three lobes of articulated plates, resting on the seabed.
    const bug=new THREE.Group();const scale=.7+rand(i,3)*1.1;
    for(const side of [-1,0,1])for(let k=0;k<7;k++){
      const seg=new THREE.Mesh(new THREE.SphereGeometry(1,8,6),shellMat);
      seg.scale.set((side===0?.42:.28)*scale,.12*scale,.16*scale);
      seg.position.set(side*(side===0?0:.38)*scale,.1*scale,(1.1-k*.34)*scale);bug.add(seg);
    }
    bug.position.set(x,groundY(x,z,.16),z);bug.rotation.y=rand(i,4)*6.28;g.add(bug);
    anim.push({mesh:bug,phase:rand(i,5)*6.28,type:'bug'});
  }
  // Real Smithsonian coral scans replace the former cylinder "sponges".
  ['cc0/coral-goniastrea','cc0/coral-porites-lobata','cc0/coral-pavonia'].forEach((name,idx)=>loadCreature(name).then(model=>{
    if(!model||!g.parent)return;
    for(let i=idx;i<22;i+=3){
      const a=rand(i)*6.28,r=30+rand(i,2)*190,x=Math.cos(a)*r,z=Math.sin(a)*r;
      const colony=model.clone(true);const cx=x+2,cz=z+1;
      const scale=.7+rand(i,idx+23)*.5;colony.scale.setScalar(scale);
      colony.position.set(cx,groundY(cx,cz,scale*.55),cz);
      colony.rotation.y=rand(i,idx+19)*6.28;g.add(colony);
    }
  }));
  return {group:g,animate:(t)=>{for(const a of anim){if(a.type==='hunter'){a.mesh.rotation.y+=.0022;a.mesh.position.y+=Math.sin(t*.5+a.phase)*.006;}else if(a.type==='drift'){a.mesh.position.y+=Math.sin(t*.8+a.phase)*.003;a.mesh.rotation.y+=.0008;}else a.mesh.rotation.y=Math.sin(t*.25+a.phase)*.12;}}};
}

function reef(period){
  const g=new THREE.Group(),anim=[];
  // Dunkleosteus: CC BY armoured placoderm (baked GLB) patrolling the reef.
  // Falls back to detailed procedural anatomy if the asset cannot be loaded.
  const placeFish=(model)=>{
    if(!model)return;
    for(let i=0;i<2;i++){
      const a=i/2*6.28+.7,r=19+i*9,clone=model.clone(true);
      clone.position.set(Math.cos(a)*r,1.2+i*.7,Math.sin(a)*r);
      clone.rotation.y=a;clone.scale.setScalar(2.1+i*.3);g.add(clone);
      anim.push({mesh:clone,phase:i*2,type:'hunter'});
    }
  };
  loadCreature('dunkleosteus').then(model=>{
    if(model)placeFish(model);
    else for(let i=0;i<2;i++){
      const fish=createDunkleosteus(),a=i/2*6.28+.7,r=19+i*9;
      fish.position.set(Math.cos(a)*r,1.2+i*.7,Math.sin(a)*r);
      fish.rotation.y=a;fish.scale.setScalar(2.1+i*.3);g.add(fish);
      anim.push({mesh:fish,phase:i*2,type:'hunter'});
    }
  });
  // Creative Commons reef companions (Quaternius CC0): large pelagic animals
  // plus a much wider range of reef fish circling above the coral gardens.
  const companions=['cc0/real-mobula_birostris','cc0/manta','cc0/dolphin','cc0/real-carcharodon_carcharias','cc0/whale','cc0/real-xiphias_gladius','cc0/real-thunnus_albacares','cc0/real-coryphaena_hippurus','cc0/real-epinephelus_lanceolatus','cc0/real-zanclus_cornutus'];
  companions.forEach((name,idx)=>{
    loadCreature(name).then(model=>{
      if(!model||!g.parent)return;
      const big=idx<4;
      for(let k=0;k<(big?1:2);k++){
        const a=idx/companions.length*6.28+k*3.141+.4,r=(big?40:28)+k*16+(idx%3)*6;
        const clone=model.clone(true);
        clone.position.set(Math.cos(a)*r,2+idx*.35+k*.6,Math.sin(a)*r);
        clone.rotation.y=a;clone.scale.setScalar(big?1.7+idx*.12:1.1+idx*.04);
        g.add(clone);anim.push({mesh:clone,type:'hunter',phase:idx+k,orbit:a,radius:r});
      }
    });
  });
  // Real CC0 Smithsonian photogrammetry coral scans replace the old cylinder branches.
  const coralSpecies=['coral-goniastrea','coral-porites-lobata','coral-acropora','coral-madrepora','coral-sideropora','coral-pavonia','coral-leptoseris','coral-manopora'];
  coralSpecies.forEach(name=>loadCreature('cc0/'+name).then(model=>{
    if(!model||!g.parent)return;
    for(let k=0;k<3;k++){
      // Put the first few heads within the player's neighbourhood so the reef is visible.
      const a=rand(k,name.length)*6.28,r=k<1?22+rand(k,name.length+2)*24:56+rand(k,name.length+2)*160;
      const colony=model.clone(true);
      // loadCreature() normalises every GLB to ~2 units; a small multiplier
      // yields a 3-6m reef head at world scale.
      const scale=1.6+rand(k,name.length+6)*1.4;colony.scale.setScalar(scale);
      const x=Math.cos(a)*r,z=Math.sin(a)*r;
      colony.position.set(x,groundY(x,z,scale*.58),z);
      colony.rotation.y=rand(k,name.length+4)*6.28;
      g.add(colony);anim.push({mesh:colony,phase:rand(k,name.length+8)*6.28,type:'sway'});
    }
  }));
  addSeafloorFauna(g,3);
  // Small reef fish sheltering inside the coral colonies.
  const reefFish=['cc0/real-chaetodon_auriga','cc0/real-zebrasoma_flavescens','cc0/real-pomacanthus_imperator','cc0/real-pterois_volitans','cc0/real-synchiropus_splendidus','cc0/real-paracanthurus_hepatus'];
  reefFish.forEach((name,idx)=>loadCreature(name).then(model=>{
    if(!model||!g.parent)return;
    for(let k=0;k<3;k++){
      const a=rand(k,idx+3)*6.28,r=32+rand(k,idx+9)*80,clone=model.clone(true);
      clone.position.set(Math.cos(a)*r,-1+rand(k,idx+5)*4,Math.sin(a)*r);
      clone.rotation.y=a;clone.scale.setScalar(.75+rand(k,idx+7)*.45);g.add(clone);
      anim.push({mesh:clone,type:'hunter',phase:k*.9+idx});
    }
  }));
  return {group:g,animate:(t)=>{for(const a of anim){if(a.type==='hunter'){a.mesh.rotation.y+=.002;a.mesh.position.y+=Math.sin(t*.5+a.phase)*.008;}else a.mesh.rotation.z=Math.sin(t*.6+a.phase)*.04;}}};
}

// Real CC0 Smithsonian photogrammetry seafloor animals (sun star + sea urchin).
function addSeafloorFauna(g,count){
  ['starfish-pycnopodia','urchin-plagiobrissus'].forEach((name,idx)=>loadCreature('cc0/'+name).then(model=>{
    if(!model||!g.parent)return;
    for(let i=0;i<count;i++){
      const a=rand(i,idx*13+41)*6.28,r=i<2?16+rand(i,idx*17+53)*18:40+rand(i,idx*17+53)*130;
      const animal=model.clone(true);
      const scale=idx===0?.7+rand(i,61)*.5:.5+rand(i,67)*.4;animal.scale.setScalar(scale);
      const x=Math.cos(a)*r,z=Math.sin(a)*r;
      animal.position.set(x,groundY(x,z,scale*.5),z);
      animal.rotation.y=rand(i,idx*19+7)*6.28;
      g.add(animal);
    }
  }));
}

// CC0 photogrammetry rocks (Poly Haven / coast_rocks_01), baked to vertex colors.
function addCC0Rocks(g,count){
  loadCreature('coast_rocks').then(model=>{
    if(!model)return;
    for(let i=0;i<count;i++){
      const a=i/count*6.28+.45,r=36+i*13,rock=model.clone(true);
      const scale=7+i*.5;rock.scale.setScalar(scale);
      const x=Math.cos(a)*r,z=Math.sin(a)*r;
      rock.position.set(x,groundY(x,z,scale*.62),z);
      rock.rotation.set(0,a*.7,0);
      g.add(rock);
    }
  });
}

function ammonite(period){
  const g=new THREE.Group(),anim=[];
  addCC0Rocks(g,5);
  addSeafloorFauna(g,3);
  // Mosasaurus GLB: giant Cretaceous marine reptile hunting among the ammonites.
  loadCreature('mosasaur').then(model=>{
    if(!model)return;
    for(let i=0;i<2;i++){
      const a=i*3.14+.8,r=18+i*7,beast=model.clone(true);
      beast.position.set(Math.cos(a)*r,2.5+i*1.2,Math.sin(a)*r);
      beast.rotation.y=a;beast.scale.setScalar(1.9+i*.3);g.add(beast);
      anim.push({mesh:beast,phase:i*2.4,type:'hunter'});
    }
  });
  // CC BY ammonites with accurate spiral shells drift through the Mesozoic sea.
  loadCreature('ammonite').then(model=>{
    if(!model)return;
    for(let i=0;i<4;i++){
      const a=i/4*6.28+.6,r=21+i*8,clone=model.clone(true);
      clone.position.set(Math.cos(a)*r,-.5+i*.7,Math.sin(a)*r);
      clone.rotation.y=a;clone.scale.setScalar(1.8+i*.2);g.add(clone);
      anim.push({mesh:clone,phase:i*1.2,type:'drift'});
    }
  });
  // Open-ocean fish sharing the ammonite seas with the mosasaurs.
  ['cc0/real-thunnus_albacares','cc0/real-xiphias_gladius','cc0/real-galeocerdo_cuvier','cc0/real-himantolophus_groenlandicus'].forEach((name,idx)=>loadCreature(name).then(model=>{
    if(!model||!g.parent)return;
    for(let k=0;k<2;k++){
      const a=idx*1.57+k*3.14+.5,r=40+k*22,clone=model.clone(true);
      clone.position.set(Math.cos(a)*r,3+idx*1.3,Math.sin(a)*r);
      clone.rotation.y=a;clone.scale.setScalar(1.2+idx*.12);g.add(clone);
      anim.push({mesh:clone,type:'hunter',phase:idx+k});
    }
  }));
  const shellMat=new THREE.MeshStandardMaterial({color:0xe0c9a0,emissive:0x4a3a26,emissiveIntensity:.35,roughness:.5,transparent:true,opacity:.85,side:THREE.DoubleSide});
  for(let i=0;i<18;i++){
    const a=rand(i)*6.28,r=34+rand(i,2)*190,x=Math.cos(a)*r,z=Math.sin(a)*r;
    // Ammonite: a logarithmic spiral of widening chambers.
    const spiral=new THREE.Group();let ang=0,rad=.2;
    for(let k=0;k<14;k++){const c=new THREE.Mesh(new THREE.TorusGeometry(rad,rad*.32,5,12),shellMat);c.position.set(Math.cos(ang)*rad*.7,0,Math.sin(ang)*rad*.7);c.rotation.x=Math.PI/2;c.rotation.z=ang;spiral.add(c);ang+=.52;rad*=1.15;}
    spiral.position.set(x,-2+rand(i,3)*6,z);spiral.rotation.set(rand(i,4)*.6,rand(i,5)*6.28,rand(i,6)*.5);g.add(spiral);
    anim.push({mesh:spiral,phase:rand(i,7)*6.28,type:'float'});
  }
  // Real Smithsonian hydrozoan scans replace the former stem-and-ball sea lilies.
  const flora=['cc0/hydrozoan-distichopora-borealis','cc0/hydrozoan-distichopora-violacea','cc0/hydrozoan-crypthelia-viridis'];
  flora.forEach((name,idx)=>loadCreature(name).then(model=>{
    if(!model||!g.parent)return;
    for(let i=idx;i<18;i+=3){
      const a=rand(i)*6.28,r=34+rand(i,2)*190,x=Math.cos(a)*r,z=Math.sin(a)*r;
      const plant=model.clone(true);const px=x+2,pz=z+1;
      const scale=.8+rand(i,idx+37)*.7;plant.scale.setScalar(scale);
      plant.position.set(px,groundY(px,pz,scale*.55),pz);
      plant.rotation.y=rand(i,idx+31)*6.28;g.add(plant);
    }
  }));
  return {group:g,animate:(t)=>{for(const a of anim){if(a.type==='hunter'){a.mesh.rotation.y+=.0018;a.mesh.position.y+=Math.sin(t*.4+a.phase)*.007;}else if(a.type==='drift'){a.mesh.position.y+=Math.sin(t*.6+a.phase)*.004;a.mesh.rotation.y+=.001;}else{a.mesh.position.y+=Math.sin(t*.5+a.phase)*.003;a.mesh.rotation.y+=.0006;}}}};
}

function shoal(period){
  const g=new THREE.Group(),anim=[];
  addCC0Rocks(g,4);
  addSeafloorFauna(g,3);
  // Mosasaurus GLB cruising the giant-kelp shoals of the age of sea monsters.
  loadCreature('mosasaur').then(model=>{
    if(!model)return;
    const beast=model.clone(true);beast.position.set(-22,3,-18);beast.rotation.y=1.2;beast.scale.setScalar(2.1);g.add(beast);
    anim.push({mesh:beast,phase:0,type:'hunter'});
  });
  // Real Smithsonian hydrozoan scans replace the old procedural kelp ribbons.
  const flora=['cc0/hydrozoan-distichopora-borealis','cc0/hydrozoan-distichopora-violacea','cc0/hydrozoan-crypthelia-viridis'];
  flora.forEach((name,idx)=>loadCreature(name).then(model=>{
    if(!model||!g.parent)return;
    for(let i=0;i<6;i++){
      const a=(i+idx*.27)*2.399,r=32+rand(i,idx+2)*195,x=Math.cos(a)*r,z=Math.sin(a)*r;
      const plant=model.clone(true);plant.rotation.y=rand(i,idx+4)*6.28;
      const scale=1.6+rand(i,idx+6)*1.6;plant.scale.setScalar(scale);
      plant.position.set(x,groundY(x,z,scale*.55),z);g.add(plant);
      anim.push({mesh:plant,phase:rand(i,idx+8)*6.28,type:'sway'});
    }
  }));
  // Bait balls: dense swirling point shoals, now with real CC0 Quatnius fish models circling inside.
  for(let s=0;s<6;s++){
    const count=40+Math.floor(rand(s,9)*40),pos=new Float32Array(count*3);
    for(let i=0;i<count;i++){const th=rand(i,s)*6.28,ph=Math.acos(2*rand(i,s+3)-1),rr=Math.cbrt(rand(i,s+5))*9;pos[i*3]=Math.sin(ph)*Math.cos(th)*rr;pos[i*3+1]=Math.cos(ph)*rr*.5;pos[i*3+2]=Math.sin(ph)*Math.sin(th)*rr;}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
    const pts=new THREE.Points(geo,new THREE.PointsMaterial({color:s%2?0xd8f0a8:0xa8e8d0,size:.42,transparent:true,opacity:.62,depthWrite:false,blending:THREE.AdditiveBlending}));
    const a=rand(s,7)*6.28,r=62+s*28;pts.position.set(Math.cos(a)*r,5+rand(s,8)*9,Math.sin(a)*r);g.add(pts);
    anim.push({mesh:pts,angle:a,radius:r,phase:rand(s)*6.28,type:'school'});
    // Real Creative Commons fish swimming with each bait ball, now with a
    // much wider species mix (all Quaternius CC0, see ASSET-CREDITS.md).
    const speciesPool=['cc0/real-sardina_pilchardus','cc0/real-clupea_harengus','cc0/real-scomber_scombrus','cc0/real-katsuwonus_pelamis','cc0/real-lutjanus_kasmira','cc0/real-ostracion_cubicum','cc0/real-arothron_hispidus','cc0/real-diodon_holocanthus','cc0/real-hippocampus_kuda','cc0/real-zanclus_cornutus','cc0/real-pygoplites_diacanthus','cc0/real-pagrus_major'];
    const species=speciesPool[s%speciesPool.length];
    loadCreature(species).then(model=>{
      if(!model||!pts.parent)return;
      for(let k=0;k<2;k++){
        const fish=model.clone(true),aa=rand(k,s)*6.28,rr=4+rand(k,s+2)*7;
        fish.position.set(Math.cos(aa)*rr,(rand(k,s+4)-.5)*4,Math.sin(aa)*rr);
        fish.rotation.y=aa;fish.scale.setScalar(.6+rand(k,s+6)*.45);pts.add(fish);
        anim.push({mesh:fish,type:'fish',spin:aa,phase:rand(k,s+8)*6.28,base:fish.position.clone(),host:pts});
      }
    });
  }
  return {group:g,animate:(t,dt)=>{for(const a of anim){if(a.type==='hunter'){a.mesh.rotation.y+=.002;a.mesh.position.y+=Math.sin(t*.4+a.phase)*.006;}else if(a.type==='sway')a.mesh.rotation.z=Math.sin(t*.7+a.phase)*.14;else if(a.type==='fish'){a.spin+=(dt||.016)*.5;a.mesh.position.set(a.base.x+Math.cos(a.spin)*2, a.base.y+Math.sin(t*1.2+a.phase)*.4, a.base.z+Math.sin(a.spin)*2);a.mesh.rotation.y=-a.spin;}else{a.angle+=(dt||.016)*.08;a.mesh.position.x=Math.cos(a.angle)*a.radius;a.mesh.position.z=Math.sin(a.angle)*a.radius;a.mesh.rotation.y=-a.angle;}}}};
}

function whalefall(period){
  const g=new THREE.Group(),anim=[];
  const bone=new THREE.MeshStandardMaterial({color:0xe8e4d4,emissive:0x3a4a48,emissiveIntensity:.3,roughness:.8,transparent:true,opacity:.9});
  const glow=new THREE.MeshBasicMaterial({color:0x9fe8ff,transparent:true,opacity:.5,depthWrite:false,blending:THREE.AdditiveBlending});
  for(let i=0;i<5;i++){
    const a=rand(i)*6.28,r=38+rand(i,2)*190,x=Math.cos(a)*r,z=Math.sin(a)*r;
    // Whale fall: a spine with rib arcs, covered in glowing worms.
    const skeleton=new THREE.Group();
    for(let k=0;k<12;k++){const v=new THREE.Mesh(new THREE.SphereGeometry(.28,8,6),bone);v.position.set(0,0,-k*.9);skeleton.add(v);if(k<9&&k>1){for(const side of [-1,1]){const rib=new THREE.Mesh(new THREE.TorusGeometry(1.5,.09,5,12,Math.PI),bone);rib.position.set(0,0,-k*.9);rib.rotation.set(Math.PI/2,0,side>0?0:Math.PI);rib.scale.setScalar(.8-k*.04);skeleton.add(rib);}}}
    const skull=new THREE.Mesh(new THREE.SphereGeometry(1,10,8),bone);skull.scale.set(.7,.5,1.5);skull.position.set(0,0,1.2);skeleton.add(skull);
    skeleton.position.set(x,groundY(x,z,.16),z);skeleton.rotation.y=rand(i,3)*6.28;g.add(skeleton);
    for(let k=0;k<5;k++){const w=new THREE.Mesh(new THREE.SphereGeometry(.12,6,5),glow);const wx=x+(rand(i*9+k)-.5)*3,wz=z+(rand(i*5+k)-.5)*3;w.position.set(wx,groundY(wx,wz,.4+rand(i*7+k)*2),wz);g.add(w);anim.push({mesh:w,phase:rand(i*3+k)*6.28,type:'glow'});}
  }
  // Abyssal scavengers around the falls: anglerfish, blobfish, goblin sharks and crabs.
  ['cc0/real-himantolophus_groenlandicus','cc0/real-anoplogaster_cornuta','cc0/real-macropinna_microstoma','cc0/crab'].forEach((name,idx)=>loadCreature(name).then(model=>{
    if(!model||!g.parent)return;
    for(let k=0;k<2;k++){
      const a=rand(k,idx+2)*6.28,r=36+rand(k,idx+4)*70,clone=model.clone(true);
      const x=Math.cos(a)*r,z=Math.sin(a)*r;
      clone.position.set(x,idx===3?groundY(x,z,.3):-1+rand(k,idx+6)*7,z);
      clone.rotation.y=a;clone.scale.setScalar(idx===3?.7:1.15);g.add(clone);
      anim.push({mesh:clone,type:'hunter',phase:idx+k});
    }
  }));
  // Drifting snow of marine detritus.
  const count=280,pos=new Float32Array(count*3);
  for(let i=0;i<count;i++){pos[i*3]=(rand(i)-.5)*760;pos[i*3+1]=(rand(i,2)-.5)*32;pos[i*3+2]=(rand(i,3)-.5)*760;}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
  const snow=new THREE.Points(geo,new THREE.PointsMaterial({color:0xc8e8ff,size:.2,transparent:true,opacity:.35,depthWrite:false,blending:THREE.AdditiveBlending}));g.add(snow);anim.push({mesh:snow,type:'snow'});
  return {group:g,animate:(t)=>{for(const a of anim){if(a.type==='glow')a.mesh.material.opacity=.3+Math.sin(t*2+a.phase)*.25;else a.mesh.rotation.y=t*.004;}}};
}
// Near-field landmarks: era-specific shapes framing the player, readable when zoomed in.
function addNearCluster(group,period){
  const warm=new THREE.MeshStandardMaterial({color:period.coral,emissive:period.coral,emissiveIntensity:.5,roughness:.5,transparent:true,opacity:.85});
  const shell=new THREE.MeshStandardMaterial({color:0xd8c49a,emissive:0x4a3826,emissiveIntensity:.35,roughness:.55,transparent:true,opacity:.85,side:THREE.DoubleSide});
  for(let i=0;i<10;i++){
    const a=i/10*6.28+.3,r=20+rand(i,11)*32,x=Math.cos(a)*r,z=Math.sin(a)*r,s=.7+rand(i,12)*.8;
    const shape=new THREE.Group();
    if(period.scene==='vents'){
      loadCreature('coast_rocks').then(model=>{
        if(!model||!group.parent)return;
        const rock=model.clone(true);rock.position.y=-1.2*s;rock.rotation.y=rand(i,15)*6.28;rock.scale.setScalar(.9*s);shape.add(rock);
      });
      const vent=new THREE.Mesh(new THREE.SphereGeometry(.6*s,10,8),warm);vent.position.y=1.4*s;shape.add(vent);
    }else if(period.scene==='trilobite'||period.scene==='reef'){
      for(let k=0;k<5;k++){const seg=new THREE.Mesh(new THREE.SphereGeometry(1,8,6),shell);seg.scale.set(.5*s,.16*s,.22*s);seg.position.set(0,.1*s,(1-k*.4)*s);shape.add(seg);}
      shape.rotation.y=rand(i,13)*6.28;
    }else if(period.scene==='ammonite'){
      let ang=0,rad=.25*s;for(let k=0;k<12;k++){const c=new THREE.Mesh(new THREE.TorusGeometry(rad,rad*.3,5,12),shell);c.position.set(Math.cos(ang)*rad*.7,Math.sin(ang)*rad*.7,0);c.rotation.z=ang;shape.add(c);ang+=.55;rad*=1.14;}
      shape.rotation.z=rand(i,14)*.7;
    }else if(period.scene==='shoal'){
      const flora=['cc0/hydrozoan-distichopora-borealis','cc0/hydrozoan-distichopora-violacea','cc0/hydrozoan-crypthelia-viridis'];
      const name=flora[i%flora.length];
      loadCreature(name).then(model=>{
        if(!model||!group.parent)return;
        const plant=model.clone(true);plant.position.set((rand(i*7)-.5)*2*s,0,(rand(i*5)-.5)*2*s);
        plant.rotation.y=rand(i*3)*6.28;plant.scale.setScalar(.7*s);shape.add(plant);
      });
    }else{
      // whalefall: bone rib arcs with glowing worms.
      for(let k=0;k<4;k++){const rib=new THREE.Mesh(new THREE.TorusGeometry(1.2*s,.08*s,5,12,Math.PI),shell);rib.position.z=-k*.7*s;rib.rotation.set(Math.PI/2,0,k%2?0:Math.PI);shape.add(rib);}
      const glow=new THREE.Mesh(new THREE.SphereGeometry(.16*s,6,5),warm);glow.position.y=.5*s;shape.add(glow);
    }
    shape.position.set(x,groundY(x,z,1.0),z);group.add(shape);
  }
  const nearRing=ring(14,period.dust,.14);nearRing.rotation.x=Math.PI/2;nearRing.position.y=groundY(0,0,.18);group.add(nearRing);
}
const BUILDERS={vents,trilobite,reef,ammonite,shoal,whalefall};
export function buildPeriodScenery(period){
  const build=BUILDERS[period.scene]||reef,result=build(period);
  addNearCluster(result.group,period);
  result.group.userData.disposable=true;
  return result;
}
export function disposeScenery(result){
  if(!result)return;const mats=new Set(),geos=new Set();
  result.group.traverse(o=>{if(o.userData.sharedAsset)return;if(o.material){Array.isArray(o.material)?o.material.forEach(m=>mats.add(m)):mats.add(o.material);}if(o.geometry)geos.add(o.geometry);});
  for(const m of mats)m.dispose();for(const geo of geos)geo.dispose();
  result.group.parent?.remove(result.group);
}
