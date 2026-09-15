# =============================================================================
# Clutch Nexus — Vercel CLI Deploy (frontend only)
# Uses the locally-installed Vercel CLI in frontend/node_modules/.bin
#
# PREREQUISITE: Set VERCEL_TOKEN
#   $env:VERCEL_TOKEN = "xxxxxxxxxxxxxxxxxxxx"
#   (get from: https://vercel.com/account/tokens)
#
# USAGE:
#   $env:VERCEL_TOKEN   = "xxxxxxxxxxxx"
#   $env:BACKEND_URL    = "https://clutch-nexus-backend.onrender.com"  # from Render
#   .\deploy_vercel.ps1
# =============================================================================

$ErrorActionPreference = "Stop"

if (-not $env:VERCEL_TOKEN)  { throw "Set VERCEL_TOKEN before running." }
if (-not $env:BACKEND_URL)   { throw "Set BACKEND_URL (your Render backend URL) before running." }

$VERCEL = "node `"$PSScriptRoot\frontend\node_modules\.bin\node_modules\vercel\dist\vc.js`""
$FRONTEND_DIR = "$PSScriptRoot\frontend"

Write-Host "Deploying frontend to Vercel..." -ForegroundColor Cyan
Write-Host "  Backend URL: $env:BACKEND_URL"

# Deploy — Vercel CLI reads vercel.json automatically
$deployOutput = cmd /c "$VERCEL --cwd `"$FRONTEND_DIR`" deploy --prod --yes --token `"$env:VERCEL_TOKEN`" -e NEXT_PUBLIC_API_URL=`"$env:BACKEND_URL`" 2>&1"
Write-Host $deployOutput

# Extract URL from output
$urlLine = $deployOutput | Where-Object { $_ -match "https://.*\.vercel\.app" } | Select-Object -Last 1
if ($urlLine -match "(https://[^\s]+\.vercel\.app)") {
    $frontendUrl = $matches[1]
    Write-Host "`nFrontend deployed: $frontendUrl" -ForegroundColor Green
} else {
    Write-Host "`nDeploy complete — check Vercel dashboard for URL" -ForegroundColor Yellow
}
