// Fichier généré depuis src/shared/constants.js - NE PAS ÉDITER MANUELLEMENT
// Partagé avec le frontend via <script src="/js/shared.js">

const EVENTS = {
  CREATE_ROOM:   'room:create',
  JOIN_ROOM:     'room:join',
  LEAVE_ROOM:    'room:leave',
  ROOM_UPDATED:  'room:updated',
  ROOM_LIST:     'room:list',
  ROOM_ERROR:    'room:error',

  GAME_START:    'game:start',
  GAME_STATE:    'game:state',
  GAME_ACTION:   'game:action',
  GAME_END:      'game:end',
  GAME_ERROR:    'game:error',

  PLAYER_JOINED: 'player:joined',
  PLAYER_LEFT:   'player:left',
  PLAYER_READY:  'player:ready',

  PING:          'ping',
  PONG:          'pong',
};

const GAME_CATALOG = [
  {
    id: 'tictactoe',
    name: 'Morpion',
    description: 'Le classique jeu de morpion',
    minPlayers: 2,
    maxPlayers: 2,
    configs: [
      { id: '1v1', label: '1 vs 1', teams: [[1], [1]] },
    ],
  },
  {
    id: 'poisoned-chalice',
    name: 'Le Calice Empoisonné',
    description: "Bluff pur : poison caché, lecture de l'adversaire, un seul tour décisif",
    minPlayers: 2,
    maxPlayers: 2,
    configs: [
      { id: '1v1-bo3', label: 'Best of 3', teams: [[1], [1]] },
    ],
  },
  {
    id: 'maze-duel',
    name: 'MazeDuel',
    description: 'Quoridor revisité : construisez des murs pour piéger votre adversaire sur 10×10',
    minPlayers: 2,
    maxPlayers: 2,
    configs: [
      { id: '1v1', label: '1 vs 1', teams: [[1], [1]] },
    ],
  },
  {
    id: 'visual-echo',
    name: 'Écho Visuel',
    description: 'Mémorisez la grille, retrouvez le symbole le plus vite - 10 rounds',
    minPlayers: 2,
    maxPlayers: 4,
    configs: [
      { id: 'ffa2', label: '2 joueurs', teams: [[1], [1]] },
      { id: 'ffa3', label: '3 joueurs', teams: [[1], [1], [1]] },
      { id: 'ffa4', label: '4 joueurs', teams: [[1], [1], [1], [1]] },
    ],
  },
];

const ROOM_STATUS = {
  WAITING:  'waiting',
  PLAYING:  'playing',
  FINISHED: 'finished',
};
