/**
 * Environment Pixel Art Assets for SnowClash
 * 나무, 바위, 수풀 등 맵 장식용 픽셀 아트
 */

// 환경 색상 팔레트
const ENV_PALETTE = {
  TRANSPARENT: null,

  // 나무
  TREE_TRUNK: 0x8B4513,
  TREE_TRUNK_DARK: 0x5D2E0C,
  TREE_LEAF: 0x228B22,
  TREE_LEAF_LIGHT: 0x32CD32,
  TREE_LEAF_DARK: 0x006400,

  // 바위
  ROCK_MAIN: 0x808080,
  ROCK_LIGHT: 0xA0A0A0,
  ROCK_DARK: 0x606060,
  ROCK_DARKER: 0x404040,

  // 수풀
  BUSH_MAIN: 0x2E8B57,
  BUSH_LIGHT: 0x3CB371,
  BUSH_DARK: 0x1E5631,

  // 눈
  SNOW: 0xFFFFFF,
  SNOW_SHADOW: 0xE8E8E8,
};

// 나무 (24x32) - 눈 덮인 소나무 스타일
// 0: 투명, 1: 줄기, 2: 줄기어두움, 3: 잎, 4: 잎밝음, 5: 잎어두움, 6: 눈, 7: 눈그림자
const TREE_SMALL = [
  '000000000066000000000000',
  '000000000666600000000000',
  '000000006777660000000000',
  '000000067777766000000000',
  '000000066666666000000000',
  '000000555333345500000000',
  '000005553333334555000000',
  '000055533333333455500000',
  '000553333333333345550000',
  '000006677766000000000000',
  '000066777776600000000000',
  '000666666666660000000000',
  '005553333333455500000000',
  '055533333333345555000000',
  '555333333333334555550000',
  '553333333333333455550000',
  '000067776600000000000000',
  '000677777660000000000000',
  '006666666666000000000000',
  '055533333345550000000000',
  '555333333334555500000000',
  '553333333333455550000000',
  '533333333333345555000000',
  '333333333333334555500000',
  '000000001210000000000000',
  '000000001210000000000000',
  '000000001210000000000000',
  '000000012221000000000000',
  '000000012221000000000000',
  '000000677776000000000000',
  '000006777776000000000000',
  '000000000000000000000000',
];

// 작은 나무 (16x24)
const TREE_TINY = [
  '0000006600000000',
  '0000066660000000',
  '0000677766000000',
  '0006666666600000',
  '0055333345500000',
  '0553333334550000',
  '5533333333455000',
  '0006776600000000',
  '0067777660000000',
  '0666666666000000',
  '5553333455500000',
  '5533333345550000',
  '5333333334555000',
  '3333333333455500',
  '0000121000000000',
  '0000121000000000',
  '0000121000000000',
  '0001222100000000',
  '0006777600000000',
  '0067777600000000',
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
];

// 바위 (16x16)
// 0: 투명, 1: 메인, 2: 밝음, 3: 어두움, 4: 더어두움, 5: 눈, 6: 눈그림자
const ROCK_MEDIUM = [
  '0000055550000000',
  '0005566665500000',
  '0056666666650000',
  '0566611111665000',
  '0566211111366500',
  '5662211111133650',
  '5621111111113365',
  '5621111111113365',
  '5611111111111335',
  '5611111111111335',
  '5611111133311335',
  '5611113333331335',
  '0561133333331350',
  '0056133333331500',
  '0005533333335000',
  '0000055555550000',
];

// 작은 바위 (12x12)
const ROCK_SMALL = [
  '000055500000',
  '005566655000',
  '056611116500',
  '562111111365',
  '561111111335',
  '561111111335',
  '561111133335',
  '561113333335',
  '056133333350',
  '005533333500',
  '000555555000',
  '000000000000',
];

// 아주 작은 바위 (8x8)
const ROCK_TINY = [
  '00555000',
  '05611650',
  '56111135',
  '56111135',
  '56113335',
  '05633350',
  '00555500',
  '00000000',
];

// 수풀 (16x12)
// 0: 투명, 1: 메인, 2: 밝음, 3: 어두움, 4: 눈, 5: 눈그림자
const BUSH_MEDIUM = [
  '0000044400044000',
  '0004455540455400',
  '0045555554555540',
  '0455221112211540',
  '4552211112211554',
  '5522111111112255',
  '5521111111111255',
  '5521111111111255',
  '5521111113311255',
  '0552111133311550',
  '0055211133115500',
  '0005553333555000',
];

// 작은 수풀 (12x10)
const BUSH_SMALL = [
  '000044004000',
  '004455545400',
  '045522115540',
  '552211112255',
  '552111111255',
  '552111111255',
  '552111331255',
  '055211331550',
  '005533335500',
  '000555555000',
];

