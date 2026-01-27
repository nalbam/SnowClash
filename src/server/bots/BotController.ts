import { GameState } from '../schema/GameState';
import { PlayerSchema } from '../schema/PlayerSchema';
import { SnowballSchema } from '../schema/SnowballSchema';
import { generateBotNickname } from '../utils/NicknameGenerator';
import {
  MAP_SIZE,
  PLAYER_SPEED,
  PLAYER_RADIUS,
  PLAYER_INITIAL_ENERGY,
  SNOWBALL_SPEED,
  NORMAL_DAMAGE,
  BOT_ATTACK_INTERVAL,
  BOT_DIRECTION_CHANGE_INTERVAL,
  SPAWN_MARGIN,
  SPAWN_PADDING,
} from '../../shared/constants';

export class BotController {
  private state: GameState;
  private botIds: Set<string> = new Set();
  private lastAttackTime: Map<string, number> = new Map();
  private lastDirectionChange: Map<string, number> = new Map();
  private moveDirection: Map<string, { dx: number; dy: number }> = new Map();

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
    bot.energy = PLAYER_INITIAL_ENERGY;
    bot.isStunned = false;
    bot.joinedAt = Date.now();

    this.state.players.set(botId, bot);
    this.botIds.add(botId);

    // Randomize initial attack/direction timing so bots don't act in sync
    const now = Date.now();
    const randomAttackOffset = Math.random() * BOT_ATTACK_INTERVAL;
    const randomDirectionOffset = Math.random() * BOT_DIRECTION_CHANGE_INTERVAL;
    this.lastAttackTime.set(botId, now - randomAttackOffset);
    this.lastDirectionChange.set(botId, now - randomDirectionOffset);
    this.moveDirection.set(botId, { dx: 0, dy: 0 });
    this.state.botCount++;

    return botId;
  }

  initializeBotPosition(botId: string): void {
    const bot = this.state.players.get(botId);
    if (!bot) return;

    const MAX_SPAWN_ATTEMPTS = 100;

    if (bot.team === 'red') {
      // Red team: top-right triangle (y < x - SPAWN_MARGIN)
      let x, y;
      let attempts = 0;
      do {
        x = SPAWN_PADDING + Math.random() * (MAP_SIZE - SPAWN_PADDING * 2);
        y = SPAWN_PADDING + Math.random() * (MAP_SIZE - SPAWN_PADDING * 2);
        attempts++;
      } while (y >= x - SPAWN_MARGIN && attempts < MAX_SPAWN_ATTEMPTS);

      // Fallback to deterministic position if random generation fails
      if (attempts >= MAX_SPAWN_ATTEMPTS) {
        x = MAP_SIZE * 0.7;
        y = MAP_SIZE * 0.3;
      }
      bot.x = x;
      bot.y = y;
    } else {
      // Blue team: bottom-left triangle (y > x + SPAWN_MARGIN)
      let x, y;
      let attempts = 0;
      do {
        x = SPAWN_PADDING + Math.random() * (MAP_SIZE - SPAWN_PADDING * 2);
        y = SPAWN_PADDING + Math.random() * (MAP_SIZE - SPAWN_PADDING * 2);
        attempts++;
      } while (y <= x + SPAWN_MARGIN && attempts < MAX_SPAWN_ATTEMPTS);

      // Fallback to deterministic position if random generation fails
      if (attempts >= MAX_SPAWN_ATTEMPTS) {
        x = MAP_SIZE * 0.3;
        y = MAP_SIZE * 0.7;
      }
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
    // Stop bot updates if game is not in playing phase
    if (this.state.phase !== 'playing') {
      return;
    }

    this.botIds.forEach(botId => {
      const bot = this.state.players.get(botId);
      if (!bot || bot.isStunned) return;

      // 방향 변경 (1초마다)
      const lastDirChange = this.lastDirectionChange.get(botId) || 0;
      if (currentTime - lastDirChange >= BOT_DIRECTION_CHANGE_INTERVAL) {
        this.changeDirection(botId);
        this.lastDirectionChange.set(botId, currentTime);
      }

      // 이동 적용
      this.applyMovement(botId);

      // 공격
      const lastAttack = this.lastAttackTime.get(botId) || 0;
      if (currentTime - lastAttack >= BOT_ATTACK_INTERVAL) {
        this.botThrowSnowball(botId);
        this.lastAttackTime.set(botId, currentTime);
      }
    });
  }

  private changeDirection(botId: string): void {
    // 랜덤 방향 설정
    const angle = Math.random() * Math.PI * 2;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    this.moveDirection.set(botId, { dx, dy });
  }

  private applyMovement(botId: string): void {
    const bot = this.state.players.get(botId);
    if (!bot) return;

    const dir = this.moveDirection.get(botId);
    if (!dir) return;

    const newX = bot.x + dir.dx * PLAYER_SPEED;
    const newY = bot.y + dir.dy * PLAYER_SPEED;

    // Check if within team territory
    if (this.isInTerritory(newX, newY, bot.team)) {
      bot.x = Math.max(PLAYER_RADIUS, Math.min(MAP_SIZE - PLAYER_RADIUS, newX));
      bot.y = Math.max(PLAYER_RADIUS, Math.min(MAP_SIZE - PLAYER_RADIUS, newY));
    } else {
      // Reverse direction if out of bounds
      this.moveDirection.set(botId, { dx: -dir.dx, dy: -dir.dy });
    }
  }

  private isInTerritory(x: number, y: number, team: string): boolean {
    // Apply padding for player size

    // Map boundary padding
    if (x < PLAYER_RADIUS || x > MAP_SIZE - PLAYER_RADIUS ||
        y < PLAYER_RADIUS || y > MAP_SIZE - PLAYER_RADIUS) {
      return false;
    }

    // Diagonal line padding
    if (team === 'red') {
      return y <= x - PLAYER_RADIUS;
    } else {
      return y >= x + PLAYER_RADIUS;
    }
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
    this.lastDirectionChange.clear();
    this.moveDirection.clear();
  }

  getBotIds(): Set<string> {
    return this.botIds;
  }
}
