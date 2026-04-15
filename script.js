// ============================================================
//  DEMO WORLD: POWER CLIMB — script.js
//  Whirlybird-inspired platform jumper, browser-based
// ============================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ── Canvas size matches wrapper ──────────────────────────────
const W = 380, H = 620;
canvas.width = W;
canvas.height = H;

// ── DOM refs ─────────────────────────────────────────────────
const scoreEl   = document.getElementById('score');
const levelEl   = document.getElementById('level');
const livesEl   = document.getElementById('lives');
const startScr  = document.getElementById('start-screen');
const gameoverScr = document.getElementById('gameover-screen');
const winScr    = document.getElementById('win-screen');
const finalScoreEl = document.getElementById('final-score');
const bestScoreEl  = document.getElementById('best-score');
const winScoreEl   = document.getElementById('win-score');

document.getElementById('start-btn').onclick   = startGame;
document.getElementById('restart-btn').onclick  = startGame;
document.getElementById('winrestart-btn').onclick = startGame;

// ── Constants ────────────────────────────────────────────────
const GRAVITY       = 0.35;
const JUMP_FORCE    = -11;
const BOOST_FORCE   = -16;
const PLAYER_SPEED  = 4.5;
const PLATFORM_W    = 70;
const PLATFORM_H    = 14;
const PLATFORM_GAP  = 90;   // vertical spacing between platforms
const SCORE_PER_PX  = 0.05;
const LEVELS        = [
  { name: "Town Hall",    bgColor: '#1a1a2e', platforms: 10, maxMoving: 0, maxBreaking: 0 },
  { name: "City Square",  bgColor: '#16213e', platforms: 12, maxMoving: 2, maxBreaking: 1 },
  { name: "Parliament",   bgColor: '#0f3460', platforms: 14, maxMoving: 4, maxBreaking: 2 },
  { name: "Power Tower",  bgColor: '#1b1b2f', platforms: 16, maxMoving: 6, maxBreaking: 4 },
  { name: "Summit",       bgColor: '#2c003e', platforms: 18, maxMoving: 8, maxBreaking: 6 },
];

// ── Game State ───────────────────────────────────────────────
let state, player, platforms, particles, score, lives,
    cameraY, scrollSpeed, levelIndex, bgColor,
    keys, bestScore = 0, animId, movingDir = {};

// ── Asset loading (graceful — falls back to canvas drawing) ──
const assets = {};
function loadImg(key, src) {
  const img = new Image();
  img.src = src;
  img.onload = () => { assets[key] = img; };
}
loadImg('player',   'assets/images/player.png');
loadImg('platform', 'assets/images/platform.png');

// ── Sounds (Web Audio API, offline-safe) ─────────────────────
let audioCtx;
function getAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function playTone(freq, type, duration, vol = 0.15) {
  try {
    const ac = getAudio();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain); gain.connect(ac.destination);
    osc.type = type; osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
    osc.start(); osc.stop(ac.currentTime + duration);
  } catch(e) {}
}
const sfx = {
  jump:  () => playTone(320, 'square', 0.12, 0.18),
  boost: () => { playTone(500, 'square', 0.08, 0.2); playTone(700, 'square', 0.12, 0.2); },
  break: () => playTone(180, 'sawtooth', 0.2, 0.12),
  score: () => playTone(880, 'sine', 0.15, 0.1),
  die:   () => { playTone(200, 'sawtooth', 0.3, 0.2); },
  win:   () => { [523,659,784,1047].forEach((f,i)=> setTimeout(()=>playTone(f,'sine',0.3,0.2),i*120)); }
};

// ── Player ───────────────────────────────────────────────────
function makePlayer() {
  return {
    x: W / 2 - 18,
    y: H - 200,
    w: 36, h: 48,
    vx: 0, vy: 0,
    onGround: false,
    facing: 1,       // 1 = right, -1 = left
    frame: 0,        // animation frame
    frameTimer: 0,
    invincible: 0,    // frames of invincibility after hit
    boosted: false,
  };
}

// ── Platform ─────────────────────────────────────────────────
// types: 'normal' | 'moving' | 'breaking' | 'boost'
function makePlatform(x, y, type = 'normal') {
  return {
    x, y,
    w: PLATFORM_W, h: PLATFORM_H,
    type,
    broken: false,
    breakTimer: 0,
    // moving
    dir: Math.random() > 0.5 ? 1 : -1,
    speed: 1.2 + Math.random() * 1.2,
    minX: 10, maxX: W - PLATFORM_W - 10,
  };
}

