// ============================================================
//  DEMO WORLD: POWER CLIMB — script.js (FINAL)
//  1 life start · heart powerup · improved oil/platform art
//  Flashing level announcements · sounds · endless mode
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
  heart: () => {
    playTone(600, "triangle", 0.10, 0.18);
    setTimeout(() => playTone(900, "triangle", 0.15, 0.18), 90);
  },
  die: () => playTone(180, "sawtooth", 0.35, 0.2),
  level: () => {
    [440, 550, 660, 880].forEach((f, i) => {
      setTimeout(() => playTone(f, "triangle", 0.14, 0.18), i * 80);
    });
  }
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
// LEVELS
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

const thresholds = [
  0, 100, 300, 600, 1000,
  1500, 2100, 2800, 3600, 4500
];

const bgColors = [
  "#1a1a2e",
  "#3b1f0b",
  "#ff4d6d",
  "#ff914d",
  "#14532d",
  "#1d3557",
  "#e8e8e8",
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
let hearts;
let popups;
let announcements;

let score = 0;
let bestScore = 0;
let level = 1;
let lastLevel = 1;
let lives = 1;

let cameraY = 0;
let keys = {};
let animId;
let bgColor = bgColors[0];

// ============================================================
// START
// ============================================================

function startGame() {
  getAudio();

  startScr.classList.remove("active");
  gameoverScr.classList.remove("active");

  score = 0;
  level = 1;
  lastLevel = 1;
  lives = 1;
  cameraY = 0;

  bgColor = bgColors[0];

  platforms = [];
  oils = [];
  hearts = [];
  popups = [];
  announcements = [];

  player = {
    x: W / 2 - 28,
    y: H - 220,
    w: 56,
    h: 64,
    vx: 0,
    vy: 0,
    squash: 0,
    invincible: 0
  };

  generateInitialPlatforms();
  spawnOil(6);
  spawnHearts(1);

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
  updateHearts();
  updatePopups();
  updateAnnouncements();
  updateCamera();
  updateScore();
}

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
  player.vy += GRAVITY + Math.max(0, (score - 4500) * 0.00005);

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
        player.squash = 6;
        sfx.jump();
        break;
      }
    }
  }

  if (player.squash > 0) player.squash--;
  if (player.invincible > 0) player.invincible--;

  if (player.y - cameraY > H + 70) loseLife();
}

// ============================================================
// LIFE
// ============================================================

