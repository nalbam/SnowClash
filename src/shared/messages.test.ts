import {
  SetProfileMessage,
  SelectTeamMessage,
  ReadyMessage,
  MoveMessage,
  ThrowSnowballMessage,
  isSetProfileMessage,
  isSelectTeamMessage,
  isReadyMessage,
  isMoveMessage,
  isThrowSnowballMessage,
} from './messages';

describe('Message Type Guards', () => {
  describe('isSetProfileMessage', () => {
    it('should return true for valid SetProfileMessage', () => {
      const validMessages: SetProfileMessage[] = [
        { nickname: 'Player1' },
        { nickname: 'Player1', googleId: '123' },
        { nickname: 'Player1', photoUrl: 'https://example.com/photo.jpg' },
        { nickname: 'Player1', googleId: '123', photoUrl: 'https://example.com/photo.jpg' },
      ];

      validMessages.forEach(msg => {
        expect(isSetProfileMessage(msg)).toBe(true);
      });
    });

    it('should return false for invalid messages', () => {
      const invalidMessages = [
        null,
        undefined,
        {},
        { googleId: '123' },
        { photoUrl: 'url' },
        { nickname: 123 },
        'string',
        42,
        [],
      ];

      invalidMessages.forEach(msg => {
        expect(isSetProfileMessage(msg)).toBe(false);
      });
    });
  });

  describe('isSelectTeamMessage', () => {
    it('should return true for valid SelectTeamMessage', () => {
      const validMessages: SelectTeamMessage[] = [
        { team: 'red' },
        { team: 'blue' },
      ];

      validMessages.forEach(msg => {
        expect(isSelectTeamMessage(msg)).toBe(true);
      });
    });

    it('should return false for invalid messages', () => {
      const invalidMessages = [
        null,
        undefined,
        {},
        { team: 'green' },
        { team: 'RED' },
        { team: 123 },
        'red',
        { team: 'red', extra: 'field' }, // Extra fields are ok, but team must be valid
      ];

      invalidMessages.forEach(msg => {
        const result = isSelectTeamMessage(msg);
        if (msg && typeof msg === 'object' && 'team' in msg && (msg.team === 'red' || msg.team === 'blue')) {
          expect(result).toBe(true);
        } else {
          expect(result).toBe(false);
        }
      });
    });
  });

  describe('isReadyMessage', () => {
    it('should return true for valid ReadyMessage', () => {
      const validMessages: ReadyMessage[] = [
        { ready: true },
        { ready: false },
      ];

      validMessages.forEach(msg => {
        expect(isReadyMessage(msg)).toBe(true);
      });
    });

    it('should return false for invalid messages', () => {
      const invalidMessages = [
        null,
        undefined,
        {},
        { ready: 'true' },
        { ready: 1 },
        { ready: 0 },
        'true',
        true,
        [],
      ];

      invalidMessages.forEach(msg => {
        expect(isReadyMessage(msg)).toBe(false);
      });
    });
  });

  describe('isMoveMessage', () => {
    it('should return true for valid MoveMessage', () => {
      const validMessages: MoveMessage[] = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: -1 },
        { x: 1, y: 1 },
        { x: -1, y: -1 },
        { x: 0.5, y: 0.5 }, // Fractional values are valid numbers
      ];

      validMessages.forEach(msg => {
        expect(isMoveMessage(msg)).toBe(true);
      });
    });

    it('should return false for invalid messages', () => {
      const invalidMessages = [
        null,
        undefined,
        {},
        { x: 0 },
        { y: 0 },
        { x: '0', y: 0 },
        { x: 0, y: '0' },
        { x: null, y: 0 },
        { x: 0, y: null },
        'string',
        [],
      ];

      invalidMessages.forEach(msg => {
        expect(isMoveMessage(msg)).toBe(false);
      });
    });
  });

  describe('isThrowSnowballMessage', () => {
    it('should return true for valid ThrowSnowballMessage', () => {
      const validMessages: ThrowSnowballMessage[] = [
        { chargeLevel: 0 },
        { chargeLevel: 0.5 },
        { chargeLevel: 1 },
        { chargeLevel: 0.7 },
        { chargeLevel: 0.001 },
      ];

      validMessages.forEach(msg => {
        expect(isThrowSnowballMessage(msg)).toBe(true);
      });
    });

    it('should return false for invalid messages', () => {
      const invalidMessages = [
        null,
        undefined,
        {},
        { chargeLevel: '0.5' },
        { chargeLevel: null },
        { charge: 0.5 },
        'string',
        0.5,
        [],
      ];

      invalidMessages.forEach(msg => {
        expect(isThrowSnowballMessage(msg)).toBe(false);
      });
    });
  });
});

