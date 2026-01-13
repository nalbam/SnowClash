import Phaser from 'phaser';
import { Room } from 'colyseus.js';

const MAP_SIZE = 600;

export class GameScene extends Phaser.Scene {
  private room?: Room;
  private players: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private snowballs: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private playerLabels: Map<string, Phaser.GameObjects.Text> = new Map();
  private energyBars: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private currentPlayer?: string;
  private keys?: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    space: Phaser.Input.Keyboard.Key;
    arrowUp: Phaser.Input.Keyboard.Key;
    arrowDown: Phaser.Input.Keyboard.Key;
    arrowLeft: Phaser.Input.Keyboard.Key;
    arrowRight: Phaser.Input.Keyboard.Key;
  };
  private chargeStartTime: number = 0;
  private isCharging: boolean = false;
  private chargeGauge?: Phaser.GameObjects.Graphics;
  private listenersSetup: boolean = false;
  private lastThrowTime: number = 0;
  private readonly THROW_COOLDOWN: number = 1000; // 1초 쿨다운
  private readonly MIN_CHARGE_TIME: number = 200; // 최소 0.2초 차징 필요
  private fadingSnowballs: Set<string> = new Set(); // 페이딩 중인 눈덩이 추적
  private snowballPositions: Map<string, { x: number; y: number; team: string }> = new Map(); // 눈덩이 마지막 위치 저장

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: any) {
    this.room = data.room;
    this.listenersSetup = false;
    this.players.clear();
    this.snowballs.clear();
    this.playerLabels.clear();
    this.energyBars.clear();
    this.fadingSnowballs.clear();
    this.snowballPositions.clear();
  }

  create() {
    this.cameras.main.setBackgroundColor('#e8f4f8');

    // Draw the map
    this.drawMap();

    // Setup input
    if (this.input.keyboard) {
      // WASD keys
      const keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
      const keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
      const keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
      const keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);

      // Arrow keys
      const keyUp = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
      const keyDown = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
      const keyLeft = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
      const keyRight = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);

      this.keys = {
        up: keyW,
        down: keyS,
        left: keyA,
        right: keyD,
        space: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
        // Store arrow keys separately
        arrowUp: keyUp,
        arrowDown: keyDown,
        arrowLeft: keyLeft,
        arrowRight: keyRight,
      };
    }

    // Setup room state listeners
    this.setupRoomHandlers();

    // Create charge gauge
    this.chargeGauge = this.add.graphics();

    // Force initial sync after a short delay (in case onStateChange doesn't fire)
    this.time.delayedCall(100, () => {
      if (this.room && this.room.state) {
        this.syncPlayersFromState(this.room.state as any);
      }
    });
  }

  update(time: number, delta: number) {
    if (!this.room || !this.keys) return;

    // Handle movement (WASD or Arrow keys)
    let moveX = 0;
    let moveY = 0;

    if (this.keys.up.isDown || this.keys.arrowUp.isDown) moveY = -1;
    if (this.keys.down.isDown || this.keys.arrowDown.isDown) moveY = 1;
    if (this.keys.left.isDown || this.keys.arrowLeft.isDown) moveX = -1;
    if (this.keys.right.isDown || this.keys.arrowRight.isDown) moveX = 1;

    if (moveX !== 0 || moveY !== 0) {
      this.room.send('move', { x: moveX, y: moveY });
    }

    // Handle snowball throwing with charge
    const canThrow = time - this.lastThrowTime >= this.THROW_COOLDOWN;

    if (this.keys.space.isDown && canThrow) {
      if (!this.isCharging) {
        this.isCharging = true;
        this.chargeStartTime = time;
      }
      this.updateChargeGauge(time);
    } else if (this.isCharging && !this.keys.space.isDown) {
      // Release snowball
      const chargeTime = time - this.chargeStartTime;

      // Only throw if minimum charge time met
      if (chargeTime >= this.MIN_CHARGE_TIME) {
        const chargeLevel = Math.min(chargeTime / 1000, 1); // Max 1 second charge
        this.room.send('throwSnowball', { chargeLevel });
        this.lastThrowTime = time;
      }

      this.isCharging = false;
      if (this.chargeGauge) {
        this.chargeGauge.clear();
      }
    }
  }

  private drawMap() {
    const graphics = this.add.graphics();

    // Draw grid background
    graphics.fillStyle(0xffffff, 1);
    graphics.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

    // Draw diagonal line dividing territories (\ shape: top-left to bottom-right)
    graphics.lineStyle(3, 0x000000, 1);
    graphics.beginPath();
    graphics.moveTo(0, 0);
    graphics.lineTo(MAP_SIZE, MAP_SIZE);
    graphics.strokePath();

    // Draw red territory (top-right triangle, above the \ diagonal)
    // Triangle vertices: (0,0), (MAP_SIZE,0), (MAP_SIZE,MAP_SIZE)
    // This area satisfies: y <= x
    graphics.fillStyle(0xff0000, 0.1);
    graphics.beginPath();
    graphics.moveTo(0, 0);
    graphics.lineTo(MAP_SIZE, 0);
    graphics.lineTo(MAP_SIZE, MAP_SIZE);
    graphics.closePath();
    graphics.fillPath();

    // Draw blue territory (bottom-left triangle, below the \ diagonal)
    // Triangle vertices: (0,0), (0,MAP_SIZE), (MAP_SIZE,MAP_SIZE)
    // This area satisfies: y >= x
    graphics.fillStyle(0x0000ff, 0.1);
    graphics.beginPath();
    graphics.moveTo(0, 0);
    graphics.lineTo(0, MAP_SIZE);
    graphics.lineTo(MAP_SIZE, MAP_SIZE);
    graphics.closePath();
    graphics.fillPath();

    // Border
    graphics.lineStyle(2, 0x000000, 1);
    graphics.strokeRect(0, 0, MAP_SIZE, MAP_SIZE);
  }

  private setupRoomHandlers() {
    if (!this.room) return;

    this.currentPlayer = this.room.sessionId;
    console.log('Setting up room handlers, sessionId:', this.currentPlayer);

    // Listen for state changes - this is the main way to get updates
    this.room.onStateChange((state) => {
      console.log('State change, phase:', state.phase, 'players:', state.players?.size);

      // Setup collection listeners on first state change
      if (!this.listenersSetup) {
        this.setupCollectionListeners(state);
      }

      // Sync players from state (create missing, update existing)
      this.syncPlayersFromState(state);
    });

    this.room.onMessage('gameEnded', (message) => {
      this.showGameOver(message.winner);
    });
  }

  private setupCollectionListeners(state: any) {
    if (!state.players || typeof state.players.onAdd !== 'function') {
      console.log('Collection listeners not available yet');
      return;
    }

    this.listenersSetup = true;
    console.log('Setting up collection listeners');

    state.players.onAdd((player: any, sessionId: string) => {
      console.log('Player added:', sessionId);
      this.createPlayer(sessionId, player);
      if (typeof player.onChange === 'function') {
        player.onChange(() => this.updatePlayer(sessionId, player));
      }
    });

    state.players.onRemove((player: any, sessionId: string) => {
      console.log('Player removed:', sessionId);
      this.removePlayer(sessionId);
    });

    state.snowballs.onAdd((snowball: any, id: string) => {
      this.createSnowball(id, snowball);
      if (typeof snowball.onChange === 'function') {
        snowball.onChange(() => this.updateSnowball(id, snowball));
      }
    });

    state.snowballs.onRemove((snowball: any, id: string) => {
      this.removeSnowball(id, snowball);
    });
  }

  private syncPlayersFromState(state: any) {
    if (!state.players) return;

    // Create players that exist in state but not locally
    state.players.forEach((player: any, sessionId: string) => {
      if (!this.players.has(sessionId)) {
        console.log('Syncing player:', sessionId, 'at', player.x, player.y);
        this.createPlayer(sessionId, player);
      } else {
        // Update existing player position
        this.updatePlayer(sessionId, player);
      }
    });

    // Sync snowballs
    state.snowballs.forEach((snowball: any, id: string) => {
      if (!this.snowballs.has(id)) {
        this.createSnowball(id, snowball);
      } else {
        this.updateSnowball(id, snowball);
      }
    });

    // 상태에 없는 눈덩이 제거 (onRemove가 호출되지 않는 경우 대비)
    const stateSnowballIds = new Set<string>();
    state.snowballs.forEach((_: any, id: string) => {
      stateSnowballIds.add(id);
    });

    this.snowballs.forEach((_, id) => {
      if (!stateSnowballIds.has(id) && !this.fadingSnowballs.has(id)) {
        this.removeSnowball(id);
      }
    });
  }

  private createPlayer(sessionId: string, player: any) {
    console.log('Creating player:', sessionId, 'team:', player.team, 'pos:', player.x, player.y);

    // Create graphics container for player
    const graphics = this.add.graphics();
    this.players.set(sessionId, graphics);

    // Create player label
    const label = this.add.text(player.x, player.y - 25, player.nickname || 'Player', {
      fontSize: '12px',
      color: '#000000',
      backgroundColor: '#ffffff',
      padding: { x: 4, y: 2 }
    }).setOrigin(0.5);
    this.playerLabels.set(sessionId, label);

    // Create energy bar
    const energyBar = this.add.graphics();
    this.energyBars.set(sessionId, energyBar);

    // Draw player at current position
    this.drawPlayer(sessionId, player);
  }

  private drawPlayer(sessionId: string, player: any) {
    const graphics = this.players.get(sessionId);
    if (!graphics) return;

    const isCurrentPlayer = sessionId === this.currentPlayer;
    const color = player.team === 'red' ? 0xff0000 : 0x0000ff;
    const isBot = player.isBot;
    const x = player.x;
    const y = player.y;

    // Clear previous drawing
    graphics.clear();

    // Set alpha for stunned players
    graphics.setAlpha(player.isStunned ? 0.3 : 1);

    // Draw player circle at world position
    graphics.fillStyle(color, 1);
    graphics.fillCircle(x, y, 15);

    // Draw border
    if (isCurrentPlayer) {
      graphics.lineStyle(3, 0xffff00, 1);
      graphics.strokeCircle(x, y, 15);
    } else if (isBot) {
      graphics.lineStyle(2, 0x888888, 1);
      graphics.strokeCircle(x, y, 15);
    } else {
      graphics.lineStyle(2, 0x000000, 0.5);
      graphics.strokeCircle(x, y, 15);
    }
  }

  private updatePlayer(sessionId: string, player: any) {
    // Redraw player at new position
    this.drawPlayer(sessionId, player);

    // Update label position
    const label = this.playerLabels.get(sessionId);
    if (label) {
      label.setPosition(player.x, player.y - 25);
    }

    // Update energy bar
    const energyBar = this.energyBars.get(sessionId);
    if (energyBar) {
      energyBar.clear();

      const barWidth = 30;
      const barHeight = 4;
      // 기절한 플레이어는 체력바 0으로 표시
      const energyPercent = player.isStunned ? 0 : Math.max(0, player.energy / 10);

      // Background
      energyBar.fillStyle(0x000000, 0.5);
      energyBar.fillRect(player.x - barWidth / 2, player.y - 35, barWidth, barHeight);

      // Energy fill (기절 시 표시 안함)
      if (energyPercent > 0) {
        const energyColor = energyPercent > 0.5 ? 0x00ff00 : energyPercent > 0.25 ? 0xffff00 : 0xff0000;
        energyBar.fillStyle(energyColor, 1);
        energyBar.fillRect(player.x - barWidth / 2, player.y - 35, barWidth * energyPercent, barHeight);
      }
    }
  }

  private removePlayer(sessionId: string) {
    const graphics = this.players.get(sessionId);
    const label = this.playerLabels.get(sessionId);
    const energyBar = this.energyBars.get(sessionId);

    if (graphics) {
      graphics.destroy();
      this.players.delete(sessionId);
    }

    if (label) {
      label.destroy();
      this.playerLabels.delete(sessionId);
    }

    if (energyBar) {
      energyBar.destroy();
      this.energyBars.delete(sessionId);
    }
  }

  private createSnowball(id: string, snowball: any) {
    const graphics = this.add.graphics();
    this.snowballs.set(id, graphics);
    this.drawSnowball(id, snowball);
  }

  private drawSnowball(id: string, snowball: any) {
    const graphics = this.snowballs.get(id);
    if (!graphics) return;

    // 페이딩 중인 눈덩이는 다시 그리지 않음
    if (this.fadingSnowballs.has(id)) return;

    // 위치 저장 (제거 시 파편 효과용)
    this.snowballPositions.set(id, { x: snowball.x, y: snowball.y, team: snowball.team });

    const color = snowball.team === 'red' ? 0xff0000 : 0x0000ff;

    // Size based on damage (normal=4, charged=7)
    // Normal: radius 5, Charged: radius 9
    const isCharged = snowball.damage >= 7;
    const radius = isCharged ? 9 : 5;

    graphics.clear();
    graphics.fillStyle(color, 0.8);
    graphics.fillCircle(snowball.x, snowball.y, radius);

    // Add white outline for visibility
    graphics.lineStyle(isCharged ? 2 : 1, 0xffffff, 0.8);
    graphics.strokeCircle(snowball.x, snowball.y, radius);
  }

  private updateSnowball(id: string, snowball: any) {
    this.drawSnowball(id, snowball);
  }

  private removeSnowball(id: string, snowball?: any) {
    const graphics = this.snowballs.get(id);
    if (graphics) {
      // 눈덩이 위치와 팀 정보 (저장된 위치 또는 snowball 객체에서)
      const storedPos = this.snowballPositions.get(id);
      const x = snowball?.x ?? storedPos?.x ?? 0;
      const y = snowball?.y ?? storedPos?.y ?? 0;
      const team = snowball?.team ?? storedPos?.team ?? 'red';

      // 원본 눈덩이 즉시 제거
      this.fadingSnowballs.delete(id);
      this.snowballs.delete(id);
      this.snowballPositions.delete(id);
      graphics.destroy();

      // 파편 효과 생성
      this.createDebrisEffect(x, y, team);
    }
  }

  private createDebrisEffect(x: number, y: number, team: string) {
    const color = team === 'red' ? 0xff6666 : 0x6666ff;
    const numParticles = 6;

    for (let i = 0; i < numParticles; i++) {
      const particle = this.add.graphics();
      particle.fillStyle(color, 1);
      particle.fillCircle(0, 0, 2 + Math.random() * 2);
      particle.setPosition(x, y);

      // 방사형으로 퍼지는 방향
      const angle = (Math.PI * 2 * i) / numParticles + Math.random() * 0.3;
      const distance = 15 + Math.random() * 15;
      const targetX = x + Math.cos(angle) * distance;
      const targetY = y + Math.sin(angle) * distance;

      // 파편 애니메이션
      this.tweens.add({
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

  private updateChargeGauge(time: number) {
    if (!this.chargeGauge) return;

    const chargeTime = time - this.chargeStartTime;
    const chargeLevel = Math.min(chargeTime / 1000, 1);

    this.chargeGauge.clear();

    const gaugeX = 10;
    const gaugeY = MAP_SIZE - 40;
    const gaugeWidth = 100;
    const gaugeHeight = 20;

    this.chargeGauge.fillStyle(0x000000, 0.5);
    this.chargeGauge.fillRect(gaugeX, gaugeY, gaugeWidth, gaugeHeight);

    const color = chargeLevel >= 0.7 ? 0xff0000 : 0xffff00;
    this.chargeGauge.fillStyle(color, 1);
    this.chargeGauge.fillRect(gaugeX, gaugeY, gaugeWidth * chargeLevel, gaugeHeight);

    this.chargeGauge.lineStyle(2, 0x000000, 1);
    this.chargeGauge.strokeRect(gaugeX, gaugeY, gaugeWidth, gaugeHeight);
  }

  private showGameOver(winner: string) {
    const centerX = MAP_SIZE / 2;
    const centerY = MAP_SIZE / 2;

    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.7);
    bg.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

    let message = '';
    let color = '#ffffff';

    if (winner === 'draw') {
      message = 'Draw!';
    } else {
      const winnerTeam = winner === 'red' ? 'Red' : 'Blue';
      color = winner === 'red' ? '#ff0000' : '#0000ff';
      message = `${winnerTeam} Team Wins!`;
    }

    this.add.text(centerX, centerY, message, {
      fontSize: '48px',
      color: color,
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(centerX, centerY + 60, 'Returning to main menu...', {
      fontSize: '24px',
      color: '#ffffff'
    }).setOrigin(0.5);

    // Leave current room
    if (this.room) {
      this.room.leave();
    }

    // Return to main menu after 5 seconds
    this.time.delayedCall(5000, () => {
      this.scene.start('MainMenuScene');
    });
  }
}
