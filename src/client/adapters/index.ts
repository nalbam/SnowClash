/**
 * Room Adapters
 *
 * Abstracts online (Colyseus) and offline (local) room connections
 * so GameScene can work identically in both modes.
 */

export * from './RoomAdapter';
export { OnlineRoomAdapter } from './OnlineRoomAdapter';
export { OfflineRoomAdapter } from './OfflineRoomAdapter';
