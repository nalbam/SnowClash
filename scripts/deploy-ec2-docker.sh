#!/bin/bash
#
# SnowClash EC2 Docker Deployment Script
# Amazon Linux 2023 + Docker + Nginx + Let's Encrypt
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/nalbam/SnowClash/main/scripts/deploy-ec2-docker.sh | bash
#   or: ./deploy-ec2-docker.sh
#

set -euo pipefail

# =============================================================================
# Configuration
# =============================================================================
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly INSTALL_DIR="/home/ec2-user/SnowClash"
readonly DOCKER_IMAGE="ghcr.io/nalbam/snowclash"
readonly CONTAINER_NAME="snowclash"
readonly APP_PORT="2567"
readonly GITHUB_REPO="nalbam/SnowClash"
readonly SSM_PARAM_NAME="${SSM_PARAM_NAME:-/env/prod/snowclash}"

# =============================================================================
# Colors and Logging
# =============================================================================
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1" >&2; }
log_fatal()   { log_error "$1"; exit 1; }

# =============================================================================
# Functions
# =============================================================================

detect_docker_cmd() {
    if docker ps &>/dev/null; then
        echo "docker"
    elif sudo docker ps &>/dev/null; then
        echo "sudo docker"
    else
        echo ""
    fi
}

fetch_versions() {
    curl -s "https://api.github.com/repos/${GITHUB_REPO}/releases" 2>/dev/null | \
        grep -o '"tag_name": "[^"]*"' | \
        sed 's/"tag_name": "//;s/"//' | \
        head -10 || echo ""
}

select_version() {
    local tags
    tags=$(fetch_versions)

    if [[ -z "$tags" ]]; then
        log_warn "Could not fetch releases. Enter version manually." >/dev/tty
        read -rp "Version [latest]: " version </dev/tty
        version=${version:-latest}
        echo "${version#v}"
        return 0
    fi

    {
        echo ""
        echo "Available versions:"
        echo "  0) latest"

        local i=1
        while IFS= read -r tag; do
            [[ -z "$tag" ]] && continue
            echo "  $i) $tag"
            ((i++))
        done <<< "$tags"

        echo ""
    } >/dev/tty

    read -rp "Select version [1]: " choice </dev/tty
    choice=${choice:-1}

    local selected
    if [[ "$choice" == "0" ]]; then
        selected="latest"
    else
        selected=$(echo "$tags" | sed -n "${choice}p")
        [[ -z "$selected" ]] && selected=$(echo "$tags" | head -1)
    fi

    echo "${selected#v}"
}

fetch_env_from_ssm() {
    local param_name="$1"
    local output_file="$2"

    log_info "Fetching environment from SSM: $param_name"

    if ! command -v aws &>/dev/null; then
        log_warn "AWS CLI not found. Skipping SSM fetch."
        return 1
    fi

    local env_content
    env_content=$(aws ssm get-parameter \
        --name "$param_name" \
        --with-decryption \
        --output text \
        --query Parameter.Value 2>/dev/null) || {
        log_warn "Failed to fetch SSM parameter"
        return 1
    }

    if [[ -n "$env_content" ]]; then
        echo "$env_content" > "$output_file"
        chmod 600 "$output_file"
        log_success "Environment saved to: $output_file"
        return 0
    fi

    return 1
}

# =============================================================================
# Pre-checks
# =============================================================================

if [[ "$EUID" -eq 0 ]]; then
    log_fatal "Please do not run as root. Run as ec2-user."
fi

echo ""
echo "=============================================="
echo "   SnowClash EC2 Docker Deployment"
echo "=============================================="
echo ""

# =============================================================================
# Quick Update Mode (if container is already running)
# =============================================================================

docker_cmd=$(detect_docker_cmd)

