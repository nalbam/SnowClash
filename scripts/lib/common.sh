#!/bin/bash
#
# SnowClash Common Functions Library
# Shared functions for deployment scripts
#

set -euo pipefail

# =============================================================================
# Colors
# =============================================================================
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

# =============================================================================
# Logging Functions
# =============================================================================
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

log_fatal() {
    log_error "$1"
    exit 1
}

# =============================================================================
# Configuration
# =============================================================================
readonly DOCKER_IMAGE="${DOCKER_IMAGE:-ghcr.io/nalbam/snowclash}"
readonly CONTAINER_NAME="${CONTAINER_NAME:-snowclash}"
readonly APP_PORT="${APP_PORT:-2567}"
readonly GITHUB_REPO="${GITHUB_REPO:-nalbam/SnowClash}"
readonly INSTALL_DIR="${INSTALL_DIR:-/home/ec2-user/SnowClash}"
readonly SSM_PARAM_NAME="${SSM_PARAM_NAME:-/env/prod/snowclash}"

# =============================================================================
# Docker Functions
# =============================================================================

# Detect docker command (with or without sudo)
detect_docker_cmd() {
    if docker ps &>/dev/null; then
        echo "docker"
    elif sudo docker ps &>/dev/null; then
        echo "sudo docker"
    else
        echo ""
    fi
}

# Check if Docker is installed
is_docker_installed() {
    command -v docker &>/dev/null
}

# Install Docker on Amazon Linux 2023
install_docker() {
    log_info "Installing Docker..."
    sudo dnf install -y docker
    sudo systemctl enable docker
    sudo systemctl start docker
    sudo usermod -aG docker "$(whoami)"
    log_success "Docker installed"
}

# Pull Docker image
docker_pull() {
    local image="$1"
    local docker_cmd
    docker_cmd=$(detect_docker_cmd)

    if [[ -z "$docker_cmd" ]]; then
        log_fatal "Docker is not available"
    fi

    log_info "Pulling image: $image"
    $docker_cmd pull "$image"
    log_success "Image pulled: $image"
}

# Stop and remove container
docker_stop_rm() {
    local name="$1"
    local docker_cmd
    docker_cmd=$(detect_docker_cmd)

    if [[ -z "$docker_cmd" ]]; then
        return 0
    fi

    $docker_cmd stop "$name" 2>/dev/null || true
    $docker_cmd rm "$name" 2>/dev/null || true
}

# Run Docker container
docker_run() {
    local name="$1"
    local image="$2"
    local port="$3"
    local env_file="$4"
    local docker_cmd
    docker_cmd=$(detect_docker_cmd)

    if [[ -z "$docker_cmd" ]]; then
        log_fatal "Docker is not available"
    fi

    log_info "Starting container: $name"

    local run_cmd="$docker_cmd run -d \
        --name $name \
        --restart unless-stopped \
        -p 127.0.0.1:${port}:${port}"

    if [[ -f "$env_file" ]]; then
        run_cmd="$run_cmd --env-file $env_file"
    fi

    run_cmd="$run_cmd $image"

    eval "$run_cmd"
    log_success "Container started: $name"
}

# =============================================================================
# AWS SSM Functions
# =============================================================================

# Fetch environment variables from AWS SSM Parameter Store
fetch_env_from_ssm() {
    local param_name="${1:-$SSM_PARAM_NAME}"
    local output_file="${2:-$INSTALL_DIR/.env}"

    log_info "Fetching environment from SSM: $param_name"

    if ! command -v aws &>/dev/null; then
        log_fatal "AWS CLI is not installed"
    fi

    local env_content
    env_content=$(aws ssm get-parameter \
        --name "$param_name" \
        --with-decryption \
        --output text \
        --query Parameter.Value 2>/dev/null) || {
        log_fatal "Failed to fetch SSM parameter: $param_name"
    }

    if [[ -z "$env_content" ]]; then
        log_fatal "SSM parameter is empty: $param_name"
    fi

    echo "$env_content" > "$output_file"
    chmod 600 "$output_file"
    log_success "Environment saved to: $output_file"
}

# =============================================================================
# Version Selection Functions
# =============================================================================

# Fetch available versions from GitHub releases
fetch_versions() {
    local tags
    tags=$(curl -s "https://api.github.com/repos/${GITHUB_REPO}/releases" 2>/dev/null | \
        grep -o '"tag_name": "[^"]*"' | \
        sed 's/"tag_name": "//;s/"//' | \
        head -10 || echo "")
    echo "$tags"
}

# Interactive version selection
select_version() {
    local tags
    tags=$(fetch_versions)

    if [[ -z "$tags" ]]; then
        log_warn "Could not fetch releases. Using 'latest'."
        echo "latest"
        return 0
    fi

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
    read -rp "Select version [1]: " choice
    choice=${choice:-1}

    local selected
    if [[ "$choice" == "0" ]]; then
        selected="latest"
    else
        selected=$(echo "$tags" | sed -n "${choice}p")
        if [[ -z "$selected" ]]; then
            log_warn "Invalid selection. Using first tag."
            selected=$(echo "$tags" | head -1)
        fi
    fi

    # Remove 'v' prefix for Docker tags
    selected="${selected#v}"
    echo "$selected"
}

# =============================================================================
# Nginx Functions
# =============================================================================

