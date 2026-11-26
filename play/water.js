import * as THREE from './vendor/three.module.js';

// Water optics shared by the seabed, environment reflections and post stack.
// The class is deliberately data-only: no fullscreen quads are added here,
// avoiding the hard horizontal bands that scene-space beam geometry produced.
export class WaterOptics {
  constructor(scene, caustics) {
    this.scene = scene;
    this.caustics = caustics;
    this.absorption = new THREE.Vector3(.50, .83, 1.04);
    this.scattering = new THREE.Color(0x0a2a34);
    this.environmentTarget = 1.0;
  }

  makeCaustics(size = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d'), image = ctx.createImageData(size, size), data = image.data;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = x / size * Math.PI * 2, v = y / size * Math.PI * 2;
      const a = Math.sin(u * 4 + Math.sin(v * 2.5) * 1.7) + Math.sin(v * 5 + Math.sin(u * 3.5) * 1.5) + Math.sin((u - v) * 3.2);
      const b = Math.sin(u * 9 - v * 7) + Math.sin(v * 8 + u * 5) * .6;
      const n = Math.min(1, Math.pow(Math.max(0, 1 - Math.abs(a) * .32), 14) * .9 + Math.pow(Math.max(0, 1 - Math.abs(b) * .45), 20) * .5);
      const i = (y * size + x) * 4;
      data[i] = 180 * n; data[i + 1] = 255 * n; data[i + 2] = 220 * n; data[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(6, 6);
    return texture;
  }

  update(period, t, dt, preset) {
    if (this.caustics) {
      this.caustics.offset.x = t * .006;
      this.caustics.offset.y = t * .004;
      this.caustics.repeat.setScalar(preset?.causticsRepeat ?? 6);
    }
    // Real HDRI reflections are kept, but their intensity follows the era and
    // quality: shallow eras glint more, abyssal eras swallow specular response.
    const target = (preset?.microDetail ? 1.14 : .82) * (period?.shallow?.[1] ? .75 + period.shallow[1] * 3 : 1);
    this.environmentTarget = Math.max(.55, Math.min(1.5, target));
    if ('environmentIntensity' in this.scene) {
      this.scene.environmentIntensity += (this.environmentTarget - (this.scene.environmentIntensity ?? 1)) * Math.min(1, dt * 2);
    }
    this.scattering.setRGB(period?.deep?.[0] ?? .014, period?.deep?.[1] ?? .067, period?.deep?.[2] ?? .084);
    this.scattering.multiplyScalar(3.8);
  }

  bindCinematic(cinematic) {
    const u = cinematic?.compose?.uniforms;
    if (!u) return;
    if (!u.waterTint) u.waterTint = { value: this.scattering.clone() };
    if (!u.hazeStrength) u.hazeStrength = { value: 1 };
    u.waterTint.value.copy(this.scattering);
    u.hazeStrength.value = 1;
  }
}
