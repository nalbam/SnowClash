/**
 * GameEngine - Main game logic integration
 *
 * The GameEngine is the central integration point for all core systems.
 * It manages game state, player management, input handling, and the game loop.
 *
 * This class is platform-independent and can be used by:
 * - Server (Colyseus) for online multiplayer
 * - Client (Phaser) for offline single-player mode
 *
 * Key responsibilities:
 * - Player management (add, remove, position)
 * - Game flow control (start, end)
 * - Input handling (move, throw)
 * - Game loop updates (snowball physics, collision detection)
 * - Bot AI integration
 * - Win condition checking
 */

import { Player, Snowball, GameState, GamePhase, GameEngineCallbacks, Team } from './types';
import { TerritorySystem } from './TerritorySystem';
import { PhysicsSystem } from './PhysicsSystem';
import { BotAI } from './BotAI';
import {
  MAP_SIZE,
  PLAYER_SPEED,
  PLAYER_INITIAL_ENERGY,
  SNOWBALL_SPEED,
  NORMAL_DAMAGE,
  CHARGED_DAMAGE,
  CHARGE_THRESHOLD,
  THROW_COOLDOWN,
} from '../constants';

/** Maximum players per team */
const MAX_TEAM_SIZE = 3;

/**
 * GameEngine manages the complete game lifecycle
 *
 * Usage:
 * 1. Create instance with optional callbacks
 * 2. Add players using addPlayer()
 * 3. Call startGame() when ready
 * 4. Call update() in game loop (60 FPS recommended)
 * 5. Handle input via handleMove() and handleThrow()
 * 6. Call destroy() when done
 */
export class GameEngine {
  private readonly state: GameState;
  private readonly callbacks: GameEngineCallbacks;
  private readonly territory: TerritorySystem;
  private readonly physics: PhysicsSystem;
  private readonly botAI: BotAI;
  private readonly lastThrowTime: Map<string, number> = new Map();
  private snowballCounter = 0;

  /**
   * Create a new GameEngine instance
   *
   * @param callbacks - Optional callbacks for game events
   * @param mapSize - Size of the game map (default: MAP_SIZE from constants)
   */
  constructor(callbacks: GameEngineCallbacks = {}, mapSize: number = MAP_SIZE) {
    this.callbacks = callbacks;

    // Initialize state
    this.state = {
      players: new Map<string, Player>(),
      snowballs: new Map<string, Snowball>(),
      phase: 'lobby',
      winner: '',
      mapSize,
    };

    // Initialize systems
    this.territory = new TerritorySystem(mapSize);
    this.physics = new PhysicsSystem(mapSize);
    this.botAI = new BotAI(this.territory);
  }

  /**
   * Get the current game state
   *
   * @returns Current GameState object
   */
  getState(): GameState {
    return this.state;
  }

  // ===========================================================================
  // Player Management
  // ===========================================================================

  /**
   * Add a new player to the game
   *
   * @param id - Unique identifier for the player
   * @param nickname - Display name for the player
   * @param team - Team assignment ('red' or 'blue')
   * @param isBot - Whether this player is controlled by AI
   * @returns The created Player object
   */
  addPlayer(id: string, nickname: string, team: Team, isBot: boolean): Player {
    const player: Player = {
      id,
      nickname,
      team,
      isBot,
      x: 0,
      y: 0,
      energy: PLAYER_INITIAL_ENERGY,
      isStunned: false,
    };

    this.state.players.set(id, player);

    // Call callback
    this.callbacks.onPlayerAdd?.(player);

    return player;
  }

  /**
   * Remove a player from the game
   *
   * @param id - Player ID to remove
   */
  removePlayer(id: string): void {
    const player = this.state.players.get(id);
    if (!player) return;

    // Unregister from bot AI if needed
    if (player.isBot) {
      this.botAI.unregisterBot(id);
    }

    // Remove from state
    this.state.players.delete(id);

    // Clear throw cooldown
    this.lastThrowTime.delete(id);

    // Call callback
    this.callbacks.onPlayerRemove?.(id);
  }

  // ===========================================================================
  // Game Flow
  // ===========================================================================

