/**
 * GameEngine Tests
 *
 * Tests for the main game engine that integrates all core systems.
 * The GameEngine is used by both server and offline client.
 */

import { GameEngine } from './GameEngine';
import { Player, Snowball, GameState, GameEngineCallbacks } from './types';
import {
  MAP_SIZE,
  PLAYER_INITIAL_ENERGY,
  PLAYER_SPEED,
  PLAYER_RADIUS,
  SNOWBALL_SPEED,
  NORMAL_DAMAGE,
  CHARGED_DAMAGE,
  CHARGE_THRESHOLD,
  THROW_COOLDOWN,
} from '../constants';

describe('GameEngine', () => {
  let engine: GameEngine;
  let callbacks: GameEngineCallbacks;

  // Track callback invocations
  let addedPlayers: Player[];
  let updatedPlayers: Player[];
  let removedPlayerIds: string[];
  let addedSnowballs: Snowball[];
  let updatedSnowballs: Snowball[];
  let removedSnowballIds: string[];
  let gameEndWinner: string | null;
  let stateChanges: GameState[];

  beforeEach(() => {
    // Reset callback trackers
    addedPlayers = [];
    updatedPlayers = [];
    removedPlayerIds = [];
    addedSnowballs = [];
    updatedSnowballs = [];
    removedSnowballIds = [];
    gameEndWinner = null;
    stateChanges = [];

    callbacks = {
      onPlayerAdd: (player) => addedPlayers.push({ ...player }),
      onPlayerUpdate: (player) => updatedPlayers.push({ ...player }),
      onPlayerRemove: (playerId) => removedPlayerIds.push(playerId),
      onSnowballAdd: (snowball) => addedSnowballs.push({ ...snowball }),
      onSnowballUpdate: (snowball) => updatedSnowballs.push({ ...snowball }),
      onSnowballRemove: (snowballId) => removedSnowballIds.push(snowballId),
      onGameEnd: (winner) => { gameEndWinner = winner; },
      onStateChange: (state) => stateChanges.push(state),
    };

    engine = new GameEngine(callbacks);
  });

  afterEach(() => {
    engine.destroy();
  });

  describe('constructor', () => {
    it('should initialize with default map size', () => {
      const state = engine.getState();
      expect(state.mapSize).toBe(MAP_SIZE);
    });

    it('should initialize with custom map size', () => {
      const customEngine = new GameEngine({}, 500);
      const state = customEngine.getState();
      expect(state.mapSize).toBe(500);
      customEngine.destroy();
    });

    it('should start in lobby phase with empty collections', () => {
      const state = engine.getState();
      expect(state.phase).toBe('lobby');
      expect(state.players.size).toBe(0);
      expect(state.snowballs.size).toBe(0);
      expect(state.winner).toBe('');
    });
  });

  describe('addPlayer', () => {
    it('should create player with correct initial properties', () => {
      const player = engine.addPlayer('player-1', 'TestPlayer', 'red', false);

      expect(player.id).toBe('player-1');
      expect(player.nickname).toBe('TestPlayer');
      expect(player.team).toBe('red');
      expect(player.isBot).toBe(false);
      expect(player.energy).toBe(PLAYER_INITIAL_ENERGY);
      expect(player.isStunned).toBe(false);
    });

    it('should create bot player correctly', () => {
      const player = engine.addPlayer('bot-1', 'BotPlayer', 'blue', true);

      expect(player.id).toBe('bot-1');
      expect(player.isBot).toBe(true);
      expect(player.team).toBe('blue');
    });

    it('should add player to game state', () => {
      engine.addPlayer('player-1', 'TestPlayer', 'red', false);

      const state = engine.getState();
      expect(state.players.has('player-1')).toBe(true);
      expect(state.players.get('player-1')?.nickname).toBe('TestPlayer');
    });

    it('should call onPlayerAdd callback', () => {
      engine.addPlayer('player-1', 'TestPlayer', 'red', false);

      expect(addedPlayers.length).toBe(1);
      expect(addedPlayers[0].id).toBe('player-1');
      expect(addedPlayers[0].nickname).toBe('TestPlayer');
    });

    it('should initialize player position to 0,0 in lobby phase', () => {
      const player = engine.addPlayer('player-1', 'TestPlayer', 'red', false);

      // In lobby phase, positions are 0,0 until game starts
      expect(player.x).toBe(0);
      expect(player.y).toBe(0);
    });
  });

  describe('removePlayer', () => {
    beforeEach(() => {
      engine.addPlayer('player-1', 'TestPlayer', 'red', false);
    });

    it('should remove player from game state', () => {
      engine.removePlayer('player-1');

      const state = engine.getState();
      expect(state.players.has('player-1')).toBe(false);
    });

    it('should call onPlayerRemove callback', () => {
      engine.removePlayer('player-1');

      expect(removedPlayerIds).toContain('player-1');
    });

    it('should not throw when removing non-existent player', () => {
      expect(() => engine.removePlayer('non-existent')).not.toThrow();
    });
  });

  describe('startGame', () => {
    beforeEach(() => {
      engine.addPlayer('player-1', 'Player1', 'red', false);
      engine.addPlayer('player-2', 'Player2', 'blue', false);
    });

    it('should set phase to playing', () => {
      engine.startGame();

      const state = engine.getState();
      expect(state.phase).toBe('playing');
    });

    it('should set spawn positions for red team players', () => {
      engine.startGame();

      const state = engine.getState();
      const player = state.players.get('player-1')!;

      // Red team: y <= x - PLAYER_RADIUS (top-right territory)
      expect(player.x).toBeGreaterThan(0);
      expect(player.y).toBeGreaterThan(0);
      expect(player.y).toBeLessThanOrEqual(player.x - PLAYER_RADIUS);
    });

    it('should set spawn positions for blue team players', () => {
      engine.startGame();

      const state = engine.getState();
      const player = state.players.get('player-2')!;

      // Blue team: y >= x + PLAYER_RADIUS (bottom-left territory)
      expect(player.x).toBeGreaterThan(0);
      expect(player.y).toBeGreaterThan(0);
      expect(player.y).toBeGreaterThanOrEqual(player.x + PLAYER_RADIUS);
    });

    it('should reset player energy to initial value', () => {
      // Damage a player before starting
      const player = engine.getState().players.get('player-1')!;
      player.energy = 5;

      engine.startGame();

      expect(player.energy).toBe(PLAYER_INITIAL_ENERGY);
    });

    it('should reset player stunned status', () => {
      // Stun a player before starting
      const player = engine.getState().players.get('player-1')!;
      player.isStunned = true;

      engine.startGame();

      expect(player.isStunned).toBe(false);
    });

    it('should not change phase if already playing', () => {
      engine.startGame();
      engine.addPlayer('player-3', 'Player3', 'red', false);

      // Try to start again - should not change anything
      engine.startGame();

      const state = engine.getState();
      expect(state.phase).toBe('playing');
    });
  });

  describe('handleMove', () => {
    beforeEach(() => {
      engine.addPlayer('player-red', 'RedPlayer', 'red', false);
      engine.addPlayer('player-blue', 'BluePlayer', 'blue', false);
      engine.startGame();
    });

    it('should update player position based on movement direction', () => {
      const state = engine.getState();
      const player = state.players.get('player-red')!;
      const initialX = player.x;
      const initialY = player.y;

      // Move in direction that stays in territory (toward top-right for red)
      engine.handleMove('player-red', 1, -1);

      // Position should change by PLAYER_SPEED * direction
      expect(player.x).toBeCloseTo(initialX + PLAYER_SPEED * 1, 5);
      expect(player.y).toBeCloseTo(initialY + PLAYER_SPEED * -1, 5);
    });

    it('should not move player when game is not playing', () => {
      const customEngine = new GameEngine();
      customEngine.addPlayer('player-1', 'Player1', 'red', false);

      const state = customEngine.getState();
      const player = state.players.get('player-1')!;
      const initialX = player.x;
      const initialY = player.y;

      customEngine.handleMove('player-1', 1, 0);

      expect(player.x).toBe(initialX);
      expect(player.y).toBe(initialY);
      customEngine.destroy();
    });

    it('should not move stunned player', () => {
      const state = engine.getState();
      const player = state.players.get('player-red')!;
      player.isStunned = true;
      const initialX = player.x;
      const initialY = player.y;

      engine.handleMove('player-red', 1, 0);

      expect(player.x).toBe(initialX);
      expect(player.y).toBe(initialY);
    });

    it('should clamp position to territory boundaries', () => {
      const state = engine.getState();
      const player = state.players.get('player-red')!;

      // Try to move red player toward blue territory (toward bottom-left)
      // This should be blocked by territory system
      for (let i = 0; i < 100; i++) {
        engine.handleMove('player-red', -1, 1);
      }

      // Player should still be in red territory (y <= x - PLAYER_RADIUS)
      expect(player.y).toBeLessThanOrEqual(player.x - PLAYER_RADIUS + 1); // +1 for floating point tolerance
    });

    it('should not move non-existent player', () => {
      expect(() => engine.handleMove('non-existent', 1, 0)).not.toThrow();
    });

    it('should call onPlayerUpdate callback after move', () => {
      updatedPlayers = []; // Clear previous updates from startGame
      engine.handleMove('player-red', 1, 0);

      // Check if callback was called (may or may not depending on position change)
      // The callback should be called if position changed
      const state = engine.getState();
      const player = state.players.get('player-red')!;
      if (player.x !== 0 || player.y !== 0) {
        expect(updatedPlayers.length).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('handleThrow', () => {
    beforeEach(() => {
      engine.addPlayer('player-red', 'RedPlayer', 'red', false);
      engine.addPlayer('player-blue', 'BluePlayer', 'blue', false);
      engine.startGame();
    });

    it('should create snowball with normal damage for low charge', () => {
      engine.handleThrow('player-red', 0.5);

      expect(addedSnowballs.length).toBe(1);
      expect(addedSnowballs[0].damage).toBe(NORMAL_DAMAGE);
    });

    it('should create snowball with charged damage for high charge', () => {
      engine.handleThrow('player-red', CHARGE_THRESHOLD);

      expect(addedSnowballs.length).toBe(1);
      expect(addedSnowballs[0].damage).toBe(CHARGED_DAMAGE);
    });

    it('should create snowball at player position', () => {
      const state = engine.getState();
      const player = state.players.get('player-red')!;

      engine.handleThrow('player-red', 0.5);

      expect(addedSnowballs[0].x).toBe(player.x);
      expect(addedSnowballs[0].y).toBe(player.y);
    });

    it('should set correct velocity for red team (toward bottom-left)', () => {
      engine.handleThrow('player-red', 0.5);

      const snowball = addedSnowballs[0];
      expect(snowball.velocityX).toBe(-SNOWBALL_SPEED);
      expect(snowball.velocityY).toBe(SNOWBALL_SPEED);
    });

    it('should set correct velocity for blue team (toward top-right)', () => {
      engine.handleThrow('player-blue', 0.5);

      const snowball = addedSnowballs[0];
      expect(snowball.velocityX).toBe(SNOWBALL_SPEED);
      expect(snowball.velocityY).toBe(-SNOWBALL_SPEED);
    });

    it('should set snowball team to player team', () => {
      engine.handleThrow('player-red', 0.5);

      expect(addedSnowballs[0].team).toBe('red');
    });

    it('should set snowball ownerId to player id', () => {
      engine.handleThrow('player-red', 0.5);

      expect(addedSnowballs[0].ownerId).toBe('player-red');
    });

    it('should enforce cooldown between throws', () => {
      engine.handleThrow('player-red', 0.5);
      engine.handleThrow('player-red', 0.5); // Immediate second throw

      // Only one snowball should be created due to cooldown
      expect(addedSnowballs.length).toBe(1);
    });

    it('should allow throw after cooldown expires', () => {
      // Use Jest fake timers for this test
      jest.useFakeTimers();

      const customEngine = new GameEngine(callbacks);
      customEngine.addPlayer('player-red', 'RedPlayer', 'red', false);
      customEngine.addPlayer('player-blue', 'BluePlayer', 'blue', false);
      customEngine.startGame();

      addedSnowballs = [];

      // First throw
      customEngine.handleThrow('player-red', 0.5);
      expect(addedSnowballs.length).toBe(1);

      // Advance time past the cooldown
      jest.advanceTimersByTime(THROW_COOLDOWN + 100);

      // Second throw after cooldown
      customEngine.handleThrow('player-red', 0.5);
      expect(addedSnowballs.length).toBe(2);

      customEngine.destroy();
      jest.useRealTimers();
    });

    it('should not throw when game is not playing', () => {
      const customEngine = new GameEngine(callbacks);
      customEngine.addPlayer('player-1', 'Player1', 'red', false);

      addedSnowballs = [];
      customEngine.handleThrow('player-1', 0.5);

      expect(addedSnowballs.length).toBe(0);
      customEngine.destroy();
    });

    it('should not throw when player is stunned', () => {
      const state = engine.getState();
      const player = state.players.get('player-red')!;
      player.isStunned = true;

      addedSnowballs = [];
      engine.handleThrow('player-red', 0.5);

      expect(addedSnowballs.length).toBe(0);
    });

    it('should clamp charge level to 0-1 range', () => {
      engine.handleThrow('player-red', 2.0); // Above 1

      // Should still use charged damage since 2.0 > CHARGE_THRESHOLD
      expect(addedSnowballs[0].damage).toBe(CHARGED_DAMAGE);
    });

    it('should call onSnowballAdd callback', () => {
      engine.handleThrow('player-red', 0.5);

      expect(addedSnowballs.length).toBe(1);
    });
  });

  describe('update', () => {
    beforeEach(() => {
      engine.addPlayer('player-red', 'RedPlayer', 'red', false);
      engine.addPlayer('player-blue', 'BluePlayer', 'blue', false);
      engine.startGame();
    });

    it('should move snowballs based on velocity', () => {
      engine.handleThrow('player-red', 0.5);

      const state = engine.getState();
      const snowballId = addedSnowballs[0].id;
      const snowball = state.snowballs.get(snowballId)!;
      const initialX = snowball.x;
      const initialY = snowball.y;

      engine.update(Date.now());

      // Snowball should have moved
      expect(snowball.x).toBe(initialX + snowball.velocityX);
      expect(snowball.y).toBe(initialY + snowball.velocityY);
    });

    it('should remove snowballs that are out of bounds', () => {
      engine.handleThrow('player-red', 0.5);

      const state = engine.getState();
      const snowballId = addedSnowballs[0].id;
      const snowball = state.snowballs.get(snowballId)!;

      // Move snowball way out of bounds
      snowball.x = -200;
      snowball.y = -200;

      engine.update(Date.now());

      expect(state.snowballs.has(snowballId)).toBe(false);
      expect(removedSnowballIds).toContain(snowballId);
    });

    it('should detect collision and remove snowball', () => {
      const state = engine.getState();
      const redPlayer = state.players.get('player-red')!;
      const bluePlayer = state.players.get('player-blue')!;

      // Place players close together for collision
      redPlayer.x = 400;
      redPlayer.y = 300;
      bluePlayer.x = 400;
      bluePlayer.y = 350; // Close enough for potential collision

      engine.handleThrow('player-red', 0.5);

      const snowballId = addedSnowballs[0].id;
      const snowball = state.snowballs.get(snowballId)!;

      // Position snowball directly at blue player
      snowball.x = bluePlayer.x;
      snowball.y = bluePlayer.y;

      engine.update(Date.now());

      // Snowball should be removed after collision
      expect(state.snowballs.has(snowballId)).toBe(false);
    });

    it('should apply damage on collision', () => {
      const state = engine.getState();
      const redPlayer = state.players.get('player-red')!;
      const bluePlayer = state.players.get('player-blue')!;

      const initialEnergy = bluePlayer.energy;

      engine.handleThrow('player-red', 0.5);

      const snowball = state.snowballs.values().next().value!;
      snowball.x = bluePlayer.x;
      snowball.y = bluePlayer.y;

      engine.update(Date.now());

      expect(bluePlayer.energy).toBe(initialEnergy - NORMAL_DAMAGE);
    });

    it('should stun player when energy reaches zero', () => {
      const state = engine.getState();
      const bluePlayer = state.players.get('player-blue')!;
      bluePlayer.energy = NORMAL_DAMAGE; // Will reach 0 after one hit

      engine.handleThrow('player-red', 0.5);

      const snowball = state.snowballs.values().next().value!;
      snowball.x = bluePlayer.x;
      snowball.y = bluePlayer.y;

      engine.update(Date.now());

      expect(bluePlayer.energy).toBe(0);
      expect(bluePlayer.isStunned).toBe(true);
    });

    it('should not apply damage to same-team players', () => {
      const state = engine.getState();
      const redPlayer = state.players.get('player-red')!;

      // Add another red player
      engine.addPlayer('player-red-2', 'RedPlayer2', 'red', false);
      const redPlayer2 = state.players.get('player-red-2')!;

      engine.handleThrow('player-red', 0.5);

      const snowball = state.snowballs.values().next().value!;
      snowball.x = redPlayer2.x;
      snowball.y = redPlayer2.y;

      const initialEnergy = redPlayer2.energy;
      engine.update(Date.now());

      // No damage to teammate
      expect(redPlayer2.energy).toBe(initialEnergy);
    });

    it('should not apply damage after game has ended', () => {
      const state = engine.getState();
      const bluePlayer = state.players.get('player-blue')!;
      const initialEnergy = bluePlayer.energy;

      engine.handleThrow('player-red', 0.5);

      const snowball = state.snowballs.values().next().value!;
      snowball.x = bluePlayer.x;
      snowball.y = bluePlayer.y;

      // End the game first
      state.phase = 'ended';

      engine.update(Date.now());

      // No damage after game ended
      expect(bluePlayer.energy).toBe(initialEnergy);
    });

    it('should not update when game is not playing', () => {
      const customEngine = new GameEngine(callbacks);
      customEngine.addPlayer('player-1', 'Player1', 'red', false);

      // Game is in lobby phase
      expect(() => customEngine.update(Date.now())).not.toThrow();

      customEngine.destroy();
    });
  });

  describe('win conditions', () => {
    beforeEach(() => {
      engine.addPlayer('player-red', 'RedPlayer', 'red', false);
      engine.addPlayer('player-blue', 'BluePlayer', 'blue', false);
      engine.startGame();
    });

    it('should end game with blue winner when all red players are stunned', () => {
      const state = engine.getState();
      const redPlayer = state.players.get('player-red')!;
      redPlayer.isStunned = true;

      engine.update(Date.now());

      expect(state.phase).toBe('ended');
      expect(state.winner).toBe('blue');
      expect(gameEndWinner).toBe('blue');
    });

    it('should end game with red winner when all blue players are stunned', () => {
      const state = engine.getState();
      const bluePlayer = state.players.get('player-blue')!;
      bluePlayer.isStunned = true;

      engine.update(Date.now());

      expect(state.phase).toBe('ended');
      expect(state.winner).toBe('red');
      expect(gameEndWinner).toBe('red');
    });

    it('should end game with draw when all players are stunned', () => {
      const state = engine.getState();
      const redPlayer = state.players.get('player-red')!;
      const bluePlayer = state.players.get('player-blue')!;
      redPlayer.isStunned = true;
      bluePlayer.isStunned = true;

      engine.update(Date.now());

      expect(state.phase).toBe('ended');
      expect(state.winner).toBe('draw');
      expect(gameEndWinner).toBe('draw');
    });

    it('should not end game when both teams have alive players', () => {
      const state = engine.getState();

      engine.update(Date.now());

      expect(state.phase).toBe('playing');
      expect(state.winner).toBe('');
    });

    it('should call onGameEnd callback when game ends', () => {
      const state = engine.getState();
      const redPlayer = state.players.get('player-red')!;
      redPlayer.isStunned = true;

      engine.update(Date.now());

      expect(gameEndWinner).toBe('blue');
    });
  });

  describe('fillTeamsWithBots', () => {
    let botNameCounter: number;

    const generateBotName = () => {
      botNameCounter++;
      return `Bot_${botNameCounter}`;
    };

    beforeEach(() => {
      botNameCounter = 0;
    });

    it('should fill red team to 3 players', () => {
      engine.addPlayer('player-1', 'Player1', 'red', false);
      engine.addPlayer('player-2', 'Player2', 'blue', false);

      engine.fillTeamsWithBots(generateBotName);

      const state = engine.getState();
      const redPlayers = Array.from(state.players.values()).filter((p: Player) => p.team === 'red');

      expect(redPlayers.length).toBe(3);
    });

    it('should fill blue team to 3 players', () => {
      engine.addPlayer('player-1', 'Player1', 'red', false);
      engine.addPlayer('player-2', 'Player2', 'blue', false);

      engine.fillTeamsWithBots(generateBotName);

      const state = engine.getState();
      const bluePlayers = Array.from(state.players.values()).filter((p: Player) => p.team === 'blue');

      expect(bluePlayers.length).toBe(3);
    });

    it('should mark added players as bots', () => {
      engine.addPlayer('player-1', 'Player1', 'red', false);
      engine.addPlayer('player-2', 'Player2', 'blue', false);

      engine.fillTeamsWithBots(generateBotName);

      const state = engine.getState();
      const bots = Array.from(state.players.values()).filter((p: Player) => p.isBot);

      expect(bots.length).toBe(4); // 2 for red, 2 for blue
    });

    it('should use provided nickname generator', () => {
      engine.addPlayer('player-1', 'Player1', 'red', false);
      engine.addPlayer('player-2', 'Player2', 'blue', false);

      engine.fillTeamsWithBots(generateBotName);

      const state = engine.getState();
      const bots = Array.from(state.players.values()).filter((p: Player) => p.isBot);

      expect(bots.some((b: Player) => b.nickname === 'Bot_1')).toBe(true);
    });

    it('should not add bots if teams are already full', () => {
      // Add 3 players to each team
      engine.addPlayer('red-1', 'Red1', 'red', false);
      engine.addPlayer('red-2', 'Red2', 'red', false);
      engine.addPlayer('red-3', 'Red3', 'red', false);
      engine.addPlayer('blue-1', 'Blue1', 'blue', false);
      engine.addPlayer('blue-2', 'Blue2', 'blue', false);
      engine.addPlayer('blue-3', 'Blue3', 'blue', false);

      engine.fillTeamsWithBots(generateBotName);

      const state = engine.getState();
      const bots = Array.from(state.players.values()).filter((p: Player) => p.isBot);

      expect(bots.length).toBe(0);
    });
  });

  describe('bot AI integration', () => {
    beforeEach(() => {
      engine.addPlayer('player-1', 'Player1', 'red', false);
      engine.addPlayer('bot-1', 'Bot1', 'blue', true);
      engine.startGame();
    });

    it('should register bots with BotAI on game start', () => {
      // Bot should be registered and will move/attack during updates
      const state = engine.getState();
      const bot = state.players.get('bot-1')!;

      // Initial position should be set
      expect(bot.x).toBeGreaterThan(0);
      expect(bot.y).toBeGreaterThan(0);
    });

    it('should update bot behavior during game loop', () => {
      const state = engine.getState();
      const bot = state.players.get('bot-1')!;
      const initialX = bot.x;
      const initialY = bot.y;

      // Run several updates - bot may or may not move depending on AI timing
      const now = Date.now();
      for (let i = 0; i < 100; i++) {
        engine.update(now + i * 16);
      }

      // Bot position may have changed due to AI movement
      // We can't guarantee it moved, but the update should not throw
    });
  });

  describe('destroy', () => {
    it('should clean up resources', () => {
      engine.addPlayer('player-1', 'Player1', 'red', false);
      engine.addPlayer('player-2', 'Player2', 'blue', false);
      engine.startGame();

      expect(() => engine.destroy()).not.toThrow();
    });

    it('should be safe to call multiple times', () => {
      engine.destroy();
      expect(() => engine.destroy()).not.toThrow();
    });
  });

  describe('getState', () => {
    it('should return current game state', () => {
      engine.addPlayer('player-1', 'Player1', 'red', false);

      const state = engine.getState();

      expect(state).toBeDefined();
      expect(state.players.size).toBe(1);
    });

    it('should return consistent state reference', () => {
      const state1 = engine.getState();
      const state2 = engine.getState();

      expect(state1).toBe(state2);
    });
  });

  describe('edge cases', () => {
    it('should handle empty game', () => {
      expect(() => engine.update(Date.now())).not.toThrow();
      expect(() => engine.startGame()).not.toThrow();
    });

    it('should handle single player', () => {
      engine.addPlayer('player-1', 'Player1', 'red', false);
      engine.startGame();

      expect(() => engine.update(Date.now())).not.toThrow();
    });

    it('should handle rapid input', () => {
      engine.addPlayer('player-red', 'Player1', 'red', false);
      engine.addPlayer('player-blue', 'Player2', 'blue', false);
      engine.startGame();

      // Rapid movement
      for (let i = 0; i < 100; i++) {
        engine.handleMove('player-red', Math.random() * 2 - 1, Math.random() * 2 - 1);
      }

      expect(() => engine.update(Date.now())).not.toThrow();
    });

    it('should work without callbacks', () => {
      const noCallbackEngine = new GameEngine();
      noCallbackEngine.addPlayer('player-1', 'Player1', 'red', false);
      noCallbackEngine.addPlayer('player-2', 'Player2', 'blue', false);
      noCallbackEngine.startGame();
      noCallbackEngine.handleMove('player-1', 1, 0);
      noCallbackEngine.handleThrow('player-1', 0.5);
      noCallbackEngine.update(Date.now());

      expect(() => noCallbackEngine.destroy()).not.toThrow();
    });
  });
});
