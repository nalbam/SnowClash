/**
 * Online Room Adapter
 *
 * Wraps Colyseus Room to implement RoomAdapter interface.
 * Used for online multiplayer mode.
 */

import { Room } from 'colyseus.js';
import { RoomAdapter, RoomState } from './RoomAdapter';

export class OnlineRoomAdapter implements RoomAdapter {
  private room: Room;
  private stateChangeCallbacks: ((state: RoomState) => void)[] = [];
  private messageCallbacks: Map<string, ((message: any) => void)[]> = new Map();
  private leaveCallbacks: ((code?: number) => void)[] = [];

  constructor(room: Room) {
    this.room = room;

    // Setup internal state change listener
    this.room.onStateChange((state) => {
      const convertedState = this.convertState(state);
      this.stateChangeCallbacks.forEach((cb) => cb(convertedState));
    });

    // Setup leave listener
    this.room.onLeave((code) => {
      this.leaveCallbacks.forEach((cb) => cb(code));
    });
  }

  get state(): RoomState {
    return this.convertState(this.room.state);
  }

  get sessionId(): string {
    return this.room.sessionId;
  }

  get isOffline(): boolean {
    return false;
  }

  /**
   * Convert Colyseus state to RoomState interface
   */
  private convertState(colyseusState: any): RoomState {
    return {
      players: colyseusState?.players || new Map(),
      snowballs: colyseusState?.snowballs || new Map(),
      phase: colyseusState?.phase || 'lobby',
      winner: colyseusState?.winner || '',
      mapSize: colyseusState?.mapSize || 800,
    };
  }

  send(type: string, message: any): void {
    this.room.send(type, message);
  }

  onStateChange(callback: (state: RoomState) => void): void {
    this.stateChangeCallbacks.push(callback);
  }

  onMessage(type: string, callback: (message: any) => void): void {
    if (!this.messageCallbacks.has(type)) {
      this.messageCallbacks.set(type, []);
      // Register with Colyseus room
      this.room.onMessage(type, (msg) => {
        this.messageCallbacks.get(type)?.forEach((cb) => cb(msg));
      });
    }
    this.messageCallbacks.get(type)!.push(callback);
  }

  onLeave(callback: (code?: number) => void): void {
    this.leaveCallbacks.push(callback);
  }

  leave(): void {
    this.room.leave();
  }

  destroy(): void {
    this.stateChangeCallbacks = [];
    this.messageCallbacks.clear();
    this.leaveCallbacks = [];
  }

  /**
   * Get underlying Colyseus room for collection listeners (onAdd, onRemove)
   * This is needed because MapSchema listeners are Colyseus-specific
   */
  getColyseusRoom(): Room {
    return this.room;
  }
}
