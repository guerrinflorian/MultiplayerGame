/**
 * MazeDuelView - rendu Canvas du jeu MazeDuel (Quoridor 10×10)
 *
 * Interactions :
 *   - Clic sur une case surlignée    → movePawn
 *   - Survol d'une bordure de case   → affiche un mur fantôme (H ou V automatique)
 *   - Clic sur le mur fantôme        → placeWall
 *   - Touche [R] ou [Espace]         → force l'orientation H/V du mur fantôme
 *   - Clic droit                     → même effet que [R]
 */
class MazeDuelView extends BaseGameView {

  // ── Initialisation ────────────────────────────────────────────────────────

  render() {
    this.state = this.startData.state;
    this.CELL  = 50;   // pixels par case
    this.BOARD = 10;

    // Lookup noms des joueurs
    this.playerNames = {};
    (this.startData.players || []).forEach(p => {
      this.playerNames[p.id] = p.name;
    });

    // État de l'UI
    this.ghostWall       = null;   // { x, y, orientation } | null
    this.validMoves      = [];     // [{x,y}] cases où le pion peut aller
    this.forcedOrient    = null;   // null | 'H' | 'V' - orientation forcée par R/clic droit

    // Structure HTML
    this.container.innerHTML = `
      <div class="md-wrapper">
        <div class="md-panel">
          <div id="md-turn"    class="md-turn-indicator"></div>
          <div class="md-players-row">
            <div class="md-player-card md-p1-card" id="md-card-p1">
              <div class="md-pawn-dot md-dot-p1"></div>
              <div>
                <div class="md-pname" id="md-name-p1"></div>
                <div class="md-walls-row" id="md-walls-p1"></div>
              </div>
            </div>
            <div class="md-player-card md-p2-card" id="md-card-p2">
              <div class="md-pawn-dot md-dot-p2"></div>
              <div>
                <div class="md-pname" id="md-name-p2"></div>
                <div class="md-walls-row" id="md-walls-p2"></div>
              </div>
            </div>
          </div>
          <div class="md-hint" id="md-hint">
            Survol bord → mur fantôme · Clic → poser · [R] → changer orientation
          </div>
          <div class="md-touch-controls">
            <button id="md-orient-btn" class="md-orient-btn">🔄 Auto</button>
          </div>
        </div>
        <div class="md-canvas-area">
          <canvas id="md-canvas"
                  width="${this.CELL * this.BOARD}"
                  height="${this.CELL * this.BOARD}">
          </canvas>
        </div>
      </div>
    `;

    this.canvas = document.getElementById('md-canvas');
    this.ctx    = this.canvas.getContext('2d');

    this._bindEvents();
    this.onState({ state: this.state });
  }

  // ── Mise à jour ────────────────────────────────────────────────────────────

