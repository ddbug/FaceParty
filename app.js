const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const statusEl = document.getElementById('status');
const faceCountInputs = document.querySelectorAll('input[name="faceCount"]');
const bgToggle = document.getElementById('bgToggle');
const startGameBtn = document.getElementById('startGameBtn');
const countdownEl = document.getElementById('countdown');
const scoreValueEl = document.getElementById('scoreValue');
const restartOverlay = document.getElementById('restartOverlay');
const restartBtn = document.getElementById('restartBtn');
const endBtn = document.getElementById('endBtn');
const maskCountEl = document.getElementById('maskCount');
let maxFaces = 1;

const ctx = overlay.getContext('2d');
let faceMeshInstance = null;
const shockwaves = [];
let lastFrameTime = performance.now();
const inhaleParticles = [];
const cooldownFill = document.getElementById('cooldownFill');
const inhaleFill = document.getElementById('inhaleFill');
const itemSprites = {
  burger: 'assets/items/burger.svg',
  bomb: 'assets/vfx/bomb_circle.png',
  poop: 'assets/items/poop.svg',
  mask: 'assets/items/mask_party.svg',
};
const itemImages = {};
const bgm = new Audio('assets/Candy Cloud Freefall.mp3');
bgm.loop = true;
const stainImage = new Image();
stainImage.src = 'assets/items/stain.svg';
const sootImage = new Image();
sootImage.src = 'assets/items/soot_smoke.svg';
const explosionSprite = new Image();
explosionSprite.src = 'assets/vfx/explosion_atlas_512x512.png';
const smokeSprite = new Image();
smokeSprite.src = 'assets/vfx/smoke_sheet.png';
const fallingItems = [];
const explosions = [];
const smokes = [];
let nextDropAt = 0;
let gameStarted = false;
let score = 0;
const roundDurationMs = 60000;
let roundEndAt = 0;
let roundStartAt = 0;
const itemGravity = 0;
const itemDrag = 0.999;
const itemBounce = 0.45;
const lastFaces = [];
const stains = [];
const soots = [];
const suctionStrength = 200000;
const suctionRadius = 10000;
const suctionKillRadius = 10;
const scoreTable = {
  poop: -10,
  burger: 10,
  mask: 80,
  bomb: -50,
};
let masksSpawned = 0;
let masksCollected = 0;
const maskTargetCount = 5;
let maskSchedule = [];
let nextMaskIndex = 0;
let nextMaskAt = 0;
const inhaleCooldownMs = 3000;
let inhaleState = 'ready';
let inhaleCooldownStart = 0;
let cyclonePhase = 0;
const blowWindowMs = 2000;
let canBlow = false;
let blowActive = false;
let blowStart = 0;
let inhaleActiveStart = 0;
let inhaleAccumulatedMs = 0;
const inhaleTriggerMs = 1000;
let inhaleConsumed = false;
const blowInfos = [];
const blowPushStrength = 120000;
const blowPushRadius = 260;
const longMouthClosedMs = 1500;
const faceState = [
  { mouthClosedAt: 0, longMouthClosed: false },
  { mouthClosedAt: 0, longMouthClosed: false },
];

const LEFT_EYE = [33, 160, 158, 133, 153, 144];
const RIGHT_EYE = [362, 385, 387, 263, 373, 380];
const MOUTH_UPPER = 13;
const MOUTH_LOWER = 14;
const MOUTH_LEFT = 78;
const MOUTH_RIGHT = 308;
const FACE_OUTLINE = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];

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

function setStartButtonReady(isReady) {
  if (!startGameBtn) return;
  startGameBtn.disabled = !isReady;
  startGameBtn.classList.toggle('is-ready', isReady);
}

function setScore(value) {
  score = value;
  if (scoreValueEl) {
    const text = Math.max(0, score).toString().padStart(4, '0');
    scoreValueEl.textContent = text;
  }
}

function updateMaskCount() {
  if (maskCountEl) {
    maskCountEl.textContent = `${masksCollected}/${maskTargetCount}`;
  }
}

