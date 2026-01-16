# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Documentation Guidelines

**IMPORTANT**: All documentation files must be stored in the `docs/` directory.

- ✅ **Correct**: `docs/RELEASE.md`, `docs/ARCHITECTURE.md`, `docs/API.md`
- ❌ **Wrong**: `RELEASE.md` (in root), `guide/RELEASE.md`, etc.

**Exceptions**: Only the following files are allowed in the root:
- `README.md` - Main project overview
- `CLAUDE.md` - This file
- `LICENSE` - License file
- `.gitignore`, `.dockerignore`, etc. - Configuration files

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

### Shared
- **Constants**: `src/shared/constants.ts` - Game constants shared between server and client

### Client (Phaser 3)
- **Entry point**: `src/client/index.ts` - Phaser game config
- **Config**: `src/client/config.ts` - Server connection settings (wsUrl, apiUrl, auto-detect HTTP/HTTPS)
- **Assets**: `src/client/assets/` - Pixel art assets
  - `PixelCharacter.ts` - Character textures and animations
  - `EnvironmentAssets.ts` - Environment decorations (trees, rocks, bushes)
- **Systems**: `src/client/systems/` - Modular game systems
  - `InputSystem.ts` - Keyboard, mouse, touch input handling and charge gauge
  - `PlayerRenderSystem.ts` - Player sprite rendering, animations, and UI elements
  - `SnowballSystem.ts` - Snowball rendering and debris effects
  - `VirtualControllerSystem.ts` - Mobile virtual joystick and attack button (touch controls)
- **Scenes**:
  - `MainMenuScene` - Nickname display, room list, create/join room, quick play
  - `LobbyScene` - Team selection, ready system, player list
  - `GameScene` - Main gameplay, orchestrates systems and state synchronization

### REST API Endpoints
- `GET /api/nickname` - Generate random nickname
- `GET /api/rooms` - List available rooms
- `POST /api/rooms` - Create new room (body: `{ name: string }`)
- `GET /api/version` - Get server version (response: `{ version: string }`)

### Communication Flow
1. Client fetches nickname via REST API (`GET /api/nickname`)
2. Client fetches room list via REST API (`GET /api/rooms`)
3. Client connects via WebSocket to Colyseus server
4. Client sends messages: `setProfile`, `selectTeam`, `ready`, `startGame`, `move`, `throwSnowball`
5. Server broadcasts state changes via Colyseus state synchronization
6. Server broadcasts `gameEnded` message with winner when game ends
7. Client listens to `onStateChange` and `onAdd`/`onRemove`/`onChange` callbacks on state collections

## Game Constants

All game constants are defined in `src/shared/constants.ts` and shared between server and client:

**Map & Player:**
- `MAP_SIZE`: 800px
- `PLAYER_SPEED`: 2
- `PLAYER_RADIUS`: 15px
- `PLAYER_INITIAL_ENERGY`: 10

**Snowball:**
- `SNOWBALL_SPEED`: 4
- `SNOWBALL_RADIUS_NORMAL`: 5px
- `SNOWBALL_RADIUS_CHARGED`: 9px
- `NORMAL_DAMAGE`: 4 (tap space)
- `CHARGED_DAMAGE`: 7 (hold space ≥0.7s)
- `CHARGE_THRESHOLD`: 0.7

**Timing:**
- `READY_TIMEOUT`: 60000ms (auto-kick if not ready)
- `THROW_COOLDOWN`: 1000ms (minimum time between throws)
- `MIN_CHARGE_TIME`: 200ms (minimum charge time to throw)

**Bot Behavior:**
- `BOT_ATTACK_INTERVAL`: 2000ms (bot throws snowball every 2s)
- `BOT_DIRECTION_CHANGE_INTERVAL`: 1000ms (bot changes movement direction every 1s)

**Territory:**
- `TERRITORY_PADDING`: 15px (distance from diagonal line)
- `SPAWN_MARGIN`: 30px (distance from diagonal for spawning)
- `SPAWN_PADDING`: 20px (distance from map edges for spawning)

**UI Layout:**
- `UI_HEADER_HEIGHT`: 70px (top margin for title/header)
- `UI_FOOTER_HEIGHT`: 70px (bottom margin for buttons)
- `MOBILE_CONTROLLER_HEIGHT`: 200px (mobile virtual controller area)
- `PLAYABLE_AREA_TOP`: 70px (calculated: UI_HEADER_HEIGHT)
- `PLAYABLE_AREA_BOTTOM`: 730px (calculated: MAP_SIZE - UI_FOOTER_HEIGHT)
- `PLAYABLE_AREA_HEIGHT`: 660px (calculated: PLAYABLE_AREA_BOTTOM - PLAYABLE_AREA_TOP)
- `PLAYER_SPACING`: 110px (distance between players in lobby)

