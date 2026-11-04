export function beatWindow(game){return game.specializations?.includes('harmony-resonance')?.2:.14;}
export function energyTarget(game){return game.specializations?.includes('harmony-resonance')||game.dailyRule==='tempo'?6:8;}
export function beatPhase(game){return ((game.beatPosition||0)%1+1)%1;}
export function rhythmReward(game,amount){
  const position=game.beatPosition||0,beat=Math.round(position);
  if(beat<1||Math.abs(position-beat)>beatWindow(game)||beat<=(game.lastRhythmBeat||0))return 0;
  if(beat-game.lastRhythmBeat>4)game.rhythmEnergy=0;
  game.lastRhythmBeat=beat;game.rhythmHits++;game.rhythmEnergy++;
  const bonus=Math.min(4,Math.max(0,amount)*.08);game.rhythmBonus+=bonus;
  game.emit('perfect',{energy:game.rhythmEnergy,bonus});
  if(game.rhythmEnergy>=energyTarget(game)){game.rhythmEnergy=0;game.crescendoTime=8;game.emit('crescendo');}
  return bonus;
}
