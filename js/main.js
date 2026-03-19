/**
 * Main Module - Application Entry Point
 */

/**
 * Fireworks Module
 */
const Fireworks = (function() {
  let canvas, ctx, particles = [];
  function init() {
    canvas = document.getElementById('fireworks-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  function explode(x, y) {
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffffff'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    // Adjusted particle count for denser, more confeti-like feel
    for (let i = 0; i < 80; i++) {
      particles.push({
        x, y, color, radius: Math.random() * 4 + 2,
        velocity: { x: (Math.random() - 0.5) * 12, y: (Math.random() - 0.5) * 12 },
        alpha: 1, decay: Math.random() * 0.01 + 0.01
      });
    }
  }
  function update() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((p, i) => {
      p.x += p.velocity.x; p.y += p.velocity.y; p.velocity.y += 0.05; p.alpha -= p.decay;
      if (p.alpha <= 0) particles.splice(i, 1);
      else {
        ctx.save(); ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
    });
    if (particles.length > 0) requestAnimationFrame(update);
  }
  return { start: () => { init(); let c=0; const inv = setInterval(() => { explode(Math.random()*canvas.width, Math.random()*canvas.height*0.6); if(c===0) update(); c++; if(c>15) clearInterval(inv); }, 400); } };
})();

const App = (function() {
  let playerCount = 1;
  let playerConfigs = [];
  let gameSettings = { speed: 5, laps: 5, track: 'oval' };
  let screens = {}, elements = {};

  function init() {
    cacheElements();
    setupEventListeners();
    loadSettings(); // Load saved player/game settings
    loadLeaderboard();
    showScreen('start-screen');
  }

  function cacheElements() {
    screens = {
      start: document.getElementById('start-screen'),
      setup: document.getElementById('setup-screen'),
      game: document.getElementById('game-screen'),
      results: document.getElementById('results-screen')
    };
    elements = {
      startBtn: document.getElementById('start-btn'),
      playerCountBtns: document.querySelectorAll('.btn-player-count'),
      playerConfigsContainer: document.getElementById('player-configs'),
      speedSelect: document.getElementById('speed-select'),
      lapsSelect: document.getElementById('laps-select'),
      trackSelect: document.getElementById('track-select'),
      backToStartBtn: document.getElementById('back-to-start'),
      startRaceBtn: document.getElementById('start-race'),
      gameTimer: document.getElementById('game-timer'),
      headerPlayerName: document.getElementById('header-player-name'),
      leaderName: document.getElementById('leader-name'),
      leaderLap: document.getElementById('leader-lap'),
      mathQuestion: document.getElementById('math-question'),
      answerButtons: document.getElementById('answer-buttons'),
      playersStatsBar: document.getElementById('players-stats-bar'),
      winnerName: document.getElementById('winner-name'),
      podiumContainer: document.getElementById('podium-container'),
      resultsRows: document.getElementById('results-rows'),
      playAgainBtn: document.getElementById('play-again'),
      resetGameBtn: document.getElementById('reset-game-btn'),
      backToMenuBtn: document.getElementById('back-to-menu'),
      currentPlayerDisplay: document.getElementById('current-player-display'),
      leaderboardRows: document.getElementById('leaderboard-rows'),
      resetLeaderboardBtn: document.getElementById('reset-leaderboard'),
      countdownOverlay: document.getElementById('countdown-overlay'),
      countdownText: document.getElementById('countdown-text')
    };
  }

  function setupEventListeners() {
    elements.startBtn.addEventListener('click', () => { initializeSetup(); showScreen('setup-screen'); });
    elements.playerCountBtns.forEach(btn => btn.addEventListener('click', () => {
      elements.playerCountBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      playerCount = parseInt(btn.dataset.count);
      generatePlayerConfigs();
      renderPlayerConfigs();
      saveSettings();
    }));
    elements.speedSelect.addEventListener('change', (e) => {
      gameSettings.speed = parseInt(e.target.value);
      saveSettings();
    });
    elements.lapsSelect.addEventListener('change', (e) => {
      gameSettings.laps = parseInt(e.target.value);
      saveSettings();
    });
    elements.trackSelect.addEventListener('change', (e) => {
      gameSettings.track = e.target.value;
      saveSettings();
    });
    elements.backToStartBtn.addEventListener('click', () => showScreen('start-screen'));
    elements.startRaceBtn.addEventListener('click', startGame);
    elements.playAgainBtn.addEventListener('click', () => { initializeSetup(); showScreen('setup-screen'); });
    if(elements.resetGameBtn) elements.resetGameBtn.addEventListener('click', () => { showScreen('start-screen'); });
    elements.backToMenuBtn.addEventListener('click', () => { loadLeaderboard(); showScreen('start-screen'); });
    if(elements.resetLeaderboardBtn) elements.resetLeaderboardBtn.addEventListener('click', resetLeaderboard);
  }

  // LEADERBOARD LOGIC
  function loadLeaderboard() {
    if(!elements.leaderboardRows) return;
    const records = JSON.parse(localStorage.getItem('mathRaceTop10') || '[]');
    if(records.length === 0) {
      elements.leaderboardRows.innerHTML = '<div class="leaderboard-row empty">No records yet</div>';
      return;
    }
    
    elements.leaderboardRows.innerHTML = records.map(r => `
      <div class="leaderboard-row">
        <div>${r.date}</div>
        <div style="font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">${r.name}</div>
        <div>${r.correct || 0}</div>
        <div>${r.wrong || 0}</div>
        <div>${(r.totalTime || 0).toFixed(0)}s</div>
        <div>${r.avg.toFixed(2)}s</div>
      </div>
    `).join('');
  }

  function saveToLeaderboard(player) {
    if(!player.finished || !player.finishTime) return;
    if(player.correctAnswers === 0) return;
    const avgTime = player.finishTime / player.correctAnswers;
    const now = new Date();
    const dateStr = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth()+1).padStart(2, '0')}.${now.getFullYear()}`;
    
    const record = {
      date: dateStr,
      name: player.name,
      avg: avgTime,
      correct: player.correctAnswers,
      wrong: player.wrongAnswers,
      totalTime: player.finishTime
    };

    let records = JSON.parse(localStorage.getItem('mathRaceTop10') || '[]');
    records.push(record);
    records.sort((a,b) => a.avg - b.avg);
    records = records.slice(0, 10);
    
    localStorage.setItem('mathRaceTop10', JSON.stringify(records));
  }

  function resetLeaderboard() {
    if(confirm("Are you sure you want to reset the Top 10 times?")) {
      localStorage.removeItem('mathRaceTop10');
      loadLeaderboard();
    }
  }

  function showScreen(screenId) {
    Object.values(screens).forEach(s => { if(s) s.classList.remove('active'); });
    const screen = screens[screenId.replace('-screen', '')];
    if (screen) screen.classList.add('active');
  }

  function saveSettings() {
    const settings = {
      playerCount,
      playerConfigs,
      gameSettings
    };
    localStorage.setItem('mathRaceSettings', JSON.stringify(settings));
  }

  function loadSettings() {
    const saved = localStorage.getItem('mathRaceSettings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        playerCount = parsed.playerCount || 1;
        playerConfigs = parsed.playerConfigs || [];
        gameSettings = parsed.gameSettings || { speed: 5, laps: 5, track: 'oval' };
        
        // Update setup UI elements
        if (elements.speedSelect) elements.speedSelect.value = gameSettings.speed;
        if (elements.lapsSelect) elements.lapsSelect.value = gameSettings.laps;
        if (elements.trackSelect) elements.trackSelect.value = gameSettings.track;
        
        // Update player count buttons
        elements.playerCountBtns.forEach(btn => {
          if (parseInt(btn.dataset.count) === playerCount) {
            btn.classList.add('active');
          } else {
            btn.classList.remove('active');
          }
        });
        
      } catch (e) {
        console.error("Error loading settings:", e);
        generatePlayerConfigs();
      }
    } else {
      generatePlayerConfigs();
    }
  }

  function initializeSetup() {
    loadSettings(); // Restore last used settings rather than resetting
    renderPlayerConfigs();
  }

  function generatePlayerConfigs() {
    const colors = Players.getCarColors();
    playerConfigs = [];
    for (let i = 0; i < playerCount; i++) {
      playerConfigs.push({
        name: `Player ${i + 1}`,
        colorIndex: i % colors.length,
        vehicleType: 'f1',
        operations: ['addition'],
        difficulties: { addition: 'easy', subtraction: 'easy', multiplication: 'easy', division: 'easy' }
      });
    }
    saveSettings();
  }

  function renderPlayerConfigs() {
    const colors = Players.getCarColors();
    const ops = ['addition', 'subtraction', 'multiplication', 'division'];
    const diffs = ['easy', 'medium', 'hard'];

    elements.playerConfigsContainer.innerHTML = playerConfigs.map((config, index) => `
      <div class="player-config">
        <h3>Player ${index + 1}</h3>
        <div style="margin: 10px 0">
          <label style="display:block; margin-bottom:5px; font-weight:600">Name</label>
          <input type="text" value="${config.name}" data-player="${index}" class="player-name-input" style="padding:10px; border-radius:8px; border:1px solid #444; width:100%; background:#2c2c2e; color:white">
        </div>
        
        <div style="margin: 15px 0">
          <label style="display:block; margin-bottom:10px; font-weight:600">Car Color</label>
          <div style="display:flex; gap:10px">
            ${colors.map((c, ci) => `<div class="color-option ${ci === config.colorIndex ? 'selected' : ''}" style="background:${c.hex}; width:35px; height:35px; border-radius:50%; cursor:pointer; border:3px solid ${ci===config.colorIndex?'#fff':'transparent'}" data-player="${index}" data-color="${ci}"></div>`).join('')}
          </div>
        </div>

        <div style="margin: 15px 0">
          <label style="display:block; margin-bottom:10px; font-weight:600">Select Vehicle</label>
          <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:10px">
            ${[
              { id: 'f1', img: 'assets/vehicles/f1.png', label: 'F1 Car' },
              { id: 'monster', img: 'assets/vehicles/monster.png', label: 'Monster Truck' },
              { id: 'bike', img: 'assets/vehicles/bike.png', label: 'Motorcycle' },
              { id: 'truck', img: 'assets/vehicles/truck.png', label: 'Semi-Truck' }
            ].map(v => `
              <div class="vehicle-option ${config.vehicleType === v.id ? 'selected' : ''}" 
                   data-player="${index}" data-vehicle="${v.id}">
                <img src="${v.img}" class="vehicle-thumb" alt="${v.label}">
                <div class="vehicle-label">${v.label}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <div style="margin: 15px 0">
          <label style="display:block; margin-bottom:10px; font-weight:600">Arithmetics</label>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px">
            ${ops.map(o => `
              <div style="background:#2c2c2e; padding:10px; border-radius:10px">
                <label style="display:flex; align-items:center; gap:8px; cursor:pointer; margin-bottom:5px">
                  <input type="checkbox" ${config.operations.includes(o) ? 'checked' : ''} data-player="${index}" data-op="${o}" class="op-checkbox">
                  ${o.charAt(0).toUpperCase() + o.slice(1)}
                </label>
                <select data-player="${index}" data-op="${o}" class="diff-select" style="width:100%; padding:5px; border-radius:5px; border:none; background:#3a3a3c; color:white; font-size:12px">
                  ${diffs.map(d => `<option value="${d}" ${config.difficulties[o] === d ? 'selected' : ''}>${d.toUpperCase()}</option>`).join('')}
                </select>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `).join('');
    setupConfigListeners();
  }

  function setupConfigListeners() {
    elements.playerConfigsContainer.querySelectorAll('.player-name-input').forEach(i => i.addEventListener('input', e => {
      playerConfigs[e.target.dataset.player].name = e.target.value;
      saveSettings();
    }));
    elements.playerConfigsContainer.querySelectorAll('.color-option').forEach(o => o.addEventListener('click', e => {
      playerConfigs[e.target.dataset.player].colorIndex = parseInt(e.target.dataset.color);
      saveSettings();
      renderPlayerConfigs();
    }));
    elements.playerConfigsContainer.querySelectorAll('.vehicle-option').forEach(o => o.addEventListener('click', e => {
      const el = e.currentTarget;
      playerConfigs[el.dataset.player].vehicleType = el.dataset.vehicle;
      saveSettings();
      renderPlayerConfigs();
    }));
    elements.playerConfigsContainer.querySelectorAll('.op-checkbox').forEach(c => c.addEventListener('change', e => {
      const p = e.target.dataset.player, op = e.target.dataset.op;
      if (e.target.checked) playerConfigs[p].operations.push(op);
      else playerConfigs[p].operations = playerConfigs[p].operations.filter(x => x !== op);
      saveSettings();
    }));
    elements.playerConfigsContainer.querySelectorAll('.diff-select').forEach(s => s.addEventListener('change', e => {
      playerConfigs[e.target.dataset.player].difficulties[e.target.dataset.op] = e.target.value;
      saveSettings();
    }));
  }

  function startGame() {
    try {
      showScreen('game-screen');
      elements.mathQuestion.textContent = "Get Ready!";
      elements.answerButtons.innerHTML = "";
      
      if (!Track.init('track-canvas')) return;
      Track.setTotalLaps(gameSettings.laps);
      Track.setTrack(gameSettings.track);
      Track.startAnimation();

      Game.init({ players: playerConfigs, speed: gameSettings.speed, laps: gameSettings.laps, track: gameSettings.track });
      Game.setCallbacks({
        onTimeUpdate: (t) => elements.gameTimer.textContent = `${Math.floor(t / 60)}:${(t % 60).toString().padStart(2, '0')}`,
        onPlayerUpdate: (p) => renderStatsBar(p),
        onQuestionReady: (d) => renderQuestion(d),
        onGameEnd: (d) => handleGameEnd(d),
        onCountdownTick: (tick) => handleCountdownTick(tick)
      });

      renderStatsBar(Players.getPlayers());
      Game.start();
    } catch (err) { console.error(err); }
  }

  function handleCountdownTick(tick) {
    if (tick === null) {
      elements.countdownOverlay.style.display = 'none';
      return;
    }
    
    elements.countdownOverlay.style.display = 'flex';
    if (tick === 'GO!') {
      elements.countdownText.textContent = '🏁 GO! 🏁';
      elements.countdownText.style.fontSize = '150px';
    } else {
      elements.countdownText.textContent = tick;
      elements.countdownText.style.fontSize = '200px';
    }
  }

  function renderStatsBar(players) {
    if (!elements.playersStatsBar) return;
    elements.playersStatsBar.innerHTML = players.map(p => {
      const isActive = p.isAnswering;
      return `
        <div class="player-stat ${isActive ? 'active' : ''}" ${isActive ? `style="border-color: ${p.color.hex}; border-width: 5px; box-shadow: 0 0 15px ${p.color.hex}44;"` : ''}>
          <div style="display:flex; justify-content:space-between; font-weight:700; font-size:16px">
            <span style="color:${p.color.hex}">${p.name}</span>
            <span>Lap ${p.laps}/${gameSettings.laps}</span>
          </div>
          <div class="player-stat-bar"><div class="player-stat-progress" style="width:${p.position}%; background:${p.color.hex}"></div></div>
          <div style="font-size:14px; font-weight:600">
            <span style="color: var(--system-green);">Correct: ${p.correctAnswers}</span> | 
            <span style="color: var(--system-red);">Wrong: ${p.wrongAnswers}</span>
            ${p.isFrozen ? ' | <span style="color:red">WAITING</span>' : ''}
          </div>
        </div>
      `;
    }).join('');
    const leader = players.reduce((a, b) => (a.totalProgress > b.totalProgress) ? a : b, players[0]);
    if (leader && elements.leaderName && elements.leaderLap) {
      elements.leaderName.textContent = leader.name;
      elements.leaderName.style.color = leader.color.hex;
      elements.leaderLap.textContent = `(Lap ${Math.min(leader.laps, gameSettings.laps)})`;
    }
  }

  function renderQuestion({ player, question }) {
    if (elements.headerPlayerName) {
      elements.headerPlayerName.textContent = player.name;
      elements.headerPlayerName.style.color = player.color.hex;
    }
    
    elements.mathQuestion.textContent = question.question;
    elements.mathQuestion.style.color = player.color.hex;
    elements.answerButtons.innerHTML = question.answers.sort(() => Math.random() - 0.5).map(a => `<button class="btn-answer" data-answer="${a}">${a}</button>`).join('');
    elements.answerButtons.querySelectorAll('.btn-answer').forEach(b => b.addEventListener('click', e => {
      const sel = parseInt(e.target.dataset.answer);
      elements.answerButtons.querySelectorAll('.btn-answer').forEach(btn => btn.style.pointerEvents = 'none');
      if (sel === question.correctAnswer) e.target.classList.add('correct'); else e.target.classList.add('wrong');
      Game.submitAnswer(sel);
    }));
  }

  function handleGameEnd({ winner, rankings }) {
    Track.stopAnimation(); Fireworks.start();
    
    // Save eligible players to leaderboard
    rankings.filter(p => p.finished).forEach(saveToLeaderboard);

    // Build Podium
    if (elements.podiumContainer) {
      // Get top 3 finished players, sorting by finishPosition
      const top3 = rankings.slice(0, 3);
      
      // We want to arrange them dynamically. Visually: [2nd] [1st] [3rd]
      let podiumOrder = [];
      if(top3.length === 1) podiumOrder = [top3[0]];
      else if(top3.length === 2) podiumOrder = [top3[1], top3[0]];
      else if(top3.length >= 3) podiumOrder = [top3[1], top3[0], top3[2]];

      elements.podiumContainer.innerHTML = podiumOrder.map(p => {
        // Need to explicitly pull final accuracy, correct/wrong answers directly.
        // And rank should literally be 1, 2, or 3 based on array index inside top3, not strictly p.finishPosition just in case.
        const rankIndex = top3.findIndex(x => x.id === p.id);
        const rank = rankIndex !== -1 ? rankIndex + 1 : p.finishPosition;

        return `
          <div class="podium-step rank-${rank}">
            <div class="podium-player-name" style="color: ${p.color.hex}">${p.name}</div>
            <div class="podium-stats">
              <span class="stat-correct" title="Correct">✓ ${p.correctAnswers}</span>
              <span class="stat-wrong" title="Wrong">✗ ${p.wrongAnswers}</span>
            </div>
            <div class="podium-block">
              <span class="podium-rank">#${rank}</span>
            </div>
          </div>
        `;
      }).join('');
    }

    elements.resultsRows.innerHTML = rankings.map((p, i) => `
      <div class="results-row">
        <div>${i+1}</div>
        <div style="color:${p.color.hex}">${p.name}</div>
        <div style="color:var(--system-green)">${p.correctAnswers}</div>
        <div style="color:var(--system-red)">${p.wrongAnswers}</div>
        <div>${p.accuracy}%</div>
      </div>
    `).join('');
    
    setTimeout(() => showScreen('results-screen'), 1000);
  }

  return { init };
})();
document.addEventListener('DOMContentLoaded', () => App.init());