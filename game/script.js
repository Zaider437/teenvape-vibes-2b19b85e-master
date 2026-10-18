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
    camera.position.set(0, 0, cameraZ);
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
  const colors = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = (Math.sin(x * 0.08) * Math.cos(y * 0.07) * 0.4) + (Math.random() - 0.5) * 0.15;
    pos.setZ(i, z);
    const shade = 0.35 + Math.random() * 0.15;
    colors.push(shade * 0.6, shade * 0.4, shade * 0.25);
  }
  groundGeo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
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
    new THREE.MeshStandardMaterial({ map: groundTex, vertexColors: true, roughness: 0.95, metalness: 0.05 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -(H / 2) * SCALE - 0.6;
  ground.receiveShadow = true;
  scene.add(ground);

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
    return g;
  }

  // Bats
  const bats = [];
  function makeBat() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.15, 0.15),
      new THREE.MeshStandardMaterial({ color: 0x000000 }),
    );
    g.add(body);
    const wing = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.05, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x000000 }),
    );
    wing.position.x = 0.4;
    g.add(wing);
    const wing2 = wing.clone();
    wing2.position.x = -0.4;
    g.add(wing2);
    scene.add(g);
    return {
      g,
      wing,
      wing2,
      x: Math.random() * W,
      y: Math.random() * H * 0.35,
      vx: (Math.random() - 0.5) * 1.2,
      phase: Math.random() * Math.PI * 2,
    };
  }
  for (let i = 0; i < 7; i++) bats.push(makeBat());

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

  const MAX_AMMO = 12;
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

  // Player 3D
  function makePlayer() {
    const g = new THREE.Group();
    // body / chassis
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 1.3, 0.55),
      new THREE.MeshStandardMaterial({ color: 0x1a1a22, metalness: 0.7, roughness: 0.35 }),
    );
    body.castShadow = true;
    g.add(body);
    // tank (glass)
    const tank = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 1.0, 24),
      new THREE.MeshPhysicalMaterial({ color: 0x99ccff, transmission: 0.6, opacity: 0.7, transparent: true, roughness: 0.1, metalness: 0.1 }),
    );
    tank.rotation.z = Math.PI / 2;
    tank.position.y = 0.15;
    tank.castShadow = true;
    g.add(tank);
    // liquid inside
    const liquid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.26, 0.85, 24),
      new THREE.MeshStandardMaterial({ color: 0xff6b9d, emissive: 0xff6b9d, emissiveIntensity: 0.35, roughness: 0.2 }),
    );
    liquid.rotation.z = Math.PI / 2;
    liquid.position.y = 0.15;
    g.add(liquid);
    // mouthpiece
    const mouth = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.16, 0.35, 16),
      new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.9, roughness: 0.2 }),
    );
    mouth.position.y = 0.85;
    mouth.castShadow = true;
    g.add(mouth);
    // drip tip
    const tip = new THREE.Mesh(
      new THREE.ConeGeometry(0.1, 0.18, 16),
      new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4 }),
    );
    tip.position.y = 1.08;
    g.add(tip);
    // fire button
    const btn = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 0.08, 16),
      new THREE.MeshStandardMaterial({ color: 0xff7a18, emissive: 0xff3d00, emissiveIntensity: 0.5, metalness: 0.6 }),
    );
    btn.rotation.x = Math.PI / 2;
    btn.position.set(0, -0.1, 0.32);
    g.add(btn);
    // emitter glow
    const emitter = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 16, 16),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0x88ccff,
        emissiveIntensity: 1.2,
      }),
    );
    emitter.position.y = 1.25;
    g.add(emitter);
    scene.add(g);
    return g;
  }

  function makeZombie() {
    const g = new THREE.Group();
    // legs
    const legMat = new THREE.MeshStandardMaterial({ color: 0x2a3a1a, roughness: 0.9 });
    const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 1.1, 12), legMat);
    legL.position.set(-0.22, -1.35, 0);
    legL.castShadow = true;
    g.add(legL);
    const legR = legL.clone();
    legR.position.x = 0.22;
    g.add(legR);
    // feet
    const footMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
    const footL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.4), footMat);
    footL.position.set(-0.22, -1.95, 0.1);
    g.add(footL);
    const footR = footL.clone();
    footR.position.x = 0.22;
    g.add(footR);
    // torso
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 1.25, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x3a5a2a, roughness: 0.85 }),
    );
    body.position.y = -0.15;
    body.castShadow = true;
    g.add(body);
    // torn shirt
    const shirt = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 0.75, 0.55),
      new THREE.MeshStandardMaterial({ color: 0x5a2a2a, roughness: 0.9 }),
    );
    shirt.position.y = 0.15;
    shirt.castShadow = true;
    g.add(shirt);
    // arms
    const armMat = new THREE.MeshStandardMaterial({ color: 0x4a7a30, roughness: 0.8 });
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.95, 0.2), armMat);
    armL.position.set(-0.68, 0.0, 0);
    armL.rotation.z = 0.55;
    armL.castShadow = true;
    g.add(armL);
    const armR = armL.clone();
    armR.position.x = 0.68;
    armR.rotation.z = -0.55;
    g.add(armR);
    // hands
    const handMat = new THREE.MeshStandardMaterial({ color: 0x8fd46a, roughness: 0.7 });
    const handL = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 10), handMat);
    handL.position.set(-0.9, -0.4, 0);
    g.add(handL);
    const handR = handL.clone();
    handR.position.x = 0.9;
    g.add(handR);
    // head
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.68, 24, 24),
      new THREE.MeshStandardMaterial({ color: 0x8fd46a, roughness: 0.7 }),
    );
    head.position.y = 1.05;
    head.castShadow = true;
    g.add(head);
    // jaw
    const jaw = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.22, 0.45),
      new THREE.MeshStandardMaterial({ color: 0x7ac45a, roughness: 0.7 }),
    );
    jaw.position.set(0, 0.72, 0.32);
    g.add(jaw);
    // eyes
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0xff2200,
      emissive: 0xff2200,
      emissiveIntensity: 1.0,
    });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), eyeMat);
    eyeL.position.set(-0.2, 1.12, 0.6);
    g.add(eyeL);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.2;
    g.add(eyeR);
    // mouth
    const mouth = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.1, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x1a0000, roughness: 0.5 }),
    );
    mouth.position.set(0, 0.84, 0.62);
    g.add(mouth);
    // teeth
    const toothMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.4 });
    for (let i = -1; i <= 1; i++) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.06), toothMat);
      t.position.set(i * 0.1, 0.84, 0.68);
      g.add(t);
     }
     // pitchfork
     const handleMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.9 });
     const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 8), handleMat);
     handle.position.set(0.9, -0.2, 0.2);
     handle.rotation.z = -0.3;
     handle.castShadow = true;
     g.add(handle);
     const prongMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.6, roughness: 0.4 });
     for (let i = -1; i <= 1; i++) {
       const prong = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.35, 0.04), prongMat);
       prong.position.set(0.9 + i * 0.08, 0.55, 0.2);
       g.add(prong);
     }
     const base = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.04), prongMat);
     base.position.set(0.9, 0.38, 0.2);
     g.add(base);
      scene.add(g);
      return g;
   }
   function makeNun() {
     const g = new THREE.Group();
    // robe
    const robe = new THREE.Mesh(
      new THREE.ConeGeometry(1.05, 2.5, 24),
      new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.95 }),
    );
    robe.position.y = 0.15;
    robe.castShadow = true;
    g.add(robe);
    // veil
    const veil = new THREE.Mesh(
      new THREE.ConeGeometry(0.95, 1.7, 24),
      new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.9 }),
    );
     veil.position.y = 1.35;
     veil.castShadow = true;
     g.add(veil);
     // hat brim
     const hatBrim = new THREE.Mesh(
       new THREE.CylinderGeometry(0.75, 0.75, 0.08, 24),
       new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.8 }),
     );
     hatBrim.position.y = 2.05;
     hatBrim.castShadow = true;
     g.add(hatBrim);
     // hat crown
     const hatCrown = new THREE.Mesh(
       new THREE.CylinderGeometry(0.45, 0.55, 0.5, 24),
       new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.8 }),
     );
     hatCrown.position.y = 2.35;
     hatCrown.castShadow = true;
     g.add(hatCrown);
     // cross on hat
     const hatCrossMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.6, metalness: 0.3 });
     const hatCrossV = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.35, 0.05), hatCrossMat);
     hatCrossV.position.set(0, 2.75, 0);
     g.add(hatCrossV);
     const hatCrossH = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.05, 0.05), hatCrossMat);
     hatCrossH.position.set(0, 2.85, 0);
     g.add(hatCrossH);
    // head
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.46, 24, 24),
      new THREE.MeshStandardMaterial({ color: 0xf5d6b3, roughness: 0.55 }),
    );
    head.position.y = 1.15;
    head.castShadow = true;
    g.add(head);
    // wimple
    const wimple = new THREE.Mesh(
      new THREE.TorusGeometry(0.5, 0.08, 12, 24, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }),
    );
    wimple.rotation.x = Math.PI / 2;
    wimple.position.y = 1.35;
    g.add(wimple);
    // face
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4 });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 10), eyeMat);
    eyeL.position.set(-0.14, 1.2, 0.42);
    g.add(eyeL);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.14;
    g.add(eyeR);
    const mouth = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.04, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x8b3a3a, roughness: 0.5 }),
    );
    mouth.position.set(0, 1.08, 0.44);
    g.add(mouth);
    // hands
    const handMat = new THREE.MeshStandardMaterial({ color: 0xf5d6b3, roughness: 0.6 });
    const handL = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), handMat);
    handL.position.set(-0.62, 0.45, 0.3);
    g.add(handL);
    const handR = handL.clone();
    handR.position.x = 0.62;
    g.add(handR);
    // cross
    const crossMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.6,
      metalness: 0.3,
    });
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.06), crossMat);
    crossV.position.set(0, 1.75, 0.55);
    g.add(crossV);
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.06, 0.06), crossMat);
    crossH.position.set(0, 1.9, 0.55);
    g.add(crossH);
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
    lives = 3;
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
  }

  function spawnEnemy() {
    const isNun = Math.random() < 0.35 + level * 0.02;
    const r = isNun ? 22 : 28;
    const mesh = isNun ? makeNun() : makeZombie();
    const label = makeTextSprite(isNun ? "Монашка" : "Зомби");
    scene.add(label);
    enemies.push({
      x: rand(r + 20, W - r - 20),
      y: -r - 10,
      r,
      type: isNun ? "nun" : "zombie",
      speed: (isNun ? 2.4 : 1.1) + level * 0.18,
      hp: 1,
      wobble: rand(0, Math.PI * 2),
      mesh,
      label,
    });
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
       mesh = new THREE.Mesh(
         new THREE.SphereGeometry(0.5, 16, 16),
         new THREE.MeshStandardMaterial({
           color: flavorColorHex(flavor),
           emissive: flavorColorHex(flavor),
           emissiveIntensity: 0.5,
           roughness: 0.3,
         }),
       );
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
       speed: 2.8,
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
    // muzzle smoke
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }),
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
      } else {
        spawnEnemy();
        spawnTimer = Math.max(350, 1000 - level * 55);
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
         e.y += e.speed;
         e.x += Math.sin(performance.now() / 600 + e.wobble) * 0.4;
       }
       e.mesh.position.set(screenToWorldX(e.x), screenToWorldY(e.y), 0);
        if (e.label) e.label.position.set(screenToWorldX(e.x), screenToWorldY(e.y) + (e.type === "nun" ? 3.0 : 2.6), 0);
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
          score += e.type === "nun" ? 25 : 10;
          scoreEl.textContent = score;
          addParticles(e.x, e.y, e.type === "nun" ? 0xc77dff : 0x7bc950, 20);
           beep(e.type === "nun" ? 740 : 440, 0.1, "square", 0.06);
           if (e.frozen && !enemies.some((x) => x.frozen)) freezeUntil = 0;
          const newLevel = 1 + Math.floor(score / 120);
          if (newLevel !== level) {
            level = newLevel;
            levelEl.textContent = level;
            beep(920, 0.18, "triangle", 0.09);
          }
          hit = true;
          break;
        }
      }
      if (hit) continue;
      if (e.y + e.r >= H - 70) {
        enemies.splice(i, 1);
        scene.remove(e.mesh);
        if (e.label) scene.remove(e.label);
         lives--;
         if (e.frozen && !enemies.some((x) => x.frozen)) freezeUntil = 0;
        addParticles(e.x, H - 70, 0xff4d4d, 24);
        beep(160, 0.3, "sawtooth", 0.12);
        if (lives <= 0) gameOver();
      }
    }

    for (let i = bonuses.length - 1; i >= 0; i--) {
      const b = bonuses[i];
      b.y += b.speed;
      b.spin += 0.1;
      b.mesh.position.set(screenToWorldX(b.x), screenToWorldY(b.y), 0);
      b.mesh.rotation.y += 0.08;
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
           const newLevel = 1 + Math.floor(score / 120);
           if (newLevel !== level) {
             level = newLevel;
             levelEl.textContent = level;
             beep(920, 0.18, "triangle", 0.09);
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

    // bats
    for (const b of bats) {
      b.x += b.vx;
      if (b.x < -20) b.x = W + 20;
      if (b.x > W + 20) b.x = -20;
      const wy = b.y + Math.sin(performance.now() / 800 + b.phase) * 8;
      b.g.position.set(screenToWorldX(b.x), screenToWorldY(wy), 0.5);
      b.wing.rotation.z = Math.sin(performance.now() / 120 + b.phase) * 0.6;
      b.wing2.rotation.z = -Math.sin(performance.now() / 120 + b.phase) * 0.6;
    }

// player mesh
player.mesh.position.set(screenToWorldX(player.x), screenToWorldY(player.y), 0);
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

  function buildMenu() {
    overlay.classList.remove("hidden");
    overlayInner.innerHTML = "";
    const h1 = document.createElement("h1");
    h1.textContent = "Sweet Zombie Hunt";
    overlayInner.appendChild(h1);
    const sub = document.createElement("p");
    sub.textContent = "Halloween Vape Edition — 3D";
    overlayInner.appendChild(sub);
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
    ammoEl.textContent = reloading ? "Перезарядка..." : `Патроны: ${ammo}/${MAX_AMMO}`;
  }

  let lastTime = performance.now();
  function loop(now) {
    const dt = now - lastTime;
    lastTime = now;
    if (state === "playing") {
      update(dt);
      updateLivesUI();
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
