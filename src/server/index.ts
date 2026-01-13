import { Server, matchMaker, ServerOptions } from 'colyseus';
import { RedisPresence } from '@colyseus/redis-presence';
import { RedisDriver } from '@colyseus/redis-driver';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import { GameRoom } from './rooms/GameRoom';
import { generateNickname } from './utils/NicknameGenerator';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const server = createServer(app);

// Redis configuration (optional - for horizontal scaling)
const REDIS_URL = process.env.REDIS_URL;

const serverOptions: ServerOptions = {
  server: server,
};

if (REDIS_URL) {
  console.log(`Redis enabled: ${REDIS_URL}`);
  serverOptions.presence = new RedisPresence(REDIS_URL);
  serverOptions.driver = new RedisDriver(REDIS_URL);
} else {
  console.log('Redis not configured - running in single server mode');
}

const gameServer = new Server(serverOptions);

gameServer.define('game_room', GameRoom);

// REST API: Get list of available rooms
app.get('/api/rooms', async (req, res) => {
  try {
    const rooms = await matchMaker.query({ name: 'game_room' });
    const roomList = rooms.map(room => ({
      roomId: room.roomId,
      roomName: room.metadata?.roomName || 'Game Room',
      playerCount: room.clients,
      maxPlayers: 6
    }));
    res.json(roomList);
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

// REST API: Create a new room
app.post('/api/rooms', async (req, res) => {
  try {
    const roomName = req.body.roomName || 'Game Room';
    const room = await matchMaker.createRoom('game_room', { roomName });
    res.json({
      roomId: room.roomId,
      roomName: roomName
    });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// REST API: Generate random nickname
app.get('/api/nickname', (req, res) => {
  res.json({ nickname: generateNickname() });
});

const port = Number(process.env.PORT) || 2567;
gameServer.listen(port);

console.log(`SnowClash server listening on port ${port}`);
