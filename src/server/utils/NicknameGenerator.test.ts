import { generateNickname, generateBotNickname } from './NicknameGenerator';

describe('NicknameGenerator', () => {
  describe('generateNickname', () => {
    it('should generate a nickname in the correct format', () => {
      const nickname = generateNickname();

      // Check format: AdjectiveNounNumber (e.g., BraveWolf42)
      expect(nickname).toMatch(/^[A-Z][a-z]+[A-Z][a-z]+\d{1,2}$/);
    });

    it('should generate a nickname with a number between 0-99', () => {
      const nickname = generateNickname();
      const number = parseInt(nickname.match(/\d+$/)?.[0] || '');

      expect(number).toBeGreaterThanOrEqual(0);
      expect(number).toBeLessThan(100);
    });

    it('should generate different nicknames on multiple calls', () => {
      const nicknames = new Set<string>();

      // Generate 50 nicknames
      for (let i = 0; i < 50; i++) {
        nicknames.add(generateNickname());
      }

      // With 20 adjectives * 20 nouns * 100 numbers = 40,000 combinations
      // 50 random selections should very likely produce unique results
      expect(nicknames.size).toBeGreaterThan(40);
    });

    it('should only use valid adjectives and nouns', () => {
      const validAdjectives = [
        'Brave', 'Swift', 'Mighty', 'Clever', 'Fierce',
        'Silent', 'Wild', 'Noble', 'Lucky', 'Bold',
        'Happy', 'Sneaky', 'Frozen', 'Icy', 'Snowy',
        'Frosty', 'Chilly', 'Arctic', 'Polar', 'Winter'
      ];

      const validNouns = [
        'Wolf', 'Bear', 'Eagle', 'Tiger', 'Fox',
        'Dragon', 'Phoenix', 'Hawk', 'Panther', 'Lion',
        'Penguin', 'Seal', 'Yeti', 'Husky', 'Owl',
        'Snowman', 'Blizzard', 'Glacier', 'Avalanche', 'Storm'
      ];

      for (let i = 0; i < 20; i++) {
        const nickname = generateNickname();
        const hasValidAdjective = validAdjectives.some(adj => nickname.startsWith(adj));
        expect(hasValidAdjective).toBe(true);

        // Check if contains a valid noun (after adjective, before number)
        const hasValidNoun = validNouns.some(noun => nickname.includes(noun));
        expect(hasValidNoun).toBe(true);
      }
    });

    it('should not exceed 20 characters in length', () => {
      // Longest possible: "Arctic" (6) + "Avalanche" (9) + "99" (2) = 17 chars
      for (let i = 0; i < 20; i++) {
        const nickname = generateNickname();
        expect(nickname.length).toBeLessThanOrEqual(20);
      }
    });
  });

  describe('generateBotNickname', () => {
    it('should generate a bot nickname in the correct format', () => {
      const botNickname = generateBotNickname();

      // Check format: BotNameNumber (e.g., SnowBot42)
      expect(botNickname).toMatch(/Bot\d{1,2}$/);
    });

    it('should generate a bot nickname with a number between 0-99', () => {
      const botNickname = generateBotNickname();
      const number = parseInt(botNickname.match(/\d+$/)?.[0] || '');

      expect(number).toBeGreaterThanOrEqual(0);
      expect(number).toBeLessThan(100);
    });

    it('should only use valid bot names', () => {
      const validBotNames = [
        'SnowBot', 'FrostBot', 'IceBot', 'BlizzardBot', 'WinterBot',
        'ChillyBot', 'ArcticBot', 'PolarBot', 'GlacierBot', 'FlurryBot'
      ];

      for (let i = 0; i < 20; i++) {
        const botNickname = generateBotNickname();
        const hasValidBotName = validBotNames.some(name => botNickname.startsWith(name));
        expect(hasValidBotName).toBe(true);
      }
    });

    it('should generate different bot nicknames on multiple calls', () => {
      const botNicknames = new Set<string>();

      // Generate 30 bot nicknames
      for (let i = 0; i < 30; i++) {
        botNicknames.add(generateBotNickname());
      }

      // With 10 names * 100 numbers = 1,000 combinations
      // 30 random selections should produce mostly unique results
      expect(botNicknames.size).toBeGreaterThan(20);
    });

    it('should not exceed 20 characters in length', () => {
      // Longest possible: "BlizzardBot" (11) + "99" (2) = 13 chars
      for (let i = 0; i < 20; i++) {
        const botNickname = generateBotNickname();
        expect(botNickname.length).toBeLessThanOrEqual(20);
      }
    });
  });
});
