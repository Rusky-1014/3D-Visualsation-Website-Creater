import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

gsap.registerPlugin(ScrollTrigger);

/* SCENE */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07080d);

/* CAMERA */
const camera = new THREE.PerspectiveCamera(
    55,
    window.innerWidth / window.innerHeight,
    0.1,
    200
);

camera.position.set(0, 3.5, 18);

/* RENDERER */
const renderer = new THREE.WebGLRenderer({
    antialias: true
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

/* LIGHTING */
scene.add(new THREE.AmbientLight(0xffffff, 0.4));

const keyLight = new THREE.DirectionalLight(0xffffff, 2);
keyLight.position.set(4, 6, 5);
scene.add(keyLight);

/* CONTROLS */
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.enableZoom = true;
controls.minDistance = 8;
controls.maxDistance = 30;

/* MODEL */
let visionModel;

function centerModel(object) {
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    object.position.sub(center);
}

const loader = new GLTFLoader();

loader.load(
    "/static/models/apple_vision_pro.glb",
    (gltf) => {

        visionModel = gltf.scene;
        centerModel(visionModel);
        visionModel.scale.set(18, 18, 18);

        scene.add(visionModel);

        /* SCROLL ROTATION */
        ScrollTrigger.create({
            trigger: ".container",
            start: "top top",
            end: "bottom bottom",
            scrub: 1,
            onUpdate: (self) => {
                visionModel.rotation.y = self.progress * Math.PI * 2;
            }
        });
    }
);

/* LOOP */
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

animate();

/* RESIZE */
window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
