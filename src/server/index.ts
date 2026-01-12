import { Server } from 'colyseus';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import { GameRoom } from './rooms/GameRoom';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const server = createServer(app);
const gameServer = new Server({
  server: server,
});

gameServer.define('game_room', GameRoom);

const port = Number(process.env.PORT) || 2567;
gameServer.listen(port);

console.log(`SnowClash server listening on port ${port}`);
