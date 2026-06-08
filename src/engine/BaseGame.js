const { EVENTS, ROOM_STATUS } = require('../shared/constants');

/**
 * Classe de base pour tous les jeux.
 * Chaque jeu hérite de BaseGame et implémente :
 *   - setup()        : initialise l'état du jeu
 *   - handleAction() : traite une action joueur
 *   - getState()     : retourne l'état sérialisable
 *
 * La logique réseau (broadcast, tours, fin de partie) est entièrement ici.
 */
class BaseGame {
  /**
   * @param {Room}   room    - La Room parente
   * @param {object} config  - Config choisie par le créateur (ex: {id:'1v1', teams:[[1],[1]]})
   */
  constructor(room, config) {
    this.room      = room;
    this.config    = config;
    this.players   = room.players;   // Map<id, Player>
    this.status    = ROOM_STATUS.WAITING;
    this.turnIndex = 0;
    this.turnOrder = [];   // [playerId, ...] dans l'ordre des tours
    this.winner    = null; // playerId | 'draw' | null
  }

  // ── Cycle de vie ──────────────────────────────────────────────────────────

  /** Appelé par Room.startGame() - NE PAS surcharger, surcharger setup() */
  start() {
    this._assignTeams();
    this.turnOrder = [...this.players.keys()];
    this.status    = ROOM_STATUS.PLAYING;
    this.setup();
    this.broadcastState();
    this.broadcastEvent(EVENTS.GAME_START, {
      config:    this.config,
      turnOrder: this.turnOrder,
      state:     this.getState(),
      players:   [...this.players.values()].map(p => p.toJSON()),
    });
  }

  /**
   * Initialise l'état interne du jeu.
   * À surcharger obligatoirement.
   */
  setup() {
    throw new Error(`${this.constructor.name} doit implémenter setup()`);
  }

  /**
   * Traite une action d'un joueur.
   * @param {Player} player
   * @param {object} action  - Payload libre défini par chaque jeu
   * À surcharger obligatoirement.
   */
  handleAction(player, action) {
    throw new Error(`${this.constructor.name} doit implémenter handleAction()`);
  }

  /**
   * Retourne l'état courant sérialisable (JSON).
   * À surcharger obligatoirement.
   */
  getState() {
    throw new Error(`${this.constructor.name} doit implémenter getState()`);
  }

  // ── Helpers utilisables dans les sous-classes ─────────────────────────────

  /** Joueur dont c'est le tour */
  get currentPlayer() {
    return this.players.get(this.turnOrder[this.turnIndex]);
  }

  /** Vérifie que c'est bien le tour du joueur donné */
  isPlayerTurn(player) {
    return this.currentPlayer && this.currentPlayer.id === player.id;
  }

  /** Passe au joueur suivant */
  nextTurn() {
    this.turnIndex = (this.turnIndex + 1) % this.turnOrder.length;
  }

  /** Termine la partie avec un gagnant ou un match nul */
  endGame(winnerId = null) {
    this.status = ROOM_STATUS.FINISHED;
    this.winner = winnerId || 'draw';

    if (winnerId && this.players.has(winnerId)) {
      this.players.get(winnerId).score += 1;
    }

    this.broadcastEvent(EVENTS.GAME_END, {
      winner: this.winner,
      state:  this.getState(),
      scores: [...this.players.values()].map(p => ({ id: p.id, name: p.name, score: p.score })),
    });

    this.room.status = ROOM_STATUS.FINISHED;
  }

  /** Diffuse l'état courant à tous les joueurs */
  broadcastState() {
    this.broadcastEvent(EVENTS.GAME_STATE, {
      state:         this.getState(),
      currentPlayer: this.currentPlayer ? this.currentPlayer.id : null,
    });
  }

  /** Diffuse un événement à tous les joueurs de la room */
  broadcastEvent(event, data) {
    for (const player of this.players.values()) {
      player.send(event, data);
    }
  }

  /** Envoie un événement uniquement à un joueur */
  sendToPlayer(playerId, event, data) {
    const player = this.players.get(playerId);
    if (player) player.send(event, data);
  }

  // ── Privé ─────────────────────────────────────────────────────────────────

  _assignTeams() {
    const playerList = [...this.players.values()];
    let playerIdx = 0;
    this.config.teams.forEach((team, teamId) => {
      const slots = Array.isArray(team) ? team.length : team;
      for (let i = 0; i < slots && playerIdx < playerList.length; i++, playerIdx++) {
        playerList[playerIdx].setTeam(teamId);
      }
    });
  }
}

module.exports = BaseGame;
