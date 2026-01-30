import { Player, Snowball } from './types';
import {
  MAP_SIZE,
  PLAYER_RADIUS,
  SNOWBALL_RADIUS_NORMAL,
  SNOWBALL_RADIUS_CHARGED,
  CHARGED_DAMAGE,
} from '../constants';

/**
 * PhysicsSystem handles collision detection and snowball physics.
 *
 * Responsibilities:
 * - Update snowball positions based on velocity
 * - Detect when snowballs are out of bounds
 * - Check collisions between snowballs and players
 * - Apply damage to players on hit
 */
export class PhysicsSystem {
  private mapSize: number;
  private outOfBoundsMargin = 100;

  /**
   * Create a new PhysicsSystem
   * @param mapSize - Size of the game map (default: MAP_SIZE from constants)
   */
  constructor(mapSize: number = MAP_SIZE) {
    this.mapSize = mapSize;
  }

  /**
   * Update snowball position based on its velocity.
   *
   * Mutates the snowball's x and y positions by adding velocityX and velocityY.
   *
   * @param snowball - The snowball to update
   */
  updateSnowball(snowball: Snowball): void {
    snowball.x += snowball.velocityX;
    snowball.y += snowball.velocityY;
  }

  /**
   * Check if a snowball is outside the playable area.
   *
   * A snowball is considered out of bounds when it's more than 100px
   * beyond the map edges. This margin allows snowballs to visually
   * leave the map before being removed.
   *
   * @param snowball - The snowball to check
   * @returns true if the snowball should be removed
   */
  isSnowballOutOfBounds(snowball: Snowball): boolean {
    return (
      snowball.x < -this.outOfBoundsMargin ||
      snowball.x > this.mapSize + this.outOfBoundsMargin ||
      snowball.y < -this.outOfBoundsMargin ||
      snowball.y > this.mapSize + this.outOfBoundsMargin
    );
  }

  /**
   * Check if a snowball collides with a player.
   *
   * Collision is detected using circle-circle intersection:
   * - Distance between centers < sum of radii = collision
   * - Same-team snowballs are ignored (return false)
   * - Charged snowballs have larger radius (9px vs 5px)
   *
   * @param snowball - The snowball to check
   * @param player - The player to check against
   * @returns true if collision detected (different teams and within radius)
   */
  checkCollision(snowball: Snowball, player: Player): boolean {
    // Same team - no friendly fire
    if (snowball.team === player.team) {
      return false;
    }

    // Calculate distance between snowball and player centers
    const dx = player.x - snowball.x;
    const dy = player.y - snowball.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Determine snowball radius based on damage
    const snowballRadius =
      snowball.damage >= CHARGED_DAMAGE
        ? SNOWBALL_RADIUS_CHARGED
        : SNOWBALL_RADIUS_NORMAL;

    // Collision if distance is less than sum of radii
    return distance < PLAYER_RADIUS + snowballRadius;
  }

  /**
   * Apply damage to a player from a snowball hit.
   *
   * - Reduces player energy by damage amount
   * - Sets isStunned = true when energy reaches 0 or below
   * - Already stunned players are not damaged further
   *
   * Note: Per game rules, stunned players can still be hit
   * (they act as shields/dummies), but they don't take more damage.
   *
   * @param player - The player to damage
   * @param damage - Amount of damage to apply
   * @returns true if player is stunned (either already was or became stunned)
   */
  applyDamage(player: Player, damage: number): boolean {
    // Already stunned players don't take more damage
    if (player.isStunned) {
      return true;
    }

    // Apply damage
    player.energy -= damage;

    // Check if player should be stunned
    if (player.energy <= 0) {
      player.energy = 0;
      player.isStunned = true;
    }

    return player.isStunned;
  }
}
