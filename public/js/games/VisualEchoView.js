/**
 * VisualEchoView - Vue frontend d'Écho Visuel
 *
 * Phases :
 *   countdown → prépare le joueur
 *   show      → grille visible + barre de décompte animée
 *   hidden    → grille cachée, cellules cliquables
 *   results   → révèle la grille + qui a marqué quoi
 */
class VisualEchoView extends BaseGameView {
  render() {
    this.state = this.startData.state;

    this.playerNames = {};
    (this.startData.players || []).forEach(p => {
      this.playerNames[p.id] = p.name;
    });

    this.container.innerHTML = `
      <div class="ve-wrapper">

        <div class="ve-topbar">
          <div id="ve-round" class="ve-round-badge">Round 0 / 10</div>
          <div id="ve-scores" class="ve-scores"></div>
        </div>

        <div id="ve-target" class="ve-target">Préparez-vous…</div>

        <div class="ve-countdown-track">
          <div id="ve-bar" class="ve-countdown-bar" style="width:0%"></div>
        </div>

        <div id="ve-grid" class="ve-grid">
          ${Array.from({ length: 9 }, (_, i) => `
            <button class="ve-cell" data-cell="${i}" id="ve-cell-${i}" disabled>
              <span class="ve-cell-content">?</span>
            </button>
          `).join('')}
        </div>

        <div id="ve-status" class="ve-status"></div>
        <div id="ve-round-results" class="ve-round-results hidden"></div>
      </div>
    `;

    this._bindEvents();
    this._hasAnimated = false;
    this.onState({ state: this.state });
  }

  onState({ state }) {
    const prev  = this.state?.phase;
    this.state  = state;

    this._renderTopbar(state);
    this._renderTarget(state);
    this._renderGrid(state);
    this._renderStatus(state);
    this._renderRoundResults(state);

    // Lancer l'animation de décompte uniquement à l'entrée en phase 'show'
    if (state.phase === 'show' && prev !== 'show') {
      this._startCountdown(state.showDuration || 3000);
    }
    if (state.phase !== 'show') {
      this._stopCountdown();
    }
  }

  onEnd(data) {
    document.querySelectorAll('.ve-cell').forEach(c => c.disabled = true);
    super.onEnd(data);
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────

  _renderTopbar(s) {
    const rEl = document.getElementById('ve-round');
    const sEl = document.getElementById('ve-scores');
    if (!rEl || !sEl) return;

    rEl.textContent = `Round ${s.round || 0} / ${s.totalRounds}`;

    // Scores triés
    const sorted = Object.entries(s.scores || {})
      .sort((a, b) => b[1] - a[1]);

    sEl.innerHTML = sorted.map(([id, score], rank) => `
      <div class="ve-score-chip ${id === this.myId ? 'is-me' : ''}">
        <span class="ve-rank">${rank === 0 ? '👑' : `#${rank + 1}`}</span>
        <span>${this.playerNames[id] || 'Joueur'}</span>
        <strong>${score}</strong>
      </div>
    `).join('');
  }

  _renderTarget(s) {
    const el = document.getElementById('ve-target');
    if (!el) return;

    if (s.phase === 'countdown') {
      el.className   = 've-target countdown';
      el.textContent = 'Préparez-vous…';
    } else if (s.phase === 'show') {
      el.className   = 've-target show-phase';
      el.innerHTML   = `Mémorisez ! Où sera&nbsp;<span class="ve-target-sym">${s.target}</span>&nbsp;?`;
    } else if (s.phase === 'hidden') {
      el.className   = 've-target hidden-phase';
      el.innerHTML   = `Où était&nbsp;<span class="ve-target-sym">${s.target}</span>&nbsp;?`;
    } else if (s.phase === 'results') {
      el.className   = 've-target results-phase';
      el.innerHTML   = `La cible était&nbsp;<span class="ve-target-sym">${s.target}</span>`;
    }
  }

  _renderGrid(s) {
    for (let i = 0; i < 9; i++) {
      const cell    = document.getElementById(`ve-cell-${i}`);
      const content = cell?.querySelector('.ve-cell-content');
      if (!cell || !content) continue;

      cell.className = 've-cell';
      cell.disabled  = true;

      if (s.phase === 'show' && s.grid) {
        content.textContent = s.grid[i];
        cell.classList.add('ve-visible');
      } else if (s.phase === 'hidden') {
        content.textContent = '?';
        cell.classList.add('ve-interactive');
        // Désactiver si déjà répondu
        const alreadyAnswered = s.roundAnswers?.some(a => a.playerId === this.myId);
        cell.disabled = alreadyAnswered || false;
      } else if (s.phase === 'results' && s.grid) {
        content.textContent = s.grid[i];
        cell.classList.add('ve-revealed');
        if (s.grid[i] === s.target) cell.classList.add('ve-correct-cell');
      } else {
        content.textContent = '·';
      }
    }
  }

  _renderStatus(s) {
    const el = document.getElementById('ve-status');
    if (!el) return;

    if (s.phase === 'hidden') {
      const answered = s.answeredCount || 0;
      const total    = s.totalPlayers  || 0;
      el.textContent = answered > 0
        ? `${answered} / ${total} joueur${total > 1 ? 's' : ''} a répondu`
        : '';
    } else {
      el.textContent = '';
    }
  }

  _renderRoundResults(s) {
    const el = document.getElementById('ve-round-results');
    if (!el) return;

    if (s.phase !== 'results' || !s.roundAnswers?.length) {
      el.classList.add('hidden');
      return;
    }

    el.classList.remove('hidden');

    // Trier : corrects d'abord (par pts desc), puis incorrects
    const sorted = [...s.roundAnswers].sort((a, b) => b.points - a.points);

    el.innerHTML = sorted.map(ans => {
      const name  = this.playerNames[ans.playerId] || 'Joueur';
      const isMe  = ans.playerId === this.myId;
      const emoji = ans.correct ? (ans.points > 0 ? `+${ans.points}pts` : '0pt') : '✗';
      const cls   = ans.correct ? 'res-correct' : 'res-wrong';

      return `
        <div class="ve-res-row ${cls} ${isMe ? 'is-me' : ''}">
          <span>${isMe ? '👤 ' : ''}${name}</span>
          <span class="ve-res-pts">${emoji}</span>
        </div>
      `;
    }).join('');
  }

  // ── Barre de décompte ─────────────────────────────────────────────────────

  _startCountdown(duration) {
    const bar = document.getElementById('ve-bar');
    if (!bar) return;
    // Reset instantané puis transition CSS
    bar.style.transition = 'none';
    bar.style.width      = '100%';
    bar.classList.add('ve-bar-active');

    requestAnimationFrame(() => requestAnimationFrame(() => {
      bar.style.transition = `width ${duration}ms linear`;
      bar.style.width      = '0%';
    }));
  }

  _stopCountdown() {
    const bar = document.getElementById('ve-bar');
    if (!bar) return;
    bar.style.transition = 'none';
    bar.style.width      = '0%';
    bar.classList.remove('ve-bar-active');
  }

  // ── Interactions ──────────────────────────────────────────────────────────

  _bindEvents() {
    document.getElementById('ve-grid')?.addEventListener('click', e => {
      const cell = e.target.closest('.ve-cell');
      if (!cell || cell.disabled) return;
      const index = parseInt(cell.dataset.cell, 10);
      if (this.state?.phase !== 'hidden') return;

      // Feedback visuel immédiat
      cell.classList.add('ve-pending');
      cell.disabled = true;
      document.querySelectorAll('.ve-cell').forEach(c => c.disabled = true);

      this.client.sendAction({ index });
    });
  }
}
