export enum GameErrorCode {
  // Room errors (1000-1999)
  ROOM_FULL = 'ROOM_FULL',
  GAME_IN_PROGRESS = 'GAME_IN_PROGRESS',
  ROOM_NOT_FOUND = 'ROOM_NOT_FOUND',

  // Player errors (2000-2999)
  INVALID_NICKNAME = 'INVALID_NICKNAME',
  NOT_READY = 'NOT_READY',
  NO_TEAM_SELECTED = 'NO_TEAM_SELECTED',
  NOT_HOST = 'NOT_HOST',

  // Team errors (3000-3999)
  TEAM_FULL = 'TEAM_FULL',
  INVALID_TEAM = 'INVALID_TEAM',

  // Game state errors (4000-4999)
  INVALID_PHASE = 'INVALID_PHASE',
  PLAYER_STUNNED = 'PLAYER_STUNNED',

  // Network errors (5000-5999)
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMITED = 'RATE_LIMITED',

  // Validation errors (6000-6999)
  INVALID_INPUT = 'INVALID_INPUT',
  VALIDATION_FAILED = 'VALIDATION_FAILED',

  // Internal errors (9000-9999)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export class GameError extends Error {
  public readonly code: GameErrorCode;
  public readonly statusCode: number;
  public readonly metadata?: Record<string, any>;
  public readonly timestamp: number;

  constructor(
    message: string,
    code: GameErrorCode,
    statusCode: number = 400,
    metadata?: Record<string, any>
  ) {
    super(message);
    this.name = 'GameError';
    this.code = code;
    this.statusCode = statusCode;
    this.metadata = metadata;
    this.timestamp = Date.now();
    Object.setPrototypeOf(this, GameError.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      metadata: this.metadata,
      timestamp: this.timestamp,
    };
  }
}

// Factory functions for common errors
export function createRoomFullError(): GameError {
  return new GameError('Room is full', GameErrorCode.ROOM_FULL, 403);
}

export function createGameInProgressError(): GameError {
  return new GameError('Game already in progress', GameErrorCode.GAME_IN_PROGRESS, 403);
}

export function createTeamFullError(team: string): GameError {
  return new GameError(`Team ${team} is full`, GameErrorCode.TEAM_FULL, 403, { team });
}

export function createInvalidTeamError(team: string): GameError {
  return new GameError(`Invalid team: ${team}`, GameErrorCode.INVALID_TEAM, 400, { team });
}

export function createNotHostError(): GameError {
  return new GameError('Only the host can start the game', GameErrorCode.NOT_HOST, 403);
}

export function createInvalidPhaseError(phase: string): GameError {
  return new GameError(`Invalid phase: ${phase}`, GameErrorCode.INVALID_PHASE, 400, { phase });
}

export function createPlayerStunnedError(): GameError {
  return new GameError('Player is stunned', GameErrorCode.PLAYER_STUNNED, 400);
}
