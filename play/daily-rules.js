export const DAILY_RULES=[
  {id:'classic',name:'经典潮汐',desc:'原有地图与规则，接续旧版旅程。',current:1,enemy:1,rare:0},
  {id:'current',name:'双倍海流',desc:'潮汐回廊的海流强度翻倍，借顺流捕食，留意漩涡。',biome:'tide',current:2,enemy:1,rare:0},
  {id:'migration',name:'星群迁徙',desc:'金色稀有猎物出现，吞噬获得额外营养与评分。',current:1,enemy:1,rare:.2},
  {id:'storms',name:'风暴迁徙',desc:'五团风暴沿环形路线移动；躲过预警，成长后吞下它们。',current:1,enemy:1,rare:0},
  {id:'bloom',name:'丰饶海域',desc:'高营养微光更多，天敌的移动速度也增加 20%。',current:1,enemy:1.2,rare:0},
  {id:'tempo',name:'节拍奔流',desc:'音乐加快至 104 BPM，六次踩拍即可触发共鸣高潮。',current:1,enemy:1,rare:0,bpm:104}
];
export const dailyRule=id=>DAILY_RULES.find(r=>r.id===id)||DAILY_RULES[0];
export function ruleForDate(key){const day=Date.parse(key+'T00:00:00Z')/86400000;return DAILY_RULES[Number.isFinite(day)?1+((Math.floor(day)%5)+5)%5:0];}
