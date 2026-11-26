export const SPECIALIZATIONS=[
  {id:'mouth-crusher',trait:'mouth',icon:'◈',name:'裂甲巨颚',desc:'更早破开晶壳，吞噬巨物所需质量降低。',hint:'专精 · 破甲与巨物'},
  {id:'mouth-feast',trait:'mouth',icon:'◈',name:'鲸吞消化',desc:'普通猎物营养 +25%，微光营养 -20%。',hint:'专精 · 大型猎食'},
  {id:'magnet-vortex',trait:'magnet',icon:'◎',name:'深渊涡流',desc:'主动引力扩大 12 米，拉近猎物更快；技能冷却增加至 10 秒。',hint:'专精 · 主动聚拢'},
  {id:'magnet-orbit',trait:'magnet',icon:'◎',name:'环流触须',desc:'被动吸附微光的范围增加 7 米，吸附速度提升。',hint:'专精 · 被动采集'},
  {id:'electric-chain',trait:'electric',icon:'ϟ',name:'弧光网络',desc:'电流范围 +35%，无需组合也能连锁麻痹。',hint:'专精 · 广域控制'},
  {id:'electric-capacitor',trait:'electric',icon:'ϟ',name:'短促脉冲',desc:'技能冷却缩短至 5 秒，电流范围缩小 20%。',hint:'专精 · 频繁施放'},
  {id:'speed-current',trait:'speed',icon:'➶',name:'逐流长鳍',desc:'游动速度再提升 15%，冲刺延长至 0.6 秒；冷却增加至 3.4 秒。',hint:'专精 · 长途巡游'},
  {id:'speed-blink',trait:'speed',icon:'➶',name:'折跃鳍',desc:'冲刺更快，冷却缩短至 2.1 秒；每次冲刺缩短至 0.3 秒。',hint:'专精 · 短距闪避'},
  {id:'harmony-resonance',trait:'harmony',icon:'♫',name:'持久和弦',desc:'连击保留 8 秒，踩拍窗口更宽；6 次踩拍即可触发共鸣。',hint:'专精 · 节拍演奏'},
  {id:'harmony-bloom',trait:'harmony',icon:'♫',name:'丰饶共生',desc:'营养加成提升至 30%，愿望奖励修复 2 层护膜并生成更多微光。',hint:'专精 · 愿望与成长'},
  {id:'shell-bastion',trait:'shell',icon:'⬡',name:'厚重晶甲',desc:'护膜上限再增加 2 层并完全修复；游动速度降低 10%。',hint:'专精 · 重甲生存'},
  {id:'shell-echo',trait:'shell',icon:'⬡',name:'回响护膜',desc:'受伤后的保护延长至 4 秒，保留更长的撤离窗口。',hint:'专精 · 灵巧防御'}
];
export function specializationChoices(game){return SPECIALIZATIONS.filter(s=>game.traits.includes(s.trait)&&!game.specializations.some(id=>SPECIALIZATIONS.find(x=>x.id===id)?.trait===s.trait));}