// 눈 덮인 돌 (10x8)
const SNOW_ROCK = [
  '0055555000',
  '0566666500',
  '5611111650',
  '5611111165',
  '5611113365',
  '5611333365',
  '0563333350',
  '0055555500',
];

type AssetType = 'tree_small' | 'tree_tiny' | 'rock_medium' | 'rock_small' | 'rock_tiny' | 'bush_medium' | 'bush_small' | 'snow_rock';

interface AssetConfig {
  data: string[];
  width: number;
  height: number;
}

const ASSET_CONFIGS: Record<AssetType, AssetConfig> = {
  tree_small: { data: TREE_SMALL, width: 24, height: 32 },
  tree_tiny: { data: TREE_TINY, width: 16, height: 24 },
  rock_medium: { data: ROCK_MEDIUM, width: 16, height: 16 },
  rock_small: { data: ROCK_SMALL, width: 12, height: 12 },
  rock_tiny: { data: ROCK_TINY, width: 8, height: 8 },
  bush_medium: { data: BUSH_MEDIUM, width: 16, height: 12 },
  bush_small: { data: BUSH_SMALL, width: 12, height: 10 },
  snow_rock: { data: SNOW_ROCK, width: 10, height: 8 },
};

/**
 * 픽셀 데이터를 Canvas에 그리기
 */
