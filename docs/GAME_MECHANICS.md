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
| `PLAYER_SPEED` | 2 | px/프레임 | 플레이어 이동 속도 |
| `SNOWBALL_SPEED` | 4 | px/프레임 | 눈덩이 이동 속도 |
| `NORMAL_DAMAGE` | 4 | 에너지 | 일반 공격 데미지 |
| `CHARGED_DAMAGE` | 7 | 에너지 | 차징 공격 데미지 |
| `READY_TIMEOUT` | 60000 | ms (1분) | 준비 타임아웃 |
| `PLAYER_RADIUS` | 15 | 픽셀 | 플레이어 캐릭터 반경 |
| `SNOWBALL_RADIUS` | 5/9 | 픽셀 | 눈덩이 반경 (일반 5, 차징 9) |
| `HIT_RADIUS` | 20/24 | 픽셀 | 충돌 판정 반경 (일반 20, 차징 24) |
| `INITIAL_ENERGY` | 10 | 에너지 | 플레이어 초기 에너지 |
| `BOT_ATTACK_INTERVAL` | 2000 | ms (2초) | 봇 공격 간격 |
| `BOT_DIRECTION_CHANGE_INTERVAL` | 1000 | ms (1초) | 봇 방향 변경 간격 |

### 상수 위치

- 게임 상수: `src/server/rooms/GameRoom.ts`
- 봇 상수: `src/server/bots/BotController.ts`

