(() => {
  "use strict";

  const wrap = document.getElementById("gameWrap");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const levelEl = document.getElementById("level");
  const upgradeLine = document.getElementById("upgradeLine");
  const overlay = document.getElementById("overlay");
  const overlayInner = document.getElementById("overlayInner");

  // Three.js setup
  const scene = new THREE.Scene();
   scene.fog = new THREE.Fog(0x050510, 30, 400);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // реалистичный отклик материалов: физически корректный рендер и ACES-тонмаппинг
  if (THREE.ColorManagement) THREE.ColorManagement.enabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  // Защита от «белого экрана»: если GPU теряет контекст (перегруз), пробуем восстановить
  renderer.domElement.addEventListener("webglcontextlost", (e) => { e.preventDefault(); console.warn("WebGL context lost — восстановление..."); });
  renderer.domElement.addEventListener("webglcontextrestored", () => { console.warn("WebGL context restored"); });
  wrap.appendChild(renderer.domElement);

  let W = window.innerWidth,
    H = window.innerHeight;
  const SCALE = 0.045;
  function screenToWorldX(sx) {
    return (sx - W / 2) * SCALE;
  }
  function screenToWorldY(sy) {
    return (H / 2 - sy) * SCALE;
  }
  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    renderer.setSize(W, H);
    camera.aspect = W / H;
    const cameraZ = (H * SCALE) / (2 * Math.tan((60 * Math.PI) / 180 / 2));
    try { baseCameraZ = cameraZ; } catch (e) {}
    // Наклон камеры вниз на ~25° — как в играх, чтобы вращение предметов было видно в перспективе
    const camAngle = (25 * Math.PI) / 180;
    try { if (!cinematic) { camera.position.set(0, Math.sin(camAngle) * cameraZ, Math.cos(camAngle) * cameraZ); camera.lookAt(0, 0, 0); } } catch (e) { camera.position.set(0, Math.sin(camAngle) * cameraZ, Math.cos(camAngle) * cameraZ); camera.lookAt(0, 0, 0); }
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();

  // Lights
  const ambient = new THREE.AmbientLight(0x667799, 0.35);
  scene.add(ambient);
  const hemi = new THREE.HemisphereLight(0x88aaff, 0x221100, 0.4);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffaa66, 1.1);
  dir.position.set(8, 14, 10);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048, 2048);
  dir.shadow.camera.near = 0.5;
  dir.shadow.camera.far = 80;
  dir.shadow.bias = -0.0005;
  scene.add(dir);
  const playerLight = new THREE.PointLight(0x88ccff, 1.2, 8);
  scene.add(playerLight);
  const rimLight = new THREE.PointLight(0xff5533, 0.6, 20);
  rimLight.position.set(0, 5, -10);
  scene.add(rimLight);

  // Stars background
  const starGeo = new THREE.BufferGeometry();
  const starVerts = [];
  for (let i = 0; i < 600; i++) {
    starVerts.push((Math.random() - 0.5) * 200, Math.random() * 80 + 5, (Math.random() - 0.5) * 200);
  }
  starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starVerts, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.25, transparent: true, opacity: 0.8 }));
  scene.add(stars);

  // Sky dome
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(150, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0x0a0a2a, side: THREE.BackSide }),
  );
  scene.add(sky);

  // Moon
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(8, 32, 32),
    new THREE.MeshStandardMaterial({ color: 0xfff5cc, emissive: 0xfff5cc, emissiveIntensity: 1.2, roughness: 0.6 }),
  );
  moon.position.set(40, 50, -80);
  scene.add(moon);
  // moon glow
  const moonLight = new THREE.PointLight(0xfff5cc, 1.5, 120);
  moonLight.position.copy(moon.position);
  scene.add(moonLight);

  // Ground (realistic terrain)
  const groundGeo = new THREE.PlaneGeometry(300, 300, 80, 80);
  const pos = groundGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = (Math.sin(x * 0.08) * Math.cos(y * 0.07) * 0.4) + (Math.random() - 0.5) * 0.15;
    pos.setZ(i, z);
  }
  // без vertex colors — убирает «цветные кружки» на земле, остаётся чистая текстура
  groundGeo.computeVertexNormals();
  const groundTex = (() => {
    const c = document.createElement("canvas");
    c.width = 512; c.height = 512;
    const cx = c.getContext("2d");
    cx.fillStyle = "#3a2a18";
    cx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 4000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const r = Math.random() * 2 + 0.5;
      const shade = 40 + Math.random() * 40;
      cx.fillStyle = "rgb(" + shade + "," + (shade * 0.65 | 0) + "," + (shade * 0.35 | 0) + ")";
      cx.beginPath();
      cx.arc(x, y, r, 0, Math.PI * 2);
      cx.fill();
    }
    for (let i = 0; i < 1500; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      cx.strokeStyle = "rgba(40,80,20,0.6)";
      cx.lineWidth = 1;
      cx.beginPath();
      cx.moveTo(x, y);
      cx.lineTo(x + (Math.random() - 0.5) * 4, y - 4 - Math.random() * 4);
      cx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(8, 8);
    return tex;
  })();
  const ground = new THREE.Mesh(
    groundGeo,
    new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.95, metalness: 0.05 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -(H / 2) * SCALE - 0.6;
  ground.receiveShadow = true;
  scene.add(ground);
  ground.userData.decor = true;

  // Distant 3D scenery: mountains + forest
const mountainMat = new THREE.MeshStandardMaterial({ color: 0x2a2a4a, roughness: 0.9, metalness: 0.05 });
for (let i = 0; i < 6; i++) {
  const mw = 30 + Math.random() * 25;
  const mh = 18 + Math.random() * 22;
  const mtn = new THREE.Mesh(new THREE.ConeGeometry(mw, mh, 6), mountainMat);
  mtn.position.set((Math.random() - 0.5) * 120, ground.position.y + mh / 2 - 1, -150 - Math.random() * 60);
  mtn.rotation.y = Math.random() * Math.PI;
  scene.add(mtn);
  // snow cap
  const cap = new THREE.Mesh(new THREE.ConeGeometry(mw * 0.35, mh * 0.25, 6), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }));
  cap.position.set(mtn.position.x, mtn.position.y + mh * 0.42, mtn.position.z);
  scene.add(cap);
}
// forest wall: many low-poly trees in distance
const forestMat = new THREE.MeshStandardMaterial({ color: 0x0d2a0d, roughness: 0.9 });
const trunkMatF = new THREE.MeshStandardMaterial({ color: 0x2a1a0a, roughness: 0.95 });
for (let i = 0; i < 260; i++) {
  const fx = (Math.random() - 0.5) * 260;
  const fz = -90 - Math.random() * 120;
  const h = 3 + Math.random() * 5;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.25, h, 6), trunkMatF);
  trunk.position.set(fx, ground.position.y + h / 2, fz);
  scene.add(trunk);
  const crown = new THREE.Mesh(new THREE.ConeGeometry(1.6 + Math.random() * 1.4, h * 1.3, 7), forestMat);
  crown.position.set(fx, ground.position.y + h + h * 0.5, fz);
  scene.add(crown);
}
// distant bushes & stones in the far background
for (let i = 0; i < 40; i++) {
  const bx = (Math.random() - 0.5) * 240;
  const bz = -120 - Math.random() * 90;
  const bush = new THREE.Mesh(
    new THREE.SphereGeometry(0.9 + Math.random() * 0.7, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x1a3314, roughness: 0.9 }),
  );
  bush.scale.y = 0.7;
  bush.position.set(bx, ground.position.y + 0.4, bz);
  bush.castShadow = true;
  scene.add(bush);
}
for (let i = 0; i < 30; i++) {
  const rx = (Math.random() - 0.5) * 240;
  const rz = -120 - Math.random() * 90;
  const rock = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.5 + Math.random() * 0.8, 0),
    new THREE.MeshStandardMaterial({ color: 0x4a4a55, roughness: 0.95, metalness: 0.05 }),
  );
  rock.position.set(rx, ground.position.y + 0.2, rz);
  rock.castShadow = true;
  scene.add(rock);
}

// Environment: road + Halloween houses
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 300),
    new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9, metalness: 0.1 }),
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, ground.position.y + 0.02, -20);
  road.receiveShadow = true;
  scene.add(road);
  // road lines
  for (let i = -120; i <= 120; i += 12) {
    const line = new THREE.Mesh(
      new THREE.PlaneGeometry(0.8, 4),
      new THREE.MeshStandardMaterial({ color: 0xffffcc, emissive: 0xffffcc, emissiveIntensity: 0.3 }),
    );
    line.rotation.x = -Math.PI / 2;
    line.position.set(0, ground.position.y + 0.03, i);
    scene.add(line);
  }
  function makeCanvasTexture(draw) {
    const c = document.createElement("canvas");
    c.width = 256; c.height = 256;
    const cx = c.getContext("2d");
    draw(cx, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }
  function makeWallTexture(base) {
    return makeCanvasTexture((cx, s) => {
      cx.fillStyle = base;
      cx.fillRect(0, 0, s, s);
      const bw = 48, bh = 24;
      for (let y = 0; y < s; y += bh) {
        const off = (Math.floor(y / bh) % 2) * (bw / 2);
        for (let x = -bw; x < s + bw; x += bw) {
          const bx = x + off;
          cx.fillStyle = "rgba(30,20,10,0.55)";
          cx.fillRect(bx, y, bw, bh);
          const shade = 0.75 + Math.random() * 0.4;
          const r = parseInt(base.slice(1, 3), 16);
          const g = parseInt(base.slice(3, 5), 16);
          const b = parseInt(base.slice(5, 7), 16);
          cx.fillStyle = "rgb(" + Math.min(255, (r * shade) | 0) + "," + Math.min(255, (g * shade) | 0) + "," + Math.min(255, (b * shade) | 0) + ")";
          cx.fillRect(bx + 2, y + 2, bw - 4, bh - 4);
          cx.fillStyle = "rgba(255,255,255,0.06)";
          cx.fillRect(bx + 2, y + 2, bw - 4, 3);
        }
      }
    });
  }
  function makeRoofTexture() {
    return makeCanvasTexture((cx, s) => {
      cx.fillStyle = "#4a2a1a";
      cx.fillRect(0, 0, s, s);
      const tw = 32, th = 16;
      for (let y = 0; y < s; y += th) {
        const off = (Math.floor(y / th) % 2) * (tw / 2);
        for (let x = -tw; x < s + tw; x += tw) {
          const tx = x + off;
          cx.fillStyle = "rgba(0,0,0,0.4)";
          cx.fillRect(tx, y, tw, th);
          const shade = 0.8 + Math.random() * 0.4;
          cx.fillStyle = "rgb(" + ((110 * shade) | 0) + "," + ((60 * shade) | 0) + "," + ((40 * shade) | 0) + ")";
          cx.fillRect(tx + 2, y + 2, tw - 4, th - 4);
        }
      }
    });
  }

  function makeHouse(x, z) {
    const g = new THREE.Group();
    const wallColor = Math.random() > 0.5 ? "#ccaa88" : "#88aacc";
    const wallTex = makeWallTexture(wallColor);
    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.85, metalness: 0.05 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(8, 6, 6), wallMat);
    body.position.y = 3;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
    const roofTex = makeRoofTexture();
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(6, 3, 4),
      new THREE.MeshStandardMaterial({ map: roofTex, roughness: 0.9, metalness: 0.05 }),
    );
    roof.position.y = 7.5;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    g.add(roof);
    const chimney = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 2.2, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x6a3a2a, roughness: 0.9 }),
    );
    chimney.position.set(2, 8.2, -1);
    chimney.castShadow = true;
    g.add(chimney);
    const door = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 2.5),
      new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.7 }),
    );
    door.position.set(0, 1.25, 3.01);
    g.add(door);
    const handle = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xccaa44, metalness: 0.8, roughness: 0.3 }),
    );
    handle.position.set(0.55, 1.2, 3.05);
    g.add(handle);
    function makeWindow(px, py) {
      const grp = new THREE.Group();
      const glass = new THREE.Mesh(
        new THREE.PlaneGeometry(1.2, 1.2),
        new THREE.MeshStandardMaterial({ color: 0xffaa44, emissive: 0xff6600, emissiveIntensity: 0.9, transparent: true, opacity: 0.9 }),
      );
      grp.add(glass);
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.7 });
      const fh = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.12, 0.05), frameMat);
      fh.position.y = 0.62;
      grp.add(fh);
      const fh2 = fh.clone(); fh2.position.y = -0.62; grp.add(fh2);
      const fv = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.35, 0.05), frameMat);
      fv.position.x = 0.62; grp.add(fv);
      const fv2 = fv.clone(); fv2.position.x = -0.62; grp.add(fv2);
      grp.position.set(px, py, 3.02);
      return grp;
    }
    g.add(makeWindow(2.5, 3.5));
    g.add(makeWindow(-2.5, 3.5));
    const pump = new THREE.Mesh(
      new THREE.SphereGeometry(0.6, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xff7a18, emissive: 0xff3d00, emissiveIntensity: 0.4 }),
    );
    pump.scale.set(1, 0.85, 1);
    pump.position.set(3.5, 0.5, 4);
    pump.castShadow = true;
    g.add(pump);
g.traverse((o) => {
  if (o.isMesh && o.material) {
    const m = o.material;
    if (m.transparent === undefined) m.transparent = false;
    m._origOpacity = m.opacity !== undefined ? m.opacity : 1;
    m._origTransparent = m.transparent;
  }
});
g.position.set(x, ground.position.y + 0.0, z);
scene.add(g);
g.userData.decor = true;
return g;
  }
