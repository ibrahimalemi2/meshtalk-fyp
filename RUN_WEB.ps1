# MeshTalk Web App Runner
# This script sets up and runs the mobile app on web

Write-Host "Starting MeshTalk Web App..." -ForegroundColor Cyan

# Navigate to mobile app directory
Set-Location "artifacts/mobile"

Write-Host "Ensuring dependencies are installed..." -ForegroundColor Yellow
pnpm install --force

Write-Host "Starting Expo web server..." -ForegroundColor Yellow
$env:EXPO_OS = "web"

# Start the dev server
pnpm run dev

Write-Host "Press 'w' to open the web app in your browser" -ForegroundColor Green
