import { Room, Client } from 'colyseus';
import { GameState } from '../schema/GameState';
import { PlayerSchema } from '../schema/PlayerSchema';
import { SnowballSchema } from '../schema/SnowballSchema';
import { BotController } from '../bots/BotController';
import { generateNickname } from '../utils/NicknameGenerator';

const READY_TIMEOUT = 60000; // 1 minute in milliseconds
const MAP_SIZE = 600;
const PLAYER_SPEED = 2;
const SNOWBALL_SPEED = 4;
const NORMAL_DAMAGE = 4;
const CHARGED_DAMAGE = 7;

export class GameRoom extends Room<GameState> {
  private readyTimers: Map<string, NodeJS.Timeout> = new Map();
  private updateInterval?: NodeJS.Timeout;
  private botController?: BotController;

  onCreate(options: any) {
    this.setState(new GameState());
    this.state.mapSize = MAP_SIZE;
    this.state.roomName = options.roomName || 'Game Room';
    this.botController = new BotController(this.state);

    // Set metadata for room listing
    this.setMetadata({ roomName: this.state.roomName });

    this.onMessage('setProfile', (client, message) => {
      const player = this.state.players.get(client.sessionId);
      if (player) {
        player.nickname = message.nickname || 'Player';
        player.googleId = message.googleId || '';
        player.photoUrl = message.photoUrl || '';
      }
    });

    this.onMessage('selectTeam', (client, message) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || this.state.phase !== 'lobby') return;

      const team = message.team;
      if (team !== 'red' && team !== 'blue') return;

      // Check team capacity
      const teamCount = Array.from(this.state.players.values())
        .filter(p => p.team === team).length;
      
      if (teamCount >= 3 && player.team !== team) {
        client.send('error', { message: 'Team is full' });
        return;
      }

      player.team = team;
      player.isReady = false; // Reset ready status when changing team
    });

    this.onMessage('ready', (client, message) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || this.state.phase !== 'lobby' || !player.team) return;

      player.isReady = message.ready;

      // Clear ready timer
      const timer = this.readyTimers.get(client.sessionId);
      if (timer) {
        clearTimeout(timer);
        this.readyTimers.delete(client.sessionId);
      }

      this.checkStartConditions();
    });

    this.onMessage('startGame', (client, message) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.isHost || this.state.phase !== 'lobby') return;

      this.startGame();
    });

    this.onMessage('move', (client, message) => {
      if (this.state.phase !== 'playing') return;

      const player = this.state.players.get(client.sessionId);
      if (!player || player.isStunned) return;

      const { x, y } = message;
      const newX = player.x + x * PLAYER_SPEED;
      const newY = player.y + y * PLAYER_SPEED;

      // Check territory boundaries
      if (this.isInPlayerTerritory(newX, newY, player.team)) {
        player.x = Math.max(0, Math.min(MAP_SIZE, newX));
        player.y = Math.max(0, Math.min(MAP_SIZE, newY));
      }
    });

    this.onMessage('throwSnowball', (client, message) => {
      if (this.state.phase !== 'playing') return;

      const player = this.state.players.get(client.sessionId);
      if (!player || player.isStunned) return;

      const chargeLevel = Math.min(1, Math.max(0, message.chargeLevel || 0));
      const damage = chargeLevel >= 0.7 ? CHARGED_DAMAGE : NORMAL_DAMAGE;

      const snowball = new SnowballSchema();
      snowball.id = `${client.sessionId}_${Date.now()}`;
      snowball.ownerId = client.sessionId;
      snowball.x = player.x;
      snowball.y = player.y;
      snowball.team = player.team;
      snowball.damage = damage;

      // Snowballs fire diagonally toward opponent territory
      // Map divided by \ diagonal: Red (top-right, y<=x), Blue (bottom-left, y>=x)
      // Red team shoots toward bottom-left (−x, +y), Blue team shoots toward top-right (+x, −y)
      if (player.team === 'red') {
        snowball.velocityX = -SNOWBALL_SPEED;
        snowball.velocityY = SNOWBALL_SPEED;
      } else {
        snowball.velocityX = SNOWBALL_SPEED;
        snowball.velocityY = -SNOWBALL_SPEED;
      }

      this.state.snowballs.set(snowball.id, snowball);
    });
  }

  onJoin(client: Client, options: any) {
    const player = new PlayerSchema();
    player.sessionId = client.sessionId;
    player.nickname = options.nickname || generateNickname();
    player.googleId = options.googleId || '';
    player.photoUrl = options.photoUrl || '';
    player.isBot = false;
    player.joinedAt = Date.now();

    // First human player is the host (exclude bots)
    const humanPlayers = Array.from(this.state.players.values()).filter(p => !p.isBot);
    if (humanPlayers.length === 0) {
      player.isHost = true;
    }

    // Auto-assign team (to team with fewer players)
    const redCount = Array.from(this.state.players.values()).filter(p => p.team === 'red').length;
    const blueCount = Array.from(this.state.players.values()).filter(p => p.team === 'blue').length;
    if (redCount <= blueCount) {
      player.team = 'red';
    } else {
      player.team = 'blue';
    }

    this.state.players.set(client.sessionId, player);

    // Set ready timeout
    const timeout = setTimeout(() => {
      if (this.state.phase === 'lobby') {
        const p = this.state.players.get(client.sessionId);
        if (p && !p.isReady) {
          this.broadcast('playerKicked', { 
            sessionId: client.sessionId, 
            reason: 'Not ready within 1 minute' 
          });
          client.leave();
        }
      }
    }, READY_TIMEOUT);

    this.readyTimers.set(client.sessionId, timeout);
  }

  onLeave(client: Client, consented: boolean) {
    const player = this.state.players.get(client.sessionId);
    
    // Clear ready timer
    const timer = this.readyTimers.get(client.sessionId);
    if (timer) {
      clearTimeout(timer);
      this.readyTimers.delete(client.sessionId);
    }

    this.state.players.delete(client.sessionId);

    // If host left, assign new host
    if (player?.isHost && this.state.players.size > 0) {
      const newHost = Array.from(this.state.players.values())[0];
      newHost.isHost = true;
    }

    // Check if game should end
    if (this.state.phase === 'playing') {
      this.checkWinConditions();
    }
  }

  onDispose() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    this.readyTimers.forEach(timer => clearTimeout(timer));
    this.readyTimers.clear();
  }

  private checkStartConditions() {
    if (this.state.phase !== 'lobby') return;

    const players = Array.from(this.state.players.values());
    const redTeam = players.filter(p => p.team === 'red');
    const blueTeam = players.filter(p => p.team === 'blue');

    // All players must be ready and in teams
    const allReady = players.every(p => p.isReady && p.team);

    if (allReady && redTeam.length > 0 && blueTeam.length > 0) {
      // Host can start the game
      // Game will be started via 'startGame' message from host
    }
  }

  private startGame() {
    const humanPlayers = Array.from(this.state.players.values()).filter(p => !p.isBot);
    const redHumans = humanPlayers.filter(p => p.team === 'red');
    const blueHumans = humanPlayers.filter(p => p.team === 'blue');

    // At least one human player must be ready in either team
    if (redHumans.length === 0 && blueHumans.length === 0) return;
    if (!humanPlayers.every(p => p.isReady)) return;

    // Fill teams with bots to make 3v3
    if (this.botController) {
      this.botController.fillTeamsWithBots();
    }

    this.state.phase = 'playing';

    // Initialize all player positions (including bots)
    // Spawn randomly within team territory with margin from diagonal
    const margin = 30; // Distance from diagonal line
    const padding = 20; // Distance from map edges

    const allPlayers = Array.from(this.state.players.values());
    allPlayers.forEach(player => {
      if (player.team === 'red') {
        // Red team: top-right triangle (y < x)
        // Generate random point where y < x - margin
        let x, y;
        do {
          x = padding + Math.random() * (MAP_SIZE - padding * 2);
          y = padding + Math.random() * (MAP_SIZE - padding * 2);
        } while (y >= x - margin); // Keep trying until y < x - margin
        player.x = x;
        player.y = y;
      } else {
        // Blue team: bottom-left triangle (y > x)
        // Generate random point where y > x + margin
        let x, y;
        do {
          x = padding + Math.random() * (MAP_SIZE - padding * 2);
          y = padding + Math.random() * (MAP_SIZE - padding * 2);
        } while (y <= x + margin); // Keep trying until y > x + margin
        player.x = x;
        player.y = y;
      }
      player.energy = 10;
      player.isStunned = false;
    });

    // Start game loop
    this.updateInterval = setInterval(() => {
      this.updateGame();
    }, 1000 / 60); // 60 FPS
  }

  private updateGame() {
    if (this.state.phase !== 'playing') return;

    // Update bots
    if (this.botController) {
      this.botController.updateBots(Date.now());
    }

    // Update snowballs
    const snowballsToRemove: string[] = [];

    this.state.snowballs.forEach((snowball, id) => {
      snowball.x += snowball.velocityX;
      snowball.y += snowball.velocityY;

      // Remove snowballs that are far out of bounds (allow traveling across the map)
      const margin = 100;
      if (snowball.x < -margin || snowball.x > MAP_SIZE + margin ||
          snowball.y < -margin || snowball.y > MAP_SIZE + margin) {
        snowballsToRemove.push(id);
        return;
      }

      // Check collision with players
      this.state.players.forEach(player => {
        if (player.team === snowball.team) return; // Don't hit teammates

        const distance = Math.sqrt(
          Math.pow(player.x - snowball.x, 2) +
          Math.pow(player.y - snowball.y, 2)
        );

        // 충돌 범위: 캐릭터 반지름(15) + 눈덩이 반지름(일반 5, 차지 9)
        const playerRadius = 15;
        const snowballRadius = snowball.damage >= CHARGED_DAMAGE ? 9 : 5;
        const hitRadius = playerRadius + snowballRadius;

        if (distance < hitRadius) {
          // Stunned players can still be hit (act as dummy/shield)
          if (!player.isStunned) {
            player.energy -= snowball.damage;
            if (player.energy <= 0) {
              player.isStunned = true;
            }
          }
          snowballsToRemove.push(id);
        }
      });
    });

    snowballsToRemove.forEach(id => {
      this.state.snowballs.delete(id);
    });

    this.checkWinConditions();
  }

  private checkWinConditions() {
    if (this.state.phase !== 'playing') return;

    const players = Array.from(this.state.players.values());
    const redAlive = players.filter(p => p.team === 'red' && !p.isStunned).length;
    const blueAlive = players.filter(p => p.team === 'blue' && !p.isStunned).length;

    if (redAlive === 0 && blueAlive > 0) {
      this.endGame('blue');
    } else if (blueAlive === 0 && redAlive > 0) {
      this.endGame('red');
    } else if (redAlive === 0 && blueAlive === 0) {
      this.endGame('draw');
    }
  }

  private endGame(winner: string) {
    this.state.phase = 'ended';
    this.state.winner = winner;

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }

    // Remove all bots
    if (this.botController) {
      this.botController.removeAllBots();
    }

    this.broadcast('gameEnded', { winner });
  }

  private isInPlayerTerritory(x: number, y: number, team: string): boolean {
    // Map is divided by \ diagonal (top-left to bottom-right)
    // Red team territory: top-right triangle (y <= x)
    // Blue team territory: bottom-left triangle (y >= x)
    // 플레이어 크기(15px) 만큼 패딩 적용
    const playerRadius = 15;

    // 맵 경계 패딩
    if (x < playerRadius || x > MAP_SIZE - playerRadius ||
        y < playerRadius || y > MAP_SIZE - playerRadius) {
      return false;
    }

    // 대각선 기준 패딩
    if (team === 'red') {
      return y <= x - playerRadius;
    } else {
      return y >= x + playerRadius;
    }
  }
}
