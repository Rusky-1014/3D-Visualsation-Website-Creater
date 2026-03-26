// ─── ThreeStage Auth — 3D Neural Network Background ────────
import * as THREE from 'three';

const { gsap } = window;

// ─────────────────────────────────────────────────────────────────
// 0. GLOBAL MOUSE & CURSOR STATE
// ─────────────────────────────────────────────────────────────────
let mx = window.innerWidth / 2;
let my = window.innerHeight / 2;
let mxNorm = 0, myNorm = 0;

// Update mouse coordinates based on user input (or fallback logic)
document.addEventListener('mousemove', (e) => {
  mx = e.clientX;
  my = e.clientY;
  mxNorm = (mx / window.innerWidth - 0.5) * 2;
  myNorm = (my / window.innerHeight - 0.5) * 2;
});

// Cursor Glow
const cursorGlow = document.getElementById('cursor-glow');
gsap.ticker.add(() => {
  gsap.set(cursorGlow, { x: mx, y: my });
});

// Interactive hover
document.querySelectorAll('a, button, input, .checkbox-container').forEach(el => {
  el.addEventListener('mouseenter', () => cursorGlow.style.transform = 'translate(-50%, -50%) scale(1.5)');
  el.addEventListener('mouseleave', () => cursorGlow.style.transform = 'translate(-50%, -50%) scale(1)');
});

// ─────────────────────────────────────────────────────────────────
// 1. MOUSE TRAIL (Water drop)
// ─────────────────────────────────────────────────────────────────
(function initTrail() {
  const canvas = document.getElementById('trail-canvas');
  const ctx = canvas.getContext('2d');
  let w, h;
  
  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const TRAIL_LENGTH = 25;
  const trail = [];

  function animate() {
    requestAnimationFrame(animate);
    ctx.clearRect(0, 0, w, h);
    
    trail.push({ x: mx, y: my });
    if (trail.length > TRAIL_LENGTH) trail.shift();
    
    for (let i = 0; i < trail.length; i++) {
      const t = trail[i];
      const progress = i / trail.length;
      const alpha = progress * 0.3;
      const radius = progress * 6 + 1;
      
      ctx.beginPath();
      ctx.arc(t.x, t.y, radius, 0, Math.PI * 2);
      
      const gradient = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, radius);
      gradient.addColorStop(0, `rgba(0, 204, 255, ${alpha})`);
      gradient.addColorStop(1, `rgba(124, 58, 237, 0)`);
      ctx.fillStyle = gradient;
      ctx.fill();
    }
  }
  animate();
})();

// ─────────────────────────────────────────────────────────────────
// 2. AUTH TOGGLE LOGIC
// ─────────────────────────────────────────────────────────────────
const tabBtns = document.querySelectorAll('.tab-btn');
const tabIndicator = document.querySelector('.tab-indicator');
const authBox = document.querySelector('.auth-box');

tabBtns.forEach((btn, index) => {
  btn.addEventListener('click', () => {
    // UI Update
    tabBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    tabIndicator.style.transform = `translateX(${index * 100}%)`;
    
    // Form Toggle with GSAP
    const targetId = btn.getAttribute('data-target') + '-form';
    document.querySelectorAll('.auth-form').forEach(form => {
      if (form.id === targetId) {
        form.classList.add('active');
        gsap.fromTo(form, { opacity: 0, x: index === 0 ? -20 : 20 }, { opacity: 1, x: 0, duration: 0.4, ease: 'power2.out' });
      } else {
        form.classList.remove('active');
      }
    });

    // 3D Scene Effect: Rotate dramatic twist
    cameraTargetRot += (index === 0 ? -1 : 1) * Math.PI / 4;
    gsap.to(camera.position, {
      z: 50 + index * 10,
      duration: 1.5,
      ease: 'power3.inOut'
    });
  });
});

