import { PhysicsSystem } from './PhysicsSystem';
import { Player, Snowball } from './types';
import {
  MAP_SIZE,
  PLAYER_RADIUS,
  SNOWBALL_RADIUS_NORMAL,
  SNOWBALL_RADIUS_CHARGED,
  NORMAL_DAMAGE,
  CHARGED_DAMAGE,
  PLAYER_INITIAL_ENERGY,
} from '../constants';

describe('PhysicsSystem', () => {
  let physicsSystem: PhysicsSystem;

  beforeEach(() => {
    physicsSystem = new PhysicsSystem();
  });

  // Helper function to create a test player
  const createPlayer = (overrides: Partial<Player> = {}): Player => ({
    id: 'player-1',
    nickname: 'TestPlayer',
    team: 'red',
    isBot: false,
    x: 400,
    y: 400,
    energy: PLAYER_INITIAL_ENERGY,
    isStunned: false,
    ...overrides,
  });

  // Helper function to create a test snowball
  const createSnowball = (overrides: Partial<Snowball> = {}): Snowball => ({
    id: 'snowball-1',
    ownerId: 'player-1',
    team: 'red',
    x: 100,
    y: 100,
    velocityX: 4,
    velocityY: 0,
    damage: NORMAL_DAMAGE,
    ...overrides,
  });

  describe('updateSnowball', () => {
    it('should move snowball by its velocity', () => {
      const snowball = createSnowball({ x: 100, y: 100, velocityX: 4, velocityY: 2 });

      physicsSystem.updateSnowball(snowball);

      expect(snowball.x).toBe(104);
      expect(snowball.y).toBe(102);
    });

    it('should handle negative velocity', () => {
      const snowball = createSnowball({ x: 100, y: 100, velocityX: -3, velocityY: -2 });

      physicsSystem.updateSnowball(snowball);

      expect(snowball.x).toBe(97);
      expect(snowball.y).toBe(98);
    });

    it('should handle zero velocity', () => {
      const snowball = createSnowball({ x: 100, y: 100, velocityX: 0, velocityY: 0 });

      physicsSystem.updateSnowball(snowball);

      expect(snowball.x).toBe(100);
      expect(snowball.y).toBe(100);
    });
  });

  describe('isSnowballOutOfBounds', () => {
    const outOfBoundsMargin = 100;

    it('should return false when snowball is inside the map', () => {
      const snowball = createSnowball({ x: 400, y: 400 });

      expect(physicsSystem.isSnowballOutOfBounds(snowball)).toBe(false);
    });

    it('should return false when snowball is at map edge', () => {
      const snowball = createSnowball({ x: 0, y: 0 });

      expect(physicsSystem.isSnowballOutOfBounds(snowball)).toBe(false);
    });

    it('should return false when snowball is within margin outside map', () => {
      const snowball = createSnowball({ x: -50, y: MAP_SIZE + 50 });

      expect(physicsSystem.isSnowballOutOfBounds(snowball)).toBe(false);
    });

    it('should return true when snowball is far left of map', () => {
      const snowball = createSnowball({ x: -outOfBoundsMargin - 1, y: 400 });

      expect(physicsSystem.isSnowballOutOfBounds(snowball)).toBe(true);
    });

    it('should return true when snowball is far right of map', () => {
      const snowball = createSnowball({ x: MAP_SIZE + outOfBoundsMargin + 1, y: 400 });

      expect(physicsSystem.isSnowballOutOfBounds(snowball)).toBe(true);
    });

    it('should return true when snowball is far above map', () => {
      const snowball = createSnowball({ x: 400, y: -outOfBoundsMargin - 1 });

      expect(physicsSystem.isSnowballOutOfBounds(snowball)).toBe(true);
    });

    it('should return true when snowball is far below map', () => {
      const snowball = createSnowball({ x: 400, y: MAP_SIZE + outOfBoundsMargin + 1 });

      expect(physicsSystem.isSnowballOutOfBounds(snowball)).toBe(true);
    });
  });

  describe('checkCollision', () => {
    it('should return true when snowball hits enemy player within radius', () => {
      const snowball = createSnowball({ x: 100, y: 100, team: 'red', damage: NORMAL_DAMAGE });
      const player = createPlayer({
        x: 100 + PLAYER_RADIUS + SNOWBALL_RADIUS_NORMAL - 1,
        y: 100,
        team: 'blue',
      });

      expect(physicsSystem.checkCollision(snowball, player)).toBe(true);
    });

    it('should return false when snowball is outside collision radius', () => {
      const snowball = createSnowball({ x: 100, y: 100, team: 'red', damage: NORMAL_DAMAGE });
      const player = createPlayer({
        x: 100 + PLAYER_RADIUS + SNOWBALL_RADIUS_NORMAL + 10,
        y: 100,
        team: 'blue',
      });

      expect(physicsSystem.checkCollision(snowball, player)).toBe(false);
    });

    it('should return false when snowball and player are on same team', () => {
      const snowball = createSnowball({ x: 100, y: 100, team: 'red' });
      const player = createPlayer({ x: 100, y: 100, team: 'red' });

      expect(physicsSystem.checkCollision(snowball, player)).toBe(false);
    });

    it('should use larger radius for charged snowball', () => {
      const chargedSnowball = createSnowball({
        x: 100,
        y: 100,
        team: 'red',
        damage: CHARGED_DAMAGE,
      });
      // Position player just outside normal radius but within charged radius
      const player = createPlayer({
        x: 100 + PLAYER_RADIUS + SNOWBALL_RADIUS_NORMAL + 2,
        y: 100,
        team: 'blue',
      });

      // Should hit with charged radius
      expect(physicsSystem.checkCollision(chargedSnowball, player)).toBe(true);

      // Normal snowball should not hit at same position
      const normalSnowball = createSnowball({
        x: 100,
        y: 100,
        team: 'red',
        damage: NORMAL_DAMAGE,
      });
      expect(physicsSystem.checkCollision(normalSnowball, player)).toBe(false);
    });

    it('should handle diagonal distance correctly', () => {
      const snowball = createSnowball({ x: 100, y: 100, team: 'red', damage: NORMAL_DAMAGE });
      // Position player diagonally - distance should be sqrt(10^2 + 10^2) = 14.14
      // Total collision distance = PLAYER_RADIUS (15) + SNOWBALL_RADIUS_NORMAL (5) = 20
      const player = createPlayer({
        x: 110,
        y: 110,
        team: 'blue',
      });

      expect(physicsSystem.checkCollision(snowball, player)).toBe(true);
    });
  });

  describe('applyDamage', () => {
    it('should reduce player energy by damage amount', () => {
      const player = createPlayer({ energy: 10 });

      physicsSystem.applyDamage(player, NORMAL_DAMAGE);

      expect(player.energy).toBe(6);
      expect(player.isStunned).toBe(false);
    });

    it('should stun player when energy reaches zero', () => {
      const player = createPlayer({ energy: 4 });

      const isStunned = physicsSystem.applyDamage(player, NORMAL_DAMAGE);

      expect(player.energy).toBe(0);
      expect(player.isStunned).toBe(true);
      expect(isStunned).toBe(true);
    });

    it('should stun player when energy goes below zero', () => {
      const player = createPlayer({ energy: 3 });

      const isStunned = physicsSystem.applyDamage(player, CHARGED_DAMAGE);

      expect(player.energy).toBe(0);
      expect(player.isStunned).toBe(true);
      expect(isStunned).toBe(true);
    });

    it('should return true if player is already stunned', () => {
      const player = createPlayer({ energy: 0, isStunned: true });

      const isStunned = physicsSystem.applyDamage(player, NORMAL_DAMAGE);

      expect(isStunned).toBe(true);
      // Energy should not change for already stunned players
      expect(player.energy).toBe(0);
    });

    it('should not reduce energy of already stunned player', () => {
      const player = createPlayer({ energy: 5, isStunned: true });

      physicsSystem.applyDamage(player, NORMAL_DAMAGE);

      // Energy should not be reduced for stunned players
      expect(player.energy).toBe(5);
    });
  });

  describe('constructor', () => {
    it('should use default MAP_SIZE when no mapSize provided', () => {
      const system = new PhysicsSystem();
      const snowball = createSnowball({ x: MAP_SIZE + 101, y: 400 });

      expect(system.isSnowballOutOfBounds(snowball)).toBe(true);
    });

    it('should use custom mapSize when provided', () => {
      const customMapSize = 500;
      const system = new PhysicsSystem(customMapSize);
      const snowball = createSnowball({ x: customMapSize + 101, y: 400 });

      expect(system.isSnowballOutOfBounds(snowball)).toBe(true);

      // Position that would be valid with default MAP_SIZE (800) but out of bounds with custom (500)
      // Out of bounds when x > customMapSize + margin (500 + 100 = 600)
      const snowballOutOfCustomBounds = createSnowball({ x: 601, y: 400 });
      expect(system.isSnowballOutOfBounds(snowballOutOfCustomBounds)).toBe(true);

      // Position within custom map bounds
      const snowballInBounds = createSnowball({ x: 599, y: 400 });
      expect(system.isSnowballOutOfBounds(snowballInBounds)).toBe(false);
    });
  });
});
