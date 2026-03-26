// ─── ThreeStage Viewer — Enhanced Scroll-Driven 3D Experience ───
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const { gsap, ScrollTrigger } = window;
gsap.registerPlugin(ScrollTrigger);

let project, scene, camera, renderer, controls;
const models = {};

// ── Init ────────────────────────────────────────────────────────
async function init() {
  try {
    const params = new URLSearchParams(window.location.search);
    const projectId = params.get('projectId');
    const sessionId = localStorage.getItem('sessionId');
    
    let url = '';
    if (projectId) url = '/api/public-project/' + projectId;
    else if (sessionId) url = '/api/project/' + sessionId;
    else {
      document.getElementById('loading-text').textContent = 'Error: No active session or project ID.';
      return;
    }

    const res = await fetch(url);
    if (!res.ok) throw new Error('Fetch failed');
    project = await res.json();

    if (!project?.slides?.length) {
      document.getElementById('loading-text').textContent =
        'No slides yet — open the Editor and create some!';
      return;
    }

    buildScaffolding();
    setupThree();
  } catch (err) {
    console.error('Viewer init failed:', err);
    document.getElementById('loading-text').textContent = 'Failed to load project';
  }
}

// ── Build DOM Scaffolding ───────────────────────────────────────
function buildScaffolding() {
  const container = document.getElementById('scroll-container');
  const dots = document.getElementById('slide-dots');

  container.style.height = `${project.slides.length * 100}vh`;

  project.slides.forEach((slide, i) => {
    const section = document.createElement('div');
    section.className = 'scroll-section';
    section.id = `section-${i}`;
    container.appendChild(section);

    const layer = document.createElement('div');
    layer.className = 'overlay-layer';
    layer.id = `overlay-${i}`;

    if (slide.overlays) {
      slide.overlays.forEach((ov) => {
        const el = document.createElement('div');
        el.className = 'viewer-overlay';
        el.style.left = ov.x + '%';
        el.style.top = ov.y + '%';
        el.style.fontSize = (ov.fontSize || 48) + 'px';
        el.style.color = ov.color || '#fff';

        // Enhanced text properties
        if (ov.fontFamily) el.style.fontFamily = `'${ov.fontFamily}', sans-serif`;
        if (ov.fontWeight) el.style.fontWeight = ov.fontWeight;
        if (ov.fontStyle) el.style.fontStyle = ov.fontStyle;
        if (ov.textDecoration && ov.textDecoration !== 'none') el.style.textDecoration = ov.textDecoration;
        if (ov.textAlign) el.style.textAlign = ov.textAlign;
        if (ov.letterSpacing) el.style.letterSpacing = ov.letterSpacing + 'px';
        if (ov.lineHeight) el.style.lineHeight = String(ov.lineHeight);
        if (ov.rotation) el.style.transform = `rotate(${ov.rotation}deg)`;
        if (ov.opacity != null && ov.opacity !== 1) el.style.opacity = ov.opacity;
        if (ov.bgColor) {
          el.style.background = ov.bgColor;
          el.style.padding = (ov.padding || 8) + 'px';
          el.style.borderRadius = (ov.borderRadius || 4) + 'px';
        }
        if (ov.width) el.style.width = ov.width + 'px';
        el.style.whiteSpace = 'pre-wrap';

        el.textContent = ov.content;
        layer.appendChild(el);
      });
    }
    document.body.appendChild(layer);

    const dot = document.createElement('div');
    dot.className = `dot${i === 0 ? ' active' : ''}`;
    dot.dataset.index = i;
    dots.appendChild(dot);
  });

  const hint = document.createElement('div');
  hint.id = 'scroll-hint';
  hint.textContent = 'Scroll ↓';
  document.body.appendChild(hint);
}

// ── Three.js Setup ──────────────────────────────────────────────
function setupThree() {
  const canvas = document.getElementById('viewer-canvas');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  scene = new THREE.Scene();
  const first = project.slides[0];
  scene.background = new THREE.Color(first.background?.color || '#000');

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(first.camera.x, first.camera.y, first.camera.z);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.enableRotate = false;
  controls.target.set(
    first.camera.targetX ?? 0,
    first.camera.targetY ?? 0,
    first.camera.targetZ ?? 0
  );
  controls.update();

  // Lights
  scene.add(new THREE.AmbientLight(0xffffff, 1.0));
  const d1 = new THREE.DirectionalLight(0xffffff, 2.5);
  d1.position.set(5, 8, 5);
  scene.add(d1);
  const d2 = new THREE.DirectionalLight(0x4488ff, 1.0);
  d2.position.set(-5, 3, -5);
  scene.add(d2);

  loadAllModels();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  gsap.ticker.add(() => {
    controls.update();
    renderer.render(scene, camera);
    const maxScroll = document.body.scrollHeight - window.innerHeight;
    if (maxScroll > 0) {
      const pct = (window.scrollY / maxScroll) * 100;
      document.getElementById('progress-bar').style.width = pct + '%';
    }
  });
}

