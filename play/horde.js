import {lineageOf} from './lineages.js';

// Tidal Horde: a 3-5 minute dense-enemy mode. Enemies actively charge the
// player in waves; between waves the player picks one of three temporary
// upgrades. All rewards stay isolated from long-term survival unlocks.

export const HORDE_DURATION = 240; // 4 minutes
export const WAVE_SECONDS = 40;

export const WAVE_NAMES = [
  '鱼群涌动', '刺细胞浪潮', '甲壳前锋', '冲锋者突袭', '精英围猎', '潮汐霸主'
];

// Enemy kind per wave, cycling through the ecology species.
export function waveKind(wave) {
  return [0, 2, 3, 1, 3, 4][Math.min(5, Math.max(0, wave - 1))];
}
export function waveEnemyCount(wave) {
  return Math.min(26, 8 + wave * 3);
}
export function waveForTime(time) {
  return Math.min(6, 1 + Math.floor(time / WAVE_SECONDS));
}

// Temporary upgrades offered three at a time. Each belongs to an evolution
// lineage, so a surrounding swarm always offers rewards related to the creature
// the player is becoming. They never touch the permanent archive.
export const UPGRADES = [
  { id: 'bulk', lineage: 'colossus', icon: '◈', name: '巨口增益', desc: '吞噬范围 +30%，本局体型成长 +20%' },
  { id: 'magnet', lineage: 'resonance', icon: '◎', name: '引力浪潮', desc: '自动吸引 12m 内的猎物' },
  { id: 'dash', lineage: 'swift', icon: '➶', name: '疾速回流', desc: '冲刺冷却 -35%，冲刺时间 +50%' },
  { id: 'shield', lineage: 'colossus', icon: '⬡', name: '潮汐护膜', desc: '立即修复全部护膜，上限 +1' },
  { id: 'combo', lineage: 'resonance', icon: '♫', name: '共鸣激增', desc: '连击持续时间翻倍，分数倍率 +25%' },
  { id: 'pulse', lineage: 'resonance', icon: 'ϟ', name: '电流脉冲', desc: '每 6 秒自动麻痹周围天敌' }
];

function hashScore(id) {
  let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return (h % 11) * .01;
}

// Situational scoring is shared by the weighted roll and the auto-pick setting.
export function scoreHordeUpgrade(u, game) {
  let score = hashScore(u.id);
  const primary = lineageOf(game);
  if (primary && u.lineage === primary) score += 3;
  if ((game?.health ?? 3) <= 2 && u.id === 'shield') score += 7;
  else if ((game?.health ?? 3) <= 2 && u.id === 'pulse') score += 5;
  if ((game?.player?.mass ?? 8) < 60 && (u.id === 'bulk' || u.id === 'magnet')) score += 3;
  if ((game?.combo ?? 0) >= 10 && (u.id === 'combo' || u.id === 'pulse')) score += 4;
  if ((game?.creatures?.length ?? 0) >= 20 && (u.id === 'pulse' || u.id === 'dash')) score += 3;
  if ((game?.hordeWave ?? 1) >= 4 && (u.id === 'shield' || u.id === 'combo')) score += 2;
  if ((game?.hordeWave ?? 1) <= 2 && (u.id === 'bulk' || u.id === 'magnet')) score += 2;
  return score;
}

export function bestHordeUpgrade(game, choices = game?.hordeChoices || []) {
  return [...choices].sort((a, b) => scoreHordeUpgrade(b, game) - scoreHordeUpgrade(a, game))[0] || null;
}

export function rollUpgrades(rand = Math.random, owned = [], game = null) {
  const pool = UPGRADES.filter(u => !owned.includes(u.id));
  const pick = [...pool];
  for (let i = pick.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pick[i], pick[j]] = [pick[j], pick[i]];
  }
  // Keep randomness, but bias the final three toward the active lineage and
  // the current danger profile so choices feel authored rather than arbitrary.
  if (game) pick.sort((a, b) => scoreHordeUpgrade(b, game) - scoreHordeUpgrade(a, game));
  return pick.slice(0, 3);
}

