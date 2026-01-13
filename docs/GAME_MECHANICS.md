# 게임 메카닉 가이드

SnowClash의 게임 규칙, 시스템, 상수값을 설명합니다.

## 목차

1. [게임 개요](#게임-개요)
2. [게임 상수](#게임-상수)
3. [게임 페이즈](#게임-페이즈)
4. [룸 시스템](#룸-시스템)
5. [봇 시스템](#봇-시스템)
6. [영역 시스템](#영역-시스템)
7. [플레이어 시스템](#플레이어-시스템)
8. [눈덩이 시스템](#눈덩이-시스템)
9. [승리 조건](#승리-조건)
10. [게임 루프](#게임-루프)

---

## 게임 개요

SnowClash는 **3v3 팀 기반 눈싸움 게임**입니다.

### 게임 목표

상대 팀의 모든 플레이어를 스턴 상태로 만들면 승리합니다.

### 게임 흐름

```
메인 메뉴 → 룸 참여/생성 → 로비 → 게임 시작 → 눈싸움 → 한 팀 전멸 → 게임 종료 → 메인 메뉴
```

1. **메인 메뉴**: 랜덤 닉네임 생성, 룸 목록 조회, 룸 생성/참여
2. **로비**: 플레이어들이 Red/Blue 팀을 선택하고 준비
3. **게임 시작**: 호스트가 게임 시작, 부족한 인원은 봇으로 채움
4. **눈싸움**: 이동하며 눈덩이를 던져 상대 에너지 깎기
5. **게임 종료**: 한 팀의 모든 플레이어가 스턴되면 종료

---

## 게임 상수

게임 밸런스를 결정하는 핵심 상수값입니다.

| 상수 | 값 | 단위 | 설명 |
|------|-----|------|------|
| `MAP_SIZE` | 600 | 픽셀 | 게임 맵의 가로/세로 크기 |
| `PLAYER_SPEED` | 3 | px/프레임 | 플레이어 이동 속도 |
| `SNOWBALL_SPEED` | 5 | px/프레임 | 눈덩이 이동 속도 |
| `NORMAL_DAMAGE` | 4 | 에너지 | 일반 공격 데미지 |
| `CHARGED_DAMAGE` | 7 | 에너지 | 차징 공격 데미지 |
| `READY_TIMEOUT` | 60000 | ms (1분) | 준비 타임아웃 |
| `HIT_RADIUS` | 20 | 픽셀 | 눈덩이 충돌 판정 반경 |
| `INITIAL_ENERGY` | 10 | 에너지 | 플레이어 초기 에너지 |
| `BOT_ATTACK_INTERVAL` | 2000 | ms (2초) | 봇 공격 간격 |

### 상수 위치

- 게임 상수: `src/server/rooms/GameRoom.ts`
- 봇 상수: `src/server/bots/BotController.ts`

```typescript
// GameRoom.ts
const READY_TIMEOUT = 60000;
const MAP_SIZE = 600;
const PLAYER_SPEED = 3;
const SNOWBALL_SPEED = 5;
const NORMAL_DAMAGE = 4;
const CHARGED_DAMAGE = 7;

// BotController.ts
const BOT_ATTACK_INTERVAL = 2000;
```

---

## 게임 페이즈

게임은 3개의 페이즈로 구성됩니다.

```
┌────────────┐      ┌────────────┐      ┌────────────┐
│   lobby    │─────→│  playing   │─────→│   ended    │
│  (로비)    │      │ (게임 중)   │      │  (종료)    │
└────────────┘      └────────────┘      └────────────┘
```

### lobby (로비)

게임 시작 전 대기 상태입니다.

**가능한 동작**
- 팀 선택 (Red/Blue)
- 준비 상태 토글
- 게임 시작 (호스트만)

**전환 조건**
- 최소 1명의 인간 플레이어가 준비 완료
- 호스트가 `startGame` 메시지 전송
- 부족한 인원은 봇으로 자동 채움

**자동 추방**
- 1분(60초) 내에 준비하지 않은 플레이어는 자동으로 추방됩니다.

### playing (게임 중)

실제 게임이 진행되는 상태입니다.

**가능한 동작**
- 이동 (WASD/방향키)
- 눈덩이 발사 (Space)

**60 FPS 게임 루프**
- 봇 행동 업데이트
- 눈덩이 위치 업데이트
- 충돌 검사
- 승리 조건 확인

**전환 조건**
- 한 팀의 모든 플레이어가 스턴됨
- 또는 양 팀 동시 전멸 (무승부)

### ended (종료)

게임이 끝난 상태입니다.

**표시 정보**
- 승자 팀 (`'red'`, `'blue'`, `'draw'`)
- 결과 화면

**전환**
- 모든 봇 제거
- 클라이언트에서 5초 후 메인 메뉴로 복귀

---

## 룸 시스템

여러 게임이 동시에 진행될 수 있는 룸 시스템입니다.

### 룸 생성 방식

| 방식 | 설명 |
|------|------|
| Quick Play | `joinOrCreate`로 기존 룸 참여 또는 새 룸 생성 |
| Create Room | 새 룸을 명시적으로 생성 |
| Join Room | 룸 목록에서 특정 룸에 참여 |

### 룸 속성

| 속성 | 설명 |
|------|------|
| `roomId` | 고유 룸 ID |
| `roomName` | 룸 이름 (생성자 닉네임 기반) |
| `playerCount` | 현재 플레이어 수 |
| `maxPlayers` | 최대 플레이어 수 (6명) |

### 호스트 시스템

- **호스트 지정**: 방에 처음 입장한 인간 플레이어
- **호스트 권한**: 게임 시작 버튼 사용 가능
- **호스트 승계**: 호스트가 퇴장하면 가장 오래된 플레이어가 새 호스트

```typescript
if (player?.isHost && this.state.players.size > 0) {
  const newHost = Array.from(this.state.players.values())[0];
  newHost.isHost = true;
}
```

---

## 봇 시스템

플레이어가 부족할 때 자동으로 채워지는 AI 플레이어입니다.

### 봇 생성 조건

- 게임 시작 시 각 팀이 3명 미만이면 봇으로 채움
- 최소 1명의 인간 플레이어가 있어야 게임 시작 가능

```
예시: Red팀 2명, Blue팀 1명인 경우
→ Red팀에 봇 1명 추가 (총 3명)
→ Blue팀에 봇 2명 추가 (총 3명)
→ 3v3 게임 시작
```

### 봇 특성

| 속성 | 값 |
|------|-----|
| 닉네임 | `[BOT] {랜덤이름}` (예: `[BOT] SnowBot42`) |
| 이동 | 없음 (제자리) |
| 공격 | 2초마다 상대 진영 방향으로 눈덩이 발사 |
| 데미지 | 일반 데미지 (4) |
| 피격 | 일반 플레이어와 동일 |
| 에너지 | 10 (일반 플레이어와 동일) |

### 봇 닉네임 목록

봇은 다음 이름 중 하나를 랜덤으로 사용합니다:
- SnowBot, FrostBot, IceBot, BlizzardBot, WinterBot
- ChillyBot, ArcticBot, PolarBot, GlacierBot, FlurryBot

### 봇 행동 로직

```typescript
// 2초마다 눈덩이 발사
if (currentTime - lastAttack >= BOT_ATTACK_INTERVAL) {
  this.botThrowSnowball(botId);
  this.lastAttackTime.set(botId, currentTime);
}

// 눈덩이 발사 방향 (상대 진영 방향)
if (bot.team === 'red') {
  snowball.velocityX = -SNOWBALL_SPEED;  // 좌하단 방향
  snowball.velocityY = SNOWBALL_SPEED;
} else {
  snowball.velocityX = SNOWBALL_SPEED;   // 우상단 방향
  snowball.velocityY = -SNOWBALL_SPEED;
}
```

### 봇 제거

- 게임 종료 시 모든 봇이 자동으로 제거됩니다.
- 봇은 로비에서 플레이어 목록에 표시되지 않습니다.

---

## 영역 시스템

맵은 `\` 모양 대각선으로 두 팀의 영역으로 분할됩니다.

### 맵 분할

```
       0                    600
    0  ┌─────────────────────┐
       │╲                    │
       │  ╲    Red 영역      │
       │    ╲   (우상단)     │
       │      ╲              │
       │        ╲            │
       │          ╲          │
       │            ╲        │
       │  Blue 영역   ╲      │
       │  (좌하단)      ╲    │
  600  └─────────────────────┘
```

### 영역 공식

대각선은 `(0, 0)`에서 `(600, 600)`으로 이어집니다. (`\` 모양)

| 팀 | 영역 조건 | 설명 |
|----|-----------|------|
| Red | `y <= x` | 대각선 위쪽 (우상단 삼각형) |
| Blue | `y >= x` | 대각선 아래쪽 (좌하단 삼각형) |

**구현 코드**

```typescript
private isInPlayerTerritory(x: number, y: number, team: string): boolean {
  if (team === 'red') {
    return y <= x;
  } else {
    return y >= x;
  }
}
```

### 이동 제한

- 플레이어는 **자기 팀 영역 내에서만** 이동 가능
- 경계를 넘어가려는 이동은 무시됨
- 맵 바깥(0 미만, 600 초과)으로도 이동 불가

---

## 플레이어 시스템

### 플레이어 속성

| 속성 | 초기값 | 설명 |
|------|--------|------|
| `energy` | 10 | 에너지 (체력) |
| `isStunned` | false | 스턴 상태 |
| `team` | '' | 소속 팀 |
| `isHost` | false | 호스트 여부 |
| `isReady` | false | 준비 상태 |
| `isBot` | false | 봇 여부 |

### 에너지 시스템

- **초기 에너지**: 10
- **데미지**: 눈덩이에 맞으면 에너지 감소
- **스턴**: 에너지가 0 이하가 되면 스턴 상태

```
에너지 10 ───(피격)───→ 에너지 6 ───(피격)───→ 에너지 0 → 스턴!
```

**스턴 상태**
- 이동 불가
- 공격 불가
- 눈덩이에 맞지 않음 (무적)
- 게임 종료까지 유지

### 이동 시스템

**조작 키**

| 키 | 방향 |
|----|------|
| W / ↑ | 위 (y - 1) |
| A / ← | 왼쪽 (x - 1) |
| S / ↓ | 아래 (y + 1) |
| D / → | 오른쪽 (x + 1) |

**이동 계산**

```typescript
newX = player.x + x * PLAYER_SPEED;  // x: -1, 0, 1
newY = player.y + y * PLAYER_SPEED;  // PLAYER_SPEED: 3
```

**대각선 이동**
- 두 방향 키 동시 입력 시 대각선 이동
- 예: W + D = 우상단 이동

### 초기 위치 배치

게임 시작 시 팀별로 자기 영역의 코너에 배치됩니다.

| 팀 | 영역 | 시작 위치 | 좌표 범위 |
|----|------|-----------|-----------|
| Red | 우상단 | 우상단 코너 | (420~600, 0~180) |
| Blue | 좌하단 | 좌하단 코너 | (0~180, 420~600) |

```typescript
if (player.team === 'red') {
  player.x = MAP_SIZE * 0.7 + Math.random() * (MAP_SIZE * 0.3);  // 420 ~ 600
  player.y = Math.random() * (MAP_SIZE * 0.3);                   // 0 ~ 180
} else {
  player.x = Math.random() * (MAP_SIZE * 0.3);                   // 0 ~ 180
  player.y = MAP_SIZE * 0.7 + Math.random() * (MAP_SIZE * 0.3);  // 420 ~ 600
}
```

---

## 눈덩이 시스템

### 발사 방법

**Space 키 사용**
- **탭 (짧게 누르기)**: 일반 공격
- **홀드 (길게 누르기)**: 차징 공격

### 차징 메카닉

```
누르기 시작 ──→ 차징 중 ──→ 놓기 ──→ 발사
     │              │           │
     └───── 시간 ────┘           │
           0 ~ 1초              └── chargeLevel 계산
```

**차징 레벨 계산**

```typescript
chargeLevel = Math.min(chargeTime / 1000, 1);  // 0.0 ~ 1.0
```

- 최대 1초까지 차징 가능
- 1초 이상 누르고 있어도 `chargeLevel`은 1.0

### 데미지 결정

| 조건 | 데미지 | 설명 |
|------|--------|------|
| `chargeLevel < 0.7` | 4 | 일반 공격 |
| `chargeLevel >= 0.7` | 7 | 차징 공격 |

**임계값**: 0.7초 (700ms)

```typescript
const damage = chargeLevel >= 0.7 ? CHARGED_DAMAGE : NORMAL_DAMAGE;
```

### 궤적 (이동 방향)

눈덩이는 팀에 따라 **상대 진영 방향**으로 대각선 이동합니다.

| 팀 | 영역 | 발사 방향 | 속도 (velocityX, velocityY) |
|----|------|-----------|------------------------------|
| Red | 우상단 | 좌하단 ↙ (Blue 진영으로) | (-5, +5) |
| Blue | 좌하단 | 우상단 ↗ (Red 진영으로) | (+5, -5) |

```
                    Red 영역 (우상단)
                         ●
                        ↙  눈덩이
                      ↙
    대각선 경계 (\)  ╲
                      ↗
                     ↗  눈덩이
                    ●
       Blue 영역 (좌하단)
```

**구현 코드**

```typescript
if (player.team === 'red') {
  snowball.velocityX = -SNOWBALL_SPEED;  // -5 (왼쪽)
  snowball.velocityY = SNOWBALL_SPEED;   // +5 (아래)
} else {
  snowball.velocityX = SNOWBALL_SPEED;   // +5 (오른쪽)
  snowball.velocityY = -SNOWBALL_SPEED;  // -5 (위)
}
```

### 충돌 판정

**히트 반경**: 20 픽셀

```typescript
const distance = Math.sqrt(
  Math.pow(player.x - snowball.x, 2) +
  Math.pow(player.y - snowball.y, 2)
);

if (distance < 20) {  // 충돌!
  player.energy -= snowball.damage;
}
```

**충돌 조건**
1. 플레이어와 눈덩이 거리가 20픽셀 미만
2. 눈덩이가 **상대 팀** 플레이어를 맞춤 (아군 피해 없음)
3. 대상이 스턴 상태가 아님

**무시되는 경우**
- 아군 플레이어
- 스턴된 플레이어
- 맵 경계를 벗어난 눈덩이

### 눈덩이 제거

다음 조건에서 눈덩이가 제거됩니다:

| 조건 | 설명 |
|------|------|
| 맵 경계 초과 | x < -100, x > 700, y < -100, y > 700 |
| 플레이어 적중 | 충돌 판정 성공 시 |

---

## 승리 조건

### 승리 판정

| 상황 | 결과 |
|------|------|
| Red팀 전원 스턴 & Blue팀 생존자 있음 | **Blue 승리** |
| Blue팀 전원 스턴 & Red팀 생존자 있음 | **Red 승리** |
| 양팀 동시 전멸 | **무승부** |

**구현 코드**

```typescript
private checkWinConditions() {
  const redAlive = players.filter(p => p.team === 'red' && !p.isStunned).length;
  const blueAlive = players.filter(p => p.team === 'blue' && !p.isStunned).length;

  if (redAlive === 0 && blueAlive > 0) {
    this.endGame('blue');
  } else if (blueAlive === 0 && redAlive > 0) {
    this.endGame('red');
  } else if (redAlive === 0 && blueAlive === 0) {
    this.endGame('draw');
  }
}
```

### 게임 종료 처리

1. `phase`를 `'ended'`로 변경
2. `winner`에 승자 저장
3. 게임 루프 정지
4. 모든 봇 제거
5. 모든 클라이언트에 `gameEnded` 메시지 전송
6. 클라이언트에서 5초 후 메인 메뉴로 복귀

---

## 게임 루프

게임이 진행되는 동안 **60 FPS**로 실행되는 루프입니다.

### 루프 시작

게임 시작 시 `setInterval`로 루프를 생성합니다.

```typescript
this.updateInterval = setInterval(() => {
  this.updateGame();
}, 1000 / 60);  // 약 16.67ms마다 실행
```

### 루프 내용 (updateGame)

매 프레임마다 다음을 수행합니다:

```
┌─────────────────────────────────────────────┐
│               updateGame()                   │
├─────────────────────────────────────────────┤
│ 1. 봇 업데이트                               │
│    └── 2초 경과 시 눈덩이 발사               │
│                                              │
│ 2. 모든 눈덩이 순회                          │
│    ├── 위치 업데이트 (velocity 적용)         │
│    ├── 경계 체크 → 제거                      │
│    └── 플레이어 충돌 체크                    │
│        ├── 아군 → 스킵                       │
│        ├── 스턴된 플레이어 → 스킵            │
│        └── 거리 < 20 → 데미지 적용, 제거     │
│                                              │
│ 3. 제거 대상 눈덩이 삭제                     │
│                                              │
│ 4. 승리 조건 확인                            │
└─────────────────────────────────────────────┘
```

### 루프 종료

게임이 끝나면 루프를 정리합니다.

```typescript
if (this.updateInterval) {
  clearInterval(this.updateInterval);
  this.updateInterval = undefined;
}
```

### 성능 고려사항

- **60 FPS**: 부드러운 게임플레이를 위한 표준 프레임률
- **델타 패치**: Colyseus가 변경된 상태만 클라이언트에 전송
- **효율적인 충돌 검사**: O(눈덩이 수 × 플레이어 수)

---

## 밸런스 조정 가이드

게임 밸런스를 조정하려면 `GameRoom.ts`의 상수를 수정합니다.

### 난이도 조정 예시

**더 빠른 게임**
```typescript
const PLAYER_SPEED = 5;     // 3 → 5
const SNOWBALL_SPEED = 8;   // 5 → 8
```

**더 오래 버티기**
```typescript
const NORMAL_DAMAGE = 2;    // 4 → 2
const CHARGED_DAMAGE = 4;   // 7 → 4
// 또는 초기 에너지 증가
player.energy = 20;         // 10 → 20
```

**더 큰 맵**
```typescript
const MAP_SIZE = 1200;      // 600 → 1200
```

**봇 공격 빈도 조정**
```typescript
// BotController.ts
const BOT_ATTACK_INTERVAL = 1000;  // 2000 → 1000 (1초)
```

### 주의사항

- 클라이언트의 렌더링 크기(600x600)와 맵 크기(MAP_SIZE)는 동일해야 합니다
- 맵 크기 변경 시 클라이언트 코드도 함께 수정 필요
- 속도 변경 시 게임 느낌이 크게 달라질 수 있음
