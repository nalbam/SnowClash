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
  - `GameState` - Root state containing players, snowballs, phase, winner, roomName, botCount
  - `PlayerSchema` - Player state (position, energy, team, ready status, isBot)
  - `SnowballSchema` - Projectile state (position, velocity, damage)
- **Bots**: `src/server/bots/BotController.ts` - Bot creation, behavior (2s attack interval), removal
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
4. Client sends messages: `selectTeam`, `ready`, `startGame`, `move`, `throwSnowball`
5. Server broadcasts state changes via Colyseus state synchronization
6. Client listens to `onStateChange` and `onAdd`/`onRemove`/`onChange` callbacks on state collections

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

## Key Game Mechanics

- **Anonymous Login**: Random nickname, no sign-in required
- **Room System**: Browse rooms, create room, quick play
- **Bot Players**: Auto-fill teams to 3v3, bots throw snowballs every 2s
- **Territory**: Map divided by `\` diagonal (top-left to bottom-right). Red team (top-right): `y <= x`, Blue team (bottom-left): `y >= x`
- **Energy**: Players start with 10 energy, stunned when reaching 0
- **Phases**: `lobby` → `playing` → `ended`
- **Host authority**: First human player to join becomes host and can start the game

## Build Configuration

- **TypeScript**: Server uses `tsc` (tsconfig.json includes only `src/server/**/*`)
- **Webpack**: Client bundled with ts-loader, outputs to `public/bundle.js`
- Client and server are compiled separately with different configurations
