import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { initArduinoIDE, toggleIDE, getEditorInstance } from './arduinoIDE.js';
import { initShuffle } from './Shuffle.js';
import { initMenuBar, setProjectName } from './menuBar.js';

import {
    createBreadboardIcon,
    startIconDrag,
    stopIconDrag,
    updateMouseRotation,
    isIconDragging,
    getIcon,
    removeBreadboardIcon
} from './breadboardRotation.js';
import {
    startLEDRotation,
    stopLEDRotation,
    updateLEDMouseRotation,
    isLEDRotating,
    getSelectedLED
} from './ledRotation.js';
import { createRoomBackground } from './roomBackground.js';

// SPLASH SCREEN HANDLING
const splashScreen = document.getElementById('splashScreen');
const mainContent = document.getElementById('mainContent');
const gameWiseText = document.getElementById('gameWiseText');
let splashTimeout = null;
let splashSkipped = false;
let shuffleInstance = null;

function hideSplash() {
    if (splashSkipped) return;
    splashSkipped = true;

    // Clear timeout if still running
    if (splashTimeout) {
        clearTimeout(splashTimeout);
        splashTimeout = null;
    }

    // Teardown shuffle animation if running
    if (shuffleInstance) {
        shuffleInstance.teardown();
        shuffleInstance = null;
    }

    // Hide splash screen
    splashScreen.classList.add('hidden');

    // Show main content
    setTimeout(() => {
        mainContent.classList.add('visible');
    }, 100);
}

// Initialize Shuffle animation
function initSplashAnimation() {
    if (!gameWiseText) return;

    // Wait for fonts to load
    const fontsLoaded = 'fonts' in document
        ? document.fonts.status === 'loaded'
        : true;

    const loadFonts = () => {
        if ('fonts' in document) {
            if (document.fonts.status === 'loaded') {
                startShuffle();
            } else {
                document.fonts.ready.then(() => {
                    startShuffle();
                });
            }
        } else {
            startShuffle();
        }
    };

    const startShuffle = () => {
        shuffleInstance = initShuffle(gameWiseText, {
            shuffleDirection: 'left',
            duration: 0.5,
            animationMode: 'evenodd',
            shuffleTimes: 2,
            ease: 'power3.out',
            stagger: 0.05,
            respectReducedMotion: true,
            onShuffleComplete: () => {
                // Mark as ready after shuffle completes
                gameWiseText.classList.add('is-ready');

                // Start fade out animation after shuffle completes
                setTimeout(() => {
                    const gameWiseContainer = document.getElementById('gameWiseContainer');
                    if (gameWiseContainer) {
                        gameWiseContainer.classList.add('fading');
                    }
                    if (splashScreen) {
                        splashScreen.classList.add('fading');
                    }

                    // Hide splash screen after fade completes
                    setTimeout(() => {
                        hideSplash();
                    }, 1000); // Match transition duration
                }, 500); // Small delay after shuffle completes
            }
        });
    };

    loadFonts();
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSplashAnimation);
} else {
    initSplashAnimation();
}

// Skip on click anywhere
splashScreen.addEventListener('click', () => {
    hideSplash();
});

// Skip on Enter key
window.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !splashSkipped) {
        hideSplash();
    }
});

// Auto-hide after 5 seconds
splashTimeout = setTimeout(() => {
    hideSplash();
}, 5000);

//Create Component Placeholders
function createLEDPlaceholder() {
    // Load LED 3D model
    const ledLoader = new GLTFLoader();
    const led = new THREE.Group();

    // Set userData immediately so it can be identified
    led.userData = {
        type: "LED",
        pins: {
            anode: null,
            cathode: null
        }
    };

    led.position.set(0, 1, 0);

    // Add invisible helpers for connection points (matching previous leg positions)
    // This ensures we have named objects 'anode' and 'cathode' if needed for logic
    const helperGeo = new THREE.BoxGeometry(0.02, 0.02, 0.02);
    const helperMat = new THREE.MeshBasicMaterial({ visible: false });

    const anodeHelper = new THREE.Mesh(helperGeo, helperMat);
    anodeHelper.position.set(-0.1, -0.25, 0);
    anodeHelper.name = 'anode';
    led.add(anodeHelper);

    const cathodeHelper = new THREE.Mesh(helperGeo, helperMat);
    cathodeHelper.position.set(0.1, -0.25, 0);
    cathodeHelper.name = 'cathode';
    led.add(cathodeHelper);

    // Load the model asynchronously
    ledLoader.load('/LED.glb', (gltf) => {
        const ledModel = gltf.scene;

        // Apply material settings for Material Preview mode
        ledModel.traverse((child) => {
            if (child instanceof THREE.Mesh && child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                child.material = materials.map((mat) => {
                    if (mat.isMeshStandardMaterial) {
                        mat.roughness = 0.4;
                        mat.metalness = 0.3;
                        mat.envMapIntensity = 1.0;
                        mat.needsUpdate = true;
                    }
                    return mat;
                });
                if (child.material.length === 1) {
                    child.material = child.material[0];
                }
            }
        });

        // SCALE DOWN THE MODEL HERE
        ledModel.scale.set(0.1, 0.1, 0.1);

        led.add(ledModel);

        console.log("LED model loaded (use R key to rotate)");
    }, undefined, (error) => {
        console.error("Error loading LED model:", error);
        // Fallback: create simple placeholder if model fails to load
        const geo = new THREE.SphereGeometry(0.15, 32, 32);
        const mat = new THREE.MeshStandardMaterial({ color: "red" });
        const fallback = new THREE.Mesh(geo, mat);
        led.add(fallback);
    });

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

// CREATE BUTTON FROM GLB MODEL
function createButtonPlaceholder() {
    const group = new THREE.Group();
    group.userData.type = "BUTTON";
    group.position.set(0, 0.3, 0);

    // Load the actual Button.glb model
    const buttonLoader = new GLTFLoader();
    buttonLoader.load('/Button.glb', (gltf) => {
        const buttonModel = gltf.scene;

        // Scale down the button to appropriate size
        buttonModel.scale.set(0.2, 0.2, 0.2);

        // Apply materials for Material Preview mode
        buttonModel.traverse((child) => {
            if (child instanceof THREE.Mesh && child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                child.material = materials.map((mat) => {
                    // Convert to MeshStandardMaterial for consistent behavior
                    if (!mat.isMeshStandardMaterial) {
                        const newMat = new THREE.MeshStandardMaterial({
                            color: mat.color || 0xffffff,
                            map: mat.map || null,
                            roughness: 0.4,
                            metalness: 0.5,
                            envMapIntensity: 1
                        });
                        return newMat;
                    } else {
                        mat.roughness = 0.4;
                        mat.metalness = 0.5;
                        mat.envMapIntensity = 1;
                        mat.needsUpdate = true;
                        return mat;
                    }
                });
                if (child.material.length === 1) {
                    child.material = child.material[0];
                }
            }
        });

        // Find button legs/pins in the model and mark them
        buttonModel.traverse((obj) => {
            // Adjust this condition based on how the pins are named in your Button.glb file
            // Common naming patterns: "leg", "pin", "terminal", etc.
            if (obj.name && (obj.name.toLowerCase().includes('leg') ||
                obj.name.toLowerCase().includes('pin') ||
                obj.name.toLowerCase().includes('terminal'))) {
                obj.userData.isPin = true;

                // Add invisible helper for raycasting
                const helper = new THREE.Mesh(
                    new THREE.SphereGeometry(0.04),
                    new THREE.MeshBasicMaterial({ visible: false })
                );
                obj.add(helper);

                // Add outline ring (hidden by default)
                const ringGeo = new THREE.TorusGeometry(0.05, 0.01, 8, 16);
                const ringMat = new THREE.MeshBasicMaterial({
                    color: 0x000000,
                    visible: false,
                    transparent: true
                });
                const ring = new THREE.Mesh(ringGeo, ringMat);
                ring.rotation.x = Math.PI / 2;
                obj.add(ring);

                // Store pin reference
                if (!group.userData.pins) {
                    group.userData.pins = {};
                }
                group.userData.pins[obj.name] = obj;
            }
        });

        // Mark the button model itself with the type so raycasting works on child meshes
        buttonModel.userData.type = "BUTTON";
        buttonModel.userData.isComponent = true;

        // Also mark all child meshes so they can be raycast properly
        buttonModel.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.userData.parentComponent = group;
            }
        });

        group.add(buttonModel);
        console.log("Button model loaded with pins:", Object.keys(group.userData.pins || {}));
    }, undefined, (error) => {
        console.error('Error loading Button.glb:', error);
    });

    return group;
}

// SCENE SETUP
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a1a);
scene.fog = new THREE.Fog(0x1a1a1a, 15, 60);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(5, 4, 6);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = false; // Disable shadows for Material Preview mode
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.4; // Slightly higher exposure for more vibrant colors
document.body.appendChild(renderer.domElement);
renderer.domElement.style.cursor = 'default';

// CONTROLS
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Create 3D room and read FLOOR_Y
const room = createRoomBackground(scene);
const FLOOR_Y = typeof room?.FLOOR_Y === 'number' ? room.FLOOR_Y : -2;

// Center orbit on workspace (near origin)
controls.target.set(0, 1.0, 0);
controls.update();

// Prevent camera from pitching below the horizontal plane (so you can't look under the tiles)
controls.minPolarAngle = 0.08; // allow looking slightly up
controls.maxPolarAngle = Math.PI / 2 - 0.03; // stop just above horizon - prevents below-floor view

// Limit zoom distance to reasonable range
controls.minDistance = 1.2;
controls.maxDistance = 100;

// LIGHTING SETUP - Material Preview Mode (Blender-style)
// Strong hemisphere light for even, environment-based lighting (like Blender's Material Preview)
// Sky color (top) and ground color (bottom) - simulating studio environment with warm tones
const hemisphereLight = new THREE.HemisphereLight(0xfffef5, 0xe8dcc8, 1.4); // Warm white top, warm beige bottom
scene.add(hemisphereLight);

// Ambient light for base fill - provides even illumination with slight warmth
const ambientLight = new THREE.AmbientLight(0xfff8f0, 0.5); // Warm white ambient
scene.add(ambientLight);

// Soft directional lights from multiple angles (simulating environment/studio lighting)
// Main key light from front-right (primary illumination) - slightly warm
const keyLight = new THREE.DirectionalLight(0xfffef5, 0.9);
keyLight.position.set(6, 10, 6);
keyLight.castShadow = false; // No harsh shadows in Material Preview mode
scene.add(keyLight);

// Fill light from opposite side (softens shadows) - slightly cool for contrast
const fillLight = new THREE.DirectionalLight(0xf0f5ff, 0.6);
fillLight.position.set(-6, 7, -6);
fillLight.castShadow = false;
scene.add(fillLight);

// Additional side light for even illumination (left side) - neutral warm
const sideLight = new THREE.DirectionalLight(0xfff8f0, 0.5);
sideLight.position.set(-10, 6, 8);
sideLight.castShadow = false;
scene.add(sideLight);

// Top light for overall brightness (simulating overhead studio light) - warm white
const topLight = new THREE.DirectionalLight(0xfffef5, 0.7);
topLight.position.set(0, 15, 0);
topLight.castShadow = false;
scene.add(topLight);

// Back light for rim lighting (adds depth to Material Preview) - neutral
const backLight = new THREE.DirectionalLight(0xffffff, 0.4);
backLight.position.set(0, 8, -10);
backLight.castShadow = false;
scene.add(backLight);

// CREATE 3D ROOM BACKGROUND
createRoomBackground(scene);


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
let draggingWireEndpoint = null; // Track which endpoint is being dragged (fromPin or toPin)
let wireEndpointHelpers = []; // Visual helpers for wire endpoints
let draggingWireFromPin = null; // Track when dragging a wire from a pin
let tempWire = null; // Temporary wire that follows mouse during drag
let targetPin = null; // Pin currently under cursor while dragging
let editingWire = null; // Wire being edited (disconnected temporarily)
let originalWireConnection = null; // Store original connection to restore if needed
let editingWireEnd = null; // Which end is being edited: 'from' or 'to'
const WIRE_RADIUS = 0.045; // Thicker, more realistic wire radius
const WIRE_RADIAL_SEGMENTS = 16;
const WIRE_TUBULAR_SEGMENTS = 96;

// Track current mouse position for R key rotation
let currentMouseX = 0;
let currentMouseY = 0;

// Update mouse position tracking
window.addEventListener('mousemove', (e) => {
    currentMouseX = e.clientX;
    currentMouseY = e.clientY;
});

