/**
 * UIManager - orchestre les vues (Lobby / Room / Jeu).
 */

const GAME_META = {
  'tictactoe':        { icon: '╋', tagline: 'Classique · 1v1',       color: '#f5a623', players: '2 joueurs' },
  'poisoned-chalice': { icon: '⚗', tagline: 'Bluff · trahison',      color: '#d946ef', players: '2 joueurs' },
  'visual-echo':      { icon: '◈', tagline: 'Mémoire · vitesse',     color: '#00d4ff', players: '2–4 joueurs' },
  'maze-duel':        { icon: '⬡', tagline: 'Labyrinthe · stratégie', color: '#39ff14', players: '2 joueurs' },
};

class UIManager {
  constructor(client) {
    this.client          = client;
    this.gameViews       = new Map();
    this.myId            = null;
    this.room            = null;
    this.activeGameView  = null;
    this._selectedGameId = null;

    this._bindClientEvents();
    this._bindUIEvents();
    this._populateGamePicker();
    this.showView('lobby');
  }

  registerGameView(gameId, ViewClass) {
    this.gameViews.set(gameId, ViewClass);
  }

  showView(name) {
    document.querySelectorAll('[data-view]').forEach(el => {
      el.classList.toggle('hidden', el.dataset.view !== name);
    });
  }

  // ── Client events ─────────────────────────────────────────

  _bindClientEvents() {
    const c = this.client;

    c.on('connected', () => {
      document.getElementById('status-dot').classList.add('online');
      document.getElementById('status-text').textContent = 'Connecté';
    });

    c.on('disconnected', () => {
      document.getElementById('status-dot').classList.remove('online');
      document.getElementById('status-text').textContent = 'Reconnexion…';
    });

    c.on(EVENTS.ROOM_ERROR, ({ message }) => this._showError(message));

    c.on(EVENTS.ROOM_UPDATED, ({ room }) => {
      this.room = room;
      this._renderRoomWaiting();
      this.showView('room');
    });

    c.on(EVENTS.PLAYER_JOINED, ({ player, room }) => {
      this.room = room;
      this._renderRoomWaiting();
    });

    c.on(EVENTS.PLAYER_LEFT, ({ playerId, room }) => {
      this.room = room;
      if (room) this._renderRoomWaiting();
    });

    c.on(EVENTS.GAME_START,  (data)  => this._launchGameView(data));
    c.on(EVENTS.GAME_STATE,  (data)  => { if (this.activeGameView) this.activeGameView.onState(data); });
    c.on(EVENTS.GAME_END,    (data)  => { if (this.activeGameView) this.activeGameView.onEnd(data); });
    c.on(EVENTS.GAME_ERROR,  ({ message }) => this._showError(message));
    c.on(EVENTS.ROOM_LIST,   ({ rooms }) => this._renderRoomList(rooms));
    c.on(EVENTS.PLAYER_READY,({ room }) => { this.room = room; this._renderRoomWaiting(); });
  }

  // ── UI events ─────────────────────────────────────────────

