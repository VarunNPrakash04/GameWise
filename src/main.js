import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

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
        new THREE.MeshBasicMaterial({ visible: false, color: 0xffffff })
    );
    helper.userData.__isPinHelper = true;
    obj.add(helper);
}

// ----------------------
// Attempt to build breadboard groups
// ----------------------
const breadboardGroups = {}; // e.g. { 'row_1_left': ['BB_A1',...], ... }

function buildBreadboardGroups() {
    // try to parse names that look like ColumnLetter+RowNumber
    const parsed = [];

    for (const obj of breadboardPins) {
        const n = obj.name.trim();
        // try to find column letter and row number in the name
        const m = n.match(/([A-J])\s*[_-]?\s*(\d{1,2})/i) || n.match(/([A-J])(\d{1,2})/i);
        if (m) {
            const col = m[1].toUpperCase();
            const row = parseInt(m[2], 10);
            parsed.push({ obj, col, row, name: n });
        }
    }

    if (parsed.length === 0) {
        console.warn('BB-GROUPS: Could not auto-parse breadboard pin names. Provide example names if you want custom mapping.');
        return;
    }

    // build map row -> { left: [A-E], right: [F-J] }
    const rows = new Map();
    parsed.forEach(p => {
        if (!rows.has(p.row)) rows.set(p.row, []);
        rows.get(p.row).push(p);
    });

    rows.forEach((arr, rowNumber) => {
        // left group (A-E)
        const left = arr.filter(x => ['A','B','C','D','E'].includes(x.col)).sort((a,b)=> a.col.localeCompare(b.col)).map(x=>x.obj.name);
        const right = arr.filter(x => ['F','G','H','I','J'].includes(x.col)).sort((a,b)=> a.col.localeCompare(b.col)).map(x=>x.obj.name);

        if (left.length) breadboardGroups[`row_${rowNumber}_left`] = left;
        if (right.length) breadboardGroups[`row_${rowNumber}_right`] = right;
    });

    console.log('BB-GROUPS created for rows:', Object.keys(breadboardGroups).length);
    // sample log for dev
    const sampleKeys = Object.keys(breadboardGroups).slice(0,6);
    sampleKeys.forEach(k => console.log('BB-GROUPS sample:', k, breadboardGroups[k].slice(0,5)));
}

// ----------------------
// Hover detection (works for both Arduino + Breadboard)
// ----------------------
window.addEventListener('pointermove', (e) => {
    // update mouse
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

    // raycast against combined list if ready, otherwise only pins we have
    const targetList = (allPins && allPins.length) ? allPins : [...arduinoPins, ...breadboardPins];

    if (!targetList.length) return;

    raycaster.setFromCamera(mouse, camera);
    const intersect = raycaster.intersectObjects(targetList, true);

    if (!intersect.length) {
        if (hoveredPin) {
            // reset helper color if exists
            const h = hoveredPin.children.find(c=>c.userData && c.userData.__isPinHelper);
            if (h) h.material.color.set(0xffffff);
        }
        hoveredPin = null;
        pinLabel.style.display = 'none';
        return;
    }

    const pinObject = intersect[0].object.parent; // our helper is child of the empty, so parent is empty
    if (!pinObject) return;

    // if new hovered, reset old
    if (hoveredPin && hoveredPin !== pinObject) {
        const oldH = hoveredPin.children.find(c=>c.userData && c.userData.__isPinHelper);
        if (oldH) oldH.material.color.set(0xffffff);
    }

    hoveredPin = pinObject;

    // highlight helper if present (yellow)
    const helperMesh = hoveredPin.children.find(c=>c.userData && c.userData.__isPinHelper);
    if (helperMesh) helperMesh.material.color.set(0xffff00);

    // show label
    pinLabel.style.display = 'block';
    pinLabel.style.left = e.clientX + 15 + 'px';
    pinLabel.style.top = e.clientY + 15 + 'px';
    pinLabel.innerText = hoveredPin.name || '(unnamed pin)';
});

// ----------------------
// Click handler: select wires / create wires
// ----------------------
window.addEventListener('pointerdown', () => {
    // raycast for wires first
    raycaster.setFromCamera(mouse, camera);

    // try picking wires
    if (wires.length) {
        const wireHits = raycaster.intersectObjects(wires, true);
        if (wireHits.length) {
            selectWire(wireHits[0].object);
            return;
        }
    }

    // else deselect wire if clicked empty space
    deselectWire();

    // if not in wire mode, return
    if (!wireMode) return;

    // ensure allPins is ready
    const targetList = (allPins && allPins.length) ? allPins : [...arduinoPins, ...breadboardPins];
    if (!targetList.length) return;

    const pinHits = raycaster.intersectObjects(targetList, true);
    if (!pinHits.length) return;

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

    const color = parseInt(wireColorPicker.value);

    // use Line for now (fast); you can swap to TubeGeometry if you want 3D thick wires (more perf cost)
    const material = new THREE.LineBasicMaterial({ color: color, linewidth: 2 });
    const line = new THREE.Line(geometry, material);

    // store original color so deletion/deselection can revert
    line.userData.originalColor = color;
    line.userData.isWire = true;
    line.userData.endpoints = [pin1.name || null, pin2.name || null];

    scene.add(line);
    wires.push(line);

    console.log(`Wire created: ${pin1.name} ↔ ${pin2.name}`);
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
    if (e.key === 'Delete' && selectedWire) {
        scene.remove(selectedWire);
        wires = wires.filter(w => w !== selectedWire);
        selectedWire = null;
    }
    if (e.key === 'Escape') {
        // cancel wire mode / selection
        wireMode = false;
        addWireBtn.style.background = '#333';
        addWireBtn.textContent = 'Add Wire';
        if (firstPin) {
            const h = firstPin.children.find(c=>c.userData && c.userData.__isPinHelper);
            if (h) h.material.color.set(0xffffff);
        }
        firstPin = null;
        deselectWire();
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
