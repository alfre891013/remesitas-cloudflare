#!/bin/bash
# Remesitas Cloudflare Deploy Script

set -e

echo "=========================================="
echo "   REMESITAS CLOUDFLARE DEPLOY"
echo "=========================================="

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Install dependencies
echo -e "${BLUE}[1/4] Installing dependencies...${NC}"
pnpm install

# Build shared package
echo -e "${BLUE}[2/4] Building shared package...${NC}"
cd packages/shared
pnpm build
cd ../..

# Deploy API to Workers
echo -e "${BLUE}[3/4] Deploying API to Workers...${NC}"
cd packages/api
npx wrangler deploy
cd ../..

# Build and deploy Web to Pages
echo -e "${BLUE}[4/4] Building and deploying Web to Pages...${NC}"
cd packages/web
npm run build
npx wrangler pages deploy .svelte-kit/cloudflare --project-name remesitas-web --branch main --commit-dirty=true
cd ../..

echo ""
echo -e "${GREEN}=========================================="
echo "   DEPLOY COMPLETE!"
echo "=========================================="
echo ""
echo "API:  https://remesitas-api.alfre891013.workers.dev"
echo "Web:  https://remesitas-web.pages.dev"
echo -e "==========================================${NC}"
