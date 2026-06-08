const BaseGame    = require('../engine/BaseGame');
const { EVENTS, ROOM_STATUS } = require('../shared/constants');

const BOARD = 10; // grille 10×10, coordonnées 0..9

/**
 * MazeDuel - Quoridor 1v1 sur grille 10×10
 *
 * Système de coordonnées des murs
 * ─────────────────────────────────
 * Un mur { x, y, orientation } est ancré à l'intersection (x, y).
 * x, y ∈ [0..8]  (le mur dépasse d'1 case donc max = BOARD-2 = 8)
 *
 * Mur Horizontal (H) ancré en (wx, wy) :
 *   bloque le passage entre la rangée wy et wy+1
 *   pour les colonnes wx  → (wx,  wy)↔(wx,  wy+1)
 *                  wx+1  → (wx+1,wy)↔(wx+1,wy+1)
 *
 * Mur Vertical (V) ancré en (wx, wy) :
 *   bloque le passage entre la colonne wx et wx+1
 *   pour les rangées wy   → (wx,wy)  ↔(wx+1,wy)
 *                   wy+1  → (wx,wy+1)↔(wx+1,wy+1)
 */
class MazeDuel extends BaseGame {

  // ── Setup ─────────────────────────────────────────────────────────────────

  setup() {
    const ids = [...this.players.keys()];
    this.p1Id = ids[0];
    this.p2Id = ids[1];

    // Positions et compteurs de murs
    this.pawns = {
      [this.p1Id]: { x: 4, y: 0, targetY: BOARD - 1, wallsLeft: 10 },
      [this.p2Id]: { x: 5, y: BOARD - 1, targetY: 0, wallsLeft: 10 },
    };

    this.walls = []; // { x, y, orientation:'H'|'V' }[]
    // turnOrder défini par BaseGame.start() → [p1Id, p2Id]
  }

  // ── Routage des actions ────────────────────────────────────────────────────

  handleAction(player, action) {
    if (!this.isPlayerTurn(player)) {
      player.send(EVENTS.GAME_ERROR, { message: "Ce n'est pas votre tour" });
      return;
    }

    switch (action.type) {
      case 'movePawn':   this._movePawn(player, action);  break;
      case 'placeWall':  this._placeWall(player, action); break;
      default:
        player.send(EVENTS.GAME_ERROR, { message: `Action inconnue : ${action.type}` });
    }
  }

  // ── Action : déplacement du pion ──────────────────────────────────────────

  _movePawn(player, { newX, newY }) {
    if (typeof newX !== 'number' || typeof newY !== 'number') {
      player.send(EVENTS.GAME_ERROR, { message: 'Coordonnées manquantes' });
      return;
    }
    if (newX < 0 || newX >= BOARD || newY < 0 || newY >= BOARD) {
      player.send(EVENTS.GAME_ERROR, { message: 'Hors du plateau' });
      return;
    }

    const err = this._validateMove(player.id, newX, newY);
    if (err) {
      player.send(EVENTS.GAME_ERROR, { message: err });
      return;
    }

    this.pawns[player.id].x = newX;
    this.pawns[player.id].y = newY;

    if (newY === this.pawns[player.id].targetY) {
      this.broadcastState();
      this.endGame(player.id);
      return;
    }

    this.nextTurn();
    this.broadcastState();
  }

  // ── Action : pose d'un mur ────────────────────────────────────────────────

  _placeWall(player, { x, y, orientation }) {
    const pawn = this.pawns[player.id];

    if (pawn.wallsLeft <= 0) {
      player.send(EVENTS.GAME_ERROR, { message: 'Plus de murs disponibles' });
      return;
    }
    if (orientation !== 'H' && orientation !== 'V') {
      player.send(EVENTS.GAME_ERROR, { message: 'Orientation invalide (H ou V)' });
      return;
    }
    // Un mur d'ancre (x,y) s'étend jusqu'à (x+1,y+1) → doit rester dans la grille
    if (typeof x !== 'number' || typeof y !== 'number' ||
        x < 0 || x > BOARD - 2 || y < 0 || y > BOARD - 2) {
      player.send(EVENTS.GAME_ERROR, { message: 'Position de mur invalide' });
      return;
    }

    const newWall = { x, y, orientation };

    // ── Collision géométrique ────────────────────────────────────────────────
    if (this._wallCollides(newWall)) {
      player.send(EVENTS.GAME_ERROR, { message: 'Collision avec un mur existant' });
      return;
    }

    // ── Vérification BFS : aucun joueur ne doit être totalement bloqué ───────
    const hypothetical = [...this.walls, newWall];
    const p1 = this.pawns[this.p1Id];
    const p2 = this.pawns[this.p2Id];

    if (!this._bfsCanReach(p1.x, p1.y, BOARD - 1, hypothetical) ||
        !this._bfsCanReach(p2.x, p2.y, 0,          hypothetical)) {
      player.send(EVENTS.GAME_ERROR, { message: 'Ce mur isolerait totalement un joueur !' });
      return;
    }

    // ── Validation OK ────────────────────────────────────────────────────────
    this.walls.push(newWall);
    pawn.wallsLeft--;
    this.nextTurn();
    this.broadcastState();
  }

  // ── Sérialisation de l'état ────────────────────────────────────────────────