```typescript
// GameRoom.ts
const READY_TIMEOUT = 60000;
const MAP_SIZE = 600;
const PLAYER_SPEED = 2;
const SNOWBALL_SPEED = 4;
const NORMAL_DAMAGE = 4;
const CHARGED_DAMAGE = 7;

// BotController.ts
const BOT_ATTACK_INTERVAL = 2000;
const BOT_DIRECTION_CHANGE_INTERVAL = 1000;
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
- 개인별 결과 메시지:
  - 승리: "You Win!" (팀 색상)
  - 패배: "You Lose!" (회색)
  - 무승부: "Draw!" (흰색)
- "Return to Menu" 버튼 (260px 너비)
- 반투명 배경 오버레이 (20% 불투명도)

**승리 팀 특전**
- 모든 플레이어 부활 (에너지 회복 없음, 스턴 해제만)
- 자유롭게 이동 가능 (WASD/Arrow 키)
- 정지 시 자동으로 만세 애니메이션 재생
- 봇도 만세 애니메이션 재생

**게임 종료 후 제한사항**
- 모든 플레이어 눈덩이 투척 불가
- 날아가는 눈덩이는 계속 이동하지만 피해 없음
- 모든 에너지 바 숨김
- 봇 AI 동작 중지

**전환**
- 모든 봇 3초 후 제거
- "Return to Menu" 버튼 클릭 시 메인 메뉴로 복귀 (수동 복귀)

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
| 이동 | 1초마다 랜덤 방향으로 이동 (영역 내) |
| 이동 속도 | 플레이어와 동일 (2 px/프레임) |
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
// 1초마다 랜덤 방향 변경
if (currentTime - lastDirChange >= BOT_DIRECTION_CHANGE_INTERVAL) {
  const angle = Math.random() * Math.PI * 2;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  this.moveDirection.set(botId, { dx, dy });
}

// 영역 내 이동 (영역 밖으로 나가면 방향 반전)
const newX = bot.x + dir.dx * PLAYER_SPEED;
const newY = bot.y + dir.dy * PLAYER_SPEED;
if (this.isInTerritory(newX, newY, bot.team)) {
  bot.x = newX;
  bot.y = newY;
} else {
  this.moveDirection.set(botId, { dx: -dir.dx, dy: -dir.dy });
}

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

- 게임 종료 시 모든 봇이 3초 후 자동으로 제거됩니다.
- 봇은 로비에서 플레이어 목록에 표시되지 않습니다.
- **게임 종료 후**: 승리 팀 봇도 만세 애니메이션을 재생합니다.
- 봇 AI는 게임 종료 시 즉시 동작을 중단합니다 (`phase !== 'playing'` 체크).

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
| Red | `y <= x - 15` | 대각선 위쪽 (우상단 삼각형, 15px 패딩) |
| Blue | `y >= x + 15` | 대각선 아래쪽 (좌하단 삼각형, 15px 패딩) |

**플레이어 크기 패딩**

플레이어 반경(15px)만큼 대각선과 맵 경계에 패딩을 적용하여 캐릭터가 경계를 넘지 않습니다.

**구현 코드**

```typescript
private isInPlayerTerritory(x: number, y: number, team: string): boolean {
  const playerRadius = 15;

  // 맵 경계 패딩
  if (x < playerRadius || x > MAP_SIZE - playerRadius ||
      y < playerRadius || y > MAP_SIZE - playerRadius) {
    return false;
  }

  // 대각선 기준 패딩
  if (team === 'red') {
    return y <= x - playerRadius;
  } else {
    return y >= x + playerRadius;
  }
}
```

### 이동 제한

- 플레이어는 **자기 팀 영역 내에서만** 이동 가능
- 경계를 넘어가려는 이동은 무시됨
- 맵 바깥(0 미만, 600 초과)으로도 이동 불가

---

## 플레이어 시스템

### 캐릭터 애니메이션

플레이어는 상태에 따라 다양한 픽셀 아트 애니메이션을 표시합니다.

| 애니메이션 | 프레임 수 | 속도 (FPS) | 재생 방식 | 표시 조건 |
|-----------|----------|-----------|----------|----------|
| **Idle** | 1 | - | 정지 | 정지 중 (게임 중) |
| **Walk** | 4 | 8 | 반복 | 이동 중 |
| **Throw Prepare** | 1 | - | 정지 | 눈덩이 차징 시작 |
| **Throw** | 1 | - | 정지 | 눈덩이 발사 순간 |
| **Throw Follow** | 1 | - | 정지 | 눈덩이 발사 후 |
| **Stunned** | 1 | - | 정지 + 60% 투명도 | 에너지 0 이하 |
| **Cheer** | 2 | 4 | 반복 | 게임 종료 후 승리 팀이 정지 중일 때 |

**만세(Cheer) 애니메이션 상세:**
- 2개 프레임으로 구성 (cheer1, cheer2)
- 프레임 1: 팔을 양옆으로 벌림
- 프레임 2: 팔을 V자로 위로 올림
- 4 FPS로 반복 재생 (0.25초당 1프레임)
- 게임 종료 후 승리 팀이 정지 상태일 때만 재생
- 이동 시 걷기 애니메이션으로 전환
- **구현 위치**: `src/client/assets/PixelCharacter.ts`의 `CHARACTER_CHEER1`, `CHARACTER_CHEER2`
- **디자인 노트**: 피부색 픽셀(111)을 사용하여 팔이 움직이도록 설계 (모자가 아님)

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
- **눈덩이에 맞음 (더미/쉴드 역할)** - 팀원을 보호하는 장벽으로 활용 가능
- 에너지는 더 이상 감소하지 않음 (이미 0)
- 게임 종료까지 유지

### 이동 시스템

**조작 방식**

| 입력 방식 | 동작 | 설명 |
|----------|------|------|
| **키보드** | W / ↑ | 위로 이동 (y - 1) |
| **키보드** | A / ← | 왼쪽으로 이동 (x - 1) |
| **키보드** | S / ↓ | 아래로 이동 (y + 1) |
| **키보드** | D / → | 오른쪽으로 이동 (x + 1) |
| **마우스** | 클릭 앤 홀드 | 커서 위치를 향해 이동 |
| **터치** | 터치 앤 홀드 | 터치 위치를 향해 이동 |

**포인터 기반 이동 (마우스/터치)**
- 클릭/터치한 위치를 향해 플레이어가 직선으로 이동
- 계속 누르고 있어야 이동 유지 (놓으면 정지)
- 목표 위치 5px 이내 도달 시 자동 정지
- 360도 자유로운 방향 이동 (정규화된 방향 벡터 사용)
- 키보드 입력이 우선순위를 가짐 (키보드 입력 시 포인터 입력 취소)

**이동 계산**

키보드 입력:
```typescript
newX = player.x + x * PLAYER_SPEED;  // x: -1, 0, 1
newY = player.y + y * PLAYER_SPEED;  // PLAYER_SPEED: 2
```

포인터 입력 (마우스/터치):
```typescript
// 플레이어에서 커서까지의 방향 벡터 계산
const dx = cursorX - player.x;
const dy = cursorY - player.y;
const distance = Math.sqrt(dx * dx + dy * dy);

