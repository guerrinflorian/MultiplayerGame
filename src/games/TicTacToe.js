const BaseGame = require('../engine/BaseGame');
const { EVENTS } = require('../shared/constants');

const WIN_LINES = [
  [0,1,2],[3,4,5],[6,7,8], // lignes
  [0,3,6],[1,4,7],[2,5,8], // colonnes
  [0,4,8],[2,4,6],          // diagonales
];

class TicTacToe extends BaseGame {
  setup() {
    this.board   = Array(9).fill(null);  // null | playerId
    this.symbols = {};                    // playerId → 'X' | 'O'

    const ids = [...this.players.keys()];
    this.symbols[ids[0]] = 'X';
    this.symbols[ids[1]] = 'O';
  }

  handleAction(player, action) {
    const { cell } = action;

    if (!this.isPlayerTurn(player)) {
      player.send(EVENTS.GAME_ERROR, { message: "Ce n'est pas votre tour" });
      return;
    }
    if (typeof cell !== 'number' || cell < 0 || cell > 8) {
      player.send(EVENTS.GAME_ERROR, { message: 'Case invalide' });
      return;
    }
    if (this.board[cell] !== null) {
      player.send(EVENTS.GAME_ERROR, { message: 'Case déjà jouée' });
      return;
    }

    this.board[cell] = player.id;

    const winnerId = this._checkWinner();
    if (winnerId) {
      this.broadcastState();
      this.endGame(winnerId);
      return;
    }

    if (this.board.every(c => c !== null)) {
      this.broadcastState();
      this.endGame(null); // match nul
      return;
    }

    this.nextTurn();
    this.broadcastState();
  }

  getState() {
    return {
      board:         this.board,
      symbols:       this.symbols,
      currentPlayer: this.currentPlayer ? this.currentPlayer.id : null,
    };
  }

  _checkWinner() {
    for (const [a, b, c] of WIN_LINES) {
      if (this.board[a] && this.board[a] === this.board[b] && this.board[a] === this.board[c]) {
        return this.board[a];
      }
    }
    return null;
  }
}

module.exports = TicTacToe;
