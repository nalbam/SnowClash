# SnowClash Deployment Scripts

AWS EC2에 SnowClash를 배포하기 위한 스크립트입니다.

## Scripts

```
scripts/
├── ec2-user-data.sh      # EC2 User Data - 인스턴스 초기화
├── deploy-ec2-docker.sh  # 대화형 배포 스크립트
├── lib/
│   └── common.sh         # 공통 함수 라이브러리
└── README.md
```

| 스크립트 | 설명 |
|---------|------|
| `ec2-user-data.sh` | EC2 User Data로 사용. Docker, Nginx 설치 및 자동 배포 |
| `deploy-ec2-docker.sh` | SSH 접속 후 대화형 배포. 버전 선택, SSL 설정 등 |
| `lib/common.sh` | 공통 함수 (로깅, Docker, SSM, Nginx 등) |

## Prerequisites

### 1. AWS SSM Parameter Store

환경 변수를 SSM Parameter Store에 저장합니다:

```bash
aws ssm put-parameter \
  --name "/env/prod/snowclash" \
  --type "SecureString" \
  --value "NODE_ENV=production
PORT=2567
SERVER_URL=game.example.com
CLIENT_URL=https://nalbam.github.io
ALLOWED_ORIGINS=https://game.example.com,https://nalbam.github.io"
```

### 2. IAM Role

EC2 인스턴스에 SSM 읽기 권한이 필요합니다:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter"
      ],
      "Resource": "arn:aws:ssm:*:*:parameter/env/prod/snowclash"
    }
  ]
}
```

### 3. Security Group

| Port | Protocol | Source | 설명 |
|------|----------|--------|------|
| 22 | TCP | Your IP | SSH |
| 80 | TCP | 0.0.0.0/0 | HTTP (redirect) |
| 443 | TCP | 0.0.0.0/0 | HTTPS |

### 4. DNS

도메인의 A 레코드를 EC2 Public IP로 설정합니다.

## Quick Start

### 방법 1: EC2 User Data (권장)

EC2 인스턴스 생성 시 User Data로 `ec2-user-data.sh` 사용:

```bash
aws ec2 run-instances \
  --image-id ami-0c55b159cbfafe1f0 \
  --instance-type t3.small \
  --key-name your-key \
  --security-group-ids sg-xxx \
  --iam-instance-profile Name=your-instance-profile \
  --user-data file://scripts/ec2-user-data.sh \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=snowclash}]'
```

User Data는 다음 작업을 자동 수행합니다:
1. 시스템 업데이트
2. Docker, Nginx, Certbot, Git 설치
3. Repository 클론
4. AWS SSM에서 .env 가져오기
5. Docker 컨테이너 시작
6. Nginx 설정

완료 후 SSL만 수동으로 설정:

```bash
ssh -i your-key.pem ec2-user@<public-ip>
sudo certbot --nginx -d your-domain.com
```

### 방법 2: 대화형 배포

```bash
# SSH 접속
ssh -i your-key.pem ec2-user@<public-ip>

# 스크립트 다운로드 및 실행
curl -fsSL https://raw.githubusercontent.com/nalbam/SnowClash/main/scripts/deploy-ec2-docker.sh | bash
```

## 환경 변수

### SSM Parameter 형식

```
NODE_ENV=production
PORT=2567
SERVER_URL=game.example.com
CLIENT_URL=https://nalbam.github.io
ALLOWED_ORIGINS=https://game.example.com,https://nalbam.github.io
REDIS_URL=redis://localhost:6379  # Optional
```

### 환경 변수 설명

| 변수 | 필수 | 설명 |
|------|------|------|
| `NODE_ENV` | O | `production` |
| `PORT` | O | 서버 포트 (기본: 2567) |
| `SERVER_URL` | O | 서버 도메인 |
| `CLIENT_URL` | O | 클라이언트 URL |
| `ALLOWED_ORIGINS` | O | CORS 허용 도메인 (쉼표 구분) |
| `REDIS_URL` | X | Redis URL (수평 확장용) |

## 관리 스크립트

배포 후 `~/SnowClash`에 관리 스크립트가 생성됩니다:

| 스크립트 | 설명 |
|---------|------|
| `start.sh` | 컨테이너 시작 |
| `stop.sh` | 컨테이너 중지 |
| `restart.sh` | 컨테이너 재시작 |
| `update.sh` | 버전 업데이트 (버전 선택, SSM 새로고침 옵션) |
| `logs.sh` | 로그 확인 |
| `status.sh` | 상태 확인 |

## 업데이트

### 빠른 업데이트

```bash
cd ~/SnowClash
./scripts/deploy-ec2-docker.sh
# 버전 선택
# SSM 새로고침 여부 선택
```

### 수동 업데이트

```bash
# 새 버전 Pull
docker pull ghcr.io/nalbam/snowclash:v1.0.1

# 재시작
docker stop snowclash
docker rm snowclash
docker run -d \
  --name snowclash \
  --restart unless-stopped \
  -p 127.0.0.1:2567:2567 \
  --env-file ~/SnowClash/.env \
  ghcr.io/nalbam/snowclash:v1.0.1
```

## 상태 확인

```bash
# 컨테이너 상태
docker ps

# 로그
docker logs -f snowclash

# 리소스
docker stats snowclash

# API 테스트
curl https://your-domain.com/api/rooms
curl https://your-domain.com/api/nickname

# Nginx 상태
sudo systemctl status nginx

# SSL 인증서
sudo certbot certificates
```

## 문제 해결

### Docker 권한 오류

```bash
# 그룹에 추가 후 재로그인
sudo usermod -aG docker $USER
exit
# 재접속
```

### SSM 가져오기 실패

```bash
# IAM 역할 확인
aws sts get-caller-identity

# SSM 파라미터 확인
aws ssm get-parameter --name "/env/prod/snowclash" --with-decryption
```

### SSL 인증서 발급 실패

```bash
# DNS 확인
dig +short your-domain.com

# Nginx 상태
sudo nginx -t

# 수동 발급
sudo certbot certonly --nginx -d your-domain.com
```

### 컨테이너 시작 실패

```bash
# 로그 확인
docker logs snowclash

# .env 파일 확인
cat ~/SnowClash/.env

# 수동 재시작
docker stop snowclash
docker rm snowclash
docker run -d \
  --name snowclash \
  --restart unless-stopped \
  -p 127.0.0.1:2567:2567 \
  --env-file ~/SnowClash/.env \
  ghcr.io/nalbam/snowclash:latest
```

## 인스턴스 타입 권장

| 타입 | vCPU | RAM | 가격 | 권장 |
|------|------|-----|------|------|
| t3.micro | 2 | 1GB | ~$9/월 | 테스트 |
| t3.small | 2 | 2GB | ~$18/월 | 소규모 |
| t3.medium | 2 | 4GB | ~$36/월 | 프로덕션 |
| t4g.micro | 2 | 1GB | ~$6/월 | 테스트 (ARM) |
| t4g.small | 2 | 2GB | ~$12/월 | 권장 (ARM) |
