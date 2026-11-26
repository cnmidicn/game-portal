// Lightweight procedural life for scanned creatures. The GLBs are static, so
// a small state-driven transform layer supplies breathing, tail sway, warning
// recoil and stun wobble without changing gameplay or asset authorship.
const STATES = {
  idle:    { rate: 0.9, bob: 0.06, sway: 0.025, pitch: 0.012, breath: 0.012 },
  patrol:  { rate: 1.5, bob: 0.10, sway: 0.045, pitch: 0.022, breath: 0.018 },
  warning: { rate: 5.2, bob: 0.04, sway: 0.075, pitch: 0.045, breath: 0.040 },
  charge:  { rate: 8.4, bob: 0.02, sway: 0.030, pitch: 0.070, breath: 0.030 },
  attack:  { rate: 9.0, bob: 0.03, sway: 0.055, pitch: 0.085, breath: 0.026 },
  exposed: { rate: 1.2, bob: 0.13, sway: 0.060, pitch: 0.030, breath: 0.035 },
  pulse:   { rate: 4.4, bob: 0.18, sway: 0.030, pitch: 0.018, breath: 0.085 },
  stunned: { rate: 6.8, bob: 0.02, sway: 0.115, pitch: 0.090, breath: 0.008 },
  flee:    { rate: 4.0, bob: 0.08, sway: 0.070, pitch: 0.040, breath: 0.022 }
};

export function creatureAnimationState(c) {
  if (!c) return 'idle';
  if (c.stun > 0) return 'stunned';
  if (c.state === 'pulse') return 'pulse';
  if (c.state === 'charge') return 'charge';
  if (c.state === 'warning') return 'warning';
  if (c.state === 'exposed') return 'exposed';
  if (c.boss && c.state === 'exposed') return 'exposed';
  return c.kind === 2 ? 'pulse' : 'idle';
}

export class CreatureAnimator {
  constructor() { this.bases = new Map(); }

  apply(group, state, t, dt = 0.016) {
    const model = group?.userData?.fauna;
    if (!model) return null;
    let base = this.bases.get(model.uuid);
    if (!base) {
      base = {
        y: model.position.y,
        rx: model.rotation.x, rz: model.rotation.z,
        sx: model.scale.x, sy: model.scale.y, sz: model.scale.z,
        phase: (group.id || 1) * 0.73
      };
      this.bases.set(model.uuid, base);
    }
    const preset = STATES[state] || STATES.idle;
    const w = t * preset.rate + base.phase;
    const breath = 1 + Math.sin(w) * preset.breath;
    model.position.y = base.y + Math.sin(w * 0.8) * preset.bob;
    model.rotation.z = base.rz + Math.sin(w) * preset.sway;
    model.rotation.x = base.rx + Math.cos(w * 0.7) * preset.pitch;
    model.scale.set(base.sx * breath, base.sy * (1 + (breath - 1) * 0.55), base.sz * breath);
    return preset;
  }
}
