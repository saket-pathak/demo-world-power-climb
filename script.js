// ============================================================
// DEMO WORLD: POWER CLIMB — COMPLETE CORRECTED script.js
// Fixed:
// ✅ Reachable endless platforms
// ✅ Level names shown
// ✅ Correct player sprite loading
// ✅ Pause + Restart buttons
// ✅ Heart lives work properly
// ============================================================

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const W = 380;
const H = 620;

canvas.width = W;
canvas.height = H;

// ============================================================
// ASSETS
// ============================================================

const playerImg = new Image();
playerImg.src = "assets/images/player.png";

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
// STATE
// ============================================================

let score = 0;
let bestScore = 0;
let level = 1;
let lives = 1;

let paused = false;
let state = "menu";

let player;
let platforms = [];
let hearts = [];
let oils = [];

let keys = {};
let cameraY = 0;
let animId;

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
  heart: () => playTone(900, "triangle", 0.18, 0.18),
  die: () => playTone(180, "sawtooth", 0.35, 0.2)
};

// ============================================================
// CONSTANTS
// ============================================================

const GRAVITY = 0.35;
const JUMP_FORCE = -11;
const PLAYER_SPEED = 4.5;

// ============================================================
// UI BUTTONS
// ============================================================

function setupUIButtons() {
  let pauseBtn = document.getElementById("pause-btn");
  let restartBtn = document.getElementById("restart-top-btn");

  if (!pauseBtn) {
    pauseBtn = document.createElement("button");
    pauseBtn.id = "pause-btn";
    pauseBtn.innerText = "⏸";
    pauseBtn.style.position = "absolute";
    pauseBtn.style.top = "8px";
    pauseBtn.style.right = "8px";
    pauseBtn.style.zIndex = "100";
    document.body.appendChild(pauseBtn);
  }

  if (!restartBtn) {
    restartBtn = document.createElement("button");
    restartBtn.id = "restart-top-btn";
    restartBtn.innerText = "↻";
    restartBtn.style.position = "absolute";
    restartBtn.style.top = "8px";
    restartBtn.style.right = "52px";
    restartBtn.style.zIndex = "100";
    document.body.appendChild(restartBtn);
  }

  pauseBtn.onclick = () => {
    if (state !== "playing") return;

    paused = !paused;
    pauseBtn.innerText = paused ? "▶" : "⏸";

    if (!paused) loop();
  };

  restartBtn.onclick = () => startGame();
}

// ============================================================
// START
// ============================================================

function startGame() {
  getAudio();
  setupUIButtons();

  score = 0;
  level = 1;
  lives = 1;
  paused = false;
  cameraY = 0;

  platforms = [];
  hearts = [];
  oils = [];

  player = {
    x: W / 2 - 28,
    y: H - 180,
    w: 56,
    h: 70,
    vx: 0,
    vy: 0,
    invincible: 0
  };

  generatePlatforms();
  spawnHeart();
  spawnOil();

  state = "playing";

  startScr.classList.remove("active");
  gameoverScr.classList.remove("active");

  updateHUD();

  cancelAnimationFrame(animId);
  loop();
}

// ============================================================
// LOOP
// ============================================================

function loop() {
  if (state !== "playing") return;
  if (paused) return;

  update();
  draw();

  animId = requestAnimationFrame(loop);
}

// ============================================================
// UPDATE
// ============================================================

function update() {
  handleInput();

  player.vy += GRAVITY;
  player.x += player.vx;
  player.y += player.vy;

  if (player.x > W) player.x = -player.w;
  if (player.x + player.w < 0) player.x = W;

  if (player.invincible > 0) player.invincible--;

  // platform collision
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
      }
    }
  }

  // camera follows upward
  const targetY = player.y - H * 0.45;
  if (targetY < cameraY) cameraY = targetY;

  // score
  score = Math.max(score, Math.floor(-cameraY * 0.05));

  // level
  level = Math.floor(score / 100) + 1;
  if (level > 10) level = 10;

  updatePlatforms();
  updateHearts();
  updateOils();

  // fall death
  if (player.y - cameraY > H + 80) loseLife();

  updateHUD();
}

function handleInput() {
  player.vx = 0;

  if (keys["ArrowLeft"] || keys["a"]) player.vx = -PLAYER_SPEED;
  if (keys["ArrowRight"] || keys["d"]) player.vx = PLAYER_SPEED;
}

// ============================================================
// LIFE SYSTEM
// ============================================================

function loseLife() {
  if (player.invincible > 0) return;

  lives--;

  if (lives <= 0) {
    gameOver();
    return;
  }

  player.invincible = 120;
  player.x = W / 2 - player.w / 2;
  player.y = cameraY + H / 2;
  player.vy = JUMP_FORCE;
}

