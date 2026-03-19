/**
 * Players Module - Player Management
 * Handles player creation, configuration, and state management
 */

const Players = (function() {
  // Available car colors
  const CAR_COLORS = [
    { name: 'Red', hex: '#EF4444', css: '#ef4444' },
    { name: 'Blue', hex: '#3B82F6', css: '#3b82f6' },
    { name: 'Green', hex: '#22C55E', css: '#22c55e' },
    { name: 'Yellow', hex: '#EAB308', css: '#eab308' },
    { name: 'Purple', hex: '#A855F7', css: '#a855f7' },
    { name: 'Orange', hex: '#F97316', css: '#f97316' },
    { name: 'Pink', hex: '#EC4899', css: '#ec4899' },
    { name: 'Cyan', hex: '#06B6D4', css: '#06b6d4' }
  ];

  // Default player configuration
  const DEFAULT_PLAYER_CONFIG = {
    name: 'Player',
    colorIndex: 0,
    operations: ['addition', 'subtraction'],
    difficulties: {
      addition: 'easy',
      subtraction: 'easy',
      multiplication: 'easy',
      division: 'easy'
    },
    vehicleType: 'f1'
  };

  // Player state class
  class Player {
    constructor(id, config) {
      this.id = id;
      this.name = config.name || `Player ${id + 1}`;
      this.colorIndex = config.colorIndex ?? (id % CAR_COLORS.length);
      this.operations = config.operations || ['addition', 'subtraction'];
      this.difficulties = { ...DEFAULT_PLAYER_CONFIG.difficulties, ...config.difficulties };
      this.vehicleType = config.vehicleType || DEFAULT_PLAYER_CONFIG.vehicleType;
      
      // Game state
      this.position = 0; // 0 to 100 (percentage)
      this.laps = 1; // Current lap
      this.totalProgress = 0; // (laps-1) * 100 + position
      this.correctAnswers = 0;
      this.wrongAnswers = 0;
      this.isAnswering = false;
      this.isPaused = false;
      this.isFrozen = false; // Frozen until next player answers
      this.finished = false;
      this.finishPosition = null;
      this.finishTime = null;
    }

    get color() {
      return CAR_COLORS[this.colorIndex] || CAR_COLORS[0];
    }

    get accuracy() {
      const total = this.correctAnswers + this.wrongAnswers;
      if (total === 0) return 0;
      return Math.round((this.correctAnswers / total) * 100);
    }

    get correctConfig() {
      return {
        name: this.name,
        colorIndex: this.colorIndex,
        operations: this.operations,
        difficulties: { ...this.difficulties },
        vehicleType: this.vehicleType
      };
    }

    recordCorrectAnswer() {
      this.correctAnswers++;
    }

    recordWrongAnswer() {
      this.wrongAnswers++;
    }

    reset() {
      this.position = 0;
      this.laps = 1;
      this.totalProgress = 0;
      this.correctAnswers = 0;
      this.wrongAnswers = 0;
      this.isAnswering = false;
      this.isPaused = false;
      this.isFrozen = false;
      this.finished = false;
      this.finishPosition = null;
      this.finishTime = null;
    }
  }

  // Players manager
  let players = [];
  let currentPlayerIndex = 0;

  /**
   * Initialize players from configuration
   */
  function initializePlayers(configs) {
    players = configs.map((config, index) => new Player(index, config));
    currentPlayerIndex = 0;
    return players;
  }

  /**
   * Get all players
   */
  function getPlayers() {
    return players;
  }

  /**
   * Get player by ID
   */
  function getPlayer(id) {
    return players.find(p => p.id === id);
  }

  /**
   * Get current player who's answering
   */
  function getCurrentPlayer() {
    return players[currentPlayerIndex];
  }

  /**
   * Get next player index
   */
  function getNextPlayerIndex() {
    return (currentPlayerIndex + 1) % players.length;
  }

  /**
   * Move to next player
   */
  function nextPlayer() {
    // Find next player who hasn't finished
    let attempts = 0;
    do {
      currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
      attempts++;
    } while (players[currentPlayerIndex].finished && attempts < players.length);
    
    return players[currentPlayerIndex];
  }

  /**
   * Set current player by index
   */
  function setCurrentPlayer(index) {
    if (index >= 0 && index < players.length) {
      currentPlayerIndex = index;
      return players[currentPlayerIndex];
    }
    return null;
  }

  /**
   * Get player count
   */
  function getPlayerCount() {
    return players.length;
  }

  /**
   * Get leader (player with highest position)
   */
  function getLeader() {
    if (players.length === 0) return null;
    return players.reduce((leader, player) => 
      player.position > leader.position ? player : leader
    , players[0]);
  }

  /**
   * Get rankings (sorted by position)
   */
  function getRankings() {
    return [...players].sort((a, b) => b.position - a.position);
  }

  /**
   * Check if any player has finished
   */
  function checkFinish() {
    for (const player of players) {
      if (player.position >= 100) {
        player.position = 100;
        if (!player.finished) {
          player.finished = true;
          const finishedCount = players.filter(p => p.finished).length;
          player.finishPosition = finishedCount;
        }
        return player;
      }
    }
    return null;
  }

  /**
   * Check if all players have finished
   */
  function allFinished() {
    return players.every(p => p.finished);
  }

  /**
   * Get winner (first to finish)
   */
  function getWinner() {
    return players.find(p => p.finished && p.finishPosition === 1);
  }

  /**
   * Get car colors for selection
   */
  function getCarColors() {
    return CAR_COLORS;
  }

  /**
   * Reset all players for new game
   */
  function resetAll() {
    for (const player of players) {
      player.reset();
    }
    currentPlayerIndex = 0;
  }

  // Public API
  return {
    initializePlayers: initializePlayers,
    getPlayers: getPlayers,
    getPlayer: getPlayer,
    getCurrentPlayer: getCurrentPlayer,
    getNextPlayerIndex: getNextPlayerIndex,
    nextPlayer: nextPlayer,
    setCurrentPlayer: setCurrentPlayer,
    getPlayerCount: getPlayerCount,
    getLeader: getLeader,
    getRankings: getRankings,
    checkFinish: checkFinish,
    allFinished: allFinished,
    getWinner: getWinner,
    getCarColors: getCarColors,
    resetAll: resetAll,
    CAR_COLORS: CAR_COLORS,
    DEFAULT_PLAYER_CONFIG: DEFAULT_PLAYER_CONFIG
  };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Players;
}