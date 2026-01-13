import { GameState } from '../schema/GameState';
import { PlayerSchema } from '../schema/PlayerSchema';
import { SnowballSchema } from '../schema/SnowballSchema';
import { generateBotNickname } from '../utils/NicknameGenerator';

const MAP_SIZE = 600;
const SNOWBALL_SPEED = 4;
const NORMAL_DAMAGE = 4;
const BOT_ATTACK_INTERVAL = 2000; // 2 seconds

export class BotController {
  private state: GameState;
  private botIds: Set<string> = new Set();
  private lastAttackTime: Map<string, number> = new Map();

  constructor(state: GameState) {
    this.state = state;
  }

  createBot(team: string): string {
    const botId = `bot_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const bot = new PlayerSchema();
    bot.sessionId = botId;
    bot.nickname = `[BOT] ${generateBotNickname()}`;
    bot.team = team;
    bot.isBot = true;
    bot.isReady = true;
    bot.energy = 10;
    bot.isStunned = false;
    bot.joinedAt = Date.now();

    this.state.players.set(botId, bot);
    this.botIds.add(botId);
    this.lastAttackTime.set(botId, 0);
    this.state.botCount++;

    return botId;
  }

  initializeBotPosition(botId: string): void {
    const bot = this.state.players.get(botId);
    if (!bot) return;

    const margin = 30;
    const padding = 20;

    if (bot.team === 'red') {
      // Red team: top-right triangle (y < x - margin)
      let x, y;
      do {
        x = padding + Math.random() * (MAP_SIZE - padding * 2);
        y = padding + Math.random() * (MAP_SIZE - padding * 2);
      } while (y >= x - margin);
      bot.x = x;
      bot.y = y;
    } else {
      // Blue team: bottom-left triangle (y > x + margin)
      let x, y;
      do {
        x = padding + Math.random() * (MAP_SIZE - padding * 2);
        y = padding + Math.random() * (MAP_SIZE - padding * 2);
      } while (y <= x + margin);
      bot.x = x;
      bot.y = y;
    }
  }

  fillTeamsWithBots(): void {
    const players = Array.from(this.state.players.values());
    const redPlayers = players.filter(p => p.team === 'red' && !p.isBot);
    const bluePlayers = players.filter(p => p.team === 'blue' && !p.isBot);
    const redBots = players.filter(p => p.team === 'red' && p.isBot);
    const blueBots = players.filter(p => p.team === 'blue' && p.isBot);

    // Fill red team to 3 players
    const redNeeded = 3 - redPlayers.length - redBots.length;
    for (let i = 0; i < redNeeded; i++) {
      this.createBot('red');
    }

    // Fill blue team to 3 players
    const blueNeeded = 3 - bluePlayers.length - blueBots.length;
    for (let i = 0; i < blueNeeded; i++) {
      this.createBot('blue');
    }
  }

  initializeAllBotPositions(): void {
    this.botIds.forEach(botId => {
      this.initializeBotPosition(botId);
    });
  }

  updateBots(currentTime: number): void {
    this.botIds.forEach(botId => {
      const bot = this.state.players.get(botId);
      if (!bot || bot.isStunned) return;

      const lastAttack = this.lastAttackTime.get(botId) || 0;
      if (currentTime - lastAttack >= BOT_ATTACK_INTERVAL) {
        this.botThrowSnowball(botId);
        this.lastAttackTime.set(botId, currentTime);
      }
    });
  }

  private botThrowSnowball(botId: string): void {
    const bot = this.state.players.get(botId);
    if (!bot || bot.isStunned) return;

    const snowball = new SnowballSchema();
    snowball.id = `${botId}_${Date.now()}`;
    snowball.ownerId = botId;
    snowball.x = bot.x;
    snowball.y = bot.y;
    snowball.team = bot.team;
    snowball.damage = NORMAL_DAMAGE;

    // Bots fire diagonally toward opponent territory
    if (bot.team === 'red') {
      snowball.velocityX = -SNOWBALL_SPEED;
      snowball.velocityY = SNOWBALL_SPEED;
    } else {
      snowball.velocityX = SNOWBALL_SPEED;
      snowball.velocityY = -SNOWBALL_SPEED;
    }

    this.state.snowballs.set(snowball.id, snowball);
  }

  removeAllBots(): void {
    this.botIds.forEach(botId => {
      this.state.players.delete(botId);
    });
    this.state.botCount = 0;
    this.botIds.clear();
    this.lastAttackTime.clear();
  }

  getBotIds(): Set<string> {
    return this.botIds;
  }
}
