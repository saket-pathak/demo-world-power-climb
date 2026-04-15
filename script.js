// ============================================================
// DEMO WORLD: POWER CLIMB
// FULL FIXED VERSION
// - Score visible on Game Over
// - Sound restored
// - Trump-like satire doodle restored
// - Oil collectibles
// - Popups
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
let lives = 3;

let cameraY = 0;
let keys = {};
let animId;

// ============================================================
// START
// ============================================================

function startGame() {
  startScr.classList.remove("active");
  gameoverScr.classList.remove("active");

  state = "playing";

  score = 0;
  level = 1;
  lives = 3;
  cameraY = 0;

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
    facing: 1,
    frame: 0,
    timer: 0
  };

  generateInitialPlatforms();
  spawnOil(6);

  updateHUD();

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

  if (left) {
    player.vx = -PLAYER_SPEED;
    player.facing = -1;
  }

  if (right) {
    player.vx = PLAYER_SPEED;
    player.facing = 1;
  }
}

// ============================================================
// PLAYER
// ============================================================

function updatePlayer() {
  player.vy += GRAVITY;

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

        spawnParticles(
          player.x + player.w / 2,
          player.y + player.h,
          "#4a9eff",
          6
        );

        break;
      }
    }
  }

  player.timer++;
  if (player.timer > 8) {
    player.timer = 0;
    player.frame ^= 1;
  }

  if (player.y - cameraY > H + 50) {
    loseLife();
  }
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

  if (targetY < cameraY) {
    cameraY = targetY;
  }
}

// ============================================================
// SCORE
// ============================================================

function updateScore() {
  const climb = Math.floor(-cameraY * SCORE_PER_PX);

  if (climb > score) {
    score = climb;
    updateHUD();
  }

  level = Math.floor(score / 250) + 1;
  levelEl.textContent = level;
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

  platforms = platforms.filter(p => p.y - cameraY < H + 60);
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

      showPopup(
        o.golden ? "BLACK GOLD +20" : "OIL +5",
        o.x,
        o.y
      );

      spawnParticles(
        o.x,
        o.y,
        o.golden ? "#ffd700" : "#111",
        10
      );

      sfx.oil();

      oils.splice(i, 1);

      updateHUD();
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
    life: 60
  });
}

function updatePopups() {
  for (let p of popups) {
    p.y -= 0.5;
    p.life--;
  }

  popups = popups.filter(p => p.life > 0);
}

// ============================================================
// PARTICLES
// ============================================================

function spawnParticles(x, y, color, n = 8) {
  for (let i = 0; i < n; i++) {
    particles.push({
      x,
      y,
      vx: rand(-2, 2),
      vy: rand(-4, -1),
      life: 1,
      decay: 0.03,
      size: rand(3, 7),
      color
    });
  }
}

function updateParticles() {
  for (let p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.15;
    p.life -= p.decay;
  }

  particles = particles.filter(p => p.life > 0);
}

// ============================================================
// DRAW
// ============================================================

function draw() {
  ctx.fillStyle = "#12122a";
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(0, -cameraY);

  for (let p of platforms) drawPlatform(p);
  for (let o of oils) drawOil(o);

  drawPlayer();

  for (let p of particles) drawParticle(p);

  drawPopups();

  ctx.restore();
}

// ============================================================
// DRAW PLATFORM
// ============================================================

function drawPlatform(p) {
  ctx.fillStyle = "#4a9eff";
  ctx.fillRect(p.x, p.y, p.w, p.h);

  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.fillRect(p.x + 2, p.y + 2, p.w - 4, 3);
}

// ============================================================
// DRAW PLAYER (SATIRE VERSION)
// ============================================================

function drawPlayer() {
  const x = player.x;
  const y = player.y;
  const w = player.w;
  const h = player.h;

  // suit
  ctx.fillStyle = "#2c3e50";
  ctx.fillRect(x + 6, y + 22, w - 12, h - 22);

  // tie
  ctx.fillStyle = "#e74c3c";
  ctx.fillRect(x + 16, y + 24, 4, 18);

  // face
  ctx.fillStyle = "#f5cba7";
  ctx.fillRect(x + 8, y + 4, w - 16, 18);

  // iconic blonde hair
  ctx.fillStyle = "#f1c40f";
  ctx.fillRect(x + 5, y + 1, w - 10, 5);
  ctx.fillRect(x + 3, y + 4, 7, 4);

  // eyes
  ctx.fillStyle = "#111";
  ctx.fillRect(x + 12, y + 10, 3, 3);
  ctx.fillRect(x + 22, y + 10, 3, 3);

  // mouth
  ctx.fillStyle = "#c0392b";
  ctx.fillRect(x + 12, y + 16, 12, 2);

  // arms
  ctx.fillStyle = "#2c3e50";
  ctx.fillRect(x + 1, y + 25, 6, 12);
  ctx.fillRect(x + w - 7, y + 25, 6, 12);

  // legs
  ctx.fillRect(x + 10, y + 40, 6, 8);
  ctx.fillRect(x + 20, y + 40, 6, 8);
}

// ============================================================
// DRAW OIL
// ============================================================

function drawOil(o) {
  ctx.fillStyle = o.golden ? "#ffd700" : "#111";
  ctx.fillRect(o.x, o.y, o.w, o.h);

  ctx.fillStyle = "#888";
  ctx.fillRect(o.x + 4, o.y + 4, o.w - 8, 4);

  ctx.fillStyle = "#fff";
  ctx.font = "10px Arial";
  ctx.fillText("🛢", o.x + 3, o.y + 18);
}

// ============================================================
// PARTICLES
// ============================================================

function drawParticle(p) {
  ctx.globalAlpha = p.life;
  ctx.fillStyle = p.color;
  ctx.fillRect(p.x, p.y, p.size, p.size);
  ctx.globalAlpha = 1;
}

// ============================================================
// POPUPS
// ============================================================

function drawPopups() {
  for (let p of popups) {
    ctx.globalAlpha = p.life / 60;
    ctx.fillStyle = "#ffd700";
    ctx.font = "bold 14px Arial";
    ctx.fillText(p.text, p.x, p.y);
    ctx.globalAlpha = 1;
  }
}

// ============================================================
// HUD
// ============================================================

function updateHUD() {
  scoreEl.textContent = score;
  levelEl.textContent = level;
  livesEl.textContent = lives;
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
// INPUT
// ============================================================

document.addEventListener("keydown", e => {
  keys[e.key] = true;
});

document.addEventListener("keyup", e => {
  keys[e.key] = false;
});

canvas.addEventListener("touchstart", e => {
  for (let t of e.touches) {
    if (t.clientX < W / 2) keys["ArrowLeft"] = true;
    else keys["ArrowRight"] = true;
  }
});

canvas.addEventListener("touchend", () => {
  keys["ArrowLeft"] = false;
  keys["ArrowRight"] = false;
});

// ============================================================
// UTILS
// ============================================================

function rand(min, max) {
  return min + Math.random() * (max - min);
}