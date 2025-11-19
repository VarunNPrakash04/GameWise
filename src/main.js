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
scene.background = new THREE.Color(0x303030); // Brighter background
scene.fog = new THREE.Fog(0x303030, 10, 50); // Subtle fog for depth

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(5, 4, 6);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.5;
document.body.appendChild(renderer.domElement);
renderer.domElement.style.cursor = 'pointer';

// CONTROLS
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// LIGHTING SETUP
// Ambient light for base illumination
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

// Hemisphere light for natural sky/ground lighting
const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
scene.add(hemisphereLight);

// Sunlight (directional light) with shadows
const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
sunLight.position.set(5, 10, 5);
sunLight.castShadow = true;

// Shadow map settings for better quality
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 50;
sunLight.shadow.camera.left = -10;
sunLight.shadow.camera.right = 10;
sunLight.shadow.camera.top = 10;
sunLight.shadow.camera.bottom = -10;
sunLight.shadow.bias = -0.0001;
sunLight.shadow.radius = 4;
scene.add(sunLight);

// Additional fill light for realism
const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
fillLight.position.set(-5, 5, -5);
scene.add(fillLight);

// Additional top light to brighten pins
const topLight = new THREE.DirectionalLight(0xffffff, 0.7);
topLight.position.set(0, 15, 0);
topLight.castShadow = false;
scene.add(topLight);

// GROUND PLANE with grid texture
function createGridTexture(size = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    
    // Fill with dark background
    context.fillStyle = '#252525';
    context.fillRect(0, 0, size, size);
    
    // Draw grid lines
    context.strokeStyle = '#404040';
    context.lineWidth = 1;
    
    const gridSize = 32;
    for (let i = 0; i <= size; i += gridSize) {
        context.beginPath();
        context.moveTo(i, 0);
        context.lineTo(i, size);
        context.stroke();
        
        context.beginPath();
        context.moveTo(0, i);
        context.lineTo(size, i);
        context.stroke();
    }
    
    // Add brighter center lines
    context.strokeStyle = '#505050';
    context.lineWidth = 1;
    const center = size / 2;
    context.beginPath();
    context.moveTo(center, 0);
    context.lineTo(center, size);
    context.stroke();
    context.beginPath();
    context.moveTo(0, center);
    context.lineTo(size, center);
    context.stroke();
    
    return new THREE.CanvasTexture(canvas);
}

const groundGeometry = new THREE.PlaneGeometry(20, 20);
const gridTexture = createGridTexture(512);
gridTexture.wrapS = THREE.RepeatWrapping;
gridTexture.wrapT = THREE.RepeatWrapping;
gridTexture.repeat.set(10, 10);

const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x2a2a2a,
    map: gridTexture,
    roughness: 0.8,
    metalness: 0.1
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -2;
ground.receiveShadow = true;
scene.add(ground);

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
    
    // Make materials glossy and enable shadows for all meshes
    arduino.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
            obj.castShadow = true;
            obj.receiveShadow = true;
            
            // Update material to be more glossy/realistic
            if (obj.material) {
                // Handle multi-material case
                const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
                
                obj.material = materials.map((oldMat) => {
                    // Convert to MeshStandardMaterial if it's not already
                    if (!oldMat.isMeshStandardMaterial) {
                        return new THREE.MeshStandardMaterial({
                            color: oldMat.color || 0xffffff,
                            map: oldMat.map || null,
                            normalMap: oldMat.normalMap || null,
                            roughness: 0.3, // Lower roughness = more glossy
                            metalness: 0.7, // Higher metalness = more metallic/shiny
                            envMapIntensity: 1.0
                        });
                    } else {
                        // If already StandardMaterial, just update properties
                        oldMat.roughness = Math.min(oldMat.roughness || 0.5, 0.4);
                        oldMat.metalness = Math.max(oldMat.metalness || 0.5, 0.6);
                        oldMat.needsUpdate = true;
                        return oldMat;
                    }
                });
                
                // If single material, unwrap from array
                if (obj.material.length === 1) {
                    obj.material = obj.material[0];
                }
            }
        }
    });
    
    scene.add(arduino);

    // Attach invisible helper sphere for every pin and enhance pin visibility
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

            // Make pin meshes brighter and more distinct with visual separators
            obj.traverse((child) => {
                if (child instanceof THREE.Mesh && child !== helper && child !== outline) {
                    // Make pins brighter
                    if (child.material) {
                        const materials = Array.isArray(child.material) ? child.material : [child.material];
                        
                        materials.forEach((mat) => {
                            if (mat.isMeshStandardMaterial || mat.isMeshPhongMaterial || mat.isMeshLambertMaterial) {
                                // Force color to grey
                                mat.color.setHex(0x808080); // Grey color
                                
                                // Add emissive glow to make pins stand out more
                                mat.emissive = new THREE.Color(0x666666);
                                mat.emissiveIntensity = 0.8;
                                
                                // Make pins more glossy
                                if (mat.roughness !== undefined) {
                                    mat.roughness = Math.max(mat.roughness * 0.6, 0.2);
                                }
                                
                                mat.needsUpdate = true;
                            }
                        });
                    }
                    
                    // Add white border around each pin using outline mesh technique
                    try {
                        // Get world position and rotation for proper placement
                        const worldPos = new THREE.Vector3();
                        const worldQuat = new THREE.Quaternion();
                        const worldScale = new THREE.Vector3();
                        child.getWorldPosition(worldPos);
                        child.getWorldQuaternion(worldQuat);
                        child.getWorldScale(worldScale);
                        
                        // Create white outline mesh
                        const outlineGeometry = child.geometry.clone();
                        const outlineMaterial = new THREE.MeshBasicMaterial({
                            color: 0xffffff,
                            side: THREE.DoubleSide
                        });
                        const outlineMesh = new THREE.Mesh(outlineGeometry, outlineMaterial);
                        
                        // Scale up to create visible white border
                        outlineMesh.scale.copy(worldScale).multiplyScalar(1.2);
                        
                        // Set world position and rotation
                        outlineMesh.position.copy(worldPos);
                        outlineMesh.quaternion.copy(worldQuat);
                        
                        // Add directly to scene (or arduino if available)
                        if (arduino && arduino.parent === scene) {
                            scene.add(outlineMesh);
                        } else {
                            child.parent.add(outlineMesh);
                        }
                        
                        // Render behind the pin
                        outlineMesh.renderOrder = -100;
                        
                        child.userData.outlineMesh = outlineMesh;
                    } catch (e) {
                        console.log("Outline creation failed:", e);
                    }
                    
                    try {
                        // Add white edge lines for border visibility (these definitely work)
                        const edges = new THREE.EdgesGeometry(child.geometry);
                        const edgeMaterial = new THREE.LineBasicMaterial({
                            color: 0xffffff,
                            depthTest: true,
                            depthWrite: true
                        });
                        const edgeLines = new THREE.LineSegments(edges, edgeMaterial);
                        edgeLines.renderOrder = 999; // Render on top
                        child.add(edgeLines);
                        child.userData.edgeLines = edgeLines;
                    } catch (e) {
                        // Skip if edges fail
                    }
                }
            });

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