// ── Load All Models ─────────────────────────────────────────────
function loadAllModels() {
  const loader = new GLTFLoader();
  const urlsToLoad = new Set();

  if (project.modelUrl) urlsToLoad.add(project.modelUrl);
  project.slides.forEach(s => {
    if (s.models) s.models.forEach(m => urlsToLoad.add(m.url));
  });

  let loaded = 0;
  const total = urlsToLoad.size || 1;

  if (urlsToLoad.size === 0) {
    // Fallback cube
    const geo = new THREE.BoxGeometry(2, 2, 2);
    const mat = new THREE.MeshStandardMaterial({ color: 0x0066ff, roughness: 0.3, metalness: 0.7 });
    const cube = new THREE.Mesh(geo, mat);
    models['__fallback__'] = cube;
    scene.add(cube);
    hideLoader();
    setupScrollTriggers();
    return;
  }

  urlsToLoad.forEach(url => {
    loader.load(url, (gltf) => {
      const m = gltf.scene;
      const box = new THREE.Box3().setFromObject(m);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 5 / maxDim;
      m.scale.setScalar(scale);
      m.position.sub(center.multiplyScalar(scale));
      models[url] = m;
      loaded++;
      if (loaded >= total) onAllModelsLoaded();
    }, undefined, () => {
      loaded++;
      if (loaded >= total) onAllModelsLoaded();
    });
  });
}

function onAllModelsLoaded() {
  // Add default model
  if (project.modelUrl && models[project.modelUrl]) {
    scene.add(models[project.modelUrl]);
  } else {
    const firstModel = Object.values(models)[0];
    if (firstModel) scene.add(firstModel);
  }
  hideLoader();
  setupScrollTriggers();
}

function hideLoader() {
  const ls = document.getElementById('loading-screen');
  ls.classList.add('hidden');
  setTimeout(() => (ls.style.display = 'none'), 600);
}

// ── Handle per-slide model visibility ───────────────────────────
function handleSlideModels(slideIdx) {
  const slide = project.slides[slideIdx];
  if (!slide.models || slide.models.length === 0) {
    // Show default model only
    Object.entries(models).forEach(([url, m]) => {
      m.visible = (url === project.modelUrl || url === '__fallback__');
    });
    return;
  }

  // Hide all, then show slide-specific
  Object.values(models).forEach(m => m.visible = false);
  slide.models.forEach(sm => {
    if (models[sm.url]) {
      models[sm.url].visible = true;
      if (!models[sm.url].parent) scene.add(models[sm.url]);
      if (sm.position) {
        models[sm.url].position.set(sm.position.x || 0, sm.position.y || 0, sm.position.z || 0);
      }
      if (sm.scale != null) {
        models[sm.url].scale.setScalar(sm.scale);
      }
    }
  });
}

// ── Scroll Triggers ─────────────────────────────────────────────
function setupScrollTriggers() {
  const sections = document.querySelectorAll('.scroll-section');
  const dots = document.querySelectorAll('.dot');

  gsap.set('#overlay-0', { opacity: 1 });

  ScrollTrigger.create({
    trigger: sections[0],
    start: 'top top',
    end: 'bottom top',
    onLeave: () => {
      const hint = document.getElementById('scroll-hint');
      if (hint) gsap.to(hint, { opacity: 0, duration: 0.3, onComplete: () => hint.remove() });
    },
  });

  project.slides.forEach((slide, i) => {
    ScrollTrigger.create({
      trigger: sections[i],
      start: 'top center',
      end: 'bottom center',
      onEnter:     () => { activateOverlay(i); updateDots(i, dots); handleSlideModels(i); },
      onEnterBack: () => { activateOverlay(i); updateDots(i, dots); handleSlideModels(i); },
      onLeave:     () => { if (i < project.slides.length - 1) deactivateOverlay(i); },
      onLeaveBack: () => { if (i > 0) deactivateOverlay(i); },
    });

    if (i < project.slides.length - 1) {
      const next = project.slides[i + 1];
      const nextColor = new THREE.Color(next.background?.color || '#000');

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sections[i],
          start: 'top top',
          end: 'bottom top',
          scrub: 1.2,
        },
      });

      tl.to(camera.position, {
        x: next.camera.x,
        y: next.camera.y,
        z: next.camera.z,
        ease: 'none',
      }, 0);

      tl.to(controls.target, {
        x: next.camera.targetX ?? 0,
        y: next.camera.targetY ?? 0,
        z: next.camera.targetZ ?? 0,
        ease: 'none',
      }, 0);

      tl.to(scene.background, {
        r: nextColor.r,
        g: nextColor.g,
        b: nextColor.b,
        ease: 'none',
      }, 0);
    }
  });

  dots.forEach((dot) => {
    dot.addEventListener('click', () => {
      const idx = Number(dot.dataset.index);
      const target = sections[idx];
      if (target) window.scrollTo({ top: target.offsetTop, behavior: 'smooth' });
    });
  });
}

function activateOverlay(i) {
  gsap.to(`#overlay-${i}`, { opacity: 1, duration: 0.5, ease: 'power2.out' });
}
function deactivateOverlay(i) {
  gsap.to(`#overlay-${i}`, { opacity: 0, duration: 0.4, ease: 'power2.in' });
}

function updateDots(activeIdx, dots) {
  dots.forEach((d, j) => d.classList.toggle('active', j === activeIdx));
}

// ── Start ───────────────────────────────────────────────────────
init();
