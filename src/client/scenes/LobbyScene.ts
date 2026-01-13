import Phaser from 'phaser';
import { Room } from 'colyseus.js';

export class LobbyScene extends Phaser.Scene {
  private room?: Room;
  private nickname: string = '';
  private selectedTeam: string = '';
  private isReady: boolean = false;
  private playerListContainer?: Phaser.GameObjects.Container;
  private listenersSetup: boolean = false;

  constructor() {
    super({ key: 'LobbyScene' });
  }

  init(data: any) {
    this.room = data.room;
    this.nickname = data.nickname || 'Player';
    this.listenersSetup = false;
  }

  create() {
    this.cameras.main.setBackgroundColor('#1a1a2e');
    this.createUI();
    this.setupRoomHandlers();
  }

  private createUI() {
    const centerX = this.cameras.main.width / 2;

    // Title
    this.add.text(centerX, 30, 'Game Lobby', {
      fontSize: '36px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Room name
    const roomName = this.room?.state?.roomName || 'Game Room';
    this.add.text(centerX, 70, roomName, {
      fontSize: '20px',
      color: '#aaaaaa'
    }).setOrigin(0.5);

    // Back button
    const backBtn = this.add.text(30, 30, '< Back', {
      fontSize: '18px',
      color: '#888888'
    }).setInteractive({ useHandCursor: true });

    backBtn.on('pointerdown', () => this.leaveRoom());
    backBtn.on('pointerover', () => backBtn.setColor('#ffffff'));
    backBtn.on('pointerout', () => backBtn.setColor('#888888'));

    // Team selection header
    this.add.text(centerX, 110, 'Select Your Team', {
      fontSize: '20px',
      color: '#ffffff'
    }).setOrigin(0.5);

    // Red team button
    const redButton = this.add.text(centerX - 100, 150, 'Red Team', {
      fontSize: '20px',
      color: '#ffffff',
      backgroundColor: '#cc0000',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    redButton.on('pointerdown', () => this.selectTeam('red'));

    // Blue team button
    const blueButton = this.add.text(centerX + 100, 150, 'Blue Team', {
      fontSize: '20px',
      color: '#ffffff',
      backgroundColor: '#0000cc',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    blueButton.on('pointerdown', () => this.selectTeam('blue'));

    // Ready button
    const readyButton = this.add.text(centerX, 210, 'Ready', {
      fontSize: '22px',
      color: '#ffffff',
      backgroundColor: '#006600',
      padding: { x: 30, y: 12 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    readyButton.on('pointerdown', () => this.toggleReady());

    // Start button (host only)
    const startButton = this.add.text(centerX, 270, 'Start Game', {
      fontSize: '24px',
      color: '#ffffff',
      backgroundColor: '#ff8800',
      padding: { x: 40, y: 15 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    startButton.on('pointerdown', () => this.startGame());

    // Store references
    this.data.set('redButton', redButton);
    this.data.set('blueButton', blueButton);
    this.data.set('readyButton', readyButton);
    this.data.set('startButton', startButton);

    // Player list section
    this.add.text(centerX, 320, 'Players', {
      fontSize: '18px',
      color: '#ffffff'
    }).setOrigin(0.5);

    // Team columns (adjusted for 600px width)
    this.add.text(150, 350, 'Red Team', {
      fontSize: '14px',
      color: '#ff6666'
    }).setOrigin(0.5);

    this.add.text(450, 350, 'Blue Team', {
      fontSize: '14px',
      color: '#6666ff'
    }).setOrigin(0.5);

    // Player list container
    this.playerListContainer = this.add.container(0, 370);
  }

  private setupRoomHandlers() {
    if (!this.room) return;

    this.room.onStateChange((state) => {
      // Ignore if scene is no longer active
      if (!this.scene.isActive('LobbyScene')) return;

      // Setup collection listeners on first state sync
      if (!this.listenersSetup && state.players && typeof state.players.onAdd === 'function') {
        this.listenersSetup = true;

        state.players.onAdd((player: any, sessionId: string) => {
          if (!this.scene.isActive('LobbyScene')) return;
          this.updatePlayerList();
          player.onChange(() => this.updatePlayerList());
        });

        state.players.onRemove((player: any, sessionId: string) => {
          if (!this.scene.isActive('LobbyScene')) return;
          this.updatePlayerList();
        });
      }

      this.updatePlayerList();

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

  private updatePlayerList() {
    // Check if scene is still active
    if (!this.scene.isActive('LobbyScene')) return;
    if (!this.playerListContainer || !this.room || !this.room.state || !this.room.state.players) return;

    this.playerListContainer.removeAll(true);

    const players = Array.from(this.room.state.players.values());
    const redPlayers = players.filter((p: any) => p.team === 'red');
    const bluePlayers = players.filter((p: any) => p.team === 'blue');
    const noTeam = players.filter((p: any) => !p.team);

    // Draw red team players (x=150 for 600px width)
    redPlayers.forEach((player: any, index: number) => {
      const y = index * 25;
      const isCurrentPlayer = player.sessionId === this.room?.sessionId;
      const displayName = player.nickname;
      const nameColor = isCurrentPlayer ? '#ffff00' : '#ffffff';
      const readyIcon = player.isReady ? ' [OK]' : '';
      const hostIcon = player.isHost ? ' [H]' : '';

      const text = this.add.text(150, y, `${displayName}${hostIcon}${readyIcon}`, {
        fontSize: '12px',
        color: nameColor
      }).setOrigin(0.5);

      this.playerListContainer!.add(text);
    });

    // Draw blue team players (x=450 for 600px width)
    bluePlayers.forEach((player: any, index: number) => {
      const y = index * 25;
      const isCurrentPlayer = player.sessionId === this.room?.sessionId;
      const displayName = player.nickname;
      const nameColor = isCurrentPlayer ? '#ffff00' : '#ffffff';
      const readyIcon = player.isReady ? ' [OK]' : '';
      const hostIcon = player.isHost ? ' [H]' : '';

      const text = this.add.text(450, y, `${displayName}${hostIcon}${readyIcon}`, {
        fontSize: '12px',
        color: nameColor
      }).setOrigin(0.5);

      this.playerListContainer!.add(text);
    });

    // Draw players without team (x=300 center for 600px width)
    noTeam.forEach((player: any, index: number) => {
      const y = 90 + index * 22;
      const isCurrentPlayer = player.sessionId === this.room?.sessionId;
      const nameColor = isCurrentPlayer ? '#ffff00' : '#888888';

      const text = this.add.text(300, y, `${player.nickname} (no team)`, {
        fontSize: '11px',
        color: nameColor
      }).setOrigin(0.5);

      this.playerListContainer!.add(text);
    });

    // Update button styles based on current player state
    this.updateButtonStyles();
  }

  private updateButtonStyles() {
    // Check if scene is still active
    if (!this.scene.isActive('LobbyScene')) return;
    if (!this.room || !this.room.state || !this.room.state.players) return;

    const currentPlayer = this.room.state.players.get(this.room.sessionId);
    if (!currentPlayer) return;

    const redButton = this.data.get('redButton') as Phaser.GameObjects.Text;
    const blueButton = this.data.get('blueButton') as Phaser.GameObjects.Text;
    const readyButton = this.data.get('readyButton') as Phaser.GameObjects.Text;

    // Update team button styles
    if (currentPlayer.team === 'red') {
      redButton.setStyle({ backgroundColor: '#ff0000', fontStyle: 'bold' });
      blueButton.setStyle({ backgroundColor: '#0000cc', fontStyle: 'normal' });
    } else if (currentPlayer.team === 'blue') {
      redButton.setStyle({ backgroundColor: '#cc0000', fontStyle: 'normal' });
      blueButton.setStyle({ backgroundColor: '#0000ff', fontStyle: 'bold' });
    }

    // Update ready button style
    if (currentPlayer.isReady) {
      readyButton.setText('Not Ready');
      readyButton.setStyle({ backgroundColor: '#00aa00', fontStyle: 'bold' });
    } else {
      readyButton.setText('Ready');
      readyButton.setStyle({ backgroundColor: '#006600', fontStyle: 'normal' });
    }
  }

  private selectTeam(team: string) {
    if (!this.room) return;

    this.selectedTeam = team;
    this.room.send('selectTeam', { team });
  }

  private toggleReady() {
    if (!this.room || !this.room.state || !this.room.state.players) return;

    const currentPlayer = this.room.state.players.get(this.room.sessionId);
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
