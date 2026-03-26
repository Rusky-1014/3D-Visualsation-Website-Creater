// ─── ThreeStage Landing — Full Interactive 3D Experience ────────
// Mouse trail, dust particles, 3D sections, owl eyes, heavy GSAP
import * as THREE from 'three';

const { gsap, ScrollTrigger } = window;
gsap.registerPlugin(ScrollTrigger);

// ─────────────────────────────────────────────────────────────────
// 0. GLOBAL MOUSE STATE
// ─────────────────────────────────────────────────────────────────
let mx = window.innerWidth / 2;
let my = window.innerHeight / 2;
let mxNorm = 0, myNorm = 0;

document.addEventListener('mousemove', (e) => {
  mx = e.clientX;
  my = e.clientY;
  mxNorm = (mx / window.innerWidth - 0.5) * 2;
  myNorm = (my / window.innerHeight - 0.5) * 2;
});

// ─────────────────────────────────────────────────────────────────
// 1. CURSOR GLOW — follows mouse with smooth lag
// ─────────────────────────────────────────────────────────────────
const cursorGlow = document.getElementById('cursor-glow');
gsap.ticker.add(() => {
  gsap.set(cursorGlow, { x: mx, y: my });
});

// Hover grow effect on interactive elements
document.querySelectorAll('a, button, .cta-button, .feature-card, .tech-card, .workflow-step')
  .forEach(el => {
    el.addEventListener('mouseenter', () => cursorGlow.classList.add('hovered'));
    el.addEventListener('mouseleave', () => cursorGlow.classList.remove('hovered'));
  });

// ─────────────────────────────────────────────────────────────────
// 2. MOUSE TRAIL — glowing water-drop trail
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

  const TRAIL_LENGTH = 35;
  const trail = [];

  function animate() {
    requestAnimationFrame(animate);
    ctx.clearRect(0, 0, w, h);

    // Add new point
    trail.push({ x: mx, y: my, age: 0 });
    if (trail.length > TRAIL_LENGTH) trail.shift();

    // Draw trail
    for (let i = 0; i < trail.length; i++) {
      const t = trail[i];
      t.age++;
      const progress = i / trail.length;
      const alpha = progress * 0.4;
      const radius = progress * 8 + 2;

      ctx.beginPath();
      ctx.arc(t.x, t.y, radius, 0, Math.PI * 2);

      const gradient = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, radius);
      gradient.addColorStop(0, `rgba(0, 204, 255, ${alpha})`);
      gradient.addColorStop(0.5, `rgba(0, 102, 255, ${alpha * 0.5})`);
      gradient.addColorStop(1, `rgba(124, 58, 237, 0)`);
      ctx.fillStyle = gradient;
      ctx.fill();
    }

    // Connecting line between trail points
    if (trail.length > 2) {
      ctx.beginPath();
      ctx.moveTo(trail[0].x, trail[0].y);
      for (let i = 1; i < trail.length; i++) {
        ctx.lineTo(trail[i].x, trail[i].y);
      }
      ctx.strokeStyle = 'rgba(0, 204, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
  animate();
})();

