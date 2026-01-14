import Phaser from 'phaser';

const MAP_SIZE = 600;

export interface InputState {
  moveX: number;        // Normalized movement X (-1 to 1)
  moveY: number;        // Normalized movement Y (-1 to 1)
  isMoving: boolean;    // Whether player is moving
  shouldThrow: boolean; // Whether snowball should be thrown
  chargeLevel: number;  // Charge level (0 to 1)
}

export interface InputConfig {
  throwCooldown: number;   // Cooldown between throws (ms)
  minChargeTime: number;   // Minimum charge time to throw (ms)
  mapSize: number;         // Map size for bounds checking
}

/**
 * InputSystem handles all input (keyboard, pointer/touch, charging) and provides
 * a clean interface for GameScene to query current input state.
 *
 * Responsibilities:
 * - Setup and manage keyboard input (WASD + Arrow keys)
 * - Handle pointer/touch events (down, up, move)
 * - Track charging state and cooldowns
 * - Render charge gauge UI
 * - Return normalized input state
 */
export class InputSystem {
  private scene: Phaser.Scene;
  private config: InputConfig;

  // Keyboard keys
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

  // Charging state
  private isCharging: boolean = false;
  private chargeStartTime: number = 0;
  private lastThrowTime: number = 0;
  private chargeGauge?: Phaser.GameObjects.Graphics;

  // Pointer state
  private isPointerDown: boolean = false;
  private pointerDownTime: number = 0;
  private currentPointerX: number = 0;
  private currentPointerY: number = 0;

  constructor(scene: Phaser.Scene, config: InputConfig) {
    this.scene = scene;
    this.config = config;
  }

  /**
   * Initialize input system - setup keyboard and pointer listeners
   */
  public init(): void {
    this.setupKeyboard();
    this.setupPointerInput();
    this.chargeGauge = this.scene.add.graphics();
  }

  /**
   * Shutdown input system - cleanup listeners
   */
  public shutdown(): void {
    this.scene.input.off('pointerdown', this.handlePointerDown, this);
    this.scene.input.off('pointerup', this.handlePointerUp, this);
    this.scene.input.off('pointermove', this.handlePointerMove, this);
  }

  /**
   * Get current input state
   */
  public getInput(time: number, playerX?: number, playerY?: number): InputState {
    // Get keyboard input first (priority)
    const keyboardInput = this.getKeyboardInput();

    let moveX = 0;
    let moveY = 0;
    let isMoving = false;

    // If keyboard is being used, cancel pointer input
    if (keyboardInput.isKeyboard) {
      this.cancelPointerInput();
      moveX = keyboardInput.moveX;
      moveY = keyboardInput.moveY;
      isMoving = moveX !== 0 || moveY !== 0;
    }
    // Otherwise, check for pointer-based movement
    else if (this.isPointerDown && playerX !== undefined && playerY !== undefined) {
      const pointerMovement = this.getPointerMovement(playerX, playerY);
      moveX = pointerMovement.moveX;
      moveY = pointerMovement.moveY;
      isMoving = moveX !== 0 || moveY !== 0;
    }

    // Process snowball input (charging/throwing)
    const snowballInput = this.processSnowballInput(time);

    return {
      moveX,
      moveY,
      isMoving,
      shouldThrow: snowballInput.shouldThrow,
      chargeLevel: snowballInput.chargeLevel
    };
  }

  /**
   * Cancel all active inputs (for game end or stun)
   */
  public cancelInput(): void {
    this.isPointerDown = false;
    if (this.isCharging) {
      this.isCharging = false;
      if (this.chargeGauge) {
        this.chargeGauge.clear();
      }
    }
  }

  /**
   * Setup keyboard input
   */
  private setupKeyboard(): void {
    if (!this.scene.input.keyboard) return;

    // WASD keys
    const keyW = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    const keyS = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    const keyA = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    const keyD = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);

