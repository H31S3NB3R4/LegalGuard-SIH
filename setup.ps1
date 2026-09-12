# ============================================================================
# LegalGuard — one-command setup for Windows.
#   powershell -ExecutionPolicy Bypass -File setup.ps1
# ============================================================================
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$Backend = "legal_metrology_backend\legal_metrology"
$Py = Join-Path $Backend "venv\Scripts\python.exe"

Write-Host "==> [1/5] Creating .env from template (if missing)" -ForegroundColor Cyan
$envPath = Join-Path $Backend ".env"
if (-not (Test-Path $envPath)) {
    Copy-Item (Join-Path $Backend ".env.example") $envPath
    Write-Host "    Created .env -- EDIT it with your real GOOGLE_API_KEY."
}

Write-Host "==> [2/5] Python virtualenv + deps" -ForegroundColor Cyan
if (-not (Test-Path $Py)) {
    python -m venv (Join-Path $Backend "venv")
}
& $Py -m pip install --upgrade pip | Out-Null
& $Py -m pip install -r (Join-Path $Backend "requirements.txt")

Write-Host "==> [3/5] Starting MySQL (Docker) on port 3307" -ForegroundColor Cyan
$dockerOk = $false
if (Get-Command docker -ErrorAction SilentlyContinue) {
    try {
        docker info *> $null
        $dockerOk = $true
        docker compose up -d
        Write-Host "    Waiting for MySQL to become healthy..."
        for ($i = 0; $i -lt 30; $i++) {
            $status = docker inspect --format='{{.State.Health.Status}}' legalguard-mysql 2>$null
            if ($status -eq "healthy") { break }
            Start-Sleep -Seconds 2
        }
    } catch {
        $dockerOk = $false
    }
}
if (-not $dockerOk) {
    Write-Warning "Docker not available. Ensure MySQL runs on :3307 with the creds in .env, then run:"
    Write-Warning "  mysql -h127.0.0.1 -P3307 -ulegalguard -p amazon_scraper_db < legal_metrology_backend\legal_metrology\database_schema.sql"
}

Write-Host "==> [4/5] Frontend deps" -ForegroundColor Cyan
if ((Test-Path "frontend") -and -not (Test-Path "frontend\node_modules")) {
    Push-Location "frontend"
    npm install
    Pop-Location
}

Write-Host "==> [5/5] Verify /api/health" -ForegroundColor Cyan
Write-Host "    Start the backend, then check:  curl http://localhost:5000/api/health"
Write-Host "    Expect 'database': 'connected' and 'status': 'ok'."

Write-Host ""
Write-Host "Setup complete. Run the backend:" -ForegroundColor Green
Write-Host "  $Py $($PSScriptRoot)\$Backend\server.py"
