const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const statusEl = document.getElementById('status');
const faceCountInputs = document.querySelectorAll('input[name="faceCount"]');
const bgToggle = document.getElementById('bgToggle');
const startGameBtn = document.getElementById('startGameBtn');
const threeCanvas = document.getElementById('threeOverlay');
const scoreLeftEl = document.getElementById('scoreLeft');
const scoreRightEl = document.getElementById('scoreRight');
const winOverlay = document.getElementById('winOverlay');
const winText = document.getElementById('winText');
const restartBtn = document.getElementById('restartBtn');
let maxFaces = 2;

const ctx = overlay.getContext('2d');
let faceMeshInstance = null;
const shockwaves = [];
let lastFrameTime = performance.now();
const inhaleParticles = [];
const cooldownFillLeft = document.getElementById('cooldownFillLeft');
const inhaleFillLeft = document.getElementById('inhaleFillLeft');
const cooldownFillRight = document.getElementById('cooldownFillRight');
const inhaleFillRight = document.getElementById('inhaleFillRight');
const inhaleCooldownMs = 500;
let cyclonePhase = 0;
const blowWindowMs = 2000;
const blowDurationMs = 800;
const explosionSprite = new Image();
explosionSprite.src = 'assets/vfx/explosion_atlas_512x512.png';
const smokeSprite = new Image();
smokeSprite.src = 'assets/vfx/smoke_sheet.png';
const bombSprite = new Image();
bombSprite.src = 'assets/vfx/bomb_circle.png';
const faceTexture = new Image();
faceTexture.src = 'assets/exploe.png';
const useFaceTexture = false;
const poopSprite = new Image();
poopSprite.src = 'assets/items/poop.svg';
const bgm = new Audio('assets/Candy Cloud Freefall.mp3');
bgm.loop = true;
let threeRenderer = null;
let threeScene = null;
let threeCamera = null;
let threeModels = [];
let threeReady = false;
const bombSpawnIntervalMs = 5000;
const bombCornerCooldownMs = 10000;
const bombSpeed = 160;
const bombSuctionStrength = 220;
const bombInhaleBoost = 400000;
const bombLipHitRadiusBase = 12;
const bombSuctionRadius = 500;
const bombSuctionMinForce = 12;
const bombExpireMargin = 80;
const bombRadius = 34;
const bombGravity = 0;
const bombDrag = 0.999;
const goalScoreLimit = 5;
const goalRadiusX = 120;
const goalRadiusY = 60;
const inhaleTriggerMs = 1000;
const longMouthClosedMs = 1500;
const faceState = [
  { mouthClosedAt: 0, longMouthClosed: false },
  { mouthClosedAt: 0, longMouthClosed: false },
];
const puck = {
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  radius: 22,
  ready: false,
};
const puckFriction = 0.996;
const puckMaxSpeed = 900;
const blowForce = 3120;
const bounceBoost = 2;
const sideStates = {
  left: {
    inhaleState: 'ready',
    inhaleCooldownStart: 0,
    inhaleActiveStart: 0,
    inhaleAccumulatedMs: 0,
    inhaleConsumed: false,
    canBlow: false,
    blowActive: false,
    blowStart: 0,
    blowStrength: 0,
    mouthOpen: false,
    faceCenter: null,
    faceRadius: 0,
    mouthLeft: null,
    mouthRight: null,
    mouthUpper: null,
    mouthLower: null,
  },
  right: {
    inhaleState: 'ready',
    inhaleCooldownStart: 0,
    inhaleActiveStart: 0,
    inhaleAccumulatedMs: 0,
    inhaleConsumed: false,
    canBlow: false,
    blowActive: false,
    blowStart: 0,
    blowStrength: 0,
    mouthOpen: false,
    faceCenter: null,
    faceRadius: 0,
    mouthLeft: null,
    mouthRight: null,
    mouthUpper: null,
    mouthLower: null,
  },
};
const bombs = [];
const explosions = [];
const smokes = [];
const poopMarks = [];
let scoreLeft = 0;
let scoreRight = 0;
let gameOver = false;
let gameStarted = false;
const bombTimers = {
  topLeft: -bombCornerCooldownMs,
  topRight: -bombCornerCooldownMs,
  bottomLeft: -bombCornerCooldownMs,
  bottomRight: -bombCornerCooldownMs,
};
let lastBombSpawn = 0;

const LEFT_EYE = [33, 160, 158, 133, 153, 144];
const RIGHT_EYE = [362, 385, 387, 263, 373, 380];
const MOUTH_UPPER = 13;
const MOUTH_LOWER = 14;
const MOUTH_LEFT = 78;
const MOUTH_RIGHT = 308;
const FACE_OUTLINE = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];

function setStartButtonReady(isReady) {
  if (!startGameBtn) return;
  startGameBtn.disabled = !isReady;
  startGameBtn.classList.toggle('is-ready', isReady);
}

function addPoopMark(side, faceCenter, faceRadius) {
  const angle = Math.random() * Math.PI * 2;
  const r = faceRadius * (0.15 + Math.random() * 0.3);
  const dx = Math.cos(angle) * r;
  const dy = Math.sin(angle) * r;
  poopMarks.push({
    side,
    dx,
    dy,
    size: faceRadius * (0.22 + Math.random() * 0.12),
  });
  if (poopMarks.length > 8) poopMarks.shift();
}

function drawPoopMarks(landmarks, side) {
  if (!poopSprite.complete || poopSprite.naturalWidth === 0) return;
  const centerPoint = landmarks[1];
  const faceTop = landmarks[10];
  const faceBottom = landmarks[152];
  if (!centerPoint || !faceTop || !faceBottom) return;
  const center = toPixel(centerPoint);
  const topPx = toPixel(faceTop);
  const bottomPx = toPixel(faceBottom);
  if (!center || !topPx || !bottomPx) return;
  const radius = Math.hypot(
    topPx.x - bottomPx.x,
    topPx.y - bottomPx.y
  ) / 2;
  poopMarks.forEach((mark) => {
    if (mark.side !== side) return;
    const x = center.x + mark.dx;
    const y = center.y + mark.dy;
    const size = mark.size;
    ctx.drawImage(poopSprite, x - size / 2, y - size / 2, size, size);
  });
}

function updateScoreboard() {
  if (scoreLeftEl) scoreLeftEl.textContent = `${scoreLeft}`;
  if (scoreRightEl) scoreRightEl.textContent = `${scoreRight}`;
}

