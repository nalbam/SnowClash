import Phaser from 'phaser';

export interface VirtualControllerInput {
  moveX: number;
  moveY: number;
  isMoving: boolean;
  isCharging: boolean;
  chargeStartTime: number;
  shouldThrow: boolean;
}

/**
 * VirtualControllerSystem renders and manages virtual joystick and attack button
 * for mobile devices. Positioned below the game area.
 */
export class VirtualControllerSystem {
  private scene: Phaser.Scene;
  private controllerY: number;
  private controllerHeight: number;

  // Joystick components
  private joystickBase?: Phaser.GameObjects.Arc;
  private joystickThumb?: Phaser.GameObjects.Arc;
  private joystickActive: boolean = false;
  private joystickPointerId: number = -1; // Track which pointer is controlling joystick
  private joystickVector = { x: 0, y: 0 };

  // Attack button components
  private attackButton?: Phaser.GameObjects.Arc;
  private attackButtonInner?: Phaser.GameObjects.Arc;
  private attackActive: boolean = false;
  private attackPointerId: number = -1; // Track which pointer is controlling attack
  private attackChargeStartTime: number = 0;
  private attackShouldThrow: boolean = false;

  // Charge gauge
  private chargeGauge?: Phaser.GameObjects.Graphics;

  // Configuration
  private readonly joystickRadius = 50;
  private readonly joystickThumbRadius = 25;
  private readonly attackButtonRadius = 45;

  constructor(scene: Phaser.Scene, gameHeight: number, controllerHeight: number) {
    this.scene = scene;
    this.controllerY = gameHeight;
    this.controllerHeight = controllerHeight;
  }

  /**
   * Initialize virtual controller UI
   */
  public init(): void {
    this.drawControllerBackground();
    this.createJoystick();
    this.createAttackButton();
    this.chargeGauge = this.scene.add.graphics();
  }

  /**
   * Draw controller area background
   */
  private drawControllerBackground(): void {
    const graphics = this.scene.add.graphics();
    graphics.fillStyle(0x2a2a4a, 1);
    graphics.fillRect(0, this.controllerY, 600, this.controllerHeight);

    // Divider line
    graphics.lineStyle(2, 0x4a4a6a, 1);
    graphics.lineBetween(0, this.controllerY, 600, this.controllerY);
  }

