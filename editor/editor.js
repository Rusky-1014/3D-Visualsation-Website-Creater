// ─── ThreeStage Editor — Full Enhanced Version ────────────────
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ── Font Choices ────────────────────────────────────────────────
const FONT_FAMILIES = [
  'Inter', 'Playfair Display', 'Space Grotesk', 'Outfit', 'Sora',
  'DM Sans', 'Poppins', 'Montserrat', 'Roboto', 'Raleway',
  'Lato', 'Open Sans', 'Oswald', 'Merriweather', 'Nunito',
  'Bebas Neue', 'Archivo Black', 'Lobster', 'Righteous', 'Fredoka One',
  'monospace', 'serif', 'cursive'
];

const sessionId = localStorage.getItem('sessionId');
if (!sessionId) {
  window.location.href = '/profile/'; // prevent unauthorized access
}

// ── Shared State ────────────────────────────────────────────────
export const state = {
  project: null,
  activeSlideId: null,
  scene: null,
  camera: null,
  controls: null,
  renderer: null,
  model: null,
  slideModels: [],           // per-slide loaded models
  allModels: {},             // url → THREE.Object3D
  availableModels: [],       // from /api/models
  draggingOverlay: null,     // overlay being drag-repositioned
  selectedOverlayId: null,   // currently selected overlay for editing
};

// ── Bootstrap ───────────────────────────────────────────────────
async function init() {
  try {
    const [projRes, modelsRes] = await Promise.all([
      fetch('/api/project/' + sessionId),
      fetch('/api/models')
    ]);
    state.project = await projRes.json();
    const modelsData = await modelsRes.json();
    state.availableModels = modelsData.models || [];

    if (state.project.slides.length > 0) {
      state.activeSlideId = state.project.slides[0].id;
    }

    setupThree();
    setupToolbar();
    setupUploadZone();
    setupOverlayDrag();
    renderTimeline();
    renderSidebar();
    renderOverlays();
  } catch (err) {
    console.error('Editor init failed:', err);
  }
}

// ── Three.js Setup ──────────────────────────────────────────────
function setupThree() {
  const canvas = document.getElementById('editor-canvas');
  const wrapper = document.getElementById('canvas-wrapper');

  state.renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
  });
  state.renderer.setPixelRatio(window.devicePixelRatio);
  state.renderer.outputColorSpace = THREE.SRGBColorSpace;
  state.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  state.renderer.toneMappingExposure = 1.2;

  state.scene = new THREE.Scene();
  const slide = getActiveSlide();
  state.scene.background = new THREE.Color(slide?.background?.color || '#0a0a0a');

  state.camera = new THREE.PerspectiveCamera(45, wrapper.clientWidth / wrapper.clientHeight, 0.1, 200);
  if (slide?.camera) {
    state.camera.position.set(slide.camera.x, slide.camera.y, slide.camera.z);
  } else {
    state.camera.position.set(0, 4, 10);
  }

  state.controls = new OrbitControls(state.camera, state.renderer.domElement);
  state.controls.enableDamping = true;
  state.controls.dampingFactor = 0.08;
  if (slide?.camera) {
    state.controls.target.set(
      slide.camera.targetX ?? 0,
      slide.camera.targetY ?? 0,
      slide.camera.targetZ ?? 0
    );
  }
  state.controls.update();

  // Lights
  state.scene.add(new THREE.AmbientLight(0xffffff, 1.0));
  const dir1 = new THREE.DirectionalLight(0xffffff, 2.5);
  dir1.position.set(5, 8, 5);
  state.scene.add(dir1);
  const dir2 = new THREE.DirectionalLight(0x4488ff, 1.0);
  dir2.position.set(-5, 3, -5);
  state.scene.add(dir2);

  // Grid helper
  const grid = new THREE.GridHelper(20, 40, 0x222222, 0x222222);
  grid.material.opacity = 0.3;
  grid.material.transparent = true;
  state.scene.add(grid);

  // Load default model
  loadModel(state.project.modelUrl);

  // Load per-slide models
  loadSlideModels();

  // Resize
  const onResize = () => {
    const w = wrapper.clientWidth;
    const h = wrapper.clientHeight;
    state.camera.aspect = w / h;
    state.camera.updateProjectionMatrix();
    state.renderer.setSize(w, h, false);
  };
  window.addEventListener('resize', onResize);
  onResize();

  // Render loop
  (function animate() {
    requestAnimationFrame(animate);
    state.controls.update();
    state.renderer.render(state.scene, state.camera);
  })();
}

