# SnowClash Documentation

Complete documentation for the SnowClash multiplayer snowball fight game.

## 🎮 Live Demo

Play now at: **[https://snowclash.nalbam.com](https://snowclash.nalbam.com)**

Server: `snowclash.server.nalbam.com`

## 📚 Documentation Index

### Getting Started

- **[Main README](../README.md)** - Project overview, quick start, and basic usage
- **[Contributing Guide](./CONTRIBUTING.md)** - How to contribute to the project

### Architecture & Design

- **[Architecture Guide](./ARCHITECTURE.md)** - System architecture, component overview, and data flow
  - Server architecture (Colyseus, schemas, rooms)
  - Client architecture (Phaser 3, scenes)
  - State synchronization mechanisms
  - Network communication patterns

### Game Documentation

- **[Game Mechanics](./GAME_MECHANICS.md)** - Detailed game rules, systems, and constants
  - Movement and territory system
  - Combat mechanics (snowballs, charging, damage)
  - Energy and stun system
  - Bot AI behavior
  - Victory conditions
  - Character animations

### API & Integration

- **[API Reference](./API.md)** - REST API and WebSocket message protocol
  - REST endpoints (`/api/rooms`, `/api/nickname`)
  - WebSocket messages (Colyseus protocol)
  - State schemas and data structures
  - Client-server message flow

### Development

- **[Testing Guide](./TESTING.md)** - Test setup, running tests, and coverage
  - Unit tests (NicknameGenerator, BotController, GameRoom)
  - Test execution and coverage reports
  - Writing new tests
  - Continuous integration

### Deployment

- **[Deployment Guide](./DEPLOYMENT.md)** - Production deployment instructions
  - Server configuration
  - Environment variables
  - AWS/Cloud deployment
  - Horizontal scaling with Redis

- **[Google OAuth Setup](./GOOGLE_OAUTH_SETUP.md)** - ⚠️ **Not Currently Implemented** (Future enhancement)
  - OAuth 2.0 setup (planned)
  - Credentials configuration
  - Integration guide

## 🗂️ Documentation Structure

```
docs/
├── README.md                  # This file - documentation index
├── ARCHITECTURE.md            # System design and architecture
├── API.md                     # API reference and protocol
├── GAME_MECHANICS.md          # Game rules and mechanics
├── TESTING.md                 # Testing guide and coverage
├── DEPLOYMENT.md              # Production deployment
├── GOOGLE_OAUTH_SETUP.md      # OAuth configuration
└── CONTRIBUTING.md            # Contribution guidelines
```

## 📖 Reading Guide

### For New Developers

1. Start with **[Main README](../README.md)** for project overview
2. Read **[Architecture Guide](./ARCHITECTURE.md)** to understand system design
3. Review **[Game Mechanics](./GAME_MECHANICS.md)** for game rules
4. Check **[API Reference](./API.md)** for integration details
5. Follow **[Testing Guide](./TESTING.md)** to run tests
6. Read **[Contributing Guide](./CONTRIBUTING.md)** before making changes

### For Players/Users

1. **[Main README](../README.md)** - How to play the game
2. **[Game Mechanics](./GAME_MECHANICS.md)** - Detailed game rules

### For DevOps/Deployment

1. **[Deployment Guide](./DEPLOYMENT.md)** - Production setup
2. **[Architecture Guide](./ARCHITECTURE.md)** - System requirements
3. **[API Reference](./API.md)** - Network configuration

### For QA/Testers

1. **[Testing Guide](./TESTING.md)** - Test execution
2. **[Game Mechanics](./GAME_MECHANICS.md)** - Expected behavior
3. **[API Reference](./API.md)** - Message protocol

## 🔍 Quick Links

### Key Concepts

- **3v3 Gameplay**: Team-based snowball fight with bot support
- **Diagonal Territory**: Map divided by `\` diagonal (top-left to bottom-right)
- **Energy System**: 10 energy per player, 4/7 damage per hit
- **Bot AI**: Auto-fill teams, 2s attack interval, 1s direction change
- **Anonymous Play**: No sign-up required, random nicknames

### Technology Stack

- **Server**: Node.js, TypeScript, Colyseus, Express
- **Client**: Phaser 3, TypeScript, Webpack
- **State Management**: @colyseus/schema (automatic synchronization)
- **Shared Utilities**: Error handling (GameError), Logging (Logger), Type-safe messages
- **Testing**: Jest, ts-jest
- **Deployment**: Docker, AWS, Redis (optional)

## 📝 Documentation Updates

When updating documentation:

1. Keep this index file updated with new documents
2. Update the main README.md if needed
3. Use consistent formatting across all docs
4. Include code examples where appropriate
5. Keep diagrams and ASCII art up to date
6. Test all commands and code snippets

## 🆘 Getting Help

If you can't find what you're looking for:

1. Check the [Main README](../README.md) FAQ section
2. Search existing documentation using `grep -r "keyword" docs/`
3. Review [API Reference](./API.md) for technical details
4. Check [Game Mechanics](./GAME_MECHANICS.md) for game-specific questions
5. Open an issue on GitHub with the `documentation` label

## 📜 License

This documentation is part of the SnowClash project and is licensed under ISC.
