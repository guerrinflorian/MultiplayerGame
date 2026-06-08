/**
 * PoisonedChaliceView - Vue frontend du Calice Empoisonné
 *
 * Gère l'affichage asymétrique :
 *  - L'Empoisonneur voit une coupe marquée après avoir placé le poison
 *  - Le Buveur voit 3 coupes identiques + 2 boutons d'action
 */
class PoisonedChaliceView extends BaseGameView {
  render() {
    this.state      = this.startData.state;
    this.actionMode = 'drink'; // 'drink' | 'force'

    // Lookup nom des joueurs
    this.playerNames = {};
    (this.startData.players || []).forEach(p => {
      this.playerNames[p.id] = p.name;
    });

    this.container.innerHTML = `
      <div class="pc-wrapper">

        <div class="pc-header">
          <div id="pc-round" class="pc-round-badge"></div>
          <div id="pc-scores" class="pc-scores"></div>
        </div>

        <div id="pc-role" class="pc-role-badge"></div>
        <div id="pc-instruction" class="pc-instruction"></div>

        <div id="pc-cups" class="pc-cups">
          ${[0, 1, 2].map(i => `
            <div class="pc-cup" data-cup="${i}" id="pc-cup-${i}" tabindex="0">
              <div class="cup-shine"></div>
              <div class="cup-rim"></div>
              <div class="cup-body">
                <span class="cup-inner-icon" id="cup-icon-${i}"></span>
              </div>
              <div class="cup-stem"></div>
              <div class="cup-foot"></div>
              <div class="cup-label">${i + 1}</div>
            </div>
          `).join('')}
        </div>

        <div id="pc-actions" class="pc-actions hidden">
          <button class="pc-act-btn active" data-mode="drink">🍷 Je bois</button>
          <button class="pc-act-btn" data-mode="force">☠️ Il boit</button>
        </div>

        <div id="pc-result" class="pc-result hidden"></div>
      </div>
    `;

    this._bindEvents();
    this._update(this.state, this.state.roles?.empoisonneur);
  }

  onState({ state, currentPlayer }) {
    this.state = state;
    this._update(state, currentPlayer);
  }

  onEnd(data) {
    document.querySelectorAll('.pc-cup').forEach(c => {
      c.style.cursor    = 'default';
      c.style.pointerEvents = 'none';
    });
    super.onEnd(data);
  }

  // ── Rendu principal ───────────────────────────────────────────────────────

  _update(s, currentPlayer) {
    if (!s) return;
    this._renderHeader(s);
    this._renderCups(s);
    this._renderPhase(s, currentPlayer);
  }

  _renderHeader(s) {
    const rEl = document.getElementById('pc-round');
    const sEl = document.getElementById('pc-scores');
    if (!rEl || !sEl) return;

    rEl.textContent = `Round ${s.round} / ${s.maxRounds}`;

    sEl.innerHTML = Object.entries(s.scores || {}).map(([id, score]) => `
      <div class="pc-score-chip ${id === this.myId ? 'is-me' : ''}">
        <span>${this.playerNames[id] || 'Joueur'}</span>
        <strong>${score}</strong>
      </div>
    `).join('');
  }

  _renderCups(s) {
    [0, 1, 2].forEach(i => {
      const cup  = document.getElementById(`pc-cup-${i}`);
      const icon = document.getElementById(`cup-icon-${i}`);
      if (!cup || !icon) return;

      // Reset classes
      cup.classList.remove('cup-marked', 'cup-poison', 'cup-chosen', 'cup-safe', 'cup-clickable');
      icon.textContent = '';

      if (s.phase === 'reveal') {
        if (i === s.poisonCup) {
          cup.classList.add('cup-poison');
          icon.textContent = '💀';
        } else {
          cup.classList.add('cup-safe');
          icon.textContent = '✓';
        }
        if (s.lastAction && i === s.lastAction.cupIndex) {
          cup.classList.add('cup-chosen');
        }
      } else if (s.poisonCup !== null && s.phase === 'choose_action') {
        // Seulement visible par l'empoisonneur (le serveur envoie poisonCup pour lui seul)
        if (i === s.poisonCup) {
          cup.classList.add('cup-marked');
          icon.textContent = '💀';
        }
      }
    });
  }

