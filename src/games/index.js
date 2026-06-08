/**
 * Registre des jeux - ajoutez simplement une ligne ici pour chaque nouveau jeu.
 * Le gameId doit correspondre à l'entrée dans GAME_CATALOG (constants.js).
 *
 * @param {GameEngine} engine
 */
const TicTacToe       = require('./TicTacToe');
const PoisonedChalice = require('./PoisonedChalice');
const VisualEcho      = require('./VisualEcho');
const MazeDuel        = require('./MazeDuel');

function registerAllGames(engine) {
  engine.registerGame('tictactoe',        TicTacToe);
  engine.registerGame('poisoned-chalice', PoisonedChalice);
  engine.registerGame('visual-echo',      VisualEcho);
  engine.registerGame('maze-duel',        MazeDuel);
}

module.exports = { registerAllGames };
