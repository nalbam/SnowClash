import Phaser from 'phaser';
import { Room } from 'colyseus.js';
import { generateCharacterTextures, createCharacterAnimations } from '../assets/PixelCharacter';
import { generateEnvironmentTextures, createEnvironmentDecorations } from '../assets/EnvironmentAssets';
import {
  MAP_SIZE,
  PLAYABLE_AREA_BOTTOM,
  PLAYER_SPACING,
  UI_BORDER_MARGIN
} from '../../shared/constants';

export class LobbyScene extends Phaser.Scene {
  private room?: Room;
  private nickname: string = '';
  private isReady: boolean = false;
  private listenersSetup: boolean = false;
  private redZone?: Phaser.GameObjects.Graphics;
  private blueZone?: Phaser.GameObjects.Graphics;
  private playerSprites: Map<string, Phaser.GameObjects.Container> = new Map();
  private ghostBots: Map<string, Phaser.GameObjects.Container> = new Map();
  private myTeam?: string;
  private teamLabels?: { red: Phaser.GameObjects.Text; blue: Phaser.GameObjects.Text };

  constructor() {
    super({ key: 'LobbyScene' });
  }

  preload() {
    // Load button sound effects
    this.load.audio('hover', 'sounds/hover.mp3');
    this.load.audio('click', 'sounds/click.mp3');
  }

  /**
   * Convert server coordinates to view coordinates
   * Red team sees the map rotated 180 degrees
   */
  private toViewCoords(x: number, y: number): { x: number; y: number } {
    if (this.myTeam === 'red') {
      return { x: MAP_SIZE - x, y: MAP_SIZE - y };
    }
    return { x, y };
  }

  /**
   * Convert view coordinates to server coordinates
   */
  private toServerCoords(x: number, y: number): { x: number; y: number } {
    if (this.myTeam === 'red') {
      return { x: MAP_SIZE - x, y: MAP_SIZE - y };
    }
    return { x, y };
  }

  init(data: any) {
    this.room = data.room;
    this.nickname = data.nickname || 'Player';
    this.listenersSetup = false;
    this.playerSprites.clear();
    this.ghostBots.clear();
    this.myTeam = undefined;
    this.teamLabels = undefined;
  }

  create() {
    // Match game scene color scheme
    this.cameras.main.setBackgroundColor('#e8f4f8');

    // Generate pixel art textures
    generateCharacterTextures(this);
    createCharacterAnimations(this);
    generateEnvironmentTextures(this);

    // Add environment decorations - behind all UI elements
    createEnvironmentDecorations(this, MAP_SIZE);

    this.createUI();
    this.setupRoomHandlers();
  }

