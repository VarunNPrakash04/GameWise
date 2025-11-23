/**
 * LED Rotation Module
 * Handles mouse-controlled rotation of the LED via R key
 * Supports 360-degree rotation with camera locking
 */

// State
let isRotationMode = false; // Track if R key is held
let previousMouseX = 0;
let previousMouseY = 0;
let selectedLED = null; // Track which LED is being rotated

/**
 * Enable rotation mode (R key pressed)
 * @param {THREE.Object3D} led - The LED to rotate
 * @param {number} mouseX - Current mouse X position
 * @param {number} mouseY - Current mouse Y position
 */
export function startLEDRotation(led, mouseX, mouseY) {
    isRotationMode = true;
    selectedLED = led;
    previousMouseX = mouseX;
    previousMouseY = mouseY;
    console.log("LED rotation mode ON (R key held)");
}

/**
 * Disable rotation mode (R key released)
 */
export function stopLEDRotation() {
    isRotationMode = false;
    selectedLED = null;
    console.log("LED rotation mode OFF (R key released)");
}

/**
 * Update rotation based on mouse movement (360-degree rotation on all axes)
 * @param {number} mouseX - Current mouse X position
 * @param {number} mouseY - Current mouse Y position
 * @param {Function} updateWiresCallback - Callback to update connected wires
 */
export function updateLEDMouseRotation(mouseX, mouseY, updateWiresCallback) {
    if (isRotationMode && selectedLED) {
        const deltaX = mouseX - previousMouseX;
        const deltaY = mouseY - previousMouseY;

        // Multi-axis rotation for globe-like behavior
        // Horizontal mouse movement rotates around Y-axis (left-right)
        selectedLED.rotation.y += deltaX * 0.01;

        // Vertical mouse movement rotates around X-axis (up-down)
        selectedLED.rotation.x -= deltaY * 0.01; // Negative for natural feel

        previousMouseX = mouseX;
        previousMouseY = mouseY;

        // Update connected wires
        if (updateWiresCallback) {
            updateWiresCallback(selectedLED);
        }
    }
}

/**
 * Check if currently in rotation mode
 */
export function isLEDRotating() {
    return isRotationMode;
}

/**
 * Get the currently selected LED
 */
export function getSelectedLED() {
    return selectedLED;
}