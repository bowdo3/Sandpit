import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const MODES = {
  nebula: {
    particleCount: 8000,
    shape: 'sphere',
    colors: [0x00f0ff, 0x8338ec, 0xff006e],
    size: 0.035,
    spread: 2.2,
    pulseSpeed: 1.2,
  },
  crystal: {
    particleCount: 6000,
    shape: 'icosahedron',
    colors: [0x00f0ff, 0xffffff, 0x8338ec],
    size: 0.045,
    spread: 1.8,
    pulseSpeed: 0.6,
  },
  pulse: {
    particleCount: 10000,
    shape: 'torus',
    colors: [0xff006e, 0xffbe0b, 0x00f0ff],
    size: 0.028,
    spread: 2.5,
    pulseSpeed: 2.4,
  },
  storm: {
    particleCount: 12000,
    shape: 'galaxy',
    colors: [0x8338ec, 0x00f0ff, 0xffffff],
    size: 0.022,
    spread: 3.2,
    pulseSpeed: 3.0,
  },
};

const canvas = document.getElementById('canvas');
const touchCountEl = document.getElementById('touch-count');
const energyLevelEl = document.getElementById('energy-level');
const rippleLayer = document.getElementById('ripple-layer');
const controlBtns = document.querySelectorAll('.control-btn');

let currentMode = 'nebula';
let touchCount = 0;
let energy = 0;
let targetEnergy = 0;

const impulses = [];
const shockwaves = [];
const screenRippleColors = ['', 'magenta', 'violet'];

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x05060f, 0.08);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 6);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x05060f, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enablePan = false;
controls.minDistance = 3;
controls.maxDistance = 12;
controls.rotateSpeed = 0.6;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const interactionPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const hitPoint = new THREE.Vector3();

let particleSystem = null;
let coreMesh = null;
let ringMeshes = [];
let basePositions = null;
let velocities = null;
let colorPalette = null;

function createShapePositions(mode, count) {
  const positions = new Float32Array(count * 3);
  const spread = mode.spread;

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    let x, y, z;

    switch (mode.shape) {
      case 'icosahedron': {
        const phi = Math.acos(1 - 2 * Math.random());
        const theta = Math.random() * Math.PI * 2;
        const r = spread * (0.85 + Math.random() * 0.15);
        x = r * Math.sin(phi) * Math.cos(theta);
        y = r * Math.sin(phi) * Math.sin(theta);
        z = r * Math.cos(phi);
        const facet = Math.floor(Math.random() * 20);
        const facetAngle = (facet / 20) * Math.PI * 2;
        x += Math.cos(facetAngle) * 0.08;
        y += Math.sin(facetAngle) * 0.08;
        break;
      }
      case 'torus': {
        const u = Math.random() * Math.PI * 2;
        const v = Math.random() * Math.PI * 2;
        const R = spread * 0.7;
        const r = spread * 0.35;
        x = (R + r * Math.cos(v)) * Math.cos(u);
        y = (R + r * Math.cos(v)) * Math.sin(u);
        z = r * Math.sin(v);
        break;
      }
      case 'galaxy': {
        const arm = Math.floor(Math.random() * 3);
        const dist = Math.pow(Math.random(), 0.5) * spread;
        const spin = dist * 2.5 + arm * ((Math.PI * 2) / 3);
        x = Math.cos(spin) * dist;
        y = (Math.random() - 0.5) * spread * 0.15;
        z = Math.sin(spin) * dist;
        break;
      }
      default: {
        const phi = Math.acos(1 - 2 * Math.random());
        const theta = Math.random() * Math.PI * 2;
        const r = spread * Math.cbrt(Math.random());
        x = r * Math.sin(phi) * Math.cos(theta);
        y = r * Math.sin(phi) * Math.sin(theta);
        z = r * Math.cos(phi);
      }
    }

    positions[i3] = x;
    positions[i3 + 1] = y;
    positions[i3 + 2] = z;
  }

  return positions;
}

function buildParticleColors(mode, count) {
  const colors = new Float32Array(count * 3);
  const palette = mode.colors.map((c) => new THREE.Color(c));

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const color = palette[Math.floor(Math.random() * palette.length)];
    colors[i3] = color.r;
    colors[i3 + 1] = color.g;
    colors[i3 + 2] = color.b;
  }

  return { colors, palette };
}

function disposeParticleSystem() {
  if (particleSystem) {
    scene.remove(particleSystem);
    particleSystem.geometry.dispose();
    particleSystem.material.dispose();
    particleSystem = null;
  }
  if (coreMesh) {
    scene.remove(coreMesh);
    coreMesh.geometry.dispose();
    coreMesh.material.dispose();
    coreMesh = null;
  }
  ringMeshes.forEach((ring) => {
    scene.remove(ring);
    ring.geometry.dispose();
    ring.material.dispose();
  });
  ringMeshes = [];
}