if [[ -n "$docker_cmd" ]] && \
   [[ -f "$INSTALL_DIR/.env" ]] && \
   $docker_cmd ps --format '{{.Names}}' 2>/dev/null | grep -q "^${CONTAINER_NAME}$"; then

    log_info "Running container detected. Quick update mode."

    # Select version
    version=$(select_version)
    image="${DOCKER_IMAGE}:${version}"

    # Optionally refresh .env from SSM
    read -rp "Refresh .env from SSM? (y/N): " refresh_env
    if [[ "$refresh_env" =~ ^[Yy]$ ]]; then
        fetch_env_from_ssm "$SSM_PARAM_NAME" "$INSTALL_DIR/.env" || true
    fi

    # Pull and restart
    log_info "Pulling image: $image"
    $docker_cmd pull "$image"

    log_info "Restarting container..."
    $docker_cmd stop "$CONTAINER_NAME" 2>/dev/null || true
    $docker_cmd rm "$CONTAINER_NAME" 2>/dev/null || true

    $docker_cmd run -d \
        --name "$CONTAINER_NAME" \
        --restart unless-stopped \
        -p "127.0.0.1:${APP_PORT}:${APP_PORT}" \
        --env-file "$INSTALL_DIR/.env" \
        "$image"

    log_success "Update completed!"
    echo ""
    echo "  Version: $version"
    echo "  Status:  $docker_cmd ps"
    echo "  Logs:    $docker_cmd logs $CONTAINER_NAME"
    echo ""
    exit 0
fi

# =============================================================================
# Fresh Installation
# =============================================================================

log_info "No running container. Starting fresh installation..."

# Get domain for SSL
read -rp "Enter your domain (e.g., game.example.com): " DOMAIN
[[ -z "$DOMAIN" ]] && log_fatal "Domain is required"

read -rp "Enter email for Let's Encrypt [admin@$DOMAIN]: " EMAIL
EMAIL=${EMAIL:-admin@$DOMAIN}

echo ""
echo "  Domain: $DOMAIN"
echo "  Email:  $EMAIL"
echo ""
read -rp "Continue? (Y/n): " confirm
[[ "$confirm" =~ ^[Nn]$ ]] && exit 0

# -----------------------------------------------------------------------------
# 1. System Update
# -----------------------------------------------------------------------------
log_info "Updating system packages..."
sudo dnf update -y

# -----------------------------------------------------------------------------
# 2. Install Docker
# -----------------------------------------------------------------------------
if ! command -v docker &>/dev/null; then
    log_info "Installing Docker..."
    sudo dnf install -y docker
    sudo systemctl enable docker
    sudo systemctl start docker
    sudo usermod -aG docker "$(whoami)"
    log_success "Docker installed"
else
    log_info "Docker already installed"
fi

# Refresh docker command
docker_cmd=$(detect_docker_cmd)
[[ -z "$docker_cmd" ]] && docker_cmd="sg docker -c docker"

# -----------------------------------------------------------------------------
# 3. Install Nginx
# -----------------------------------------------------------------------------
log_info "Installing Nginx..."
sudo dnf install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
log_success "Nginx installed"

# -----------------------------------------------------------------------------
# 4. Install Certbot
# -----------------------------------------------------------------------------
log_info "Installing Certbot..."
sudo dnf install -y certbot python3-certbot-nginx
log_success "Certbot installed"

# -----------------------------------------------------------------------------
# 5. Create Installation Directory
# -----------------------------------------------------------------------------
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# Clone repo for management scripts
if [[ ! -d "$INSTALL_DIR/.git" ]]; then
    log_info "Cloning repository for management scripts..."
    git clone https://github.com/nalbam/SnowClash.git "$INSTALL_DIR" 2>/dev/null || true
fi

