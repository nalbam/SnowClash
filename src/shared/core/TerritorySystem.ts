/**
 * TerritorySystem - Handles territory boundaries and spawn positions
 *
 * The game map is divided by a diagonal line (\) from top-left to bottom-right:
 * - Red team: top-right triangle (y <= x - PLAYER_RADIUS)
 * - Blue team: bottom-left triangle (y >= x + PLAYER_RADIUS)
 *
 * This system provides:
 * - Territory boundary validation
 * - Spawn position generation
 * - Snowball direction calculation
 * - Position clamping to valid territory
 */

import {
  MAP_SIZE,
  PLAYER_RADIUS,
  SPAWN_MARGIN,
  SPAWN_PADDING,
} from '../constants';

export interface Position {
  x: number;
  y: number;
}

export interface Direction {
  dx: number;
  dy: number;
}

export type Team = 'red' | 'blue';

export class TerritorySystem {
  private readonly mapSize: number;

  constructor(mapSize: number = MAP_SIZE) {
    this.mapSize = mapSize;
  }

  /**
   * Check if a position is within a team's territory
   *
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param team - Team to check ('red' or 'blue')
   * @returns true if the position is within the team's territory
   */
  isInTerritory(x: number, y: number, team: Team): boolean {
    // Map boundary check (with player radius padding)
    if (
      x < PLAYER_RADIUS ||
      x > this.mapSize - PLAYER_RADIUS ||
      y < PLAYER_RADIUS ||
      y > this.mapSize - PLAYER_RADIUS
    ) {
      return false;
    }

    // Diagonal territory check
    // Red team: top-right (y <= x - PLAYER_RADIUS)
    // Blue team: bottom-left (y >= x + PLAYER_RADIUS)
    if (team === 'red') {
      return y <= x - PLAYER_RADIUS;
    } else {
      return y >= x + PLAYER_RADIUS;
    }
  }

  /**
   * Generate a random spawn position within a team's territory
   *
   * @param team - Team to spawn for ('red' or 'blue')
   * @returns Random position within the team's territory
   */
  getSpawnPosition(team: Team): Position {
    const MAX_ATTEMPTS = 100;
    let x: number;
    let y: number;
    let attempts = 0;

    if (team === 'red') {
      // Red team: top-right triangle (y < x - SPAWN_MARGIN)
      do {
        x = SPAWN_PADDING + Math.random() * (this.mapSize - SPAWN_PADDING * 2);
        y = SPAWN_PADDING + Math.random() * (this.mapSize - SPAWN_PADDING * 2);
        attempts++;
      } while (y >= x - SPAWN_MARGIN && attempts < MAX_ATTEMPTS);

      // Fallback to deterministic position if random generation fails
      if (attempts >= MAX_ATTEMPTS) {
        x = this.mapSize * 0.7;
        y = this.mapSize * 0.3;
      }
    } else {
      // Blue team: bottom-left triangle (y > x + SPAWN_MARGIN)
      do {
        x = SPAWN_PADDING + Math.random() * (this.mapSize - SPAWN_PADDING * 2);
        y = SPAWN_PADDING + Math.random() * (this.mapSize - SPAWN_PADDING * 2);
        attempts++;
      } while (y <= x + SPAWN_MARGIN && attempts < MAX_ATTEMPTS);

      // Fallback to deterministic position if random generation fails
      if (attempts >= MAX_ATTEMPTS) {
        x = this.mapSize * 0.3;
        y = this.mapSize * 0.7;
      }
    }

    return { x, y };
  }

  /**
   * Get the snowball direction for a team
   *
   * Snowballs fire diagonally toward opponent territory:
   * - Red team shoots toward bottom-left (-x, +y)
   * - Blue team shoots toward top-right (+x, -y)
   *
   * @param team - Team throwing the snowball
   * @returns Direction vector (normalized to unit magnitude per axis)
   */
  getSnowballDirection(team: Team): Direction {
    if (team === 'red') {
      // Red shoots toward bottom-left
      return { dx: -1, dy: 1 };
    } else {
      // Blue shoots toward top-right
      return { dx: 1, dy: -1 };
    }
  }

  /**
   * Clamp a position to stay within a team's territory
   *
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param team - Team to clamp for
   * @returns Clamped position within the team's territory
   */
  clampToTerritory(x: number, y: number, team: Team): Position {
    // First clamp to map bounds
    let clampedX = Math.max(PLAYER_RADIUS, Math.min(this.mapSize - PLAYER_RADIUS, x));
    let clampedY = Math.max(PLAYER_RADIUS, Math.min(this.mapSize - PLAYER_RADIUS, y));

    // Then clamp to territory boundary
    if (team === 'red') {
      // Red team: y <= x - PLAYER_RADIUS
      // If violating, set y to maximum allowed value
      if (clampedY > clampedX - PLAYER_RADIUS) {
        clampedY = clampedX - PLAYER_RADIUS;
        // Ensure y is still within map bounds
        clampedY = Math.max(PLAYER_RADIUS, clampedY);
      }
    } else {
      // Blue team: y >= x + PLAYER_RADIUS
      // If violating, set y to minimum allowed value
      if (clampedY < clampedX + PLAYER_RADIUS) {
        clampedY = clampedX + PLAYER_RADIUS;
        // Ensure y is still within map bounds
        clampedY = Math.min(this.mapSize - PLAYER_RADIUS, clampedY);
      }
    }

    return { x: clampedX, y: clampedY };
  }
}
