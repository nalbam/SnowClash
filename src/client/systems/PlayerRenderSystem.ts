import Phaser from 'phaser';
import { MAP_SIZE } from '../../shared/constants';

export interface PlayerSpriteData {
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Sprite;
  indicator: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  energyBar: Phaser.GameObjects.Graphics;
  lastX: number;
  lastY: number;
  displayEnergy: number;  // For smooth energy bar interpolation
  wasStunned: boolean;    // Track previous stun state for sound effect
  lastEnergy: number;     // Track previous energy for hit sound effect
}

export interface PlayerState {
  x: number;
  y: number;
  team: string;
  nickname: string;
  energy: number;
  isStunned: boolean;
  isBot: boolean;
}

export interface GameContext {
  gameEnded: boolean;
  winner: string;
}

/**
 * PlayerRenderSystem manages all player sprites, animations, and UI elements.
 *
 * Responsibilities:
 * - Create player sprites with team textures
 * - Update player positions with interpolation (lerp for remote, correction for local)
 * - Manage animation states (idle, walk, stunned, cheer)
 * - Render UI elements (labels, energy bars, indicators)
 * - Handle smooth energy bar transitions
 * - Convert server coordinates to view coordinates (for red team rotation)
 */
export class PlayerRenderSystem {
  private scene: Phaser.Scene;
  private players: Map<string, PlayerSpriteData> = new Map();
  private myTeam?: string;
  private localPlayerMoving: boolean = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Set the current player's team (for coordinate transformation)
   */
  public setMyTeam(team: string): void {
    this.myTeam = team;
  }

  /**
   * Set local player's movement state (for animation during client prediction)
   */
  public setLocalPlayerMoving(isMoving: boolean): void {
    this.localPlayerMoving = isMoving;
  }

  /**
   * Convert server coordinates to view coordinates
   */
  private toViewCoords(x: number, y: number): { x: number; y: number } {
    if (this.myTeam === 'red') {
      return { x: MAP_SIZE - x, y: MAP_SIZE - y };
    }
    return { x, y };
  }

  /**
   * Create a new player sprite with all UI elements
   */
  public createPlayer(sessionId: string, state: PlayerState): void {
    const team = state.team || 'red';
    const textureKey = `character_${team}_idle`;

    // Convert server coordinates to view coordinates
    const viewPos = this.toViewCoords(state.x, state.y);

    // Create container to hold all player elements (moves together)
    const container = this.scene.add.container(viewPos.x, viewPos.y);

    // Create sprite for player (at container origin)
    const sprite = this.scene.add.sprite(0, 0, textureKey);
    sprite.setScale(1);
    container.add(sprite);

    // Create indicator (relative to container)
    const indicator = this.scene.add.graphics();
    container.add(indicator);

    // Create player label (relative to container)
    const label = this.scene.add.text(0, -30, state.nickname || 'Player', {
      fontSize: '10px',
      color: '#000000',
      backgroundColor: '#ffffffcc',
      padding: { x: 3, y: 1 }
    }).setOrigin(0.5);
    container.add(label);

    // Create energy bar (relative to container)
    const energyBar = this.scene.add.graphics();
    container.add(energyBar);

    // Store player data (store server coordinates for tracking movement)
    this.players.set(sessionId, {
      container,
      sprite,
      indicator,
      label,
      energyBar,
      lastX: state.x,
      lastY: state.y,
      displayEnergy: state.energy,
      wasStunned: state.isStunned,
      lastEnergy: state.energy
    });

    // Initial update
    this.updatePlayer(sessionId, state, false, { gameEnded: false, winner: '' });
  }

  /**
   * Update player sprite, animation, and UI
   */
  public updatePlayer(sessionId: string, state: PlayerState, isLocalPlayer: boolean, context: GameContext): void {
    const playerData = this.players.get(sessionId);
    if (!playerData) return;

    const team = state.team || 'red';

    // Check if player is moving
    // For local player, use the tracked movement state (from client prediction)
    // For remote players, compare server positions
    const isMoving = isLocalPlayer
      ? this.localPlayerMoving
      : (playerData.lastX !== state.x || playerData.lastY !== state.y);

    // Update container position with interpolation
    this.updateContainerPosition(playerData, state, isLocalPlayer);

    // Update animation
    this.updateAnimation(playerData, state, isMoving, context);

    // Check for hit (energy decreased) and play sound
    if (state.energy < playerData.lastEnergy) {
      try {
        this.scene.sound.play('hit', { volume: 0.3 });
      } catch (e) {
        // Sound may not be loaded
      }
    }
    playerData.lastEnergy = state.energy;

    // Check for stun state change and play sound
    if (state.isStunned && !playerData.wasStunned) {
      try {
        this.scene.sound.play('stun', { volume: 0.4 });
      } catch (e) {
        // Sound may not be loaded
      }
    }
    playerData.wasStunned = state.isStunned;

    // Update last position (use server position for tracking movement state)
    playerData.lastX = state.x;
    playerData.lastY = state.y;

    // Update energy bar (drawn at relative position inside container)
    this.updateEnergyBar(playerData, state, context);
  }

  /**
   * Update local player position (for client prediction)
   */
  public updateLocalPlayerPosition(sessionId: string, x: number, y: number): void {
    const playerData = this.players.get(sessionId);
    if (!playerData) return;

    // Update container position - all children move together
    playerData.container.setPosition(x, y);

    // Update indicator (relative to container origin)
    playerData.indicator.clear();
    playerData.indicator.lineStyle(2, 0xffff00, 1);
    playerData.indicator.strokeCircle(0, 0, 20);
  }

