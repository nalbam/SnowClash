import {
  GameError,
  GameErrorCode,
  createRoomFullError,
  createGameInProgressError,
  createTeamFullError,
  createInvalidTeamError,
  createNotHostError,
  createInvalidPhaseError,
  createPlayerStunnedError,
} from './errors';

describe('GameError', () => {
  describe('constructor', () => {
    it('should create error with all properties', () => {
      const error = new GameError(
        'Test error',
        GameErrorCode.ROOM_FULL,
        403,
        { playerId: '123' }
      );

      expect(error.message).toBe('Test error');
      expect(error.code).toBe(GameErrorCode.ROOM_FULL);
      expect(error.statusCode).toBe(403);
      expect(error.metadata).toEqual({ playerId: '123' });
      expect(error.timestamp).toBeDefined();
      expect(typeof error.timestamp).toBe('number');
    });

    it('should use default status code 400 if not provided', () => {
      const error = new GameError('Test error', GameErrorCode.INVALID_INPUT);

      expect(error.statusCode).toBe(400);
    });

    it('should work without metadata', () => {
      const error = new GameError('Test error', GameErrorCode.ROOM_FULL, 403);

      expect(error.metadata).toBeUndefined();
    });

    it('should set name to GameError', () => {
      const error = new GameError('Test error', GameErrorCode.ROOM_FULL);

      expect(error.name).toBe('GameError');
    });

    it('should be instance of Error', () => {
      const error = new GameError('Test error', GameErrorCode.ROOM_FULL);

      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('toJSON', () => {
    it('should serialize to JSON with all fields', () => {
      const error = new GameError(
        'Test error',
        GameErrorCode.TEAM_FULL,
        403,
        { team: 'red' }
      );

      const json = error.toJSON();

      expect(json).toEqual({
        name: 'GameError',
        message: 'Test error',
        code: GameErrorCode.TEAM_FULL,
        statusCode: 403,
        metadata: { team: 'red' },
        timestamp: expect.any(Number),
      });
    });

    it('should serialize without metadata if not provided', () => {
      const error = new GameError('Test error', GameErrorCode.ROOM_FULL, 403);

      const json = error.toJSON();

      expect(json.metadata).toBeUndefined();
    });
  });
});

describe('Error Factory Functions', () => {
  describe('createRoomFullError', () => {
    it('should create room full error with correct properties', () => {
      const error = createRoomFullError();

      expect(error.message).toBe('Room is full');
      expect(error.code).toBe(GameErrorCode.ROOM_FULL);
      expect(error.statusCode).toBe(403);
    });
  });

  describe('createGameInProgressError', () => {
    it('should create game in progress error with correct properties', () => {
      const error = createGameInProgressError();

      expect(error.message).toBe('Game already in progress');
      expect(error.code).toBe(GameErrorCode.GAME_IN_PROGRESS);
      expect(error.statusCode).toBe(403);
    });
  });

  describe('createTeamFullError', () => {
    it('should create team full error with correct properties', () => {
      const error = createTeamFullError('red');

      expect(error.message).toBe('Team red is full');
      expect(error.code).toBe(GameErrorCode.TEAM_FULL);
      expect(error.statusCode).toBe(403);
      expect(error.metadata).toEqual({ team: 'red' });
    });

    it('should work with blue team', () => {
      const error = createTeamFullError('blue');

      expect(error.message).toBe('Team blue is full');
      expect(error.metadata).toEqual({ team: 'blue' });
    });
  });

  describe('createInvalidTeamError', () => {
    it('should create invalid team error with correct properties', () => {
      const error = createInvalidTeamError('invalid');

      expect(error.message).toBe('Invalid team: invalid');
      expect(error.code).toBe(GameErrorCode.INVALID_TEAM);
      expect(error.statusCode).toBe(400);
      expect(error.metadata).toEqual({ team: 'invalid' });
    });
  });

  describe('createNotHostError', () => {
    it('should create not host error with correct properties', () => {
      const error = createNotHostError();

      expect(error.message).toBe('Only the host can start the game');
      expect(error.code).toBe(GameErrorCode.NOT_HOST);
      expect(error.statusCode).toBe(403);
    });
  });

  describe('createInvalidPhaseError', () => {
    it('should create invalid phase error with correct properties', () => {
      const error = createInvalidPhaseError('invalid');

      expect(error.message).toBe('Invalid phase: invalid');
      expect(error.code).toBe(GameErrorCode.INVALID_PHASE);
      expect(error.statusCode).toBe(400);
      expect(error.metadata).toEqual({ phase: 'invalid' });
    });
  });

  describe('createPlayerStunnedError', () => {
    it('should create player stunned error with correct properties', () => {
      const error = createPlayerStunnedError();

      expect(error.message).toBe('Player is stunned');
      expect(error.code).toBe(GameErrorCode.PLAYER_STUNNED);
      expect(error.statusCode).toBe(400);
    });
  });
});

describe('GameErrorCode enum', () => {
  it('should have all expected error codes', () => {
    // Room errors
    expect(GameErrorCode.ROOM_FULL).toBe('ROOM_FULL');
    expect(GameErrorCode.GAME_IN_PROGRESS).toBe('GAME_IN_PROGRESS');
    expect(GameErrorCode.ROOM_NOT_FOUND).toBe('ROOM_NOT_FOUND');

    // Player errors
    expect(GameErrorCode.INVALID_NICKNAME).toBe('INVALID_NICKNAME');
    expect(GameErrorCode.NOT_READY).toBe('NOT_READY');
    expect(GameErrorCode.NO_TEAM_SELECTED).toBe('NO_TEAM_SELECTED');
    expect(GameErrorCode.NOT_HOST).toBe('NOT_HOST');

    // Team errors
    expect(GameErrorCode.TEAM_FULL).toBe('TEAM_FULL');
    expect(GameErrorCode.INVALID_TEAM).toBe('INVALID_TEAM');

    // Game state errors
    expect(GameErrorCode.INVALID_PHASE).toBe('INVALID_PHASE');
    expect(GameErrorCode.PLAYER_STUNNED).toBe('PLAYER_STUNNED');

    // Network errors
    expect(GameErrorCode.CONNECTION_ERROR).toBe('CONNECTION_ERROR');
    expect(GameErrorCode.TIMEOUT).toBe('TIMEOUT');
    expect(GameErrorCode.RATE_LIMITED).toBe('RATE_LIMITED');

    // Validation errors
    expect(GameErrorCode.INVALID_INPUT).toBe('INVALID_INPUT');
    expect(GameErrorCode.VALIDATION_FAILED).toBe('VALIDATION_FAILED');

    // Internal errors
    expect(GameErrorCode.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
    expect(GameErrorCode.UNKNOWN_ERROR).toBe('UNKNOWN_ERROR');
  });
});
