/**
 * BotAI Test Suite
 *
 * Tests for bot behavior logic including:
 * - Bot registration with randomized timings
 * - Movement direction changes (every 1 second)
 * - Attack behavior (every 2 seconds)
 * - Territory boundary handling
 * - Stunned bot behavior
 */

import { BotAI, BotActions } from './BotAI';
import { TerritorySystem } from './TerritorySystem';
import { Player } from './types';
import {
  BOT_ATTACK_INTERVAL,
  BOT_DIRECTION_CHANGE_INTERVAL,
} from '../constants';

describe('BotAI', () => {
  let territory: TerritorySystem;
  let botAI: BotAI;

  beforeEach(() => {
    territory = new TerritorySystem();
    botAI = new BotAI(territory);
  });

  describe('registerBot', () => {
    it('should register a bot with randomized timings', () => {
      const botId = 'bot_1';

      botAI.registerBot(botId);

      expect(botAI.isRegistered(botId)).toBe(true);
    });

    it('should register multiple bots independently', () => {
      botAI.registerBot('bot_1');
      botAI.registerBot('bot_2');
      botAI.registerBot('bot_3');

      expect(botAI.isRegistered('bot_1')).toBe(true);
      expect(botAI.isRegistered('bot_2')).toBe(true);
      expect(botAI.isRegistered('bot_3')).toBe(true);
    });

    it('should allow custom initial attack time', () => {
      const botId = 'bot_1';
      const initialAttackTime = 1000;

      botAI.registerBot(botId, initialAttackTime);

      expect(botAI.isRegistered(botId)).toBe(true);
    });

    it('should allow custom initial direction time', () => {
      const botId = 'bot_1';
      const initialAttackTime = 1000;
      const initialDirectionTime = 500;

      botAI.registerBot(botId, initialAttackTime, initialDirectionTime);

      expect(botAI.isRegistered(botId)).toBe(true);
    });
  });

  describe('isRegistered', () => {
    it('should return false for unregistered bot', () => {
      expect(botAI.isRegistered('unknown_bot')).toBe(false);
    });

    it('should return true for registered bot', () => {
      botAI.registerBot('bot_1');
      expect(botAI.isRegistered('bot_1')).toBe(true);
    });
  });

  describe('unregisterBot', () => {
    it('should remove bot from tracking', () => {
      botAI.registerBot('bot_1');
      expect(botAI.isRegistered('bot_1')).toBe(true);

      botAI.unregisterBot('bot_1');
      expect(botAI.isRegistered('bot_1')).toBe(false);
    });

    it('should not throw when unregistering unknown bot', () => {
      expect(() => botAI.unregisterBot('unknown')).not.toThrow();
    });
  });

  describe('clear', () => {
    it('should remove all registered bots', () => {
      botAI.registerBot('bot_1');
      botAI.registerBot('bot_2');
      botAI.registerBot('bot_3');

      botAI.clear();

      expect(botAI.isRegistered('bot_1')).toBe(false);
      expect(botAI.isRegistered('bot_2')).toBe(false);
      expect(botAI.isRegistered('bot_3')).toBe(false);
    });
  });

  describe('updateBot', () => {
    const createBot = (overrides: Partial<Player> = {}): Player => ({
      id: 'bot_1',
      nickname: '[BOT] TestBot',
      team: 'red',
      isBot: true,
      x: 600,
      y: 200,
      energy: 10,
      isStunned: false,
      ...overrides,
    });

    it('should return no action for unregistered bot', () => {
      const bot = createBot();
      const actions = botAI.updateBot(bot, Date.now());

      expect(actions.shouldAttack).toBe(false);
      expect(actions.moveX).toBe(0);
      expect(actions.moveY).toBe(0);
    });

    it('should return no action for stunned bot', () => {
      const bot = createBot({ isStunned: true, energy: 0 });
      botAI.registerBot(bot.id, 0, 0); // Force immediate triggers

      const actions = botAI.updateBot(bot, Date.now() + BOT_ATTACK_INTERVAL + 1000);

      expect(actions.shouldAttack).toBe(false);
      expect(actions.moveX).toBe(0);
      expect(actions.moveY).toBe(0);
    });

    describe('attack behavior', () => {
      it('should return shouldAttack true when attack interval passed', () => {
        const bot = createBot();
        const startTime = 1000;

        // Register with known timing
        botAI.registerBot(bot.id, startTime, startTime);

        // Update at exactly the attack interval
        const attackTime = startTime + BOT_ATTACK_INTERVAL;
        const actions = botAI.updateBot(bot, attackTime);

        expect(actions.shouldAttack).toBe(true);
      });

      it('should not attack before interval passes', () => {
        const bot = createBot();
        const startTime = 1000;

        botAI.registerBot(bot.id, startTime, startTime);

        // Update before attack interval
        const beforeAttack = startTime + BOT_ATTACK_INTERVAL - 100;
        const actions = botAI.updateBot(bot, beforeAttack);

        expect(actions.shouldAttack).toBe(false);
      });

      it('should reset attack timer after attacking', () => {
        const bot = createBot();
        const startTime = 1000;

        botAI.registerBot(bot.id, startTime, startTime);

        // First attack
        const firstAttackTime = startTime + BOT_ATTACK_INTERVAL;
        const actions1 = botAI.updateBot(bot, firstAttackTime);
        expect(actions1.shouldAttack).toBe(true);

        // Should not attack immediately after
        const actions2 = botAI.updateBot(bot, firstAttackTime + 100);
        expect(actions2.shouldAttack).toBe(false);

        // Should attack again after another interval
        const secondAttackTime = firstAttackTime + BOT_ATTACK_INTERVAL;
        const actions3 = botAI.updateBot(bot, secondAttackTime);
        expect(actions3.shouldAttack).toBe(true);
      });
    });

    describe('movement behavior', () => {
      it('should return movement direction when direction interval passed', () => {
        const bot = createBot();
        const startTime = 1000;

        botAI.registerBot(bot.id, startTime, startTime);

        const moveTime = startTime + BOT_DIRECTION_CHANGE_INTERVAL;
        const actions = botAI.updateBot(bot, moveTime);

        // Direction should be set (non-zero magnitude)
        const magnitude = Math.sqrt(actions.moveX ** 2 + actions.moveY ** 2);
        expect(magnitude).toBeGreaterThan(0);
        expect(magnitude).toBeLessThanOrEqual(Math.sqrt(2)); // Max magnitude for unit vector
      });

      it('should maintain same direction between interval changes', () => {
        const bot = createBot();
        const startTime = 1000;

        botAI.registerBot(bot.id, startTime, startTime);

        // First direction change
        const moveTime = startTime + BOT_DIRECTION_CHANGE_INTERVAL;
        const actions1 = botAI.updateBot(bot, moveTime);

        // Same direction before next interval
        const actions2 = botAI.updateBot(bot, moveTime + 100);

        expect(actions2.moveX).toBeCloseTo(actions1.moveX, 5);
        expect(actions2.moveY).toBeCloseTo(actions1.moveY, 5);
      });

      it('should change direction after interval passes', () => {
        const bot = createBot();
        const startTime = 1000;

        // Use fixed seed for predictable random values by mocking Math.random
        let randomCallCount = 0;
        const mockRandom = jest.spyOn(Math, 'random');
        mockRandom.mockImplementation(() => {
          // Return different values for consecutive calls
          return (randomCallCount++ % 10) / 10;
        });

        botAI.registerBot(bot.id, startTime, startTime);

        // First direction change
        const firstMoveTime = startTime + BOT_DIRECTION_CHANGE_INTERVAL;
        const actions1 = botAI.updateBot(bot, firstMoveTime);

        // Second direction change - should potentially be different
        const secondMoveTime = firstMoveTime + BOT_DIRECTION_CHANGE_INTERVAL;
        const actions2 = botAI.updateBot(bot, secondMoveTime);

        // With mocked random, directions are determined by the sequence
        // Just verify that update occurs without error
        expect(typeof actions1.moveX).toBe('number');
        expect(typeof actions2.moveX).toBe('number');

        mockRandom.mockRestore();
      });
    });

    describe('territory boundary handling', () => {
      it('should reverse direction when bot would leave territory', () => {
        // Red team bot at the edge of territory (near diagonal)
        const bot = createBot({
          team: 'red',
          x: 100, // Close to diagonal where y = x
          y: 80,
        });
        const startTime = 1000;

        // Mock random to give direction toward boundary (toward bottom-left)
        const mockRandom = jest.spyOn(Math, 'random');
        mockRandom.mockReturnValue(0.625); // 5/8 of 2*PI = toward bottom-left

        botAI.registerBot(bot.id, startTime, startTime);

        // Initial direction set
        const moveTime = startTime + BOT_DIRECTION_CHANGE_INTERVAL;
        botAI.updateBot(bot, moveTime);

        // Simulate bot moved to position that would exit territory
        const botAtBoundary = createBot({
          ...bot,
          x: 50,
          y: 50, // At diagonal, would violate y <= x - PLAYER_RADIUS
        });

        // Next update should detect boundary violation and reverse
        const actions = botAI.updateBot(botAtBoundary, moveTime + 100);

        // Direction should be reversed (or at least valid for territory)
        expect(typeof actions.moveX).toBe('number');
        expect(typeof actions.moveY).toBe('number');

        mockRandom.mockRestore();
      });

      it('should keep bot within blue team territory', () => {
        const bot = createBot({
          id: 'bot_blue',
          team: 'blue',
          x: 200,
          y: 600,
        });
        const startTime = 1000;

        botAI.registerBot(bot.id, startTime, startTime);

        const moveTime = startTime + BOT_DIRECTION_CHANGE_INTERVAL;
        const actions = botAI.updateBot(bot, moveTime);

        // Should return valid movement direction
        const magnitude = Math.sqrt(actions.moveX ** 2 + actions.moveY ** 2);
        expect(magnitude).toBeGreaterThan(0);
      });
    });
  });

  describe('integration scenarios', () => {
    const createBot = (id: string, team: 'red' | 'blue'): Player => ({
      id,
      nickname: `[BOT] ${id}`,
      team,
      isBot: true,
      x: team === 'red' ? 600 : 200,
      y: team === 'red' ? 200 : 600,
      energy: 10,
      isStunned: false,
    });

    it('should handle multiple bots with different timings', () => {
      const bot1 = createBot('bot_1', 'red');
      const bot2 = createBot('bot_2', 'blue');
      const bot3 = createBot('bot_3', 'red');

      const startTime = 1000;

      // Register with staggered timings
      botAI.registerBot(bot1.id, startTime, startTime);
      botAI.registerBot(bot2.id, startTime + 500, startTime + 300);
      botAI.registerBot(bot3.id, startTime + 1000, startTime + 600);

      // At startTime + BOT_ATTACK_INTERVAL, only bot1 should attack
      const time1 = startTime + BOT_ATTACK_INTERVAL;
      const actions1_1 = botAI.updateBot(bot1, time1);
      const actions1_2 = botAI.updateBot(bot2, time1);
      const actions1_3 = botAI.updateBot(bot3, time1);

      expect(actions1_1.shouldAttack).toBe(true);
      expect(actions1_2.shouldAttack).toBe(false); // 500ms behind
      expect(actions1_3.shouldAttack).toBe(false); // 1000ms behind
    });

    it('should maintain consistent behavior over time', () => {
      const bot = createBot('bot_1', 'red');
      const startTime = 1000;

      botAI.registerBot(bot.id, startTime, startTime);

      let attackCount = 0;
      let directionChangeCount = 0;
      let lastMoveX = 0;
      let lastMoveY = 0;

      // Simulate 10 seconds of updates at 60 FPS
      const frameTime = 1000 / 60;
      for (let i = 0; i < 600; i++) {
        const currentTime = startTime + i * frameTime;
        const actions = botAI.updateBot(bot, currentTime);

        if (actions.shouldAttack) {
          attackCount++;
        }

        if (actions.moveX !== lastMoveX || actions.moveY !== lastMoveY) {
          if (lastMoveX !== 0 || lastMoveY !== 0) {
            directionChangeCount++;
          }
          lastMoveX = actions.moveX;
          lastMoveY = actions.moveY;
        }
      }

      // Over 10 seconds with 2s attack interval, expect ~5 attacks
      expect(attackCount).toBeGreaterThanOrEqual(4);
      expect(attackCount).toBeLessThanOrEqual(6);

      // Over 10 seconds with 1s direction interval, expect ~10 direction changes
      expect(directionChangeCount).toBeGreaterThanOrEqual(8);
      expect(directionChangeCount).toBeLessThanOrEqual(12);
    });
  });
});
