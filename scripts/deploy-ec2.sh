#!/bin/bash
#
# SnowClash EC2 Deployment Script
# Amazon Linux 2023 + Node.js 22 + PM2 + Nginx + Let's Encrypt
#
# Usage: curl -fsSL https://raw.githubusercontent.com/nalbam/SnowClash/main/scripts/deploy-ec2.sh | bash
#        or: ./deploy-ec2.sh
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

# Check if running as root
if [ "$EUID" -eq 0 ]; then
  log_error "Please do not run as root. Run as ec2-user."
  exit 1
fi

echo ""
echo "=============================================="
echo "       SnowClash EC2 Deployment Script"
echo "=============================================="
echo ""

# Installation directory
INSTALL_DIR="/home/ec2-user/SnowClash"
APP_NAME="snowclash"

# Detect if this is an update or fresh install
UPDATE_MODE=false
if [ -d "$INSTALL_DIR" ] && [ -f "$INSTALL_DIR/.env" ] && pm2 list 2>/dev/null | grep -q "$APP_NAME"; then
  UPDATE_MODE=true
  log_info "Existing installation detected."
  echo ""
  echo "What would you like to do?"
  echo "  1) Update game to latest version (quick)"
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
ALLOWED_ORIGINS=""
if [ -f "$INSTALL_DIR/.env" ]; then
  DEFAULT_DOMAIN=$(grep -E "^ALLOWED_ORIGINS=" "$INSTALL_DIR/.env" 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'" | sed 's|https://||' | xargs)
  ALLOWED_ORIGINS=$(grep -E "^ALLOWED_ORIGINS=" "$INSTALL_DIR/.env" 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'" | xargs)
elif [ -f ".env" ]; then
  DEFAULT_DOMAIN=$(grep -E "^SERVER_URL=" .env 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'" | xargs)
elif [ -f "../.env" ]; then
  DEFAULT_DOMAIN=$(grep -E "^SERVER_URL=" ../.env 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'" | xargs)
fi

# Skip configuration prompts in update mode
if [ "$UPDATE_MODE" = true ]; then
  DOMAIN="$DEFAULT_DOMAIN"
  EMAIL=""

  if [ -z "$DOMAIN" ]; then
    log_error "Cannot determine domain from existing configuration!"
    exit 1
  fi

  log_info "Using existing configuration: $DOMAIN"
else
  # Get domain name for fresh install
  if [ -n "$DEFAULT_DOMAIN" ]; then
    read -p "Enter your domain name [$DEFAULT_DOMAIN]: " DOMAIN
    DOMAIN=${DOMAIN:-$DEFAULT_DOMAIN}
  else
    read -p "Enter your domain name (e.g., game.example.com): " DOMAIN
  fi

  if [ -z "$DOMAIN" ]; then
    log_error "Domain name is required!"
    exit 1
  fi

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
  echo "  Domain: $DOMAIN"
  echo "  Email:  $EMAIL"
  echo "=============================================="
  echo ""
  read -p "Continue with these settings? (y/n): " CONFIRM
  if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    log_warn "Deployment cancelled."
    exit 0
  fi
fi

log_info "Starting deployment..."

# ============================================
# QUICK UPDATE MODE
# ============================================
if [ "$UPDATE_MODE" = true ]; then
  log_info "Quick update mode: Skipping system setup..."

  # Jump to application update
  cd "$INSTALL_DIR"

  log_info "Pulling latest changes..."
  git pull origin main

  log_info "Installing dependencies..."
  if [ -f "package-lock.json" ]; then
    npm ci --production=false
  else
    log_warn "package-lock.json not found, using npm install instead"
    npm install --production=false
  fi

  log_info "Building server..."
  npm run build:server

  log_info "Restarting application..."
  pm2 restart "$APP_NAME"

  log_success "Update completed!"
  log_info ".env file preserved (not modified)"

  echo ""
  echo "=============================================="
  echo -e "${GREEN}  Update Complete!${NC}"
  echo "=============================================="
  echo ""
  echo "  Your game is available at:"
  echo -e "  ${BLUE}https://$DOMAIN${NC}"
  echo ""
  echo "  Check status:"
  echo "    pm2 status"
  echo "    pm2 logs $APP_NAME"
  echo "    ./diagnose.sh  (run full diagnostics)"
  echo ""
  echo "  Note: .env file was NOT modified"
  echo "  To view current settings: cat ~/SnowClash/.env"
  echo ""
  echo "=============================================="

  exit 0
fi

# ============================================
# FULL INSTALLATION MODE
# ============================================

# ============================================
# 1. System Update
# ============================================
log_info "Updating system packages..."
sudo dnf update -y

# ============================================
# 2. Install Node.js 22
# ============================================
log_info "Installing Node.js 22..."
curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
sudo dnf install -y nodejs

# Verify Node.js installation
NODE_VERSION=$(node --version)
log_success "Node.js installed: $NODE_VERSION"

# ============================================
# 3. Install PM2
# ============================================
log_info "Installing PM2..."
sudo npm install -g pm2

# Setup PM2 startup script
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ec2-user --hp /home/ec2-user

log_success "PM2 installed"

# ============================================
# 4. Install Nginx
# ============================================
log_info "Installing Nginx..."
sudo dnf install -y nginx

# Enable and start Nginx
sudo systemctl enable nginx
sudo systemctl start nginx

log_success "Nginx installed and started"

# ============================================
# 5. Install Certbot (Let's Encrypt)
# ============================================
log_info "Installing Certbot..."
sudo dnf install -y certbot python3-certbot-nginx

log_success "Certbot installed"

# ============================================
# 6. Install Git
# ============================================
log_info "Installing Git..."
sudo dnf install -y git

# ============================================
# 7. Clone SnowClash Repository
# ============================================
log_info "Cloning SnowClash repository..."
if [ -d "$INSTALL_DIR" ]; then
  log_warn "Directory exists, pulling latest changes..."
  cd "$INSTALL_DIR"
  git pull origin main
else
  git clone https://github.com/nalbam/SnowClash.git "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# ============================================
# 8. Install Dependencies and Build
# ============================================
log_info "Installing npm dependencies..."
if [ -f "package-lock.json" ]; then
  npm ci --production=false
else
  log_warn "package-lock.json not found, using npm install instead"
  npm install --production=false
fi

log_info "Building server..."
npm run build:server

log_success "Server build completed"

# Note: Client is hosted separately (GitHub Pages, S3, etc.)
# If you need to build client here, uncomment:
# SERVER_URL="$DOMAIN" npm run build

# ============================================
# 9. Configure Nginx (HTTP only, for Certbot)
# ============================================
log_info "Configuring Nginx (HTTP for Certbot)..."

# Remove default nginx config if exists
sudo rm -f /etc/nginx/conf.d/default.conf

# Create HTTP-only config first (for Certbot)
sudo tee /etc/nginx/conf.d/snowclash.conf > /dev/null <<EOF
# SnowClash Nginx Configuration (HTTP)
# Generated by deploy-ec2.sh

map \$http_upgrade \$connection_upgrade {
    default upgrade;
    '' close;
}

upstream snowclash_backend {
    server 127.0.0.1:2567;
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
# 10. Obtain SSL Certificate
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
# 11. Update Nginx for HTTPS with http2
# ============================================
log_info "Updating Nginx configuration for HTTP/2..."

# Fix http2 directive for newer Nginx versions
sudo sed -i 's/listen 443 ssl;/listen 443 ssl;\n    http2 on;/g' /etc/nginx/conf.d/snowclash.conf

# Test and reload Nginx
sudo nginx -t && sudo systemctl reload nginx

log_success "Nginx HTTPS configured"

# ============================================
# 12. Setup Auto-renewal for SSL
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
# 13. Create Environment File
# ============================================
log_info "Configuring environment file..."

# Backup existing .env if it exists
if [ -f "$INSTALL_DIR/.env" ]; then
  BACKUP_FILE="$INSTALL_DIR/.env.backup.$(date +%Y%m%d_%H%M%S)"
  cp "$INSTALL_DIR/.env" "$BACKUP_FILE"
  log_info "Existing .env backed up to: $BACKUP_FILE"

  # Load existing values
  EXISTING_ORIGINS=$(grep -E "^ALLOWED_ORIGINS=" "$INSTALL_DIR/.env" 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'")
  EXISTING_SERVER_URL=$(grep -E "^SERVER_URL=" "$INSTALL_DIR/.env" 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'")
  EXISTING_REDIS_URL=$(grep -E "^REDIS_URL=" "$INSTALL_DIR/.env" 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'")

  # Merge ALLOWED_ORIGINS (keep existing domains, add new one if not present)
  if [ -n "$EXISTING_ORIGINS" ]; then
    if echo "$EXISTING_ORIGINS" | grep -q "https://$DOMAIN"; then
      ALLOWED_ORIGINS="$EXISTING_ORIGINS"
    else
      ALLOWED_ORIGINS="$EXISTING_ORIGINS,https://$DOMAIN"
    fi
  else
    ALLOWED_ORIGINS="https://$DOMAIN"
  fi

  # Use existing SERVER_URL or set to new domain
  if [ -n "$EXISTING_SERVER_URL" ]; then
    SERVER_URL="$EXISTING_SERVER_URL"
  else
    SERVER_URL="$DOMAIN"
  fi
else
  # Fresh install
  ALLOWED_ORIGINS="https://$DOMAIN"
  SERVER_URL="$DOMAIN"
  EXISTING_REDIS_URL=""
fi

# Create .env file
cat > "$INSTALL_DIR/.env" <<EOF
# SnowClash Production Environment
NODE_ENV=production
PORT=2567
ALLOWED_ORIGINS=$ALLOWED_ORIGINS
SERVER_URL=$SERVER_URL
EOF

# Add REDIS_URL if it exists
if [ -n "$EXISTING_REDIS_URL" ]; then
  echo "REDIS_URL=$EXISTING_REDIS_URL" >> "$INSTALL_DIR/.env"
fi

log_success "Environment file configured"
log_info "ALLOWED_ORIGINS=$ALLOWED_ORIGINS"

# ============================================
# 14. Start Application with PM2
# ============================================
log_info "Starting SnowClash with PM2..."

cd "$INSTALL_DIR"

# Create PM2 ecosystem file
cat > ecosystem.config.js <<EOF
module.exports = {
  apps: [{
    name: '$APP_NAME',
    script: 'dist/server/index.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 2567,
      ALLOWED_ORIGINS: '$ALLOWED_ORIGINS'
    },
    max_memory_restart: '500M',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    error_file: 'logs/error.log',
    out_file: 'logs/out.log',
    merge_logs: true,
    autorestart: true,
    watch: false,
  }]
};
EOF

# Create logs directory
mkdir -p logs

# Stop existing instance if running
pm2 delete "$APP_NAME" 2>/dev/null || true

# Start application
pm2 start ecosystem.config.js

# Save PM2 process list
pm2 save

log_success "SnowClash started with PM2"

# ============================================
# 15. Configure Firewall (if enabled)
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
# 16. Create Management Scripts
# ============================================
log_info "Creating management scripts..."

# Start script
cat > "$INSTALL_DIR/start.sh" <<EOF
#!/bin/bash
cd $INSTALL_DIR
pm2 start ecosystem.config.js
EOF

# Stop script
cat > "$INSTALL_DIR/stop.sh" <<EOF
#!/bin/bash
pm2 stop $APP_NAME
EOF

# Restart script
cat > "$INSTALL_DIR/restart.sh" <<EOF
#!/bin/bash
pm2 restart $APP_NAME
EOF

# Update script
cat > "$INSTALL_DIR/update.sh" <<EOF
#!/bin/bash
cd $INSTALL_DIR
git pull origin main
if [ -f "package-lock.json" ]; then
  npm ci --production=false
else
  echo "Warning: package-lock.json not found, using npm install instead"
  npm install --production=false
fi
npm run build:server
pm2 restart $APP_NAME
echo "Update completed!"
EOF

# Logs script
cat > "$INSTALL_DIR/logs.sh" <<EOF
#!/bin/bash
pm2 logs $APP_NAME
EOF

# Status script
cat > "$INSTALL_DIR/status.sh" <<EOF
#!/bin/bash
echo "=== PM2 Status ==="
pm2 status
echo ""
echo "=== Nginx Status ==="
sudo systemctl status nginx --no-pager
echo ""
echo "=== SSL Certificate ==="
sudo certbot certificates
EOF

# Diagnose script (copy from scripts/)
if [ -f "$INSTALL_DIR/scripts/diagnose.sh" ]; then
  cp "$INSTALL_DIR/scripts/diagnose.sh" "$INSTALL_DIR/diagnose.sh"
fi

chmod +x "$INSTALL_DIR"/*.sh

log_success "Management scripts created"

# ============================================
# Complete!
# ============================================
echo ""
echo "=============================================="
echo -e "${GREEN}  Deployment Complete!${NC}"
echo "=============================================="
echo ""
echo "  Your game is available at:"
echo -e "  ${BLUE}https://$DOMAIN${NC}"
echo ""
echo "  Management commands:"
echo "    ./start.sh    - Start the server"
echo "    ./stop.sh     - Stop the server"
echo "    ./restart.sh  - Restart the server"
echo "    ./update.sh   - Pull latest and rebuild"
echo "    ./logs.sh     - View application logs"
echo "    ./status.sh   - Check status"
echo "    ./diagnose.sh - Run diagnostics (10 checks)"
echo ""
echo "  PM2 commands:"
echo "    pm2 status   - Check process status"
echo "    pm2 logs     - View logs"
echo "    pm2 monit    - Monitor resources"
echo ""
echo "  SSL auto-renewal is configured."
echo "  Certificates will renew automatically."
echo ""
echo "=============================================="