// 거리가 5px 초과인 경우에만 이동
if (distance > 5) {
  // 정규화된 방향 벡터 사용 (360도 자유 이동)
  moveX = dx / distance;  // -1.0 ~ 1.0
  moveY = dy / distance;  // -1.0 ~ 1.0

  newX = player.x + moveX * PLAYER_SPEED;
  newY = player.y + moveY * PLAYER_SPEED;
}
```

**대각선 이동**
- 키보드: 두 방향 키 동시 입력 시 대각선 이동 (예: W + D = 우상단)
- 포인터: 360도 모든 방향으로 자유롭게 이동 가능

### 초기 위치 배치

게임 시작 시 팀별로 자기 영역 내 랜덤 위치에 배치됩니다.

| 팀 | 영역 | 조건 |
|----|------|------|
| Red | 우상단 삼각형 | `y < x - 30` (대각선에서 30px 마진) |
| Blue | 좌하단 삼각형 | `y > x + 30` (대각선에서 30px 마진) |

```typescript
const margin = 30;  // 대각선에서 거리
const padding = 20; // 맵 경계에서 거리

if (player.team === 'red') {
  // Red team: top-right triangle (y < x - margin)
  let x, y;
  do {
    x = padding + Math.random() * (MAP_SIZE - padding * 2);
    y = padding + Math.random() * (MAP_SIZE - padding * 2);
  } while (y >= x - margin);
  player.x = x;
  player.y = y;
} else {
  // Blue team: bottom-left triangle (y > x + margin)
  let x, y;
  do {
    x = padding + Math.random() * (MAP_SIZE - padding * 2);
    y = padding + Math.random() * (MAP_SIZE - padding * 2);
  } while (y <= x + margin);
  player.x = x;
  player.y = y;
}
```

---

## 눈덩이 시스템

### 발사 방법

**입력 방식**

| 입력 | 동작 |
|------|------|
| **키보드** | Space 키 (홀드하여 차징, 놓으면 발사) |
| **마우스** | 클릭 앤 홀드 (홀드하여 차징, 놓으면 발사) |
| **터치** | 탭 앤 홀드 (홀드하여 차징, 놓으면 발사) |

**동작 방식**
- **탭 (짧게 누르기)**: 일반 공격 (4 데미지)
- **홀드 (길게 누르기)**: 차징 공격 (7 데미지)

**포인터 입력의 이중 용도**

포인터(마우스/터치)는 이동과 공격을 모두 처리합니다:

```
포인터 누름
    │
    ├─ 계속 누르고 있음 → 커서 위치로 이동 (이동 중)
    │
    └─ 충분히 길게 홀드 (0.2초 이상) → 차징 시작
           │
           └─ 놓음 → 눈덩이 발사
```

**주의사항:**
- 키보드 입력이 있으면 포인터 입력이 취소됩니다
- 이동 중 키보드를 누르면 포인터 이동이 중단되고 키보드 방향으로 전환
- 차징 중 키보드를 누르면 차징이 취소됩니다

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
| Red | 우상단 | 좌하단 ↙ (Blue 진영으로) | (-4, +4) |
| Blue | 좌하단 | 우상단 ↗ (Red 진영으로) | (+4, -4) |

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
  snowball.velocityX = -SNOWBALL_SPEED;  // -4 (왼쪽)
  snowball.velocityY = SNOWBALL_SPEED;   // +4 (아래)
} else {
  snowball.velocityX = SNOWBALL_SPEED;   // +4 (오른쪽)
  snowball.velocityY = -SNOWBALL_SPEED;  // -4 (위)
}
```

