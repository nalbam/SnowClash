import { Schema, type } from '@colyseus/schema';

export class PlayerSchema extends Schema {
  @type('string') sessionId: string = '';
  @type('string') nickname: string = '';
  @type('string') googleId: string = '';
  @type('string') photoUrl: string = '';
  @type('string') team: string = ''; // 'red' or 'blue'
  @type('boolean') isReady: boolean = false;
  @type('boolean') isHost: boolean = false;
  @type('number') x: number = 0;
  @type('number') y: number = 0;
  @type('number') energy: number = 10;
  @type('boolean') isStunned: boolean = false;
  @type('number') joinedAt: number = Date.now();
}
