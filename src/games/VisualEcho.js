const BaseGame    = require('../engine/BaseGame');
const { EVENTS, ROOM_STATUS } = require('../shared/constants');

const SYMBOLS      = ['⭐', '🌙', '☀️', '💎', '🔥', '🌊', '⚡', '🍀', '🎯'];
const TOTAL_ROUNDS = 10;
const SHOW_MS      = 3000;  // durée d'affichage de la grille
const ANSWER_MS    = 7000;  // délai max pour répondre après la grille cachée

/**
 * Écho Visuel - FFA 2-4 joueurs, mémoire + rapidité
 *
 * Chaque round :
 *  1. Une grille 3×3 de symboles s'affiche pendant SHOW_MS.
 *     La cible est annoncée dès le départ ("Où était ⭐ ?").
 *  2. La grille disparaît. Les joueurs cliquent sur la case où était la cible.
 *  3. Points selon l'ordre d'arrivée des bonnes réponses :
 *       1er juste : N pts (N = nombre de joueurs)
 *       2e  juste : N-1 pts  …  dernier juste : 1 pt
 *       Mauvaise réponse ou timeout : 0 pt
 *  Après 10 rounds, le score total détermine le gagnant.
 */
class VisualEcho extends BaseGame {
  setup() {
    this.round        = 0;
    this.totalRounds  = TOTAL_ROUNDS;
    this.phase        = 'countdown'; // countdown → show → hidden → results → (boucle)
    this.grid         = [];
    this.target       = null;
    this.roundAnswers = [];
    this.answered     = new Set();
    this.scores       = {};

    for (const id of this.players.keys()) {
      this.scores[id] = 0;
    }

    this._showTimer   = null;
    this._answerTimer = null;

    // Petit délai pour que le client ait le temps d'afficher le GAME_START
    setTimeout(() => {
      if (this.status !== ROOM_STATUS.PLAYING) return;
      this._startRound();
    }, 1800);
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  handleAction(player, action) {
    if (this.phase !== 'hidden') {
      player.send(EVENTS.GAME_ERROR, { message: 'Attendez que la grille disparaisse !' });
      return;
    }
    if (this.answered.has(player.id)) {
      player.send(EVENTS.GAME_ERROR, { message: 'Vous avez déjà répondu' });
      return;
    }

    const { index } = action;
    if (typeof index !== 'number' || index < 0 || index > 8) {
      player.send(EVENTS.GAME_ERROR, { message: 'Case invalide' });
      return;
    }

    const correct = this.grid[index] === this.target;
    this.answered.add(player.id);
    this.roundAnswers.push({
      playerId:  player.id,
      serverTs:  Date.now(),
      index,
      correct,
      points:    0,
    });

    // Broadcast partiel pour montrer "X joueurs ont répondu"
    this.broadcastState();

    if (this.answered.size >= this.players.size) {
      clearTimeout(this._answerTimer);
      this._resolveRound();
    }
  }

  // ── État ──────────────────────────────────────────────────────────────────

  getState() {
    const showGrid = this.phase === 'show' || this.phase === 'results';
    return {
      phase:         this.phase,
      round:         this.round,
      totalRounds:   this.totalRounds,
      grid:          showGrid ? this.grid : null,
      target:        this.target,
      scores:        this.scores,
      roundAnswers:  this.phase === 'results' ? this.roundAnswers : [],
      answeredCount: this.answered.size,
      totalPlayers:  this.players.size,
      showDuration:  SHOW_MS,
    };
  }

  // ── Privé ─────────────────────────────────────────────────────────────────

  _startRound() {
    this.round++;
    this.roundAnswers = [];
    this.answered     = new Set();
    this.grid         = this._generateGrid();

    // La cible est garantie présente dans la grille
    const unique  = [...new Set(this.grid)];
    this.target   = unique[Math.floor(Math.random() * unique.length)];
    this.phase    = 'show';
    this.broadcastState();

    this._showTimer = setTimeout(() => {
      if (this.status !== ROOM_STATUS.PLAYING) return;
      this.phase = 'hidden';
      this.broadcastState();

      this._answerTimer = setTimeout(() => {
        if (this.status !== ROOM_STATUS.PLAYING) return;
        this._resolveRound();
      }, ANSWER_MS);
    }, SHOW_MS);
  }

  _resolveRound() {
    const n = this.players.size;

    // Trier les bonnes réponses par timestamp serveur (le plus tôt = 1er)
    const correct = this.roundAnswers
      .filter(a => a.correct)
      .sort((a, b) => a.serverTs - b.serverTs);

    correct.forEach((a, i) => {
      a.points = Math.max(n - i, 1);
      this.scores[a.playerId] = (this.scores[a.playerId] || 0) + a.points;
    });

    this.phase = 'results';
    this.broadcastState();

    setTimeout(() => {
      if (this.status !== ROOM_STATUS.PLAYING) return;
      if (this.round >= this.totalRounds) {
        this.endGame(this._getWinner());
      } else {
        this._startRound();
      }
    }, 2800);
  }

  _generateGrid() {
    // 5 symboles distincts tirés au hasard → 9 cases avec répétitions (plus difficile)
    const pool = [...SYMBOLS]
      .sort(() => Math.random() - 0.5)
      .slice(0, 5);
    return Array.from({ length: 9 }, () => pool[Math.floor(Math.random() * pool.length)]);
  }

  _getWinner() {
    let max = -1, winnerId = null, tie = false;
    for (const [id, score] of Object.entries(this.scores)) {
      if (score > max)       { max = score; winnerId = id; tie = false; }
      else if (score === max) { tie = true; }
    }
    return tie ? null : winnerId;
  }
}

module.exports = VisualEcho;
