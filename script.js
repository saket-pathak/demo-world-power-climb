// ============================================================
//  DEMO WORLD: POWER CLIMB — script.js (v2)
//  1 life start · heart powerup · canvas oil/pump art
//  Bold flashing level announcements
// ============================================================

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const W = 380;
const H = 620;
canvas.width = W;
canvas.height = H;

// ── Assets ───────────────────────────────────────────────────
const catImg = new Image();
catImg.src = "assets/images/player-cat.png";

// ── DOM ──────────────────────────────────────────────────────
const scoreEl      = document.getElementById("score");
const levelEl      = document.getElementById("level");
const livesEl      = document.getElementById("lives");
const finalScoreEl = document.getElementById("final-score");
const bestScoreEl  = document.getElementById("best-score");
const startScr     = document.getElementById("start-screen");
const gameoverScr  = document.getElementById("gameover-screen");

document.getElementById("start-btn").onclick  = startGame;
document.getElementById("restart-btn").onclick = startGame;

// ── Audio ────────────────────────────────────────────────────
let audioCtx;
function getAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function playTone(freq, type, duration, vol = 0.15) {
  try {
    const ac   = getAudio();
    const osc  = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type; osc.frequency.value = freq;
    osc.connect(gain); gain.connect(ac.destination);
    gain.gain.setValueAtTime(vol, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
    osc.start(); osc.stop(ac.currentTime + duration);
  } catch(e) {}
}
const sfx = {
  jump:  () => playTone(320, "square",   0.12, 0.18),
  oil:   () => playTone(700, "sine",     0.12, 0.18),
  heart: () => { playTone(600, "sine", 0.10, 0.20); playTone(900, "sine", 0.15, 0.15); },
  die:   () => playTone(180, "sawtooth", 0.35, 0.20),
  level: () => { [440,550,660,880].forEach((f,i) => setTimeout(() => playTone(f,"triangle",0.18,0.22), i*80)); }
};

// ── Constants ────────────────────────────────────────────────
const GRAVITY      = 0.35;
const JUMP_FORCE   = -11;
const PLAYER_SPEED = 4.5;
const PLATFORM_W   = 70;
const PLATFORM_H   = 14;
const PLATFORM_GAP = 90;
const SCORE_PER_PX = 0.05;

// ── Levels ───────────────────────────────────────────────────
const levelNames = [
  "Trump Tower","Mar-a-Lago","Miami Rally","Palm Beach",
  "Wall Street","Washington Run","Capitol Heights",
  "Air Force Rise","Global Summit","White House"
];
const endlessName = "Mystery Island";
const thresholds  = [0,100,300,600,1000,1500,2100,2800,3600,4500];
const bgColors    = [
  "#1a1a2e","#3b1f0b","#ff4d6d","#ff914d","#14532d",
  "#1d3557","#e8e8e8","#4ea8de","#5a189a","#111111","#2b003d"
];

// ── State ────────────────────────────────────────────────────
let state, player, platforms, oils, hearts, popups, announcements;
let score = 0, bestScore = 0, level = 1, lastLevel = 1, lives = 1;
let cameraY = 0, keys = {}, animId;
let bgColor = bgColors[0];

// ── Start ────────────────────────────────────────────────────
function startGame() {
  startScr.classList.remove("active");
  gameoverScr.classList.remove("active");

  score = 0; level = 1; lastLevel = 1;
  lives = 1;          // ← ONE life to start
  cameraY = 0;
  bgColor = bgColors[0];

  oils = []; hearts = []; platforms = []; popups = []; announcements = [];

  player = {
    x: W / 2 - 28, y: H - 200,
    w: 56, h: 64,
    vx: 0, vy: 0,
    squash: 0,
    invincible: 0
  };

  generateInitialPlatforms();
  spawnOil(6);
  spawnHearts(2);
  updateHUD();

  state = "playing";
  cancelAnimationFrame(animId);
  loop();
}

// ── Loop ─────────────────────────────────────────────────────
function loop() {
  if (state !== "playing") return;
  update(); draw();
  animId = requestAnimationFrame(loop);
}

// ── Update ───────────────────────────────────────────────────
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
  const left  = keys["ArrowLeft"]  || keys["a"];
  const right = keys["ArrowRight"] || keys["d"];
  player.vx = right ? PLAYER_SPEED : left ? -PLAYER_SPEED : 0;
}

