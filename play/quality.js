// Central render-quality contract. Every subsystem reads its switches from
// here so the menu, auto-degradation and mobile mode cannot drift apart.
export const QUALITY_PRESETS = {
  low: {
    dprCap: 0.9, dust: 180, post: false, samples: 0,
    bloom: 0, ao: false, shafts: false, underwater: 0,
    vignette: 0.12, grain: 0.002, shadowMap: 0, cascades: 1,
    farShadow: false, causticsRepeat: 2, backgroundIntensity: 1.10,
    toneExposure: 2.0, microDetail: 0, particleScale: 0.35,
    lodBias: 1.6, gtao: false, dof: false, motionBlur: false,
    taa: false, lensFlare: false, filmLut: false, adaptiveExposure: false,
    waterLayers: 1
  },
  medium: {
    dprCap: 1.35, dust: 360, post: true, samples: 2,
    bloom: 0.32, ao: true, shafts: true, underwater: 0.6,
    vignette: 0.17, grain: 0.004, shadowMap: 1024, cascades: 1,
    farShadow: false, causticsRepeat: 3, backgroundIntensity: 0.94,
    toneExposure: 1.68, microDetail: 1, particleScale: 0.7,
    lodBias: 0.8, gtao: false, dof: false, motionBlur: false,
    taa: false, lensFlare: false, filmLut: true, adaptiveExposure: true,
    waterLayers: 2
  },
  high: {
    dprCap: 2, dust: 650, post: true, samples: 4,
    bloom: 0.42, ao: true, shafts: true, underwater: 1,
    vignette: 0.22, grain: 0.006, shadowMap: 4096, cascades: 2,
    farShadow: true, causticsRepeat: 4, backgroundIntensity: 0.84,
    toneExposure: 1.78, microDetail: 2, particleScale: 1,
    lodBias: 0, gtao: true, dof: true, motionBlur: true,
    taa: true, lensFlare: true, filmLut: true, adaptiveExposure: true,
    waterLayers: 2
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
