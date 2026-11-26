// Lightweight runtime telemetry. The HUD is opt-in via ?debugperf=1; the
// rolling numbers are always available to the adaptive quality controller.
const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

export class PerfMonitor {
  constructor() {
    this.samples = [];
    this.frames = 0;
    this.slow = 0;
    this.lastRecommendation = null;
    this.hud = null;
    this.hudVisible = false;
  }

  attachHud(container = document.body) {
    if (this.hud || !container) return this.hud;
    this.hud = document.createElement('div');
    this.hud.id = 'perf-hud';
    this.hud.className = 'perf-hud hidden';
    this.hud.setAttribute('aria-hidden', 'true');
    container.appendChild(this.hud);
    return this.hud;
  }

  setHud(visible) {
    this.hudVisible = !!visible;
    if (this.hud) this.hud.classList.toggle('hidden', !visible);
  }

  sample(delta, renderMs = 0, info = null) {
    const ms = Math.max(0, Math.min(200, (delta || 0) * 1000));
    this.samples.push(ms);
    if (this.samples.length > 120) this.samples.shift();
    this.frames++;
    this.slow = ms > 24 ? this.slow + 1 : Math.max(0, this.slow - 2);
    if (this.hudVisible && this.hud && this.frames % 12 === 0) this.renderHud(renderMs, info);
    return ms;
  }

  stats() {
    const s = this.samples;
    if (!s.length) return { fps: 0, avg: 0, p95: 0, slow: 0 };
    const sorted = [...s].sort((a, b) => a - b);
    const avg = s.reduce((a, b) => a + b, 0) / s.length;
    return {
      fps: Math.round(1000 / Math.max(1, avg)),
      avg: +avg.toFixed(1),
      p95: +sorted[Math.floor((sorted.length - 1) * 0.95)].toFixed(1),
      slow: this.slow
    };
  }

  recommend(currentMode = 'high') {
    const { p95, slow } = this.stats();
    if (this.samples.length < 90) return null;
    if (slow > 110 && p95 > 26 && currentMode !== 'low') return 'low';
    if (slow > 45 && p95 > 19.5 && currentMode === 'high') return 'medium';
    return null;
  }

  renderHud(renderMs, info) {
    const s = this.stats();
    const parts = [
      `FPS ${s.fps}`,
      `CPU ${s.avg}ms`,
      `P95 ${s.p95}ms`,
      `GPU-ish ${Number(renderMs || 0).toFixed(1)}ms`,
      `SLOW ${s.slow}`
    ];
    if (info) {
      parts.push(`DRAW ${info.render?.calls ?? 0}`);
      parts.push(`TRI ${info.render?.triangles ?? 0}`);
    }
    this.hud.textContent = parts.join(' · ');
  }
}

export function measure(fn) {
  const t0 = now();
  const value = fn();
  return { value, ms: now() - t0 };
}
