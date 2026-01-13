# Deployment Guide

SnowClash 프로덕션 배포 가이드입니다.

## Prerequisites

- Node.js 18+
- Docker (optional)
- Domain name (recommended)
- SSL certificate (required for production)

## Build for Production

```bash
# Install dependencies
npm install

# Build client (outputs to public/)
npm run build

# Build server (outputs to dist/server/)
npm run build:server
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `2567` |
| `SERVER_URL` | Client → Server address (build-time) | `localhost:2567` |
| `REDIS_URL` | Redis for horizontal scaling (optional) | - |
| `NODE_ENV` | Environment mode | `development` |

---

## Option 1: Docker (Recommended)

### Build and Run

```bash
# Build image
docker build -t snowclash .

# Run single instance
docker run -p 2567:2567 snowclash

# Run with Redis for scaling
docker run -p 2567:2567 \
  -e REDIS_URL=redis://redis-server:6379 \
  snowclash
```

### Docker Compose (with Redis)

**docker-compose.yml**:
```yaml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  snowclash:
    build: .
    ports:
      - "2567:2567"
    environment:
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
    deploy:
      replicas: 2
```

```bash
docker-compose up -d
```

---

## Option 2: AWS ECS + ALB + ElastiCache

### Architecture

```
                        ┌─────────────────┐
                        │   Route 53      │
                        │ game.example.com│
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
              │ (Fargate) ││ (Fargate) ││ (Fargate) │
              └─────┬─────┘└─────┬─────┘└─────┬─────┘
                    └────────────┼────────────┘
                        ┌────────▼────────┐
                        │  ElastiCache    │
                        │    (Redis)      │
                        └─────────────────┘
```

### Step 1: Create ElastiCache (Redis)

```bash
# Create Redis cluster
aws elasticache create-cache-cluster \
  --cache-cluster-id snowclash-redis \
  --cache-node-type cache.t3.micro \
  --engine redis \
  --num-cache-nodes 1 \
  --security-group-ids sg-xxxxxxxx \
  --cache-subnet-group-name default
```

### Step 2: Create ECR Repository and Push Image

```bash
# Create repository
aws ecr create-repository --repository-name snowclash

# Login to ECR
aws ecr get-login-password --region ap-northeast-2 | \
  docker login --username AWS --password-stdin \
  123456789012.dkr.ecr.ap-northeast-2.amazonaws.com

# Build and push
docker build -t snowclash .
docker tag snowclash:latest \
  123456789012.dkr.ecr.ap-northeast-2.amazonaws.com/snowclash:latest
docker push \
  123456789012.dkr.ecr.ap-northeast-2.amazonaws.com/snowclash:latest
