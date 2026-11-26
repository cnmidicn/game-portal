import {dailyChallenge} from './random.js';
import {isMode} from './modes.js';
export function runOptions(selection,daily=dailyChallenge()){
  const mode=isMode(selection.mode)?selection.mode:'expedition';
  const timed=mode==='daily'||mode==='horde';
  const biome=mode==='expedition'?'lagoon':timed?daily.biome:['lagoon','tide','crystal'].includes(selection.biome)?selection.biome:'lagoon';
  const options={mode,biome,difficulty:mode==='daily'?'normal':['normal','relaxed','master'].includes(selection.difficulty)?selection.difficulty:'normal',dailyKey:mode==='daily'?daily.key:'',dailyRule:mode==='daily'?daily.rule:'classic',seed:timed?daily.seed:undefined};
  if(Number.isFinite(selection.lifeLevel))options.lifeLevel=selection.lifeLevel;
  return options;
}
export function replayOptions(game){return{mode:game.mode,biome:game.biome.id,difficulty:game.difficulty,lifeLevel:game.lifeLevel};}