function drawEnvironmentAsset(
  ctx: CanvasRenderingContext2D,
  data: string[],
  assetType: AssetType
): void {
  // 자산 종류에 따른 색상 매핑
  let colorMap: Record<string, number | null>;

  if (assetType.startsWith('tree')) {
    colorMap = {
      '0': null,
      '1': ENV_PALETTE.TREE_TRUNK,
      '2': ENV_PALETTE.TREE_TRUNK_DARK,
      '3': ENV_PALETTE.TREE_LEAF,
      '4': ENV_PALETTE.TREE_LEAF_LIGHT,
      '5': ENV_PALETTE.TREE_LEAF_DARK,
      '6': ENV_PALETTE.SNOW,
      '7': ENV_PALETTE.SNOW_SHADOW,
    };
  } else if (assetType.startsWith('rock') || assetType === 'snow_rock') {
    colorMap = {
      '0': null,
      '1': ENV_PALETTE.ROCK_MAIN,
      '2': ENV_PALETTE.ROCK_LIGHT,
      '3': ENV_PALETTE.ROCK_DARK,
      '4': ENV_PALETTE.ROCK_DARKER,
      '5': ENV_PALETTE.SNOW,
      '6': ENV_PALETTE.SNOW_SHADOW,
    };
  } else {
    // bush
    colorMap = {
      '0': null,
      '1': ENV_PALETTE.BUSH_MAIN,
      '2': ENV_PALETTE.BUSH_LIGHT,
      '3': ENV_PALETTE.BUSH_DARK,
      '4': ENV_PALETTE.SNOW,
      '5': ENV_PALETTE.SNOW_SHADOW,
    };
  }

  for (let y = 0; y < data.length; y++) {
    const row = data[y];
    for (let x = 0; x < row.length; x++) {
      const colorCode = row[x];
      const color = colorMap[colorCode];

      if (color !== null && color !== undefined) {
        ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}

/**
 * 환경 텍스처 생성
 */
export function generateEnvironmentTextures(scene: Phaser.Scene): void {
  const assetTypes: AssetType[] = [
    'tree_small', 'tree_tiny',
    'rock_medium', 'rock_small', 'rock_tiny',
    'bush_medium', 'bush_small', 'snow_rock'
  ];

  for (const assetType of assetTypes) {
    const config = ASSET_CONFIGS[assetType];
    const canvas = document.createElement('canvas');
    canvas.width = config.width;
    canvas.height = config.height;
    const ctx = canvas.getContext('2d')!;

    drawEnvironmentAsset(ctx, config.data, assetType);

    scene.textures.addCanvas(`env_${assetType}`, canvas);
  }
}

/**
 * 맵 테두리와 대각선 경계에 장식물 배치
 * - 테두리: 나무만 배치
 * - 대각선 경계: 수풀과 바위만 배치
 * - 영역 내부: 배치하지 않음
 */
export function createEnvironmentDecorations(scene: Phaser.Scene, mapSize: number): Phaser.GameObjects.Container {
  const container = scene.add.container(0, 0);

  // 배치할 장식물 목록
  const decorations: Array<{ x: number; y: number; type: AssetType; scale: number; depth: number }> = [];

  // 상단 테두리 (나무만)
  for (let x = 30; x < mapSize - 30; x += 50 + Math.random() * 30) {
    const type = Math.random() > 0.4 ? 'tree_small' : 'tree_tiny';
    decorations.push({ x, y: 20 + Math.random() * 15, type, scale: 1, depth: 5 });
  }

  // 하단 테두리 (나무만)
  for (let x = 30; x < mapSize - 30; x += 50 + Math.random() * 30) {
    const type = Math.random() > 0.4 ? 'tree_small' : 'tree_tiny';
    decorations.push({ x, y: mapSize - 20 - Math.random() * 15, type, scale: 1, depth: mapSize });
  }

  // 왼쪽 테두리 (나무만)
  for (let y = 60; y < mapSize - 60; y += 60 + Math.random() * 30) {
    const type = Math.random() > 0.5 ? 'tree_small' : 'tree_tiny';
    decorations.push({ x: 15 + Math.random() * 15, y, type, scale: 1, depth: y });
  }

  // 오른쪽 테두리 (나무만)
  for (let y = 60; y < mapSize - 60; y += 60 + Math.random() * 30) {
    const type = Math.random() > 0.5 ? 'tree_small' : 'tree_tiny';
    decorations.push({ x: mapSize - 20 - Math.random() * 15, y, type, scale: 1, depth: y });
  }

  // 대각선 경계 (\ 방향) - 수풀과 바위만
  for (let i = 60; i < mapSize - 60; i += 40 + Math.random() * 25) {
    // 대각선 위치에서 약간의 랜덤 오프셋
    const offset = (Math.random() - 0.5) * 30;
    const x = i + offset;
    const y = i + offset;

    // 테두리와 겹치지 않는 범위에서만 배치
    if (x > 40 && x < mapSize - 40 && y > 50 && y < mapSize - 50) {
      const types: AssetType[] = ['rock_medium', 'rock_small', 'bush_medium', 'bush_small', 'snow_rock'];
      const type = types[Math.floor(Math.random() * types.length)];
      const scale = 0.9 + Math.random() * 0.3;
      decorations.push({ x, y, type, scale, depth: y });
    }
  }

  // depth 순서로 정렬 후 생성
  decorations.sort((a, b) => a.depth - b.depth);

  for (const deco of decorations) {
    const sprite = scene.add.image(deco.x, deco.y, `env_${deco.type}`);
    sprite.setScale(deco.scale);
    sprite.setOrigin(0.5, 1); // 바닥 기준으로 배치
    container.add(sprite);
  }

  // 컨테이너 전체를 뒤로 보내기 (UI 요소들보다 뒤에 렌더링)
  container.setDepth(-10);

  return container;
}

/**
 * 메인 메뉴용 장식물 배치 (테두리에 나무만)
 */
export function createMenuDecorations(scene: Phaser.Scene, mapSize: number): Phaser.GameObjects.Container {
  const container = scene.add.container(0, 0);

  const decorations: Array<{ x: number; y: number; type: AssetType; scale: number }> = [];

  // 상단 테두리 (나무)
  for (let x = 25; x < mapSize - 25; x += 45 + Math.random() * 25) {
    const type = Math.random() > 0.4 ? 'tree_small' : 'tree_tiny';
    decorations.push({ x, y: 18 + Math.random() * 12, type, scale: 0.9 + Math.random() * 0.2 });
  }

  // 하단 테두리 (나무)
  for (let x = 25; x < mapSize - 25; x += 45 + Math.random() * 25) {
    const type = Math.random() > 0.4 ? 'tree_small' : 'tree_tiny';
    decorations.push({ x, y: mapSize - 15 - Math.random() * 12, type, scale: 0.9 + Math.random() * 0.2 });
  }

  // 왼쪽 테두리 (나무)
  for (let y = 50; y < mapSize - 50; y += 55 + Math.random() * 25) {
    const type = Math.random() > 0.5 ? 'tree_small' : 'tree_tiny';
    decorations.push({ x: 12 + Math.random() * 12, y, type, scale: 0.9 + Math.random() * 0.2 });
  }

  // 오른쪽 테두리 (나무)
  for (let y = 50; y < mapSize - 50; y += 55 + Math.random() * 25) {
    const type = Math.random() > 0.5 ? 'tree_small' : 'tree_tiny';
    decorations.push({ x: mapSize - 18 - Math.random() * 12, y, type, scale: 0.9 + Math.random() * 0.2 });
  }

  for (const deco of decorations) {
    const sprite = scene.add.image(deco.x, deco.y, `env_${deco.type}`);
    sprite.setScale(deco.scale);
    sprite.setOrigin(0.5, 1);
    container.add(sprite);
  }

  container.setDepth(-10);

  return container;
}
