// Geological periods drive the whole sea: palette, lighting, scenery and fauna.
// Derived from stage / mass so saves need no new fields. Six eras span the timeline.
export const PERIODS=[
  {
    id:'archaean',name:'原初之海',en:'THE PRIMORDIAL SEA',era:'太古宙 · 35 亿年前',
    background:'#071c24',deep:[0.008,0.040,0.052],shallow:[0.020,0.090,0.104],
    fog:.0024,key:0xbfe8d2,fill:0x2e7d92,rim:0x7fe0b8,ambient:0x89d4b4,
    dust:0x6fd8b0,kelp:0x1f5a4a,coral:0x2c6a58,
    fauna:['原核孢子','热泉菌毯','古菌群落','铁细菌壳'],
    weights:[.72,.06,.16,.06],
    scene:'vents',
    backdrop:'./assets/backgrounds/cambrian.webp',
    story:'缺氧的绿色海洋，热液喷口是生命的火种。'
  },
  {
    id:'cambrian',name:'寒武纪海洋',en:'THE CAMBRIAN EXPLOSION',era:'寒武纪 · 5.4 亿年前',
    background:'#082735',deep:[0.012,0.067,0.097],shallow:[0.028,0.135,0.174],
    fog:.0022,key:0xd8ffe8,fill:0x54b6d6,rim:0x9affd8,ambient:0x9de0cc,
    dust:0x8fe8d0,kelp:0x2b7f66,coral:0xffab8a,
    fauna:['三叶虫幼体','奇虾猎手','海绵虫','小壳动物'],
    weights:[.58,.14,.14,.14],
    scene:'trilobite',
    backdrop:'./assets/backgrounds/cambrian.webp',
    story:'生命大爆发——第一双眼、第一副铠甲、第一次追逐。'
  },
  {
    id:'devonian',name:'古生代礁海',en:'THE PALAEOZOIC REEF',era:'奥陶纪—泥盆纪 · 4 亿年前',
    background:'#092c3d',deep:[0.014,0.073,0.108],shallow:[0.034,0.155,0.205],
    fog:.0020,key:0xe4fff0,fill:0x4f9fd0,rim:0x8ff0d4,ambient:0x9fd8c8,
    dust:0x9ae6d8,kelp:0x338a6e,coral:0xff9c7a,
    fauna:['浮游孢','甲胄幼鱼','板足鲎','珊瑚虫'],
    weights:[.50,.20,.12,.18],
    scene:'reef',
    backdrop:'./assets/backgrounds/cambrian.webp',
    story:'珊瑚礁第一次形成山脉，鱼类征服了海洋。'
  },
  {
    id:'mesozoic',name:'中生代深渊',en:'THE MESOZOIC ABYSS',era:'三叠纪—白垩纪 · 1.5 亿年前',
    background:'#062434',deep:[0.011,0.060,0.100],shallow:[0.026,0.132,0.190],
    fog:.0019,key:0xd6f2ff,fill:0x3f86c4,rim:0x7fd8ff,ambient:0x8fc4dc,
    dust:0x8fd8f0,kelp:0x2a7258,coral:0xc79bff,
    fauna:['菊石','箭石','海百合','厚壳菊石'],
    weights:[.42,.24,.20,.14],
    scene:'ammonite',
    backdrop:'./assets/backgrounds/mesozoic.webp',
    story:'海生爬行动物统治深蓝，菊石在暗流中盘旋。'
  },
  {
    id:'neogene',name:'巨兽之海',en:'THE SEA OF GIANTS',era:'中新世—现代 · 2000 万年前',
    background:'#092b3d',deep:[0.013,0.074,0.115],shallow:[0.032,0.160,0.210],
    fog:.0018,key:0xe8fff4,fill:0x5aa8cc,rim:0x9fe8d0,ambient:0xa8ddcc,
    dust:0xa8eed8,kelp:0x3a9a72,coral:0xffb08a,
    fauna:['浮游磷虾','剑射鱼','水母群','巨齿鲨幼体'],
    weights:[.48,.22,.18,.12],
    scene:'shoal',
    backdrop:'./assets/backgrounds/mesozoic.webp',
    story:'巨齿鲨的阴影掠过浅滩，鲸的歌声开始回荡。'
  },
  {
    id:'modern',name:'深海纪元',en:'THE MODERN ABYSS',era:'现代 · 深海',
    background:'#051f31',deep:[0.009,0.053,0.094],shallow:[0.022,0.124,0.180],
    fog:.0017,key:0xdaf0ff,fill:0x3d7fbe,rim:0x86d8ff,ambient:0x8ab8d4,
    dust:0x9fe0ff,kelp:0x2c7f6a,coral:0xb59cff,
    fauna:['深海磷虾','灯笼鱼','冠水母','鲸落群落'],
    weights:[.42,.20,.26,.12],
    scene:'whalefall',
    backdrop:'./assets/backgrounds/modern.webp',
    story:'鲸落化作深海的绿洲，微光生物在黑暗中绽放。'
  }
];
// Stage 0..4 maps to the first five periods; very large mass reaches the modern abyss.
export function periodIndexFor(game){
  if(!game)return 0;
  const stage=Math.max(0,Math.min(4,game.stage||0));
  if(game.player?.mass>=1600||game.chapter>=2)return 5;
  return stage;
}
export function periodFor(game){return PERIODS[periodIndexFor(game)];}
// Pick a fauna kind using the period's weights, preserving the canonical 0..3 range.
export function pickFaunaKind(period,random=Math.random){
  const w=period.weights,total=w.reduce((a,b)=>a+b,0);let r=random()*total;
  for(let i=0;i<w.length;i++){r-=w[i];if(r<=0)return i;}
  return w.length-1;
}
