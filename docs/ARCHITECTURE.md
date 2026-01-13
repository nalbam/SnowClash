# 아키텍처 가이드

SnowClash의 시스템 아키텍처와 각 컴포넌트의 역할을 설명합니다.

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
- **이동**: 없음 (제자리)
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
  @type('number') mapSize                  // 맵 크기 (800)
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
  width: 800,
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

### MainMenuScene (`src/client/scenes/MainMenuScene.ts`)

메인 메뉴 화면을 담당합니다.

#### 주요 기능

| 기능 | 설명 |
|------|------|
| 랜덤 닉네임 | 서버에서 닉네임 생성, 변경 가능 |
| 룸 목록 | 5초마다 자동 새로고침 |
| Quick Play | `joinOrCreate`로 빠른 참여 |
| Create Room | 새 방 생성 |
| Join Room | 선택한 방에 참여 |

#### UI 레이아웃

```
┌──────────────────────────────────────┐
│            SnowClash                 │
├──────────────────────────────────────┤
│      Your Nickname: BraveWolf42      │
│            [Change]                  │
│                                      │
│   [Quick Play]    [Create Room]      │
│                                      │
│         Available Rooms              │
│   ┌────────────────────────────┐     │
│   │ Room Name     2/6    [Join]│     │
│   │ Room Name     1/6    [Join]│     │
│   └────────────────────────────┘     │
└──────────────────────────────────────┘
```

### LobbyScene (`src/client/scenes/LobbyScene.ts`)

게임 시작 전 로비 화면을 담당합니다.

#### 주요 기능

| 기능 | 설명 |
|------|------|
| 팀 선택 | Red/Blue 팀 선택 (팀당 최대 3명) |
| Ready 시스템 | 준비 상태 토글 |
| 호스트 권한 | 첫 입장자가 게임 시작 버튼 사용 가능 |
| 플레이어 목록 | 팀별 플레이어 표시 (봇 포함) |
| 뒤로 가기 | MainMenuScene으로 복귀 |

#### UI 레이아웃

```
┌──────────────────────────────────────┐
│  < Back        Game Lobby            │
│              Room Name               │
├──────────────────────────────────────┤
│          Select Your Team            │
│     [Red Team]    [Blue Team]        │
│                                      │
│             [Ready]                  │
│          [Start Game]  ← 호스트만     │
│                                      │
│             Players                  │
│    Red Team        Blue Team         │
│    Player1 [H]     Player2           │
│    [BOT] Bot1      [BOT] Bot2        │
└──────────────────────────────────────┘
```

### GameScene (`src/client/scenes/GameScene.ts`)

실제 게임 플레이 화면을 담당합니다.

#### 주요 기능

| 기능 | 설명 |
|------|------|
| 맵 렌더링 | 영역 표시, 대각선 경계선 |
| 플레이어 렌더링 | 원형 아바타, 닉네임, 에너지 바 |
| 봇 렌더링 | 회색 테두리로 구분 |
| 눈덩이 렌더링 | 이동하는 발사체 표시 |
| 입력 처리 | WASD 이동, Space 차징/발사 |
| 게임 종료 | 결과 표시 후 MainMenuScene으로 복귀 |

#### 입력 바인딩

| 키 | 동작 |
|-----|------|
| W / ↑ | 위로 이동 |
| A / ← | 왼쪽으로 이동 |
| S / ↓ | 아래로 이동 |
| D / → | 오른쪽으로 이동 |
| Space (탭) | 일반 공격 (4 데미지) |
| Space (홀드 0.7초+) | 차징 공격 (7 데미지) |

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
│   ├── client/                      # 클라이언트 코드
│   │   ├── index.ts                 # Phaser 게임 설정
│   │   ├── index.html               # HTML 템플릿
│   │   └── scenes/
│   │       ├── MainMenuScene.ts     # 메인 메뉴 씬
│   │       ├── LobbyScene.ts        # 로비 씬
│   │       └── GameScene.ts         # 게임 씬
│   │
│   └── server/                      # 서버 코드
│       ├── index.ts                 # Express + Colyseus 설정
│       ├── rooms/
│       │   └── GameRoom.ts          # 게임 룸 (핵심 로직)
│       ├── schema/
│       │   ├── GameState.ts         # 루트 상태 스키마
│       │   ├── PlayerSchema.ts      # 플레이어 스키마
│       │   └── SnowballSchema.ts    # 눈덩이 스키마
│       ├── bots/
│       │   └── BotController.ts     # 봇 컨트롤러
│       └── utils/
│           └── NicknameGenerator.ts # 닉네임 생성 유틸리티
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
├── package.json                     # 의존성 및 스크립트
├── tsconfig.json                    # TypeScript 설정 (서버용)
├── webpack.config.js                # Webpack 설정 (클라이언트용)
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
- 로더: `ts-loader`
- 개발 서버 포트: 8080
