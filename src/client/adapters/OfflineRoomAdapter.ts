/**
 * Offline Room Adapter
 *
 * Implements RoomAdapter using local GameEngine for offline single-player mode.
 * Creates a 3v3 game with bots when server is unavailable.
 */

import { RoomAdapter, RoomState } from './RoomAdapter';
import { GameEngine, Player, Snowball } from '../../shared/core';

// Simple bot nickname generator for client-side
const BOT_NAMES = [
  'Snowman',
  'Frosty',
  'Blizzard',
  'Icicle',
  'Flurry',
  'Glacier',
  'Powder',
  'Sleet',
  'Avalanche',
  'Crystal',
];

function generateBotNickname(): string {
  const name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
  const number = String(Math.floor(Math.random() * 100)).padStart(2, '0');
  return `${name}${number}`;
}

export class OfflineRoomAdapter implements RoomAdapter {
  private engine: GameEngine;
  private _sessionId: string;
  private _state: RoomState;
  private stateChangeCallbacks: ((state: RoomState) => void)[] = [];
  private messageCallbacks: Map<string, ((message: any) => void)[]> = new Map();
  private leaveCallbacks: ((code?: number) => void)[] = [];
  private updateInterval?: number;

  constructor(playerNickname: string) {
    this._sessionId = `offline_${Date.now()}`;

    // Initialize state
    this._state = {
      players: new Map(),
      snowballs: new Map(),
      phase: 'lobby',
      winner: '',
      mapSize: 800,
    };

    // Create engine with callbacks
    this.engine = new GameEngine({
      onPlayerAdd: (player) => this.handlePlayerAdd(player),
      onPlayerUpdate: (player) => this.handlePlayerUpdate(player),
      onPlayerRemove: (id) => this.handlePlayerRemove(id),
      onSnowballAdd: (snowball) => this.handleSnowballAdd(snowball),
      onSnowballUpdate: (snowball) => this.handleSnowballUpdate(snowball),
      onSnowballRemove: (id) => this.handleSnowballRemove(id),
      onGameEnd: (winner) => this.handleGameEnd(winner),
      onStateChange: (state) => this.handleStateChange(state),
    });

    // Add human player to blue team
    this.engine.addPlayer(this._sessionId, playerNickname, 'blue', false);

    // Fill teams with bots (2 blue bots + 3 red bots for 3v3)
    this.engine.fillTeamsWithBots(generateBotNickname);

    // Start game immediately (skip lobby)
    this.engine.startGame();

    // Start game loop at 60 FPS
    this.updateInterval = window.setInterval(() => {
      this.engine.update(Date.now());
    }, 1000 / 60);
  }

  get state(): RoomState {
    return this._state;
  }

  get sessionId(): string {
    return this._sessionId;
  }

  get isOffline(): boolean {
    return true;
  }

  private handlePlayerAdd(player: Player): void {
    this._state.players.set(player.id, this.convertPlayer(player));
    this.notifyStateChange();
  }

  private handlePlayerUpdate(player: Player): void {
    this._state.players.set(player.id, this.convertPlayer(player));
    this.notifyStateChange();
  }

  private handlePlayerRemove(id: string): void {
    this._state.players.delete(id);
    this.notifyStateChange();
  }

  private handleSnowballAdd(snowball: Snowball): void {
    this._state.snowballs.set(snowball.id, this.convertSnowball(snowball));
    this.notifyStateChange();
  }

  private handleSnowballUpdate(snowball: Snowball): void {
    this._state.snowballs.set(snowball.id, this.convertSnowball(snowball));
    this.notifyStateChange();
  }

  private handleSnowballRemove(id: string): void {
    this._state.snowballs.delete(id);
    this.notifyStateChange();
  }

  private handleGameEnd(winner: string): void {
    this._state.winner = winner;
    this._state.phase = 'ended';

    // Notify via message callback (same as Colyseus server)
    const callbacks = this.messageCallbacks.get('gameEnded');
    callbacks?.forEach((cb) => cb({ winner }));

    this.notifyStateChange();
  }

  private handleStateChange(state: any): void {
    this._state.phase = state.phase;
    this._state.winner = state.winner;
    this.notifyStateChange();
  }

  /**
   * Convert core Player to Colyseus-like player object
   */
  private convertPlayer(player: Player): any {
    return {
      sessionId: player.id,
      nickname: player.nickname,
      team: player.team,
      isBot: player.isBot,
      x: player.x,
      y: player.y,
      energy: player.energy,
      isStunned: player.isStunned,
      isReady: true,
      isHost: player.id === this._sessionId,
      // Mock onChange for Colyseus compatibility (not actually used in offline mode)
      onChange: () => {},
    };
  }

  /**
   * Convert core Snowball to Colyseus-like snowball object
   */
  private convertSnowball(snowball: Snowball): any {
    return {
      id: snowball.id,
      ownerId: snowball.ownerId,
      team: snowball.team,
      x: snowball.x,
      y: snowball.y,
      velocityX: snowball.velocityX,
      velocityY: snowball.velocityY,
      damage: snowball.damage,
      // Mock onChange for Colyseus compatibility
      onChange: () => {},
    };
  }

  private notifyStateChange(): void {
    this.stateChangeCallbacks.forEach((cb) => cb(this._state));
  }

  send(type: string, message: any): void {
    if (this._state.phase !== 'playing') return;

    switch (type) {
      case 'move':
        this.engine.handleMove(this._sessionId, message.x, message.y);
        break;
      case 'throwSnowball':
        this.engine.handleThrow(this._sessionId, message.chargeLevel);
        break;
    }
  }

  onStateChange(callback: (state: RoomState) => void): void {
    this.stateChangeCallbacks.push(callback);
    // Immediately call with current state
    callback(this._state);
  }

  onMessage(type: string, callback: (message: any) => void): void {
    if (!this.messageCallbacks.has(type)) {
      this.messageCallbacks.set(type, []);
    }
    this.messageCallbacks.get(type)!.push(callback);
  }

  onLeave(callback: (code?: number) => void): void {
    this.leaveCallbacks.push(callback);
  }

  leave(): void {
    this.leaveCallbacks.forEach((cb) => cb(1000));
  }

  destroy(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }
    this.engine.destroy();
    this.stateChangeCallbacks = [];
    this.messageCallbacks.clear();
    this.leaveCallbacks = [];
  }
}
