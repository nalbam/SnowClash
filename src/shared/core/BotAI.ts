/**
 * BotAI - Bot behavior logic system
 *
 * Handles bot AI behavior including:
 * - Random direction changes every BOT_DIRECTION_CHANGE_INTERVAL (1 second)
 * - Attacks every BOT_ATTACK_INTERVAL (2 seconds)
 * - Territory boundary detection and direction reversal
 * - Stunned bot handling
 *
 * This is a pure logic system with no Colyseus dependencies,
 * making it suitable for both online (server) and offline modes.
 */

import {
  BOT_ATTACK_INTERVAL,
  BOT_DIRECTION_CHANGE_INTERVAL,
} from '../constants';
import { TerritorySystem } from './TerritorySystem';
import { Player } from './types';

/**
 * Actions returned by bot AI update
 */
export interface BotActions {
  /** Horizontal movement direction (-1 to 1) */
  moveX: number;

  /** Vertical movement direction (-1 to 1) */
  moveY: number;

  /** Whether the bot should throw a snowball */
  shouldAttack: boolean;
}

/**
 * Internal state for tracking a single bot
 */
interface BotState {
  /** Last time the bot attacked */
  lastAttackTime: number;

  /** Last time the bot changed direction */
  lastDirectionChange: number;

  /** Current movement direction */
  direction: { dx: number; dy: number };
}

/**
 * BotAI manages bot behavior logic
 *
 * Usage:
 * 1. Create instance with TerritorySystem
 * 2. Call registerBot() when a bot is created
 * 3. Call updateBot() each frame to get bot actions
 * 4. Call unregisterBot() when bot is removed
 * 5. Call clear() when game ends
 */
export class BotAI {
  private readonly territory: TerritorySystem;
  private readonly bots: Map<string, BotState> = new Map();

  constructor(territory: TerritorySystem) {
    this.territory = territory;
  }

  /**
   * Register a bot for AI tracking
   *
   * Initial timings can be customized to prevent all bots from acting in sync.
   * If not provided, timings are randomized.
   *
   * @param botId - Unique identifier for the bot
   * @param initialAttackTime - Initial last attack time (default: randomized offset)
   * @param initialDirectionTime - Initial last direction change time (default: randomized offset)
   */
  registerBot(
    botId: string,
    initialAttackTime?: number,
    initialDirectionTime?: number
  ): void {
    const now = Date.now();

    // Randomize initial timings if not provided to prevent sync
    const attackTime = initialAttackTime ?? now - Math.random() * BOT_ATTACK_INTERVAL;
    const directionTime =
      initialDirectionTime ?? now - Math.random() * BOT_DIRECTION_CHANGE_INTERVAL;

    this.bots.set(botId, {
      lastAttackTime: attackTime,
      lastDirectionChange: directionTime,
      direction: { dx: 0, dy: 0 },
    });
  }

  /**
   * Check if a bot is registered
   */
  isRegistered(botId: string): boolean {
    return this.bots.has(botId);
  }

  /**
   * Unregister a bot from AI tracking
   */
  unregisterBot(botId: string): void {
    this.bots.delete(botId);
  }

  /**
   * Clear all registered bots
   */
  clear(): void {
    this.bots.clear();
  }

  /**
   * Update a bot and return its actions for this frame
   *
   * @param bot - Current bot state
   * @param currentTime - Current timestamp (e.g., Date.now())
   * @returns Actions the bot should take (movement, attack)
   */
  updateBot(bot: Player, currentTime: number): BotActions {
    const noAction: BotActions = {
      moveX: 0,
      moveY: 0,
      shouldAttack: false,
    };

    const state = this.bots.get(bot.id);
    if (!state) {
      return noAction;
    }

    // Stunned bots do nothing
    if (bot.isStunned) {
      return noAction;
    }

    // Check for direction change
    if (currentTime - state.lastDirectionChange >= BOT_DIRECTION_CHANGE_INTERVAL) {
      this.changeDirection(state);
      state.lastDirectionChange = currentTime;
    }

    // Check territory boundary and reverse if needed
    this.checkBoundary(bot, state);

    // Check for attack
    let shouldAttack = false;
    if (currentTime - state.lastAttackTime >= BOT_ATTACK_INTERVAL) {
      shouldAttack = true;
      state.lastAttackTime = currentTime;
    }

    return {
      moveX: state.direction.dx,
      moveY: state.direction.dy,
      shouldAttack,
    };
  }

  /**
   * Generate a new random direction for the bot
   */
  private changeDirection(state: BotState): void {
    const angle = Math.random() * Math.PI * 2;
    state.direction = {
      dx: Math.cos(angle),
      dy: Math.sin(angle),
    };
  }

  /**
   * Check if the bot's current direction would take it out of territory
   * and reverse the direction if so
   */
  private checkBoundary(bot: Player, state: BotState): void {
    // Calculate where the bot would be after one frame of movement
    // Using a small lookahead distance
    const lookaheadDistance = 5;
    const nextX = bot.x + state.direction.dx * lookaheadDistance;
    const nextY = bot.y + state.direction.dy * lookaheadDistance;

    // Check if next position is within territory
    const team = bot.team as 'red' | 'blue';
    if (!this.territory.isInTerritory(nextX, nextY, team)) {
      // Reverse direction
      state.direction = {
        dx: -state.direction.dx,
        dy: -state.direction.dy,
      };
    }
  }
}