**Room Limits (defined in GameRoom):**
- `MAX_PLAYERS`: 6 (3v3 teams)
- `MAX_NICKNAME_LENGTH`: 20 characters

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
- **Game End**:
  - Snowballs continue moving but deal no damage after game ends
  - Victory celebration: Winning team revives, can move freely, and performs cheer animation
  - Energy bars hidden
  - "Return to Menu" button displayed (manual return, no auto-redirect)
  - Light overlay (20% opacity) to indicate game end
- **Phases**: `lobby` → `playing` → `ended`
- **Host authority**: First human player to join becomes host and can start the game

## Controls

### Movement
- **Keyboard**: WASD keys or Arrow keys
- **Mouse**: Click and hold - player moves toward cursor position (360° directional movement)
- **Touch (Desktop)**: Touch and hold - player moves toward touch position
- **Touch (Mobile)**: Virtual joystick in bottom-left corner

**Movement Behavior:**
- Keyboard input takes priority over pointer input
- Pointer-based: Hold down to continuously move toward cursor/touch position
- Stops when within 5px of target or when released
- Uses normalized direction vectors for smooth 360-degree movement
- Mobile: Virtual joystick provides 360° analog movement control

### Throw Snowball
- **Keyboard**: Space (hold to charge, release to throw)
- **Mouse**: Click and hold to charge, release to fire
- **Touch (Desktop)**: Touch and hold to charge, release to fire
- **Touch (Mobile)**: Virtual attack button in bottom-right corner

**Throwing Mechanics:**
- Minimum charge: 0.2s required to throw
- Full charge: 0.7s+ for charged damage (7 instead of 4)
- Cooldown: 1s between throws
- Mobile: Virtual attack button with visual charge gauge

**Important**: Since pointer is used for both movement and attacking, the input is context-dependent:
- Keep holding to move (if not charging yet)
- Hold long enough and it becomes a charge attack instead of movement

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
SERVER_URL=snowclash.server.nalbam.com npm run build
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
ALLOWED_ORIGINS=https://snowclash.nalbam.com \
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

## Release and Deployment

### GitHub Actions Workflows

Located in `.github/workflows/`:

**release.yml** - Automated release workflow
- **Trigger**: Tag push with `v*` pattern (e.g., `v1.0.0`, `v1.2.3`)
- **Jobs**:
  1. **build-and-deploy-client**:
     - Builds client with `npm run build`
     - Deploys to GitHub Pages
     - URL: `https://<username>.github.io/SnowClash/`
  2. **build-and-push-docker**:
     - Builds Docker image using `Dockerfile`
     - Pushes to GitHub Container Registry (ghcr.io)
     - Tags: `v1.2.3`, `v1.2`, `v1`, `latest`
     - Multi-platform: `linux/amd64`, `linux/arm64`

**deploy-client.yml.disabled** - Old workflow (disabled)
- Previously triggered on main branch push
- Renamed to `.disabled` to prevent execution

### Creating a Release

**Important:** The workflow automatically updates `package.json` version from the tag (e.g., `v1.0.0` → `1.0.0`). You don't need to manually update `package.json`.

```bash
# Create and push tag
git tag v1.0.0
git push origin v1.0.0
```

Or use annotated tag:
```bash
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

The workflow will:
1. Extract version from tag (`v1.2.3` → `1.2.3`)
2. Update `package.json` version with `npm version <version> --no-git-tag-version`
3. Build client and Docker image with correct version
4. Deploy to GitHub Pages and push to ghcr.io

### Docker Image Tags

For release `v1.2.3`, the following tags are created:
- `ghcr.io/<username>/snowclash:v1.2.3` - Exact version
- `ghcr.io/<username>/snowclash:v1.2` - Minor version
- `ghcr.io/<username>/snowclash:v1` - Major version
- `ghcr.io/<username>/snowclash:latest` - Latest release

### Required GitHub Settings

1. **GitHub Pages**: Settings → Pages → Source: GitHub Actions
2. **Workflow Permissions**: Settings → Actions → General → Workflow permissions: Read and write ✅
3. **Repository Variables** (optional): Settings → Secrets and variables → Actions → Variables
   - `SERVER_URL`: Default server URL for client builds

See **[docs/RELEASE.md](./docs/RELEASE.md)** for detailed release instructions.
