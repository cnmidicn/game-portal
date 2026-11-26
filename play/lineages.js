// Biological evolution lineages. Every upgrade belongs to a route; choosing
// successive nodes changes both statistics and the final creature silhouette.

export const LINEAGES = [
  {
    id: 'predator', name: '裂甲巨颚', icon: '◈', color: '#f0c39a', trait: 'mouth',
    desc: '破开晶壳，吞噬接近自身体型的猎物。',
    stageNames: ['裂甲幼体', '裂甲猎手', '沧龙 · 巨颚王']
  },
  {
    id: 'swift', name: '逐浪鳍翼', icon: '➶', color: '#9ed9f8', trait: 'speed',
    desc: '游得更快，冲刺更频繁，最终化为流线型海猎手。',
    stageNames: ['逐浪幼体', '长鳍游猎者', '鱼龙 · 逐浪者']
  },
  {
    id: 'colossus', name: '巨壳深鲸', icon: '⬡', color: '#d0edc3', trait: 'shell',
    desc: '增大体型与护膜，用厚度换来生存。',
    stageNames: ['厚壳幼体', '巨壳潜行者', '龙王鲸 · 深海巨壁']
  },
  {
    id: 'resonance', name: '回声共鸣', icon: '♫', color: '#d9c7ff', trait: 'harmony',
    desc: '把连击、电流与引力编排成声波武器。',
    stageNames: ['回声细胞', '共鸣歌者', '抹香鲸 · 回声歌者']
  }
];

export const LINEAGE_IDS = LINEAGES.map(l => l.id);
const lineageById = id => LINEAGES.find(l => l.id === id);
const radiusFor = m => Math.min(28, .85 * Math.sqrt(Math.max(m, 8) / 8));
const RANK_LABEL = ['Ⅰ', 'Ⅱ', 'Ⅲ'];

// Base traits keep their original ids so old tests and saves stay valid.
const BASE_NODES = [
  { id: 'mouth', lineage: 'predator', rank: 1, stats: { mouth: 1.2, growth: 1.08, formBias: .35 } },
  { id: 'speed', lineage: 'swift', rank: 1, stats: { speed: 1.1, dashCd: .85, formBias: .35 } },
  { id: 'shell', lineage: 'colossus', rank: 1, stats: { massMul: 1.04, formBias: .8 } },
  { id: 'harmony', lineage: 'resonance', rank: 1, stats: { combo: 1.15, growth: 1.12, formBias: .45 } },
  { id: 'electric', lineage: 'resonance', rank: 1, stats: { abilityCd: .9, formBias: .35 } },
  { id: 'magnet', lineage: 'resonance', rank: 1, stats: { growth: 1.05, formBias: .3 } }
];

// Specializations are rank II nodes. They require the matching base trait.
const BRANCH_NODES = [
  { id: 'mouth-crusher', lineage: 'predator', rank: 2, requires: 'mouth', stats: { formBias: .6 } },
  { id: 'mouth-feast', lineage: 'predator', rank: 2, requires: 'mouth', stats: { formBias: .5 } },
  { id: 'speed-current', lineage: 'swift', rank: 2, requires: 'speed', stats: { formBias: .6 } },
  { id: 'speed-blink', lineage: 'swift', rank: 2, requires: 'speed', stats: { formBias: .7 } },
  { id: 'shell-bastion', lineage: 'colossus', rank: 2, requires: 'shell', stats: { massMul: 1.05, formBias: 1.1 } },
  { id: 'shell-echo', lineage: 'colossus', rank: 2, requires: 'shell', stats: { formBias: .9 } },
  { id: 'harmony-resonance', lineage: 'resonance', rank: 2, requires: 'harmony', stats: { formBias: .7 } },
  { id: 'harmony-bloom', lineage: 'resonance', rank: 2, requires: 'harmony', stats: { formBias: .8 } },
  { id: 'electric-chain', lineage: 'resonance', rank: 2, requires: 'electric', stats: { formBias: .7 } },
  { id: 'electric-capacitor', lineage: 'resonance', rank: 2, requires: 'electric', stats: { formBias: .6 } },
  { id: 'magnet-vortex', lineage: 'resonance', rank: 2, requires: 'magnet', stats: { formBias: .6 } },
  { id: 'magnet-orbit', lineage: 'resonance', rank: 2, requires: 'magnet', stats: { formBias: .65 } }
];

