import Phaser from 'phaser';
import { Client, Room } from 'colyseus.js';

declare global {
  interface Window {
    google: any;
  }
}

export class LobbyScene extends Phaser.Scene {
  private client?: Client;
  private room?: Room;
  private googleUser: any = null;
  private nickname: string = '';
  private selectedTeam: string = '';
  private isReady: boolean = false;

  constructor() {
    super({ key: 'LobbyScene' });
  }

  preload() {
    // Preload assets if needed
  }

  create() {
    this.cameras.main.setBackgroundColor('#ffffff');

    // Create UI elements
    this.createUI();
    this.initGoogleSignIn();
    this.connectToServer();
  }

  private createUI() {
    const centerX = this.cameras.main.width / 2;
    const centerY = this.cameras.main.height / 2;

    // Title
    this.add.text(centerX, 50, 'SnowClash', {
      fontSize: '48px',
      color: '#000000',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Google Sign In button placeholder
    this.add.text(centerX, 150, 'Sign in with Google', {
      fontSize: '20px',
      color: '#000000',
      backgroundColor: '#4285f4',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5).setInteractive()
      .on('pointerdown', () => this.handleGoogleSignIn());

    // Profile section
    const profileY = 250;
    this.add.text(100, profileY, 'Nickname:', {
      fontSize: '18px',
      color: '#000000'
    });

    // Team selection
    const teamY = 350;
    this.add.text(centerX, teamY - 30, 'Select Team:', {
      fontSize: '24px',
      color: '#000000'
    }).setOrigin(0.5);

    // Red team button
    const redButton = this.add.text(centerX - 100, teamY, 'Red Team', {
      fontSize: '20px',
      color: '#ffffff',
      backgroundColor: '#ff0000',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5).setInteractive()
      .on('pointerdown', () => this.selectTeam('red'));

    // Blue team button
    const blueButton = this.add.text(centerX + 100, teamY, 'Blue Team', {
      fontSize: '20px',
      color: '#ffffff',
      backgroundColor: '#0000ff',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5).setInteractive()
      .on('pointerdown', () => this.selectTeam('blue'));

    // Ready button
    const readyButton = this.add.text(centerX, 450, 'Ready', {
      fontSize: '24px',
      color: '#ffffff',
      backgroundColor: '#00aa00',
      padding: { x: 30, y: 15 }
    }).setOrigin(0.5).setInteractive()
      .on('pointerdown', () => this.toggleReady());

    // Start button (only visible to host)
    const startButton = this.add.text(centerX, 550, 'Start Game', {
      fontSize: '28px',
      color: '#ffffff',
      backgroundColor: '#ff8800',
      padding: { x: 40, y: 20 }
    }).setOrigin(0.5).setInteractive()
      .on('pointerdown', () => this.startGame());

    // Store references
    this.data.set('redButton', redButton);
    this.data.set('blueButton', blueButton);
    this.data.set('readyButton', readyButton);
    this.data.set('startButton', startButton);
  }

  private initGoogleSignIn() {
    // This would be initialized with actual Google OAuth
    // For demo purposes, we'll use a simplified version
    console.log('Google Sign In initialized');
  }

  private handleGoogleSignIn() {
    // Simplified Google sign-in
    this.googleUser = {
      id: 'user_' + Math.random().toString(36).substring(2, 11),
      name: 'Player' + Math.floor(Math.random() * 1000),
      photoUrl: ''
    };
    this.nickname = this.googleUser.name;
    console.log('Signed in as:', this.nickname);

    if (this.room) {
      this.room.send('setProfile', {
        nickname: this.nickname,
        googleId: this.googleUser.id,
        photoUrl: this.googleUser.photoUrl
      });
    }
  }

  private async connectToServer() {
    try {
      this.client = new Client('ws://localhost:2567');
      
      // Try to create or join a room
      try {
        this.room = await this.client.create('game_room', {
          nickname: this.nickname || 'Player'
        });
      } catch (e) {
        // If creation fails, try to join
        this.room = await this.client.joinOrCreate('game_room', {
          nickname: this.nickname || 'Player'
        });
      }

      this.setupRoomHandlers();
      console.log('Connected to room:', this.room.roomId);
    } catch (e) {
      console.error('Failed to connect to server:', e);
    }
  }

  private setupRoomHandlers() {
    if (!this.room) return;

    this.room.onStateChange((state) => {
      // Update UI based on state
      if (state.phase === 'playing') {
        this.scene.start('GameScene', { room: this.room });
      }
    });

    this.room.onMessage('error', (message) => {
      console.error('Server error:', message);
    });

    this.room.onMessage('playerKicked', (message) => {
      console.log('Player kicked:', message);
    });

    this.room.onMessage('gameEnded', (message) => {
      console.log('Game ended. Winner:', message.winner);
    });
  }

  private selectTeam(team: string) {
    this.selectedTeam = team;
    if (this.room) {
      this.room.send('selectTeam', { team });
    }

    // Visual feedback
    const redButton = this.data.get('redButton');
    const blueButton = this.data.get('blueButton');
    
    if (team === 'red') {
      redButton.setStyle({ backgroundColor: '#ff0000', fontStyle: 'bold' });
      blueButton.setStyle({ backgroundColor: '#0000ff', fontStyle: 'normal' });
    } else {
      blueButton.setStyle({ backgroundColor: '#0000ff', fontStyle: 'bold' });
      redButton.setStyle({ backgroundColor: '#ff0000', fontStyle: 'normal' });
    }
  }

  private toggleReady() {
    if (!this.selectedTeam) {
      console.log('Please select a team first');
      return;
    }

    this.isReady = !this.isReady;
    if (this.room) {
      this.room.send('ready', { ready: this.isReady });
    }

    const readyButton = this.data.get('readyButton');
    if (this.isReady) {
      readyButton.setStyle({ backgroundColor: '#00ff00', fontStyle: 'bold' });
    } else {
      readyButton.setStyle({ backgroundColor: '#00aa00', fontStyle: 'normal' });
    }
  }

  private startGame() {
    if (this.room) {
      this.room.send('startGame', {});
    }
  }
}