function showWinner(text) {
  if (winText) winText.textContent = text;
  if (winOverlay) {
    winOverlay.classList.add('is-visible');
    winOverlay.setAttribute('aria-hidden', 'false');
  }
}

function resetPuck() {
  puck.x = overlay.width / 2 || 0;
  puck.y = overlay.height / 2 || 0;
  puck.vx = 0;
  puck.vy = 0;
  puck.ready = true;
}

function updateSideBars(state, cooldownEl, inhaleEl, hasFace) {
  if (!cooldownEl || !inhaleEl) return;
  if (!hasFace) {
    cooldownEl.style.width = '0%';
    inhaleEl.style.width = '0%';
    return;
  }
  if (state.inhaleState === 'cooldown') {
    const elapsed = performance.now() - state.inhaleCooldownStart;
    const progress = Math.min(elapsed / inhaleCooldownMs, 1);
    cooldownEl.style.width = `${Math.round(progress * 100)}%`;
  } else if (state.inhaleState === 'ready') {
    cooldownEl.style.width = '100%';
  } else {
    cooldownEl.style.width = '0%';
  }

  if (state.inhaleState === 'active') {
    const progress = Math.min(state.inhaleAccumulatedMs / inhaleTriggerMs, 1);
    inhaleEl.style.width = `${Math.round(progress * 100)}%`;
  } else {
    inhaleEl.style.width = `${Math.round((state.inhaleAccumulatedMs / inhaleTriggerMs) * 100)}%`;
  }
}

function setStatus(text, isActive = false) {
  statusEl.textContent = text;
  statusEl.style.whiteSpace = 'pre-line';
  statusEl.style.borderColor = isActive
    ? 'rgba(56, 189, 248, 0.8)'
    : 'rgba(56, 189, 248, 0.2)';
  statusEl.style.boxShadow = isActive
    ? '0 0 18px rgba(56, 189, 248, 0.35)'
    : 'none';
}

function fitCanvasToVideo() {
  const { videoWidth, videoHeight } = video;
  if (!videoWidth || !videoHeight) return;
  const sizeChanged = overlay.width !== videoWidth || overlay.height !== videoHeight;
  if (overlay.width !== videoWidth) overlay.width = videoWidth;
  if (overlay.height !== videoHeight) overlay.height = videoHeight;
  if (threeCanvas) {
    if (threeCanvas.width !== videoWidth) threeCanvas.width = videoWidth;
    if (threeCanvas.height !== videoHeight) threeCanvas.height = videoHeight;
    if (threeRenderer) {
      threeRenderer.setSize(videoWidth, videoHeight, false);
    }
    if (threeCamera) {
      threeCamera.left = 0;
      threeCamera.right = videoWidth;
      threeCamera.top = 0;
      threeCamera.bottom = videoHeight;
      threeCamera.updateProjectionMatrix();
    }
  }
  if (sizeChanged) {
    // no-op
  }
}

function clearOverlay() {
  ctx.clearRect(0, 0, overlay.width, overlay.height);
}

function toPixel(point) {
  if (!point || !overlay.width || !overlay.height) return null;
  return {
    x: point.x * overlay.width,
    y: point.y * overlay.height,
  };
}

function initThree() {
  if (!threeCanvas || !window.THREE) return;
  threeRenderer = new THREE.WebGLRenderer({
    canvas: threeCanvas,
    alpha: true,
    antialias: true,
  });
  threeRenderer.setPixelRatio(window.devicePixelRatio || 1);
  threeRenderer.setSize(overlay.width || 1, overlay.height || 1, false);
  threeScene = new THREE.Scene();
  threeCamera = new THREE.OrthographicCamera(0, overlay.width || 1, overlay.height || 1, 0, -1000, 1000);
  const ambient = new THREE.AmbientLight(0xffffff, 0.9);
  const dir = new THREE.DirectionalLight(0xffffff, 0.6);
  dir.position.set(0, -1, 1);
  threeScene.add(ambient, dir);

  if (!THREE.GLTFLoader) return;
  const loader = new THREE.GLTFLoader();
  loader.load('assets/3d_poop_emoji.glb', (gltf) => {
    const base = gltf.scene;
    base.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = false;
        node.receiveShadow = false;
      }
    });
    threeModels = [base.clone(true), base.clone(true)];
    threeModels.forEach((model) => {
      model.visible = false;
      model.scale.set(0.7, 0.7, 0.7);
      threeScene.add(model);
    });
    threeReady = true;
  });
}

function updateFaceModel(index, landmarks) {
  if (!threeReady || !threeModels[index]) return;
  const model = threeModels[index];
  if (!landmarks || !overlay.width) {
    model.visible = false;
    return;
  }
  const centerPoint = landmarks[1];
  if (!centerPoint) {
    model.visible = false;
    return;
  }
  const center = toPixel(centerPoint);
  model.visible = true;
  model.position.set(center.x, center.y, 0);

  const left = landmarks[234];
  const right = landmarks[454];
  const top = landmarks[10];
  const chin = landmarks[152];
  if (left && right && top && chin) {
    const lx = right.x - left.x;
    const ly = right.y - left.y;
    const lz = right.z - left.z;
    const ux = top.x - chin.x;
    const uy = top.y - chin.y;
    const uz = top.z - chin.z;
    let xLen = Math.hypot(lx, ly, lz) || 1;
    let uxLen = Math.hypot(ux, uy, uz) || 1;
    const xAxis = { x: lx / xLen, y: ly / xLen, z: lz / xLen };
    const yAxis = { x: ux / uxLen, y: uy / uxLen, z: uz / uxLen };
    const zAxis = {
      x: xAxis.y * yAxis.z - xAxis.z * yAxis.y,
      y: xAxis.z * yAxis.x - xAxis.x * yAxis.z,
      z: xAxis.x * yAxis.y - xAxis.y * yAxis.x,
    };
    const m = new THREE.Matrix4();
    m.makeBasis(
      new THREE.Vector3(xAxis.x, xAxis.y, xAxis.z),
      new THREE.Vector3(yAxis.x, yAxis.y, yAxis.z),
      new THREE.Vector3(zAxis.x, zAxis.y, zAxis.z)
    );
    model.quaternion.setFromRotationMatrix(m);
  }
}

