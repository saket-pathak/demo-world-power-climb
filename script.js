// ============================================================
// DEMO WORLD: POWER CLIMB
// COMPLETE LEVEL SYSTEM UPDATE
// Trump Theme + Mystery Island Endless Mode
// Paste into script.js
// ============================================================

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const W = 380;
const H = 620;

canvas.width = W;
canvas.height = H;

// ============================================================
// DOM
// ============================================================

const scoreEl = document.getElementById("score");
const levelEl = document.getElementById("level");
const livesEl = document.getElementById("lives");

const finalScoreEl = document.getElementById("final-score");
const bestScoreEl = document.getElementById("best-score");

const startScr = document.getElementById("start-screen");
const gameoverScr = document.getElementById("gameover-screen");

document.getElementById("start-btn").onclick = startGame;
document.getElementById("restart-btn").onclick = startGame;

// ============================================================
// AUDIO
// ============================================================

let audioCtx;

function getAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function playTone(freq, type, duration, vol = 0.15) {
  try {
    const ac = getAudio();

    const osc = ac.createOscillator();
    const gain = ac.createGain();

    osc.type = type;
    osc.frequency.value = freq;

    osc.connect(gain);
    gain.connect(ac.destination);

    gain.gain.setValueAtTime(vol, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      ac.currentTime + duration
    );

    osc.start();
    osc.stop(ac.currentTime + duration);
  } catch (e) {}
}

const sfx = {
  jump: () => playTone(320, "square", 0.12, 0.18),
  oil: () => playTone(700, "sine", 0.12, 0.18),
  die: () => playTone(180, "sawtooth", 0.35, 0.2),
  level: () => playTone(880, "triangle", 0.15, 0.18)
};

// ============================================================
// CONSTANTS
// ============================================================

const GRAVITY = 0.35;
const JUMP_FORCE = -11;
const PLAYER_SPEED = 4.5;

const PLATFORM_W = 70;
const PLATFORM_H = 14;
const PLATFORM_GAP = 90;

const SCORE_PER_PX = 0.05;

// ============================================================
// LEVEL DATA
// ============================================================

const levelNames = [
  "Trump Tower",
  "Mar-a-Lago",
  "Miami Rally",
  "Palm Beach",
  "Wall Street",
  "Washington Run",
  "Capitol Heights",
  "Air Force Rise",
  "Global Summit",
  "White House"
];

const endlessName = "Mystery Island";

// Progressive thresholds
const thresholds = [
  0,
  100,
  300,
  600,
  1000,
  1500,
  2100,
  2800,
  3600,
  4500
];

const bgColors = [
  "#1a1a2e",
  "#3b1f0b",
  "#ff4d6d",
  "#ff914d",
  "#14532d",
  "#1d3557",
  "#f8f9fa",
  "#4ea8de",
  "#5a189a",
  "#111111",
  "#2b003d"
];

// ============================================================
// STATE
// ============================================================

let state;
let player;
let platforms;
let oils;
let particles;
let popups;

let score = 0;
let bestScore = 0;
let level = 1;
let lastLevel = 1;
let lives = 3;

let cameraY = 0;
let keys = {};
let animId;
let bgColor = bgColors[0];

// ============================================================
// START GAME
// ============================================================

function startGame() {
  startScr.classList.remove("active");
  gameoverScr.classList.remove("active");

  score = 0;
  bestScore = bestScore || 0;
  level = 1;
  lastLevel = 1;
  lives = 3;
  cameraY = 0;
  bgColor = bgColors[0];

  platforms = [];
  oils = [];
  particles = [];
  popups = [];

  player = {
    x: W / 2 - 18,
    y: H - 200,
    w: 36,
    h: 48,
    vx: 0,
    vy: 0,
    frame: 0,
    timer: 0
  };

  generateInitialPlatforms();
  spawnOil(6);

  updateHUD();

  state = "playing";

  cancelAnimationFrame(animId);
  loop();
}

// ============================================================
// LOOP
// ============================================================

function loop() {
  if (state !== "playing") return;

  update();
  draw();

  animId = requestAnimationFrame(loop);
}

// ============================================================
// UPDATE
// ============================================================

