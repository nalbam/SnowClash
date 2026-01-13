# API 레퍼런스

SnowClash의 서버-클라이언트 간 메시지 프로토콜과 상태 스키마를 설명합니다.

## 목차

1. [개요](#개요)
2. [REST API](#rest-api)
3. [클라이언트 → 서버 메시지](#클라이언트--서버-메시지)
4. [서버 → 클라이언트 메시지](#서버--클라이언트-메시지)
5. [상태 스키마](#상태-스키마)
6. [상태 변경 이벤트](#상태-변경-이벤트)
7. [예제 코드](#예제-코드)

---

## 개요

SnowClash는 Colyseus 프레임워크를 사용하여 WebSocket 기반 실시간 통신을 구현합니다.

### 통신 방식

| 방식 | 설명 |
|------|------|
| 메시지 전송 | `room.send(type, payload)` - 클라이언트가 서버에 명시적으로 전송 |
| 상태 동기화 | 서버의 `GameState` 변경이 자동으로 클라이언트에 동기화됨 |
| 브로드캐스트 | 서버가 모든 클라이언트에 메시지 전송 |

### 연결 흐름

```typescript
// 1. 서버 연결
const client = new Client('ws://localhost:2567');

// 2. 방 생성 또는 참여
const room = await client.joinOrCreate('game_room', {
  nickname: 'Player1'
});

// 3. 메시지 전송
room.send('selectTeam', { team: 'red' });

// 4. 상태 감지
room.state.players.onAdd((player) => { ... });
```

---

## REST API

게임 룸 관리를 위한 HTTP REST API입니다.

### GET /api/rooms

사용 가능한 게임 룸 목록을 조회합니다.

**응답**

```json
[
  {
    "roomId": "abc123",
    "roomName": "Player의 방",
    "playerCount": 2,
    "maxPlayers": 6
  }
]
```

### POST /api/rooms

새 게임 룸을 생성합니다.

**요청 바디**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `roomName` | string | 선택 | 룸 이름 (기본값: 'Game Room') |

**응답**

```json
{
  "roomId": "abc123",
  "roomName": "Player의 방"
}
```

### GET /api/nickname

랜덤 닉네임을 생성합니다.

**응답**

```json
{
  "nickname": "BraveWolf42"
}
```

---

## 클라이언트 → 서버 메시지

클라이언트가 `room.send()`를 통해 서버에 전송하는 메시지입니다.

### setProfile

플레이어 프로필을 설정합니다.

| 항목 | 값 |
|------|-----|
| 메시지 타입 | `'setProfile'` |
| 허용 페이즈 | 모든 페이즈 |

**페이로드**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `nickname` | string | 선택 | 플레이어 닉네임 (기본값: 'Player') |
| `googleId` | string | 선택 | Google OAuth ID |
| `photoUrl` | string | 선택 | 프로필 사진 URL |

**예제**

```typescript
room.send('setProfile', {
  nickname: '눈싸움왕',
  googleId: 'google_123456',
  photoUrl: 'https://example.com/photo.jpg'
});
```

---

### selectTeam

팀을 선택합니다.

| 항목 | 값 |
|------|-----|
| 메시지 타입 | `'selectTeam'` |
| 허용 페이즈 | `lobby` |

**페이로드**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `team` | string | 필수 | 팀 선택 (`'red'` 또는 `'blue'`) |

**처리 로직**

1. 현재 페이즈가 `lobby`인지 확인
2. 선택한 팀의 인원이 3명 미만인지 확인
3. 조건 충족 시 플레이어의 `team` 필드 업데이트
4. `isReady`를 `false`로 초기화 (팀 변경 시 준비 상태 해제)

**에러 응답**

| 조건 | 메시지 |
|------|--------|
| 팀 정원 초과 | `{ message: 'Team is full' }` |

**예제**

```typescript
room.send('selectTeam', { team: 'red' });
```

---

### ready

준비 상태를 변경합니다.

| 항목 | 값 |
|------|-----|
| 메시지 타입 | `'ready'` |
| 허용 페이즈 | `lobby` |
| 전제조건 | 팀 선택 완료 |

**페이로드**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `ready` | boolean | 필수 | 준비 상태 (`true`/`false`) |

**처리 로직**

1. 플레이어가 팀에 속해 있는지 확인
2. `isReady` 필드 업데이트
3. Ready 타임아웃 타이머 취소 (1분 자동 추방 방지)
4. 시작 조건 확인

**예제**

```typescript
room.send('ready', { ready: true });
```

---

### startGame

게임을 시작합니다 (호스트 전용).

| 항목 | 값 |
|------|-----|
| 메시지 타입 | `'startGame'` |
| 허용 페이즈 | `lobby` |
| 권한 | 호스트만 가능 |

**페이로드**

없음 (빈 객체)

**처리 로직**

1. 요청자가 호스트인지 확인
2. 모든 인간 플레이어가 준비 상태인지 확인
3. 최소 1명의 인간 플레이어가 팀에 있는지 확인
4. 조건 충족 시:
   - 각 팀에 3명이 될 때까지 봇으로 채움
   - `phase`를 `'playing'`으로 변경
   - 플레이어(봇 포함) 초기 위치 배치
   - 60 FPS 게임 루프 시작

**예제**

```typescript
room.send('startGame', {});
```

---

### move

플레이어를 이동시킵니다.

| 항목 | 값 |
|------|-----|
| 메시지 타입 | `'move'` |
| 허용 페이즈 | `playing` |
| 제한 | 스턴 상태에서 불가 |

**페이로드**

| 필드 | 타입 | 필수 | 값 범위 | 설명 |
|------|------|------|---------|------|
| `x` | number | 필수 | -1, 0, 1 | X축 이동 방향 |
| `y` | number | 필수 | -1, 0, 1 | Y축 이동 방향 |

**처리 로직**

1. 플레이어가 스턴 상태가 아닌지 확인
2. 새 위치 계산: `newX = player.x + x * PLAYER_SPEED`
3. 새 위치가 자기 팀 영역 내인지 확인
4. 맵 경계 내로 제한 (0 ~ MAP_SIZE)

**예제**

```typescript
// 오른쪽 아래로 이동
room.send('move', { x: 1, y: 1 });

// 왼쪽으로만 이동
room.send('move', { x: -1, y: 0 });
```

---

### throwSnowball

눈덩이를 발사합니다.

| 항목 | 값 |
|------|-----|
| 메시지 타입 | `'throwSnowball'` |
| 허용 페이즈 | `playing` |
| 제한 | 스턴 상태에서 불가 |

**페이로드**

| 필드 | 타입 | 필수 | 값 범위 | 설명 |
|------|------|------|---------|------|
| `chargeLevel` | number | 선택 | 0.0 ~ 1.0 | 차징 레벨 (기본값: 0) |

**처리 로직**

1. `chargeLevel`을 0~1 사이로 클램핑
2. 데미지 결정:
   - `chargeLevel >= 0.7`: 7 데미지 (차징 공격)
   - `chargeLevel < 0.7`: 4 데미지 (일반 공격)
3. 눈덩이 생성:
   - 위치: 플레이어 현재 위치
   - 속도: 팀에 따라 상대 진영 방향으로 대각선 발사 (맵은 `\` 대각선으로 분할)
     - Red팀 (우상단, y<=x): (-5, +5) - 좌하단 방향 (Blue 진영으로)
     - Blue팀 (좌하단, y>=x): (+5, -5) - 우상단 방향 (Red 진영으로)

**예제**

```typescript
// 일반 공격 (4 데미지)
room.send('throwSnowball', { chargeLevel: 0.3 });

// 차징 공격 (7 데미지)
room.send('throwSnowball', { chargeLevel: 0.8 });
```

---

## 서버 → 클라이언트 메시지

서버가 `client.send()` 또는 `this.broadcast()`를 통해 전송하는 메시지입니다.

### error

에러를 알립니다.

**페이로드**

| 필드 | 타입 | 설명 |
|------|------|------|
| `message` | string | 에러 메시지 |

**발생 조건**

| 조건 | 메시지 |
|------|--------|
| 팀 정원 초과 | `'Team is full'` |

**예제**

```typescript
room.onMessage('error', (message) => {
  console.error('에러:', message.message);
});
```

---

### playerKicked

플레이어가 추방되었음을 알립니다.

**페이로드**

| 필드 | 타입 | 설명 |
|------|------|------|
| `sessionId` | string | 추방된 플레이어의 세션 ID |
| `reason` | string | 추방 사유 |

**발생 조건**

| 조건 | 사유 |
|------|------|
| 1분 내 준비 안 함 | `'Not ready within 1 minute'` |

**예제**

```typescript
room.onMessage('playerKicked', (message) => {
  console.log(`${message.sessionId} 추방됨: ${message.reason}`);
});
```

---

### gameEnded

게임이 종료되었음을 알립니다.

**페이로드**

| 필드 | 타입 | 설명 |
|------|------|------|
| `winner` | string | 승자 (`'red'`, `'blue'`, `'draw'`) |

**예제**

```typescript
room.onMessage('gameEnded', (message) => {
  if (message.winner === 'draw') {
    console.log('무승부!');
  } else {
    console.log(`${message.winner} 팀 승리!`);
  }
});
```

---

## 상태 스키마

서버의 상태는 `@colyseus/schema`를 통해 정의되며 자동으로 클라이언트에 동기화됩니다.

### GameState

게임 전체 상태를 관리하는 루트 스키마입니다.

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `players` | MapSchema<PlayerSchema> | `{}` | 모든 플레이어 (키: sessionId) |
| `snowballs` | MapSchema<SnowballSchema> | `{}` | 현재 필드의 눈덩이들 |
| `phase` | string | `'lobby'` | 게임 페이즈 |
| `winner` | string | `''` | 승자 |
| `mapSize` | number | `800` | 맵 크기 (픽셀) |
| `roomName` | string | `''` | 룸 이름 |
| `botCount` | number | `0` | 현재 봇 수 |

**phase 값**

| 값 | 설명 |
|-----|------|
| `'lobby'` | 로비 (팀 선택, 준비) |
| `'playing'` | 게임 진행 중 |
| `'ended'` | 게임 종료 |

---

### PlayerSchema

플레이어 상태를 정의합니다.

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `sessionId` | string | `''` | Colyseus 세션 ID |
| `nickname` | string | `''` | 플레이어 닉네임 |
| `googleId` | string | `''` | Google OAuth ID |
| `photoUrl` | string | `''` | 프로필 사진 URL |
| `team` | string | `''` | 팀 (`'red'` 또는 `'blue'`) |
| `isReady` | boolean | `false` | 준비 상태 |
| `isHost` | boolean | `false` | 호스트 여부 |
| `isBot` | boolean | `false` | 봇 여부 |
| `x` | number | `0` | X 좌표 |
| `y` | number | `0` | Y 좌표 |
| `energy` | number | `10` | 에너지 (0이 되면 스턴) |
| `isStunned` | boolean | `false` | 스턴 상태 |
| `joinedAt` | number | `Date.now()` | 입장 타임스탬프 |

**봇 플레이어**

- 봇은 닉네임에 `[BOT]` 접두사가 붙습니다
- 봇은 제자리에서 2초마다 눈덩이를 발사합니다 (일반 데미지 4)
- 게임 시작 시 팀 인원이 3명 미만이면 봇으로 채워집니다

---

### SnowballSchema

눈덩이(발사체) 상태를 정의합니다.

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `id` | string | `''` | 고유 ID (`{sessionId}_{timestamp}`) |
| `ownerId` | string | `''` | 발사한 플레이어 세션 ID |
| `x` | number | `0` | X 좌표 |
| `y` | number | `0` | Y 좌표 |
| `velocityX` | number | `0` | X축 속도 |
| `velocityY` | number | `0` | Y축 속도 |
| `damage` | number | `4` | 데미지 |
| `team` | string | `''` | 발사한 팀 |

---

## 상태 변경 이벤트

클라이언트에서 서버 상태 변경을 감지하는 콜백 함수입니다.

### MapSchema 이벤트

`players`와 `snowballs`는 `MapSchema` 타입으로, 다음 이벤트를 지원합니다.

#### onAdd

새 항목이 추가될 때 호출됩니다.

```typescript
room.state.players.onAdd((player, sessionId) => {
  console.log(`플레이어 입장: ${sessionId}`);
  createPlayerSprite(sessionId, player);
});
```

#### onRemove

항목이 제거될 때 호출됩니다.

```typescript
room.state.players.onRemove((player, sessionId) => {
  console.log(`플레이어 퇴장: ${sessionId}`);
  removePlayerSprite(sessionId);
});
```

#### onChange (Schema 내부)

개별 스키마의 속성이 변경될 때 호출됩니다.

```typescript
room.state.players.onAdd((player, sessionId) => {
  // 플레이어 추가 시 onChange 리스너도 등록
  player.onChange(() => {
    updatePlayerSprite(sessionId, player);
  });
});
```

### 전체 상태 변경

#### onStateChange

상태가 변경될 때마다 호출됩니다.

```typescript
room.onStateChange((state) => {
  if (state.phase === 'playing') {
    scene.start('GameScene');
  }
});
```

---

## 예제 코드

### 완전한 클라이언트 연결 예제

```typescript
import { Client, Room } from 'colyseus.js';

class GameClient {
  private client: Client;
  private room: Room;

  async connect() {
    // 1. 서버 연결
    this.client = new Client('ws://localhost:2567');

    // 2. 방 참여
    this.room = await this.client.joinOrCreate('game_room', {
      nickname: 'Player1'
    });

    // 3. 상태 리스너 설정
    this.setupStateListeners();

    // 4. 메시지 핸들러 설정
    this.setupMessageHandlers();
  }

  private setupStateListeners() {
    // 플레이어 추가/제거
    this.room.state.players.onAdd((player, sessionId) => {
      console.log(`플레이어 입장: ${player.nickname}`);

      player.onChange(() => {
        console.log(`플레이어 업데이트: ${player.nickname} (${player.x}, ${player.y})`);
      });
    });

    this.room.state.players.onRemove((player, sessionId) => {
      console.log(`플레이어 퇴장: ${player.nickname}`);
    });

    // 눈덩이 추가/제거
    this.room.state.snowballs.onAdd((snowball, id) => {
      console.log(`눈덩이 생성: ${id}`);
    });

    this.room.state.snowballs.onRemove((snowball, id) => {
      console.log(`눈덩이 제거: ${id}`);
    });

    // 페이즈 변경
    this.room.onStateChange((state) => {
      console.log(`페이즈: ${state.phase}`);
    });
  }

  private setupMessageHandlers() {
    this.room.onMessage('error', (message) => {
      alert(`에러: ${message.message}`);
    });

    this.room.onMessage('playerKicked', (message) => {
      console.log(`추방: ${message.sessionId} - ${message.reason}`);
    });

    this.room.onMessage('gameEnded', (message) => {
      alert(`게임 종료! 승자: ${message.winner}`);
    });
  }

  // 팀 선택
  selectTeam(team: 'red' | 'blue') {
    this.room.send('selectTeam', { team });
  }

  // 준비 상태 변경
  setReady(ready: boolean) {
    this.room.send('ready', { ready });
  }

  // 게임 시작 (호스트만)
  startGame() {
    this.room.send('startGame', {});
  }

  // 이동
  move(x: number, y: number) {
    this.room.send('move', { x, y });
  }

  // 눈덩이 발사
  throwSnowball(chargeLevel: number) {
    this.room.send('throwSnowball', { chargeLevel });
  }
}
```

### 메시지 전송 시퀀스 다이어그램

```
로비 페이즈:
  클라이언트              서버
     │                    │
     ├─ setProfile ──────→│ 프로필 저장
     ├─ selectTeam ──────→│ 팀 할당
     ├─ ready ───────────→│ 준비 상태 변경
     ├─ startGame ───────→│ 게임 시작
     │                    │

게임 페이즈:
  클라이언트              서버
     │                    │
     ├─ move ────────────→│ 위치 업데이트 (상태 동기화)
     ├─ throwSnowball ───→│ 눈덩이 생성 (상태 동기화)
     │                    │
     │←── 상태 변경 ───────┤ 매 프레임 업데이트
     │                    │

게임 종료:
  클라이언트              서버
     │                    │
     │←── gameEnded ──────┤ 승자 알림
     │                    │
```
