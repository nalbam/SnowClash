import Phaser from 'phaser';
import { Room } from 'colyseus.js';
import { generateCharacterTextures, createCharacterAnimations } from '../assets/PixelCharacter';
import { SnowballSystem } from '../systems/SnowballSystem';
import { InputSystem } from '../systems/InputSystem';
import { PlayerRenderSystem } from '../systems/PlayerRenderSystem';

const MAP_SIZE = 600;

export class GameScene extends Phaser.Scene {
  // Systems
  private snowballSystem?: SnowballSystem;
  private inputSystem?: InputSystem;
  private playerRenderSystem?: PlayerRenderSystem;

  private room?: Room;
  private currentPlayer?: string;
  private listenersSetup: boolean = false;

  // Game ended flag
  private gameEnded: boolean = false;
  private winner: string = '';

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: any) {
    this.room = data.room;
    this.listenersSetup = false;
    this.gameEnded = false;
    this.winner = '';

    // Initialize systems
    this.snowballSystem = new SnowballSystem(this);
    this.inputSystem = new InputSystem(this, {
      throwCooldown: 1000,    // 1초 쿨다운
      minChargeTime: 200,     // 최소 0.2초 차징 필요
      mapSize: MAP_SIZE
    });
    this.playerRenderSystem = new PlayerRenderSystem(this);
  }

  create() {
    this.cameras.main.setBackgroundColor('#e8f4f8');

    // Generate pixel art textures
    generateCharacterTextures(this);
    createCharacterAnimations(this);

    // Draw the map
    this.drawMap();

    // Initialize input system
    if (this.inputSystem) {
      this.inputSystem.init();
    }

    // Setup room state listeners
    this.setupRoomHandlers();

    // Force initial sync after a short delay (in case onStateChange doesn't fire)
    this.time.delayedCall(100, () => {
      if (this.room && this.room.state) {
        this.syncPlayersFromState(this.room.state as any);
      }
    });
  }

  update(time: number, delta: number) {
    if (!this.room || !this.inputSystem || !this.playerRenderSystem) return;

    // Get current player state
    const currentPlayerState = this.room.state?.players?.get(this.currentPlayer || '');
    const isWinningTeam = this.gameEnded && this.winner !== 'draw' && this.winner === currentPlayerState?.team;

    // Check if game has ended or not in playing phase
    if ((this.gameEnded || this.room.state?.phase !== 'playing' || currentPlayerState?.isStunned) && !isWinningTeam) {
      this.inputSystem.cancelInput();
      return;
    }

    // Get current player position
    const playerPos = this.playerRenderSystem.getPlayerPosition(this.currentPlayer || '');
    const playerX = playerPos?.x;
    const playerY = playerPos?.y;

    // Get input from input system
    const input = this.inputSystem.getInput(time, playerX, playerY);

    // Apply client-side prediction for local player (smooth movement)
    if (input.isMoving && this.currentPlayer && playerPos) {
      const PLAYER_SPEED = 2;
      const newX = playerPos.x + input.moveX * PLAYER_SPEED;
      const newY = playerPos.y + input.moveY * PLAYER_SPEED;

      // Update position immediately on client for smooth movement
      this.playerRenderSystem.updateLocalPlayerPosition(this.currentPlayer, newX, newY);
    }

    // Send movement to server
    if (input.isMoving) {
      this.room.send('move', { x: input.moveX, y: input.moveY });
    }

    // Send snowball throw to server
    if (input.shouldThrow) {
      this.room.send('throwSnowball', { chargeLevel: input.chargeLevel });
    }
  }

  private drawMap() {
    const graphics = this.add.graphics();

    // Draw grid background
    graphics.fillStyle(0xffffff, 1);
    graphics.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

    // Draw red territory (top-right triangle, above the \ diagonal)
    graphics.fillStyle(0xff0000, 0.1);
    graphics.beginPath();
    graphics.moveTo(0, 0);
    graphics.lineTo(MAP_SIZE, 0);
    graphics.lineTo(MAP_SIZE, MAP_SIZE);
    graphics.closePath();
    graphics.fillPath();

    // Draw blue territory (bottom-left triangle, below the \ diagonal)
    graphics.fillStyle(0x0000ff, 0.1);
    graphics.beginPath();
    graphics.moveTo(0, 0);
    graphics.lineTo(0, MAP_SIZE);
    graphics.lineTo(MAP_SIZE, MAP_SIZE);
    graphics.closePath();
    graphics.fillPath();
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
      if (this.playerRenderSystem) {
        this.playerRenderSystem.createPlayer(sessionId, player);
        // Update indicator for current player
        if (sessionId === this.currentPlayer) {
          this.playerRenderSystem.updatePlayerIndicator(sessionId, true, player.isBot);
        } else {
          this.playerRenderSystem.updatePlayerIndicator(sessionId, false, player.isBot);
        }
      }
      if (typeof player.onChange === 'function') {
        player.onChange(() => {
          if (this.playerRenderSystem) {
            const isLocal = sessionId === this.currentPlayer;
            this.playerRenderSystem.updatePlayer(sessionId, player, isLocal, {
              gameEnded: this.gameEnded,
              winner: this.winner
            });
            // Update indicator
            this.playerRenderSystem.updatePlayerIndicator(sessionId, sessionId === this.currentPlayer, player.isBot);
          }
        });
      }
    });

    state.players.onRemove((player: any, sessionId: string) => {
      console.log('Player removed:', sessionId);
      if (this.playerRenderSystem) {
        this.playerRenderSystem.removePlayer(sessionId);
      }
    });

    state.snowballs.onAdd((snowball: any, id: string) => {
      if (this.snowballSystem) {
        this.snowballSystem.createSnowball(id, snowball);
        if (typeof snowball.onChange === 'function') {
          snowball.onChange(() => {
            if (this.snowballSystem) {
              this.snowballSystem.updateSnowball(id, snowball);
            }
          });
        }
      }
    });

    state.snowballs.onRemove((snowball: any, id: string) => {
      if (this.snowballSystem) {
        this.snowballSystem.removeSnowball(id, snowball);
      }
    });
  }

  private syncPlayersFromState(state: any) {
    if (!state.players || !this.playerRenderSystem) return;

    // Create players that exist in state but not locally
    state.players.forEach((player: any, sessionId: string) => {
      if (!this.playerRenderSystem!.hasPlayer(sessionId)) {
        console.log('Syncing player:', sessionId, 'at', player.x, player.y);
        this.playerRenderSystem!.createPlayer(sessionId, player);
        // Update indicator
        this.playerRenderSystem!.updatePlayerIndicator(sessionId, sessionId === this.currentPlayer, player.isBot);
      } else {
        // Update existing player position
        const isLocal = sessionId === this.currentPlayer;
        this.playerRenderSystem!.updatePlayer(sessionId, player, isLocal, {
          gameEnded: this.gameEnded,
          winner: this.winner
        });
        // Update indicator
        this.playerRenderSystem!.updatePlayerIndicator(sessionId, sessionId === this.currentPlayer, player.isBot);
      }
    });

    // Sync snowballs
    if (this.snowballSystem) {
      state.snowballs.forEach((snowball: any, id: string) => {
        if (!this.snowballSystem!.hasSnowball(id)) {
          this.snowballSystem!.createSnowball(id, snowball);
        } else {
          this.snowballSystem!.updateSnowball(id, snowball);
        }
      });

      // 상태에 없는 눈덩이 제거 (onRemove가 호출되지 않는 경우 대비)
      const stateSnowballIds = new Set<string>();
      state.snowballs.forEach((_: any, id: string) => {
        stateSnowballIds.add(id);
      });

      // Note: We cannot iterate over snowballSystem's internal map directly,
      // but the onRemove handler should handle cleanup
    }
  }




  private showGameOver(winner: string) {
    // Mark game as ended and store winner
    this.gameEnded = true;
    this.winner = winner;

    const centerX = MAP_SIZE / 2;
    const centerY = MAP_SIZE / 2;

    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.2);
    bg.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

    let message = '';
    let color = '#ffffff';

    // Get current player's team
    const currentPlayerState = this.room?.state?.players?.get(this.currentPlayer || '');
    const myTeam = currentPlayerState?.team;

    if (winner === 'draw') {
      message = 'Draw!';
      color = '#ffffff';
    } else if (myTeam && myTeam === winner) {
      // Player won
      message = 'You Win!';
      color = winner === 'red' ? '#ff0000' : '#0000ff';
    } else {
      // Player lost
      message = 'You Lose!';
      color = '#666666';
    }

    // Animation is handled by updatePlayer automatically

    this.add.text(centerX, centerY, message, {
      fontSize: '48px',
      color: color,
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Create return button
    const buttonY = centerY + 80;
    const buttonWidth = 260;
    const buttonHeight = 50;

    // Button background
    const buttonBg = this.add.graphics();
    buttonBg.fillStyle(0x4CAF50, 1);
    buttonBg.fillRoundedRect(centerX - buttonWidth / 2, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 10);
    buttonBg.lineStyle(3, 0xffffff, 1);
    buttonBg.strokeRoundedRect(centerX - buttonWidth / 2, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 10);

    // Button text
    const buttonText = this.add.text(centerX, buttonY, 'Return to Menu', {
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Make button interactive
    const buttonZone = this.add.zone(centerX, buttonY, buttonWidth, buttonHeight)
      .setInteractive({ useHandCursor: true });

    // Button hover effect
    buttonZone.on('pointerover', () => {
      buttonBg.clear();
      buttonBg.fillStyle(0x66BB6A, 1);
      buttonBg.fillRoundedRect(centerX - buttonWidth / 2, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 10);
      buttonBg.lineStyle(3, 0xffffff, 1);
      buttonBg.strokeRoundedRect(centerX - buttonWidth / 2, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 10);
    });

    buttonZone.on('pointerout', () => {
      buttonBg.clear();
      buttonBg.fillStyle(0x4CAF50, 1);
      buttonBg.fillRoundedRect(centerX - buttonWidth / 2, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 10);
      buttonBg.lineStyle(3, 0xffffff, 1);
      buttonBg.strokeRoundedRect(centerX - buttonWidth / 2, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 10);
    });

    // Button click handler
    buttonZone.on('pointerdown', () => {
      // Leave current room
      if (this.room) {
        this.room.leave();
      }
      // Return to main menu
      this.scene.start('MainMenuScene');
    });
  }

  shutdown() {
    // Cleanup systems
    if (this.inputSystem) {
      this.inputSystem.shutdown();
    }
    if (this.playerRenderSystem) {
      this.playerRenderSystem.clear();
    }
    if (this.snowballSystem) {
      this.snowballSystem.clear();
    }
  }
}
