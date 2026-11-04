import * as T from './vendor/three.module.js';
export function prepareMaterials(stage){
  const room=new T.Scene();room.background=new T.Color(0x162438);
  const panel=(color,x,y,z,sx,sy,sz)=>{const m=new T.Mesh(new T.BoxGeometry(sx,sy,sz),new T.MeshBasicMaterial({color}));m.position.set(x,y,z);room.add(m);};
  panel(0xd5edff,-7,4,0,.2,5,12);panel(0x729ac8,8,2,0,.2,7,10);panel(0xffd1ae,0,9,-2,10,.2,8);panel(0x445f83,0,-7,0,14,.2,12);panel(0xf3f5f4,0,3,10,9,2,.2);
  const pmrem=new T.PMREMGenerator(stage.renderer);pmrem.compileCubemapShader();stage.reflectionTarget=pmrem.fromScene(room,0,.1,60);stage.scene.environment=stage.reflectionTarget.texture;pmrem.dispose();for(const m of room.children){m.geometry.dispose();m.material.dispose();}
  const loader=new T.TextureLoader();loader.load(new URL('./assets/basalt-v1.png',import.meta.url).href,texture=>{
    texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(2,2);texture.anisotropy=Math.min(8,stage.renderer.capabilities.getMaxAnisotropy());
    const height=texture.clone();height.colorSpace=T.NoColorSpace;height.needsUpdate=true;
    const material=stage.mountains.material;material.map=texture;material.bumpMap=height;material.bumpScale=.22;material.vertexColors=false;material.color.setHex(0xc1d1da);material.metalness=.04;material.roughness=.84;material.emissiveIntensity=.04;material.envMapIntensity=.5;material.needsUpdate=true;
  });
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const ctx=canvas.getContext('2d');ctx.fillStyle='#c4ccd1';ctx.fillRect(0,0,512,512);
  for(let y=0;y<512;y+=64)for(let x=0;x<512;x+=128){ctx.fillStyle=(x/128+y/64)%2?'#b7c0c8':'#d3d9dc';ctx.fillRect(x+2,y+2,124,60);ctx.strokeStyle='#697986';ctx.lineWidth=1;ctx.strokeRect(x+2,y+2,124,60);ctx.fillStyle='#667680';for(const dx of [8,118]){ctx.fillRect(x+dx,y+7,3,3);ctx.fillRect(x+dx,y+53,3,3);}}
  ctx.fillStyle='#315b6d';ctx.fillRect(17,0,9,512);ctx.fillStyle='#8cddd1';ctx.fillRect(28,0,3,512);
  const coating=new T.CanvasTexture(canvas);coating.colorSpace=T.SRGBColorSpace;coating.wrapS=coating.wrapT=T.RepeatWrapping;coating.repeat.set(2,2);coating.anisotropy=4;
  stage.ship.traverse(object=>{if(object.material?.isMeshStandardMaterial&&object.material!==stage.enemyHullMat){object.material.map=coating;object.material.envMapIntensity=1.2;object.material.roughness=.3;object.material.metalness=.68;object.material.needsUpdate=true;}});
  stage.enemyHullMat.envMapIntensity=1.3;stage.enemyHullMat.roughness=.28;stage.enemyHullMat.metalness=.65;
}
