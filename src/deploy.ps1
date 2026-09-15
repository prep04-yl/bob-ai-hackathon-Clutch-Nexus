# =============================================================================
# Clutch Nexus — One-Shot Deployment Script
# Deploys backend to Render and frontend to Vercel via their REST APIs.
#
# PREREQUISITES (takes ~5 min to get):
#   1. RENDER_API_KEY  → https://dashboard.render.com/u/settings  (Account → API Keys → Create API Key)
#   2. VERCEL_TOKEN    → https://vercel.com/account/tokens         (Create Token → name: clutch-nexus)
#
# USAGE:
#   $env:RENDER_API_KEY = "rnd_xxxxxxxxxxxxxxxxxxxx"
#   $env:VERCEL_TOKEN   = "xxxxxxxxxxxxxxxxxxxx"
#   .\deploy.ps1
# =============================================================================

$ErrorActionPreference = "Stop"

# ─── Token validation ─────────────────────────────────────────────────────────
if (-not $env:RENDER_API_KEY) { throw "Set RENDER_API_KEY before running this script." }
if (-not $env:VERCEL_TOKEN)   { throw "Set VERCEL_TOKEN before running this script."   }

$REPO_OWNER = "prep04-yl"
$REPO_NAME  = "bob-ai-hackathon-Clutch-Nexus"
$REPO_BRANCH = "main"

Write-Host "`n=== Clutch Nexus Deployment ===" -ForegroundColor Cyan

# ─── Helper ───────────────────────────────────────────────────────────────────
function Invoke-API {
    param([string]$Uri, [string]$Method = "GET", [hashtable]$Headers, [string]$Body)
    $params = @{ Uri = $Uri; Method = $Method; Headers = $Headers; ContentType = "application/json" }
    if ($Body) { $params.Body = $Body }
    try {
        return Invoke-RestMethod @params
    } catch {
        $status = $_.Exception.Response.StatusCode.value__
        $msg    = $_.ErrorDetails.Message
        throw "API call failed ($status): $msg"
    }
}

# =============================================================================
# STEP 1 — Create Render web service (backend)
# =============================================================================
Write-Host "`n[1/6] Creating Render web service..." -ForegroundColor Yellow

$renderHeaders = @{
    "Authorization" = "Bearer $env:RENDER_API_KEY"
    "Accept"        = "application/json"
}