function generatePlatforms(count, topY, lvl) {
  const plats = [];
  // Always put a safe platform directly under player at start
  plats.push(makePlatform(W/2 - PLATFORM_W/2, H - 120, 'normal'));

  for (let i = 1; i < count; i++) {
    const y = topY - i * PLATFORM_GAP + rand(-20, 20);
    const x = rand(10, W - PLATFORM_W - 10);
    let type = 'normal';
    const roll = Math.random();
    const movingChance = lvl.maxMoving / lvl.platforms;
    const breakChance  = lvl.maxBreaking / lvl.platforms;
    if (roll < breakChance * 0.4) type = 'breaking';
    else if (roll < breakChance * 0.4 + movingChance * 0.5) type = 'moving';
    else if (roll < breakChance * 0.4 + movingChance * 0.5 + 0.05) type = 'boost';
    plats.push(makePlatform(x, y, type));
  }
  return plats;
}

// ── Particles ────────────────────────────────────────────────
function spawnParticles(x, y, color, n = 8) {
  for (let i = 0; i < n; i++) {
    particles.push({
      x, y,
      vx: rand(-3, 3), vy: rand(-4, -0.5),
      life: 1, decay: 0.04 + Math.random() * 0.03,
      size: rand(3, 7),
      color
    });
  }
}

// ── INIT ─────────────────────────────────────────────────────
function startGame() {
  showScreen(null);
  levelIndex = 0;
  score = 0; lives = 3;
  cameraY = 0;
  scrollSpeed = 0;
  particles = [];
  keys = {};
  player = makePlayer();
  const lvl = LEVELS[levelIndex];
  bgColor = lvl.bgColor;
  platforms = generatePlatforms(lvl.platforms, H - 120, lvl);
  movingDir = {};
  updateHUD();
  cancelAnimationFrame(animId);
  state = 'playing';
  loop();
}

function nextLevel() {
  levelIndex++;
  if (levelIndex >= LEVELS.length) { endGame(true); return; }
  const lvl = LEVELS[levelIndex];
  bgColor = lvl.bgColor;
  // Add new platforms above current top
  const topY = Math.min(...platforms.map(p=>p.y));
  platforms.push(...generatePlatforms(lvl.platforms, topY, lvl));
  updateHUD();
}

// ── GAME LOOP ────────────────────────────────────────────────
function loop() {
  if (state !== 'playing') return;
  update();
  draw();
  animId = requestAnimationFrame(loop);
}

function update() {
  handleInput();
  updatePlayer();
  updatePlatforms();
  updateParticles();
  updateCamera();
  updateScore();
  checkLevel();
}

function handleInput() {
  const left  = keys['ArrowLeft']  || keys['a'] || keys['A'];
  const right = keys['ArrowRight'] || keys['d'] || keys['D'];
  player.vx = right ? PLAYER_SPEED : left ? -PLAYER_SPEED : 0;
  if (right) player.facing = 1;
  if (left)  player.facing = -1;
}

function updatePlayer() {
  // Gravity
  player.vy += GRAVITY;
  player.y  += player.vy;
  player.x  += player.vx;

  // Wrap horizontally
  if (player.x + player.w < 0) player.x = W;
  if (player.x > W)            player.x = -player.w;

  // Platform collision (only when falling)
  if (player.vy > 0 && player.invincible <= 0) {
    for (const p of platforms) {
      if (p.broken) continue;
      if (
        player.x + player.w - 6 > p.x &&
        player.x + 6 < p.x + p.w &&
        player.y + player.h > p.y &&
        player.y + player.h < p.y + p.h + 14
      ) {
        landOn(p);
        break;
      }
    }
  }

  // Animate
  player.frameTimer++;
  if (player.frameTimer > 8) { player.frame ^= 1; player.frameTimer = 0; }

  // Invincibility countdown
  if (player.invincible > 0) player.invincible--;

  // Fell below screen → lose life
  if (player.y - cameraY > H + 50) {
    loseLife();
  }
}

function landOn(plat) {
  player.y = plat.y - player.h;
  player.onGround = true;

  if (plat.type === 'boost') {
    player.vy = BOOST_FORCE;
    player.boosted = true;
    sfx.boost();
    spawnParticles(player.x + player.w/2, player.y + player.h, '#00e676', 12);
  } else {
    player.vy = JUMP_FORCE;
    player.boosted = false;
    sfx.jump();
    spawnParticles(player.x + player.w/2, player.y + player.h, '#4a9eff', 6);
  }

  if (plat.type === 'breaking') {
    plat.breakTimer = 20; // frames before it disappears
    sfx.break();
  }
}