# -----------------------------------------------------------------------------
# 6. Fetch Environment from SSM or Create Default
# -----------------------------------------------------------------------------
if ! fetch_env_from_ssm "$SSM_PARAM_NAME" "$INSTALL_DIR/.env"; then
    log_info "Creating default .env file..."

    read -rp "Enter CLIENT_URL [https://nalbam.github.io]: " CLIENT_URL
    CLIENT_URL=${CLIENT_URL:-https://nalbam.github.io}

    cat > "$INSTALL_DIR/.env" <<EOF
NODE_ENV=production
PORT=${APP_PORT}
SERVER_URL=${DOMAIN}
CLIENT_URL=${CLIENT_URL}
ALLOWED_ORIGINS=https://${DOMAIN},${CLIENT_URL}
EOF

    chmod 600 "$INSTALL_DIR/.env"
    log_success "Default .env created"
fi

# -----------------------------------------------------------------------------
# 7. Select and Pull Docker Image
# -----------------------------------------------------------------------------
version=$(select_version)
image="${DOCKER_IMAGE}:${version}"

log_info "Pulling image: $image"
sg docker -c "docker pull $image" 2>/dev/null || sudo docker pull "$image"
log_success "Image pulled"

# -----------------------------------------------------------------------------
# 8. Configure Nginx (HTTP)
# -----------------------------------------------------------------------------
log_info "Configuring Nginx..."

sudo rm -f /etc/nginx/conf.d/default.conf

sudo tee /etc/nginx/conf.d/snowclash.conf > /dev/null <<EOF
# SnowClash Nginx Configuration

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

sudo nginx -t && sudo systemctl reload nginx
log_success "Nginx configured"

# -----------------------------------------------------------------------------
# 9. Obtain SSL Certificate
# -----------------------------------------------------------------------------
log_info "Obtaining SSL certificate..."

sudo certbot --nginx \
    -d "$DOMAIN" \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL" \
    --redirect

# Enable HTTP/2
sudo sed -i 's/listen 443 ssl;/listen 443 ssl;\n    http2 on;/g' /etc/nginx/conf.d/snowclash.conf
sudo nginx -t && sudo systemctl reload nginx

log_success "SSL configured"

# -----------------------------------------------------------------------------
# 10. Setup SSL Auto-renewal
# -----------------------------------------------------------------------------
log_info "Setting up SSL auto-renewal..."

sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh > /dev/null <<'EOF'
#!/bin/bash
systemctl reload nginx
EOF

sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
sudo certbot renew --dry-run
sudo systemctl enable certbot-renew.timer
sudo systemctl start certbot-renew.timer

log_success "SSL auto-renewal configured"

# -----------------------------------------------------------------------------
# 11. Start Docker Container
# -----------------------------------------------------------------------------
log_info "Starting container..."

sg docker -c "docker stop $CONTAINER_NAME" 2>/dev/null || sudo docker stop "$CONTAINER_NAME" 2>/dev/null || true
sg docker -c "docker rm $CONTAINER_NAME" 2>/dev/null || sudo docker rm "$CONTAINER_NAME" 2>/dev/null || true

sg docker -c "docker run -d \
    --name $CONTAINER_NAME \
    --restart unless-stopped \
    -p 127.0.0.1:${APP_PORT}:${APP_PORT} \
    --env-file $INSTALL_DIR/.env \
    $image" 2>/dev/null || \
sudo docker run -d \
    --name "$CONTAINER_NAME" \
    --restart unless-stopped \
    -p "127.0.0.1:${APP_PORT}:${APP_PORT}" \
    --env-file "$INSTALL_DIR/.env" \
    "$image"

log_success "Container started"

# -----------------------------------------------------------------------------
# 12. Configure Firewall
# -----------------------------------------------------------------------------
if command -v firewall-cmd &>/dev/null && systemctl is-active --quiet firewalld; then
    log_info "Configuring firewall..."
    sudo firewall-cmd --permanent --add-service=http
    sudo firewall-cmd --permanent --add-service=https
    sudo firewall-cmd --reload
    log_success "Firewall configured"
fi

# -----------------------------------------------------------------------------
# Complete
# -----------------------------------------------------------------------------
echo ""
echo "=============================================="
echo -e "${GREEN}  Deployment Complete!${NC}"
echo "=============================================="
echo ""
echo "  Version: $version"
echo "  URL:     https://$DOMAIN"
echo ""
echo "  Management scripts (in ~/SnowClash):"
echo "    ./start.sh    - Start container"
echo "    ./stop.sh     - Stop container"
echo "    ./restart.sh  - Restart container"
echo "    ./update.sh   - Update version"
echo "    ./logs.sh     - View logs"
echo "    ./status.sh   - Check status"
echo ""
echo "  Docker commands:"
echo "    docker ps              - Status"
echo "    docker logs snowclash  - Logs"
echo "    docker stats snowclash - Resources"
echo ""
echo "  Note: Log out and back in for docker group"
echo ""
echo "=============================================="
