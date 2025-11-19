import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// SCENE SETUP
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x202020);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(5, 4, 6);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// CONTROLS
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// LIGHT
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2));

// RAYCASTER
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

let arduino = null;
let pinObjects = [];
let hoveredPin = null;

// WIRE SYSTEM
let wireMode = false;
let firstPin = null;
let wires = [];
let selectedWire = null;

// HTML
const pinLabel = document.getElementById("pinLabel");
const addWireBtn = document.getElementById("addWireBtn");
const wireColorPicker = document.getElementById("wireColorPicker");

// TOGGLE WIRE MODE
addWireBtn.addEventListener("click", () => {
    wireMode = !wireMode;
    addWireBtn.style.background = wireMode ? "#0066ff" : "#333";
    addWireBtn.textContent = wireMode ? "Wire Mode: ON" : "Add Wire";
    firstPin = null;
});

// LOAD MODEL
const loader = new GLTFLoader();
loader.load('/Arduino.glb', (gltf) => {
    arduino = gltf.scene;
    scene.add(arduino);

    // Attach invisible helper sphere for every pin
    arduino.traverse((obj) => {
        if (obj.type === "Object3D" && obj.name.startsWith("Pin_")) {
            obj.userData.isPin = true;

            const helper = new THREE.Mesh(
                new THREE.SphereGeometry(0.03),
                new THREE.MeshBasicMaterial({ visible: false })
            );
            obj.add(helper);

            pinObjects.push(obj);
        }
    });

    console.log("Loaded pins:", pinObjects.map(p => p.name));
});

// HOVER PIN
window.addEventListener('pointermove', (e) => {
    mouse.x = (e.clientX / innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    // If wire mode is off, still highlight pins
    const intersect = raycaster.intersectObjects(pinObjects, true);

    if (!intersect.length) {
        if (hoveredPin) hoveredPin.children[0].material.color.set(0xffffff);
        hoveredPin = null;
        pinLabel.style.display = "none";
        return;
    }

    const pin = intersect[0].object.parent;

    if (hoveredPin !== pin) {
        if (hoveredPin) hoveredPin.children[0].material.color.set(0xffffff);
        pin.children[0].material.color.set(0xffff00);
    }

    hoveredPin = pin;
    pinLabel.style.display = "block";
    pinLabel.style.left = e.clientX + 15 + "px";
    pinLabel.style.top = e.clientY + 15 + "px";
    pinLabel.innerHTML = pin.name;
});

// CLICK HANDLER (pin / wire selection)
window.addEventListener('pointerdown', () => {
    raycaster.setFromCamera(mouse, camera);

    // 1. Check if clicked on a wire
    const wireIntersects = raycaster.intersectObjects(wires, true);

    if (wireIntersects.length > 0) {
        selectWire(wireIntersects[0].object);
        return;
    }

    // 2. If clicked empty, deselect wire
    deselectWire();

    // 3. If wire mode OFF → done
    if (!wireMode) return;

    // 4. If wire mode ON → check pin click
    const pinIntersect = raycaster.intersectObjects(pinObjects, true);
    if (!pinIntersect.length) return;

    const pin = pinIntersect[0].object.parent;

    // FIRST PIN
    if (!firstPin) {
        firstPin = pin;
        pin.children[0].material.color.set(0x00aaff);
        return;
    }

    // SECOND PIN
    if (pin !== firstPin) {
        drawWire(firstPin, pin);
    }

    firstPin.children[0].material.color.set(0xffffff);
    firstPin = null;
});

// DRAW CURVED WIRE
function drawWire(pin1, pin2) {
    const p1 = new THREE.Vector3();
    const p2 = new THREE.Vector3();
    pin1.getWorldPosition(p1);
    pin2.getWorldPosition(p2);

    const mid = p1.clone().lerp(p2, 0.5);
    mid.y += 0.3;

    const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2);
    const points = curve.getPoints(80);

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
        color: parseInt(wireColorPicker.value),
        linewidth: 10
    });

    const wire = new THREE.Line(geometry, material);

    wire.userData.isWire = true;

    scene.add(wire);
    wires.push(wire);
}

// WIRE SELECTION
function selectWire(wire) {
    deselectWire();

    selectedWire = wire;
    wire.material.color.set(0xffffff); // highlight white
}

// DESELECT
function deselectWire() {
    if (!selectedWire) return;

    // Revert to original color
    selectedWire.material.color.set(selectedWire.userData.originalColor || 0xff0000);
    selectedWire = null;
}

// DELETE WITH KEYBOARD
window.addEventListener('keydown', (e) => {
    if (e.key === "Delete" && selectedWire) {
        scene.remove(selectedWire);
        wires = wires.filter(w => w !== selectedWire);
        selectedWire = null;
    }
});

// LOOP
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();

// RESIZE
window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
});
