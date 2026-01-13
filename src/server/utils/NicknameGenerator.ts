const adjectives = [
  'Brave', 'Swift', 'Mighty', 'Clever', 'Fierce',
  'Silent', 'Wild', 'Noble', 'Lucky', 'Bold',
  'Happy', 'Sneaky', 'Frozen', 'Icy', 'Snowy',
  'Frosty', 'Chilly', 'Arctic', 'Polar', 'Winter'
];

const nouns = [
  'Wolf', 'Bear', 'Eagle', 'Tiger', 'Fox',
  'Dragon', 'Phoenix', 'Hawk', 'Panther', 'Lion',
  'Penguin', 'Seal', 'Yeti', 'Husky', 'Owl',
  'Snowman', 'Blizzard', 'Glacier', 'Avalanche', 'Storm'
];

export function generateNickname(): string {
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const number = Math.floor(Math.random() * 100);
  return `${adjective}${noun}${number}`;
}

export function generateBotNickname(): string {
  const botNames = [
    'SnowBot', 'FrostBot', 'IceBot', 'BlizzardBot', 'WinterBot',
    'ChillyBot', 'ArcticBot', 'PolarBot', 'GlacierBot', 'FlurryBot'
  ];
  const name = botNames[Math.floor(Math.random() * botNames.length)];
  const number = Math.floor(Math.random() * 100);
  return `${name}${number}`;
}
