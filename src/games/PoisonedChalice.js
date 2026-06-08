const BaseGame    = require('../engine/BaseGame');
const { EVENTS, ROOM_STATUS } = require('../shared/constants');

/**
 * Le Calice Empoisonné - 1v1 bluff/asymétrique, Best of 3
 *
 * Chaque round :
 *  1. L'Empoisonneur clique secrètement sur une coupe pour y mettre le poison.
 *  2. Le Buveur choisit son action :
 *       "drink"      → il boit une coupe. Si poison → il perd. Si sain → il gagne.
 *       "forceDrink" → il force l'adversaire à boire. Si poison → adversaire perd.
 *                      Si sain → adversaire s'en sort, buveur perd.
 *  3. Révélation + score. Les rôles s'inversent au round suivant.
 *  Premier à 2 victoires (ou plus après 3 rounds) gagne le match.
 */
class PoisonedChalice extends BaseGame {
  setup() {
    const ids = [...this.players.keys()];

    this.empoisonneurId = ids[0];
    this.buveurId       = ids[1];

    this.round      = 1;
    this.maxRounds  = 3;
    this.phase      = 'place_poison'; // place_poison → choose_action → reveal
    this.poisonCup  = null;           // 0 | 1 | 2
    this.lastAction = null;
    this.lastResult = null;
    this.scores     = { [ids[0]]: 0, [ids[1]]: 0 };

    this._revealTimer = null;
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  handleAction(player, action) {
    const { type, cupIndex } = action;

    if (this.phase === 'place_poison') {
      if (player.id !== this.empoisonneurId) {
        player.send(EVENTS.GAME_ERROR, { message: "Ce n'est pas votre rôle" });
        return;
      }
      if (type !== 'placePoison') return;
      if (typeof cupIndex !== 'number' || cupIndex < 0 || cupIndex > 2) {
        player.send(EVENTS.GAME_ERROR, { message: 'Coupe invalide' });
        return;
      }

      this.poisonCup = cupIndex;
      this.phase     = 'choose_action';
      this._sendAsymmetricState();
      return;
    }

    if (this.phase === 'choose_action') {
      if (player.id !== this.buveurId) {
        player.send(EVENTS.GAME_ERROR, { message: "Ce n'est pas votre rôle" });
        return;
      }
      if (type !== 'drink' && type !== 'forceDrink') return;
      if (typeof cupIndex !== 'number' || cupIndex < 0 || cupIndex > 2) {
        player.send(EVENTS.GAME_ERROR, { message: 'Coupe invalide' });
        return;
      }

      const isPoisoned     = cupIndex === this.poisonCup;
      let   roundWinnerId;

      if (type === 'drink') {
        // Buveur boit → sain = buveur gagne, poison = empoisonneur gagne
        roundWinnerId = isPoisoned ? this.empoisonneurId : this.buveurId;
      } else {
        // Force l'empoisonneur → poison = buveur gagne (a deviné), sain = empoisonneur gagne
        roundWinnerId = isPoisoned ? this.buveurId : this.empoisonneurId;
      }

      this.lastAction = { type, cupIndex };
      this.lastResult = { isPoisoned, roundWinner: roundWinnerId };
      this.scores[roundWinnerId]++;
      this.phase = 'reveal';
      this._sendAsymmetricState(); // tout le monde voit maintenant la coupe poison

      // Vérifier fin de match prématurée (2 victoires avant round 3)
      const needed     = Math.ceil(this.maxRounds / 2);
      const matchOver  = Object.values(this.scores).some(s => s >= needed);
      const lastRound  = this.round >= this.maxRounds;

      this._revealTimer = setTimeout(() => {
        if (this.status !== ROOM_STATUS.PLAYING) return;
        if (matchOver || lastRound) {
          this.endGame(this._getMatchWinner());
        } else {
          this._nextRound();
        }
      }, 3500);
    }
  }

  // ── État ──────────────────────────────────────────────────────────────────

  /** État public (poisonCup masqué en dehors de la révélation) */
  getState() {
    return {
      phase:      this.phase,
      round:      this.round,
      maxRounds:  this.maxRounds,
      roles:      { empoisonneur: this.empoisonneurId, buveur: this.buveurId },
      poisonCup:  this.phase === 'reveal' ? this.poisonCup : null,
      lastAction: this.lastAction,
      lastResult: this.lastResult,
      scores:     this.scores,
    };
  }

  /** Override - états asymétriques : l'empoisonneur voit sa coupe en choose_action */
  broadcastState() {
    this._sendAsymmetricState();
  }

  // ── Privé ─────────────────────────────────────────────────────────────────

  _sendAsymmetricState() {
    for (const [id, player] of this.players) {
      const showPoison =
        this.phase === 'reveal' ||
        (this.phase === 'choose_action' && id === this.empoisonneurId);

      player.send(EVENTS.GAME_STATE, {
        currentPlayer: this._activePlayerId(),
        state: { ...this.getState(), poisonCup: showPoison ? this.poisonCup : null },
      });
    }
  }

  _activePlayerId() {
    if (this.phase === 'place_poison')  return this.empoisonneurId;
    if (this.phase === 'choose_action') return this.buveurId;
    return null;
  }

  _nextRound() {
    this.round++;
    // Inverser les rôles
    [this.empoisonneurId, this.buveurId] = [this.buveurId, this.empoisonneurId];
    this.phase      = 'place_poison';
    this.poisonCup  = null;
    this.lastAction = null;
    this.lastResult = null;
    this._sendAsymmetricState();
  }

  _getMatchWinner() {
    const [id1, id2] = [...this.players.keys()];
    if (this.scores[id1] > this.scores[id2]) return id1;
    if (this.scores[id2] > this.scores[id1]) return id2;
    return null; // égalité parfaite
  }
}

module.exports = PoisonedChalice;