// R key for LED rotation
window.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') {
        // Only start rotation if an LED is selected
        if (selectedComponent && selectedComponent.userData.type === "LED" && !isLEDRotating()) {
            controls.enabled = false; // Lock camera
            startLEDRotation(selectedComponent, currentMouseX, currentMouseY);
            console.log("🔒 Camera locked - LED rotation mode ON (R key)");
        }
    }
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'r' || e.key === 'R') {
        if (isLEDRotating()) {
            stopLEDRotation();
            controls.enabled = true; // Unlock camera
            console.log("🔓 Camera unlocked - LED rotation mode OFF (R key)");
        }
    }
});

// New helper: set outline visible/color for breadboard pins based on current wire connections
function refreshPinHighlight(pin) {
    // ...safety...
    if (!pin) return;
    // Only consider breadboard pins
    const root = findComponentRoot(pin);
    if (!root || root.userData?.type !== 'BREADBOARD') {
        // If not breadboard, ensure outline (if present) remains hidden
        if (pin.children && pin.children[1]) {
            pin.children[1].material.visible = false;
        }
        return;
    }
    // Determine if any wire remains connected to this pin
    const stillConnected = wires.some(w => {
        return (w.userData.fromPinObj === pin) || (w.userData.toPinObj === pin);
    });
    if (pin.children && pin.children[1]) {
        // Dark blue highlight when connected
        pin.children[1].material.color.set(0x001f7a);
        pin.children[1].material.visible = !!stillConnected;
    }
}

// HTML
const pinLabel = document.getElementById("pinLabel");
const addWireBtn = document.getElementById("addWireBtn");
const wireColorPicker = document.getElementById("wireColorPicker");
const loadingOverlay = document.getElementById("loadingOverlay");
const moveBoardBtn = document.getElementById("moveBoardBtn");

let breadboardMoveMode = false;
let breadboard = null;

// TOGGLE MOVE BOARD MODE
moveBoardBtn.addEventListener("click", () => {
    console.log("Move Board button clicked");
    if (!breadboard) {
        console.error("Breadboard not found!");
        return;
    }

    breadboardMoveMode = !breadboardMoveMode;
    console.log("Move Mode:", breadboardMoveMode);

    if (breadboardMoveMode) {
        moveBoardBtn.textContent = "Lock Board";
        moveBoardBtn.classList.add("active");
        moveBoardBtn.style.background = "#0066ff";

        // Deselect everything else
        deselectComponent();
        deselectWire();

        // Disable wire mode if on
        if (wireMode) {
            wireMode = false;
            addWireBtn.style.background = "#333";
            addWireBtn.textContent = "Add Wire";
            firstPin = null;
        }

        // Lock camera controls
        controls.enabled = false;
        console.log("🔒 Camera locked - Move Board mode ON");
        // Enable rotation
    } else {
        moveBoardBtn.textContent = "Move Board";
        moveBoardBtn.classList.remove("active");
        moveBoardBtn.style.background = "#333";

        // Stop dragging
        draggingComponent = null;
        deselectComponent();

        // Unlock camera controls
        controls.enabled = true;
        console.log("🔓 Camera unlocked - Move Board mode OFF");
    }
});

// TOGGLE WIRE MODE
addWireBtn.addEventListener("click", () => {
    wireMode = !wireMode;
    addWireBtn.style.background = wireMode ? "#0066ff" : "#333";
    addWireBtn.textContent = wireMode ? "Wire Mode: ON" : "Add Wire";
    firstPin = null;
    console.log(wireMode)
});

// Create environment map for Material Preview (Blender-style)
// Using a procedural approach to simulate studio environment lighting with warm tones
function createMaterialPreviewEnvironment() {
    // Create a larger texture for better quality reflections
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');

    // Create radial gradient from center (simulating studio lighting with warm tones)
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size * 0.7;

    // Use warmer, more vibrant colors instead of pure greyscale
    const gradient = context.createRadialGradient(centerX, centerY * 0.3, 0, centerX, centerY, radius);
    gradient.addColorStop(0, '#fffef5'); // Warm white center (top area)
    gradient.addColorStop(0.3, '#fff8e8'); // Warm light
    gradient.addColorStop(0.6, '#f0e8d8'); // Warm mid-tone
    gradient.addColorStop(1, '#e8dcc8'); // Warm darker edges (bottom area)

    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);

    // Add warm colored highlights to simulate light sources (more vibrant)
    context.fillStyle = 'rgba(255, 248, 240, 0.4)'; // Warm highlight
    context.beginPath();
    context.arc(centerX * 0.7, centerY * 0.2, size * 0.1, 0, Math.PI * 2);
    context.fill();

    context.beginPath();
    context.arc(centerX * 1.3, centerY * 0.25, size * 0.08, 0, Math.PI * 2);
    context.fill();

    // Add subtle blue-tinted area for contrast (like sky reflection)
    context.fillStyle = 'rgba(240, 245, 255, 0.2)';
    context.beginPath();
    context.arc(centerX, centerY * 0.1, size * 0.15, 0, Math.PI * 2);
    context.fill();

    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.needsUpdate = true;

    return texture;
}