// ─────────────────────────────────────────────────────────────────
// 3. DUST / FIREFLY PARTICLES — 2D canvas full page
// ─────────────────────────────────────────────────────────────────
(function initDust() {
  const canvas = document.getElementById('dust-canvas');
  const ctx = canvas.getContext('2d');
  let w, h;

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const DUST_COUNT = 80;
  const dusts = [];

  for (let i = 0; i < DUST_COUNT; i++) {
    dusts.push({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.2 - 0.1,
      size: Math.random() * 2.5 + 0.5,
      alpha: Math.random() * 0.3 + 0.05,
      pulseSpeed: Math.random() * 0.02 + 0.005,
      pulseOffset: Math.random() * Math.PI * 2,
      color: Math.random() < 0.5 ? '0, 204, 255' : (Math.random() < 0.5 ? '0, 102, 255' : '124, 58, 237'),
    });
  }

  let frame = 0;
  function animate() {
    requestAnimationFrame(animate);
    ctx.clearRect(0, 0, w, h);
    frame++;

    dusts.forEach(d => {
      // Mouse repulsion — dust drifts away from cursor
      const dx = d.x - mx;
      const dy = d.y - (my + window.scrollY) % h;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 120) {
        const force = (120 - dist) / 120;
        d.vx += (dx / dist) * force * 0.08;
        d.vy += (dy / dist) * force * 0.08;
      }

      // Physics
      d.x += d.vx;
      d.y += d.vy;
      d.vx *= 0.98;
      d.vy *= 0.98;

      // Wrap
      if (d.x < -10) d.x = w + 10;
      if (d.x > w + 10) d.x = -10;
      if (d.y < -10) d.y = h + 10;
      if (d.y > h + 10) d.y = -10;

      // Pulse
      const pulse = Math.sin(frame * d.pulseSpeed + d.pulseOffset);
      const alpha = d.alpha * (0.6 + pulse * 0.4);
      const size = d.size * (0.8 + pulse * 0.2);

      ctx.beginPath();
      ctx.arc(d.x, d.y, size, 0, Math.PI * 2);
      const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, size);
      g.addColorStop(0, `rgba(${d.color}, ${alpha})`);
      g.addColorStop(1, `rgba(${d.color}, 0)`);
      ctx.fillStyle = g;
      ctx.fill();
    });
  }
  animate();
})();

