import Phaser from 'phaser';
import { Client, Room } from 'colyseus.js';
import { config } from '../config';
import { generateCharacterTextures, createCharacterAnimations } from '../assets/PixelCharacter';
import { generateEnvironmentTextures, createMenuDecorations } from '../assets/EnvironmentAssets';
import { MAP_SIZE, UI_BORDER_MARGIN } from '../../shared/constants';
import { OfflineRoomAdapter } from '../adapters';

interface RoomInfo {
  roomId: string;
  roomName: string;
  playerCount: number;
  maxPlayers: number;
  phase: string;
}

export class MainMenuScene extends Phaser.Scene {
  private client?: Client;
  private nickname: string = '';
  private nicknameText?: Phaser.GameObjects.Text;
  private roomListContainer?: Phaser.GameObjects.Container;
  private rooms: RoomInfo[] = [];
  private serverVersion: string = '';

  // Timer reference for cleanup
  private refreshTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super({ key: 'MainMenuScene' });
  }

  preload() {
    // Load button sound effects
    this.load.audio('hover', 'sounds/hover.mp3');
    this.load.audio('click', 'sounds/click.mp3');
  }

  async create() {
    this.cameras.main.setBackgroundColor('#e8f4f8');
    this.client = new Client(config.wsUrl);

    // Generate pixel art textures
    generateCharacterTextures(this);
    createCharacterAnimations(this);
    generateEnvironmentTextures(this);

    // Add environment decorations - behind all UI elements (trees only for menu)
    createMenuDecorations(this, MAP_SIZE);

    // Generate random nickname and fetch server version
    await Promise.all([
      this.generateNickname(),
      this.fetchServerVersion()
    ]);

    this.createUI();
    this.refreshRoomList();

    // Auto-refresh room list every 5 seconds
    // Store timer reference for cleanup
    this.refreshTimer = this.time.addEvent({
      delay: 5000,
      callback: () => this.refreshRoomList(),
      loop: true
    });
  }

  private async fetchServerVersion() {
    try {
      const response = await fetch(`${config.apiUrl}/api/version`);

      if (!response.ok) {
        console.warn(`Failed to fetch version: ${response.status} ${response.statusText}`);
        this.serverVersion = 'unknown';
        return;
      }

      const data = await response.json() as { version: string };
      this.serverVersion = data.version;
    } catch (error) {
      console.warn('Failed to fetch version:', error);
      this.serverVersion = 'unknown';
    }
  }

  private async generateNickname(forceNew: boolean = false) {
    // Check localStorage first (unless forcing new nickname)
    if (!forceNew) {
      const savedNickname = localStorage.getItem('snowclash_nickname');
      if (savedNickname) {
        this.nickname = savedNickname;
        return;
      }
    }

    // Generate new nickname from API
    try {
      const response = await fetch(`${config.apiUrl}/api/nickname`);
      const data = await response.json() as { nickname: string };
      this.nickname = data.nickname;
    } catch (error) {
      this.nickname = 'Player' + Math.floor(Math.random() * 1000);
    }

    // Save to localStorage
    localStorage.setItem('snowclash_nickname', this.nickname);
  }

  private createUI() {
    const centerX = this.cameras.main.width / 2;

    // Title
    this.add.text(centerX, 70, 'SnowClash', {
      fontSize: '48px',
      color: '#333333',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Red team character (left of title)
    const redCharacter = this.add.sprite(centerX - MAP_SIZE * 0.28, 70, 'character_red_idle');
    redCharacter.setScale(2);
    this.tweens.add({
      targets: redCharacter,
      y: 65,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // Blue team character (right of title)
    const blueCharacter = this.add.sprite(centerX + MAP_SIZE * 0.28, 70, 'character_blue_idle');
    blueCharacter.setScale(2);
    blueCharacter.setFlipX(true); // Face toward center
    this.tweens.add({
      targets: blueCharacter,
      y: 65,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      delay: 400 // Offset animation for visual interest
    });

    // Nickname section
    this.add.text(centerX, 115, 'Your Nickname:', {
      fontSize: '18px',
      color: '#666666'
    }).setOrigin(0.5);

    this.nicknameText = this.add.text(centerX, 145, this.nickname, {
      fontSize: '24px',
      color: '#008800',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Change nickname button
    const changeBtn = this.add.text(centerX, 180, '[Change]', {
      fontSize: '14px',
      color: '#888888'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    changeBtn.on('pointerdown', () => { this.sound.play('click', { volume: 0.3 }); this.changeNickname(); });
    changeBtn.on('pointerover', () => { this.sound.play('hover', { volume: 0.2 }); changeBtn.setColor('#333333'); });
    changeBtn.on('pointerout', () => changeBtn.setColor('#888888'));

    // Quick Play button
    const quickPlayBtn = this.add.text(centerX - MAP_SIZE * 0.16, 235, 'Quick Play', {
      fontSize: '20px',
      color: '#ffffff',
      backgroundColor: '#4CAF50',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    quickPlayBtn.on('pointerdown', () => { this.sound.play('click', { volume: 0.3 }); this.quickPlay(); });
    quickPlayBtn.on('pointerover', () => { this.sound.play('hover', { volume: 0.2 }); quickPlayBtn.setStyle({ backgroundColor: '#66BB6A' }); });
    quickPlayBtn.on('pointerout', () => quickPlayBtn.setStyle({ backgroundColor: '#4CAF50' }));

    // Create Room button
    const createRoomBtn = this.add.text(centerX + MAP_SIZE * 0.16, 235, 'Create Room', {
      fontSize: '20px',
      color: '#ffffff',
      backgroundColor: '#2196F3',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    createRoomBtn.on('pointerdown', () => { this.sound.play('click', { volume: 0.3 }); this.createRoom(); });
    createRoomBtn.on('pointerover', () => { this.sound.play('hover', { volume: 0.2 }); createRoomBtn.setStyle({ backgroundColor: '#42A5F5' }); });
    createRoomBtn.on('pointerout', () => createRoomBtn.setStyle({ backgroundColor: '#2196F3' }));

    // Room list header
    this.add.text(centerX, 295, 'Available Rooms', {
      fontSize: '20px',
      color: '#333333'
    }).setOrigin(0.5);

    // Refresh button (positioned to the right, inside border margin)
    const refreshBtn = this.add.text(MAP_SIZE - UI_BORDER_MARGIN - 10, 295, '[Refresh]', {
      fontSize: '12px',
      color: '#888888'
    }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });

    refreshBtn.on('pointerdown', () => { this.sound.play('click', { volume: 0.3 }); this.refreshRoomList(); });
    refreshBtn.on('pointerover', () => { this.sound.play('hover', { volume: 0.2 }); refreshBtn.setColor('#333333'); });
    refreshBtn.on('pointerout', () => refreshBtn.setColor('#888888'));

    // Room list container
    this.roomListContainer = this.add.container(0, 335);

    // Version info at bottom
    const versionText = `Client: v${config.clientVersion} | Server: v${this.serverVersion}`;
    this.add.text(centerX, MAP_SIZE - 12, versionText, {
      fontSize: '10px',
      color: '#999999'
    }).setOrigin(0.5);
  }

  private async changeNickname() {
    await this.generateNickname(true); // Force new nickname
    if (this.nicknameText) {
      this.nicknameText.setText(this.nickname);
    }
  }

  private async refreshRoomList() {
    try {
      const response = await fetch(`${config.apiUrl}/api/rooms`);

      if (!response.ok) {
        if (response.status === 429) {
          console.warn('Rate limited, will retry later');
        } else {
          console.error(`Failed to fetch rooms: ${response.status} ${response.statusText}`);
        }
        return;
      }

      const data = await response.json();

      // Validate that response is an array
      if (Array.isArray(data)) {
        this.rooms = data as RoomInfo[];
        this.updateRoomListUI();
      } else {
        console.error('Invalid room list response:', data);
      }
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
    }
  }

  private updateRoomListUI() {
    if (!this.roomListContainer) return;

    // Clear existing room items
    this.roomListContainer.removeAll(true);

    const centerX = this.cameras.main.width / 2;

    if (this.rooms.length === 0) {
      const noRoomsText = this.add.text(centerX, 20, 'No rooms available. Create one!', {
        fontSize: '16px',
        color: '#888888'
      }).setOrigin(0.5);
      this.roomListContainer.add(noRoomsText);
      return;
    }

    // Filter out ended rooms
    const activeRooms = this.rooms.filter(room => room.phase !== 'ended');

    const listMargin = UI_BORDER_MARGIN;
    const listWidth = MAP_SIZE - listMargin * 2;

    activeRooms.forEach((room, index) => {
      const y = index * 45;
      const isJoinable = room.phase === 'lobby' && room.playerCount < room.maxPlayers;

      // Room background
      const bg = this.add.graphics();
      bg.fillStyle(isJoinable ? 0xffffff : 0xeeeeee, 0.8);
      bg.lineStyle(1, 0xcccccc, 1);
      bg.fillRoundedRect(listMargin, y, listWidth, 38, 8);
      bg.strokeRoundedRect(listMargin, y, listWidth, 38, 8);

      // Room name
      const nameText = this.add.text(listMargin + 15, y + 10, room.roomName, {
        fontSize: '14px',
        color: isJoinable ? '#333333' : '#888888'
      });

      // Player count and status
      const statusText = room.phase === 'playing' ? 'In Game' : `${room.playerCount}/${room.maxPlayers}`;
      const countText = this.add.text(listMargin + listWidth * 0.62, y + 10, statusText, {
        fontSize: '14px',
        color: room.phase === 'playing' ? '#ff6600' : (room.playerCount >= room.maxPlayers ? '#cc0000' : '#008800')
      });

      // Join button (only for joinable rooms)
      if (isJoinable) {
        const joinBtn = this.add.text(listMargin + listWidth * 0.82, y + 8, 'Join', {
          fontSize: '14px',
          color: '#ffffff',
          backgroundColor: '#FF9800',
          padding: { x: 12, y: 5 }
        }).setInteractive({ useHandCursor: true });

        joinBtn.on('pointerdown', () => { this.sound.play('click', { volume: 0.3 }); this.joinRoom(room.roomId); });
        joinBtn.on('pointerover', () => { this.sound.play('hover', { volume: 0.2 }); joinBtn.setStyle({ backgroundColor: '#FFB74D' }); });
        joinBtn.on('pointerout', () => joinBtn.setStyle({ backgroundColor: '#FF9800' }));

        this.roomListContainer!.add([bg, nameText, countText, joinBtn]);
      } else {
        this.roomListContainer!.add([bg, nameText, countText]);
      }
    });
  }

  private async quickPlay() {
    if (!this.client) return;

    try {
      const room = await this.withTimeout(
        this.client.joinOrCreate('game_room', {
          nickname: this.nickname
        }),
        3000
      );
      this.scene.start('LobbyScene', { room, nickname: this.nickname });
    } catch (error) {
      console.warn('Failed to quick play:', error);
      this.showOfflineDialog();
    }
  }

  private async createRoom() {
    if (!this.client) return;

    try {
      const roomName = `${this.nickname}'s Room`;
      const room = await this.withTimeout(
        this.client.create('game_room', {
          roomName,
          nickname: this.nickname
        }),
        3000
      );
      this.scene.start('LobbyScene', { room, nickname: this.nickname });
    } catch (error) {
      console.warn('Failed to create room:', error);
      this.showOfflineDialog();
    }
  }

  private async joinRoom(roomId: string) {
    if (!this.client) return;

    try {
      const room = await this.withTimeout(
        this.client.joinById(roomId, {
          nickname: this.nickname
        }),
        3000
      );
      this.scene.start('LobbyScene', { room, nickname: this.nickname });
    } catch (error) {
      console.warn('Failed to join room:', error);
      this.showOfflineDialog();
    }
  }

  /**
   * Wrap a promise with timeout
   */
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, timeoutMs);

      promise
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Show offline mode dialog when server connection fails
   */
  private showOfflineDialog() {
    const centerX = this.cameras.main.width / 2;
    const centerY = this.cameras.main.height / 2;

    // Create dialog container
    const dialogContainer = this.add.container(centerX, centerY);

    // Semi-transparent background overlay
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.5);
    overlay.fillRect(-centerX, -centerY, this.cameras.main.width, this.cameras.main.height);
    dialogContainer.add(overlay);

    // Dialog box background
    const dialogBg = this.add.graphics();
    dialogBg.fillStyle(0xffffff, 1);
    dialogBg.lineStyle(2, 0x333333, 1);
    dialogBg.fillRoundedRect(-150, -80, 300, 160, 12);
    dialogBg.strokeRoundedRect(-150, -80, 300, 160, 12);
    dialogContainer.add(dialogBg);

    // Dialog title
    const title = this.add.text(0, -55, 'Server Unavailable', {
      fontSize: '18px',
      color: '#333333',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    dialogContainer.add(title);

    // Dialog message
    const message = this.add.text(0, -15, 'Play offline with bots?', {
      fontSize: '16px',
      color: '#666666'
    }).setOrigin(0.5);
    dialogContainer.add(message);

    // Yes button
    const yesBtn = this.add.text(-60, 40, 'Yes', {
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#4CAF50',
      padding: { x: 20, y: 8 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    yesBtn.on('pointerdown', () => {
      this.sound.play('click', { volume: 0.3 });
      dialogContainer.destroy();
      this.startOfflineMode();
    });
    yesBtn.on('pointerover', () => {
      this.sound.play('hover', { volume: 0.2 });
      yesBtn.setStyle({ backgroundColor: '#66BB6A' });
    });
    yesBtn.on('pointerout', () => yesBtn.setStyle({ backgroundColor: '#4CAF50' }));
    dialogContainer.add(yesBtn);

    // No button
    const noBtn = this.add.text(60, 40, 'No', {
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#f44336',
      padding: { x: 20, y: 8 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    noBtn.on('pointerdown', () => {
      this.sound.play('click', { volume: 0.3 });
      dialogContainer.destroy();
    });
    noBtn.on('pointerover', () => {
      this.sound.play('hover', { volume: 0.2 });
      noBtn.setStyle({ backgroundColor: '#ef5350' });
    });
    noBtn.on('pointerout', () => noBtn.setStyle({ backgroundColor: '#f44336' }));
    dialogContainer.add(noBtn);

    // Bring dialog to front
    dialogContainer.setDepth(1000);
  }

  /**
   * Start offline mode with bots
   */
  private startOfflineMode() {
    const offlineRoom = new OfflineRoomAdapter(this.nickname);
    this.scene.start('GameScene', { room: offlineRoom, nickname: this.nickname });
  }

  shutdown() {
    // Cleanup timer
    if (this.refreshTimer) {
      this.refreshTimer.remove();
      this.refreshTimer = undefined;
    }
  }
}
