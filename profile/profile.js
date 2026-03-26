// ─── ThreeStage Profile — 3D Holographic Gallery ────────
import * as THREE from 'three';

const { gsap } = window;

// ─────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────
// 0. AUTH & GLOBAL INITIALIZATION
// ─────────────────────────────────────────────────────────────────
const userStr = localStorage.getItem('user');
if (!userStr) window.location.href = '/auth/';
const user = JSON.parse(userStr);

// Set info
document.querySelector('.user-name').textContent = `Welcome, ${user.name}`;
document.querySelector('.user-email').textContent = user.email;

document.getElementById('new-project-btn').addEventListener('click', async () => {
  const btn = document.getElementById('new-project-btn');
  const ogText = btn.textContent;
  btn.textContent = 'Initializing...';
  try {
    const res = await fetch('/api/sessions', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      localStorage.setItem('sessionId', data.sessionId);
      window.location.href = '/editor/';
    }
  } catch (err) {
    btn.textContent = ogText;
  }
});

let userProjects = [];
let panels = [];
let targetRotationY = 0;
let currentRotationY = 0;
let mx = window.innerWidth / 2;
let my = window.innerHeight / 2;
let mxNorm = 0, myNorm = 0;

document.addEventListener('mousemove', (e) => {
  mx = e.clientX;
  my = e.clientY;
  mxNorm = (mx / window.innerWidth - 0.5) * 2;
  myNorm = (my / window.innerHeight - 0.5) * 2;
});

// Cursor Ring
const cursorRing = document.getElementById('cursor-ring');
gsap.ticker.add(() => {
  gsap.set(cursorRing, { x: mx, y: my });
});

document.querySelectorAll('a, button, .project-card').forEach(el => {
  el.addEventListener('mouseenter', () => {
    gsap.to(cursorRing, { width: 60, height: 60, background: 'rgba(0,204,255,0.1)', duration: 0.3 });
  });
  el.addEventListener('mouseleave', () => {
    gsap.to(cursorRing, { width: 40, height: 40, background: 'transparent', duration: 0.3 });
  });
});

// ─────────────────────────────────────────────────────────────────
// 1. BEAM LIGHT TRAIL (Abstract Light Streak)
// ─────────────────────────────────────────────────────────────────
(function initBeam() {
  const canvas = document.getElementById('beam-canvas');
  const ctx = canvas.getContext('2d');
  let w, h;
  
  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const TRAIL_LENGTH = 15;
  const trail = [];

  function animate() {
    requestAnimationFrame(animate);
    ctx.clearRect(0, 0, w, h);
    
    trail.push({ x: mx, y: my });
    if (trail.length > TRAIL_LENGTH) trail.shift();
    
    if (trail.length > 2) {
      ctx.beginPath();
      ctx.moveTo(trail[0].x, trail[0].y);
      for (let i = 1; i < trail.length; i++) {
        // Smooth curve
        const xc = (trail[i].x + trail[i - 1].x) / 2;
        const yc = (trail[i].y + trail[i - 1].y) / 2;
        ctx.quadraticCurveTo(trail[i - 1].x, trail[i - 1].y, xc, yc);
      }
      ctx.lineTo(trail[trail.length - 1].x, trail[trail.length - 1].y);

      // Light beam styling
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      
      const gradient = ctx.createLinearGradient(trail[0].x, trail[0].y, trail[trail.length - 1].x, trail[trail.length - 1].y);
      gradient.addColorStop(0, 'rgba(0, 204, 255, 0)');
      gradient.addColorStop(1, 'rgba(0, 204, 255, 0.8)');
      
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 12;
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#00ccff';
      ctx.stroke();
    }
  }
  animate();
})();

