import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

gsap.registerPlugin(ScrollTrigger);

/* ───────── SCENE ───────── */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07080d);

/* ───────── CAMERA ───────── */
const camera = new THREE.PerspectiveCamera(
    55,
    window.innerWidth / window.innerHeight,
    0.1,
    200
);

camera.position.set(8.31, 2.18, -0.31); // Slide 1 start

/* ───────── RENDERER ───────── */
const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;

document.body.appendChild(renderer.domElement);

/* ───────── LIGHTING (UNCHANGED) ───────── */
scene.add(new THREE.AmbientLight(0xffffff, 0.4));

const keyLight = new THREE.DirectionalLight(0xfff4e0, 2.8);
keyLight.position.set(4, 6, 5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xc8e0ff, 0.9);
fillLight.position.set(-5, 2, 3);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xe2c97e, 1.2);
rimLight.position.set(-2, -1, -6);
scene.add(rimLight);

const bounceLight = new THREE.PointLight(0x3a8ef6, 0.6, 20);
bounceLight.position.set(0, -3, 2);
scene.add(bounceLight);

/* ───────── CONTROLS ───────── */
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enablePan = false;
controls.enabled = false;

/* ───────── STATE ───────── */
let model = null;
let masterTimeline = null;
let resumeTimeout;

/* ───────── SLIDES (YOUR REAL DATA) ───────── */
const slides = [
    { x: 8.31, y: 2.18, z: -0.31 },
    { x: 16.34, y: 1.10, z: 0.06 },
    { x: 9.93, y: 9.97, z: 8.48 },
    { x: 0.15, y: 18.90, z: -0.08 },
    { x: 8.32, y: 14.84, z: -8.45 },
    { x: -12.44, y: 12.24, z: 7.46 },
];

/* ───────── MODEL LOADER ───────── */
function centerModel(object) {
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    object.position.sub(center);
}

const loader = new GLTFLoader();

loader.load(
    "model/apple_vision_pro-2.glb",
    (gltf) => {
        model = gltf.scene;
        centerModel(model);
        model.scale.set(18, 18, 18);
        scene.add(model);
        setupScrollTimeline();
        setupStrictTextFade();
    }
);

/* ───────── SCROLL SLIDE TIMELINE ───────── */
function setupScrollTimeline() {

    masterTimeline = gsap.timeline({
        scrollTrigger: {
            trigger: "#scroll-container",
            start: "top top",
            end: "bottom bottom",
            scrub: 2.2,
        }
    });

    const S = slides;

    /* ───────── 1 → 2 (KEEP AS IS – Zoom Out First) ───────── */

    masterTimeline
        .to(camera.position, {
            x: S[0].x * 1.8,
            y: S[0].y * 0.8,
            z: S[0].z * 1.8,
            duration: 0.6,
            ease: "power2.inOut",
            onUpdate: () => camera.lookAt(0, 0, 0),
        })
        .to(camera.position, {
            x: S[1].x,
            y: S[1].y,
            z: S[1].z,
            duration: 0.4,
            ease: "power2.inOut",
            onUpdate: () => camera.lookAt(0, 0, 0),
        });


    /* ───────── 2 → 3 (Smooth Direct) ───────── */

    masterTimeline.to(camera.position, {
        x: S[2].x,
        y: S[2].y,
        z: S[2].z,
        duration: 1,
        ease: "power1.inOut",
        onUpdate: () => camera.lookAt(0, 0, 0),
    });


    /* ───────── 3 → 4 (Smooth Direct) ───────── */

    masterTimeline.to(camera.position, {
        x: S[3].x,
        y: S[3].y,
        z: S[3].z,
        duration: 1,
        ease: "power1.inOut",
        onUpdate: () => camera.lookAt(0, 0, 0),
    });


    /* ───────── 4 → 5 (Smooth Direct) ───────── */

    masterTimeline.to(camera.position, {
        x: S[4].x,
        y: S[4].y,
        z: S[4].z,
        duration: 1,
        ease: "power1.inOut",
        onUpdate: () => camera.lookAt(0, 0, 0),
    });


    /* ───────── 5 → 6 (Smooth Direct) ───────── */

    masterTimeline.to(camera.position, {
        x: S[5].x,
        y: S[5].y,
        z: S[5].z,
        duration: 1,
        ease: "power1.inOut",
        onUpdate: () => camera.lookAt(0, 0, 0),
    });


    /* ───────── 6 → 1 (REVERSE OF 1 → 2) ───────── */

    // Step 1: Orbit/rotate at same distance (no zoom yet)

    const last = S[5];
    const first = S[0];

    const radiusLast = Math.sqrt(
        last.x * last.x +
        last.z * last.z
    );

    const angleStart = Math.atan2(last.x, last.z);
    const angleEnd = Math.atan2(first.x, first.z);

    const orbit = { a: angleStart };

    masterTimeline.to(orbit, {
        a: angleEnd,
        duration: 0.6,
        ease: "power2.inOut",
        onUpdate: () => {
            camera.position.x = radiusLast * Math.sin(orbit.a);
            camera.position.z = radiusLast * Math.cos(orbit.a);
            camera.position.y = last.y; // keep height same during rotation
            camera.lookAt(0, 0, 0);
        }
    });

    // Step 2: Smooth zoom in to Slide 1

    masterTimeline.to(camera.position, {
        x: first.x,
        y: first.y,
        z: first.z,
        duration: 0.6,
        ease: "power2.inOut",
        onUpdate: () => camera.lookAt(0, 0, 0),
    });

}



/* ───────── USER INTERACTION MODE ───────── */

renderer.domElement.addEventListener("pointerdown", () => {

    if (masterTimeline?.scrollTrigger)
        masterTimeline.scrollTrigger.disable();

    controls.enabled = true;
    clearTimeout(resumeTimeout);
});

controls.addEventListener("end", () => {

    resumeTimeout = setTimeout(() => {

        controls.enabled = false;

        if (masterTimeline?.scrollTrigger)
            masterTimeline.scrollTrigger.enable();

    }, 2000);
});

/* ───────── RENDER LOOP ───────── */
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();

/* ───────── RESIZE ───────── */
window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ───────── TEXT FADE SYSTEM ───────── */

/* ───────── STRICT TEXT SEQUENCING ───────── */

function setupStrictTextFade() {

    const sections = document.querySelectorAll(".section");
    const texts = document.querySelectorAll(".fade-text");

    let currentIndex = 0;
    let isAnimating = false;

    // Show first text initially
    gsap.to(texts[0], {
        opacity: 1,
        y: 0,
        duration: 0.8,
        ease: "power2.out"
    });

    sections.forEach((section, index) => {

        ScrollTrigger.create({
            trigger: section,
            start: "top center",
            onEnter: () => switchText(index),
            onEnterBack: () => switchText(index)
        });

    });

    function switchText(newIndex) {

        if (newIndex === currentIndex || isAnimating) return;

        isAnimating = true;

        const currentText = texts[currentIndex];
        const nextText = texts[newIndex];

        const tl = gsap.timeline({
            onComplete: () => {
                currentIndex = newIndex;
                isAnimating = false;
            }
        });

        // Fade OUT completely first
        tl.to(currentText, {
            opacity: 0,
            y: -30,
            duration: 0.5,
            ease: "power2.in"
        });

        // THEN fade IN next
        tl.to(nextText, {
            opacity: 1,
            y: 0,
            duration: 0.7,
            ease: "power2.out"
        });

    }

}
