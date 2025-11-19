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

// SCENE SETUP
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x202020);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(5, 4, 6);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
renderer.domElement.style.cursor = 'pointer';

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

let wireConnections = [];
let wireIdCounter = 0;

// COMPONENT TRACKING
let components = [];
let selectedComponent = null;
const MIN_COMPONENT_Y = 0.1; // Minimum Y position to keep components above Arduino board

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
    console.log(wireMode)
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

            // Add outline ring for hover effect
            const outlineGeometry = new THREE.TorusGeometry(0.06, 0.015, 8, 16);
            const outlineMaterial = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                visible: false,
                transparent: true,
                opacity: 0.9
            });
            const outline = new THREE.Mesh(outlineGeometry, outlineMaterial);
            outline.rotation.x = Math.PI / 2; // Rotate to be perpendicular to pin
            obj.add(outline);

            pinObjects.push(obj);
        }
    });

    console.log("Loaded pins:", pinObjects.map(p => p.name));
});

// HOVER PIN and DRAG COMPONENT
window.addEventListener('pointermove', (e) => {
    updateMouse(e);
    raycaster.setFromCamera(mouse, camera);

    // Handle component dragging
    if (draggingComponent && !wireMode) {
        const hit = raycaster.ray.intersectPlane(plane, planeIntersect);
        if (hit) {
            const newPos = hit.clone().add(offset);
            // Ensure component stays above Arduino board
            if (newPos.y < MIN_COMPONENT_Y) {
                newPos.y = MIN_COMPONENT_Y;
            }
            draggingComponent.position.copy(newPos);
        }
    }

    // Handle pin hovering (only if not dragging)
    if (!draggingComponent) {
        const intersect = raycaster.intersectObjects(pinObjects, true);

        if (!intersect.length) {
            if (hoveredPin) {
                hoveredPin.children[0].material.color.set(0xffffff);
                // Hide outline
                if (hoveredPin.children[1]) {
                    hoveredPin.children[1].material.visible = false;
                }
            }
            hoveredPin = null;
            pinLabel.style.display = "none";
            return;
        }

        const pin = intersect[0].object.parent;

        if (hoveredPin !== pin) {
            if (hoveredPin) {
                hoveredPin.children[0].material.color.set(0xffffff);
                // Hide previous pin outline
                if (hoveredPin.children[1]) {
                    hoveredPin.children[1].material.visible = false;
                }
            }
            pin.children[0].material.color.set(0xffff00);
            // Show outline for new hovered pin
            if (pin.children[1]) {
                pin.children[1].material.visible = true;
            }
        }

        hoveredPin = pin;
        pinLabel.style.display = "block";
        pinLabel.style.left = e.clientX + 15 + "px";
        pinLabel.style.top = e.clientY + 15 + "px";
        pinLabel.innerHTML = pin.name;
    }
});

