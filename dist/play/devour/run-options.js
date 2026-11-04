import {dailyChallenge} from './random.js';
export function runOptions(selection,daily=dailyChallenge()){
  const mode=['expedition','free','daily'].includes(selection.mode)?selection.mode:'expedition';
  return {mode,biome:mode==='expedition'?'lagoon':mode==='daily'?daily.biome:['lagoon','tide','crystal'].includes(selection.biome)?selection.biome:'lagoon',difficulty:mode==='daily'?'normal':['normal','relaxed','master'].includes(selection.difficulty)?selection.difficulty:'normal',dailyKey:mode==='daily'?daily.key:'',dailyRule:mode==='daily'?daily.rule:'classic',seed:mode==='daily'?daily.seed:undefined};
}
export function replayOptions(game){return{mode:game.mode,biome:game.biome.id,difficulty:game.difficulty};}
