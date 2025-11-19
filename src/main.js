import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

//Create Component Placeholders
function createLEDPlaceholder() {
    const geo = new THREE.SphereGeometry(0.15, 32, 32);
    const mat = new THREE.MeshStandardMaterial({ color: "red" });
    const led = new THREE.Mesh(geo, mat);

    led.userData = {
        type: "LED",
        pins: {
            anode: null,
            cathode: null
        }
    };

    led.position.set(0, 1, 0); // spawn in air, above board
    return led;
}

function createResistorPlaceholder() {
    const geo = new THREE.CylinderGeometry(0.05, 0.05, 0.4, 16);
    const mat = new THREE.MeshStandardMaterial({ color: "yellow" });
    const resistor = new THREE.Mesh(geo, mat);

    resistor.rotation.z = Math.PI / 2;

    resistor.userData = {
        type: "RESISTOR",
        pins: {
            pin1: null,
            pin2: null
        }
    };

    resistor.position.set(0, 1, 0); // spawn in air, above board
    return resistor;
}

// ----------------------
// Scene + Renderer
// ----------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x202020);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(5, 4, 6);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
renderer.domElement.style.cursor = 'pointer';

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Light
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2));

// ----------------------
// Globals
// ----------------------
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

let arduino = null;
let breadboard = null;

let arduinoPins = [];    // objects found from Arduino model
let breadboardPins = []; // objects found from Breadboard model
let allPins = [];        // combined list used for raycasting/logic

let hoveredPin = null;

let wireConnections = [];
let wireIdCounter = 0;

// COMPONENT TRACKING
let components = [];
let selectedComponent = null;
const MIN_COMPONENT_Y = 0.1; // Minimum Y position to keep components above Arduino board

// Wire system
let wireMode = false;
let firstPin = null;
let wires = [];         // array of THREE.Line
let selectedWire = null;

// UI elements
const pinLabel = document.getElementById("pinLabel");
const addWireBtn = document.getElementById("addWireBtn");
const wireColorPicker = document.getElementById("wireColorPicker");
const statusEl = document.getElementById("status");

// Status helpers
function setStatus(text) { statusEl.innerText = text; }

// ----------------------
// Wire mode toggle
// ----------------------
addWireBtn.addEventListener("click", () => {
    wireMode = !wireMode;
    addWireBtn.style.background = wireMode ? "#0066ff" : "#333";
    addWireBtn.textContent = wireMode ? "Wire Mode: ON" : "Add Wire";
    firstPin = null;
    console.log(wireMode)
});

// ----------------------
// Load models (Arduino + Breadboard)
// ----------------------
const loader = new GLTFLoader();
let loadedCount = 0;

function tryReady() {
    if (loadedCount < 2) {
        setStatus(`Loaded ${loadedCount}/2 models...`);
        return;
    }
    setStatus('Ready — Hover pins to see names. Add wires with button.');
    // combine pins
    allPins = [...arduinoPins, ...breadboardPins];
    console.log('ALL PINS COUNT:', allPins.length);
}

// Load Arduino
loader.load('/Arduino.glb',
    (gltf) => {
        arduino = gltf.scene;
        scene.add(arduino);
        detectArduinoPins(arduino);
        loadedCount++;
        tryReady();
    },
    undefined,
    (err) => {
        console.error('Error loading Arduino.glb', err);
        setStatus('Error loading Arduino.glb (check file name)');
    }
);

// Load Breadboard
loader.load('/Breadboard.glb',
    (gltf) => {
        breadboard = gltf.scene;
        scene.add(breadboard);
        detectBreadboardPins(breadboard);
        loadedCount++;
        tryReady();
    },
    undefined,
    (err) => {
        console.error('Error loading Breadboard.glb', err);
        setStatus('Error loading Breadboard.glb (check file name)');
    }
);

// ----------------------
// Detection heuristics
// ----------------------

// Arduino pins are expected to be named "Pin_*"
function detectArduinoPins(root) {
    root.traverse(obj => {
        if (obj.type === 'Object3D' && obj.name && obj.name.startsWith('Pin_')) {
            // attach invisible helper sphere (used for visuals if needed)
            attachHelper(obj);
            arduinoPins.push(obj);
            console.log(`ARDUINO PIN: ${obj.name}`);
        }
    });
    setStatus(prev => prev); // no-op to keep UI steady
}

