class TicTacToeView extends BaseGameView {
  render() {
    this.state   = this.startData.state;
    this.myId    = this.startData.turnOrder
      ? this._detectMyId()
      : this.myId;

    this.container.innerHTML = `
      <div class="ttt-wrapper">
        <div id="ttt-status" class="ttt-status"></div>
        <div id="ttt-board" class="ttt-board">
          ${Array(9).fill(null).map((_, i) =>
            `<button class="ttt-cell" data-cell="${i}"></button>`
          ).join('')}
        </div>
        <div id="ttt-symbol" class="ttt-symbol"></div>
      </div>
    `;

    this._bindClicks();
    this.onState({ state: this.state, currentPlayer: this.startData.state.currentPlayer });
  }

  onState({ state, currentPlayer }) {
    this.state         = state;
    this.currentPlayer = currentPlayer;

    // Met à jour le plateau
    state.board.forEach((cell, i) => {
      const btn = this.container.querySelector(`[data-cell="${i}"]`);
      if (!btn) return;
      const sym = cell ? state.symbols[cell] : '';
      btn.textContent = sym;
      btn.classList.toggle('played', !!cell);
      btn.classList.toggle('sym-x', sym === 'X');
      btn.classList.toggle('sym-o', sym === 'O');
      btn.disabled = !!cell || currentPlayer !== this.myId;
    });

    // Statut
    const statusEl = document.getElementById('ttt-status');
    const symEl    = document.getElementById('ttt-symbol');
    const mySymbol = state.symbols[this.myId];

    symEl.textContent = mySymbol ? `Vous jouez : ${mySymbol}` : '';

    if (currentPlayer === this.myId) {
      statusEl.textContent = 'À votre tour !';
      statusEl.className   = 'ttt-status your-turn';
    } else {
      statusEl.textContent = "Tour de l'adversaire…";
      statusEl.className   = 'ttt-status wait';
    }
  }

  onEnd(data) {
    // Désactiver toutes les cellules
    this.container.querySelectorAll('.ttt-cell').forEach(btn => btn.disabled = true);
    super.onEnd(data);
  }

  _bindClicks() {
    this.container.addEventListener('click', (e) => {
      const btn = e.target.closest('.ttt-cell');
      if (!btn || btn.disabled) return;
      const cell = parseInt(btn.dataset.cell, 10);
      this.client.sendAction({ cell });
    });
  }

  _detectMyId() {
    // Le serveur inclut turnOrder dans game:start, mais on ne connaît pas
    // notre propre socketId côté client. On le déduit depuis room.players
    // via UIManager qui passe myId. Ici on retourne simplement this.myId.
    return this.myId;
  }
}
