import 'dotenv/config';
import { Server, matchMaker, ServerOptions } from 'colyseus';
import { RedisPresence } from '@colyseus/redis-presence';
import { RedisDriver } from '@colyseus/redis-driver';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { GameRoom } from './rooms/GameRoom';
import { generateNickname } from './utils/NicknameGenerator';

const app = express();

// Security: Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: false, // Disable for game assets
  crossOriginEmbedderPolicy: false,
}));

// Security: CORS - restrict to allowed origins
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['http://localhost:8080', 'http://localhost:2567'];
console.log('ALLOWED_ORIGINS:', JSON.stringify(ALLOWED_ORIGINS));
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.) in development
    if (!origin && process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    const trimmedOrigin = origin?.trim();
    const isAllowed = trimmedOrigin && ALLOWED_ORIGINS.includes(trimmedOrigin);
    console.log('CORS check - origin:', JSON.stringify(origin), 'trimmed:', JSON.stringify(trimmedOrigin), 'allowed:', isAllowed);
    if (!origin || isAllowed) {
      callback(null, true);
    } else {
      console.log('CORS rejected origin:', JSON.stringify(origin));
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// Security: Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const roomCreateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 room creates per minute
  message: { error: 'Too many room creation requests' },
});

app.use('/api', apiLimiter);
app.use(express.json({ limit: '10kb' })); // Limit payload size
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

// REST API: Create a new room (with stricter rate limit)
app.post('/api/rooms', roomCreateLimiter, async (req, res) => {
  try {
    // Validate room name
    let roomName = req.body.roomName || 'Game Room';
    if (typeof roomName !== 'string' || roomName.length > 50) {
      return res.status(400).json({ error: 'Invalid room name' });
    }
    // Sanitize room name
    roomName = roomName.replace(/[<>]/g, '').trim();

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