# Install Nginx
install_nginx() {
    log_info "Installing Nginx..."
    sudo dnf install -y nginx
    sudo systemctl enable nginx
    sudo systemctl start nginx
    log_success "Nginx installed"
}

# Configure Nginx for reverse proxy (HTTP only, for Certbot)
configure_nginx_http() {
    local domain="$1"
    local port="${2:-$APP_PORT}"

    log_info "Configuring Nginx (HTTP)..."

    sudo rm -f /etc/nginx/conf.d/default.conf

    sudo tee /etc/nginx/conf.d/snowclash.conf > /dev/null <<EOF
# SnowClash Nginx Configuration
# Generated by deploy script

map \$http_upgrade \$connection_upgrade {
    default upgrade;
    '' close;
}

upstream snowclash_backend {
    server 127.0.0.1:${port};
    keepalive 64;
}

server {
    listen 80;
    server_name ${domain};

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

    sudo nginx -t
    sudo systemctl reload nginx
    log_success "Nginx HTTP configured"
}

# Enable HTTP/2 in Nginx
enable_nginx_http2() {
    log_info "Enabling HTTP/2..."
    sudo sed -i 's/listen 443 ssl;/listen 443 ssl;\n    http2 on;/g' /etc/nginx/conf.d/snowclash.conf
    sudo nginx -t && sudo systemctl reload nginx
    log_success "HTTP/2 enabled"
}

# =============================================================================
# SSL Functions
# =============================================================================

# Install Certbot
install_certbot() {
    log_info "Installing Certbot..."
    sudo dnf install -y certbot python3-certbot-nginx
    log_success "Certbot installed"
}

# Obtain SSL certificate
obtain_ssl_cert() {
    local domain="$1"
    local email="$2"

    log_info "Obtaining SSL certificate for: $domain"

    sudo certbot --nginx \
        -d "$domain" \
        --non-interactive \
        --agree-tos \
        --email "$email" \
        --redirect

    log_success "SSL certificate obtained"
}

# Setup SSL auto-renewal
setup_ssl_renewal() {
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
}

# =============================================================================
# Firewall Functions
# =============================================================================

# Configure firewall for HTTP/HTTPS
configure_firewall() {
    if ! command -v firewall-cmd &>/dev/null; then
        return 0
    fi

    if ! systemctl is-active --quiet firewalld; then
        return 0
    fi

    log_info "Configuring firewall..."
    sudo firewall-cmd --permanent --add-service=http
    sudo firewall-cmd --permanent --add-service=https
    sudo firewall-cmd --reload
    log_success "Firewall configured"
}

# =============================================================================
# Management Scripts
# =============================================================================

# Create management scripts in install directory
create_management_scripts() {
    local dir="${1:-$INSTALL_DIR}"

    log_info "Creating management scripts..."

    # start.sh
    cat > "$dir/start.sh" <<'EOF'
#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/scripts/lib/common.sh"

docker_cmd=$(detect_docker_cmd)
$docker_cmd start snowclash 2>/dev/null || \
    docker_run snowclash "${DOCKER_IMAGE}:latest" "$APP_PORT" "$SCRIPT_DIR/.env"
EOF

    # stop.sh
    cat > "$dir/stop.sh" <<'EOF'
#!/bin/bash
set -euo pipefail
docker_cmd=$(docker ps &>/dev/null && echo "docker" || echo "sudo docker")
$docker_cmd stop snowclash
EOF

    # restart.sh
    cat > "$dir/restart.sh" <<'EOF'
#!/bin/bash
set -euo pipefail
docker_cmd=$(docker ps &>/dev/null && echo "docker" || echo "sudo docker")
$docker_cmd restart snowclash
EOF

    # logs.sh
    cat > "$dir/logs.sh" <<'EOF'
#!/bin/bash
set -euo pipefail
docker_cmd=$(docker ps &>/dev/null && echo "docker" || echo "sudo docker")
$docker_cmd logs -f snowclash
EOF

    # status.sh
    cat > "$dir/status.sh" <<'EOF'
#!/bin/bash
set -euo pipefail

echo "=== Docker Container ==="
docker ps -a --filter "name=snowclash" 2>/dev/null || sudo docker ps -a --filter "name=snowclash"

echo ""
echo "=== Recent Logs ==="
docker logs --tail 20 snowclash 2>/dev/null || sudo docker logs --tail 20 snowclash

echo ""
echo "=== Nginx Status ==="
sudo systemctl status nginx --no-pager

echo ""
echo "=== SSL Certificate ==="
sudo certbot certificates 2>/dev/null || echo "Certbot not installed"
EOF

    # update.sh
    cat > "$dir/update.sh" <<'EOF'
#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/scripts/lib/common.sh"

cd "$SCRIPT_DIR"

# Fetch latest .env from SSM
fetch_env_from_ssm

# Select version
version=$(select_version)
image="${DOCKER_IMAGE}:${version}"

# Pull and restart
docker_pull "$image"
docker_stop_rm snowclash
docker_run snowclash "$image" "$APP_PORT" "$SCRIPT_DIR/.env"

log_success "Updated to version: $version"
EOF

    # cleanup.sh
    cat > "$dir/cleanup.sh" <<'EOF'
#!/bin/bash
set -euo pipefail
echo "Removing unused Docker images..."
docker image prune -af 2>/dev/null || sudo docker image prune -af
echo "Done!"
EOF

    chmod +x "$dir"/*.sh
    log_success "Management scripts created"
}
