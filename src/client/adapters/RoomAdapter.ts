/**
 * Room Adapter Interface
 *
 * Common interface for online (Colyseus) and offline (local) room connections.
 * Allows GameScene to work identically in both modes.
 */

/**
 * Simplified room state for adapter interface
 */
export interface RoomState {
  players: Map<string, any>;
  snowballs: Map<string, any>;
  phase: string;
  winner: string;
  mapSize: number;
}

/**
 * Adapter interface that abstracts Colyseus Room
 * Both OnlineRoomAdapter and OfflineRoomAdapter implement this
 */
export interface RoomAdapter {
  /** Current room state */
  readonly state: RoomState;

  /** Current player's session ID */
  readonly sessionId: string;

  /** Whether this is offline mode */
  readonly isOffline: boolean;

  /** Send message to room (move, throwSnowball, etc.) */
  send(type: string, message: any): void;

  /** Register callback for state changes */
  onStateChange(callback: (state: RoomState) => void): void;

  /** Register callback for specific message types */
  onMessage(type: string, callback: (message: any) => void): void;

  /** Register callback for when leaving room */
  onLeave(callback: (code?: number) => void): void;

  /** Leave the room */
  leave(): void;

  /** Cleanup resources */
  destroy(): void;
}