// Rank III nodes are the apex forms: each route ends as a different creature.
export const APEX_NODES = [
  {
    id: 'apex-mosasaur', lineage: 'predator', rank: 3, icon: '♛', name: '沧龙 · 巨颚王',
    desc: '颚部与尾鳍完全骨化，可以正面撕开任何晶壳。', hint: '终局形态 · 破甲与巨物',
    stats: { mouth: 1.2, growth: 1.15, maxHealth: 1, formBias: 1.05, massMul: 1.06 }
  },
  {
    id: 'apex-ichthyosaur', lineage: 'swift', rank: 3, icon: '➶', name: '鱼龙 · 逐浪者',
    desc: '月牙尾与长吻合为一体，冲刺几乎不停歇。', hint: '终局形态 · 速度与闪避',
    stats: { speed: 1.22, dashCd: .75, dashTime: 1.25, formBias: .75 }
  },
  {
    id: 'apex-basilosaur', lineage: 'colossus', rank: 3, icon: '⬡', name: '龙王鲸 · 深海巨壁',
    desc: '躯体拉长成缓慢移动的巨壁，护膜厚到能硬吃脉冲。', hint: '终局形态 · 体型与生命',
    stats: { maxHealth: 2, massMul: 1.14, formBias: 2.35 }
  },
  {
    id: 'apex-orca', lineage: 'resonance', rank: 3, icon: '♫', name: '抹香鲸 · 回声歌者',
    desc: '头部共鸣腔把整片海变成乐器，连击与电流同时增强。', hint: '终局形态 · 共鸣与控制',
    stats: { combo: 1.3, growth: 1.18, abilityCd: .75, formBias: 1.55 }
  }
];

const ALL_NODES = [...BASE_NODES, ...BRANCH_NODES, ...APEX_NODES];
export const PATH_EVOLUTION_IDS = ALL_NODES.map(n => n.id);
export function nodeFor(id) { return ALL_NODES.find(n => n.id === id) || null; }

export function rankOf(game, lineageId) {
  let rank = 0;
  for (const id of game?.lineageNodes || []) {
    const node = nodeFor(id);
    if (node && node.lineage === lineageId) rank = Math.max(rank, node.rank);
  }
  return rank;
}

export function lineageOf(game) {
  const nodes = (game?.lineageNodes || []).map(nodeFor).filter(Boolean);
  if (!nodes.length) return '';
  let best = '', bestScore = -1;
  for (const lineage of LINEAGES) {
    const count = nodes.filter(n => n.lineage === lineage.id).length;
    const score = rankOf(game, lineage.id) * 10 + count + (game.lineage === lineage.id ? .5 : 0);
    if (score > bestScore) { best = lineage.id; bestScore = score; }
  }
  return best;
}

export function lineageStats(game) {
  const stats = {
    growth: 1, speed: 1, dashCd: 1, dashTime: 1, mouth: 1,
    combo: 1, abilityCd: 1, maxHealth: 0, formBias: 0, invuln: 0
  };
  for (const id of game?.lineageNodes || []) {
    const node = nodeFor(id); if (!node?.stats) continue;
    for (const [key, value] of Object.entries(node.stats)) {
      if (key === 'maxHealth' || key === 'formBias' || key === 'invuln') stats[key] += value;
      else if (key !== 'massMul') stats[key] = (stats[key] ?? 1) * value;
    }
  }
  return stats;
}

export function lineageStageName(game, lineageId = lineageOf(game)) {
  const rank = rankOf(game, lineageId);
  return rank ? lineageById(lineageId)?.stageNames[rank - 1] || '' : '';
}
export function lineageFinalName(game) {
  const id = lineageOf(game);
  const lineage = lineageById(id);
  if (!lineage) return '';
  return lineage.stageNames[Math.max(0, rankOf(game, id) - 1)];
}
export function lineageFormBias(game) { return lineageStats(game).formBias; }
export function lineageColor(game) { return lineageById(lineageOf(game))?.color || ''; }
export function completedLineages(game) {
  const ids = new Set();
  for (const id of game?.lineageNodes || []) {
    const node = nodeFor(id);
    if (node?.rank === 3) ids.add(node.lineage);
  }
  return [...ids];
}

export function evolutionNodeInfo(id, game) {
  const node = nodeFor(id); if (!node) return null;
  const lineage = lineageById(node.lineage);
  return {
    lineage: lineage?.name || '', icon: lineage?.icon || '', color: lineage?.color || '',
    rank: RANK_LABEL[node.rank - 1] || '', stage: lineage?.stageNames[node.rank - 1] || node.name,
    isApex: node.rank === 3,
    current: lineageStageName(game, node.lineage)
  };
}

