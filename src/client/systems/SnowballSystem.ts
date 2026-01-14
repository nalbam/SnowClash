import Phaser from 'phaser';

export interface SnowballState {
  x: number;
  y: number;
  team: string;
  damage: number;
}

interface SnowballSpriteData {
  sprite: Phaser.GameObjects.Sprite;
}

/**
 * SnowballSystem manages all snowball sprites, their positions, and visual effects.
 * Responsibilities:
 * - Create snowball sprites with correct textures (team color + charged/normal)
 * - Update snowball positions
 * - Remove snowballs and create debris effects
 * - Track snowball states for proper cleanup
 */
export class SnowballSystem {
  private scene: Phaser.Scene;
  private snowballs: Map<string, SnowballSpriteData> = new Map();
  private snowballPositions: Map<string, SnowballState> = new Map();
  private fadingSnowballs: Set<string> = new Set();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Create a new snowball sprite
   */
  public createSnowball(id: string, state: SnowballState): void {
    const textureKey = this.getTextureKey(state.team, state.damage);
    const sprite = this.scene.add.sprite(state.x, state.y, textureKey);

    this.snowballs.set(id, { sprite });
    this.snowballPositions.set(id, { ...state });
  }

  /**
   * Update snowball position
   */
  public updateSnowball(id: string, state: SnowballState): void {
    const snowballData = this.snowballs.get(id);
    if (!snowballData) return;

    // Don't update fading snowballs
    if (this.fadingSnowballs.has(id)) return;

    snowballData.sprite.setPosition(state.x, state.y);

    // Store updated position
    this.snowballPositions.set(id, { ...state });
  }

  /**
   * Remove snowball and create debris effect
   */
  public removeSnowball(id: string, state?: SnowballState): void {
    const snowballData = this.snowballs.get(id);
    if (!snowballData) return;

    // Get snowball position and team info
    const storedPos = this.snowballPositions.get(id);
    const x = state?.x ?? storedPos?.x ?? 0;
    const y = state?.y ?? storedPos?.y ?? 0;
    const team = state?.team ?? storedPos?.team ?? 'red';

    // Remove original snowball immediately
    this.fadingSnowballs.delete(id);
    this.snowballs.delete(id);
    this.snowballPositions.delete(id);
    snowballData.sprite.destroy();

    // Create debris effect
    this.createDebrisEffect(x, y, team);
  }

  /**
   * Check if snowball exists
   */
  public hasSnowball(id: string): boolean {
    return this.snowballs.has(id);
  }

  /**
   * Check if snowball is fading
   */
  public isFading(id: string): boolean {
    return this.fadingSnowballs.has(id);
  }

  /**
   * Clear all snowballs (cleanup)
   */
  public clear(): void {
    this.snowballs.forEach((data) => {
      data.sprite.destroy();
    });
    this.snowballs.clear();
    this.snowballPositions.clear();
    this.fadingSnowballs.clear();
  }

  /**
   * Get texture key based on team and damage
   */
  private getTextureKey(team: string, damage: number): string {
    const isCharged = damage >= 7;
    return `snowball_${team}_${isCharged ? 'charged' : 'normal'}`;
  }

  /**
   * Create debris particle effect when snowball hits or expires
   */
  private createDebrisEffect(x: number, y: number, team: string): void {
    const color = this.getTeamColor(team);
    const numParticles = 6;

    for (let i = 0; i < numParticles; i++) {
      const particle = this.scene.add.graphics();
      particle.fillStyle(color, 1);
      particle.fillCircle(0, 0, 2 + Math.random() * 2);
      particle.setPosition(x, y);

      // Radial spread direction
      const angle = (Math.PI * 2 * i) / numParticles + Math.random() * 0.3;
      const distance = 15 + Math.random() * 15;
      const targetX = x + Math.cos(angle) * distance;
      const targetY = y + Math.sin(angle) * distance;

      // Particle animation
      this.scene.tweens.add({
        targets: particle,
        x: targetX,
        y: targetY,
        alpha: 0,
        scale: 0.3,
        duration: 400,
        ease: 'Power2',
        onComplete: () => {
          particle.destroy();
        }
      });
    }
  }

  /**
   * Get team color for debris effect
   */
  private getTeamColor(team: string): number {
    return team === 'red' ? 0xff6666 : 0x6666ff;
  }
}
