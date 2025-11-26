import * as THREE from 'three';

export function createRoomBackground(scene) {
    const FLOOR_Y = -2;

    // ============================================
    // TRON LEGACY CYBERPUNK TILE GRID
    // ============================================

    // Grid parameters
    const gridSize = 80;
    const tileSize = 1.75;
    const numTiles = gridSize / tileSize;

    // Tron Legacy blue (the iconic electric blue from the movie)
    const tronBlue = 0x00d9ff; // Tron Legacy's signature cyan-blue

    // Create tile grid
    const tileGroup = new THREE.Group();

    for (let x = 0; x < numTiles; x++) {
        for (let z = 0; z < numTiles; z++) {
            // Create tile base (pure black, matching Tron Legacy)
            const tileGeo = new THREE.PlaneGeometry(tileSize - 0.05, tileSize - 0.05);
            const tileMat = new THREE.MeshBasicMaterial({
                color: 0x000000, // Pure black floor - unaffected by lighting
            });

            const tile = new THREE.Mesh(tileGeo, tileMat);
            tile.rotation.x = -Math.PI / 2;
            tile.position.set(
                x * tileSize - gridSize / 2 + tileSize / 2,
                FLOOR_Y + 0.01,
                z * tileSize - gridSize / 2 + tileSize / 2
            );

            tileGroup.add(tile);

            // Add glowing Tron Legacy blue edges (static, no animation)
            // Create 4 edge lines for each tile
            const edgePositions = [
                // Top edge
                [
                    new THREE.Vector3(-tileSize / 2 + 0.025, 0, -tileSize / 2 + 0.025),
                    new THREE.Vector3(tileSize / 2 - 0.025, 0, -tileSize / 2 + 0.025)
                ],
                // Right edge
                [
                    new THREE.Vector3(tileSize / 2 - 0.025, 0, -tileSize / 2 + 0.025),
                    new THREE.Vector3(tileSize / 2 - 0.025, 0, tileSize / 2 - 0.025)
                ],
                // Bottom edge
                [
                    new THREE.Vector3(tileSize / 2 - 0.025, 0, tileSize / 2 - 0.025),
                    new THREE.Vector3(-tileSize / 2 + 0.025, 0, tileSize / 2 - 0.025)
                ],
                // Left edge
                [
                    new THREE.Vector3(-tileSize / 2 + 0.025, 0, tileSize / 2 - 0.025),
                    new THREE.Vector3(-tileSize / 2 + 0.025, 0, -tileSize / 2 + 0.025)
                ]
            ];

            edgePositions.forEach(([start, end]) => {
                const points = [start, end];
                const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
                const lineMat = new THREE.LineBasicMaterial({
                    color: tronBlue, // Tron Legacy blue
                    opacity: 0.7,
                    transparent: true,
                    linewidth: 2
                });

                const line = new THREE.Line(lineGeo, lineMat);
                line.position.copy(tile.position);
                line.position.y = FLOOR_Y + 0.02; // Slightly above tile

                tileGroup.add(line);
            });
        }
    }

    scene.add(tileGroup);

    // ============================================
    // AMBIENT LIGHTING (Tron Legacy style)
    // ============================================

    // Subtle blue ambient glow
    const ambientGlow = new THREE.AmbientLight(0x001a33, 0.2);
    scene.add(ambientGlow);

    // Tron blue rim light
    const blueLight = new THREE.DirectionalLight(0x00d9ff, 0.3);
    blueLight.position.set(10, 5, 10);
    scene.add(blueLight);

    // Secondary blue accent light
    const accentLight = new THREE.DirectionalLight(0x0099cc, 0.2);
    accentLight.position.set(-10, 5, -10);
    scene.add(accentLight);

    return { FLOOR_Y };
}