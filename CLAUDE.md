# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

```bash
# Install dependencies
npm install

# Development (runs both server and client concurrently)
npm run dev

# Or run separately:
npm run dev:server    # Server on http://localhost:2567
npm run dev:client    # Client on http://localhost:8080

# Production build
npm run build         # Build client (outputs to public/)
npm run build:server  # Build server (outputs to dist/server/)
npm start             # Run production server
```

## Architecture

SnowClash is a 3v3 multiplayer snowball fight game using a client-server architecture:

### Server (Colyseus)
- **Entry point**: `src/server/index.ts` - Express server with Colyseus game server, REST API
- **Game room**: `src/server/rooms/GameRoom.ts` - All game logic, message handlers, and game loop (60 FPS)
- **Schemas**: `src/server/schema/` - Colyseus state schemas using `@colyseus/schema` decorators
  - `GameState` - Root state containing players, snowballs, phase, winner, roomName, botCount, mapSize
  - `PlayerSchema` - Player state (sessionId, nickname, googleId, photoUrl, team, isReady, isHost, isBot, x, y, energy, isStunned, joinedAt)
  - `SnowballSchema` - Projectile state (id, ownerId, x, y, velocityX, velocityY, team, damage)
- **Bots**: `src/server/bots/BotController.ts` - Bot creation, AI movement (1s direction change), attack behavior (2s interval), removal
- **Utils**: `src/server/utils/NicknameGenerator.ts` - Random nickname generation

### Client (Phaser 3)
- **Entry point**: `src/client/index.ts` - Phaser game config
- **Scenes**:
  - `MainMenuScene` - Nickname display, room list, create/join room, quick play
  - `LobbyScene` - Team selection, ready system, player list
  - `GameScene` - Main gameplay, handles input and renders state from server

### Communication Flow
1. Client fetches nickname via REST API (`GET /api/nickname`)
2. Client fetches room list via REST API (`GET /api/rooms`)
3. Client connects via WebSocket to Colyseus server
4. Client sends messages: `setProfile`, `selectTeam`, `ready`, `startGame`, `move`, `throwSnowball`
5. Server broadcasts state changes via Colyseus state synchronization
6. Server broadcasts `gameEnded` message with winner when game ends
7. Client listens to `onStateChange` and `onAdd`/`onRemove`/`onChange` callbacks on state collections

## Game Constants

Located in `src/server/rooms/GameRoom.ts`:
- `MAP_SIZE`: 600px
- `PLAYER_SPEED`: 2
- `SNOWBALL_SPEED`: 4
- `NORMAL_DAMAGE`: 4 (tap space)
- `CHARGED_DAMAGE`: 7 (hold space ≥0.7s)
- `READY_TIMEOUT`: 60000ms (auto-kick if not ready)

Located in `src/server/bots/BotController.ts`:
- `BOT_ATTACK_INTERVAL`: 2000ms (bot throws snowball every 2s)
- `BOT_DIRECTION_CHANGE_INTERVAL`: 1000ms (bot changes movement direction every 1s)

Located in `src/client/scenes/GameScene.ts`:
- `THROW_COOLDOWN`: 1000ms (minimum time between throws)
- `MIN_CHARGE_TIME`: 200ms (minimum charge time to throw)

## Key Game Mechanics

- **Anonymous Login**: Random nickname, no sign-in required
- **Room System**: Browse rooms, create room, quick play
- **Bot Players**: Auto-fill teams to 3v3, bots throw snowballs every 2s and move around every 1s
- **Territory**: Map divided by `\` diagonal (top-left to bottom-right). Red team (top-right): `y <= x`, Blue team (bottom-left): `y >= x`
- **Territory Boundaries**: 15px padding from map edges and diagonal line (playerRadius)
- **Spawn Positions**: Random within team territory with 30px margin from diagonal and 20px from edges
- **Energy**: Players start with 10 energy, stunned when reaching 0
- **Stunned Players**: Can still be hit by snowballs (act as dummy/shield)
- **Snowball Hit Detection**: Player radius (15px) + snowball radius (normal: 5px, charged: 9px)
- **Snowball Direction**: Red team shoots toward bottom-left (−x, +y), Blue team shoots toward top-right (+x, −y)
- **Game End**: Snowballs continue moving for 3 seconds after game ends
- **Phases**: `lobby` → `playing` → `ended`
- **Host authority**: First human player to join becomes host and can start the game

## Controls

- **Movement**: WASD keys or Arrow keys
- **Throw Snowball**: Space (hold to charge, release to throw)
  - Minimum charge: 0.2s required to throw
  - Full charge: 0.7s+ for charged damage (7 instead of 4)
  - Cooldown: 1s between throws

## Build Configuration

- **TypeScript**: Server uses `tsc` (tsconfig.json includes only `src/server/**/*`)
- **Webpack**: Client bundled with ts-loader, outputs to `public/bundle.js`
- Client and server are compiled separately with different configurations

## Environment Variables

### Client (build-time)
- `SERVER_URL`: Server address for client to connect (default: `localhost:2567`)
```bash
# Development (default)
npm run dev

# Production build with custom server
SERVER_URL=game.example.com:2567 npm run build

# Or with HTTPS (protocol auto-detected from page)
SERVER_URL=game.example.com npm run build
```

### Server (runtime)
- `PORT`: Server port (default: `2567`)
- `REDIS_URL`: Redis server URL for horizontal scaling (optional)
  - If not set, runs in single server mode
  - Format: `redis://[username:password@]host:port`
- `ALLOWED_ORIGINS`: Comma-separated list of allowed CORS origins
  - Default: `http://localhost:8080,http://localhost:2567`
  - Required for production security
- `NODE_ENV`: Set to `production` for stricter security

```bash
# Single server mode (default)
npm start

# With custom port
PORT=3000 npm start

# With Redis for horizontal scaling
REDIS_URL=redis://localhost:6379 npm start

# Production with security
NODE_ENV=production \
ALLOWED_ORIGINS=https://game.example.com \
REDIS_URL=redis://:password@redis.example.com:6379 \
PORT=2567 npm start
```

## Security Features

- **Helmet**: Security headers (X-Frame-Options, X-Content-Type-Options, etc.)
- **CORS**: Restricted to `ALLOWED_ORIGINS` in production
- **Rate Limiting**:
  - API: 100 requests per 15 minutes
  - Room creation: 5 per minute
- **Input Validation**: Nickname length, room name sanitization
- **Payload Limit**: 10KB max request body

### Horizontal Scaling with Redis

When `REDIS_URL` is set, multiple server instances share room information:

```
┌─────────────────┐     ┌─────────────────┐
│    Server 1     │     │    Server 2     │
│  REDIS_URL=...  │     │  REDIS_URL=...  │
│  PORT=2567      │     │  PORT=2568      │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     │
              ┌──────▼──────┐
              │    Redis    │
              └─────────────┘
```

- **RedisPresence**: Shares room metadata across servers
- **RedisDriver**: Enables room queries across all servers
- **Load Balancer**: Required for production (Nginx with ip_hash recommended)
