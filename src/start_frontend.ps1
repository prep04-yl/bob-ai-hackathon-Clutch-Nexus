param([string]$Port = "3000")

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location "$ScriptDir\frontend"

if (-not (Test-Path "node_modules")) {
    Write-Host "Installing npm packages (first run may take a few minutes)..."
    npm install
}

Write-Host ""
Write-Host "==================================================="
Write-Host " Supply Chain Frontend starting on port $Port"
Write-Host " App: http://localhost:$Port"
Write-Host "==================================================="
Write-Host ""

npm run dev -- --port $Port
