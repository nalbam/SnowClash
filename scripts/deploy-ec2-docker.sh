#!/bin/bash
#
# SnowClash EC2 Docker Deployment Script
# Amazon Linux 2023 + Docker + Nginx + Let's Encrypt
#
# Usage: curl -fsSL https://raw.githubusercontent.com/nalbam/SnowClash/main/scripts/deploy-ec2-docker.sh | bash
#        or: ./deploy-ec2-docker.sh
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# Docker image configuration
DOCKER_IMAGE="ghcr.io/nalbam/snowclash"
CONTAINER_NAME="snowclash"
APP_PORT=2567

# Select version (tag) to deploy
select_version() {
  log_info "Fetching available versions from GitHub Container Registry..."

  # Get tags from ghcr.io using skopeo or docker
  local tags=""

  # Try to get tags (requires authentication for private repos)
  # For public repos, we can use the GitHub API
  tags=$(curl -s "https://api.github.com/users/nalbam/packages/container/snowclash/versions" 2>/dev/null | \
    grep -o '"name":"[^"]*"' | sed 's/"name":"//;s/"//' | head -10 || echo "")

  # If API fails, try docker
  if [ -z "$tags" ]; then
    # Fallback: ask user to input version or use latest
    log_warn "Could not fetch tags automatically."
    echo ""
    echo "Enter version to deploy (e.g., 1.0.1, latest):"
    read -p "Version [latest]: " SELECTED_VERSION
    SELECTED_VERSION=${SELECTED_VERSION:-latest}
    # Remove 'v' prefix if present
    SELECTED_VERSION="${SELECTED_VERSION#v}"
    return 0
  fi

  echo ""
  echo "Available versions:"
  echo "  0) latest"

  local i=1
  while IFS= read -r tag; do
    [ -z "$tag" ] && continue
    echo "  $i) $tag"
    i=$((i + 1))
  done <<< "$tags"

  echo ""
  read -p "Select version [0]: " VERSION_CHOICE
  VERSION_CHOICE=${VERSION_CHOICE:-0}

  if [ "$VERSION_CHOICE" = "0" ]; then
    SELECTED_VERSION="latest"
    log_info "Selected: latest"
  else
    SELECTED_VERSION=$(echo "$tags" | sed -n "${VERSION_CHOICE}p")
    if [ -z "$SELECTED_VERSION" ]; then
      log_warn "Invalid selection. Using latest."
      SELECTED_VERSION="latest"
    fi
    log_info "Selected version: $SELECTED_VERSION"
  fi

  # Remove 'v' prefix if present (Docker tags don't have 'v' prefix)
  SELECTED_VERSION="${SELECTED_VERSION#v}"
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then
  log_error "Please do not run as root. Run as ec2-user."
  exit 1
fi

echo ""
echo "=============================================="
echo "   SnowClash EC2 Docker Deployment Script"
echo "=============================================="
echo ""

# Installation directory (for config files)
INSTALL_DIR="/home/ec2-user/SnowClash"

# Detect if this is an update or fresh install
UPDATE_MODE=false
if [ -f "$INSTALL_DIR/.env" ] && docker ps -a --format '{{.Names}}' 2>/dev/null | grep -q "^${CONTAINER_NAME}$"; then
  UPDATE_MODE=true
  log_info "Existing Docker installation detected."
  echo ""
  echo "What would you like to do?"
  echo "  1) Update game to new version (quick)"
  echo "  2) Full reinstall (reconfigure everything)"
  echo ""
  read -p "Choose option (1/2) [1]: " INSTALL_MODE
  INSTALL_MODE=${INSTALL_MODE:-1}

  if [ "$INSTALL_MODE" = "1" ]; then
    UPDATE_MODE=true
    log_info "Update mode selected"
  else
    UPDATE_MODE=false
    log_info "Full reinstall mode selected"
  fi
fi

# Load defaults from .env if exists
DEFAULT_DOMAIN=""
DEFAULT_CLIENT_URL=""
if [ -f "$INSTALL_DIR/.env" ]; then
  DEFAULT_DOMAIN=$(grep -E "^SERVER_URL=" "$INSTALL_DIR/.env" 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'" | xargs)
  DEFAULT_CLIENT_URL=$(grep -E "^CLIENT_URL=" "$INSTALL_DIR/.env" 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'" | xargs)
fi

# Skip configuration prompts in update mode
if [ "$UPDATE_MODE" = true ]; then
  DOMAIN="$DEFAULT_DOMAIN"
  CLIENT_URL="$DEFAULT_CLIENT_URL"

  if [ -z "$DOMAIN" ]; then
    log_error "Cannot determine domain from existing configuration!"
    exit 1
  fi

  log_info "Using existing server domain: $DOMAIN"
  [ -n "$CLIENT_URL" ] && log_info "Using existing client URL: $CLIENT_URL"
else
  # Get server domain for full reinstall
  if [ -n "$DEFAULT_DOMAIN" ]; then
    read -p "Enter your server domain [$DEFAULT_DOMAIN]: " DOMAIN
    DOMAIN=${DOMAIN:-$DEFAULT_DOMAIN}
  else
    read -p "Enter your server domain (e.g., game.example.com): " DOMAIN
  fi

  if [ -z "$DOMAIN" ]; then
    log_error "Domain name is required!"
    exit 1
  fi

  # Get client URL (GitHub Pages or custom domain)
  DEFAULT_CLIENT_URL=${DEFAULT_CLIENT_URL:-"https://nalbam.github.io"}
  read -p "Enter your client URL [$DEFAULT_CLIENT_URL]: " CLIENT_URL
  CLIENT_URL=${CLIENT_URL:-$DEFAULT_CLIENT_URL}

  # Get email for Let's Encrypt (default: admin@domain)
  DEFAULT_EMAIL="admin@$DOMAIN"
  read -p "Enter your email for Let's Encrypt [$DEFAULT_EMAIL]: " EMAIL
  EMAIL=${EMAIL:-$DEFAULT_EMAIL}

  if [ -z "$EMAIL" ]; then
    log_error "Email is required for Let's Encrypt!"
    exit 1
  fi

  # Confirm settings
  echo ""
  echo "=============================================="
  echo "  Server Domain: $DOMAIN"
  echo "  Client URL:    $CLIENT_URL"
  echo "  Email:         $EMAIL"
  echo "=============================================="
  echo ""
  read -p "Continue with these settings? (Y/n): " CONFIRM
  CONFIRM=${CONFIRM:-Y}
  if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    log_warn "Deployment cancelled."
    exit 0
  fi
fi

log_info "Starting deployment..."

# ============================================
# Check and Install Docker if needed
# ============================================
install_docker_if_needed() {
  if ! command -v docker &> /dev/null; then
    log_info "Docker not found. Installing Docker..."
    sudo dnf install -y docker
    sudo systemctl enable docker
    sudo systemctl start docker
    sudo usermod -aG docker ec2-user
    log_success "Docker installed"
    # Need to use sg for this session since group membership isn't active yet
    DOCKER_CMD="sg docker -c"
  else
    log_info "Docker is already installed"
    DOCKER_CMD=""
  fi
}

# ============================================
# QUICK UPDATE MODE (Docker)
# ============================================
if [ "$UPDATE_MODE" = true ]; then
  log_info "Quick update mode: Updating Docker container..."

  # Check Docker installation
  install_docker_if_needed

  # Select version
  select_version

  # Load environment from .env
  source "$INSTALL_DIR/.env"

  # Define docker run function based on whether we need sg
  run_docker() {
    if [ -n "$DOCKER_CMD" ]; then
      sg docker -c "$*"
    else
      eval "$*"
    fi
  }

  log_info "Pulling Docker image: ${DOCKER_IMAGE}:${SELECTED_VERSION}..."
  run_docker "docker pull '${DOCKER_IMAGE}:${SELECTED_VERSION}'"

  log_info "Stopping existing container..."
  run_docker "docker stop '$CONTAINER_NAME'" 2>/dev/null || true
  run_docker "docker rm '$CONTAINER_NAME'" 2>/dev/null || true

  log_info "Starting new container..."
  run_docker "docker run -d \
    --name '$CONTAINER_NAME' \
    --restart unless-stopped \
    -p 127.0.0.1:${APP_PORT}:${APP_PORT} \
    -e NODE_ENV=production \
    -e PORT=${APP_PORT} \
    -e ALLOWED_ORIGINS='${ALLOWED_ORIGINS}' \
    ${REDIS_URL:+-e REDIS_URL='${REDIS_URL}'} \
    '${DOCKER_IMAGE}:${SELECTED_VERSION}'"

  # Update version in .env
  sed -i "s/^DOCKER_TAG=.*/DOCKER_TAG=${SELECTED_VERSION}/" "$INSTALL_DIR/.env" 2>/dev/null || \
    echo "DOCKER_TAG=${SELECTED_VERSION}" >> "$INSTALL_DIR/.env"

  log_success "Update completed!"

  echo ""
  echo "=============================================="
  echo -e "${GREEN}  Update Complete!${NC}"
  echo "=============================================="
  echo ""
  echo "  Deployed version: $SELECTED_VERSION"
  echo ""
  echo "  Your game is available at:"
  echo -e "  ${BLUE}https://$DOMAIN${NC}"
  echo ""
  echo "  Check status:"
  echo "    docker ps"
  echo "    docker logs $CONTAINER_NAME"
  echo ""
  echo "=============================================="

  exit 0
fi

# ============================================
# FULL INSTALLATION MODE (Docker)
# ============================================

# ============================================
# 1. System Update
# ============================================
log_info "Updating system packages..."
sudo dnf update -y

# ============================================
# 2. Install Docker
# ============================================
install_docker_if_needed

# ============================================
# 3. Install Nginx
# ============================================
log_info "Installing Nginx..."
sudo dnf install -y nginx

# Enable and start Nginx
sudo systemctl enable nginx
sudo systemctl start nginx

log_success "Nginx installed and started"

# ============================================
# 4. Install Certbot (Let's Encrypt)
# ============================================
log_info "Installing Certbot..."
sudo dnf install -y certbot python3-certbot-nginx

log_success "Certbot installed"

# ============================================
# 5. Create Installation Directory
# ============================================
log_info "Creating installation directory..."
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# ============================================
# 6. Select and Pull Docker Image
# ============================================
select_version

log_info "Pulling Docker image: ${DOCKER_IMAGE}:${SELECTED_VERSION}..."
# Use newgrp to apply docker group membership for this session
sg docker -c "docker pull ${DOCKER_IMAGE}:${SELECTED_VERSION}"

log_success "Docker image pulled"

# ============================================
# 7. Configure Nginx (HTTP only, for Certbot)
# ============================================
log_info "Configuring Nginx (HTTP for Certbot)..."

# Remove default nginx config if exists
sudo rm -f /etc/nginx/conf.d/default.conf

# Create HTTP-only config first (for Certbot)
sudo tee /etc/nginx/conf.d/snowclash.conf > /dev/null <<EOF
# SnowClash Nginx Configuration (HTTP)
# Generated by deploy-ec2-docker.sh

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
    server_name $DOMAIN;

    # Health check
    location = / {
        return 200 'SnowClash Server OK';
        add_header Content-Type text/plain;
    }

    # API endpoints
    location /api {
        proxy_pass http://snowclash_backend;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Colyseus matchmake
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

    # WebSocket connections (Colyseus room IDs - supports /roomId/odS format)
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

# Test Nginx configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx

log_success "Nginx HTTP configured"

# ============================================
# 8. Obtain SSL Certificate
# ============================================
log_info "Obtaining SSL certificate from Let's Encrypt..."

sudo certbot --nginx \
  -d "$DOMAIN" \
  --non-interactive \
  --agree-tos \
  --email "$EMAIL" \
  --redirect

log_success "SSL certificate obtained"

# ============================================
# 9. Update Nginx for HTTPS with http2
# ============================================
log_info "Updating Nginx configuration for HTTP/2..."

# Fix http2 directive for newer Nginx versions
sudo sed -i 's/listen 443 ssl;/listen 443 ssl;\n    http2 on;/g' /etc/nginx/conf.d/snowclash.conf

# Test and reload Nginx
sudo nginx -t && sudo systemctl reload nginx

log_success "Nginx HTTPS configured"

# ============================================
# 10. Setup Auto-renewal for SSL
# ============================================
log_info "Setting up automatic SSL certificate renewal..."

# Create renewal hook to reload nginx
sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh > /dev/null <<EOF
#!/bin/bash
systemctl reload nginx
EOF

sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh

# Test renewal (dry run)
sudo certbot renew --dry-run

# Certbot automatically adds a systemd timer, verify it's active
sudo systemctl enable certbot-renew.timer
sudo systemctl start certbot-renew.timer

log_success "Auto-renewal configured"

# ============================================
# 11. Create Environment File
# ============================================
log_info "Configuring environment file..."

# Combine server domain and client URL for CORS
ALLOWED_ORIGINS="https://$DOMAIN,$CLIENT_URL"

cat > "$INSTALL_DIR/.env" <<EOF
# SnowClash Docker Production Environment
NODE_ENV=production
PORT=${APP_PORT}
ALLOWED_ORIGINS=${ALLOWED_ORIGINS}
SERVER_URL=${DOMAIN}
CLIENT_URL=${CLIENT_URL}
DOCKER_IMAGE=${DOCKER_IMAGE}
DOCKER_TAG=${SELECTED_VERSION}
EOF

log_success "Environment file configured"

# ============================================
# 12. Start Docker Container
# ============================================
log_info "Starting SnowClash Docker container..."

# Stop existing container if running
sg docker -c "docker stop $CONTAINER_NAME 2>/dev/null || true"
sg docker -c "docker rm $CONTAINER_NAME 2>/dev/null || true"

# Run container
sg docker -c "docker run -d \
  --name $CONTAINER_NAME \
  --restart unless-stopped \
  -p 127.0.0.1:${APP_PORT}:${APP_PORT} \
  -e NODE_ENV=production \
  -e PORT=${APP_PORT} \
  -e ALLOWED_ORIGINS='${ALLOWED_ORIGINS}' \
  ${DOCKER_IMAGE}:${SELECTED_VERSION}"

log_success "SnowClash Docker container started"

# ============================================
# 13. Configure Firewall (if enabled)
# ============================================
log_info "Checking firewall settings..."

if command -v firewall-cmd &> /dev/null; then
  if systemctl is-active --quiet firewalld; then
    sudo firewall-cmd --permanent --add-service=http
    sudo firewall-cmd --permanent --add-service=https
    sudo firewall-cmd --reload
    log_success "Firewall configured"
  fi
fi

# ============================================
# 14. Create Management Scripts
# ============================================
log_info "Creating management scripts..."

# Start script
cat > "$INSTALL_DIR/start.sh" <<EOF
#!/bin/bash
source $INSTALL_DIR/.env
docker start $CONTAINER_NAME 2>/dev/null || \
docker run -d \
  --name $CONTAINER_NAME \
  --restart unless-stopped \
  -p 127.0.0.1:\${PORT}:\${PORT} \
  -e NODE_ENV=production \
  -e PORT=\${PORT} \
  -e ALLOWED_ORIGINS="\${ALLOWED_ORIGINS}" \
  \${REDIS_URL:+-e REDIS_URL="\${REDIS_URL}"} \
  \${DOCKER_IMAGE}:\${DOCKER_TAG}
EOF

# Stop script
cat > "$INSTALL_DIR/stop.sh" <<EOF
#!/bin/bash
docker stop $CONTAINER_NAME
EOF

# Restart script
cat > "$INSTALL_DIR/restart.sh" <<EOF
#!/bin/bash
docker restart $CONTAINER_NAME
EOF

# Update script (with version selection)
cat > "$INSTALL_DIR/update.sh" <<'SCRIPT'
#!/bin/bash
cd /home/ec2-user/SnowClash

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

source .env

DOCKER_IMAGE="${DOCKER_IMAGE:-ghcr.io/nalbam/snowclash}"
CONTAINER_NAME="snowclash"

echo -e "${BLUE}[INFO]${NC} Fetching available versions..."

# Try to get tags from GitHub API
tags=$(curl -s "https://api.github.com/users/nalbam/packages/container/snowclash/versions" 2>/dev/null | \
  grep -o '"name":"[^"]*"' | sed 's/"name":"//;s/"//' | head -10 || echo "")

if [ -z "$tags" ]; then
  echo -e "${YELLOW}[WARN]${NC} Could not fetch tags automatically."
  echo ""
  echo "Enter version to deploy (e.g., 1.0.1, latest):"
  read -p "Version [latest]: " SELECTED_VERSION
  SELECTED_VERSION=${SELECTED_VERSION:-latest}
  # Remove 'v' prefix if present
  SELECTED_VERSION="${SELECTED_VERSION#v}"
else
  echo ""
  echo "Available versions:"
  echo "  0) latest"

  i=1
  while IFS= read -r tag; do
    [ -z "$tag" ] && continue
    echo "  $i) $tag"
    i=$((i + 1))
  done <<< "$tags"

  echo ""
  read -p "Select version [0]: " VERSION_CHOICE
  VERSION_CHOICE=${VERSION_CHOICE:-0}

  if [ "$VERSION_CHOICE" = "0" ]; then
    SELECTED_VERSION="latest"
  else
    SELECTED_VERSION=$(echo "$tags" | sed -n "${VERSION_CHOICE}p")
    if [ -z "$SELECTED_VERSION" ]; then
      SELECTED_VERSION="latest"
    fi
  fi
  # Remove 'v' prefix if present (Docker tags don't have 'v' prefix)
  SELECTED_VERSION="${SELECTED_VERSION#v}"
fi

echo -e "${BLUE}[INFO]${NC} Pulling Docker image: ${DOCKER_IMAGE}:${SELECTED_VERSION}..."
docker pull "${DOCKER_IMAGE}:${SELECTED_VERSION}"

echo -e "${BLUE}[INFO]${NC} Stopping existing container..."
docker stop "$CONTAINER_NAME" 2>/dev/null || true
docker rm "$CONTAINER_NAME" 2>/dev/null || true

echo -e "${BLUE}[INFO]${NC} Starting new container..."
docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  -p 127.0.0.1:${PORT}:${PORT} \
  -e NODE_ENV=production \
  -e PORT=${PORT} \
  -e ALLOWED_ORIGINS="${ALLOWED_ORIGINS}" \
  ${REDIS_URL:+-e REDIS_URL="${REDIS_URL}"} \
  "${DOCKER_IMAGE}:${SELECTED_VERSION}"

# Update version in .env
sed -i "s/^DOCKER_TAG=.*/DOCKER_TAG=${SELECTED_VERSION}/" .env 2>/dev/null || \
  echo "DOCKER_TAG=${SELECTED_VERSION}" >> .env

echo ""
echo -e "${GREEN}[SUCCESS]${NC} Update completed!"
echo "  Deployed version: $SELECTED_VERSION"
SCRIPT

# Logs script
cat > "$INSTALL_DIR/logs.sh" <<EOF
#!/bin/bash
docker logs -f $CONTAINER_NAME
EOF

# Status script
cat > "$INSTALL_DIR/status.sh" <<EOF
#!/bin/bash
echo "=== Docker Container Status ==="
docker ps -a --filter "name=$CONTAINER_NAME"
echo ""
echo "=== Container Logs (last 20 lines) ==="
docker logs --tail 20 $CONTAINER_NAME
echo ""
echo "=== Nginx Status ==="
sudo systemctl status nginx --no-pager
echo ""
echo "=== SSL Certificate ==="
sudo certbot certificates
EOF

# Cleanup script (remove old images)
cat > "$INSTALL_DIR/cleanup.sh" <<EOF
#!/bin/bash
echo "Removing unused Docker images..."
docker image prune -af
echo "Done!"
EOF

chmod +x "$INSTALL_DIR"/*.sh

log_success "Management scripts created"

# ============================================
# Complete!
# ============================================
echo ""
echo "=============================================="
echo -e "${GREEN}  Docker Deployment Complete!${NC}"
echo "=============================================="
echo ""
echo "  Deployed version: $SELECTED_VERSION"
echo ""
echo "  Your game is available at:"
echo -e "  ${BLUE}https://$DOMAIN${NC}"
echo ""
echo "  Management commands:"
echo "    ./start.sh    - Start the container"
echo "    ./stop.sh     - Stop the container"
echo "    ./restart.sh  - Restart the container"
echo "    ./update.sh   - Update to new version"
echo "    ./logs.sh     - View container logs"
echo "    ./status.sh   - Check status"
echo "    ./cleanup.sh  - Remove old Docker images"
echo ""
echo "  Docker commands:"
echo "    docker ps              - Check container status"
echo "    docker logs snowclash  - View logs"
echo "    docker stats snowclash - Monitor resources"
echo ""
echo "  SSL auto-renewal is configured."
echo "  Certificates will renew automatically."
echo ""
echo "  NOTE: You may need to log out and back in"
echo "        for docker group membership to take effect."
echo ""
echo "=============================================="
