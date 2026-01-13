import Phaser from 'phaser';
import { Room } from 'colyseus.js';

const MAP_SIZE = 800;

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
  };
  private chargeStartTime: number = 0;
  private isCharging: boolean = false;
  private chargeGauge?: Phaser.GameObjects.Graphics;
  private listenersSetup: boolean = false;

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
  }

  create() {
    this.cameras.main.setBackgroundColor('#e8f4f8');

    // Draw the map
    this.drawMap();

    // Setup input
    if (this.input.keyboard) {
      this.keys = {
        up: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        down: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        space: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      };

      // Also support arrow keys
      this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP).on('down', () => {
        if (this.keys) this.keys.up.isDown = true;
      });
      this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN).on('down', () => {
        if (this.keys) this.keys.down.isDown = true;
      });
      this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT).on('down', () => {
        if (this.keys) this.keys.left.isDown = true;
      });
      this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT).on('down', () => {
        if (this.keys) this.keys.right.isDown = true;
      });
    }

    // Setup room state listeners
    this.setupRoomHandlers();

    // Create charge gauge
    this.chargeGauge = this.add.graphics();
  }

  update(time: number, delta: number) {
    if (!this.room || !this.keys) return;

    // Handle movement
    let moveX = 0;
    let moveY = 0;

    if (this.keys.up.isDown) moveY = -1;
    if (this.keys.down.isDown) moveY = 1;
    if (this.keys.left.isDown) moveX = -1;
    if (this.keys.right.isDown) moveX = 1;

    if (moveX !== 0 || moveY !== 0) {
      this.room.send('move', { x: moveX, y: moveY });
    }

    // Handle snowball throwing with charge
    if (this.keys.space.isDown) {
      if (!this.isCharging) {
        this.isCharging = true;
        this.chargeStartTime = time;
      }
      this.updateChargeGauge(time);
    } else if (this.isCharging) {
      // Release snowball
      const chargeTime = time - this.chargeStartTime;
      const chargeLevel = Math.min(chargeTime / 1000, 1); // Max 1 second charge
      this.room.send('throwSnowball', { chargeLevel });
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

    this.room.onStateChange((state) => {
      // Setup collection listeners on first state sync
      if (!this.listenersSetup && state.players && typeof state.players.onAdd === 'function') {
        this.listenersSetup = true;

        // Add existing players
        state.players.forEach((player: any, sessionId: string) => {
          if (!this.players.has(sessionId)) {
            this.createPlayer(sessionId, player);
          }
        });

        state.players.onAdd((player: any, sessionId: string) => {
          this.createPlayer(sessionId, player);

          player.onChange(() => {
            this.updatePlayer(sessionId, player);
          });
        });

        state.players.onRemove((player: any, sessionId: string) => {
          this.removePlayer(sessionId);
        });

        state.snowballs.onAdd((snowball: any, id: string) => {
          this.createSnowball(id, snowball);

          snowball.onChange(() => {
            this.updateSnowball(id, snowball);
          });
        });

        state.snowballs.onRemove((snowball: any, id: string) => {
          this.removeSnowball(id);
        });
      }
    });

    this.room.onMessage('gameEnded', (message) => {
      this.showGameOver(message.winner);
    });
  }

  private createPlayer(sessionId: string, player: any) {
    const isCurrentPlayer = sessionId === this.currentPlayer;
    const color = player.team === 'red' ? 0xff0000 : 0x0000ff;
    const isBot = player.isBot;

    // Create player circle
    const graphics = this.add.graphics();
    graphics.fillStyle(color, 1);
    graphics.fillCircle(0, 0, 15);

    if (isCurrentPlayer) {
      graphics.lineStyle(2, 0xffff00, 1);
      graphics.strokeCircle(0, 0, 15);
    } else if (isBot) {
      // Bot players have gray dashed border
      graphics.lineStyle(2, 0x888888, 1);
      graphics.strokeCircle(0, 0, 15);
    }

    this.players.set(sessionId, graphics);

    // Create player label
    const label = this.add.text(0, -25, player.nickname || 'Player', {
      fontSize: '12px',
      color: '#000000',
      backgroundColor: '#ffffff',
      padding: { x: 4, y: 2 }
    }).setOrigin(0.5);
    this.playerLabels.set(sessionId, label);

    // Create energy bar
    const energyBar = this.add.graphics();
    this.energyBars.set(sessionId, energyBar);

    this.updatePlayer(sessionId, player);
  }

  private updatePlayer(sessionId: string, player: any) {
    const graphics = this.players.get(sessionId);
    const label = this.playerLabels.get(sessionId);
    const energyBar = this.energyBars.get(sessionId);

    if (graphics) {
      graphics.setPosition(player.x, player.y);
      
      // Update opacity if stunned
      graphics.setAlpha(player.isStunned ? 0.3 : 1);
    }

    if (label) {
      label.setPosition(player.x, player.y - 25);
    }

    if (energyBar) {
      energyBar.clear();
      
      // Draw energy bar
      const barWidth = 30;
      const barHeight = 4;
      const energyPercent = player.energy / 10;
      
      energyBar.fillStyle(0x000000, 0.5);
      energyBar.fillRect(player.x - barWidth / 2, player.y - 35, barWidth, barHeight);
      
      const energyColor = energyPercent > 0.5 ? 0x00ff00 : energyPercent > 0.25 ? 0xffff00 : 0xff0000;
      energyBar.fillStyle(energyColor, 1);
      energyBar.fillRect(player.x - barWidth / 2, player.y - 35, barWidth * energyPercent, barHeight);
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
    const color = snowball.team === 'red' ? 0xff0000 : 0x0000ff;
    
    graphics.fillStyle(color, 0.8);
    graphics.fillCircle(0, 0, 5);
    
    this.snowballs.set(id, graphics);
    this.updateSnowball(id, snowball);
  }

  private updateSnowball(id: string, snowball: any) {
    const graphics = this.snowballs.get(id);
    if (graphics) {
      graphics.setPosition(snowball.x, snowball.y);
    }
  }

  private removeSnowball(id: string) {
    const graphics = this.snowballs.get(id);
    if (graphics) {
      graphics.destroy();
      this.snowballs.delete(id);
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
