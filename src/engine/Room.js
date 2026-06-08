const { v4: uuidv4 } = require('uuid');
const { EVENTS, ROOM_STATUS, GAME_CATALOG } = require('../shared/constants');

class Room {
  /**
   * @param {string}      creatorId  - ID du joueur créateur
   * @param {string}      gameId     - ID du jeu choisi (cf. GAME_CATALOG)
   * @param {object}      config     - Config équipes choisie
   * @param {GameEngine}  engine     - Référence au GameEngine pour accès aux classes de jeu
   */
  constructor(creatorId, gameId, config, engine) {
    this.id        = uuidv4().slice(0, 8).toUpperCase();
    this.creatorId = creatorId;
    this.gameId    = gameId;
    this.config    = config;
    this.status    = ROOM_STATUS.WAITING;
    this.players   = new Map();  // Map<id, Player>
    this.game      = null;
    this._engine   = engine;

    this.gameDef = GAME_CATALOG.find(g => g.id === gameId);
    if (!this.gameDef) throw new Error(`Jeu inconnu : ${gameId}`);
  }

  get maxPlayers() {
    return this.config.teams.reduce((sum, t) => sum + (Array.isArray(t) ? t.length : t), 0);
  }

  get isFull() {
    return this.players.size >= this.maxPlayers;
  }

  get playerCount() {
    return this.players.size;
  }

  // ── Gestion des joueurs ───────────────────────────────────────────────────

  addPlayer(player) {
    if (this.isFull) throw new Error('Salon plein');
    if (this.status !== ROOM_STATUS.WAITING) throw new Error('Partie déjà en cours');
    this.players.set(player.id, player);
    this._broadcast(EVENTS.PLAYER_JOINED, { player: player.toJSON(), room: this.toJSON() });
  }

  removePlayer(playerId) {
    const player = this.players.get(playerId);
    if (!player) return;
    this.players.delete(playerId);
    player.disconnect();
    this._broadcast(EVENTS.PLAYER_LEFT, { playerId, room: this.toJSON() });

    if (this.status === ROOM_STATUS.PLAYING && this.game) {
      // Partie abandonnée si quelqu'un quitte
      this.game.endGame(null);
    }

    // Si le créateur part, on désigne un nouveau créateur
    if (playerId === this.creatorId && this.players.size > 0) {
      this.creatorId = [...this.players.keys()][0];
    }
  }

  setPlayerReady(playerId, ready) {
    const player = this.players.get(playerId);
    if (!player) return;
    player.setReady(ready);
    this._broadcast(EVENTS.PLAYER_READY, { playerId, isReady: ready, room: this.toJSON() });
  }

  // ── Démarrage du jeu ──────────────────────────────────────────────────────

  startGame() {
    if (this.status !== ROOM_STATUS.WAITING) throw new Error('Partie déjà en cours ou terminée');
    if (this.players.size < this.gameDef.minPlayers) {
      throw new Error(`Il faut au moins ${this.gameDef.minPlayers} joueurs`);
    }

    const GameClass = this._engine.getGameClass(this.gameId);
    if (!GameClass) throw new Error(`Classe introuvable pour : ${this.gameId}`);

    this.game = new GameClass(this, this.config);
    this.status = ROOM_STATUS.PLAYING;
    this.game.start();
  }

  handleGameAction(player, action) {
    if (!this.game || this.status !== ROOM_STATUS.PLAYING) {
      player.send(EVENTS.GAME_ERROR, { message: 'Aucune partie en cours' });
      return;
    }
    this.game.handleAction(player, action);
  }

  // ── Sérialisation ─────────────────────────────────────────────────────────

  toJSON() {
    return {
      id:          this.id,
      gameId:      this.gameId,
      gameName:    this.gameDef.name,
      config:      this.config,
      status:      this.status,
      creatorId:   this.creatorId,
      playerCount: this.playerCount,
      maxPlayers:  this.maxPlayers,
      players:     [...this.players.values()].map(p => p.toJSON()),
    };
  }

  _broadcast(event, data) {
    for (const player of this.players.values()) {
      player.send(event, data);
    }
  }
}

module.exports = Room;