// Breadboard detection: flexible heuristics to handle different naming schemes
function detectBreadboardPins(root) {
    const found = [];

    root.traverse(obj => {
        if (!(obj.type === 'Object3D' && obj.name && obj.name.length > 0)) return;

        const name = obj.name;

        // heuristic 1: explicit BB_ prefix (recommended)
        if (/^BB_/i.test(name) || /bread/i.test(name)) {
            attachHelper(obj);
            breadboardPins.push(obj);
            found.push({ obj, method: 'prefix_BB' });
            return;
        }

        // heuristic 2: single-letter column (A-J) + number  e.g. A1, B12, J63
        if (/^[A-J]\d{1,2}$/i.test(name)) {
            attachHelper(obj);
            breadboardPins.push(obj);
            found.push({ obj, method: 'colrow_simple' });
            return;
        }

        // heuristic 3: patterns like A_1, A-1, rowA1, colA1
        if (/[A-J][_-\s]?\d{1,2}/i.test(name) || /row[_\s]?\d+/i.test(name)) {
            attachHelper(obj);
            breadboardPins.push(obj);
            found.push({ obj, method: 'colrow_variant' });
            return;
        }

        // heuristic 4: rails or power names (pos, neg, plus, gnd)
        if (/\b(pos|neg|plus|gnd|vcc|5v|3v3|power|rail)\b/i.test(name)) {
            attachHelper(obj);
            breadboardPins.push(obj);
            found.push({ obj, method: 'rail_or_power' });
            return;
        }

        // else: do nothing for now
    });

    console.log('BB-DETECT: total detected breadboard pins:', breadboardPins.length, found.length);
    found.slice(0, 20).forEach(f => console.log('BB-DETECT:', f.obj.name, 'via', f.method));

    // attempt to build connectivity groups if we can parse A-J + row numbers
    buildBreadboardGroups();
}

// attach invisible helper sphere (so we always have a child mesh for coloring/highlight)
function attachHelper(obj) {
    // if it already has children, avoid duplicating helper
    if (obj.children && obj.children.some(c => c.userData && c.userData.__isPinHelper)) return;

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
    deselectComponent();

    // 3. If wire mode OFF → done
    if (!wireMode) return;

    // 4. If wire mode ON → check pin click
    const pinIntersect = raycaster.intersectObjects(pinObjects, true);
    if (!pinIntersect.length) return;

    const hitPin = pinHits[0].object.parent; // the empty
    if (!hitPin) return;

    // first pin select
    if (!firstPin) {
        firstPin = hitPin;
        // set helper to blue
        const h = firstPin.children.find(c=>c.userData && c.userData.__isPinHelper);
        if (h) h.material.color.set(0x00aaff);
        return;
    }

    // second pin -> create wire
    if (hitPin !== firstPin) {
        drawWire(firstPin, hitPin);
    }

    // reset first pin helper color
    const fh = firstPin.children.find(c=>c.userData && c.userData.__isPinHelper);
    if (fh) fh.material.color.set(0xffffff);
    firstPin = null;
});

// ----------------------
// Draw curved wire (TubeGeometry alternative: we use buffered line for speed, but tube can be used if desired)
// ----------------------
function drawWire(pin1, pin2) {
    const p1 = new THREE.Vector3();
    const p2 = new THREE.Vector3();
    pin1.getWorldPosition(p1);
    pin2.getWorldPosition(p2);

    // dynamic mid-point lift based on distance
    const dist = p1.distanceTo(p2);
    const mid = p1.clone().lerp(p2, 0.5);
    mid.y += Math.max(0.15, dist * 0.25); // lift more for long wires

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

// ----------------------
// Wire selection + deletion (Option A flow)
// ----------------------
function selectWire(line) {
    deselectWire();
    selectedWire = line;
    if (selectedWire && selectedWire.material) selectedWire.material.color.set(0xffffff);
}

function deselectWire() {
    if (!selectedWire) return;
    // revert color
    if (selectedWire.material && selectedWire.userData && selectedWire.userData.originalColor) {
        selectedWire.material.color.set(selectedWire.userData.originalColor);
    }
    selectedWire = null;
}

window.addEventListener('keydown', (e) => {
    if (e.key === "Delete" && selectedWire) {
        scene.remove(selectedWire);
        wires = wires.filter(w => w !== selectedWire);
        selectedWire = null;
    }
});

// ----------------------
// Render loop
// ----------------------
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();

// Component selection and highlighting
function highlightComponent(component, highlight) {
    if (!component) return;
    
    if (highlight) {
        // Store original emissive color
        if (!component.userData.originalEmissive) {
            component.userData.originalEmissive = component.material.emissive?.clone() || new THREE.Color(0x000000);
        }
        // Add emissive glow to show selection
        component.material.emissive = new THREE.Color(0x444444);
        component.material.emissiveIntensity = 0.5;
    } else {
        // Restore original emissive
        if (component.userData.originalEmissive) {
            component.material.emissive = component.userData.originalEmissive;
            component.material.emissiveIntensity = 0;
        }
    }
}

function deselectComponent() {
    if (selectedComponent) {
        highlightComponent(selectedComponent, false);
        selectedComponent = null;
    }
}

//Spawn Component
function spawnComponent(type) {
    let obj;

    if (type === "LED") obj = createLEDPlaceholder();
    if (type === "RESISTOR") obj = createResistorPlaceholder();

    if (obj) {
        scene.add(obj);
        components.push(obj);
        // Auto-select newly spawned component
        deselectComponent();
        selectedComponent = obj;
        highlightComponent(obj, true);
    }
}


// ----------------------
// Resize
// ----------------------
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ----------------------
// Helpful dev command: list detected pin names in console
// ----------------------
window.__debugListPins = function() {
    console.log('Arduino pins:', arduinoPins.map(p=>p.name));
    console.log('Breadboard pins:', breadboardPins.map(p=>p.name).slice(0,200));
    console.log('All pins count:', allPins.length);
};
