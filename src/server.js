const path       = require('path');
const Fastify    = require('fastify');
const GameEngine = require('./engine/GameEngine');
const { registerAllGames } = require('./games/index');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// ── Initialisation Fastify ────────────────────────────────────────────────────
const fastify = Fastify({ logger: { level: process.env.LOG_LEVEL || 'info' } });

// Health check - déclaré AVANT @fastify/static pour ne pas être intercepté
fastify.get('/healthz', async () => ({ status: 'ok', uptime: Math.round(process.uptime()) }));

// Servir les fichiers statiques depuis /public
fastify.register(require('@fastify/static'), {
  root:   path.join(__dirname, '..', 'public'),
  prefix: '/',
});

// Plugin WebSocket
fastify.register(require('@fastify/websocket'));

// ── Initialisation du moteur de jeu ──────────────────────────────────────────
const engine = new GameEngine();
registerAllGames(engine);

// ── Route WebSocket ───────────────────────────────────────────────────────────
fastify.register(async function wsPlugin(fastify) {
  fastify.get('/ws', { websocket: true }, (socket, req) => {
    const socketId = req.id;  // ID unique fourni par Fastify par requête

    engine.onConnect(socketId, socket);

    socket.on('message', (rawMsg) => {
      engine.onMessage(socketId, rawMsg.toString());
    });

    socket.on('close', () => {
      engine.onDisconnect(socketId);
    });

    socket.on('error', (err) => {
      fastify.log.error({ socketId, err }, 'WebSocket error');
      engine.onDisconnect(socketId);
    });
  });
});

// ── Démarrage ─────────────────────────────────────────────────────────────────
const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: HOST });
    console.log(`\n🎮  Serveur démarré sur http://localhost:${PORT}`);
    console.log(`🔌  WebSocket disponible sur ws://localhost:${PORT}/ws\n`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
