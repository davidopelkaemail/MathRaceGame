/**
 * Track Module - Colossal Full-Canvas Edition (Stadium Perfection)
 */

const Track = (function() {
  let scene, camera, renderer, animationFrameId;
  let trackGroup, trackCurve, isInitialized = false;
  let carMeshes = [], currentDesign = 'oval';
  let crowdMeshes = []; // Store references to animate the crowd
  let birds = []; // Store references to animated birds
  let lastBirdSpawnTime = 0; // Track when to spawn the next flock

  // SCALING CONSTANTS
  const TRACK_SCALE = 9000; // Balanced scale to keep the track visible on screen
  const TRACK_WIDTH = 3000;  // Appropriate width for 4 cars
  const CAR_SCALE = 0.8;     // Scaled appropriately
  const FAR_CLIP = 300000;   // View distance

  const TRACK_CONFIGS = {
    oval: { getCurve: (s=TRACK_SCALE) => new THREE.CatmullRomCurve3([
      new THREE.Vector3(s * 1.5, 0, 0),
      new THREE.Vector3(s * 1.2, 0, s * 0.8),
      new THREE.Vector3(0, 0, s),
      new THREE.Vector3(-s * 1.2, 0, s * 0.8),
      new THREE.Vector3(-s * 1.5, 0, 0),
      new THREE.Vector3(-s * 1.2, 0, -s * 0.8),
      new THREE.Vector3(0, 0, -s),
      new THREE.Vector3(s * 1.2, 0, -s * 0.8),
    ], true) },
    island: { getCurve: (s=TRACK_SCALE) => new THREE.CatmullRomCurve3([
      new THREE.Vector3(s * 1.5, 0, 0),
      new THREE.Vector3(s * 1.2, 0, s * 0.6),
      new THREE.Vector3(s * 0.5, 0, s * 1.2),
      new THREE.Vector3(-s * 0.6, 0, s * 0.7),
      new THREE.Vector3(-s * 1.4, 0, 0),
      new THREE.Vector3(-s * 0.8, 0, -s * 1.0),
      new THREE.Vector3(0, 0, -s * 1.4),
      new THREE.Vector3(s * 0.8, 0, -s * 0.9),
    ], true) }
  };

  function init(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return false;
    const container = canvas.parentElement;
    
    scene = new THREE.Scene();
    // Atmospheric sunset/dusk look
    scene.background = new THREE.Color(0x8cb8d4); 
    scene.fog = new THREE.FogExp2(0x8cb8d4, 0.00002); // Lower density so background is clearer

    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    
    // Narrower FOV helps with scale/depth perception for racing
    camera = new THREE.PerspectiveCamera(50, w / h, 1, FAR_CLIP);
    
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(w, h);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // Basic tone mapping for better colors
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    // Advanced dynamic lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(-15000, 10000, 5000);
    sun.castShadow = true;
    sun.shadow.camera.near = 100;
    sun.shadow.camera.far = 40000;
    sun.shadow.camera.left = -20000;
    sun.shadow.camera.right = 20000;
    sun.shadow.camera.top = 20000;
    sun.shadow.camera.bottom = -20000;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.bias = -0.001;
    scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(FAR_CLIP, FAR_CLIP),
      // A pleasing grass-like professional turf
      new THREE.MeshStandardMaterial({ color: 0x3d5c31, roughness: 1.0, metalness: 0.0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -5;
    ground.receiveShadow = true;
    scene.add(ground);

    createTrack();
    addEnvironment();
    
    // Birds will spawn periodically in the render loop instead of here
    
    fitCameraToCanvas(); 
    
    isInitialized = true;
    window.addEventListener('resize', onResize);
    return true;
  }

  function fitCameraToCanvas() {
    // Elevate camera, but not too high, to see the entire track comfortably
    // A middle ground so back bends aren't too small and front street isn't cut off.
    camera.position.set(0, 8000, 16000); 
    camera.lookAt(0, -500, 500); 
  }

  function addEnvironment() {
    // 12 Tribunes placed properly using true curve normal to point OUTWARD
    const sectionCount = 12;
    const trackPoints = trackCurve.getSpacedPoints(1000);
    
    for (let i = 0; i < sectionCount; i++) {
        const t = (i / sectionCount);
        const point = trackCurve.getPointAt(t);
        const tangent = trackCurve.getTangentAt(t).normalize();
        
        // Use true normal (perpendicular to tangent) for reliable outward direction
        // We calculate both left and right normals and pick the one further from origin for 'outward'
        const normal1 = new THREE.Vector3(-tangent.z, 0, tangent.x);
        const normal2 = new THREE.Vector3(tangent.z, 0, -tangent.x);
        
        const pos1 = point.clone().add(normal1.clone().multiplyScalar(7500));
        const pos2 = point.clone().add(normal2.clone().multiplyScalar(7500));
        
        // Pick the position further from the center (most tracks are around origin)
        const tribunePos = pos1.lengthSq() > pos2.lengthSq() ? pos1 : pos2;
        const finalNormal = tribunePos.clone().sub(point).normalize();
        // Removed Math.PI to rotate 180 degrees back towards center
        const rot = Math.atan2(finalNormal.x, finalNormal.z);
        
        // Final safety check: ensure tribune isn't too close to ANY track point
        let minTribDist = Infinity;
        for (let j = 0; j < trackPoints.length; j++) {
            const distSq = tribunePos.distanceToSquared(trackPoints[j]);
            if (distSq < minTribDist) minTribDist = distSq;
        }
        
        if (Math.sqrt(minTribDist) > 5000) {
            addTribune(tribunePos.x, tribunePos.z, rot);
        }
    }
    
    // Low-poly forest with strict distance checking
    let treesPlaced = 0;
    let attempts = 0;
    while (treesPlaced < 70 && attempts < 1000) {
        attempts++;
        const x = (Math.random() - 0.5) * TRACK_SCALE * 3.5;
        const z = (Math.random() - 0.5) * TRACK_SCALE * 3.5;
        const pos = new THREE.Vector3(x, 0, z);
        
        let minDistanceSq = Infinity;
        for (let i = 0; i < trackPoints.length; i++) {
            const distSq = pos.distanceToSquared(trackPoints[i]);
            if (distSq < minDistanceSq) minDistanceSq = distSq;
        }

        const minDistance = Math.sqrt(minDistanceSq);
        // Track width is 3000 (1500 radius). Buffer of 3500 ensures no trees near asphalt.
        if (minDistance > 5000) {
            addTree(x, z);
            treesPlaced++;
        }
    }
  }

  function addTree(x, z) {
    const group = new THREE.Group();
    // Realistic thin trunk
    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(60, 100, 600), 
        new THREE.MeshStandardMaterial({ color: 0x3b2f2f, roughness: 0.9 })
    );
    trunk.position.y = 300; 
    trunk.castShadow = true;
    group.add(trunk);
    
    // Pine tree layered cone look
    const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x1f4722, roughness: 0.9 });
    for(let i=0; i<3; i++) {
        const leaves = new THREE.Mesh(new THREE.ConeGeometry(500 - i*100, 800, 8), leafMaterial);
        leaves.position.y = 700 + i*350;
        leaves.castShadow = true;
        group.add(leaves);
    }
    group.position.set(x, 0, z); 
    
    // Add randomness to tree scale and rotation
    const s = 0.5 + Math.random();
    group.scale.set(s,s,s);
    group.rotation.y = Math.random() * Math.PI;
    
    scene.add(group);
  }

  function addTribune(x, z, rotation) {
    const group = new THREE.Group();
    
    // Concrete base structure
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.8 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(4500, 800, 2000), baseMat);
    base.position.y = 400; 
    base.castShadow = true;
    group.add(base);
    
    // Bleachers (steps)
    const stepMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.7 });
    for (let i = 0; i < 8; i++) {
        const step = new THREE.Mesh(new THREE.BoxGeometry(4500, 150, 250), stepMat);
        step.position.set(0, 800 + i * 150, -600 + i * 250); 
        step.castShadow = true;
        group.add(step);
      
        // Crowd (Low poly colored boxes)
        for (let j = 0; j < 30; j++) {
            // Give them a skin-tone or colorful clothes
            const isSkin = Math.random() > 0.5;
            const color = isSkin ? 
                new THREE.Color().setHSL(0.05 + Math.random()*0.05, 0.4 + Math.random()*0.3, 0.6 + Math.random()*0.3) :
                new THREE.Color().setHSL(Math.random(), 0.8, 0.5);

            const personGroups = new THREE.Group();
            
            // Body
            const body = new THREE.Mesh(new THREE.BoxGeometry(70, 90, 70), new THREE.MeshLambertMaterial({ color: color }));
            body.position.y = 45;
            personGroups.add(body);
            
            // Head
            const head = new THREE.Mesh(new THREE.BoxGeometry(40, 40, 40), new THREE.MeshLambertMaterial({ color: 0xffdbac }));
            head.position.y = 110;
            personGroups.add(head);

            personGroups.position.set(-2100 + j * 145, 950 + i * 150, -570 + i * 250);
            
            // Store original Y position for jumping animation
            personGroups.userData.baseY = personGroups.position.y;
            personGroups.userData.jumpOffset = Math.random() * Math.PI * 2;
            personGroups.userData.jumpSpeed = 0.05 + Math.random() * 0.1;

            crowdMeshes.push(personGroups);
            group.add(personGroups);
        }
    }
    
    // Modern roof overhang
    const roof = new THREE.Mesh(new THREE.BoxGeometry(4700, 100, 2500), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.2, metalness: 0.7 }));
    roof.position.set(0, 2400, 500); 
    roof.rotation.x = -0.1;
    roof.castShadow = true;
    group.add(roof);

    // Pillars supporting roof
    for(let p=0; p<4; p++) {
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(50, 50, 1600), baseMat);
        pillar.position.set(-2000 + (p * 1333), 1600, 1400);
        pillar.castShadow = true;
        group.add(pillar);
    }

    group.position.set(x, 0, z); 
    group.rotation.y = rotation; 
    scene.add(group);
  }

  function spawnBirdFlock() {
    const numBirds = 3 + Math.floor(Math.random() * 5); // 3 to 7 birds
    const startX = -25000;
    const startZ = -10000 + Math.random() * 20000;
    const height = 4000 + Math.random() * 2000;
    const speedX = 100 + Math.random() * 50; // Fly across the track
    const speedZ = (Math.random() - 0.5) * 30; // Slight sideways drift
    
    // Group them somewhat close together
    for(let i=0; i<numBirds; i++) {
        const birdGroup = new THREE.Group();
        const birdMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
        
        // V-Shape Birds
        const wing1 = new THREE.Mesh(new THREE.BoxGeometry(100, 10, 30), birdMat);
        wing1.position.set(40, 0, -20);
        wing1.rotation.y = -Math.PI / 4;
        birdGroup.add(wing1);

        const wing2 = new THREE.Mesh(new THREE.BoxGeometry(100, 10, 30), birdMat);
        wing2.position.set(-40, 0, -20);
        wing2.rotation.y = Math.PI / 4;
        birdGroup.add(wing2);

        // Offset each bird slightly from the flock center
        const offsetX = (Math.random() - 0.5) * 1500;
        const offsetZ = (Math.random() - 0.5) * 1500;
        const offsetY = (Math.random() - 0.5) * 800;

        birdGroup.position.set(startX + offsetX, height + offsetY, startZ + offsetZ);
        
        // Point the bird in direction of travel
        birdGroup.lookAt(startX + offsetX + speedX, height + offsetY, startZ + offsetZ + speedZ);

        // Store animation data
        birdGroup.userData = {
            speedX: speedX,
            speedZ: speedZ,
            heightOffset: Math.random() * Math.PI * 2,
            baseY: height + offsetY
        };

        birds.push(birdGroup);
        scene.add(birdGroup);
    }
  }

  function createTrack() {
    if (trackGroup) scene.remove(trackGroup);
    trackGroup = new THREE.Group();
    const config = TRACK_CONFIGS[currentDesign] || TRACK_CONFIGS.oval;
    trackCurve = config.getCurve(TRACK_SCALE); 

    const trackTexture = new THREE.CanvasTexture(createTrackTexture());
    trackTexture.wrapS = THREE.RepeatWrapping;
    trackTexture.wrapT = THREE.RepeatWrapping;
    // High repeat for very detailed asphalt lines
    trackTexture.repeat.set(1, 20);
    // Anisotropy for sharp lines at distance
    trackTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const asphaltMat = new THREE.MeshStandardMaterial({ 
        map: trackTexture, 
        roughness: 0.8, 
        metalness: 0.2, // Brings back soft shadows 
        color: 0x777777  // Neutral grey color to keep shadows grey instead of green
    });

    const asphalt = new THREE.Mesh(
      new THREE.TubeGeometry(trackCurve, 512, TRACK_WIDTH / 2, 24, true),
      asphaltMat
    );
    asphalt.scale.y = 0.001; 
    asphalt.receiveShadow = true; 
    trackGroup.add(asphalt);

    // Guard rails
    const railMat = new THREE.MeshStandardMaterial({ color: 0xff4444, metalness: 0.3, roughness: 0.3 });
    const innerRail = new THREE.Mesh(new THREE.TubeGeometry(trackCurve, 512, 80, 8, true), railMat);
    innerRail.scale.set(1 - (TRACK_WIDTH/2)/TRACK_SCALE, 1, 1 - (TRACK_WIDTH/2)/TRACK_SCALE);
    innerRail.position.y = 150;
    trackGroup.add(innerRail);
    
    const outerRailMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.8, roughness: 0.3 });
    const outerRail = new THREE.Mesh(new THREE.TubeGeometry(trackCurve, 512, 80, 8, true), outerRailMat);
    outerRail.scale.set(1 + (TRACK_WIDTH/2)/TRACK_SCALE, 1, 1 + (TRACK_WIDTH/2)/TRACK_SCALE);
    outerRail.position.y = 150;
    trackGroup.add(outerRail);

    const startPoint = trackCurve.getPointAt(0);
    const startTangent = trackCurve.getTangentAt(0).normalize();
    const checkerCanvas = document.createElement('canvas');
    checkerCanvas.width = 1024; checkerCanvas.height = 256;
    const ctx = checkerCanvas.getContext('2d');
    for (let y = 0; y < 4; y++) { for (let x = 0; x < 16; x++) { ctx.fillStyle = (x + y) % 2 === 0 ? '#ffffff' : '#000000'; ctx.fillRect(x * 64, y * 64, 64, 64); } }
    const checkerTexture = new THREE.CanvasTexture(checkerCanvas);
    const startLine = new THREE.Mesh(
      new THREE.PlaneGeometry(TRACK_WIDTH * 1.1, 800), 
      new THREE.MeshStandardMaterial({ map: checkerTexture, side: THREE.DoubleSide })
    );
    startLine.position.copy(startPoint); 
    // Fix graphic Z-fighting red glitches on asphalt by pulling the line higher up
    startLine.position.y = 30; 
    const helper = new THREE.Object3D();
    helper.position.copy(startPoint); 
    helper.lookAt(startPoint.clone().add(startTangent));
    startLine.quaternion.copy(helper.quaternion);
    startLine.rotateX(-Math.PI / 2); 
    
    trackGroup.add(startLine);
    scene.add(trackGroup);
  }
  
  function createTrackTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // High detail asphalt - lightened significantly per user request
    ctx.fillStyle = '#555555';
    ctx.fillRect(0, 0, 512, 512);

    // Rumble strips/kerbs at the edges (red & white)
    for(let y=0; y<512; y+=32) {
        ctx.fillStyle = (y % 64 === 0) ? '#cc0000' : '#ffffff';
        ctx.fillRect(0, y, 20, 32);     // left edge
        ctx.fillRect(492, y, 20, 32);   // right edge
    }

    // Lane dividing lines (dashed)
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for(let i=1; i<4; i++) {
        const xPos = (512 / 4) * i;
        ctx.fillRect(xPos - 2, 0, 4, 128); // Dash pattern
    }
    
    return canvas;
  }

  function createPlaceTexture(place, colorHex) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    
    // Clear canvas explicitly to ensure full transparency
    ctx.clearRect(0, 0, 256, 256);
    
    ctx.beginPath();
    ctx.arc(128, 128, 110, 0, Math.PI * 2);
    ctx.fillStyle = colorHex;
    ctx.fill();
    ctx.lineWidth = 12;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 140px "Fredoka One", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(place.toString(), 128, 128 + 10);
    
    const texture = new THREE.CanvasTexture(canvas);
    // Needs to be sharp
    texture.minFilter = THREE.LinearFilter;
    texture.premultiplyAlpha = true;
    return texture;
  }

  function createVehicle(colorHex, type) {
    let m;
    switch(type) {
      case 'monster': m = createMonsterTruck(colorHex); break;
      case 'bike': m = createMotorcycle(colorHex); break;
      case 'truck': m = createSemiTruck(colorHex); break;
      default: m = createF1Car(colorHex);
    }
    m.userData.vehicleType = type;
    m.userData.colorHex = colorHex;
    return m;
  }

  // Original Formula Style Car
  function createF1Car(colorHex) {
    const group = new THREE.Group();
    const scale = CAR_SCALE;
    
    // Core glossy paint material - adding emissive so it glows vividly
    const paintMat = new THREE.MeshStandardMaterial({ 
        color: colorHex, 
        emissive: colorHex,    // Make the color self-illuminating
        emissiveIntensity: 0.4, // Enough to pop, not enough to wash out
        metalness: 0.8, 
        roughness: 0.2,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1
    });
    
    // Carbon fiber / black parts
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.6, roughness: 0.8 });
    
    const wVal = 400 * scale; // sleeker width
    const lVal = 1400 * scale; // longer chassis
    const bodyHeight = 150 * scale;
    const wheelRad = 160 * scale;
    
    // Main Chassis
    const chassisGeometry = new THREE.BoxGeometry(wVal * 0.5, bodyHeight, lVal * 0.8);
    const body = new THREE.Mesh(chassisGeometry, paintMat);
    body.position.set(0, wheelRad + bodyHeight/2, 0); 
    body.castShadow = true; 
    group.add(body);
    
    // Sleek Nose
    const noseGeometry = new THREE.ConeGeometry(wVal * 0.25, lVal * 0.3, 4);
    const nose = new THREE.Mesh(noseGeometry, paintMat);
    nose.rotation.x = Math.PI / 2;
    nose.rotation.y = Math.PI / 4;
    nose.position.set(0, wheelRad + bodyHeight/2, lVal * 0.55); 
    nose.castShadow = true;
    group.add(nose);
    
    // Front Wing
    const frontWingGeo = new THREE.BoxGeometry(wVal * 1.6, 20 * scale, 150 * scale);
    const frontWing = new THREE.Mesh(frontWingGeo, darkMat);
    frontWing.position.set(0, wheelRad * 0.5, lVal * 0.6);
    frontWing.castShadow = true;
    group.add(frontWing);

    // Cockpit & Halo
    const cockpitGeo = new THREE.BoxGeometry(wVal * 0.4, bodyHeight * 0.8, lVal * 0.3);
    const cockpit = new THREE.Mesh(cockpitGeo, darkMat);
    cockpit.position.set(0, wheelRad + bodyHeight * 1.2, -lVal * 0.1); 
    group.add(cockpit);
    
    // Rear Wing 
    const spoilerSupports = new THREE.Mesh(new THREE.BoxGeometry(wVal * 0.4, bodyHeight*1.5, 50*scale), darkMat);
    spoilerSupports.position.set(0, wheelRad + bodyHeight, -lVal*0.45);
    group.add(spoilerSupports);

    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(wVal * 1.4, 20 * scale, 250 * scale), paintMat);
    spoiler.position.set(0, wheelRad + bodyHeight * 2, -lVal * 0.5); 
    spoiler.castShadow = true;
    group.add(spoiler);

    // Grand Prix Wheels 
    const wheelPositions = [
      [-wVal*0.8, wheelRad, lVal*0.45], [wVal*0.8, wheelRad, lVal*0.45], // Front
      [-wVal*0.9, wheelRad, -lVal*0.4], [wVal*0.9, wheelRad, -lVal*0.4]  // Rear (wider)
    ];
    
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9, metalness: 0.1 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xc0c0c0, metalness: 1.0, roughness: 0.2 });
    
    wheelPositions.forEach((p, idx) => {
      const isRear = idx >= 2;
      const wWidth = isRear ? 200 * scale : 150 * scale;
      const wGroup = new THREE.Group();
      
      const w = new THREE.Mesh(new THREE.CylinderGeometry(wheelRad, wheelRad, wWidth, 32), wheelMat);
      w.rotation.z = Math.PI / 2;
      w.castShadow = true;
      wGroup.add(w);
      
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(wheelRad*0.6, wheelRad*0.6, wWidth * 1.05, 16), rimMat);
      rim.rotation.z = Math.PI / 2;
      wGroup.add(rim);
      
      wGroup.position.set(p[0], p[1], p[2]);
      group.add(wGroup);
    });
    
    addDriver(group, wheelRad + bodyHeight * 0.8, -lVal * 0.1, scale);
    addVehicleCommon(group, colorHex, wheelRad + bodyHeight/2, lVal, wVal);
    return group;
  }

  function createMonsterTruck(colorHex) {
    const group = new THREE.Group();
    const scale = CAR_SCALE * 0.9;
    const paintMat = new THREE.MeshStandardMaterial({ color: colorHex, metalness: 0.8, roughness: 0.2 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.1 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 1.0, roughness: 0.0, transparent: true, opacity: 0.8 });
    
    const wheelRad = 450 * scale;
    const wheelWidth = 300 * scale;
    const wheelPositions = [
      [-320*scale, wheelRad, 750*scale], [320*scale, wheelRad, 750*scale],
      [-320*scale, wheelRad, -850*scale], [320*scale, wheelRad, -850*scale]
    ];
    
    wheelPositions.forEach(p => {
      const wGroup = new THREE.Group();
      const w = new THREE.Mesh(new THREE.CylinderGeometry(wheelRad, wheelRad, wheelWidth, 24), darkMat);
      w.rotation.z = Math.PI / 2;
      w.castShadow = true;
      wGroup.add(w);
      
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(wheelRad*0.65, wheelRad*0.6, wheelWidth*1.05, 12), chromeMat);
      rim.rotation.z = Math.PI / 2;
      wGroup.add(rim);

      wGroup.position.set(p[0], p[1], p[2]);
      group.add(wGroup);
    });

    // Extended Low-slung Wide Chassis
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(700*scale, 100*scale, 1800*scale), darkMat);
    chassis.position.set(0, wheelRad + 250*scale, -100*scale);
    group.add(chassis);

    // Lamborghini Style Wedge Body (Extended)
    const bodyBase = new THREE.Mesh(new THREE.BoxGeometry(850*scale, 200*scale, 2000*scale), paintMat);
    bodyBase.position.set(0, wheelRad + 350*scale, -100*scale);
    bodyBase.castShadow = true;
    group.add(bodyBase);

    // Sloped Sharp Nose
    const nose = new THREE.Mesh(new THREE.BoxGeometry(850*scale, 100*scale, 800*scale), paintMat);
    nose.rotation.x = 0.35;
    nose.position.set(0, wheelRad + 430*scale, 400*scale);
    group.add(nose);

    // Front Splitter
    const splitter = new THREE.Mesh(new THREE.BoxGeometry(900*scale, 40*scale, 200*scale), darkMat);
    splitter.position.set(0, wheelRad + 320*scale, 850*scale);
    group.add(splitter);

    // Low-profile cabin (Wedge style)
    const cabFront = new THREE.Mesh(new THREE.BoxGeometry(700*scale, 300*scale, 500*scale), glassMat);
    cabFront.rotation.x = -0.6;
    cabFront.position.set(0, wheelRad + 550*scale, 50*scale);
    group.add(cabFront);

    const cabRoof = new THREE.Mesh(new THREE.BoxGeometry(700*scale, 50*scale, 500*scale), paintMat);
    cabRoof.position.set(0, wheelRad + 700*scale, -200*scale);
    group.add(cabRoof);

    const cabBack = new THREE.Mesh(new THREE.BoxGeometry(700*scale, 300*scale, 400*scale), paintMat);
    cabBack.rotation.x = 0.4;
    cabBack.position.set(0, wheelRad + 560*scale, -450*scale);
    group.add(cabBack);

    addDriver(group, wheelRad + 400*scale, -50*scale, scale);
    addVehicleCommon(group, colorHex, wheelRad + 400*scale, 1600*scale, 850*scale);
    return group;
  }

  function createMotorcycle(colorHex) {
    const group = new THREE.Group();
    const scale = CAR_SCALE;
    const paintMat = new THREE.MeshStandardMaterial({ color: colorHex, metalness: 0.8, roughness: 0.2 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.5, roughness: 0.5 });
    
    const wheelRad = 350 * scale;
    const wheelWidth = 150 * scale;

    [700*scale, -700*scale].forEach(z => {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(wheelRad, wheelRad, wheelWidth, 16), darkMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(0, wheelRad, z);
      w.castShadow = true;
      group.add(w);
    });

    // Sport Bike Chassis
    const frame = new THREE.Mesh(new THREE.BoxGeometry(150*scale, 500*scale, 1200*scale), bodyMat);
    frame.position.set(0, wheelRad + 100*scale, 0);
    group.add(frame);

    // Fuel Tank
    const tank = new THREE.Mesh(new THREE.SphereGeometry(300*scale, 16, 16), paintMat);
    tank.scale.set(0.6, 0.8, 1.2);
    tank.position.set(0, wheelRad + 600*scale, 100*scale);
    group.add(tank);

    // Fairing / Nose
    const nose = new THREE.Mesh(new THREE.ConeGeometry(200*scale, 500*scale, 4), paintMat);
    nose.rotation.x = Math.PI / 2;
    nose.rotation.y = Math.PI / 4;
    nose.position.set(0, wheelRad + 500*scale, 600*scale);
    group.add(nose);

    // Seat
    const seat = new THREE.Mesh(new THREE.BoxGeometry(200*scale, 50*scale, 400*scale), darkMat);
    seat.position.set(0, wheelRad + 450*scale, -300*scale);
    group.add(seat);

    // Handlebars
    const bars = new THREE.Mesh(new THREE.BoxGeometry(600*scale, 40*scale, 40*scale), bodyMat);
    bars.position.set(0, wheelRad + 700*scale, 400*scale);
    group.add(bars);

    addDriver(group, wheelRad + 750*scale, -200*scale, scale, 0.3); // Leaning forward
    addVehicleCommon(group, colorHex, wheelRad + 400*scale, 1200*scale, 300*scale);
    return group;
  }

  function createSemiTruck(colorHex) {
    const group = new THREE.Group();
    const scale = CAR_SCALE;
    const paintMat = new THREE.MeshStandardMaterial({ color: colorHex, metalness: 0.5, roughness: 0.5 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 1.0, roughness: 0.1 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 1.0, roughness: 0.0, transparent: true, opacity: 0.5 });
    
    const wheelRad = 250 * scale;
    const wheelWidth = 200 * scale;

    const wheelPositions = [
      [-350*scale, wheelRad, 850*scale], [350*scale, wheelRad, 850*scale],
      [-350*scale, wheelRad, -700*scale], [350*scale, wheelRad, -700*scale],
      [-350*scale, wheelRad, -1100*scale], [350*scale, wheelRad, -1100*scale]
    ];
    
    wheelPositions.forEach(p => {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(wheelRad, wheelRad, wheelWidth, 24), darkMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(p[0], p[1], p[2]);
      w.castShadow = true;
      group.add(w);
    });

    // Heavier, Longer Chassis
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(700*scale, 150*scale, 2800*scale), darkMat);
    chassis.position.set(0, wheelRad + 50*scale, -200*scale);
    group.add(chassis);

    // Massive Imposing Cab
    const cab = new THREE.Mesh(new THREE.BoxGeometry(850*scale, 950*scale, 850*scale), paintMat);
    cab.position.set(0, wheelRad + 550*scale, 150*scale);
    cab.castShadow = true;
    group.add(cab);

    // Wide Flat Hood
    const hood = new THREE.Mesh(new THREE.BoxGeometry(850*scale, 650*scale, 950*scale), paintMat);
    hood.position.set(0, wheelRad + 350*scale, 1000*scale);
    group.add(hood);

    // Massive Vertical Chrome Grill
    const grill = new THREE.Mesh(new THREE.BoxGeometry(700*scale, 550*scale, 20*scale), chromeMat);
    grill.position.set(0, wheelRad + 350*scale, 1480*scale);
    group.add(grill);

    // Heavy Duty Chrome Bumper
    const bumper = new THREE.Mesh(new THREE.BoxGeometry(900*scale, 200*scale, 150*scale), chromeMat);
    bumper.position.set(0, wheelRad + 100*scale, 1550*scale);
    group.add(bumper);

    // Large Square Headlights
    [-380*scale, 380*scale].forEach(x => {
        const light = new THREE.Mesh(new THREE.BoxGeometry(120*scale, 120*scale, 20*scale), new THREE.MeshStandardMaterial({color: 0xffffff, emissive: 0xffffff}));
        light.position.set(x, wheelRad + 220*scale, 1555*scale);
        group.add(light);
    });

    // Windshield
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(750*scale, 400*scale, 10*scale), glassMat);
    windshield.position.set(0, wheelRad + 750*scale, 580*scale);
    group.add(windshield);

    // Aerodynamic Deflector (Integrated)
    const deflector = new THREE.Mesh(new THREE.BoxGeometry(850*scale, 400*scale, 850*scale), paintMat);
    deflector.rotation.x = 0.5;
    deflector.position.set(0, wheelRad + 1150*scale, -100*scale);
    group.add(deflector);

    // Side Fuel Tanks
    [-420*scale, 420*scale].forEach(x => {
        const tank = new THREE.Mesh(new THREE.CylinderGeometry(150*scale, 150*scale, 800*scale), chromeMat);
        tank.rotation.x = Math.PI/2;
        tank.position.set(x, wheelRad + 50*scale, 0);
        group.add(tank);
    });

    // Dual Tall Vertical Exhaust Stacks
    [-380*scale, 380*scale].forEach(x => {
        const stack = new THREE.Mesh(new THREE.CylinderGeometry(50*scale, 50*scale, 1500*scale), chromeMat);
        stack.position.set(x, wheelRad + 1050*scale, -300*scale);
        group.add(stack);
    });

    addDriver(group, wheelRad + 550*scale, 250*scale, scale);
    addVehicleCommon(group, colorHex, wheelRad + 350*scale, 2400*scale, 850*scale);
    return group;
  }

  function addDriver(group, y, z, scale, lean = 0) {
    const driverGroup = new THREE.Group();
    // Body / Suit
    const bodyGeo = new THREE.BoxGeometry(180*scale, 200*scale, 120*scale);
    const body = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({ color: 0x333333 }));
    driverGroup.add(body);
    
    // Helmet
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(80*scale, 16, 16), new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 0.8, roughness: 0.2 }));
    helmet.position.y = 150 * scale;
    driverGroup.add(helmet);
    
    // Visor
    const visor = new THREE.Mesh(new THREE.BoxGeometry(110*scale, 45*scale, 20*scale), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    visor.position.set(0, 160 * scale, 65 * scale);
    driverGroup.add(visor);
    
    driverGroup.position.set(0, y, z);
    if (lean !== 0) driverGroup.rotation.x = lean;
    group.add(driverGroup);
  }

  // Shared lights and indicator setup
  function addVehicleCommon(group, colorHex, lightY, length, width) {
    const scale = CAR_SCALE;
    
    // Headlights
    const headlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const hlLeft = new THREE.Mesh(new THREE.BoxGeometry(width * 0.2, 50 * scale, 10 * scale), headlightMat);
    hlLeft.position.set(-width * 0.3, lightY, length * 0.5);
    group.add(hlLeft);

    const hlRight = new THREE.Mesh(new THREE.BoxGeometry(width * 0.2, 50 * scale, 10 * scale), headlightMat);
    hlRight.position.set(width * 0.3, lightY, length * 0.5);
    group.add(hlRight);

    // Brake Lights (Tail lights)
    const brakeLightMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const blLeft = new THREE.Mesh(new THREE.BoxGeometry(width * 0.2, 50 * scale, 10 * scale), brakeLightMat);
    blLeft.position.set(-width * 0.3, lightY, -length * 0.5);
    group.add(blLeft);

    const blRight = new THREE.Mesh(new THREE.BoxGeometry(width * 0.2, 50 * scale, 10 * scale), brakeLightMat);
    blRight.position.set(width * 0.3, lightY, -length * 0.5);
    group.add(blRight);

    const carLight = new THREE.PointLight(0xffffff, 2, 4000);
    carLight.position.set(0, lightY, length * 0.6);
    group.add(carLight);

    // Place Indicator Sprite
    const spriteMat = new THREE.SpriteMaterial({ map: createPlaceTexture(1, colorHex), depthTest: true, transparent: true });
    const placeSprite = new THREE.Sprite(spriteMat);
    placeSprite.scale.set(1600 * scale, 1600 * scale, 1);
    const spriteY = lightY + 2000 * scale;
    placeSprite.position.set(0, spriteY, 0); 
    placeSprite.userData = { lastPlace: 1, baseColor: colorHex, baseY: spriteY };
    group.add(placeSprite);
    group.userData.placeSprite = placeSprite;
    group.castShadow = true;
  }

  function updateCars(data) {
    if (!isInitialized) return;
    const needsRecreate = carMeshes.length !== data.length || data.some((p, i) => {
      const m = carMeshes[i];
      return p.vehicleType !== m.userData.vehicleType || p.color.hex !== m.userData.colorHex;
    });

    if (needsRecreate) {
      carMeshes.forEach(m => scene.remove(m));
      carMeshes = data.map(p => { const m = createVehicle(p.color.hex, p.vehicleType); scene.add(m); return m; });
    }
    data.forEach((p, i) => {
      const m = carMeshes[i];
      // Update place sprite texture if place changed
      if (p.place && m.userData.placeSprite) {
        const sprite = m.userData.placeSprite;
        if (sprite.userData.lastPlace !== p.place) {
          sprite.userData.lastPlace = p.place;
          sprite.material.map.dispose();
          sprite.material.map = createPlaceTexture(p.place, p.color.hex);
        }
      }

      const t = (p.position % 100) / 100;
      const pt = trackCurve.getPointAt(t), tan = trackCurve.getTangentAt(t).normalize();
      const right = new THREE.Vector3().crossVectors(tan, new THREE.Vector3(0, 1, 0)).normalize();
      // Calculate a safe usable track width (80% of track) to ensure cars stay on the asphalt
      const usableWidth = TRACK_WIDTH * 0.8;
      const laneWidth = usableWidth / Math.max(data.length, 1);
      const laneOffset = (i - (data.length - 1) / 2) * laneWidth;
      const pos = pt.clone().add(right.multiplyScalar(laneOffset));
      m.position.copy(pos);
      m.position.y = 0; 
      m.lookAt(pos.clone().add(tan.multiplyScalar(100)));
      m.traverse(o => { 
        if(o.material) { 
          o.material.opacity = p.isFrozen ? 0.4 : 1; 
          // CRITICAL: Preserve transparency for sprites, set for others based on frozen state
          // Otherwise, sprites get a black background when car is not frozen
          o.material.transparent = (o.type === 'Sprite') ? true : p.isFrozen; 
        } 
      });
    });
  }

  function onResize() {
    if (!renderer || !camera) return;
    const cont = renderer.domElement.parentElement;
    camera.aspect = cont.clientWidth / cont.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(cont.clientWidth, cont.clientHeight);
    fitCameraToCanvas();
  }

  function render() {
    if (!isInitialized) return;
    
    // Animate crowd jumping
    const time = Date.now();
    crowdMeshes.forEach(person => {
        person.position.y = person.userData.baseY + Math.abs(Math.sin(time * person.userData.jumpSpeed + person.userData.jumpOffset)) * 50;
    });

    // Periodic Bird Spawning (every 45 seconds)
    if (time - lastBirdSpawnTime > 45000) {
        spawnBirdFlock();
        lastBirdSpawnTime = time;
    }

    // Animate birds flying straight across and remove when out of bounds
    for (let i = birds.length - 1; i >= 0; i--) {
        const bird = birds[i];
        bird.position.x += bird.userData.speedX;
        bird.position.z += bird.userData.speedZ;
        // Flapping motion simulation on Y axis
        bird.position.y = bird.userData.baseY + Math.sin(time * 0.01 + bird.userData.heightOffset) * 150;
        
        // Remove birds that flew past the far edge of the track
        if (bird.position.x > 30000) {
            scene.remove(bird);
            birds.splice(i, 1);
        }
    }

    // Animate place sprites bobbing
    carMeshes.forEach((carGroup, index) => {
        if (carGroup.userData.placeSprite) {
            const sprite = carGroup.userData.placeSprite;
            sprite.position.y = sprite.userData.baseY + Math.sin(time * 0.005 + index) * 50;
        }
    });

    animationFrameId = requestAnimationFrame(render);
    renderer.render(scene, camera);
  }

  return { init, setTrack: (d) => { currentDesign=d; if(isInitialized) createTrack(); }, setTotalLaps: (l) => {}, updateCars, startAnimation: render, stopAnimation: () => { cancelAnimationFrame(animationFrameId); isInitialized=false; } };
})();
