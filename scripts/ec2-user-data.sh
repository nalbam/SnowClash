#!/bin/bash
#
# EC2 User Data Script for SnowClash
# Amazon Linux 2023 - Docker Deployment
#
# This script is executed once when the EC2 instance is first launched.
# It installs Docker, Nginx, and deploys SnowClash from ghcr.io.
#
# Prerequisites:
#   - EC2 instance with Amazon Linux 2023
#   - IAM role with SSM read permission for /env/prod/snowclash
#   - Security group allowing ports 80, 443
#   - DNS A record pointing to EC2 public IP
#

set -euo pipefail

# =============================================================================
# Configuration
# =============================================================================
readonly LOG_FILE="/var/log/user-data.log"
readonly INSTALL_DIR="/home/ec2-user/SnowClash"
readonly DOCKER_IMAGE="ghcr.io/nalbam/snowclash"
readonly DOCKER_TAG="${DOCKER_TAG:-latest}"
readonly CONTAINER_NAME="snowclash"
readonly APP_PORT="2567"
readonly SSM_PARAM_NAME="${SSM_PARAM_NAME:-/env/prod/snowclash}"

# =============================================================================
# Logging
# =============================================================================
exec > >(tee -a "$LOG_FILE") 2>&1

log_info() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO] $1"
}

log_success() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [OK] $1"
}

log_error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] $1" >&2
}

# =============================================================================
# Main
# =============================================================================
log_info "=== Starting EC2 User Data Script ==="
log_info "Date: $(date)"

# -----------------------------------------------------------------------------
# 1. System Update
# -----------------------------------------------------------------------------
log_info "Updating system packages..."
dnf update -y
log_success "System updated"

# -----------------------------------------------------------------------------
# 2. Install Docker
# -----------------------------------------------------------------------------
log_info "Installing Docker..."
dnf install -y docker
systemctl enable docker
systemctl start docker
usermod -aG docker ec2-user
log_success "Docker installed"

# -----------------------------------------------------------------------------
# 3. Install Nginx
# -----------------------------------------------------------------------------
log_info "Installing Nginx..."
dnf install -y nginx
systemctl enable nginx
systemctl start nginx
log_success "Nginx installed"

# -----------------------------------------------------------------------------
# 4. Install Certbot
# -----------------------------------------------------------------------------
log_info "Installing Certbot..."
dnf install -y certbot python3-certbot-nginx
systemctl enable certbot-renew.timer
systemctl start certbot-renew.timer
log_success "Certbot installed"

# -----------------------------------------------------------------------------
# 5. Install Git
# -----------------------------------------------------------------------------
log_info "Installing Git..."
dnf install -y git
log_success "Git installed"

# -----------------------------------------------------------------------------
# 6. Clone Repository (for management scripts)
# -----------------------------------------------------------------------------
log_info "Cloning SnowClash repository..."
if [[ -d "$INSTALL_DIR" ]]; then
    cd "$INSTALL_DIR"
    sudo -u ec2-user git fetch --all --tags
    sudo -u ec2-user git pull origin main || true
else
    sudo -u ec2-user git clone https://github.com/nalbam/SnowClash.git "$INSTALL_DIR"
fi
chown -R ec2-user:ec2-user "$INSTALL_DIR"
log_success "Repository cloned"

# -----------------------------------------------------------------------------
# 7. Fetch Environment from AWS SSM
# -----------------------------------------------------------------------------
log_info "Fetching environment from SSM: $SSM_PARAM_NAME"
ENV_CONTENT=$(aws ssm get-parameter \
    --name "$SSM_PARAM_NAME" \
    --with-decryption \
    --output text \
    --query Parameter.Value 2>/dev/null || echo "")

if [[ -z "$ENV_CONTENT" ]]; then
    log_error "Failed to fetch SSM parameter or parameter is empty"
    log_info "Creating default .env file"
    cat > "$INSTALL_DIR/.env" <<EOF
