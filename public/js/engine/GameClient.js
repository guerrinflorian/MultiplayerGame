/**
 * GameClient - couche réseau côté client.
 * Gère la connexion WebSocket, le ping keepalive, et dispatch les événements.
 *
 * Usage :
 *   const client = new GameClient('ws://localhost:3000/ws');
 *   client.on(EVENTS.GAME_STATE, (data) => renderGame(data));
 *   client.createRoom({ gameId: 'tictactoe', configId: '1v1', playerName: 'Alice' });
 */
class GameClient extends EventTarget {
  constructor(wsUrl) {
    super();
    this.wsUrl     = wsUrl;
    this.socket    = null;
    this.connected = false;
    this._pingInterval = null;
    this._connect();
  }

  // ── Connexion ─────────────────────────────────────────────────────────────

  _connect() {
    this.socket = new WebSocket(this.wsUrl);

    this.socket.addEventListener('open', () => {
      this.connected = true;
      this._emit('connected');
      this._startPing();
      console.log('[GameClient] Connecté');
    });

    this.socket.addEventListener('message', (ev) => {
      try {
        const { event, data } = JSON.parse(ev.data);
        this._emit(event, data);
      } catch {
        console.warn('[GameClient] Message invalide', ev.data);
      }
    });

    this.socket.addEventListener('close', () => {
      this.connected = false;
      this._stopPing();
      this._emit('disconnected');
      console.log('[GameClient] Déconnecté, reconnexion dans 3s...');
      setTimeout(() => this._connect(), 3000);
    });

    this.socket.addEventListener('error', (err) => {
      console.error('[GameClient] Erreur WebSocket', err);
    });
  }

  // ── Envoi de messages ─────────────────────────────────────────────────────

  send(event, data = {}) {
    if (!this.connected) {
      console.warn('[GameClient] Non connecté, message ignoré');
      return;
    }
    this.socket.send(JSON.stringify({ event, data }));
  }

  createRoom(opts)    { this.send(EVENTS.CREATE_ROOM, opts); }
  joinRoom(opts)      { this.send(EVENTS.JOIN_ROOM, opts); }
  leaveRoom()         { this.send(EVENTS.LEAVE_ROOM); }
  sendAction(action)  { this.send(EVENTS.GAME_ACTION, { action }); }
  setReady(isReady)   { this.send(EVENTS.PLAYER_READY, { isReady }); }
  requestRoomList()   { this.send(EVENTS.ROOM_LIST); }

  // ── Événements ────────────────────────────────────────────────────────────

  on(event, cb) {
    this.addEventListener(event, (e) => cb(e.detail));
    return this;
  }

  _emit(event, data) {
    this.dispatchEvent(new CustomEvent(event, { detail: data }));
  }

  // ── Ping keepalive ────────────────────────────────────────────────────────

  _startPing() {
    this._pingInterval = setInterval(() => {
      this.send(EVENTS.PING);
    }, 25000);
  }

  _stopPing() {
    if (this._pingInterval) {
      clearInterval(this._pingInterval);
      this._pingInterval = null;
    }
  }
}
