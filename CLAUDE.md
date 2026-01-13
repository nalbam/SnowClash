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
- **Entry point**: `src/server/index.ts` - Express server with Colyseus game server
- **Game room**: `src/server/rooms/GameRoom.ts` - All game logic, message handlers, and game loop (60 FPS)
- **Schemas**: `src/server/schema/` - Colyseus state schemas using `@colyseus/schema` decorators
  - `GameState` - Root state containing players, snowballs, phase, winner
  - `PlayerSchema` - Player state (position, energy, team, ready status)
  - `SnowballSchema` - Projectile state (position, velocity, damage)

### Client (Phaser 3)
- **Entry point**: `src/client/index.ts` - Phaser game config
- **Scenes**:
  - `LobbyScene` - Team selection, ready system, Google auth (simplified)
  - `GameScene` - Main gameplay, handles input and renders state from server

### Communication Flow
1. Client connects via WebSocket to Colyseus server
2. Client sends messages: `setProfile`, `selectTeam`, `ready`, `startGame`, `move`, `throwSnowball`
3. Server broadcasts state changes via Colyseus state synchronization
4. Client listens to `onAdd`/`onRemove`/`onChange` callbacks on state collections

## Game Constants

Located in `src/server/rooms/GameRoom.ts`:
- `MAP_SIZE`: 800px
- `PLAYER_SPEED`: 3
- `SNOWBALL_SPEED`: 5
- `NORMAL_DAMAGE`: 4 (tap space)
- `CHARGED_DAMAGE`: 7 (hold space ≥0.7s)
- `READY_TIMEOUT`: 60000ms (auto-kick if not ready)

## Key Game Mechanics

- **Territory**: Map divided by `\` diagonal (top-left to bottom-right). Red team (top-right): `y <= x`, Blue team (bottom-left): `y >= x`
- **Energy**: Players start with 10 energy, stunned when reaching 0
- **Phases**: `lobby` → `playing` → `ended`
- **Host authority**: First player to join becomes host and can start the game

## Build Configuration

- **TypeScript**: Server uses `tsc` (tsconfig.json includes only `src/server/**/*`)
- **Webpack**: Client bundled with ts-loader, outputs to `public/bundle.js`
- Client and server are compiled separately with different configurations