NODE_ENV=production
PORT=$APP_PORT
ALLOWED_ORIGINS=https://nalbam.github.io
EOF
else
    echo "$ENV_CONTENT" > "$INSTALL_DIR/.env"
    log_success "Environment saved to $INSTALL_DIR/.env"
fi
chmod 600 "$INSTALL_DIR/.env"
chown ec2-user:ec2-user "$INSTALL_DIR/.env"

# -----------------------------------------------------------------------------
# 8. Pull Docker Image
# -----------------------------------------------------------------------------
log_info "Pulling Docker image: ${DOCKER_IMAGE}:${DOCKER_TAG}"
docker pull "${DOCKER_IMAGE}:${DOCKER_TAG}"
log_success "Docker image pulled"

# -----------------------------------------------------------------------------
# 9. Start Docker Container
# -----------------------------------------------------------------------------
log_info "Starting Docker container..."
docker stop "$CONTAINER_NAME" 2>/dev/null || true
docker rm "$CONTAINER_NAME" 2>/dev/null || true

docker run -d \
    --name "$CONTAINER_NAME" \
    --restart unless-stopped \
    -p "127.0.0.1:${APP_PORT}:${APP_PORT}" \
    --env-file "$INSTALL_DIR/.env" \
    "${DOCKER_IMAGE}:${DOCKER_TAG}"

log_success "Docker container started"

# -----------------------------------------------------------------------------
# 10. Configure Nginx (HTTP only for Certbot)
# -----------------------------------------------------------------------------
log_info "Configuring Nginx..."

# Get domain from .env
DOMAIN=$(grep -E "^SERVER_URL=" "$INSTALL_DIR/.env" 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'" | xargs || echo "")

if [[ -z "$DOMAIN" ]]; then
    log_error "SERVER_URL not found in .env, skipping Nginx configuration"
    log_info "Please configure Nginx manually after setting SERVER_URL in .env"
else
    rm -f /etc/nginx/conf.d/default.conf

    cat > /etc/nginx/conf.d/snowclash.conf <<EOF
# SnowClash Nginx Configuration
# Generated by ec2-user-data.sh

map \$http_upgrade \$connection_upgrade {
    default upgrade;
    '' close;
}

upstream snowclash_backend {
    server 127.0.0.1:${APP_PORT};
    keepalive 64;
}

server {
    listen 80;
    server_name ${DOMAIN};

    location = / {
        return 200 'SnowClash Server OK';
        add_header Content-Type text/plain;
    }

    location /api {
        proxy_pass http://snowclash_backend;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /matchmake {
        proxy_pass http://snowclash_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \$connection_upgrade;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    location ~ ^/[a-zA-Z0-9_/-]+\$ {
        proxy_pass http://snowclash_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \$connection_upgrade;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
EOF

    nginx -t && systemctl reload nginx
    log_success "Nginx configured for: $DOMAIN"
fi

# -----------------------------------------------------------------------------
# Complete
# -----------------------------------------------------------------------------
log_info "=== EC2 User Data Script Complete ==="
log_info "Date: $(date)"
echo ""
echo "=============================================="
echo "  SnowClash EC2 Setup Complete"
echo "=============================================="
echo ""
echo "Next steps:"
echo "  1. SSH: ssh -i your-key.pem ec2-user@<public-ip>"
echo "  2. Obtain SSL: sudo certbot --nginx -d $DOMAIN"
echo "  3. Check status: cd SnowClash && ./status.sh"
echo ""
echo "Management commands (in ~/SnowClash):"
echo "  ./start.sh    - Start container"
echo "  ./stop.sh     - Stop container"
echo "  ./restart.sh  - Restart container"
echo "  ./update.sh   - Update to new version"
echo "  ./logs.sh     - View logs"
echo "  ./status.sh   - Check status"
echo ""
echo "=============================================="