// ─────────────────────────────────────────────────────────────────
// 4. OWL MASCOT — eyes follow mouse
// ─────────────────────────────────────────────────────────────────
(function initOwl() {
  const mascot = document.getElementById('mascot');
  const leftPupil = document.querySelector('.owl-pupil-left');
  const rightPupil = document.querySelector('.owl-pupil-right');
  const leftDot = document.querySelector('.owl-pupil-dot-left');
  const rightDot = document.querySelector('.owl-pupil-dot-right');
  const bubble = document.getElementById('mascot-bubble');

  if (!leftPupil || !rightPupil) return;

  const EYE_RADIUS = 4.5; // max pupil offset

  // Pupil tracking
  gsap.ticker.add(() => {
    const rect = mascot.getBoundingClientRect();
    const owlCenterX = rect.left + rect.width / 2;
    const owlCenterY = rect.top + rect.height / 2;

    const angle = Math.atan2(my - owlCenterY, mx - owlCenterX);
    const dist = Math.min(Math.hypot(mx - owlCenterX, my - owlCenterY) / 200, 1);
    const offsetX = Math.cos(angle) * EYE_RADIUS * dist;
    const offsetY = Math.sin(angle) * EYE_RADIUS * dist;

    // Left eye center: 45, 52
    leftPupil.setAttribute('cx', 45 + offsetX);
    leftPupil.setAttribute('cy', 52 + offsetY);
    leftDot.setAttribute('cx', 46 + offsetX * 0.6);
    leftDot.setAttribute('cy', 50 + offsetY * 0.6);

    // Right eye center: 75, 52
    rightPupil.setAttribute('cx', 75 + offsetX);
    rightPupil.setAttribute('cy', 52 + offsetY);
    rightDot.setAttribute('cx', 76 + offsetX * 0.6);
    rightDot.setAttribute('cy', 50 + offsetY * 0.6);
  });

  // Show mascot on scroll
  gsap.to(mascot, {
    opacity: 1,
    y: 0,
    duration: 0.8,
    delay: 2,
    ease: 'back.out(1.5)',
  });

  // Bubble appears after delay
  gsap.to(bubble, {
    opacity: 1,
    y: 0,
    scale: 1,
    duration: 0.5,
    delay: 3,
    ease: 'back.out(2)',
  });

  // Bubble hides on scroll
  ScrollTrigger.create({
    start: 200,
    onEnter: () => gsap.to(bubble, { opacity: 0, duration: 0.3 }),
    onLeaveBack: () => gsap.to(bubble, { opacity: 1, duration: 0.5, delay: 1 }),
  });

  // Change bubble text based on section
  const bubbleMessages = [
    'Hey! Scroll down! 🦉',
    'Cool features, right? ✨',
    'Just 3 steps! Easy! 🎯',
    'Powerful tech stack! ⚡',
    'Go build something! 🚀',
  ];

  ['#hero', '#features', '#workflow', '#showcase', '#cta-section'].forEach((sel, i) => {
    ScrollTrigger.create({
      trigger: sel,
      start: 'top center',
      onEnter: () => {
        bubble.textContent = bubbleMessages[i];
        gsap.fromTo(bubble, { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out' });
      },
    });
  });
})();

// ─────────────────────────────────────────────────────────────────
// 5. THREE.JS HERO — Particles + Wireframes
// ─────────────────────────────────────────────────────────────────
(function initHero3D() {
  const canvas = document.getElementById('hero-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(0, 0, 50);

  // Particle Cloud
  const PARTICLE_COUNT = 2500;
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const colors = new Float32Array(PARTICLE_COUNT * 3);
  const velocities = [];
  const color1 = new THREE.Color('#0066ff');
  const color2 = new THREE.Color('#00ccff');
  const color3 = new THREE.Color('#7c3aed');

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3;
    positions[i3] = (Math.random() - 0.5) * 120;
    positions[i3 + 1] = (Math.random() - 0.5) * 80;
    positions[i3 + 2] = (Math.random() - 0.5) * 60;
    const c = Math.random() < 0.4 ? color1 : Math.random() < 0.6 ? color2 : color3;
    colors[i3] = c.r;
    colors[i3 + 1] = c.g;
    colors[i3 + 2] = c.b;
    velocities.push({
      x: (Math.random() - 0.5) * 0.015,
      y: (Math.random() - 0.5) * 0.015,
      z: (Math.random() - 0.5) * 0.08,
    });
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: 1.5, vertexColors: true, transparent: true, opacity: 0.7,
    blending: THREE.AdditiveBlending, sizeAttenuation: true, depthWrite: false,
  });
  scene.add(new THREE.Points(geo, mat));

  // Wireframe shapes
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(12, 0.15, 16, 100),
    new THREE.MeshBasicMaterial({ color: 0x0066ff, transparent: true, opacity: 0.2, wireframe: true })
  );
  ring.rotation.x = Math.PI / 3;
  scene.add(ring);

  const ring2 = new THREE.Mesh(
    new THREE.TorusGeometry(18, 0.1, 16, 80),
    new THREE.MeshBasicMaterial({ color: 0x7c3aed, transparent: true, opacity: 0.12, wireframe: true })
  );
  ring2.rotation.x = -Math.PI / 4;
  ring2.rotation.y = Math.PI / 6;
  scene.add(ring2);

  const ico = new THREE.Mesh(
    new THREE.IcosahedronGeometry(5, 1),
    new THREE.MeshBasicMaterial({ color: 0x00ccff, transparent: true, opacity: 0.15, wireframe: true })
  );
  scene.add(ico);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();
    const pos = geo.attributes.position.array;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      pos[i3] += velocities[i].x;
      pos[i3 + 1] += velocities[i].y;
      pos[i3 + 2] += velocities[i].z;
      if (pos[i3] > 60) pos[i3] = -60;
      if (pos[i3] < -60) pos[i3] = 60;
      if (pos[i3 + 1] > 40) pos[i3 + 1] = -40;
      if (pos[i3 + 1] < -40) pos[i3 + 1] = 40;
    }
    geo.attributes.position.needsUpdate = true;

    ring.rotation.z = t * 0.1;
    ring.rotation.x = Math.PI / 3 + Math.sin(t * 0.3) * 0.2;
    ring2.rotation.z = -t * 0.08;
    ring2.rotation.y = Math.PI / 6 + Math.cos(t * 0.2) * 0.15;
    ico.rotation.x = t * 0.15;
    ico.rotation.y = t * 0.1;
    ico.scale.setScalar(1 + Math.sin(t) * 0.08);

    camera.position.x += (mxNorm * 3 - camera.position.x) * 0.03;
    camera.position.y += (-myNorm * 2 - camera.position.y) * 0.03;
    camera.lookAt(0, 0, 0);

    // Constant opacity instead of fading out on scroll
    mat.opacity = 0.5;
    ring.material.opacity = 0.15;
    ring2.material.opacity = 0.1;
    ico.material.opacity = 0.12;

    renderer.render(scene, camera);
  }
  animate();
})();

