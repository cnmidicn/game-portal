import * as THREE from './vendor/three.module.js';
import {STRUCTURE_TYPES} from './world.js';
import {groundY} from './seabed.js';
export class WorldScene{
  constructor(scene,glow){this.scene=scene;this.glow=glow;this.objects=new Map();this.waves=new Map();this.box=new THREE.BoxGeometry(1,1,1);this.sphere=new THREE.SphereGeometry(1,12,8);this.rock=new THREE.IcosahedronGeometry(1,0);this.gem=new THREE.OctahedronGeometry(1,0);this.stem=new THREE.CylinderGeometry(.09,.14,1,6);this.ring=new THREE.RingGeometry(.95,1,64);}
  material(color,extra={}){return new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.08,roughness:.6,metalness:.12,...extra});}
  mesh(group,geo,mat,pos=[0,0,0],scale=[1,1,1]){const m=new THREE.Mesh(geo,mat);m.position.set(...pos);m.scale.set(...scale);group.add(m);return m;}
  create(s){
    const g=new THREE.Group(),color=STRUCTURE_TYPES[s.type].color,mat=this.material(color),dark=this.material(s.type==='wreck'?0x41585a:0x32534d),unit=new THREE.Group();g.add(unit);
    if(s.type==='reef')for(let i=0;i<5;i++){const a=i*2.4,x=Math.cos(a)*.5,z=Math.sin(a)*.5,h=.55+(i%3)*.25;this.mesh(unit,this.stem,mat,[x,h*.5,z],[1,h,1]);this.mesh(unit,this.sphere,mat,[x,h,z],[.2,.22,.2]);const branch=this.mesh(unit,this.stem,mat,[x+.15,h*.6,z],[.7,h*.5,.7]);branch.rotation.z=-.7;}
    else if(s.type==='wreck'){
      // A fossil-era rock outcrop rather than a shipwreck slab: stacked
      // weathered lithologies with encrusting filter feeders.
      const stone=this.material(0x5b746d,{roughness:.96,metalness:0,emissiveIntensity:.025,flatShading:true});
      const pale=this.material(0x9aa79a,{roughness:.92,metalness:0,emissiveIntensity:.02,flatShading:true});
      for(let i=0;i<7;i++){
        const a=i*2.399,r=.22+(i%3)*.22;
        const chunk=this.mesh(unit,i%3===0?this.gem:this.rock,i%2?stone:pale,
          [Math.cos(a)*r,-.14+(i%4)*.16,Math.sin(a)*r],
          [.52+(i%3)*.22,.36+(i%4)*.17,.48+(i%2)*.24]);
        chunk.rotation.set(Math.sin(i*2.1)*.35,a*.7,Math.cos(i*1.7)*.3);
      }
      for(let i=0;i<5;i++){
        const a=i*1.256,crust=this.mesh(unit,this.sphere,pale,[Math.cos(a)*.62,.12+(i%2)*.16,Math.sin(a)*.55],[.17,.11,.17]);
        crust.rotation.y=a;
      }
      dark.emissiveIntensity=.03;dark.roughness=.96;unit.rotation.y=.18;
    }
    else if(s.type==='island'){this.mesh(unit,this.rock,dark,[0,-.4,0],[1,.7,1]);this.mesh(unit,this.rock,mat,[0,.05,0],[1,.22,1]);this.mesh(unit,this.rock,dark,[.3,.35,-.2],[.25,.5,.25]);}
    else if(s.type==='storm'){for(let i=0;i<5;i++){const a=i*1.256;this.mesh(unit,this.sphere,mat,[Math.cos(a)*.5,.6+(i%2)*.2,Math.sin(a)*.5],[.6,.35,.6]);}const bolt=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,.5,0),new THREE.Vector3(-.15,0,0),new THREE.Vector3(.15,0,0),new THREE.Vector3(-.1,-.7,0)]),new THREE.LineBasicMaterial({color:0xd8d6ff}));unit.add(bolt);}
    else{mat.emissiveIntensity=s.type==='heart'?1.2:.7;mat.roughness=.2;this.mesh(unit,this.gem,mat,[0,.4,0],[.55,.8,.55]);const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:this.glow,color,transparent:true,opacity:.55,blending:THREE.AdditiveBlending,depthWrite:false}));halo.scale.set(5,5,1);unit.add(halo);const pillar=this.mesh(unit,this.stem,new THREE.MeshBasicMaterial({color,transparent:true,opacity:.12,depthWrite:false}),[0,1,0],[1,8,1]);pillar.position.y=1.2;}
    const ring=new THREE.Mesh(this.ring,new THREE.MeshBasicMaterial({color,transparent:true,opacity:.2,side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=.06;g.add(ring);g.userData={mat,dark,unit,ring};this.scene.add(g);return g;
  }
  update(game,dt,t){
    const ids=new Set();for(const s of game.structures){ids.add(s.id);let o=this.objects.get(s.id);if(!o){o=this.create(s);this.objects.set(s.id,o);}const d=o.userData,edible=game.canAbsorb(s),objective=s.type==='echo'||s.type==='heart';const floor=groundY(s.x,s.z);o.position.set(s.x,floor,s.z);d.unit.scale.setScalar(s.radius*(s.type==='heart'?1.2:1));d.ring.scale.setScalar(s.radius*1.2);d.ring.material.color.set(edible?0xb8f5ca:objective?STRUCTURE_TYPES[s.type].color:0x5d8989);d.ring.material.opacity=edible?.45:objective?.3:.12;d.mat.emissiveIntensity=objective?(edible?1:.25):edible?.17:.04;
      if(objective){d.unit.position.y=Math.sin(t*1.5+s.phase)*.3+1;d.unit.rotation.y=t*.35+s.phase;}else if(s.type==='storm'){d.unit.rotation.y=t*.2+s.phase;d.unit.position.y=Math.sin(t+s.phase)*.5+1;if(!edible){d.ring.material.color.set(s.state==='pulse'?0xffa9ba:0xa7bafa);d.ring.material.opacity=s.state==='pulse'?.7:s.state==='warning'?.4:.13;}}
      o.visible=game.status==='home'?Math.hypot(s.x-2,s.z)<100:true;
    }
    for(const [id,o]of this.objects)if(!ids.has(id)){this.dispose(o);this.objects.delete(id);}
    const waveIds=new Set();for(const w of game.waves){waveIds.add(w.id);let o=this.waves.get(w.id);if(!o){o=new THREE.Mesh(w.type==='ring'?this.ring:this.gem,new THREE.MeshBasicMaterial({color:w.type==='ring'?0x9bd8ef:0xd8b6fc,transparent:true,opacity:.7,side:THREE.DoubleSide,depthWrite:false}));if(w.type==='ring')o.rotation.x=-Math.PI/2;this.scene.add(o);this.waves.set(w.id,o);}o.position.set(w.x,.3,w.z);o.scale.setScalar(w.type==='ring'?w.radius:1);o.material.opacity=Math.min(.8,w.life*.5);}
    for(const [id,o]of this.waves)if(!waveIds.has(id)){this.dispose(o);this.waves.delete(id);}
  }
  reset(){for(const o of this.objects.values())this.dispose(o);for(const o of this.waves.values())this.dispose(o);this.objects.clear();this.waves.clear();}
  dispose(g){const materials=new Set(),geometries=new Set(),shared=new Set([this.box,this.sphere,this.rock,this.gem,this.stem,this.ring]);g.traverse(o=>{if(o.material)materials.add(o.material);if(o.geometry&&!shared.has(o.geometry))geometries.add(o.geometry);});for(const m of materials)m.dispose();for(const geo of geometries)geo.dispose();this.scene.remove(g);}
}
