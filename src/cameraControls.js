import * as THREE from 'three';
import gsap from 'gsap';

/**
 * Creates 4 directional arrow buttons for camera panning
 * @param {THREE.OrbitControls} controls - The OrbitControls instance
 * @param {THREE.Camera} camera - The camera instance
 */
export function createCameraArrows(controls, camera) {
    const container = document.createElement('div');
    container.id = 'camera-arrows';
    container.style.cssText = `
        position: fixed;
        bottom: 30px;
        left: 30px;
        width: 120px;
        height: 120px;
        display: grid;
        grid-template-columns: 40px 40px 40px;
        grid-template-rows: 40px 40px 40px;
        gap: 0px;
        z-index: 1000;
    `;

    // Arrow button style
    const arrowStyle = `
        background: rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        color: rgba(255, 255, 255, 0.8);
        transition: all 0.2s ease;
        user-select: none;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    `;

    const hoverStyle = `
        background: rgba(255, 255, 255, 0.2);
        border-color: rgba(255, 255, 255, 0.4);
        color: rgba(255, 255, 255, 1);
        transform: scale(1.05);
    `;

    // Create arrow buttons
    const arrows = [
        { direction: 'up', icon: '▲', gridArea: '1 / 2 / 2 / 3' },
        { direction: 'left', icon: '◀', gridArea: '2 / 1 / 3 / 2' },
        { direction: 'right', icon: '▶', gridArea: '2 / 3 / 3 / 4' },
        { direction: 'down', icon: '▼', gridArea: '3 / 2 / 4 / 3' }
    ];

    const panSpeed = 0.5; // Adjust this to control pan speed

    arrows.forEach(({ direction, icon, gridArea }) => {
        const btn = document.createElement('button');
        btn.className = `camera-arrow camera-arrow-${direction}`;
        btn.innerHTML = icon;
        btn.style.cssText = arrowStyle + `grid-area: ${gridArea};`;

        // Hover effects
        btn.addEventListener('mouseenter', () => {
            btn.style.background = 'rgba(255, 255, 255, 0.2)';
            btn.style.borderColor = 'rgba(255, 255, 255, 0.4)';
            btn.style.color = 'rgba(255, 255, 255, 1)';
            btn.style.transform = 'scale(1.05)';
        });

        btn.addEventListener('mouseleave', () => {
            btn.style.background = 'rgba(255, 255, 255, 0.1)';
            btn.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            btn.style.color = 'rgba(255, 255, 255, 0.8)';
            btn.style.transform = 'scale(1)';
        });

        // Click handler - pan the camera
        btn.addEventListener('click', () => {
            panCamera(direction, controls, camera, panSpeed);
        });

        container.appendChild(btn);
    });

    document.body.appendChild(container);
}

/**
 * Pan the camera in the specified direction
 */
function panCamera(direction, controls, camera, speed) {
    const target = controls.target.clone();
    const cameraPos = camera.position.clone();

    // Get camera's right and up vectors
    const right = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    camera.getWorldDirection(right);
    right.cross(up).normalize();

    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0; // Keep movement horizontal
    forward.normalize();

    let offset = new THREE.Vector3();

    switch (direction) {
        case 'up':
            offset = forward.multiplyScalar(speed);
            break;
        case 'down':
            offset = forward.multiplyScalar(-speed);
            break;
        case 'left':
            offset = right.multiplyScalar(-speed);
            break;
        case 'right':
            offset = right.multiplyScalar(speed);
            break;
    }

    // Animate the pan
    gsap.to(controls.target, {
        x: target.x + offset.x,
        y: target.y,
        z: target.z + offset.z,
        duration: 0.3,
        ease: 'power2.out'
    });

    gsap.to(camera.position, {
        x: cameraPos.x + offset.x,
        y: cameraPos.y,
        z: cameraPos.z + offset.z,
        duration: 0.3,
        ease: 'power2.out'
    });
}