import * as THREE from 'three';

export function initShootingStars(scene, opts = {}) {
	// options
	const {
		maxStars = 8,
		spawnIntervalMin = 800, // ms
		spawnIntervalMax = 2200,
		trailLength = 10,
		starSize = 0.06,
		trailSpriteSize = 0.12,
		gravity = -9.8 * 0.08, // scaled gravity (scene units)
		drag = 0.02,
		fadeSpeed = 1.0,
		floorY = -12
	} = opts;

	const group = new THREE.Group();
	group.name = 'ShootingStarsGroup';
	scene.add(group);

	const stars = []; // active stars

	// Shared geometries & materials
	const headGeo = new THREE.SphereGeometry(1, 8, 8);
	const headMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false });
	const trailTexture = createTrailSprite(); // small circular gradient canvas texture
	const trailMatFactory = (alpha) => new THREE.SpriteMaterial({
		map: trailTexture,
		color: new THREE.Color(0xffffff),
		transparent: true,
		depthWrite: false,
		opacity: alpha
	});

	function createTrailSprite() {
		const size = 64;
		const canvas = document.createElement('canvas');
		canvas.width = size;
		canvas.height = size;
		const ctx = canvas.getContext('2d');
		const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
		grad.addColorStop(0, 'rgba(255,255,255,1)');
		grad.addColorStop(0.2, 'rgba(255,255,255,0.9)');
		grad.addColorStop(0.6, 'rgba(255,255,255,0.2)');
		grad.addColorStop(1, 'rgba(255,255,255,0)');
		ctx.fillStyle = grad;
		ctx.fillRect(0,0,size,size);
		const tex = new THREE.CanvasTexture(canvas);
		tex.needsUpdate = true;
		return tex;
	}

	function spawnStar() {
		if (stars.length >= maxStars) return;

		// spawn position: somewhat far / high above scene, random x/z spread
		const x = (Math.random() - 0.5) * 40;
		const z = (Math.random() - 0.5) * 40;
		const y = floorY + 18 + Math.random() * 14; // well above floor

		// initial velocity: mostly downward-forward with some variance
		const speed = 6 + Math.random() * 8;
		const angleXZ = (Math.PI / 8) * (Math.random() - 0.5); // slight angle
		const vx = Math.sin(angleXZ) * speed * (0.5 + Math.random() * 1.2);
		const vz = (Math.random() - 0.5) * 1.0;
		const vy = -Math.abs(3 + Math.random() * 6);

		const head = new THREE.Mesh(headGeo, headMat.clone());
		head.scale.setScalar(starSize);
		head.position.set(x, y, z);
		head.material.opacity = 0.9 * (0.4 + Math.random() * 0.7);
		head.renderOrder = 999;

		// trail sprites
		const trail = [];
		for (let i=0;i<trailLength;i++){
			const s = new THREE.Sprite(trailMatFactory(0.0));
			s.scale.setScalar(trailSpriteSize * (1 - i / (trailLength*1.2)));
			s.position.copy(head.position);
			group.add(s);
			trail.push(s);
		}

		group.add(head);

		const star = {
			head,
			trail,
			pos: new THREE.Vector3(x,y,z),
			vel: new THREE.Vector3(vx, vy, vz),
			age: 0,
			life: 6 + Math.random()*3,
			fade: 1.0
		};
		stars.push(star);
	}

	// spawn scheduling
	let nextSpawn = performance.now() + randInterval();
	function randInterval(){ return spawnIntervalMin + Math.random() * (spawnIntervalMax - spawnIntervalMin); }

	// update loop
	let lastT = performance.now();
	let rafId = null;
	function step(t){
		const dt = Math.min(0.06, (t - lastT) / 1000); // clamp dt
		lastT = t;

		// spawn logic
		if (t >= nextSpawn) {
			spawnStar();
			nextSpawn = t + randInterval();
		}

		// update stars
		for (let i = stars.length - 1; i >= 0; i--) {
			const s = stars[i];
			// physics
			s.vel.y += gravity * dt;
			// simple drag
			s.vel.multiplyScalar(1 - drag * dt);

			// integrate
			s.pos.addScaledVector(s.vel, dt);
			s.head.position.copy(s.pos);

			// age & fade
			s.age += dt;
			const remaining = Math.max(0, s.life - s.age);
			s.fade = Math.min(1, remaining / 1.5);
			// head fade slightly
			if (s.head.material) s.head.material.opacity = 0.8 * Math.max(0.05, s.fade * 0.9);

			// update trail: shift recent positions
			s.trail.unshift(s.pos.clone()); // add current pos to front
			if (s.trail.length > trailLength) s.trail.pop();

			// update trail sprite positions & opacities
			for (let j=0;j<s.trail.length;j++){
				const sprite = s.trail[j];
				const alpha = (1 - j / s.trail.length) * 0.25 * s.fade;
				sprite.position.copy(s.trail[j]);
				if (sprite.material) sprite.material.opacity = alpha;
			}

			// remove when below floor or life end
			if (s.pos.y < floorY - 6 || remaining <= 0) {
				// fade out and remove
				// clean up
				group.remove(s.head);
				if (s.head.geometry) s.head.geometry.dispose();
				if (s.head.material) s.head.material.dispose();
				for (const sp of s.trail) {
					group.remove(sp);
					if (sp.material) sp.material.dispose();
				}
				stars.splice(i,1);
			}
		}

		rafId = requestAnimationFrame(step);
	}
	rafId = requestAnimationFrame(step);

	// public dispose to stop loop and cleanup
	return {
		dispose() {
			if (rafId) cancelAnimationFrame(rafId);
			// cleanup group
			stars.forEach(s => {
				group.remove(s.head);
				if (s.head.geometry) s.head.geometry.dispose();
				if (s.head.material) s.head.material.dispose();
				s.trail.forEach(sp => {
					group.remove(sp);
					if (sp.material) sp.material.dispose();
				});
			});
			stars.length = 0;
			scene.remove(group);
		}
	};
}
