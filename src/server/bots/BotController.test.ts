import { BotController } from './BotController';
import { GameState } from '../schema/GameState';
import { PlayerSchema } from '../schema/PlayerSchema';

describe('BotController', () => {
  let gameState: GameState;
  let botController: BotController;

  beforeEach(() => {
    gameState = new GameState();
    gameState.mapSize = 800;
    gameState.phase = 'lobby';
    botController = new BotController(gameState);
  });

  describe('createBot', () => {
    it('should create a bot with correct properties', () => {
      const botId = botController.createBot('red');

      expect(botId).toMatch(/^bot_\d+_[a-z0-9]+$/);
      expect(gameState.players.has(botId)).toBe(true);

      const bot = gameState.players.get(botId);
      expect(bot).toBeDefined();
      expect(bot!.team).toBe('red');
      expect(bot!.isBot).toBe(true);
      expect(bot!.isReady).toBe(true);
      expect(bot!.energy).toBe(10);
      expect(bot!.isStunned).toBe(false);
      expect(bot!.nickname).toMatch(/^\[BOT\] \w+Bot\d{1,2}$/);
    });

    it('should create bots for different teams', () => {
      const redBotId = botController.createBot('red');
      const blueBotId = botController.createBot('blue');

      const redBot = gameState.players.get(redBotId);
      const blueBot = gameState.players.get(blueBotId);

      expect(redBot!.team).toBe('red');
      expect(blueBot!.team).toBe('blue');
    });

    it('should increment bot count', () => {
      expect(gameState.botCount).toBe(0);

      botController.createBot('red');
      expect(gameState.botCount).toBe(1);

      botController.createBot('blue');
      expect(gameState.botCount).toBe(2);
    });

    it('should track bot IDs', () => {
      const botId1 = botController.createBot('red');
      const botId2 = botController.createBot('blue');

      const botIds = botController.getBotIds();
      expect(botIds.has(botId1)).toBe(true);
      expect(botIds.has(botId2)).toBe(true);
      expect(botIds.size).toBe(2);
    });
  });

  describe('initializeBotPosition', () => {
    it('should position red bot in red territory (y < x)', () => {
      const botId = botController.createBot('red');
      botController.initializeBotPosition(botId);

      const bot = gameState.players.get(botId);
      expect(bot).toBeDefined();

      // Red territory: y <= x - 30 (margin)
      expect(bot!.y).toBeLessThan(bot!.x - 30);
    });

    it('should position blue bot in blue territory (y > x)', () => {
      const botId = botController.createBot('blue');
      botController.initializeBotPosition(botId);

      const bot = gameState.players.get(botId);
      expect(bot).toBeDefined();

      // Blue territory: y >= x + 30 (margin)
      expect(bot!.y).toBeGreaterThan(bot!.x + 30);
    });

    it('should position bot within map boundaries', () => {
      const redBotId = botController.createBot('red');
      const blueBotId = botController.createBot('blue');

      botController.initializeBotPosition(redBotId);
      botController.initializeBotPosition(blueBotId);

      const redBot = gameState.players.get(redBotId);
      const blueBot = gameState.players.get(blueBotId);

      // Check padding (20px from edges)
      [redBot!, blueBot!].forEach(bot => {
        expect(bot.x).toBeGreaterThanOrEqual(20);
        expect(bot.x).toBeLessThanOrEqual(780);
        expect(bot.y).toBeGreaterThanOrEqual(20);
        expect(bot.y).toBeLessThanOrEqual(780);
      });
    });
  });

  describe('fillTeamsWithBots', () => {
    it('should fill empty teams with 3 bots each', () => {
      botController.fillTeamsWithBots();

      const players = Array.from(gameState.players.values());
      const redPlayers = players.filter(p => p.team === 'red');
      const bluePlayers = players.filter(p => p.team === 'blue');

      expect(redPlayers.length).toBe(3);
      expect(bluePlayers.length).toBe(3);
      expect(gameState.botCount).toBe(6);
    });

    it('should fill teams with human players to 3 total', () => {
      // Add 1 human red player
      const humanPlayer = new PlayerSchema();
      humanPlayer.sessionId = 'human1';
      humanPlayer.nickname = 'Human Player';
      humanPlayer.team = 'red';
      humanPlayer.isBot = false;
      humanPlayer.isReady = true;
      gameState.players.set('human1', humanPlayer);

      botController.fillTeamsWithBots();

      const players = Array.from(gameState.players.values());
      const redPlayers = players.filter(p => p.team === 'red');
      const bluePlayers = players.filter(p => p.team === 'blue');
      const redBots = redPlayers.filter(p => p.isBot);

      expect(redPlayers.length).toBe(3);
      expect(redBots.length).toBe(2); // 2 bots added
      expect(bluePlayers.length).toBe(3);
      expect(bluePlayers.every(p => p.isBot)).toBe(true);
    });

    it('should not add bots if team is full', () => {
      // Add 3 human red players
      for (let i = 0; i < 3; i++) {
        const humanPlayer = new PlayerSchema();
        humanPlayer.sessionId = `human${i}`;
        humanPlayer.nickname = `Player${i}`;
        humanPlayer.team = 'red';
        humanPlayer.isBot = false;
        humanPlayer.isReady = true;
        gameState.players.set(`human${i}`, humanPlayer);
      }

      botController.fillTeamsWithBots();

      const players = Array.from(gameState.players.values());
      const redPlayers = players.filter(p => p.team === 'red');
      const redBots = redPlayers.filter(p => p.isBot);
      const bluePlayers = players.filter(p => p.team === 'blue');

      expect(redPlayers.length).toBe(3);
      expect(redBots.length).toBe(0); // No bots added to red team
      expect(bluePlayers.length).toBe(3);
      expect(bluePlayers.every(p => p.isBot)).toBe(true);
    });
  });

  describe('updateBots', () => {
    it('should not update bots if game is not in playing phase', () => {
      const botId = botController.createBot('red');
      botController.initializeBotPosition(botId);

      const bot = gameState.players.get(botId);
      const initialX = bot!.x;
      const initialY = bot!.y;

      gameState.phase = 'lobby';
      botController.updateBots(Date.now());

      // Position should not change
      expect(bot!.x).toBe(initialX);
      expect(bot!.y).toBe(initialY);
    });

    it('should update bot movement during playing phase', () => {
      const botId = botController.createBot('red');
      botController.initializeBotPosition(botId);

      const bot = gameState.players.get(botId);
      const initialX = bot!.x;
      const initialY = bot!.y;

      gameState.phase = 'playing';

      // Update bots multiple times to allow movement
      for (let i = 0; i < 10; i++) {
        botController.updateBots(Date.now() + i * 100);
      }

      // Position should have changed (unless unlucky random direction kept it same)
      const moved = bot!.x !== initialX || bot!.y !== initialY;
      expect(moved).toBe(true);
    });

    it('should not update stunned bots', () => {
      const botId = botController.createBot('red');
      botController.initializeBotPosition(botId);

      const bot = gameState.players.get(botId);
      bot!.isStunned = true;
      const initialX = bot!.x;
      const initialY = bot!.y;

      gameState.phase = 'playing';

      for (let i = 0; i < 10; i++) {
        botController.updateBots(Date.now() + i * 100);
      }

      // Stunned bot should not move
      expect(bot!.x).toBe(initialX);
      expect(bot!.y).toBe(initialY);
    });

    it('should make bots throw snowballs periodically', () => {
      const botId = botController.createBot('red');
      botController.initializeBotPosition(botId);

      gameState.phase = 'playing';
      const currentTime = Date.now();

      expect(gameState.snowballs.size).toBe(0);

      // First update - bot throws immediately (lastAttackTime initialized to 0)
      botController.updateBots(currentTime);
      expect(gameState.snowballs.size).toBe(1);

      // Clear snowballs
      gameState.snowballs.clear();

      // After 2 seconds - should throw another
      botController.updateBots(currentTime + 2100);
      expect(gameState.snowballs.size).toBe(1);

      // Check snowball properties
      const snowball = Array.from(gameState.snowballs.values())[0];
      expect(snowball.team).toBe('red');
      expect(snowball.damage).toBe(4);
      expect(snowball.ownerId).toBe(botId);

      // Red team shoots toward bottom-left
      expect(snowball.velocityX).toBe(-4);
      expect(snowball.velocityY).toBe(4);
    });

    it('should change bot direction periodically', () => {
      const botId = botController.createBot('red');
      botController.initializeBotPosition(botId);

      gameState.phase = 'playing';
      const currentTime = Date.now();

      // Record positions over time
      const positions: Array<{ x: number; y: number }> = [];

      for (let i = 0; i < 5; i++) {
        botController.updateBots(currentTime + i * 1100);
        const bot = gameState.players.get(botId);
        positions.push({ x: bot!.x, y: bot!.y });
      }

      // Bot should have moved (direction changes every 1 second)
      const uniquePositions = new Set(positions.map(p => `${p.x},${p.y}`));
      expect(uniquePositions.size).toBeGreaterThan(1);
    });
  });

  describe('removeAllBots', () => {
    it('should remove all bots from game state', () => {
      botController.fillTeamsWithBots();
      expect(gameState.players.size).toBe(6);
      expect(gameState.botCount).toBe(6);

      botController.removeAllBots();

      expect(gameState.players.size).toBe(0);
      expect(gameState.botCount).toBe(0);
      expect(botController.getBotIds().size).toBe(0);
    });

    it('should not remove human players', () => {
      // Add human player
      const humanPlayer = new PlayerSchema();
      humanPlayer.sessionId = 'human1';
      humanPlayer.nickname = 'Human Player';
      humanPlayer.team = 'red';
      humanPlayer.isBot = false;
      gameState.players.set('human1', humanPlayer);

      // Add bots
      botController.fillTeamsWithBots();

      const totalPlayers = gameState.players.size;
      expect(totalPlayers).toBeGreaterThan(1);

      botController.removeAllBots();

      // Human player should remain
      expect(gameState.players.size).toBe(1);
      expect(gameState.players.has('human1')).toBe(true);
      expect(gameState.botCount).toBe(0);
    });

    it('should clear all bot tracking data', () => {
      botController.createBot('red');
      botController.createBot('blue');

      botController.removeAllBots();

      expect(botController.getBotIds().size).toBe(0);
      expect(gameState.botCount).toBe(0);
    });
  });

  describe('bot movement boundaries', () => {
    it('should keep bots within their territory', () => {
      const botId = botController.createBot('red');
      botController.initializeBotPosition(botId);

      gameState.phase = 'playing';
      const currentTime = Date.now();

      // Update many times to test boundary enforcement
      for (let i = 0; i < 100; i++) {
        botController.updateBots(currentTime + i * 100);

        const bot = gameState.players.get(botId);

        // Red bot should stay in red territory (y <= x - 15)
        expect(bot!.y).toBeLessThanOrEqual(bot!.x - 15);

        // Should stay within map boundaries
        expect(bot!.x).toBeGreaterThanOrEqual(15);
        expect(bot!.x).toBeLessThanOrEqual(785);
        expect(bot!.y).toBeGreaterThanOrEqual(15);
        expect(bot!.y).toBeLessThanOrEqual(785);
      }
    });
  });
});
