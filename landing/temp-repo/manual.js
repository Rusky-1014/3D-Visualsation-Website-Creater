import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

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

camera.position.set(0, 3.5, 16);

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

/* ───────── LIGHTING (same aesthetic) ───────── */
scene.add(new THREE.AmbientLight(0xffffff, 0.4));

const keyLight = new THREE.DirectionalLight(0xfff4e0, 2.8);
keyLight.position.set(4, 6, 5);
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
controls.enablePan = true;
controls.minDistance = 8;
controls.maxDistance = 25;

/* ───────── MODEL LOADING ───────── */
let model;

function centerModel(object) {
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    object.position.sub(center);
}

const loader = new GLTFLoader();

loader.load(
    "model/apple_vision_pro.glb",
    (gltf) => {
        model = gltf.scene;

        centerModel(model);
        model.scale.set(18, 18, 18);

        model.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        scene.add(model);
    },
    undefined,
    (err) => console.error("Model load error:", err)
);

/* ───────── LIVE DATA PANEL ───────── */
const posX = document.getElementById("posX");
const posY = document.getElementById("posY");
const posZ = document.getElementById("posZ");

const rotX = document.getElementById("rotX");
const rotY = document.getElementById("rotY");
const rotZ = document.getElementById("rotZ");

const camDist = document.getElementById("camDist");

/* ───────── RENDER LOOP ───────── */
function animate() {
    requestAnimationFrame(animate);

    controls.update();

    if (model) {

        // CAMERA position (because OrbitControls moves camera)
        posX.textContent = camera.position.x.toFixed(2);
        posY.textContent = camera.position.y.toFixed(2);
        posZ.textContent = camera.position.z.toFixed(2);

        // MODEL rotation (this changes when user rotates)
        rotX.textContent = model.rotation.x.toFixed(2);
        rotY.textContent = model.rotation.y.toFixed(2);
        rotZ.textContent = model.rotation.z.toFixed(2);

        camDist.textContent = controls.getDistance().toFixed(2);
    }


    renderer.render(scene, camera);
}

animate();

/* ───────── RESIZE ───────── */
window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