function updatePlayer() {
  player.vy += GRAVITY + Math.max(0, (score - 4500) * 0.00005);
  player.x  += player.vx;
  player.y  += player.vy;

  if (player.x > W)            player.x = -player.w;
  if (player.x + player.w < 0) player.x = W;

  if (player.vy > 0) {
    for (let p of platforms) {
      if (
        player.x + player.w > p.x &&
        player.x < p.x + p.w &&
        player.y + player.h > p.y &&
        player.y + player.h < p.y + p.h + 12
      ) {
        player.y   = p.y - player.h;
        player.vy  = JUMP_FORCE;
        player.squash = 6;
        sfx.jump();
        break;
      }
    }
  }

  if (player.squash > 0)     player.squash--;
  if (player.invincible > 0) player.invincible--;

  if (player.y - cameraY > H + 60) loseLife();
}

// ── Lives ────────────────────────────────────────────────────
function loseLife() {
  if (player.invincible > 0) return;
  lives--;
  updateHUD();
  if (lives <= 0) { gameOver(); return; }
  player.invincible = 80;
  player.x  = W / 2 - player.w / 2;
  player.y  = cameraY + H / 2;
  player.vy = JUMP_FORCE;
}

// ── Camera ───────────────────────────────────────────────────
function updateCamera() {
  const t = player.y - H * 0.45;
  if (t < cameraY) cameraY = t;
}

// ── Score / Level ────────────────────────────────────────────
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
    const isWhiteHouse = level === 10;
    triggerLevelBanner(
      isWhiteHouse ? "WHITE HOUSE REACHED!" : "LEVEL " + level,
      isWhiteHouse ? levelNames[9] : levelNames[level - 1],
      isWhiteHouse
    );
    lastLevel = level;
  }

  bgColor = score < 4500 ? bgColors[level - 1] : bgColors[10];
  updateHUD();
}

function updateHUD() {
  scoreEl.textContent = score;
  livesEl.textContent = lives > 0 ? "❤️".repeat(lives) : "💀";
  levelEl.textContent = score < 4500
    ? level + " - " + levelNames[level - 1]
    : "10 - " + endlessName;
}

// ── Platforms ────────────────────────────────────────────────
function generateInitialPlatforms() {
  for (let i = 0; i < 8; i++) {
    platforms.push({
      x: rand(10, W - PLATFORM_W - 10),
      y: H - i * PLATFORM_GAP,
      w: PLATFORM_W, h: PLATFORM_H
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
        w: PLATFORM_W, h: PLATFORM_H
      });
    }
  }
  platforms = platforms.filter(p => p.y - cameraY < H + 80);
}

// ── Oil ──────────────────────────────────────────────────────
function spawnOil(count = 3) {
  for (let i = 0; i < count; i++) {
    oils.push({
      x: rand(20, W - 44),
      y: cameraY - rand(100, 700),
      w: 28, h: 36,
      golden: Math.random() < 0.15,
      value:  Math.random() < 0.15 ? 20 : 5
    });
  }
}
function updateOil() {
  for (let i = oils.length - 1; i >= 0; i--) {
    const o = oils[i];
    if (
      player.x < o.x + o.w && player.x + player.w > o.x &&
      player.y < o.y + o.h && player.y + player.h > o.y
    ) {
      score += o.value;
      sfx.oil();
      showPopup(o.golden ? "⭐ GOLD OIL +20" : "🛢 OIL +5", o.x, o.y);
      oils.splice(i, 1);
      continue;
    }
    if (o.y - cameraY > H + 40) oils.splice(i, 1);
  }
  if (oils.length < 5) spawnOil(2);
}

// ── Hearts ───────────────────────────────────────────────────
function spawnHearts(count = 1) {
  for (let i = 0; i < count; i++) {
    hearts.push({
      x:   rand(30, W - 50),
      y:   cameraY - rand(200, 800),
      w:   32, h: 32,
      bob: Math.random() * Math.PI * 2,
      _bobOffset: 0
    });
  }
}
function updateHearts() {
  const now = Date.now() * 0.003;
  for (let i = hearts.length - 1; i >= 0; i--) {
    const h = hearts[i];
    h._bobOffset = Math.sin(now + h.bob) * 4;

    if (
      player.x < h.x + h.w && player.x + player.w > h.x &&
      player.y < h.y + h.h && player.y + player.h > h.y
    ) {
      lives++;
      sfx.heart();
      showPopup("❤️ +1 LIFE!", h.x, h.y);
      updateHUD();
      hearts.splice(i, 1);
      continue;
    }
    if (h.y - cameraY > H + 40) hearts.splice(i, 1);
  }
  // Spawn hearts based on progress; max 3 on screen at once
  const desired = Math.max(1, Math.floor(score / 800));
  if (hearts.length < Math.min(desired, 3)) spawnHearts(1);
}

