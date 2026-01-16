import Phaser from 'phaser';
import { Room } from 'colyseus.js';
import { generateCharacterTextures, createCharacterAnimations } from '../assets/PixelCharacter';
import { SnowballSystem } from '../systems/SnowballSystem';
import { InputSystem } from '../systems/InputSystem';
import { PlayerRenderSystem } from '../systems/PlayerRenderSystem';
import { VirtualControllerSystem } from '../systems/VirtualControllerSystem';
import { MAP_SIZE, PLAYER_SPEED, THROW_COOLDOWN, MIN_CHARGE_TIME } from '../../shared/constants';

export class GameScene extends Phaser.Scene {
  // Systems
  private snowballSystem?: SnowballSystem;
  private inputSystem?: InputSystem;
  private playerRenderSystem?: PlayerRenderSystem;
  private virtualController?: VirtualControllerSystem;

  // Mobile flag
  private isMobile: boolean = false;

  // Team and coordinate system
  private myTeam?: string;
  private mapDrawn: boolean = false;

  private room?: Room;
  private currentPlayer?: string;
  private listenersSetup: boolean = false;
  private playersListenersSetup: boolean = false;
  private snowballsListenersSetup: boolean = false;

  // Game ended flag
  private gameEnded: boolean = false;
  private winner: string = '';

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: any) {
    this.room = data.room;
    this.listenersSetup = false;
    this.playersListenersSetup = false;
    this.snowballsListenersSetup = false;
    this.gameEnded = false;
    this.winner = '';
    this.myTeam = undefined;
    this.mapDrawn = false;

    // Get mobile flag from registry
    this.isMobile = this.registry.get('isMobile') || false;
    const controllerHeight = this.registry.get('controllerHeight') || 200;

    // Initialize systems
    this.snowballSystem = new SnowballSystem(this);
    this.inputSystem = new InputSystem(this, {
      throwCooldown: THROW_COOLDOWN,
      minChargeTime: MIN_CHARGE_TIME,
      mapSize: MAP_SIZE,
      isMobile: this.isMobile
    });
    this.playerRenderSystem = new PlayerRenderSystem(this);

    // Initialize virtual controller for mobile
    if (this.isMobile) {
      this.virtualController = new VirtualControllerSystem(this, MAP_SIZE, controllerHeight);
    }
  }

  create() {
    this.cameras.main.setBackgroundColor('#e8f4f8');

    // Generate pixel art textures
    generateCharacterTextures(this);
    createCharacterAnimations(this);

    // Don't draw map yet - wait for team info

    // Initialize input system
    if (this.inputSystem) {
      this.inputSystem.init();
    }

    // Initialize virtual controller for mobile
    if (this.virtualController) {
      this.virtualController.init();
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
      if (this.virtualController) {
        this.virtualController.cancelInput();
      }
      return;
    }

    // Update virtual controller input if on mobile
    if (this.virtualController && this.inputSystem) {
      const virtualInput = this.virtualController.getInput(time);
      this.inputSystem.setVirtualInput(virtualInput);
    }

    // Get current player position
    const playerPos = this.playerRenderSystem.getPlayerPosition(this.currentPlayer || '');
    const playerX = playerPos?.x;
    const playerY = playerPos?.y;

    // Get input from input system
    const input = this.inputSystem.getInput(time, playerX, playerY);

    // Update local player movement state for animation
    this.playerRenderSystem.setLocalPlayerMoving(input.isMoving);

    // Apply client-side prediction for local player (smooth movement)
    if (input.isMoving && this.currentPlayer && playerPos) {
      // For client prediction, we need view coordinate directions
      // InputSystem returns server coordinate directions, so reverse them back for red team
      let viewMoveX = input.moveX;
      let viewMoveY = input.moveY;

      if (this.myTeam === 'red') {
        viewMoveX = -input.moveX;
        viewMoveY = -input.moveY;
      }

      const newX = playerPos.x + viewMoveX * PLAYER_SPEED;
      const newY = playerPos.y + viewMoveY * PLAYER_SPEED;

      // Update position immediately on client for smooth movement
      this.playerRenderSystem.updateLocalPlayerPosition(this.currentPlayer, newX, newY);
    }

    // Send movement to server (already in server coordinates)
    if (input.isMoving) {
      this.room.send('move', { x: input.moveX, y: input.moveY });
    }

    // Send snowball throw to server
    if (input.shouldThrow) {
      this.room.send('throwSnowball', { chargeLevel: input.chargeLevel });
    }
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
   * Used for input (clicks, touches)
   */
  private toServerCoords(x: number, y: number): { x: number; y: number } {
    if (this.myTeam === 'red') {
      return { x: MAP_SIZE - x, y: MAP_SIZE - y };
    }
    return { x, y };
  }

  private drawMap() {
    const graphics = this.add.graphics();

    // Draw grid background
    graphics.fillStyle(0xffffff, 1);
    graphics.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

    // Determine colors based on team
    // Red team sees: bottom-left = red, top-right = blue
    // Blue team sees: bottom-left = blue, top-right = red (default)
    const isRedTeam = this.myTeam === 'red';
    const bottomLeftColor = isRedTeam ? 0xff0000 : 0x0000ff;
    const topRightColor = isRedTeam ? 0x0000ff : 0xff0000;

    // Draw top-right territory (above the \ diagonal)
    graphics.fillStyle(topRightColor, 0.03);
    graphics.beginPath();
    graphics.moveTo(0, 0);
    graphics.lineTo(MAP_SIZE, 0);
    graphics.lineTo(MAP_SIZE, MAP_SIZE);
    graphics.closePath();
    graphics.fillPath();

    // Draw bottom-left territory (below the \ diagonal)
    graphics.fillStyle(bottomLeftColor, 0.03);
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

    // Listen for state changes - this is the main way to get updates
    this.room.onStateChange((state) => {
      // Check if we have team info and it's the first time
      const currentPlayerState = state.players?.get(this.currentPlayer || '');
      const team = currentPlayerState?.team;

      if (team && !this.myTeam) {
        // First time getting team info
        this.myTeam = team;

        // Draw map with team-specific colors
        if (!this.mapDrawn) {
          this.drawMap();
          this.mapDrawn = true;
        }

        // Update all systems with team info
        if (this.playerRenderSystem) {
          this.playerRenderSystem.setMyTeam(team);
        }
        if (this.snowballSystem) {
          this.snowballSystem.setMyTeam(team);
        }
        if (this.inputSystem) {
          this.inputSystem.setMyTeam(team);
        }
      }

      // Sync players from state (create missing, update existing)
      this.syncPlayersFromState(state);
    });

    // Setup collection listeners after a short delay to ensure state is fully initialized
    // This is a Colyseus timing issue - MapSchema methods are not immediately available
    this.time.delayedCall(200, () => {
      if (!this.listenersSetup && this.room && this.room.state) {
        this.setupCollectionListeners(this.room.state as any);
      }
    });

    this.room.onMessage('gameEnded', (message) => {
      this.showGameOver(message.winner);
    });
  }

  private setupCollectionListeners(state: any) {
    // Try to setup players listeners (only once)
    if (!this.playersListenersSetup && state.players && typeof state.players.onAdd === 'function') {
      this.playersListenersSetup = true;

      state.players.onAdd((player: any, sessionId: string) => {
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
        if (this.playerRenderSystem) {
          this.playerRenderSystem.removePlayer(sessionId);
        }
      });
    }

    // Setup snowball listeners independently (only once)
    if (!this.snowballsListenersSetup && state.snowballs && typeof state.snowballs.onAdd === 'function') {
      this.snowballsListenersSetup = true;

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

    // Update overall listeners setup flag
    if (this.playersListenersSetup && this.snowballsListenersSetup) {
      this.listenersSetup = true;
    }
  }

  private lastSnowballIds: Set<string> = new Set();

  private syncPlayersFromState(state: any) {
    if (!state.players || !this.playerRenderSystem) return;

    // Create players that exist in state but not locally
    state.players.forEach((player: any, sessionId: string) => {
      if (!this.playerRenderSystem!.hasPlayer(sessionId)) {
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

    // Sync snowballs - MANUAL TRACKING since collection listeners don't work
    if (this.snowballSystem && state.snowballs) {
      const currentSnowballIds = new Set<string>();

      state.snowballs.forEach((snowball: any, id: string) => {
        currentSnowballIds.add(id);

        if (!this.snowballSystem!.hasSnowball(id)) {
          this.snowballSystem!.createSnowball(id, snowball);
        } else {
          this.snowballSystem!.updateSnowball(id, snowball);
        }
      });

      // Find snowballs that were removed (exist in last frame but not in current)
      this.lastSnowballIds.forEach((id) => {
        if (!currentSnowballIds.has(id)) {
          // Get last known state for this snowball to pass to removeSnowball
          if (this.snowballSystem!.hasSnowball(id)) {
            this.snowballSystem!.removeSnowball(id);
          }
        }
      });

      // Update lastSnowballIds for next frame
      this.lastSnowballIds = currentSnowballIds;
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
    if (this.virtualController) {
      this.virtualController.shutdown();
    }
    if (this.playerRenderSystem) {
      this.playerRenderSystem.clear();
    }
    if (this.snowballSystem) {
      this.snowballSystem.clear();
    }
  }
}
