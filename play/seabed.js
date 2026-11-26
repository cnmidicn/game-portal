import * as THREE from './vendor/three.module.js';

// Deterministic value noise used for large-scale seabed relief. The scene needs
// the same height field in JavaScript and GLSL-adjacent placement code, so the
// geometry is built here instead of living only inside a shader.
const fract = x => x - Math.floor(x);
function hash2(x, z) {
  return fract(Math.sin(x * 127.1 + z * 311.7) * 43758.5453123);
}
function valueNoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz), b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}
function fbm(x, z, octaves = 4) {
  let sum = 0, amp = 0.5, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x, z) * amp;
    norm += amp;
    x = x * 2.03 + 17.3;
    z = z * 2.01 - 9.1;
    amp *= 0.5;
  }
  return sum / norm;
}

// A quiet, ancient seafloor: broad sediment swells, current-scoured ridges and
// fine ripples. Amplitude stays below the swimming layer so gameplay is intact.
export function seabedHeight(x, z) {
  const basin = (fbm(x * 0.0038, z * 0.0038, 4) - 0.5) * 5.8;
  const shelf = (fbm(x * 0.011 + 31, z * 0.011 - 17, 3) - 0.5) * 1.9;
  const scour = Math.sin(x * 0.038 + Math.sin(z * 0.014) * 1.8) *
                Math.sin(z * 0.027 - Math.sin(x * 0.009) * 1.3) * 0.42;
  const ripple = Math.sin(x * 0.19 + z * 0.045 + Math.sin(z * 0.031) * 1.5) * 0.075;
  const grain = (fbm(x * 0.24, z * 0.24, 2) - 0.5) * 0.09;
  const height = -4 + basin + shelf + scour + ripple + grain;
  return Math.max(-6.2, Math.min(-2.15, height));
}

export function groundY(x, z, lift = 0) {
  return seabedHeight(x, z) + lift;
}

// Slope and substrate are shared with the ecology placement code so rocks,
// mats and burrowing fauna land on the right kind of bottom.
export function slopeAt(x, z) {
  const e = 1.4;
  const dx = (seabedHeight(x + e, z) - seabedHeight(x - e, z)) / (2 * e);
  const dz = (seabedHeight(x, z + e) - seabedHeight(x, z - e)) / (2 * e);
  return Math.min(1, Math.hypot(dx, dz) * 0.72);
}

export function biomeAt(x, z) {
  const y = seabedHeight(x, z), slope = slopeAt(x, z);
  const patch = fbm(x * 0.018 + 41, z * 0.018 - 23, 3);
  if (slope > 0.34 || patch < 0.31) return 2;          // exposed rock
  if (y < -4.65 || patch > 0.74) return 1;             // fine anoxic silt
  if (patch > 0.58) return 3;                          // microbial mat
  return 0;                                            // rippled sand
}

export function makeSeabedGeometry(size = 1100, segments = 256, offsetX = 0, offsetZ = 0) {
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const slopes = new Float32Array(position.count);
  const biomes = new Float32Array(position.count);
  for (let i = 0; i < position.count; i++) {
    const localX = position.getX(i), localZ = position.getZ(i);
    const x = localX + offsetX, z = localZ + offsetZ;
    const y = seabedHeight(x, z);
    position.setY(i, y);
    // Slightly darker in the scoured hollows, paler on the crests. This reads
    // as mineral sorting rather than a single flat colour.
    const silt = fbm(x * 0.026 + 7, z * 0.026 - 5, 3);
    const crest = Math.max(0, Math.min(1, (y + 5.4) / 3.2));
    const shade = 0.74 + silt * 0.24 + crest * 0.13;
    colors[i * 3] = shade * 0.88;
    colors[i * 3 + 1] = shade * 0.97;
    colors[i * 3 + 2] = shade;
    slopes[i] = slopeAt(x, z);
    biomes[i] = biomeAt(x, z);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSlope', new THREE.BufferAttribute(slopes, 1));
  geometry.setAttribute('aBiome', new THREE.BufferAttribute(biomes, 1));
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

// Four LOD tiles keep near sediment detail cheap: the player's tile is dense,
// distant tiles fall back to broad relief without visible seams.
export function makeSeabedTiles(size = 1100, segments = 160) {
  const group = new THREE.Group();
  group.name = 'seabed-lod';
  const tileSize = size / 2;
  const levels = [segments, Math.max(48, Math.round(segments * 0.62)), Math.max(28, Math.round(segments * 0.34))];
  for (let tz = 0; tz < 2; tz++) {
    for (let tx = 0; tx < 2; tx++) {
      const cx = (tx - 0.5) * tileSize, cz = (tz - 0.5) * tileSize;
      const lod = new THREE.LOD();
      lod.position.set(cx, 0, cz);
      levels.forEach((seg, i) => {
        const mesh = new THREE.Mesh(makeSeabedGeometry(tileSize, seg, cx, cz));
        mesh.receiveShadow = true;
        mesh.userData.seabedLevel = i;
        lod.addLevel(mesh, i === 0 ? 0 : i === 1 ? 260 : 620);
      });
      group.add(lod);
    }
  }
  return group;
}

function makeBlankTexture(rgb) {
  const texture = new THREE.DataTexture(new Uint8Array(rgb), 1, 1, THREE.RGBFormat);
  texture.needsUpdate = true;
  return texture;
}

export function loadSeabedTextures(maxAnisotropy = 8) {
  const loader = new THREE.TextureLoader();
  const load = (url, colorSpace) => {
    const texture = loader.load(url);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = Math.max(1, Math.min(16, maxAnisotropy));
    if (colorSpace) texture.colorSpace = colorSpace;
    return texture;
  };
  return {
    albedo: load('./assets/textures/seafloor-albedo.webp', THREE.SRGBColorSpace),
    normal: load('./assets/textures/seafloor-normal.webp'),
    roughness: load('./assets/textures/seafloor-roughness.webp')
  };
}

export const blankSeabedTextures = () => ({
  albedo: makeBlankTexture([104, 122, 120]),
  normal: makeBlankTexture([128, 128, 255]),
  roughness: makeBlankTexture([190, 190, 190])
});