function buildScene(modeKey) {
  disposeParticleSystem();
  const mode = MODES[modeKey];
  currentMode = modeKey;

  const count = mode.particleCount;
  basePositions = createShapePositions(mode, count);
  velocities = new Float32Array(count * 3);

  const { colors, palette } = buildParticleColors(mode, count);
  colorPalette = palette;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(basePositions.slice(), 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: mode.size,
    vertexColors: true,
    transparent: true,
    opacity: 0.92,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });

  particleSystem = new THREE.Points(geometry, material);
  scene.add(particleSystem);

  const coreGeo = new THREE.IcosahedronGeometry(0.35, 2);
  const coreMat = new THREE.MeshBasicMaterial({
    color: mode.colors[0],
    wireframe: true,
    transparent: true,
    opacity: 0.35,
  });
  coreMesh = new THREE.Mesh(coreGeo, coreMat);
  scene.add(coreMesh);

  for (let i = 0; i < 3; i++) {
    const ringGeo = new THREE.TorusGeometry(1.2 + i * 0.45, 0.008, 8, 128);
    const ringMat = new THREE.MeshBasicMaterial({
      color: mode.colors[i % mode.colors.length],
      transparent: true,
      opacity: 0.15 - i * 0.03,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2 + i * 0.3;
    ring.rotation.y = i * 0.5;
    scene.add(ring);
    ringMeshes.push(ring);
  }

  scene.fog.color.setHex(0x05060f);
}

function pointerToNDC(clientX, clientY) {
  pointer.x = (clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(clientY / window.innerHeight) * 2 + 1;
}

function getWorldHitPoint() {
  raycaster.setFromCamera(pointer, camera);
  interactionPlane.normal.copy(camera.getWorldDirection(new THREE.Vector3())).negate();
  interactionPlane.constant = -interactionPlane.normal.dot(particleSystem ? particleSystem.position : new THREE.Vector3());
  return raycaster.ray.intersectPlane(interactionPlane, hitPoint) ? hitPoint.clone() : null;
}

function addImpulse(worldPoint, strength = 1.4) {
  impulses.push({
    position: worldPoint.clone(),
    strength,
    radius: 0.5,
    maxRadius: 2.8,
    age: 0,
    life: 1.2,
  });
}

function addShockwave(worldPoint, colorIndex = 0) {
  const color = colorPalette[colorIndex % colorPalette.length];
  const geo = new THREE.RingGeometry(0.05, 0.12, 64);
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(worldPoint);
  mesh.lookAt(camera.position);
  scene.add(mesh);

  shockwaves.push({
    mesh,
    age: 0,
    life: 1.0,
    maxScale: 4.5,
  });
}

function addScreenRipple(clientX, clientY) {
  const ripple = document.createElement('div');
  ripple.className = 'screen-ripple ' + screenRippleColors[touchCount % screenRippleColors.length];
  const size = Math.min(window.innerWidth, window.innerHeight) * 0.5;
  ripple.style.width = size + 'px';
  ripple.style.height = size + 'px';
  ripple.style.left = clientX + 'px';
  ripple.style.top = clientY + 'px';
  rippleLayer.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove());
}

function registerInteraction(clientX, clientY, strength = 1) {
  pointerToNDC(clientX, clientY);
  const worldPoint = getWorldHitPoint();

  touchCount += 1;
  targetEnergy = Math.min(100, targetEnergy + 8 * strength);
  touchCountEl.textContent = String(touchCount);

  addScreenRipple(clientX, clientY);

  if (worldPoint) {
    addImpulse(worldPoint, 1.6 * strength);
    addShockwave(worldPoint, touchCount % colorPalette.length);
    addShockwave(worldPoint, (touchCount + 1) % colorPalette.length);

    const burstCount = 3;
    for (let i = 0; i < burstCount; i++) {
      setTimeout(() => {
        const offset = new THREE.Vector3(
          (Math.random() - 0.5) * 0.4,
          (Math.random() - 0.5) * 0.4,
          (Math.random() - 0.5) * 0.4
        );
        addImpulse(worldPoint.clone().add(offset), 0.6 * strength);
      }, i * 80);
    }
  }

  if (coreMesh) {
    coreMesh.material.opacity = 0.7;
    coreMesh.scale.setScalar(1.3);
  }
}

function onPointerDown(event) {
  if (event.target.closest('.control-btn, .hud, .hint')) return;

  const strength = event.pointerType === 'touch' ? 1.2 : 1;
  registerInteraction(event.clientX, event.clientY, strength);
}

function updateParticles(time, delta) {
  if (!particleSystem || !basePositions) return;

  const mode = MODES[currentMode];
  const positions = particleSystem.geometry.attributes.position.array;
  const colors = particleSystem.geometry.attributes.color.array;
  const count = mode.particleCount;

  for (let i = impulses.length - 1; i >= 0; i--) {
    impulses[i].age += delta;
    impulses[i].radius += delta * 3.5;
    if (impulses[i].age > impulses[i].life) impulses.splice(i, 1);
  }

  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const sw = shockwaves[i];
    sw.age += delta;
    const t = sw.age / sw.life;
    const scale = 1 + t * sw.maxScale;
    sw.mesh.scale.set(scale, scale, scale);
    sw.mesh.material.opacity = 0.85 * (1 - t);
    if (sw.age >= sw.life) {
      scene.remove(sw.mesh);
      sw.mesh.geometry.dispose();
      sw.mesh.material.dispose();
      shockwaves.splice(i, 1);
    }
  }

  const globalPulse = Math.sin(time * mode.pulseSpeed) * 0.04;

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const bx = basePositions[i3];
    const by = basePositions[i3 + 1];
    const bz = basePositions[i3 + 2];

    let fx = 0;
    let fy = 0;
    let fz = 0;

    for (const imp of impulses) {
      const dx = bx + velocities[i3] - imp.position.x;
      const dy = by + velocities[i3 + 1] - imp.position.y;
      const dz = bz + velocities[i3 + 2] - imp.position.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist < imp.radius && dist > 0.001) {
        const falloff = 1 - dist / imp.radius;
        const force = imp.strength * falloff * falloff;
        fx += (dx / dist) * force * delta * 8;
        fy += (dy / dist) * force * delta * 8;
        fz += (dz / dist) * force * delta * 8;
      }
    }

    const distFromOrigin = Math.sqrt(bx * bx + by * by + bz * bz) || 1;
    const returnForce = 2.5 + energy * 0.02;
    fx += (-bx / distFromOrigin) * returnForce * delta * (distFromOrigin > mode.spread ? 2 : 0.3);
    fy += (-by / distFromOrigin) * returnForce * delta * (distFromOrigin > mode.spread ? 2 : 0.3);
    fz += (-bz / distFromOrigin) * returnForce * delta * (distFromOrigin > mode.spread ? 2 : 0.3);

    velocities[i3] = (velocities[i3] + fx) * 0.92;
    velocities[i3 + 1] = (velocities[i3 + 1] + fy) * 0.92;
    velocities[i3 + 2] = (velocities[i3 + 2] + fz) * 0.92;

    const pulse = 1 + globalPulse + Math.sin(time * 2 + i * 0.01) * 0.02;
    positions[i3] = bx * pulse + velocities[i3];
    positions[i3 + 1] = by * pulse + velocities[i3 + 1];
    positions[i3 + 2] = bz * pulse + velocities[i3 + 2];

    const energyGlow = energy / 100;
    colors[i3] = Math.min(1, colors[i3] + energyGlow * 0.01);
    colors[i3 + 1] = Math.min(1, colors[i3 + 1] + energyGlow * 0.005);
    colors[i3 + 2] = Math.min(1, colors[i3 + 2] + energyGlow * 0.015);
  }

  particleSystem.geometry.attributes.position.needsUpdate = true;
  particleSystem.geometry.attributes.color.needsUpdate = true;

  if (coreMesh) {
    coreMesh.rotation.x = time * 0.4;
    coreMesh.rotation.y = time * 0.6;
    coreMesh.material.opacity += (0.35 - coreMesh.material.opacity) * delta * 3;
    const targetScale = 1 + energy / 200;
    coreMesh.scale.x += (targetScale - coreMesh.scale.x) * delta * 4;
    coreMesh.scale.y = coreMesh.scale.x;
    coreMesh.scale.z = coreMesh.scale.x;
  }

  ringMeshes.forEach((ring, i) => {
    ring.rotation.z = time * (0.2 + i * 0.1);
    ring.rotation.x = Math.PI / 2 + Math.sin(time * 0.5 + i) * 0.2;
    ring.material.opacity = (0.15 - i * 0.03) + (energy / 100) * 0.2;
  });

  particleSystem.rotation.y = time * 0.05;
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function setMode(modeKey) {
  buildScene(modeKey);
  impulses.length = 0;
  controlBtns.forEach((btn) => {
    const active = btn.dataset.mode === modeKey;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
}

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  const time = clock.getElapsedTime();

  energy += (targetEnergy - energy) * delta * 4;
  targetEnergy = Math.max(0, targetEnergy - delta * 6);
  energyLevelEl.textContent = Math.round(energy) + '%';

  updateParticles(time, delta);
  controls.update();
  renderer.render(scene, camera);
}

canvas.addEventListener('pointerdown', onPointerDown);
window.addEventListener('resize', onResize);

controlBtns.forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    setMode(btn.dataset.mode);
    registerInteraction(window.innerWidth / 2, window.innerHeight / 2, 1.5);
  });
});

buildScene('nebula');
animate();
