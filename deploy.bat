@echo off
REM Remesitas Cloudflare Deploy Script (Windows)

echo ==========================================
echo    REMESITAS CLOUDFLARE DEPLOY
echo ==========================================
echo.

REM Install dependencies
echo [1/4] Installing dependencies...
call pnpm install
if %ERRORLEVEL% neq 0 exit /b %ERRORLEVEL%

REM Build shared package
echo [2/4] Building shared package...
cd packages\shared
call pnpm build
if %ERRORLEVEL% neq 0 exit /b %ERRORLEVEL%
cd ..\..

REM Deploy API to Workers
echo [3/4] Deploying API to Workers...
cd packages\api
call npx wrangler deploy
if %ERRORLEVEL% neq 0 exit /b %ERRORLEVEL%
cd ..\..

REM Build and deploy Web to Pages
echo [4/4] Building and deploying Web to Pages...
cd packages\web
call npm run build
if %ERRORLEVEL% neq 0 exit /b %ERRORLEVEL%
call npx wrangler pages deploy .svelte-kit\cloudflare --project-name remesitas-web --branch main --commit-dirty=true
if %ERRORLEVEL% neq 0 exit /b %ERRORLEVEL%
cd ..\..

echo.
echo ==========================================
echo    DEPLOY COMPLETE!
echo ==========================================
echo.
echo API:  https://remesitas-api.alfre891013.workers.dev
echo Web:  https://remesitas-web.pages.dev
echo ==========================================
