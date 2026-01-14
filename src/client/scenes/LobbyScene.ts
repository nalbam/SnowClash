import Phaser from 'phaser';
import { Room } from 'colyseus.js';
import { generateCharacterTextures, createCharacterAnimations } from '../assets/PixelCharacter';
import { MAP_SIZE } from '../../shared/constants';

export class LobbyScene extends Phaser.Scene {
  private room?: Room;
  private nickname: string = '';
  private isReady: boolean = false;
  private listenersSetup: boolean = false;
  private redZone?: Phaser.GameObjects.Graphics;
  private blueZone?: Phaser.GameObjects.Graphics;
  private playerSprites: Map<string, Phaser.GameObjects.Container> = new Map();

  constructor() {
    super({ key: 'LobbyScene' });
  }

  init(data: any) {
    this.room = data.room;
    this.nickname = data.nickname || 'Player';
    this.listenersSetup = false;
    this.playerSprites.clear();
  }

  create() {
    // Match game scene color scheme
    this.cameras.main.setBackgroundColor('#e8f4f8');

    // Generate pixel art textures
    generateCharacterTextures(this);
    createCharacterAnimations(this);

    this.createUI();
    this.setupRoomHandlers();
  }

  private createUI() {
    const centerX = MAP_SIZE / 2;

    // Title and room name at top
    this.add.text(centerX, 20, 'Game Lobby', {
      fontSize: '24px',
      color: '#333333',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const roomName = (this.room?.state as any)?.roomName || 'Game Room';
    this.add.text(centerX, 50, roomName, {
      fontSize: '14px',
      color: '#666666'
    }).setOrigin(0.5);

    // Back button
    const backBtn = this.add.text(20, 20, '< Back', {
      fontSize: '14px',
      color: '#666666'
    }).setInteractive({ useHandCursor: true });

    backBtn.on('pointerdown', () => this.leaveRoom());
    backBtn.on('pointerover', () => backBtn.setColor('#000000'));
    backBtn.on('pointerout', () => backBtn.setColor('#666666'));

    // Draw team zones (diagonal split like game map)
    this.drawTeamZones();

    // Team labels (positioned in their zones)
    this.add.text(480, 150, 'RED', {
      fontSize: '28px',
      color: '#ff0000',
      fontStyle: 'bold'
    }).setOrigin(0.5).setAlpha(0.4);

    this.add.text(120, 450, 'BLUE', {
      fontSize: '28px',
      color: '#0000ff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setAlpha(0.4);

    // Click instruction
    this.add.text(centerX, 300, 'Click area to change team', {
      fontSize: '11px',
      color: '#555555',
      backgroundColor: '#ffffffcc',
      padding: { x: 8, y: 4 }
    }).setOrigin(0.5);

    // Bottom UI panel
    const panelY = MAP_SIZE - 60;

    // Ready button
    const readyButton = this.add.text(centerX - 100, panelY, 'Ready', {
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#006600',
      padding: { x: 20, y: 8 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    readyButton.on('pointerdown', () => this.toggleReady());

    // Start button (host only, hidden by default)
    const startButton = this.add.text(centerX + 100, panelY, 'Start', {
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#ff8800',
      padding: { x: 20, y: 8 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setVisible(false);

    startButton.on('pointerdown', () => this.startGame());

    // Store references
    this.data.set('readyButton', readyButton);
    this.data.set('startButton', startButton);
  }

  private drawTeamZones() {
    const topY = 70;      // Top margin for title
    const bottomY = 530;  // Bottom margin for buttons (600 - 70)
    const height = bottomY - topY;  // 460px available height

    // Red zone (top-right triangle)
    // Diagonal goes from top-left (0, topY) to bottom-right (width, bottomY)
    this.redZone = this.add.graphics();
    this.redZone.fillStyle(0xff0000, 0.1);
    this.redZone.beginPath();
    this.redZone.moveTo(0, topY);           // Top-left corner
    this.redZone.lineTo(MAP_SIZE, topY);    // Top-right corner
    this.redZone.lineTo(MAP_SIZE, bottomY); // Bottom-right corner
    this.redZone.lineTo(0, topY);           // Back to top-left (diagonal)
    this.redZone.closePath();
    this.redZone.fillPath();

    // Blue zone (bottom-left triangle)
    this.blueZone = this.add.graphics();
    this.blueZone.fillStyle(0x0000ff, 0.1);
    this.blueZone.beginPath();
    this.blueZone.moveTo(0, topY);          // Top-left corner (diagonal start)
    this.blueZone.lineTo(MAP_SIZE, bottomY); // Bottom-right corner (diagonal end)
    this.blueZone.lineTo(0, bottomY);       // Bottom-left corner
    this.blueZone.closePath();
    this.blueZone.fillPath();

    // Diagonal line
    const line = this.add.graphics();
    line.lineStyle(2, 0xffffff, 0.5);
    line.beginPath();
    line.moveTo(0, topY);
    line.lineTo(MAP_SIZE, bottomY);
    line.strokePath();

    // Make zones clickable
    // Red zone: upper-right area
    const redHitArea = this.add.zone(MAP_SIZE * 0.65, topY + height * 0.35, MAP_SIZE * 0.6, height * 0.5);
    redHitArea.setInteractive({ useHandCursor: true });
    redHitArea.on('pointerdown', () => this.selectTeam('red'));

    // Blue zone: lower-left area
    const blueHitArea = this.add.zone(MAP_SIZE * 0.35, topY + height * 0.65, MAP_SIZE * 0.6, height * 0.5);
    blueHitArea.setInteractive({ useHandCursor: true });
    blueHitArea.on('pointerdown', () => this.selectTeam('blue'));
  }

  private setupRoomHandlers() {
    if (!this.room) return;

    this.room.onStateChange((state) => {
      if (!this.scene.isActive('LobbyScene')) return;

      if (!this.listenersSetup && state.players && typeof state.players.onAdd === 'function') {
        this.listenersSetup = true;

        // Sync existing players first
        state.players.forEach((player: any, sessionId: string) => {
          this.updatePlayerSprite(sessionId, player);
          if (typeof player.onChange === 'function') {
            player.onChange(() => {
              if (this.scene.isActive('LobbyScene')) {
                this.updatePlayers();
              }
            });
          }
        });

        state.players.onAdd((player: any, sessionId: string) => {
          if (!this.scene.isActive('LobbyScene')) return;
          this.updatePlayers();
          player.onChange(() => {
            if (this.scene.isActive('LobbyScene')) {
              this.updatePlayers();
            }
          });
        });

        state.players.onRemove((player: any, sessionId: string) => {
          if (!this.scene.isActive('LobbyScene')) return;
          this.removePlayerSprite(sessionId);
          this.updatePlayers();
        });
      }

      this.updatePlayers();

      if (state.phase === 'playing') {
        this.scene.start('GameScene', { room: this.room });
      }
    });

    this.room.onMessage('error', (message) => {
      console.error('Server error:', message);
    });

    // Force initial sync after a short delay
    this.time.delayedCall(100, () => {
      if (this.room?.state) {
        const state = this.room.state as any;
        if (state.players) {
          state.players.forEach((player: any, sessionId: string) => {
            this.updatePlayerSprite(sessionId, player);
          });
        }
      }
    });
  }

  private updatePlayers() {
    if (!this.scene.isActive('LobbyScene')) return;
    if (!this.room || !this.room.state) return;

    const state = this.room.state as any;
    if (!state.players) return;

    // Update player positions based on team
    state.players.forEach((player: any, sessionId: string) => {
      this.updatePlayerSprite(sessionId, player);
    });

    this.updateButtonStyles();
  }

  private updatePlayerSprite(sessionId: string, player: any) {
    let container = this.playerSprites.get(sessionId);
    const team = player.team || 'red';
    const textureKey = `character_${team}_idle`;

    if (!container) {
      // Create new player container
      container = this.add.container(0, 0);

      // Create pixel art sprite
      const sprite = this.add.sprite(0, 0, textureKey);
      sprite.setScale(1.2); // Slightly larger for lobby visibility
      container.add(sprite);
      container.setData('sprite', sprite);

      // Create indicator ring
      const indicator = this.add.graphics();
      container.add(indicator);
      container.setData('indicator', indicator);

      // Create name text
      const nameText = this.add.text(0, -35, player.nickname, {
        fontSize: '10px',
        color: '#000000',
        backgroundColor: '#ffffffcc',
        padding: { x: 3, y: 1 }
      }).setOrigin(0.5);
      container.add(nameText);
      container.setData('nameText', nameText);

      this.playerSprites.set(sessionId, container);
    }

    // Update position based on team
    const isCurrentPlayer = sessionId === this.room?.sessionId;
    let x: number, y: number;

    if (player.team === 'red') {
      // Red zone: triangle (0,70)-(600,70)-(600,530), centroid ~(400, 223)
      // Arrange parallel to diagonal from (0,70) to (600,530)
      const index = this.getTeamPlayerIndex(sessionId, 'red');
      x = 320 + index * 80;
      y = 143 + index * 80;
    } else if (player.team === 'blue') {
      // Blue zone: triangle (0,70)-(0,530)-(600,530), centroid ~(200, 377)
      // Arrange parallel to diagonal from (0,70) to (600,530)
      const index = this.getTeamPlayerIndex(sessionId, 'blue');
      x = 120 + index * 80;
      y = 297 + index * 80;
    } else {
      // No team - position along center diagonal
      const index = this.getNoTeamPlayerIndex(sessionId);
      x = 220 + index * 80;
      y = 220 + index * 80;
    }

    container.setPosition(x, y);

    // Update sprite texture based on team
    const sprite = container.getData('sprite') as Phaser.GameObjects.Sprite;
    const newTextureKey = player.team ? `character_${player.team}_idle` : 'character_red_idle';

    if (sprite.texture.key !== newTextureKey) {
      sprite.setTexture(newTextureKey);
    }

    // Update indicator
    const indicator = container.getData('indicator') as Phaser.GameObjects.Graphics;
    indicator.clear();

    if (isCurrentPlayer) {
      // Yellow ring for current player
      indicator.lineStyle(3, 0xffff00, 1);
      indicator.strokeCircle(0, 0, 22);
    } else if (player.isReady) {
      // Green ring for ready players
      indicator.lineStyle(2, 0x00ff00, 1);
      indicator.strokeCircle(0, 0, 20);
    }

    // Update name with status
    const nameText = container.getData('nameText') as Phaser.GameObjects.Text;
    const readyIcon = player.isReady ? ' ✓' : '';
    nameText.setText(`${player.nickname}${readyIcon}`);
    nameText.setColor(isCurrentPlayer ? '#cc8800' : '#000000');

    // Draw crown for host
    let crown = container.getData('crown') as Phaser.GameObjects.Text;
    if (player.isHost) {
      if (!crown) {
        crown = this.add.text(0, -50, '👑', {
          fontSize: '16px'
        }).setOrigin(0.5);
        container.add(crown);
        container.setData('crown', crown);
      }
      crown.setVisible(true);
    } else if (crown) {
      crown.setVisible(false);
    }

    // Add bouncing animation for ready players
    if (player.isReady && !sprite.getData('bouncing')) {
      sprite.setData('bouncing', true);
      this.tweens.add({
        targets: sprite,
        y: -5,
        duration: 500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    } else if (!player.isReady && sprite.getData('bouncing')) {
      sprite.setData('bouncing', false);
      this.tweens.killTweensOf(sprite);
      sprite.setY(0);
    }
  }

  private getTeamPlayerIndex(sessionId: string, team: string): number {
    if (!this.room?.state) return 0;
    const state = this.room.state as any;
    const entries = Array.from(state.players.entries()) as [string, any][];
    const teamPlayers = entries
      .filter(([_, p]) => p.team === team)
      .map(([id, _]) => id);
    return teamPlayers.indexOf(sessionId);
  }

  private getNoTeamPlayerIndex(sessionId: string): number {
    if (!this.room?.state) return 0;
    const state = this.room.state as any;
    const entries = Array.from(state.players.entries()) as [string, any][];
    const noTeamPlayers = entries
      .filter(([_, p]) => !p.team)
      .map(([id, _]) => id);
    return noTeamPlayers.indexOf(sessionId);
  }

  private removePlayerSprite(sessionId: string) {
    const container = this.playerSprites.get(sessionId);
    if (container) {
      const sprite = container.getData('sprite') as Phaser.GameObjects.Sprite;
      if (sprite) {
        this.tweens.killTweensOf(sprite);
      }
      container.destroy();
      this.playerSprites.delete(sessionId);
    }
  }

  private updateButtonStyles() {
    if (!this.scene.isActive('LobbyScene')) return;
    if (!this.room?.state) return;

    const state = this.room.state as any;
    const currentPlayer = state.players?.get(this.room.sessionId);
    if (!currentPlayer) return;

    const readyButton = this.data.get('readyButton') as Phaser.GameObjects.Text;
    const startButton = this.data.get('startButton') as Phaser.GameObjects.Text;

    if (currentPlayer.isReady) {
      readyButton.setText('Not Ready');
      readyButton.setStyle({ backgroundColor: '#00aa00', fontStyle: 'bold' });
    } else {
      readyButton.setText('Ready');
      readyButton.setStyle({ backgroundColor: '#006600', fontStyle: 'normal' });
    }

    // Show start button only for host
    if (startButton) {
      startButton.setVisible(currentPlayer.isHost);
    }
  }

  private selectTeam(team: string) {
    if (!this.room) return;
    this.room.send('selectTeam', { team });
  }

  private toggleReady() {
    if (!this.room?.state) return;

    const state = this.room.state as any;
    const currentPlayer = state.players?.get(this.room.sessionId);
    if (!currentPlayer || !currentPlayer.team) {
      console.log('Please select a team first');
      return;
    }

    this.isReady = !this.isReady;
    this.room.send('ready', { ready: this.isReady });
  }

  private startGame() {
    if (!this.room) return;
    this.room.send('startGame', {});
  }

  private leaveRoom() {
    if (this.room) {
      this.room.leave();
    }
    this.scene.start('MainMenuScene');
  }
}