  /**
   * Remove player and cleanup all UI elements
   */
  public removePlayer(sessionId: string): void {
    const playerData = this.players.get(sessionId);
    if (!playerData) return;

    // Destroy container (destroys all children automatically)
    playerData.container.destroy();

    this.players.delete(sessionId);
  }

  /**
   * Check if player exists
   */
  public hasPlayer(sessionId: string): boolean {
    return this.players.has(sessionId);
  }

  /**
   * Get player position
   */
  public getPlayerPosition(sessionId: string): { x: number; y: number } | null {
    const playerData = this.players.get(sessionId);
    if (!playerData) return null;

    return {
      x: playerData.container.x,
      y: playerData.container.y
    };
  }

  /**
   * Clear all players (cleanup)
   */
  public clear(): void {
    this.players.forEach((playerData) => {
      playerData.container.destroy();
    });
    this.players.clear();
  }

  /**
   * Update container position with interpolation
   */
  private updateContainerPosition(playerData: PlayerSpriteData, state: PlayerState, isLocalPlayer: boolean): void {
    const { container } = playerData;

    // Convert server coordinates to view coordinates
    const viewPos = this.toViewCoords(state.x, state.y);

    if (!isLocalPlayer) {
      // For remote players, smoothly interpolate to server position
      const lerpSpeed = 0.3;
      container.x += (viewPos.x - container.x) * lerpSpeed;
      container.y += (viewPos.y - container.y) * lerpSpeed;
    } else {
      // For local player, apply smooth correction towards server position
      const correctionSpeed = 0.2;
      const dx = viewPos.x - container.x;
      const dy = viewPos.y - container.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Only correct if there's significant deviation (more than 5 pixels)
      if (distance > 5) {
        container.x += dx * correctionSpeed;
        container.y += dy * correctionSpeed;
      }
    }
  }

  /**
   * Update animation state
   */
  private updateAnimation(playerData: PlayerSpriteData, state: PlayerState, isMoving: boolean, context: GameContext): void {
    const { sprite } = playerData;
    const team = state.team || 'red';

    // Determine animation state
    const isWinningTeam = context.gameEnded && context.winner !== 'draw' && context.winner === team;

    if (state.isStunned && !isWinningTeam) {
      // Stunned state (unless winning team)
      const stunnedKey = `character_${team}_stunned`;
      sprite.setTexture(stunnedKey);
      sprite.setAlpha(0.6);
      sprite.anims.stop();
    } else if (isMoving) {
      // Walking animation
      sprite.setAlpha(1);
      const walkAnim = `${team}_walk`;
      // Check if walk animation is not playing (either different anim or stopped)
      if (sprite.anims.currentAnim?.key !== walkAnim || !sprite.anims.isPlaying) {
        sprite.play(walkAnim);
      }
    } else {
      // Idle or cheer state
      sprite.setAlpha(1);
      if (isWinningTeam) {
        // Cheer animation for winning team
        const cheerAnim = `${team}_cheer`;
        if (sprite.anims.currentAnim?.key !== cheerAnim || !sprite.anims.isPlaying) {
          sprite.play(cheerAnim);
        }
      } else {
        // Idle state
        const idleKey = `character_${team}_idle`;
        sprite.setTexture(idleKey);
        sprite.anims.stop();
      }
    }
  }

  /**
   * Update indicator (ring around player)
   */
  private updateIndicator(playerData: PlayerSpriteData, sessionId: string, state: PlayerState, currentPlayerIndicator: Phaser.GameObjects.Graphics): void {
    const { sprite, indicator } = playerData;

    indicator.clear();

    // For simplicity, we don't know which is the current player here
    // The indicator will be updated by GameScene when needed
  }

  /**
   * Update energy bar with smooth interpolation
   */
  private updateEnergyBar(playerData: PlayerSpriteData, state: PlayerState, context: GameContext): void {
    const { energyBar } = playerData;

    energyBar.clear();

    // Don't draw energy bars if game has ended
    if (context.gameEnded) {
      return;
    }

    // Smoothly interpolate energy value
    const targetEnergy = state.isStunned ? 0 : state.energy;
    const energyLerpSpeed = 0.15;
    playerData.displayEnergy = playerData.displayEnergy + (targetEnergy - playerData.displayEnergy) * energyLerpSpeed;

    const barWidth = 30;
    const barHeight = 4;
    const energyPercent = Math.max(0, playerData.displayEnergy / 10);

    // Draw at relative position (0, -40) inside container
    // Background
    energyBar.fillStyle(0x000000, 0.5);
    energyBar.fillRect(-barWidth / 2, -40, barWidth, barHeight);

    // Energy fill
    if (energyPercent > 0) {
      const energyColor = energyPercent > 0.5 ? 0x00ff00 : energyPercent > 0.25 ? 0xffff00 : 0xff0000;
      energyBar.fillStyle(energyColor, 1);
      energyBar.fillRect(-barWidth / 2, -40, barWidth * energyPercent, barHeight);
    }
  }

  /**
   * Update indicator for a specific player (called by GameScene)
   */
  public updatePlayerIndicator(sessionId: string, isCurrentPlayer: boolean, isBot: boolean): void {
    const playerData = this.players.get(sessionId);
    if (!playerData) return;

    const { indicator } = playerData;

    indicator.clear();

    if (isCurrentPlayer) {
      // Yellow ring for current player (relative to container origin)
      indicator.lineStyle(2, 0xffff00, 1);
      indicator.strokeCircle(0, 0, 20);
    } else if (isBot) {
      // Gray ring for bots (relative to container origin)
      indicator.lineStyle(1, 0x888888, 0.5);
      indicator.strokeCircle(0, 0, 18);
    }
  }
}
