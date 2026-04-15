// ============================================================
// DEMO WORLD: POWER CLIMB — script.js
// Updated Version with Oil Collectibles + Popups
// ============================================================

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const W = 380;
const H = 620;

canvas.width = W;
canvas.height = H;

// HUD
const scoreEl = document.getElementById("score");
const levelEl = document.getElementById("level");
const livesEl = document.getElementById("lives");

const startScr = document.getElementById("start-screen");
const gameoverScr = document.getElementById("gameover-screen");

document.getElementById("start-btn").onclick = startGame;
document.getElementById("restart-btn").onclick = startGame;

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
let particles;
let oils;
let popups;
let score;
let lives;
let level;
let cameraY;
let keys = {};
let animId;

// ============================================================
// START GAME
// ============================================================

function startGame() {
  startScr.classList.remove("active");
  gameoverScr.classList.remove("active");

  score = 0;
  lives = 3;
  level = 1;
  cameraY = 0;

  particles = [];
  oils = [];
  popups = [];

  player = {
    x: W / 2 - 18,
    y: H - 200,
    w: 36,
    h: 48,
    vx: 0,
    vy: 0,
    facing: 1
  };

  platforms = [];
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
  updateParticles();
  updateOil();
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

  // wrap screen
  if (player.x > W) player.x = -player.w;
  if (player.x + player.w < 0) player.x = W;

  // platform collision only falling
  if (player.vy > 0) {
    for (let p of platforms) {
      if (
        player.x + player.w > p.x &&
        player.x < p.x + p.w &&
        player.y + player.h > p.y &&
        player.y + player.h < p.y + p.h + 12
      ) {
        player.vy = JUMP_FORCE;
        player.y = p.y - player.h;

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

  // fell below screen
  if (player.y - cameraY > H + 60) {
    loseLife();
  }
}

// ============================================================
// LIFE SYSTEM
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
  const climbScore = Math.floor(-cameraY * SCORE_PER_PX);

  if (climbScore > score) {
    score = climbScore;
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

  platforms = platforms.filter(p => p.y - cameraY < H + 80);
}

// ============================================================
// OIL SYSTEM
// ============================================================

function spawnOil(count = 3) {
  for (let i = 0; i < count; i++) {
    oils.push({
      x: rand(20, W - 30),
      y: cameraY - rand(100, 700),
      w: 22,
      h: 28,
      golden: Math.random() < 0.15,
      value: Math.random() < 0.15 ? 20 : 5
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
  ctx.fillStyle = "#1a1a2e";
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
// DRAW HELPERS
// ============================================================

function drawPlatform(p) {
  ctx.fillStyle = "#4a9eff";
  ctx.fillRect(p.x, p.y, p.w, p.h);
}

function drawPlayer() {
  ctx.fillStyle = "#f5cba7";
  ctx.fillRect(player.x + 8, player.y + 4, 20, 18);

  ctx.fillStyle = "#f1c40f";
  ctx.fillRect(player.x + 6, player.y + 2, 24, 5);

  ctx.fillStyle = "#2c3e50";
  ctx.fillRect(player.x + 10, player.y + 22, 16, 24);
}

function drawOil(o) {
  ctx.fillStyle = o.golden ? "#ffd700" : "#111";
  ctx.fillRect(o.x, o.y, o.w, o.h);

  ctx.fillStyle = "#666";
  ctx.fillRect(o.x + 4, o.y + 4, o.w - 8, 4);

  ctx.fillStyle = "#fff";
  ctx.font = "10px Arial";
  ctx.fillText("🛢", o.x + 2, o.y + 18);
}

function drawParticle(p) {
  ctx.globalAlpha = p.life;
  ctx.fillStyle = p.color;
  ctx.fillRect(p.x, p.y, p.size, p.size);
  ctx.globalAlpha = 1;
}

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

// Start screen visible initially