### 충돌 판정

**원형 충돌 검사**: 플레이어 반경 + 눈덩이 반경

| 눈덩이 종류 | 눈덩이 반경 | 플레이어 반경 | 히트 반경 |
|------------|------------|--------------|----------|
| 일반 (4 데미지) | 5px | 15px | 20px |
| 차징 (7 데미지) | 9px | 15px | 24px |

```typescript
const distance = Math.sqrt(
  Math.pow(player.x - snowball.x, 2) +
  Math.pow(player.y - snowball.y, 2)
);

const playerRadius = 15;
const snowballRadius = snowball.damage >= CHARGED_DAMAGE ? 9 : 5;
const hitRadius = playerRadius + snowballRadius;

if (distance < hitRadius) {  // 충돌!
  if (!player.isStunned) {
    player.energy -= snowball.damage;
  }
  // 스턴된 플레이어도 맞지만 에너지 감소 없음 (쉴드 역할)
}
```

**충돌 조건**
1. 플레이어와 눈덩이 거리가 히트 반경 미만
2. 눈덩이가 **상대 팀** 플레이어를 맞춤 (아군 피해 없음)

**무시되는 경우**
- 아군 플레이어
- 맵 경계를 벗어난 눈덩이

**스턴된 플레이어 (쉴드 역할)**
- 눈덩이에 맞음 (눈덩이 제거됨)
- 에너지 감소 없음
- 팀원을 보호하는 장벽으로 활용 가능

### 눈덩이 제거

다음 조건에서 눈덩이가 제거됩니다:

| 조건 | 설명 |
|------|------|
| 맵 경계 초과 | x < -100, x > 700, y < -100, y > 700 |
| 플레이어 적중 | 충돌 판정 성공 시 |

### 파편 효과 (클라이언트)

눈덩이가 플레이어에게 맞으면 파편이 흩어지는 효과가 표시됩니다.

| 속성 | 값 |
|------|-----|
| 파편 수 | 6개 |
| 색상 | 발사 팀 색상 (Red: #ff6666, Blue: #6666ff) |
| 애니메이션 | 방사형으로 흩어지며 페이드아웃 |
| 지속 시간 | 400ms |

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

**서버 측 처리:**
1. `phase`를 `'ended'`로 변경
2. `winner`에 승자 저장 (`'red'`, `'blue'`, `'draw'`)
3. 모든 클라이언트에 `gameEnded` 메시지 전송
4. 눈덩이 충돌 시 피해 적용 중단 (`this.state.phase !== 'playing'` 체크)
5. 봇 AI 동작 중단 (`BotController.updateBots()` 조기 반환)
6. 3초 후 게임 루프 정지 및 모든 봇 제거

**클라이언트 측 처리:**
1. 게임 종료 화면 표시:
   - 반투명 배경 오버레이 (0x000000, 0.2 불투명도)
   - 개인별 결과 메시지 (승리/패배/무승부)
   - "Return to Menu" 버튼 (260px × 50px)
2. 모든 에너지 바 숨김
3. 승리 팀 처리:
   - `isStunned` 상태 무시 (이동 가능)
   - 이동 입력 허용 (키보드/포인터)
   - 정지 시 만세 애니메이션 자동 재생
4. 패배 팀 처리:
   - 모든 입력 차단
   - 스턴 상태 유지
5. 눈덩이 투척 차단 (`!this.gameEnded` 체크)
6. 버튼 클릭 시 방 퇴장 후 메인 메뉴로 이동 (수동 복귀)

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
const PLAYER_SPEED = 4;     // 2 → 4
const SNOWBALL_SPEED = 8;   // 4 → 8
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