const houses = [];
for (let i = 0; i < 6; i++) {
  houses.push(makeHouse(-8, -60 + i * 22));
  houses.push(makeHouse(8, -60 + i * 22));
}

  // Trees to fill background
  function makeTree(x, z) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.4, 3, 8),
      new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.9 }),
    );
    trunk.position.y = 1.5;
    trunk.castShadow = true;
    g.add(trunk);
    const leaves = new THREE.Mesh(
      new THREE.ConeGeometry(2.2, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0x1a3a1a, roughness: 0.8 }),
    );
    leaves.position.y = 4.5;
    leaves.castShadow = true;
    g.add(leaves);
    const leaves2 = leaves.clone();
    leaves2.position.y = 6;
    leaves2.scale.set(0.7, 0.7, 0.7);
    g.add(leaves2);
    g.position.set(x, ground.position.y, z);
    scene.add(g);
    g.userData.decor = true;
    return g;
  }
  for (let i = 0; i < 12; i++) {
     makeTree(-12, -80 + i * 14);
     makeTree(12, -80 + i * 14);
  }
  // fence along road
  for (let z = -100; z <= 100; z += 4) {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 1.2, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x5a3a2a, roughness: 0.9 }),
    );
    post.position.set(-6, ground.position.y + 0.6, z);
    scene.add(post);
    post.userData.decor = true;
    const post2 = post.clone();
    post2.position.x = 6;
    scene.add(post2);
   }

    // Street lamps along the road
    function makeLamp(x, z) {
      const g = new THREE.Group();
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.12, 6, 8),
        new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.7, roughness: 0.4 }),
      );
      pole.position.y = 3;
      pole.castShadow = true;
      g.add(pole);
      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.08, 0.08),
        new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.7, roughness: 0.4 }),
      );
      arm.position.set(x > 0 ? -0.6 : 0.6, 5.8, 0);
      g.add(arm);
      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.25, 12, 12),
        new THREE.MeshStandardMaterial({ color: 0xffeebb, emissive: 0xffcc66, emissiveIntensity: 1.2 }),
      );
      lamp.position.set(x > 0 ? -1.2 : 1.2, 5.8, 0);
      g.add(lamp);
      const light = new THREE.PointLight(0xffcc66, 0.8, 18);
      light.position.copy(lamp.position);
      g.add(light);
      g.position.set(x, ground.position.y, z);
      scene.add(g);
      g.userData.decor = true;
      return g;
    }
    for (let z = -90; z <= 90; z += 18) {
      makeLamp(-7.5, z);
      makeLamp(7.5, z);
    }

    // Rocks & grass tufts for terrain detail
    for (let i = 0; i < 60; i++) {
      const rx = (Math.random() - 0.5) * 60;
      const rz = (Math.random() - 0.5) * 200;
      if (Math.abs(rx) < 8) continue;
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.3 + Math.random() * 0.5, 0),
        new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.95, metalness: 0.05 }),
      );
      rock.position.set(rx, ground.position.y + 0.15, rz);
      rock.castShadow = true;
      rock.receiveShadow = true;
      scene.add(rock);
    }
    for (let i = 0; i < 80; i++) {
      const gx = (Math.random() - 0.5) * 60;
      const gz = (Math.random() - 0.5) * 200;
      if (Math.abs(gx) < 9) continue;
      const tuft = new THREE.Mesh(
        new THREE.ConeGeometry(0.15, 0.6, 5),
        new THREE.MeshStandardMaterial({ color: 0x2a4a1a, roughness: 0.9 }),
      );
      tuft.position.set(gx, ground.position.y + 0.3, gz);
      scene.add(tuft);
    }

    // Extra vegetation: bushes, grass patches, stumps
    for (let i = 0; i < 50; i++) {
      const bx = (Math.random() - 0.5) * 70;
      const bz = (Math.random() - 0.5) * 220;
      if (Math.abs(bx) < 9) continue;
      const bush = new THREE.Mesh(
        new THREE.SphereGeometry(0.6 + Math.random() * 0.5, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0x1f3a14 + (Math.random() * 0x101010 | 0), roughness: 0.9 }),
      );
      bush.scale.y = 0.7;
      bush.position.set(bx, ground.position.y + 0.35, bz);
      bush.castShadow = true;
      scene.add(bush);
    }
    for (let i = 0; i < 120; i++) {
      const gx = (Math.random() - 0.5) * 70;
      const gz = (Math.random() - 0.5) * 220;
      if (Math.abs(gx) < 9) continue;
      const blade = new THREE.Mesh(
        new THREE.PlaneGeometry(0.05, 0.5 + Math.random() * 0.4),
        new THREE.MeshStandardMaterial({ color: 0x3a6a22, side: THREE.DoubleSide, roughness: 0.9 }),
      );
      blade.position.set(gx, ground.position.y + 0.25, gz);
      blade.rotation.y = Math.random() * Math.PI;
      scene.add(blade);
    }
    for (let i = 0; i < 15; i++) {
      const sx = (Math.random() > 0.5 ? 1 : -1) * (10 + Math.random() * 20);
      const sz = (Math.random() - 0.5) * 200;
      const stump = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.5, 0.6, 8),
        new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.95 }),
      );
      stump.position.set(sx, ground.position.y + 0.3, sz);
      scene.add(stump);
    }

    // Pumpkins
   const pumpkins = [];
   function makePumpkin(x, y) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.9, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xff7a18, roughness: 0.7 }),
    );
    body.scale.set(1, 0.85, 1);
    body.castShadow = true;
    g.add(body);
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.15, 0.4, 8),
      new THREE.MeshStandardMaterial({ color: 0x3a8f2a }),
    );
    stem.position.y = 0.7;
    g.add(stem);
    g.position.set(screenToWorldX(x), screenToWorldY(y), 0);
    scene.add(g);
    g.userData.decor = true;
    return g;
  }

  // Bats (реалистичные: объёмное тело, перепончатые крылья с суставами, уши)
  const bats = [];
  function makeBat() {
    const g = new THREE.Group();
    const furMat = new THREE.MeshStandardMaterial({ color: 0x14100e, roughness: 0.9 });
    const membraneMat = new THREE.MeshStandardMaterial({ color: 0x1e1412, roughness: 0.75, side: THREE.DoubleSide, transparent: true, opacity: 0.94 });
    // тело: пухлое, обтекаемое
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), furMat);
    body.scale.set(1, 0.85, 1.5);
    g.add(body);
    // голова
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), furMat);
    head.position.set(0, 0.06, 0.18);
    g.add(head);
    // уши
    for (const ex of [-0.05, 0.05]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 5), furMat);
      ear.position.set(ex, 0.15, 0.18);
      ear.rotation.z = ex > 0 ? -0.2 : 0.2;
      g.add(ear);
    }
    // лапки, поджатые под тело
    const feetMat = new THREE.MeshStandardMaterial({ color: 0x2a1c14, roughness: 0.85 });
    for (const fx of [-0.06, 0.06]) {
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.09, 5), feetMat);
      foot.position.set(fx, -0.14, 0.05);
      foot.rotation.x = 0.9;
      g.add(foot);
    }
    // крылья: две фаланги (плечо + кончик) на каждой стороне, вращаются от «сустава»
    // pivot-группы позволяют махать крылом с естественным изгибом
    // Крылья: перепонка с реальным контуром (изогнутая мембрана, как у летучей мыши)
    function batWingShape(mirror) {
      const s = new THREE.Shape();
      const m = mirror ? -1 : 1;
      s.moveTo(0, 0.1);            // у тела сверху
      s.quadraticCurveTo(m * 0.3, 0.28, m * 0.55, 0.1);   // верхний край (плечевая кость)
      s.quadraticCurveTo(m * 0.75, 0.02, m * 0.9, -0.06); // палец наружу
      s.quadraticCurveTo(m * 0.7, -0.16, m * 0.45, -0.18); // нижняя перепонка (изгиб)
      s.quadraticCurveTo(m * 0.25, -0.22, 0, -0.14);      // к телу
      s.closePath();
      return s;
    }
    function makeMembrane(mirror) {
      const geo = new THREE.ShapeGeometry(batWingShape(mirror));
      const mesh = new THREE.Mesh(geo, membraneMat);
      // ShapeGeometry лежит в плоскости XY — поворачиваем, чтобы крыло было горизонтально
      mesh.rotation.x = -Math.PI / 2;
      return mesh;
    }
    const wingPivotL = new THREE.Group();
    wingPivotL.position.set(-0.14, 0.02, 0);
    wingPivotL.add(makeMembrane(true));
    g.add(wingPivotL);
    const wingPivotR = new THREE.Group();
    wingPivotR.position.set(0.14, 0.02, 0);
    wingPivotR.add(makeMembrane(false));
    g.add(wingPivotR);
    scene.add(g);
    return {
      g, wing: wingPivotL, wing2: wingPivotR,
      x: Math.random() * W,
      y: Math.random() * H * 0.35,
      vx: (Math.random() - 0.5) * 1.2,
      phase: Math.random() * Math.PI * 2,
      flapSpeed: 0.09 + Math.random() * 0.05,
    };
  }
  for (let i = 0; i < 9; i++) bats.push(makeBat());
  const alienShips = [];
  function makeAlienShip() {
    const g = new THREE.Group();
    const ship = makeSpaceship();
    ship.scale.setScalar(0.3);
    g.add(ship);
    const alien = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), new THREE.MeshStandardMaterial({color:0x33ff66, emissive:0x11aa33, emissiveIntensity:0.4}));
    alien.position.set(0, 0.6, 0);
    g.add(alien);
    scene.add(g);
    g.visible = false;
    return { g, x: Math.random()*W, y: Math.random()*H*0.3, vx: (Math.random()-0.5)*0.8, phase: Math.random()*Math.PI*2 };
  }
  for (let i = 0; i < 5; i++) alienShips.push(makeAlienShip());

  // Audio
  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        audioCtx = null;
      }
    }
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  }
  function beep(freq, dur, type = "sine", vol = 0.08) {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
    o.connect(g).connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + dur);
  }

  // State
  let state = "menu";
  let score = 0;
  let best = +localStorage.getItem("szh_best") || 0;
  let level = 1;
  let lives = 3;
  let player = null;
  let vapeTemplate = null;
  let shots = [];
  let enemies = [];
  let bonuses = [];
  let particles = [];
  let smoke = [];
  let spawnTimer = 0;
  let bonusTimer = 0;
   let buffUntil = 0;
   let freezeUntil = 0;
  let lastShot = 0;
  let keys = { left: false, right: false };
  let touchStartX = null;
  let touchMoved = false;
  let mouseX = null;

  const MAX_AMMO = 20;
  let ammo = MAX_AMMO;
  let reloading = false;
  let reloadUntil = 0;
  let reloadStart = 0;

  let playerName = localStorage.getItem("szh_name") || "";
  let tgUser = null;
  try { tgUser = JSON.parse(localStorage.getItem("szh_tg") || "null"); } catch (e) { tgUser = null; }
  if (tgUser && (tgUser.first_name || tgUser.username)) {
    playerName = tgUser.first_name || tgUser.username || playerName;
  }
  let leaderboard = [];
  // —— Перки / рюкзак / сундук / город ——
  let _permPerks = [];
  try { _permPerks = JSON.parse(localStorage.getItem("szh_perm_perks") || "[]"); } catch (e) { _permPerks = []; }
  let chest = null;
  let chestTakenThisRun = false; // 1 предмет за забег
  let perks = [];
  let extraLives = 0;
  let bulletSpread = 0;
  let scoreBoost = false;
  let cityMode = false;
  let cityCinematicDone = false;
  let cityDecor = [];
  let cityCars = [];
  let cityPedestrians = [];
  // planetGroundLift удалён: земля планеты теперь на уровне базовой земли
  const killPhrases = ["Выкуси!", "Теперь будешь знать, каково это — когда тебя сосут!", "Вы скурили мою семью!", "У мамы теперь пососи!", "Это был не картридж... а его голова!"];
  let lastPhrase = "";
  let spaceMode = false;
  let planetMode = false;
  let cinematicKind = null;
  let spaceCinematicDone = false;
  let planetCinematicDone = false;
  let slowUntil = 0;
  let cinematic = null;
  let cinematicStarted = false;
  let spaceship = null;
  let baseCameraZ = camera.position.z;

  // Player 3D
  function attachSpeech(g) {
    const speechPhrases = ["Получайте, твари!", "Ещё раз?", "Больше ни разу!", "Да как вы смеете!", "Да вы чё, серьёзно?", "Бывало и лучше", "А как тебе такое?"];
    const speechCanvas = document.createElement("canvas");
    speechCanvas.width = 512; speechCanvas.height = 128;
    const speechCtx = speechCanvas.getContext("2d");
    const speechTex = new THREE.CanvasTexture(speechCanvas);
    const speechMat = new THREE.SpriteMaterial({ map: speechTex, transparent: true, depthTest: false });
    const speechSprite = new THREE.Sprite(speechMat);
    speechSprite.scale.set(5.5, 1.375, 1); // умеренный размер, читается на любом ракурсе
    speechSprite.position.set(0, 3.4, 0);
    speechSprite.visible = false;
    g.add(speechSprite);
    g.userData.speech = { sprite: speechSprite, canvas: speechCanvas, ctx: speechCtx, tex: speechTex, phrases: speechPhrases, active: false, text: "", index: 0, timer: 0, nextTime: performance.now() + 2000 + Math.random() * 3000 };
  }
  // Предзагрузка GLTF-модели вейпа: к моменту первого запуска vapeTemplate уже готов, фолбэк не мелькает
  if (typeof THREE.GLTFLoader !== "undefined" && !vapeTemplate) {
    new THREE.GLTFLoader().load("geek_pulse.glb", (gltf) => {
      try {
        vapeTemplate = gltf.scene;
        vapeTemplate.scale.set(3.5, 3.5, 3.5);
        vapeTemplate.position.set(0, -0.2, 0);
        vapeTemplate.traverse((o) => { if (o.isMesh && o.material) { if (o.material.color) o.material.color.set(0x2255aa); if (o.material.emissive) o.material.emissive.set(0x113366); } });
      } catch (e) {}
    }, undefined, () => {});
  }
  function makePlayer() {
    const g = new THREE.Group();
    scene.add(g);
    if (vapeTemplate) {
      const model = vapeTemplate.clone(true);
      model.scale.set(3.5, 3.5, 3.5);
      model.position.set(0, -0.2, 0);
      model.traverse((o) => { if (o.isMesh && o.material) { if (o.material.color) o.material.color.set(0x2255aa); if (o.material.emissive) o.material.emissive.set(0x113366); } });
      g.add(model);
      g.userData.model = model;
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const pupilMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
      const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), eyeMat);
      const pupilL = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), pupilMat);
      eyeL.position.set(-0.35, 0.7, 1.2);
      pupilL.position.set(0, 0, 0.12);
      eyeL.add(pupilL);
      const eyeR = eyeL.clone();
      eyeR.position.x = 0.35;
      g.add(eyeL); g.add(eyeR);
      g.userData.eyes = [eyeL, eyeR];
      const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.12), new THREE.MeshStandardMaterial({ color: 0x111111 }));
      mouth.position.set(0, 0.45, 1.3);
      g.add(mouth);
      g.userData.mouth = mouth;
      attachSpeech(g);
      return g;
    }
    // Fallback-вейп: виден МГНОВЕННО, пока грузится GLTF-модель (иначе моделька «пропадает» при пересоздании игрока)
    const fbBody = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.2, 0.55), new THREE.MeshStandardMaterial({ color: 0x2255aa, metalness: 0.6, roughness: 0.35 }));
    fbBody.position.y = 0.6; fbBody.castShadow = true; g.add(fbBody);
    const fbTank = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 1.0, 20), new THREE.MeshPhysicalMaterial({ color: 0x99ccff, opacity: 0.7, transparent: true, roughness: 0.1 }));
    fbTank.rotation.z = Math.PI / 2; fbTank.position.y = 1.0; g.add(fbTank);
    const fbMouth = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.35, 16), new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.9 }));
    fbMouth.position.y = 1.85; g.add(fbMouth);
    g.userData.fallback = true;
    // load GLTF vape
    if (typeof THREE.GLTFLoader !== "undefined") {
      const loader = new THREE.GLTFLoader();
      loader.load("geek_pulse.glb", (gltf) => {
        // remove placeholder
        if (g.userData.fallback) {
          g.remove(fbBody); g.remove(fbTank); g.remove(fbMouth);
          g.userData.fallback = false;
        }
        const model = gltf.scene;
        // scale to fit
        model.scale.set(3.5, 3.5, 3.5);
        model.position.set(0, -0.2, 0);
        // recolor materials
        model.traverse((o) => {
          if (o.isMesh && o.material) {
            if (o.material.color) o.material.color.set(0x2255aa);
            if (o.material.emissive) o.material.emissive.set(0x113366);
          }
        });
        g.add(model);
        g.userData.model = model;
        // eyes
        const eyeMat = new THREE.MeshBasicMaterial({color:0xffffff});
        const pupilMat = new THREE.MeshBasicMaterial({color:0x000000});
        const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), eyeMat);
        const pupilL = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), pupilMat);
        eyeL.position.set(-0.35, 0.7, 1.2);
        pupilL.position.set(0, 0, 0.12);
        eyeL.add(pupilL);
        const eyeR = eyeL.clone();
        eyeR.position.x = 0.35;
        g.add(eyeL);
        g.add(eyeR);
        g.userData.eyes = [eyeL, eyeR];
        const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.12), new THREE.MeshStandardMaterial({color:0x111111}));
        mouth.position.set(0, 0.45, 1.3);
        g.add(mouth);
        g.userData.mouth = mouth;
        // кэшируем базовую модель для последующих пересозданий
        try { vapeTemplate = model.clone(true); } catch (e) {}
        // phrases
         attachSpeech(g);
      }, undefined, (err) => {
        console.error("GLTF load error", err);
      });
    }
    return g;
  }

  function makeZombie() {
    // Реалистичный зомби: естественная анатомия (капсулы, шарнирные группы),
    // мёртвая серо-зелёная кожа, рваная одежда, асимметрия, гниющие детали
    const g = new THREE.Group();
    const skinMat = new THREE.MeshStandardMaterial({ color: 0x7f9a6a, roughness: 0.95, metalness: 0.0 });
    const rotMat   = new THREE.MeshStandardMaterial({ color: 0x54663f, roughness: 1.0 });   // гниль/пятна
    const clothMat = new THREE.MeshStandardMaterial({ color: 0x4a3f33, roughness: 1.0 });   // рваная рубашка
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x2e2a26, roughness: 1.0 });
    const shoeMat  = new THREE.MeshStandardMaterial({ color: 0x191512, roughness: 0.9 });

    // ТАЗ и ТОРС: капсулы вместо кубов — плавные объёмы
    const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.26, 18, 14), pantsMat);
    pelvis.scale.set(1.15, 0.8, 0.85); pelvis.position.y = 0.1; pelvis.castShadow = true; g.add(pelvis);
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.5, 6, 16), clothMat);
    torso.scale.set(1.25, 1, 0.8); torso.position.y = 0.62; torso.rotation.x = 0.12; torso.castShadow = true; g.add(torso);
    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 14), clothMat);
    chest.scale.set(1.25, 0.9, 0.85); chest.position.set(0, 0.95, 0.02); chest.castShadow = true; g.add(chest);
    // дыры в одежде + проблёскивающая гниль
    const tear = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), rotMat);
    tear.position.set(0.16, 0.55, 0.21); tear.scale.set(1, 0.7, 0.4); g.add(tear);
    const tear2 = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), rotMat);
    tear2.position.set(-0.2, 0.85, 0.2); tear2.scale.set(1.1, 0.6, 0.4); g.add(tear2);

    // ШЕЯ
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.18, 10), skinMat);
    neck.position.y = 1.22; neck.rotation.x = 0.1; g.add(neck);

    // ГОЛОВА: вытянутая, с черепными буграми, челюсть отвисла
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 24, 20), skinMat);
    head.scale.set(0.92, 1.08, 1.05); head.position.set(0, 1.44, 0.02); head.castShadow = true; g.add(head);
    const brow = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), skinMat);
    brow.scale.set(1.8, 0.5, 0.8); brow.position.set(0, 1.5, 0.18); g.add(brow);
    // пятна гнили на лице и голове
    const rotSpot = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), rotMat);
    rotSpot.position.set(0.13, 1.46, 0.16); rotSpot.scale.set(1, 0.8, 0.4); g.add(rotSpot);
    const rotSpot2 = rotSpot.clone(); rotSpot2.position.set(-0.1, 1.56, 0.12); rotSpot2.scale.set(0.7, 0.9, 0.4); g.add(rotSpot2);
    // впалые глазницы + мутные светящиеся зрачки
    const socketMat = new THREE.MeshStandardMaterial({ color: 0x2a3320, roughness: 1.0 });
    const eyeGlowMat = new THREE.MeshStandardMaterial({ color: 0xffd257, emissive: 0xffaa00, emissiveIntensity: 1.6 });
    for (const ex of [-0.08, 0.08]) {
      const socket = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10), socketMat);
      socket.position.set(ex, 1.49, 0.17); g.add(socket);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), eyeGlowMat);
      pupil.position.set(ex, 1.49, 0.2); g.add(pupil);
    }
    // отвисшая челюсть с зубами
    const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 12), skinMat);
    jaw.scale.set(0.9, 0.7, 1.0); jaw.position.set(0, 1.31, 0.09); g.add(jaw);
    const mouthCavity = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.07, 0.08), new THREE.MeshStandardMaterial({ color: 0x1a0d08, roughness: 1.0 }));
    mouthCavity.position.set(0, 1.33, 0.2); g.add(mouthCavity);
    const toothMat = new THREE.MeshStandardMaterial({ color: 0xd8cfa8, roughness: 0.5 });
    for (let i = 0; i < 4; i++) {
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.03, 0.015), toothMat);
      tooth.position.set(-0.05 + i * 0.033, 1.355, 0.225); g.add(tooth);
    }
    // клочья волос
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x241c14, roughness: 1.0 });
    for (let i = 0; i < 6; i++) {
      const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.09, 4), hairMat);
      const a = i * 1.05;
      tuft.position.set(Math.sin(a) * 0.14, 1.62 + (i % 2) * 0.02, Math.cos(a) * 0.1 - 0.02);
      tuft.rotation.set((Math.random() - 0.5) * 0.8, 0, (Math.random() - 0.5) * 0.8);
      g.add(tuft);
    }

    // РУКИ: шарнирные группы (плечо -> локоть -> кисть), выставлены вперёд как у классического зомби
    function makeArm(side) {
      const pivot = new THREE.Group(); pivot.position.set(side * 0.33, 0.98, 0);
      const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.26, 4, 10), skinMat);
      upper.position.y = -0.16; upper.castShadow = true; pivot.add(upper);
      const elbow = new THREE.Group(); elbow.position.y = -0.32; pivot.add(elbow);
      const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.24, 4, 10), skinMat);
      fore.position.y = -0.15; fore.castShadow = true; elbow.add(fore);
      elbow.rotation.x = -1.15; // предплечье вперёд
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), skinMat);
      hand.scale.set(0.9, 1.1, 0.7); hand.position.y = -0.3; elbow.add(hand);
      for (let f = 0; f < 3; f++) {
        const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.014, 0.05, 3, 6), skinMat);
        finger.position.set(-0.03 + f * 0.03, -0.38, 0.02); finger.rotation.x = 0.4; elbow.add(finger);
      }
      pivot.rotation.x = -1.35; // вся рука вытянута вперёд
      pivot.rotation.z = side * 0.12;
      g.add(pivot);
      return pivot;
    }
    makeArm(-1); makeArm(1);

    // НОГИ: бедро -> колено -> ступня
    function makeLeg(side) {
      const pivot = new THREE.Group(); pivot.position.set(side * 0.15, 0.08, 0);
      const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.3, 4, 10), pantsMat);
      thigh.position.y = -0.2; thigh.castShadow = true; pivot.add(thigh);
      const knee = new THREE.Group(); knee.position.y = -0.42; pivot.add(knee);
      const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.28, 4, 10), pantsMat);
      shin.position.y = -0.18; shin.castShadow = true; knee.add(shin);
      const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), shoeMat);
      shoe.scale.set(1, 0.6, 1.6); shoe.position.set(0, -0.4, 0.04); knee.add(shoe);
      knee.rotation.x = 0.15;
      pivot.rotation.x = -0.08; g.add(pivot);
      return pivot;
    }
    makeLeg(-1); makeLeg(1);

    // ВИЛЫ: деревянное топорище + металлические зубцы с остриями
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.038, 1.7, 10), new THREE.MeshStandardMaterial({ color: 0x5a4028, roughness: 0.9 }));
    handle.position.set(0.62, 0.35, 0.25); handle.rotation.z = -0.25; handle.castShadow = true; g.add(handle);
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.85, roughness: 0.35 });
    const forkBase = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.045, 0.045), metalMat);
    forkBase.position.set(0.74, 0.85, 0.25); forkBase.rotation.z = -0.25; g.add(forkBase);
    for (let i = -1; i <= 1; i++) {
      const prong = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.006, 0.42, 8), metalMat);
      prong.position.set(0.66 + i * 0.085, 1.07, 0.25); prong.rotation.z = -0.25; g.add(prong);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.07, 8), metalMat);
      tip.position.set(0.615 + i * 0.085, 1.29, 0.25); tip.rotation.z = -0.25; g.add(tip);
    }
    // ВЫРАВНИВАНИЕ: как у старой модели, ступни на y ≈ -2.0 (контакт с землёй)
    g.children.slice().forEach((c) => { c.position.y -= 1.2; });
      if (spaceMode) {
        const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.55,16,16), new THREE.MeshStandardMaterial({color:0xddddff, transparent:true, opacity:0.35, roughness:0.2}));
        helmet.position.y = 1.25; g.add(helmet);
        const jet = new THREE.Mesh(new THREE.BoxGeometry(0.45,0.8,0.25), new THREE.MeshStandardMaterial({color:0x888888, metalness:0.8, roughness:0.3}));
        jet.position.set(0,-0.3,-0.65); g.add(jet);
        const flame = new THREE.Mesh(new THREE.ConeGeometry(0.12,0.35,8), new THREE.MeshBasicMaterial({color:0x66ccff}));
        flame.position.set(0,-0.85,-0.65); flame.rotation.x=Math.PI; g.add(flame);
        g.traverse((o) => { if (o.isMesh && o.material && o.material.color && !(o.material.emissive && o.material.emissive.r > 0.5)) o.material.color.set(0xffffff); });
      }
      scene.add(g);
      return g;
   }
   function makeNun() {
     const g = new THREE.Group();
    // Реалистичная монашка: естественный силуэт одежды, шарнирные руки, настоящая голова
    const habitMat = new THREE.MeshStandardMaterial({ color: 0x121212, roughness: 1.0 });
    const tunicMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.95 });
    const skinMatN = new THREE.MeshStandardMaterial({ color: 0xeecfae, roughness: 0.55 });

    // Ноги/подол: юбка колоколом + тела внизу
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.62, 1.15, 20), habitMat);
    skirt.position.y = 0.58; skirt.castShadow = true; g.add(skirt);
    const shoeMatN = new THREE.MeshStandardMaterial({ color: 0x14100c, roughness: 0.7 });
    for (const sx of [-0.13, 0.13]) {
      const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), shoeMatN);
      shoe.scale.set(1, 0.6, 1.5); shoe.position.set(sx, 0.045, 0.04); g.add(shoe);
    }
    // Талия и торс (туника поверх)
    const waist = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 14), habitMat);
    waist.scale.set(1, 0.75, 0.85); waist.position.y = 1.18; g.add(waist);
    const torsoN = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.42, 6, 16), tunicMat);
    torsoN.scale.set(1.15, 1, 0.8); torsoN.position.y = 1.52; torsoN.castShadow = true; g.add(torsoN);
    // пояс-верёвка (cincture францисканцев)
    const rope = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.028, 10, 24), new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.95 }));
    rope.rotation.x = Math.PI / 2; rope.position.y = 1.32; rope.scale.set(1.1, 0.9, 0.9); g.add(rope);

    // РУКИ: сложены в молитве перед грудью
    function makeArmN(side) {
      const pivot = new THREE.Group(); pivot.position.set(side * 0.28, 1.68, 0);
      const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.24, 4, 10), tunicMat);
      upper.position.y = -0.15; upper.castShadow = true; pivot.add(upper);
      pivot.rotation.z = side * 0.55;   // локти разведены
      pivot.rotation.x = -0.35;
      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.2, 10), habitMat);
      sleeve.position.y = -0.32; pivot.add(sleeve);   // широкий манжет
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 10), skinMatN);
      hand.position.set(-side * 0.12, -0.4, 0.12); pivot.add(hand); // кисти к центру
      g.add(pivot);
      return pivot;
    }
    makeArmN(-1); makeArmN(1);

    // ГОЛОВА: овальная, с носом, глазами и ртом
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 24, 20), skinMatN);
    head.scale.set(0.9, 1.1, 0.95); head.position.y = 2.0; head.castShadow = true; g.add(head);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.07, 8), skinMatN);
    nose.rotation.x = Math.PI / 2; nose.position.set(0, 1.99, 0.185); g.add(nose);
    const eyeMatN = new THREE.MeshStandardMaterial({ color: 0x241a12, roughness: 0.3 });
    for (const ex of [-0.07, 0.07]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), eyeMatN);
      eye.position.set(ex, 2.05, 0.165); g.add(eye);
    }
    const mouthN = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.015, 0.02), new THREE.MeshStandardMaterial({ color: 0x9a5a4a, roughness: 0.6 }));
    mouthN.position.set(0, 1.92, 0.175); g.add(mouthN);

    // ХИД (плат, обрамляющий лицо): полусфера с вырезом лица + свободное полотно по бокам
    const veilTop = new THREE.Mesh(new THREE.SphereGeometry(0.225, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), habitMat);
    veilTop.position.y = 2.02; veilTop.scale.set(1.05, 1.15, 1.05); veilTop.castShadow = true; g.add(veilTop);
    const veilBack = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.3, 0.75, 16, 1, true), habitMat);
    veilBack.position.set(0, 1.72, -0.05); veilBack.scale.set(1, 1, 0.9); veilBack.castShadow = true; g.add(veilBack);
    // поле платa по бокам лица
    const veilL = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12, Math.PI * 0.35, Math.PI * 0.3, 0, Math.PI), habitMat);
    veilL.position.y = 2.0; veilL.scale.set(1, 1.1, 1); g.add(veilL);
    const veilR = veilL.clone(); veilR.rotation.y = Math.PI; g.add(veilR);

    // КАТОЛИЧЕСКИЙ ПИЛИГРИМНЫЙ КАПЕЛЮН: полоса ткани через лоб
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.045, 10, 24), habitMat);
    band.rotation.x = Math.PI / 2 - 0.15; band.position.y = 2.1; band.scale.set(1, 1, 0.85); g.add(band);

    // серебряный крест на груди
    const crossMatN = new THREE.MeshStandardMaterial({ color: 0xd8d8e0, metalness: 0.9, roughness: 0.25 });
    const cV = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.03), crossMatN);
    cV.position.set(0, 1.62, 0.24); g.add(cV);
    const cH = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.05, 0.03), crossMatN);
    cH.position.set(0, 1.68, 0.24); g.add(cH);
    // чётки на поясе
    const beadMat = new THREE.MeshStandardMaterial({ color: 0x4a1a1a, roughness: 0.4 });
    for (let i = 0; i < 8; i++) {
      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), beadMat);
      const a = i / 8 * Math.PI;
      bead.position.set(Math.cos(a) * 0.3, 1.32 - Math.sin(a) * 0.18, 0.26); g.add(bead);
    }
    if (spaceMode) {
      const helmetN = new THREE.Mesh(new THREE.SphereGeometry(0.3,16,16), new THREE.MeshStandardMaterial({color:0xddddff, transparent:true, opacity:0.35, roughness:0.2}));
      helmetN.position.y = 2.02; g.add(helmetN);
      const jet = new THREE.Mesh(new THREE.BoxGeometry(0.4,0.7,0.2), new THREE.MeshStandardMaterial({color:0x888888, metalness:0.8, roughness:0.3}));
      jet.position.set(0,-0.2,-0.6); g.add(jet);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.1,0.3,8), new THREE.MeshBasicMaterial({color:0x66ccff}));
      flame.position.set(0,-0.7,-0.6); flame.rotation.x=Math.PI; g.add(flame);
      g.traverse((o) => { if (o.isMesh && o.material && o.material.color && !(o.material.emissive && o.material.emissive.r > 0.5)) o.material.color.set(0xffffff); });
    }
    scene.add(g);
    return g;
  }

  function makeTextSprite(text) {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 128;
    const cx = c.getContext("2d");
    cx.fillStyle = "rgba(0,0,0,0.65)";
    cx.fillRect(0, 0, 512, 128);
    cx.font = "bold 48px sans-serif";
    cx.fillStyle = "#fff";
    cx.textAlign = "center";
    cx.textBaseline = "middle";
    cx.shadowColor = "rgba(0,0,0,0.8)";
    cx.shadowBlur = 6;
    cx.fillText(text, 256, 64);
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sp = new THREE.Sprite(mat);
    sp.scale.set(3.2, 0.8, 1);
    return sp;
  }

  function initPumpkins() {
    pumpkins.forEach((p) => scene.remove(p));
    pumpkins.length = 0;
    pumpkins.push(makePumpkin(50, H - 34));
    pumpkins.push(makePumpkin(W - 50, H - 34));
  }
  initPumpkins();
  // —— Детали фона уровней 1–4: гробницы, кресты, черепа, туман у земли ——
  (function enrichHalloween() {
    const gY = ground.position.y;
    const graveMat = new THREE.MeshStandardMaterial({ color: 0x6a6a72, roughness: 0.92 });
    const crossMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.9 });
    const skullMat = new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.85 });
    const deadMat = new THREE.MeshStandardMaterial({ color: 0x2a2418, roughness: 0.95 });
    // Надгробия с крестами
    for (let i = 0; i < 10; i++) {
      const gx = (Math.random() > 0.5 ? 1 : -1) * (9 + Math.random() * 14);
      const gz = -70 + (i / 10) * 140 + (Math.random() - 0.5) * 8;
      const grp = new THREE.Group();
      const slab = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.5, 0.25), graveMat);
      slab.position.y = 0.75; slab.castShadow = true; grp.add(slab);
      const cv = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.8, 0.1), crossMat);
      cv.position.set(0, 1.05, 0.14); grp.add(cv);
      const ch = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.13, 0.1), crossMat);
      ch.position.set(0, 1.2, 0.14); grp.add(ch);
      grp.position.set(gx, gY, gz);
      grp.rotation.y = (Math.random() - 0.5) * 0.5;
      scene.add(grp);
    }
    // Черепа на земле
    for (let i = 0; i < 12; i++) {
      const sx = (Math.random() - 0.5) * 50;
      if (Math.abs(sx) < 7) continue;
      const sz = (Math.random() - 0.5) * 160;
      const skull = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), skullMat);
      skull.scale.set(1, 0.8, 1.1);
      skull.position.set(sx, gY + 0.14, sz);
      skull.rotation.y = Math.random() * Math.PI;
      const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.09, 0.14), skullMat);
      jaw.position.set(0, -0.12, 0.12); skull.add(jaw);
      scene.add(skull);
    }
    // Мёртвые деревья (голые ветви)
    for (let i = 0; i < 8; i++) {
      const dx = (Math.random() > 0.5 ? 1 : -1) * (13 + Math.random() * 16);
      const dz = -80 + Math.random() * 160;
      const dt = new THREE.Group();
      const trunkH = 4 + Math.random() * 2.5;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.3, trunkH, 7), deadMat);
      trunk.position.y = trunkH / 2; trunk.castShadow = true; dt.add(trunk);
      for (let b = 0; b < 4; b++) {
        const br = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.1, 1.3, 5), deadMat);
        br.position.set(0, trunkH * (0.5 + b * 0.13), 0);
        br.rotation.z = (b % 2 ? 1 : -1) * (0.7 + Math.random() * 0.4);
        br.rotation.y = Math.random() * Math.PI;
        br.translateY(0.5);
        dt.add(br);
      }
      dt.position.set(dx, gY, dz);
      scene.add(dt);
    }
    // Каменные булыжники (крупные валуны и мелкие камни)
    const boulderMat = new THREE.MeshStandardMaterial({ color: 0x5c5c66, roughness: 0.96, metalness: 0.03 });
    for (let i = 0; i < 14; i++) {
      const bx = (Math.random() > 0.5 ? 1 : -1) * (10 + Math.random() * 18);
      const bz = -80 + Math.random() * 160;
      const bs = 0.7 + Math.random() * 1.3;
      const boulder = new THREE.Mesh(new THREE.DodecahedronGeometry(bs, 0), boulderMat);
      boulder.scale.set(1, 0.65 + Math.random() * 0.3, 1.1);
      boulder.rotation.set(Math.random() * 0.4, Math.random() * Math.PI, Math.random() * 0.4);
      boulder.position.set(bx, gY + bs * 0.35, bz);
      boulder.castShadow = true;
      boulder.receiveShadow = true;
      scene.add(boulder);
    }
    // Полосы тумана у земли (движущиеся: медленно дрейфуют и колышутся)
    const groundFogStrips = [];
    const fogMat = new THREE.MeshBasicMaterial({ color: 0x8899bb, transparent: true, opacity: 0.09, depthWrite: false });
    for (let i = 0; i < 10; i++) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(30 + Math.random() * 20, 3), fogMat.clone());
      strip.position.set((Math.random() - 0.5) * 40, gY + 0.5 + i * 0.18, -20 - i * 12);
      strip.userData = {
        vx: (Math.random() * 0.5 + 0.2) * (Math.random() > 0.5 ? 1 : -1), // скорость дрейфа по X
        baseX: strip.position.x,
        phase: Math.random() * Math.PI * 2,
        baseOpacity: 0.06 + Math.random() * 0.06,
      };
      scene.add(strip);
      groundFogStrips.push(strip);
    }
    window.__groundFogStrips = groundFogStrips;
  })();
  scene.children.slice().forEach((o) => { if (o.userData && o.userData.isShip) scene.remove(o); if (o.children) o.children.slice().forEach((c) => { if (c.userData && c.userData.isShip) o.remove(c); }); });
  if (typeof alienShips !== "undefined") alienShips.forEach((a) => scene.remove(a.g));
  const groundDecor = scene.children.filter((o) => o !== stars && o !== sky && o !== moon && !(o.isLight));

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }
  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  // snowflake texture for frozen enemies
  const snowflakeTexture = (() => {
    const c = document.createElement("canvas");
    c.width = 64; c.height = 64;
    const cx = c.getContext("2d");
    cx.strokeStyle = "#ffffff";
    cx.lineWidth = 4;
    cx.lineCap = "round";
    cx.shadowColor = "#99ddff";
    cx.shadowBlur = 6;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      cx.beginPath();
      cx.moveTo(32, 32);
      cx.lineTo(32 + Math.cos(a) * 26, 32 + Math.sin(a) * 26);
      cx.stroke();
      const bx = 32 + Math.cos(a) * 15;
      const by = 32 + Math.sin(a) * 15;
      for (let s = -1; s <= 1; s += 2) {
        const ba = a + s * 0.55;
        cx.beginPath();
        cx.moveTo(bx, by);
        cx.lineTo(bx + Math.cos(ba) * 9, by + Math.sin(ba) * 9);
        cx.stroke();
      }
    }
    return new THREE.CanvasTexture(c);
  })();

  function makeSnowflakeSprite() {
    const mat = new THREE.SpriteMaterial({ map: snowflakeTexture, transparent: true, depthTest: false, opacity: 0.95 });
    const sp = new THREE.Sprite(mat);
    sp.scale.set(0.7, 0.7, 1);
    return sp;
  }

  function setFrozenVisual(e, frozen) {
    if (!e || !e.mesh) return;
    if (frozen) {
      e.mesh.traverse((o) => {
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) {
            if (!m._frozenSaved) {
              m._frozenSaved = {
                color: m.color ? m.color.getHex() : 0xffffff,
                emissive: m.emissive ? m.emissive.getHex() : 0,
                emissiveIntensity: m.emissiveIntensity || 0,
                opacity: m.opacity,
                transparent: m.transparent,
              };
            }
            if (m.color) m.color.setHex(0x66ccff);
            if (m.emissive) {
              m.emissive.setHex(0x3399ff);
              m.emissiveIntensity = 0.7;
            }
          }
        }
      });
      if (!e.snowflakes) {
        const group = new THREE.Group();
        for (let i = 0; i < 6; i++) {
          const sf = makeSnowflakeSprite();
          const a = (i / 6) * Math.PI * 2;
          sf.position.set(Math.cos(a) * 1.4, 1.2 + (i % 2) * 0.4, Math.sin(a) * 1.4);
          group.add(sf);
        }
        e.mesh.add(group);
        e.snowflakes = group;
      }
      e.snowflakes.visible = true;
    } else {
      e.mesh.traverse((o) => {
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) {
            if (m._frozenSaved) {
              if (m.color) m.color.setHex(m._frozenSaved.color);
              if (m.emissive) {
                m.emissive.setHex(m._frozenSaved.emissive);
                m.emissiveIntensity = m._frozenSaved.emissiveIntensity;
              }
              m.opacity = m._frozenSaved.opacity;
              m.transparent = m._frozenSaved.transparent;
              delete m._frozenSaved;
            }
          }
        }
      });
      if (e.snowflakes) e.snowflakes.visible = false;
    }
  }

  function resetGame() {
    // remove old meshes
    shots.forEach((s) => scene.remove(s.mesh));
    enemies.forEach((e) => {
      scene.remove(e.mesh);
      if (e.label) scene.remove(e.label);
    });
    bonuses.forEach((b) => scene.remove(b.mesh));
    particles.forEach((p) => scene.remove(p.mesh));
    smoke.forEach((s) => scene.remove(s.mesh));
    shots = [];
    enemies = [];
    bonuses = [];
    particles = [];
    smoke = [];
    score = 0;
    level = 1;
    try { _permPerks = JSON.parse(localStorage.getItem("szh_perm_perks") || "[]"); } catch (e) { _permPerks = []; }
    perks = _permPerks.slice(0, 3);
    extraLives = perks.includes("lives") ? 1 : 0;
    bulletSpread = perks.includes("bullets") ? 1 : 0;
    scoreBoost = perks.includes("score");
    lives = 3 + extraLives;
    chestTakenThisRun = false;
    chest = null;
    player = { x: W / 2, y: H - 90, w: 60, h: 46, speed: 7, mesh: makePlayer() };
    spawnTimer = 0;
    bonusTimer = 3000;
     buffUntil = 0;
     freezeUntil = 0;
    ammo = MAX_AMMO;
    reloading = false;
    reloadUntil = 0;
    scoreEl.textContent = 0;
    levelEl.textContent = 1;
    upgradeLine.textContent = "Улучшения: нет";
     // reset world
     spaceMode = false;
     planetMode = false;
     spaceCinematicDone = false;
     planetCinematicDone = false;
     cinematic = null;
     cinematicKind = null;
     cinematicStarted = false;
     slowUntil = 0;
     buffUntil = 0;
     freezeUntil = 0;
     // ВАЖНО: возвращаем видимость ВСЕМ наземным объектам (groundDecor),
     // а не только тем, у кого есть userData.decor — иначе после космоса
     // навсегда пропадают горы, лес, камни и валуны (баг «исчезающего фона»)
     scene.children.slice().forEach((o) => { if (o.userData && o.userData.cityDecor) scene.remove(o); });
     cityDecor = []; cityCars = []; cityPedestrians = []; cityMode = false;
     cityCinematicDone = false;
     groundDecor.forEach((o) => { o.visible = true; });
     scene.children.forEach((o) => { if (o.userData && o.userData.decor) o.visible = true; });
     // восстанавливаем освещение и атмосферу ночного Хэллоуина
     ambient.intensity = 0.35;
     ambient.color.set(0x667799);
     hemi.intensity = 0.4;
     dir.color.set(0xffaa66);
     dir.intensity = 1.1;
     stars.material.opacity = 0.8;
     stars.material.size = 0.25;
     moonLight.position.copy(moon.position);
     scene.children.slice().forEach((o) => { if (o.userData && o.userData.planetDecor) scene.remove(o); });
     scene.children.slice().forEach((o) => { if (o.userData && o.userData.spaceDecor) scene.remove(o); });
     moon.material.color.set(0xfff5cc);
     moon.material.emissive.set(0xfff5cc);
     moon.material.emissiveIntensity = 1.2;
     moon.scale.setScalar(1);
     moon.position.set(40, 50, -80);
     camera.position.set(0, Math.sin((25 * Math.PI) / 180) * baseCameraZ, Math.cos((25 * Math.PI) / 180) * baseCameraZ);
     camera.lookAt(0, 0, 0);
     sky.material.color.set(0x0a0a2a);
     scene.fog.color.set(0x050510);
     scene.fog.near = 30;
     scene.fog.far = 400;
  }
  function spawnEnemy() {
    try {
    const sl = planetMode ? Math.max(1, level - 19) : level;
    let type, r, mesh, label, speed;
    if (planetMode) {
      type = "slime";
      r = 24;
      mesh = makeSlime();
      label = makeTextSprite("Слизь");
      speed = Math.max(2.0, 2.2 + (sl - 1) * 0.12);
    } else if (spaceMode) {
      if (Math.random() < 0.35) {
        type = "meteor";
        r = 20;
        mesh = makeMeteorite();
        label = makeTextSprite("Метеорит");
        speed = Math.max(2.4, 2.6 + (sl - 1) * 0.12);
      } else {
        const isNun = Math.random() < 0.35;
        type = isNun ? "nun" : "zombie";
        r = isNun ? 22 : 28;
        mesh = isNun ? makeNun() : makeZombie();
        label = makeTextSprite(isNun ? "Монашка" : "Зомби");
        speed = Math.max(2.2, (isNun ? 2.8 : 2.2) + (sl - 1) * 0.12);
      }
    } else {
      const isNun = Math.random() < 0.35 + level * 0.02;
      type = isNun ? "nun" : "zombie";
      r = isNun ? 22 : 28;
      mesh = isNun ? makeNun() : makeZombie();
      label = makeTextSprite(isNun ? "Монашка" : "Зомби");
      // Одинаковая скорость на всех уровнях: повышенная база + рост с уровнем
      speed = Math.max(1.8, (isNun ? 2.6 : 1.8) + (level - 1) * 0.12);
    }
    scene.add(label);
    enemies.push({
      x: rand(r + 20, W - r - 20),
      y: -r - 10,
      r,
      type,
      speed,
      hp: 1,
      wobble: rand(0, Math.PI * 2),
      mesh,
      label,
    });
    } catch (e) { console.error(e); }
  }

   function spawnBonus() {
     const roll = Math.random();
     let kind = "buff";
     if (roll < 0.2) kind = "dynamite";
     else if (roll < 0.4) kind = "freeze";
     let mesh, name, flavor = null;
     if (kind === "dynamite") {
       kind = "dynamite";
       name = "Динамит";
       const g = new THREE.Group();
       const body = new THREE.Mesh(
         new THREE.CylinderGeometry(0.35, 0.35, 1.0, 16),
         new THREE.MeshStandardMaterial({ color: 0xcc2222, roughness: 0.6, metalness: 0.2 }),
       );
       body.castShadow = true;
       g.add(body);
       const fuse = new THREE.Mesh(
         new THREE.CylinderGeometry(0.06, 0.06, 0.4, 8),
         new THREE.MeshStandardMaterial({ color: 0xffcc33, emissive: 0xff6600, emissiveIntensity: 0.8 }),
       );
       fuse.position.y = 0.7;
       g.add(fuse);
       mesh = g;
     } else if (kind === "freeze") {
       name = "Заморозка";
       const g = new THREE.Group();
       const core = new THREE.Mesh(
         new THREE.SphereGeometry(0.5, 16, 16),
         new THREE.MeshStandardMaterial({ color: 0x66ccff, emissive: 0x3399ff, emissiveIntensity: 0.9, roughness: 0.2, transparent: true, opacity: 0.85 }),
       );
       core.castShadow = true;
       g.add(core);
       for (let i = 0; i < 6; i++) {
         const shard = new THREE.Mesh(
           new THREE.ConeGeometry(0.08, 0.4, 6),
           new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x99ddff, emissiveIntensity: 0.6 }),
         );
         const a = (i / 6) * Math.PI * 2;
         shard.position.set(Math.cos(a) * 0.55, 0, Math.sin(a) * 0.55);
         shard.rotation.z = Math.PI / 2;
         shard.rotation.y = a;
         g.add(shard);
       }
       mesh = g;
     } else {
       kind = "buff";
       const flavors = ["strawberry", "kiwi", "orange"];
       const names = { strawberry: "Клубника", kiwi: "Киви", orange: "Мандарин" };
       flavor = flavors[Math.floor(Math.random() * flavors.length)];
       name = names[flavor];
        mesh = new THREE.Group();
        const _buffColor = flavorColorHex(flavor);
        // Фолбэк-баночка сразу: бонус не должен быть невидимым, пока грузится GLB
        const _fallbackCan = new THREE.Mesh(
          new THREE.CylinderGeometry(0.3, 0.3, 0.8, 16),
          new THREE.MeshStandardMaterial({ color: _buffColor, emissive: _buffColor, emissiveIntensity: 0.6, roughness: 0.35, metalness: 0.3 }),
        );
        _fallbackCan.castShadow = true;
        mesh.add(_fallbackCan);
        if (typeof THREE.GLTFLoader !== "undefined") {
          const _bloader = new THREE.GLTFLoader();
          _bloader.load("buff_can.glb", (gltf) => {
            const _bm = gltf.scene;
            _bm.scale.set(0.3, 0.3, 0.3);
            _bm.traverse((o) => { if (o.isMesh && o.material) { if (o.material.emissiveIntensity !== undefined) o.material.emissiveIntensity = 0.9; } });
            mesh.remove(_fallbackCan);
            mesh.add(_bm);
          });
        }
        mesh.castShadow = true;
     }
     scene.add(mesh);
     bonuses.push({
       x: rand(30, W - 30),
       y: -20,
       r: 16,
       kind,
       flavor,
       name,
       // Скорость падения бонуса растёт с уровнем — на ранних уровнях не ползёт
       speed: 2.2 + Math.min(1.2, Math.floor(level / 5) * 0.2),
       spin: 0,
       mesh,
     });
   }

  function flavorColorHex(f) {
    return f === "strawberry" ? 0xff4d6d : f === "kiwi" ? 0x7bc950 : 0xffb347;
  }
  function flavorColor(f) {
    return f === "strawberry" ? "#ff4d6d" : f === "kiwi" ? "#7bc950" : "#ffb347";
  }

  function startReload() {
    if (reloading || ammo === MAX_AMMO) return;
    reloading = true;
    reloadStart = performance.now();
    reloadUntil = reloadStart + 1300;
    beep(260, 0.08, "square", 0.05);
  }

  function fire() {
    if (state !== "playing") return;
    if (cinematic) return; // во время кино не стреляем (и не удаляем корабль из кадра!)
    if (reloading) return;
    if (ammo <= 0) {
      startReload();
      return;
    }
    const now = performance.now();
    if (now - lastShot < 180) return;
    lastShot = now;
    ammo--;
    const radius = now < buffUntil ? 30 : 16;
    const makeShot = (vx) => {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 12, 12),
        new THREE.MeshStandardMaterial({
          color: 0xddeeff,
          emissive: 0x88ccff,
          emissiveIntensity: 0.9,
          transparent: true,
          opacity: 0.9,
        }),
      );
      mesh.castShadow = true;
      scene.add(mesh);
      shots.push({ x: player.x, y: player.y - 26, r: radius, vy: -10, vx, life: 1, mesh });
    };
    makeShot(0);
    makeShot(-0.7);
    makeShot(0.7);
    if (bulletSpread) { makeShot(-1.4); makeShot(1.4); }
    // muzzle smoke
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false }),
      );
      scene.add(m);
      smoke.push({
        x: player.x + rand(-6, 6),
        y: player.y - 28,
        vx: rand(-0.6, 0.6),
        vy: rand(-2, -0.5),
        life: 1,
        r: rand(4, 9),
        mesh: m,
      });
    }
    beep(560, 0.05, "triangle", 0.05);
    ensureAudio();
    if (ammo === 0) startReload();
  }

  function addParticles(x, y, colorHex, n = 14) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = rand(1, 4.5);
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 8, 8),
        new THREE.MeshStandardMaterial({
          color: colorHex,
          emissive: colorHex,
          emissiveIntensity: 0.6,
          transparent: true,
          opacity: 1,
        }),
      );
      scene.add(m);
      particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 1,
        color: colorHex,
        r: rand(2, 5),
        mesh: m,
      });
    }
  }

  async function fetchLeaderboard() {
    try {
      let url = "/game/leaderboard";
      if (tgUser && tgUser.id) url += "?viewer=" + encodeURIComponent(tgUser.id);
      const headers = {};
      const token = getSupabaseAccessToken();
      if (token) headers["Authorization"] = "Bearer " + token;
      const r = await fetch(url, { cache: "no-store", headers });
      const j = await r.json();
      leaderboard = Array.isArray(j.scores) ? j.scores : [];
    } catch (e) {
      leaderboard = [];
    }
    renderLeaderboard();
  }
  async function submitScore() {
    try {
      const r = await fetch("/game/leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: playerName || "Игрок",
          score,
          telegram_id: tgUser ? tgUser.id : undefined,
          telegram_username: tgUser ? tgUser.username : undefined,
          telegram_first_name: tgUser ? tgUser.first_name : undefined,
        }),
      });
      const j = await r.json();
      if (Array.isArray(j.scores)) leaderboard = j.scores;
    } catch (e) {}
    if (score > best) {
      best = score;
      localStorage.setItem("szh_best", best);
      bestEl.textContent = best;
    }
    renderLeaderboard();
  }

  bestEl.textContent = best;

  function update(dt) {
    if (state !== "playing") return;
     if (cinematic) {
       const t = (performance.now() - cinematic.start) / 1000;
       if (cinematicKind === "planet") {
         // УРОВЕНЬ 20: корабль просто УЛЕТАЕТ ВДАЛЬ по -Z
         if (spaceship) {
           const fly = Math.min(1, t / 3.6);
           const ease = fly * fly; // ускорение
           spaceship.scale.setScalar(0.7 + ease * 0.3);
           spaceship.position.set(0, -4 + ease * 2, -ease * 130); // уходит вдаль
           if (spaceship.userData.engines) {
             spaceship.userData.engines.forEach((eng) => { eng.scale.set(1 + ease * 1.5, 1 + ease * 2.2, 1 + ease * 1.5); });
           }
         }
         // игрок-вейп смотрит вслед и чуть приседает от ветра реактивной струи
         if (player && player.mesh) {
           player.mesh.position.x = screenToWorldX(player.x);
           player.mesh.position.y = screenToWorldY(player.y) + Math.sin(t * 8) * 0.15;
         }
       } else {
         // УРОВЕНЬ 5: корабль стоит вдалеке НА ЗЕМЛЕ (земля на ~-9), вейп подлетает к нему
         if (spaceship) {
           const groundY = -(H / 2) * SCALE - 0.6;
           const hover = Math.sin(t * 2) * 0.4; // слегка парит над землёй
           spaceship.position.set(0, groundY + 1.5 + hover, -18);
           spaceship.rotation.z = Math.sin(t * 1.5) * 0.05; // лёгкое покачивание
         }
          if (cinematicKind === "space" && player && player.mesh) {
            const bp = Math.min(1, Math.max(0, (t - 1) / 2.5));
            player.mesh.position.x = screenToWorldX(player.x) * (1 - bp);
            player.mesh.position.y = screenToWorldY(player.y) * (1 - bp);
            if (bp >= 0.85) {
              player.mesh.visible = false;
            } else {
              player.mesh.visible = true;
              player.mesh.scale.setScalar(1 - bp * 0.9);
            }
          }
       }
       const zoomFactor = t < 2 ? (1 - 0.4 * (t / 2)) : 0.6;
       camera.position.z = baseCameraZ * zoomFactor;
       camera.lookAt(0, 0, 0);
        if (t >= 4.2) {
          // СНАЧАЛА чистим декор старого мира и ВСЕ корабли, ПОТОМ входим в новый
          scene.children.slice().forEach((o) => { if (o.userData && o.userData.planetDecor) scene.remove(o); });
          scene.children.slice().forEach((o) => { if (o.userData && o.userData.spaceDecor) scene.remove(o); });
          scene.children.slice().forEach((o) => { if (o.userData && o.userData.isShip) scene.remove(o); }); // фикс: убираем старый корабль
          spaceship = null; // старый корабль больше не «висит в фоне»
          const wasKind = cinematicKind;
          if (wasKind === "planet") { planetCinematicDone = true; enterPlanetMode(); }
           else if (wasKind === "city") { cityCinematicDone = true; enterCityMode(); }
           else { spaceCinematicDone = true; enterSpaceMode(); }
          cinematicKind = null;
          cinematic = null;
          cinematicStarted = false;
          camera.position.z = baseCameraZ;
          camera.lookAt(0, 0, 0);
        }
       return;
     }

    if (reloading && performance.now() >= reloadUntil) {
      reloading = false;
      ammo = MAX_AMMO;
      beep(440, 0.1, "triangle", 0.06);
    }

    if (keys.left) player.x -= player.speed;
    if (keys.right) player.x += player.speed;
    if (mouseX !== null) player.x += (mouseX - player.x) * 0.22;
    player.x = clamp(player.x, player.w / 2 + 10, W - player.w / 2 - 10);

    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i];
      s.x += s.vx;
      s.y += s.vy;
      s.vy -= 0.02;
      s.life -= 0.006;
      s.mesh.position.set(screenToWorldX(s.x), screenToWorldY(s.y), 0);
      s.mesh.scale.setScalar(Math.max(0.1, s.life));
      if (s.y < -60 || s.life <= 0) {
        scene.remove(s.mesh);
        shots.splice(i, 1);
      }
    }

    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      const freezeActive = freezeUntil > 0 && performance.now() < freezeUntil;
      const hasFrozen = enemies.some((e) => e.frozen);
      if (freezeActive && hasFrozen) {
        spawnTimer = 200;
      } else if (enemies.length >= 14) {
        // защита от перегруза: не даём толпе врагов заполнить экран (GPU и так нагружен)
        spawnTimer = 500;
      } else {
        spawnEnemy();
        spawnTimer = Math.max(420, 1100 - (planetMode ? Math.max(1, level - 19) : level) * 30);
      }
    }
    bonusTimer -= dt;
    if (bonusTimer <= 0) {
      spawnBonus();
      bonusTimer = rand(4500, 7500);
    }

      if (freezeUntil > 0 && performance.now() >= freezeUntil) {
        for (const e of enemies) if (e.frozen) { e.frozen = false; setFrozenVisual(e, false); }
        freezeUntil = 0;
      }
     const nowTime = performance.now();
     for (let i = enemies.length - 1; i >= 0; i--) {
       const e = enemies[i];
       if (!e.frozen) {
         let _sp = e.speed; if (spaceMode && !planetMode && performance.now() < slowUntil) _sp *= 0.5; e.y += _sp;
         e.x += Math.sin(performance.now() / 600 + e.wobble) * 0.4;
       }
       e.mesh.position.set(screenToWorldX(e.x), screenToWorldY(e.y), 0);
       // позиция врага
       if (e.label) e.label.position.set(screenToWorldX(e.x), screenToWorldY(e.y) + (e.type === "nun" ? 3.0 : e.type === "slime" ? 1.8 : 2.6), 0);
       if (e.frozen && e.snowflakes) {
         e.snowflakes.rotation.y += 0.06;
         e.snowflakes.rotation.x = Math.sin(performance.now() / 500 + e.wobble) * 0.25;
       }
      // wobble rotation
      e.mesh.rotation.y = Math.sin(performance.now() / 500 + e.wobble) * 0.2;
      let hit = false;
      for (let j = shots.length - 1; j >= 0; j--) {
        const s = shots[j];
        const dx = s.x - e.x,
          dy = s.y - e.y;
        if (dx * dx + dy * dy < (s.r + e.r) * (s.r + e.r)) {
          enemies.splice(i, 1);
          shots.splice(j, 1);
          scene.remove(e.mesh);
          if (e.label) scene.remove(e.label);
          scene.remove(s.mesh);
           const gained = e.type === "nun" ? 25 : e.type === "meteor" ? 15 : e.type === "slime" ? 12 : (scoreBoost ? 20 : 10);
           score += gained;
          scoreEl.textContent = score;
          addParticles(e.x, e.y, e.type === "nun" ? 0xc77dff : 0x7bc950, 20);
           beep(e.type === "nun" ? 740 : 440, 0.1, "square", 0.06);
           if (e.frozen && !enemies.some((x) => x.frozen)) freezeUntil = 0;
          const newLevel = 1 + Math.floor(score / 180);
          if (newLevel !== level) {
            level = newLevel;
            levelEl.textContent = level;
            beep(920, 0.18, "triangle", 0.09);
            if (level >= 5 && !spaceMode && !cinematicStarted) startCinematic("space");
            if (level >= 20 && !planetCinematicDone && !cinematic) startCinematic("planet");
             if (level >= 35 && !chest && !chestTakenThisRun) spawnChest();
             if (level >= 50 && !cityCinematicDone && !cinematic) startCinematic("city");
          }
          hit = true;
          break;
        }
      }
      if (hit) continue;
      if (cityMode) {
        for (let j = cityPedestrians.length - 1; j >= 0; j--) {
          const p = cityPedestrians[j];
          if (!p.alive) continue;
          for (let k = shots.length - 1; k >= 0; k--) {
            const s = shots[k];
            const sWX = screenToWorldX(s.x), sWY = screenToWorldY(s.y);
            const dxw = sWX - p.mesh.position.x;
            const dyw = sWY - (p.mesh.position.y + 1.0);
            if (dxw * dxw + dyw * dyw < 2.2) {
              p.alive = false;
              scene.remove(p.mesh);
              shots.splice(k, 1);
              scene.remove(s.mesh);
              score = Math.max(0, score - 5);
              scoreEl.textContent = score;
              showKillPhrase(s.x, s.y);
              break;
            }
          }
        }
      }
      if (e.y + e.r >= H - 70) {
        enemies.splice(i, 1);
        scene.remove(e.mesh);
        if (e.label) scene.remove(e.label);
         lives -= (perks.includes("score") ? 2 : 1);
         if (e.frozen && !enemies.some((x) => x.frozen)) freezeUntil = 0;
        addParticles(e.x, H - 70, 0xff4d4d, 24);
        beep(160, 0.3, "sawtooth", 0.12);
        if (lives <= 0) gameOver();
      }
    }

    for (let i = bonuses.length - 1; i >= 0; i--) {
      const b = bonuses[i];
      b.y += b.speed;
      const dtSec = dt / 1000; // dt в секундах — стабильная скорость на любом FPS
      // Вращение как в играх: полный оборот 360° вокруг вертикальной оси мира (Y)
      // Полный оборот за ~4.2 сек (2*PI/1.5), только вокруг Y — как пикапы в UE5/Mario
      b.spin += dtSec;
      b.mesh.position.set(screenToWorldX(b.x), screenToWorldY(b.y), 0);
      b.mesh.rotation.set(0, 0, 0); // сброс наклонов
      b.mesh.rotation.y = (b.spin * 1.5) % (Math.PI * 2); // чистый Yaw: 360° вокруг вертикали
      const px = player.x,
        py = player.y;
       if (Math.abs(b.x - px) < player.w / 2 + b.r && Math.abs(b.y - py) < player.h / 2 + b.r) {
         bonuses.splice(i, 1);
         scene.remove(b.mesh);
         if (b.kind === "dynamite") {
           let gained = 0;
           for (let j = enemies.length - 1; j >= 0; j--) {
             const e = enemies[j];
             if (e.y >= 0 && e.y <= H) {
               gained += e.type === "nun" ? 25 : 10;
               addParticles(e.x, e.y, 0xffaa00, 28);
               try { scene.remove(e.mesh); } catch (err) {}
               if (e.label) try { scene.remove(e.label); } catch (err) {}
               enemies.splice(j, 1);
             }
           }
            score += gained;
            if (!enemies.some((x) => x.frozen)) freezeUntil = 0;
           scoreEl.textContent = score;
           const newLevel = 1 + Math.floor(score / 180);
           if (newLevel !== level) {
             level = newLevel;
             levelEl.textContent = level;
             beep(920, 0.18, "triangle", 0.09);
             if (level >= 5 && !spaceMode && !cinematicStarted) startCinematic("space");
             if (level >= 20 && !planetCinematicDone && !cinematic) startCinematic("planet");
             if (level >= 35 && !chest && !chestTakenThisRun) spawnChest();
             if (level >= 50 && !cityCinematicDone && !cinematic) startCinematic("city");
           }
           addParticles(b.x, b.y, 0xff6600, 45);
           beep(120, 0.4, "sawtooth", 0.15);
           upgradeLine.textContent = "Бонус: Динамит! 💥";
         } else if (b.kind === "freeze") {
           freezeUntil = performance.now() + 15000;
           for (let j = enemies.length - 1; j >= 0; j--) {
             const e = enemies[j];
              if (e.y >= 0 && e.y <= H) {
                e.frozen = true;
                setFrozenVisual(e, true);
                addParticles(e.x, e.y, 0x66ccff, 18);
              }
           }
           addParticles(b.x, b.y, 0x66ccff, 35);
           beep(880, 0.2, "sine", 0.1);
           upgradeLine.textContent = "Бонус: Заморозка! ❄️";
         } else {
           buffUntil = performance.now() + 6000;
           if (spaceMode && !planetMode) { slowUntil = performance.now() + 20000; upgradeLine.textContent = "Улучшения: замедление врагов 20с"; }
           upgradeLine.textContent = `Улучшения: Усиленный пар (${b.name}) — площадь +100%`;
           addParticles(b.x, b.y, flavorColorHex(b.flavor), 22);
           beep(680, 0.14, "triangle", 0.09);
         }
         continue;
       }
      if (b.y > H + 20) {
        scene.remove(b.mesh);
        bonuses.splice(i, 1);
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.08;
      p.life -= 0.022;
      p.mesh.position.set(screenToWorldX(p.x), screenToWorldY(p.y), 0);
      p.mesh.material.opacity = p.life;
      if (p.life <= 0) {
        scene.remove(p.mesh);
        particles.splice(i, 1);
      }
    }
    for (let i = smoke.length - 1; i >= 0; i--) {
      const s = smoke[i];
      s.x += s.vx;
      s.y += s.vy;
      s.vy -= 0.02;
      s.life -= 0.025;
      s.r += 0.15;
      s.mesh.position.set(screenToWorldX(s.x), screenToWorldY(s.y), 0);
      s.mesh.scale.setScalar(Math.max(0.1, s.life));
      s.mesh.material.opacity = s.life * 0.5;
      if (s.life <= 0) {
        scene.remove(s.mesh);
        smoke.splice(i, 1);
      }
    }

     if (cityMode) updateCity(dt);
    // движущийся туман у земли (только на начальных уровнях — полосы скрыты в космосе/на планете вместе с decor)
    if (window.__groundFogStrips) {
      const nowF = performance.now();
      for (const strip of window.__groundFogStrips) {
        const u = strip.userData;
        // дрейф по X с плавным возвратом-гулянием вокруг базовой позиции
        strip.position.x = u.baseX + Math.sin(nowF / 4000 + u.phase) * 6 + Math.sin(nowF / 1700 + u.phase * 2) * 1.5;
        // колыхание плотности (туман «дышит»)
        strip.material.opacity = u.baseOpacity * (0.7 + 0.3 * Math.sin(nowF / 2500 + u.phase * 3));
        // лёгкое вертикальное парение
        strip.position.y += Math.sin(nowF / 3000 + u.phase) * 0.003;
        strip.rotation.z = Math.sin(nowF / 5000 + u.phase) * 0.03;
      }
    }

    // bats — реалистичный полёт: взмах с изгибом крыла, крен в поворотах, вертикальное парение
    for (const b of bats) {
      b.x += b.vx;
      if (b.x < -20) b.x = W + 20;
      if (b.x > W + 20) b.x = -20;
      const now = performance.now();
      const wy = b.y + Math.sin(now / 800 + b.phase) * 8;
      b.g.position.set(screenToWorldX(b.x), screenToWorldY(wy), 0.5);
      // взмах: основной сустав машет, кончик крыла отстаёт по фазе (естественная волна по мембране)
      const flap = Math.sin(now / (b.flapSpeed * 1000) + b.phase);
      b.wing.rotation.z = flap * 0.85;
      b.wing2.rotation.z = -flap * 0.85;
      // тело кренится в сторону полёта и слегка рыскает
      b.g.rotation.z = -b.vx * 0.25 + flap * 0.06;
      b.g.rotation.y = Math.sin(now / 1200 + b.phase) * 0.25;
      // лёгкое покачивание тела против взмаха (инерция)
      b.g.rotation.x = flap * 0.12;
    }

// player mesh
player.mesh.position.set(screenToWorldX(player.x), screenToWorldY(player.y), 0);
player.mesh.scale.setScalar(spaceMode ? 0.6 : 1);
  const _sp = player.mesh.userData.speech;
  if (player.mesh.userData.mouth && (!_sp || !_sp.active)) player.mesh.userData.mouth.scale.set(1, 0.2, 1);
  if (_sp) {
    const _now = performance.now();
    if (!_sp.active && _now >= _sp.nextTime) { _sp.active = true; _sp.text = _sp.phrases[Math.floor(Math.random() * _sp.phrases.length)]; _sp.index = 0; _sp.timer = _now; _sp.sprite.visible = true; if (player.mesh.userData.mouth) player.mesh.userData.mouth.scale.set(1, 1, 1); }
    if (_sp.active) {
      const _el = _now - _sp.timer;
      const _chars = Math.min(_sp.text.length, Math.floor(_el / 45));
      if (player.mesh.userData.mouth) player.mesh.userData.mouth.scale.set(1, 0.3 + Math.abs(Math.sin(_now * 0.015)) * 0.9, 1);
      if (_chars !== _sp.index) {
        _sp.index = _chars;
        const _ctx = _sp.ctx;
        _ctx.clearRect(0, 0, _sp.canvas.width, _sp.canvas.height);
        _ctx.fillStyle = "rgba(0,0,0,0.65)";
        _ctx.fillRect(0, 0, _sp.canvas.width, _sp.canvas.height);
        _ctx.font = "bold 36px sans-serif";
        _ctx.fillStyle = "#fff";
        _ctx.textAlign = "center";
        _ctx.textBaseline = "middle";
        _ctx.fillText(_sp.text.substring(0, _sp.index), _sp.canvas.width / 2, _sp.canvas.height / 2);
        _sp.tex.needsUpdate = true;
      }
      if (_sp.index >= _sp.text.length && _el > _sp.text.length * 45 + 2200) { _sp.active = false; _sp.sprite.visible = false; _sp.nextTime = _now + 3500 + Math.random() * 4000; if (player.mesh.userData.mouth) player.mesh.userData.mouth.scale.set(1, 0.2, 1); }
    }
  }

  if (player.mesh.userData.eyes) {
    const et = performance.now() / 1000;
    const eyes = player.mesh.userData.eyes;
    eyes[0].position.x = -0.35 + Math.sin(et * 2) * 0.03;
    eyes[0].position.y = 0.7 + Math.cos(et * 1.5) * 0.02;
    eyes[1].position.x = 0.35 + Math.sin(et * 2 + 1) * 0.03;
    eyes[1].position.y = 0.7 + Math.cos(et * 1.5 + 1) * 0.02;
  }

playerLight.position.set(screenToWorldX(player.x), screenToWorldY(player.y), 2);

// house transparency when player is behind
const pwx = screenToWorldX(player.x);
for (const h of houses) {
  const hx = h.position.x;
  const hz = h.position.z;
  const dx = Math.abs(hx - pwx);
  const occludes = hz > 0 && dx < 6.5;
  h.traverse((o) => {
    if (o.isMesh && o.material) {
      const m = o.material;
      if (occludes) {
        m.transparent = true;
        m.opacity = 0.3;
      } else {
        m.transparent = m._origTransparent;
        m.opacity = m._origOpacity;
      }
    }
  });
}

     // buff/freeze timer display
     const nowT = performance.now();
     if (nowT < freezeUntil) {
       const rem = Math.ceil((freezeUntil - nowT) / 1000);
       upgradeLine.textContent = `Заморозка: ${rem}с ❄️`;
     } else if (nowT < buffUntil) {
       const rem = Math.ceil((buffUntil - nowT) / 1000);
       upgradeLine.textContent = `Улучшения: Усиленный пар (${rem}с)`;
     } else {
       upgradeLine.textContent = "Улучшения: нет";
     }
  }

  // ================= СУНДУК УЛУЧШЕНИЙ (35+ уровень) =================
  function makeChest() {
    // Реалистичный сундук: деревянный корпус с металлической оковкой, полукруглая крышка,
    // петли, замок с ключевой скважиной, золотое свечение из щели
    const g = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6a4423, roughness: 0.8, metalness: 0.05 });
    const woodDarkMat = new THREE.MeshStandardMaterial({ color: 0x54341a, roughness: 0.85, metalness: 0.05 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x8a8a92, metalness: 0.9, roughness: 0.3 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 1.0, roughness: 0.25, emissive: 0xaa8800, emissiveIntensity: 0.35 });

    // корпус: деревянный бокс из досок
    const bodyBox = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.85, 1.0), woodMat);
    bodyBox.position.y = 0.43; bodyBox.castShadow = true; bodyBox.receiveShadow = true; g.add(bodyBox);
    // доски: тонкие тёмные полосы на корпусе
    for (let i = 0; i < 3; i++) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.03, 1.02), woodDarkMat);
      plank.position.y = 0.15 + i * 0.28; g.add(plank);
    }
    // оковка: металлические уголки по вертикальным рёбрам и низ/верх
    const bandMat = metalMat;
    for (const sx of [-0.81, 0.81]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.9, 1.04), bandMat);
      band.position.set(sx, 0.44, 0); g.add(band);
    }
    const bandTop = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.08, 1.04), bandMat);
    bandTop.position.y = 0.86; g.add(bandTop);
    const bandBottom = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.08, 1.04), bandMat);
    bandBottom.position.y = 0.02; g.add(bandBottom);

    // ПОЛУКРУГЛАЯ КРЫШКА: полудиск, выдавленный в дугу через цилиндр
    const lid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 1.6, 24, 1, false, 0, Math.PI),
      woodMat
    );
    lid.rotation.z = Math.PI / 2;      // ось вдоль X
    lid.rotation.y = Math.PI / 2;      // полудуга кверху
    lid.position.y = 0.86; lid.castShadow = true; g.add(lid);
    // оковка крышки — два металлических полукольца
    for (const lz of [-0.55, 0.55]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.045, 8, 24, Math.PI), bandMat);
      ring.rotation.y = Math.PI / 2; ring.rotation.z = Math.PI / 2;
      ring.position.set(0, 0.86, lz); g.add(ring);
    }

    // ПЕТЛИ сзади
    for (const hz of [-0.35, 0.35]) {
      const hinge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.18), bandMat);
      hinge.position.set(0, 0.78, hz); g.add(hinge);
    }
    // ЗАМОК: золотая пластина спереди с ключевой скважиной
    const lockPlate = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.36, 0.06), goldMat);
    lockPlate.position.set(0, 0.82, 0.53); g.add(lockPlate);
    const keyhole = new THREE.Mesh(new THREE.CircleGeometry(0.05, 12), new THREE.MeshStandardMaterial({ color: 0x1a1208, roughness: 0.9 }));
    keyhole.position.set(0, 0.84, 0.565); g.add(keyhole);
    const keyholeTail = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.09, 0.01), new THREE.MeshStandardMaterial({ color: 0x1a1208, roughness: 0.9 }));
    keyholeTail.position.set(0, 0.79, 0.565); g.add(keyholeTail);

    // свечение из-под крышки (щель между крышкой и корпусом)
    const glow = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.9),
      new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffd700, emissiveIntensity: 2.0 }));
    glow.position.y = 0.92; g.add(glow);
    // золотые лучи-частицы над сундуком
    const sparkle = new THREE.Mesh(new THREE.OctahedronGeometry(0.09), goldMat);
    sparkle.position.y = 1.35; g.add(sparkle);
    g.userData.chestSparkle = sparkle;
    return g;
  }
  function spawnChest() {
    const g = makeChest();
    const glow = g.userData.chestSparkle;
    g.position.set(0, screenToWorldY(H / 2) + 4, 2);
    scene.add(g);
    chest = { mesh: g, glow };
    chestTakenThisRun = true; // один сундук за забег
    state = "chest"; // ПАУЗА
    showChestChoice();
    beep(700, 0.3, "triangle", 0.1);
  }

  function showChestChoice() {
    overlay.classList.remove("hidden");
    overlayInner.innerHTML = "";
    const h1 = document.createElement("h1");
    h1.textContent = "🎁 Сундук улучшений!";
    overlayInner.appendChild(h1);
    const p = document.createElement("p");
    p.textContent = "Выбери ОДИН предмет — он будет работать НАВСЕГДА:";
    overlayInner.appendChild(p);
    const allOptions = [
      { key: "lives", title: "❤️ 4 жизни навсегда", desc: "Базовое здоровье увеличено до 4" },
      { key: "bullets", title: "🔫 4 пули вместо 3", desc: "Выстрел рассыпается на 4 пули" },
      { key: "score", title: "💰 20 очков за монстра", desc: "НО: монстры отнимают сразу 2 жизни!" },
    ];
    // в сундуке только предметы, которых ещё НЕТ в рюкзаке — прошлые исчезают навсегда
    const options = allOptions.filter((o) => !_permPerks.includes(o.key));
    if (!options.length) {
      const all = document.createElement("p");
      all.textContent = "Все предметы уже собраны! 🎉";
      all.style.color = "#ffd700";
      overlayInner.appendChild(all);
      const btn = document.createElement("button");
      btn.textContent = "Продолжить";
      btn.onclick = (e) => {
        e.stopPropagation();
        if (chest) { scene.remove(chest.mesh); chest = null; }
        overlay.classList.add("hidden");
        overlayInner.innerHTML = "";
        state = "playing";
      };
      overlayInner.appendChild(btn);
      return;
    }
    for (const o of options) {
      const btn = document.createElement("button");
      btn.textContent = o.title;
      btn.style.cssText = "display:block;width:100%;margin:8px 0;padding:12px;border-radius:10px;border:2px solid #ff7a18;background:#1a1a2a;color:#fff;font-weight:700;cursor:pointer;font-size:16px;";
      const desc = document.createElement("div");
      desc.textContent = o.desc;
      desc.style.cssText = "font-size:12px;color:#999;font-weight:400;margin-top:4px;";
      btn.appendChild(desc);
      btn.onclick = (e) => {
        e.stopPropagation();
        chooseChestPerk(o.key);
      };
      overlayInner.appendChild(btn);
    }
  }

  function chooseChestPerk(key) {
    let perms = [];
    try { perms = JSON.parse(localStorage.getItem("szh_perm_perks") || "[]"); } catch (e) {}
    if (!perms.includes(key)) perms.push(key); // только 1 предмет за раз
    localStorage.setItem("szh_perm_perks", JSON.stringify(perms));
    _permPerks = perms;
    perks = perms.slice(0, 3);
    extraLives = perks.includes("lives") ? 1 : 0;
    bulletSpread = perks.includes("bullets") ? 1 : 0;
    scoreBoost = perks.includes("score");
    if (key === "lives") lives = 3 + extraLives;
    if (chest) { scene.remove(chest.mesh); chest = null; }
    overlay.classList.add("hidden");
    overlayInner.innerHTML = "";
    state = "playing";
    upgradeLine.textContent = "Рюкзак: " + perks.length + "/3 — " + key;
    beep(880, 0.2, "triangle", 0.1);
  }

  // ================= УРОВЕНЬ 50: ГОРОД =================
  function enterCityMode() {
    cityMode = true;
    groundDecor.forEach((o) => { o.visible = false; });
    const asphaltTex = (() => {
      const c = document.createElement("canvas");
      c.width = 256; c.height = 256;
      const cx = c.getContext("2d");
      cx.fillStyle = "#333338";
      cx.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 1500; i++) {
        cx.fillStyle = "rgba(255,255,255," + (Math.random() * 0.05) + ")";
        cx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
      }
      const tx = new THREE.CanvasTexture(c);
      tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
      tx.repeat.set(10, 10);
      return tx;
    })();
    const cityGround = new THREE.Mesh(new THREE.PlaneGeometry(300, 300, 40, 40), new THREE.MeshStandardMaterial({ map: asphaltTex, roughness: 0.9 }));
    cityGround.rotation.x = -Math.PI / 2;
    cityGround.position.y = ground.position.y;
    cityGround.receiveShadow = true;
    cityGround.userData.cityDecor = true;
    scene.add(cityGround);
    cityDecor.push(cityGround);
    scene.fog.color.set(0x0a0a18);
    scene.fog.near = 50;
    scene.fog.far = 350;
    sky.material.color.set(0x141428);
    ambient.intensity = 0.45;
    ambient.color.set(0x8899bb);
    hemi.intensity = 0.3;
    dir.color.set(0xffeecc);
    dir.intensity = 0.8;
    const buildingMats = [0x2a2a3a, 0x3a2a2a, 0x2a3a2a, 0x3a3a2a];
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 10; i++) {
        const bw = 6 + Math.random() * 4;
        const bh = 10 + Math.random() * 18;
        const bx = side * (14 + Math.random() * 14);
        const bz = -20 - i * 24;
        const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bw), new THREE.MeshStandardMaterial({ color: buildingMats[i % buildingMats.length], roughness: 0.85 }));
        b.position.set(bx, ground.position.y + bh / 2, bz);
        b.castShadow = true;
        b.userData.cityDecor = true;
        scene.add(b);
        cityDecor.push(b);
        const winMat = new THREE.MeshStandardMaterial({ color: 0xffcc66, emissive: 0xffaa33, emissiveIntensity: 0.8 });
        for (let wy = 1; wy < bh - 1; wy += 2.2) {
          for (let wx = -bw / 2 + 1; wx < bw / 2 - 0.5; wx += 1.6) {
            if (Math.random() < 0.55) {
              const win = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.0), winMat);
              win.position.set(bx + wx * side, ground.position.y + wy, bz + side * (bw / 2 + 0.05));
              win.userData.cityDecor = true;
              scene.add(win);
              cityDecor.push(win);
            }
          }
        }
      }
    }
    const cityRoad = new THREE.Mesh(new THREE.PlaneGeometry(18, 300), new THREE.MeshStandardMaterial({ color: 0x222226, roughness: 0.85 }));
    cityRoad.rotation.x = -Math.PI / 2;
    cityRoad.position.y = ground.position.y + 0.02;
    cityRoad.userData.cityDecor = true;
    scene.add(cityRoad);
    cityDecor.push(cityRoad);
    for (let z = -140; z <= 140; z += 10) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 4), new THREE.MeshStandardMaterial({ color: 0xdddddd, emissive: 0x888888, emissiveIntensity: 0.3 }));
      line.rotation.x = -Math.PI / 2;
      line.position.set(0, ground.position.y + 0.04, z);
      line.userData.cityDecor = true;
      scene.add(line);
      cityDecor.push(line);
    }
    for (const cz of [-40, 20, 80]) {
      for (let i = -7; i <= 7; i += 1.4) {
        const zebra = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 3.5), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xbbbbbb, emissiveIntensity: 0.2 }));
        zebra.rotation.x = -Math.PI / 2;
        zebra.position.set(i, ground.position.y + 0.05, cz);
        zebra.userData.cityDecor = true;
        scene.add(zebra);
        cityDecor.push(zebra);
      }
      const sign = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3, 6), new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.6 }));
      sign.position.set(9.5, ground.position.y + 1.5, cz);
      sign.userData.cityDecor = true;
      scene.add(sign);
      cityDecor.push(sign);
    }
    for (let z = -120; z <= 120; z += 24) {
      for (const lx of [-10, 10]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 7, 8), new THREE.MeshStandardMaterial({ color: 0x444448, metalness: 0.7 }));
        pole.position.set(lx, ground.position.y + 3.5, z);
        pole.userData.cityDecor = true;
        scene.add(pole);
        cityDecor.push(pole);
        const lampHead = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 10), new THREE.MeshStandardMaterial({ color: 0xffeebb, emissive: 0xffcc66, emissiveIntensity: 1.5 }));
        lampHead.position.set(lx, ground.position.y + 7.2, z);
        lampHead.userData.cityDecor = true;
        scene.add(lampHead);
        cityDecor.push(lampHead);
      }
    }
    upgradeLine.textContent = "Уровень 50: ГОРОД 🏙️ — не задави пешеходов!";
    cityCars = [];
    const carColors = [0xcc2222, 0x2266cc, 0x22aa44, 0xddaa22, 0x888888, 0xaa22aa];
    for (let i = 0; i < 5; i++) {
      const car = new THREE.Group();
      const cc = carColors[i % carColors.length];
      const cbody = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.8, 4.2), new THREE.MeshStandardMaterial({ color: cc, metalness: 0.6, roughness: 0.35 }));
      cbody.position.y = 0.6; cbody.castShadow = true; car.add(cbody);
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 2.0), new THREE.MeshStandardMaterial({ color: 0x223344, metalness: 0.4, roughness: 0.2 }));
      cabin.position.set(0, 1.2, -0.2); car.add(cabin);
      const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
      for (const wz of [1.4, -1.4]) {
        for (const wx of [-1.0, 1.0]) {
          const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.25, 12), wheelMat);
          wheel.rotation.z = Math.PI / 2;
          wheel.position.set(wx, 0.35, wz);
          car.add(wheel);
        }
      }
      const headlightMat = new THREE.MeshStandardMaterial({ color: 0xffffcc, emissive: 0xffffaa, emissiveIntensity: 1.2 });
      for (const hxx of [-0.6, 0.6]) {
        const hl = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), headlightMat);
        hl.position.set(hxx, 0.6, 2.1);
        car.add(hl);
      }
      const dirSign = Math.random() > 0.5 ? 1 : -1;
      car.position.set(dirSign > 0 ? -4.5 : 4.5, ground.position.y + 0.4, -60 - i * 40);
      if (dirSign < 0) car.rotation.y = Math.PI;
      scene.add(car);
      cityCars.push({ mesh: car, dir: dirSign, speed: 0.3 + Math.random() * 0.3 });
    }
    cityPedestrians = [];
    const pedShirts = [0xdd4444, 0x4466dd, 0x44aa66, 0xddaa44, 0x8844dd, 0xdd66aa];
    for (let i = 0; i < 8; i++) {
      const ped = makePedestrian(pedShirts[i % pedShirts.length]);
      ped.position.set(rand(-14, 14), ground.position.y + 0.1, rand(-80, 20));
      scene.add(ped);
      cityPedestrians.push({ mesh: ped, x: ped.position.x, z: ped.position.z, vx: rand(-0.08, 0.08), vz: rand(-0.08, 0.08), alive: true });
    }
  }

  function makePedestrian(shirtColor) {
    // Реалистичный прохожий: шарнирные конечности, голова с лицом, куртка и штаны
    const g = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: 0xeecfae, roughness: 0.55 });
    const shirt = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.45, 6, 16), new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.85 }));
    shirt.scale.set(1.15, 1, 0.8); shirt.position.y = 1.15; shirt.castShadow = true; g.add(shirt);
    // куртка — нижняя часть торса, чуть шире
    const jacket = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.24, 0.35, 14), new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.9 }));
    jacket.position.y = 0.95; jacket.castShadow = true; g.add(jacket);
    const pants = new THREE.MeshStandardMaterial({ color: 0x2a3040, roughness: 0.95 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0x14110e, roughness: 0.6 });
    for (const lx of [-0.11, 0.11]) {
      const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.3, 4, 10), pants);
      thigh.position.set(lx, 0.62, 0); thigh.castShadow = true; g.add(thigh);
      const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.3, 4, 10), pants);
      shin.position.set(lx, 0.25, 0); g.add(shin);
      const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), shoeMat);
      shoe.scale.set(1, 0.55, 1.5); shoe.position.set(lx, 0.04, 0.04); g.add(shoe);
    }
    for (const ax of [-0.27, 0.27]) {
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.42, 4, 10), new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.85 }));
      arm.position.set(ax, 1.1, 0); arm.rotation.z = ax > 0 ? -0.12 : 0.12; arm.castShadow = true; g.add(arm);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), skin);
      hand.position.set(ax * 1.12, 0.82, 0); g.add(hand);
    }
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.09, 10), skin);
    neck.position.y = 1.49; g.add(neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 24, 20), skin);
    head.scale.set(0.92, 1.1, 0.98); head.position.y = 1.68; head.castShadow = true; g.add(head);
    // волосы: полусфера + короткая чёлка
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2e2018, roughness: 0.95 }));
    hair.position.y = 1.72; hair.scale.set(1.02, 1, 1.02); g.add(hair);
    const fringe = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 8, 0, Math.PI, Math.PI * 0.25, Math.PI * 0.3), new THREE.MeshStandardMaterial({ color: 0x2e2018, roughness: 0.95 }));
    fringe.position.y = 1.7; fringe.rotation.z = Math.PI; g.add(fringe);
    // нос, глаза с бликом, рот
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.06, 8), skin);
    nose.rotation.x = Math.PI / 2; nose.position.set(0, 1.67, 0.185); g.add(nose);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x241a12, roughness: 0.3 });
    for (const ex of [-0.07, 0.07]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), eyeMat);
      eye.position.set(ex, 1.72, 0.16); g.add(eye);
    }
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.014, 0.02), new THREE.MeshStandardMaterial({ color: 0x9a5a4a, roughness: 0.6 }));
    mouth.position.set(0, 1.61, 0.17); g.add(mouth);
    return g;
  }

  function updateCity(dt) {
    for (const c of cityCars) {
      c.mesh.position.z += c.dir * c.speed;
      if (c.mesh.position.z > 100) c.mesh.position.z = -160;
      if (c.mesh.position.z < -160) c.mesh.position.z = 100;
    }
    for (const p of cityPedestrians) {
      if (!p.alive) continue;
      p.x += p.vx;
      p.z += p.vz;
      if (Math.abs(p.x) > 15) p.vx *= -1;
      if (p.z > 30 || p.z < -100) p.vz *= -1;
      p.mesh.position.set(p.x, ground.position.y + 0.1, p.z);
      p.mesh.rotation.y = Math.atan2(p.vx, p.vz);
    }
  }

  function showKillPhrase(x, y) {
    let phrase = killPhrases[Math.floor(Math.random() * killPhrases.length)];
    while (phrase === lastPhrase && killPhrases.length > 1) phrase = killPhrases[Math.floor(Math.random() * killPhrases.length)];
    lastPhrase = phrase;
    const c = document.createElement("canvas");
    c.width = 1024; c.height = 128;
    const cx = c.getContext("2d");
    cx.fillStyle = "rgba(0,0,0,0.75)";
    cx.fillRect(0, 0, 1024, 128);
    cx.font = "bold 44px sans-serif";
    cx.fillStyle = "#ff4455";
    cx.textAlign = "center";
    cx.textBaseline = "middle";
    cx.fillText(phrase, 512, 64);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false }));
    sp.scale.set(9, 1.15, 1);
    sp.position.set(screenToWorldX(x), screenToWorldY(y), 3);
    scene.add(sp);
    setTimeout(() => scene.remove(sp), 2500);
    beep(200, 0.25, "sawtooth", 0.12);
  }

  function gameOver() {
    state = "gameover";
    submitScore();
    overlay.classList.remove("hidden");
    overlayInner.innerHTML = "";
    const h1 = document.createElement("h1");
    h1.textContent = "Игра окончена";
    overlayInner.appendChild(h1);
    const p = document.createElement("p");
    p.textContent = `Ваш счёт: ${score}. Рекорд: ${best}.`;
    overlayInner.appendChild(p);
    const btn = document.createElement("button");
    btn.textContent = "Играть снова";
    btn.onclick = (e) => {
      e.stopPropagation();
      startGame();
    };
    overlayInner.appendChild(btn);
    const lbTitle = document.createElement("h3");
    lbTitle.textContent = "Таблица рекордов";
    lbTitle.style.color = "#ff7a18";
    overlayInner.appendChild(lbTitle);
    const lb = document.createElement("div");
    lb.id = "leaderboard";
    overlayInner.appendChild(lb);
    renderLeaderboard();
  }

  function makeMeteorite() {
    // Реалистичный метеорит: неровный оплавленный камень, кратеры, тлеющие трещины
    const g = new THREE.Group();
    const rock = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.95, 2),
      new THREE.MeshStandardMaterial({ color: 0x4a3a30, roughness: 0.95, metalness: 0.05, flatShading: true })
    );
    // неровность: случайные смещения вершин (обтекаемый неровный камень)
    const pos = rock.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const n = 1 + (Math.sin(i * 12.9898) * 0.5 + 0.5) * 0.28;
      pos.setXYZ(i, pos.getX(i) * n, pos.getY(i) * n * 0.85, pos.getZ(i) * n);
    }
    pos.needsUpdate = true;
    rock.geometry.computeVertexNormals();
    rock.castShadow = true;
    g.add(rock);
    // кратеры (тёмные вдавленности)
    const craterMat = new THREE.MeshStandardMaterial({ color: 0x2e241d, roughness: 1.0 });
    for (let i = 0; i < 4; i++) {
      const a = i * 1.7, el = 0.5 + (i % 2) * 0.6;
      const crater = new THREE.Mesh(new THREE.SphereGeometry(0.16 + (i % 2) * 0.08, 10, 8), craterMat);
      crater.position.set(Math.cos(a) * 0.8 * el, Math.sin(el * 2) * 0.5, Math.sin(a) * 0.8 * el);
      crater.scale.set(1, 0.35, 1);
      g.add(crater);
    }
    // тлеющие трещины: маленькие светящиеся полосы на поверхности
    const lavaMat = new THREE.MeshStandardMaterial({ color: 0xff5a00, emissive: 0xff4400, emissiveIntensity: 2.2, roughness: 0.7 });
    for (let i = 0; i < 5; i++) {
      const a = i * 1.25;
      const crack = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.35 + Math.random() * 0.25, 3, 6), lavaMat);
      crack.position.set(Math.cos(a) * 0.75, (Math.random() - 0.5) * 0.7, Math.sin(a) * 0.75);
      crack.rotation.set(Math.random() * 2, a, Math.random() * 2);
      g.add(crack);
    }
    // жар-ореол вокруг (слабое свечение, а не шар)
    const glow = new THREE.Mesh(new THREE.SphereGeometry(1.35, 16, 16), new THREE.MeshBasicMaterial({ color: 0xff5500, transparent: true, opacity: 0.10, side: THREE.BackSide }));
    g.add(glow);
    scene.add(g);
    return g;
  }
  function makeSlime() {
    // Реалистичная слизь: полупрозрачное желеобразное тело с внутренним ядром,
    // капли по краю, влажный блеск, глаза внутри тела
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: 0x2fbf62, emissive: 0x0d5c2a, emissiveIntensity: 0.45,
      roughness: 0.08, metalness: 0.0, transparent: true, opacity: 0.72,
      clearcoat: 1.0, clearcoatRoughness: 0.06,
      // ВАЖНО: без transmission! Преломление рендерится отдельным проходом на КАЖДЫЙ кадр
      // для каждого меша — толпа слизней на высоких уровнях перегружала GPU
      // (падение FPS до нуля и потеря WebGL-контекста => белый экран).
    });
    const blob = new THREE.Mesh(new THREE.SphereGeometry(0.92, 32, 24), bodyMat);
    blob.scale.set(1, 0.68, 1); blob.castShadow = true; g.add(blob);
    // «пузико» — упрощённая нижняя часть, чтобы сидело на земле
    const baseBlob = new THREE.Mesh(new THREE.SphereGeometry(0.85, 24, 16), bodyMat);
    baseBlob.scale.set(1.05, 0.35, 1.05); baseBlob.position.y = -0.35; g.add(baseBlob);
    // внутреннее ядро (как у реальной слизи с «сердцем»)
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12), new THREE.MeshStandardMaterial({ color: 0x8affaa, emissive: 0x44cc66, emissiveIntensity: 1.4, transparent: true, opacity: 0.5, roughness: 0.2 }));
    core.position.y = 0.05; core.scale.set(1, 0.75, 1); g.add(core);
    // глаза: белки + зрачки, чуть утоплены
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf5fff5, roughness: 0.25 });
    const pupilMat = new THREE.MeshStandardMaterial({ color: 0x0a2412, roughness: 0.2 });
    for (const ex of [-0.26, 0.26]) {
      const white = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 12), whiteMat);
      white.position.set(ex, 0.14, 0.68); g.add(white);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), pupilMat);
      pupil.position.set(ex, 0.14, 0.79); g.add(pupil);
      const shine = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      shine.position.set(ex + 0.03, 0.2, 0.83); g.add(shine);
    }
    // маленькие бугорки-блики на поверхности
    const dripMat = bodyMat;
    for (let i = 0; i < 3; i++) {
      const a = i * 2.2;
      const drip = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), dripMat);
      drip.position.set(Math.cos(a) * 0.8, -0.45, Math.sin(a) * 0.8);
      drip.scale.set(1, 0.6, 1); g.add(drip);
    }
    scene.add(g);
    return g;
  }
  function makeSpaceship() {
    // Реалистичный шаттл: обтекаемый фюзеляж, кабина со стеклом, стреловидные крылья,
    // двигатели-гондолы, шасси, заклёпочные панели
    const g = new THREE.Group();
    const hullMat = new THREE.MeshStandardMaterial({ color: 0xcfd3d8, metalness: 0.85, roughness: 0.32 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x2b2f36, metalness: 0.7, roughness: 0.45 });
    const accentMat = new THREE.MeshStandardMaterial({ color: 0xff7a18, metalness: 0.4, roughness: 0.4, emissive: 0xff3d00, emissiveIntensity: 0.25 });
    const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x88ccff, metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.55, clearcoat: 1.0 });

    // фюзеляж: вытянутое веретено
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.75, 3.0, 8, 24), hullMat);
    body.rotation.x = Math.PI / 2; body.scale.set(1, 1, 0.72); body.castShadow = true; g.add(body);
    // брюхо/панель — тёмная нижняя часть
    const belly = new THREE.Mesh(new THREE.CapsuleGeometry(0.7, 2.8, 6, 16), darkMat);
    belly.rotation.x = Math.PI / 2; belly.scale.set(1, 1, 0.5); belly.position.y = -0.28; g.add(belly);
    // кабина со стеклом (спереди, +Z)
    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.52, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2), glassMat);
    cockpit.rotation.x = Math.PI / 2; cockpit.position.set(0, 0.25, 1.35); cockpit.scale.set(1, 1, 1.3); g.add(cockpit);
    const cockpitRim = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 10, 24), darkMat);
    cockpitRim.position.set(0, 0.22, 1.5); cockpitRim.rotation.x = Math.PI / 2 + 0.5; g.add(cockpitRim);
    // носовой конус с антенной
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.5, 20), accentMat);
    nose.rotation.x = -Math.PI / 2; nose.position.z = 2.5; nose.castShadow = true; g.add(nose);
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.01, 0.5, 6), darkMat);
    antenna.position.set(0, 0.45, 2.2); antenna.rotation.x = -0.5; g.add(antenna);

    // стреловидные крылья (скошенные боксы, закреплены под углом)
    function makeWing(side) {
      const pivot = new THREE.Group(); pivot.position.set(side * 0.7, 0, -0.3);
      const shape = new THREE.Shape();
      shape.moveTo(0, 0.55); shape.lineTo(side * 1.5, -0.55); shape.lineTo(side * 1.5, -0.85); shape.lineTo(0, -0.35); shape.closePath();
      const wing = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.09, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.04, bevelSegments: 2 }), hullMat);
      wing.rotation.x = -Math.PI / 2 + 0.08; wing.castShadow = true; pivot.add(wing);
      // законцовка-огонёк
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshStandardMaterial({ color: 0xff3333, emissive: 0xff2222, emissiveIntensity: 1.5 }));
      tip.position.set(side * 1.45, 0.1, -0.95); pivot.add(tip);
      g.add(pivot);
      return pivot;
    }
    makeWing(-1); makeWing(1);
    // вертикальный киль
    const finShape = new THREE.Shape();
    finShape.moveTo(0, 0); finShape.lineTo(-0.75, 0); finShape.lineTo(-0.85, 0.85); finShape.lineTo(-0.45, 0.85); finShape.closePath();
    const fin = new THREE.Mesh(new THREE.ExtrudeGeometry(finShape, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.03, bevelSegments: 2 }), accentMat);
    fin.rotation.y = Math.PI / 2; fin.position.set(0.035, 0.35, -1.15); fin.castShadow = true; g.add(fin);

    // двигатели: две гондолы под крыльями + центральный блок, сопла с внутренним свечением
    const glowInnerMat = new THREE.MeshBasicMaterial({ color: 0x99ddff });
    function makeEngine(x) {
      const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 1.3, 16), darkMat);
      pod.rotation.x = Math.PI / 2; pod.position.set(x, -0.25, -1.55); pod.castShadow = true; g.add(pod);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 8, 20), hullMat);
      ring.position.set(x, -0.25, -2.2); g.add(ring);
      const inner = new THREE.Mesh(new THREE.CircleGeometry(0.27, 16), glowInnerMat);
      inner.position.set(x, -0.25, -2.2); g.add(inner);
      const eng = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.9, 12), new THREE.MeshBasicMaterial({ color: 0xff8833, transparent: true, opacity: 0.85 }));
      eng.rotation.x = -Math.PI / 2; eng.position.set(x, -0.25, -2.65); g.add(eng);
      return eng;
    }
    const engL = makeEngine(-0.95), engR = makeEngine(0.95);
    g.userData.engines = [engL, engR];
    // шасси: три опоры
    const gearMat = darkMat;
    for (const gp of [[-0.55, -0.5, 1.1], [0.55, -0.5, 1.1], [0, -0.5, -1.4]]) {
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.45, 8), gearMat);
      strut.position.set(gp[0], gp[1], gp[2]); g.add(strut);
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.09, 12), gearMat);
      wheel.rotation.z = Math.PI / 2; wheel.position.set(gp[0], gp[1] - 0.24, gp[2]); g.add(wheel);
    }
    g.rotation.x = -Math.PI / 2;
    g.userData.isShip = true;
    scene.add(g);
    return g;
  }
  function enterSpaceMode() {
    spaceMode = true;
    groundDecor.forEach((o) => { o.visible = false; });
    if (spaceship) {
      // переиспользуем ТОТ ЖЕ корабль, на котором мы уже летали — дубля не будет
      if (player && player.mesh && player.mesh !== spaceship) scene.remove(player.mesh);
      player.mesh = spaceship;
      spaceship = null;
      player.mesh.scale.setScalar(0.6);
      if (!player.mesh.userData.speech) attachSpeech(player.mesh);
      player.mesh.visible = true;
    } else {
      if (player && player.mesh) scene.remove(player.mesh);
      const _ship = makeSpaceship(); _ship.scale.setScalar(0.6); player.mesh = _ship; attachSpeech(player.mesh);
    }
    scene.fog.color.set(0x000011);
    scene.fog.near = 120;
    scene.fog.far = 420;
    sky.material.color.set(0x000005);
    stars.material.opacity = 1.0;
    stars.material.size = 0.35;
    ambient.intensity = 0.25;
    ambient.color.set(0x8899cc);
    hemi.intensity = 0.2;
    dir.color.set(0xffffff);
    dir.intensity = 0.9;
    upgradeLine.textContent = "Космос: скафандры и реактивные ранцы! 🚀";
    // НИЖНЯЯ ЧАСТЬ ФОНА: космическая дымка/неуловимая атмосфера вместо пустоты
    const hazeColors = [0x223355, 0x334488, 0x5544aa, 0x226699];
    for (let i = 0; i < 8; i++) {
      const haze = new THREE.Mesh(
        new THREE.PlaneGeometry(90 + Math.random() * 60, 10 + Math.random() * 14),
        new THREE.MeshBasicMaterial({ color: hazeColors[i % hazeColors.length], transparent: true, opacity: 0.07 + Math.random() * 0.06, depthWrite: false, side: THREE.DoubleSide })
      );
      haze.position.set((Math.random() - 0.5) * 120, -(10 + Math.random() * 18), -80 - Math.random() * 70);
      haze.rotation.z = (Math.random() - 0.5) * 0.3;
      haze.userData.spaceDecor = true;
      scene.add(haze);
    }
    // Нижняя туманность-градиент (широкая, тёплая снизу — как горизонт планеты)
    const horizonGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(220, 26),
      new THREE.MeshBasicMaterial({ color: 0x4a3060, transparent: true, opacity: 0.16, depthWrite: false })
    );
    horizonGlow.position.set(0, -14, -150);
    horizonGlow.userData.spaceDecor = true;
    scene.add(horizonGlow);
    // Астероиды внизу (мелкие, ближе)
    const lowAstMat = new THREE.MeshStandardMaterial({ color: 0x665544, roughness: 0.95 });
    for (let i = 0; i < 14; i++) {
      const ast = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3 + Math.random() * 0.7, 0), lowAstMat);
      ast.position.set((Math.random() - 0.5) * 100, -(6 + Math.random() * 14), -60 - Math.random() * 60);
      ast.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      ast.userData.spaceDecor = true;
      scene.add(ast);
    }
    // Гигантская планета с кольцом на горизонте
    const gasGiant = new THREE.Mesh(
      new THREE.SphereGeometry(16, 32, 32),
      new THREE.MeshStandardMaterial({ color: 0xcc8844, emissive: 0x552200, emissiveIntensity: 0.3, roughness: 0.8 })
    );
    gasGiant.position.set(-55, 30, -160);
    gasGiant.userData.spaceDecor = true;
    scene.add(gasGiant);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(20, 28, 48),
      new THREE.MeshBasicMaterial({ color: 0xd8b070, transparent: true, opacity: 0.4, side: THREE.DoubleSide })
    );
    ring.position.copy(gasGiant.position);
    ring.rotation.x = Math.PI / 2.4;
    ring.rotation.y = 0.3;
    ring.userData.spaceDecor = true;
    scene.add(ring);
    // Мерцающие цветные звёзды (два слоя)
    const coloredStarsGeo = new THREE.BufferGeometry();
    const cStarVerts = [];
    for (let i = 0; i < 200; i++) {
      cStarVerts.push((Math.random() - 0.5) * 220, Math.random() * 90 + 5, -100 - Math.random() * 120);
    }
    coloredStarsGeo.setAttribute("position", new THREE.Float32BufferAttribute(cStarVerts, 3));
    const coloredStars = new THREE.Points(coloredStarsGeo, new THREE.PointsMaterial({ color: 0xaaddff, size: 0.4, transparent: true, opacity: 0.9 }));
    coloredStars.userData.spaceDecor = true;
    scene.add(coloredStars);
    // Реалистичный космос: цветные туманности
    const nebulaColors = [0x6633aa, 0x2255aa, 0xaa3366, 0x33aa88];
    for (let i = 0; i < 5; i++) {
      const nc = nebulaColors[i % nebulaColors.length];
      const neb = new THREE.Mesh(
        new THREE.SphereGeometry(12 + Math.random() * 10, 16, 16),
        new THREE.MeshBasicMaterial({ color: nc, transparent: true, opacity: 0.12 })
      );
      neb.position.set((Math.random() - 0.5) * 140, 15 + Math.random() * 40, -120 - Math.random() * 80);
      neb.userData.spaceDecor = true;
      scene.add(neb);
    }
    // Кольцо астероидов вдалеке
    const astMat = new THREE.MeshStandardMaterial({ color: 0x776655, roughness: 0.95 });
    for (let i = 0; i < 22; i++) {
      const ast = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4 + Math.random() * 0.8, 0), astMat);
      const aa = Math.random() * Math.PI * 2;
      const ar = 60 + Math.random() * 40;
      ast.position.set(Math.cos(aa) * ar, (Math.random() - 0.5) * 30, -100 - Math.random() * 60);
      ast.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      ast.userData.spaceDecor = true;
      scene.add(ast);
    }
    const pcolors = [0x2266aa, 0x338844, 0x886633, 0x44aaff, 0x66aa44];
    for (let i = 0; i < 7; i++) {
      const pl = new THREE.Mesh(new THREE.SphereGeometry(2 + Math.random()*5, 16, 16), new THREE.MeshStandardMaterial({color: pcolors[i % pcolors.length], emissive: pcolors[i % pcolors.length], emissiveIntensity: 0.25}));
      pl.position.set((Math.random()-0.5)*80, 10 + Math.random()*40, -80 - Math.random()*60);
      pl.userData.spaceDecor = true;
      scene.add(pl);
    }
  }
  function enterPlanetMode() {
    planetMode = true;
    groundDecor.forEach((o) => { o.visible = false; });
    if (player && player.mesh) scene.remove(player.mesh);
    player.mesh = makePlayer();
    player.mesh.visible = true;
    player.mesh.scale.setScalar(1);
    spaceMode = false;
    // фикс «проваливания»: игрок и слизь стоят на Y=-2 (уровень планетной земли), а не на мировом нуле
    // Земля: холмистое поле с травяной текстурой (реалистичный дневной вид)
    const pgroundGeo = new THREE.PlaneGeometry(300, 300, 60, 60);
    const ppos = pgroundGeo.attributes.position;
    for (let i = 0; i < ppos.count; i++) {
      ppos.setZ(i, Math.sin(ppos.getX(i) * 0.1) * Math.cos(ppos.getY(i) * 0.08) * 0.5);
    }
    pgroundGeo.computeVertexNormals();
    const grassTex = (() => {
      const c = document.createElement("canvas");
      c.width = 512; c.height = 512;
      const cx = c.getContext("2d");
      cx.fillStyle = "#4a7a2a";
      cx.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 6000; i++) {
        const x = Math.random() * 512, y = Math.random() * 512;
        const g = 100 + Math.random() * 70;
        cx.fillStyle = "rgb(" + (g * 0.55 | 0) + "," + g + "," + (g * 0.4 | 0) + ")";
        cx.fillRect(x, y, 2, 3);
      }
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(12, 12);
      return t;
    })();
    const pground = new THREE.Mesh(pgroundGeo, new THREE.MeshStandardMaterial({ map: grassTex, color: 0xffffff, roughness: 0.95 }));
    pground.rotation.x = -Math.PI/2;
    pground.position.y = ground.position.y;
    pground.receiveShadow = true;
    pground.userData.planetDecor = true;
    scene.add(pground);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(6, 200), new THREE.MeshStandardMaterial({color:0x8b7355, roughness:0.95}));
    road.rotation.x = -Math.PI/2;
    road.position.y = ground.position.y + 0.1;
    road.userData.planetDecor = true;
    scene.add(road);
    // Дневное небо с облаками
    scene.fog.color.set(0xbcd8f0);
    scene.fog.near = 60;
    scene.fog.far = 320;
    sky.material.color.set(0x87b8e8);
    ambient.intensity = 0.75;
    ambient.color.set(0xffffff);
    hemi.intensity = 0.55;
    dir.color.set(0xfff2cc);
    dir.intensity = 1.4;
    moon.material.color.set(0xfff7e0);
    moon.material.emissive.set(0xffeebb);
    moon.material.emissiveIntensity = 0.4;
    moon.scale.setScalar(1.3);
    moon.position.set(-60, 65, -110);
    // Облака
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.85 });
    for (let i = 0; i < 14; i++) {
      const cloud = new THREE.Group();
      for (let j = 0; j < 4; j++) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(2.5 + Math.random() * 2.5, 10, 8), cloudMat);
        puff.position.set(j * 2.5 - 4 + Math.random(), Math.random(), Math.random() * 2);
        cloud.add(puff);
      }
      cloud.position.set((Math.random() - 0.5) * 140, 18 + Math.random() * 16, -80 - Math.random() * 60);
      cloud.userData.planetDecor = true;
      scene.add(cloud);
    }
    // Дальний лес ПО КРАЯМ (центр открыт — там монументы и замок)
    const dTreeMat = new THREE.MeshStandardMaterial({ color: 0x1e4a1e, roughness: 0.9 });
    const dTrunkMat = new THREE.MeshStandardMaterial({ color: 0x3a2a18, roughness: 0.95 });
    for (let i = 0; i < 110; i++) {
      const fx = (Math.random() - 0.5) * 220;
      const fz = -90 - Math.random() * 100;
      if (Math.abs(fx) < 26) continue; // центр открыт для замка/камней
      const th = 3 + Math.random() * 4;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.25, th, 6), dTrunkMat);
      trunk.position.set(fx, ground.position.y + th / 2, fz);
      trunk.userData.planetDecor = true;
      scene.add(trunk);
      const crown = new THREE.Mesh(new THREE.SphereGeometry(1.4 + Math.random(), 8, 6), dTreeMat);
      crown.position.set(fx, ground.position.y + th + 1, fz);
      crown.userData.planetDecor = true;
      scene.add(crown);
    }
    // КУКУРУЗНЫЕ ПОЛЯ: две больших грядки слева и справа + узкая полоса вдоль обочины
    const cornStalkMat = new THREE.MeshStandardMaterial({color:0x3a8a2a, roughness:0.85});
    const cornLeafMat = new THREE.MeshStandardMaterial({color:0x4aa030, roughness:0.8, side:THREE.DoubleSide});
    const cornCobMat = new THREE.MeshStandardMaterial({color:0xe8c840, roughness:0.7});
    function plantCornField(rowCount, stalksPerRow, baseX, spacingX, baseZ, spacingZ) {
      for (let row = 0; row < rowCount; row++) {
        for (let i = 0; i < stalksPerRow; i++) {
          const cx2 = baseX + row * spacingX + (Math.random() - 0.5);
          const cz2 = baseZ + i * spacingZ + (Math.random() - 0.5);
          const stalkH = 1.6 + Math.random() * 0.7;
          const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, stalkH, 5), cornStalkMat);
          stalk.position.set(cx2, ground.position.y + stalkH / 2, cz2);
          stalk.rotation.z = (Math.random() - 0.5) * 0.08;
          stalk.userData.planetDecor = true;
          scene.add(stalk);
          for (let l = 0; l < 3; l++) {
            const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.7), cornLeafMat);
            leaf.position.set(cx2, ground.position.y + stalkH * (0.4 + l * 0.2), cz2);
            leaf.rotation.z = (l % 2 ? 0.9 : -0.9);
            leaf.rotation.y = Math.random() * Math.PI;
            leaf.userData.planetDecor = true;
            scene.add(leaf);
          }
          if (Math.random() < 0.4) {
            const cob = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.3, 8), cornCobMat);
            cob.position.set(cx2 + 0.1, ground.position.y + stalkH * 0.6, cz2);
            cob.rotation.z = 0.5;
            cob.userData.planetDecor = true;
            scene.add(cob);
          }
        }
      }
    }
    plantCornField(7, 34, -26, 3.2, -50, 2.4); // левое поле
    plantCornField(7, 34, 26, 3.2, -50, 2.4);  // правое поле
    plantCornField(1, 12, -8.6, 1.4, -18, 2.0); // вдоль дороги слева
    plantCornField(1, 12, 8.6, 1.4, -18, 2.0);  // вдоль дороги справа
    upgradeLine.textContent = "Планета: слизь, камни и замок! 🌽🏰";

    // КАМЕННЫЕ МОНУМЕНТЫ ВДАЛЕКЕ: стоячие камни-менгиры, дольмен и обломанные арки (за полями)
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x9a938a, roughness: 0.92, metalness: 0.02 });
    const stoneMossMat = new THREE.MeshStandardMaterial({ color: 0x5f7a45, roughness: 0.98 });
    function addMenhir(x, z, h, w, tilt, rotY) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(w, h, w * 0.55), stoneMat);
      // слегка неровный: сужается кверху
      s.scale.set(1, 1, 1);
      s.position.set(x, ground.position.y + h / 2 - 0.25, z);
      s.rotation.z = tilt; s.rotation.y = rotY;
      s.castShadow = true; s.receiveShadow = true;
      s.userData.planetDecor = true;
      scene.add(s);
      // мох у основания
      const moss = new THREE.Mesh(new THREE.SphereGeometry(w * 0.42, 8, 6), stoneMossMat);
      moss.scale.set(1.1, 0.4, 0.9);
      moss.position.set(x, ground.position.y + 0.12, z);
      moss.userData.planetDecor = true;
      scene.add(moss);
      return s;
    }
    // круг менгиров (как Стоунхендж) вдалеке по центру
    const stoneCenterZ = -95;
    const stoneCount = 9;
    const stoneRadius = 11;
    for (let i = 0; i < stoneCount; i++) {
      const a = (i / stoneCount) * Math.PI * 2;
      const sx = Math.cos(a) * stoneRadius;
      const sz = stoneCenterZ + Math.sin(a) * stoneRadius;
      addMenhir(sx, sz, 4.0 + Math.random() * 1.2, 1.2 + Math.random() * 0.4, (Math.random() - 0.5) * 0.09, -a + Math.PI / 2);
      // перемычки (линтели) на верху, у части пар
      if (i % 2 === 0) {
        const a2 = ((i + 1) / stoneCount) * Math.PI * 2;
        const lintel = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.75, 1.15), stoneMat);
        lintel.position.set((sx + Math.cos(a2) * stoneRadius) / 2, ground.position.y + 4.6, (sz + stoneCenterZ + Math.sin(a2) * stoneRadius) / 2);
        lintel.rotation.y = -a + Math.PI / 2;
        lintel.castShadow = true;
        lintel.userData.planetDecor = true;
        scene.add(lintel);
      }
    }
    // алтарный камень в центре круга
    const altar = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 1.7), stoneMat);
    altar.position.set(0, ground.position.y + 0.45, stoneCenterZ);
    altar.castShadow = true; altar.receiveShadow = true;
    altar.userData.planetDecor = true;
    scene.add(altar);
    // одиночные менгиры-часовые вдоль дороги и у полей
    addMenhir(-12, -30, 3.4, 1.0, 0.06, 0.4);
    addMenhir(13, -38, 3.8, 1.1, -0.05, -0.3);
    addMenhir(-15, -62, 4.4, 1.3, 0.04, 1.1);
    addMenhir(14, -70, 5.0, 1.4, -0.07, -0.9);
    addMenhir(0, -44, 2.8, 0.9, 0.08, 0.2); // обломанный низкий камень
    // обломанная арка: два камня + упавший переклад
    const archL = addMenhir(-6.5, -80, 4.6, 1.2, 0.03, 0.15);
    const archR = addMenhir(6.5, -80, 4.6, 1.2, -0.03, -0.15);
    const fallenLintel = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.9, 1.2), stoneMat);
    fallenLintel.position.set(0, ground.position.y + 0.45, -80.6);
    fallenLintel.rotation.z = 0.05;
    fallenLintel.castShadow = true;
    fallenLintel.userData.planetDecor = true;
    scene.add(fallenLintel);

    // КОРОЛЕВСКИЙ ЗАМОК НА ГОРИЗОНТЕ (виден издалека, по центру за кругом камней)
    const castleWallMat = new THREE.MeshStandardMaterial({ color: 0x8a8a92, roughness: 0.85 });
    const castleRoofMat = new THREE.MeshStandardMaterial({ color: 0x6a3050, roughness: 0.6 });
    const castleWoodMat = new THREE.MeshStandardMaterial({ color: 0x4a2f18, roughness: 0.9 });
    const cz = -150; // далеко за Стоунхенджем — силуэт на горизонте
    const castleScale = 2.2; // крупный, чтобы читался издалека
    function addCastlePart(geo, mat, x, y, z, rotY) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x * castleScale, ground.position.y + y * castleScale, z);
      if (rotY !== undefined) m.rotation.y = rotY;
      m.castShadow = true;
      m.userData.planetDecor = true;
      scene.add(m);
      return m;
    }
    // внешняя стена с зубцами
    addCastlePart(new THREE.BoxGeometry(20, 7, 1.6), castleWallMat, 0, 1.5, cz);
    for (let i = -5; i <= 5; i++) {
      if (Math.abs(i) < 1.5) continue;
      addCastlePart(new THREE.BoxGeometry(1.1, 1.0, 1.7), castleWallMat, i * 1.9, 5.5, cz);
    }
    // ворота
    addCastlePart(new THREE.BoxGeometry(1.6, 5, 1.8), castleWallMat, -2.4, 0.5, cz);
    addCastlePart(new THREE.BoxGeometry(1.6, 5, 1.8), castleWallMat, 2.4, 0.5, cz);
    addCastlePart(new THREE.BoxGeometry(3.4, 1.2, 1.8), castleWallMat, 0, 3.2, cz);
    addCastlePart(new THREE.BoxGeometry(2.8, 4.2, 0.3), castleWoodMat, 0, 1.0, cz);
    // башни с коническими крышами и флагами
    for (const tx of [-9, 9]) {
      addCastlePart(new THREE.CylinderGeometry(1.8, 2.2, 12, 10), castleWallMat, tx, 4, cz);
      addCastlePart(new THREE.ConeGeometry(2.3, 3.4, 10), castleRoofMat, tx, 11.5, cz);
      addCastlePart(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), castleWoodMat, tx, 14.2, cz);
      const flag = addCastlePart(new THREE.PlaneGeometry(1.4, 0.8), new THREE.MeshStandardMaterial({ color: 0xaa2244, side: THREE.DoubleSide, roughness: 0.8 }), tx + 0.75, 14.8, cz);
      flag.castShadow = false;
    }
    // главный донжон (keep) с большой крышей
    addCastlePart(new THREE.BoxGeometry(6, 9, 5), castleWallMat, 0, 4.5, cz + 4);
    const keepRoof = addCastlePart(new THREE.ConeGeometry(4.4, 3.2, 4), castleRoofMat, 0, 10.4, cz + 4, Math.PI / 4);
    keepRoof.castShadow = false;
  }
  function startCinematic(kind) {
    if (kind === "space" && spaceCinematicDone) return;
    if (kind === "planet" && planetCinematicDone) return;
    if (kind === "city" && cityCinematicDone) return;
    if (cinematic) return;
    cinematicKind = kind;
    cinematic = { start: performance.now() };
    for (const e of enemies) { scene.remove(e.mesh); if (e.label) scene.remove(e.label); }
    enemies = [];
    for (const b of bonuses) { scene.remove(b.mesh); if (b.label) scene.remove(b.label); }
    bonuses = [];
    for (const s of shots) { scene.remove(s.mesh); }
    shots = [];
    spaceship = makeSpaceship();
    spaceship.position.set(0, kind === "planet" ? -4 : (-(H / 2) * SCALE - 0.6) + 1.5, kind === "planet" ? 0 : -18);
    spaceship.scale.setScalar(kind === "planet" ? 0.7 : 0.6);
    // запоминаем, чей это корабль (для перехода 5→20) и скрываем игрока в режимах space/planet
    spaceship.userData.shipFor = kind;
    if (player && player.mesh && kind !== "space") player.mesh.visible = false;
    spawnTimer = 1200;
    bonusTimer = 5000;
    cinematicStarted = true;
    upgradeLine.textContent = kind === "planet" ? "Уровень 20: новый мир! 🪐" : kind === "city" ? "Уровень 50: въезжаем в город! 🏙️" : "Уровень 5: запуск! 🚀";
  }
  function startGame() {
    if (!tgUser) return;
    ensureAudio();
    if (tgUser) {
      playerName = tgUser.first_name || tgUser.username || playerName || "Игрок";
    } else {
      playerName = playerName || "Игрок";
    }
    localStorage.setItem("szh_name", playerName);
    if (player && player.mesh) scene.remove(player.mesh);
    resetGame();
    state = "playing";
    overlay.classList.add("hidden");
  }

  // ================= БЕСТИАРИЙ / ЛОР (иконка ℹ️ в меню) — 3D-версия =================
  // 3D-витрина: своя камера/сцена на overlay-канвасе, модель крутится на 360° как пикап-бонус.
  let bestiaryViewer = null; // { scene, camera, renderer, current, turntable }
  const BESTIARY_ENTRIES = [
    { key: "vape", title: "Вейп (ты)", color: "#7dd3fc", make: () => {
        // реальная модель игрока (GLTF) или фолбэк
        if (vapeTemplate) return vapeTemplate.clone(true);
        const g = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.2, 0.55), new THREE.MeshStandardMaterial({ color: 0x2255aa, metalness: 0.6, roughness: 0.35 }));
        g.add(body);
        return g;
      } },
    { key: "zombie", title: "Зомби", color: "#7bc950", make: () => makeZombie() },
    { key: "nun", title: "Монашка", color: "#c77dff", make: () => makeNun() },
    { key: "meteor", title: "Метеорит", color: "#ffa94d", make: () => makeMeteorite() },
    { key: "slime", title: "Слизь", color: "#51cf66", make: () => makeSlime() },
    { key: "pedestrian", title: "Прохожий", color: "#ff8787", make: () => makePedestrian(0xdd4444) },
    { key: "ship", title: "Корабль", color: "#99e9f2", make: () => makeSpaceship() },
    { key: "chest", title: "Сундук", color: "#ffd43b", make: () => makeChest() },
  ];
  const BESTIARY_LORE = {
    vape: "Последний живой вейп в городке Свит-Холлоу. Когда-то он был обычным клубничным подом с полки магазина, но однажды ночью призрак основателя завода вдохнул в него жизнь. Теперь он пара-дышащий герой, который стреляет ароматным паром и защищает свой магазин от нежити.",
    zombie: "Бывшие покупатели магазина, которые накурились просрочки и превратились в ходячих сладкоежек. Выходят с кладбища за городом и тянутся грызть витрины со сладостями. Медленные, но их много. Появляются с 1 уровня, ночью на старом шоссе.",
    nun: "Настоятельница заброшенного монастыря на холме. Под её привычкой — древний культ Вейп-Бога, и она несёт не спасение, а сбор пара для своих тёмных обрядов. Быстрее зомби и наглее. Появляется с 1 уровня, идёт по центру дороги.",
    meteor: "Обломок астероида, который упал вместе с кораблём инопланетян. Горячий, злой и пахнет горелым картриджем. В космосе (с 5 уровня) метеориты летят прямо на тебя — их приносит магнитная буря.",
    slime: "Живая слизь с планеты Вейп-Прайм. Съедает всё, что пахнет фруктами. Появляется на планете (с 20 уровня) из древних раскопок рядом со Стоунхенджем.",
    pedestrian: "Обычные жители города Неон-Сити (с 50 уровня). Они ни в чём не виноваты! Если задеть их паром — теряешь очки, а они кричат всякое. Машины ездят сами по себе — у них автопилот от Sweethollow Motors.",
    ship: "Корабль инопланетян, который забрал тебя на космический уровень (5+), а на 20-м улетел в сторону планеты Вейп-Прайм. Гражданский транспорт Sweethollow Motors, модель «Пион-7».",
    chest: "Появляется на 35-м уровне. Даёт ОДИН предмет навсегда: 4 жизни, 4 пули или 20 очков за монстра (но тогда монстры бьют вдвое больнее). В рюкзак влезает до 3 предметов.",
  };

  function ensureBestiaryViewer() {
    if (bestiaryViewer) return bestiaryViewer;
    const cnv = document.createElement("canvas");
    cnv.id = "bestiaryCanvas";
    cnv.style.cssText = "width:100%;height:260px;border-radius:12px;background:#0a0a18;display:block;";
    const r = new THREE.WebGLRenderer({ canvas: cnv, antialias: true, alpha: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const sc = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    cam.position.set(0, 2.2, 6);
    cam.lookAt(0, 0.8, 0);
    sc.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(3, 6, 5);
    sc.add(key);
    const rim = new THREE.PointLight(0x6699ff, 1.0, 30);
    rim.position.set(-4, 2, -4);
    sc.add(rim);
    // подиум
    const podium = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 0.25, 40), new THREE.MeshStandardMaterial({ color: 0x2a2a3a, metalness: 0.5, roughness: 0.4 }));
    podium.position.y = -0.12;
    sc.add(podium);
    bestiaryViewer = { renderer: r, scene: sc, camera: cam, canvas: cnv, current: null, turntable: null, raf: null };
    return bestiaryViewer;
  }

  function bestiaryShow(index) {
    const v = ensureBestiaryViewer();
    const entry = BESTIARY_ENTRIES[index];
    if (v.current) { v.scene.remove(v.current); v.current = null; }
    const model = entry.make();
    // нормализация размера: вписываем модель в ~2 юнита
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = 2.2 / maxDim;
    model.scale.setScalar(scale);
    // центрируем по X/Z и ставим НИЗ модели ровно на подиум (не проваливается)
    const box2 = new THREE.Box3().setFromObject(model);
    const center = box2.getCenter(new THREE.Vector3());
    const halfH = (box2.max.y - box2.min.y) / 2;
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= center.y - halfH; // низ = 0 (верх подиума)
    // обёртка: вращаем её, а не саму модель — у некоторых моделей (корабль) запечён
    // собственный rotation.x, и вращение по Y давало странный «кувырок» вместо ровного оборота
    const wrap = new THREE.Group();
    wrap.add(model);
    v.scene.add(wrap);
    v.current = wrap;
    v.turntable = wrap;
    // лор и заголовок
    document.getElementById("bestiaryTitle").innerHTML = entry.title + " <span style='color:" + entry.color + "'>●</span>";
    document.getElementById("bestiaryLore").textContent = BESTIARY_LORE[entry.key] || "";
    // подсветка активной кнопки
    const tabs = document.querySelectorAll(".bestiary-tab");
    tabs.forEach((b, i) => { b.style.borderColor = i === index ? entry.color : "rgba(255,255,255,0.15)"; b.style.background = i === index ? "rgba(255,122,24,0.25)" : "rgba(255,255,255,0.05)"; });
    // запоминаем активный индекс для перезапуска анимации
    v.activeIndex = index;
  }

  function bestiaryTick() {
    const v = bestiaryViewer;
    if (!v) return;
    const now = performance.now();
    // крутится как пикап-бонус: полный оборот за ~4 сек вокруг вертикали
    if (v.turntable) v.turntable.rotation.y = (now / 1000) * 1.5 % (Math.PI * 2);
    const cw = v.canvas.clientWidth || 300, ch = v.canvas.clientHeight || 260;
    if (v.canvas.width !== cw * v.renderer.getPixelRatio() || v.canvas.height !== ch * v.renderer.getPixelRatio()) {
      v.renderer.setSize(cw, ch, false);
      v.camera.aspect = cw / ch;
      v.camera.updateProjectionMatrix();
    }
    v.renderer.render(v.scene, v.camera);
    v.raf = requestAnimationFrame(bestiaryTick);
  }

  function stopBestiaryViewer() {
    const v = bestiaryViewer;
    if (!v) return;
    if (v.raf) cancelAnimationFrame(v.raf);
    v.raf = null;
  }

  function showBestiary() {
    stopBestiaryViewer();
    overlay.classList.remove("hidden");
    overlayInner.innerHTML = "";
    const h1 = document.createElement("h1");
    h1.textContent = "📖 Бестиарий и лор";
    h1.style.cssText = "font-size:20px;margin-bottom:0;"; // компактный заголовок (обычный h1 40px не влезает)
    overlayInner.appendChild(h1);
    // 3D-витрина
    const v = ensureBestiaryViewer();
    overlayInner.appendChild(v.canvas);
    const title = document.createElement("div");
    title.id = "bestiaryTitle";
    title.style.cssText = "font-size:16px;font-weight:700;margin-top:8px;";
    overlayInner.appendChild(title);
    const lore = document.createElement("div");
    lore.id = "bestiaryLore";
    lore.style.cssText = "font-size:13px;color:#bbb;line-height:1.45;max-width:100%;";
    overlayInner.appendChild(lore);
    // табы-персонажи
    const tabs = document.createElement("div");
    tabs.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:10px 0;";
    const icons = { vape: "🥎", zombie: "🧟", nun: "⛪", meteor: "☄️", slime: "🟢", pedestrian: "🏙️", ship: "🚀", chest: "🧰" };
    BESTIARY_ENTRIES.forEach((e, i) => {
      const b = document.createElement("button");
      b.className = "bestiary-tab";
      b.textContent = icons[e.key] || "•";
      b.title = e.title;
      b.style.cssText = "width:40px;height:40px;font-size:19px;border-radius:10px;cursor:pointer;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.15);";
      b.onclick = (ev) => { ev.stopPropagation(); bestiaryShow(i); };
      tabs.appendChild(b);
    });
    overlayInner.appendChild(tabs);
    const btn = document.createElement("button");
    btn.textContent = "← Назад в меню";
    btn.onclick = (e) => { e.stopPropagation(); stopBestiaryViewer(); buildMenu(); };
    overlayInner.appendChild(btn);
    bestiaryShow(0);
    bestiaryTick();
  }

  function buildMenu() {
    overlay.classList.remove("hidden");
    overlayInner.innerHTML = "";
    const h1 = document.createElement("h1");
    h1.textContent = "Sweet Zombie Hunt";
    overlayInner.appendChild(h1);
    const sub = document.createElement("p");
    sub.textContent = "Halloween Vape Edition — 3D";
    overlayInner.appendChild(sub);
    // —— РЮКЗАК (3 слота, предметы НАВСЕГДА) ——
    let _menuPerks = [];
    try { _menuPerks = JSON.parse(localStorage.getItem("szh_perm_perks") || "[]"); } catch (e) {}
    const bpWrap = document.createElement("div");
    bpWrap.style.cssText = "display:flex;align-items:center;gap:10px;margin:10px 0;padding:10px;background:rgba(255,122,24,0.08);border:1px solid rgba(255,122,24,0.4);border-radius:12px;";
    const bpIcon = document.createElement("div");
    bpIcon.textContent = "🎒";
    bpIcon.style.cssText = "font-size:34px;";
    bpWrap.appendChild(bpIcon);
    const bpLabel = document.createElement("div");
    bpLabel.textContent = "Рюкзак перков:";
    bpLabel.style.cssText = "font-size:13px;color:#ccc;";
    bpWrap.appendChild(bpLabel);
    const bpSlots = document.createElement("div");
    bpSlots.style.cssText = "display:flex;gap:6px;";
    const perkIcons = { lives: "❤️", bullets: "🔫", score: "💰" };
    const perkNames = { lives: "4 жизни навсегда", bullets: "4 пули вместо 3", score: "20 очков (2 урона)" };
    for (let i = 0; i < 3; i++) {
      const slot = document.createElement("div");
      const perk = _menuPerks[i];
      slot.textContent = perk ? perkIcons[perk] : "➕";
      slot.title = perk ? perkNames[perk] : "Пустой слот — получи предмет из сундука на 35 уровне";
      slot.style.cssText = "width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:20px;background:" + (perk ? "rgba(255,122,24,0.35)" : "rgba(255,255,255,0.06)") + ";border:1px dashed " + (perk ? "#ff7a18" : "#555") + ";border-radius:8px;";
      bpSlots.appendChild(slot);
    }
    bpWrap.appendChild(bpSlots);
    // —— ИКОНКА ИНФО (справа от рюкзака) ——
    const infoBtn = document.createElement("button");
    infoBtn.textContent = "ℹ️";
    infoBtn.title = "Бестиарий и лор игры";
    infoBtn.style.cssText = "margin-left:auto;width:44px;height:44px;font-size:22px;line-height:1;display:flex;align-items:center;justify-content:center;padding:0;background:rgba(122,162,255,0.15);border:1px solid rgba(122,162,255,0.5);border-radius:12px;cursor:pointer;flex-shrink:0;";
    infoBtn.onclick = (e) => { e.stopPropagation(); showBestiary(); };
    bpWrap.appendChild(infoBtn);
    overlayInner.appendChild(bpWrap);
    const info = document.createElement("p");
    info.textContent =
      "Стрелки/мышь — движение, пробел/клик — выстрел, R — перезарядка. Телефон: свайп — движение, тап — выстрел.";
    overlayInner.appendChild(info);
    const tgWrap = document.createElement("div");
    tgWrap.style.cssText = "width:100%;margin:8px 0;text-align:center;";
    const tgContainer = document.createElement("div");
    tgContainer.id = "tgWidgetContainer";
    tgContainer.style.cssText = "display:flex;justify-content:center;margin:6px 0;min-height:44px;";
    tgWrap.appendChild(tgContainer);
    overlayInner.appendChild(tgWrap);
    if (!tgUser) {
      loadTelegramWidget(tgWrap);
    }
    const tgHint = document.createElement("p");
    tgHint.style.cssText = "font-size:12px;color:#888;margin:4px 0;";
    tgHint.textContent = tgUser
      ? `Вы вошли как ${tgUser.first_name || tgUser.username}`
      : "Если кнопка Telegram не появилась, проверьте домен у @BotFather";
    overlayInner.appendChild(tgHint);
    if (!tgUser) {
      const manual = document.createElement("div");
      manual.style.cssText = "margin:8px 0;";
      const minput = document.createElement("input");
      minput.placeholder = "@username в Telegram";
      minput.style.cssText = "width:100%;padding:8px;border-radius:8px;border:1px solid #444;background:#111;color:#fff;";
      const mbtn = document.createElement("button");
      mbtn.textContent = "Войти вручную";
      mbtn.style.cssText = "width:100%;margin-top:6px;padding:8px;border-radius:8px;border:none;background:#ff7a18;color:#000;font-weight:700;cursor:pointer;";
      mbtn.onclick = (e) => {
        e.stopPropagation();
        const v = minput.value.trim().replace(/^@+/, "");
        if (!v) return;
        tgUser = { id: Date.now(), first_name: v, last_name: null, username: v, photo_url: null };
        localStorage.setItem("szh_tg", JSON.stringify(tgUser));
        playerName = v;
        localStorage.setItem("szh_name", playerName);
        buildMenu();
        fetchLeaderboard();
      };
      manual.appendChild(minput);
      manual.appendChild(mbtn);
      overlayInner.appendChild(manual);
    }
    if (tgUser) {
      const btn = document.createElement("button");
      btn.textContent = "Играть";
      btn.onclick = (e) => {
        e.stopPropagation();
        startGame();
      };
      overlayInner.appendChild(btn);
    } else {
      const msg = document.createElement("p");
      msg.textContent = "Войдите через Telegram, чтобы начать игру";
      msg.style.color = "#ff7a18";
      overlayInner.appendChild(msg);
    }
    const lbTitle = document.createElement("h3");
    lbTitle.textContent = "Таблица рекордов";
    lbTitle.style.color = "#ff7a18";
    overlayInner.appendChild(lbTitle);
    const lb = document.createElement("div");
    lb.id = "leaderboard";
    overlayInner.appendChild(lb);
    renderLeaderboard();
  }

  function renderLeaderboard() {
    const lb = document.getElementById("leaderboard");
    if (!lb) return;
    if (!leaderboard.length) {
      lb.innerHTML =
        "<div style='color:#888;text-align:center;padding:12px;'>Пока нет рекордов</div>";
      return;
    }
    lb.innerHTML = leaderboard
      .map(
        (s, i) => {
          const name = escapeHtml(s.name);
          const contact = s.contact ? escapeHtml(s.contact) : null;
          const nameHtml = contact
            ? `<a href="${contact}" target="_blank" rel="noopener" onclick="if(!window.open('${contact}','_blank')){window.top.location.href='${contact}';}return false;" style="color:#7dd3fc;text-decoration:underline;cursor:pointer;">${name}</a>`
            : name;
          return `
      <div style="display:flex;justify-content:space-between;padding:4px 6px;border-bottom:1px solid rgba(255,255,255,0.08);">
        <span>${i + 1}. ${nameHtml}</span>
        <span style="color:#ff7a18;font-weight:700;">${s.score}</span>
      </div>
    `;
        },
      )
      .join("");
  }
  function escapeHtml(t) {
    return String(t).replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  }

  function getSupabaseAccessToken() {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("sb-") && k.endsWith("-auth-token")) {
          const v = JSON.parse(localStorage.getItem(k));
          const token = v?.access_token || v?.currentSession?.access_token;
          if (token) return token;
        }
      }
    } catch (e) {}
    return null;
  }

  async function loadTelegramWidget(container) {
    const box = container.querySelector("#tgWidgetContainer") || container;
    box.innerHTML = "";
    const botUsername = "gameeventlove_bot";
    window.onTelegramAuth = function (user) {
      try {
        tgUser = {
          id: user.id,
          first_name: user.first_name || null,
          last_name: user.last_name || null,
          username: user.username || null,
          photo_url: user.photo_url || null,
        };
        localStorage.setItem("szh_tg", JSON.stringify(tgUser));
        playerName = tgUser.first_name || tgUser.username || playerName || "Игрок";
        localStorage.setItem("szh_name", playerName);
        location.reload();
      } catch (e) {
        console.warn("tg auth error", e);
      }
    };
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-userpic", "true");
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    box.appendChild(script);
  }

  // Input
  window.addEventListener("keydown", (e) => {
    if (state === "chest") return;
    if (e.key === "ArrowLeft") keys.left = true;
    if (e.key === "ArrowRight") keys.right = true;
    if (e.key === "r" || e.key === "R") startReload();
    if (e.code === "Space") {
      e.preventDefault();
      if (state === "playing") fire();
      else if (state === "menu") startGame();
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.key === "ArrowLeft") keys.left = false;
    if (e.key === "ArrowRight") keys.right = false;
  });

  renderer.domElement.addEventListener("mousemove", (e) => {
    const rect = renderer.domElement.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
  });
  renderer.domElement.addEventListener("mousedown", (e) => {
    ensureAudio();
    if (state === "chest") return;
    const rect = renderer.domElement.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    if (state === "playing") fire();
    else if (state === "menu") startGame();
  });

  renderer.domElement.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      ensureAudio();
      const t = e.touches[0];
      const rect = renderer.domElement.getBoundingClientRect();
      touchStartX = t.clientX - rect.left;
      touchMoved = false;
      mouseX = touchStartX;
      if (state === "menu") startGame();
    },
    { passive: false },
  );
  renderer.domElement.addEventListener(
    "touchmove",
    (e) => {
      e.preventDefault();
      const t = e.touches[0];
      const rect = renderer.domElement.getBoundingClientRect();
      const x = t.clientX - rect.left;
      if (Math.abs(x - touchStartX) > 6) touchMoved = true;
      mouseX = x;
    },
    { passive: false },
  );
  renderer.domElement.addEventListener(
    "touchend",
    (e) => {
      e.preventDefault();
      if (state === "playing" && !touchMoved) fire();
      touchStartX = null;
    },
    { passive: false },
  );

  bestEl.textContent = best;
  buildMenu();
  fetchLeaderboard();

  const backToSiteBtn = document.getElementById("backToSiteBtn");
  if (backToSiteBtn) {
    backToSiteBtn.addEventListener("click", async () => {
      if (state === "playing" && score > 0) {
        try { await submitScore(); } catch (e) {}
      }
      try { (window.top || window).location.href = "/"; } catch (e) { window.location.href = "/"; }
    });
  }
  const fireBtn = document.getElementById("fireBtn");
  if (fireBtn) {
    fireBtn.addEventListener("click", (e) => {
      e.preventDefault();
      ensureAudio();
      if (state === "playing") fire();
      else if (state === "menu") startGame();
    });
  }

  // Lives display (HTML overlay small)
  // We'll draw lives via DOM? Keep simple: add to hud
  const livesEl = document.createElement("div");
  livesEl.id = "lives";
  document.getElementById("hud").appendChild(livesEl);
  const ammoEl = document.createElement("div");
  ammoEl.id = "ammo";
  document.getElementById("hud").appendChild(ammoEl);
  // update lives in loop
  function updateLivesUI() {
    livesEl.textContent = "❤".repeat(Math.max(0, lives));
    ammoEl.textContent = reloading ? "Перезарядка..." : `Патроны: ${ammo}/${MAX_AMMO}` + (perks.length ? ` | Рюкзак: ${perks.length}/3` : "");
  }

  let lastTime = performance.now();
  function loop(now) {
    const dt = now - lastTime;
    lastTime = now;
    if (state === "playing" || state === "chest") {
       try { if (state === "playing") update(dt); } catch (e) { upgradeLine.textContent = "ERR: " + e.message; console.error(e); }
       try { updateLivesUI(); } catch (e) {}
    }
    // player mesh update (position already in update; but menu no player)
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // init pumpkins world positions after resize? reinit on first
  window.addEventListener("resize", () => {
    initPumpkins();
  });
})();
