export const CAMERA_VIEWS=[
  {id:'chase',label:'追尾',description:'贴近机身，兼顾速度感与瞄准'},
  {id:'cockpit',label:'驾驶舱',description:'第一人称飞行，直接迎向音环'},
  {id:'wide',label:'远景',description:'抬高并拉远，观察航道与敌群'},
];
export function cameraPose(id,g,mobile=false){
  if(id==='cockpit')return {position:[g.x,g.y+.33,5.4],lookAt:[g.x,g.y+.16,-60],fov:mobile?80:78,roll:.075};
  if(id==='wide')return {position:[g.x*(mobile?.65:.3),8.8+g.y*.24,mobile?28:24],lookAt:[g.x*.35,2.8,-34],fov:mobile?70:64,roll:.1};
  return {position:[g.x*(mobile?.7:.45),4.2+g.y*.22,mobile?17:14.8],lookAt:[g.x*.38,2.3,-45],fov:mobile?76:70,roll:.15};
}
export class CameraRig {
  constructor(mode='chase'){
    this.mode=CAMERA_VIEWS.some(v=>v.id===mode)?mode:'chase';
    this.weights=Object.fromEntries(CAMERA_VIEWS.map(v=>[v.id,v.id===this.mode?1:0]));
  }
  setMode(mode){if(!CAMERA_VIEWS.some(v=>v.id===mode))return false;this.mode=mode;return true;}
  cycle(){const index=CAMERA_VIEWS.findIndex(v=>v.id===this.mode);this.setMode(CAMERA_VIEWS[(index+1)%CAMERA_VIEWS.length].id);return this.mode;}
  update(dt,g,{mobile=false,boost=false,reduced=false}={}){
    const alpha=reduced?1:1-Math.exp(-Math.max(0,dt)*7),out={position:[0,0,0],lookAt:[0,0,0],fov:0,roll:0};
    for(const {id} of CAMERA_VIEWS){
      this.weights[id]+=((id===this.mode?1:0)-this.weights[id])*alpha;
      const pose=cameraPose(id,g,mobile),w=this.weights[id];
      for(let i=0;i<3;i++){out.position[i]+=pose.position[i]*w;out.lookAt[i]+=pose.lookAt[i]*w;}
      out.fov+=(pose.fov+(boost&&!reduced?(id==='cockpit'?5:9):0))*w;out.roll+=pose.roll*w;
    }
    out.cockpit=this.weights.cockpit;out.showShip=out.cockpit<.45;return out;
  }
}