  /**
   * Start the game
   *
   * Initializes player positions based on team territories,
   * resets energy/stun status, and sets phase to 'playing'.
   */
  startGame(): void {
    // Only start from lobby phase
    if (this.state.phase !== 'lobby') return;

    this.state.phase = 'playing';

    // Initialize all player positions and state
    this.state.players.forEach((player) => {
      // Reset energy and stun status
      player.energy = PLAYER_INITIAL_ENERGY;
      player.isStunned = false;

      // Set spawn position based on team
      const spawnPos = this.territory.getSpawnPosition(player.team);
      player.x = spawnPos.x;
      player.y = spawnPos.y;

      // Register bots with AI system
      if (player.isBot) {
        this.botAI.registerBot(player.id);
      }

      // Call update callback for position change
      this.callbacks.onPlayerUpdate?.(player);
    });
  }

  // ===========================================================================
  // Input Handling
  // ===========================================================================

  /**
   * Handle player movement input
   *
   * @param playerId - ID of the player to move
   * @param dx - Horizontal direction (-1 to 1)
   * @param dy - Vertical direction (-1 to 1)
   */
  handleMove(playerId: string, dx: number, dy: number): void {
    // Only allow movement during playing phase
    if (this.state.phase !== 'playing') return;

    const player = this.state.players.get(playerId);
    if (!player) return;

    // Stunned players cannot move
    if (player.isStunned) return;

    // Calculate new position
    const newX = player.x + dx * PLAYER_SPEED;
    const newY = player.y + dy * PLAYER_SPEED;

    // Check if new position is within player's territory
    if (this.territory.isInTerritory(newX, newY, player.team)) {
      player.x = newX;
      player.y = newY;
      this.callbacks.onPlayerUpdate?.(player);
    } else {
      // Clamp to territory boundary
      const clampedPos = this.territory.clampToTerritory(newX, newY, player.team);
      if (clampedPos.x !== player.x || clampedPos.y !== player.y) {
        player.x = clampedPos.x;
        player.y = clampedPos.y;
        this.callbacks.onPlayerUpdate?.(player);
      }
    }
  }

  /**
   * Handle player snowball throw
   *
   * @param playerId - ID of the player throwing
   * @param chargeLevel - Charge level (0 to 1, 0.7+ for charged damage)
   */
  handleThrow(playerId: string, chargeLevel: number): void {
    // Only allow throwing during playing phase
    if (this.state.phase !== 'playing') return;

    const player = this.state.players.get(playerId);
    if (!player) return;

    // Stunned players cannot throw
    if (player.isStunned) return;

    // Check cooldown
    const now = Date.now();
    const lastThrow = this.lastThrowTime.get(playerId) || 0;
    if (now - lastThrow < THROW_COOLDOWN) {
      return; // Still on cooldown
    }
    this.lastThrowTime.set(playerId, now);

    // Clamp charge level
    const clampedCharge = Math.min(1, Math.max(0, chargeLevel));

    // Determine damage based on charge level
    const damage = clampedCharge >= CHARGE_THRESHOLD ? CHARGED_DAMAGE : NORMAL_DAMAGE;

    // Get snowball direction based on team
    const direction = this.territory.getSnowballDirection(player.team);

    // Create snowball
    this.snowballCounter++;
    const snowball: Snowball = {
      id: `${playerId}_${now}_${this.snowballCounter}`,
      ownerId: playerId,
      team: player.team,
      x: player.x,
      y: player.y,
      velocityX: direction.dx * SNOWBALL_SPEED,
      velocityY: direction.dy * SNOWBALL_SPEED,
      damage,
    };

    // Add to state
    this.state.snowballs.set(snowball.id, snowball);

    // Call callback
    this.callbacks.onSnowballAdd?.(snowball);
  }

  // ===========================================================================
  // Game Loop
  // ===========================================================================

  /**
   * Update the game state (called every frame, 60 FPS recommended)
   *
   * @param currentTime - Current timestamp (e.g., Date.now())
   */
  update(currentTime: number): void {
    // Only update during playing phase
    if (this.state.phase !== 'playing') return;

    // Update bot AI
    this.updateBots(currentTime);

    // Update snowballs
    this.updateSnowballs();

    // Check win conditions
    this.checkWinConditions();
  }