function loadModel(url) {
  if (!url) {
    showUploadZone();
    return;
  }
  const loader = new GLTFLoader();
  loader.load(
    url,
    (gltf) => {
      if (state.model) state.scene.remove(state.model);
      state.model = gltf.scene;
      const box = new THREE.Box3().setFromObject(state.model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 5 / maxDim;
      state.model.scale.setScalar(scale);
      state.model.position.sub(center.multiplyScalar(scale));
      state.scene.add(state.model);
      state.allModels[url] = state.model;
      hideUploadZone();
    },
    undefined,
    () => {
      console.warn('Model not found, showing upload zone');
      showUploadZone();
    }
  );
}

function loadSlideModels() {
  const loader = new GLTFLoader();
  const slide = getActiveSlide();
  if (!slide?.models) return;

  // Clear old slide models
  state.slideModels.forEach(m => state.scene.remove(m));
  state.slideModels = [];

  slide.models.forEach(sm => {
    if (state.allModels[sm.url]) {
      const m = state.allModels[sm.url].clone();
      if (sm.position) m.position.set(sm.position.x || 0, sm.position.y || 0, sm.position.z || 0);
      if (sm.scale != null) m.scale.setScalar(sm.scale);
      state.scene.add(m);
      state.slideModels.push(m);
    } else {
      loader.load(sm.url, (gltf) => {
        const m = gltf.scene;
        const box = new THREE.Box3().setFromObject(m);
        const center = box.getCenter(new THREE.Vector3());
        const sz = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(sz.x, sz.y, sz.z);
        const scale = (sm.scale || 5) / maxDim;
        m.scale.setScalar(scale);
        m.position.sub(center.multiplyScalar(scale));
        if (sm.position) m.position.set(sm.position.x || 0, sm.position.y || 0, sm.position.z || 0);
        state.scene.add(m);
        state.allModels[sm.url] = m;
        state.slideModels.push(m);
      });
    }
  });
}

// Deleted addFallbackCube function

// ── Upload Zone ─────────────────────────────────────────────────
function showUploadZone() { document.getElementById('upload-zone').style.display = 'flex'; }
function hideUploadZone() { document.getElementById('upload-zone').style.display = 'none'; }

function setupUploadZone() {
  const zone = document.getElementById('upload-zone');
  const inner = zone.querySelector('.upload-inner');
  const fileInput = document.getElementById('model-file-input');

  inner.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) uploadFile(e.target.files[0]);
  });

  zone.addEventListener('dragover', (e) => { e.preventDefault(); inner.style.borderColor = '#0066ff'; });
  zone.addEventListener('dragleave', () => { inner.style.borderColor = ''; });
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    inner.style.borderColor = '';
    if (e.dataTransfer.files[0]) uploadFile(e.dataTransfer.files[0]);
  });
}

async function uploadFile(file) {
  const formData = new FormData();
  formData.append('model', file);
  try {
    const res = await fetch('/api/upload-model/' + sessionId, { method: 'POST', body: formData });
    const data = await res.json();
    if (data.success) {
      state.project.modelUrl = data.modelUrl;
      state.availableModels.push({ name: file.name, url: data.modelUrl, size: file.size });
      loadModel(data.modelUrl);
      renderSidebar(); // refresh model list in sidebar
    }
  } catch (err) {
    console.error('Upload failed:', err);
  }
}

// Upload model specifically for slide (not global)
async function uploadModelForSlide(file) {
  const formData = new FormData();
  formData.append('model', file);
  try {
    const res = await fetch('/api/upload-model/' + sessionId, { method: 'POST', body: formData });
    const data = await res.json();
    if (data.success) {
      state.availableModels.push({ name: file.name, url: data.modelUrl, size: file.size });
      return data.modelUrl;
    }
  } catch (err) {
    console.error('Upload failed:', err);
  }
  return null;
}

// ── Toolbar ─────────────────────────────────────────────────────
function setupToolbar() {
  const tb = document.getElementById('toolbar');
  tb.innerHTML = `
    <div class="toolbar-left">
      <a href="/profile/" style="text-decoration:none; color:#fff; margin-right: 15px; font-weight:500;">← Profile</a>
      <span class="toolbar-logo">ThreeStage</span>
      <div class="toolbar-divider"></div>
      <span class="toolbar-project-name">Demo Project</span>
    </div>
    <div class="toolbar-actions">
      <button class="btn-upload-model" id="tb-upload">📦 Upload Model</button>
      <a class="btn-preview" href="/viewer/" target="_blank">▶ &nbsp;Preview Site</a>
      <button class="btn-finalize" id="tb-finalize">🚀 Finalize & Deploy</button>
    </div>
  `;

  tb.querySelector('#tb-upload').addEventListener('click', () => {
    document.getElementById('model-file-input').click();
  });

  tb.querySelector('#tb-finalize').addEventListener('click', finalizeProject);
}

// ── Finalize to DB ──────────────────────────────────────────────
async function finalizeProject() {
  const btn = document.getElementById('tb-finalize');
  btn.textContent = 'Saving...';
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  if (!user) {
    alert("Please log in first!");
    window.location.href = '/auth/';
    return;
  }
  
  try {
    const res = await fetch('/api/project/finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, userId: user.id || user.username, name: 'My 3D Project' })
    });
    const data = await res.json();
    if (data.success) {
      localStorage.removeItem('sessionId');
      showSuccessModal(data.projectId);
    } else {
      btn.textContent = 'Error!';
      console.error(data.error);
    }
  } catch(e) {
    btn.textContent = 'Error!';
    console.error(e);
  }
}

