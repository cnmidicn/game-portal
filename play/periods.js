// Geological periods drive the whole sea: palette, lighting, scenery and fauna.
// Derived from stage / mass so saves need no new fields. Six eras span the timeline.
//
// Palette note: the open ocean is blue, not green. Green only survives in the
// very earliest iron-rich seas and in microbial mats on the seabed.
export const PERIODS=[
  {
    id:'archaean',name:'原初之海',en:'THE PRIMORDIAL SEA',era:'太古宙 · 35 亿年前',
    background:'#041520',deep:[0.006,0.034,0.060],shallow:[0.014,0.072,0.118],
    fog:.0016,key:0xbfe8d2,fill:0x2e7d92,rim:0x7fe0b8,ambient:0x89d4b4,
    dust:0x6fd8b0,kelp:0x1f5a4a,coral:0x2c6a58,
    fauna:['原核孢子','热泉菌毯','古菌群落','铁细菌壳','硫光菌簇','磁性菌带'],
    weights:[.42,.05,.10,.05,.18,.20],
    seabedTint:[.82,.94,.68],
    sediment:{sand:[.86,.82,.62],silt:[.58,.72,.74],rock:[.48,.55,.60],mat:[.58,.86,.62]},
    scene:'vents',
    backdrop:'./assets/backgrounds/cambrian.webp',
    story:'缺氧的绿色海洋，热液喷口是生命的火种。'
  },
  {
    id:'cambrian',name:'寒武纪海洋',en:'THE CAMBRIAN EXPLOSION',era:'寒武纪 · 5.4 亿年前',
    background:'#05202e',deep:[0.008,0.045,0.078],shallow:[0.019,0.095,0.150],
    fog:.0015,key:0xd8ffe8,fill:0x54b6d6,rim:0x9affd8,ambient:0x9de0cc,
    dust:0x8fe8d0,kelp:0x2b7f66,coral:0xffab8a,
    fauna:['三叶虫幼体','奇虾猎手','海绵虫','小壳动物','腕足幼体','盾甲游虫'],
    weights:[.32,.12,.10,.10,.18,.18],
    seabedTint:[.96,.86,.66],
    sediment:{sand:[.94,.86,.68],silt:[.64,.72,.80],rock:[.52,.58,.70],mat:[.62,.84,.70]},
    scene:'trilobite',
    backdrop:'./assets/backgrounds/cambrian.webp',
    story:'生命大爆发——第一双眼、第一副铠甲、第一次追逐。'
  },
  {
    id:'devonian',name:'古生代礁海',en:'THE PALAEOZOIC REEF',era:'奥陶纪—泥盆纪 · 4 亿年前',
    background:'#052435',deep:[0.010,0.052,0.096],shallow:[0.023,0.112,0.180],
    fog:.0014,key:0xe4fff0,fill:0x4f9fd0,rim:0x8ff0d4,ambient:0x9fd8c8,
    dust:0x9ae6d8,kelp:0x338a6e,coral:0xff9c7a,
    fauna:['浮游孢','甲胄幼鱼','板足鲎','珊瑚虫','盾皮幼鱼','海百合苗'],
    weights:[.28,.16,.10,.14,.16,.16],
    seabedTint:[1.08,.92,.70],
    sediment:{sand:[1.00,.88,.66],silt:[.70,.76,.78],rock:[.56,.62,.72],mat:[.66,.88,.68]},
    scene:'reef',
    backdrop:'./assets/backgrounds/cambrian.webp',
    story:'珊瑚礁第一次形成山脉，鱼类征服了海洋。'
  },
  {
    id:'mesozoic',name:'中生代深渊',en:'THE MESOZOIC ABYSS',era:'三叠纪—白垩纪 · 1.5 亿年前',
    background:'#041b2b',deep:[0.007,0.041,0.082],shallow:[0.018,0.098,0.165],
    fog:.0013,key:0xd6f2ff,fill:0x3f86c4,rim:0x7fd8ff,ambient:0x8fc4dc,
    dust:0x8fd8f0,kelp:0x2a7258,coral:0xc79bff,
    fauna:['菊石','箭石','海百合','厚壳菊石','鹦鹉螺','滑齿龙幼体'],
    weights:[.24,.20,.16,.10,.14,.16],
    seabedTint:[.72,.80,1.12],
    sediment:{sand:[.80,.84,.92],silt:[.58,.68,.88],rock:[.46,.54,.76],mat:[.54,.80,.78]},
    scene:'ammonite',
    backdrop:'./assets/backgrounds/mesozoic.webp',
    story:'海生爬行动物统治深蓝，菊石在暗流中盘旋。'
  },
  {
    id:'neogene',name:'巨兽之海',en:'THE SEA OF GIANTS',era:'中新世—现代 · 2000 万年前',
    background:'#052033',deep:[0.009,0.049,0.096],shallow:[0.022,0.110,0.180],
    fog:.0012,key:0xe8fff4,fill:0x5aa8cc,rim:0x9fe8d0,ambient:0xa8ddcc,
    dust:0xa8eed8,kelp:0x3a9a72,coral:0xffb08a,
    fauna:['浮游磷虾','剑射鱼','水母群','巨齿鲨幼体','旗鱼群','翻车鱼幼体'],
    weights:[.28,.18,.14,.08,.16,.16],
    seabedTint:[1.02,.88,.76],
    sediment:{sand:[.96,.86,.70],silt:[.68,.72,.80],rock:[.52,.56,.68],mat:[.62,.84,.72]},
    scene:'shoal',
    backdrop:'./assets/backgrounds/mesozoic.webp',
    story:'巨齿鲨的阴影掠过浅滩，鲸的歌声开始回荡。'
  },
  {
    id:'modern',name:'深海纪元',en:'THE MODERN ABYSS',era:'现代 · 深海',
    background:'#031729',deep:[0.006,0.032,0.072],shallow:[0.014,0.082,0.150],
    fog:.0011,key:0xdaf0ff,fill:0x3d7fbe,rim:0x86d8ff,ambient:0x8ab8d4,
    dust:0x9fe0ff,kelp:0x2c7f6a,coral:0xb59cff,
    fauna:['深海磷虾','灯笼鱼','冠水母','鲸落群落','鮟鱇幼体','吸血乌贼'],
    weights:[.26,.14,.18,.08,.16,.18],
    seabedTint:[.64,.76,1.16],
    sediment:{sand:[.72,.78,.94],silt:[.52,.62,.86],rock:[.40,.48,.72],mat:[.50,.74,.84]},
    scene:'whalefall',
    backdrop:'./assets/backgrounds/modern.webp',
    story:'鲸落化作深海的绿洲，微光生物在黑暗中绽放。'
  }
];
// Six playable fauna roles. Kind 4 is reserved for the arena boss.
export const FAUNA_KINDS=[0,1,2,3,5,6];
// Per-instance colour families. Applied as a gentle lerp to each scanned model
// so the same real asset can appear as several distinct, believable animals.
export const FAUNA_TINTS=[
  {id:'opal',color:0xa8f0d8,name:'蛋白青'},
  {id:'cobalt',color:0x8fc9ff,name:'钴蓝'},
  {id:'amber',color:0xffd39a,name:'琥珀金'},
  {id:'coral',color:0xffa9a0,name:'珊瑚红'},
  {id:'violet',color:0xc6adff,name:'深海紫'},
  {id:'jade',color:0xb7e39a,name:'藻玉绿'},
  {id:'pearl',color:0xf0e4ff,name:'珍珠白'},
  {id:'sun',color:0xffe08a,name:'日光黄'}
];
export const FOOD_TINTS=[[.36,.78,.94],[.58,.88,.70],[.82,.72,.98],[.96,.74,.48],[.50,.82,.96],[.94,.86,.58],[.72,.90,.82],[.88,.68,.84]];
// Stage 0..4 maps to the first five periods; very large mass reaches the modern abyss.
export function periodIndexFor(game){
  if(!game)return 0;
  const stage=Math.max(0,Math.min(4,game.stage||0));
  if(game.player?.mass>=1600||game.chapter>=2)return 5;
  return stage;
}
export function periodFor(game){return PERIODS[periodIndexFor(game)];}
// Map a playable fauna kind (4 is reserved for bosses) to its period name.
export function faunaNameFor(period,kind){
  const index=Math.max(0,FAUNA_KINDS.indexOf(kind));
  return period.fauna[Math.min(index,period.fauna.length-1)];
}
// Pick a fauna role using the period's weights, keeping boss kind 4 out of normal spawns.
export function pickFaunaKind(period,random=Math.random){
  const w=period.weights,total=w.reduce((a,b)=>a+b,0);let r=random()*total;
  for(let i=0;i<w.length;i++){r-=w[i];if(r<=0)return FAUNA_KINDS[i]??0;}
  return FAUNA_KINDS[FAUNA_KINDS.length-1];
}
