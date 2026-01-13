# Deployment Guide

SnowClash AWS 배포 가이드입니다.

## Prerequisites

- Node.js 22+
- AWS CLI 설치 및 설정
- Domain name (recommended)
- SSL certificate (ACM)

## Build for Production

```bash
# Install dependencies
npm ci

# Build client (outputs to public/)
SERVER_URL=game.server.example.com npm run build

# Build server (outputs to dist/server/)
npm run build:server
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `2567` |
| `NODE_ENV` | Environment mode | `development` |
| `ALLOWED_ORIGINS` | CORS allowed origins | `http://localhost:8080` |
| `REDIS_URL` | Redis for horizontal scaling | - |
| `SERVER_URL` | Client build-time server address | `localhost:2567` |

## Cost Comparison

| Option | 최소 비용 | 난이도 | Auto Scaling |
|--------|----------|--------|--------------|
| **EC2 (단일)** | ~$9/월 | 높음 | 수동 |
| **Beanstalk (단일)** | ~$9/월 | 낮음 | 자동 |
| **Beanstalk + ALB** | ~$27/월 | 낮음 | 자동 |
| **ECS Fargate** | ~$9/월 | 중간 | 자동 |
| **ECS + ALB + Redis** | ~$50/월 | 중간 | 자동 |

---

## Option 1: EC2 (단일 서버)

가장 저렴하고 직접 관리하는 방식입니다.

### Architecture

```
사용자 → EC2 Public IP:2567 → Node.js Server
         (또는 도메인)
```

### Step 1: EC2 인스턴스 생성

```bash
# Amazon Linux 2023 / t3.micro
aws ec2 run-instances \
  --image-id ami-0c55b159cbfafe1f0 \
  --instance-type t3.micro \
  --key-name your-key \
  --security-group-ids sg-xxx \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=snowclash}]'
```

### Step 2: Security Group 설정

| Port | Protocol | Source |
|------|----------|--------|
| 22 | TCP | Your IP |
| 2567 | TCP | 0.0.0.0/0 |
| 443 | TCP | 0.0.0.0/0 |

### Step 3: 서버 설정

```bash
# SSH 접속
ssh -i your-key.pem ec2-user@<public-ip>

# Node.js 설치
curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
sudo yum install -y nodejs git

# 프로젝트 클론 및 빌드
git clone https://github.com/nalbam/SnowClash.git
cd SnowClash
npm ci --production
npm run build:server

# PM2로 실행
sudo npm install -g pm2
pm2 start dist/server/index.js --name snowclash
pm2 save
pm2 startup
```

### Step 4: Nginx + SSL (선택)

```bash
# Nginx 설치
sudo yum install -y nginx

# Certbot 설치 (Let's Encrypt)
sudo yum install -y certbot python3-certbot-nginx

# SSL 인증서 발급
sudo certbot --nginx -d game.example.com
```

**/etc/nginx/nginx.conf**:
```nginx
user nginx;
worker_processes auto;

events {
    worker_connections 1024;
}

http {
    map $http_upgrade $connection_upgrade {
        default upgrade;
        '' close;
    }

    server {
        listen 80;
        server_name game.example.com;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name game.example.com;

        ssl_certificate /etc/letsencrypt/live/game.example.com/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/game.example.com/privkey.pem;

        # Static files (client)
        location / {
            root /home/ec2-user/SnowClash/public;
            try_files $uri $uri/ /index.html;
        }

        # API and WebSocket
        location ~ ^/(api|matchmake) {
            proxy_pass http://127.0.0.1:2567;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $connection_upgrade;
            proxy_set_header Host $host;
            proxy_read_timeout 86400s;
        }

        # Game room WebSocket
        location ~ ^/[a-zA-Z0-9_-]+$ {
            proxy_pass http://127.0.0.1:2567;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $connection_upgrade;
            proxy_read_timeout 86400s;
        }
    }
}
```

```bash
sudo nginx -t && sudo systemctl enable nginx && sudo systemctl restart nginx
```

---

## Option 2: Elastic Beanstalk (권장)

관리가 쉽고 Auto Scaling을 지원합니다.

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│  단일 인스턴스 (~$9/월)                                  │
│  사용자 → EC2 (t3.micro) → Node.js                      │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  ALB 포함 (~$27/월)                                      │
│  사용자 → ALB (HTTPS) → EC2 (Auto Scaling) → Node.js   │
└─────────────────────────────────────────────────────────┘
```

### Step 1: EB CLI 설치

```bash
pip install awsebcli
```

### Step 2: Procfile 생성

```bash
echo "web: npm start" > Procfile
```

### Step 3: .ebextensions 설정

**.ebextensions/nodecommand.config**:
```yaml
option_settings:
  aws:elasticbeanstalk:container:nodejs:
    NodeCommand: "npm start"
  aws:elasticbeanstalk:application:environment:
    NODE_ENV: production
    PORT: 8080
    ALLOWED_ORIGINS: https://game.example.com