// ── Success & Deploy Modal ──────────────────────────────────────
function showSuccessModal(projectId) {
  const existing = document.getElementById('deploy-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'deploy-modal';
  modal.innerHTML = `
    <div class="deploy-modal-overlay" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9998; backdrop-filter:blur(10px);"></div>
    <div class="deploy-modal-content" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#111; border:1px solid #333; padding:40px; border-radius:16px; width:450px; z-index:9999; text-align:center; color:#fff; font-family:'Inter', sans-serif;">
      <h2 style="font-size:24px; margin-bottom:10px; color:#00ccff;">✨ Project Finalized!</h2>
      <p style="color:#aaa; margin-bottom:30px; line-height:1.5;">Your 3D website has been permanently saved to your account. Your code download should start automatically.</p>
      
      <div class="deploy-actions" style="display:flex; flex-direction:column; gap:15px;">
        <button class="btn" id="download-code-btn" style="padding:15px; font-size:16px; background:#222; border:1px solid #444; color:#fff; border-radius:8px; cursor:pointer; display:flex; justify-content:center; align-items:center; gap:10px;">
          ⬇️ Download Code (.zip)
        </button>
        <button class="btn primary" id="deploy-vercel-btn" style="padding:15px; font-size:16px; background:#0066ff; border:none; color:#fff; border-radius:8px; cursor:pointer; display:flex; justify-content:center; align-items:center; gap:10px; box-shadow: 0 4px 15px rgba(0,102,255,0.3);">
          ☁️ Deploy to Vercel
        </button>
        <button class="btn" id="finish-btn" style="padding:15px; font-size:16px; background:transparent; border:none; color:#888; cursor:pointer; transition:color 0.2s;">
          Return to Profile
        </button>
      </div>

      <div id="deploy-result" style="margin-top:20px; font-size:14px; text-align:left;"></div>
    </div>
  `;
  document.body.appendChild(modal);

  // Auto-trigger download
  window.location.href = '/api/download/' + projectId;

  modal.querySelector('#download-code-btn').addEventListener('click', () => {
    window.location.href = '/api/download/' + projectId;
  });

  modal.querySelector('#finish-btn').addEventListener('click', () => {
    window.location.href = '/profile/';
  });

  const btnVercel = modal.querySelector('#deploy-vercel-btn');
  btnVercel.addEventListener('click', async () => {
    btnVercel.disabled = true;
    btnVercel.innerHTML = '<span class="spinner" style="display:inline-block; width:16px; height:16px; border:2px solid #fff; border-top-color:transparent; border-radius:50%; animation:spin 1s linear infinite;"></span> Deploying...';
    
    const resBox = modal.querySelector('#deploy-result');
    resBox.innerHTML = '<p style="color:#aaa;">Sending export to Vercel servers... This may take up to a minute.</p>';

    // Add spinner css if not exists
    if (!document.getElementById('spinner-anim')) {
      const style = document.createElement('style');
      style.id = 'spinner-anim';
      style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
      document.head.appendChild(style);
    }

    try {
      const res = await fetch('/api/deploy/' + projectId, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        btnVercel.innerHTML = '✅ Deployed Successfully!';
        resBox.innerHTML = `
          <div style="background:rgba(0, 204, 255, 0.1); border:1px solid #00ccff; padding:15px; border-radius:8px; display:flex; align-items:center; justify-content:space-between;">
            <span style="color:#00ccff; font-weight:600;">Live URL:</span>
            <a href="${data.url}" target="_blank" style="color:#fff; text-decoration:none; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${data.url}</a>
          </div>
        `;
      } else {
        throw new Error(data.error || 'Unknown Vercel Error');
      }
    } catch (err) {
      btnVercel.innerHTML = '❌ Deploy Failed';
      btnVercel.disabled = false;
      resBox.innerHTML = `<p style="color:#ff4444;">${err.message}</p>`;
    }
  });

}

// ── Overlay Drag & Drop on Canvas ───────────────────────────────
function setupOverlayDrag() {
  const container = document.getElementById('overlay-container');
  const wrapper = document.getElementById('canvas-wrapper');

  container.addEventListener('mousedown', (e) => {
    const ghostEl = e.target.closest('.ghost-overlay');
    if (!ghostEl) return;
    e.preventDefault();
    e.stopPropagation();

    state.draggingOverlay = {
      el: ghostEl,
      id: ghostEl.dataset.id,
      startX: e.clientX,
      startY: e.clientY,
      origLeft: parseFloat(ghostEl.style.left),
      origTop: parseFloat(ghostEl.style.top),
    };

    // Disable orbit controls during drag
    state.controls.enabled = false;
    ghostEl.style.cursor = 'grabbing';
    ghostEl.style.opacity = '1';
  });

  document.addEventListener('mousemove', (e) => {
    if (!state.draggingOverlay) return;

    const dx = e.clientX - state.draggingOverlay.startX;
    const dy = e.clientY - state.draggingOverlay.startY;
    const wrapperRect = wrapper.getBoundingClientRect();

    const newX = state.draggingOverlay.origLeft + (dx / wrapperRect.width) * 100;
    const newY = state.draggingOverlay.origTop + (dy / wrapperRect.height) * 100;

    state.draggingOverlay.el.style.left = Math.max(0, Math.min(100, newX)) + '%';
    state.draggingOverlay.el.style.top = Math.max(0, Math.min(100, newY)) + '%';
  });

  document.addEventListener('mouseup', () => {
    if (!state.draggingOverlay) return;

    const { id, el } = state.draggingOverlay;
    const slide = getActiveSlide();
    if (slide?.overlays) {
      const ov = slide.overlays.find(o => o.id === id);
      if (ov) {
        ov.x = parseFloat(el.style.left);
        ov.y = parseFloat(el.style.top);
        persistSlideField(slide, 'overlays');
        renderSidebar();
      }
    }

    state.controls.enabled = true;
    el.style.cursor = 'grab';
    el.style.opacity = '0.75';
    state.draggingOverlay = null;
  });
}

// ── Timeline ────────────────────────────────────────────────────
export function renderTimeline() {
  const t = document.getElementById('timeline');
  t.innerHTML = '';
  if (!state.project) return;

  state.project.slides.forEach((slide, i) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'slide-wrapper';

    const card = document.createElement('div');
    card.className = `slide-card${state.activeSlideId === slide.id ? ' active' : ''}`;
    card.dataset.id = slide.id;

    const thumb = document.createElement('div');
    thumb.className = 'slide-thumbnail';
    if (slide.thumbnail) thumb.style.backgroundImage = `url(${slide.thumbnail})`;
    card.appendChild(thumb);

    const footer = document.createElement('div');
    footer.className = 'slide-footer';
    footer.innerHTML = `<span>Slide ${i + 1}</span><button class="delete-btn" data-id="${slide.id}">×</button>`;
    card.appendChild(footer);
    wrapper.appendChild(card);

    if (i < state.project.slides.length - 1) {
      const next = state.project.slides[i + 1];
      const badge = document.createElement('div');
      badge.className = 'transition-badge';
      badge.textContent = (next.transition?.type || 'fly').toUpperCase();
      wrapper.appendChild(badge);
    }

    t.appendChild(wrapper);
  });

  const addBtn = document.createElement('div');
  addBtn.className = 'add-slide-btn';
  addBtn.textContent = '+';
  t.appendChild(addBtn);

  t.addEventListener('click', handleTimelineClick);
}