  _bindUIEvents() {
    document.getElementById('btn-create').addEventListener('click', () => {
      if (!this._selectedGameId) return this._showError('Sélectionnez un jeu');
      const name     = document.getElementById('input-name').value.trim() || undefined;
      const configId = document.getElementById('select-config').value;
      this.client.createRoom({ gameId: this._selectedGameId, configId, playerName: name });
    });

    document.getElementById('btn-join').addEventListener('click', () => {
      const name   = document.getElementById('input-name').value.trim() || undefined;
      const roomId = document.getElementById('input-room-id').value.trim().toUpperCase();
      if (!roomId) return this._showError('Entrez un code de salon');
      this.client.joinRoom({ roomId, playerName: name });
    });

    document.getElementById('btn-browse').addEventListener('click', () => {
      this.client.requestRoomList();
    });

    const leaveHandler = () => {
      this.client.leaveRoom();
      this.room = null;
      this.activeGameView = null;
      this.showView('lobby');
    };
    document.getElementById('btn-leave-room').addEventListener('click', leaveHandler);
    document.getElementById('btn-leave-room-2').addEventListener('click', leaveHandler);

    // Enter key on room code input
    document.getElementById('input-room-id').addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('btn-join').click();
    });
  }

  // ── Game picker ───────────────────────────────────────────

  _populateGamePicker() {
    const container = document.getElementById('game-picker');
    if (!container) return;

    GAME_CATALOG.forEach(game => {
      const meta = GAME_META[game.id] || { icon: '?', tagline: '', color: '#888', players: '' };
      const card = document.createElement('div');
      card.className = 'game-card';
      card.dataset.gameId = game.id;
      card.style.setProperty('--card-color', meta.color);
      card.innerHTML = `
        <div class="game-card-icon">${meta.icon}</div>
        <div class="game-card-name">${game.name}</div>
        <div class="game-card-tag">${meta.tagline}</div>
        <div class="game-card-players">${meta.players}</div>
      `;
      card.addEventListener('click', () => this._selectGame(game.id));
      container.appendChild(card);
    });

    if (GAME_CATALOG.length > 0) this._selectGame(GAME_CATALOG[0].id);
  }

  _selectGame(gameId) {
    this._selectedGameId = gameId;
    document.querySelectorAll('.game-card').forEach(card => {
      card.classList.toggle('selected', card.dataset.gameId === gameId);
    });
    this._updateConfigOptions(gameId);
  }

  _updateConfigOptions(gameId) {
    const game   = GAME_CATALOG.find(g => g.id === gameId);
    const select = document.getElementById('select-config');
    select.innerHTML = '';
    if (!game) return;
    game.configs.forEach(cfg => {
      const opt = document.createElement('option');
      opt.value       = cfg.id;
      opt.textContent = cfg.label;
      select.appendChild(opt);
    });
  }

  // ── Room list ─────────────────────────────────────────────

  _renderRoomList(rooms) {
    const container = document.getElementById('room-list');
    container.innerHTML = '';

    if (!rooms.length) {
      container.innerHTML = '<p class="empty">Aucun salon disponible</p>';
      return;
    }

    rooms.forEach(room => {
      const meta = GAME_META[room.gameId] || { icon: '◉', color: '#00d4ff' };
      const div  = document.createElement('div');
      div.className = 'room-item';
      div.style.setProperty('--card-color', meta.color);
      div.innerHTML = `
        <span class="room-item-icon">${meta.icon}</span>
        <div class="room-item-info">
          <strong>${room.gameName}</strong>
          <span class="room-item-mode">${room.config.label}</span>
        </div>
        <span class="room-item-count">${room.playerCount}/${room.maxPlayers}</span>
        <button class="btn-secondary">Rejoindre</button>
      `;
      div.querySelector('button').addEventListener('click', () => {
        const name = document.getElementById('input-name').value.trim() || undefined;
        this.client.joinRoom({ roomId: room.id, playerName: name });
      });
      container.appendChild(div);
    });
  }

  // ── Room waiting ──────────────────────────────────────────

  _renderRoomWaiting() {
    if (!this.room) return;

    const meta        = GAME_META[this.room.gameId] || { icon: '◉', color: '#00d4ff' };
    const waitingArea = document.getElementById('waiting-area');

    // Apply game color to the waiting room
    if (waitingArea) waitingArea.style.setProperty('--game-color', meta.color);

    const iconEl = document.getElementById('room-game-icon');
    if (iconEl) iconEl.textContent = meta.icon;

    document.getElementById('room-title').textContent  = this.room.gameName;
    document.getElementById('room-code').textContent   = this.room.id;
    document.getElementById('room-config').textContent = this.room.config.label;
    document.getElementById('room-count').textContent  = `${this.room.playerCount} / ${this.room.maxPlayers}`;

    const list = document.getElementById('room-players');
    list.innerHTML = '';
    this.room.players.forEach(p => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="player-dot"></span>
        <span>${p.name}</span>
        <span class="player-status">${p.isReady ? '✓ prêt' : '…'}</span>
      `;
      list.appendChild(li);
    });

    // Copy button - bind only once
    const copyBtn = document.getElementById('btn-copy-code');
    if (copyBtn && !copyBtn._copyBound) {
      copyBtn._copyBound = true;
      copyBtn.addEventListener('click', () => {
        const code = document.getElementById('room-code').textContent;
        navigator.clipboard.writeText(code).catch(() => {});
        copyBtn.textContent = '✓ Copié';
        setTimeout(() => { copyBtn.textContent = 'Copier'; }, 2000);
      });
    }

    document.getElementById('waiting-area').classList.remove('hidden');
    document.getElementById('game-area').classList.add('hidden');
  }

  // ── Game launch ───────────────────────────────────────────

  _launchGameView(startData) {
    const gameId   = this.room?.gameId;
    const ViewClass = this.gameViews.get(gameId);
    const meta      = GAME_META[gameId] || { color: '#00d4ff' };

    document.getElementById('waiting-area').classList.add('hidden');
    const gameArea = document.getElementById('game-area');
    gameArea.classList.remove('hidden');
    gameArea.style.setProperty('--game-color', meta.color);

    const container = document.getElementById('game-container');
    container.innerHTML = '';

    if (ViewClass) {
      this.activeGameView = new ViewClass(container, this.client, startData, this.myId);
    } else {
      container.innerHTML = `<p style="color:var(--muted);font-size:.85rem">Aucune vue disponible pour « ${gameId} ».</p>`;
    }

    document.getElementById('room-title-game').textContent =
      this.room ? `${this.room.gameName} - ${this.room.config.label}` : 'Partie en cours';

    this.showView('room');
  }

  // ── Utility ───────────────────────────────────────────────

  _showError(msg) {
    const el = document.getElementById('error-msg');
    el.textContent = msg;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 4000);
  }
}