  /**
   * Update all bot players
   */
  private updateBots(currentTime: number): void {
    this.state.players.forEach((player) => {
      if (!player.isBot || player.isStunned) return;

      // Get bot actions from AI
      const actions = this.botAI.updateBot(player, currentTime);

      // Apply movement
      if (actions.moveX !== 0 || actions.moveY !== 0) {
        this.handleMove(player.id, actions.moveX, actions.moveY);
      }

      // Apply attack
      if (actions.shouldAttack) {
        // Bots use random charge level
        const chargeLevel = Math.random() < 0.3 ? CHARGE_THRESHOLD : 0.5;
        this.handleThrow(player.id, chargeLevel);
      }
    });
  }

  /**
   * Update all snowballs (position and collisions)
   */
  private updateSnowballs(): void {
    const snowballsToRemove: string[] = [];

    this.state.snowballs.forEach((snowball, id) => {
      // Update position
      this.physics.updateSnowball(snowball);

      // Check if out of bounds
      if (this.physics.isSnowballOutOfBounds(snowball)) {
        snowballsToRemove.push(id);
        return;
      }

      // Check collisions with players
      this.state.players.forEach((player) => {
        // Skip if already marked for removal
        if (snowballsToRemove.includes(id)) return;

        // Check collision
        if (this.physics.checkCollision(snowball, player)) {
          // Apply damage only if game is still playing and player is not stunned
          if (this.state.phase === 'playing' && !player.isStunned) {
            this.physics.applyDamage(player, snowball.damage);
            this.callbacks.onPlayerUpdate?.(player);
          }

          // Mark snowball for removal
          snowballsToRemove.push(id);
        }
      });

      // Update callback for moving snowball
      if (!snowballsToRemove.includes(id)) {
        this.callbacks.onSnowballUpdate?.(snowball);
      }
    });

    // Remove marked snowballs
    snowballsToRemove.forEach((id) => {
      this.state.snowballs.delete(id);
      this.callbacks.onSnowballRemove?.(id);
    });
  }

  /**
   * Check win conditions and end game if met
   */
  private checkWinConditions(): void {
    if (this.state.phase !== 'playing') return;

    const players = Array.from(this.state.players.values());
    const redAlive = players.filter((p) => p.team === 'red' && !p.isStunned).length;
    const blueAlive = players.filter((p) => p.team === 'blue' && !p.isStunned).length;

    if (redAlive === 0 && blueAlive > 0) {
      this.endGame('blue');
    } else if (blueAlive === 0 && redAlive > 0) {
      this.endGame('red');
    } else if (redAlive === 0 && blueAlive === 0) {
      this.endGame('draw');
    }
  }

  /**
   * End the game with a winner
   */
  private endGame(winner: string): void {
    this.state.phase = 'ended';
    this.state.winner = winner;

    // Call callback
    this.callbacks.onGameEnd?.(winner);
  }

  // ===========================================================================
  // Utilities
  // ===========================================================================

  /**
   * Fill both teams with bots to reach 3v3
   *
   * @param generateBotNickname - Function to generate bot nicknames
   */
  fillTeamsWithBots(generateBotNickname: () => string): void {
    const players = Array.from(this.state.players.values());
    const redCount = players.filter((p) => p.team === 'red').length;
    const blueCount = players.filter((p) => p.team === 'blue').length;

    // Fill red team
    for (let i = redCount; i < MAX_TEAM_SIZE; i++) {
      const botId = `bot_red_${Date.now()}_${i}`;
      this.addPlayer(botId, generateBotNickname(), 'red', true);
    }

    // Fill blue team
    for (let i = blueCount; i < MAX_TEAM_SIZE; i++) {
      const botId = `bot_blue_${Date.now()}_${i}`;
      this.addPlayer(botId, generateBotNickname(), 'blue', true);
    }
  }

  /**
   * Clean up resources
   *
   * Call this when the game engine is no longer needed.
   */
  destroy(): void {
    // Clear bot AI
    this.botAI.clear();

    // Clear throw cooldowns
    this.lastThrowTime.clear();

    // Clear state collections
    this.state.players.clear();
    this.state.snowballs.clear();
  }
}
