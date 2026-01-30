import { TerritorySystem } from './TerritorySystem';
import {
  MAP_SIZE,
  PLAYER_RADIUS,
  SPAWN_MARGIN,
  SPAWN_PADDING,
} from '../constants';

describe('TerritorySystem', () => {
  let territory: TerritorySystem;

  beforeEach(() => {
    territory = new TerritorySystem(MAP_SIZE);
  });

  describe('constructor', () => {
    it('should create with default map size', () => {
      const defaultTerritory = new TerritorySystem();
      expect(defaultTerritory).toBeDefined();
    });

    it('should create with custom map size', () => {
      const customTerritory = new TerritorySystem(1000);
      expect(customTerritory).toBeDefined();
    });
  });

  describe('isInTerritory', () => {
    describe('red team (top-right triangle)', () => {
      it('should return true for red team in top-right area', () => {
        // Point clearly in red territory (y < x - PLAYER_RADIUS)
        expect(territory.isInTerritory(600, 200, 'red')).toBe(true);
      });

      it('should return true for red team near diagonal within boundary', () => {
        // y = x - PLAYER_RADIUS (exactly on red team boundary)
        expect(territory.isInTerritory(400, 400 - PLAYER_RADIUS, 'red')).toBe(true);
      });

      it('should return false for red team in blue territory', () => {
        // Point clearly in blue territory
        expect(territory.isInTerritory(200, 600, 'red')).toBe(false);
      });

      it('should return false for red team on diagonal line', () => {
        // Point exactly on diagonal (y = x) is in neutral zone
        expect(territory.isInTerritory(400, 400, 'red')).toBe(false);
      });
    });

    describe('blue team (bottom-left triangle)', () => {
      it('should return true for blue team in bottom-left area', () => {
        // Point clearly in blue territory (y > x + PLAYER_RADIUS)
        expect(territory.isInTerritory(200, 600, 'blue')).toBe(true);
      });

      it('should return true for blue team near diagonal within boundary', () => {
        // y = x + PLAYER_RADIUS (exactly on blue team boundary)
        expect(territory.isInTerritory(400, 400 + PLAYER_RADIUS, 'blue')).toBe(true);
      });

      it('should return false for blue team in red territory', () => {
        // Point clearly in red territory
        expect(territory.isInTerritory(600, 200, 'blue')).toBe(false);
      });

      it('should return false for blue team on diagonal line', () => {
        // Point exactly on diagonal (y = x) is in neutral zone
        expect(territory.isInTerritory(400, 400, 'blue')).toBe(false);
      });
    });

    describe('map boundary checks', () => {
      it('should return false for positions outside left boundary', () => {
        expect(territory.isInTerritory(-10, 400, 'red')).toBe(false);
        expect(territory.isInTerritory(-10, 400, 'blue')).toBe(false);
      });

      it('should return false for positions outside right boundary', () => {
        expect(territory.isInTerritory(MAP_SIZE + 10, 400, 'red')).toBe(false);
        expect(territory.isInTerritory(MAP_SIZE + 10, 400, 'blue')).toBe(false);
      });

      it('should return false for positions outside top boundary', () => {
        expect(territory.isInTerritory(400, -10, 'red')).toBe(false);
        expect(territory.isInTerritory(400, -10, 'blue')).toBe(false);
      });

      it('should return false for positions outside bottom boundary', () => {
        expect(territory.isInTerritory(400, MAP_SIZE + 10, 'red')).toBe(false);
        expect(territory.isInTerritory(400, MAP_SIZE + 10, 'blue')).toBe(false);
      });

      it('should return false for positions too close to left edge', () => {
        // Within PLAYER_RADIUS from edge
        expect(territory.isInTerritory(PLAYER_RADIUS - 1, 400, 'blue')).toBe(false);
      });

      it('should return false for positions too close to right edge', () => {
        // Within PLAYER_RADIUS from edge
        expect(territory.isInTerritory(MAP_SIZE - PLAYER_RADIUS + 1, 400, 'red')).toBe(false);
      });

      it('should return false for positions too close to top edge', () => {
        // Within PLAYER_RADIUS from edge
        expect(territory.isInTerritory(400, PLAYER_RADIUS - 1, 'red')).toBe(false);
      });

      it('should return false for positions too close to bottom edge', () => {
        // Within PLAYER_RADIUS from edge
        expect(territory.isInTerritory(400, MAP_SIZE - PLAYER_RADIUS + 1, 'blue')).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should handle corner positions correctly', () => {
        // Top-right corner (should be red territory if within bounds)
        const topRightX = MAP_SIZE - PLAYER_RADIUS;
        const topRightY = PLAYER_RADIUS;
        expect(territory.isInTerritory(topRightX, topRightY, 'red')).toBe(true);

        // Bottom-left corner (should be blue territory if within bounds)
        const bottomLeftX = PLAYER_RADIUS;
        const bottomLeftY = MAP_SIZE - PLAYER_RADIUS;
        expect(territory.isInTerritory(bottomLeftX, bottomLeftY, 'blue')).toBe(true);
      });

      it('should work with center position', () => {
        // Center point (400, 400) is on diagonal - neither team
        expect(territory.isInTerritory(MAP_SIZE / 2, MAP_SIZE / 2, 'red')).toBe(false);
        expect(territory.isInTerritory(MAP_SIZE / 2, MAP_SIZE / 2, 'blue')).toBe(false);
      });
    });
  });

  describe('getSpawnPosition', () => {
    describe('red team spawning', () => {
      it('should return position in red territory', () => {
        for (let i = 0; i < 10; i++) {
          const pos = territory.getSpawnPosition('red');
          // Red team: y < x - SPAWN_MARGIN
          expect(pos.y).toBeLessThan(pos.x - SPAWN_MARGIN);
        }
      });

      it('should return position within map bounds with padding', () => {
        for (let i = 0; i < 10; i++) {
          const pos = territory.getSpawnPosition('red');
          expect(pos.x).toBeGreaterThanOrEqual(SPAWN_PADDING);
          expect(pos.x).toBeLessThanOrEqual(MAP_SIZE - SPAWN_PADDING);
          expect(pos.y).toBeGreaterThanOrEqual(SPAWN_PADDING);
          expect(pos.y).toBeLessThanOrEqual(MAP_SIZE - SPAWN_PADDING);
        }
      });
    });

    describe('blue team spawning', () => {
      it('should return position in blue territory', () => {
        for (let i = 0; i < 10; i++) {
          const pos = territory.getSpawnPosition('blue');
          // Blue team: y > x + SPAWN_MARGIN
          expect(pos.y).toBeGreaterThan(pos.x + SPAWN_MARGIN);
        }
      });

      it('should return position within map bounds with padding', () => {
        for (let i = 0; i < 10; i++) {
          const pos = territory.getSpawnPosition('blue');
          expect(pos.x).toBeGreaterThanOrEqual(SPAWN_PADDING);
          expect(pos.x).toBeLessThanOrEqual(MAP_SIZE - SPAWN_PADDING);
          expect(pos.y).toBeGreaterThanOrEqual(SPAWN_PADDING);
          expect(pos.y).toBeLessThanOrEqual(MAP_SIZE - SPAWN_PADDING);
        }
      });
    });

    describe('position variety', () => {
      it('should generate different positions for multiple calls', () => {
        const positions = new Set<string>();
        for (let i = 0; i < 20; i++) {
          const pos = territory.getSpawnPosition('red');
          positions.add(`${Math.floor(pos.x)},${Math.floor(pos.y)}`);
        }
        // Should have at least some variety (unlikely to get same position 20 times)
        expect(positions.size).toBeGreaterThan(1);
      });
    });
  });

  describe('getSnowballDirection', () => {
    it('should return direction toward bottom-left for red team', () => {
      const dir = territory.getSnowballDirection('red');
      expect(dir.dx).toBeLessThan(0); // Moving left (-x)
      expect(dir.dy).toBeGreaterThan(0); // Moving down (+y)
    });

    it('should return direction toward top-right for blue team', () => {
      const dir = territory.getSnowballDirection('blue');
      expect(dir.dx).toBeGreaterThan(0); // Moving right (+x)
      expect(dir.dy).toBeLessThan(0); // Moving up (-y)
    });

    it('should return normalized direction vectors', () => {
      const redDir = territory.getSnowballDirection('red');
      const blueDir = territory.getSnowballDirection('blue');

      // For diagonal movement, both components should have same magnitude
      expect(Math.abs(redDir.dx)).toBe(Math.abs(redDir.dy));
      expect(Math.abs(blueDir.dx)).toBe(Math.abs(blueDir.dy));
    });
  });

  describe('clampToTerritory', () => {
    it('should return same position if already in territory', () => {
      const pos = territory.clampToTerritory(600, 200, 'red');
      expect(pos.x).toBe(600);
      expect(pos.y).toBe(200);
    });

    it('should clamp x to map bounds for red team', () => {
      const pos = territory.clampToTerritory(900, 200, 'red');
      expect(pos.x).toBeLessThanOrEqual(MAP_SIZE - PLAYER_RADIUS);
      expect(pos.y).toBe(200);
    });

    it('should clamp y to map bounds for blue team', () => {
      const pos = territory.clampToTerritory(200, 900, 'blue');
      expect(pos.x).toBe(200);
      expect(pos.y).toBeLessThanOrEqual(MAP_SIZE - PLAYER_RADIUS);
    });

    it('should clamp to territory boundary when crossing diagonal', () => {
      // Red team trying to go into blue territory
      const redPos = territory.clampToTerritory(200, 600, 'red');
      // Should be clamped so that y <= x - PLAYER_RADIUS
      expect(redPos.y).toBeLessThanOrEqual(redPos.x - PLAYER_RADIUS);

      // Blue team trying to go into red territory
      const bluePos = territory.clampToTerritory(600, 200, 'blue');
      // Should be clamped so that y >= x + PLAYER_RADIUS
      expect(bluePos.y).toBeGreaterThanOrEqual(bluePos.x + PLAYER_RADIUS);
    });
  });
});
