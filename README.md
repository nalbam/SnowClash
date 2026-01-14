# SnowClash

A Snowcraft-style 3v3 online multiplayer snowball fight game built with Phaser 3 and Colyseus.

## 🎮 Live Demo

Play now at: **[https://snowclash.nalbam.com](https://snowclash.nalbam.com)**

Server: `snowclash.server.nalbam.com`

## Features

- **Anonymous Login**: Play instantly with a randomly generated nickname (no sign-in required)
- **Room System**: Browse available rooms, create new rooms, or quick play
- **Bot Players**: Bots fill empty team slots automatically (3v3)
- **Team Selection**: Choose between Red Team or Blue Team (3v3)
- **Ready System**: All players must ready up before game starts
- **Auto-kick**: Players not ready within 1 minute are automatically removed
- **Host Controls**: Room creator has game start authority
- **Diagonal Territory**: Square snow map divided by `\` diagonal (top-left to bottom-right)
- **Movement**: Keyboard controls (WASD/Arrow keys)
- **Snowball Mechanics**:
  - Press Space to throw
  - Hold Space to charge for more damage
  - Snowballs fly diagonally toward opponent territory
- **Energy System**:
  - Each player starts with 10 energy
  - Normal snowball: 4 damage
  - Charged snowball: 7 damage
  - 0 or below energy = stunned
- **Win Condition**: All opponents stunned/incapacitated

## Installation

```bash
npm install
```

## Development

Run both server and client in development mode:

```bash
npm run dev
```

Or run them separately:

```bash
# Terminal 1 - Server
npm run dev:server

# Terminal 2 - Client
npm run dev:client
```

The server will run on `http://localhost:2567`  
The client will run on `http://localhost:8080`

## Building

Build the client:

```bash
npm run build
```

Build the server:

```bash
npm run build:server
```

## Production

```bash
npm run build:server
npm run build
npm start
```

## Environment Variables

### Client (build-time)
- `SERVER_URL`: Server address for client to connect (default: `localhost:2567`)

```bash
# Development
npm run build

# Production
SERVER_URL=snowclash.server.nalbam.com npm run build
```

### Server (runtime)
- `PORT`: Server port (default: `2567`)
- `REDIS_URL`: Redis URL for horizontal scaling (optional)
- `ALLOWED_ORIGINS`: Comma-separated list of allowed CORS origins
- `NODE_ENV`: Set to `production` for stricter security

```bash
# Development
npm start

# Production
NODE_ENV=production \
ALLOWED_ORIGINS=https://snowclash.nalbam.com \
PORT=2567 \
npm start
```

## Game Rules

1. **Main Menu**:
   - Get a random nickname (can change anytime)
   - Create a new room, join an existing room, or quick play

2. **Lobby Phase**:
   - Select a team (Red or Blue)
   - Click "Ready"
   - Wait for all players to ready up
   - Host starts the game (bots fill empty slots automatically)

3. **Playing Phase**:
   - Move your character within your team's territory
   - Red team: Top-right diagonal half
   - Blue team: Bottom-left diagonal half
   - Throw snowballs at opponents
   - Hold Space to charge for more damage
   - Avoid getting hit
   - Bots move randomly every 1 second and throw snowballs every 2 seconds

4. **Winning**:
   - Stun all opponents by reducing their energy to 0 or below
   - Last team standing wins!
   - **Victory Celebration**: Winning team revives, can move freely, and performs cheer animation
   - Click "Return to Menu" button to go back

## Controls

### Desktop
- **Movement**:
  - WASD or Arrow keys
  - OR Click and hold to move toward cursor
- **Throw Snowball**:
  - Space (hold to charge, release to fire)
  - OR Click and hold to charge, release to fire

### Mobile/Touch
- **Movement**: Touch and hold to move toward touch position
- **Throw Snowball**: Touch and hold to charge, release to fire

**Note**: When using mouse/touch, keep holding to move continuously toward the cursor/touch position. Release to stop or switch to attacking.

## Technology Stack

- **Client**: Phaser 3 (game engine)
- **Server**: Colyseus (multiplayer framework)
- **Language**: TypeScript
- **Bundler**: Webpack

## Documentation

For more detailed information, see the **[Documentation Index](./docs/README.md)** or browse individual guides:

### Core Documentation
- **[Architecture Guide](./docs/ARCHITECTURE.md)** - System architecture and component overview
- **[API Reference](./docs/API.md)** - REST API and WebSocket message protocol
- **[Game Mechanics](./docs/GAME_MECHANICS.md)** - Game rules, systems, and constants

### Development
- **[Testing Guide](./docs/TESTING.md)** - Unit tests, coverage, and test execution
- **[Contributing](./docs/CONTRIBUTING.md)** - Contribution guidelines

### Deployment
- **[Deployment Guide](./docs/DEPLOYMENT.md)** - Production deployment instructions
- **[Google OAuth Setup](./docs/GOOGLE_OAUTH_SETUP.md)** - OAuth 2.0 configuration
- **[Release Guide](./docs/RELEASE.md)** - Creating releases and deploying with GitHub Actions

## Release Process

Releases are automated via GitHub Actions when you push a tag starting with `v`:

```bash
# Create and push a release tag
git tag v1.0.0
git push origin v1.0.0
```

This will automatically:
- 📝 Update `package.json` version to match the tag (e.g., `v1.0.0` → `1.0.0`)
- 🌐 Build and deploy the client to **GitHub Pages**
- 🐳 Build and push Docker image to **GitHub Container Registry** (`ghcr.io`)

**Note:** You don't need to manually update `package.json` - the CI/CD pipeline handles it automatically.

See **[docs/RELEASE.md](./docs/RELEASE.md)** for detailed instructions.

## License

ISC