function getEyeOpenness(landmarks, indices) {
  const p1 = toPixel(landmarks[indices[0]]);
  const p2 = toPixel(landmarks[indices[1]]);
  const p3 = toPixel(landmarks[indices[2]]);
  const p4 = toPixel(landmarks[indices[3]]);
  const p5 = toPixel(landmarks[indices[4]]);
  const p6 = toPixel(landmarks[indices[5]]);
  if (!p1 || !p2 || !p3 || !p4 || !p5 || !p6) return 0;

  const vertical = Math.hypot(p2.x - p5.x, p2.y - p5.y) + Math.hypot(p3.x - p6.x, p3.y - p6.y);
  const horizontal = Math.hypot(p1.x - p4.x, p1.y - p4.y);
  return vertical / Math.max(horizontal, 0.001);
}

function getMouthOpenness(landmarks) {
  const upper = toPixel(landmarks[MOUTH_UPPER]);
  const lower = toPixel(landmarks[MOUTH_LOWER]);
  const left = toPixel(landmarks[MOUTH_LEFT]);
  const right = toPixel(landmarks[MOUTH_RIGHT]);
  if (!upper || !lower || !left || !right) return 0;

  const vertical = Math.hypot(upper.x - lower.x, upper.y - lower.y);
  const horizontal = Math.hypot(left.x - right.x, left.y - right.y);
  return vertical / Math.max(horizontal, 0.001);
}

function getMouthWidthRatio(landmarks) {
  const left = toPixel(landmarks[MOUTH_LEFT]);
  const right = toPixel(landmarks[MOUTH_RIGHT]);
  const faceLeft = toPixel(landmarks[234]);
  const faceRight = toPixel(landmarks[454]);
  if (!left || !right || !faceLeft || !faceRight) return 0;
  const mouthWidth = Math.hypot(left.x - right.x, left.y - right.y);
  const faceWidth = Math.hypot(faceLeft.x - faceRight.x, faceLeft.y - faceRight.y);
  return mouthWidth / Math.max(faceWidth, 0.001);
}

function getLipGapRatio(landmarks) {
  const upper = toPixel(landmarks[MOUTH_UPPER]);
  const lower = toPixel(landmarks[MOUTH_LOWER]);
  const faceTop = toPixel(landmarks[10]);
  const faceBottom = toPixel(landmarks[152]);
  if (!upper || !lower || !faceTop || !faceBottom) return 0;
  const lipGap = Math.hypot(upper.x - lower.x, upper.y - lower.y);
  const faceHeight = Math.hypot(faceTop.x - faceBottom.x, faceTop.y - faceBottom.y);
  return lipGap / Math.max(faceHeight, 0.001);
}

function drawPath(points, close = false) {
  if (!points.length) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  if (close) ctx.closePath();
}

function drawMask(landmarks, fillColor = 'rgba(0, 0, 0, 0)') {
  const outline = FACE_OUTLINE.map((index) => toPixel(landmarks[index]));
  if (outline.some((pt) => !pt)) return;
  drawPath(outline, true);
  const canDrawTexture = useFaceTexture && faceTexture.complete && faceTexture.naturalWidth > 0;
  if (canDrawTexture) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    outline.forEach((pt) => {
      if (pt.x < minX) minX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y > maxY) maxY = pt.y;
    });
    ctx.save();
    ctx.clip();
    ctx.drawImage(faceTexture, minX, minY, maxX - minX, maxY - minY);
    ctx.restore();
  } else {
    ctx.fillStyle = fillColor;
    ctx.fill();
  }
  // No face border when fully transparent.

  const leftEye = LEFT_EYE.map((index) => toPixel(landmarks[index]));
  const rightEye = RIGHT_EYE.map((index) => toPixel(landmarks[index]));

  // Eyes outline disabled for full transparency.
}

function getMouthDirection(landmarks) {
  const upperLip = toPixel(landmarks[MOUTH_UPPER]);
  const lowerLip = toPixel(landmarks[MOUTH_LOWER]);
  if (!upperLip || !lowerLip) {
    return { mouthCenter: { x: overlay.width / 2 || 0, y: overlay.height / 2 || 0 }, dirX: 0, dirY: -1, nz: 0 };
  }
  const mouthCenter = {
    x: (upperLip.x + lowerLip.x) / 2,
    y: (upperLip.y + lowerLip.y) / 2,
  };

  const left = landmarks[234];
  const right = landmarks[454];
  const top = landmarks[10];
  const chin = landmarks[152];
  if (!left || !right || !top || !chin) {
    return { mouthCenter, dirX: 0, dirY: -1, nz: 0 };
  }

  const vx = right.x - left.x;
  const vy = right.y - left.y;
  const vz = right.z - left.z;
  const wx = top.x - chin.x;
  const wy = top.y - chin.y;
  const wz = top.z - chin.z;

  let nx = vy * wz - vz * wy;
  let ny = vz * wx - vx * wz;
  let nz = vx * wy - vy * wx;
  const len = Math.hypot(nx, ny, nz) || 1;
  nx /= len;
  ny /= len;
  nz /= len;

  if (nz > 0) {
    nx *= -1;
    ny *= -1;
    nz *= -1;
  }

  return { mouthCenter, dirX: nx, dirY: ny, nz };
}