function update() {
  handleInput();
  updatePlayer();
  updatePlatforms();
  updateOil();
  updateParticles();
  updatePopups();
  updateCamera();
  updateScore();
}

// ============================================================
// INPUT
// ============================================================

function handleInput() {
  const left = keys["ArrowLeft"] || keys["a"];
  const right = keys["ArrowRight"] || keys["d"];

  player.vx = 0;

  if (left) player.vx = -PLAYER_SPEED;
  if (right) player.vx = PLAYER_SPEED;
}

// ============================================================
// PLAYER
// ============================================================

function updatePlayer() {
  player.vy += GRAVITY + Math.max(0, (score - 4500) * 0.00004);

  player.x += player.vx;
  player.y += player.vy;

  if (player.x > W) player.x = -player.w;
  if (player.x + player.w < 0) player.x = W;

  if (player.vy > 0) {
    for (let p of platforms) {
      if (
        player.x + player.w > p.x &&
        player.x < p.x + p.w &&
        player.y + player.h > p.y &&
        player.y + player.h < p.y + p.h + 12
      ) {
        player.y = p.y - player.h;
        player.vy = JUMP_FORCE;
        sfx.jump();
        break;
      }
    }
  }

  if (player.y - cameraY > H + 60) loseLife();
}

// ============================================================
// LIFE
// ============================================================

function loseLife() {
  lives--;
  updateHUD();

  if (lives <= 0) {
    gameOver();
    return;
  }

  player.x = W / 2;
  player.y = cameraY + H / 2;
  player.vy = JUMP_FORCE;
}

// ============================================================
// CAMERA
// ============================================================

function updateCamera() {
  const targetY = player.y - H * 0.45;

  if (targetY < cameraY) cameraY = targetY;
}

// ============================================================
// SCORE + LEVELS
// ============================================================

function updateScore() {
  const climb = Math.floor(-cameraY * SCORE_PER_PX);

  if (climb > score) {
    score = climb;
  }

  level = 1;

  for (let i = 0; i < thresholds.length; i++) {
    if (score >= thresholds[i]) {
      level = i + 1;
    }
  }

  if (level > 10) level = 10;

  // level up detected
  if (level !== lastLevel) {
    sfx.level();

    if (level < 10) {
      showPopup(levelNames[level - 1], 90, cameraY + 250);
    } else {
      showPopup("WHITE HOUSE REACHED", 60, cameraY + 250);
      showPopup("MYSTERY ISLAND UNLOCKED", 40, cameraY + 290);
    }

    lastLevel = level;
  }

  // background update
  if (score < 4500) {
    bgColor = bgColors[level - 1];
  } else {
    bgColor = bgColors[10];
  }

  updateHUD();
}

// ============================================================
// HUD
// ============================================================

function updateHUD() {
  scoreEl.textContent = score;
  livesEl.textContent = lives;

  if (score < 4500) {
    levelEl.textContent =
      "LVL " + level + " - " + levelNames[level - 1];
  } else {
    levelEl.textContent =
      "LVL 10 - " + endlessName;
  }
}

// ============================================================
// PLATFORMS
// ============================================================

function generateInitialPlatforms() {
  for (let i = 0; i < 8; i++) {
    platforms.push({
      x: rand(10, W - PLATFORM_W - 10),
      y: H - i * PLATFORM_GAP,
      w: PLATFORM_W,
      h: PLATFORM_H
    });
  }
}

function updatePlatforms() {
  const topY = Math.min(...platforms.map(p => p.y));

  if (topY - cameraY > -200) {
    for (let i = 0; i < 3; i++) {
      platforms.push({
        x: rand(10, W - PLATFORM_W - 10),
        y: topY - (i + 1) * PLATFORM_GAP,
        w: PLATFORM_W,
        h: PLATFORM_H
      });
    }
  }

  platforms = platforms.filter(p => p.y - cameraY < H + 80);
}

// ============================================================
// OIL
// ============================================================

function spawnOil(count = 3) {
  for (let i = 0; i < count; i++) {
    oils.push({
      x: rand(20, W - 30),
      y: cameraY - rand(100, 700),
      w: 24,
      h: 28,
      value: Math.random() < 0.15 ? 20 : 5,
      golden: Math.random() < 0.15
    });
  }
}

