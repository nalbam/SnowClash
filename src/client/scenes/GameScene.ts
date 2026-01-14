import Phaser from 'phaser';
import { Room } from 'colyseus.js';
import { generateCharacterTextures, createCharacterAnimations } from '../assets/PixelCharacter';

const MAP_SIZE = 600;

interface PlayerSprite extends Phaser.GameObjects.Sprite {
  lastX?: number;
  lastY?: number;
  isMoving?: boolean;
  displayEnergy?: number; // For smooth energy bar interpolation
}

export class GameScene extends Phaser.Scene {
  private room?: Room;
  private players: Map<string, PlayerSprite> = new Map();
  private playerIndicators: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private snowballs: Map<string, Phaser.GameObjects.Sprite> = new Map();
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
  private snowballPositions: Map<string, { x: number; y: number; team: string; damage: number }> = new Map();

  // Pointer/touch input state
  private isPointerDown: boolean = false;
  private pointerDownTime: number = 0;
  private currentPointerX: number = 0;
  private currentPointerY: number = 0;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: any) {
    this.room = data.room;
    this.listenersSetup = false;
    this.players.clear();
    this.playerIndicators.clear();
    this.snowballs.clear();
    this.playerLabels.clear();
    this.energyBars.clear();
    this.fadingSnowballs.clear();
    this.snowballPositions.clear();
  }

  create() {
    this.cameras.main.setBackgroundColor('#e8f4f8');

    // Generate pixel art textures
    generateCharacterTextures(this);
    createCharacterAnimations(this);

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

    // Setup pointer/touch input (works for both mouse and touch)
    this.input.on('pointerdown', this.handlePointerDown, this);
    this.input.on('pointerup', this.handlePointerUp, this);
    this.input.on('pointermove', this.handlePointerMove, this);

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

    // Check if current player is stunned
    const currentPlayerState = this.room.state?.players?.get(this.currentPlayer || '');
    const isStunned = currentPlayerState?.isStunned || false;

    // If stunned, cancel all inputs
    if (isStunned) {
      this.isPointerDown = false;
      if (this.isCharging) {
        this.isCharging = false;
        if (this.chargeGauge) {
          this.chargeGauge.clear();
        }
      }
      return; // Don't process any movement or attacks
    }

    // Handle movement - keyboard takes priority
    let moveX = 0;
    let moveY = 0;
    let isKeyboardMoving = false;

    // Check keyboard input
    if (this.keys.up.isDown || this.keys.arrowUp.isDown) {
      moveY = -1;
      isKeyboardMoving = true;
    }
    if (this.keys.down.isDown || this.keys.arrowDown.isDown) {
      moveY = 1;
      isKeyboardMoving = true;
    }
    if (this.keys.left.isDown || this.keys.arrowLeft.isDown) {
      moveX = -1;
      isKeyboardMoving = true;
    }
    if (this.keys.right.isDown || this.keys.arrowRight.isDown) {
      moveX = 1;
      isKeyboardMoving = true;
    }

    // If keyboard is being used, cancel pointer input
    if (isKeyboardMoving) {
      this.isPointerDown = false;
      if (this.isCharging) {
        this.isCharging = false;
        if (this.chargeGauge) {
          this.chargeGauge.clear();
        }
      }
    }
    // Otherwise, check for pointer-based movement
    else if (this.isPointerDown) {
      const currentPlayer = this.players.get(this.currentPlayer || '');
      if (currentPlayer) {
        // Calculate direction from player to cursor
        const dx = this.currentPointerX - currentPlayer.x;
        const dy = this.currentPointerY - currentPlayer.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 5) {
          // Only move if cursor is not too close to player
          // Use normalized direction for smooth 360-degree movement
          moveX = dx / distance;
          moveY = dy / distance;
        }
      }
    }

    // Apply client-side prediction for local player (smooth movement)
    if ((moveX !== 0 || moveY !== 0) && this.currentPlayer) {
      const currentPlayer = this.players.get(this.currentPlayer);
      if (currentPlayer) {
        const PLAYER_SPEED = 2;
        const newX = currentPlayer.x + moveX * PLAYER_SPEED;
        const newY = currentPlayer.y + moveY * PLAYER_SPEED;

        // Update position immediately on client for smooth movement
        currentPlayer.setPosition(newX, newY);

        // Also update label and energy bar positions
        const label = this.playerLabels.get(this.currentPlayer);
        if (label) {
          label.setPosition(newX, newY - 30);
        }

        const energyBar = this.energyBars.get(this.currentPlayer);
        const indicator = this.playerIndicators.get(this.currentPlayer);
        if (indicator) {
          indicator.clear();
          indicator.lineStyle(2, 0xffff00, 1);
          indicator.strokeCircle(newX, newY, 20);
        }
      }
    }

    // Send movement to server
    if (moveX !== 0 || moveY !== 0) {
      this.room.send('move', { x: moveX, y: moveY });
    }

    // Handle snowball charging/throwing
    this.handleSnowballInput(time);
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

    const team = player.team || 'red';
    const textureKey = `character_${team}_idle`;

    // Create sprite for player
    const sprite = this.add.sprite(player.x, player.y, textureKey) as PlayerSprite;
    sprite.setScale(1);
    sprite.lastX = player.x;
    sprite.lastY = player.y;
    sprite.isMoving = false;
    sprite.displayEnergy = player.energy; // Initialize display energy
    this.players.set(sessionId, sprite);

    // Create indicator for current player
    const indicator = this.add.graphics();
    this.playerIndicators.set(sessionId, indicator);

    // Create player label
    const label = this.add.text(player.x, player.y - 30, player.nickname || 'Player', {
      fontSize: '10px',
      color: '#000000',
      backgroundColor: '#ffffffcc',
      padding: { x: 3, y: 1 }
    }).setOrigin(0.5);
    this.playerLabels.set(sessionId, label);

    // Create energy bar
    const energyBar = this.add.graphics();
    this.energyBars.set(sessionId, energyBar);

    // Initial update
    this.updatePlayer(sessionId, player);
  }

  private updatePlayer(sessionId: string, player: any) {
    const sprite = this.players.get(sessionId);
    if (!sprite) return;

    const team = player.team || 'red';

    // Check if player is moving
    const isMoving = sprite.lastX !== player.x || sprite.lastY !== player.y;

    // For local player, only use server position for correction (skip immediate update)
    // Client-side prediction handles local player movement
    const isLocalPlayer = sessionId === this.currentPlayer;

    if (!isLocalPlayer) {
      // For remote players, smoothly interpolate to server position
      const lerpSpeed = 0.3; // Adjust between 0-1 for smoother/faster interpolation
      sprite.x += (player.x - sprite.x) * lerpSpeed;
      sprite.y += (player.y - sprite.y) * lerpSpeed;
    } else {
      // For local player, apply smooth correction towards server position
      const correctionSpeed = 0.2; // Adjust between 0-1 for smoother/faster correction
      const dx = player.x - sprite.x;
      const dy = player.y - sprite.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Only correct if there's significant deviation (more than 5 pixels)
      if (distance > 5) {
        sprite.x += dx * correctionSpeed;
        sprite.y += dy * correctionSpeed;
      }
    }

    // Determine animation state
    if (player.isStunned) {
      // Stunned state
      const stunnedKey = `character_${team}_stunned`;
      sprite.setTexture(stunnedKey);
      sprite.setAlpha(0.6);
      sprite.anims.stop();
    } else if (isMoving) {
      // Walking animation
      sprite.setAlpha(1);
      const walkAnim = `${team}_walk`;
      if (sprite.anims.currentAnim?.key !== walkAnim) {
        sprite.play(walkAnim);
      }
    } else {
      // Idle state
      sprite.setAlpha(1);
      const idleKey = `character_${team}_idle`;
      sprite.setTexture(idleKey);
      sprite.anims.stop();
    }

    // Update last position (use server position for tracking movement state)
    sprite.lastX = player.x;
    sprite.lastY = player.y;

    // Update indicator (use sprite's interpolated position)
    const indicator = this.playerIndicators.get(sessionId);
    if (indicator) {
      indicator.clear();

      const isCurrentPlayer = sessionId === this.currentPlayer;
      const isBot = player.isBot;

      if (isCurrentPlayer) {
        // Yellow ring for current player
        indicator.lineStyle(2, 0xffff00, 1);
        indicator.strokeCircle(sprite.x, sprite.y, 20);
      } else if (isBot) {
        // Gray ring for bots
        indicator.lineStyle(1, 0x888888, 0.5);
        indicator.strokeCircle(sprite.x, sprite.y, 18);
      }
    }

    // Update label position (use sprite's interpolated position)
    const label = this.playerLabels.get(sessionId);
    if (label) {
      label.setPosition(sprite.x, sprite.y - 30);
    }

    // Update energy bar (use sprite's interpolated position)
    const energyBar = this.energyBars.get(sessionId);
    if (energyBar) {
      energyBar.clear();

      // Initialize displayEnergy if not set
      const currentEnergy = sprite.displayEnergy ?? player.energy;

      // Smoothly interpolate energy value
      const targetEnergy = player.isStunned ? 0 : player.energy;
      const energyLerpSpeed = 0.15; // Adjust for smoother/faster energy bar changes
      const currentDisplayEnergy = currentEnergy + (targetEnergy - currentEnergy) * energyLerpSpeed;
      sprite.displayEnergy = currentDisplayEnergy;

      const barWidth = 30;
      const barHeight = 4;
      const energyPercent = Math.max(0, currentDisplayEnergy / 10);

      // Background
      energyBar.fillStyle(0x000000, 0.5);
      energyBar.fillRect(sprite.x - barWidth / 2, sprite.y - 40, barWidth, barHeight);

      // Energy fill
      if (energyPercent > 0) {
        const energyColor = energyPercent > 0.5 ? 0x00ff00 : energyPercent > 0.25 ? 0xffff00 : 0xff0000;
        energyBar.fillStyle(energyColor, 1);
        energyBar.fillRect(sprite.x - barWidth / 2, sprite.y - 40, barWidth * energyPercent, barHeight);
      }
    }
  }

  private removePlayer(sessionId: string) {
    const sprite = this.players.get(sessionId);
    const indicator = this.playerIndicators.get(sessionId);
    const label = this.playerLabels.get(sessionId);
    const energyBar = this.energyBars.get(sessionId);

    if (sprite) {
      sprite.destroy();
      this.players.delete(sessionId);
    }

    if (indicator) {
      indicator.destroy();
      this.playerIndicators.delete(sessionId);
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
    const team = snowball.team || 'red';
    const isCharged = snowball.damage >= 7;
    const textureKey = `snowball_${team}_${isCharged ? 'charged' : 'normal'}`;

    const sprite = this.add.sprite(snowball.x, snowball.y, textureKey);
    this.snowballs.set(id, sprite);
    this.snowballPositions.set(id, {
      x: snowball.x,
      y: snowball.y,
      team: snowball.team,
      damage: snowball.damage
    });
  }

  private updateSnowball(id: string, snowball: any) {
    const sprite = this.snowballs.get(id);
    if (!sprite) return;

    // 페이딩 중인 눈덩이는 업데이트하지 않음
    if (this.fadingSnowballs.has(id)) return;

    sprite.setPosition(snowball.x, snowball.y);

    // 위치 저장
    this.snowballPositions.set(id, {
      x: snowball.x,
      y: snowball.y,
      team: snowball.team,
      damage: snowball.damage
    });
  }

  private removeSnowball(id: string, snowball?: any) {
    const sprite = this.snowballs.get(id);
    if (sprite) {
      // 눈덩이 위치와 팀 정보
      const storedPos = this.snowballPositions.get(id);
      const x = snowball?.x ?? storedPos?.x ?? 0;
      const y = snowball?.y ?? storedPos?.y ?? 0;
      const team = snowball?.team ?? storedPos?.team ?? 'red';

      // 원본 눈덩이 즉시 제거
      this.fadingSnowballs.delete(id);
      this.snowballs.delete(id);
      this.snowballPositions.delete(id);
      sprite.destroy();

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

  private handlePointerDown(pointer: Phaser.Input.Pointer) {
    // Only handle left clicks (mouse button 0) or primary touch
    if (pointer.button !== 0 && pointer.button !== undefined) return;

    // Check if player is stunned
    const currentPlayerState = this.room?.state?.players?.get(this.currentPlayer || '');
    if (currentPlayerState?.isStunned) return;

    // Ignore clicks outside the map
    if (pointer.x < 0 || pointer.x > MAP_SIZE || pointer.y < 0 || pointer.y > MAP_SIZE) return;

    // Record pointer down state and position
    this.isPointerDown = true;
    this.pointerDownTime = this.time.now;
    this.currentPointerX = pointer.x;
    this.currentPointerY = pointer.y;
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer) {
    // Release pointer - snowball will be fired by handleSnowballInput
    this.isPointerDown = false;
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer) {
    // Update cursor position while pointer is down
    if (this.isPointerDown) {
      this.currentPointerX = pointer.x;
      this.currentPointerY = pointer.y;
    }
  }

  private handleSnowballInput(time: number) {
    if (!this.room) return;

    const canThrow = time - this.lastThrowTime >= this.THROW_COOLDOWN;

    // Check if charging should start
    const shouldCharge = this.keys?.space.isDown || this.isPointerDown;

    if (shouldCharge && canThrow) {
      if (!this.isCharging) {
        this.isCharging = true;
        this.chargeStartTime = time;
      }
      this.updateChargeGauge(time);
    }
    // Check if should release
    else if (this.isCharging && !shouldCharge) {
      // Release snowball
      const chargeTime = time - this.chargeStartTime;

      // Only throw if minimum charge time met
      if (chargeTime >= this.MIN_CHARGE_TIME) {
        const chargeLevel = Math.min(chargeTime / 1000, 1);
        this.room.send('throwSnowball', { chargeLevel });
        this.lastThrowTime = time;
      }

      this.isCharging = false;
      if (this.chargeGauge) {
        this.chargeGauge.clear();
      }
    }
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

  shutdown() {
    // Remove pointer listeners
    this.input.off('pointerdown', this.handlePointerDown, this);
    this.input.off('pointerup', this.handlePointerUp, this);
    this.input.off('pointermove', this.handlePointerMove, this);
  }
}