function drawMouthDirection(landmarks) {
  const { mouthCenter, dirX, dirY, nz } = getMouthDirection(landmarks);
  const length = 90 + Math.min(30, Math.abs(nz) * 60);
  const endX = mouthCenter.x + dirX * length;
  const endY = mouthCenter.y + dirY * length;

  ctx.save();
  ctx.strokeStyle = 'rgba(248, 250, 252, 0.9)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(mouthCenter.x, mouthCenter.y);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  const angle = Math.atan2(endY - mouthCenter.y, endX - mouthCenter.x);
  const headLen = 10;
  ctx.beginPath();
  ctx.moveTo(endX, endY);
  ctx.lineTo(endX - headLen * Math.cos(angle - Math.PI / 6), endY - headLen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(endX - headLen * Math.cos(angle + Math.PI / 6), endY - headLen * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fillStyle = 'rgba(56, 189, 248, 0.9)';
  ctx.fill();
  ctx.restore();
}



function spawnShockwave(x, y) {
  shockwaves.push({
    x,
    y,
    bornAt: performance.now(),
    life: 900,
    radius: 20 + Math.random() * 10,
    speed: 180 + Math.random() * 40,
    alpha: 0.55 + Math.random() * 0.25,
  });
}
function spawnInhaleParticle(x, y) {
  inhaleParticles.push({
    x: x + (Math.random() - 0.5) * 200,
    y: y + (Math.random() - 0.5) * 140,
    vx: 0,
    vy: 0,
    life: 900 + Math.random() * 700,
    bornAt: performance.now(),
    size: 3 + Math.random() * 3,
    alpha: 0.45 + Math.random() * 0.35,
    jitter: (Math.random() - 0.5) * 0.25,
    angle: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.08,
  });
}

function updateAndDrawInhaleParticles(deltaMs, target) {
  if (inhaleParticles.length === 0) return;
  for (let i = inhaleParticles.length - 1; i >= 0; i -= 1) {
    const p = inhaleParticles[i];
    const age = performance.now() - p.bornAt;
    const t = Math.min(Math.max(age / p.life, 0), 1);
    const dx = target.x - p.x;
    const dy = target.y - p.y;
    const dist = Math.max(10, Math.hypot(dx, dy));
    const accel = 0.0022 * deltaMs;
    p.vx += (dx / dist) * accel * 140;
    p.vy += (dy / dist) * accel * 140;
    p.angle += p.spin * deltaMs;
    const swirlStrength = Math.max(0, 1 - dist / 220);
    p.vx += Math.cos(p.angle) * swirlStrength * 0.9;
    p.vy += Math.sin(p.angle) * swirlStrength * 0.9;
    p.x += p.vx * (deltaMs / 16);
    p.y += p.vy * (deltaMs / 16);
    p.x += p.jitter * deltaMs;
    p.y += p.jitter * deltaMs * 0.6;

    ctx.save();
    const fade = p.alpha * (1 - t);
    ctx.globalAlpha = fade;
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.9)';
    ctx.lineWidth = Math.max(1, p.size * 0.45);
    ctx.beginPath();
    ctx.moveTo(p.x - p.vx * 0.12, p.y - p.vy * 0.12);
    ctx.lineTo(p.x + p.vx * 0.2, p.y + p.vy * 0.2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(203, 213, 225, 0.8)';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (t >= 1 || dist < 8) {
      inhaleParticles.splice(i, 1);
    }
  }
}

function drawCycloneEffect(center, deltaMs) {
  cyclonePhase += deltaMs * 0.002;
  const maxRadius = 140;
  const rings = 3;

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';

  for (let r = 1; r <= rings; r += 1) {
    const radius = (maxRadius / rings) * r * 0.9;
    const swirl = cyclonePhase * (1.2 + r * 0.2);
    ctx.strokeStyle = `rgba(148, 163, 184, ${0.25 - r * 0.05})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let a = 0; a <= Math.PI * 2 + 0.2; a += 0.2) {
      const warp = Math.sin(a * 3 + swirl) * 6;
      const rr = radius + warp;
      const x = center.x + Math.cos(a + swirl * 0.6) * rr;
      const y = center.y + Math.sin(a + swirl * 0.6) * rr;
      if (a === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }

  for (let i = 0; i < 12; i += 1) {
    const angle = cyclonePhase * 2 + i * 0.5;
    const radius = maxRadius * (0.4 + (i % 4) * 0.15);
    const x = center.x + Math.cos(angle) * radius;
    const y = center.y + Math.sin(angle) * radius;
    ctx.fillStyle = 'rgba(226, 232, 240, 0.6)';
    ctx.beginPath();
    ctx.arc(x, y, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawPlayerLabel(text, x, y, color) {
  const scale = 3;
  const paddingX = 10 * scale;
  const paddingY = 6 * scale;
  ctx.save();
  ctx.font = `${14 * scale}px "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif`;
  const textWidth = ctx.measureText(text).width;
  const width = textWidth + paddingX * 2;
  const height = 24 * scale;
  const labelX = x - width / 2;
  const labelY = y - height - 18;

  ctx.scale(-1, 1);
  const mirrorX = -labelX - width;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(mirrorX, labelY, width, height, 8);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, mirrorX + paddingX, labelY + height - paddingY);
  ctx.restore();
}

function drawShockwave(wave, t) {
  const radius = wave.radius + wave.speed * t;
  const fade = wave.alpha * (1 - t);
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.strokeStyle = 'rgba(226, 232, 240, 0.9)';
  ctx.lineWidth = Math.max(1.5, 6 * (1 - t));
  ctx.beginPath();
  ctx.arc(wave.x, wave.y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = fade * 0.6;
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.8)';
  ctx.lineWidth = Math.max(1, 3 * (1 - t));
  ctx.beginPath();
  ctx.arc(wave.x, wave.y, radius * 0.65, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawGoalZones() {
  if (!overlay.width || !overlay.height) return;
  const centers = [
    { x: overlay.width * 0.25, y: overlay.height },
    { x: overlay.width * 0.75, y: overlay.height },
  ];
  ctx.save();
  ctx.strokeStyle = '#000000';
  ctx.fillStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.9;
  centers.forEach((center) => {
    ctx.beginPath();
    ctx.ellipse(center.x, center.y, goalRadiusX, goalRadiusY, 0, Math.PI, 0, false);
    ctx.fill();
    ctx.stroke();
  });
  ctx.restore();
}

function puckInGoal(centerX) {
  const cx = centerX;
  const cy = overlay.height;
  const dx = puck.x - cx;
  const dy = puck.y - cy;
  if (puck.y < cy - goalRadiusY || puck.y > cy) return false;
  return (dx * dx) / (goalRadiusX * goalRadiusX) + (dy * dy) / (goalRadiusY * goalRadiusY) <= 1;
}

function handleGoals() {
  if (gameOver) return;
  const leftGoalX = overlay.width * 0.25;
  const rightGoalX = overlay.width * 0.75;
  if (puckInGoal(leftGoalX)) {
    scoreRight += 1;
    updateScoreboard();
    resetPuck();
  } else if (puckInGoal(rightGoalX)) {
    scoreLeft += 1;
    updateScoreboard();
    resetPuck();
  }
  if (scoreLeft >= goalScoreLimit || scoreRight >= goalScoreLimit) {
    gameOver = true;
    const winner = scoreLeft >= goalScoreLimit ? 'P2' : 'P1';
    showWinner(`${winner} 胜利`);
  }
}

function distancePointToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const abLenSq = abx * abx + aby * aby || 1;
  let t = (apx * abx + apy * aby) / abLenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + abx * t;
  const cy = ay + aby * t;
  return Math.hypot(px - cx, py - cy);
}

function ensurePuckPosition() {
  if (!gameStarted) return;
  if (puck.ready && overlay.width && overlay.height) return;
  puck.x = overlay.width / 2 || 0;
  puck.y = overlay.height / 2 || 0;
  puck.vx = 0;
  puck.vy = 0;
  puck.ready = true;
}

function applyPuckForce(dir, strength, deltaMs) {
  if (gameOver || !gameStarted) return;
  if (!dir) return;
  const len = Math.hypot(dir.x, dir.y) || 1;
  const nx = dir.x / len;
  const ny = dir.y / len;
  const accel = (strength * deltaMs * 2) / 1000;
  puck.vx += nx * accel;
  puck.vy += ny * accel;
}

function updatePuck(deltaMs) {
  if (gameOver) return;
  ensurePuckPosition();
  const dt = deltaMs / 1000;
  puck.vx *= puckFriction;
  puck.vy *= puckFriction;
  const speed = Math.hypot(puck.vx, puck.vy);
  if (speed > puckMaxSpeed) {
    const scale = puckMaxSpeed / speed;
    puck.vx *= scale;
    puck.vy *= scale;
  }
  puck.x += puck.vx * dt;
  puck.y += puck.vy * dt;

  const minX = puck.radius;
  const maxX = overlay.width - puck.radius;
  const minY = puck.radius;
  const maxY = overlay.height - puck.radius;

  if (puck.x <= minX) {
    puck.x = minX;
    puck.vx = Math.abs(puck.vx) * bounceBoost;
  } else if (puck.x >= maxX) {
    puck.x = maxX;
    puck.vx = -Math.abs(puck.vx) * bounceBoost;
  }

  if (puck.y <= minY) {
    puck.y = minY;
    puck.vy = Math.abs(puck.vy) * bounceBoost;
  } else if (puck.y >= maxY) {
    puck.y = maxY;
    puck.vy = -Math.abs(puck.vy) * bounceBoost;
  }
}

function reflectPuck(nx, ny) {
  const dot = puck.vx * nx + puck.vy * ny;
  if (dot < 0) {
    puck.vx -= 2 * dot * nx;
    puck.vy -= 2 * dot * ny;
    puck.vx *= bounceBoost;
    puck.vy *= bounceBoost;
  }
}

function handlePuckCollisions() {
  if (!puck.ready) return;

  for (let i = bombs.length - 1; i >= 0; i -= 1) {
    const bomb = bombs[i];
    const dx = puck.x - bomb.x;
    const dy = puck.y - bomb.y;
    const dist = Math.hypot(dx, dy) || 0.0001;
    const minDist = puck.radius + bombRadius;
    if (dist <= minDist) {
      const nx = dx / dist;
      const ny = dy / dist;
      puck.x = bomb.x + nx * minDist;
      puck.y = bomb.y + ny * minDist;
      reflectPuck(nx, ny);
      spawnExplosion(bomb.x, bomb.y);
      bombs.splice(i, 1);
    }
  }

  const players = [sideStates.left, sideStates.right];
  players.forEach((player) => {
    if (!player.faceCenter || !player.faceRadius) return;
    const dx = puck.x - player.faceCenter.x;
    const dy = puck.y - player.faceCenter.y;
    const dist = Math.hypot(dx, dy) || 0.0001;
    const faceHitRadius = player.faceRadius * 0.7;
    const minDist = puck.radius + faceHitRadius;
    if (dist <= minDist) {
      const nx = dx / dist;
      const ny = dy / dist;
      puck.x = player.faceCenter.x + nx * minDist;
      puck.y = player.faceCenter.y + ny * minDist;
      reflectPuck(nx, ny);
    }
  });
}

function drawPuck() {
  ctx.save();
  ctx.fillStyle = '#ef4444';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(puck.x, puck.y, puck.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function updateAndDrawShockwaves() {
  if (shockwaves.length === 0) return;
  const now = performance.now();
  for (let i = shockwaves.length - 1; i >= 0; i -= 1) {
    const wave = shockwaves[i];
    const t = Math.min(Math.max((now - wave.bornAt) / wave.life, 0), 1);
    drawShockwave(wave, t);
    if (t >= 1) {
      shockwaves.splice(i, 1);
    }
  }
}

function spawnExplosion(x, y) {
  explosions.push({
    x,
    y,
    bornAt: performance.now(),
    life: 420,
    frameCount: 9,
    cols: 3,
    rows: 3,
    scale: 1.5,
  });
  smokes.push({
    x: x + (Math.random() - 0.5) * 18,
    y: y + (Math.random() - 0.5) * 18,
    bornAt: performance.now(),
    life: 1100,
    frameCount: 25,
    cols: 5,
    rows: 5,
    scale: 2.2,
    driftX: (Math.random() - 0.5) * 26,
    driftY: -20 - Math.random() * 18,
  });
}

function spawnBomb(x, y, angle) {
  bombs.push({
    x,
    y,
    vx: Math.cos(angle) * bombSpeed,
    vy: Math.sin(angle) * bombSpeed,
  });
}

function spawnBombsIfNeeded(now) {
  if (now - lastBombSpawn < bombSpawnIntervalMs) return;
  const dueCorners = [];
  if (now - bombTimers.topLeft >= bombCornerCooldownMs) {
    dueCorners.push('topLeft');
  }
  if (now - bombTimers.topRight >= bombCornerCooldownMs) {
    dueCorners.push('topRight');
  }
  if (now - bombTimers.bottomLeft >= bombCornerCooldownMs) {
    dueCorners.push('bottomLeft');
  }
  if (now - bombTimers.bottomRight >= bombCornerCooldownMs) {
    dueCorners.push('bottomRight');
  }
  if (dueCorners.length === 0) return;
  const corner = dueCorners[Math.floor(Math.random() * dueCorners.length)];
  let spawnX = 0;
  let spawnY = 0;
  if (corner === 'topRight') {
    spawnX = overlay.width;
    spawnY = 0;
  } else if (corner === 'bottomLeft') {
    spawnX = 0;
    spawnY = overlay.height;
  } else if (corner === 'bottomRight') {
    spawnX = overlay.width;
    spawnY = overlay.height;
  }
  bombTimers[corner] = now;
  lastBombSpawn = now;
  const centerX = overlay.width / 2;
  const centerY = overlay.height / 2;
  const baseAngle = Math.atan2(centerY - spawnY, centerX - spawnX);
  const offset = ((Math.random() * 40) - 20) * (Math.PI / 180);
  spawnBomb(spawnX, spawnY, baseAngle + offset);
}

function updateBombs(deltaMs) {
  if (bombs.length === 0) return;
  const dt = deltaMs / 1000;
  for (let i = bombs.length - 1; i >= 0; i -= 1) {
    const bomb = bombs[i];
    const targets = [sideStates.left, sideStates.right];
    targets.forEach((player) => {
      if (!player.mouthOpen || !player.mouthLeft || !player.mouthRight) return;
      const center = {
        x: (player.mouthLeft.x + player.mouthRight.x) / 2,
        y: (player.mouthLeft.y + player.mouthRight.y) / 2,
      };
      const dx = center.x - bomb.x;
      const dy = center.y - bomb.y;
      const dist = Math.hypot(dx, dy);
      if (dist > bombSuctionRadius) return;
      const safeDist = Math.max(8, dist);
      const baseForce = (bombSuctionStrength * bombInhaleBoost) / (safeDist * safeDist);
      const force = Math.max(baseForce, bombSuctionMinForce);
      bomb.vx += (dx / safeDist) * force * dt;
      bomb.vy += (dy / safeDist) * force * dt;
    });

    bomb.vy += bombGravity * dt;
    bomb.vx *= bombDrag;
    bomb.vy *= bombDrag;
    bomb.x += bomb.vx * dt;
    bomb.y += bomb.vy * dt;

    let absorbedBy = null;
    const leftMouth = sideStates.left;
    const rightMouth = sideStates.right;
    const checkLipHit = (player) => {
      if (!player.mouthOpen) return false;
      const { mouthLeft, mouthRight, mouthUpper, mouthLower } = player;
      if (!mouthLeft || !mouthRight || !mouthUpper || !mouthLower) return false;
      const mouthWidth = Math.hypot(mouthLeft.x - mouthRight.x, mouthLeft.y - mouthRight.y);
      const lipHitRadius = Math.max(bombLipHitRadiusBase, mouthWidth * 0.06);
      const lipPoints = [mouthLeft, mouthUpper, mouthRight, mouthLower, mouthLeft];
      for (let j = 0; j < lipPoints.length - 1; j += 1) {
        const a = lipPoints[j];
        const b = lipPoints[j + 1];
        if (distancePointToSegment(bomb.x, bomb.y, a.x, a.y, b.x, b.y) <= lipHitRadius) {
          return true;
        }
      }
      return false;
    };
    if (checkLipHit(leftMouth)) absorbedBy = 'left';
    if (!absorbedBy && checkLipHit(rightMouth)) absorbedBy = 'right';

    if (absorbedBy) {
      spawnExplosion(
        sideStates[absorbedBy].mouthCenter.x,
        sideStates[absorbedBy].mouthCenter.y
      );
      if (sideStates[absorbedBy].faceCenter && sideStates[absorbedBy].faceRadius) {
        addPoopMark(
          absorbedBy,
          sideStates[absorbedBy].faceCenter,
          sideStates[absorbedBy].faceRadius
        );
      }
      bombs.splice(i, 1);
      continue;
    }

    if (
      bomb.x < -bombExpireMargin ||
      bomb.x > overlay.width + bombExpireMargin ||
      bomb.y < -bombExpireMargin ||
      bomb.y > overlay.height + bombExpireMargin
    ) {
      bombs.splice(i, 1);
    }
  }
}

function drawBombs() {
  if (bombs.length === 0) return;
  ctx.save();
  const canDrawSprite = bombSprite.complete && bombSprite.naturalWidth > 0;
  if (!canDrawSprite) {
    ctx.fillStyle = '#f97316';
  }
  bombs.forEach((bomb) => {
    if (canDrawSprite) {
      const size = bombRadius * 2;
      ctx.drawImage(
        bombSprite,
        bomb.x - size / 2,
        bomb.y - size / 2,
        size,
        size
      );
    } else {
      ctx.beginPath();
      ctx.arc(bomb.x, bomb.y, bombRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  ctx.restore();
}

function drawExplosions() {
  const now = performance.now();
  const canDrawExplosion = explosionSprite.complete && explosionSprite.naturalWidth > 0;
  const canDrawSmoke = smokeSprite.complete && smokeSprite.naturalWidth > 0;

  if (canDrawExplosion && explosions.length > 0) {
    for (let i = explosions.length - 1; i >= 0; i -= 1) {
      const ex = explosions[i];
      const t = Math.min(Math.max((now - ex.bornAt) / ex.life, 0), 1);
      const frame = Math.min(ex.frameCount - 1, Math.floor(t * ex.frameCount));
      const frameW = explosionSprite.naturalWidth / ex.cols;
      const frameH = explosionSprite.naturalHeight / ex.rows;
      const sx = (frame % ex.cols) * frameW;
      const sy = Math.floor(frame / ex.cols) * frameH;
      const size = 80 * ex.scale;
      ctx.save();
      ctx.globalAlpha = 1 - t * 0.4;
      ctx.drawImage(
        explosionSprite,
        sx,
        sy,
        frameW,
        frameH,
        ex.x - size / 2,
        ex.y - size / 2,
        size,
        size
      );
      ctx.restore();
      if (t >= 1) {
        explosions.splice(i, 1);
      }
    }
  }

  if (canDrawSmoke && smokes.length > 0) {
    for (let i = smokes.length - 1; i >= 0; i -= 1) {
      const ex = smokes[i];
      const t = Math.min(Math.max((now - ex.bornAt) / ex.life, 0), 1);
      const frame = Math.min(ex.frameCount - 1, Math.floor(t * ex.frameCount));
      const frameW = smokeSprite.naturalWidth / ex.cols;
      const frameH = smokeSprite.naturalHeight / ex.rows;
      const sx = (frame % ex.cols) * frameW;
      const sy = Math.floor(frame / ex.cols) * frameH;
      const size = 120 * ex.scale;
      const driftX = ex.driftX * t;
      const driftY = ex.driftY * t;
      ctx.save();
      ctx.globalAlpha = (1 - t) * 0.75;
      ctx.drawImage(
        smokeSprite,
        sx,
        sy,
        frameW,
        frameH,
        ex.x - size / 2 + driftX,
        ex.y - size / 2 + driftY,
        size,
        size
      );
      ctx.restore();
      if (t >= 1) {
        smokes.splice(i, 1);
      }
    }
  }

  if (!canDrawExplosion && explosions.length > 0) {
    explosions.length = 0;
  }
  if (!canDrawSmoke && smokes.length > 0) {
    smokes.length = 0;
  }
}

function getFaceActionInfo(landmarks) {
  const leftEyeOpen = getEyeOpenness(landmarks, LEFT_EYE);
  const rightEyeOpen = getEyeOpenness(landmarks, RIGHT_EYE);
  const mouthOpen = getMouthOpenness(landmarks);
  const mouthWidthRatio = getMouthWidthRatio(landmarks);
  const lipGapRatio = getLipGapRatio(landmarks);
  const faceDepth = Math.abs(landmarks[1]?.z ?? 0);

  const eyeOpenThreshold = 0.78;
  const mouthOpenThreshold = 0.28;
  const tongueThreshold = 0.38;
  const blowWidthMax = 0.28;
  const lipGapMax = 0.12;

  const leftEyeState = leftEyeOpen > eyeOpenThreshold ? '睁开' : '闭眼';
  const rightEyeState = rightEyeOpen > eyeOpenThreshold ? '睁开' : '闭眼';
  const eyesClosed = leftEyeOpen <= eyeOpenThreshold && rightEyeOpen <= eyeOpenThreshold;
  const mouthState = mouthOpen > mouthOpenThreshold ? '张开' : '闭合';
  const tongueState = mouthOpen > tongueThreshold ? '伸舌头(推测)' : '未伸舌头';
  const blowState = (mouthWidthRatio < blowWidthMax && lipGapRatio < lipGapMax)
    ? '吹气(推测)'
    : '未吹气';

  const { mouthCenter, dirX, dirY } = getMouthDirection(landmarks);
  const mouthLeft = toPixel(landmarks[MOUTH_LEFT]);
  const mouthRight = toPixel(landmarks[MOUTH_RIGHT]);
  const mouthUpper = toPixel(landmarks[MOUTH_UPPER]);
  const mouthLower = toPixel(landmarks[MOUTH_LOWER]);

  return {
    leftEyeState,
    rightEyeState,
    eyesClosed,
    mouthState,
    tongueState,
    blowState,
    leftEyeOpen,
    rightEyeOpen,
    mouthWidthRatio,
    lipGapRatio,
    mouthCenter,
    mouthLeft,
    mouthRight,
    mouthUpper,
    mouthLower,
    mouthDir: { x: dirX, y: dirY },
    mouthOpen,
    faceDepth,
  };
}

async function setupFaceMesh() {
  setStatus('正在加载 FaceMesh 模型...');

  const faceMesh = new FaceMesh({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
  });
  faceMeshInstance = faceMesh;

  const applyFaceMeshOptions = () => {
    faceMesh.setOptions({
      maxNumFaces: maxFaces,
      refineLandmarks: true,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });
  };
  applyFaceMeshOptions();

  faceMesh.onResults((results) => {
    const now = performance.now();
    const deltaMs = Math.min(now - lastFrameTime, 40);
    lastFrameTime = now;

    fitCanvasToVideo();
    clearOverlay();
    if (!overlay || overlay.width === 0 || overlay.height === 0) {
      setStartButtonReady(false);
      updateSideBars(sideStates.left, cooldownFillLeft, inhaleFillLeft, false);
      updateSideBars(sideStates.right, cooldownFillRight, inhaleFillRight, false);
      setStatus('画面尺寸未准备好');
      return;
    }

    let hadBlow = false;
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
      const faces = results.multiFaceLandmarks.slice(0, maxFaces);
      const midX = overlay.width / 2;
      const sidePresence = { left: false, right: false };
      let leftCount = 0;
      let rightCount = 0;
      let statusParts = [];
      faces.forEach((landmarks, index) => {
        const centerPoint = landmarks[1];
        const center = centerPoint ? toPixel(centerPoint) : null;
        const side = center && center.x < midX ? 'left' : 'right';
        const player = sideStates[side];
        updateFaceModel(index, landmarks);
        if (center) {
          if (side === 'left') {
            leftCount += 1;
          } else {
            rightCount += 1;
          }
          sidePresence[side] = true;
        }
        const actionInfo = getFaceActionInfo(landmarks);
        player.mouthCenter = actionInfo.mouthCenter;
        player.mouthOpen = actionInfo.mouthOpen > 0.28;
        player.mouthLeft = actionInfo.mouthLeft;
        player.mouthRight = actionInfo.mouthRight;
        player.mouthUpper = actionInfo.mouthUpper;
        player.mouthLower = actionInfo.mouthLower;
        player.mouthCornerMid = actionInfo.mouthCornerMid;
        const faceCenterPoint = landmarks[1];
        if (faceCenterPoint) {
          player.faceCenter = toPixel(faceCenterPoint);
          const faceTop = toPixel(landmarks[10]);
          const faceBottom = toPixel(landmarks[152]);
          if (player.faceCenter && faceTop && faceBottom) {
            player.faceRadius = Math.hypot(faceTop.x - faceBottom.x, faceTop.y - faceBottom.y) / 2;
          } else {
            player.faceRadius = 0;
          }
        } else {
          player.faceCenter = null;
          player.faceRadius = 0;
        }
        drawMask(landmarks);
        drawPoopMarks(landmarks, side);
        drawMouthDirection(landmarks);
        if (player.blowActive && now - player.blowStart > blowWindowMs) {
          player.canBlow = false;
          player.blowActive = false;
          player.inhaleConsumed = false;
        }
        const mouthIsOpen = actionInfo.mouthOpen > 0.28;
        const state = faceState[index] || { mouthClosedAt: 0, longMouthClosed: false };
        faceState[index] = state;

        if (!mouthIsOpen) {
          if (!state.mouthClosedAt) {
            state.mouthClosedAt = now;
          }
          state.longMouthClosed = now - state.mouthClosedAt >= longMouthClosedMs;
        } else {
          state.mouthClosedAt = 0;
          state.longMouthClosed = false;
        }

        const headTop = toPixel(landmarks[10]);
        const label = side === 'left' ? 'P2' : 'P1';
        const labelColor = side === 'left' ? '#dc2626' : '#2563eb';
        if (headTop) {
          drawPlayerLabel(label, headTop.x, headTop.y, labelColor);
        }
        if (player.inhaleState === 'ready' && mouthIsOpen) {
          player.inhaleState = 'active';
          player.inhaleActiveStart = now;
          player.inhaleConsumed = false;
        }

        if (player.inhaleState === 'active') {
          player.inhaleAccumulatedMs = Math.min(player.inhaleAccumulatedMs + deltaMs, inhaleTriggerMs);
          if (player.inhaleAccumulatedMs >= inhaleTriggerMs) {
            player.canBlow = true;
          }
          drawCycloneEffect(actionInfo.mouthCenter, deltaMs);
          for (let i = 0; i < 3; i += 1) {
            spawnInhaleParticle(actionInfo.mouthCenter.x, actionInfo.mouthCenter.y);
          }
          updateAndDrawInhaleParticles(deltaMs, actionInfo.mouthCenter);
          if (!mouthIsOpen) {
            player.inhaleState = 'cooldown';
            player.inhaleCooldownStart = now;
            player.blowActive = false;
          }
        } else if (player.inhaleState === 'cooldown') {
          const elapsed = now - player.inhaleCooldownStart;
          if (elapsed >= inhaleCooldownMs) {
            player.inhaleState = 'ready';
          }
        }

        if (player.canBlow && actionInfo.blowState === '吹气(推测)') {
          if (!player.blowActive) {
            player.blowActive = true;
            player.blowStart = now;
            const chargeRatio = Math.min(player.inhaleAccumulatedMs / inhaleTriggerMs, 1);
            player.blowStrength = blowForce * chargeRatio;
          }
          if (now - player.blowStart <= blowWindowMs) {
            if (!player.inhaleConsumed) {
              player.inhaleAccumulatedMs = 0;
              player.inhaleConsumed = true;
            }
            applyPuckForce(actionInfo.mouthDir, player.blowStrength, deltaMs);
            hadBlow = true;
            spawnShockwave(
              actionInfo.mouthCenter.x + (Math.random() - 0.5) * 4,
              actionInfo.mouthCenter.y + (Math.random() - 0.5) * 4
            );
          } else {
            player.canBlow = false;
            player.blowActive = false;
            player.inhaleConsumed = false;
            player.blowStrength = 0;
          }
        } else {
          player.blowActive = false;
          player.blowStrength = 0;
        }
        const blowStatus = actionInfo.blowState === '吹气(推测)' ? '吹气' : '未吹气';
        statusParts.push(
          `人脸${index + 1}: 眼睛${actionInfo.eyesClosed ? '闭合' : '非闭合'} / ` +
          `长闭口${state.longMouthClosed ? '是' : '否'} / ` +
          `${actionInfo.tongueState} / ${blowStatus} / 距离${actionInfo.faceDepth.toFixed(3)}`
        );
      });
      const canStart = faces.length >= 2 && leftCount >= 1 && rightCount >= 1;
      setStartButtonReady(canStart);
      updateSideBars(sideStates.left, cooldownFillRight, inhaleFillRight, sidePresence.left);
      updateSideBars(sideStates.right, cooldownFillLeft, inhaleFillLeft, sidePresence.right);
      setStatus(`检测到人脸：\n${statusParts.join('\n')}`, true);
      if (threeRenderer && threeScene && threeCamera) {
        threeRenderer.render(threeScene, threeCamera);
      }
    } else {
      setStartButtonReady(false);
      updateSideBars(sideStates.left, cooldownFillRight, inhaleFillRight, false);
      updateSideBars(sideStates.right, cooldownFillLeft, inhaleFillLeft, false);
      setStatus('未检测到脸部');
      if (threeModels.length) {
        threeModels.forEach((model) => {
          model.visible = false;
        });
      }
      if (threeRenderer && threeScene && threeCamera) {
        threeRenderer.render(threeScene, threeCamera);
      }
    }

    drawGoalZones();
    if (gameStarted) {
      if (!gameOver) {
        spawnBombsIfNeeded(now);
        updateBombs(deltaMs);
      }
      drawBombs();
      drawExplosions();
      updatePuck(deltaMs);
      handlePuckCollisions();
      handleGoals();
      drawPuck();
    }

    updateAndDrawShockwaves();
    const anyInhaleActive = sideStates.left.inhaleState === 'active' || sideStates.right.inhaleState === 'active';
    if (!anyInhaleActive) {
      updateAndDrawInhaleParticles(deltaMs, { x: overlay.width / 2, y: overlay.height / 2 });
    }
  });

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 1280, height: 720 },
    audio: false,
  });

  video.srcObject = stream;
  await video.play();

  setStatus('摄像头已启动，等待检测...');

  let isProcessing = false;
  const processFrame = async () => {
    if (!video.videoWidth || !video.videoHeight) {
      requestAnimationFrame(processFrame);
      return;
    }

    if (isProcessing) {
      requestAnimationFrame(processFrame);
      return;
    }

    isProcessing = true;
    try {
      await faceMesh.send({ image: video });
    } catch (error) {
      console.error('FaceMesh error:', error);
    } finally {
      isProcessing = false;
      requestAnimationFrame(processFrame);
    }
  };

  requestAnimationFrame(processFrame);
}

async function init() {
  updateScoreboard();
  initThree();
  if (startGameBtn) {
    startGameBtn.addEventListener('click', () => {
      gameStarted = true;
      puck.ready = false;
      bgm.currentTime = 0;
      bgm.volume = 0.7;
      bgm.play().catch(() => {});
    });
  }
  if (restartBtn) {
    restartBtn.addEventListener('click', () => {
      window.location.reload();
    });
  }
  try {
    await setupFaceMesh();
  } catch (error) {
    console.error(error);
    setStatus('摄像头或模型加载失败，请检查权限或网络');
  }
}

init();

faceCountInputs.forEach((input) => {
  input.addEventListener('change', () => {
    const value = Number(input.value);
    if (Number.isNaN(value)) return;
    maxFaces = Math.min(Math.max(value, 1), 2);
    if (faceMeshInstance) {
      faceMeshInstance.setOptions({
        maxNumFaces: maxFaces,
        refineLandmarks: true,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.6,
      });
    }
  });
});

if (bgToggle) {
  const applyBgToggle = () => {
    video.style.visibility = bgToggle.checked ? 'visible' : 'hidden';
  };
  applyBgToggle();
  bgToggle.addEventListener('change', applyBgToggle);
}