```

### Step 3: Create ECS Task Definition

**task-definition.json**:
```json
{
  "family": "snowclash",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
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
        { "name": "PORT", "value": "2567" },
        { "name": "REDIS_URL", "value": "redis://snowclash-redis.xxx.cache.amazonaws.com:6379" }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/snowclash",
          "awslogs-region": "ap-northeast-2",
          "awslogs-stream-prefix": "ecs"
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

### Step 4: Create ALB with Sticky Sessions

```bash
# Create ALB
aws elbv2 create-load-balancer \
  --name snowclash-alb \
  --subnets subnet-xxx subnet-yyy \
  --security-groups sg-xxx \
  --scheme internet-facing \
  --type application

# Create Target Group
aws elbv2 create-target-group \
  --name snowclash-tg \
  --protocol HTTP \
  --port 2567 \
  --vpc-id vpc-xxx \
  --target-type ip \
  --health-check-path /api/rooms

# Enable Sticky Sessions (IMPORTANT for WebSocket!)
aws elbv2 modify-target-group-attributes \
  --target-group-arn arn:aws:elasticloadbalancing:...:targetgroup/snowclash-tg/xxx \
  --attributes \
    Key=stickiness.enabled,Value=true \
    Key=stickiness.type,Value=lb_cookie \
    Key=stickiness.lb_cookie.duration_seconds,Value=86400

# Create HTTPS Listener
aws elbv2 create-listener \
  --load-balancer-arn arn:aws:elasticloadbalancing:...:loadbalancer/app/snowclash-alb/xxx \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=arn:aws:acm:...:certificate/xxx \
  --default-actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:...:targetgroup/snowclash-tg/xxx
```

### Step 5: Create ECS Service

```bash
# Create ECS Cluster
aws ecs create-cluster --cluster-name snowclash-cluster

# Create Service
aws ecs create-service \
  --cluster snowclash-cluster \
  --service-name snowclash-service \
  --task-definition snowclash:1 \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx,subnet-yyy],securityGroups=[sg-xxx],assignPublicIp=ENABLED}" \
  --load-balancers "targetGroupArn=arn:aws:elasticloadbalancing:...:targetgroup/snowclash-tg/xxx,containerName=snowclash,containerPort=2567"
```

### Step 6: Auto Scaling (Optional)

```bash
# Register scalable target
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --scalable-dimension ecs:service:DesiredCount \
  --resource-id service/snowclash-cluster/snowclash-service \
  --min-capacity 2 \
  --max-capacity 10

# CPU-based scaling policy
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
| ALB SG | 443 | 0.0.0.0/0 |
| ECS SG | 2567 | ALB SG |
| Redis SG | 6379 | ECS SG |

---

## Option 3: EC2 + Nginx

### Install and Setup

```bash
# Install Node.js
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs nginx

# Clone and build
git clone https://github.com/your-repo/SnowClash.git
cd SnowClash
npm ci --production
npm run build && npm run build:server

# Run with PM2
npm install -g pm2
pm2 start dist/server/index.js --name snowclash
pm2 save && pm2 startup
```

### Nginx Configuration

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

    upstream colyseus {
        ip_hash;  # Sticky sessions for WebSocket
        server 127.0.0.1:2567;
        server 127.0.0.1:2568;  # If running multiple instances
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

        # Static files
        location / {
            root /home/ec2-user/SnowClash/public;
            try_files $uri $uri/ /index.html;
        }

        # API and WebSocket proxy
        location ~ ^/(api|matchmake|\w+$) {
            proxy_pass http://colyseus;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $connection_upgrade;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_read_timeout 86400s;
            proxy_send_timeout 86400s;
        }
    }
}
```

```bash
sudo nginx -t && sudo systemctl restart nginx
```

---

## Option 4: Heroku

```bash
# Create Procfile
echo "web: npm start" > Procfile

# Deploy
heroku create snowclash-app
heroku config:set NODE_ENV=production
git push heroku main

# Add Redis for scaling (optional)
heroku addons:create heroku-redis:mini
```

---

## Cost Estimation (AWS, ap-northeast-2)

| Configuration | Monthly Cost |
|--------------|--------------|
| Small (1x t3.small + ElastiCache t3.micro) | ~$30-50 |
| Medium (2x Fargate 0.5vCPU + ElastiCache t3.small) | ~$80-120 |
| Large (4x Fargate 1vCPU + ElastiCache r6g.large + ALB) | ~$300-500 |

---

## Troubleshooting

### WebSocket Connection Fails
- Verify ALB sticky sessions are enabled
- Check security group allows port 2567
- Verify health check endpoint responds

### Rooms Not Shared Between Servers
- Verify `REDIS_URL` is set correctly
- Test Redis connection: `redis-cli -h xxx.cache.amazonaws.com ping`
- Check security group allows port 6379

### 504 Gateway Timeout
```bash
# Increase ALB idle timeout
aws elbv2 modify-load-balancer-attributes \
  --load-balancer-arn arn:aws:elasticloadbalancing:... \
  --attributes Key=idle_timeout.timeout_seconds,Value=3600
```

### Container Health Check Fails
- Verify `/api/rooms` endpoint returns 200
- Check container logs: `aws logs get-log-events --log-group-name /ecs/snowclash`

---

## Post-Deployment Checklist

- [ ] Server is running and accessible
- [ ] WebSocket connections working
- [ ] SSL/HTTPS enabled
- [ ] Sticky sessions configured
- [ ] Redis connected (if scaling)
- [ ] Health checks passing
- [ ] Auto-scaling configured
- [ ] Monitoring/alerts set up
- [ ] Logs accessible
