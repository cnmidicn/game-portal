import * as THREE from './vendor/three.module.js';

// Geometry-side LOD for cached GLBs. The simplified buffers are built once per
// cached model and then shared by every clone, so adding LODs does not multiply
// memory with each creature instance.
function triangleCount(geometry) {
  if (!geometry?.attributes?.position) return 0;
  return geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3;
}

export function simplifyGeometry(geometry, ratio) {
  const position = geometry?.attributes?.position;
  if (!position) return geometry;
  const total = triangleCount(geometry);
  if (total < 72 || ratio >= 1) return geometry;
  const keep = Math.max(12, Math.floor(total * ratio));
  if (keep >= total) return geometry;
  const step = total / keep;
  const outPosition = [], outNormal = [], outUv = [], outColor = [];
  const normal = geometry.attributes.normal;
  const uv = geometry.attributes.uv;
  const color = geometry.attributes.color;
  const colorSize = color?.itemSize || 0;
  for (let t = 0; t < keep; t++) {
    const tri = Math.min(total - 1, Math.floor(t * step));
    for (let k = 0; k < 3; k++) {
      const i = geometry.index ? geometry.index.getX(tri * 3 + k) : tri * 3 + k;
      outPosition.push(position.getX(i), position.getY(i), position.getZ(i));
      if (normal) outNormal.push(normal.getX(i), normal.getY(i), normal.getZ(i));
      if (uv) outUv.push(uv.getX(i), uv.getY(i));
      if (color) for (let c = 0; c < colorSize; c++) outColor.push(color.getComponent(i, c));
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(outPosition, 3));
  if (outNormal.length) out.setAttribute('normal', new THREE.Float32BufferAttribute(outNormal, 3));
  if (outUv.length) out.setAttribute('uv', new THREE.Float32BufferAttribute(outUv, 2));
  if (outColor.length) out.setAttribute('color', new THREE.Float32BufferAttribute(outColor, colorSize));
  if (!outNormal.length) out.computeVertexNormals();
  out.computeBoundingSphere();
  return out;
}

export function makeCreatureLOD(model, name = 'creature') {
  const group = new THREE.Group();
  group.name = `${name}-lod`;
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z, 1) * 0.5;
  const distances = [0, Math.max(9, radius * 9), Math.max(24, radius * 22)];
  const ratios = [1, 0.5, 0.22];
  for (let level = 0; level < ratios.length; level++) {
    const clone = model.clone(true);
    clone.name = `${name}-lod-${level}`;
    clone.userData.lodLevel = level;
    clone.userData.lodDistances = distances;
    clone.traverse(o => {
      o.userData.sharedAsset = true;
      if (!o.isMesh || level === 0) return;
      if (o.isSkinnedMesh || o.morphTargetInfluences) return;
      if (Array.isArray(o.material) || !o.geometry) return;
      const simplified = simplifyGeometry(o.geometry, ratios[level]);
      if (simplified !== o.geometry) o.geometry = simplified;
    });
    clone.visible = level === 0;
    group.add(clone);
  }
  group.userData.lodWrapper = true;
  group.userData.sourceName = name;
  return group;
}

const _world = new THREE.Vector3();
const _scale = new THREE.Vector3();

export function updateCreatureLOD(group, camera, bias = 0) {
  if (!group?.userData?.lodWrapper) return -1;
  const levels = group.children.filter(child => child.userData.lodLevel !== undefined)
    .sort((a, b) => a.userData.lodLevel - b.userData.lodLevel);
  if (!levels.length) return -1;
  group.getWorldPosition(_world);
  group.getWorldScale(_scale);
  const scale = Math.max(0.0001, _scale.x);
  const distance = camera.position.distanceTo(_world) / scale * (1 + bias);
  const distances = levels[0].userData.lodDistances || [0, 9, 24];
  let chosen = 0;
  for (let i = 1; i < levels.length; i++) if (distance >= distances[i]) chosen = i;
  for (let i = 0; i < levels.length; i++) levels[i].visible = i === chosen;
  return chosen;
}