function updateOil() {
  for (let i = oils.length - 1; i >= 0; i--) {
    const o = oils[i];

    if (
      player.x < o.x + o.w &&
      player.x + player.w > o.x &&
      player.y < o.y + o.h &&
      player.y + player.h > o.y
    ) {
      score += o.value;

      sfx.oil();

      showPopup(
        o.golden ? "BLACK GOLD +20" : "OIL +5",
        o.x,
        o.y
      );

      oils.splice(i, 1);
    }

    if (o.y - cameraY > H + 40) oils.splice(i, 1);
  }

  if (oils.length < 5) spawnOil(2);
}

// ============================================================
// POPUPS
// ============================================================

function showPopup(text, x, y) {
  popups.push({
    text,
    x,
    y,
    life: 80
  });
}

function updatePopups() {
  for (let p of popups) {
    p.y -= 0.4;
    p.life--;
  }

  popups = popups.filter(p => p.life > 0);
}

// ============================================================
// PARTICLES
// ============================================================

function updateParticles() {}

function drawParticles() {}

// ============================================================
// DRAW
// ============================================================

function draw() {
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(0, -cameraY);

  for (let p of platforms) drawPlatform(p);
  for (let o of oils) drawOil(o);

  drawPlayer();
  drawPopups();

  ctx.restore();
}

function drawPlatform(p) {
  ctx.fillStyle = "#4a9eff";
  ctx.fillRect(p.x, p.y, p.w, p.h);
}

function drawOil(o) {
  ctx.fillStyle = o.golden ? "#ffd700" : "#111";
  ctx.fillRect(o.x, o.y, o.w, o.h);

  ctx.fillStyle = "#fff";
  ctx.font = "10px Arial";
  ctx.fillText("🛢", o.x + 3, o.y + 18);
}

// ============================================================
// PLAYER SATIRE DRAW
// ============================================================

function drawPlayer() {
  const x = player.x;
  const y = player.y;
  const w = player.w;
  const h = player.h;

  ctx.fillStyle = "#2c3e50";
  ctx.fillRect(x + 6, y + 22, w - 12, h - 22);

  ctx.fillStyle = "#e74c3c";
  ctx.fillRect(x + 16, y + 24, 4, 18);

  ctx.fillStyle = "#f5cba7";
  ctx.fillRect(x + 8, y + 4, w - 16, 18);

  ctx.fillStyle = "#f1c40f";
  ctx.fillRect(x + 5, y + 1, w - 10, 5);
  ctx.fillRect(x + 3, y + 4, 7, 4);

  ctx.fillStyle = "#111";
  ctx.fillRect(x + 12, y + 10, 3, 3);
  ctx.fillRect(x + 22, y + 10, 3, 3);

  ctx.fillRect(x + 1, y + 25, 6, 12);
  ctx.fillRect(x + w - 7, y + 25, 6, 12);

  ctx.fillRect(x + 10, y + 40, 6, 8);
  ctx.fillRect(x + 20, y + 40, 6, 8);
}

function drawPopups() {
  for (let p of popups) {
    ctx.globalAlpha = p.life / 80;
    ctx.fillStyle = "#ffd700";
    ctx.font = "bold 14px Arial";
    ctx.fillText(p.text, p.x, p.y);
    ctx.globalAlpha = 1;
  }
}

// ============================================================
// GAME OVER
// ============================================================

function gameOver() {
  state = "ended";
  cancelAnimationFrame(animId);

  if (score > bestScore) bestScore = score;

  finalScoreEl.textContent = score;
  bestScoreEl.textContent = bestScore;

  sfx.die();

  gameoverScr.classList.add("active");
}

// ============================================================
// INPUT EVENTS
// ============================================================

document.addEventListener("keydown", e => {
  keys[e.key] = true;
});

document.addEventListener("keyup", e => {
  keys[e.key] = false;
});

// ============================================================
// UTILS
// ============================================================

function rand(min, max) {
  return min + Math.random() * (max - min);
}