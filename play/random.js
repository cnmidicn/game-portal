import {ruleForDate} from './daily-rules.js';
export function hashSeed(value){let h=2166136261;for(const c of String(value)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
export class SeededRandom{
  constructor(seed,state){this.state=state===undefined?hashSeed(seed):state>>>0;}
  next(){let t=this.state=(this.state+0x6D2B79F5)>>>0;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;}
}
export function dailyChallenge(date=new Date()){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date),get=t=>parts.find(p=>p.type===t).value;
  const key=`${get('year')}-${get('month')}-${get('day')}`,seed='symphony-daily-v3-'+key,rule=ruleForDate(key);return{key,seed,biome:rule.biome||['lagoon','tide','crystal'][hashSeed(seed)%3],rule:rule.id,limit:300};
}