function buildMaskSchedule() {
  const cuts = [];
  for (let i = 0; i < 5; i += 1) {
    cuts.push(Math.random());
  }
  cuts.sort((a, b) => a - b);
  const points = [0, ...cuts, 1];
  const intervals = [];
  for (let i = 1; i < points.length; i += 1) {
    intervals.push((points[i] - points[i - 1]) * roundDurationMs);
  }
  const times = [];
  let acc = 0;
  for (let i = 0; i < maskTargetCount; i += 1) {
    acc += intervals[i];
    times.push(acc);
  }
  maskSchedule = times;
  nextMaskIndex = 0;
  nextMaskAt = roundStartAt + (maskSchedule[0] || roundDurationMs);
}

function updateCountdown(now) {
  if (!countdownEl) return;
  if (!gameStarted) {
    countdownEl.textContent = '01:00';
    return;
  }
  const remaining = Math.max(0, roundEndAt - now);
  const totalSeconds = Math.ceil(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  countdownEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function endRound() {
  gameStarted = false;
  if (!bgm.paused) {
    bgm.pause();
  }
  if (restartOverlay) {
    restartOverlay.classList.add('is-visible');
    restartOverlay.setAttribute('aria-hidden', 'false');
  }
}

function loadItemImages() {
  Object.entries(itemSprites).forEach(([key, src]) => {
    const img = new Image();
    img.src = src;
    itemImages[key] = img;
  });
}

function addStain(faceIndex, faceCenter, faceRadius, hitX, hitY) {
  const dx = (hitX - faceCenter.x) / Math.max(faceRadius, 1);
  const dy = (hitY - faceCenter.y) / Math.max(faceRadius, 1);
  stains.push({
    faceIndex,
    dx,
    dy,
    size: faceRadius * (0.28 + Math.random() * 0.12),
  });
  if (stains.length > 12) {
    stains.shift();
  }
}

function addSoot(faceIndex, faceCenter, faceRadius, hitX, hitY) {
  const dx = (hitX - faceCenter.x) / Math.max(faceRadius, 1);
  const dy = (hitY - faceCenter.y) / Math.max(faceRadius, 1);
  soots.push({
    faceIndex,
    dx,
    dy,
    size: faceRadius * (0.45 + Math.random() * 0.2),
  });
  if (soots.length > 10) {
    soots.shift();
  }
}

function drawStains(landmarks, faceIndex) {
  if (!stainImage.complete || stainImage.naturalWidth === 0) return;
  const faceCenterPoint = landmarks[1];
  const faceTop = landmarks[10];
  const faceBottom = landmarks[152];
  if (!faceCenterPoint || !faceTop || !faceBottom) return;
  const center = toPixel(faceCenterPoint);
  const radius = Math.hypot(
    toPixel(faceTop).x - toPixel(faceBottom).x,
    toPixel(faceTop).y - toPixel(faceBottom).y
  ) / 2;
  stains.forEach((stain) => {
    if (stain.faceIndex !== faceIndex) return;
    const x = center.x + stain.dx * radius;
    const y = center.y + stain.dy * radius;
    const size = stain.size;
    ctx.drawImage(stainImage, x - size / 2, y - size / 2, size, size);
  });
}

function drawSoots(landmarks, faceIndex) {
  if (!sootImage.complete || sootImage.naturalWidth === 0) return;
  const faceCenterPoint = landmarks[1];
  const faceTop = landmarks[10];
  const faceBottom = landmarks[152];
  if (!faceCenterPoint || !faceTop || !faceBottom) return;
  const center = toPixel(faceCenterPoint);
  const radius = Math.hypot(
    toPixel(faceTop).x - toPixel(faceBottom).x,
    toPixel(faceTop).y - toPixel(faceBottom).y
  ) / 2;
  ctx.save();
  ctx.globalAlpha = 0.7;
  ctx.globalCompositeOperation = 'multiply';
  soots.forEach((soot) => {
    if (soot.faceIndex !== faceIndex) return;
    const x = center.x + soot.dx * radius;
    const y = center.y + soot.dy * radius;
    const size = soot.size;
    ctx.drawImage(sootImage, x - size / 2, y - size / 2, size, size);
  });
  ctx.restore();
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
    scale: 1.2,
  });
  smokes.push({
    x: x + (Math.random() - 0.5) * 18,
    y: y + (Math.random() - 0.5) * 18,
    bornAt: performance.now(),
    life: 1100,
    frameCount: 25,
    cols: 5,
    rows: 5,
    scale: 1.8,
    driftX: (Math.random() - 0.5) * 26,
    driftY: -20 - Math.random() * 18,
  });
}

