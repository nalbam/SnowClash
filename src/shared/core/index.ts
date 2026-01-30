/**
 * Shared Game Core Module
 *
 * Platform-independent game logic that can be used by both
 * server (Colyseus) and client (offline mode).
 */

// Types
export * from './types';

// Systems
export { TerritorySystem } from './TerritorySystem';
export { PhysicsSystem } from './PhysicsSystem';
export { BotAI, type BotActions } from './BotAI';

// Main Engine
export { GameEngine } from './GameEngine';
