#!/bin/bash
#
# SnowClash Server Diagnostics
# 서버 상태를 체계적으로 확인하는 스크립트
#

set +e  # Don't exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PASS="${GREEN}✓ PASS${NC}"
FAIL="${RED}✗ FAIL${NC}"
WARN="${YELLOW}⚠ WARN${NC}"
INFO="${BLUE}ℹ INFO${NC}"

echo ""
echo "=============================================="
echo "    SnowClash Server Diagnostics"
echo "=============================================="
echo ""

DOMAIN=""
if [ -f "/home/ec2-user/SnowClash/.env" ]; then
  DOMAIN=$(grep -E "^ALLOWED_ORIGINS=" /home/ec2-user/SnowClash/.env 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'" | sed 's|https://||' | xargs)
fi

# ============================================
# 1. System Resources
# ============================================
echo -e "${BLUE}[1/10] Checking System Resources...${NC}"

CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
MEM_USAGE=$(free | grep Mem | awk '{printf "%.1f", $3/$2 * 100.0}')
DISK_USAGE=$(df -h / | tail -1 | awk '{print $5}' | sed 's/%//')

echo "  CPU Usage: ${CPU_USAGE}%"
echo "  Memory Usage: ${MEM_USAGE}%"
echo "  Disk Usage: ${DISK_USAGE}%"

if (( $(echo "$CPU_USAGE > 80" | bc -l) )); then
  echo -e "  ${WARN} CPU usage is high"
elif (( $(echo "$MEM_USAGE > 80" | bc -l) )); then
  echo -e "  ${WARN} Memory usage is high"
elif (( $(echo "$DISK_USAGE > 80" | bc -l) )); then
  echo -e "  ${WARN} Disk usage is high"
else
  echo -e "  ${PASS}"
fi
echo ""

# ============================================
# 2. PM2 Process
# ============================================
echo -e "${BLUE}[2/10] Checking PM2 Process...${NC}"

if command -v pm2 &> /dev/null; then
  if pm2 list 2>/dev/null | grep -q "snowclash"; then
    PM2_STATUS=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name=="snowclash") | .pm2_env.status' 2>/dev/null || echo "unknown")
    PM2_UPTIME=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name=="snowclash") | .pm2_env.pm_uptime' 2>/dev/null || echo "0")
    PM2_RESTART=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name=="snowclash") | .pm2_env.restart_time' 2>/dev/null || echo "0")

    if [ "$PM2_STATUS" = "online" ]; then
      UPTIME_SEC=$(( ($(date +%s) - $PM2_UPTIME / 1000) ))
      UPTIME_MIN=$(( UPTIME_SEC / 60 ))
      echo "  Status: online"
      echo "  Uptime: ${UPTIME_MIN} minutes"
      echo "  Restarts: ${PM2_RESTART}"

      if [ "$PM2_RESTART" -gt 5 ]; then
        echo -e "  ${WARN} High restart count - check logs"
      else
        echo -e "  ${PASS}"
      fi
    else
      echo "  Status: $PM2_STATUS"
      echo -e "  ${FAIL} Process is not online"
    fi
  else
    echo -e "  ${FAIL} Process 'snowclash' not found"
  fi
else
  echo -e "  ${FAIL} PM2 not installed"
fi
echo ""

# ============================================
# 3. Node.js Server Port
# ============================================
echo -e "${BLUE}[3/10] Checking Node.js Server (Port 2567)...${NC}"

if netstat -tulpn 2>/dev/null | grep -q ":2567"; then
  echo "  Port 2567: Listening"

  # Test local connection
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:2567 2>/dev/null | grep -q "200"; then
    echo "  HTTP Response: 200 OK"
    echo -e "  ${PASS}"
  else
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:2567 2>/dev/null || echo "000")
    echo "  HTTP Response: $HTTP_CODE"
    echo -e "  ${WARN} Server responding but not 200"
  fi
else
  echo -e "  ${FAIL} Port 2567 not listening"
fi
echo ""

# ============================================
# 4. Nginx Service
# ============================================
echo -e "${BLUE}[4/10] Checking Nginx...${NC}"

if systemctl is-active --quiet nginx; then
  echo "  Service: active"

  if sudo nginx -t 2>&1 | grep -q "successful"; then
    echo "  Config: valid"
    echo -e "  ${PASS}"
  else
    echo "  Config: invalid"
    echo -e "  ${FAIL} Nginx configuration has errors"
  fi
else
  echo -e "  ${FAIL} Nginx service not running"
fi
echo ""

# ============================================
# 5. HTTP/HTTPS Ports
# ============================================
echo -e "${BLUE}[5/10] Checking HTTP/HTTPS Ports...${NC}"

PORT_80=$(netstat -tulpn 2>/dev/null | grep ":80 " | wc -l)
PORT_443=$(netstat -tulpn 2>/dev/null | grep ":443 " | wc -l)

if [ "$PORT_80" -gt 0 ]; then
  echo "  Port 80 (HTTP): Listening"
else
  echo -e "  ${FAIL} Port 80 not listening"
fi

if [ "$PORT_443" -gt 0 ]; then
  echo "  Port 443 (HTTPS): Listening"
else
  echo -e "  ${FAIL} Port 443 not listening"
fi

if [ "$PORT_80" -gt 0 ] && [ "$PORT_443" -gt 0 ]; then
  echo -e "  ${PASS}"
fi
echo ""

