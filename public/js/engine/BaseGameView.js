/**
 * BaseGameView - vue de base pour chaque jeu.
 * Chaque jeu front hérite de cette classe et implémente :
 *   - render()   : construit le DOM initial du jeu
 *   - onState()  : met à jour l'affichage à partir de l'état serveur
 *   - onEnd()    : affiche l'écran de fin
 */
class BaseGameView {
  /**
   * @param {HTMLElement} container  - Élément DOM où injecter le jeu
   * @param {GameClient}  client     - Instance du client réseau
   * @param {object}      startData  - Données d'initialisation (game:start)
   * @param {string}      myId       - ID du joueur local
   */
  constructor(container, client, startData, myId) {
    this.container = container;
    this.client    = client;
    this.startData = startData;
    this.myId      = myId;
    this.render();
  }

  render() {
    throw new Error(`${this.constructor.name} doit implémenter render()`);
  }

  onState(data) {
    throw new Error(`${this.constructor.name} doit implémenter onState()`);
  }

  onEnd(data) {
    const overlay = document.createElement('div');
    overlay.className = 'game-end-overlay';

    let resultClass, icon, msg;
    if (data.winner === 'draw') {
      resultClass = 'end-draw';
      icon        = '🤝';
      msg         = 'Match nul !';
    } else if (data.winner === this.myId) {
      resultClass = 'end-win';
      icon        = '🏆';
      msg         = 'Victoire !';
    } else {
      resultClass = 'end-lose';
      icon        = '💀';
      const winner = data.scores?.find(s => s.id === data.winner);
      msg = winner ? `${winner.name} gagne !` : 'Partie terminée';
    }

    const rows = (data.scores || [])
      .sort((a, b) => b.score - a.score)
      .map(s => `<div>${s.name} - ${s.score} pts</div>`)
      .join('');

    overlay.innerHTML = `
      <div class="end-card ${resultClass}">
        <div class="end-result-icon">${icon}</div>
        <h2>${msg}</h2>
        ${rows ? `<div class="scores">${rows}</div>` : ''}
        <button id="btn-leave-end" class="btn-primary">Retour au lobby</button>
      </div>
    `;
    this.container.appendChild(overlay);

    document.getElementById('btn-leave-end')?.addEventListener('click', () => {
      this.client.leaveRoom();
    });
  }
}