  private createUI() {
    const centerX = MAP_SIZE / 2;

    // Title and room name at top (inside border margin)
    this.add.text(centerX, UI_BORDER_MARGIN + 5, 'Game Lobby', {
      fontSize: '24px',
      color: '#333333',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const roomName = (this.room?.state as any)?.roomName || 'Game Room';
    this.add.text(centerX, UI_BORDER_MARGIN + 30, roomName, {
      fontSize: '14px',
      color: '#666666'
    }).setOrigin(0.5);

    // Back button (inside border margin, high depth to be above playableArea zone)
    const backBtn = this.add.text(UI_BORDER_MARGIN, UI_BORDER_MARGIN + 5, '< Back', {
      fontSize: '14px',
      color: '#666666',
      backgroundColor: '#ffffffcc',
      padding: { x: 8, y: 4 }
    }).setInteractive({ useHandCursor: true }).setDepth(100);

    backBtn.on('pointerdown', () => { this.sound.play('click', { volume: 0.3 }); this.leaveRoom(); });
    backBtn.on('pointerover', () => { this.sound.play('hover', { volume: 0.2 }); backBtn.setStyle({ color: '#000000', backgroundColor: '#ffffff' }); });
    backBtn.on('pointerout', () => backBtn.setStyle({ color: '#666666', backgroundColor: '#ffffffcc' }));

    // Initialize graphics objects (but don't draw zones yet - wait for team info)
    this.redZone = this.add.graphics();
    this.blueZone = this.add.graphics();
    this.redZone.setDepth(-100);
    this.blueZone.setDepth(-100);

    // Draw diagonal line (full map, same as GameScene)
    const line = this.add.graphics();
    line.lineStyle(2, 0xffffff, 0.5);
    line.beginPath();
    line.moveTo(0, 0);
    line.lineTo(MAP_SIZE, MAP_SIZE);
    line.strokePath();

    // Make entire map clickable for team selection
    const playableArea = this.add.zone(MAP_SIZE / 2, MAP_SIZE / 2, MAP_SIZE, MAP_SIZE);
    playableArea.setInteractive({ useHandCursor: true });
    playableArea.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.sound.play('click', { volume: 0.3 });
      this.handleTeamClick(pointer.x, pointer.y);
    });

    // Team labels (positioned in their zones) - will be updated by updateTeamUI()
    const redLabel = this.add.text(MAP_SIZE * 0.8, MAP_SIZE * 0.25, '', {
      fontSize: '28px',
      color: '#ff0000',
      fontStyle: 'bold'
    }).setOrigin(0.5).setAlpha(0.4);

    const blueLabel = this.add.text(MAP_SIZE * 0.2, MAP_SIZE * 0.75, '', {
      fontSize: '28px',
      color: '#0000ff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setAlpha(0.4);

    this.teamLabels = { red: redLabel, blue: blueLabel };

    // Click instruction
    this.add.text(centerX, MAP_SIZE * 0.5, 'Click area to change team', {
      fontSize: '11px',
      color: '#555555',
      backgroundColor: '#ffffffcc',
      padding: { x: 8, y: 4 }
    }).setOrigin(0.5);

    // Bottom UI panel
    const panelY = PLAYABLE_AREA_BOTTOM - 10;

    // Ready button
    const readyButton = this.add.text(centerX - 100, panelY, 'Ready', {
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#006600',
      padding: { x: 20, y: 8 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    readyButton.on('pointerdown', () => { this.sound.play('click', { volume: 0.3 }); this.toggleReady(); });
    readyButton.on('pointerover', () => { this.sound.play('hover', { volume: 0.2 }); });

    // Start button (host only, hidden by default)
    const startButton = this.add.text(centerX + 100, panelY, 'Start', {
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#ff8800',
      padding: { x: 20, y: 8 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setVisible(false);

    startButton.on('pointerdown', () => { this.sound.play('click', { volume: 0.3 }); this.startGame(); });
    startButton.on('pointerover', () => { this.sound.play('hover', { volume: 0.2 }); });

    // Store references
    this.data.set('readyButton', readyButton);
    this.data.set('startButton', startButton);

    // Create ghost bot slots (3 per team)
    this.createGhostBots();
  }

  /**
   * Create ghost bot placeholders for empty slots
   */
  private createGhostBots(): void {
    const teams = ['red', 'blue'];
    const slotsPerTeam = 3;

    teams.forEach(team => {
      for (let i = 0; i < slotsPerTeam; i++) {
        const ghostId = `ghost_${team}_${i}`;
        const container = this.add.container(0, 0);

        // Create ghost sprite (semi-transparent)
        const sprite = this.add.sprite(0, 0, `character_${team}_idle`);
        sprite.setScale(1.2);
        sprite.setAlpha(0.3);
        container.add(sprite);

        // Create "BOT" label
        const label = this.add.text(0, -35, '[BOT]', {
          fontSize: '9px',
          color: '#888888',
          backgroundColor: '#ffffff88',
          padding: { x: 3, y: 1 }
        }).setOrigin(0.5);
        container.add(label);

        container.setVisible(false);
        container.setDepth(-5);
        this.ghostBots.set(ghostId, container);
      }
    });
  }


  /**
   * Handle team selection click
   * Converts view coordinates to server coordinates and determines which team area was clicked
   */
  private handleTeamClick(viewX: number, viewY: number) {
    // Convert view coordinates to server coordinates
    const serverPos = this.toServerCoords(viewX, viewY);

    // Determine which side of the diagonal the click is on
    // Diagonal line: y = x (from top-left to bottom-right)
    if (serverPos.y < serverPos.x) {
      // Above diagonal = Red team (in server coordinates)
      this.selectTeam('red');
    } else {
      // Below diagonal = Blue team (in server coordinates)
      this.selectTeam('blue');
    }
  }

  /**
   * Update team UI based on player's team
   * Players always see their own team in the bottom-left
   */
  private updateTeamUI() {
    if (!this.myTeam || !this.teamLabels || !this.redZone || !this.blueZone) return;

    // Determine colors based on team
    const isRedTeam = this.myTeam === 'red';
    const bottomLeftColor = isRedTeam ? 0xff0000 : 0x0000ff;
    const topRightColor = isRedTeam ? 0x0000ff : 0xff0000;

    // Redraw zones with correct colors (full map, same as GameScene)
    // Draw top-right territory (above the \ diagonal)
    this.redZone.clear();
    this.redZone.fillStyle(topRightColor, 0.03);
    this.redZone.beginPath();
    this.redZone.moveTo(0, 0);
    this.redZone.lineTo(MAP_SIZE, 0);
    this.redZone.lineTo(MAP_SIZE, MAP_SIZE);
    this.redZone.closePath();
    this.redZone.fillPath();

    // Draw bottom-left territory (below the \ diagonal)
    this.blueZone.clear();
    this.blueZone.fillStyle(bottomLeftColor, 0.03);
    this.blueZone.beginPath();
    this.blueZone.moveTo(0, 0);
    this.blueZone.lineTo(0, MAP_SIZE);
    this.blueZone.lineTo(MAP_SIZE, MAP_SIZE);
    this.blueZone.closePath();
    this.blueZone.fillPath();

    // Update team labels to show "MY TEAM" for player's team
    if (isRedTeam) {
      // Red team sees: bottom-left = RED (my team), top-right = BLUE
      this.teamLabels.red.setText('MY TEAM\n(RED)');
      this.teamLabels.red.setFontSize('24px');
      this.teamLabels.blue.setText('BLUE');
      this.teamLabels.blue.setFontSize('28px');

      // Update positions (180 degree rotation for red team)
      const redPos = this.toViewCoords(MAP_SIZE * 0.8, MAP_SIZE * 0.25);
      const bluePos = this.toViewCoords(MAP_SIZE * 0.2, MAP_SIZE * 0.75);
      this.teamLabels.red.setPosition(redPos.x, redPos.y);
      this.teamLabels.blue.setPosition(bluePos.x, bluePos.y);
    } else {
      // Blue team sees: bottom-left = BLUE (my team), top-right = RED
      this.teamLabels.blue.setText('MY TEAM\n(BLUE)');
      this.teamLabels.blue.setFontSize('24px');
      this.teamLabels.red.setText('RED');
      this.teamLabels.red.setFontSize('28px');

      // Positions stay the same for blue team
      this.teamLabels.red.setPosition(MAP_SIZE * 0.8, MAP_SIZE * 0.25);
      this.teamLabels.blue.setPosition(MAP_SIZE * 0.2, MAP_SIZE * 0.75);
    }

    // Player sprites will be updated by updatePlayers() which called this method
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

    // Check if current player's team has changed
    const currentPlayer = state.players.get(this.room.sessionId);
    if (currentPlayer?.team && currentPlayer.team !== this.myTeam) {
      // Team changed - update UI
      this.myTeam = currentPlayer.team;
      this.updateTeamUI();
    } else if (currentPlayer?.team && !this.myTeam) {
      // First time getting team info
      this.myTeam = currentPlayer.team;
      this.updateTeamUI();
    }

    // Update player positions based on team
    state.players.forEach((player: any, sessionId: string) => {
      this.updatePlayerSprite(sessionId, player);
    });

    // Update ghost bots visibility
    this.updateGhostBots();

    this.updateButtonStyles();
  }

  /**
   * Update ghost bot positions and visibility based on actual players
   */
  private updateGhostBots(): void {
    if (!this.room?.state) return;

    const state = this.room.state as any;
    const players = Array.from(state.players.values()) as any[];

    // Count players per team
    const redPlayers = players.filter(p => p.team === 'red');
    const bluePlayers = players.filter(p => p.team === 'blue');

    const teams = [
      { name: 'red', count: redPlayers.length },
      { name: 'blue', count: bluePlayers.length }
    ];

    teams.forEach(({ name: team, count }) => {
      for (let i = 0; i < 3; i++) {
        const ghostId = `ghost_${team}_${i}`;
        const container = this.ghostBots.get(ghostId);
        if (!container) continue;

        // Show ghost bot only for empty slots (after actual players)
        if (i >= count) {
          container.setVisible(true);

          // Calculate position (same logic as updatePlayerSprite)
          let serverX: number, serverY: number;
          if (team === 'red') {
            serverX = MAP_SIZE * 0.54 + i * PLAYER_SPACING;
            serverY = MAP_SIZE * 0.24 + i * PLAYER_SPACING;
          } else {
            serverX = MAP_SIZE * 0.2 + i * PLAYER_SPACING;
            serverY = MAP_SIZE * 0.5 + i * PLAYER_SPACING;
          }

          const viewPos = this.toViewCoords(serverX, serverY);
          container.setPosition(viewPos.x, viewPos.y);
        } else {
          container.setVisible(false);
        }
      }
    });
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
    let serverX: number, serverY: number;

    if (player.team === 'red') {
      // Red zone: arrange parallel to diagonal (server coordinates)
      const index = this.getTeamPlayerIndex(sessionId, 'red');
      serverX = MAP_SIZE * 0.54 + index * PLAYER_SPACING;
      serverY = MAP_SIZE * 0.24 + index * PLAYER_SPACING;
    } else if (player.team === 'blue') {
      // Blue zone: arrange parallel to diagonal (server coordinates)
      const index = this.getTeamPlayerIndex(sessionId, 'blue');
      serverX = MAP_SIZE * 0.2 + index * PLAYER_SPACING;
      serverY = MAP_SIZE * 0.5 + index * PLAYER_SPACING;
    } else {
      // No team - position along center diagonal
      const index = this.getNoTeamPlayerIndex(sessionId);
      serverX = MAP_SIZE * 0.37 + index * PLAYER_SPACING;
      serverY = MAP_SIZE * 0.37 + index * PLAYER_SPACING;
    }

    // Convert to view coordinates
    const viewPos = this.toViewCoords(serverX, serverY);
    container.setPosition(viewPos.x, viewPos.y);

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
