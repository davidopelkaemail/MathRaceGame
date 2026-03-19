/**
 * Game Module - Main Game Logic
 * Handles game state, turns, timing, and core gameplay
 */

const Game = (function() {
  // Game state
  let gameState = 'idle'; // idle, countdown, playing, finished
  let players = [];
  let currentQuestion = null;
  let timeElapsed = 0;
  let gameTimer = null;
  let moveTimer = null;
  let countdownTimer = null;
  let isProcessingAnswer = false;
  
  // Settings
  let speedLevel = 5; // Levels 1-10
  let totalLaps = 5;
  let currentTrack = 'oval';
  let normalSpeed = 0; // Speed per tick (100ms)
  
  // Constants
  const TICK_RATE = 100; // ms
  const QUIZ_MOVE_DELAY = 300; // ms delay after answer before next player
  
  // Callbacks
  let onStateChange = null;
  let onTimeUpdate = null;
  let onPlayerUpdate = null;
  let onQuestionReady = null;
  let onAnswerResult = null;
  let onGameEnd = null;
  let onCountdownTick = null;
  
  /**
   * Calculate speed based on speed level
   */
  function calculateSpeed() {
    // Current default: 5 laps (500 units) in 3 minutes (180s)
    // 180s at 10 ticks/s = 1800 ticks. 500 / 1800 = 0.2777...
    const baseSpeed = 0.2777777777777778; 
    const multiplier = 1 + (speedLevel - 5) * 0.1;
    normalSpeed = baseSpeed * multiplier;
    if (normalSpeed < 0.01) normalSpeed = 0.01;
    if (normalSpeed > 10.0) normalSpeed = 10.0;
  }

  /**
   * Initialize game with settings
   */
  function init(settings) {
    speedLevel = settings.speed || 5;
    totalLaps = settings.laps || 5;
    currentTrack = settings.track || 'oval';
    
    calculateSpeed();
    
    // 1. Initialize players first
    Players.initializePlayers(settings.players);
    players = Players.getPlayers();
    
    players.forEach((player, i) => {
      player.reset();
      player.position = 0;
      player.laps = 1;
      player.totalProgress = 0;
      player.currentPlace = 1; // Everyone starts at 1st place
    });
    
    // 2. Setup track
    Track.setTrack(currentTrack);
    Track.setTotalLaps(totalLaps);
    
    // 3. Initial car update with FULL player data
    Track.updateCars(players.map(p => ({
      id: p.id,
      name: p.name,
      position: p.position,
      laps: p.laps,
      color: p.color,
      isFrozen: p.isFrozen,
      place: p.currentPlace
    })));
    
    gameState = 'idle';
    timeElapsed = 0;
    isProcessingAnswer = false;
  }

  function setCallbacks(callbacks) {
    onStateChange = callbacks.onStateChange;
    onTimeUpdate = callbacks.onTimeUpdate;
    onPlayerUpdate = callbacks.onPlayerUpdate;
    onQuestionReady = callbacks.onQuestionReady;
    onAnswerResult = callbacks.onAnswerResult;
    onGameEnd = callbacks.onGameEnd;
    onCountdownTick = callbacks.onCountdownTick;
  }

  function start() {
    if (gameState !== 'idle') return;
    gameState = 'countdown';
    if (onStateChange) onStateChange(gameState);
    
    // Show first player name during countdown and highlight them
    const firstPlayer = Players.getCurrentPlayer();
    if (firstPlayer) {
      firstPlayer.isAnswering = true;
      if (onPlayerUpdate) onPlayerUpdate(players);
    }
    
    if (onQuestionReady) onQuestionReady({ 
      player: firstPlayer, 
      question: { question: "Get Ready!", answers: [] } 
    });

    startCountdown();
  }

  function startCountdown() {
    let count = 3;
    if (onCountdownTick) onCountdownTick(count);
    
    countdownTimer = setInterval(() => {
      count--;
      if (count > 0) {
        if (onCountdownTick) onCountdownTick(count);
      } else if (count === 0) {
        if (onCountdownTick) onCountdownTick('GO!');
      } else {
        clearInterval(countdownTimer);
        beginRace();
      }
    }, 1000);
  }

  function beginRace() {
    gameState = 'playing';
    if (onStateChange) onStateChange(gameState);
    if (onCountdownTick) onCountdownTick(null); // Clear overlay
    startGameTimer();
    startCarMovement();
    presentQuestion();
  }

  function startGameTimer() {
    gameTimer = setInterval(() => {
      timeElapsed++;
      // Pass elapsed time instead of remaining time
      if (onTimeUpdate) onTimeUpdate(timeElapsed);
    }, 1000);
  }

  function startCarMovement() {
    moveTimer = setInterval(() => {
      if (gameState !== 'playing') return;
      
      players.forEach(player => {
        if (player.finished) return;
        // Speed calculation logic: in single player mode, car only stops when frozen
        const isStopped = player.isFrozen || (players.length > 1 && player.isAnswering);
        let speed = isStopped ? 0 : normalSpeed;
        if (speed > 0) {
          player.position += speed;
          if (player.position >= 100) {
            player.laps++;
            if (player.laps > totalLaps) {
              player.position = 100;
              player.finished = true;
              player.finishTime = timeElapsed;
              player.finishPosition = players.filter(p => p.finished).length;
            } else {
              player.position -= 100;
            }
          }
        }
        player.totalProgress = (player.laps - 1) * 100 + player.position;
      });

      // Calculate places with tie logic
      const sortedPlayers = [...players].sort((a, b) => b.totalProgress - a.totalProgress);
      let pRank = 1;
      let pScore = sortedPlayers.length > 0 ? sortedPlayers[0].totalProgress : 0;
      
      sortedPlayers.forEach((p, index) => {
        if (p.totalProgress < pScore) {
            pRank = index + 1;
            pScore = p.totalProgress;
        }
        p.currentPlace = pRank;
      });
      
      Track.updateCars(players.map(p => ({
        id: p.id,
        name: p.name,
        position: p.position,
        laps: p.laps,
        color: p.color,
        isFrozen: p.isFrozen,
        place: p.currentPlace,
        vehicleType: p.vehicleType
      })));
      
      if (onPlayerUpdate) onPlayerUpdate(players);
      
      // End game logic:
      // If >1 player: end when only 1 is left racing
      // If 1 player: end when that player finishes
      const racersLeft = players.filter(p => !p.finished).length;
      const shouldEnd = (players.length > 1) ? (racersLeft <= 1) : (racersLeft === 0);
      if (shouldEnd) endGame();
    }, TICK_RATE);
  }

  function presentQuestion() {
    if (gameState !== 'playing') return;
    
    // Safeguard: Reset answering status for all players before picking the next one
    players.forEach(p => p.isAnswering = false);

    let player = Players.getCurrentPlayer();
    if (player.finished) {
      Players.nextPlayer();
      player = Players.getCurrentPlayer();
      if (players.every(p => p.finished)) { endGame(); return; }
      presentQuestion(); // Recursive call handles multiple finished players in a row
      return;
    }
    currentQuestion = Quiz.generateQuestion(player.correctConfig);
    player.isAnswering = true;
    if (onQuestionReady) onQuestionReady({ player, question: currentQuestion });
  }

  function submitAnswer(answer) {
    if (gameState !== 'playing' || isProcessingAnswer) return;
    isProcessingAnswer = true;
    
    const currentPlayer = Players.getCurrentPlayer();
    const isCorrect = Quiz.checkAnswer(currentQuestion, answer);
    
    if (onAnswerResult) onAnswerResult(isCorrect, currentPlayer);

    // Clear answering status immediately so they can potentially move during the delay
    currentPlayer.isAnswering = false;

    // Record results and update frozen status for the answering player
    if (isCorrect) {
      currentPlayer.recordCorrectAnswer();
      currentPlayer.isFrozen = false;
    } else {
      currentPlayer.recordWrongAnswer();
      currentPlayer.isFrozen = true;
    }
    
    // Advance to next player
    Players.nextPlayer();
    
    // RULE: Any answer from a player unfreezes all OTHER players
    // This allows previously frozen players to resume while the next person thinks
    players.forEach(p => {
      if (p.id !== currentPlayer.id) {
        p.isFrozen = false;
      }
    });

    setTimeout(() => {
      isProcessingAnswer = false;
      presentQuestion();
    }, QUIZ_MOVE_DELAY);
  }

  function endGame() {
    if (gameTimer) clearInterval(gameTimer);
    if (moveTimer) clearInterval(moveTimer);
    gameState = 'finished';
    if (onStateChange) onStateChange(gameState);
    const rankings = [...players].sort((a, b) => {
      if (a.finished && b.finished) return a.finishPosition - b.finishPosition;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.totalProgress - a.totalProgress;
    });
    if (onGameEnd) onGameEnd({ winner: rankings[0], rankings });
  }

  return {
    init, setCallbacks, start, submitAnswer, 
    getFormattedTime: () => {
      const mins = Math.floor(timeElapsed / 60);
      const secs = timeElapsed % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    },
    getState: () => gameState
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Game;