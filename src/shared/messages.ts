// Client -> Server messages
export interface SetProfileMessage {
  nickname: string;
  googleId?: string;
  photoUrl?: string;
}

export interface SelectTeamMessage {
  team: 'red' | 'blue';
}

export interface ReadyMessage {
  ready: boolean;
}

export interface StartGameMessage {}

export interface MoveMessage {
  x: number; // -1, 0, or 1
  y: number; // -1, 0, or 1
}

export interface ThrowSnowballMessage {
  chargeLevel: number; // 0-1
}

// Server -> Client messages
export interface GameEndedMessage {
  winner: 'red' | 'blue' | 'draw';
}

export interface PlayerKickedMessage {
  sessionId: string;
  reason: string;
}

export interface ErrorMessage {
  message: string;
  code?: string;
  metadata?: Record<string, any>;
}

// Room options
export interface RoomOptions {
  roomName?: string;
  nickname?: string;
  googleId?: string;
  photoUrl?: string;
}

// Scene init data
export interface GameSceneInitData {
  room: any; // Room type from colyseus.js
}

export interface LobbySceneInitData {
  room: any;
  nickname: string;
}

// Type guards
export function isSetProfileMessage(msg: any): msg is SetProfileMessage {
  return typeof msg === 'object' && typeof msg.nickname === 'string';
}

export function isSelectTeamMessage(msg: any): msg is SelectTeamMessage {
  return typeof msg === 'object' && (msg.team === 'red' || msg.team === 'blue');
}

export function isReadyMessage(msg: any): msg is ReadyMessage {
  return typeof msg === 'object' && typeof msg.ready === 'boolean';
}

export function isMoveMessage(msg: any): msg is MoveMessage {
  return typeof msg === 'object' &&
         typeof msg.x === 'number' &&
         typeof msg.y === 'number';
}

export function isThrowSnowballMessage(msg: any): msg is ThrowSnowballMessage {
  return typeof msg === 'object' && typeof msg.chargeLevel === 'number';
}
