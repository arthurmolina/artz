/* Molina Runner — mini jogo 2D estilo endless runner, embutido na página.
 * Ao carregar, roda em modo demonstração (personagem correndo, sem obstáculos);
 * START ou barra de espaço começam a partida de verdade.
 * Sprites: assets/sprites/frame_*.png (recortados de assets/sprites/sheet_original.png)
 * Vídeo do personagem correndo: assets/video/running.mp4 (tela de game over)
 */
(function () {
  'use strict';

  // ---------- DOM ----------
  var canvas = document.getElementById('game-canvas');
  var ctx = canvas.getContext('2d');
  var startScreen = document.getElementById('game-start');
  var overScreen = document.getElementById('game-over');
  var finalScoreEl = document.getElementById('final-score');

  // Largura acompanha a página (faixa integrada, sem moldura); altura fixa.
  var H = 300, GROUND_Y = 262;
  var W = 0;
  function resize() {
    W = canvas.clientWidth || 900;
    canvas.width = W;
    canvas.height = H;
    ctx.imageSmoothingEnabled = false;
  }
  resize();
  window.addEventListener('resize', resize);

  // ---------- Sprites ----------
  var SPRITES = {
    run1: 'assets/sprites/frame_00.png',
    run2: 'assets/sprites/frame_04.png',
    jump: 'assets/sprites/frame_06.png',
    duck: 'assets/sprites/frame_04.png',
    dead: 'assets/sprites/frame_08.png'
  };
  var images = {};
  var pending = 0;
  Object.keys(SPRITES).forEach(function (key) {
    if (images[SPRITES[key]]) { images[key] = images[SPRITES[key]]; return; }
    pending++;
    var img = new Image();
    img.src = SPRITES[key];
    img.onload = img.onerror = function () { pending--; };
    images[key] = img;
    images[SPRITES[key]] = img;
  });

  // ---------- Estado ----------
  // DEMO: personagem corre sozinho, sem obstáculos, com o botão START por cima
  var STATE = { DEMO: 0, PLAYING: 1, OVER: 2 };
  var state = STATE.DEMO;
  var lastTime = 0;

  var player, obstacles, speed, distance, score, hiScore, spawnIn, groundOffset;
  hiScore = parseInt(localStorage.getItem('molina-runner-hi') || '0', 10);

  var PLAYER_H = 74;
  var GRAVITY = 2600;
  var JUMP_V = -880;

  function reset() {
    player = {
      x: 70,
      y: GROUND_Y,       // pés do personagem
      vy: 0,
      onGround: true,
      ducking: false,
      holdingJump: false,
      animTime: 0
    };
    obstacles = [];
    speed = 340;
    distance = 0;
    score = 0;
    spawnIn = 900; // px até o primeiro obstáculo
    groundOffset = 0;
  }
  reset();

  // ---------- Cenário ----------
  // Gerado sobre um ciclo largo fixo, repetido em qualquer largura de tela.
  var CYCLE = 4800;
  var stars = [];
  for (var i = 0; i < 220; i++) {
    stars.push({ x: Math.random() * CYCLE, y: Math.random() * (GROUND_Y - 100), r: Math.random() * 1.5 + 0.5 });
  }
  var skylineFar = [], skylineNear = [];
  (function buildSkyline() {
    var x = 0;
    while (x < CYCLE) {
      var w = 40 + Math.random() * 60, h = 40 + Math.random() * 70;
      skylineFar.push({ x: x, w: w, h: h });
      x += w + 10 + Math.random() * 30;
    }
    x = 0;
    while (x < CYCLE) {
      var w2 = 50 + Math.random() * 80, h2 = 20 + Math.random() * 45;
      skylineNear.push({ x: x, w: w2, h: h2 });
      x += w2 + 20 + Math.random() * 60;
    }
  })();

  // ---------- Obstáculos ----------
  // fly=true passa na altura da cabeça: precisa abaixar (ou cronometrar o pulo)
  var OBSTACLE_TYPES = [
    { emoji: '\u{1F41B}', size: 40, fly: false, label: 'bug' },          // 🐛
    { emoji: '\u{1F47E}', size: 46, fly: false, label: 'alien' },        // 👾
    { emoji: '\u{1F525}', size: 44, fly: false, label: 'incidente' },    // 🔥
    { emoji: '\u{2709}\u{FE0F}', size: 40, fly: true, label: 'e-mails' } // ✉️
  ];

  function spawnObstacle() {
    var canFly = score > 150;
    var type;
    do {
      type = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
    } while (type.fly && !canFly);
    var y = type.fly ? GROUND_Y - PLAYER_H - 10 : GROUND_Y - type.size + 6;
    obstacles.push({ type: type, x: W + 60, y: y, w: type.size, h: type.size });
    var minGap = Math.max(260, 520 - speed * 0.25);
    spawnIn = minGap + Math.random() * 320;
  }

  // ---------- Áudio ----------
  var audioCtx = null;
  function beep(freq, dur, vol) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      gain.gain.value = vol || 0.04;
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + dur);
    } catch (e) { /* sem áudio, sem drama */ }
  }

  // ---------- Loop ----------
  function update(dt) {
    var playing = state === STATE.PLAYING;
    if (playing) speed = Math.min(900, speed + 9 * dt);
    var dx = speed * dt;
    distance += dx;
    groundOffset = (groundOffset + dx) % 40;
    player.animTime += dt;

    // física do pulo (segurar o pulo sobe mais alto)
    if (!player.onGround) {
      var g = (player.vy < 0 && player.holdingJump) ? GRAVITY * 0.55 : GRAVITY;
      player.vy += g * dt;
      player.y += player.vy * dt;
      if (player.y >= GROUND_Y) {
        player.y = GROUND_Y;
        player.vy = 0;
        player.onGround = true;
      }
    }

    if (!playing) return; // modo demonstração: sem obstáculos nem pontuação

    var newScore = Math.floor(distance / 10);
    if (newScore !== score && newScore > 0 && newScore % 100 === 0) beep(880, 0.12);
    score = newScore;

    // obstáculos
    spawnIn -= dx;
    if (spawnIn <= 0) spawnObstacle();
    for (var i = obstacles.length - 1; i >= 0; i--) {
      obstacles[i].x -= dx;
      if (obstacles[i].x + obstacles[i].w < -80) obstacles.splice(i, 1);
    }

    // colisão (hitbox encolhida pra ser justo)
    var ph = player.ducking ? PLAYER_H * 0.55 : PLAYER_H;
    var pw = 34;
    var px = player.x - pw / 2 + 4;
    var py = player.y - ph;
    for (var j = 0; j < obstacles.length; j++) {
      var o = obstacles[j];
      var ox = o.x + o.w * 0.15, oy = o.y + o.h * 0.15, ow = o.w * 0.7, oh = o.h * 0.7;
      if (px < ox + ow && px + pw > ox && py < oy + oh && py + ph > oy) {
        gameOver();
        return;
      }
    }
  }

  function drawBackground() {
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#e5e7eb';
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      if (s.x > W) continue;
      ctx.globalAlpha = 0.3 + 0.4 * Math.abs(Math.sin(s.x + distance * 0.001 + i));
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#1f2937';
    var off = (distance * 0.2) % CYCLE;
    for (var f = 0; f < skylineFar.length; f++) {
      var b = skylineFar[f];
      var bx = ((b.x - off) % CYCLE + CYCLE) % CYCLE - 100;
      if (bx > W + 100) continue;
      ctx.fillRect(bx, GROUND_Y - 40 - b.h, b.w, b.h + 40);
    }
    ctx.fillStyle = '#273449';
    var off2 = (distance * 0.5) % CYCLE;
    for (var n = 0; n < skylineNear.length; n++) {
      var b2 = skylineNear[n];
      var bx2 = ((b2.x - off2) % CYCLE + CYCLE) % CYCLE - 100;
      if (bx2 > W + 100) continue;
      ctx.fillRect(bx2, GROUND_Y - 10 - b2.h, b2.w, b2.h + 10);
    }

    // chão
    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y + 2);
    ctx.lineTo(W, GROUND_Y + 2);
    ctx.stroke();
    ctx.fillStyle = '#374151';
    for (var d = -1; d < W / 40 + 1; d++) {
      ctx.fillRect(d * 40 - groundOffset, GROUND_Y + 12, 18, 3);
    }
  }

  function drawPlayer() {
    var img;
    if (state === STATE.OVER) img = images.dead;
    else if (!player.onGround) img = images.jump;
    else if (player.ducking) img = images.duck;
    else img = (Math.floor(player.animTime * 8) % 2 === 0) ? images.run1 : images.run2;
    if (!img || !img.naturalWidth) return;

    var h = player.ducking && player.onGround ? PLAYER_H * 0.62 : PLAYER_H;
    var w = img.naturalWidth * (PLAYER_H / img.naturalHeight);
    ctx.drawImage(img, player.x - w / 2, player.y - h, w, h);
  }

  function drawObstacles() {
    ctx.textBaseline = 'top';
    for (var i = 0; i < obstacles.length; i++) {
      var o = obstacles[i];
      ctx.font = o.w + 'px serif';
      ctx.fillText(o.type.emoji, o.x, o.y);
    }
  }

  function drawHUD() {
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#9ca3af';
    if (state === STATE.DEMO) {
      ctx.font = 'bold 20px monospace';
      ctx.fillText('MOLINA RUNNER', 16, 14);
      if (hiScore > 0) {
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'right';
        ctx.fillText('HI ' + String(hiScore).padStart(5, '0'), W - 16, 14);
        ctx.textAlign = 'left';
      }
      return;
    }
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'right';
    var hi = Math.max(hiScore, score);
    ctx.fillText('HI ' + String(hi).padStart(5, '0') + '  ' + String(score).padStart(5, '0'), W - 16, 14);
    ctx.textAlign = 'left';
  }

  function frame(t) {
    requestAnimationFrame(frame);
    var dt = Math.min(0.05, (t - lastTime) / 1000 || 0);
    lastTime = t;
    if (state !== STATE.OVER) update(dt);
    drawBackground();
    drawObstacles();
    drawPlayer();
    drawHUD();
  }
  requestAnimationFrame(frame);

  // ---------- Controle de jogo ----------
  function startGame() {
    reset();
    state = STATE.PLAYING;
    startScreen.style.display = 'none';
    overScreen.style.display = 'none';
    beep(520, 0.08);
  }

  function gameOver() {
    state = STATE.OVER;
    beep(140, 0.35, 0.06);
    if (score > hiScore) {
      hiScore = score;
      localStorage.setItem('molina-runner-hi', String(hiScore));
      finalScoreEl.textContent = 'Novo recorde: ' + score + ' pontos!';
    } else {
      finalScoreEl.textContent = score + ' pontos · recorde: ' + hiScore;
    }
    overScreen.style.display = 'flex';
  }

  function jump() {
    if (player.onGround) {
      player.vy = JUMP_V;
      player.onGround = false;
      player.ducking = false;
      beep(660, 0.07);
    }
    player.holdingJump = true;
  }

  function primaryAction() {
    if (state === STATE.PLAYING) jump();
    else if (pending === 0) startGame();
  }

  // ---------- Input ----------
  document.addEventListener('keydown', function (e) {
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName);
    if (typing) return;

    switch (e.code) {
      case 'Space':
      case 'ArrowUp':
      case 'KeyW':
        e.preventDefault();
        if (!e.repeat) {
          if (state !== STATE.PLAYING) canvas.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          primaryAction();
        }
        break;
      case 'ArrowDown':
      case 'KeyS':
        if (state === STATE.PLAYING) {
          e.preventDefault();
          if (player.onGround) player.ducking = true;
        }
        break;
    }
  });

  document.addEventListener('keyup', function (e) {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') player.holdingJump = false;
    if (e.code === 'ArrowDown' || e.code === 'KeyS') player.ducking = false;
  });

  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    primaryAction();
  });
  canvas.addEventListener('pointerup', function () {
    player.holdingJump = false;
  });

  document.getElementById('start-button').addEventListener('click', startGame);
  document.getElementById('restart-button').addEventListener('click', startGame);
})();
