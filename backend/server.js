const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const archiver = require('archiver');
const { MongoClient, ObjectId } = require('mongodb');
const os = require('os');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ── Static Files ────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '..')));

// Set up model upload directory
const MODELS_DIR = path.join(__dirname, '..', 'models');

// ── Multer for GLB uploads (multi-model with unique filenames) ──
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(MODELS_DIR)) fs.mkdirSync(MODELS_DIR, { recursive: true });
    cb(null, MODELS_DIR);
  },
  filename: (req, file, cb) => {
    // Generate unique name: model-<timestamp>-<original>.glb
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueName = `model-${Date.now()}-${base}${ext}`;
    cb(null, uniqueName);
  }
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.glb' || ext === '.gltf') cb(null, true);
    else cb(new Error('Only .glb / .gltf files are accepted'));
  },
  limits: { fileSize: 100 * 1024 * 1024 } // 100 MB
});

// ── Storage & Sessions ───────────────────────────────────────────
const schemaTemplate = require('../shared/schema-template');

// In-memory active editing sessions
// Format: { [sessionId]: projectData }
const sessions = {};

// MongoDB setup
const uri = "mongodb+srv://vitul:password%40123@3d-project.qimlwgn.mongodb.net/?retryWrites=true&w=majority";
const client = new MongoClient(uri);
let db, usersColl, projectsColl;

client.connect().then(() => {
  console.log("🟢 Connected to MongoDB Atlas");
  db = client.db("authDB");
  usersColl = db.collection("users");
  projectsColl = db.collection("projects");
}).catch(console.error);

function getSession(sessionId) {
  if (!sessions[sessionId]) {
    sessions[sessionId] = JSON.parse(JSON.stringify(schemaTemplate));
  }
  return sessions[sessionId];
}

