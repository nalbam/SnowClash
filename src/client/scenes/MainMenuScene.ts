import Phaser from 'phaser';
import { Client, Room } from 'colyseus.js';
import { config } from '../config';
import { generateCharacterTextures, createCharacterAnimations } from '../assets/PixelCharacter';

interface RoomInfo {
  roomId: string;
  roomName: string;
  playerCount: number;
  maxPlayers: number;
}

export class MainMenuScene extends Phaser.Scene {
  private client?: Client;
  private nickname: string = '';
  private nicknameText?: Phaser.GameObjects.Text;
  private roomListContainer?: Phaser.GameObjects.Container;
  private rooms: RoomInfo[] = [];

  constructor() {
    super({ key: 'MainMenuScene' });
  }

  async create() {
    this.cameras.main.setBackgroundColor('#e8f4f8');
    this.client = new Client(config.wsUrl);

    // Generate pixel art textures
    generateCharacterTextures(this);
    createCharacterAnimations(this);

    // Generate random nickname
    await this.generateNickname();

    this.createUI();
    this.refreshRoomList();

    // Auto-refresh room list every 5 seconds
    this.time.addEvent({
      delay: 5000,
      callback: () => this.refreshRoomList(),
      loop: true
    });
  }

  private async generateNickname() {
    try {
      const response = await fetch(`${config.apiUrl}/api/nickname`);
      const data = await response.json() as { nickname: string };
      this.nickname = data.nickname;
    } catch (error) {
      this.nickname = 'Player' + Math.floor(Math.random() * 1000);
    }
  }

  private createUI() {
    const centerX = this.cameras.main.width / 2;

    // Title
    this.add.text(centerX, 40, 'SnowClash', {
      fontSize: '48px',
      color: '#333333',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Red team character (left of title)
    const redCharacter = this.add.sprite(centerX - 200, 40, 'character_red_idle');
    redCharacter.setScale(2);
    this.tweens.add({
      targets: redCharacter,
      y: 35,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // Blue team character (right of title)
    const blueCharacter = this.add.sprite(centerX + 200, 40, 'character_blue_idle');
    blueCharacter.setScale(2);
    blueCharacter.setFlipX(true); // Face toward center
    this.tweens.add({
      targets: blueCharacter,
      y: 35,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      delay: 400 // Offset animation for visual interest
    });

    // Nickname section
    this.add.text(centerX, 100, 'Your Nickname:', {
      fontSize: '18px',
      color: '#666666'
    }).setOrigin(0.5);

    this.nicknameText = this.add.text(centerX, 130, this.nickname, {
      fontSize: '24px',
      color: '#008800',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Change nickname button
    const changeBtn = this.add.text(centerX, 165, '[Change]', {
      fontSize: '14px',
      color: '#888888'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    changeBtn.on('pointerdown', () => this.changeNickname());
    changeBtn.on('pointerover', () => changeBtn.setColor('#333333'));
    changeBtn.on('pointerout', () => changeBtn.setColor('#888888'));

    // Quick Play button
    const quickPlayBtn = this.add.text(centerX - 100, 220, 'Quick Play', {
      fontSize: '20px',
      color: '#ffffff',
      backgroundColor: '#4CAF50',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    quickPlayBtn.on('pointerdown', () => this.quickPlay());
    quickPlayBtn.on('pointerover', () => quickPlayBtn.setStyle({ backgroundColor: '#66BB6A' }));
    quickPlayBtn.on('pointerout', () => quickPlayBtn.setStyle({ backgroundColor: '#4CAF50' }));

    // Create Room button
    const createRoomBtn = this.add.text(centerX + 100, 220, 'Create Room', {
      fontSize: '20px',
      color: '#ffffff',
      backgroundColor: '#2196F3',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    createRoomBtn.on('pointerdown', () => this.createRoom());
    createRoomBtn.on('pointerover', () => createRoomBtn.setStyle({ backgroundColor: '#42A5F5' }));
    createRoomBtn.on('pointerout', () => createRoomBtn.setStyle({ backgroundColor: '#2196F3' }));

    // Room list header
    this.add.text(centerX, 280, 'Available Rooms', {
      fontSize: '20px',
      color: '#333333'
    }).setOrigin(0.5);

    // Refresh button (positioned to the right)
    const refreshBtn = this.add.text(560, 280, '[Refresh]', {
      fontSize: '12px',
      color: '#888888'
    }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });

    refreshBtn.on('pointerdown', () => this.refreshRoomList());
    refreshBtn.on('pointerover', () => refreshBtn.setColor('#333333'));
    refreshBtn.on('pointerout', () => refreshBtn.setColor('#888888'));

    // Room list container
    this.roomListContainer = this.add.container(0, 320);
  }

  private async changeNickname() {
    await this.generateNickname();
    if (this.nicknameText) {
      this.nicknameText.setText(this.nickname);
    }
  }

  private async refreshRoomList() {
    try {
      const response = await fetch(`${config.apiUrl}/api/rooms`);
      this.rooms = await response.json() as RoomInfo[];
      this.updateRoomListUI();
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

    this.rooms.forEach((room, index) => {
      const y = index * 45;

      // Room background (adjusted for 600px width)
      const bg = this.add.graphics();
      bg.fillStyle(0xffffff, 0.8);
      bg.lineStyle(1, 0xcccccc, 1);
      bg.fillRoundedRect(20, y, 560, 38, 8);
      bg.strokeRoundedRect(20, y, 560, 38, 8);

      // Room name
      const nameText = this.add.text(35, y + 10, room.roomName, {
        fontSize: '14px',
        color: '#333333'
      });

      // Player count
      const countText = this.add.text(420, y + 10, `${room.playerCount}/${room.maxPlayers}`, {
        fontSize: '14px',
        color: room.playerCount >= room.maxPlayers ? '#cc0000' : '#008800'
      });

      // Join button
      const joinBtn = this.add.text(500, y + 8, 'Join', {
        fontSize: '14px',
        color: '#ffffff',
        backgroundColor: '#FF9800',
        padding: { x: 12, y: 5 }
      }).setInteractive({ useHandCursor: true });

      joinBtn.on('pointerdown', () => this.joinRoom(room.roomId));
      joinBtn.on('pointerover', () => joinBtn.setStyle({ backgroundColor: '#FFB74D' }));
      joinBtn.on('pointerout', () => joinBtn.setStyle({ backgroundColor: '#FF9800' }));

      this.roomListContainer!.add([bg, nameText, countText, joinBtn]);
    });
  }

  private async quickPlay() {
    if (!this.client) return;

    try {
      const room = await this.client.joinOrCreate('game_room', {
        nickname: this.nickname
      });
      this.scene.start('LobbyScene', { room, nickname: this.nickname });
    } catch (error) {
      console.error('Failed to quick play:', error);
    }
  }

  private async createRoom() {
    if (!this.client) return;

    try {
      const roomName = `${this.nickname}'s Room`;
      const room = await this.client.create('game_room', {
        roomName,
        nickname: this.nickname
      });
      this.scene.start('LobbyScene', { room, nickname: this.nickname });
    } catch (error) {
      console.error('Failed to create room:', error);
    }
  }

  private async joinRoom(roomId: string) {
    if (!this.client) return;

    try {
      const room = await this.client.joinById(roomId, {
        nickname: this.nickname
      });
      this.scene.start('LobbyScene', { room, nickname: this.nickname });
    } catch (error) {
      console.error('Failed to join room:', error);
    }
  }
}