// CLICK HANDLER (pin / wire selection / component dragging)
window.addEventListener('pointerdown', (e) => {
    updateMouse(e);
    raycaster.setFromCamera(mouse, camera);

    // 1. Check if clicked on a component (when not in wire mode)
    if (!wireMode) {
        const compHit = raycaster.intersectObjects(components, true)
            .find(x => x.object.userData?.type);
        
        if (compHit) {
            // Select component for deletion and start dragging
            deselectComponent();
            selectedComponent = compHit.object;
            draggingComponent = compHit.object;
            highlightComponent(selectedComponent, true);
            
            // Disable OrbitControls to prevent Arduino from moving
            controls.enabled = false;
            
            // Setup dragging plane
            plane.setFromNormalAndCoplanarPoint(
                camera.getWorldDirection(new THREE.Vector3()).clone().negate(),
                draggingComponent.position
            );
            planeIntersect.copy(compHit.point);
            offset.copy(draggingComponent.position).sub(planeIntersect);
            return;
        }
    }

    // 2. Check if clicked on a wire
    const wireIntersects = raycaster.intersectObjects(wires, true);

    if (wireIntersects.length > 0) {
        selectWire(wireIntersects[0].object);
        deselectComponent();
        return;
    }

    // 3. If clicked empty, deselect wire and component
    deselectWire();
    deselectComponent();

    // 4. If wire mode OFF → done
    if (!wireMode) return;

    // 5. If wire mode ON → check pin click
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
    const color = parseInt(wireColorPicker.value);

    const material = new THREE.LineBasicMaterial({
        color: color,
        linewidth: 10
    });

    const wire = new THREE.Line(geometry, material);

    const wireId = wireIdCounter++;

    wire.userData = {
        id: wireId,
        isWire: true,
        fromPin: pin1.name,
        toPin: pin2.name,
        color: color
    };

    scene.add(wire);
    wires.push(wire);

    wireConnections.push({
        id: wireId,
        from: pin1.name,
        to: pin2.name,
        color: color
    });

    console.log("CONNECTION MAP:", wireConnections);
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
    if (e.key === "Delete") {
        // Delete selected wire
        if (selectedWire) {
            const id = selectedWire.userData.id;
        
            wireConnections = wireConnections.filter(w => w.id !== id);
            wires = wires.filter(w => w.userData.id !== id);
        
            scene.remove(selectedWire);
            selectedWire = null;
        
            console.log("UPDATED CONNECTION MAP:", wireConnections);
        }
        
        // Delete selected component
        if (selectedComponent) {
            // Remove any wires connected to this component's pins
            const componentPins = Object.keys(selectedComponent.userData.pins || {});
            wires = wires.filter(wire => {
                const fromPin = wire.userData.fromPin;
                const toPin = wire.userData.toPin;
                const shouldKeep = !componentPins.some(pin => 
                    fromPin.includes(pin) || toPin.includes(pin)
                );
                if (!shouldKeep) {
                    scene.remove(wire);
                    wireConnections = wireConnections.filter(w => w.id !== wire.userData.id);
                }
                return shouldKeep;
            });
            
            // Remove component from tracking array
            components = components.filter(c => c !== selectedComponent);
            
            // Remove from scene
            scene.remove(selectedComponent);
            selectedComponent = null;
            
            console.log("Component deleted");
        }
    }
});



document.querySelectorAll(".spawn").forEach(btn => {
    btn.addEventListener("click", () => {
        spawnComponent(btn.dataset.type);
        console.log("Spawning:", btn.dataset.type);
    });
});


//Drag and Drop
let draggingComponent = null;
let offset = new THREE.Vector3();
let plane = new THREE.Plane();
let planeIntersect = new THREE.Vector3();

window.addEventListener("pointerup", () => {
    if (draggingComponent) {
        snapToNearestPin(draggingComponent);
        // Keep selectedComponent selected for potential deletion
        draggingComponent = null;
    }
    // Always re-enable OrbitControls when pointer is released
    if (!controls.enabled) {
        controls.enabled = true;
    }
});

//Snap to Nearest Pin
function snapToNearestPin(component) {
    let compPos = new THREE.Vector3();
    component.getWorldPosition(compPos);

    let nearest = null;
    let nearestDist = Infinity;

    pinObjects.forEach(pin => {
        let pinPos = new THREE.Vector3();
        pin.getWorldPosition(pinPos);

        const dist = compPos.distanceTo(pinPos);
        if (dist < nearestDist && dist < 0.3) { // snap radius
            nearest = pin;
            nearestDist = dist;
        }
    });

    if (!nearest) return;

    // Snap to pin position but ensure it stays above the board
    const snapPos = nearest.position.clone();
    if (snapPos.y < MIN_COMPONENT_Y) {
        snapPos.y = MIN_COMPONENT_Y;
    }
    component.position.copy(snapPos);
    component.userData.snappedPin = nearest.name;

    console.log(component.userData.type, "snapped to", nearest.name);
}

//Update Mouse
function updateMouse(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}



// LOOP
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


// RESIZE
window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
});