# Check if service already exists
$existing = Invoke-RestMethod -Uri "https://api.render.com/v1/services?name=clutch-nexus-backend&limit=1" `
    -Headers $renderHeaders -Method GET -ContentType "application/json" -ErrorAction SilentlyContinue

$backendUrl = $null

if ($existing.services.Count -gt 0) {
    $svc = $existing.services[0].service
    $backendUrl = "https://$($svc.serviceDetails.url)"
    if (-not $backendUrl.StartsWith("https://")) { $backendUrl = "https://$($svc.serviceDetails.url)" }
    Write-Host "  Service already exists: $($svc.id) — skipping creation" -ForegroundColor Gray
    Write-Host "  Backend URL: $backendUrl"
} else {
    $renderBody = @{
        type         = "web_service"
        name         = "clutch-nexus-backend"
        ownerId      = $null   # will use default owner from token
        autoDeploy   = "yes"
        serviceDetails = @{
            region      = "singapore"
            plan        = "free"
            runtime     = "python"
            buildCommand= "pip install -r requirements.txt"
            startCommand= "uvicorn main:app --host 0.0.0.0 --port `$PORT"
        }
        repo = @{
            type   = "github"
            repoURL= "https://github.com/$REPO_OWNER/$REPO_NAME"
            branch = $REPO_BRANCH
            rootDir= "src/backend"
        }
        envVars = @(
            @{ key = "PYTHON_VERSION"; value = "3.11.9" }
            @{ key = "GEMINI_API_KEY"; value = ($env:GEMINI_API_KEY ?? "") }
            @{ key = "GEMINI_MODEL";   value = "gemini-2.0-flash" }
        )
    } | ConvertTo-Json -Depth 10

    $result = Invoke-API -Uri "https://api.render.com/v1/services" -Method POST -Headers $renderHeaders -Body $renderBody
    $svcId = $result.service.id
    Write-Host "  Created service: $svcId" -ForegroundColor Green

    # Wait for first deploy to complete (up to 10 min)
    Write-Host "  Waiting for Render deploy (this takes 3-5 min on free tier)..." -ForegroundColor Gray
    $maxWait = 600; $waited = 0; $deployDone = $false
    while ($waited -lt $maxWait) {
        Start-Sleep -Seconds 15; $waited += 15
        $svcStatus = Invoke-RestMethod -Uri "https://api.render.com/v1/services/$svcId" `
            -Headers $renderHeaders -Method GET -ContentType "application/json"
        $state = $svcStatus.service.serviceDetails.buildCommand  # re-fetch live state
        # Check deploy status via deploys endpoint
        $deploys = Invoke-RestMethod -Uri "https://api.render.com/v1/services/$svcId/deploys?limit=1" `
            -Headers $renderHeaders -Method GET -ContentType "application/json"
        $deployStatus = $deploys.deploy.status
        Write-Host "    [$waited`s] deploy status: $deployStatus" -ForegroundColor Gray
        if ($deployStatus -in @("live", "succeeded")) { $deployDone = $true; break }
        if ($deployStatus -in @("failed", "canceled")) { throw "Render deploy failed with status: $deployStatus" }
    }
    if (-not $deployDone) { Write-Host "  WARNING: Timed out waiting for deploy — check Render dashboard" -ForegroundColor Red }

    # Retrieve service URL
    $svcFinal = Invoke-RestMethod -Uri "https://api.render.com/v1/services/$svcId" `
        -Headers $renderHeaders -Method GET -ContentType "application/json"
    $backendUrl = "https://$($svcFinal.service.serviceDetails.url)"
    Write-Host "  Backend live at: $backendUrl" -ForegroundColor Green
}

# =============================================================================
# STEP 2 — Verify backend health
# =============================================================================
Write-Host "`n[2/6] Verifying backend health..." -ForegroundColor Yellow
$maxRetry = 12; $retried = 0; $healthy = $false
while ($retried -lt $maxRetry) {
    try {
        $health = Invoke-RestMethod -Uri "$backendUrl/health" -TimeoutSec 10
        if ($health.status -eq "ok") { $healthy = $true; break }
    } catch { Start-Sleep -Seconds 10; $retried++ }
}
if ($healthy) { Write-Host "  Backend healthy: $backendUrl/health" -ForegroundColor Green }
else          { Write-Host "  WARNING: Backend not responding yet — continuing anyway" -ForegroundColor Yellow }

# =============================================================================
# STEP 3 — Create Vercel project (frontend)
# =============================================================================
Write-Host "`n[3/6] Creating Vercel project..." -ForegroundColor Yellow

$vercelHeaders = @{ "Authorization" = "Bearer $env:VERCEL_TOKEN" }

# Check if project already exists
$vProjects = Invoke-RestMethod -Uri "https://api.vercel.com/v9/projects/clutch-nexus" `
    -Headers $vercelHeaders -Method GET -ContentType "application/json" -ErrorAction SilentlyContinue

$frontendUrl = $null
$vercelProjectId = $null

if ($vProjects -and $vProjects.id) {
    $vercelProjectId = $vProjects.id
    Write-Host "  Project already exists: $vercelProjectId" -ForegroundColor Gray
} else {
    $vercelBody = @{
        name      = "clutch-nexus"
        framework = "nextjs"
        gitRepository = @{
            type = "github"
            repo = "$REPO_OWNER/$REPO_NAME"
        }
        rootDirectory = "src/frontend"
        buildCommand  = "npm run build"
        installCommand= "npm ci"
        environmentVariables = @(
            @{ key = "NEXT_PUBLIC_API_URL"; value = $backendUrl; target = @("production", "preview") }
        )
    } | ConvertTo-Json -Depth 10

    $vResult = Invoke-API -Uri "https://api.vercel.com/v9/projects" -Method POST -Headers $vercelHeaders -Body $vercelBody
    $vercelProjectId = $vResult.id
    Write-Host "  Created project: $vercelProjectId" -ForegroundColor Green
}

# =============================================================================
# STEP 4 — Trigger Vercel deployment
# =============================================================================
Write-Host "`n[4/6] Triggering Vercel deployment..." -ForegroundColor Yellow

