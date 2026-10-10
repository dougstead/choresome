# Pull + install + build + restart for the hosted (multi-household) Choresome,
# with a health check. Touches nothing belonging to the LAN household
# instance (C:\Apps\choresome, port 3010): it only stops its own scheduled
# task, whatever listens on its own port, and processes whose command line
# runs from its own directory.
#
#   powershell -ExecutionPolicy Bypass -File C:\Apps\hosted-choresome\scripts\server\hosted\deploy-hosted.ps1

param(
    [string]$AppDirectory = "C:\Apps\hosted-choresome",
    [int]$Port = 3011,
    [string]$TaskName = "Choresome Hosted"
)

$ErrorActionPreference = "Stop"

function Assert-LastCommandSucceeded([string]$Step) {
    if ($LASTEXITCODE -ne 0) { throw "$Step failed with exit code $LASTEXITCODE." }
}

function Stop-HostedProcesses {
    $prefix = $AppDirectory.TrimEnd("\") + "\"
    $count = 0
    foreach ($connection in (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)) {
        Stop-Process -Id $connection.OwningProcess -Force -ErrorAction SilentlyContinue
        $count++
    }
    # node.exe only: the shell running this script (and its SSH parent) also
    # mention the app directory on their command lines and must survive.
    $mine = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -and $_.CommandLine.IndexOf($prefix, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 }
    foreach ($process in $mine) {
        Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
        $count++
    }
    return $count
}

Write-Host "Deploying hosted Choresome..." -ForegroundColor Cyan
Set-Location $AppDirectory

if (-not (Test-Path ".env.hosted")) { throw ".env.hosted missing -- run setup-hosted.ps1 first." }

Write-Host "Pulling latest code..."
git pull --ff-only
Assert-LastCommandSucceeded "git pull"

Write-Host "Stopping $TaskName..."
Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
$deadline = (Get-Date).AddSeconds(15)
while ((Get-Date) -lt $deadline) {
    if ((Stop-HostedProcesses) -eq 0) { break }
    Start-Sleep -Milliseconds 500
}

Write-Host "Installing dependencies..."
$attempt = 1
while ($true) {
    npm.cmd ci
    if ($LASTEXITCODE -eq 0) { break }
    if ($attempt -ge 3) { Assert-LastCommandSucceeded "npm ci" }
    Write-Host "npm ci failed (attempt $attempt of 3), retrying in 5 seconds..."
    Start-Sleep -Seconds 5
    $attempt++
}

Write-Host "Generating Prisma client..."
npx.cmd prisma generate
Assert-LastCommandSucceeded "prisma generate"

Write-Host "Building..."
npm.cmd run build
Assert-LastCommandSucceeded "next build"

# Migrations run inside the task (scripts/start-hosted.mjs), before it serves.
Write-Host "Starting $TaskName..."
Start-ScheduledTask -TaskName $TaskName

$healthy = $false
$deadline = (Get-Date).AddSeconds(90)
while ((Get-Date) -lt $deadline) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$Port/api/health" -UseBasicParsing -TimeoutSec 5
        if ($response.StatusCode -eq 200) { $healthy = $true; break }
    } catch {
        Start-Sleep -Seconds 2
    }
}
if (-not $healthy) { throw "Hosted Choresome did not become healthy on port $Port within 90 seconds." }

Write-Host "Deployment complete: http://localhost:$Port is healthy." -ForegroundColor Green
