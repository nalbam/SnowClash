import Phaser from 'phaser';
import { MainMenuScene } from './scenes/MainMenuScene';
import { LobbyScene } from './scenes/LobbyScene';
import { GameScene } from './scenes/GameScene';

// Detect mobile device
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  || (window.innerWidth <= 768 && 'ontouchstart' in window);

// Controller area height for mobile
const CONTROLLER_HEIGHT = 200;
const GAME_HEIGHT = 600;

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 600,
  height: isMobile ? GAME_HEIGHT + CONTROLLER_HEIGHT : GAME_HEIGHT,
  parent: 'game-container',
  backgroundColor: '#1a1a2e',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  input: {
    activePointers: 2, // Enable multi-touch for joystick + attack button
    touch: {
      capture: true
    }
  },
  scene: [MainMenuScene, LobbyScene, GameScene],
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false
    }
  },
  callbacks: {
    preBoot: (game) => {
      // Store mobile flag and controller height in registry for scenes to access
      game.registry.set('isMobile', isMobile);
      game.registry.set('controllerHeight', CONTROLLER_HEIGHT);
    }
  }
};

const game = new Phaser.Game(config);
