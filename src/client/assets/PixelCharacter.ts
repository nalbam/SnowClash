/**
 * 32x32 Pixel Art Character Generator for SnowClash
 * 눈사람 스타일 캐릭터 - Red/Blue 팀 지원
 */

// 색상 팔레트
const PALETTE = {
  // 공통
  TRANSPARENT: null,
  WHITE: 0xFFFFFF,
  SNOW_LIGHT: 0xF0F8FF,
  SNOW_DARK: 0xD0E8F0,
  BLACK: 0x000000,
  GRAY: 0x888888,

  // Red 팀
  RED_MAIN: 0xE53935,
  RED_DARK: 0xB71C1C,
  RED_LIGHT: 0xFF6659,

  // Blue 팀
  BLUE_MAIN: 0x1E88E5,
  BLUE_DARK: 0x0D47A1,
  BLUE_LIGHT: 0x6AB7FF,

  // 스턴 상태
  STUN_OVERLAY: 0x666666,
};

// 픽셀 데이터 (32x32)
// 0: 투명, 1: 흰색(몸), 2: 눈 어두운, 3: 검정(눈), 4: 팀색상, 5: 팀색상 어두운, 6: 팀색상 밝은
const CHARACTER_IDLE = [
  '00000000000044444444440000000000',
  '00000000004444444444444400000000',
  '00000000044444444444444440000000',
  '00000000444455444445544440000000',
  '00000004444455444455444444000000',
  '00000044444444444444444444400000',
  '00000044444444444444444444400000',
  '00000004444444444444444444000000',
  '00000000444444444444444440000000',
  '00000000044444444444444400000000',
  '00000000001111111111110000000000',
  '00000000111111111111111100000000',
  '00000001111111111111111110000000',
  '00000011112211111111221110000000',
  '00000111112211111112211111000000',
  '00001111111111111111111111100000',
  '00001111111111331111111111100000',
  '00011111111111331111111111110000',
  '00011111111111111111111111110000',
  '00011111111133333311111111110000',
  '00001111111111111111111111100000',
  '00001111111111111111111111100000',
  '00000111111111111111111110000000',
  '00000011111111111111111100000000',
  '00000001111122222211111000000000',
  '00000000111122222211110000000000',
  '00000000011122222211100000000000',
  '00000000001111111111000000000000',
  '00000000000111111110000000000000',
  '00000000000011111100000000000000',
  '00000000000022002200000000000000',
  '00000000000022002200000000000000',
];

const CHARACTER_WALK1 = [
  '00000000000044444444440000000000',
  '00000000004444444444444400000000',
  '00000000044444444444444440000000',
  '00000000444455444445544440000000',
  '00000004444455444455444444000000',
  '00000044444444444444444444400000',
  '00000044444444444444444444400000',
  '00000004444444444444444444000000',
  '00000000444444444444444440000000',
  '00000000044444444444444400000000',
  '00000000001111111111110000000000',
  '00000000111111111111111100000000',
  '00000001111111111111111110000000',
  '00000011112211111111221110000000',
  '00000111112211111112211111000000',
  '00001111111111111111111111100000',
  '00001111111111331111111111100000',
  '00011111111111331111111111110000',
  '00011111111111111111111111110000',
  '00011111111133333311111111110000',
  '00001111111111111111111111100000',
  '00001111111111111111111111100000',
  '00000111111111111111111110000000',
  '00000011111111111111111100000000',
  '00000001111122222211111000000000',
  '00000000111122222211110000000000',
  '00000000011122222211100000000000',
  '00000000001111111111000000000000',
  '00000000000111111110000000000000',
  '00000000000011111100000000000000',
  '00000000000220000022000000000000',
  '00000000000220000022000000000000',
];

const CHARACTER_WALK2 = [
  '00000000000044444444440000000000',
  '00000000004444444444444400000000',
  '00000000044444444444444440000000',
  '00000000444455444445544440000000',
  '00000004444455444455444444000000',
  '00000044444444444444444444400000',
  '00000044444444444444444444400000',
  '00000004444444444444444444000000',
  '00000000444444444444444440000000',
  '00000000044444444444444400000000',
  '00000000001111111111110000000000',
  '00000000111111111111111100000000',
  '00000001111111111111111110000000',
  '00000011112211111111221110000000',
  '00000111112211111112211111000000',
  '00001111111111111111111111100000',
  '00001111111111331111111111100000',
  '00011111111111331111111111110000',
  '00011111111111111111111111110000',
  '00011111111133333311111111110000',
  '00001111111111111111111111100000',
  '00001111111111111111111111100000',
  '00000111111111111111111110000000',
  '00000011111111111111111100000000',
  '00000001111122222211111000000000',
  '00000000111122222211110000000000',
  '00000000011122222211100000000000',
  '00000000001111111111000000000000',
  '00000000000111111110000000000000',
  '00000000000011111100000000000000',
  '00000000002200000002200000000000',
  '00000000002200000002200000000000',
];

