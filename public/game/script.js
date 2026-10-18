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
  scene.fog = new THREE.Fog(0x050510, 10, 60);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
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
  const ambient = new THREE.AmbientLight(0x667799, 0.5);
  scene.add(ambient);
  const dir = new THREE.DirectionalLight(0xffaa66, 0.9);
  dir.position.set(5, 10, 8);
  dir.castShadow = true;
  dir.shadow.mapSize.set(1024, 1024);
  scene.add(dir);
  const playerLight = new THREE.PointLight(0x88ccff, 0.8, 6);
  scene.add(playerLight);

  // Ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshStandardMaterial({ color: 0x1a1208, roughness: 0.9, metalness: 0.1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -(H / 2) * SCALE - 0.5;
  ground.receiveShadow = true;
  scene.add(ground);

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
  let leaderboard = [];

  // Player 3D
  function makePlayer() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 1.0, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x2b2b3a, metalness: 0.6, roughness: 0.4 }),
    );
    body.castShadow = true;
    g.add(body);
    const tank = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, 0.9, 16),
      new THREE.MeshStandardMaterial({ color: 0x6a4c93, metalness: 0.4, roughness: 0.5 }),
    );
    tank.rotation.z = Math.PI / 2;
    tank.castShadow = true;
    g.add(tank);
    const mouth = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 0.3, 12),
      new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.8 }),
    );
    mouth.position.y = 0.65;
    mouth.castShadow = true;
    g.add(mouth);
    const emitter = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 12, 12),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0x88ccff,
        emissiveIntensity: 0.8,
      }),
    );
    emitter.position.y = 0.85;
    g.add(emitter);
    scene.add(g);
    return g;
  }

  function makeZombie() {
    const g = new THREE.Group();
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.7, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0x8fd46a, roughness: 0.7 }),
    );
    head.position.y = 1.0;
    head.castShadow = true;
    g.add(head);
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 1.2, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x3a5a2a, roughness: 0.8 }),
    );
    body.position.y = -0.2;
    body.castShadow = true;
    g.add(body);
    const armL = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.8, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x4a7a30 }),
    );
    armL.position.set(-0.7, 0.1, 0);
    armL.rotation.z = 0.4;
    g.add(armL);
    const armR = armL.clone();
    armR.position.x = 0.7;
    armR.rotation.z = -0.4;
    g.add(armR);
    // eyes
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0xffea00,
      emissive: 0xffea00,
      emissiveIntensity: 0.4,
    });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), eyeMat);
    eyeL.position.set(-0.2, 1.05, 0.6);
    g.add(eyeL);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.2;
    g.add(eyeR);
    scene.add(g);
    return g;
  }

  function makeNun() {
    const g = new THREE.Group();
    const veil = new THREE.Mesh(
      new THREE.ConeGeometry(0.9, 2.0, 16),
      new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 }),
    );
    veil.position.y = 0.2;
    veil.castShadow = true;
    g.add(veil);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xf5d6b3, roughness: 0.6 }),
    );
    head.position.y = 1.1;
    head.castShadow = true;
    g.add(head);
    const cross = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.35, 0.05),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 0.3,
      }),
    );
    cross.position.set(0, 1.5, 0.5);
    g.add(cross);
    const cross2 = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 0.05, 0.05),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 0.3,
      }),
    );
    cross2.position.set(0, 1.5, 0.5);
    g.add(cross2);
    scene.add(g);
    return g;
  }

  function makeTextSprite(text) {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 64;
    const cx = c.getContext("2d");
    cx.fillStyle = "rgba(0,0,0,0.55)";
    cx.fillRect(0, 0, 256, 64);
    cx.font = "bold 26px sans-serif";
    cx.fillStyle = "#fff";
    cx.textAlign = "center";
    cx.textBaseline = "middle";
    cx.fillText(text, 128, 32);
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sp = new THREE.Sprite(mat);
    sp.scale.set(2.2, 0.55, 1);
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
    lastShot = 0;
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
    const flavors = ["strawberry", "kiwi", "orange"];
    const names = { strawberry: "Клубника", kiwi: "Киви", orange: "Мандарин" };
    const f = flavors[Math.floor(Math.random() * flavors.length)];
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 16, 16),
      new THREE.MeshStandardMaterial({
        color: flavorColorHex(f),
        emissive: flavorColorHex(f),
        emissiveIntensity: 0.5,
        roughness: 0.3,
      }),
    );
    mesh.castShadow = true;
    scene.add(mesh);
    bonuses.push({
      x: rand(30, W - 30),
      y: -20,
      r: 16,
      flavor: f,
      name: names[f],
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
      const r = await fetch("/game/leaderboard", { cache: "no-store" });
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
        body: JSON.stringify({ name: playerName || "Игрок", score }),
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
      spawnEnemy();
      spawnTimer = Math.max(350, 1000 - level * 55);
    }
    bonusTimer -= dt;
    if (bonusTimer <= 0) {
      spawnBonus();
      bonusTimer = rand(4500, 7500);
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      e.y += e.speed;
      e.x += Math.sin(performance.now() / 600 + e.wobble) * 0.4;
      e.mesh.position.set(screenToWorldX(e.x), screenToWorldY(e.y), 0);
      if (e.label) e.label.position.set(screenToWorldX(e.x), screenToWorldY(e.y) + 1.6, 0);
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
        buffUntil = performance.now() + 6000;
        upgradeLine.textContent = `Улучшения: Усиленный пар (${b.name}) — площадь +100%`;
        addParticles(b.x, b.y, flavorColorHex(b.flavor), 22);
        beep(680, 0.14, "triangle", 0.09);
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

    // buff timer display
    if (performance.now() < buffUntil) {
      const rem = Math.ceil((buffUntil - performance.now()) / 1000);
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
    ensureAudio();
    const nameInput = document.getElementById("nameInput");
    playerName = (nameInput ? nameInput.value.trim() : playerName) || "Игрок";
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
    const nameWrap = document.createElement("div");
    nameWrap.style.cssText = "width:100%;";
    const input = document.createElement("input");
    input.id = "nameInput";
    input.placeholder = "Ваше имя";
    input.value = playerName;
    input.maxLength = 20;
    nameWrap.appendChild(input);
    overlayInner.appendChild(nameWrap);
    const info = document.createElement("p");
    info.textContent =
      "Стрелки/мышь — движение, пробел/клик — выстрел, R — перезарядка. Телефон: свайп — движение, тап — выстрел.";
    overlayInner.appendChild(info);
    const btn = document.createElement("button");
    btn.textContent = "Играть";
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
        (s, i) => `
      <div style="display:flex;justify-content:space-between;padding:4px 6px;border-bottom:1px solid rgba(255,255,255,0.08);">
        <span>${i + 1}. ${escapeHtml(s.name)}</span>
        <span style="color:#ff7a18;font-weight:700;">${s.score}</span>
      </div>
    `,
      )
      .join("");
  }
  function escapeHtml(t) {
    return String(t).replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
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