function handleTimelineClick(e) {
  const t = document.getElementById('timeline');
  t.removeEventListener('click', handleTimelineClick);

  const delBtn = e.target.closest('.delete-btn');
  if (delBtn) { deleteSlide(delBtn.dataset.id); return; }

  const card = e.target.closest('.slide-card');
  if (card) { loadSlideIntoEditor(card.dataset.id); return; }

  if (e.target.closest('.add-slide-btn')) { createNewSlide(); }
}

// ── Sidebar ─────────────────────────────────────────────────────
export function renderSidebar() {
  const sb = document.getElementById('sidebar');
  sb.innerHTML = '';
  const slide = getActiveSlide();
  const isNew = !slide;

  // ── Save / Update button ──────
  const headerSec = el('div', 'sidebar-section');
  headerSec.innerHTML = `
    <h3>${isNew ? 'New Slide' : 'Slide Settings'}</h3>
    <button class="btn btn-primary" id="save-slide-btn">
      ${isNew ? '💾  Save New Slide' : '💾  Update Slide'}
    </button>
  `;
  sb.appendChild(headerSec);
  headerSec.querySelector('#save-slide-btn').addEventListener('click', async () => {
    const btn = headerSec.querySelector('#save-slide-btn');
    btn.textContent = '⏳  Saving…';
    await saveSlide();
    btn.textContent = '✓  Saved!';
    setTimeout(() => renderSidebar(), 800);
  });

  if (isNew) return;

  // ── Background ────────────────
  const bgSec = el('div', 'sidebar-section');
  const bgColor = slide.background?.color || '#0a0a0a';
  bgSec.innerHTML = `
    <h3>Background</h3>
    <div class="form-group">
      <label>Color</label>
      <input type="color" id="bg-color" value="${bgColor}">
    </div>
  `;
  sb.appendChild(bgSec);
  const bgInput = bgSec.querySelector('#bg-color');
  bgInput.addEventListener('input', (e) => updateSceneBackground(e.target.value));
  bgInput.addEventListener('change', (e) => {
    slide.background = { color: e.target.value };
    persistSlideField(slide, 'background');
  });

  // ── Models for this Slide ─────
  const modelSec = el('div', 'sidebar-section');
  modelSec.innerHTML = `
    <h3>3D Models</h3>
    <div id="slide-models-list"></div>
    <div class="model-add-controls">
      <select id="model-select" class="model-select"></select>
      <button class="btn" id="add-model-to-slide-btn">+ Add Model</button>
    </div>
    <div style="margin-top:10px; display: flex; gap: 8px; flex-direction: column;">
      <input type="file" id="slide-model-upload" accept=".glb,.gltf" hidden>
      <button class="btn" id="upload-new-model-btn">📦 Upload New Model</button>
      <button class="btn" id="remove-all-models-btn" style="background:#dc2626; color:white; border-color:#991b1b;">🗑️ Remove All Models</button>
    </div>
  `;
  sb.appendChild(modelSec);

  // Populate model select
  const select = modelSec.querySelector('#model-select');
  state.availableModels.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.url;
    opt.textContent = m.name;
    select.appendChild(opt);
  });

  // List current slide models
  const modelList = modelSec.querySelector('#slide-models-list');
  if (!slide.models) slide.models = [];
  slide.models.forEach((sm, idx) => {
    const item = el('div', 'model-list-item');
    item.innerHTML = `
      <span class="model-name">${sm.name || sm.url.split('/').pop()}</span>
      <button class="delete-model-btn" data-idx="${idx}">×</button>
    `;
    modelList.appendChild(item);

    item.querySelector('.delete-model-btn').addEventListener('click', () => {
      slide.models.splice(idx, 1);
      persistSlideField(slide, 'models');
      loadSlideModels();
      renderSidebar();
    });
  });

  modelSec.querySelector('#remove-all-models-btn').addEventListener('click', () => {
    slide.models = [];
    if (state.model) {
      state.scene.remove(state.model);
      state.model = null;
      state.project.modelUrl = null;
    }
    persistSlideField(slide, 'models');
    loadSlideModels();
    renderSidebar();
    showUploadZone();
  });

  modelSec.querySelector('#add-model-to-slide-btn').addEventListener('click', () => {
    const selectedUrl = select.value;
    if (!selectedUrl) return;
    if (!slide.models) slide.models = [];
    const modelInfo = state.availableModels.find(m => m.url === selectedUrl);
    slide.models.push({
      url: selectedUrl,
      name: modelInfo?.name || selectedUrl.split('/').pop(),
      position: { x: 0, y: 0, z: 0 },
      scale: 5
    });
    persistSlideField(slide, 'models');
    loadSlideModels();
    renderSidebar();
  });

  modelSec.querySelector('#upload-new-model-btn').addEventListener('click', () => {
    modelSec.querySelector('#slide-model-upload').click();
  });

  modelSec.querySelector('#slide-model-upload').addEventListener('change', async (e) => {
    if (!e.target.files[0]) return;
    const url = await uploadModelForSlide(e.target.files[0]);
    if (url) {
      if (!slide.models) slide.models = [];
      slide.models.push({
        url,
        name: e.target.files[0].name,
        position: { x: 0, y: 0, z: 0 },
        scale: 5
      });
      persistSlideField(slide, 'models');
      loadSlideModels();
      renderSidebar();
    }
  });

  // ── Text Overlays ─────────────
  const ovSec = el('div', 'sidebar-section');
  ovSec.innerHTML = `<h3>Text Overlays</h3><div id="overlays-list"></div>
    <button class="btn" id="add-text-btn">+ Add Text</button>`;
  sb.appendChild(ovSec);

  const list = ovSec.querySelector('#overlays-list');
  (slide.overlays || []).forEach((ov, idx) => {
    const item = el('div', 'overlay-item');
    const isSelected = state.selectedOverlayId === ov.id;
    item.innerHTML = `
      <div class="overlay-item-header">
        <span>${ov.content || '(empty)'}</span>
        <div class="overlay-actions">
          <button class="edit-overlay">${isSelected ? '▼' : 'Edit'}</button>
          <button class="delete-overlay">×</button>
        </div>
      </div>
      <div class="overlay-edit-form" style="display:${isSelected ? 'block' : 'none'}">
        <div class="form-group">
          <label>Text</label>
          <textarea class="ov-text" rows="2">${ov.content || ''}</textarea>
        </div>
        <div class="overlay-edit-row">
          <div class="form-group"><label>X %</label><input type="number" class="ov-x" value="${ov.x}" min="0" max="100"></div>
          <div class="form-group"><label>Y %</label><input type="number" class="ov-y" value="${ov.y}" min="0" max="100"></div>
        </div>
        <div class="overlay-edit-row">
          <div class="form-group"><label>Size</label><input type="number" class="ov-size" value="${ov.fontSize || 48}" min="8" max="200"></div>
          <div class="form-group"><label>Color</label><input type="color" class="ov-color" value="${ov.color || '#ffffff'}"></div>
        </div>
        <div class="form-group">
          <label>Font Family</label>
          <select class="ov-font-family">
            ${FONT_FAMILIES.map(f => `<option value="${f}" ${(ov.fontFamily || 'Inter') === f ? 'selected' : ''}>${f}</option>`).join('')}
          </select>
        </div>
        <div class="overlay-edit-row">
          <div class="form-group">
            <label>Weight</label>
            <select class="ov-font-weight">
              <option value="300" ${ov.fontWeight === '300' ? 'selected' : ''}>Light</option>
              <option value="400" ${(!ov.fontWeight || ov.fontWeight === '400') ? 'selected' : ''}>Regular</option>
              <option value="500" ${ov.fontWeight === '500' ? 'selected' : ''}>Medium</option>
              <option value="600" ${ov.fontWeight === '600' ? 'selected' : ''}>SemiBold</option>
              <option value="700" ${ov.fontWeight === '700' ? 'selected' : ''}>Bold</option>
            </select>
          </div>
          <div class="form-group">
            <label>Style</label>
            <select class="ov-font-style">
              <option value="normal" ${(!ov.fontStyle || ov.fontStyle === 'normal') ? 'selected' : ''}>Normal</option>
              <option value="italic" ${ov.fontStyle === 'italic' ? 'selected' : ''}>Italic</option>
            </select>
          </div>
        </div>
        <div class="overlay-edit-row">
          <div class="form-group">
            <label>Text Decoration</label>
            <select class="ov-text-decoration">
              <option value="none" ${(!ov.textDecoration || ov.textDecoration === 'none') ? 'selected' : ''}>None</option>
              <option value="underline" ${ov.textDecoration === 'underline' ? 'selected' : ''}>Underline</option>
              <option value="line-through" ${ov.textDecoration === 'line-through' ? 'selected' : ''}>Strikethrough</option>
              <option value="overline" ${ov.textDecoration === 'overline' ? 'selected' : ''}>Overline</option>
            </select>
          </div>
          <div class="form-group">
            <label>Text Align</label>
            <select class="ov-text-align">
              <option value="left" ${(!ov.textAlign || ov.textAlign === 'left') ? 'selected' : ''}>Left</option>
              <option value="center" ${ov.textAlign === 'center' ? 'selected' : ''}>Center</option>
              <option value="right" ${ov.textAlign === 'right' ? 'selected' : ''}>Right</option>
            </select>
          </div>
        </div>
        <div class="overlay-edit-row">
          <div class="form-group">
            <label>Letter Spacing</label>
            <input type="number" class="ov-letter-spacing" value="${ov.letterSpacing || 0}" min="-5" max="30" step="0.5">
          </div>
          <div class="form-group">
            <label>Line Height</label>
            <input type="number" class="ov-line-height" value="${ov.lineHeight || 1.2}" min="0.5" max="3" step="0.1">
          </div>
        </div>
        <div class="overlay-edit-row">
          <div class="form-group">
            <label>Rotation °</label>
            <input type="number" class="ov-rotation" value="${ov.rotation || 0}" min="-180" max="180">
          </div>
          <div class="form-group">
            <label>Opacity</label>
            <input type="range" class="ov-opacity" value="${ov.opacity != null ? ov.opacity : 1}" min="0" max="1" step="0.05">
          </div>
        </div>
        <div class="overlay-edit-row">
          <div class="form-group">
            <label>BG Color</label>
            <input type="color" class="ov-bg-color" value="${ov.bgColor || '#000000'}">
          </div>
          <div class="form-group">
            <label><input type="checkbox" class="ov-bg-enabled" ${ov.bgColor ? 'checked' : ''}> Enable BG</label>
          </div>
        </div>
        <div class="overlay-edit-row">
          <div class="form-group">
            <label>Width (px, 0=auto)</label>
            <input type="number" class="ov-width" value="${ov.width || 0}" min="0" max="2000">
          </div>
          <div class="form-group">
            <label>Padding</label>
            <input type="number" class="ov-padding" value="${ov.padding || 0}" min="0" max="60">
          </div>
        </div>
        <div class="form-group">
          <label>Border Radius</label>
          <input type="number" class="ov-border-radius" value="${ov.borderRadius || 0}" min="0" max="50">
        </div>
      </div>
    `;
    list.appendChild(item);

    item.querySelector('.edit-overlay').addEventListener('click', () => {
      state.selectedOverlayId = (state.selectedOverlayId === ov.id) ? null : ov.id;
      renderSidebar();
    });
    item.querySelector('.delete-overlay').addEventListener('click', () => {
      slide.overlays.splice(idx, 1);
      persistSlideField(slide, 'overlays');
      renderSidebar();
      renderOverlays();
    });

    // Live editing — attach change/input to all inputs/selects
    const form = item.querySelector('.overlay-edit-form');
    if (form) {
      const updateOverlay = () => {
        ov.content        = form.querySelector('.ov-text').value;
        ov.x              = Number(form.querySelector('.ov-x').value);
        ov.y              = Number(form.querySelector('.ov-y').value);
        ov.fontSize       = Number(form.querySelector('.ov-size').value);
        ov.color          = form.querySelector('.ov-color').value;
        ov.fontFamily     = form.querySelector('.ov-font-family').value;
        ov.fontWeight     = form.querySelector('.ov-font-weight').value;
        ov.fontStyle      = form.querySelector('.ov-font-style').value;
        ov.textDecoration = form.querySelector('.ov-text-decoration').value;
        ov.textAlign      = form.querySelector('.ov-text-align').value;
        ov.letterSpacing  = Number(form.querySelector('.ov-letter-spacing').value);
        ov.lineHeight     = Number(form.querySelector('.ov-line-height').value);
        ov.rotation       = Number(form.querySelector('.ov-rotation').value);
        ov.opacity        = Number(form.querySelector('.ov-opacity').value);
        ov.width          = Number(form.querySelector('.ov-width').value);
        ov.padding        = Number(form.querySelector('.ov-padding').value);
        ov.borderRadius   = Number(form.querySelector('.ov-border-radius').value);

        const bgEnabled = form.querySelector('.ov-bg-enabled').checked;
        ov.bgColor = bgEnabled ? form.querySelector('.ov-bg-color').value : null;

        renderOverlays();
      };

      form.querySelectorAll('input, select, textarea').forEach((inp) => {
        inp.addEventListener('input', updateOverlay);
        inp.addEventListener('change', () => {
          updateOverlay();
          persistSlideField(slide, 'overlays');
        });
      });
    }
  });

  ovSec.querySelector('#add-text-btn').addEventListener('click', () => {
    if (!slide.overlays) slide.overlays = [];
    slide.overlays.push({
      id: 'ov-' + Date.now(),
      type: 'heading',
      content: 'New Text',
      x: 10, y: 15,
      fontSize: 48,
      color: '#ffffff',
      fontFamily: 'Inter',
      fontWeight: '700',
      fontStyle: 'normal',
      textDecoration: 'none',
      textAlign: 'left',
      letterSpacing: 0,
      lineHeight: 1.2,
      rotation: 0,
      opacity: 1,
      bgColor: null,
      padding: 0,
      borderRadius: 0,
      width: 0,
    });
    state.selectedOverlayId = slide.overlays[slide.overlays.length - 1].id;
    persistSlideField(slide, 'overlays');
    renderSidebar();
    renderOverlays();
  });

  // ── Transition (skip for first slide) ──
  const slideIdx = state.project.slides.findIndex((s) => s.id === slide.id);
  if (slideIdx > 0) {
    const trSec = el('div', 'sidebar-section');
    const t = slide.transition || { type: 'fly', duration: 1.2, easing: 'power2.inOut' };
    trSec.innerHTML = `
      <h3>Transition</h3>
      <div class="form-group">
        <label>Type</label>
        <select id="tr-type">
          <option value="fly"  ${t.type==='fly'  ? 'selected':''}>Fly</option>
          <option value="spin" ${t.type==='spin' ? 'selected':''}>Spin</option>
          <option value="fade" ${t.type==='fade' ? 'selected':''}>Fade</option>
          <option value="morph"${t.type==='morph'? 'selected':''}>Color Morph</option>
        </select>
      </div>
      <div class="form-group">
        <label>Duration: <strong id="dur-val">${t.duration}s</strong></label>
        <input type="range" id="tr-dur" min="0.3" max="3" step="0.1" value="${t.duration}">
      </div>
      <div class="form-group">
        <label>Easing</label>
        <select id="tr-ease">
          <option value="power2.inOut" ${t.easing==='power2.inOut'?'selected':''}>Ease In Out</option>
          <option value="none"         ${t.easing==='none'        ?'selected':''}>Linear</option>
          <option value="elastic.out(1,0.5)" ${t.easing?.includes?.('elastic')?'selected':''}>Elastic</option>
          <option value="bounce.out"   ${t.easing==='bounce.out'  ?'selected':''}>Bounce</option>
        </select>
      </div>
    `;
    sb.appendChild(trSec);

    const saveTr = () => {
      slide.transition = {
        type: trSec.querySelector('#tr-type').value,
        duration: parseFloat(trSec.querySelector('#tr-dur').value),
        easing: trSec.querySelector('#tr-ease').value,
      };
      trSec.querySelector('#dur-val').textContent = slide.transition.duration + 's';
      persistSlideField(slide, 'transition');
      renderTimeline();
    };
    trSec.querySelector('#tr-type').addEventListener('change', saveTr);
    trSec.querySelector('#tr-dur').addEventListener('input', (e) => {
      trSec.querySelector('#dur-val').textContent = e.target.value + 's';
    });
    trSec.querySelector('#tr-dur').addEventListener('change', saveTr);
    trSec.querySelector('#tr-ease').addEventListener('change', saveTr);
  }
}

