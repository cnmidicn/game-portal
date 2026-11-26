// Central render-quality contract. Every subsystem reads its switches from
// here so the menu, auto-degradation and mobile mode cannot drift apart.
export const QUALITY_PRESETS = {
  low: {
    dprCap: 0.9, dust: 450, post: false, samples: 0,
    bloom: 0, ao: false, shafts: false, underwater: 0,
    vignette: 0.18, grain: 0.004, shadowMap: 0, cascades: 1,
    farShadow: false, causticsRepeat: 3, backgroundIntensity: 1.15,
    toneExposure: 2.05, microDetail: 0, particleScale: 0.35,
    lodBias: 1.6, gtao: false, dof: false, motionBlur: false,
    taa: false, lensFlare: false, filmLut: false, adaptiveExposure: false,
    waterLayers: 1
  },
  medium: {
    dprCap: 1.35, dust: 900, post: true, samples: 2,
    bloom: 0.45, ao: true, shafts: true, underwater: 0.6,
    vignette: 0.24, grain: 0.008, shadowMap: 1024, cascades: 1,
    farShadow: false, causticsRepeat: 4, backgroundIntensity: 0.92,
    toneExposure: 1.55, microDetail: 1, particleScale: 0.7,
    lodBias: 0.8, gtao: false, dof: false, motionBlur: false,
    taa: false, lensFlare: false, filmLut: true, adaptiveExposure: true,
    waterLayers: 2
  },
  high: {
    dprCap: 2, dust: 1700, post: true, samples: 4,
    bloom: 0.72, ao: true, shafts: true, underwater: 1,
    vignette: 0.30, grain: 0.012, shadowMap: 4096, cascades: 2,
    farShadow: true, causticsRepeat: 6, backgroundIntensity: 0.76,
    toneExposure: 1.58, microDetail: 2, particleScale: 1,
    lodBias: 0, gtao: true, dof: true, motionBlur: true,
    taa: true, lensFlare: true, filmLut: true, adaptiveExposure: true,
    waterLayers: 3
  }
};

const MOBILE_CAP = {
  dprCap: 1.5, dust: 900, shadowMap: 2048, cascades: 1,
  farShadow: false, dof: false, motionBlur: false, taa: false,
  lensFlare: false, samples: 2, microDetail: 1, particleScale: 0.65,
  waterLayers: 2
};

export function resolveQuality(requested = 'high', mobile = false, dpr = 1) {
  const mode = ['low', 'medium', 'high'].includes(requested) ? requested : 'high';
  const base = { ...QUALITY_PRESETS[mode] };
  if (mobile) {
    for (const [key, value] of Object.entries(MOBILE_CAP)) {
      if (typeof value === 'number' && typeof base[key] === 'number') {
        base[key] = Math.min(base[key], value);
      } else {
        base[key] = value;
      }
    }
  }
  base.mode = mode;
  base.mobile = !!mobile;
  base.ratio = Math.min(dpr || 1, base.dprCap);
  return base;
}

export function qualityRank(mode) {
  return ({ low: 0, medium: 1, high: 2 })[mode] ?? 2;
}