```

**.ebextensions/nginx-websocket.config** (WebSocket 지원):
```yaml
files:
  "/etc/nginx/conf.d/websocket.conf":
    mode: "000644"
    owner: root
    group: root
    content: |
      upstream nodejs {
        server 127.0.0.1:8080;
        keepalive 256;
      }

      server {
        listen 80;

        location / {
          proxy_pass http://nodejs;
          proxy_http_version 1.1;
          proxy_set_header Upgrade $http_upgrade;
          proxy_set_header Connection "upgrade";
          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_read_timeout 86400s;
          proxy_send_timeout 86400s;
        }
      }
```

### Step 4: 배포

```bash
# 초기화
eb init snowclash --platform "Node.js 22" --region ap-northeast-2

# 단일 인스턴스로 생성 (저렴)
eb create snowclash-env --single --instance-type t3.micro

# 또는 ALB 포함 (프로덕션)
eb create snowclash-env --elb-type application --instance-type t3.micro

# 배포
eb deploy

# 환경변수 설정
eb setenv NODE_ENV=production ALLOWED_ORIGINS=https://game.example.com
```

### Step 5: HTTPS 설정 (ALB 사용 시)

```bash
# ACM 인증서 ARN 확인
aws acm list-certificates --region ap-northeast-2

# HTTPS 리스너 추가
eb config
# 편집기에서 다음 추가:
# aws:elb:listener:443:
#   ListenerProtocol: HTTPS
#   SSLCertificateId: arn:aws:acm:...:certificate/xxx
#   InstancePort: 80
#   InstanceProtocol: HTTP
```

### 유용한 명령어

```bash
eb status          # 상태 확인
eb logs            # 로그 보기
eb ssh             # SSH 접속
eb scale 2         # 인스턴스 수 조정
eb terminate       # 환경 삭제
```

---

## Option 3: ECS Fargate

컨테이너 기반 서버리스 배포입니다.

### Architecture

```
                        ┌─────────────────┐
                        │   Route 53      │
                        └────────┬────────┘
                                 │
                        ┌────────▼────────┐
                        │      ALB        │
                        │ (Sticky Session)│
                        └────────┬────────┘
                    ┌────────────┼────────────┐
                    │            │            │
              ┌─────▼─────┐┌─────▼─────┐┌─────▼─────┐
              │ECS Task 1 ││ECS Task 2 ││ECS Task 3 │
              └─────┬─────┘└─────┬─────┘└─────┬─────┘
                    └────────────┼────────────┘
                        ┌────────▼────────┐
                        │  ElastiCache    │
                        │    (Redis)      │
                        └─────────────────┘
```

### Step 1: ECR에 이미지 푸시

```bash
# ECR 리포지토리 생성
aws ecr create-repository --repository-name snowclash --region ap-northeast-2

# Docker 빌드
docker build -t snowclash .

# ECR 로그인
aws ecr get-login-password --region ap-northeast-2 | \
  docker login --username AWS --password-stdin \
  123456789012.dkr.ecr.ap-northeast-2.amazonaws.com

# 태그 및 푸시
docker tag snowclash:latest \
  123456789012.dkr.ecr.ap-northeast-2.amazonaws.com/snowclash:latest
docker push \
  123456789012.dkr.ecr.ap-northeast-2.amazonaws.com/snowclash:latest
```

### Step 2: ECS 클러스터 생성

```bash
aws ecs create-cluster --cluster-name snowclash-cluster
```

### Step 3: Task Definition

**task-definition.json**:
```json
{
  "family": "snowclash",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::123456789012:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "snowclash",
      "image": "123456789012.dkr.ecr.ap-northeast-2.amazonaws.com/snowclash:latest",
      "portMappings": [
        {
          "containerPort": 2567,
          "protocol": "tcp"
        }
      ],
      "environment": [
        { "name": "NODE_ENV", "value": "production" },
        { "name": "PORT", "value": "2567" },
        { "name": "ALLOWED_ORIGINS", "value": "https://game.example.com" }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/snowclash",
          "awslogs-region": "ap-northeast-2",
          "awslogs-stream-prefix": "ecs",
          "awslogs-create-group": "true"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "wget -q --spider http://localhost:2567/api/rooms || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3
      }
    }
  ]
}
```

```bash
aws ecs register-task-definition --cli-input-json file://task-definition.json
```

### Step 4: ALB 생성 (Sticky Sessions 필수)

```bash
# ALB 생성
aws elbv2 create-load-balancer \
  --name snowclash-alb \
  --subnets subnet-xxx subnet-yyy \
  --security-groups sg-xxx \
  --scheme internet-facing \
  --type application