// ── API Routes (MongoDB Auth) ───────────────────────────────────

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'All fields required' });
    
    const existing = await usersColl.findOne({ username });
    if (existing) return res.status(400).json({ error: 'User already exists' });
    
    const result = await usersColl.insertOne({ username, password });
    res.json({ success: true, user: { id: result.insertedId.toString(), username } });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'All fields required' });

    const user = await usersColl.findOne({ username, password });
    if (user) {
      res.json({ success: true, user: { id: user._id.toString(), username: user.username } });
    } else {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Get Finalized Projects for User
app.get('/api/projects/:userId', async (req, res) => {
  try {
    const userProjects = await projectsColl.find({ userId: req.params.userId }).toArray();
    const mapped = userProjects.map(p => ({ ...p, id: p._id.toString() }));
    res.json({ success: true, projects: mapped });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Get Single Finalized Project
app.get('/api/public-project/:projectId', async (req, res) => {
  try {
    const proj = await projectsColl.findOne({ _id: new ObjectId(req.params.projectId) });
    if (proj) {
      res.json(proj.data);
    } else {
      res.status(404).json({ error: 'Project not found' });
    }
  } catch(e) {
    res.status(404).json({ error: 'Invalid ID format' });
  }
});

// ── API Routes (Sessions) ───────────────────────────────────────
const uuid = () => Math.random().toString(36).substring(2, 9);

// Create new editing session
app.post('/api/sessions', (req, res) => {
  const sessionId = 'session_' + uuid();
  sessions[sessionId] = JSON.parse(JSON.stringify(schemaTemplate));
  res.json({ success: true, sessionId });
});

// GET full project for a session
app.get('/api/project/:sessionId', (req, res) => {
  res.json(getSession(req.params.sessionId));
});

// POST save new slide
app.post('/api/project/save-slide', (req, res) => {
  const { sessionId, slide } = req.body;
  const project = getSession(sessionId);
  if (!slide.id) slide.id = 'slide-' + Date.now();
  project.slides.push(slide);
  res.json({ success: true, slide });
});

// PUT update existing slide
app.put('/api/project/update-slide', (req, res) => {
  const { sessionId, slide } = req.body;
  const project = getSession(sessionId);
  const idx = project.slides.findIndex(s => s.id === slide.id);
  if (idx === -1) return res.status(404).json({ error: 'Slide not found' });
  if (!slide.thumbnail && project.slides[idx].thumbnail) {
    slide.thumbnail = project.slides[idx].thumbnail;
  }
  project.slides[idx] = slide;
  res.json({ success: true, slide });
});

// DELETE slide
app.delete('/api/project/delete-slide/:sessionId/:slideId', (req, res) => {
  const project = getSession(req.params.sessionId);
  project.slides = project.slides.filter(s => s.id !== req.params.slideId);
  res.json({ success: true });
});

// POST reorder slides
app.post('/api/project/reorder-slides', (req, res) => {
  const { sessionId, slides } = req.body;
  const project = getSession(sessionId);
  project.slides = slides;
  res.json({ success: true });
});

// POST upload model (mapped to session)
app.post('/api/upload-model/:sessionId', upload.single('model'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const modelUrl = '/models/' + req.file.filename;
  
  const project = getSession(req.params.sessionId);
  if (!project.modelUrl) {
    project.modelUrl = modelUrl;
  }
  res.json({ success: true, modelUrl });
});

// GET list of all uploaded models
app.get('/api/models', (req, res) => {
  const dir = path.join(__dirname, '..', 'models');
  if (!fs.existsSync(dir)) return res.json({ models: [] });
  const files = fs.readdirSync(dir)
    .filter(f => ['.glb', '.gltf'].includes(path.extname(f).toLowerCase()))
    .map(f => ({
      name: f,
      url: '/models/' + f,
      size: fs.statSync(path.join(dir, f)).size
    }));
  res.json({ models: files });
});

// DELETE a model file
app.delete('/api/models/:filename', (req, res) => {
  const filePath = path.join(__dirname, '..', 'models', req.params.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  res.json({ success: true });
});

// ── Export / Deploy / Finalize ──────────────────────────────────

// Finalize project to MongoDB
app.post('/api/project/finalize', async (req, res) => {
  try {
    const { sessionId, userId, name } = req.body;
    const projectData = getSession(sessionId);
    if (!projectData) return res.status(400).json({ error: 'No active session' });
    if (projectData.slides.length === 0) return res.status(400).json({ error: 'Cannot finalize empty project' });
    
    // Auto-generate project site HTML into data payload cache for direct downloads later? 
    // Wait, let's just save the JSON structuring here.
    const newProject = {
      userId: userId || 'admin',
      name: name || 'Untitled Project',
      createdAt: new Date().toISOString(),
      data: projectData
    };
    
    if (projectData.slides[0].thumbnail) {
      newProject.thumbnail = projectData.slides[0].thumbnail;
    }

    const result = await projectsColl.insertOne(newProject);
    
    // Clear temp session
    delete sessions[sessionId];

    res.json({ success: true, projectId: result.insertedId.toString(), projectData });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// DOWNLOAD Zipped Project Source Code
app.get('/api/download/:projectId', async (req, res) => {
  try {
    const proj = await projectsColl.findOne({ _id: new ObjectId(req.params.projectId) });
    if (!proj) return res.status(404).json({ error: 'Project not found' });

    const archive = archiver('zip', { zlib: { level: 9 } });
    res.attachment(`${proj.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_code.zip`);
    archive.pipe(res);

    // 1. Generate HTML
    const projectJSON = JSON.stringify(proj.data);
    const html = generateStandaloneHTML(proj.data, projectJSON);
    archive.append(html, { name: 'index.html' });

    // 2. Resolve Model URLs
    const modelUrls = new Set();
    if (proj.data.modelUrl) modelUrls.add(proj.data.modelUrl);
    proj.data.slides.forEach(s => {
      if (s.models) s.models.forEach(m => modelUrls.add(m.url));
    });

    modelUrls.forEach(url => {
      const filename = path.basename(url);
      const src = path.join(MODELS_DIR, filename);
      if (fs.existsSync(src)) {
        archive.file(src, { name: `models/${filename}` });
      }
    });

    await archive.finalize();
  } catch (err) {
    console.error('Download failed:', err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

// POST deploy to Vercel
app.post('/api/deploy/:projectId', async (req, res) => {
  try {
    const proj = await projectsColl.findOne({ _id: new ObjectId(req.params.projectId) });
    if (!proj) throw new Error('Project not found in DB');

    // Manually export for vercel
    const exportDir = path.join(__dirname, '..', 'export');
    
    if (fs.existsSync(exportDir)) fs.rmSync(exportDir, { recursive: true });
    fs.mkdirSync(exportDir, { recursive: true });
    fs.mkdirSync(path.join(exportDir, 'models'), { recursive: true });

    const projectJSON = JSON.stringify(proj.data);
    const html = generateStandaloneHTML(proj.data, projectJSON);
    fs.writeFileSync(path.join(exportDir, 'index.html'), html, 'utf8');

    const modelUrls = new Set();
    if (proj.data.modelUrl) modelUrls.add(proj.data.modelUrl);
    proj.data.slides.forEach(s => {
      if (s.models) s.models.forEach(m => modelUrls.add(m.url));
    });

    modelUrls.forEach(url => {
      const filename = path.basename(url);
      const src = path.join(MODELS_DIR, filename);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(exportDir, 'models', filename));
      }
    });

    // Deploy using Vercel CLI
    try {
      const result = execSync(`npx -y vercel --prod --yes`, {
        cwd: exportDir,
        timeout: 120000,
        encoding: 'utf8',
        env: { ...process.env, FORCE_COLOR: '0' }
      });
      
      const lines = result.trim().split('\n');
      const deployUrl = lines[lines.length - 1].trim();
      
      res.json({ success: true, url: deployUrl });
    } catch (vercelErr) {
      res.json({
        success: false,
        error: 'Vercel deployment failed.',
        details: vercelErr.message
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Standalone HTML Generator ───────────────────────────────────
function generateStandaloneHTML(project, projectJSON) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ThreeStage Experience</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&family=Playfair+Display:wght@400;700&family=Space+Grotesk:wght@300;400;500;700&family=Outfit:wght@300;400;500;600;700&family=Sora:wght@300;400;600;700&family=DM+Sans:wght@400;500;700&family=Poppins:wght@300;400;500;600;700&family=Montserrat:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root { --font: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
    * { scrollbar-width: none; box-sizing: border-box; margin: 0; padding: 0; }
    ::-webkit-scrollbar { display: none; }
    html, body { font-family: var(--font); background: #000; color: #fff; overflow-x: hidden; -webkit-font-smoothing: antialiased; }
    #loading-screen { position: fixed; inset: 0; background: #000; display: flex; flex-direction: column; justify-content: center; align-items: center; z-index: 200; transition: opacity 0.6s ease; }
    #loading-screen.hidden { opacity: 0; pointer-events: none; }
    .loader-ring { width: 48px; height: 48px; border: 2px solid rgba(255,255,255,.15); border-top-color: #fff; border-radius: 50%; animation: spin .8s linear infinite; margin-bottom: 20px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    #loading-text { font-size: 14px; font-weight: 300; letter-spacing: 2px; text-transform: uppercase; color: rgba(255,255,255,.5); }
    #progress-bar { position: fixed; top: 0; left: 0; height: 3px; width: 0%; background: linear-gradient(90deg, #0066ff, #00ccff); z-index: 100; transition: width .05s linear; }
    #viewer-canvas { position: fixed; top: 0; left: 0; width: 100%; height: 100vh; z-index: 1; }
    #scroll-container { position: relative; z-index: 5; pointer-events: none; }
    .scroll-section { width: 100%; height: 100vh; }
    .overlay-layer { position: fixed; inset: 0; opacity: 0; pointer-events: none; z-index: 10; transition: opacity .4s ease; }
    .viewer-overlay { position: absolute; font-weight: 700; text-shadow: 0 2px 20px rgba(0,0,0,.7), 0 0 60px rgba(0,0,0,.4); line-height: 1.15; letter-spacing: -0.5px; white-space: pre-wrap; }
    #slide-dots { position: fixed; right: 24px; top: 50%; transform: translateY(-50%); display: flex; flex-direction: column; gap: 14px; z-index: 50; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,.25); transition: all .3s ease; cursor: pointer; }
    .dot.active { background: #fff; transform: scale(1.6); box-shadow: 0 0 10px rgba(255,255,255,.5); }
    #scroll-hint { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); z-index: 50; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; color: rgba(255,255,255,.35); animation: pulse 2s ease infinite; }
    @keyframes pulse { 0%, 100% { opacity: .35; transform: translateX(-50%) translateY(0); } 50% { opacity: .7; transform: translateX(-50%) translateY(-5px); } }
  </style>
</head>
<body>
  <div id="loading-screen"><div class="loader-ring"></div><p id="loading-text">Loading Experience…</p></div>
  <div id="progress-bar"></div>
  <div id="slide-dots"></div>
  <canvas id="viewer-canvas"></canvas>
  <div id="scroll-container"></div>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>
  <script type="importmap">
    { "imports": { "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js", "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/" } }
  </script>
  <script type="module">
    import * as THREE from 'three';
    import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
    import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

    const { gsap, ScrollTrigger } = window;
    gsap.registerPlugin(ScrollTrigger);

    const project = ${projectJSON};
    let scene, camera, renderer, controls;
    const models = {};

    async function init() {
      if (!project?.slides?.length) {
        document.getElementById('loading-text').textContent = 'No slides yet';
        return;
      }
      buildScaffolding();
      setupThree();
    }

    function buildScaffolding() {
      const container = document.getElementById('scroll-container');
      const dots = document.getElementById('slide-dots');
      container.style.height = project.slides.length * 100 + 'vh';
      project.slides.forEach((slide, i) => {
        const section = document.createElement('div');
        section.className = 'scroll-section';
        section.id = 'section-' + i;
        container.appendChild(section);
        const layer = document.createElement('div');
        layer.className = 'overlay-layer';
        layer.id = 'overlay-' + i;
        if (slide.overlays) {
          slide.overlays.forEach(ov => {
            const el = document.createElement('div');
            el.className = 'viewer-overlay';
            el.style.left = ov.x + '%';
            el.style.top = ov.y + '%';
            el.style.fontSize = (ov.fontSize || 48) + 'px';
            el.style.color = ov.color || '#fff';
            if (ov.fontFamily) el.style.fontFamily = ov.fontFamily;
            if (ov.fontWeight) el.style.fontWeight = ov.fontWeight;
            if (ov.fontStyle) el.style.fontStyle = ov.fontStyle;
            if (ov.textDecoration) el.style.textDecoration = ov.textDecoration;
            if (ov.letterSpacing) el.style.letterSpacing = ov.letterSpacing + 'px';
            if (ov.lineHeight) el.style.lineHeight = ov.lineHeight;
            if (ov.textAlign) el.style.textAlign = ov.textAlign;
            if (ov.rotation) el.style.transform = 'rotate(' + ov.rotation + 'deg)';
            if (ov.opacity != null) el.style.opacity = ov.opacity;
            if (ov.bgColor) { el.style.background = ov.bgColor; el.style.padding = (ov.padding || 8) + 'px'; el.style.borderRadius = (ov.borderRadius || 4) + 'px'; }
            if (ov.width) el.style.width = ov.width + 'px';
            el.textContent = ov.content;
            layer.appendChild(el);
          });
        }
        document.body.appendChild(layer);
        const dot = document.createElement('div');
        dot.className = 'dot' + (i === 0 ? ' active' : '');
        dot.dataset.index = i;
        dots.appendChild(dot);
      });
      const hint = document.createElement('div');
      hint.id = 'scroll-hint';
      hint.textContent = 'Scroll ↓';
      document.body.appendChild(hint);
    }

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
      controls.target.set(first.camera.targetX || 0, first.camera.targetY || 0, first.camera.targetZ || 0);
      controls.update();
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
          document.getElementById('progress-bar').style.width = (window.scrollY / maxScroll) * 100 + '%';
        }
      });
    }

    function loadAllModels() {
      const loader = new GLTFLoader();
      const urlsToLoad = new Set();
      if (project.modelUrl) urlsToLoad.add(project.modelUrl);
      project.slides.forEach(s => {
        if (s.models) s.models.forEach(m => urlsToLoad.add(m.url));
      });
      let loaded = 0;
      const total = urlsToLoad.size || 1;
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
      if (urlsToLoad.size === 0) {
        const geo = new THREE.BoxGeometry(2, 2, 2);
        const mat = new THREE.MeshStandardMaterial({ color: 0x0066ff, roughness: 0.3, metalness: 0.7 });
        const cube = new THREE.Mesh(geo, mat);
        models['__fallback__'] = cube;
        scene.add(cube);
        hideLoader();
        setupScrollTriggers();
      }
    }

    function onAllModelsLoaded() {
      // Add default model to scene
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
      setTimeout(() => ls.style.display = 'none', 600);
    }

    function setupScrollTriggers() {
      const sections = document.querySelectorAll('.scroll-section');
      const dots = document.querySelectorAll('.dot');
      gsap.set('#overlay-0', { opacity: 1 });
      ScrollTrigger.create({
        trigger: sections[0], start: 'top top', end: 'bottom top',
        onLeave: () => { const h = document.getElementById('scroll-hint'); if (h) gsap.to(h, { opacity: 0, duration: 0.3, onComplete: () => h.remove() }); }
      });
      project.slides.forEach((slide, i) => {
        ScrollTrigger.create({
          trigger: sections[i], start: 'top center', end: 'bottom center',
          onEnter: () => { gsap.to('#overlay-'+i, {opacity:1,duration:.5}); dots.forEach((d,j) => d.classList.toggle('active', j===i)); handleSlideModels(i); },
          onEnterBack: () => { gsap.to('#overlay-'+i, {opacity:1,duration:.5}); dots.forEach((d,j) => d.classList.toggle('active', j===i)); handleSlideModels(i); },
          onLeave: () => { if(i<project.slides.length-1) gsap.to('#overlay-'+i, {opacity:0,duration:.4}); },
          onLeaveBack: () => { if(i>0) gsap.to('#overlay-'+i, {opacity:0,duration:.4}); }
        });
        if (i < project.slides.length - 1) {
          const next = project.slides[i+1];
          const nc = new THREE.Color(next.background?.color || '#000');
          const tl = gsap.timeline({ scrollTrigger: { trigger: sections[i], start: 'top top', end: 'bottom top', scrub: 1.2 } });
          tl.to(camera.position, { x: next.camera.x, y: next.camera.y, z: next.camera.z, ease: 'none' }, 0);
          tl.to(controls.target, { x: next.camera.targetX||0, y: next.camera.targetY||0, z: next.camera.targetZ||0, ease: 'none' }, 0);
          tl.to(scene.background, { r: nc.r, g: nc.g, b: nc.b, ease: 'none' }, 0);
        }
      });
      dots.forEach(dot => dot.addEventListener('click', () => {
        const target = sections[Number(dot.dataset.index)];
        if (target) window.scrollTo({ top: target.offsetTop, behavior: 'smooth' });
      }));
    }

    function handleSlideModels(slideIdx) {
      const slide = project.slides[slideIdx];
      if (!slide.models || slide.models.length === 0) return;
      // Show/hide models for this slide
      Object.values(models).forEach(m => { m.visible = false; });
      slide.models.forEach(sm => {
        if (models[sm.url]) {
          models[sm.url].visible = true;
          if (!models[sm.url].parent) scene.add(models[sm.url]);
          if (sm.position) models[sm.url].position.set(sm.position.x||0, sm.position.y||0, sm.position.z||0);
          if (sm.scale != null) models[sm.url].scale.setScalar(sm.scale);
        }
      });
      // If no slide-specific models, show default
      if (slide.models.length === 0 && project.modelUrl && models[project.modelUrl]) {
        models[project.modelUrl].visible = true;
      }
    }

    init();
  </script>
</body>
</html>`;
}

// ── Root route → landing page ──────────────────────────────────
app.get('/', (req, res) => {
  res.redirect('/landing/');
});

// ── Start ───────────────────────────────────────────────────────
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n  ✦ ThreeStage Server running at http://localhost:${PORT}`);
    console.log(`  ✦ Landing →  http://localhost:${PORT}/`);
    console.log(`  ✦ Auth    →  http://localhost:${PORT}/auth/`);
    console.log(`  ✦ Profile →  http://localhost:${PORT}/profile/`);
    console.log(`  ✦ Editor  →  http://localhost:${PORT}/editor/`);
    console.log(`  ✦ Viewer  →  http://localhost:${PORT}/viewer/\n`);
  });
}

module.exports = app;