// LOAD MODEL
const loader = new GLTFLoader();
loader.load('/Arduino.glb', (gltf) => {
    arduino = gltf.scene;

    // Breadboard loading moved to spawnBreadboard function


    // Create environment map for Material Preview
    const envMap = createMaterialPreviewEnvironment();

    // Set scene environment (modern Three.js way - applies to all materials automatically)
    scene.environment = envMap;

    // Configure materials for Material Preview mode
    arduino.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
            obj.castShadow = false; // No shadows in Material Preview mode
            obj.receiveShadow = false;

            // Update material for Material Preview mode (better material preview with environment lighting)
            if (obj.material) {
                // Handle multi-material case
                const materials = Array.isArray(obj.material) ? obj.material : [obj.material];

                obj.material = materials.map((oldMat) => {
                    // Preserve original color - get it from the material or texture
                    let originalColor = 0xffffff;
                    if (oldMat.color) {
                        originalColor = oldMat.color;
                    } else if (oldMat.map) {
                        // Try to extract color from texture if available
                        originalColor = 0xffffff;
                    }

                    // Convert to MeshStandardMaterial if it's not already
                    if (!oldMat.isMeshStandardMaterial) {
                        const newMat = new THREE.MeshStandardMaterial({
                            color: originalColor,
                            map: oldMat.map || null,
                            normalMap: oldMat.normalMap || null,
                            roughness: 0.3, // Original clean look
                            metalness: 0.5, // Moderate metalness
                            envMap: envMap,
                            envMapIntensity: 1.0, // Balanced reflections
                            side: THREE.FrontSide
                        });
                        return newMat;
                    } else {
                        if (!oldMat.color) {
                            oldMat.color = new THREE.Color(originalColor);
                        }
                        oldMat.roughness = 0
                        oldMat.metalness = 0
                        oldMat.envMap = envMap;
                        oldMat.envMapIntensity = 0
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
                    // Force pins to be grey - replace material completely
                    const greyMaterial = new THREE.MeshStandardMaterial({
                        color: 0x999999, // Light grey color
                        emissive: 0x555555,
                        emissiveIntensity: 0.5,
                        roughness: 0.4, // Adjusted for Material Preview
                        metalness: 0.6, // Adjusted for Material Preview
                        castShadow: false, // No shadows in Material Preview mode
                        receiveShadow: false
                    });

                    // Replace material (handle both single and array cases)
                    if (Array.isArray(child.material)) {
                        // Replace all materials with grey
                        child.material = child.material.map(() => greyMaterial.clone());
                    } else {
                        // Single material - replace directly
                        child.material = greyMaterial;
                    }

                    child.material.needsUpdate = true;

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
    // Handle breadboard rotation icon dragging
    if (isIconDragging() && breadboard) {
        updateMouseRotation(breadboard, e.clientX, updateConnectedWires);
        return;
    }

    // Handle LED rotation with R key
    if (isLEDRotating()) {
        updateLEDMouseRotation(currentMouseX, currentMouseY, updateConnectedWires);
        return;
    }

    updateMouse(e);
    raycaster.setFromCamera(mouse, camera);

    // Handle component dragging
    // Handle component dragging
    if (draggingComponent) {
        // If dragging breadboard, ensure we are in move mode
        if (draggingComponent.userData.type === "BREADBOARD" && !breadboardMoveMode) {
            draggingComponent = null;
            return;
        }
        const hit = raycaster.ray.intersectPlane(plane, planeIntersect);
        if (hit) {
            const newPos = hit.clone().add(offset);
            // Ensure component stays above Arduino board
            if (newPos.y < MIN_COMPONENT_Y) {
                newPos.y = MIN_COMPONENT_Y;
            }
            draggingComponent.position.copy(newPos);

            // Update connected wires
            updateConnectedWires(draggingComponent);

            // Live preview for LED snapping
            if (draggingComponent.userData.type === "LED") {
                highlightNearbyPinsForLED(draggingComponent);
            }

            // Live preview for BUTTON snapping
            if (draggingComponent.userData.type === "BUTTON") {
                highlightNearbyPinsForButton(draggingComponent);
            }
        }
    }

    // Handle wire endpoint dragging
    if (draggingWireEndpoint && !wireMode) {
        const hit = raycaster.ray.intersectPlane(plane, planeIntersect);

        if (hit) {
            // Check if hovering over a pin
            const pinIntersect = raycaster.intersectObjects(pinObjects, true);

            if (pinIntersect.length > 0) {
                const newPin = pinIntersect[0].object.parent;
                const wire = draggingWireEndpoint.wire;
                const endpointType = draggingWireEndpoint.type;

                // Temporarily update to show preview
                if (endpointType === 'from') {
                    wire.userData.fromPinObj = newPin;
                } else {
                    wire.userData.toPinObj = newPin;
                }

                // Update wire geometry for preview
                updateWireGeometry(wire);

                // Update helper position
                const pinPos = new THREE.Vector3();
                newPin.getWorldPosition(pinPos);
                draggingWireEndpoint.helper.position.copy(pinPos);
            } else {
                // If not over a pin, show helper at mouse position (temporary preview)
                const previewPos = hit.clone().add(offset);
                if (previewPos.y < MIN_COMPONENT_Y) {
                    previewPos.y = MIN_COMPONENT_Y;
                }
                draggingWireEndpoint.helper.position.copy(previewPos);

                // Use original pin for wire geometry preview
                const wire = draggingWireEndpoint.wire;
                const endpointType = draggingWireEndpoint.type;
                if (endpointType === 'from') {
                    wire.userData.fromPinObj = draggingWireEndpoint.originalPin;
                } else {
                    wire.userData.toPinObj = draggingWireEndpoint.originalPin;
                }
                updateWireGeometry(wire);
            }
        }
    }

    // Handle wire dragging from pin
    if (draggingWireFromPin && wireMode) {
        // Get mouse position in 3D space (projected onto a plane)
        // Update plane if needed (in case camera moved)
        const pinPos = new THREE.Vector3();
        draggingWireFromPin.getWorldPosition(pinPos);
        plane.setFromNormalAndCoplanarPoint(
            camera.getWorldDirection(new THREE.Vector3()).clone().negate(),
            pinPos
        );

        const hit = raycaster.ray.intersectPlane(plane, planeIntersect);
        let mousePos3D;

        if (hit) {
            mousePos3D = hit;
        } else {
            // Fallback: use a point in front of camera
            const distance = 5;
            mousePos3D = new THREE.Vector3();
            raycaster.ray.at(distance, mousePos3D);
        }

        // Check if hovering over a pin
        const pinIntersect = raycaster.intersectObjects(pinObjects, true);

        if (pinIntersect.length > 0) {
            const pin = pinIntersect[0].object.parent;

            // Don't highlight the pin we're dragging from
            if (pin !== draggingWireFromPin) {
                // Highlight target pin
                if (targetPin && targetPin !== pin) {
                    // Reset previous target pin visual state (respect existing connections)
                    targetPin.children[0].material.color.set(0xffffff);
                    if (targetPin.children[1]) {
                        refreshPinHighlight(targetPin);
                    }
                }

                targetPin = pin;

                // Determine if this pin belongs to a breadboard -> keep breadboard pin outline black
                const root = findComponentRoot(pin);
                const isBreadboardPin = root && root.userData && root.userData.type === 'BREADBOARD';

                // Set pin color (body) and outline color accordingly
                pin.children[0].material.color.set(isBreadboardPin ? 0x000000 : 0x00ff00);
                if (pin.children[1]) {
                    pin.children[1].material.visible = true;
                    pin.children[1].material.color.set(isBreadboardPin ? 0x000000 : 0x00ff00);
                }

                // Show pin label for target pin
                pinLabel.style.display = "block";
                pinLabel.style.left = e.clientX + 15 + "px";
                pinLabel.style.top = e.clientY + 15 + "px";
                pinLabel.innerHTML = pin.name;

                // Update wire geometry
                if (editingWire) {
                    // Update existing wire to point to this pin
                    if (editingWireEnd === 'from') {
                        editingWire.userData.fromPinObj = pin;
                    } else {
                        editingWire.userData.toPinObj = pin;
                    }
                    updateWireGeometry(editingWire);
                } else {
                    // Update temp wire to point to this pin
                    const pinPos = new THREE.Vector3();
                    pin.getWorldPosition(pinPos);
                    updateTempWire(pinPos);
                }
            } else {
                // Reset target if hovering over starting pin
                if (targetPin) {
                    targetPin.children[0].material.color.set(0xffffff);
                    if (targetPin.children[1]) {
                        refreshPinHighlight(targetPin);
                    }
                    targetPin = null;
                }
                pinLabel.style.display = "none";

                // Restore wire to original other pin if editing
                if (editingWire && originalWireConnection) {
                    // Restore the other end to its original pin
                    if (editingWireEnd === 'from') {
                        editingWire.userData.fromPinObj = draggingWireFromPin;
                        editingWire.userData.toPinObj = originalWireConnection.toPin;
                    } else {
                        editingWire.userData.toPinObj = draggingWireFromPin;
                        editingWire.userData.fromPinObj = originalWireConnection.fromPin;
                    }
                    updateWireGeometry(editingWire);

                    // Update endpoint helpers
                    const p1 = new THREE.Vector3();
                    const p2 = new THREE.Vector3();
                    editingWire.userData.fromPinObj.getWorldPosition(p1);
                    editingWire.userData.toPinObj.getWorldPosition(p2);
                    if (editingWire.userData.fromHelper) {
                        editingWire.userData.fromHelper.position.copy(p1);
                    }
                    if (editingWire.userData.toHelper) {
                        editingWire.userData.toHelper.position.copy(p2);
                    }
                }
            }
        } else {
            // Reset target pin if not over any pin
            if (targetPin) {
                targetPin.children[0].material.color.set(0xffffff);
                if (targetPin.children[1]) {
                    refreshPinHighlight(targetPin);
                }
                targetPin = null;
            }
            pinLabel.style.display = "none";

            // Update wire geometry to follow mouse
            if (editingWire) {
                // Update existing wire to follow mouse
                const otherPin = editingWireEnd === 'from' ? editingWire.userData.toPinObj : editingWire.userData.fromPinObj;
                const p1 = new THREE.Vector3();
                const p2 = new THREE.Vector3();
                draggingWireFromPin.getWorldPosition(p1);
                otherPin.getWorldPosition(p2);

                const mid = p1.clone().lerp(mousePos3D, 0.5);
                mid.y += 0.3;
                const curve = new THREE.QuadraticBezierCurve3(p1, mid, mousePos3D);

                // Update wire geometry
                editingWire.userData.curve = curve;
                const newGeometry = new THREE.TubeGeometry(curve, WIRE_TUBULAR_SEGMENTS, WIRE_RADIUS, WIRE_RADIAL_SEGMENTS, false);
                editingWire.geometry.dispose();
                editingWire.geometry = newGeometry;
            } else {
                // Update temp wire to follow mouse
                updateTempWire(mousePos3D);
            }
        }
        return;
    }

    // Handle pin hovering (only if not dragging)
    if (!draggingComponent && !draggingWireFromPin) {
        // If in breadboard move mode, don't hover pins on the breadboard
        if (breadboardMoveMode) {
            // We still want to hover pins on Arduino, so we need to check parent
            // But simpler: just disable all pin hovering when moving board
            if (hoveredPin) {
                hoveredPin.children[0].material.color.set(0xffffff);
                // Restore previous pin outline according to its connection state
                if (hoveredPin.children[1]) {
                    refreshPinHighlight(hoveredPin);
                }
                hoveredPin = null;
                pinLabel.style.display = "none";
            }

            // Check if hovering over breadboard to show move cursor
            const intersects = raycaster.intersectObjects(components, true);
            const breadboardHit = intersects.find(hit => {
                const root = findComponentRoot(hit.object);
                return root && root.userData.type === "BREADBOARD";
            });

            if (breadboardHit) {
                document.body.style.cursor = "move";
            } else {
                document.body.style.cursor = "default";
            }
            return;
        }

        const intersect = raycaster.intersectObjects(pinObjects, true);

        if (!intersect.length) {
            if (hoveredPin) {
                hoveredPin.children[0].material.color.set(0xffffff);
                // Restore outline according to connection state (breadboard pins keep dark-blue if connected)
                if (hoveredPin.children[1]) {
                    refreshPinHighlight(hoveredPin);
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
                // Restore previous pin outline according to its connection state
                if (hoveredPin.children[1]) {
                    refreshPinHighlight(hoveredPin);
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

    // Check if clicked on breadboard rotation icon
    if (breadboardMoveMode) {
        const icon = getIcon();
        if (icon) {
            const iconIntersects = raycaster.intersectObject(icon, true);
            if (iconIntersects.length > 0) {
                startIconDrag(e.clientX);
                return;
            }
        }
    }


    // 1. Check if clicked on a component (when not in wire mode)
    if (true) {
        const intersects = raycaster.intersectObjects(components, true);
        let compHit = null;
        let rootComponent = null;

        for (const hit of intersects) {
            // Skip if this is a pin object (we want to drag the component, not connect wires)
            const isPin = hit.object.userData.isPin ||
                (hit.object.parent && hit.object.parent.userData.isPin);

            const root = findComponentRoot(hit.object);
            if (root && !isPin) {
                compHit = hit;
                rootComponent = root;
                break;
            }
            // If it's a pin but belongs to LED/BUTTON, still allow component dragging
            if (root && isPin && (root.userData.type === 'LED' || root.userData.type === 'BUTTON') && !wireMode) {
                compHit = hit;
                rootComponent = root;
                break;
            }
        }

        if (rootComponent) {
            const obj = rootComponent;

            // Special handling for breadboard
            if (obj.userData.type === "BREADBOARD") {
                if (!breadboardMoveMode) {
                    // If not in move mode, ignore click on breadboard body
                    return;
                }
                // If in move mode, allow dragging
                deselectComponent();
                selectedComponent = obj;
                draggingComponent = obj;
                highlightComponent(obj, true);

                // Setup dragging plane
                plane.setFromNormalAndCoplanarPoint(
                    camera.getWorldDirection(new THREE.Vector3()).clone().negate(),
                    obj.position
                );

                // Calculate offset
                const hitPoint = compHit.point;
                planeIntersect.copy(hitPoint);
                offset.copy(obj.position).sub(planeIntersect);

                controls.enabled = false;
                return;
            }
            // Select component for deletion and start dragging
            deselectComponent();
            selectedComponent = rootComponent;
            draggingComponent = rootComponent;
            highlightComponent(selectedComponent, false);

            // Clear old LED pin highlights when picking up LED
            if (rootComponent.userData.type === "LED" && rootComponent.userData.snappedPins) {
                const oldSnappedPins = rootComponent.userData.snappedPins;
                // Find and clear highlights from old pins
                pinObjects.forEach(pin => {
                    if (pin.name === oldSnappedPins.long || pin.name === oldSnappedPins.short) {
                        if (pin.children && pin.children[1]) {
                            // Only hide if no wires connected
                            const hasWire = wires.some(w =>
                                w.userData.fromPinObj === pin || w.userData.toPinObj === pin
                            );
                            if (!hasWire) {
                                pin.children[1].material.visible = false;
                            }
                        }
                    }
                });
                // Clear the snapped pins reference
                delete rootComponent.userData.snappedPins;
            }
            // Clear old BUTTON pin highlights when picking up BUTTON
            if (rootComponent.userData.type === "BUTTON" && rootComponent.userData.snappedPins) {
                const oldSnappedPins = rootComponent.userData.snappedPins;
                // Find and clear highlights from old pins
                pinObjects.forEach(pin => {
                    if (oldSnappedPins.includes(pin.name)) {
                        if (pin.children && pin.children[1]) {
                            // Only hide if no wires connected
                            const hasWire = wires.some(w =>
                                w.userData.fromPinObj === pin || w.userData.toPinObj === pin
                            );
                            if (!hasWire) {
                                pin.children[1].material.visible = false;
                            }
                        }
                    }
                });
                // Clear the snapped pins reference
                delete rootComponent.userData.snappedPins;
            }

            // Disable OrbitControls to prevent Arduino from moving
            controls.enabled = false;

            // Setup dragging plane at component's position
            const componentWorldPos = new THREE.Vector3();
            draggingComponent.getWorldPosition(componentWorldPos);

            plane.setFromNormalAndCoplanarPoint(
                camera.getWorldDirection(new THREE.Vector3()).clone().negate(),
                componentWorldPos
            );

            // Use the hit point to calculate offset properly
            if (compHit && compHit.point) {
                planeIntersect.copy(compHit.point);
                offset.copy(componentWorldPos).sub(planeIntersect);
            } else {
                // Fallback if no hit point
                planeIntersect.copy(componentWorldPos);
                offset.set(0, 0, 0);
            }
            return;
        }
    }

    // 2. Check if clicked on a wire endpoint helper (for dragging)
    if (!wireMode) {
        const endpointIntersects = raycaster.intersectObjects(wireEndpointHelpers, true);
        if (endpointIntersects.length > 0) {
            const helper = endpointIntersects[0].object;
            const wire = helper.userData.wire;
            selectWire(wire);

            // Get current pin position for plane setup
            const currentPin = helper.userData.endpointType === 'from' ? wire.userData.fromPinObj : wire.userData.toPinObj;
            const pinPos = new THREE.Vector3();
            currentPin.getWorldPosition(pinPos);

            // Setup dragging plane
            plane.setFromNormalAndCoplanarPoint(
                camera.getWorldDirection(new THREE.Vector3()).clone().negate(),
                pinPos
            );
            planeIntersect.copy(endpointIntersects[0].point);
            offset.copy(pinPos).sub(planeIntersect);

            draggingWireEndpoint = {
                wire: wire,
                type: helper.userData.endpointType, // 'from' or 'to'
                helper: helper,
                originalPin: currentPin
            };
            deselectComponent();
            controls.enabled = false; // Disable camera controls when dragging wire endpoint
            return;
        }
    }

    // 3. Check if clicked on a wire
    const wireIntersects = raycaster.intersectObjects(wires, true);

    if (wireIntersects.length > 0) {
        selectWire(wireIntersects[0].object);
        deselectComponent();
        return;
    }

    // 4. If clicked empty, deselect wire and component
    deselectWire();
    deselectComponent();

    // 5. If wire mode OFF → done
    if (!wireMode) return;

    // 6. If wire mode ON → check pin click for drag-to-connect
    const pinIntersect = raycaster.intersectObjects(pinObjects, true);
    if (!pinIntersect.length) return;

    const pin = pinIntersect[0].object.parent;

    // Check if this pin already has a wire connected
    const existingWire = wires.find(w =>
        w.userData.fromPinObj === pin || w.userData.toPinObj === pin
    );

    if (existingWire) {
        // We're editing an existing wire - drag the actual wire visually
        editingWire = existingWire;
        editingWireEnd = existingWire.userData.fromPinObj === pin ? 'from' : 'to';
        originalWireConnection = {
            fromPin: existingWire.userData.fromPinObj,
            toPin: existingWire.userData.toPinObj,
            fromPinName: existingWire.userData.fromPin,
            toPinName: existingWire.userData.toPin
        };

        // Determine which end is connected to this pin
        const otherPin = editingWireEnd === 'from' ? existingWire.userData.toPinObj : existingWire.userData.fromPinObj;

        // Start dragging from this pin (will reconnect to other pin or new pin)
        draggingWireFromPin = pin;
        targetPin = otherPin; // Default target is the other end of the wire

        // Don't create temp wire - we'll update the existing wire geometry directly
    } else {
        // New wire - start dragging from this pin
        draggingWireFromPin = pin;
        targetPin = null;
        editingWire = null;
        editingWireEnd = null;
        originalWireConnection = null;

        // Create temporary wire that will follow mouse
        createTempWire(pin);
    }

    // Lock Arduino movement
    controls.enabled = false;

    // Setup dragging plane for temp wire
    const pinPos = new THREE.Vector3();
    pin.getWorldPosition(pinPos);
    plane.setFromNormalAndCoplanarPoint(
        camera.getWorldDirection(new THREE.Vector3()).clone().negate(),
        pinPos
    );
    planeIntersect.copy(pinIntersect[0].point);

    // Highlight the starting pin
    pin.children[0].material.color.set(0x00aaff);
});

// POINTER UP HANDLER - Finalize wire connection
window.addEventListener('pointerup', (e) => {
    // Stop breadboard icon dragging
    if (isIconDragging()) {
        stopIconDrag();
        return;
    }

    // Handle wire dragging completion
    if (draggingWireFromPin && wireMode) {
        updateMouse(e);
        raycaster.setFromCamera(mouse, camera);

        // Check if released over a pin
        const pinIntersect = raycaster.intersectObjects(pinObjects, true);

        if (pinIntersect.length > 0) {
            const endPin = pinIntersect[0].object.parent;

            // Only create/update wire if it's a different pin
            if (endPin !== draggingWireFromPin) {
                if (editingWire) {
                    // We're editing an existing wire - update it
                    // store old endpoints
                    const oldFrom = originalWireConnection.fromPin;
                    const oldTo = originalWireConnection.toPin;

                    if (editingWireEnd === 'from') {
                        // Update the fromPin
                        editingWire.userData.fromPin = endPin.name;
                        editingWire.userData.fromPinObj = endPin;
                    } else {
                        // Update the toPin
                        editingWire.userData.toPin = endPin.name;
                        editingWire.userData.toPinObj = endPin;
                    }

                    // Update wire geometry
                    updateWireGeometry(editingWire);

                    // Update connection map
                    const connection = wireConnections.find(c => c.id === editingWire.userData.id);
                    if (connection) {
                        if (editingWireEnd === 'from') {
                            connection.from = endPin.name;
                        } else {
                            connection.to = endPin.name;
                        }
                    }

                    // Update endpoint helpers
                    const p1 = new THREE.Vector3();
                    const p2 = new THREE.Vector3();
                    editingWire.userData.fromPinObj.getWorldPosition(p1);
                    editingWire.userData.toPinObj.getWorldPosition(p2);
                    if (editingWire.userData.fromHelper) {
                        editingWire.userData.fromHelper.position.copy(p1);
                    }
                    if (editingWire.userData.toHelper) {
                        editingWire.userData.toHelper.position.copy(p2);
                    }

                    // Refresh highlights: old endpoints may now be disconnected, new endpoints should show highlight
                    refreshPinHighlight(oldFrom);
                    refreshPinHighlight(oldTo);
                    refreshPinHighlight(editingWire.userData.fromPinObj);
                    refreshPinHighlight(editingWire.userData.toPinObj);

                    console.log("Wire updated:", connection);
                } else {
                    // Create new wire
                    drawWire(draggingWireFromPin, endPin);
                }
            } else {
                // Released on same pin - restore original connection if editing
                if (editingWire && originalWireConnection) {
                    editingWire.userData.fromPin = originalWireConnection.fromPinName;
                    editingWire.userData.toPin = originalWireConnection.toPinName;
                    editingWire.userData.fromPinObj = originalWireConnection.fromPin;
                    editingWire.userData.toPinObj = originalWireConnection.toPin;

                    // Update wire geometry
                    updateWireGeometry(editingWire);

                    // Update endpoint helpers
                    const p1 = new THREE.Vector3();
                    const p2 = new THREE.Vector3();
                    editingWire.userData.fromPinObj.getWorldPosition(p1);
                    editingWire.userData.toPinObj.getWorldPosition(p2);
                    if (editingWire.userData.fromHelper) {
                        editingWire.userData.fromHelper.position.copy(p1);
                    }
                    if (editingWire.userData.toHelper) {
                        editingWire.userData.toHelper.position.copy(p2);
                    }

                    // Refresh highlights back to original pins
                    refreshPinHighlight(originalWireConnection.fromPin);
                    refreshPinHighlight(originalWireConnection.toPin);

                    console.log("Wire restored to original connection");
                }
            }
        } else {
            // Released on empty space - restore original connection if editing
            if (editingWire && originalWireConnection) {
                editingWire.userData.fromPin = originalWireConnection.fromPinName;
                editingWire.userData.toPin = originalWireConnection.toPinName;
                editingWire.userData.fromPinObj = originalWireConnection.fromPin;
                editingWire.userData.toPinObj = originalWireConnection.toPin;

                // Update wire geometry
                updateWireGeometry(editingWire);

                // Update endpoint helpers
                const p1 = new THREE.Vector3();
                const p2 = new THREE.Vector3();
                editingWire.userData.fromPinObj.getWorldPosition(p1);
                editingWire.userData.toPinObj.getWorldPosition(p2);
                if (editingWire.userData.fromHelper) {
                    editingWire.userData.fromHelper.position.copy(p1);
                }
                if (editingWire.userData.toHelper) {
                    editingWire.userData.toHelper.position.copy(p2);
                }

                console.log("Wire restored to original connection");
            }
        }

        // Clean up temporary wire
        if (tempWire) {
            scene.remove(tempWire);
            tempWire.geometry.dispose();
            tempWire.material.dispose();
            tempWire = null;
        }

        // Reset starting pin color
        if (draggingWireFromPin) {
            draggingWireFromPin.children[0].material.color.set(0xffffff);
            if (draggingWireFromPin.children[1]) {
                refreshPinHighlight(draggingWireFromPin);
            }
        }

        // Reset target pin if any
        if (targetPin) {
            targetPin.children[0].material.color.set(0xffffff);
            if (targetPin.children[1]) {
                refreshPinHighlight(targetPin);
            }
            targetPin = null;
        }

        // Reset editing state
        draggingWireFromPin = null;
        editingWire = null;
        originalWireConnection = null;

        // Re-enable Arduino movement
        controls.enabled = true;
    }

    // Handle component dragging completion
    if (draggingComponent) {
        snapToNearestPin(draggingComponent);
        // Keep selectedComponent selected for potential deletion
        draggingComponent = null;
    }

    // Handle wire endpoint drop
    if (draggingWireEndpoint) {
        const wire = draggingWireEndpoint.wire;
        const endpointType = draggingWireEndpoint.type;

        // Check if dropped on a pin
        updateMouse(e);
        raycaster.setFromCamera(mouse, camera);
        const pinIntersect = raycaster.intersectObjects(pinObjects, true);
        if (pinIntersect.length > 0) {
            const newPin = pinIntersect[0].object.parent;

            // Remember old pin
            const oldPin = draggingWireEndpoint.originalPin;

            // Update wire connection
            if (endpointType === 'from') {
                wire.userData.fromPin = newPin.name;
                wire.userData.fromPinObj = newPin;
            } else {
                wire.userData.toPin = newPin.name;
                wire.userData.toPinObj = newPin;
            }

            // Update wire geometry
            updateWireGeometry(wire);

            // Update connection map
            const connection = wireConnections.find(c => c.id === wire.userData.id);
            if (connection) {
                if (endpointType === 'from') {
                    connection.from = newPin.name;
                } else {
                    connection.to = newPin.name;
                }
            }

            // Refresh highlights: old pin may be disconnected now; new pin should show dark-blue ring
            refreshPinHighlight(oldPin);
            refreshPinHighlight(newPin);

            console.log("Wire reconnected:", connection);
        } else {
            // If not dropped on a pin, revert to original position
            updateWireGeometry(wire);
        }

        draggingWireEndpoint = null;
    }

    // Always re-enable OrbitControls when pointer is released
    if (!controls.enabled && !breadboardMoveMode) {
        controls.enabled = true;
    }
});

// Create temporary wire that follows mouse
function createTempWire(fromPin) {
    // Remove existing temp wire if any
    if (tempWire) {
        scene.remove(tempWire);
        tempWire.geometry.dispose();
        tempWire.material.dispose();
    }

    const p1 = new THREE.Vector3();
    fromPin.getWorldPosition(p1);

    // Start with a point at the pin, will update in pointermove
    const p2 = p1.clone();

    const mid = p1.clone().lerp(p2, 0.5);
    mid.y += 0.3;

    const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2);
    const geometry = new THREE.TubeGeometry(curve, WIRE_TUBULAR_SEGMENTS, WIRE_RADIUS, WIRE_RADIAL_SEGMENTS, false);
    const color = parseInt(wireColorPicker.value);

    const material = new THREE.MeshPhysicalMaterial({
        color: color,
        metalness: 0.1,
        roughness: 0.35,
        clearcoat: 0.6,
        clearcoatRoughness: 0.2,
        sheen: 0.25,
        sheenColor: new THREE.Color(color),
        emissive: color,
        emissiveIntensity: 0.15,
        transparent: true,
        opacity: 0.7 // Slightly transparent to indicate it's temporary
    });

    tempWire = new THREE.Mesh(geometry, material);
    tempWire.userData.isTempWire = true;
    scene.add(tempWire);
}

// Update temporary wire to follow mouse
function updateTempWire(mousePos) {
    if (!tempWire || !draggingWireFromPin) return;

    const p1 = new THREE.Vector3();
    draggingWireFromPin.getWorldPosition(p1);

    // Use mouse position (projected onto a plane)
    const p2 = mousePos;

    const mid = p1.clone().lerp(p2, 0.5);
    mid.y += 0.3;

    const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2);
    // Dispose old geometry
    tempWire.geometry.dispose();
    tempWire.geometry = new THREE.TubeGeometry(curve, WIRE_TUBULAR_SEGMENTS, WIRE_RADIUS, WIRE_RADIAL_SEGMENTS, false);
}

// DRAW CURVED WIRE (thicker using TubeGeometry)
function drawWire(pin1, pin2, customColor = null) {
    const p1 = new THREE.Vector3();
    const p2 = new THREE.Vector3();
    pin1.getWorldPosition(p1);
    pin2.getWorldPosition(p2);

    const mid = p1.clone().lerp(p2, 0.5);
    mid.y += 0.3;

    const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2);

    // Use TubeGeometry for thicker, 3D wires
    const geometry = new THREE.TubeGeometry(curve, WIRE_TUBULAR_SEGMENTS, WIRE_RADIUS, WIRE_RADIAL_SEGMENTS, false);

    // Use custom color if provided, otherwise use color picker value
    const color = customColor !== null ? customColor : parseInt(wireColorPicker.value);

    const material = new THREE.MeshPhysicalMaterial({
        color: color,
        metalness: 0.15,
        roughness: 0.3,
        clearcoat: 0.65,
        clearcoatRoughness: 0.18,
        sheen: 0.35,
        sheenColor: new THREE.Color(color),
        emissive: color,
        emissiveIntensity: 0.15
    });

    const wire = new THREE.Mesh(geometry, material);
    wire.castShadow = false; // No shadows in Material Preview mode
    wire.receiveShadow = false;

    const wireId = wireIdCounter++;

    wire.userData = {
        id: wireId,
        isWire: true,
        fromPin: pin1.name,
        toPin: pin2.name,
        fromPinObj: pin1,
        toPinObj: pin2,
        color: color,
        originalColor: color,
        curve: curve // Store curve for updating
    };

    // Create visual helpers at wire endpoints for dragging
    createWireEndpointHelpers(wire, p1, p2);

    scene.add(wire);
    wires.push(wire);

    wireConnections.push({
        id: wireId,
        from: pin1.name,
        to: pin2.name,
        color: color
    });

    console.log("CONNECTION MAP:", wireConnections);

    // Ensure breadboard pin outlines reflect this new connection
    refreshPinHighlight(pin1);
    refreshPinHighlight(pin2);
}

// Create visual helpers at wire endpoints
function createWireEndpointHelpers(wire, p1, p2) {
    // Remove old helpers if they exist
    if (wire.userData.fromHelper) {
        scene.remove(wire.userData.fromHelper);
    }
    if (wire.userData.toHelper) {
        scene.remove(wire.userData.toHelper);
    }

    // Create sphere helpers at endpoints (only visible when wire is selected)
    const helperGeometry = new THREE.SphereGeometry(0.05, 16, 16);
    const helperMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        visible: false,
        transparent: true,
        opacity: 0.8
    });

    const fromHelper = new THREE.Mesh(helperGeometry, helperMaterial.clone());
    fromHelper.position.copy(p1);
    fromHelper.userData.isWireEndpoint = true;
    fromHelper.userData.wire = wire;
    fromHelper.userData.endpointType = 'from';
    scene.add(fromHelper);
    wire.userData.fromHelper = fromHelper;
    wireEndpointHelpers.push(fromHelper);

    const toHelper = new THREE.Mesh(helperGeometry, helperMaterial.clone());
    toHelper.position.copy(p2);
    toHelper.userData.isWireEndpoint = true;
    toHelper.userData.wire = wire;
    toHelper.userData.endpointType = 'to';
    scene.add(toHelper);
    wire.userData.toHelper = toHelper;
    wireEndpointHelpers.push(toHelper);
}

// Update wire geometry when endpoint is moved
function updateWireGeometry(wire) {
    const fromPin = wire.userData.fromPinObj;
    const toPin = wire.userData.toPinObj;

    const p1 = new THREE.Vector3();
    const p2 = new THREE.Vector3();
    fromPin.getWorldPosition(p1);
    toPin.getWorldPosition(p2);

    const mid = p1.clone().lerp(p2, 0.5);
    mid.y += 0.3;

    const newCurve = new THREE.QuadraticBezierCurve3(p1, mid, p2);
    wire.userData.curve = newCurve;

    // Update tube geometry
    const newGeometry = new THREE.TubeGeometry(newCurve, WIRE_TUBULAR_SEGMENTS, WIRE_RADIUS, WIRE_RADIAL_SEGMENTS, false);

    // Dispose old geometry
    wire.geometry.dispose();
    wire.geometry = newGeometry;

    // Update helper positions
    if (wire.userData.fromHelper) {
        wire.userData.fromHelper.position.copy(p1);
    }
    if (wire.userData.toHelper) {
        wire.userData.toHelper.position.copy(p2);
    }
}


// WIRE SELECTION
function selectWire(wire) {
    deselectWire();

    selectedWire = wire;
    // Store original color if not already stored
    if (!wire.userData.originalColor) {
        wire.userData.originalColor = wire.userData.color;
    }
    wire.material.color.set(0xffffff); // highlight white
    wire.material.emissive.set(0xffffff);
    wire.material.emissiveIntensity = 0.5;

    // Show endpoint helpers when wire is selected
    if (wire.userData.fromHelper) {
        wire.userData.fromHelper.material.visible = true;
    }
    if (wire.userData.toHelper) {
        wire.userData.toHelper.material.visible = true;
    }
}

// DESELECT
function deselectWire() {
    if (!selectedWire) return;

    // Revert to original color
    const originalColor = selectedWire.userData.originalColor || selectedWire.userData.color || 0xff0000;
    selectedWire.material.color.set(originalColor);
    selectedWire.material.emissive.set(originalColor);
    selectedWire.material.emissiveIntensity = 0.2;

    // Hide endpoint helpers
    if (selectedWire.userData.fromHelper) {
        selectedWire.userData.fromHelper.material.visible = false;
    }
    if (selectedWire.userData.toHelper) {
        selectedWire.userData.toHelper.material.visible = false;
    }

    selectedWire = null;
    draggingWireEndpoint = null;
}

// DELETE WITH KEYBOARD
window.addEventListener('keydown', (e) => {
    if (e.key === "Delete") {
        // Delete selected wire (shared logic)
        deleteSelectedWire();

        // Delete selected component
        if (selectedComponent) {
            // If deleting a breadboard, remove its rotation icon and clear global ref
            if (selectedComponent.userData.type === "BREADBOARD") {
                try {
                    removeBreadboardIcon(selectedComponent);
                } catch (err) { /* ignore if icon removal fails */ }
                if (breadboard === selectedComponent) {
                    breadboard = null;
                }
            }
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

            // If no breadboards remain, hide the Move Board button
            const anyBreadboard = components.some(c => c.userData && c.userData.type === "BREADBOARD");
            if (!anyBreadboard) {
                moveBoardBtn.style.display = "none";
                // also ensure move mode is off
                breadboardMoveMode = false;
                controls.enabled = true;
            }
            +
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

window.addEventListener("pointerup", (e) => {
    // Handle wire dragging completion (drag from pin to pin)
    if (draggingWireFromPin && wireMode) {
        updateMouse(e);
        raycaster.setFromCamera(mouse, camera);

        // Check if released over a pin
        const pinIntersect = raycaster.intersectObjects(pinObjects, true);

        if (pinIntersect.length > 0) {
            const endPin = pinIntersect[0].object.parent;

            // Only create wire if it's a different pin
            if (endPin !== draggingWireFromPin) {
                // Create final wire
                drawWire(draggingWireFromPin, endPin);
            }
        }

        // Clean up temporary wire
        if (tempWire) {
            scene.remove(tempWire);
            tempWire.geometry.dispose();
            tempWire.material.dispose();
            tempWire = null;
        }

        // Reset starting pin color
        if (draggingWireFromPin) {
            draggingWireFromPin.children[0].material.color.set(0xffffff);
            if (draggingWireFromPin.children[1]) {
                refreshPinHighlight(draggingWireFromPin);
            }
        }

        // Reset target pin if any
        if (targetPin) {
            targetPin.children[0].material.color.set(0xffffff);
            if (targetPin.children[1]) {
                refreshPinHighlight(targetPin);
            }
            targetPin = null;
        }

        draggingWireFromPin = null;
    }

    // Handle component dragging completion
    if (draggingComponent) {
        snapToNearestPin(draggingComponent);
        // Keep selectedComponent selected for potential deletion
        draggingComponent = null;
    }

    // Handle wire endpoint drop
    if (draggingWireEndpoint) {
        updateMouse(e);
        raycaster.setFromCamera(mouse, camera);
        const wire = draggingWireEndpoint.wire;
        const endpointType = draggingWireEndpoint.type;

        // Check if dropped on a pin
        const pinIntersect = raycaster.intersectObjects(pinObjects, true);
        if (pinIntersect.length > 0) {
            const newPin = pinIntersect[0].object.parent;

            // Update wire connection
            if (endpointType === 'from') {
                wire.userData.fromPin = newPin.name;
                wire.userData.fromPinObj = newPin;
            } else {
                wire.userData.toPin = newPin.name;
                wire.userData.toPinObj = newPin;
            }

            // Update wire geometry
            updateWireGeometry(wire);

            // Update connection map
            const connection = wireConnections.find(c => c.id === wire.userData.id);
            if (connection) {
                if (endpointType === 'from') {
                    connection.from = newPin.name;
                } else {
                    connection.to = newPin.name;
                }
            }

            // Refresh highlights: old pin may be disconnected now; new pin should show dark-blue ring
            refreshPinHighlight(oldPin);
            refreshPinHighlight(newPin);

            console.log("Wire reconnected:", connection);
        } else {
            // If not dropped on a pin, revert to original position
            updateWireGeometry(wire);
        }

        draggingWireEndpoint = null;
    }

    // Always re-enable OrbitControls when pointer is released
    if (!controls.enabled && !breadboardMoveMode) {
        controls.enabled = true;
    }
});

//Snap to Nearest Pin
function snapToNearestPin(component) {
    if (component.userData.type === "BREADBOARD") return;

    // Special handling for LED - snap both legs
    if (component.userData.type === "LED") {
        snapLEDToNearestPins(component);
        return;
    }

    // Special handling for BUTTON - snap all 4 legs
    if (component.userData.type === "BUTTON") {
        snapButtonToNearestPins(component);
        return;
    }

    // Original snapping logic for other components
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

// Highlight breadboard pins when LED legs are near them (live preview while dragging)
function highlightNearbyPinsForLED(led) {
    // Find the LED legs
    let longLeg = null;
    let shortLeg = null;

    led.traverse((child) => {
        if (child.name === 'anode') {
            longLeg = child;
        }
        if (child.name === 'cathode') {
            shortLeg = child;
        }
    });

    if (!longLeg || !shortLeg) {
        return;
    }

    // Get world positions of both legs
    const longLegPos = new THREE.Vector3();
    const shortLegPos = new THREE.Vector3();
    longLeg.getWorldPosition(longLegPos);
    shortLeg.getWorldPosition(shortLegPos);

    // Only check breadboard pins
    const breadboardPins = pinObjects.filter(pin => {
        const root = findComponentRoot(pin);
        return root && root.userData.type === 'BREADBOARD';
    });

    // Reset all breadboard pin highlights first (unless they have wires or are snapped to other LEDs)
    breadboardPins.forEach(pin => {
        if (pin.children && pin.children[1]) {
            // Only hide if no wires connected and not currently snapped to another LED
            const hasWire = wires.some(w =>
                w.userData.fromPinObj === pin || w.userData.toPinObj === pin
            );
            const hasOtherLED = components.some(comp => {
                if (comp.userData.type !== 'LED' || comp === led) return false;
                const snapped = comp.userData.snappedPins;
                return snapped && (snapped.long === pin.name || snapped.short === pin.name);
            });

            if (!hasWire && !hasOtherLED) {
                pin.children[1].material.visible = false;
            }
        }
    });

    // Find and highlight nearest pins for each leg
    let nearestLongPin = null;
    let nearestShortPin = null;
    let minLongDist = Infinity;
    let minShortDist = Infinity;

    breadboardPins.forEach(pin => {
        const pinPos = new THREE.Vector3();
        pin.getWorldPosition(pinPos);

        const longDist = longLegPos.distanceTo(pinPos);
        const shortDist = shortLegPos.distanceTo(pinPos);

        if (longDist < minLongDist && longDist < 0.5) {
            minLongDist = longDist;
            nearestLongPin = pin;
        }

        if (shortDist < minShortDist && shortDist < 0.5) {
            minShortDist = shortDist;
            nearestShortPin = pin;
        }
    });

    // Highlight the nearest pins with black circles (live preview)
    if (nearestLongPin && nearestLongPin.children && nearestLongPin.children[1]) {
        nearestLongPin.children[1].material.color.set(0x000000);
        nearestLongPin.children[1].material.visible = true;
    }

    if (nearestShortPin && nearestShortPin !== nearestLongPin &&
        nearestShortPin.children && nearestShortPin.children[1]) {
        nearestShortPin.children[1].material.color.set(0x000000);
        nearestShortPin.children[1].material.visible = true;
    }
}

// Highlight breadboard pins when button legs are near them (live preview while dragging)
function highlightNearbyPinsForButton(button) {
    const legs = [];

    button.traverse((child) => {
        if (child.userData.isPin || (child.name && (
            child.name.toLowerCase().includes('leg') ||
            child.name.toLowerCase().includes('pin') ||
            child.name.toLowerCase().includes('terminal')
        ))) {
            legs.push(child);
        }
    });

    // Fallback: check userData.pins if no legs found via traverse
    if (legs.length === 0 && button.userData.pins) {
        Object.values(button.userData.pins).forEach(pin => {
            if (pin) legs.push(pin);
        });
    }

    if (legs.length === 0) {
        console.log('⚠️ No button legs found for highlighting');
        return;
    }

    const breadboardPins = pinObjects.filter(pin => {
        const root = findComponentRoot(pin);
        return root && root.userData.type === 'BREADBOARD';
    });

    // Reset all breadboard pin highlights
    breadboardPins.forEach(pin => {
        if (pin.children && pin.children[1]) {
            const hasWire = wires.some(w =>
                w.userData.fromPinObj === pin || w.userData.toPinObj === pin
            );
            const hasOtherComponent = components.some(comp => {
                if (comp === button) return false;
                const snapped = comp.userData.snappedPins;
                if (!snapped) return false;

                // Handle both array (button) and object (LED) formats
                if (Array.isArray(snapped)) {
                    return snapped.includes(pin.name);
                } else if (typeof snapped === 'object') {
                    return snapped.long === pin.name || snapped.short === pin.name;
                }
                return false;
            });

            if (!hasWire && !hasOtherComponent) {
                pin.children[1].material.visible = false;
            }
        }
    });

    // Highlight nearest pins for each leg
    legs.forEach(leg => {
        const legPos = new THREE.Vector3();
        leg.getWorldPosition(legPos);

        let nearestPin = null;
        let minDist = Infinity;

        breadboardPins.forEach(pin => {
            const pinPos = new THREE.Vector3();
            pin.getWorldPosition(pinPos);
            const dist = legPos.distanceTo(pinPos);

            if (dist < minDist && dist < 0.5) {
                minDist = dist;
                nearestPin = pin;
            }
        });

        if (nearestPin && nearestPin.children && nearestPin.children[1]) {
            nearestPin.children[1].material.color.set(0x000000);
            nearestPin.children[1].material.visible = true;
        }
    });
}

// LED-specific snapping - snaps both legs to breadboard pins
function snapLEDToNearestPins(led) {
    // Find the LED legs in the model - use the helper objects we created
    let longLeg = null;
    let shortLeg = null;

    led.traverse((child) => {
        if (child.name === 'anode') {
            longLeg = child;
        }
        if (child.name === 'cathode') {
            shortLeg = child;
        }
    });

    if (!longLeg || !shortLeg) {
        console.warn("LED legs (anode/cathode helpers) not found");
        return;
    }

    // Get world positions of both legs
    const longLegPos = new THREE.Vector3();
    const shortLegPos = new THREE.Vector3();
    longLeg.getWorldPosition(longLegPos);
    shortLeg.getWorldPosition(shortLegPos);

    // Find nearest breadboard pins for each leg
    let nearestLongPin = null;
    let nearestShortPin = null;
    let minLongDist = Infinity;
    let minShortDist = Infinity;

    // Only snap to breadboard pins (not Arduino pins)
    const breadboardPins = pinObjects.filter(pin => {
        const root = findComponentRoot(pin);
        return root && root.userData.type === 'BREADBOARD';
    });

    breadboardPins.forEach(pin => {
        const pinPos = new THREE.Vector3();
        pin.getWorldPosition(pinPos);

        const longDist = longLegPos.distanceTo(pinPos);
        const shortDist = shortLegPos.distanceTo(pinPos);

        if (longDist < minLongDist && longDist < 0.5) {
            minLongDist = longDist;
            nearestLongPin = pin;
        }

        if (shortDist < minShortDist && shortDist < 0.5) {
            minShortDist = shortDist;
            nearestShortPin = pin;
        }
    });

    // Only snap if both legs found nearby pins and they're different pins
    if (nearestLongPin && nearestShortPin && nearestLongPin !== nearestShortPin) {
        // Get pin world positions
        const pin1Pos = new THREE.Vector3();
        const pin2Pos = new THREE.Vector3();
        nearestLongPin.getWorldPosition(pin1Pos);
        nearestShortPin.getWorldPosition(pin2Pos);

        // Calculate midpoint between the two pins
        const midpoint = new THREE.Vector3();
        midpoint.addVectors(pin1Pos, pin2Pos).multiplyScalar(0.5);

        // Snap to midpoint
        led.position.copy(midpoint);

        // Calculate rotation to align LED with pin direction
        const direction = new THREE.Vector3();
        direction.subVectors(pin2Pos, pin1Pos).normalize();

        // Calculate angle in XZ plane
        const angle = Math.atan2(direction.x, direction.z);
        led.rotation.y = angle;

        // Store snapped pins
        led.userData.snappedPins = {
            long: nearestLongPin.name,
            short: nearestShortPin.name
        };

        // Keep black circles visible on snapped pins (persistent highlight)
        if (nearestLongPin.children && nearestLongPin.children[1]) {
            nearestLongPin.children[1].material.color.set(0x000000);
            nearestLongPin.children[1].material.visible = true;
        }
        if (nearestShortPin.children && nearestShortPin.children[1]) {
            nearestShortPin.children[1].material.color.set(0x000000);
            nearestShortPin.children[1].material.visible = true;
        }

        console.log(`LED snapped: Long leg → ${nearestLongPin.name}, Short leg → ${nearestShortPin.name}`);
    } else {
        console.log("LED not close enough to breadboard pins for snapping");
    }
}

// BUTTON-specific snapping - snaps all 4 legs to breadboard pins
function snapButtonToNearestPins(button) {
    // Find the button legs in the model
    const legs = [];

    button.traverse((child) => {
        if (child.userData.isPin || (child.name && (
            child.name.toLowerCase().includes('leg') ||
            child.name.toLowerCase().includes('pin') ||
            child.name.toLowerCase().includes('terminal')
        ))) {
            legs.push(child);
            console.log('Found button leg:', child.name, 'isPin:', child.userData.isPin);
        }
    });

    console.log('Total button legs found:', legs.length);

    if (legs.length === 0) {
        console.warn("Button legs not found - checking button.userData.pins");
        // Fallback: check if pins are stored in userData
        if (button.userData.pins) {
            Object.values(button.userData.pins).forEach(pin => {
                if (pin) legs.push(pin);
            });
            console.log('Found legs from userData.pins:', legs.length);
        }
    }

    if (legs.length === 0) {
        console.warn("Button legs still not found");
        return;
    }

    // Get world positions of all legs
    const legPositions = legs.map(leg => {
        const pos = new THREE.Vector3();
        leg.getWorldPosition(pos);
        return { leg, pos };
    });

    // Only snap to breadboard pins
    const breadboardPins = pinObjects.filter(pin => {
        const root = findComponentRoot(pin);
        return root && root.userData.type === 'BREADBOARD';
    });

    // Find nearest pins for each leg
    const snappedPins = [];
    legPositions.forEach(({ leg, pos }) => {
        let nearestPin = null;
        let minDist = Infinity;

        breadboardPins.forEach(pin => {
            const pinPos = new THREE.Vector3();
            pin.getWorldPosition(pinPos);
            const dist = pos.distanceTo(pinPos);

            if (dist < minDist && dist < 0.5) {
                minDist = dist;
                nearestPin = pin;
            }
        });

        if (nearestPin) {
            snappedPins.push({ leg, pin: nearestPin });
        }
    });

    // Only snap if at least 2 legs found nearby pins
    if (snappedPins.length >= 2) {
        // Calculate average position of snapped pins
        const avgPos = new THREE.Vector3();
        snappedPins.forEach(({ pin }) => {
            const pinPos = new THREE.Vector3();
            pin.getWorldPosition(pinPos);
            avgPos.add(pinPos);
        });
        avgPos.divideScalar(snappedPins.length);

        // Snap button to average position
        button.position.copy(avgPos);

        // Store snapped pins
        button.userData.snappedPins = snappedPins.map(({ pin }) => pin.name);

        // Highlight snapped pins with black circles
        snappedPins.forEach(({ pin }) => {
            if (pin.children && pin.children[1]) {
                pin.children[1].material.color.set(0x000000);
                pin.children[1].material.visible = true;
            }
        });

        console.log(`Button snapped to ${snappedPins.length} pins:`, button.userData.snappedPins);
    } else {
        console.log("Button not close enough to breadboard pins for snapping");
    }
}

// Helper to find the root component from a raycast hit object
function findComponentRoot(obj) {
    while (obj) {
        // Check if this object has a type (it's a root component)
        if (obj.userData && obj.userData.type) {
            return obj;
        }
        // Check if this object has a reference to its parent component
        if (obj.userData && obj.userData.parentComponent) {
            return obj.userData.parentComponent;
        }
        obj = obj.parent;
    }
    return null;
}
//Update Mouse
function updateMouse(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}



// LOOP
// LOOP
// LOOP
function animate() {
    requestAnimationFrame(animate);
    controls.update();

    // Safety clamp: keep camera above the floor by a small margin
    const minCameraY = FLOOR_Y + 0.25;
    if (camera.position.y < minCameraY) {
        camera.position.y = minCameraY;
        // ensure camera doesn't clip through when we adjust y
        controls.update();
    }

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
    if (type === "BUTTON") obj = createButtonPlaceholder();
    if (type === "BREADBOARD") {
        spawnBreadboard();
        return;
    }

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

function spawnBreadboard() {
    // Show loading
    loadingOverlay.classList.remove("hidden");

    // Simulate loading delay
    setTimeout(() => {
        const breadboardLoader = new GLTFLoader();
        breadboardLoader.load('/Breadboard.glb', (gltf) => {
            const bb = gltf.scene;
            breadboard = bb; // Store global reference

            // Position it in front of camera
            breadboard.position.set(0, 0, 2);
            breadboard.scale.set(1, 1, 1);

            breadboard.userData.type = "BREADBOARD";

            scene.add(breadboard);
            components.push(breadboard);

            // Detect breadboard pins (names must start with BB_ )
            // Apply same material settings as Arduino
            // Detect breadboard pins (names must start with BB_ )
            breadboard.traverse((obj) => {
                if (obj.type === "Object3D" && (obj.name.startsWith("BB_") || obj.name.includes("GND") || obj.name.includes("VCC"))) {

                    obj.userData.isPin = true;

                    // Invisible helper sphere for raycast
                    const helper = new THREE.Mesh(
                        new THREE.SphereGeometry(0.03),
                        new THREE.MeshBasicMaterial({ visible: false })
                    );
                    obj.add(helper);

                    // Outline / hover ring
                    const ringGeo = new THREE.TorusGeometry(0.06, 0.015, 8, 16);
                    const ringMat = new THREE.MeshBasicMaterial({
                        color: 0x000000,
                        visible: false,
                        transparent: true
                    });
                    const ring = new THREE.Mesh(ringGeo, ringMat);
                    ring.rotation.x = Math.PI / 2;
                    obj.add(ring);

                    pinObjects.push(obj);
                }
            });

            // Apply same material settings as Arduino
            breadboard.traverse((child) => {
                if (child instanceof THREE.Mesh && child.material) {
                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                    child.material = materials.map((mat) => {
                        if (mat.isMeshStandardMaterial) {
                            mat.roughness = 1;
                            mat.metalness = 1;
                            mat.envMapIntensity = 1;
                            mat.needsUpdate = true;
                        }
                        return mat;
                    });
                    if (child.material.length === 1) {
                        child.material = child.material[0];
                    }
                }
            });

            // Hide loading
            // Create the rotation icon
            createBreadboardIcon(breadboard);
            // Hide loading
            loadingOverlay.classList.add("hidden");
            // Show move button
            moveBoardBtn.style.display = "block";
            console.log("Breadboard spawned");
        });
    }, 1000);
}

function updateConnectedWires(component) {
    // Find all pins belonging to this component
    const componentPins = [];
    component.traverse((child) => {
        if (child.userData.isPin) {
            componentPins.push(child);
        }
    });

    // Also check for pins in userData.pins (for placeholders)
    if (component.userData.pins) {
        Object.values(component.userData.pins).forEach(pin => {
            if (pin) componentPins.push(pin);
        });
    }

    // Update wires connected to these pins
    wires.forEach(wire => {
        const fromPin = wire.userData.fromPinObj;
        const toPin = wire.userData.toPinObj;

        if (componentPins.includes(fromPin) || componentPins.includes(toPin)) {
            updateWireGeometry(wire);
        }
    });
}
// Initialize Arduino IDE
// Initialize Arduino IDE with references to wireConnections and components
initArduinoIDE(wireConnections, components);

// Setup IDE toggle button
const ideToggleBtn = document.getElementById('ide-toggle-btn');
if (ideToggleBtn) {
    ideToggleBtn.addEventListener('click', () => {
        toggleIDE();
        ideToggleBtn.classList.toggle('ide-open');
    });
}

// ===== Wire context-menu & right-click delete helper =====

// Create a floating "Delete wire" button (lazy)
function ensureWireContextMenu() {
    if (document.getElementById('deleteWireBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'deleteWireBtn';
    btn.textContent = 'Delete wire';
    Object.assign(btn.style, {
        position: 'fixed',
        zIndex: 100000,
        display: 'none',
        padding: '8px 12px',
        background: '#c62828',
        color: '#fff',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
    });
    document.body.appendChild(btn);

    // Prevent global pointerdown from hiding the menu before this button's click runs
    btn.addEventListener('pointerdown', (ev) => {
        ev.stopPropagation();
    });

    // Click handler to delete the wire currently targeted
    btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const targetId = btn.dataset.targetWireId;
        if (typeof targetId === 'undefined') {
            hideWireContextMenu();
            return;
        }
        // Find wire object by id
        const wire = wires.find(w => String(w.userData.id) === String(targetId));
        if (wire) {
            // Reuse same deletion code path as keyboard: set selectedWire and delete
            selectedWire = wire;
            deleteSelectedWire();
        }
        hideWireContextMenu();
    });
}

// Show menu at event position for a specific wire
function showWireContextMenu(event, wire) {
    ensureWireContextMenu();
    const btn = document.getElementById('deleteWireBtn');
    if (!btn) return;
    btn.style.left = (event.clientX + 4) + 'px';
    btn.style.top = (event.clientY + 4) + 'px';
    btn.style.display = 'block';
    btn.dataset.targetWireId = String(wire.userData.id);
    // prevent native context menu when our custom menu is visible
    event.preventDefault();
}

// Hide the floating menu
function hideWireContextMenu() {
    const btn = document.getElementById('deleteWireBtn');
    if (!btn) return;
    btn.style.display = 'none';
    delete btn.dataset.targetWireId;
}

// Remove a wire object safely (reused by both Delete key and context menu)
function deleteWireObject(wire) {
    if (!wire || !wire.userData || !wire.userData.id) return;

    // Capture pins
    const fromPin = wire.userData.fromPinObj;
    const toPin = wire.userData.toPinObj;

    // Remove endpoint helpers
    if (wire.userData.fromHelper) {
        scene.remove(wire.userData.fromHelper);
        wireEndpointHelpers = wireEndpointHelpers.filter(h => h !== wire.userData.fromHelper);
    }
    if (wire.userData.toHelper) {
        scene.remove(wire.userData.toHelper);
        wireEndpointHelpers = wireEndpointHelpers.filter(h => h !== wire.userData.toHelper);
    }

    // Dispose geometry & material
    try { wire.geometry.dispose(); } catch (e) { }
    try { if (wire.material) wire.material.dispose(); } catch (e) { }

    // Remove from connection map and wires array
    wireConnections = wireConnections.filter(w => w.id !== wire.userData.id);
    wires = wires.filter(w => w.userData.id !== wire.userData.id);

    // Remove from scene
    if (wire.parent) {
        wire.parent.remove(wire);
    } else {
        scene.remove(wire);
    }

    // If this was selectedWire, clear selection state
    if (selectedWire === wire) {
        selectedWire = null;
    }

    // Refresh pin outlines for both endpoints
    refreshPinHighlight(fromPin);
    refreshPinHighlight(toPin);

    console.log("Wire deleted via context menu:", wire.userData.id, "UPDATED CONNECTION MAP:", wireConnections);
}

// NEW: unify deletion logic for selectedWire so both Delete key and button use same behavior
function deleteSelectedWire() {
    if (!selectedWire) return;

    const id = selectedWire.userData.id;

    // Capture pins before removal to refresh their state afterwards
    const fromPinObj = selectedWire.userData.fromPinObj;
    const toPinObj = selectedWire.userData.toPinObj;

    // Remove endpoint helpers
    if (selectedWire.userData.fromHelper) {
        scene.remove(selectedWire.userData.fromHelper);
        wireEndpointHelpers = wireEndpointHelpers.filter(h => h !== selectedWire.userData.fromHelper);
    }
    if (selectedWire.userData.toHelper) {
        scene.remove(selectedWire.userData.toHelper);
        wireEndpointHelpers = wireEndpointHelpers.filter(h => h !== selectedWire.userData.toHelper);
    }

    // Dispose geometry/material safely
    try { selectedWire.geometry.dispose(); } catch (err) { }
    try { if (selectedWire.material) selectedWire.material.dispose(); } catch (err) { }

    // Remove from connection map and wires array
    wireConnections = wireConnections.filter(w => w.id !== id);
    wires = wires.filter(w => w.userData.id !== id);

    // Remove from scene
    if (selectedWire.parent) {
        selectedWire.parent.remove(selectedWire);
    } else {
        scene.remove(selectedWire);
    }

    // Clear selection
    selectedWire = null;

    // Refresh outline state on both pins (will hide if no other wire remains)
    refreshPinHighlight(fromPinObj);
    refreshPinHighlight(toPinObj);

    console.log("UPDATED CONNECTION MAP:", wireConnections);
}

// Right-click handler: show delete button when a wire is under cursor
window.addEventListener('contextmenu', (e) => {
    // Prevent native menu if we're over a wire
    updateMouse(e);
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(wires, true);
    if (intersects.length > 0) {
        // Ensure we target the top-level wire mesh (in case a child was hit)
        let obj = intersects[0].object;
        while (obj && !(obj.userData && obj.userData.isWire)) {
            obj = obj.parent;
        }
        if (obj) {
            showWireContextMenu(e, obj);
            return;
        }
    }
    // hide if clicked elsewhere
    hideWireContextMenu();
});

// Hide menu on any left-click or when the user scrolls/resizes
window.addEventListener('pointerdown', (e) => {
    // Only hide if left-click and the click is outside the floating delete button
    if (e.button === 0) {
        const btn = document.getElementById('deleteWireBtn');
        if (btn && btn.style.display === 'block') {
            // If click target is not inside our button, hide; otherwise let the button's own handlers run
            if (!btn.contains(e.target)) hideWireContextMenu();
        }
    }
});
window.addEventListener('wheel', hideWireContextMenu);
window.addEventListener('resize', hideWireContextMenu);
window.addEventListener('scroll', hideWireContextMenu);


function saveStateToLocalStorage() {
    try {
        const state = {
            components: components.map(comp => {
                // Clean userData to avoid circular references
                const cleanUserData = {
                    type: comp.userData.type,
                    snappedPins: comp.userData.snappedPins,
                    // Don't save the 'pins' object as it contains Three.js object references
                };

                return {
                    type: comp.userData.type,
                    position: { x: comp.position.x, y: comp.position.y, z: comp.position.z },
                    rotation: { x: comp.rotation.x, y: comp.rotation.y, z: comp.rotation.z },
                    scale: { x: comp.scale.x, y: comp.scale.y, z: comp.scale.z },
                    userData: cleanUserData
                };
            }),
            wires: wires.map(wire => ({
                id: wire.userData.id,
                fromPin: wire.userData.fromPin,
                toPin: wire.userData.toPin,
                color: wire.userData.color
            })),
            wireConnections: wireConnections,
            arduinoCode: getEditorInstance() ? getEditorInstance().getValue() : ''
        };

        localStorage.setItem('gamewise_board_state', JSON.stringify(state));
        console.log('✅ State saved to localStorage');
    } catch (error) {
        console.error('❌ Error saving state:', error);
    }
}

function loadStateFromLocalStorage() {
    try {
        const savedState = localStorage.getItem('gamewise_board_state');
        if (!savedState) {
            console.log('No saved state found');
            return false;
        }

        const state = JSON.parse(savedState);

        // Clear current scene
        clearScene();

        // Restore components
        state.components.forEach(compData => {
            let comp = null;

            if (compData.type === 'BREADBOARD') {
                // Spawn breadboard
                loadingOverlay.classList.remove("hidden");
                const breadboardLoader = new GLTFLoader();
                breadboardLoader.load('/Breadboard.glb', (gltf) => {
                    const bb = gltf.scene;
                    breadboard = bb;

                    bb.position.set(compData.position.x, compData.position.y, compData.position.z);
                    bb.rotation.set(compData.rotation.x, compData.rotation.y, compData.rotation.z);
                    bb.scale.set(compData.scale.x, compData.scale.y, compData.scale.z);
                    bb.userData = compData.userData;

                    scene.add(bb);
                    components.push(bb);

                    // Detect breadboard pins
                    bb.traverse((obj) => {
                        if (obj.type === "Object3D" && (obj.name.startsWith("BB_") || obj.name.includes("GND") || obj.name.includes("VCC"))) {
                            obj.userData.isPin = true;

                            const helper = new THREE.Mesh(
                                new THREE.SphereGeometry(0.03),
                                new THREE.MeshBasicMaterial({ visible: false })
                            );
                            obj.add(helper);

                            const ringGeo = new THREE.TorusGeometry(0.06, 0.015, 8, 16);
                            const ringMat = new THREE.MeshBasicMaterial({
                                color: 0x000000,
                                visible: false,
                                transparent: true
                            });
                            const ring = new THREE.Mesh(ringGeo, ringMat);
                            ring.rotation.x = Math.PI / 2;
                            obj.add(ring);

                            pinObjects.push(obj);
                        }
                    });

                    // Apply materials
                    bb.traverse((child) => {
                        if (child instanceof THREE.Mesh && child.material) {
                            const materials = Array.isArray(child.material) ? child.material : [child.material];
                            child.material = materials.map((mat) => {
                                if (mat.isMeshStandardMaterial) {
                                    mat.roughness = 1;
                                    mat.metalness = 1;
                                    mat.envMapIntensity = 1;
                                    mat.needsUpdate = true;
                                }
                                return mat;
                            });
                            if (child.material.length === 1) {
                                child.material = child.material[0];
                            }
                        }
                    });

                    createBreadboardIcon(bb);
                    loadingOverlay.classList.add("hidden");
                    moveBoardBtn.style.display = "block";

                    console.log('Breadboard loaded, restoring wires...');
                    // Restore wires after breadboard is loaded
                    setTimeout(() => {
                        if (state.wires && state.wires.length > 0) {
                            state.wires.forEach(wireData => {
                                const fromPin = pinObjects.find(p => p.name === wireData.fromPin);
                                const toPin = pinObjects.find(p => p.name === wireData.toPin);

                                if (fromPin && toPin) {
                                    drawWire(fromPin, toPin, wireData.color);
                                    console.log(`Wire restored: ${wireData.fromPin} -> ${wireData.toPin}`);
                                } else {
                                    console.warn(`Could not restore wire: ${wireData.fromPin} -> ${wireData.toPin}`);
                                }
                            });

                            if (state.wireConnections) {
                                wireConnections = state.wireConnections;
                            }
                            console.log('✅ Wires restored');
                        }
                    }, 800);
                });
            }
            else if (compData.type === 'LED') {
                comp = createLEDPlaceholder();
                comp.position.set(compData.position.x, compData.position.y, compData.position.z);
                comp.rotation.set(compData.rotation.x, compData.rotation.y, compData.rotation.z);
                comp.userData = compData.userData;

                scene.add(comp);
                components.push(comp);

                // Restore LED pin highlights if it was snapped
                if (compData.userData.snappedPins) {
                    setTimeout(() => {
                        const longPin = pinObjects.find(p => p.name === compData.userData.snappedPins.long);
                        const shortPin = pinObjects.find(p => p.name === compData.userData.snappedPins.short);

                        if (longPin && longPin.children && longPin.children[1]) {
                            longPin.children[1].material.color.set(0x000000);
                            longPin.children[1].material.visible = true;
                        }
                        if (shortPin && shortPin.children && shortPin.children[1]) {
                            shortPin.children[1].material.color.set(0x000000);
                            shortPin.children[1].material.visible = true;
                        }
                        console.log(`LED snapping restored: ${compData.userData.snappedPins.long} & ${compData.userData.snappedPins.short}`);
                    }, 1000);
                }
            }
            else if (compData.type === 'BUTTON') {
                comp = createButtonPlaceholder();
                comp.position.set(compData.position.x, compData.position.y, compData.position.z);
                comp.rotation.set(compData.rotation.x, compData.rotation.y, compData.rotation.z);
                comp.userData = compData.userData;

                scene.add(comp);
                components.push(comp);

                // Restore BUTTON pin highlights if it was snapped
                if (compData.userData.snappedPins && Array.isArray(compData.userData.snappedPins)) {
                    setTimeout(() => {
                        compData.userData.snappedPins.forEach(pinName => {
                            const pin = pinObjects.find(p => p.name === pinName);
                            if (pin && pin.children && pin.children[1]) {
                                pin.children[1].material.color.set(0x000000);
                                pin.children[1].material.visible = true;
                            }
                        });
                        console.log(`Button snapping restored: ${compData.userData.snappedPins.length} pins`);
                    }, 1000);
                }

                console.log('Button restored at', comp.position);
            }
            else if (compData.type === 'RESISTOR') {
                comp = createResistorPlaceholder();
                comp.position.set(compData.position.x, compData.position.y, compData.position.z);
                comp.rotation.set(compData.rotation.x, compData.rotation.y, compData.rotation.z);
                comp.userData = compData.userData;

                scene.add(comp);
                components.push(comp);
            }
        });

        // Restore Arduino code
        const editor = getEditorInstance();
        if (state.arduinoCode && editor) {
            editor.setValue(state.arduinoCode);
        }

        console.log('✅ State loaded from localStorage');
        return true;
    } catch (error) {
        console.error('❌ Error loading state:', error);
        return false;
    }
}


function clearScene() {
    // Remove all components
    components.forEach(comp => {
        scene.remove(comp);
    });
    components = [];

    // Remove all wires
    wires.forEach(wire => {
        if (wire.userData.fromHelper) scene.remove(wire.userData.fromHelper);
        if (wire.userData.toHelper) scene.remove(wire.userData.toHelper);
        scene.remove(wire);
    });
    wires = [];
    wireConnections = [];

    // Clear ONLY breadboard pins, keep Arduino pins
    pinObjects = pinObjects.filter(pin => {
        // Keep pins that belong to Arduino (start with "Pin_")
        return pin.name && pin.name.startsWith("Pin_");
    });

    // Reset breadboard
    breadboard = null;
    moveBoardBtn.style.display = "none";

    console.log('Scene cleared, Arduino pins preserved');
}


// Export for manual save/load buttons (optional)
window.saveState = saveStateToLocalStorage;
window.loadState = loadStateFromLocalStorage;
window.clearState = () => {
    localStorage.removeItem('gamewise_board_state');
    clearScene();
    console.log('✅ State cleared');
};

initMenuBar(
    // Save callback - returns current state
    () => {
        const state = {
            components: components.map(comp => {
                // Clean userData to avoid circular references
                const cleanUserData = {
                    type: comp.userData.type,
                    snappedPins: comp.userData.snappedPins,
                    // Don't save the 'pins' object as it contains Three.js object references
                };

                return {
                    type: comp.userData.type,
                    position: { x: comp.position.x, y: comp.position.y, z: comp.position.z },
                    rotation: { x: comp.rotation.x, y: comp.rotation.y, z: comp.rotation.z },
                    scale: { x: comp.scale.x, y: comp.scale.y, z: comp.scale.z },
                    userData: cleanUserData
                };
            }),
            wires: wires.map(wire => ({
                id: wire.userData.id,
                fromPin: wire.userData.fromPin,
                toPin: wire.userData.toPin,
                color: wire.userData.color
            })),
            wireConnections: wireConnections,
            arduinoCode: getEditorInstance() ? getEditorInstance().getValue() : ''
        };
        return state;
    },
    // Load callback - loads state from file
    // Load callback - loads state from file
    (state) => {
        console.log('Loading state:', state);
        clearScene();

        let breadboardLoaded = false;

        // Restore components
        state.components.forEach(compData => {
            let comp = null;

            if (compData.type === 'BREADBOARD') {
                breadboardLoaded = true;
                const breadboardLoader = new GLTFLoader();
                breadboardLoader.load('/Breadboard.glb', (gltf) => {
                    const bb = gltf.scene;
                    breadboard = bb;

                    bb.position.set(compData.position.x, compData.position.y, compData.position.z);
                    bb.rotation.set(compData.rotation.x, compData.rotation.y, compData.rotation.z);
                    bb.scale.set(compData.scale.x, compData.scale.y, compData.scale.z);
                    bb.userData = compData.userData;

                    scene.add(bb);
                    components.push(bb);

                    bb.traverse((obj) => {
                        if (obj.type === "Object3D" && (obj.name.startsWith("BB_") || obj.name.includes("GND") || obj.name.includes("VCC"))) {
                            obj.userData.isPin = true;

                            const helper = new THREE.Mesh(
                                new THREE.SphereGeometry(0.03),
                                new THREE.MeshBasicMaterial({ visible: false })
                            );
                            obj.add(helper);

                            const ringGeo = new THREE.TorusGeometry(0.06, 0.015, 8, 16);
                            const ringMat = new THREE.MeshBasicMaterial({
                                color: 0x000000,
                                visible: false,
                                transparent: true
                            });
                            const ring = new THREE.Mesh(ringGeo, ringMat);
                            ring.rotation.x = Math.PI / 2;
                            obj.add(ring);

                            pinObjects.push(obj);
                        }
                    });

                    bb.traverse((child) => {
                        if (child instanceof THREE.Mesh && child.material) {
                            const materials = Array.isArray(child.material) ? child.material : [child.material];
                            child.material = materials.map((mat) => {
                                if (mat.isMeshStandardMaterial) {
                                    mat.roughness = 1;
                                    mat.metalness = 1;
                                    mat.envMapIntensity = 1;
                                    mat.needsUpdate = true;
                                }
                                return mat;
                            });
                            if (child.material.length === 1) {
                                child.material = child.material[0];
                            }
                        }
                    });

                    createBreadboardIcon(bb);
                    moveBoardBtn.style.display = "block";

                    console.log('Breadboard loaded, restoring wires...');
                    // Restore wires after breadboard is loaded
                    setTimeout(() => {
                        if (state.wires && state.wires.length > 0) {
                            state.wires.forEach(wireData => {
                                const fromPin = pinObjects.find(p => p.name === wireData.fromPin);
                                const toPin = pinObjects.find(p => p.name === wireData.toPin);

                                if (fromPin && toPin) {
                                    drawWire(fromPin, toPin, wireData.color);
                                    console.log(`Wire restored: ${wireData.fromPin} -> ${wireData.toPin}`);
                                } else {
                                    console.warn(`Could not restore wire: ${wireData.fromPin} -> ${wireData.toPin}`);
                                }
                            });

                            if (state.wireConnections) {
                                wireConnections = state.wireConnections;
                            }
                            console.log('✅ Wires restored');
                        }
                    }, 800);
                });
            }
            else if (compData.type === 'LED') {
                comp = createLEDPlaceholder();
                comp.position.set(compData.position.x, compData.position.y, compData.position.z);
                comp.rotation.set(compData.rotation.x, compData.rotation.y, compData.rotation.z);
                comp.userData = compData.userData;

                scene.add(comp);
                components.push(comp);

                // Restore LED pin highlights if it was snapped
                if (compData.userData.snappedPins) {
                    setTimeout(() => {
                        const longPin = pinObjects.find(p => p.name === compData.userData.snappedPins.long);
                        const shortPin = pinObjects.find(p => p.name === compData.userData.snappedPins.short);

                        if (longPin && longPin.children && longPin.children[1]) {
                            longPin.children[1].material.color.set(0x000000);
                            longPin.children[1].material.visible = true;
                        }
                        if (shortPin && shortPin.children && shortPin.children[1]) {
                            shortPin.children[1].material.color.set(0x000000);
                            shortPin.children[1].material.visible = true;
                        }
                        console.log(`LED snapping restored: ${compData.userData.snappedPins.long} & ${compData.userData.snappedPins.short}`);
                    }, 1000);
                }

                console.log('LED restored at', comp.position);
            }
            else if (compData.type === 'BUTTON') {
                comp = createButtonPlaceholder();
                comp.position.set(compData.position.x, compData.position.y, compData.position.z);
                comp.rotation.set(compData.rotation.x, compData.rotation.y, compData.rotation.z);
                comp.userData = compData.userData;

                scene.add(comp);
                components.push(comp);

                // Restore BUTTON pin highlights if it was snapped
                if (compData.userData.snappedPins && Array.isArray(compData.userData.snappedPins)) {
                    setTimeout(() => {
                        compData.userData.snappedPins.forEach(pinName => {
                            const pin = pinObjects.find(p => p.name === pinName);
                            if (pin && pin.children && pin.children[1]) {
                                pin.children[1].material.color.set(0x000000);
                                pin.children[1].material.visible = true;
                            }
                        });
                        console.log(`Button snapping restored: ${compData.userData.snappedPins.length} pins`);
                    }, 1000);
                }
            }
            else if (compData.type === 'RESISTOR') {
                comp = createResistorPlaceholder();
                comp.position.set(compData.position.x, compData.position.y, compData.position.z);
                comp.rotation.set(compData.rotation.x, compData.rotation.y, compData.rotation.z);
                comp.userData = compData.userData;

                scene.add(comp);
                components.push(comp);
                console.log('Resistor restored at', comp.position);
            }
        });

        // Restore Arduino code - wait for editor to be ready
        if (state.arduinoCode) {
            const trySetCode = () => {
                const editor = getEditorInstance();
                if (editor) {
                    editor.setValue(state.arduinoCode);
                    console.log('✅ Arduino code restored');
                } else {
                    // Editor not ready yet, try again
                    setTimeout(trySetCode, 500);
                }
            };
            setTimeout(trySetCode, 1000);
        }
    },
    // Clear callback
    () => {
        clearScene();
    }
);


// ===== MANUAL SNAP FEATURE (A key) =====

const manualSnapModal = document.getElementById('manualSnapModal');
const modalTitle = document.getElementById('modalTitle');
const modalSubtitle = document.getElementById('modalSubtitle');
const modalInputs = document.getElementById('modalInputs');
const modalSnapBtn = document.getElementById('modalSnapBtn');
const modalCancelBtn = document.getElementById('modalCancelBtn');
const modalError = document.getElementById('modalError');

let currentSnapComponent = null;

// A key to open manual snap modal
window.addEventListener('keydown', (e) => {
    if (e.key === 'a' || e.key === 'A') {
        if (selectedComponent && (selectedComponent.userData.type === 'LED' || selectedComponent.userData.type === 'BUTTON')) {
            openManualSnapModal(selectedComponent);
        }
    }
});

function openManualSnapModal(component) {
    // Check if breadboard exists
    if (!breadboard) {
        alert('⚠️ Breadboard not spawned! Please add a breadboard first.');
        return;
    }

    currentSnapComponent = component;
    const type = component.userData.type;

    // Set title
    modalTitle.textContent = `Snap ${type} to Breadboard Pins`;

    // Create input fields based on component type
    modalInputs.innerHTML = '';

    if (type === 'LED') {
        modalInputs.innerHTML = `
            <div class="modal-input-group">
                <label>Anode (Long Leg) Pin:</label>
                <input type="text" id="input_anode" placeholder="e.g., A1, B5, VCC1" />
            </div>
            <div class="modal-input-group">
                <label>Cathode (Short Leg) Pin:</label>
                <input type="text" id="input_cathode" placeholder="e.g., A2, GND1" />
            </div>
        `;
    } else if (type === 'BUTTON') {
        modalInputs.innerHTML = `
            <div class="modal-input-group">
                <label>Leg 1 Pin:</label>
                <input type="text" id="input_leg1" placeholder="e.g., A1" />
            </div>
            <div class="modal-input-group">
                <label>Leg 2 Pin:</label>
                <input type="text" id="input_leg2" placeholder="e.g., A3" />
            </div>
            <div class="modal-input-group">
                <label>Leg 3 Pin:</label>
                <input type="text" id="input_leg3" placeholder="e.g., D1" />
            </div>
            <div class="modal-input-group">
                <label>Leg 4 Pin:</label>
                <input type="text" id="input_leg4" placeholder="e.g., D3" />
            </div>
        `;
    }

    modalError.style.display = 'none';
    manualSnapModal.style.display = 'flex';

    // Focus first input
    setTimeout(() => {
        const firstInput = modalInputs.querySelector('input');
        if (firstInput) firstInput.focus();
    }, 100);
}

// Cancel button
modalCancelBtn.addEventListener('click', () => {
    manualSnapModal.style.display = 'none';
    currentSnapComponent = null;
});

// Snap button
modalSnapBtn.addEventListener('click', () => {
    if (!currentSnapComponent) return;

    const type = currentSnapComponent.userData.type;
    const pinNames = [];
    const inputs = modalInputs.querySelectorAll('input');

    // Collect pin names and add BB_ prefix
    inputs.forEach(input => {
        let pinName = input.value.trim().toUpperCase();
        // Auto-add BB_ prefix if not already present
        if (!pinName.startsWith('BB_') && !pinName.startsWith('PIN_')) {
            pinName = 'BB_' + pinName;
        }
        pinNames.push(pinName);
    });

    // Validate pin names
    const validPins = [];
    for (const pinName of pinNames) {
        if (!pinName) {
            showModalError('Please fill in all pin fields');
            return;
        }

        // Find the pin in pinObjects
        const pin = pinObjects.find(p => p.name === pinName);
        if (!pin) {
            showModalError(`Pin "${pinName}" not found. Check breadboard pin names.`);
            return;
        }

        // Check if pin belongs to breadboard
        const root = findComponentRoot(pin);
        if (!root || root.userData.type !== 'BREADBOARD') {
            showModalError(`Pin "${pinName}" is not a breadboard pin`);
            return;
        }

        validPins.push(pin);
    }

    // All pins valid - snap the component
    if (type === 'LED') {
        manualSnapLED(currentSnapComponent, validPins[0], validPins[1]);
    } else if (type === 'BUTTON') {
        manualSnapButton(currentSnapComponent, validPins);
    }

    manualSnapModal.style.display = 'none';
    currentSnapComponent = null;
});

function showModalError(message) {
    modalError.textContent = message;
    modalError.style.display = 'block';
}

function manualSnapLED(led, anodePin, cathodePin) {
    const p1 = new THREE.Vector3();
    const p2 = new THREE.Vector3();
    anodePin.getWorldPosition(p1);
    cathodePin.getWorldPosition(p2);

    // Position LED at midpoint
    const midpoint = p1.clone().lerp(p2, 0.5);
    led.position.copy(midpoint);

    // Calculate rotation to align with pins
    const direction = new THREE.Vector3().subVectors(p2, p1);
    const angle = Math.atan2(direction.x, direction.z);
    led.rotation.y = angle;

    // Store snapped pins
    led.userData.snappedPins = {
        long: anodePin.name,
        short: cathodePin.name
    };

    // Highlight pins
    if (anodePin.children && anodePin.children[1]) {
        anodePin.children[1].material.color.set(0x000000);
        anodePin.children[1].material.visible = true;
    }
    if (cathodePin.children && cathodePin.children[1]) {
        cathodePin.children[1].material.color.set(0x000000);
        cathodePin.children[1].material.visible = true;
    }

    console.log(`✅ LED manually snapped to ${anodePin.name} & ${cathodePin.name}`);
}

function manualSnapButton(button, pins) {
    // Calculate average position
    const avgPos = new THREE.Vector3();
    pins.forEach(pin => {
        const pos = new THREE.Vector3();
        pin.getWorldPosition(pos);
        avgPos.add(pos);
    });
    avgPos.divideScalar(pins.length);

    // Snap button
    button.position.copy(avgPos);

    // Store snapped pins
    button.userData.snappedPins = pins.map(p => p.name);

    // Highlight pins
    pins.forEach(pin => {
        if (pin.children && pin.children[1]) {
            pin.children[1].material.color.set(0x000000);
            pin.children[1].material.visible = true;
        }
    });

    console.log(`✅ Button manually snapped to ${pins.length} pins:`, button.userData.snappedPins);
}