describe('Message Type Interfaces', () => {
  it('SetProfileMessage should accept nickname and optional fields', () => {
    const msg1: SetProfileMessage = { nickname: 'Player1' };
    const msg2: SetProfileMessage = { nickname: 'Player1', googleId: '123' };
    const msg3: SetProfileMessage = { nickname: 'Player1', photoUrl: 'url' };
    const msg4: SetProfileMessage = { nickname: 'Player1', googleId: '123', photoUrl: 'url' };

    expect(msg1).toBeDefined();
    expect(msg2).toBeDefined();
    expect(msg3).toBeDefined();
    expect(msg4).toBeDefined();
  });

  it('SelectTeamMessage should only accept red or blue', () => {
    const msg1: SelectTeamMessage = { team: 'red' };
    const msg2: SelectTeamMessage = { team: 'blue' };

    expect(msg1.team).toBe('red');
    expect(msg2.team).toBe('blue');
  });

  it('ReadyMessage should accept boolean ready field', () => {
    const msg1: ReadyMessage = { ready: true };
    const msg2: ReadyMessage = { ready: false };

    expect(msg1.ready).toBe(true);
    expect(msg2.ready).toBe(false);
  });

  it('MoveMessage should accept x and y numbers', () => {
    const msg: MoveMessage = { x: 1, y: -1 };

    expect(msg.x).toBe(1);
    expect(msg.y).toBe(-1);
  });

  it('ThrowSnowballMessage should accept chargeLevel number', () => {
    const msg: ThrowSnowballMessage = { chargeLevel: 0.7 };

    expect(msg.chargeLevel).toBe(0.7);
  });
});

describe('Type Guard Edge Cases', () => {
  it('should handle objects with extra properties', () => {
    const msgWithExtra = { nickname: 'Player', extra: 'field', another: 123 };
    expect(isSetProfileMessage(msgWithExtra)).toBe(true);
  });

  it('should handle null vs undefined', () => {
    expect(isSetProfileMessage(null)).toBe(false);
    expect(isSetProfileMessage(undefined)).toBe(false);

    expect(isSelectTeamMessage(null)).toBe(false);
    expect(isSelectTeamMessage(undefined)).toBe(false);

    expect(isReadyMessage(null)).toBe(false);
    expect(isReadyMessage(undefined)).toBe(false);

    expect(isMoveMessage(null)).toBe(false);
    expect(isMoveMessage(undefined)).toBe(false);

    expect(isThrowSnowballMessage(null)).toBe(false);
    expect(isThrowSnowballMessage(undefined)).toBe(false);
  });

  it('should handle primitive types', () => {
    const primitives = ['string', 42, true, Symbol('test')];

    primitives.forEach(value => {
      expect(isSetProfileMessage(value)).toBe(false);
      expect(isSelectTeamMessage(value)).toBe(false);
      expect(isReadyMessage(value)).toBe(false);
      expect(isMoveMessage(value)).toBe(false);
      expect(isThrowSnowballMessage(value)).toBe(false);
    });
  });

  it('should handle arrays', () => {
    const arrays = [[], [1, 2, 3], ['red'], [{ team: 'red' }]];

    arrays.forEach(value => {
      expect(isSetProfileMessage(value)).toBe(false);
      expect(isSelectTeamMessage(value)).toBe(false);
      expect(isReadyMessage(value)).toBe(false);
      expect(isMoveMessage(value)).toBe(false);
      expect(isThrowSnowballMessage(value)).toBe(false);
    });
  });
});
