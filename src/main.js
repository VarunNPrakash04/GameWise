import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { initShuffle } from './Shuffle.js';

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
scene.background = new THREE.Color(0x1a1a1a); // Darker background for Material Preview mode
scene.fog = new THREE.Fog(0x1a1a1a, 15, 60); // Subtle fog for depth

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(5, 4, 6);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = false; // Disable shadows for Material Preview mode
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.4; // Slightly higher exposure for more vibrant colors
document.body.appendChild(renderer.domElement);
renderer.domElement.style.cursor = 'pointer';

// CONTROLS
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

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

// GROUND PLANE with grid texture (very prominent - Material Preview style)
function createGridTexture(size = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    
    // Fill with darker background for maximum contrast
    context.fillStyle = '#0f0f0f';
    context.fillRect(0, 0, size, size);
    
    // Draw very prominent grid lines (like Blender's Material Preview)
    context.strokeStyle = '#707070'; // Much brighter grid lines
    context.lineWidth = 2; // Thicker lines for visibility
    
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
    
    // Add very bright center lines for reference (like Blender)
    context.strokeStyle = '#a0a0a0'; // Very bright center lines
    context.lineWidth = 2.5; // Even thicker center lines
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
    color: 0x151515, // Darker base for maximum grid contrast
    map: gridTexture,
    roughness: 0.6,
    metalness: 0.05,
    emissive: 0x000000,
    emissiveIntensity: 0
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -2;
ground.receiveShadow = false; // No shadows in Material Preview mode
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

// LOAD BREADBOARD MODEL
const breadboardLoader = new GLTFLoader();
breadboardLoader.load('/Breadboard.glb', (gltf) => {
    const breadboard = gltf.scene;

    // Position it next to the Arduino
    breadboard.position.set(3, 0, 0);  // move right side
    breadboard.scale.set(1, 1, 1);

    scene.add(breadboard);

    // Detect breadboard pins (names must start with BB_ )
    breadboard.traverse((obj) => {
        if (obj.type === "Object3D" && obj.name.startsWith("BB_")) {

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
                color: 0xffffff,
                visible: false,
                transparent: true
            });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.rotation.x = Math.PI / 2;
            obj.add(ring);

            pinObjects.push(obj);
        }
    });

    console.log("Breadboard pins loaded:", pinObjects.map(p => p.name));
});

    
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
                            color: originalColor, // Preserve original color
                            map: oldMat.map || null, // Preserve texture map
                            normalMap: oldMat.normalMap || null,
                            roughness: 0.3, // Lower roughness for Material Preview (more reflective, like Blender)
                            metalness: 0.5, // Moderate metalness for better material preview
                            envMap: envMap, // Apply environment map for Material Preview
                            envMapIntensity: 1.0, // Reduced to preserve material colors (was 1.6)
                            side: THREE.FrontSide
                        });
                        return newMat;
                    } else {
                        // If already StandardMaterial, adjust for Material Preview mode
                        // Preserve original color - don't override it
                        if (!oldMat.color) {
                            oldMat.color = new THREE.Color(originalColor);
                        }
                        oldMat.roughness = Math.min(oldMat.roughness || 0.5, 0.35); // Lower for more reflection
                        oldMat.metalness = Math.max(oldMat.metalness || 0.3, 0.4);
                        oldMat.envMap = envMap; // Apply environment map
                        oldMat.envMapIntensity = oldMat.envMapIntensity || 1.0; // Reduced to preserve colors
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
        // Get mouse position in 3D space (project onto a plane)
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
                    // Reset previous target pin
                    targetPin.children[0].material.color.set(0xffffff);
                    if (targetPin.children[1]) {
                        targetPin.children[1].material.visible = false;
                    }
                }
                
                targetPin = pin;
                pin.children[0].material.color.set(0x00ff00); // Green for target
                if (pin.children[1]) {
                    pin.children[1].material.visible = true;
                    pin.children[1].material.color.set(0x00ff00);
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
                        targetPin.children[1].material.visible = false;
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
                    targetPin.children[1].material.visible = false;
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
                draggingWireFromPin.children[1].material.visible = false;
            }
        }
        
        // Reset target pin if any
        if (targetPin) {
            targetPin.children[0].material.color.set(0xffffff);
            if (targetPin.children[1]) {
                targetPin.children[1].material.visible = false;
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
            
            console.log("Wire reconnected:", connection);
        } else {
            // If not dropped on a pin, revert to original position
            updateWireGeometry(wire);
        }
        
        draggingWireEndpoint = null;
    }
    
    // Always re-enable OrbitControls when pointer is released
    if (!controls.enabled) {
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
function drawWire(pin1, pin2) {
    const p1 = new THREE.Vector3();
    const p2 = new THREE.Vector3();
    pin1.getWorldPosition(p1);
    pin2.getWorldPosition(p2);

    const mid = p1.clone().lerp(p2, 0.5);
    mid.y += 0.3;

    const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2);
    
    // Use TubeGeometry for thicker, 3D wires
    const geometry = new THREE.TubeGeometry(curve, WIRE_TUBULAR_SEGMENTS, WIRE_RADIUS, WIRE_RADIAL_SEGMENTS, false);
    const color = parseInt(wireColorPicker.value);

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
        // Delete selected wire
        if (selectedWire) {
            const id = selectedWire.userData.id;
        
            // Remove endpoint helpers
            if (selectedWire.userData.fromHelper) {
                scene.remove(selectedWire.userData.fromHelper);
                wireEndpointHelpers = wireEndpointHelpers.filter(h => h !== selectedWire.userData.fromHelper);
            }
            if (selectedWire.userData.toHelper) {
                scene.remove(selectedWire.userData.toHelper);
                wireEndpointHelpers = wireEndpointHelpers.filter(h => h !== selectedWire.userData.toHelper);
            }
            
            // Dispose geometry
            selectedWire.geometry.dispose();
            selectedWire.material.dispose();
            
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
                draggingWireFromPin.children[1].material.visible = false;
            }
        }
        
        // Reset target pin if any
        if (targetPin) {
            targetPin.children[0].material.color.set(0xffffff);
            if (targetPin.children[1]) {
                targetPin.children[1].material.visible = false;
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
            
            console.log("Wire reconnected:", connection);
        } else {
            // If not dropped on a pin, revert to original position
            updateWireGeometry(wire);
        }
        
        draggingWireEndpoint = null;
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