// ── Popups ───────────────────────────────────────────────────
function showPopup(text, x, y) {
  popups.push({ text, x, y, life: 70 });
}
function updatePopups() {
  for (let p of popups) { p.y -= 0.7; p.life--; }
  popups = popups.filter(p => p.life > 0);
}

// ── Announcements ────────────────────────────────────────────
function triggerLevelBanner(headline, subline, special = false) {
  announcements.push({ headline, subline, life: 180, special });
}
function updateAnnouncements() {
  for (let a of announcements) a.life--;
  announcements = announcements.filter(a => a.life > 0);
}

// ── Draw ─────────────────────────────────────────────────────
function draw() {
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(0, -cameraY);

  for (let p of platforms) drawPlatform(p);
  for (let o of oils)      drawOilBarrel(o);
  for (let h of hearts)    drawHeart(h);

  drawPlayer();
  drawPopups();

  ctx.restore();

  // Screen-space overlays (no camera offset)
  drawAnnouncements();
}

// ── Platform ────────────────────────────────────────────────
function drawPlatform(p) {
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.fillRect(p.x + 3, p.y + 4, p.w, p.h);
  ctx.fillStyle = "#4a9eff";
  ctx.fillRect(p.x, p.y, p.w, p.h);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillRect(p.x + 2, p.y + 2, p.w - 4, 3);
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.fillRect(p.x + 2, p.y + p.h - 3, p.w - 4, 3);
}