# Get latest commit SHA
$commitsResp = Invoke-RestMethod -Uri "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/commits/$REPO_BRANCH" `
    -Headers @{ "User-Agent" = "clutch-nexus-deploy" } -ErrorAction SilentlyContinue
$commitSha = if ($commitsResp.sha) { $commitsResp.sha } else { "HEAD" }

$deployBody = @{
    name   = "clutch-nexus"
    gitSource = @{
        type      = "github"
        repoId    = $null
        ref       = $REPO_BRANCH
        sha       = $commitSha
    }
    projectSettings = @{
        rootDirectory  = "src/frontend"
        buildCommand   = "npm run build"
        installCommand = "npm ci"
    }
} | ConvertTo-Json -Depth 10

$dResult = Invoke-API -Uri "https://api.vercel.com/v13/deployments" -Method POST -Headers $vercelHeaders -Body $deployBody
$deployId = $dResult.id
Write-Host "  Deployment triggered: $deployId" -ForegroundColor Green

# Wait for Vercel deploy
Write-Host "  Waiting for Vercel deploy (typically 2-3 min)..." -ForegroundColor Gray
$maxWait = 300; $waited = 0; $vDone = $false
while ($waited -lt $maxWait) {
    Start-Sleep -Seconds 10; $waited += 10
    $dStatus = Invoke-RestMethod -Uri "https://api.vercel.com/v13/deployments/$deployId" `
        -Headers $vercelHeaders -Method GET -ContentType "application/json"
    $state = $dStatus.status
    Write-Host "    [$waited`s] Vercel deploy state: $state" -ForegroundColor Gray
    if ($state -eq "READY") { $frontendUrl = "https://$($dStatus.url)"; $vDone = $true; break }
    if ($state -in @("ERROR", "CANCELED")) { throw "Vercel deploy failed: $state — $($dStatus.errorMessage)" }
}
if (-not $vDone) { Write-Host "  WARNING: Timed out waiting for Vercel deploy" -ForegroundColor Red }
else             { Write-Host "  Frontend live at: $frontendUrl" -ForegroundColor Green }

# =============================================================================
# STEP 5 — Patch Render FRONTEND_URL env var for CORS
# =============================================================================
Write-Host "`n[5/6] Patching Render CORS (FRONTEND_URL = $frontendUrl)..." -ForegroundColor Yellow

if ($frontendUrl) {
    $envBody = @(
        @{ key = "FRONTEND_URL"; value = $frontendUrl }
    ) | ConvertTo-Json

    Invoke-API -Uri "https://api.render.com/v1/services/$svcId/env-vars" `
        -Method PUT -Headers $renderHeaders -Body $envBody | Out-Null

    # Trigger redeploy so new CORS env var takes effect
    Invoke-API -Uri "https://api.render.com/v1/services/$svcId/deploys" `
        -Method POST -Headers $renderHeaders -Body "{}" | Out-Null
    Write-Host "  FRONTEND_URL set and Render redeploy triggered" -ForegroundColor Green
} else {
    Write-Host "  Skipped (no frontend URL available yet)" -ForegroundColor Yellow
}

# =============================================================================
# STEP 6 — Smoke test
# =============================================================================
Write-Host "`n[6/6] Running smoke test..." -ForegroundColor Yellow

$endpoints = @(
    "$backendUrl/health",
    "$backendUrl/api/v1/dashboard/kpis",
    "$backendUrl/api/v1/disruptions/",
    "$backendUrl/api/v1/fleet/optimise",
    "$backendUrl/api/v1/cold-chain/summary",
    "$backendUrl/api/v1/whatif/scenarios"
)

$pass = 0; $fail = 0
foreach ($ep in $endpoints) {
    try {
        $r = Invoke-RestMethod -Uri $ep -TimeoutSec 30
        Write-Host "  PASS $ep" -ForegroundColor Green
        $pass++
    } catch {
        Write-Host "  FAIL $ep — $($_.Exception.Message)" -ForegroundColor Red
        $fail++
    }
}

# =============================================================================
# Summary
# =============================================================================
Write-Host "`n=== Deployment Complete ===" -ForegroundColor Cyan
Write-Host "Backend  : $backendUrl"
Write-Host "Frontend : $frontendUrl"
Write-Host "Swagger  : $backendUrl/docs"
Write-Host "Smoke    : $pass passed, $fail failed"
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Open $frontendUrl to verify all 9 pages"
Write-Host "  2. Check /copilot for AI fallback response"
Write-Host "  3. If Gemini key is set, check /api/v1/ai/copilot in Swagger"
