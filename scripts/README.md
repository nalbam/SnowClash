# SnowClash Deployment Scripts

AWS EC2에 SnowClash를 배포하기 위한 스크립트입니다.

## Quick Start

### 1. EC2 인스턴스 생성

```bash
# Amazon Linux 2023 (x86_64 또는 ARM64)
aws ec2 run-instances \
  --image-id ami-0c55b159cbfafe1f0 \
  --instance-type t3.micro \
  --key-name your-key \
  --security-group-ids sg-xxx \
  --user-data file://scripts/ec2-user-data.sh \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=snowclash}]'
```

### 2. Security Group 설정

| Port | Protocol | Source | 설명 |
|------|----------|--------|------|
| 22 | TCP | Your IP | SSH |
| 80 | TCP | 0.0.0.0/0 | HTTP (redirect to HTTPS) |
| 443 | TCP | 0.0.0.0/0 | HTTPS |

### 3. DNS 설정

도메인의 A 레코드를 EC2 Public IP로 설정

### 4. 배포 스크립트 실행

```bash
# SSH 접속
ssh -i your-key.pem ec2-user@<public-ip>

# User Data 완료 확인 (5-10분 소요)
tail -f /var/log/user-data.log

# 배포 스크립트 실행
cd SnowClash
./scripts/deploy-ec2.sh
```

## Scripts

| 스크립트 | 설명 |
|---------|------|
| `deploy-ec2.sh` | 전체 배포 또는 빠른 업데이트 |
| `ec2-user-data.sh` | EC2 User Data용 초기 설정 |

## 배포 후 생성되는 관리 스크립트

| 스크립트 | 설명 |
|---------|------|
| `start.sh` | 서버 시작 |
| `stop.sh` | 서버 중지 |
| `restart.sh` | 서버 재시작 |
| `update.sh` | 최신 코드 pull 및 재빌드 (비대화형) |
| `logs.sh` | 로그 확인 |
| `status.sh` | 상태 확인 |

## 게임 업데이트

기존 설치를 최신 버전으로 업데이트하는 방법:

### 방법 1: 빠른 업데이트 (추천, 1-2분)

```bash
cd ~/SnowClash/scripts
./deploy-ec2.sh
# 1 선택 또는 Enter
```

자동으로:
- Git pull (최신 코드)
- npm ci (의존성 설치)
- npm run build:server (빌드)
- pm2 restart (재시작)

### 방법 2: 비대화형 업데이트 (CI/CD용)

```bash
cd ~/SnowClash
./update.sh
```

### 전체 재설치

도메인/SSL 변경 시:

```bash
cd ~/SnowClash/scripts
./deploy-ec2.sh
# 2 선택
```

## 수동 배포 (User Data 없이)

```bash
# SSH 접속 후

# 1. 시스템 업데이트
sudo dnf update -y

# 2. Node.js 22 설치
curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
sudo dnf install -y nodejs

# 3. 필수 패키지 설치
sudo dnf install -y git nginx certbot python3-certbot-nginx
sudo npm install -g pm2

# 4. 프로젝트 클론
git clone https://github.com/nalbam/SnowClash.git
cd SnowClash

# 5. 배포 스크립트 실행
./scripts/deploy-ec2.sh
```

## 인스턴스 타입 권장

| 타입 | vCPU | RAM | 가격 | 권장 |
|------|------|-----|------|------|
| t3.micro | 2 | 1GB | ~$9/월 | 테스트 |
| t3.small | 2 | 2GB | ~$18/월 | 소규모 |
| t3.medium | 2 | 4GB | ~$36/월 | 프로덕션 |
| t4g.micro | 2 | 1GB | ~$6/월 | 테스트 (ARM) |
| t4g.small | 2 | 2GB | ~$12/월 | 권장 (ARM) |

## 문제 해결

### 업데이트 후 서버 시작 실패

```bash
# 로그 확인
pm2 logs snowclash --lines 50

# PM2 프로세스 완전히 제거 후 재시작
pm2 delete snowclash
pm2 start ecosystem.config.js
pm2 save
```

### Git pull 충돌

```bash
cd ~/SnowClash

# 로컬 변경사항 백업 후 업데이트
git stash
git pull origin main

# 또는 로컬 변경사항 버리기
git reset --hard origin/main
```

### 의존성 문제

```bash
cd ~/SnowClash
rm -rf node_modules package-lock.json
npm install
npm run build:server
pm2 restart snowclash
```

### SSL 인증서 발급 실패

```bash
# DNS 확인
dig +short your-domain.com

# Certbot 수동 실행
sudo certbot certonly --nginx -d your-domain.com
```

### PM2 프로세스 문제

```bash
pm2 status
pm2 logs snowclash
pm2 restart snowclash
```

### Nginx 설정 문제

```bash
sudo nginx -t
sudo tail -f /var/log/nginx/error.log
```