const CHARACTER_THROW = [
  '00000000000044444444440000000000',
  '00000000004444444444444400000000',
  '00000000044444444444444440000000',
  '00000000444455444445544440000000',
  '00000004444455444455444444000000',
  '00000044444444444444444444400000',
  '00000044444444444444444444400000',
  '00000004444444444444444444000000',
  '00000000444444444444444440000000',
  '00000000044444444444444400000000',
  '00000000001111111111110000000000',
  '00000000111111111111111100000000',
  '00000001111111111111111110000000',
  '00000011113311111111331110000000',
  '00000111113311111113311111000000',
  '00001111111111111111111111100000',
  '00001111111111331111111111100000',
  '00011111111111331111111111110000',
  '00011111111111111111111111110000',
  '00011111111133333311111111110000',
  '00001111111111111111111111111110',
  '00001111111111111111111111111110',
  '00000111111111111111111111111100',
  '00000011111111111111111100000000',
  '00000001111122222211111000000000',
  '00000000111122222211110000000000',
  '00000000011122222211100000000000',
  '00000000001111111111000000000000',
  '00000000000111111110000000000000',
  '00000000000011111100000000000000',
  '00000000000022002200000000000000',
  '00000000000022002200000000000000',
];

const CHARACTER_STUNNED = [
  '00000000000000000000000000000000',
  '00000000000000000000000000000000',
  '00000000000044444444440000000000',
  '00000000004444444444444400000000',
  '00000000044444444444444440000000',
  '00000000444455444445544440000000',
  '00000004444455444455444444000000',
  '00000044444444444444444444400000',
  '00000044444444444444444444400000',
  '00000004444444444444444444000000',
  '00000000444444444444444440000000',
  '00000000044444444444444400000000',
  '00000000001111111111110000000000',
  '00000000111111111111111100000000',
  '00000001111111111111111110000000',
  '00000011113333111133331110000000',
  '00000111113333111133331111000000',
  '00001111111111111111111111100000',
  '00001111111111111111111111100000',
  '00011111111111111111111111110000',
  '00011111111111111111111111110000',
  '00011111111133333311111111110000',
  '00001111111111111111111111100000',
  '00001111111111111111111111100000',
  '00000111111111111111111110000000',
  '00000011111111111111111100000000',
  '00000001111122222211111000000000',
  '00000000111122222211110000000000',
  '00000000011122222211100000000000',
  '00000000001111111111000000000000',
  '00002222200111111110002222200000',
  '00002222200011111100002222200000',
];

export type CharacterState = 'idle' | 'walk1' | 'walk2' | 'throw' | 'stunned';
export type TeamColor = 'red' | 'blue';

const FRAMES: Record<CharacterState, string[]> = {
  idle: CHARACTER_IDLE,
  walk1: CHARACTER_WALK1,
  walk2: CHARACTER_WALK2,
  throw: CHARACTER_THROW,
  stunned: CHARACTER_STUNNED,
};

/**
 * Phaser Scene에서 픽셀 캐릭터 텍스처 생성
 */
export function generateCharacterTextures(scene: Phaser.Scene): void {
  const teams: TeamColor[] = ['red', 'blue'];
  const states: CharacterState[] = ['idle', 'walk1', 'walk2', 'throw', 'stunned'];

  teams.forEach(team => {
    states.forEach(state => {
      const key = `character_${team}_${state}`;
      if (scene.textures.exists(key)) return;

      const graphics = scene.make.graphics({ x: 0, y: 0 });
      drawCharacter(graphics, FRAMES[state], team, state === 'stunned');
      graphics.generateTexture(key, 32, 32);
      graphics.destroy();
    });
  });

  // 눈덩이 텍스처도 생성
  generateSnowballTextures(scene);
}

function drawCharacter(
  graphics: Phaser.GameObjects.Graphics,
  pixelData: string[],
  team: TeamColor,
  isStunned: boolean
): void {
  const teamColors = team === 'red'
    ? { main: PALETTE.RED_MAIN, dark: PALETTE.RED_DARK, light: PALETTE.RED_LIGHT }
    : { main: PALETTE.BLUE_MAIN, dark: PALETTE.BLUE_DARK, light: PALETTE.BLUE_LIGHT };

  for (let y = 0; y < 32; y++) {
    const row = pixelData[y];
    for (let x = 0; x < 32; x++) {
      const pixel = row[x];
      let color: number | null = null;

      switch (pixel) {
        case '0': color = null; break; // 투명
        case '1': color = PALETTE.WHITE; break; // 흰색 (몸)
        case '2': color = PALETTE.SNOW_DARK; break; // 어두운 눈색
        case '3': color = PALETTE.BLACK; break; // 검정 (눈, 입)
        case '4': color = teamColors.main; break; // 팀 메인 색상
        case '5': color = teamColors.dark; break; // 팀 어두운 색상
        case '6': color = teamColors.light; break; // 팀 밝은 색상
      }

      if (color !== null) {
        if (isStunned) {
          // 스턴 상태: 회색조로 변환
          color = blendWithGray(color, 0.5);
        }
        graphics.fillStyle(color, 1);
        graphics.fillRect(x, y, 1, 1);
      }
    }
  }
}