function loseLife() {
  lives--;
  sfx.die();
  updateHUD();
  if (lives <= 0) { endGame(false); return; }
  // Respawn at a safe platform
  player.invincible = 60;
  const safePlat = platforms.filter(p => !p.broken && p.type === 'normal')
    .sort((a,b) => (a.y - cameraY) - (b.y - cameraY))
    .find(p => (p.y - cameraY) > 50 && (p.y - cameraY) < H - 50);
  if (safePlat) {
    player.x = safePlat.x + safePlat.w/2 - player.w/2;
    player.y = safePlat.y - player.h - 2;
  } else {
    player.y = cameraY + H/2;
  }
  player.vy = JUMP_FORCE;
  spawnParticles(player.x + player.w/2, player.y + player.h, '#e94560', 16);
}

function updatePlatforms() {
  for (const p of platforms) {
    if (p.type === 'moving') {
      p.x += p.speed * p.dir;
      if (p.x <= p.minX || p.x >= p.maxX) p.dir *= -1;
    }
    if (p.type === 'breaking' && p.breakTimer > 0) {
      p.breakTimer--;
      if (p.breakTimer <= 0) p.broken = true;
    }
  }
  // Remove broken & off-screen below
  platforms = platforms.filter(p => !(p.broken && p.y - cameraY > H + 100));

  // Spawn new platforms above if near top
  const topY = Math.min(...platforms.map(p => p.y));
  if (topY - cameraY > -200) {
    const lvl = LEVELS[levelIndex];
    for (let i = 0; i < 3; i++) {
      const y  = topY - (i + 1) * PLATFORM_GAP + rand(-15, 15);
      const x  = rand(10, W - PLATFORM_W - 10);
      const roll = Math.random();
      const mc = lvl.maxMoving / lvl.platforms;
      const bc = lvl.maxBreaking / lvl.platforms;
      let type = 'normal';
      if (roll < bc * 0.4) type = 'breaking';
      else if (roll < bc * 0.4 + mc * 0.5) type = 'moving';
      else if (roll < bc * 0.4 + mc * 0.5 + 0.05) type = 'boost';
      platforms.push(makePlatform(x, y, type));
    }
  }
}

function updateCamera() {
  // Camera follows player upward but never goes back down
  const targetY = player.y - H * 0.45;
  if (targetY < cameraY) cameraY = targetY;
}

function updateScore() {
  const newScore = Math.floor(-cameraY * SCORE_PER_PX);
  if (newScore > score) {
    score = newScore;
    if (score > bestScore) bestScore = score;
    scoreEl.textContent = score;
  }
}

function checkLevel() {
  const thresholds = [300, 700, 1200, 1800, 2600];
  if (levelIndex < LEVELS.length - 1 && score >= thresholds[levelIndex]) {
    nextLevel();
    sfx.score();
  }
}

function updateParticles() {
  for (const p of particles) {
    p.x += p.vx; p.y += p.vy;
    p.vy += 0.15;
    p.life -= p.decay;
  }
  particles = particles.filter(p => p.life > 0);
}

// ── DRAW ─────────────────────────────────────────────────────
function draw() {
  // Background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, W, H);

  // Subtle grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let y = 0; y < H; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  ctx.save();
  ctx.translate(0, -cameraY);

  // Platforms
  for (const p of platforms) drawPlatform(p);

  // Particles
  for (const p of particles) drawParticle(p);

  // Player
  drawPlayer();

  ctx.restore();

  // HUD overlay shimmer
  ctx.fillStyle = 'rgba(0,0,0,0)'; // transparent — HUD is DOM
}

function drawPlatform(p) {
  const screenY = p.y - cameraY;
  if (screenY < -30 || screenY > H + 30) return; // cull

  const colors = {
    normal:   '#4a9eff',
    moving:   '#ffd700',
    breaking: p.breakTimer > 0 ? `rgba(255,80,80,${0.5 + p.breakTimer/40})` : '#ff6b6b',
    boost:    '#00e676',
  };

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(p.x + 4, p.y + 5, p.w, p.h);

  // Platform body
  if (assets.platform && p.type === 'normal') {
    ctx.drawImage(assets.platform, p.x, p.y, p.w, p.h);
  } else {
    ctx.fillStyle = colors[p.type] || '#4a9eff';
    ctx.fillRect(p.x, p.y, p.w, p.h);

    // Pixel shine
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(p.x + 2, p.y + 2, p.w - 4, 3);

    // Bottom shadow strip
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(p.x + 2, p.y + p.h - 3, p.w - 4, 3);

    // Type icon
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    const icons = { moving: '↔', breaking: '💥', boost: '⬆', normal: '' };
    if (icons[p.type]) ctx.fillText(icons[p.type], p.x + p.w/2, p.y + 11);
  }
}