// ── Overlay Ghost Rendering ─────────────────────────────────────
export function renderOverlays() {
  const c = document.getElementById('overlay-container');
  c.innerHTML = '';
  const slide = getActiveSlide();
  if (!slide?.overlays) return;

  slide.overlays.forEach((ov) => {
    const d = document.createElement('div');
    d.className = 'ghost-overlay';
    d.dataset.id = ov.id;
    d.style.left = ov.x + '%';
    d.style.top = ov.y + '%';
    d.style.fontSize = (ov.fontSize || 48) + 'px';
    d.style.color = ov.color || '#ffffff';
    d.style.fontFamily = ov.fontFamily || 'Inter';
    d.style.fontWeight = ov.fontWeight || '700';
    d.style.fontStyle = ov.fontStyle || 'normal';
    d.style.textDecoration = ov.textDecoration || 'none';
    d.style.textAlign = ov.textAlign || 'left';
    d.style.letterSpacing = (ov.letterSpacing || 0) + 'px';
    d.style.lineHeight = String(ov.lineHeight || 1.2);
    if (ov.rotation) d.style.transform = `rotate(${ov.rotation}deg)`;
    if (ov.opacity != null) d.style.opacity = ov.opacity;
    if (ov.bgColor) {
      d.style.background = ov.bgColor;
      d.style.padding = (ov.padding || 8) + 'px';
      d.style.borderRadius = (ov.borderRadius || 4) + 'px';
    }
    if (ov.width) d.style.width = ov.width + 'px';
    d.style.whiteSpace = 'pre-wrap';
    d.style.cursor = 'grab';
    d.style.pointerEvents = 'auto';
    d.textContent = ov.content;

    // Highlight selected
    if (state.selectedOverlayId === ov.id) {
      d.style.outline = '2px solid #0066ff';
      d.style.outlineOffset = '4px';
    }

    c.appendChild(d);
  });
}

