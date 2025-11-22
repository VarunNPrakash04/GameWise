import * as THREE from 'three';

/**
 * Breadboard Rotation Module
 * Handles mouse-controlled rotation of the breadboard via a draggable icon
 */

// State
let breadboardIcon = null;
let isDraggingIcon = false;
let previousMouseX = 0;

/**
 * Creates a rotation arrow icon attached to the breadboard
 * @param {THREE.Object3D} breadboard - The breadboard object
 * @returns {THREE.Group} The created icon group
 */
export function createBreadboardIcon(breadboard) {
    // Create a group to hold the rotation icon parts
    const iconGroup = new THREE.Group();

    // Grey material for the rotation symbol
    const iconMaterial = new THREE.MeshStandardMaterial({
        color: 0x888888,
        emissive: 0x444444,
        emissiveIntensity: 0.3,
        roughness: 0.4,
        metalness: 0.6
    });

    // Create a curved torus (3/4 circle) for the rotation arrow
    const ringGeometry = new THREE.TorusGeometry(0.1, 0.015, 8, 24, Math.PI * 1.5);
    const ring = new THREE.Mesh(ringGeometry, iconMaterial);
    ring.rotation.x = Math.PI / 2;
    iconGroup.add(ring);

    // Create arrow head (small cone)
    const arrowGeometry = new THREE.ConeGeometry(0.035, 0.07, 8);
    const arrow = new THREE.Mesh(arrowGeometry, iconMaterial.clone());
    arrow.rotation.z = -Math.PI / 2;
    arrow.position.set(0.1, 0, 0);
    iconGroup.add(arrow);

    breadboardIcon = iconGroup;

    // Position the icon at the end of the breadboard
    breadboardIcon.position.set(2, 0.2, 0);

    // Mark it for raycasting
    breadboardIcon.userData.isRotationIcon = true;
    breadboardIcon.userData.breadboard = breadboard;

    // Add the icon as a child of the breadboard so it moves with it
    breadboard.add(breadboardIcon);

    console.log("Breadboard rotation icon created");
    return breadboardIcon;
}

/**
 * Removes the breadboard icon
 */
export function removeBreadboardIcon(breadboard) {
    if (breadboardIcon && breadboard) {
        breadboard.remove(breadboardIcon);
        breadboardIcon.geometry.dispose();
        breadboardIcon.material.dispose();
        breadboardIcon = null;
        console.log("Breadboard icon removed");
    }
}

/**
 * Start dragging the rotation icon
 * @param {number} mouseX - Current mouse X position
 */
export function startIconDrag(mouseX) {
    isDraggingIcon = true;
    previousMouseX = mouseX;
    console.log("Started dragging rotation icon");
}

/**
 * Stop dragging the rotation icon
 */
export function stopIconDrag() {
    isDraggingIcon = false;
    console.log("Stopped dragging rotation icon");
}

/**
 * Update rotation based on mouse movement
 * @param {THREE.Object3D} breadboard - The breadboard object to rotate
 * @param {number} mouseX - Current mouse X position
 * @param {Function} updateWiresCallback - Callback to update connected wires
 */
export function updateMouseRotation(breadboard, mouseX, updateWiresCallback) {
    if (isDraggingIcon && breadboard) {
        const deltaX = mouseX - previousMouseX;
        // Rotate based on mouse movement (adjust sensitivity with multiplier)
        breadboard.rotation.y += deltaX * 0.01;
        previousMouseX = mouseX;

        // Update connected wires
        if (updateWiresCallback) {
            updateWiresCallback(breadboard);
        }
    }
}

/**
 * Check if currently dragging the icon
 */
export function isIconDragging() {
    return isDraggingIcon;
}

/**
 * Get the icon mesh
 */
export function getIcon() {
    return breadboardIcon;
}
