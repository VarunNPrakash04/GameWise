/**
 * Animated entrance effects for UI components
 * Using GSAP for smooth animations
 */
import { gsap } from 'gsap';

// ============================================
// GLOBAL FLAGS (Prevent Double Animations)
// ============================================
let componentsButtonAnimated = false;
let arduinoAnimated = false;
let allAnimationsTriggered = false;

// ============================================
// COMPONENTS BUTTON ANIMATION
// ============================================

export function initButtonAnimation() {
    // Prevent double animation
    if (componentsButtonAnimated) {
        //console.log('🔒 Components button already animated, skipping...');
        return;
    }

    const componentsToggle = document.getElementById('components-toggle');

    if (!componentsToggle) {
        //console.warn('⚠️ Components toggle button not found');
        return;
    }

    // Mark as animated IMMEDIATELY
    componentsButtonAnimated = true;
    //console.log('🎬 Starting Components button animation...');

    // Kill any existing animations on this element (safety)
    gsap.killTweensOf(componentsToggle);

    // Set initial state (hidden, below final position)
    gsap.set(componentsToggle, {
        y: 10,
        scale: 0.9,
        opacity: 0,
        visibility: 'visible'
    });

    // Animate to final position
    gsap.to(componentsToggle, {
        y: 0,
        scale: 1,
        opacity: 1,
        duration: 0.6,
        ease: 'power2.out',
        delay: 0.2,
        onComplete: () => {
            //console.log('✅ Components button animation complete');
        }
    });
}

// ============================================
// ARDUINO BOARD ANIMATION
// ============================================

function animateArduinoFadeIn(arduino) {
    if (!arduino) {
        //console.warn('⚠️ Arduino object not found');
        return;
    }

    // Prevent double animation
    if (arduinoAnimated) {
        //console.log('🔒 Arduino already animated, skipping...');
        return;
    }

    // Mark as animated IMMEDIATELY
    arduinoAnimated = true;
    //console.log('🎬 Starting Arduino animation...');

    // Kill any existing animations (safety)
    gsap.killTweensOf(arduino.position);
    gsap.killTweensOf(arduino.scale);

    // Set initial state (slightly below, smaller)
    arduino.position.y = arduino.position.y - 0.5;
    arduino.scale.set(0.9, 0.9, 0.9);

    // Store original Y position
    const originalY = arduino.position.y + 0.5;

    // Animate position
    gsap.to(arduino.position, {
        y: originalY,
        duration: 0.8,
        ease: 'back.out(1.2)',
        delay: 0.3
    });

    // Animate scale
    gsap.to(arduino.scale, {
        x: 1,
        y: 1,
        z: 1,
        duration: 0.8,
        ease: 'back.out(1.2)',
        delay: 0.3
    });

    // Animate opacity for all materials
    arduino.traverse((child) => {
        if (child.material) {
            gsap.to(child.material, {
                opacity: 1,
                duration: 0.8,
                ease: 'power2.out',
                delay: 0.3,
                onComplete: () => {
                    //console.log('✅ Arduino animation complete');
                }
            });
        }
    });
}

// ============================================
// TRIGGER FUNCTIONS (Called from main.js)
// ============================================

/**
 * Trigger all UI animations after splash screen is dismissed
 */
export function triggerAllAnimations() {
    // Prevent double triggering
    if (allAnimationsTriggered) {
        //console.log('🔒 All animations already triggered, skipping...');
        return;
    }

    // Mark as triggered IMMEDIATELY
    allAnimationsTriggered = true;
    //console.log('🎬 Triggering all UI animations...');

    // Animate Components button
    initButtonAnimation();
}

/**
 * Trigger Arduino animation (called separately after model loads)
 */
export function triggerArduinoAnimation(arduino) {
    // Only animate if splash is already hidden
    const mainContent = document.getElementById('mainContent');

    if (mainContent && mainContent.classList.contains('visible')) {
        // Splash already dismissed, animate immediately
        animateArduinoFadeIn(arduino);
    } else {
        // Wait for splash to be dismissed
        //console.log('⏳ Waiting for splash dismissal before animating Arduino...');
        window.addEventListener('splashDismissed', () => {
            animateArduinoFadeIn(arduino);
        }, { once: true });
    }
}
/**
 * Animate component spawn (for Breadboard, Button, LED)
 * @param {THREE.Object3D} component - The component to animate
 * @param {number} duration - Animation duration in seconds (default 0.3)
 */
export function animateComponentSpawn(component, duration = 0.3) {
    if (!component) {
        // console.warn('⚠️ Component not found for spawn animation');
        return;
    }

    console.log('🎬 Animating component spawn:', component.userData.type);

    // Kill any existing animations (safety)
    gsap.killTweensOf(component.position);
    gsap.killTweensOf(component.scale);

    // Store original position
    const originalY = component.position.y;

    // Set initial state (slightly below, smaller, invisible)
    component.position.y = originalY - 0.3;
    component.scale.set(0.85, 0.85, 0.85);

    // Set materials to transparent and invisible
    component.traverse((child) => {
        if (child.material) {
            child.material.transparent = true;
            child.material.opacity = 0;
        }
    });

    // Animate position
    gsap.to(component.position, {
        y: originalY,
        duration: duration,
        ease: 'back.out(1.2)',
        delay: 0.1
    });

    // Animate scale
    gsap.to(component.scale, {
        x: 1,
        y: 1,
        z: 1,
        duration: duration,
        ease: 'back.out(1.2)',
        delay: 0.1
    });

    // Animate opacity for all materials
    component.traverse((child) => {
        if (child.material) {
            gsap.to(child.material, {
                opacity: 1,
                duration: duration,
                ease: 'power2.out',
                delay: 0.1
            });
        }
    });
}