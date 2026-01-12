import { Schema, type } from '@colyseus/schema';

export class SnowballSchema extends Schema {
  @type('string') id: string = '';
  @type('string') ownerId: string = '';
  @type('number') x: number = 0;
  @type('number') y: number = 0;
  @type('number') velocityX: number = 0;
  @type('number') velocityY: number = 0;
  @type('number') damage: number = 4;
  @type('string') team: string = '';
}