# Target Group 생성
aws elbv2 create-target-group \
  --name snowclash-tg \
  --protocol HTTP \
  --port 2567 \
  --vpc-id vpc-xxx \
  --target-type ip \
  --health-check-path /api/rooms

# Sticky Sessions 활성화 (WebSocket 필수!)
aws elbv2 modify-target-group-attributes \
  --target-group-arn arn:aws:elasticloadbalancing:...:targetgroup/snowclash-tg/xxx \
  --attributes \
    Key=stickiness.enabled,Value=true \
    Key=stickiness.type,Value=lb_cookie \
    Key=stickiness.lb_cookie.duration_seconds,Value=86400

# HTTPS Listener
aws elbv2 create-listener \
  --load-balancer-arn arn:aws:elasticloadbalancing:...:loadbalancer/app/snowclash-alb/xxx \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=arn:aws:acm:...:certificate/xxx \
  --default-actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:...:targetgroup/snowclash-tg/xxx
```

### Step 5: ECS Service 생성

```bash
aws ecs create-service \
  --cluster snowclash-cluster \
  --service-name snowclash-service \
  --task-definition snowclash:1 \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx,subnet-yyy],securityGroups=[sg-xxx],assignPublicIp=ENABLED}" \
  --load-balancers "targetGroupArn=arn:aws:elasticloadbalancing:...:targetgroup/snowclash-tg/xxx,containerName=snowclash,containerPort=2567"
```

### Step 6: Auto Scaling (선택)

```bash
# Scalable Target 등록
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --scalable-dimension ecs:service:DesiredCount \
  --resource-id service/snowclash-cluster/snowclash-service \
  --min-capacity 1 \
  --max-capacity 5

# CPU 기반 스케일링
aws application-autoscaling put-scaling-policy \
  --service-namespace ecs \
  --scalable-dimension ecs:service:DesiredCount \
  --resource-id service/snowclash-cluster/snowclash-service \
  --policy-name cpu-scaling \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration '{
    "TargetValue": 70.0,
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "ECSServiceAverageCPUUtilization"
    }
  }'
```

### Security Groups

| Name | Port | Source |
|------|------|--------|
| ALB SG | 443, 80 | 0.0.0.0/0 |
| ECS SG | 2567 | ALB SG |
| Redis SG | 6379 | ECS SG |

---

## Horizontal Scaling (Redis)

여러 서버 인스턴스 운영 시 Redis가 필요합니다.

### ElastiCache Redis 생성

```bash
aws elasticache create-cache-cluster \
  --cache-cluster-id snowclash-redis \
  --cache-node-type cache.t3.micro \
  --engine redis \
  --num-cache-nodes 1 \
  --security-group-ids sg-xxx
```

### 환경변수 추가

```bash
REDIS_URL=redis://snowclash-redis.xxx.cache.amazonaws.com:6379
```

---

## Troubleshooting

### WebSocket 연결 실패
- ALB Sticky Sessions 활성화 확인
- Security Group에서 포트 허용 확인
- Nginx WebSocket 설정 확인

### 504 Gateway Timeout
```bash
# ALB idle timeout 증가
aws elbv2 modify-load-balancer-attributes \
  --load-balancer-arn arn:aws:elasticloadbalancing:... \
  --attributes Key=idle_timeout.timeout_seconds,Value=3600
```

### Health Check 실패
- `/api/rooms` 엔드포인트가 200 반환하는지 확인
- 컨테이너 로그 확인: `aws logs get-log-events --log-group-name /ecs/snowclash`

### 방이 서버 간 공유 안됨
- `REDIS_URL` 환경변수 확인
- Redis 연결 테스트: `redis-cli -h xxx.cache.amazonaws.com ping`

---

## Checklist

- [ ] 서버 실행 및 접속 가능
- [ ] WebSocket 연결 동작
- [ ] HTTPS 활성화
- [ ] Sticky Sessions 설정 (ALB)
- [ ] Health Check 통과
- [ ] 환경변수 설정 완료
- [ ] 로그 확인 가능
