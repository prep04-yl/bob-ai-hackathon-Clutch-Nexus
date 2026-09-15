param([string]$Port = "8000")

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location "$ScriptDir\backend"

# Create venv if missing
if (-not (Test-Path "venv")) {
    Write-Host "Creating Python virtual environment..."
    python -m venv venv
}

# Activate
& ".\venv\Scripts\Activate.ps1"

# Install deps
Write-Host "Installing/verifying dependencies..."
pip install -r requirements.txt -q

Write-Host ""
Write-Host "==================================================="
Write-Host " Supply Chain Backend starting on port $Port"
Write-Host " Swagger docs: http://localhost:$Port/docs"
Write-Host "==================================================="
Write-Host ""

uvicorn main:app --reload --host 0.0.0.0 --port $Port
