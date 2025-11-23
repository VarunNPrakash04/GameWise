import * as THREE from 'three';

/**
 * Creates a 3D room background with dark grey walls
 * @param {THREE.Scene} scene - The Three.js scene to add the room to
 * @returns {Object} Object containing all room meshes for potential manipulation
 */
export function createRoomBackground(scene) {
    // Room dimensions
    const ROOM_SIZE = 200;
    const ROOM_HEIGHT = 50;

    // Move the floor further down so camera/orbiting won't easily go under the tiles
    const FLOOR_Y = -12; // moved down from -2 to -12

    // Create grid texture for the room surfaces
    function createGridTexture(size = 512) {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');

        // Fill with darker background for maximum contrast
        context.fillStyle = '#0f0f0f';
        context.fillRect(0, 0, size, size);

        // Draw grid lines
        context.strokeStyle = '#707070';
        context.lineWidth = 2;
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

        // Center reference lines
        context.strokeStyle = '#a0a0a0';
        context.lineWidth = 2.5;
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

    function createMaterialWithTexture() {
        const texture = createGridTexture(512);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(20, 20);

        return new THREE.MeshStandardMaterial({
            color: 0x151515,
            map: texture,
            roughness: 0.6,
            metalness: 0.05,
            emissive: 0x000000,
            emissiveIntensity: 0,
            side: THREE.DoubleSide
        });
    }

    // FLOOR - moved down using FLOOR_Y
    const groundGeometry = new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE);
    const ground = new THREE.Mesh(groundGeometry, createMaterialWithTexture());
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = FLOOR_Y; // lowered
    ground.receiveShadow = false;
    scene.add(ground);

    // CEILING and walls should span from FLOOR_Y up to FLOOR_Y + ROOM_HEIGHT
    const ceilingY = FLOOR_Y + ROOM_HEIGHT;

    const ceilingGeometry = new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE);
    const ceiling = new THREE.Mesh(ceilingGeometry, createMaterialWithTexture());
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = ceilingY;
    ceiling.receiveShadow = false;
    scene.add(ceiling);

    // Walls height and center
    const wallHeight = ROOM_HEIGHT;
    const wallCenterY = FLOOR_Y + wallHeight / 2;

    // BACK WALL
    const backWallGeometry = new THREE.PlaneGeometry(ROOM_SIZE, wallHeight);
    const backWall = new THREE.Mesh(backWallGeometry, createMaterialWithTexture());
    backWall.position.z = -ROOM_SIZE / 2;
    backWall.position.y = wallCenterY;
    backWall.receiveShadow = false;
    scene.add(backWall);

    // FRONT WALL
    const frontWallGeometry = new THREE.PlaneGeometry(ROOM_SIZE, wallHeight);
    const frontWall = new THREE.Mesh(frontWallGeometry, createMaterialWithTexture());
    frontWall.position.z = ROOM_SIZE / 2;
    frontWall.position.y = wallCenterY;
    frontWall.rotation.y = Math.PI;
    frontWall.receiveShadow = false;
    scene.add(frontWall);

    // LEFT WALL
    const leftWallGeometry = new THREE.PlaneGeometry(ROOM_SIZE, wallHeight);
    const leftWall = new THREE.Mesh(leftWallGeometry, createMaterialWithTexture());
    leftWall.position.x = -ROOM_SIZE / 2;
    leftWall.position.y = wallCenterY;
    leftWall.rotation.y = Math.PI / 2;
    leftWall.receiveShadow = false;
    scene.add(leftWall);

    // RIGHT WALL
    const rightWallGeometry = new THREE.PlaneGeometry(ROOM_SIZE, wallHeight);
    const rightWall = new THREE.Mesh(rightWallGeometry, createMaterialWithTexture());
    rightWall.position.x = ROOM_SIZE / 2;
    rightWall.position.y = wallCenterY;
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.receiveShadow = false;
    scene.add(rightWall);

    // Return room components and FLOOR_Y so callers can clamp camera if needed
    return {
        ground,
        ceiling,
        backWall,
        frontWall,
        leftWall,
        rightWall,
        ROOM_SIZE,
        ROOM_HEIGHT,
        FLOOR_Y
    };
}
