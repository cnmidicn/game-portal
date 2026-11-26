// Long-term survival progression: permanent life levels, soft-capped attributes,
// offline gains and UTC+8 daily/weekly cadence. Pure functions, no side effects.

const DAY_MS = 86400000;
const SOFT = {
  startMass: 1.5,     // initial mass bonus plateaus at +150%
  efficiency: 0.06,   // efficiency = 1 / (1 + level * 0.06)
  healthEvery: 5,     // +1 membrane cap per 5 levels
  healthMax: 5,
  dashEvery: 4,       // -2% dash cooldown per 4 levels
  dashMax: 0.4
};

export function utc8Key(ts = Date.now()) {
  const d = new Date(ts + 8 * 3600000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
export function utc8Week(ts = Date.now()) {
  const d = new Date(ts + 8 * 3600000);
  const day = Math.floor(d.getTime() / DAY_MS);
  // 1970-01-01 was a Thursday; shift so Monday = 0.
  return Math.floor((day + 3) / 7);
}

// Biomass needed to advance from `level` to `level + 1`. Grows gently so the
// first levels feel quick and later months stay meaningful without stalling.
export function levelCost(level) {
  return Math.round(40 * Math.pow(1.16, Math.max(0, level)));
}
export function biomassToLevel(biomass) {
  let level = 0, spent = 0;
  while (level < 200 && spent + levelCost(level) <= biomass) {
    spent += levelCost(level);
    level++;
  }
  return level;
}
export function levelProgress(biomass) {
  const level = biomassToLevel(biomass);
  let spent = 0;
  for (let i = 0; i < level; i++) spent += levelCost(i);
  const need = levelCost(level);
  return { level, current: biomass - spent, need, ratio: need ? (biomass - spent) / need : 0 };
}

// Permanent attribute multipliers derived from life level. All soft-capped.
export function lifeAttributes(level = 0) {
  const L = Math.max(0, Math.floor(level));
  return {
    startMass: 1 + Math.min(SOFT.startMass, L * 0.02),
    efficiency: 1 / (1 + L * SOFT.efficiency),
    healthBonus: Math.min(SOFT.healthMax, Math.floor(L / SOFT.healthEvery)),
    dashReduction: Math.min(SOFT.dashMax, Math.floor(L / SOFT.dashEvery) * 0.02)
  };
}

// Per-run biomass cap so a single run cannot bank months of progress.
export function biomassCap(level = 0) {
  return 120 + Math.max(0, Math.floor(level)) * 8;
}
export function geneWeeklyCap() {
  return 3;
}
export function survivalReward(game, lifeLevel = 0) {
  const cap = biomassCap(lifeLevel);
  const fromMass = Math.round(game.player.mass * 0.12);
  const fromPrey = game.stats.prey * 2 + game.stats.structures * 3 + game.stats.bosses * 20;
  const biomass = Math.max(1, Math.min(cap, Math.round((fromMass + fromPrey) * 0.5)));
  const gene = game.stats.bosses > 0 ? 1 : 0;
  return { biomass, gene };
}

// Offline gain: at most 8 hours, 25% of a conservative online rate. A backwards
// system clock yields zero and an anomaly flag so the archive can record it.
export function offlineGain(lastClaimAt, now = Date.now(), lifeLevel = 0) {
  const result = { biomass: 0, gene: 0, seconds: 0, anomaly: false };
  if (!Number.isFinite(lastClaimAt) || lastClaimAt <= 0) return result;
  const elapsed = now - lastClaimAt;
  if (elapsed < 0) { result.anomaly = true; return result; }
  const seconds = Math.floor(Math.min(elapsed, 8 * 3600000) / 1000);
  const perHour = 18 + Math.max(0, Math.floor(lifeLevel)) * 0.6;
  result.seconds = seconds;
  result.biomass = Math.floor(perHour * 0.25 * (seconds / 3600));
  return result;
}

// Milestone goals that give players a reason to return across days/weeks/months.
export const EPOCH_DAYS = 84; // 12 weeks per epoch
export function epochOf(lifeLevel) {
  return Math.floor(Math.max(0, lifeLevel) / 20);
}
export function epochGoal(epoch) {
  return [
    '征服微光浅海，达成 32 μ',
    '解锁潮汐回廊与第二种起始形态',
    '进入晶簇深渊，发现第一组生命协奏',
    '击败海域霸主，开启守护者试炼',
    '完成第一次深海长歌纪元终章'
  ][Math.min(4, Math.max(0, epoch))];
}

// Deterministic growth simulation used by tests to prove no overflow/negatives
// across 30/90/180-day horizons.
export function simulateGrowth(runsPerDay, days, opts = {}) {
  const archive = { lifeLevel: opts.startLevel || 0, biomass: opts.startBiomass || 0, geneSamples: 0, lastDailyKey: '', lastOfflineClaimAt: 0 };
  let day = 0;
  const clockStart = Date.UTC(2026, 0, 1);
  for (day = 0; day < days; day++) {
    const key = utc8Key(clockStart + day * DAY_MS);
    for (let r = 0; r < runsPerDay; r++) {
      const fake = { player: { mass: 200 + r * 50 }, stats: { prey: 10 + r, structures: 2, bosses: r % 4 === 0 ? 1 : 0 } };
      const reward = survivalReward(fake, archive.lifeLevel);
      archive.biomass += reward.biomass;
      if (reward.gene) archive.geneSamples += reward.gene;
    }
    const nextLevel = biomassToLevel(archive.biomass);
    if (nextLevel > archive.lifeLevel) archive.lifeLevel = nextLevel;
    archive.lastDailyKey = key;
  }
  archive.lifeLevel = biomassToLevel(archive.biomass);
  return archive;
}