    // Arrow keys
    const keyUp = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    const keyDown = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    const keyLeft = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    const keyRight = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);

    this.keys = {
      up: keyW,
      down: keyS,
      left: keyA,
      right: keyD,
      space: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      arrowUp: keyUp,
      arrowDown: keyDown,
      arrowLeft: keyLeft,
      arrowRight: keyRight,
    };
  }

  /**
   * Setup pointer/touch input
   */
  private setupPointerInput(): void {
    this.scene.input.on('pointerdown', this.handlePointerDown, this);
    this.scene.input.on('pointerup', this.handlePointerUp, this);
    this.scene.input.on('pointermove', this.handlePointerMove, this);
  }

  /**
   * Handle pointer down event
   */
  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    // Only handle left clicks (mouse button 0) or primary touch
    if (pointer.button !== 0 && pointer.button !== undefined) return;

    // Ignore clicks outside the map
    if (pointer.x < 0 || pointer.x > this.config.mapSize || pointer.y < 0 || pointer.y > this.config.mapSize) return;

    // Record pointer down state and position
    this.isPointerDown = true;
    this.pointerDownTime = this.scene.time.now;
    this.currentPointerX = pointer.x;
    this.currentPointerY = pointer.y;
  }

  /**
   * Handle pointer up event
   */
  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    // Release pointer - snowball will be fired by processSnowballInput
    this.isPointerDown = false;
  }

  /**
   * Handle pointer move event
   */
  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    // Update cursor position while pointer is down
    if (this.isPointerDown) {
      this.currentPointerX = pointer.x;
      this.currentPointerY = pointer.y;
    }
  }

  /**
   * Get keyboard input state
   */
  private getKeyboardInput(): { moveX: number; moveY: number; isKeyboard: boolean } {
    if (!this.keys) return { moveX: 0, moveY: 0, isKeyboard: false };

    let moveX = 0;
    let moveY = 0;
    let isKeyboard = false;

    if (this.keys.up.isDown || this.keys.arrowUp.isDown) {
      moveY = -1;
      isKeyboard = true;
    }
    if (this.keys.down.isDown || this.keys.arrowDown.isDown) {
      moveY = 1;
      isKeyboard = true;
    }
    if (this.keys.left.isDown || this.keys.arrowLeft.isDown) {
      moveX = -1;
      isKeyboard = true;
    }
    if (this.keys.right.isDown || this.keys.arrowRight.isDown) {
      moveX = 1;
      isKeyboard = true;
    }

    return { moveX, moveY, isKeyboard };
  }

  /**
   * Get pointer-based movement
   */
  private getPointerMovement(playerX: number, playerY: number): { moveX: number; moveY: number } {
    // Calculate direction from player to cursor
    const dx = this.currentPointerX - playerX;
    const dy = this.currentPointerY - playerY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 5) {
      // Only move if cursor is not too close to player
      // Use normalized direction for smooth 360-degree movement
      return {
        moveX: dx / distance,
        moveY: dy / distance
      };
    }

    return { moveX: 0, moveY: 0 };
  }

  /**
   * Process snowball input (charging/throwing)
   */
  private processSnowballInput(time: number): { shouldThrow: boolean; chargeLevel: number } {
    const canThrow = time - this.lastThrowTime >= this.config.throwCooldown;

    // Check if charging should start
    const shouldCharge = this.keys?.space.isDown || this.isPointerDown;

    if (shouldCharge && canThrow) {
      if (!this.isCharging) {
        this.isCharging = true;
        this.chargeStartTime = time;
      }
      this.drawChargeGauge(time);
      return { shouldThrow: false, chargeLevel: 0 };
    }
    // Check if should release
    else if (this.isCharging && !shouldCharge) {
      const chargeTime = time - this.chargeStartTime;

      // Only throw if minimum charge time met
      if (chargeTime >= this.config.minChargeTime) {
        const chargeLevel = Math.min(chargeTime / 1000, 1);
        this.lastThrowTime = time;
        this.isCharging = false;
        if (this.chargeGauge) {
          this.chargeGauge.clear();
        }
        return { shouldThrow: true, chargeLevel };
      }

      this.isCharging = false;
      if (this.chargeGauge) {
        this.chargeGauge.clear();
      }
    }

    return { shouldThrow: false, chargeLevel: 0 };
  }

  /**
   * Draw charge gauge
   */
  private drawChargeGauge(time: number): void {
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

  /**
   * Cancel pointer input (when keyboard is used)
   */
  private cancelPointerInput(): void {
    this.isPointerDown = false;
    if (this.isCharging) {
      this.isCharging = false;
      if (this.chargeGauge) {
        this.chargeGauge.clear();
      }
    }
  }
}