# ============================================
# 6. SSL Certificate
# ============================================
echo -e "${BLUE}[6/10] Checking SSL Certificate...${NC}"

if [ -n "$DOMAIN" ]; then
  if sudo certbot certificates 2>/dev/null | grep -q "$DOMAIN"; then
    CERT_EXPIRY=$(sudo certbot certificates 2>/dev/null | grep "Expiry Date:" | head -1 | awk '{print $3}')
    echo "  Domain: $DOMAIN"
    echo "  Expiry: $CERT_EXPIRY"

    # Check if cert expires in less than 30 days
    EXPIRY_EPOCH=$(date -d "$CERT_EXPIRY" +%s 2>/dev/null || echo "0")
    NOW_EPOCH=$(date +%s)
    DAYS_LEFT=$(( ($EXPIRY_EPOCH - $NOW_EPOCH) / 86400 ))

    if [ "$DAYS_LEFT" -lt 30 ]; then
      echo -e "  ${WARN} Certificate expires in $DAYS_LEFT days"
    else
      echo "  Valid for: $DAYS_LEFT days"
      echo -e "  ${PASS}"
    fi
  else
    echo -e "  ${FAIL} No certificate found for $DOMAIN"
  fi
else
  echo -e "  ${WARN} Domain not configured"
fi
echo ""

# ============================================
# 7. Public API Endpoint
# ============================================
echo -e "${BLUE}[7/10] Checking Public API...${NC}"

if [ -n "$DOMAIN" ]; then
  API_URL="https://$DOMAIN/api/rooms"

  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL" 2>/dev/null || echo "000")

  if [ "$HTTP_CODE" = "200" ]; then
    echo "  URL: $API_URL"
    echo "  Response: $HTTP_CODE OK"
    echo -e "  ${PASS}"
  else
    echo "  URL: $API_URL"
    echo "  Response: $HTTP_CODE"
    echo -e "  ${FAIL} API not responding correctly"
  fi
else
  echo -e "  ${WARN} Cannot test - domain not configured"
fi
echo ""

# ============================================
# 8. WebSocket Connection
# ============================================
echo -e "${BLUE}[8/10] Checking WebSocket Capability...${NC}"

if [ -n "$DOMAIN" ]; then
  # Check if Nginx WebSocket config exists
  if sudo grep -q "Upgrade" /etc/nginx/conf.d/snowclash.conf 2>/dev/null; then
    echo "  Nginx WebSocket config: found"
    echo -e "  ${PASS}"
  else
    echo -e "  ${FAIL} Nginx WebSocket config missing"
  fi
else
  echo -e "  ${WARN} Cannot verify - domain not configured"
fi
echo ""

# ============================================
# 9. Application Logs
# ============================================
echo -e "${BLUE}[9/10] Checking Recent Logs...${NC}"

if pm2 list 2>/dev/null | grep -q "snowclash"; then
  ERROR_COUNT=$(pm2 logs snowclash --nostream --lines 100 2>/dev/null | grep -i "error" | wc -l)

  echo "  Recent errors (last 100 lines): $ERROR_COUNT"

  if [ "$ERROR_COUNT" -gt 10 ]; then
    echo -e "  ${WARN} High error count - review logs"
    echo ""
    echo "  Last 5 errors:"
    pm2 logs snowclash --nostream --lines 100 2>/dev/null | grep -i "error" | tail -5 | sed 's/^/    /'
  elif [ "$ERROR_COUNT" -gt 0 ]; then
    echo -e "  ${WARN} Some errors found - review if needed"
  else
    echo -e "  ${PASS}"
  fi
else
  echo -e "  ${WARN} Cannot check - PM2 process not found"
fi
echo ""

# ============================================
# 10. Firewall
# ============================================
echo -e "${BLUE}[10/10] Checking Firewall...${NC}"

if command -v firewall-cmd &> /dev/null; then
  if systemctl is-active --quiet firewalld; then
    HTTP_ALLOWED=$(sudo firewall-cmd --list-services 2>/dev/null | grep -o "http" | wc -l)
    HTTPS_ALLOWED=$(sudo firewall-cmd --list-services 2>/dev/null | grep -o "https" | wc -l)

    if [ "$HTTP_ALLOWED" -gt 0 ] && [ "$HTTPS_ALLOWED" -gt 0 ]; then
      echo "  HTTP: allowed"
      echo "  HTTPS: allowed"
      echo -e "  ${PASS}"
    else
      echo -e "  ${FAIL} HTTP/HTTPS not allowed in firewall"
    fi
  else
    echo "  Firewalld: not active"
    echo -e "  ${INFO} Using Security Group only"
  fi
else
  echo "  Firewalld: not installed"
  echo -e "  ${INFO} Using Security Group only"
fi
echo ""

# ============================================
# Summary
# ============================================
echo "=============================================="
echo "  Diagnostics Complete"
echo "=============================================="
echo ""
echo "Useful commands:"
echo "  pm2 status              - Check PM2 processes"
echo "  pm2 logs snowclash      - View application logs"
echo "  sudo systemctl status nginx - Check Nginx status"
echo "  sudo nginx -t           - Test Nginx config"
echo "  sudo certbot renew --dry-run - Test SSL renewal"
echo ""

if [ -n "$DOMAIN" ]; then
  echo "Quick tests:"
  echo "  curl https://$DOMAIN"
  echo "  curl https://$DOMAIN/api/rooms"
  echo ""
fi

echo "For detailed logs:"
echo "  ~/SnowClash/logs.sh"
echo ""
