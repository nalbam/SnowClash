# 아키텍처 가이드

SnowClash의 시스템 아키텍처와 각 컴포넌트의 역할을 설명합니다.

**관련 문서:**
- [API Reference](./API.md) - REST API 및 WebSocket 메시지 프로토콜
- [Game Mechanics](./GAME_MECHANICS.md) - 게임 로직 및 규칙
- [Testing Guide](./TESTING.md) - 테스트 실행 및 커버리지

---

## 목차

1. [시스템 개요](#시스템-개요)
2. [아키텍처 다이어그램](#아키텍처-다이어그램)
3. [서버 아키텍처](#서버-아키텍처)
4. [클라이언트 아키텍처](#클라이언트-아키텍처)
5. [데이터 흐름](#데이터-흐름)
6. [디렉토리 구조](#디렉토리-구조)

---

## 시스템 개요

SnowClash는 3v3 멀티플레이어 눈싸움 게임으로, 다음 기술 스택을 사용합니다:

| 구성요소 | 기술 | 역할 |
|---------|------|------|
| 서버 | Express + Colyseus | HTTP 서버, 게임 상태 관리, WebSocket 통신 |
| 클라이언트 | Phaser 3 | 게임 렌더링, 입력 처리, UI |
| 상태 동기화 | @colyseus/schema | 서버-클라이언트 간 실시간 상태 동기화 |
| 빌드 | TypeScript + Webpack | 타입 안전성, 모듈 번들링 |

---

## 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────────────┐
│                         클라이언트 (Phaser 3)                    │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐│
│  │  MainMenuScene   │─→│   LobbyScene     │─→│   GameScene      ││
│  │  - 닉네임 설정    │  │  - 팀 선택       │  │  - 게임 렌더링    ││
│  │  - 룸 목록       │  │  - Ready 시스템   │  │  - 입력 처리      ││
│  │  - 룸 생성/참여   │  │  - 호스트 권한    │  │  - 상태 반영      ││
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘│
│           │                     │                     │          │
│           └─────────────────────┴─────────────────────┘          │
│                                 │                                │
│                    WebSocket (colyseus.js)                       │
└─────────────────────────────────┼────────────────────────────────┘
                                  │
                                  │ ws://localhost:2567
                                  │
┌─────────────────────────────────┼────────────────────────────────┐
│                                 ▼                                │
│                          서버 (Colyseus)                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                       GameRoom                             │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │  │
│  │  │ onCreate    │  │ onMessage   │  │ updateGame  │        │  │
│  │  │ 상태 초기화  │  │ 메시지 처리  │  │ 게임 루프    │        │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘        │  │
│  │                                                            │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │                   GameState                          │  │  │
│  │  │  - players: MapSchema<PlayerSchema>                  │  │  │
│  │  │  - snowballs: MapSchema<SnowballSchema>              │  │  │
│  │  │  - phase: 'lobby' | 'playing' | 'ended'              │  │  │
│  │  │  - roomName, botCount                                │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                            │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │                  BotController                       │  │  │
│  │  │  - 봇 생성/제거                                       │  │  │
│  │  │  - 봇 행동 (2초마다 눈덩이 발사)                       │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    REST API (Express)                      │  │
│  │  GET /api/rooms - 룸 목록 조회                             │  │
│  │  POST /api/rooms - 룸 생성                                 │  │
│  │  GET /api/nickname - 랜덤 닉네임 생성                      │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│                    Express (정적 파일 서빙)                       │
└──────────────────────────────────────────────────────────────────┘
```

---

## 서버 아키텍처

### 진입점 (`src/server/index.ts`)

서버 시작점으로 Express와 Colyseus를 통합합니다.

```typescript
// Express 앱 설정
const app = express();
app.use(cors());
app.use(express.static('public'));  // 클라이언트 번들 서빙

// REST API 엔드포인트
app.get('/api/rooms', ...);      // 룸 목록 조회
app.post('/api/rooms', ...);     // 룸 생성
app.get('/api/nickname', ...);   // 랜덤 닉네임 생성

// Colyseus 게임 서버 생성
const server = createServer(app);
const gameServer = new Server({ server });

// GameRoom 등록
gameServer.define('game_room', GameRoom);

// 포트 2567에서 시작 (환경변수로 변경 가능)
gameServer.listen(Number(process.env.PORT) || 2567);
```

### 게임 룸 (`src/server/rooms/GameRoom.ts`)

모든 게임 로직이 집중된 핵심 파일입니다.

#### Room 라이프사이클

| 메서드 | 시점 | 역할 |
|--------|------|------|
| `onCreate` | 방 생성 시 | 상태 초기화, 메시지 핸들러 등록, BotController 생성 |
| `onJoin` | 플레이어 입장 시 | 플레이어 추가, 호스트 지정, 타이머 설정 |
| `onLeave` | 플레이어 퇴장 시 | 플레이어 제거, 호스트 승계, 승리 조건 확인 |
| `onDispose` | 방 소멸 시 | 타이머 정리, 리소스 해제 |

#### 핵심 메서드

```typescript
// 게임 시작 - 봇으로 팀 채우기, 초기 위치 배치, 게임 루프 시작
private startGame(): void

// 게임 루프 (60 FPS) - 봇 업데이트, 눈덩이 업데이트, 충돌 검사
private updateGame(): void

// 승리 조건 확인
private checkWinConditions(): void

// 영역 확인 (플레이어가 자기 영역 내에 있는지)
private isInPlayerTerritory(x, y, team): boolean
```

### 봇 컨트롤러 (`src/server/bots/BotController.ts`)

봇 플레이어를 관리하는 컨트롤러입니다.

#### 주요 기능

| 메서드 | 역할 |
|--------|------|
| `createBot(team)` | 특정 팀에 봇 생성 |
| `fillTeamsWithBots()` | 양 팀을 3명씩 봇으로 채움 |
| `updateBots(currentTime)` | 봇 행동 업데이트 (2초마다 눈덩이 발사) |
| `removeAllBots()` | 게임 종료 시 모든 봇 제거 |

#### 봇 특성

- **닉네임**: `[BOT] {랜덤이름}` 형식
- **이동**: 1초마다 랜덤 방향으로 이동 (플레이어와 동일한 속도 2)
- **공격**: 2초마다 상대 진영 방향으로 눈덩이 발사 (일반 데미지 4)
- **피격**: 일반 플레이어와 동일

### 닉네임 생성기 (`src/server/utils/NicknameGenerator.ts`)

랜덤 닉네임을 생성하는 유틸리티입니다.

```typescript
// 플레이어용 닉네임 생성: {형용사}{명사}{숫자}
generateNickname(): string  // 예: "BraveWolf42"

// 봇용 닉네임 생성
generateBotNickname(): string  // 예: "SnowBot73"
```

### 상태 스키마 (`src/server/schema/`)

Colyseus의 `@colyseus/schema`를 사용하여 자동 동기화되는 상태를 정의합니다.

#### GameState (`GameState.ts`)

게임 전체 상태를 관리하는 루트 스키마입니다.

```typescript
class GameState extends Schema {
  @type({ map: PlayerSchema }) players     // 모든 플레이어
  @type({ map: SnowballSchema }) snowballs // 현재 눈덩이들
  @type('string') phase                    // 게임 페이즈
  @type('string') winner                   // 승자
  @type('number') mapSize                  // 맵 크기 (600)
  @type('string') roomName                 // 룸 이름
  @type('number') botCount                 // 현재 봇 수
}
```

#### PlayerSchema (`PlayerSchema.ts`)

각 플레이어의 상태를 정의합니다.

```typescript
class PlayerSchema extends Schema {
  @type('string') sessionId   // 세션 ID
  @type('string') nickname    // 닉네임
  @type('string') googleId    // Google OAuth ID (선택)
  @type('string') photoUrl    // 프로필 사진 URL (선택)
  @type('string') team        // 팀 ('red' | 'blue')
  @type('boolean') isReady    // 준비 상태
  @type('boolean') isHost     // 호스트 여부
  @type('boolean') isBot      // 봇 여부
  @type('number') x, y        // 위치
  @type('number') energy      // 에너지 (초기값 10)
  @type('boolean') isStunned  // 스턴 상태
  @type('number') joinedAt    // 입장 시간
}
```

#### SnowballSchema (`SnowballSchema.ts`)

눈덩이(발사체)의 상태를 정의합니다.

```typescript
class SnowballSchema extends Schema {
  @type('string') id          // 고유 ID
  @type('string') ownerId     // 발사한 플레이어 ID
  @type('number') x, y        // 현재 위치
  @type('number') velocityX   // X축 속도
  @type('number') velocityY   // Y축 속도
  @type('number') damage      // 데미지 (4 또는 7)
  @type('string') team        // 발사한 팀
}
```

---

## 클라이언트 아키텍처

### 진입점 (`src/client/index.ts`)

Phaser 3 게임 설정을 정의합니다.

```typescript
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 600,
  height: 600,
  parent: 'game-container',
  backgroundColor: '#1a1a2e',
  scene: [MainMenuScene, LobbyScene, GameScene],
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 0 } }
  }
};

new Phaser.Game(config);
```

### 설정 (`src/client/config.ts`)

서버 연결 설정을 관리합니다.

```typescript
const SERVER_URL = process.env.SERVER_URL || 'localhost:2567';

// 프로토콜 자동 감지 (HTTPS 환경에서 WSS 사용)
const isSecure = window.location.protocol === 'https:';
const wsProtocol = isSecure ? 'wss' : 'ws';
const httpProtocol = isSecure ? 'https' : 'http';

export const config = {
  serverUrl: SERVER_URL,
  wsUrl: `${wsProtocol}://${SERVER_URL}`,
  apiUrl: `${httpProtocol}://${SERVER_URL}`,
};
```

### 캐릭터 에셋 (`src/client/assets/PixelCharacter.ts`)

픽셀 아트 캐릭터 텍스처와 애니메이션을 생성합니다.

- 팀별 캐릭터 텍스처 (red_idle, blue_idle, red_walk, blue_walk, red_stunned, blue_stunned)
- 눈덩이 텍스처 (일반, 차징)
- 걷기 애니메이션 정의

### MainMenuScene (`src/client/scenes/MainMenuScene.ts`)

메인 메뉴 화면을 담당합니다.

#### 주요 기능

| 기능 | 설명 |
|------|------|
| 랜덤 닉네임 | 서버 API에서 닉네임 생성 (실패 시 "Player" + 랜덤 숫자), localStorage에 저장 |
| 닉네임 변경 | [Change] 버튼으로 새 닉네임 생성 및 저장 |
| 룸 목록 | 5초마다 자동 새로고침, [Refresh] 버튼으로 수동 새로고침 |
| Quick Play | `joinOrCreate`로 빠른 참여 |
| Create Room | 새 방 생성 (`{닉네임}'s Room` 형식) |
| Join Room | 선택한 방에 참여 |

#### 시각적 요소

| 요소 | 세부 사항 |
|------|----------|
| 배경색 | `#e8f4f8` (연한 청록색) |
| 타이틀 | "SnowClash" (48px, 볼드, #333333) |
| **애니메이션 캐릭터** | 타이틀 양옆에 Red/Blue 팀 캐릭터 (scale 2x, 바운싱 애니메이션 y: 35-40, 800ms yoyo, Blue는 400ms 딜레이) |
| 닉네임 표시 | 24px, 볼드, #008800 (초록색) |
| Change 버튼 | 14px, 회색 (#888888), 호버 시 #333333 |
| Quick Play 버튼 | 20px, 녹색 배경 (#4CAF50), 호버 시 #66BB6A |
| Create Room 버튼 | 20px, 파란 배경 (#2196F3), 호버 시 #42A5F5 |
| Refresh 버튼 | 우측 정렬 (x=560), 12px, 회색, 호버 효과 |
| 룸 목록 아이템 | 560x38px, 흰 배경 (0.8 투명도), 8px 둥근 모서리, 1px 회색 테두리 |
| 플레이어 수 표시 | 녹색 (#008800) if not full, 빨강 (#cc0000) if full |
| Join 버튼 | 주황색 (#FF9800), 호버 시 #FFB74D |
| 빈 방 메시지 | "No rooms available. Create one!" (회색) |

#### UI 레이아웃

```
┌──────────────────────────────────────┐
│    🔴 SnowClash 🔵                  │  ← 애니메이션 캐릭터
├──────────────────────────────────────┤
│      Your Nickname: BraveWolf42      │
│            [Change]                  │
│                                      │
│   [Quick Play]    [Create Room]      │
│                                      │
│   Available Rooms         [Refresh]  │
│   ┌────────────────────────────┐     │
│   │ Room Name     2/6    [Join]│     │  ← 초록색
│   │ Room Name     6/6    [Join]│     │  ← 빨간색 (full)
│   └────────────────────────────┘     │
└──────────────────────────────────────┘
```

#### 데이터 저장

- **localStorage**: `snowclash_nickname` 키에 닉네임 저장
- 첫 로드 시 localStorage에서 복원, 없으면 API 호출
- Change 버튼 클릭 시 API에서 새 닉네임 받아 저장

### LobbyScene (`src/client/scenes/LobbyScene.ts`)

게임 시작 전 로비 화면을 담당합니다.

#### 주요 기능

| 기능 | 설명 |
|------|------|
| 팀 선택 | Red/Blue 영역 클릭으로 팀 선택 (팀당 최대 3명) |
| Ready 시스템 | 준비 상태 토글 (Ready ↔ Not Ready) |
| 호스트 권한 | 첫 입장자가 게임 시작 버튼 사용 가능 |
| 플레이어 표시 | 팀별 플레이어 표시 (캐릭터 스프라이트, 닉네임, 상태 표시) |
| 뒤로 가기 | MainMenuScene으로 복귀 (방에서 퇴장) |

#### 시각적 요소

| 요소 | 세부 사항 |
|------|----------|
| 배경색 | `#e8f4f8` (연한 청록색) |
| 타이틀 | "Game Lobby" (24px, 볼드, 중앙) + 방 이름 (14px, 회색) |
| Back 버튼 | 좌상단, 회색, 호버 시 검은색 |
| **대각선 팀 영역** | Red (우상단 삼각형, 0.1 투명도), Blue (좌하단 삼각형, 0.1 투명도) |
| 대각선 | (0,70)에서 (600,530)까지, 흰색 2px, 0.5 투명도 |
| 팀 라벨 | "RED" (480,150, 28px, 0.4 투명도), "BLUE" (120,450, 28px, 0.4 투명도) |
| 안내 문구 | "Click area to change team" (중앙, 11px, 반투명 흰 배경) |
| **플레이어 위치** | 대각선에 평행하게 배치, 80px 간격 |
| 플레이어 스프라이트 | 팀 색상, 1.2x 크기 |
| **현재 플레이어 표시** | 노란색 링 (3px, 반지름 22) |
| **Ready 플레이어 표시** | 초록색 링 (2px, 반지름 20), ✓ 아이콘, 바운싱 애니메이션 (y: -5, 500ms yoyo) |
| **호스트 표시** | 👑 왕관 아이콘 (16px, y: -50) |
| 닉네임 | 자신: 주황색 (#cc8800), 타인: 검은색, 10px, 반투명 흰 배경 |
| Ready 버튼 | 녹색 (#006600), Ready 상태 시 밝은 녹색 (#00aa00) + 볼드, "Not Ready"로 텍스트 변경 |
| Start 버튼 | 주황색 (#ff8800), 호스트만 표시 |

#### UI 레이아웃

```
┌──────────────────────────────────────┐
│  < Back        Game Lobby            │
│              Room Name               │
├──────────────────────────────────────┤
│                   \                  │  ← 대각선 경계
│    RED 영역         \   BLUE 영역    │
│  (반투명 빨강)        \ (반투명 파랑) │
│                       \              │
│   "Click area to change team"        │  ← 중앙 안내
│                         \            │
│                           \          │
│                             \        │
│         👑Player1 ✓    Player2       │  ← 플레이어 스프라이트
│                               \      │     대각선 평행 배치
│                                 \    │
│          [Ready]  [Start Game]       │  ← 하단 버튼
└──────────────────────────────────────┘
```

#### 플레이어 배치 알고리즘

Red 팀 (우상단):
```
x = 320 + index * 80
y = 143 + index * 80
```

Blue 팀 (좌하단):
```
x = 120 + index * 80
y = 297 + index * 80
```

#### 상태 동기화

- **100ms 초기 동기화**: 씬 생성 후 강제 동기화로 플레이어 표시 보장
- **onStateChange**: 전체 상태 변경 감지
- **players.onAdd/onRemove**: 플레이어 입장/퇴장 감지
- **player.onChange**: 개별 플레이어 상태 변경 감지 (팀, Ready 상태 등)

### GameScene (`src/client/scenes/GameScene.ts`)

실제 게임 플레이 화면을 담당합니다.

#### 주요 기능

| 기능 | 설명 |
|------|------|
| 맵 렌더링 | 600x600px, 흰 배경, 반투명 Red/Blue 영역, 대각선 없음 (LobbyScene과 달리) |
| 플레이어 렌더링 | 픽셀 캐릭터 스프라이트, 닉네임, 에너지 바, 인디케이터 링 |
| 봇 렌더링 | 회색 반투명 링 (1px, 반지름 18, 0.5 투명도)으로 구분 |
| 눈덩이 렌더링 | 이동하는 발사체 (일반: 5px, 차징: 9px) |
| 입력 처리 | 키보드 (WASD/Arrow) + 마우스/터치 (클릭으로 이동, 홀드로 차징) |
| 차징 게이지 | 좌하단 (10, 560), 100x20px, 노란색 → 빨간색 |
| 에너지 바 | 플레이어 위 (30x4px), 색상 코딩 (초록 > 50%, 노랑 > 25%, 빨강 ≤ 25%) |
| 충돌 효과 | 파편 효과 (6개 입자, 방사형 확산, 400ms 페이드아웃) |
| 승리 축하 | 이긴 팀은 이동 가능, cheer 애니메이션 재생 |
| 게임 종료 | 결과 표시, Return to Menu 버튼으로 복귀 |

#### 입력 바인딩

| 입력 | 동작 |
|------|------|
| W / ↑ | 위로 이동 |
| A / ← | 왼쪽으로 이동 |
| S / ↓ | 아래로 이동 |
| D / → | 오른쪽으로 이동 |
| **마우스/터치 클릭** | 클릭한 위치로 이동 (360° 자유 방향) |
| Space (탭) | 일반 공격 (최소 0.2초 차징 필요) |
| Space (홀드 0.7초+) | 차징 공격 (7 데미지) |
| **마우스/터치 홀드** | 차징 (키보드와 동일하게 작동) |

#### 시각적 요소 - Playing Phase

| 요소 | 세부 사항 |
|------|----------|
| 배경색 | `#e8f4f8` (연한 청록색) |
| 맵 | 600x600px, 흰 배경 |
| Red 영역 | 우상단 삼각형, 0.1 빨강 투명도 |
| Blue 영역 | 좌하단 삼각형, 0.1 파랑 투명도 |
| **플레이어 인디케이터** | 자신: 노란색 링 (2px, 반지름 20), 봇: 회색 링 (1px, 반지름 18, 0.5 투명도) |
| 닉네임 라벨 | y: -30, 10px, 검은색, 반투명 흰 배경 |
| **에너지 바** | y: -40, 30x4px, 검은 배경 + 색상 코딩 fill, 게임 종료 시 숨김 |
| **차징 게이지** | 좌하단 (10, 560), 100x20px, 검은 배경, 차징 레벨에 따라 노랑/빨강, 2px 검은 테두리 |
| 눈덩이 | 일반: 5px 반지름, 차징: 9px 반지름 |
| **파편 효과** | 눈덩이 제거 시 6개 입자, 2-4px, 팀 색상, 15-30px 방사형 확산, 400ms 페이드 |

#### 시각적 요소 - Ended Phase

| 요소 | 세부 사항 |
|------|----------|
| 오버레이 | 20% 검은색 투명도, 600x600px 전체 |
| 승리/패배 메시지 | 중앙, 48px 볼드 |
| - Win 메시지 | "You Win!", 팀 색상 (빨강 #ff0000 / 파랑 #0000ff) |
| - Lose 메시지 | "You Lose!", 회색 (#666666) |
| - Draw 메시지 | "Draw!", 흰색 (#ffffff) |
| **Return to Menu 버튼** | 260x50px, 녹색 (#4CAF50), 둥근 모서리 10px, 흰 테두리 3px |
| 버튼 호버 | 밝은 녹색 (#66BB6A) |
| 버튼 텍스트 | "Return to Menu", 24px, 흰색, 볼드 |
| **승리 팀 애니메이션** | cheer 애니메이션 재생 (4 FPS, 2 프레임 루프) |
| **승리 팀 이동** | 이긴 팀은 자유롭게 이동 가능 (stunned 무시) |
| 에너지 바 | 게임 종료 시 모든 에너지 바 숨김 |

#### 입력 처리 상세

**키보드 이동**:
- 8방향 이동 (대각선 가능)
- 정규화된 방향 벡터를 서버로 전송
- 서버에서 이동 검증 (영역 체크)

**포인터 이동**:
- 클릭한 위치를 향해 360° 자유 방향 이동
- 정규화된 방향 벡터 계산: `(dx/distance, dy/distance)`
- 목표 지점 5px 이내 도달 시 이동 중단
- 키보드 입력이 우선순위 (포인터 목표 취소)

**차징 시스템**:
- 최소 차징 시간: 200ms (MIN_CHARGE_TIME)
- 완전 차징: 700ms (0.7초)
- 쿨다운: 1000ms (THROW_COOLDOWN)
- Space 키 또는 포인터 홀드로 차징
- 차징 중 게이지 표시 (노란색 → 빨간색)

#### 클라이언트 예측 및 보간

**로컬 플레이어 (Client-Side Prediction)**:
- 입력 즉시 로컬 위치 업데이트
- 서버에서 검증 후 수정 (영역 벗어남 등)
- 차징 게이지와 인디케이터 로컬 갱신

**원격 플레이어 (Lerp Interpolation)**:
- `lastX`, `lastY` 저장
- 서버 위치와 선형 보간 (lerp factor 0.3)
- 부드러운 이동 효과

**눈덩이 (Server Authoritative)**:
- 서버에서 위치 계산
- 클라이언트는 서버 위치를 직접 렌더링
- 제거 시 페이딩 애니메이션 추가 (fadingSnowballs Set으로 중복 방지)

#### 게임 종료 처리

**승리 팀 (Winning Team)**:
- 자유롭게 이동 가능 (stunned 무시)
- cheer 애니메이션 자동 재생
- 입력 계속 처리 (이동만 가능, 공격 불가)

**패배 팀 (Losing Team)**:
- 모든 입력 차단
- stunned 상태 유지
- 에너지 바 숨김

**공통**:
- 에너지 바 렌더링 중단
- 오버레이 및 결과 메시지 표시
- Return to Menu 버튼 표시

---

## 데이터 흐름

### 상태 동기화 메커니즘

Colyseus는 `@colyseus/schema`를 통해 서버 상태를 클라이언트에 자동으로 동기화합니다.

```
서버                                클라이언트
  │                                    │
  │  GameState 변경                     │
  │  (player.x = 100)                  │
  │                                    │
  ├──── 자동 동기화 (delta patch) ─────→│
  │                                    │
  │                        player.onChange() 콜백
  │                        └── 렌더링 업데이트
```

### 클라이언트 상태 리스너

```typescript
// 상태 변경 시 리스너 설정 (deferred pattern)
room.onStateChange((state) => {
  if (!listenersSetup && state.players?.onAdd) {
    listenersSetup = true;

    state.players.onAdd((player, sessionId) => {
      createPlayerGraphics(sessionId, player);
      player.onChange(() => updatePlayerGraphics(sessionId, player));
    });

    state.players.onRemove((player, sessionId) => {
      removePlayerGraphics(sessionId);
    });
  }
});
```

### 게임 흐름

```
MainMenuScene
├── GET /api/nickname → 랜덤 닉네임
├── GET /api/rooms → 룸 목록 조회
├── [Quick Play] → joinOrCreate → LobbyScene
├── [Create Room] → create → LobbyScene
└── [Join] → joinById → LobbyScene

LobbyScene
├── selectTeam → 팀 선택
├── ready → 준비 상태 토글
├── [Start Game] → startGame → 봇으로 채워서 시작
└── [Back] → leave → MainMenuScene

GameScene
├── move → 이동
├── throwSnowball → 눈덩이 발사
├── gameEnded 메시지 → 결과 표시
└── 5초 후 → MainMenuScene
```

---

## 디렉토리 구조

```
SnowClash/
├── src/
│   ├── shared/                      # 공유 코드 (서버/클라이언트 공통)
│   │   └── constants.ts             # 게임 상수 (MAP_SIZE, PLAYER_SPEED, etc.)
│   │
│   ├── client/                      # 클라이언트 코드
│   │   ├── index.ts                 # Phaser 게임 설정
│   │   ├── config.ts                # 서버 연결 설정
│   │   ├── index.html               # HTML 템플릿
│   │   ├── assets/
│   │   │   └── PixelCharacter.ts    # 픽셀 아트 캐릭터 생성
│   │   ├── systems/                 # 게임 시스템 모듈
│   │   │   ├── InputSystem.ts       # 입력 처리 (키보드, 마우스, 터치, 차징)
│   │   │   ├── PlayerRenderSystem.ts # 플레이어 렌더링 및 애니메이션
│   │   │   └── SnowballSystem.ts    # 눈덩이 렌더링 및 파편 효과
│   │   └── scenes/
│   │       ├── MainMenuScene.ts     # 메인 메뉴 씬
│   │       ├── LobbyScene.ts        # 로비 씬
│   │       └── GameScene.ts         # 게임 씬
│   │
│   └── server/                      # 서버 코드
│       ├── index.ts                 # Express + Colyseus 설정
│       ├── rooms/
│       │   ├── GameRoom.ts          # 게임 룸 (핵심 로직)
│       │   └── GameRoom.test.ts     # 게임 룸 테스트
│       ├── schema/
│       │   ├── GameState.ts         # 루트 상태 스키마
│       │   ├── PlayerSchema.ts      # 플레이어 스키마
│       │   └── SnowballSchema.ts    # 눈덩이 스키마
│       ├── bots/
│       │   ├── BotController.ts     # 봇 컨트롤러
│       │   └── BotController.test.ts # 봇 컨트롤러 테스트
│       └── utils/
│           ├── NicknameGenerator.ts # 닉네임 생성 유틸리티
│           └── NicknameGenerator.test.ts # 닉네임 생성 테스트
│
├── public/                          # 정적 파일 (빌드 결과물)
│   ├── bundle.js                    # 클라이언트 번들
│   └── index.html                   # 게임 HTML
│
├── dist/                            # 서버 빌드 결과물
│   └── server/
│
├── docs/                            # 문서
│   ├── ARCHITECTURE.md              # 아키텍처 가이드 (이 문서)
│   ├── API.md                       # API 레퍼런스
│   ├── GAME_MECHANICS.md            # 게임 메카닉
│   ├── CONTRIBUTING.md              # 기여 가이드
│   ├── DEPLOYMENT.md                # 배포 가이드
│   └── GOOGLE_OAUTH_SETUP.md        # OAuth 설정 가이드 (선택)
│
├── .github/
│   └── workflows/
│       └── release.yml              # 릴리스 자동화 (GitHub Pages + Docker)
│
├── package.json                     # 의존성 및 스크립트
├── tsconfig.json                    # TypeScript 설정 (서버용)
├── tsconfig.client.json             # TypeScript 설정 (클라이언트용)
├── webpack.config.js                # Webpack 설정 (클라이언트용)
├── Dockerfile                       # 도커 빌드 설정
├── .env.example                     # 환경변수 예시 (개발용)
├── .env.production.example          # 환경변수 예시 (프로덕션용)
├── README.md                        # 프로젝트 소개
└── CLAUDE.md                        # Claude Code 가이드
```

---

## 빌드 구성

### 서버 빌드

TypeScript 컴파일러(`tsc`)를 사용합니다.

```bash
npm run build:server  # dist/server/에 출력
```

`tsconfig.json` 설정:
- `include`: `src/server/**/*` (서버 코드만)
- `target`: ES2020
- `module`: CommonJS
- `experimentalDecorators`: true (Colyseus 스키마용)

### 클라이언트 빌드

Webpack을 사용하여 번들링합니다.

```bash
npm run build  # public/bundle.js에 출력
```

`webpack.config.js` 설정:
- 진입점: `src/client/index.ts`
- 출력: `public/bundle.js`
- 로더: `ts-loader` (`tsconfig.client.json` 사용)
- 개발 서버 포트: 8080

`tsconfig.client.json` 설정:
- `target`: ES2020
- `module`: ES2020
- `lib`: ES2020, DOM (브라우저 API 지원)
- `include`: `src/client/**/*`


---

## 관련 문서

- **[API Reference](./API.md)** - REST API 및 WebSocket 메시지 프로토콜
- **[Game Mechanics](./GAME_MECHANICS.md)** - 게임 로직 및 규칙 상세
- **[Testing Guide](./TESTING.md)** - 테스트 실행 및 커버리지
- **[Deployment Guide](./DEPLOYMENT.md)** - 프로덕션 배포 가이드

## 네비게이션

- [← 문서 인덱스로 돌아가기](./README.md)
- [← 메인 README로 돌아가기](../README.md)

---

**마지막 업데이트**: 2026-01-14