// ─────────────────────────────────────────────────────────────────
// 3. 3D NEURAL DATA CORE (Three.js)
// ─────────────────────────────────────────────────────────────────
const canvas = document.getElementById('auth-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2('#030303', 0.015);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(0, 0, 50);
let cameraTargetRot = 0;

// Create Neural Points & Lines
const PARTICLE_COUNT = 300;
const MAX_DISTANCE = 12;

const positions = new Float32Array(PARTICLE_COUNT * 3);
const velocities = [];
const basePositions = [];

// Layout nodes in a sphere
for (let i = 0; i < PARTICLE_COUNT; i++) {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos((Math.random() * 2) - 1);
  const r = 25 + Math.random() * 10;

  const x = r * Math.sin(phi) * Math.cos(theta);
  const y = r * Math.sin(phi) * Math.sin(theta);
  const z = r * Math.cos(phi);

  positions[i*3] = x;
  positions[i*3+1] = y;
  positions[i*3+2] = z;

  basePositions.push(new THREE.Vector3(x, y, z));
  velocities.push(new THREE.Vector3(
    (Math.random() - 0.5) * 0.05,
    (Math.random() - 0.5) * 0.05,
    (Math.random() - 0.5) * 0.05
  ));
}

const particlesGeo = new THREE.BufferGeometry();
particlesGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

const particleMat = new THREE.PointsMaterial({
  color: 0x00ccff,
  size: 0.4,
  transparent: true,
  opacity: 0.8,
  blending: THREE.AdditiveBlending
});

const particles = new THREE.Points(particlesGeo, particleMat);
scene.add(particles);

// Create Lines
const linesGeo = new THREE.BufferGeometry();
// Max lines = N * (N-1) / 2
const linePositions = new Float32Array(PARTICLE_COUNT * PARTICLE_COUNT * 3);
const lineColors = new Float32Array(PARTICLE_COUNT * PARTICLE_COUNT * 3);
linesGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
linesGeo.setAttribute('color', new THREE.BufferAttribute(lineColors, 3));

const lineMat = new THREE.LineBasicMaterial({
  vertexColors: true,
  transparent: true,
  opacity: 0.35,
  blending: THREE.AdditiveBlending
});

const linesMesh = new THREE.LineSegments(linesGeo, lineMat);
scene.add(linesMesh);

// Center glowing massive sphere
const coreGeo = new THREE.IcosahedronGeometry(8, 2);
const coreMat = new THREE.MeshBasicMaterial({
  color: 0x7c3aed,
  wireframe: true,
  transparent: true,
  opacity: 0.1
});
const core = new THREE.Mesh(coreGeo, coreMat);
scene.add(core);


window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
const mouseVec = new THREE.Vector3();
const raycaster = new THREE.Raycaster();

// Keyboard interaction — pulse on typing
document.querySelectorAll('input').forEach(input => {
  input.addEventListener('keydown', () => {
    // Create a burst in the center core
    gsap.fromTo(core.scale, { x: 1.5, y: 1.5, z: 1.5 }, { x: 1, y: 1, z: 1, duration: 0.6, ease: 'elastic.out(1, 0.3)' });
    gsap.fromTo(core.material, { opacity: 0.4 }, { opacity: 0.1, duration: 0.6 });
  });
});

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  // Mouse Raycasting to repel nodes
  mouseVec.set(mxNorm, -myNorm, 0.5);
  mouseVec.unproject(camera);
  mouseVec.sub(camera.position).normalize();
  const distance = -camera.position.z / mouseVec.z;
  const mouseWorld = camera.position.clone().add(mouseVec.multiplyScalar(distance));

  let vertexCount = 0;
  const posArr = particlesGeo.attributes.position.array;

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const base = basePositions[i];
    const v = velocities[i];
    
    // Drift
    posArr[i*3] += v.x;
    posArr[i*3+1] += v.y;
    posArr[i*3+2] += v.z;

    const currentPos = new THREE.Vector3(posArr[i*3], posArr[i*3+1], posArr[i*3+2]);

    // Spring back to base
    const spring = new THREE.Vector3().subVectors(base, currentPos).multiplyScalar(0.01);
    v.add(spring);
    // Friction
    v.multiplyScalar(0.95);

    // Mouse Repel
    const dx = currentPos.x - mouseWorld.x;
    const dy = currentPos.y - mouseWorld.y;
    const dz = currentPos.z - mouseWorld.z;
    const distSq = dx*dx + dy*dy + dz*dz;
    
    // Only repel if mouse is active and near
    if (distSq < 150) {
      const force = (150 - distSq) / 150;
      v.x += (dx / Math.sqrt(distSq)) * force * 0.2;
      v.y += (dy / Math.sqrt(distSq)) * force * 0.2;
      v.z += (dz / Math.sqrt(distSq)) * force * 0.2;
    }
  }

  // Update lines based on distance
  let lineIdx = 0;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    for (let j = i + 1; j < PARTICLE_COUNT; j++) {
      const dx = posArr[i*3] - posArr[j*3];
      const dy = posArr[i*3+1] - posArr[j*3+1];
      const dz = posArr[i*3+2] - posArr[j*3+2];
      const distSq = dx*dx + dy*dy + dz*dz;

      if (distSq < MAX_DISTANCE * MAX_DISTANCE) {
        // Line alpha based on distance
        const alpha = 1 - (Math.sqrt(distSq) / MAX_DISTANCE);
        
        linePositions[lineIdx*3] = posArr[i*3];
        linePositions[lineIdx*3+1] = posArr[i*3+1];
        linePositions[lineIdx*3+2] = posArr[i*3+2];
        
        linePositions[lineIdx*3+3] = posArr[j*3];
        linePositions[lineIdx*3+4] = posArr[j*3+1];
        linePositions[lineIdx*3+5] = posArr[j*3+2];

        // Color mix based on position + alpha
        const cVal = 0.5 + Math.sin(t + i*0.1)*0.5;
        // Blue to Purple
        lineColors[lineIdx*3] = cVal * alpha;
        lineColors[lineIdx*3+1] = 0.6 * alpha;
        lineColors[lineIdx*3+2] = 1 * alpha;

        lineColors[lineIdx*3+3] = cVal * alpha;
        lineColors[lineIdx*3+4] = 0.6 * alpha;
        lineColors[lineIdx*3+5] = 1 * alpha;

        lineIdx += 2;
      }
    }
  }

  particlesGeo.attributes.position.needsUpdate = true;
  linesGeo.attributes.position.needsUpdate = true;
  linesGeo.attributes.color.needsUpdate = true;
  
  // Set draw range so we don't render unused buffer lines
  linesGeo.setDrawRange(0, lineIdx);

  // Scene rotation
  scene.rotation.y += (cameraTargetRot - scene.rotation.y) * 0.05;
  scene.rotation.y += 0.001;
  scene.rotation.x = Math.sin(t * 0.5) * 0.1;

  core.rotation.y -= 0.005;
  core.rotation.x += 0.003;

  // Parallax on camera
  camera.position.x += (mxNorm * 5 - camera.position.x) * 0.05;
  camera.position.y += (-myNorm * 5 - camera.position.y) * 0.05;
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);
}

