// Single source of truth for game modes and savable states.
// Every whitelist (game / checkpoint / progression / run-options / main / tests)
// must read from here so new modes are never silently downgraded.

export const MODES = {
  expedition: { id: 'expedition', name: '三海远征', group: 'more', timed: false, permanent: false },
  free: { id: 'free', name: '自由探索', group: 'more', timed: false, permanent: false },
  daily: { id: 'daily', name: '每日挑战', group: 'more', timed: true, permanent: false },
  survival: { id: 'survival', name: '深海长歌', group: 'primary', timed: false, permanent: true },
  horde: { id: 'horde', name: '潮汐围猎', group: 'primary', timed: true, permanent: false }
};

export const MODE_IDS = Object.keys(MODES);
export const MODE_NAMES = Object.fromEntries(MODE_IDS.map(id => [id, MODES[id].name]));
export const PRIMARY_MODES = MODE_IDS.filter(id => MODES[id].group === 'primary');
export const MORE_MODES = MODE_IDS.filter(id => MODES[id].group === 'more');

// Non-terminal states that can be resumed from a checkpoint.
export const SAVABLE_STATUS = new Set(['paused', 'briefing', 'evolution', 'interlude', 'victory', 'hordeUpgrade']);
// States that end a run and clear the save slot.
export const TERMINAL_STATUS = new Set(['dead', 'complete', 'timeup']);

export function isMode(mode) {
  return typeof mode === 'string' && Object.hasOwn(MODES, mode);
}
export function modeName(mode) {
  return MODE_NAMES[mode] || '自由探索';
}
export function isPermanentMode(mode) {
  return !!(MODES[mode] && MODES[mode].permanent);
}
export function isTimedMode(mode) {
  return !!(MODES[mode] && MODES[mode].timed);
}
export function isSavable(status) {
  return SAVABLE_STATUS.has(status);
}
export function isTerminal(status) {
  return TERMINAL_STATUS.has(status);
}
