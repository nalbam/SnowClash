#!/bin/bash
#
# CORS 문제 해결 스크립트
#

set +e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo "=============================================="
echo "    CORS 문제 진단 및 해결"
echo "=============================================="
echo ""

INSTALL_DIR="/home/ec2-user/SnowClash"

# 1. 현재 .env 확인
echo -e "${BLUE}[1/6] 현재 .env 설정 확인${NC}"
if [ -f "$INSTALL_DIR/.env" ]; then
  echo "  현재 .env 내용:"
  cat "$INSTALL_DIR/.env" | grep -E "ALLOWED_ORIGINS|SERVER_URL"
  echo ""
else
  echo -e "  ${RED}✗ .env 파일이 없습니다!${NC}"
  exit 1
fi

# 2. PM2 프로세스 상태
echo -e "${BLUE}[2/6] PM2 프로세스 상태${NC}"
PM2_STATUS=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name=="snowclash") | .pm2_env.status' 2>/dev/null || echo "unknown")
echo "  Status: $PM2_STATUS"
if [ "$PM2_STATUS" != "online" ]; then
  echo -e "  ${RED}✗ 프로세스가 online 상태가 아닙니다${NC}"
fi
echo ""

# 3. 서버 로그에서 CORS 관련 에러 확인
echo -e "${BLUE}[3/6] 서버 로그 확인 (최근 50줄)${NC}"
ERROR_COUNT=$(pm2 logs snowclash --nostream --lines 50 2>/dev/null | grep -i "error\|cors\|origin" | wc -l)
echo "  에러/CORS 관련 로그: $ERROR_COUNT 건"
if [ "$ERROR_COUNT" -gt 0 ]; then
  echo ""
  echo "  최근 에러:"
  pm2 logs snowclash --nostream --lines 50 2>/dev/null | grep -i "error\|cors\|origin" | tail -10 | sed 's/^/    /'
fi
echo ""

# 4. 로컬 API 테스트
echo -e "${BLUE}[4/6] 로컬 API 테스트${NC}"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:2567/api/rooms 2>/dev/null || echo "000")
echo "  http://localhost:2567/api/rooms → $HTTP_CODE"

if [ "$HTTP_CODE" = "200" ]; then
  RESPONSE=$(curl -s http://localhost:2567/api/rooms 2>/dev/null)
  echo "  Response: $RESPONSE"
  echo -e "  ${GREEN}✓ 로컬에서는 정상 작동${NC}"
else
  echo -e "  ${RED}✗ 로컬에서도 에러 발생 (서버 자체 문제)${NC}"
fi
echo ""

# 5. PM2 환경변수 확인
echo -e "${BLUE}[5/6] PM2 환경변수 확인${NC}"
PM2_ORIGINS=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name=="snowclash") | .pm2_env.ALLOWED_ORIGINS' 2>/dev/null || echo "")
if [ -n "$PM2_ORIGINS" ]; then
  echo "  PM2 ALLOWED_ORIGINS: $PM2_ORIGINS"
else
  echo -e "  ${YELLOW}⚠ PM2에 ALLOWED_ORIGINS 환경변수가 없습니다${NC}"
  echo "  .env 파일이 제대로 로드되지 않았을 수 있습니다"
fi
echo ""

# 6. 해결 방법 제시
echo -e "${BLUE}[6/6] 해결 방법${NC}"
echo ""

if [ "$HTTP_CODE" != "200" ]; then
  echo -e "${YELLOW}문제: 서버 자체가 500 에러를 반환합니다${NC}"
  echo ""
  echo "해결 방법:"
  echo "  1. 서버 로그 자세히 확인:"
  echo "     pm2 logs snowclash --lines 100"
  echo ""
  echo "  2. 서버 재시작:"
  echo "     cd ~/SnowClash"
  echo "     pm2 restart snowclash"
  echo ""
  echo "  3. 그래도 안되면 프로세스 완전히 재시작:"
  echo "     cd ~/SnowClash"
  echo "     pm2 delete snowclash"
  echo "     pm2 start ecosystem.config.js"
  echo "     pm2 save"
  echo ""
else
  echo -e "${YELLOW}문제: 로컬은 정상이지만 CORS 헤더가 없습니다${NC}"
  echo ""
  echo "해결 방법:"
  echo "  1. ecosystem.config.js에 환경변수 추가:"
  echo "     nano ~/SnowClash/ecosystem.config.js"
  echo ""
  echo "  2. env 섹션에 ALLOWED_ORIGINS 추가 확인:"
  echo "     env: {"
  echo "       ALLOWED_ORIGINS: 'https://nalbam.github.io,https://snowclash.server.nalbam.com'"
  echo "     }"
  echo ""
  echo "  3. PM2 재시작:"
  echo "     pm2 restart snowclash"
  echo ""
fi

echo "=============================================="
echo ""

# 자동 수정 제안
read -p "자동으로 수정을 시도하시겠습니까? (y/n): " AUTO_FIX
if [ "$AUTO_FIX" = "y" ] || [ "$AUTO_FIX" = "Y" ]; then
  echo ""
  echo -e "${BLUE}자동 수정 시작...${NC}"

  cd "$INSTALL_DIR"

  # .env 확인
  if ! grep -q "^ALLOWED_ORIGINS=" .env; then
    echo "ALLOWED_ORIGINS=https://nalbam.github.io,https://snowclash.server.nalbam.com" >> .env
    echo "  ✓ .env에 ALLOWED_ORIGINS 추가"
  fi

  # PM2 재시작
  echo "  ✓ PM2 재시작 중..."
  pm2 restart snowclash
  sleep 3

  # 테스트
  echo ""
  echo "  재시작 완료. 5초 후 테스트..."
  sleep 5

  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:2567/api/rooms 2>/dev/null || echo "000")
  echo "  테스트 결과: $HTTP_CODE"

  if [ "$HTTP_CODE" = "200" ]; then
    echo -e "  ${GREEN}✓ 수정 완료! 브라우저에서 다시 시도해보세요${NC}"
  else
    echo -e "  ${RED}✗ 여전히 문제가 있습니다. 수동 확인이 필요합니다${NC}"
    echo ""
    echo "  다음 명령어로 로그를 확인하세요:"
    echo "  pm2 logs snowclash"
  fi
fi

echo ""