function shuffled(items, random) {
  const a = [...items], rand = typeof random === 'function' ? random : Math.random;
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export function availableEvolutionNodes(game, crossChapter = false, limit = 3) {
  const owned = new Set(game?.lineageNodes || []);
  const traits = new Set(game?.traits || []);
  const branchTrait = new Map(BRANCH_NODES.map(n => [n.id, n.requires]));
  const usedBranchTraits = new Set((game?.specializations || []).map(id => branchTrait.get(id)).filter(Boolean));
  const primary = lineageOf(game);
  const primaryRank = primary ? rankOf(game, primary) : 0;
  const valid = node => !owned.has(node.id) && !(node.rank === 1 && traits.has(node.id)) && (!node.requires || (traits.has(node.requires) && !usedBranchTraits.has(node.requires)));
  const pool = [];

  if (!primary) {
    pool.push(...ALL_NODES.filter(n => n.rank === 1 && valid(n)));
  } else {
    pool.push(...ALL_NODES.filter(n => n.lineage === primary && n.rank === primaryRank + 1 && valid(n)));
    if (primaryRank >= 3) {
      const apex = APEX_NODES.find(n => n.lineage === primary && valid(n));
      if (apex) pool.push(apex);
    }
    pool.push(...ALL_NODES.filter(n => n.rank === 1 && n.lineage !== primary && valid(n)));
    if (crossChapter) pool.push(...ALL_NODES.filter(n => n.rank === 2 && valid(n)));
  }

  const distinct = [...new Map(pool.map(n => [n.id, n])).values()];
  // Route continuity outranks novelty: always show the next node of the
  // established lineage first, then fill the remaining cards from other routes.
  const primaryPool = primary ? distinct.filter(n => n.lineage === primary && (n.rank === primaryRank + 1 || n.rank === 3)) : distinct.filter(n => n.rank === 1);
  const crossPool = distinct.filter(n => !primaryPool.includes(n));
  const unique = [...shuffled(primaryPool, game?.random), ...shuffled(crossPool, game?.random)];
  if (unique.length < limit) {
    for (const n of shuffled(ALL_NODES.filter(n => valid(n) && !unique.some(u => u.id === n.id)), game?.random)) {
      unique.push(n); if (unique.length >= limit) break;
    }
  }
  return unique.slice(0, limit);
}

export function registerLineageNode(game, id) {
  const node = nodeFor(id); if (!node) return null;
  if (!Array.isArray(game.lineageNodes)) game.lineageNodes = [];
  if (!game.lineageNodes.includes(id)) game.lineageNodes.push(id);
  const primary = lineageOf(game);
  if (primary) game.lineage = primary;
  const stats = node.stats || {};
  if (stats.maxHealth && game.maxHealth !== undefined) {
    game.maxHealth = Math.min(10, game.maxHealth + stats.maxHealth);
    game.health = Math.min(10, Math.max(game.health ?? 1, game.maxHealth));
  }
  if (stats.massMul && game.player) {
    game.player.mass *= stats.massMul;
    game.player.radius = radiusFor(game.player.mass);
    game.peakMass = Math.max(game.peakMass || 0, game.player.mass);
  }
  if (stats.invuln) game.invincible = (game.invincible || 0) + stats.invuln;
  if (typeof game.emit === 'function') {
    game.emit('lineage', { id, lineage: node.lineage, name: node.name, stage: lineageStageName(game, node.lineage) });
  }
  return node;
}

function hashScore(id) {
  let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return (h % 13) * .01;
}

export function scoreEvolution(node, game) {
  const primary = lineageOf(game), stats = node.stats || {};
  let score = node.rank * 3 + hashScore(node.id);
  if (primary === node.lineage) score += 4;
  else if (primary) score -= 1.5;
  if (!primary && node.rank === 1) score += 1;
  if ((game.health ?? 3) <= 2 && (stats.maxHealth || node.id === 'shell')) score += 5;
  if ((game.player?.mass ?? 8) < 60 && (stats.growth || stats.mouth)) score += 3;
  if (game.danger && (stats.speed || stats.dashCd || node.id === 'electric')) score += 4;
  if (game.mode === 'horde' && (stats.growth || stats.combo)) score += 2;
  return score;
}

export function bestEvolution(game, choices = game?.choices || []) {
  return [...choices].sort((a, b) => scoreEvolution(b, game) - scoreEvolution(a, game))[0] || null;
}