  onState({ state }) {
    this.state = state;
    this._computeValidMoves();
    this._renderPanel();
    this._draw();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PANEL D'INFORMATION
  // ═══════════════════════════════════════════════════════════════════════════

  _renderPanel() {
    const s = this.state;
    if (!s) return;

    const isMyTurn = s.currentPlayer === this.myId;
    const turnEl   = document.getElementById('md-turn');
    const hintEl   = document.getElementById('md-hint');
    if (turnEl) turnEl.textContent = isMyTurn ? 'À votre tour !' : 'Tour adversaire…';
    if (turnEl) turnEl.className   = `md-turn-indicator ${isMyTurn ? 'my-turn' : 'opp-turn'}`;

    ['p1', 'p2'].forEach(key => {
      const p      = s.players[key];
      const nameEl = document.getElementById(`md-name-${key}`);
      const wallEl = document.getElementById(`md-walls-${key}`);
      const cardEl = document.getElementById(`md-card-${key}`);
      const isMe   = p.id === this.myId;
      const isActive = s.currentPlayer === p.id;

      if (nameEl) nameEl.textContent = (isMe ? '👤 ' : '') + (this.playerNames[p.id] || key.toUpperCase());
      if (cardEl) cardEl.classList.toggle('md-card-active', isActive);

      if (wallEl) {
        wallEl.innerHTML = Array.from({ length: 10 }, (_, i) => `
          <span class="md-wall-pip ${i < p.wallsLeft ? 'pip-on' : 'pip-off'}"></span>
        `).join('');
      }
    });

    if (hintEl) {
      if (!isMyTurn) {
        hintEl.textContent = 'Attendez…';
      } else {
        const pKey = s.p1Id === this.myId ? 'p1' : 'p2';
        const walls = s.players[pKey].wallsLeft;
        hintEl.textContent = walls > 0
          ? (this.forcedOrient
              ? `Orientation forcée : ${this.forcedOrient === 'H' ? 'Horizontale' : 'Verticale'} - [R] pour changer`
              : 'Toucher case → bouger · Bord de case → poser mur · [R]/🔄 orient.')
          : 'Plus de murs - déplacez votre pion.';
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDU CANVAS
  // ═══════════════════════════════════════════════════════════════════════════

  _draw() {
    const ctx  = this.ctx;
    const C    = this.CELL;
    const S    = this.state;
    const W    = C * this.BOARD;

    ctx.clearRect(0, 0, W, W);

    // ── Fond ──────────────────────────────────────────────────────────────
    ctx.fillStyle = '#12151f';
    ctx.fillRect(0, 0, W, W);

    // ── Lignes d'objectif (P1 doit atteindre y=9, P2 doit atteindre y=0) ──
    ctx.fillStyle = 'rgba(108, 99, 255, 0.12)'; // violet pour y=0 (objectif P2)
    ctx.fillRect(0, 0, W, C);
    ctx.fillStyle = 'rgba(255, 101, 132, 0.12)'; // rose pour y=9 (objectif P1)
    ctx.fillRect(0, W - C, W, C);

    // ── Cellules ──────────────────────────────────────────────────────────
    for (let x = 0; x < this.BOARD; x++) {
      for (let y = 0; y < this.BOARD; y++) {
        ctx.fillStyle = '#1a1d27';
        ctx.beginPath();
        ctx.roundRect(x * C + 2, y * C + 2, C - 4, C - 4, 4);
        ctx.fill();
      }
    }

    // ── Cases accessibles (déplacements valides) ───────────────────────────
    if (S?.currentPlayer === this.myId) {
      for (const { x, y } of this.validMoves) {
        ctx.fillStyle = 'rgba(108, 99, 255, 0.35)';
        ctx.beginPath();
        ctx.roundRect(x * C + 2, y * C + 2, C - 4, C - 4, 4);
        ctx.fill();
      }
    }

    // ── Murs posés ────────────────────────────────────────────────────────
    for (const wall of (S?.walls || [])) {
      this._drawWall(wall, '#e8c060', 7, false);
    }

    // ── Mur fantôme (hover) ───────────────────────────────────────────────
    if (this.ghostWall && S?.currentPlayer === this.myId) {
      const pKey   = S.p1Id === this.myId ? 'p1' : 'p2';
      const hasWalls = S.players[pKey].wallsLeft > 0;
      if (hasWalls) {
        this._drawWall(this.ghostWall, 'rgba(108, 99, 255, 0.55)', 7, true);
      }
    }

    // ── Grille fine ────────────────────────────────────────────────────────
    ctx.strokeStyle = '#1e2235';
    ctx.lineWidth   = 1;
    for (let i = 0; i <= this.BOARD; i++) {
      ctx.beginPath(); ctx.moveTo(i * C, 0);     ctx.lineTo(i * C, W);     ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * C);     ctx.lineTo(W, i * C);     ctx.stroke();
    }

    // ── Pions ─────────────────────────────────────────────────────────────
    if (S?.players) {
      const p1 = S.players.p1;
      const p2 = S.players.p2;
      const p1Name = this.playerNames[p1.id]?.slice(0, 2) || 'P1';
      const p2Name = this.playerNames[p2.id]?.slice(0, 2) || 'P2';
      this._drawPawn(p1.x, p1.y, '#6c63ff', p1Name, p1.id === this.myId);
      this._drawPawn(p2.x, p2.y, '#ff6584', p2Name, p2.id === this.myId);
    }
  }

  /**
   * Dessine un mur sur le canvas.
   * H(wx,wy) → ligne horizontale de (wx*C, (wy+1)*C) à ((wx+2)*C, (wy+1)*C)
   * V(wx,wy) → ligne verticale de ((wx+1)*C, wy*C) à ((wx+1)*C, (wy+2)*C)
   */
  _drawWall(wall, color, width, dashed) {
    const ctx = this.ctx;
    const C   = this.CELL;
    const GAP = 3; // léger retrait aux extrémités

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth   = width;
    ctx.lineCap     = 'round';
    if (dashed) ctx.setLineDash([10, 5]);

    ctx.beginPath();
    if (wall.orientation === 'H') {
      const py = (wall.y + 1) * C;
      ctx.moveTo(wall.x * C + GAP,       py);
      ctx.lineTo((wall.x + 2) * C - GAP, py);
    } else {
      const px = (wall.x + 1) * C;
      ctx.moveTo(px, wall.y * C + GAP);
      ctx.lineTo(px, (wall.y + 2) * C - GAP);
    }
    ctx.stroke();
    ctx.restore();
  }

  /** Dessine un pion (cercle coloré) avec initiales et effet de lueur. */
  _drawPawn(x, y, color, label, isMe) {
    const ctx = this.ctx;
    const C   = this.CELL;
    const cx  = x * C + C / 2;
    const cy  = y * C + C / 2;
    const r   = C / 2 - 7;

    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur  = isMe ? 18 : 10;

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle  = 'rgba(255,255,255,0.9)';
    ctx.font       = `bold ${Math.round(C * 0.28)}px sans-serif`;
    ctx.textAlign  = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cx, cy);

    ctx.restore();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MOUVEMENTS VALIDES (calcul côté client - miroir du backend)
  // ═══════════════════════════════════════════════════════════════════════════

  _computeValidMoves() {
    this.validMoves = [];
    const s = this.state;
    if (!s || s.currentPlayer !== this.myId) return;

    const pKey = s.p1Id === this.myId ? 'p1' : 'p2';
    const oppKey = pKey === 'p1' ? 'p2' : 'p1';
    const me  = s.players[pKey];
    const opp = s.players[oppKey];

    for (const [dx, dy] of [[0,1],[0,-1],[1,0],[-1,0]]) {
      const nx = me.x + dx;
      const ny = me.y + dy;
      if (nx < 0 || nx >= this.BOARD || ny < 0 || ny >= this.BOARD) continue;
      if (this._clientBlocked(me.x, me.y, nx, ny, s.walls)) continue;

      if (opp.x === nx && opp.y === ny) {
        // Case de l'adversaire → tentative de saut droit
        const jx = nx + dx;
        const jy = ny + dy;
        if (jx >= 0 && jx < this.BOARD && jy >= 0 && jy < this.BOARD &&
            !this._clientBlocked(nx, ny, jx, jy, s.walls)) {
          this.validMoves.push({ x: jx, y: jy });
        }
        // Pas de saut diagonal implémenté côté client (cohérent avec le backend)
      } else {
        this.validMoves.push({ x: nx, y: ny });
      }
    }
  }

  /** Miroir de MazeDuel._isBlocked - utilisé pour les highlights côté client. */
  _clientBlocked(x, y, nx, ny, walls) {
    if (ny === y + 1) return walls.some(w => w.orientation === 'H' && w.y === y   && (w.x === x || w.x === x - 1));
    if (ny === y - 1) return walls.some(w => w.orientation === 'H' && w.y === y-1 && (w.x === x || w.x === x - 1));
    if (nx === x + 1) return walls.some(w => w.orientation === 'V' && w.x === x   && (w.y === y || w.y === y - 1));
    if (nx === x - 1) return walls.some(w => w.orientation === 'V' && w.x === x-1 && (w.y === y || w.y === y - 1));
    return false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DÉTECTION DES INTERACTIONS SOURIS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Détermine si la souris est en mode "mur" ou "déplacement".
   *
   * Principe : on calcule la distance de (mx,my) à la bordure horizontale
   * la plus proche ET à la bordure verticale la plus proche.
   * Si on est à moins de EDGE_ZONE pixels d'une bordure, on entre en mode mur.
   * La bordure la plus proche détermine l'orientation, sauf si forcedOrient est défini.
   *
   * @returns {{ mode:'wall'|'move', wall?:object, cell?:object } | null}
   */
  _detectInteraction(mx, my) {
    const C         = this.CELL;
    const EDGE_ZONE = 14; // pixels depuis une bordure → mode mur

    // Bordure horizontale la plus proche
    const nearHBound = Math.round(my / C);           // indice 0..10
    const distH      = Math.abs(my - nearHBound * C);

    // Bordure verticale la plus proche
    const nearVBound = Math.round(mx / C);
    const distV      = Math.abs(mx - nearVBound * C);

    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

    const inWallZone = distH < EDGE_ZONE || distV < EDGE_ZONE;

    if (inWallZone) {
      let orientation;

      if (this.forcedOrient) {
        orientation = this.forcedOrient;
      } else {
        // Auto : la bordure la plus proche gagne
        orientation = distH <= distV ? 'H' : 'V';
      }

      if (orientation === 'H' && nearHBound > 0 && nearHBound < this.BOARD) {
        const wy = nearHBound - 1;
        const wx = Math.floor(mx / C);
        return { mode: 'wall', wall: { x: clamp(wx, 0, 8), y: clamp(wy, 0, 8), orientation: 'H' } };
      }
      if (orientation === 'V' && nearVBound > 0 && nearVBound < this.BOARD) {
        const wx = nearVBound - 1;
        const wy = Math.floor(my / C);
        return { mode: 'wall', wall: { x: clamp(wx, 0, 8), y: clamp(wy, 0, 8), orientation: 'V' } };
      }
    }

    // Mode déplacement - cellule sous le curseur
    const cellX = Math.floor(mx / C);
    const cellY = Math.floor(my / C);
    if (cellX >= 0 && cellX < this.BOARD && cellY >= 0 && cellY < this.BOARD) {
      return { mode: 'move', cell: { x: cellX, y: cellY } };
    }

    return null;
  }

  /** Traduit les coordonnées écran → canvas (gère le scaling CSS). */
  _canvasCoords(e) {
    const rect   = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width  / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      mx: (e.clientX - rect.left) * scaleX,
      my: (e.clientY - rect.top)  * scaleY,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ÉVÉNEMENTS
  // ═══════════════════════════════════════════════════════════════════════════

  _bindEvents() {
    const canvas = this.canvas;

    canvas.addEventListener('mousemove', e => {
      const { mx, my } = this._canvasCoords(e);
      if (this.state?.currentPlayer !== this.myId) {
        this.ghostWall = null; this._draw(); return;
      }
      const hit = this._detectInteraction(mx, my);
      this.ghostWall = (hit?.mode === 'wall') ? hit.wall : null;
      this._draw();
    });

    canvas.addEventListener('mouseleave', () => {
      this.ghostWall = null;
      this._draw();
    });

    canvas.addEventListener('click', e => {
      if (this.state?.currentPlayer !== this.myId) return;
      const { mx, my } = this._canvasCoords(e);
      const hit = this._detectInteraction(mx, my);
      if (!hit) return;
      this._handleClick(hit);
    });

    // Clic droit → inverser orientation forcée
    canvas.addEventListener('contextmenu', e => {
      e.preventDefault();
      this._toggleOrientation();
    });

    // Clavier : R ou Espace → inverser orientation forcée
    this._keyHandler = e => {
      if (e.key === 'r' || e.key === 'R' || e.key === ' ') {
        e.preventDefault();
        this._toggleOrientation();
      }
    };
    document.addEventListener('keydown', this._keyHandler);

    // Bouton orientation tactile
    const orientBtn = document.getElementById('md-orient-btn');
    if (orientBtn) orientBtn.addEventListener('click', () => this._toggleOrientation());

    // Événements tactiles
    this._bindTouchEvents();
  }

  _bindTouchEvents() {
    const canvas = this.canvas;
    let touchStartX = 0, touchStartY = 0, touchStartTime = 0;

    this._touchStart = e => {
      e.preventDefault();
      const touch = e.touches[0];
      const { mx, my } = this._canvasCoords(touch);
      touchStartX = mx;
      touchStartY = my;
      touchStartTime = Date.now();

      if (this.state?.currentPlayer !== this.myId) return;
      const hit = this._detectInteraction(mx, my);
      this.ghostWall = (hit?.mode === 'wall') ? hit.wall : null;
      this._draw();
    };

    this._touchMove = e => {
      e.preventDefault();
      const touch = e.touches[0];
      const { mx, my } = this._canvasCoords(touch);

      if (this.state?.currentPlayer !== this.myId) {
        this.ghostWall = null; this._draw(); return;
      }
      const hit = this._detectInteraction(mx, my);
      this.ghostWall = (hit?.mode === 'wall') ? hit.wall : null;
      this._draw();
    };

    this._touchEnd = e => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      const { mx, my } = this._canvasCoords(touch);

      const dx = mx - touchStartX;
      const dy = my - touchStartY;
      const moved = Math.sqrt(dx * dx + dy * dy);

      // Tap court (< 15px, < 500ms) → déclenche l'action
      if (moved < 15 && Date.now() - touchStartTime < 500) {
        if (this.state?.currentPlayer === this.myId) {
          const hit = this._detectInteraction(mx, my);
          if (hit) this._handleClick(hit);
        }
      }

      this.ghostWall = null;
      this._draw();
    };

    canvas.addEventListener('touchstart', this._touchStart, { passive: false });
    canvas.addEventListener('touchmove',  this._touchMove,  { passive: false });
    canvas.addEventListener('touchend',   this._touchEnd,   { passive: false });
  }

  _handleClick(hit) {
    const s = this.state;
    if (!s) return;

    if (hit.mode === 'move') {
      const { x, y } = hit.cell;
      const isValid = this.validMoves.some(m => m.x === x && m.y === y);
      if (isValid) {
        this.client.sendAction({ type: 'movePawn', newX: x, newY: y });
      }
    } else if (hit.mode === 'wall') {
      const pKey = s.p1Id === this.myId ? 'p1' : 'p2';
      if (s.players[pKey].wallsLeft > 0) {
        this.client.sendAction({ type: 'placeWall', ...hit.wall });
      }
    }
  }

  _toggleOrientation() {
    if (this.forcedOrient === null)       this.forcedOrient = 'H';
    else if (this.forcedOrient === 'H')   this.forcedOrient = 'V';
    else                                  this.forcedOrient = null;

    // Mise à jour du hint et du bouton tactile
    const hintEl   = document.getElementById('md-hint');
    const orientBtn = document.getElementById('md-orient-btn');

    if (this.forcedOrient === 'H') {
      if (hintEl)    hintEl.textContent = 'Orientation forcée : Horizontale - [R] pour changer';
      if (orientBtn) { orientBtn.textContent = '- H'; orientBtn.className = 'md-orient-btn orient-h'; }
    } else if (this.forcedOrient === 'V') {
      if (hintEl)    hintEl.textContent = 'Orientation forcée : Verticale - [R] pour changer';
      if (orientBtn) { orientBtn.textContent = '| V'; orientBtn.className = 'md-orient-btn orient-v'; }
    } else {
      if (hintEl)    hintEl.textContent = 'Orientation auto · Toucher bord → mur · Case → bouger';
      if (orientBtn) { orientBtn.textContent = '🔄 Auto'; orientBtn.className = 'md-orient-btn'; }
    }

    this._draw();
  }

  // Nettoyage des listeners à la fin du jeu
  onEnd(data) {
    if (this._keyHandler) document.removeEventListener('keydown', this._keyHandler);
    if (this._touchStart) this.canvas.removeEventListener('touchstart', this._touchStart);
    if (this._touchMove)  this.canvas.removeEventListener('touchmove',  this._touchMove);
    if (this._touchEnd)   this.canvas.removeEventListener('touchend',   this._touchEnd);
    this.ghostWall  = null;
    this.validMoves = [];
    this._draw();
    super.onEnd(data);
  }
}
