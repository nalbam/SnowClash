#!/bin/bash
#
# EC2 User Data Script for SnowClash
# Amazon Linux 2023 - Initial Setup
#
# Use this script as User Data when launching EC2 instance
# It installs prerequisites and prepares the system for deployment
#

set -e

# Log all output
exec > >(tee /var/log/user-data.log) 2>&1

echo "=== Starting EC2 User Data Script ==="
echo "Date: $(date)"

# ============================================
# 1. System Update
# ============================================
echo "=== Updating system ==="
dnf update -y

# ============================================
# 2. Install Node.js 22
# ============================================
echo "=== Installing Node.js 22 ==="
curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
dnf install -y nodejs

echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"

# ============================================
# 3. Install PM2
# ============================================
echo "=== Installing PM2 ==="
npm install -g pm2

# Setup PM2 startup for ec2-user
env PATH=$PATH:/usr/bin pm2 startup systemd -u ec2-user --hp /home/ec2-user

# ============================================
# 4. Install Nginx
# ============================================
echo "=== Installing Nginx ==="
dnf install -y nginx

systemctl enable nginx
systemctl start nginx

# ============================================
# 5. Install Certbot
# ============================================
echo "=== Installing Certbot ==="
dnf install -y certbot python3-certbot-nginx

# Enable auto-renewal timer
systemctl enable certbot-renew.timer
systemctl start certbot-renew.timer

# ============================================
# 6. Install Git
# ============================================
echo "=== Installing Git ==="
dnf install -y git

# ============================================
# 7. Clone SnowClash Repository
# ============================================
echo "=== Cloning SnowClash ==="
cd /home/ec2-user
sudo -u ec2-user git clone https://github.com/nalbam/SnowClash.git

# Set ownership
chown -R ec2-user:ec2-user /home/ec2-user/SnowClash

# ============================================
# 8. Install Dependencies
# ============================================
echo "=== Installing npm dependencies ==="
cd /home/ec2-user/SnowClash
sudo -u ec2-user npm ci --production=false

# ============================================
# 9. Build Server
# ============================================
echo "=== Building server ==="
sudo -u ec2-user npm run build:server

# ============================================
# Complete
# ============================================
echo "=== User Data Script Complete ==="
echo "Date: $(date)"
echo ""
echo "Next steps:"
echo "1. SSH into the instance: ssh -i your-key.pem ec2-user@<public-ip>"
echo "2. Run the deployment script: cd SnowClash && ./scripts/deploy-ec2.sh"
echo ""
echo "Or run manually:"
echo "  cd SnowClash"
echo "  SERVER_URL=your-domain.com npm run build"
echo "  pm2 start dist/server/index.js --name snowclash"