function loseLife() {
  if (player.invincible > 0) return;

  lives--;
  updateHUD();

  if (lives <= 0) {
    gameOver();
    return;
  }

  player.invincible = 80;
  player.x = W / 2 - player.w / 2;
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
// SCORE / LEVEL
// ============================================================

function updateScore() {
  const climb = Math.floor(-cameraY * SCORE_PER_PX);

  if (climb > score) score = climb;

  level = 1;

  for (let i = 0; i < thresholds.length; i++) {
    if (score >= thresholds[i]) level = i + 1;
  }

  if (level > 10) level = 10;

  if (level !== lastLevel) {
    sfx.level();

    if (level < 10) {
      triggerBanner(
        "LEVEL " + level,
        levelNames[level - 1]
      );
    } else {
      triggerBanner(
        "WHITE HOUSE REACHED",
        "MYSTERY ISLAND UNLOCKED"
      );
    }

    lastLevel = level;
  }

  bgColor = score < 4500 ? bgColors[level - 1] : bgColors[10];

  updateHUD();
}

function updateHUD() {
  scoreEl.textContent = score;

  livesEl.textContent =
    lives > 0 ? "❤️".repeat(lives) : "💀";

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

  platforms = platforms.filter(
    p => p.y - cameraY < H + 80
  );
}

// ============================================================
// OIL
// ============================================================

function spawnOil(count = 2) {
  for (let i = 0; i < count; i++) {
    oils.push({
      x: rand(20, W - 44),
      y: cameraY - rand(100, 700),
      w: 28,
      h: 36,
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

      sfx.oil();

      showPopup(
        o.golden ? "⭐ GOLD OIL +20" : "🛢 OIL +5",
        o.x,
        o.y
      );

      oils.splice(i, 1);
      continue;
    }

    if (o.y - cameraY > H + 50) oils.splice(i, 1);
  }

  if (oils.length < 5) spawnOil(1);
}

// ============================================================
// HEARTS
// ============================================================

function spawnHearts(count = 1) {
  for (let i = 0; i < count; i++) {
    hearts.push({
      x: rand(20, W - 50),
      y: cameraY - rand(250, 900),
      w: 30,
      h: 30,
      bob: Math.random() * Math.PI * 2
    });
  }
}

function updateHearts() {
  const t = Date.now() * 0.003;

  for (let i = hearts.length - 1; i >= 0; i--) {
    const h = hearts[i];
    h.offset = Math.sin(t + h.bob) * 4;

    if (
      player.x < h.x + h.w &&
      player.x + player.w > h.x &&
      player.y < h.y + h.h &&
      player.y + player.h > h.y
    ) {
      lives++;
      sfx.heart();

      showPopup("❤️ +1 LIFE", h.x, h.y);

      hearts.splice(i, 1);
      updateHUD();
      continue;
    }

    if (h.y - cameraY > H + 50) hearts.splice(i, 1);
  }

  if (hearts.length < 1 && Math.random() < 0.01) {
    spawnHearts(1);
  }
}

// ============================================================
// POPUPS
// ============================================================

function showPopup(text, x, y) {
  popups.push({
    text,
    x,
    y,
    life: 70
  });
}

function updatePopups() {
  for (let p of popups) {
    p.y -= 0.6;
    p.life--;
  }

  popups = popups.filter(p => p.life > 0);
}

// ============================================================
// ANNOUNCEMENTS
// ============================================================

function triggerBanner(head, sub) {
  announcements.push({
    head,
    sub,
    life: 160
  });
}

function updateAnnouncements() {
  for (let a of announcements) a.life--;

  announcements = announcements.filter(
    a => a.life > 0
  );
}

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
  for (let h of hearts) drawHeart(h);

  drawPlayer();
  drawPopups();

  ctx.restore();

  drawAnnouncements();
}

// ============================================================
// DRAW OBJECTS
// ============================================================

function drawPlatform(p) {
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(p.x + 3, p.y + 4, p.w, p.h);

  ctx.fillStyle = "#4a9eff";
  ctx.fillRect(p.x, p.y, p.w, p.h);

  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillRect(p.x + 2, p.y + 2, p.w - 4, 3);
}

function drawOil(o) {
  ctx.fillStyle = o.golden ? "#ffd700" : "#111";
  ctx.fillRect(o.x, o.y, o.w, o.h);

  ctx.fillStyle = "#888";
  ctx.fillRect(o.x + 3, o.y + 5, o.w - 6, 4);

  ctx.fillStyle = "#fff";
  ctx.font = "bold 8px monospace";
  ctx.fillText("OIL", o.x + 5, o.y + 22);
}

function drawHeart(h) {
  const cx = h.x + 15;
  const cy = h.y + 15 + (h.offset || 0);

  ctx.fillStyle = "#ff2255";

  ctx.beginPath();
  ctx.arc(cx - 6, cy - 4, 7, 0, Math.PI * 2);
  ctx.arc(cx + 6, cy - 4, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cx - 13, cy);
  ctx.lineTo(cx + 13, cy);
  ctx.lineTo(cx, cy + 18);
  ctx.closePath();
  ctx.fill();
}

function drawPlayer() {
  if (
    player.invincible > 0 &&
    Math.floor(player.invincible / 5) % 2 === 0
  ) return;

  let w = player.w;
  let h = player.h;

  if (player.squash > 0) {
    w += 6;
    h -= 6;
  }

  const bounce =
    Math.sin(Date.now() * 0.01) * 2;

  ctx.save();

  ctx.translate(
    player.x + player.w / 2,
    player.y + player.h / 2
  );

  ctx.rotate(player.vx * 0.04);

  if (playerImg.complete && playerImg.naturalWidth > 0) {
    ctx.drawImage(
      playerImg,
      -w / 2,
      -h / 2 + bounce,
      w,
      h
    );
  } else {
    ctx.fillStyle = "#f1c40f";
    ctx.fillRect(-18, -22, 36, 44);
  }

  ctx.restore();
}

// ============================================================
// TEXT DRAW
// ============================================================

function drawPopups() {
  for (let p of popups) {
    ctx.globalAlpha = p.life / 70;
    ctx.fillStyle = "#ffd700";
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "center";
    ctx.fillText(p.text, p.x + 14, p.y);
    ctx.globalAlpha = 1;
  }

  ctx.textAlign = "left";
}

function drawAnnouncements() {
  if (!announcements.length) return;

  const a = announcements[announcements.length - 1];

  const alpha = a.life / 160;

  ctx.save();
  ctx.globalAlpha = alpha;

  ctx.fillStyle = "rgba(0,0,0,0.85)";
  ctx.fillRect(0, H / 2 - 55, W, 110);

  ctx.fillStyle = "#e94560";
  ctx.fillRect(0, H / 2 - 55, W, 5);
  ctx.fillRect(0, H / 2 + 50, W, 5);

  ctx.textAlign = "center";

  ctx.fillStyle =
    Math.floor(a.life / 8) % 2 === 0
      ? "#ffffff"
      : "#ffd700";

  ctx.font = "bold 22px monospace";
  ctx.fillText(a.head, W / 2, H / 2 - 8);

  ctx.fillStyle = "#8fd3ff";
  ctx.font = "bold 12px monospace";
  ctx.fillText(a.sub, W / 2, H / 2 + 22);

  ctx.restore();
  ctx.textAlign = "left";
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
    if (t.clientX < W / 2)
      keys["ArrowLeft"] = true;
    else
      keys["ArrowRight"] = true;
  }
}, { passive: true });

canvas.addEventListener("touchend", () => {
  keys["ArrowLeft"] = false;
  keys["ArrowRight"] = false;
}, { passive: true });

// ============================================================
// UTILS
// ============================================================

function rand(min, max) {
  return min + Math.random() * (max - min);
}