  _renderPhase(s, currentPlayer) {
    const roleEl  = document.getElementById('pc-role');
    const instrEl = document.getElementById('pc-instruction');
    const actEl   = document.getElementById('pc-actions');
    const resEl   = document.getElementById('pc-result');
    if (!roleEl) return;

    const isEmpo = this.myId === s.roles?.empoisonneur;
    const isBuv  = this.myId === s.roles?.buveur;

    // Badge de rôle
    roleEl.className   = `pc-role-badge ${isEmpo ? 'role-empo' : 'role-buv'}`;
    roleEl.innerHTML   = isEmpo
      ? '<span class="role-icon">☠️</span> Vous êtes l\'<strong>Empoisonneur</strong>'
      : '<span class="role-icon">🍷</span> Vous êtes le <strong>Buveur</strong>';

    actEl.classList.add('hidden');
    resEl.classList.add('hidden');
    document.querySelectorAll('.pc-cup').forEach(c => c.classList.remove('cup-clickable'));

    switch (s.phase) {

      case 'place_poison':
        if (isEmpo) {
          instrEl.innerHTML = 'Cliquez sur une coupe pour y dissimuler le poison.';
          document.querySelectorAll('.pc-cup').forEach(c => c.classList.add('cup-clickable'));
        } else {
          instrEl.innerHTML = "<em>L'Empoisonneur choisit sa coupe…</em>";
        }
        break;

      case 'choose_action':
        if (isBuv) {
          instrEl.innerHTML = 'Choisissez votre stratégie, puis cliquez sur une coupe.';
          actEl.classList.remove('hidden');
          document.querySelectorAll('.pc-cup').forEach(c => c.classList.add('cup-clickable'));
        } else {
          instrEl.innerHTML = "<em>Le Buveur prend sa décision…</em>";
        }
        break;

      case 'reveal':
        const res = s.lastResult;
        if (res) {
          const iWon     = res.roundWinner === this.myId;
          const verb     = s.lastAction?.type === 'drink' ? 'a bu' : 'a forcé à boire';
          const cupNum   = (s.lastAction?.cupIndex ?? 0) + 1;

          resEl.className = `pc-result ${iWon ? 'res-win' : 'res-lose'}`;
          resEl.classList.remove('hidden');
          resEl.innerHTML = `
            <div class="res-detail">
              ${res.isPoisoned ? '💀 Coupe empoisonnée !' : '✅ Coupe saine !'} - ${verb} la coupe ${cupNum}
            </div>
            <div class="res-verdict">${iWon ? '🎉 Vous gagnez ce round !' : '😵 Vous perdez ce round…'}</div>
          `;
        }
        instrEl.innerHTML = '<em>Prochain round dans quelques secondes…</em>';
        break;
    }
  }

  // ── Interactions ──────────────────────────────────────────────────────────

  _bindEvents() {
    // Toggle du mode buveur
    document.getElementById('pc-actions')?.addEventListener('click', e => {
      const btn = e.target.closest('.pc-act-btn');
      if (!btn) return;
      this.actionMode = btn.dataset.mode;
      document.querySelectorAll('.pc-act-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });

    // Clic sur une coupe
    document.getElementById('pc-cups')?.addEventListener('click', e => {
      const cup = e.target.closest('.pc-cup');
      if (!cup || !cup.classList.contains('cup-clickable')) return;
      const cupIndex = parseInt(cup.dataset.cup, 10);
      const s = this.state;

      if (s.phase === 'place_poison' && this.myId === s.roles?.empoisonneur) {
        this.client.sendAction({ type: 'placePoison', cupIndex });
        document.querySelectorAll('.pc-cup').forEach(c => c.classList.remove('cup-clickable'));
      } else if (s.phase === 'choose_action' && this.myId === s.roles?.buveur) {
        const type = this.actionMode === 'force' ? 'forceDrink' : 'drink';
        this.client.sendAction({ type, cupIndex });
        document.querySelectorAll('.pc-cup').forEach(c => c.classList.remove('cup-clickable'));
      }
    });
  }
}
