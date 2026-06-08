const Player      = require('./Player');
const Room        = require('./Room');
const { EVENTS, GAME_CATALOG, ROOM_STATUS } = require('../shared/constants');

/**
 * GameEngine : cerveau central.
 * - Registre des classes de jeu (gameId → Class)
 * - Registre des rooms actives
 * - Registre des joueurs connectés (socketId → Player)
 * - Routage de tous les messages WebSocket
 */
class GameEngine {
  constructor() {
    this._gameRegistry = new Map();  // gameId → GameClass
    this._rooms        = new Map();  // roomId → Room
    this._players      = new Map();  // socketId → Player
  }

  // ── Registre des jeux ─────────────────────────────────────────────────────

  /** Enregistre une classe de jeu. Appelé dans src/games/index.js */
  registerGame(gameId, GameClass) {
    if (!GAME_CATALOG.find(g => g.id === gameId)) {
      throw new Error(`Jeu "${gameId}" absent du GAME_CATALOG dans constants.js`);
    }
    this._gameRegistry.set(gameId, GameClass);
    console.log(`[GameEngine] Jeu enregistré : ${gameId}`);
  }

  getGameClass(gameId) {
    return this._gameRegistry.get(gameId) || null;
  }

  // ── Gestion des connexions ────────────────────────────────────────────────

  onConnect(socketId, socket) {
    const player = new Player(socketId, null, socket);
    this._players.set(socketId, player);
    console.log(`[GameEngine] Connexion : ${socketId} (total: ${this._players.size})`);
    // Informe immédiatement le client de son propre ID
    player.send('self', { id: socketId });
    return player;
  }

  onDisconnect(socketId) {
    const player = this._players.get(socketId);
    if (!player) return;

    // Retire le joueur de sa room si présent
    for (const room of this._rooms.values()) {
      if (room.players.has(socketId)) {
        room.removePlayer(socketId);
        if (room.playerCount === 0) {
          this._rooms.delete(room.id);
          console.log(`[GameEngine] Room supprimée (vide) : ${room.id}`);
        }
        break;
      }
    }

    this._players.delete(socketId);
    console.log(`[GameEngine] Déconnexion : ${socketId} (total: ${this._players.size})`);
  }

  // ── Routage des messages ──────────────────────────────────────────────────

  onMessage(socketId, rawMessage) {
    let parsed;
    try {
      parsed = JSON.parse(rawMessage);
    } catch {
      console.warn(`[GameEngine] Message invalide de ${socketId}`);
      return;
    }

    const { event, data } = parsed;
    const player = this._players.get(socketId);
    if (!player) return;

    switch (event) {
      case EVENTS.PING:
        player.send(EVENTS.PONG, { ts: Date.now() });
        break;

      case EVENTS.CREATE_ROOM:
        this._handleCreateRoom(player, data);
        break;

      case EVENTS.JOIN_ROOM:
        this._handleJoinRoom(player, data);
        break;

      case EVENTS.LEAVE_ROOM:
        this._handleLeaveRoom(player);
        break;

      case EVENTS.PLAYER_READY:
        this._handlePlayerReady(player, data);
        break;

      case EVENTS.GAME_ACTION:
        this._handleGameAction(player, data);
        break;

      case EVENTS.ROOM_LIST:
        this._handleRoomList(player);
        break;

      default:
        console.warn(`[GameEngine] Événement inconnu "${event}" de ${socketId}`);
    }
  }

  // ── Handlers privés ───────────────────────────────────────────────────────

  _handleCreateRoom(player, data) {
    try {
      const { gameId, configId, playerName } = data;
      if (playerName) player.name = playerName;

      const gameDef = GAME_CATALOG.find(g => g.id === gameId);
      if (!gameDef) throw new Error(`Jeu inconnu : ${gameId}`);

      const config = gameDef.configs.find(c => c.id === configId);
      if (!config) throw new Error(`Config inconnue : ${configId}`);

      const room = new Room(player.id, gameId, config, this);
      this._rooms.set(room.id, room);
      room.addPlayer(player);

      player.send(EVENTS.ROOM_UPDATED, { room: room.toJSON() });
      console.log(`[GameEngine] Room créée : ${room.id} (${gameId}/${configId})`);
    } catch (err) {
      player.send(EVENTS.ROOM_ERROR, { message: err.message });
    }
  }

  _handleJoinRoom(player, data) {
    try {
      const { roomId, playerName } = data;
      if (playerName) player.name = playerName;

      const room = this._rooms.get(roomId);
      if (!room) throw new Error(`Salon introuvable : ${roomId}`);

      room.addPlayer(player);
      player.send(EVENTS.ROOM_UPDATED, { room: room.toJSON() });

      // Démarrage automatique si la room est pleine et tous les joueurs sont là
      if (room.isFull) {
        room.startGame();
      }
    } catch (err) {
      player.send(EVENTS.ROOM_ERROR, { message: err.message });
    }
  }

  _handleLeaveRoom(player) {
    for (const room of this._rooms.values()) {
      if (room.players.has(player.id)) {
        room.removePlayer(player.id);
        if (room.playerCount === 0) {
          this._rooms.delete(room.id);
        }
        break;
      }
    }
  }

  _handlePlayerReady(player, data) {
    for (const room of this._rooms.values()) {
      if (room.players.has(player.id)) {
        room.setPlayerReady(player.id, data?.isReady !== false);
        break;
      }
    }
  }

  _handleGameAction(player, data) {
    for (const room of this._rooms.values()) {
      if (room.players.has(player.id)) {
        room.handleGameAction(player, data?.action || data);
        break;
      }
    }
  }

  _handleRoomList(player) {
    const rooms = [...this._rooms.values()]
      .filter(r => r.status === ROOM_STATUS.WAITING && !r.isFull)
      .map(r => r.toJSON());
    player.send(EVENTS.ROOM_LIST, { rooms });
  }
}

module.exports = GameEngine;