  getState() {
    return {
      boardSize: BOARD,
      players: {
        p1: { id: this.p1Id, ...this.pawns[this.p1Id] },
        p2: { id: this.p2Id, ...this.pawns[this.p2Id] },
      },
      walls:         this.walls,
      currentPlayer: this.currentPlayer ? this.currentPlayer.id : null,
      p1Id:          this.p1Id,
      p2Id:          this.p2Id,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VALIDATION DES DÉPLACEMENTS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Retourne null si le mouvement est légal, ou un message d'erreur sinon.
   * Gère le déplacement simple (1 case) et le saut par-dessus l'adversaire (2 cases).
   */
  _validateMove(playerId, nx, ny) {
    const me  = this.pawns[playerId];
    const oppId = playerId === this.p1Id ? this.p2Id : this.p1Id;
    const opp = this.pawns[oppId];

    const dx = nx - me.x;
    const dy = ny - me.y;
    const dist = Math.abs(dx) + Math.abs(dy);

    // Pas de mouvement diagonal
    if (dx !== 0 && dy !== 0) return 'Mouvement diagonal interdit';

    if (dist === 1) {
      // Case occupée par l'adversaire → interdit (le saut se fait en dist=2)
      if (opp.x === nx && opp.y === ny) return 'Case occupée par l\'adversaire';
      if (this._isBlocked(me.x, me.y, nx, ny, this.walls)) return 'Un mur bloque ce passage';
      return null;
    }

    if (dist === 2) {
      // Saut par-dessus l'adversaire : la case intermédiaire DOIT être l'adversaire
      const midX = (me.x + nx) / 2;
      const midY = (me.y + ny) / 2;
      if (!Number.isInteger(midX) || !Number.isInteger(midY)) return 'Mouvement invalide';
      if (opp.x !== midX || opp.y !== midY) return 'Saut uniquement par-dessus l\'adversaire';
      if (this._isBlocked(me.x, me.y, midX, midY, this.walls)) return 'Un mur bloque le saut (1ère moitié)';
      if (this._isBlocked(midX, midY, nx,   ny,   this.walls)) return 'Un mur bloque le saut (2ème moitié)';
      return null;
    }

    return 'Déplacement trop long';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VÉRIFICATION DES MURS SUR UN PASSAGE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Retourne true si un mur (dans `walls`) bloque le passage de (x,y) à (nx,ny).
   * Les deux cases doivent être strictement adjacentes (dist == 1).
   */
  _isBlocked(x, y, nx, ny, walls) {
    if (ny === y + 1) {
      // Vers le bas : cherche un mur H avec w.y === y couvrant colonne x
      // H(wx,wy) couvre colonnes wx et wx+1 → wx === x ou wx+1 === x → wx === x ou wx === x-1
      return walls.some(w => w.orientation === 'H' && w.y === y &&
                              (w.x === x || w.x === x - 1));
    }
    if (ny === y - 1) {
      // Vers le haut : mur H avec w.y === y-1
      return walls.some(w => w.orientation === 'H' && w.y === y - 1 &&
                              (w.x === x || w.x === x - 1));
    }
    if (nx === x + 1) {
      // Vers la droite : mur V avec w.x === x couvrant rangée y
      // V(wx,wy) couvre rangées wy et wy+1 → wy === y ou wy === y-1
      return walls.some(w => w.orientation === 'V' && w.x === x &&
                              (w.y === y || w.y === y - 1));
    }
    if (nx === x - 1) {
      // Vers la gauche : mur V avec w.x === x-1
      return walls.some(w => w.orientation === 'V' && w.x === x - 1 &&
                              (w.y === y || w.y === y - 1));
    }
    return false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COLLISION GÉOMÉTRIQUE ENTRE MURS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Retourne true si `newWall` entre en collision avec un mur existant.
   *
   * Règles :
   *   H + H même rangée : collision si |wx1 - wx2| < 2  (chaque mur occupe 2 segments horizontaux)
   *   V + V même colonne : collision si |wy1 - wy2| < 2
   *   H + V même ancre   : ils se croisent en leur centre → collision
   */
  _wallCollides(newWall) {
    return this.walls.some(w => {
      const { x: ax, y: ay, orientation: ao } = newWall;
      const { x: bx, y: by, orientation: bo } = w;

      if (ao === 'H' && bo === 'H') return ay === by && Math.abs(ax - bx) < 2;
      if (ao === 'V' && bo === 'V') return ax === bx && Math.abs(ay - by) < 2;

      // Un H et un V se croisent uniquement s'ils partagent le même point d'ancre
      const [hx, hy] = ao === 'H' ? [ax, ay] : [bx, by];
      const [vx, vy] = ao === 'V' ? [ax, ay] : [bx, by];
      return hx === vx && hy === vy;
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BFS - VÉRIFICATION DE CHEMIN
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Breadth-First Search : vérifie qu'il existe un chemin de (sx,sy) vers
   * n'importe quelle case de la rangée `targetY`, en respectant `walls`.
   *
   * Complexité : O(BOARD² × |walls|) dans le pire cas, soit O(10 000) pour une
   * grille 10×10 avec 20 murs - acceptable pour une validation en temps réel.
   *
   * @param {number}   sx, sy     - Position de départ
   * @param {number}   targetY    - Rangée cible
   * @param {object[]} walls      - Tableau de murs à respecter
   * @returns {boolean}
   */
  _bfsCanReach(sx, sy, targetY, walls) {
    const visited = new Set();
    const queue   = [[sx, sy]];

    while (queue.length > 0) {
      const [x, y] = queue.shift();
      const key = x * BOARD + y; // hash rapide (entier)

      if (visited.has(key)) continue;
      visited.add(key);

      if (y === targetY) return true;

      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < BOARD && ny >= 0 && ny < BOARD &&
            !visited.has(nx * BOARD + ny) &&
            !this._isBlocked(x, y, nx, ny, walls)) {
          queue.push([nx, ny]);
        }
      }
    }

    return false;
  }
}

module.exports = MazeDuel;
