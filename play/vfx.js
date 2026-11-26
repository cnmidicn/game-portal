import * as THREE from './vendor/three.module.js';

// Short-lived cinematic accents layered on top of the gameplay particles:
// expanding impact rings, speed streaks and a global bloom kick.
export class CinematicVFX {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.flashValue = 0;
    this.ringGeometry = new THREE.RingGeometry(.78, 1, 48);
    this.streakGeometry = new THREE.PlaneGeometry(.12, 4.5);
  }

  pulse(x, z, color = 0xa8fbc5, scale = 1, y = .35) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .7, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    const mesh = new THREE.Mesh(this.ringGeometry, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    mesh.scale.setScalar(scale * .45);
    this.scene.add(mesh);
    this.items.push({ mesh, life: .7, max: .7, grow: scale * 2.4, kind: 'ring' });
    this.flash(color, .16);
  }

  streak(x, z, heading = 0, color = 0x9fe8ff, scale = 1) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .38, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    const mesh = new THREE.Mesh(this.streakGeometry, mat);
    mesh.rotation.set(-Math.PI / 2, 0, -heading);
    mesh.position.set(x - Math.sin(heading) * 2.4, .5, z - Math.cos(heading) * 2.4);
    mesh.scale.set(scale, scale, 1);
    this.scene.add(mesh);
    this.items.push({ mesh, life: .42, max: .42, kind: 'streak', heading, x, z });
  }

  flash(color = 0xffffff, strength = .18) {
    this.flashValue = Math.max(this.flashValue, strength);
    this.flashColor = new THREE.Color(color);
  }

  event(type, game) {
    const p = game.player;
    if (type === 'dash') { this.streak(p.x, p.z, Math.atan2(p.vx || 0, p.vz || 1), 0xa8f0ff, 1.2); }
    else if (type === 'eat') this.pulse(p.x, p.z, 0xb9ffd4, 1.4);
    else if (type === 'perfect') this.pulse(p.x, p.z, 0xffe7a6, 2.1);
    else if (type === 'damage') { this.pulse(p.x, p.z, 0xff9b83, 2.6); this.flash(0xff7568, .28); }
    else if (type === 'ability') this.pulse(p.x, p.z, 0x9bd6ff, 3.4);
    else if (type === 'crescendo') this.flash(0xe8ffc0, .24);
  }

  update(dt) {
    this.flashValue = Math.max(0, this.flashValue - dt * 1.7);
    const alive = [];
    for (const item of this.items) {
      item.life -= dt;
      if (item.life <= 0) { this.scene.remove(item.mesh); item.mesh.material.dispose(); continue; }
      const k = 1 - item.life / item.max;
      if (item.kind === 'ring') {
        item.mesh.scale.setScalar(item.mesh.scale.x + item.grow * dt);
        item.mesh.material.opacity = (1 - k) * .7;
      } else {
        item.mesh.material.opacity = (1 - k) * .38;
        item.mesh.position.y = .5 + Math.sin(k * Math.PI) * .25;
      }
      alive.push(item);
    }
    this.items = alive;
  }
}