// ── Actions ─────────────────────────────────────────────────────
export function getActiveSlide() {
  if (!state.project || !state.activeSlideId) return null;
  return state.project.slides.find((s) => s.id === state.activeSlideId);
}

export function updateSceneBackground(hex) {
  if (state.scene) state.scene.background = new THREE.Color(hex);
}

export async function saveSlide() {
  state.renderer.render(state.scene, state.camera);
  const thumbnail = state.renderer.domElement.toDataURL('image/jpeg', 0.6);

  const existing = getActiveSlide();
  const bgHex = '#' + (state.scene.background?.getHexString?.() || '000000');

  const slideData = {
    id: existing?.id || null,
    thumbnail,
    camera: {
      x: state.camera.position.x,
      y: state.camera.position.y,
      z: state.camera.position.z,
      targetX: state.controls.target.x,
      targetY: state.controls.target.y,
      targetZ: state.controls.target.z,
    },
    background: { color: bgHex },
    overlays: existing?.overlays || [],
    models: existing?.models || [],
    transition: existing?.transition || { type: 'fly', duration: 1.2, easing: 'power2.inOut' },
  };

  const isNew = !slideData.id;
  const url = isNew ? '/api/project/save-slide' : '/api/project/update-slide';
  const method = isNew ? 'POST' : 'PUT';

  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, slide: slideData }),
  });
  const { slide } = await res.json();

  if (isNew) {
    state.project.slides.push(slide);
  } else {
    const idx = state.project.slides.findIndex((s) => s.id === slide.id);
    if (idx !== -1) state.project.slides[idx] = slide;
  }
  state.activeSlideId = slide.id;

  renderTimeline();
  renderSidebar();
  renderOverlays();
}