// ============================================================
// HUD
// ============================================================

function updateHUD() {
  scoreEl.textContent = score;

  const names = [
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

  levelEl.textContent =
    "LVL " + level + " - " + names[level - 1];

  livesEl.textContent = "❤️ x " + lives;
}

// ============================================================
// PLATFORM SYSTEM (FIXED)
// ============================================================

function generatePlatforms() {
  let y = H - 30;
  let prevX = W / 2 - 35;

  for (let i = 0; i < 12; i++) {
    let x = rand(
      Math.max(10, prevX - 100),
      Math.min(W - 80, prevX + 100)
    );

    platforms.push({
      x,
      y,
      w: 70,
      h: 14
    });

    prevX = x;
    y -= 85;
  }
}

function updatePlatforms() {
  let top = platforms.reduce((a, b) =>
    a.y < b.y ? a : b
  );

  while (top.y - cameraY > -220) {
    let x = rand(
      Math.max(10, top.x - 100),
      Math.min(W - 80, top.x + 100)
    );

    const p = {
      x,
      y: top.y - 85,
      w: 70,
      h: 14
    };

    platforms.push(p);
    top = p;
  }

  platforms = platforms.filter(
    p => p.y - cameraY < H + 100
  );
}

// ============================================================
// HEARTS
// ============================================================

function spawnHeart() {
  hearts.push({
    x: rand(20, W - 40),
    y: cameraY - 400,
    w: 26,
    h: 26
  });
}

function updateHearts() {
  for (let i = hearts.length - 1; i >= 0; i--) {
    const h = hearts[i];

    if (
      player.x < h.x + h.w &&
      player.x + player.w > h.x &&
      player.y < h.y + h.h &&
      player.y + player.h > h.y
    ) {
      lives++;
      sfx.heart();
      hearts.splice(i, 1);
      spawnHeart();
    }
  }
}

// ============================================================
// OIL
// ============================================================

function spawnOil() {
  oils.push({
    x: rand(20, W - 40),
    y: cameraY - 300,
    w: 26,
    h: 32
  });
}

function updateOils() {
  for (let i = oils.length - 1; i >= 0; i--) {
    const o = oils[i];

    if (
      player.x < o.x + o.w &&
      player.x + player.w > o.x &&
      player.y < o.y + o.h &&
      player.y + player.h > o.y
    ) {
      score += 5;
      sfx.oil();
      oils.splice(i, 1);
      spawnOil();
    }
  }
}

// ============================================================
// DRAW
// ============================================================

function draw() {
  ctx.fillStyle = "#14142b";
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(0, -cameraY);

  for (let p of platforms) drawPlatform(p);
  for (let h of hearts) drawHeart(h);
  for (let o of oils) drawOil(o);

  drawPlayer();

  ctx.restore();
}

function drawPlatform(p) {
  ctx.fillStyle = "#4a9eff";
  ctx.fillRect(p.x, p.y, p.w, p.h);
}

function drawHeart(h) {
  ctx.font = "18px Arial";
  ctx.fillText("❤️", h.x, h.y + 20);
}

function drawOil(o) {
  ctx.fillStyle = "#111";
  ctx.fillRect(o.x, o.y, o.w, o.h);

  ctx.fillStyle = "#fff";
  ctx.font = "10px monospace";
  ctx.fillText("OIL", o.x + 3, o.y + 18);
}

// ============================================================
// PLAYER
// ============================================================

function drawPlayer() {
  if (
    player.invincible > 0 &&
    Math.floor(player.invincible / 5) % 2 === 0
  ) return;

  ctx.save();

  ctx.translate(
    player.x + player.w / 2,
    player.y + player.h / 2
  );

  ctx.rotate(player.vx * 0.03);
  ctx.imageSmoothingEnabled = false;

  if (playerImg.complete && playerImg.naturalWidth > 0) {
    ctx.drawImage(
      playerImg,
      -34,
      -40,
      68,
      80
    );
  } else {
    ctx.fillStyle = "yellow";
    ctx.fillRect(-20, -20, 40, 40);
  }

  ctx.restore();
}

// ============================================================
// GAME OVER
// ============================================================

function gameOver() {
  state = "ended";

  if (score > bestScore) bestScore = score;

  finalScoreEl.textContent = score;
  bestScoreEl.textContent = bestScore;

  sfx.die();
  gameoverScr.classList.add("active");
}

// ============================================================
// INPUT
// ============================================================

document.addEventListener("keydown", e => {
  keys[e.key] = true;
});

document.addEventListener("keyup", e => {
  keys[e.key] = false;
});

// ============================================================
// UTIL
// ============================================================

function rand(min, max) {
  return min + Math.random() * (max - min);
}