// ─────────────────────────────────────────────────────────────────
// 2. 3D HOLOGRAPHIC GALLERY (Three.js Carousel)
// ─────────────────────────────────────────────────────────────────
const canvas = document.getElementById('profile-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 500);
// Position camera to look at the right side of the screen where the gallery floats
camera.position.set(0, 10, 60);

// Global Group
const galleryGroup = new THREE.Group();
// Shift it right so it doesn't overlap the sidebar
galleryGroup.position.set(15, 0, 0);
scene.add(galleryGroup);

// Central Holo-Core
const coreGeo = new THREE.OctahedronGeometry(4, 1);
const coreMat = new THREE.MeshBasicMaterial({ color: 0x00ccff, wireframe: true, transparent: true, opacity: 0.3 });
const coreMesh = new THREE.Mesh(coreGeo, coreMat);
galleryGroup.add(coreMesh);

// Orbital Data Rings
for (let i = 0; i < 3; i++) {
  const ringGeo = new THREE.TorusGeometry(12 + i * 4, 0.05, 16, 100);
  const ringMat = new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? 0x0066ff : 0x7c3aed, transparent: true, opacity: 0.2 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.userData = { speed: (i + 1) * 0.002 * (i % 2 === 0 ? 1 : -1) };
  galleryGroup.add(ring);
}

// Holo-Panels Configuration
let PANEL_COUNT = 8;
const radius = 22;

function renderProjects() {
  const grid = document.getElementById('projects-grid');
  grid.innerHTML = '';
  document.querySelector('.stat-num').textContent = userProjects.length;

  if (userProjects.length === 0) {
    grid.innerHTML = '<p style="grid-column: 1/-1; opacity: 0.5;">No projects yet. Click "New Project" to start building!</p>';
    PANEL_COUNT = 3; // minimum 3 rings for aesthetics
  } else {
    PANEL_COUNT = Math.max(userProjects.length, 3);
  }

  userProjects.forEach((proj, idx) => {
    const thumbStyle = proj.thumbnail ? `background-image: url(${proj.thumbnail})` : '';
    const dateStr = new Date(proj.createdAt).toLocaleDateString();

    const card = document.createElement('div');
    card.className = 'project-card';
    card.dataset.index = idx;
    card.innerHTML = `
      <div class="project-thumb" style="${thumbStyle}"></div>
      <div class="project-info">
        <h3>${proj.name}</h3>
        <p>Created on ${dateStr}</p>
        <div class="card-actions">
          <button class="action-btn edit" disabled>Locked</button>
          <button class="action-btn view">View Live</button>
        </div>
      </div>
    `;
    grid.appendChild(card);

    // Dynamic Hover Hooks
    card.addEventListener('mouseenter', () => {
      const targetAngle = (idx / PANEL_COUNT) * Math.PI * 2;
      targetRotationY = -targetAngle + Math.PI/2;
      if (panels[idx]) {
        gsap.to(panels[idx].material, { opacity: 0.6, duration: 0.3 });
        gsap.to(panels[idx].scale, { x: 1.2, y: 1.2, z: 1.2, duration: 0.3 });
      }
    });

    card.addEventListener('mouseleave', () => {
      if (panels[idx]) {
        gsap.to(panels[idx].material, { opacity: 0.15, duration: 0.3 });
        gsap.to(panels[idx].scale, { x: 1, y: 1, z: 1, duration: 0.3 });
      }
    });

    card.querySelector('.view').addEventListener('click', () => {
      window.location.href = '/viewer/?projectId=' + proj.id;
    });
  });

  // Entrance Anim
  if (userProjects.length > 0) {
    gsap.from('.project-card', { 
      y: 40, opacity: 0, duration: 0.8, stagger: 0.1, ease: 'back.out(1.5)', delay: 0.3 
    });
  }
}

function initGallery() {
  for (let i = 0; i < PANEL_COUNT; i++) {
    const angle = (i / PANEL_COUNT) * Math.PI * 2;
    // Panel Frame
    const panelGeo = new THREE.PlaneGeometry(8, 12);
    const panelMat = new THREE.MeshBasicMaterial({ 
      color: 0x00ccff, 
      transparent: true, 
      opacity: 0.15,
      side: THREE.DoubleSide
    });
    
    const panel = new THREE.Mesh(panelGeo, panelMat);
    panel.position.set(Math.cos(angle) * radius, Math.sin(angle * 2) * 3, Math.sin(angle) * radius);
    panel.lookAt(0, 0, 0);
    
    // Add wireframe border
    const edges = new THREE.EdgesGeometry(panelGeo);
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x00ccff, transparent: true, opacity: 0.5 }));
    panel.add(line);
    
    panel.userData = { angle, baseY: panel.position.y };
    galleryGroup.add(panel);
    panels.push(panel);
  }
}

// Particle field
const particleGeo = new THREE.BufferGeometry();
const pCount = 500;
const pPos = new Float32Array(pCount * 3);
for(let i=0; i<pCount; i++) {
  pPos[i*3] = (Math.random() - 0.5) * 100 + 15;
  pPos[i*3+1] = (Math.random() - 0.5) * 60;
  pPos[i*3+2] = (Math.random() - 0.5) * 60;
}
particleGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
const particleMat = new THREE.PointsMaterial({ color: 0x7c3aed, size: 0.2, transparent: true, opacity: 0.4 });
const particleSystem = new THREE.Points(particleGeo, particleMat);
scene.add(particleSystem);


window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  // Core spinning
  coreMesh.rotation.x = t * 0.5;
  coreMesh.rotation.y = t * 0.6;
  coreMesh.scale.setScalar(1 + Math.sin(t * 3) * 0.1);

  // Rings spinning
  galleryGroup.children.forEach(child => {
    if (child.userData.speed) {
      child.rotation.z += child.userData.speed;
    }
  });

  // Flowing motion for panels
  panels.forEach((p, i) => {
    p.position.y = p.userData.baseY + Math.sin(t * 2 + i) * 2;
  });
  
  // Rotate gallery if no card hovered, else go to target
  if (targetRotationY === 0 && !document.querySelector('.project-card:hover')) {
    targetRotationY += 0.002; // auto rotate slowly
  }
  currentRotationY += (targetRotationY - currentRotationY) * 0.05;
  galleryGroup.rotation.y = currentRotationY;

  // Parallax
  camera.position.x += (mxNorm * 4 - camera.position.x) * 0.02;
  camera.position.y += (-myNorm * 2 + 10 - camera.position.y) * 0.02;
  camera.lookAt(15, 0, 0);

  renderer.render(scene, camera);
}
animate();

// Fetch Data and Boot
fetch('/api/projects/' + user.id)
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      userProjects = data.projects;
      renderProjects();
      initGallery();
    }
  });

// GSAP Entrance
gsap.from('.profile-sidebar', { x: -50, opacity: 0, duration: 1, ease: 'power3.out' });