export function createNewSlide() {
  state.activeSlideId = null;
  renderTimeline();
  renderSidebar();
  renderOverlays();
}

export function loadSlideIntoEditor(id) {
  state.activeSlideId = id;
  state.selectedOverlayId = null;
  const slide = getActiveSlide();
  if (!slide) return;

  state.camera.position.set(slide.camera.x, slide.camera.y, slide.camera.z);
  state.controls.target.set(
    slide.camera.targetX ?? 0,
    slide.camera.targetY ?? 0,
    slide.camera.targetZ ?? 0
  );
  state.controls.update();
  updateSceneBackground(slide.background?.color || '#0a0a0a');

  // Load slide models
  loadSlideModels();

  renderTimeline();
  renderSidebar();
  renderOverlays();
}

export async function deleteSlide(id) {
  await fetch(`/api/project/delete-slide/${sessionId}/${id}`, { method: 'DELETE' });
  state.project.slides = state.project.slides.filter((s) => s.id !== id);
  if (state.activeSlideId === id) {
    state.activeSlideId = state.project.slides[0]?.id || null;
  }
  renderTimeline();
  renderSidebar();
  renderOverlays();
}

function persistSlideField(slide, field) {
  fetch('/api/project/update-slide', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, slide }),
  });
}

// ── Helpers ─────────────────────────────────────────────────────
function el(tag, cls) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}

// ── Start ───────────────────────────────────────────────────────
init();
