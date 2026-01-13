import { Schema, type, MapSchema } from '@colyseus/schema';
import { PlayerSchema } from './PlayerSchema';
import { SnowballSchema } from './SnowballSchema';

export class GameState extends Schema {
  @type({ map: PlayerSchema }) players = new MapSchema<PlayerSchema>();
  @type({ map: SnowballSchema }) snowballs = new MapSchema<SnowballSchema>();
  @type('string') phase: string = 'lobby'; // 'lobby', 'playing', 'ended'
  @type('string') winner: string = ''; // 'red', 'blue', or ''
  @type('number') mapSize: number = 600;
  @type('string') roomName: string = '';
  @type('number') botCount: number = 0;
}