// Apply a chosen upgrade to a live game. Returns a short toast label.
export function applyUpgrade(game, id) {
  const u = UPGRADES.find(u => u.id === id);
  if (!u) return '';
  game.hordeUpgrades = game.hordeUpgrades || [];
  if (game.hordeUpgrades.includes(id)) return '';
  game.hordeUpgrades.push(id);
  switch (id) {
    case 'bulk': game.hordeMouth = 1.3; game.hordeGrowth = 1.2; break;
    case 'magnet': game.hordeMagnet = 12; break;
    case 'dash': game.hordeDashCd = 0.65; game.hordeDashTime = 1.5; break;
    case 'shield': game.maxHealth = Math.min(10, game.maxHealth + 1); game.health = game.maxHealth; break;
    case 'combo': game.hordeComboTime = 2; game.hordeScoreMul = 1.25; break;
    case 'pulse': game.hordePulse = true; break;
  }
  return u.name;
}

export function hordeScore(game) {
  const base = game.hordePoints || 0;
  const comboBonus = Math.max(0, game.bestCombo) * 25;
  const waveBonus = Math.max(0, game.hordeWave || 0) * 200;
  return Math.round((base + comboBonus + waveBonus) * (game.hordeScoreMul || 1));
}

export function hordeGrade(score) {
  if (score >= 12000) return 'S';
  if (score >= 8000) return 'A';
  if (score >= 5000) return 'B';
  if (score >= 2500) return 'C';
  return 'D';
}

// Register points for a swallow in horde mode; small prey scale with combo.
export function registerKill(game, mass = 1, boss = false) {
  game.hordePoints = (game.hordePoints || 0) + Math.round((boss ? 500 : 10 + mass * 0.6) * Math.max(1, game.combo));
}

export function resetHorde(game) {
  game.hordePoints = 0;
  game.hordeWave = 1;
  game.hordeUpgrades = [];
  game.hordeMouth = 1;
  game.hordeGrowth = 1;
  game.hordeMagnet = 0;
  game.hordeDashCd = 1;
  game.hordeDashTime = 1;
  game.hordeComboTime = 1;
  game.hordeScoreMul = 1;
  game.hordePulse = false;
  game.hordePulseClock = 0;
  game.hordeChoices = [];
}

// Enemy director: called each horde update. Spawns a dense wave around the
// player and nudges every creature toward the player so they actively attack.
export function tickHorde(game, dt) {
  if (game.status !== 'playing') return;
  const wave = waveForTime(game.time);
  if (wave !== game.hordeWave) {
    game.hordeWave = wave;
    if (wave <= 6) {
      game.hordeChoices = rollUpgrades(game.random, game.hordeUpgrades, game);
      if (game.hordeChoices.length) { game.status = 'hordeUpgrade'; game.emit('hordeWave', { wave }); }
    }
  }

  // Continuously maintain a dense population surrounding the player.
  // Existing reset-spawned creatures are converted to horde behaviour so the
  // mode always plays as an active swarm regardless of initial population.
  const p = game.player;
  const target = waveEnemyCount(wave);
  for (const c of game.creatures) if (!c.boss && c.kind !== 4) c.horde = true;
  const living = game.creatures.filter(c => !c.boss && c.kind !== 4);
  for (let i = living.length; i < target; i++) {
    const a = game.rnd(0, Math.PI * 2), r = game.rnd(28, 62);
    const mass = Math.max(3, p.mass * game.rnd(0.12, 0.42));
    game.creatures.push({
      id: game.allocateId(), x: Math.max(-178, Math.min(178, p.x + Math.cos(a) * r)),
      z: Math.max(-178, Math.min(178, p.z + Math.sin(a) * r)), mass,
      radius: Math.max(0.8, Math.min(28, 0.85 * Math.sqrt(mass / 8))),
      angle: a, phase: game.rnd(0, 8), kind: waveKind(wave), stun: 0,
      boss: false, state: 'drift', attackClock: 0, horde: true
    });
  }

  // Automatic pulse upgrade: periodically stun nearby threats.
  if (game.hordePulse) {
    game.hordePulseClock = (game.hordePulseClock || 0) + dt;
    if (game.hordePulseClock >= 6) { game.hordePulseClock = 0; game.pulse(p.radius * 3 + 8, 1.6); game.emit('hordePulse'); }
  }
}

// Make a horde creature charge the player. Kept separate from ecology.creatureMotion
// so normal modes remain byte-for-byte unchanged.
export function hordeMotion(game, c, dt) {
  c.age = (c.age || 0) + dt;
  const p = game.player, dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz) || 0.01;
  const angle = Math.atan2(dz, dx);
  const speed = 7 + Math.min(c.radius * 0.4, 4) + game.hordeWave * 0.6;
  c.heading = angle;
  if (c.stun > 0) return { angle, speed: speed * 0.08 };
  return { angle, speed };
}