  /**
   * Create virtual joystick
   */
  private createJoystick(): void {
    const centerX = 100;
    const centerY = this.controllerY + this.controllerHeight / 2;

    // Joystick base (outer circle)
    this.joystickBase = this.scene.add.circle(centerX, centerY, this.joystickRadius, 0x4a4a6a, 0.8);
    this.joystickBase.setStrokeStyle(3, 0x6a6a8a);

    // Joystick thumb (inner circle)
    this.joystickThumb = this.scene.add.circle(centerX, centerY, this.joystickThumbRadius, 0x8a8aaa, 1);
    this.joystickThumb.setStrokeStyle(2, 0xaaaacc);

    // Make joystick area interactive
    const joystickZone = this.scene.add.zone(centerX, centerY, this.joystickRadius * 3, this.controllerHeight)
      .setInteractive();

    joystickZone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // Only activate if not already controlled by another pointer
      if (!this.joystickActive) {
        this.joystickActive = true;
        this.joystickPointerId = pointer.id;
        this.updateJoystickPosition(pointer);
      }
    });

    joystickZone.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      // Only respond to the pointer that started on this zone
      if (this.joystickActive && pointer.id === this.joystickPointerId && pointer.isDown) {
        this.updateJoystickPosition(pointer);
      }
    });

    joystickZone.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      // Only reset if this is the controlling pointer
      if (pointer.id === this.joystickPointerId) {
        this.resetJoystick();
      }
    });

    joystickZone.on('pointerout', (pointer: Phaser.Input.Pointer) => {
      // Only reset if this is the controlling pointer and it's released
      if (pointer.id === this.joystickPointerId && !pointer.isDown) {
        this.resetJoystick();
      }
    });

    // Label
    this.scene.add.text(centerX, this.controllerY + 15, 'MOVE', {
      fontSize: '14px',
      color: '#8888aa'
    }).setOrigin(0.5);
  }

  /**
   * Create attack button
   */
  private createAttackButton(): void {
    const centerX = 500;
    const centerY = this.controllerY + this.controllerHeight / 2;

    // Attack button (outer circle)
    this.attackButton = this.scene.add.circle(centerX, centerY, this.attackButtonRadius, 0x6a3a3a, 0.8);
    this.attackButton.setStrokeStyle(3, 0xaa5555);

    // Attack button inner
    this.attackButtonInner = this.scene.add.circle(centerX, centerY, this.attackButtonRadius - 10, 0x884444, 1);

    // Make attack button interactive
    const attackZone = this.scene.add.zone(centerX, centerY, this.attackButtonRadius * 3, this.controllerHeight)
      .setInteractive();

    attackZone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // Only activate if not already controlled by another pointer
      if (!this.attackActive) {
        this.attackActive = true;
        this.attackPointerId = pointer.id;
        this.attackChargeStartTime = this.scene.time.now;
        this.attackShouldThrow = false;

        // Visual feedback
        if (this.attackButtonInner) {
          this.attackButtonInner.setFillStyle(0xaa6666);
        }
      }
    });

    attackZone.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      // Only respond to the controlling pointer
      if (pointer.id === this.attackPointerId) {
        if (this.attackActive) {
          this.attackShouldThrow = true;
        }
        this.releaseAttackButton();
      }
    });

    attackZone.on('pointerout', (pointer: Phaser.Input.Pointer) => {
      // Only respond to the controlling pointer when released
      if (pointer.id === this.attackPointerId && !pointer.isDown && this.attackActive) {
        this.attackShouldThrow = true;
        this.releaseAttackButton();
      }
    });

    // Label
    this.scene.add.text(centerX, this.controllerY + 15, 'ATTACK', {
      fontSize: '14px',
      color: '#aa8888'
    }).setOrigin(0.5);
  }

  /**
   * Update joystick thumb position based on pointer
   */
  private updateJoystickPosition(pointer: Phaser.Input.Pointer): void {
    if (!this.joystickBase || !this.joystickThumb) return;

    const baseX = this.joystickBase.x;
    const baseY = this.joystickBase.y;

    // Calculate offset from joystick center
    const dx = pointer.x - baseX;
    const dy = pointer.y - baseY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Clamp to joystick radius
    const maxDistance = this.joystickRadius;
    const clampedDistance = Math.min(distance, maxDistance);

    if (distance > 0) {
      const normalizedX = dx / distance;
      const normalizedY = dy / distance;

      // Update thumb position
      this.joystickThumb.x = baseX + normalizedX * clampedDistance;
      this.joystickThumb.y = baseY + normalizedY * clampedDistance;

      // Update vector (normalized -1 to 1)
      this.joystickVector.x = normalizedX * (clampedDistance / maxDistance);
      this.joystickVector.y = normalizedY * (clampedDistance / maxDistance);
    }
  }

  /**
   * Reset joystick to center
   */
  private resetJoystick(): void {
    this.joystickActive = false;
    this.joystickPointerId = -1;
    this.joystickVector = { x: 0, y: 0 };

    if (this.joystickBase && this.joystickThumb) {
      this.joystickThumb.x = this.joystickBase.x;
      this.joystickThumb.y = this.joystickBase.y;
    }
  }

  /**
   * Release attack button
   */
  private releaseAttackButton(): void {
    this.attackActive = false;
    this.attackPointerId = -1;

    // Reset visual
    if (this.attackButtonInner) {
      this.attackButtonInner.setFillStyle(0x884444);
    }

    // Clear charge gauge
    if (this.chargeGauge) {
      this.chargeGauge.clear();
    }
  }

  /**
   * Get current input state from virtual controller
   */
  public getInput(time: number): VirtualControllerInput {
    // Draw charge gauge if attacking
    if (this.attackActive && this.chargeGauge && this.attackButton) {
      this.drawChargeGauge(time);
    }

    const shouldThrow = this.attackShouldThrow;
    if (this.attackShouldThrow) {
      this.attackShouldThrow = false;
    }

    return {
      moveX: this.joystickVector.x,
      moveY: this.joystickVector.y,
      isMoving: this.joystickActive && (Math.abs(this.joystickVector.x) > 0.1 || Math.abs(this.joystickVector.y) > 0.1),
      isCharging: this.attackActive,
      chargeStartTime: this.attackChargeStartTime,
      shouldThrow
    };
  }

  /**
   * Draw charge gauge around attack button
   */
  private drawChargeGauge(time: number): void {
    if (!this.chargeGauge || !this.attackButton) return;

    const chargeTime = time - this.attackChargeStartTime;
    const chargeLevel = Math.min(chargeTime / 1000, 1);

    this.chargeGauge.clear();

    const centerX = this.attackButton.x;
    const centerY = this.attackButton.y;
    const radius = this.attackButtonRadius + 8;

    // Background arc
    this.chargeGauge.lineStyle(6, 0x333333, 0.5);
    this.chargeGauge.beginPath();
    this.chargeGauge.arc(centerX, centerY, radius, -Math.PI / 2, Math.PI * 1.5, false);
    this.chargeGauge.strokePath();

    // Charge arc
    const color = chargeLevel >= 0.7 ? 0xff4444 : 0xffff44;
    this.chargeGauge.lineStyle(6, color, 1);
    this.chargeGauge.beginPath();
    this.chargeGauge.arc(centerX, centerY, radius, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * chargeLevel), false);
    this.chargeGauge.strokePath();
  }

  /**
   * Check if controller is active
   */
  public isActive(): boolean {
    return this.joystickActive || this.attackActive;
  }

  /**
   * Cancel all inputs
   */
  public cancelInput(): void {
    this.resetJoystick();
    this.releaseAttackButton();
    this.attackShouldThrow = false;
  }

  /**
   * Cleanup
   */
  public shutdown(): void {
    this.cancelInput();
  }
}