// ── Oil Barrel (detailed canvas art) ─────────────────────────
function drawOilBarrel(o) {
  const { x, y, w, h, golden: gold } = o;
  const cx = x + w / 2;

  // Drop shadow
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(cx + 3, y + h + 2, w / 2 - 2, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Main body
  const bodyGrad = ctx.createLinearGradient(x, y, x + w, y);
  if (gold) {
    bodyGrad.addColorStop(0,   "#7a4f00");
    bodyGrad.addColorStop(0.3, "#c8860a");
    bodyGrad.addColorStop(0.6, "#ffd700");
    bodyGrad.addColorStop(1,   "#9a6200");
  } else {
    bodyGrad.addColorStop(0,   "#111");
    bodyGrad.addColorStop(0.3, "#2a2a2a");
    bodyGrad.addColorStop(0.6, "#444");
    bodyGrad.addColorStop(1,   "#111");
  }
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.roundRect(x + 1, y + 5, w - 2, h - 8, [3, 3, 6, 6]);
  ctx.fill();

  // Vertical shine strip
  ctx.fillStyle = gold ? "rgba(255,245,150,0.30)" : "rgba(255,255,255,0.10)";
  ctx.fillRect(x + 5, y + 8, 5, h - 16);

  // Top ellipse cap
  const topGrad = ctx.createRadialGradient(cx, y + 5, 1, cx, y + 5, w/2);
  topGrad.addColorStop(0, gold ? "#ffe566" : "#555");
  topGrad.addColorStop(1, gold ? "#b8860b" : "#222");
  ctx.fillStyle = topGrad;
  ctx.beginPath();
  ctx.ellipse(cx, y + 5, w / 2 - 1, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = gold ? "#ffd700" : "#666";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Bottom ellipse cap
  ctx.fillStyle = gold ? "#b8860b" : "#1a1a1a";
  ctx.beginPath();
  ctx.ellipse(cx, y + h - 4, w / 2 - 1, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Horizontal band rings
  ctx.strokeStyle = gold ? "rgba(255,215,0,0.8)" : "rgba(100,100,100,0.9)";
  ctx.lineWidth = 2.5;
  [0.33, 0.66].forEach(t => {
    const bY = y + 5 + (h - 13) * t;
    ctx.beginPath();
    ctx.moveTo(x + 2, bY);
    ctx.bezierCurveTo(cx - 5, bY + 2, cx + 5, bY + 2, x + w - 2, bY);
    ctx.stroke();
  });

  // Nozzle / spout on top
  ctx.fillStyle = gold ? "#d4a800" : "#555";
  ctx.fillRect(cx - 4, y - 2, 8, 8);
  ctx.fillStyle = gold ? "#ffe566" : "#888";
  ctx.fillRect(cx - 5, y - 5, 10, 4);
  // Nozzle hole
  ctx.fillStyle = gold ? "#7a4f00" : "#000";
  ctx.beginPath();
  ctx.arc(cx, y - 3, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Label text
  ctx.font = "bold 6px monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = gold ? "#3a2500" : "rgba(200,200,200,0.85)";
  ctx.fillText(gold ? "GOLD" : "OIL", cx, y + h / 2 + 2);
  ctx.fillStyle = gold ? "rgba(255,255,200,0.5)" : "rgba(255,255,255,0.25)";
  ctx.font = "5px monospace";
  ctx.fillText(gold ? "★ RARE ★" : "CRUDE", cx, y + h / 2 + 10);
  ctx.textAlign = "left";

  // Glow for golden barrels
  if (gold) {
    ctx.save();
    ctx.shadowColor = "#ffd700";
    ctx.shadowBlur  = 16;
    ctx.strokeStyle = "rgba(255,215,0,0.6)";
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.roundRect(x + 1, y + 5, w - 2, h - 8, [3, 3, 6, 6]);
    ctx.stroke();
    ctx.restore();
  }
}

// ── Heart Powerup ────────────────────────────────────────────
function drawHeart(h) {
  const cx = h.x + h.w / 2;
  const cy = h.y + h.h / 2 + (h._bobOffset || 0);
  const s  = 15;

  ctx.save();

  // Outer glow
  ctx.shadowColor = "#ff2255";
  ctx.shadowBlur  = 20;

  // Main heart (two arcs + triangle)
  ctx.fillStyle = "#ff2255";
  ctx.beginPath();
  ctx.arc(cx - s * 0.30, cy - s * 0.18, s * 0.52, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + s * 0.30, cy - s * 0.18, s * 0.52, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.80, cy + s * 0.06);
  ctx.lineTo(cx + s * 0.80, cy + s * 0.06);
  ctx.lineTo(cx,             cy + s * 1.02);
  ctx.closePath();
  ctx.fill();

  // Inner lighter fill for depth
  ctx.shadowBlur = 0;
  ctx.fillStyle  = "#ff5577";
  ctx.beginPath();
  ctx.arc(cx - s * 0.28, cy - s * 0.16, s * 0.38, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + s * 0.28, cy - s * 0.16, s * 0.38, 0, Math.PI * 2);
  ctx.fill();

  // Shine highlight
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath();
  ctx.ellipse(cx - s * 0.18, cy - s * 0.28, s * 0.20, s * 0.12, -0.5, 0, Math.PI * 2);
  ctx.fill();

  // Crisp outline
  ctx.strokeStyle = "#cc0033";
  ctx.lineWidth   = 1.5;
  ctx.shadowColor = "#ff2255";
  ctx.shadowBlur  = 6;
  ctx.beginPath();
  ctx.arc(cx - s * 0.30, cy - s * 0.18, s * 0.52, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx + s * 0.30, cy - s * 0.18, s * 0.52, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();

  // Floating "+1" label above heart
  ctx.save();
  ctx.globalAlpha  = 0.85;
  ctx.fillStyle    = "#ffffff";
  ctx.font         = "bold 9px monospace";
  ctx.textAlign    = "center";
  ctx.shadowColor  = "#ff2255";
  ctx.shadowBlur   = 6;
  ctx.fillText("+1 ❤", cx, cy - s - 4);
  ctx.restore();
  ctx.textAlign = "left";
}

// ── Player ───────────────────────────────────────────────────
function drawPlayer() {
  const bounce = Math.sin(Date.now() * 0.01) * 2;
  let w = player.w, h = player.h;
  if (player.squash > 0) { w += 6; h -= 6; }

  // Flash when briefly invincible after respawn
  if (player.invincible > 0 && Math.floor(player.invincible / 5) % 2 === 0) return;

  ctx.save();
  ctx.translate(player.x + player.w / 2, player.y + player.h / 2);
  ctx.rotate(player.vx * 0.04);
  ctx.drawImage(catImg, -w / 2, -h / 2 + bounce, w, h);
  ctx.restore();
}

// ── Popups ───────────────────────────────────────────────────
function drawPopups() {
  for (let p of popups) {
    ctx.globalAlpha = p.life / 70;
    ctx.fillStyle   = "#ffd700";
    ctx.font        = "bold 12px monospace";
    ctx.textAlign   = "center";
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur  = 4;
    ctx.fillText(p.text, p.x + 16, p.y);
    ctx.shadowBlur  = 0;
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = "left";
}

// ── Level Announcement Banner (screen-space) ─────────────────
function drawAnnouncements() {
  if (!announcements.length) return;

  const a   = announcements[announcements.length - 1];
  const age = 180 - a.life;

  // Alpha: fade in (0-15), hold, fade out (last 40)
  let alpha = 1;
  if (age < 15)    alpha = age / 15;
  if (a.life < 40) alpha = a.life / 40;

  // Flash: alternate colour every 6 frames for first 60 frames
  const flash = age < 60 && Math.floor(age / 6) % 2 === 0;

  const bannerH = a.special ? 114 : 94;
  const bannerY = H / 2 - bannerH / 2;

  ctx.save();
  ctx.globalAlpha = alpha;

  // ── Backdrop ──────────────────────────────────────────────
  ctx.fillStyle = a.special
    ? "rgba(8, 0, 24, 0.90)"
    : "rgba(0, 0, 0, 0.82)";
  ctx.fillRect(0, bannerY, W, bannerH);

  // Top + bottom accent border (thick)
  const accentColor = a.special ? "#ffd700" : "#e94560";
  ctx.fillStyle = accentColor;
  ctx.fillRect(0, bannerY,              W, 5);
  ctx.fillRect(0, bannerY + bannerH - 5, W, 5);

  // ── Headline ──────────────────────────────────────────────
  ctx.textAlign   = "center";
  ctx.font        = `bold ${a.special ? 26 : 22}px 'Press Start 2P', monospace`;

  // Flashing: swap between accent and white
  ctx.fillStyle   = flash ? accentColor : "#ffffff";
  ctx.shadowColor = accentColor;
  ctx.shadowBlur  = flash ? 28 : 12;

  wrapText(ctx, a.headline, W / 2, bannerY + 46, W - 36, 30);

  // ── Sub-line (location name) ──────────────────────────────
  ctx.font        = "12px 'Silkscreen', monospace";
  ctx.fillStyle   = a.special ? "#ffd700" : "#a8d4ff";
  ctx.shadowBlur  = 5;
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.fillText(a.subline, W / 2, bannerY + bannerH - 16);

  ctx.shadowBlur  = 0;
  ctx.textAlign   = "left";
  ctx.globalAlpha = 1;
  ctx.restore();
}

// Helper: word-wrap canvas text
function wrapText(ctx, text, cx, y, maxW, lineH) {
  const words = text.split(" ");
  let line = "", lines = [];
  for (const word of words) {
    const test = line ? line + " " + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line); line = word;
    } else line = test;
  }
  lines.push(line);
  const startY = y - ((lines.length - 1) * lineH) / 2;
  lines.forEach((l, i) => ctx.fillText(l, cx, startY + i * lineH));
}

// ── Game Over ────────────────────────────────────────────────
function gameOver() {
  state = "ended";
  cancelAnimationFrame(animId);
  if (score > bestScore) bestScore = score;
  finalScoreEl.textContent = score;
  bestScoreEl.textContent  = bestScore;
  sfx.die();
  gameoverScr.classList.add("active");
}

// ── Input ─────────────────────────────────────────────────────
document.addEventListener("keydown", e => { keys[e.key] = true; });
document.addEventListener("keyup",   e => { keys[e.key] = false; });

canvas.addEventListener("touchstart", e => {
  for (const t of e.touches)
    keys[t.clientX < W / 2 ? "ArrowLeft" : "ArrowRight"] = true;
}, { passive: true });
canvas.addEventListener("touchend", () => {
  keys["ArrowLeft"] = keys["ArrowRight"] = false;
}, { passive: true });

// ── Utils ─────────────────────────────────────────────────────
function rand(min, max) { return min + Math.random() * (max - min); }