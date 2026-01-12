# 기여 가이드

SnowClash 프로젝트에 기여하는 방법을 안내합니다.

## 목차

1. [시작하기](#시작하기)
2. [개발 환경 설정](#개발-환경-설정)
3. [프로젝트 구조](#프로젝트-구조)
4. [코드 스타일](#코드-스타일)
5. [커밋 규칙](#커밋-규칙)
6. [Pull Request 가이드](#pull-request-가이드)
7. [이슈 작성 가이드](#이슈-작성-가이드)
8. [테스트 방법](#테스트-방법)
9. [보안 가이드](#보안-가이드)

---

## 시작하기

### 저장소 포크 및 클론

```bash
# 1. GitHub에서 저장소 Fork

# 2. 로컬에 클론
git clone https://github.com/YOUR_USERNAME/SnowClash.git
cd SnowClash

# 3. 원본 저장소를 upstream으로 추가
git remote add upstream https://github.com/nalbam/SnowClash.git
```

### 브랜치 생성

```bash
# main 브랜치 최신화
git checkout main
git pull upstream main

# 작업 브랜치 생성
git checkout -b feature/새로운-기능
```

---

## 개발 환경 설정

### 필수 요구사항

| 도구 | 버전 | 확인 명령어 |
|------|------|-------------|
| Node.js | 16 이상 | `node --version` |
| npm | 8 이상 | `npm --version` |

### 의존성 설치

```bash
npm install
```

### 개발 서버 실행

```bash
# 서버와 클라이언트 동시 실행 (권장)
npm run dev

# 또는 별도로 실행
npm run dev:server    # 서버만 (포트 2567)
npm run dev:client    # 클라이언트만 (포트 8080)
```

### 포트 정보

| 서비스 | 포트 | URL |
|--------|------|-----|
| 게임 서버 (Colyseus) | 2567 | http://localhost:2567 |
| 개발 클라이언트 (Webpack) | 8080 | http://localhost:8080 |

### 빌드

```bash
# 클라이언트 빌드
npm run build

# 서버 빌드
npm run build:server

# 프로덕션 실행
npm start
```

---

## 프로젝트 구조

```
SnowClash/
├── src/
│   ├── client/              # 클라이언트 코드 (Phaser 3)
│   │   ├── index.ts         # 진입점, Phaser 설정
│   │   ├── index.html       # HTML 템플릿
│   │   └── scenes/          # Phaser 씬들
│   │       ├── LobbyScene.ts
│   │       └── GameScene.ts
│   │
│   └── server/              # 서버 코드 (Colyseus)
│       ├── index.ts         # 진입점, Express/Colyseus 설정
│       ├── rooms/           # 게임 룸
│       │   └── GameRoom.ts  # 핵심 게임 로직
│       └── schema/          # 상태 스키마
│           ├── GameState.ts
│           ├── PlayerSchema.ts
│           └── SnowballSchema.ts
│
├── public/                  # 정적 파일 (빌드 결과물)
├── dist/                    # 서버 빌드 결과물
├── docs/                    # 문서
└── 설정 파일들
```

### 주요 파일 설명

| 파일 | 역할 |
|------|------|
| `src/server/rooms/GameRoom.ts` | 모든 게임 로직, 메시지 핸들러, 게임 루프 |
| `src/server/schema/*.ts` | Colyseus 상태 스키마 정의 |
| `src/client/scenes/LobbyScene.ts` | 로비 UI, 팀 선택, 준비 시스템 |
| `src/client/scenes/GameScene.ts` | 게임 렌더링, 입력 처리 |

---

## 코드 스타일

### 일반 규칙

- **언어**: TypeScript 사용
- **파일 크기**: 700줄 이하 권장 (500줄 넘으면 리팩토링 고려)
- **들여쓰기**: 2 스페이스
- **세미콜론**: 사용
- **문자열**: 작은따옴표 (`'`) 사용

### 네이밍 컨벤션

| 대상 | 규칙 | 예시 |
|------|------|------|
| 클래스 | PascalCase | `GameRoom`, `PlayerSchema` |
| 함수/메서드 | camelCase | `startGame()`, `checkWinConditions()` |
| 변수 | camelCase | `playerSpeed`, `isReady` |
| 상수 | UPPER_SNAKE_CASE | `MAP_SIZE`, `PLAYER_SPEED` |
| 파일명 | PascalCase (클래스), camelCase (기타) | `GameRoom.ts`, `index.ts` |

### TypeScript 규칙

```typescript
// 타입 명시 (any 사용 최소화)
function updatePlayer(player: PlayerSchema, delta: number): void {
  // ...
}

// 인터페이스 활용
interface MoveMessage {
  x: number;
  y: number;
}

// private 멤버 명시
class GameRoom extends Room<GameState> {
  private readyTimers: Map<string, NodeJS.Timeout> = new Map();
}
```

### 주석 규칙

```typescript
// 한 줄 주석은 이렇게

/**
 * 여러 줄 주석은 이렇게
 * 복잡한 로직 설명 시 사용
 */

// TODO: 나중에 구현할 기능
// FIXME: 수정 필요한 버그
```

---

## 커밋 규칙

### 커밋 메시지 형식

```
<type>: <subject>

[optional body]
```

### 타입 (type)

| 타입 | 설명 |
|------|------|
| `feat` | 새로운 기능 추가 |
| `fix` | 버그 수정 |
| `docs` | 문서 수정 |
| `style` | 코드 포맷팅 (기능 변경 없음) |
| `refactor` | 리팩토링 (기능 변경 없음) |
| `test` | 테스트 추가/수정 |
| `chore` | 빌드, 설정 변경 |

### 예시

```bash
# 좋은 예
feat: 파워업 아이템 시스템 추가
fix: 눈덩이 충돌 판정 오류 수정
docs: API 문서에 throwSnowball 설명 추가
refactor: GameRoom 게임 루프 로직 분리

# 나쁜 예
update code
fix bug
asdf
```

### 커밋 팁

- **작은 단위**로 커밋
- 하나의 커밋 = 하나의 논리적 변경
- 작동하는 상태에서만 커밋
- 의미 있는 메시지 작성

---

## Pull Request 가이드

### PR 생성 전 체크리스트

- [ ] 최신 main 브랜치와 merge/rebase 완료
- [ ] 로컬에서 정상 동작 확인
- [ ] `npm run build` 성공
- [ ] `npm run build:server` 성공
- [ ] 코드 스타일 준수
- [ ] 관련 문서 업데이트 (필요시)

### PR 제목 형식

```
<type>: <간단한 설명>
```

예시:
- `feat: 에너지 회복 아이템 추가`
- `fix: 팀 선택 버튼 클릭 안 되는 문제 수정`

### PR 본문 템플릿

```markdown
## 변경 사항
- 변경 내용 1
- 변경 내용 2

## 관련 이슈
Closes #123

## 테스트 방법
1. 서버 실행
2. 브라우저 탭 2개 열기
3. 각 탭에서 다른 팀 선택
4. 게임 시작하여 확인

## 스크린샷 (선택)
[관련 화면 캡처]
```

### 리뷰 대응

- 리뷰어의 피드백에 응답
- 수정 후 "resolved" 처리
- 큰 변경은 새 커밋으로

---

## 이슈 작성 가이드

### 버그 리포트

```markdown
## 버그 설명
[버그가 무엇인지 명확하게 설명]

## 재현 단계
1. 서버 실행
2. 로비에서 Red팀 선택
3. Ready 버튼 클릭
4. ...

## 예상 동작
[정상적으로 작동해야 할 방식]

## 실제 동작
[실제로 발생한 문제]

## 환경
- OS: macOS 14 / Windows 11 / Ubuntu 22.04
- Node.js: v20.x
- 브라우저: Chrome 120
```

### 기능 제안

```markdown
## 기능 설명
[추가하고 싶은 기능 설명]

## 사용 사례
[이 기능이 필요한 이유, 어떻게 사용될지]

## 구현 아이디어 (선택)
[대략적인 구현 방향]
```

---

## 테스트 방법

### 멀티플레이어 테스트

브라우저 탭을 여러 개 열어 테스트합니다.

```bash
# 1. 개발 서버 실행
npm run dev

# 2. 브라우저에서 http://localhost:8080 열기
# 3. 새 탭에서 같은 URL 열기 (최대 6명)
```

### 테스트 시나리오

**로비 테스트**
1. 팀 선택 (Red/Blue)
2. Ready 토글
3. 호스트 게임 시작
4. 1분 타임아웃 (준비 안 하면 추방)

**게임플레이 테스트**
1. WASD 이동
2. 영역 제한 확인
3. Space 눈덩이 발사
4. 차징 공격 (Space 길게)
5. 에너지 감소 확인
6. 스턴 상태 확인
7. 승리/패배 조건

**엣지 케이스**
1. 호스트 퇴장 시 승계
2. 게임 중 플레이어 퇴장
3. 팀 불균형 상태
4. 동시 피격

### 빌드 테스트

```bash
# 클라이언트 빌드
npm run build

# 서버 빌드
npm run build:server

# 프로덕션 모드 실행
npm start

# http://localhost:2567 에서 확인
```

---

## 보안 가이드

### 금지 사항

| 금지 항목 | 설명 |
|-----------|------|
| 비밀 정보 커밋 | API 키, 비밀번호, 토큰 등 |
| 하드코딩된 자격증명 | 코드에 비밀번호 직접 입력 |
| 민감한 데이터 로깅 | console.log에 개인정보 출력 |

### 환경변수 사용

```typescript
// 나쁜 예
const API_KEY = 'sk-1234567890abcdef';

// 좋은 예
const API_KEY = process.env.API_KEY;
```

### .gitignore 확인

다음 파일들이 커밋되지 않도록 확인:

```
.env
.env.local
*.pem
credentials.json
```

### 입력 검증

```typescript
// 서버에서 항상 입력 검증
this.onMessage('selectTeam', (client, message) => {
  const team = message.team;

  // 유효한 값인지 확인
  if (team !== 'red' && team !== 'blue') return;

  // 정원 확인
  if (teamCount >= 3) {
    client.send('error', { message: 'Team is full' });
    return;
  }
});
```

---

## 추가 자료

### 공식 문서

- [Colyseus 문서](https://docs.colyseus.io/)
- [Phaser 3 문서](https://photonstorm.github.io/phaser3-docs/)
- [TypeScript 문서](https://www.typescriptlang.org/docs/)

### 프로젝트 문서

- [아키텍처 가이드](./ARCHITECTURE.md)
- [API 레퍼런스](./API.md)
- [게임 메카닉](./GAME_MECHANICS.md)
- [배포 가이드](../DEPLOYMENT.md)
- [Google OAuth 설정](../GOOGLE_OAUTH_SETUP.md)

---

## 도움 요청

질문이나 도움이 필요하면:

1. [GitHub Issues](https://github.com/nalbam/SnowClash/issues)에서 검색
2. 관련 이슈가 없으면 새 이슈 생성
3. 커뮤니티에 질문

기여해 주셔서 감사합니다!
