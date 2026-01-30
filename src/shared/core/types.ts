/**
 * Platform-independent game types for SnowClash
 *
 * These types are shared between server (Colyseus) and client (offline mode).
 * They contain NO dependencies on Colyseus schemas or any platform-specific code.
 */

// =============================================================================
// Team Types
// =============================================================================

/**
 * Team identifier for players and snowballs
 */
export type Team = 'red' | 'blue';

// =============================================================================
// Player Types
// =============================================================================

/**
 * Player state (platform-independent)
 *
 * Contains only the essential fields needed for game logic.
 * Server-specific fields (isHost, isReady, joinedAt) are not included.
 */
export interface Player {
  /** Unique identifier for the player (sessionId in online mode) */
  id: string;

  /** Display name for the player */
  nickname: string;

  /** Team the player belongs to */
  team: Team;

  /** Whether this player is controlled by AI */
  isBot: boolean;

  /** X position on the map */
  x: number;

  /** Y position on the map */
  y: number;

  /** Current energy level (0 = stunned) */
  energy: number;

  /** Whether the player is stunned (energy reached 0) */
  isStunned: boolean;
}

// =============================================================================
// Snowball Types
// =============================================================================

/**
 * Snowball projectile state
 *
 * Represents a thrown snowball that moves across the map.
 */
export interface Snowball {
  /** Unique identifier for the snowball */
  id: string;

  /** Player ID who threw this snowball */
  ownerId: string;

  /** Team that threw this snowball (for collision detection) */
  team: Team;

  /** X position on the map */
  x: number;

  /** Y position on the map */
  y: number;

  /** Horizontal velocity */
  velocityX: number;

  /** Vertical velocity */
  velocityY: number;

  /** Damage dealt on hit (normal: 4, charged: 7) */
  damage: number;
}

// =============================================================================
// Game State Types
// =============================================================================

/**
 * Game phases
 *
 * - lobby: Waiting for players, team selection
 * - playing: Active gameplay
 * - ended: Game finished, showing winner
 */
export type GamePhase = 'lobby' | 'playing' | 'ended';

/**
 * Complete game state
 *
 * Contains all the data needed to render and update the game.
 */
export interface GameState {
  /** Map of player ID to player state */
  players: Map<string, Player>;

  /** Map of snowball ID to snowball state */
  snowballs: Map<string, Snowball>;

  /** Current game phase */
  phase: GamePhase;

  /** Winning team ('red', 'blue', or '' if no winner yet) */
  winner: string;

  /** Size of the game map (default: 800) */
  mapSize: number;
}

// =============================================================================
// Callback Types
// =============================================================================

/**
 * Callbacks for game engine events
 *
 * These callbacks allow the rendering layer (client) to respond to
 * game state changes from the game engine.
 */
export interface GameEngineCallbacks {
  /** Called when a new player is added */
  onPlayerAdd?: (player: Player) => void;

  /** Called when a player's state is updated */
  onPlayerUpdate?: (player: Player) => void;

  /** Called when a player is removed */
  onPlayerRemove?: (playerId: string) => void;

  /** Called when a new snowball is created */
  onSnowballAdd?: (snowball: Snowball) => void;

  /** Called when a snowball's position is updated */
  onSnowballUpdate?: (snowball: Snowball) => void;

  /** Called when a snowball is removed (hit or out of bounds) */
  onSnowballRemove?: (snowballId: string) => void;

  /** Called when the game ends */
  onGameEnd?: (winner: string) => void;

  /** Called when the entire game state changes */
  onStateChange?: (state: GameState) => void;
}

// =============================================================================
// Input Types
// =============================================================================

/**
 * Movement input from player
 *
 * Represents the direction the player wants to move.
 * Values are normalized direction components (-1 to 1).
 */
export interface MoveInput {
  /** Horizontal movement direction (-1 = left, 0 = none, 1 = right) */
  x: number;

  /** Vertical movement direction (-1 = up, 0 = none, 1 = down) */
  y: number;
}

/**
 * Throw snowball input from player
 *
 * Contains information about how long the player charged the throw.
 */
export interface ThrowInput {
  /**
   * Charge level (0 to 1)
   *
   * - 0: No charge (minimum throw)
   * - 0.7+: Full charge (charged damage)
   */
  chargeLevel: number;
}