function drawPlayer() {
  const px = player.x, py = player.y;
  const w = player.w, h = player.h;

  if (player.invincible > 0 && Math.floor(player.invincible / 4) % 2 === 0) return; // flash

  if (assets.player) {
    ctx.save();
    if (player.facing === -1) {
      ctx.scale(-1, 1);
      ctx.translate(-W, 0);
      ctx.drawImage(assets.player, W - px - w, py, w, h);
    } else {
      ctx.drawImage(assets.player, px, py, w, h);
    }
    ctx.restore();
    return;
  }

  // CSS pixel-art political doodle character (fallback)
  ctx.save();
  if (player.facing === -1) {
    ctx.scale(-1, 1);
    ctx.translate(-(2 * px + w), 0);
  }

  // --- SUIT BODY ---
  ctx.fillStyle = '#2c3e50';
  ctx.fillRect(px + 6, py + 22, w - 12, h - 22);

  // Shirt collar / tie
  ctx.fillStyle = '#ecf0f1';
  ctx.fillRect(px + 13, py + 22, 10, 10);
  ctx.fillStyle = '#e74c3c'; // red tie
  ctx.fillRect(px + 16, py + 24, 5, 16);

  // Head
  ctx.fillStyle = '#f5cba7';
  ctx.fillRect(px + 8, py + 4, w - 16, 18);

  // Hair (iconic tuft)
  ctx.fillStyle = '#f1c40f';
  ctx.fillRect(px + 6, py + 2, w - 12, 5);
  ctx.fillRect(px + 4, py + 4, 5, 4);

  // Eyes
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(px + 11, py + 9, 4, 4);
  ctx.fillRect(px + 21, py + 9, 4, 4);
  ctx.fillStyle = '#fff';
  ctx.fillRect(px + 12, py + 10, 2, 2);
  ctx.fillRect(px + 22, py + 10, 2, 2);

  // Mouth
  ctx.fillStyle = '#c0392b';
  ctx.fillRect(px + 12, py + 16, 12, 3);

  // Arms
  ctx.fillStyle = '#2c3e50';
  const armY = py + 24 + (player.frame === 0 ? 0 : 2);
  ctx.fillRect(px + 1, armY, 6, 14);
  ctx.fillRect(px + w - 7, armY, 6, 14);

  // Hands
  ctx.fillStyle = '#f5cba7';
  ctx.fillRect(px + 1, armY + 12, 6, 6);
  ctx.fillRect(px + w - 7, armY + 12, 6, 6);

  // Legs
  ctx.fillStyle = '#1a1a2e';
  const legBob = player.frame === 0 ? 0 : 3;
  ctx.fillRect(px + 8, py + h - 16, 8, 10 + legBob);
  ctx.fillRect(px + w - 16, py + h - 16, 8, 10 - legBob);

  // Shoes
  ctx.fillStyle = '#2c2c2c';
  ctx.fillRect(px + 6, py + h - 6, 10, 6);
  ctx.fillRect(px + w - 16, py + h - 6, 10, 6);

  // Boost glow
  if (player.boosted) {
    ctx.strokeStyle = '#00e676';
    ctx.lineWidth = 2;
    ctx.strokeRect(px - 2, py - 2, w + 4, h + 4);
  }

  ctx.restore();
}

function drawParticle(p) {
  ctx.globalAlpha = p.life;
  ctx.fillStyle = p.color;
  ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
  ctx.globalAlpha = 1;
}

// ── END GAME ─────────────────────────────────────────────────
function endGame(won) {
  state = 'ended';
  cancelAnimationFrame(animId);
  if (won) {
    sfx.win();
    winScoreEl.textContent = score;
    showScreen('win-screen');
  } else {
    sfx.die();
    finalScoreEl.textContent = score;
    bestScoreEl.textContent  = bestScore;
    showScreen('gameover-screen');
  }
}

// ── SCREENS ──────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  if (id) document.getElementById(id)?.classList.add('active');
}

// Show start screen initially
showScreen('start-screen');

// ── INPUT ────────────────────────────────────────────────────
document.addEventListener('keydown', e => { keys[e.key] = true; });
document.addEventListener('keyup',   e => { keys[e.key] = false; });

// Mobile: touch left/right halves
canvas.addEventListener('touchstart', e => {
  for (const t of e.touches) {
    if (t.clientX < W / 2) keys['ArrowLeft']  = true;
    else                   keys['ArrowRight'] = true;
  }
}, { passive: true });
canvas.addEventListener('touchend', () => {
  keys['ArrowLeft'] = keys['ArrowRight'] = false;
}, { passive: true });

// ── UTILS ────────────────────────────────────────────────────
function rand(min, max) { return min + Math.random() * (max - min); }
function updateHUD() {
  scoreEl.textContent = score;
  levelEl.textContent = levelIndex + 1;
  livesEl.textContent = lives;
}