// ─────────────────────────────────────────────────────────────────
// 6. FEATURES SECTION — Floating crystal geometry
// ─────────────────────────────────────────────────────────────────
// Extra scenes removed as requested

// ─────────────────────────────────────────────────────────────────
// 9. GSAP MEGA ANIMATIONS — Hero, Scroll reveals, parallax, etc
// ─────────────────────────────────────────────────────────────────

// ── Hero Entrance Sequence ──
const heroTL = gsap.timeline({ delay: 0.3 });
heroTL
  .to('#hero-badge', { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' })
  .to('.hero-line', { opacity: 1, y: 0, duration: 0.7, stagger: 0.12, ease: 'power3.out' }, '-=0.3')
  .to('#hero-subtitle', { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, '-=0.4')
  .to('#hero-actions', { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, '-=0.3')
  .to('#hero-stats', { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, '-=0.3')
  .to('#scroll-indicator', { opacity: 1, duration: 0.8, ease: 'power2.out' }, '-=0.2');

// ── Section Header GSAP Reveal with Scale + Rotation ──
gsap.utils.toArray('.section-tag').forEach(tag => {
  gsap.from(tag, {
    opacity: 0, scale: 0.5, rotation: -10, duration: 0.6, ease: 'back.out(2)',
    scrollTrigger: { trigger: tag, start: 'top 88%', toggleActions: 'play none none none' },
  });
});

gsap.utils.toArray('.section-header h2').forEach(h2 => {
  gsap.from(h2, {
    opacity: 0, y: 50, skewY: 3, duration: 0.9, ease: 'power3.out',
    scrollTrigger: { trigger: h2, start: 'top 85%', toggleActions: 'play none none none' },
  });
});

gsap.utils.toArray('.section-desc').forEach(desc => {
  gsap.from(desc, {
    opacity: 0, y: 30, duration: 0.7, ease: 'power2.out',
    scrollTrigger: { trigger: desc, start: 'top 85%', toggleActions: 'play none none none' },
  });
});

// ── Feature Cards — Staggered 3D flip-in ──
gsap.utils.toArray('.feature-card').forEach((card, i) => {
  gsap.to(card, {
    opacity: 1, y: 0, duration: 0.8, ease: 'power3.out',
    scrollTrigger: { trigger: card, start: 'top 85%', toggleActions: 'play none none none' },
    delay: (i % 3) * 0.12,
  });
});

// Feature card magnetic tilt on hover
gsap.utils.toArray('.feature-card').forEach(card => {
  card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const ax = (e.clientX - cx) / (rect.width / 2);
    const ay = (e.clientY - cy) / (rect.height / 2);
    gsap.to(card, {
      rotateY: ax * 5,
      rotateX: -ay * 5,
      duration: 0.4,
      ease: 'power2.out',
      transformPerspective: 800,
    });
  });
  card.addEventListener('mouseleave', () => {
    gsap.to(card, { rotateY: 0, rotateX: 0, duration: 0.6, ease: 'elastic.out(1.2, 0.5)' });
  });
});

// ── Workflow Steps — Alternating slide-in ──
gsap.utils.toArray('.workflow-step').forEach((step, i) => {
  gsap.to(step, {
    opacity: 1, x: 0, duration: 1, ease: 'power3.out',
    scrollTrigger: { trigger: step, start: 'top 82%', toggleActions: 'play none none none' },
  });

  // Animate step number with scale bounce
  const num = step.querySelector('.step-number');
  if (num) {
    gsap.from(num, {
      scale: 0, rotation: -20, duration: 0.8, ease: 'back.out(2)',
      scrollTrigger: { trigger: step, start: 'top 80%', toggleActions: 'play none none none' },
      delay: 0.2,
    });
  }

  // Mockup fly-in from right
  const visual = step.querySelector('.step-visual');
  if (visual) {
    gsap.from(visual, {
      x: 80, opacity: 0, rotation: 5, duration: 0.9, ease: 'power3.out',
      scrollTrigger: { trigger: step, start: 'top 78%', toggleActions: 'play none none none' },
      delay: 0.3,
    });
  }
});

// ── Tech Cards — Staggered with 3D perspective ──
gsap.utils.toArray('.tech-card').forEach((card, i) => {
  gsap.to(card, {
    opacity: 1, y: 0, rotateX: 0, duration: 0.7, ease: 'power3.out',
    scrollTrigger: { trigger: card, start: 'top 88%', toggleActions: 'play none none none' },
    delay: i * 0.1,
  });

  // Hover parallax on tech logos
  const logo = card.querySelector('.tech-logo');
  card.addEventListener('mouseenter', () => {
    gsap.to(logo, { scale: 1.3, rotation: 360, duration: 0.6, ease: 'power2.out' });
  });
  card.addEventListener('mouseleave', () => {
    gsap.to(logo, { scale: 1, rotation: 0, duration: 0.5, ease: 'power2.inOut' });
  });
});

// ── CTA Section — Elastic scale-in ──
gsap.from('.cta-block h2', {
  opacity: 0, scale: 0.8, y: 40, duration: 1, ease: 'power3.out',
  scrollTrigger: { trigger: '#cta-section', start: 'top 80%', toggleActions: 'play none none none' },
});

gsap.from('.cta-block p', {
  opacity: 0, y: 20, duration: 0.6, ease: 'power2.out',
  scrollTrigger: { trigger: '#cta-section', start: 'top 75%', toggleActions: 'play none none none' },
  delay: 0.2,
});

gsap.from('.cta-block .cta-button', {
  opacity: 0, y: 30, scale: 0.9, duration: 0.7, ease: 'back.out(2)',
  scrollTrigger: { trigger: '#cta-section', start: 'top 72%', toggleActions: 'play none none none' },
  delay: 0.4,
});

// ── Parallax Scrolling on Hero Content ──
gsap.to('.hero-content', {
  y: -80,
  scrollTrigger: {
    trigger: '#hero',
    start: 'top top',
    end: 'bottom top',
    scrub: 1,
  },
});

gsap.to('#scroll-indicator', {
  y: -30,
  opacity: 0,
  scrollTrigger: {
    trigger: '#hero',
    start: '20% top',
    end: '50% top',
    scrub: 1,
  },
});

// ── Nav Shrink on Scroll ──
ScrollTrigger.create({
  start: 80,
  onToggle: (self) => {
    const nav = document.getElementById('main-nav');
    if (self.isActive) {
      nav.style.padding = '10px 0';
      nav.style.borderBottomColor = 'rgba(255,255,255,.12)';
    } else {
      nav.style.padding = '16px 0';
      nav.style.borderBottomColor = 'rgba(255,255,255,.08)';
    }
  },
});

// ── Stat numbers counter animation ──
gsap.utils.toArray('.stat-number').forEach(el => {
  gsap.from(el, {
    textContent: 0,
    duration: 0,
    scrollTrigger: {
      trigger: el,
      start: 'top 90%',
      onEnter: () => {
        gsap.from(el, { scale: 0, duration: 0.5, ease: 'back.out(3)' });
      },
    },
  });
});

