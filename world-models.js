import * as THREE from './vendor/three.module.js';
const material=(color,metalness=.15,roughness=.65)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
function add(parent,geo,mat,x=0,y=0,z=0){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);parent.add(m);return m}
function box(parent,w,h,d,mat,x,y,z){return add(parent,new THREE.BoxGeometry(w,h,d),mat,x,y,z)}
function glow(parent,texture,color,size,x,y,z,opacity=.6){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,color,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending}));s.position.set(x,y,z);s.scale.set(size,size,1);parent.add(s);return s}
export function createEcho(texture){
 const group=new THREE.Group(),island=new THREE.Group();group.add(island);island.rotation.set(.32,-.34,-.04);island.position.y=-.15;
 const grass=material('#497c67'),edge=material('#35504d'),stone=material('#263d46'),soil=material('#273e3c'),wood=material('#795a40'),leafA=material('#3d7765'),leafB=material('#5a9581'),leafC=material('#7cb69a'),gold=new THREE.MeshStandardMaterial({color:'#e4c27d',emissive:'#ad7936',emissiveIntensity:.7,metalness:.6,roughness:.25}),water=new THREE.MeshStandardMaterial({color:'#6ed0cc',emissive:'#287b84',emissiveIntensity:.5,roughness:.2,metalness:.45});
 box(island,4.6,.23,3.3,grass,0,-.4,0);box(island,4.3,.32,3.15,edge,0,-.67,0);box(island,3.95,.4,2.7,soil,0,-.98,0);box(island,3.15,.4,2.25,stone,.2,-1.35,-.1);box(island,1.9,.45,1.4,stone,.3,-1.74,-.1);
 for(let i=0;i<22;i++){const a=i*2.4,r=1.25+(i%4)*.26;const rock=box(island,.32+(i%3)*.16,.3+(i%4)*.2,.4+(i%2)*.2,i%2?stone:edge,Math.cos(a)*r,-.75-(i%3)*.25,Math.sin(a)*1.2);rock.rotation.y=a;}
 for(let i=0;i<14;i++){const x=-2.1+i*.32;box(island,.34,.035,.46,water,x,-.262,.83+Math.sin(i*.55)*.2)}
 for(let i=0;i<6;i++)box(island,.12,.08,.85,wood,-.28+i*.11,-.21,.82);
 for(let i=0;i<10;i++)box(island,.31,.045,.32,material('#81917b'),.22+Math.sin(i*.62)*.25,-.245,-1.4+i*.28);
 const trees=[];const coordinates=[[-1.85,-.9,.8],[-1.1,-1.1,1.1],[.75,-1.15,.85],[1.7,-.85,1.0],[-1.55,.2,.65],[1.85,.3,.75]];
 for(const [x,z,s]of coordinates){const tree=new THREE.Group();tree.position.set(x,-.28,z);tree.scale.setScalar(s);island.add(tree);box(tree,.19,1.15,.19,wood,0,.57,0);box(tree,1,.47,.88,leafA,0,1.18,0);box(tree,.8,.45,.74,leafB,.04,1.57,-.03);box(tree,.53,.35,.52,leafC,-.04,1.95,.02);trees.push(tree)}
 const towers=[];for(const [x,z]of[[-1.1,.15],[1.1,-.05],[.2,-.55]]){const tower=new THREE.Group();tower.position.set(x,-.26,z);island.add(tower);box(tower,.56,.17,.56,stone,0,.085,0);box(tower,.31,.56,.31,edge,0,.42,0);for(let k=0;k<3;k++)box(tower,.065,.35+k*.13,.065,gold,-.12+k*.12,.81+k*.065,0);const ring=add(tower,new THREE.TorusGeometry(.31,.013,8,48),gold,0,1.16,0);ring.rotation.x=Math.PI/2;towers.push(ring)}
 const core=add(island,new THREE.OctahedronGeometry(.33),gold,.2,1.67,-.55);glow(island,texture,0xffd59b,2,.2,1.65,-.55,.45);
 const portal=add(island,new THREE.TorusGeometry(.75,.038,10,80),gold,.2,1.05,-1.38);portal.rotation.y=.1;
 const sparks=[];for(let i=0;i<18;i++){const a=i*2.399,r=1+(i%6)*.3;const s=add(island,new THREE.SphereGeometry(.022,8,6),gold,Math.cos(a)*r,.5+(i%5)*.3,Math.sin(a)*1.6);sparks.push(s)}
 return {group,tick(t,energy){island.position.y=-.15+Math.sin(t*.6)*.06;core.rotation.y=t*.5;core.rotation.z=Math.sin(t)*.1;core.scale.setScalar(1+energy*.4);trees.forEach((o,i)=>o.rotation.z=Math.sin(t*.65+i)*.015);towers.forEach((o,i)=>{o.rotation.z=t*.2;o.scale.setScalar(1+Math.sin(t*1.8+i)*.08+energy*.25)});sparks.forEach((o,i)=>o.position.y=.5+(i%5)*.3+Math.sin(t*.6+i)*.08)}};
}
export function createWave(texture){
 const group=new THREE.Group(),ship=new THREE.Group(),backdrop=new THREE.Group();group.add(backdrop,ship);ship.rotation.set(.2,-.5,-.22);ship.position.set(0,.1,1);
 const hull=material('#345168',.55,.28),lightHull=material('#8fb7c8',.35,.28),dark=material('#122c42',.6,.22),cyan=new THREE.MeshStandardMaterial({color:'#8ce5ff',emissive:'#4dbbdc',emissiveIntensity:1.4,metalness:.6,roughness:.2}),pink=new THREE.MeshStandardMaterial({color:'#b19aee',emissive:'#7953d7',emissiveIntensity:1.3,metalness:.5,roughness:.2});
 const body=add(ship,new THREE.CylinderGeometry(.14,.34,1.9,6),hull,0,0,.15);body.rotation.x=Math.PI/2;const nose=add(ship,new THREE.ConeGeometry(.145,.65,6),lightHull,0,0,1.42);nose.rotation.x=Math.PI/2;const cockpit=add(ship,new THREE.SphereGeometry(.3,24,16),dark,0,.19,.55);cockpit.scale.set(.72,.55,1.7);
 function wing(side){const s=new THREE.Shape();s.moveTo(0,.8);s.lineTo(side*.43,-.45);s.lineTo(side*1.75,-1.0);s.lineTo(side*1.5,-.15);s.lineTo(side*.6,.9);s.closePath();const geo=new THREE.ExtrudeGeometry(s,{depth:.07,bevelEnabled:true,bevelSize:.015,bevelThickness:.015,bevelSegments:1});geo.rotateX(Math.PI/2);const w=add(ship,geo,lightHull,0,-.08,.1);return w}wing(-1);wing(1);
 for(const side of[-1,1]){const engine=add(ship,new THREE.CylinderGeometry(.14,.18,.8,12),hull,side*.69,-.05,-.65);engine.rotation.x=Math.PI/2;const nozzle=add(ship,new THREE.TorusGeometry(.14,.037,10,32),cyan,side*.69,-.05,-1.08);const flame=add(ship,new THREE.ConeGeometry(.13,.95,14),cyan,side*.69,-.05,-1.55);flame.rotation.x=-Math.PI/2;glow(ship,texture,0x91dfff,1.35,side*.69,-.05,-1.2,.6);box(ship,.065,.06,.9,cyan,side*.88,-.02,-.13);const fin=box(ship,.07,.46,.47,hull,side*.69,.25,-.9);fin.rotation.z=side*.15;}
 box(ship,.04,.035,.9,cyan,0,.18,.7);
 const rings=[];for(let i=0;i<7;i++){const ring=add(backdrop,new THREE.TorusGeometry(2.0,.022,8,96),i%2?pink:cyan,0,0,-2-i*1.45);ring.rotation.z=i*.12;rings.push(ring)}
 for(let i=0;i<8;i++){const rock=add(backdrop,new THREE.IcosahedronGeometry(.35+(i%3)*.2,0),material(i%2?'#273355':'#394464',.2,.8),Math.sin(i*2.4)*3,-1.5-(i%2)*.3,-1-i*.9);rock.scale.set(.8,1.6,.8)}
 const lines=[];for(let i=0;i<20;i++){const a=i*2.4,r=2.2+(i%3)*.5;const line=box(backdrop,.014,.014,.7,i%2?cyan:pink,Math.cos(a)*r,Math.sin(a)*r,-1-(i%5));lines.push(line)}
 return {group,tick(t,energy){ship.position.y=.1+Math.sin(t*1.3)*.1;ship.rotation.z=-.22+Math.sin(t*.7)*.03;ship.rotation.x=.2+Math.sin(t*.5)*.03;rings.forEach((r,i)=>{r.position.z=-2-((i*1.45-t*.55)%10+10)%10;r.rotation.z=i*.12+t*.06;r.scale.setScalar(1+energy*.15)});lines.forEach((r,i)=>r.position.z=-1-((i*.4-t*1.8)%7+7)%7)}};
}