function blendWithGray(color: number, amount: number): number {
  const r = (color >> 16) & 0xFF;
  const g = (color >> 8) & 0xFF;
  const b = color & 0xFF;

  const gray = Math.round((r + g + b) / 3);

  const newR = Math.round(r + (gray - r) * amount);
  const newG = Math.round(g + (gray - g) * amount);
  const newB = Math.round(b + (gray - b) * amount);

  return (newR << 16) | (newG << 8) | newB;
}

/**
 * 눈덩이 픽셀아트 텍스처 생성
 */
function generateSnowballTextures(scene: Phaser.Scene): void {
  // 일반 눈덩이 (10x10)
  const normalKey = 'snowball_normal';
  if (!scene.textures.exists(normalKey)) {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawSnowball(g, 10, false);
    g.generateTexture(normalKey, 10, 10);
    g.destroy();
  }

  // 차징 눈덩이 (18x18)
  const chargedKey = 'snowball_charged';
  if (!scene.textures.exists(chargedKey)) {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawSnowball(g, 18, true);
    g.generateTexture(chargedKey, 18, 18);
    g.destroy();
  }

  // 팀 색상 눈덩이
  ['red', 'blue'].forEach(team => {
    const color = team === 'red' ? PALETTE.RED_LIGHT : PALETTE.BLUE_LIGHT;

    const normalTeamKey = `snowball_${team}_normal`;
    if (!scene.textures.exists(normalTeamKey)) {
      const g = scene.make.graphics({ x: 0, y: 0 });
      drawColoredSnowball(g, 10, color);
      g.generateTexture(normalTeamKey, 10, 10);
      g.destroy();
    }

    const chargedTeamKey = `snowball_${team}_charged`;
    if (!scene.textures.exists(chargedTeamKey)) {
      const g = scene.make.graphics({ x: 0, y: 0 });
      drawColoredSnowball(g, 18, color);
      g.generateTexture(chargedTeamKey, 18, 18);
      g.destroy();
    }
  });
}

function drawSnowball(graphics: Phaser.GameObjects.Graphics, size: number, charged: boolean): void {
  const center = size / 2;
  const radius = size / 2 - 1;

  // 그림자
  graphics.fillStyle(0xCCCCCC, 0.5);
  graphics.fillCircle(center + 1, center + 1, radius);

  // 메인 눈덩이
  graphics.fillStyle(0xFFFFFF, 1);
  graphics.fillCircle(center, center, radius);

  // 하이라이트
  graphics.fillStyle(0xFFFFFF, 1);
  graphics.fillCircle(center - radius / 3, center - radius / 3, radius / 4);

  if (charged) {
    // 차징 눈덩이는 테두리 추가
    graphics.lineStyle(2, 0xADD8E6, 1);
    graphics.strokeCircle(center, center, radius);
  }
}

function drawColoredSnowball(graphics: Phaser.GameObjects.Graphics, size: number, color: number): void {
  const center = size / 2;
  const radius = size / 2 - 1;

  // 그림자
  graphics.fillStyle(0x888888, 0.3);
  graphics.fillCircle(center + 1, center + 1, radius);

  // 메인 눈덩이 (팀 색상)
  graphics.fillStyle(color, 0.9);
  graphics.fillCircle(center, center, radius);

  // 흰색 코어
  graphics.fillStyle(0xFFFFFF, 0.7);
  graphics.fillCircle(center, center, radius * 0.6);

  // 하이라이트
  graphics.fillStyle(0xFFFFFF, 1);
  graphics.fillCircle(center - radius / 3, center - radius / 3, radius / 4);
}

/**
 * 캐릭터 애니메이션 생성
 */
export function createCharacterAnimations(scene: Phaser.Scene): void {
  const teams: TeamColor[] = ['red', 'blue'];

  teams.forEach(team => {
    // 걷기 애니메이션
    const walkKey = `${team}_walk`;
    if (!scene.anims.exists(walkKey)) {
      scene.anims.create({
        key: walkKey,
        frames: [
          { key: `character_${team}_walk1` },
          { key: `character_${team}_idle` },
          { key: `character_${team}_walk2` },
          { key: `character_${team}_idle` },
        ],
        frameRate: 8,
        repeat: -1
      });
    }

    // 대기 애니메이션
    const idleKey = `${team}_idle`;
    if (!scene.anims.exists(idleKey)) {
      scene.anims.create({
        key: idleKey,
        frames: [{ key: `character_${team}_idle` }],
        frameRate: 1,
        repeat: -1
      });
    }

    // 던지기 애니메이션
    const throwKey = `${team}_throw`;
    if (!scene.anims.exists(throwKey)) {
      scene.anims.create({
        key: throwKey,
        frames: [
          { key: `character_${team}_throw` },
          { key: `character_${team}_idle` },
        ],
        frameRate: 4,
        repeat: 0
      });
    }

    // 스턴 애니메이션
    const stunnedKey = `${team}_stunned`;
    if (!scene.anims.exists(stunnedKey)) {
      scene.anims.create({
        key: stunnedKey,
        frames: [{ key: `character_${team}_stunned` }],
        frameRate: 1,
        repeat: -1
      });
    }
  });
}
