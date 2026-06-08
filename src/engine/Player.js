const { PLAYER_STATUS } = require('../shared/constants');

class Player {
  /**
   * @param {string} id       - Socket ID unique
   * @param {string} name     - Pseudo choisi par le joueur
   * @param {object} socket   - Référence à la socket Fastify/WS
   */
  constructor(id, name, socket) {
    this.id     = id;
    this.name   = name || `Joueur_${id.slice(0, 4)}`;
    this.socket = socket;
    this.status = PLAYER_STATUS.CONNECTED;
    this.teamId = null;   // assigné lors du démarrage du jeu
    this.score  = 0;
    this.isReady = false;
  }

  send(event, data) {
    if (this.socket && this.socket.readyState === /* OPEN */ 1) {
      this.socket.send(JSON.stringify({ event, data }));
    }
  }

  setTeam(teamId) {
    this.teamId = teamId;
  }

  setReady(ready = true) {
    this.isReady = ready;
    this.status  = ready ? PLAYER_STATUS.READY : PLAYER_STATUS.CONNECTED;
  }

  disconnect() {
    this.status = PLAYER_STATUS.DISCONNECTED;
    this.socket = null;
  }

  toJSON() {
    return {
      id:      this.id,
      name:    this.name,
      teamId:  this.teamId,
      status:  this.status,
      score:   this.score,
      isReady: this.isReady,
    };
  }
}

module.exports = Player;
