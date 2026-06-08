// Point d'entrée de l'application cliente
// wss:// sur HTTPS (Render/production), ws:// en local
const WS_PROTO = location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL   = `${WS_PROTO}//${location.host}/ws`;

const client = new GameClient(WS_URL);
const ui     = new UIManager(client);

// Enregistrement des vues de jeu - ajoutez une ligne par jeu
ui.registerGameView('tictactoe',        TicTacToeView);
ui.registerGameView('poisoned-chalice', PoisonedChaliceView);
ui.registerGameView('visual-echo',      VisualEchoView);
ui.registerGameView('maze-duel',        MazeDuelView);

// Le serveur envoie notre propre socketId dès la connexion
client.on('self', ({ id }) => {
  ui.myId = id;
  console.log('[App] Mon ID :', id);
});