function drawExplosions() {
  const now = performance.now();
  const canDrawExplosion = explosionSprite.complete && explosionSprite.naturalWidth > 0;
  const canDrawSmoke = smokeSprite.complete && smokeSprite.naturalWidth > 0;

  if (canDrawExplosion) {
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

  if (canDrawSmoke) {
    for (let i = smokes.length - 1; i >= 0; i -= 1) {
      const ex = smokes[i];
      const t = Math.min(Math.max((now - ex.bornAt) / ex.life, 0), 1);
      const frame = Math.min(ex.frameCount - 1, Math.floor(t * ex.frameCount));
      const frameW = smokeSprite.naturalWidth / ex.cols;
      const frameH = smokeSprite.naturalHeight / ex.rows;
      const sx = (frame % ex.cols) * frameW;
      const sy = Math.floor(frame / ex.cols) * frameH;
      const size = 110 * ex.scale;
      const driftX = ex.driftX * t;
      const driftY = ex.driftY * t;
      ctx.save();
      ctx.globalAlpha = (1 - t) * 0.7;
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
}
function fitCanvasToVideo() {
  const { videoWidth, videoHeight } = video;
  if (!videoWidth || !videoHeight) return;
  const sizeChanged = overlay.width !== videoWidth || overlay.height !== videoHeight;
  if (overlay.width !== videoWidth) overlay.width = videoWidth;
  if (overlay.height !== videoHeight) overlay.height = videoHeight;
  if (sizeChanged) {
    // no-op
  }
}

function clearOverlay() {
  ctx.clearRect(0, 0, overlay.width, overlay.height);
}

function toPixel(point) {
  return {
    x: point.x * overlay.width,
    y: point.y * overlay.height,
  };
}

function getEyeOpenness(landmarks, indices) {
  const p1 = toPixel(landmarks[indices[0]]);
  const p2 = toPixel(landmarks[indices[1]]);
  const p3 = toPixel(landmarks[indices[2]]);
  const p4 = toPixel(landmarks[indices[3]]);
  const p5 = toPixel(landmarks[indices[4]]);
  const p6 = toPixel(landmarks[indices[5]]);

  const vertical = Math.hypot(p2.x - p5.x, p2.y - p5.y) + Math.hypot(p3.x - p6.x, p3.y - p6.y);
  const horizontal = Math.hypot(p1.x - p4.x, p1.y - p4.y);
  return vertical / Math.max(horizontal, 0.001);
}

function getMouthOpenness(landmarks) {
  const upper = toPixel(landmarks[MOUTH_UPPER]);
  const lower = toPixel(landmarks[MOUTH_LOWER]);
  const left = toPixel(landmarks[MOUTH_LEFT]);
  const right = toPixel(landmarks[MOUTH_RIGHT]);

  const vertical = Math.hypot(upper.x - lower.x, upper.y - lower.y);
  const horizontal = Math.hypot(left.x - right.x, left.y - right.y);
  return vertical / Math.max(horizontal, 0.001);
}

function getMouthWidthRatio(landmarks) {
  const left = toPixel(landmarks[MOUTH_LEFT]);
  const right = toPixel(landmarks[MOUTH_RIGHT]);
  const faceLeft = toPixel(landmarks[234]);
  const faceRight = toPixel(landmarks[454]);
  const mouthWidth = Math.hypot(left.x - right.x, left.y - right.y);
  const faceWidth = Math.hypot(faceLeft.x - faceRight.x, faceLeft.y - faceRight.y);
  return mouthWidth / Math.max(faceWidth, 0.001);
}

function getLipGapRatio(landmarks) {
  const upper = toPixel(landmarks[MOUTH_UPPER]);
  const lower = toPixel(landmarks[MOUTH_LOWER]);
  const faceTop = toPixel(landmarks[10]);
  const faceBottom = toPixel(landmarks[152]);
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

function drawMask(landmarks) {
  const outline = FACE_OUTLINE.map((index) => toPixel(landmarks[index]));
  drawPath(outline, true);
  ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
  ctx.lineWidth = 2;
  ctx.shadowColor = 'rgba(56, 189, 248, 0.65)';
  ctx.shadowBlur = 16;
  ctx.stroke();

  const leftEye = LEFT_EYE.map((index) => toPixel(landmarks[index]));
  const rightEye = RIGHT_EYE.map((index) => toPixel(landmarks[index]));

  ctx.save();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(226, 232, 240, 0.7)';
  drawPath(leftEye, true);
  ctx.stroke();
  drawPath(rightEye, true);
  ctx.stroke();
  ctx.restore();
}

function getMouthDirection(landmarks) {
  const upperLip = toPixel(landmarks[MOUTH_UPPER]);
  const lowerLip = toPixel(landmarks[MOUTH_LOWER]);
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

function getDropPoints() {
  const points = [];
  if (!overlay.width) return points;
  for (let i = 1; i <= 8; i += 1) {
    points.push((overlay.width * i) / 9);
  }
  return points;
}

function spawnFallingItem(now) {
  if (now < nextDropAt) return;
  const points = getDropPoints();
  if (points.length === 0) return;
  const x = points[Math.floor(Math.random() * points.length)];
  let type;
  if (nextMaskIndex < maskTargetCount && now >= nextMaskAt) {
    type = 'mask';
    masksSpawned += 1;
    nextMaskIndex += 1;
    nextMaskAt = roundStartAt + (maskSchedule[nextMaskIndex] || roundDurationMs);
  } else {
    const types = Object.keys(itemSprites).filter((key) => key !== 'mask');
    type = types[Math.floor(Math.random() * types.length)];
  }
  fallingItems.push({
    type,
    x,
    y: -20,
    vx: (Math.random() - 0.5) * 80,
    vy: 120 + Math.random() * 120,
    size: 48 + Math.random() * 20,
  });
  nextDropAt = now + 3000 + Math.random() * 2000;
}

function updateAndDrawFallingItems(deltaMs, now) {
  if (!gameStarted) return;
  if (now >= roundEndAt) {
    endRound();
    return;
  }
  spawnFallingItem(now);
  const dt = deltaMs / 1000;
  for (let i = fallingItems.length - 1; i >= 0; i -= 1) {
    const item = fallingItems[i];
    if (blowInfos.length > 0) {
      blowInfos.forEach((info) => {
        const dx = item.x - info.center.x;
        const dy = item.y - info.center.y;
        const dist = Math.hypot(dx, dy);
        if (dist > blowPushRadius) return;
        const falloff = 1 - dist / blowPushRadius;
        const force = blowPushStrength * falloff;
        item.vx += info.dir.x * force * dt;
        item.vy += info.dir.y * force * dt;
      });
    }
    item.vy += itemGravity * dt;
    item.vx *= itemDrag;
    item.vy *= itemDrag;
    item.x += item.vx * dt;
    item.y += item.vy * dt;
    if (item.x < item.size * 0.3) {
      item.x = item.size * 0.3;
      item.vx = Math.abs(item.vx) * itemBounce;
    } else if (item.x > overlay.width - item.size * 0.3) {
      item.x = overlay.width - item.size * 0.3;
      item.vx = -Math.abs(item.vx) * itemBounce;
    }

    let consumed = false;
    if (lastFaces.length > 0) {
      for (let f = 0; f < lastFaces.length; f += 1) {
        const face = lastFaces[f];
        if (!face || !face.mouthOpen || !face.mouthCornerMid) continue;
        const dx = face.mouthCornerMid.x - item.x;
        const dy = face.mouthCornerMid.y - item.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= suctionRadius) {
          const safeDist = Math.max(10, dist);
          const force = suctionStrength / safeDist;
          item.vx += (dx / safeDist) * force * dt;
          item.vy += (dy / safeDist) * force * dt;
        }
        if (face.mouthLeft && face.mouthRight && face.mouthUpper && face.mouthLower) {
          const mouthWidth = Math.hypot(
            face.mouthLeft.x - face.mouthRight.x,
            face.mouthLeft.y - face.mouthRight.y
          );
          const lipHitRadius = Math.max(12, mouthWidth * 0.06);
          const lipPoints = [
            face.mouthLeft,
            face.mouthUpper,
            face.mouthRight,
            face.mouthLower,
            face.mouthLeft,
          ];
          let lipHit = false;
          for (let j = 0; j < lipPoints.length - 1; j += 1) {
            const a = lipPoints[j];
            const b = lipPoints[j + 1];
            if (distancePointToSegment(item.x, item.y, a.x, a.y, b.x, b.y) <= lipHitRadius) {
              lipHit = true;
              break;
            }
          }
          if (!lipHit) {
            continue;
          }
        } else {
          continue;
        }
        {
          const delta = scoreTable[item.type] ?? 0;
          setScore(score + delta);
          if (item.type === 'mask') {
            masksCollected = Math.min(maskTargetCount, masksCollected + 1);
            updateMaskCount();
          }
          if (item.type === 'bomb') {
            spawnExplosion(item.x, item.y);
            addSoot(face.index, face.center, face.radius, item.x, item.y);
          }
          fallingItems.splice(i, 1);
          consumed = true;
          break;
        }
      }
    }
    if (consumed) {
      continue;
    }

    if (item.type === 'poop' && lastFaces.length > 0) {
      for (let f = 0; f < lastFaces.length; f += 1) {
        const face = lastFaces[f];
        if (!face) continue;
        const dx = item.x - face.center.x;
        const dy = item.y - face.center.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= face.radius * 0.55) {
          addStain(face.index, face.center, face.radius, item.x, item.y);
          fallingItems.splice(i, 1);
          break;
        }
      }
      if (i >= fallingItems.length) {
        continue;
      }
    }
    const img = itemImages[item.type];
    if (img && img.complete && img.naturalWidth > 0) {
      const size = item.size * 1.5;
      ctx.drawImage(img, item.x - size / 2, item.y - size / 2, size, size);
    } else {
      ctx.save();
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(item.x, item.y, item.size * 0.75, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (item.y - item.size > overlay.height + 40) {
      fallingItems.splice(i, 1);
    }
  }
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

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
      const faces = results.multiFaceLandmarks.slice(0, maxFaces);
      lastFaces.length = 0;
      blowInfos.length = 0;
      setStartButtonReady(true);
      let statusParts = [];
      faces.forEach((landmarks, index) => {
        const centerPoint = landmarks[1];
        const topPoint = landmarks[10];
        const bottomPoint = landmarks[152];
        const mouthLeft = landmarks[MOUTH_LEFT];
        const mouthRight = landmarks[MOUTH_RIGHT];
        const mouthUpper = landmarks[MOUTH_UPPER];
        const mouthLower = landmarks[MOUTH_LOWER];
        const mouthOpen = getMouthOpenness(landmarks) > 0.28;
        let mouthCornerMid = null;
        if (mouthLeft && mouthRight) {
          const left = toPixel(mouthLeft);
          const right = toPixel(mouthRight);
          mouthCornerMid = { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
        }
        if (centerPoint && topPoint && bottomPoint) {
          const center = toPixel(centerPoint);
          const top = toPixel(topPoint);
          const bottom = toPixel(bottomPoint);
          const radius = Math.hypot(top.x - bottom.x, top.y - bottom.y) / 2;
          lastFaces.push({
            index,
            center,
            radius,
            mouthOpen,
            mouthCornerMid,
            mouthLeft: mouthLeft ? toPixel(mouthLeft) : null,
            mouthRight: mouthRight ? toPixel(mouthRight) : null,
            mouthUpper: mouthUpper ? toPixel(mouthUpper) : null,
            mouthLower: mouthLower ? toPixel(mouthLower) : null,
          });
        }
        drawMask(landmarks);
        drawStains(landmarks, index);
        drawSoots(landmarks, index);
        drawMouthDirection(landmarks);
        const actionInfo = getFaceActionInfo(landmarks);
        if (blowActive && now - blowStart > blowWindowMs) {
          canBlow = false;
          blowActive = false;
          inhaleConsumed = false;
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
        drawPlayerLabel(index === 0 ? 'P1' : 'P2', headTop.x, headTop.y, index === 0 ? '#2563eb' : '#dc2626');
        inhaleState = mouthIsOpen ? 'active' : 'ready';
        if (inhaleState === 'active') {
          inhaleAccumulatedMs = Math.min(inhaleAccumulatedMs + deltaMs, inhaleTriggerMs);
          if (inhaleAccumulatedMs >= inhaleTriggerMs) {
            canBlow = true;
          }
          drawCycloneEffect(actionInfo.mouthCenter, deltaMs);
          for (let i = 0; i < 3; i += 1) {
            spawnInhaleParticle(actionInfo.mouthCenter.x, actionInfo.mouthCenter.y);
          }
          updateAndDrawInhaleParticles(deltaMs, actionInfo.mouthCenter);
        }

        if (canBlow && actionInfo.blowState === '吹气(推测)') {
          if (!blowActive) {
            blowActive = true;
            blowStart = now;
          }
          if (now - blowStart <= blowWindowMs) {
            if (!inhaleConsumed) {
              inhaleAccumulatedMs = 0;
              inhaleConsumed = true;
            }
            blowInfos.push({
              center: actionInfo.mouthCenter,
              dir: actionInfo.mouthDir,
            });
            spawnShockwave(
              actionInfo.mouthCenter.x + (Math.random() - 0.5) * 4,
              actionInfo.mouthCenter.y + (Math.random() - 0.5) * 4
            );
          } else {
            canBlow = false;
            blowActive = false;
            inhaleConsumed = false;
          }
        } else {
          blowActive = false;
        }
        const blowStatus = actionInfo.blowState === '吹气(推测)' ? '吹气' : '未吹气';
        statusParts.push(
          `人脸${index + 1}: 眼睛${actionInfo.eyesClosed ? '闭合' : '非闭合'} / ` +
          `长闭口${state.longMouthClosed ? '是' : '否'} / ` +
          `${actionInfo.tongueState} / ${blowStatus} / 距离${actionInfo.faceDepth.toFixed(3)}`
        );
      });
      setStatus(`检测到人脸：\n${statusParts.join('\n')}`, true);
    } else {
      lastFaces.length = 0;
      blowInfos.length = 0;
      setStartButtonReady(false);
      setStatus('未检测到脸部');
    }

    updateAndDrawShockwaves();
    updateCountdown(now);
    updateAndDrawFallingItems(deltaMs, now);
    drawExplosions();
    if (inhaleState !== 'active') {
      updateAndDrawInhaleParticles(deltaMs, { x: overlay.width / 2, y: overlay.height / 2 });
    }

    if (cooldownFill) {
      cooldownFill.style.width = '100%';
    }

    if (inhaleFill) {
      if (inhaleState === 'active') {
        const progress = Math.min(inhaleAccumulatedMs / inhaleTriggerMs, 1);
        inhaleFill.style.width = `${Math.round(progress * 100)}%`;
      } else {
        inhaleFill.style.width = `${Math.round((inhaleAccumulatedMs / inhaleTriggerMs) * 100)}%`;
      }
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
  loadItemImages();
  updateMaskCount();
  if (startGameBtn) {
    startGameBtn.addEventListener('click', () => {
      if (startGameBtn.disabled) return;
      gameStarted = true;
      fallingItems.length = 0;
      nextDropAt = performance.now() + 1000;
      roundStartAt = performance.now();
      roundEndAt = roundStartAt + roundDurationMs;
      setScore(0);
      masksCollected = 0;
      masksSpawned = 0;
      updateMaskCount();
      buildMaskSchedule();
      bgm.currentTime = 0;
      bgm.play().catch(() => {});
      if (restartOverlay) {
        restartOverlay.classList.remove('is-visible');
        restartOverlay.setAttribute('aria-hidden', 'true');
      }
    });
  }
  if (restartBtn) {
    restartBtn.addEventListener('click', () => {
      fallingItems.length = 0;
      stains.length = 0;
      soots.length = 0;
      setScore(0);
      gameStarted = true;
      roundStartAt = performance.now();
      roundEndAt = roundStartAt + roundDurationMs;
      nextDropAt = performance.now() + 1000;
      masksCollected = 0;
      masksSpawned = 0;
      updateMaskCount();
      buildMaskSchedule();
      bgm.currentTime = 0;
      bgm.play().catch(() => {});
      if (restartOverlay) {
        restartOverlay.classList.remove('is-visible');
        restartOverlay.setAttribute('aria-hidden', 'true');
      }
    });
  }
  if (endBtn) {
    endBtn.addEventListener('click', () => {
      gameStarted = false;
      fallingItems.length = 0;
      if (!bgm.paused) {
        bgm.pause();
      }
      if (restartOverlay) {
        restartOverlay.classList.remove('is-visible');
        restartOverlay.setAttribute('aria-hidden', 'true');
      }
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
