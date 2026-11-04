// Shared game rules. No rendering, timers, or browser state live here.
export const BUILD_COST = 1;
export const STARTER_PADS = Object.freeze([6, 7, 4]);
export const FIRST_COUNTDOWN = 5;
export const BREAK_SECONDS = 8;
export const COMBO_WINDOW = 6;
export const BEAT_SECONDS = 60 / 96 / 2;
export const TOWER_LEVELS = Object.freeze([
  Object.freeze({ level: 1, damage: 25, range: 13 }),
  Object.freeze({ level: 2, damage: 40, range: 14 }),
  Object.freeze({ level: 3, damage: 60, range: 15 }),
]);
export const ENEMY_TYPES = Object.freeze({
  shade: Object.freeze({ name: '暗影', hp: 76, speed: 1.8, scale: 1, points: 100, color: 0x53636a }),
  runner: Object.freeze({ name: '疾影', hp: 58, speed: 2.65, scale: .78, points: 80, color: 0x9b8868 }),
  boss: Object.freeze({ name: '巨影', hp: 360, speed: 1.05, scale: 1.75, points: 300, color: 0x947c72 }),
  brute: Object.freeze({ name: '重影', hp: 225, speed: 1.12, scale: 1.38, points: 160, color: 0x756c86 }),
});
const rosters = [
  ['shade', 'shade', 'shade', 'shade', 'shade'],
  ['shade', 'runner', 'shade', 'runner', 'brute', 'runner', 'shade', 'brute'],
  ['runner', 'shade', 'brute', 'runner', 'shade', 'brute', 'runner', 'brute', 'brute', 'boss'],
];
export const WAVES = Object.freeze(rosters.map((roster, index) => Object.freeze({
  enemies: Object.freeze(roster), interval: [2.2, 1.8, 1.6][index],
})));
export const TOTAL_ENEMIES = WAVES.reduce((total, wave) => total + wave.enemies.length, 0);
export function comboAfterKill(previousCount, lastTime, now) {
  const count = previousCount > 0 && now - lastTime <= COMBO_WINDOW ? previousCount + 1 : 1;
  return {
    count,
    multiplier: count >= 10 ? 2 : count >= 6 ? 1.5 : count >= 3 ? 1.25 : 1,
    reward: count === 10 ? 2 : count === 3 || count === 6 ? 1 : 0,
  };
}
export function waveReward(leaks, health) {
  return { seeds: leaks === 0 ? 3 : 2, health: Math.min(6, health + 1), perfect: leaks === 0 };
}
export function towerStats(level = 1) {
  if (!Number.isInteger(level) || level < 1 || level > 3) throw new RangeError('Invalid tower level');
  return TOWER_LEVELS[level - 1];
}
export function planUpgrade(level, balance) {
  towerStats(level);
  if (!Number.isInteger(balance) || balance < 0) throw new RangeError('Invalid balance');
  if (level === 3) return { allowed: false, reason: 'max', balance, level, cost: 0 };
  const cost = level + 1;
  if (balance < cost) return { allowed: false, reason: 'funds', balance, level, cost };
  return { allowed: true, reason: null, balance: balance - cost, level: level + 1, cost };
}
export function waveSummary(waveNumber) {
  const wave = WAVES[waveNumber - 1];
  if (!wave) return '';
  const counts = {};
  for (const type of wave.enemies) counts[type] = (counts[type] || 0) + 1;
  return Object.entries(counts).map(([type, count]) => `${count} ${ENEMY_TYPES[type].name}`).join(' · ');
}
export function resultFor({ won, health, points, kills, duration, escaped = 0, maxCombo = 0 }) {
  return {
    won, stars: won ? (health === 6 && escaped === 0 ? 3 : health >= 3 ? 2 : 1) : 0,
    score: points + Math.max(0, health) * 150,
    kills, health, maxCombo, duration: Math.floor(duration),
  };
}

export const SUPPORT_COOLDOWN = .65;
export const FORESTS = Object.freeze([
  Object.freeze({ id:'mist', name:'雾松林', tag:'MIST & PINE', top:0x263854, horizon:0xe1a886, fog:0x5d737b, leaf:0x739c8d, grassHue:.25, sun:0xffd0a0, mote:0xffdca0, pitch:1 }),
  Object.freeze({ id:'firefly', name:'萤火林', tag:'FIREFLY GROVE', top:0x243449, horizon:0x98b9b0, fog:0x526e75, leaf:0x739f9c, grassHue:.30, sun:0xc7e0cf, mote:0xc9f2b0, pitch:9/8 }),
  Object.freeze({ id:'amber', name:'琥珀林', tag:'AMBER WOODS', top:0x47334b, horizon:0xf0b48a, fog:0x887d73, leaf:0xd9ae72, grassHue:.20, sun:0xffc486, mote:0xffd9a0, pitch:4/3 }),
]);
export function forestForRound(round) {
  const index = Number.isFinite(round) && round >= 0 ? Math.floor(round) : 0;
  return FORESTS[index % FORESTS.length];
}
export function planSupport(now, readyAt, untilNextBeat) {
  if (now < readyAt) return { allowed:false, readyAt, perfect:false, damage:0 };
  const phase = ((untilNextBeat % BEAT_SECONDS) + BEAT_SECONDS) % BEAT_SECONDS;
  const perfect = Math.min(phase, BEAT_SECONDS - phase) <= .07;
  return { allowed:true, readyAt:now + SUPPORT_COOLDOWN, perfect, damage:perfect ? 22 : 14 };
}
export function applyDamage(hp, damage) {
  const applied = Math.min(Math.max(0, hp), Math.max(0, damage));
  return { hp:Math.max(0, hp - applied), applied, killed:hp > 0 && hp - applied <= 0 };
}

export const ECHO_CAPACITY = 9;
export const OVERFLOW_POINTS = 50;
export const RESONANCE_DAMAGE = 18;
export function creditEchoes(balance, requested) {
  if (!Number.isInteger(balance) || balance < 0 || balance > ECHO_CAPACITY || !Number.isInteger(requested) || requested < 0) throw new RangeError('Invalid echo credit');
  const received = Math.min(requested, ECHO_CAPACITY - balance), overflow = requested - received;
  return { balance:balance + received, received, overflow, points:overflow * OVERFLOW_POINTS };
}
export function suggestUpgrade(pads, balance) {
  const order = [...STARTER_PADS, 5, 3, 2, 1, 0];
  const eligible = pads.filter(p => p.level > 0 && p.level < 3 && balance >= p.level + 1);
  eligible.sort((a,b) => a.level - b.level || order.indexOf(a.index) - order.indexOf(b.index));
  return eligible[0]?.index ?? null;
}
export function canResonate(combo, lastWave, currentWave) {
  return combo >= 6 && currentWave >= 1 && currentWave <= WAVES.length && lastWave !== currentWave;
}
export function recordForestStars(previous, forestId, stars) {
  const record = {};
  for (const forest of FORESTS) {
    const value = previous && typeof previous === 'object' ? previous[forest.id] : 0;
    record[forest.id] = Number.isInteger(value) ? Math.max(0, Math.min(3, value)) : 0;
  }
  if (FORESTS.some(f => f.id === forestId) && Number.isInteger(stars)) record[forestId] = Math.max(record[forestId], Math.max(0, Math.min(3, stars)));
  return record;
}