animate();

// Intro Animation
gsap.from('.auth-box', {
  opacity: 0,
  y: 40,
  rotationX: -10,
  duration: 1,
  ease: 'power3.out',
  delay: 0.5
});

// Real Login Logic
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const btn = e.target.querySelector('.submit-btn span');
  const ogText = btn.textContent;
  btn.textContent = 'Authenticating...';
  
  const email = e.target.querySelectorAll('input')[0].value;
  const password = e.target.querySelectorAll('input')[1].value;
  
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: email, password })
    });
    const data = await res.json();
    
    if (data.success) {
      localStorage.setItem('user', JSON.stringify(data.user));
      
      gsap.to('.auth-box', { scale: 0.9, opacity: 0, duration: 0.4 });
      gsap.to(camera.position, { z: 150, duration: 0.8, ease: 'power2.in', onComplete: () => {
        window.location.href = '/profile/';
      }});
    } else {
      btn.textContent = ogText;
      alert(data.error || 'Authentication failed');
    }
  } catch (err) {
    btn.textContent = ogText;
    console.error(err);
  }
});

// Real Register Logic
document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const btn = e.target.querySelector('.submit-btn span');
  const ogText = btn.textContent;
  btn.textContent = 'Creating Account...';
  
  const inputs = e.target.querySelectorAll('input');
  const email = inputs[1].value;
  const password = inputs[2].value;

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: email, password })
    });
    const data = await res.json();
    
    if (data.success) {
      localStorage.setItem('user', JSON.stringify(data.user));
      gsap.to('.auth-box', { scale: 0.9, opacity: 0, duration: 0.4 });
      gsap.to(camera.position, { z: 150, duration: 0.8, ease: 'power2.in', onComplete: () => {
        window.location.href = '/profile/';
      }});
    } else {
      btn.textContent = ogText;
      alert(data.error || 'Registration failed');
    }
  } catch (err) {
    btn.textContent = ogText;
    console.error(err);
  }
});
