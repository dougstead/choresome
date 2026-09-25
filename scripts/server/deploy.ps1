$ErrorActionPreference = "Stop"

$AppDirectory = "C:\Apps\choresome"
$AppTaskName = "Choresome"
$CaddyTaskName = "Choresome Caddy"

# Fixed explicitly (matches package.json's "start" script and the Caddyfile,
# both of which also hardcode it) rather than left to whatever Next.js would
# otherwise default to -- this host runs more than one thing, so every app
# here gets its own pinned port rather than "whatever's free".
$Port = 3010

function Assert-LastCommandSucceeded {
    param([string]$Step)

    if ($LASTEXITCODE -ne 0) {
        throw "$Step failed with exit code $LASTEXITCODE."
    }
}

Write-Host "Deploying Choresome..." -ForegroundColor Cyan

Set-Location $AppDirectory

Write-Host "Pulling latest code..."
git pull --ff-only
Assert-LastCommandSucceeded "git pull"

Write-Host "Stopping Choresome and Caddy..."

Stop-ScheduledTask -TaskName $AppTaskName -ErrorAction SilentlyContinue
Stop-ScheduledTask -TaskName $CaddyTaskName -ErrorAction SilentlyContinue

# Stop-ScheduledTask only reliably signals the task's own process tree. It
# won't necessarily catch a stray build process left behind by a previous
# interrupted deploy, so also sweep for anything still running out of the
# app directory (covers both node.exe and caddy.exe, since both live here).
function Stop-StaleAppProcesses {
    $staleProcesses = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object {
            $_.ExecutablePath -and
            $_.ExecutablePath.StartsWith($AppDirectory, [System.StringComparison]::OrdinalIgnoreCase)
        }

    foreach ($process in $staleProcesses) {
        Write-Host "Stopping leftover process $($process.ProcessId) ($($process.Name))..."
        Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
    }

    return @($staleProcesses).Count
}

# Also make sure nothing is still listening on our port specifically.
$connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue

foreach ($connection in $connections) {
    Write-Host "Stopping process $($connection.OwningProcess) on port $Port..."
    Stop-Process -Id $connection.OwningProcess -Force -ErrorAction SilentlyContinue
}

Stop-StaleAppProcesses | Out-Null

# Poll for locked processes to actually exit instead of guessing with a
# fixed sleep -- a force-killed process can take a moment to release its
# file handles (this matters for `npm ci` re-writing node_modules).
$deadline = (Get-Date).AddSeconds(15)

while ((Get-Date) -lt $deadline) {
    if ((Stop-StaleAppProcesses) -eq 0) {
        break
    }
    Start-Sleep -Milliseconds 500
}

Start-Sleep -Seconds 2

try {
    Write-Host "Installing dependencies..."

    # A freshly-written node_modules\**\*.exe can be transiently locked by
    # antivirus/Windows Defender real-time scanning right after npm writes
    # it, independent of any leftover process -- retry a couple of times
    # before giving up, since that lock is normally released within a
    # couple of seconds.
    $maxAttempts = 3
    $attempt = 1

    while ($true) {
        npm.cmd ci

        if ($LASTEXITCODE -eq 0) {
            break
        }

        if ($attempt -ge $maxAttempts) {
            Assert-LastCommandSucceeded "npm ci"
        }

        Write-Host "npm ci failed (attempt $attempt of $maxAttempts), retrying in 5 seconds..."
        Start-Sleep -Seconds 5
        $attempt++
    }

    if (-not (Test-Path "$AppDirectory\.env")) {
        Write-Host "No .env found -- copying .env.example."
        Copy-Item "$AppDirectory\.env.example" "$AppDirectory\.env"
    }

    if (-not (Test-Path "$AppDirectory\data")) {
        New-Item -ItemType Directory -Path "$AppDirectory\data" | Out-Null
    }

    # Belt-and-suspenders: package.json's own "postinstall" already does this,
    # but `npm ci`'s handling of *dependency* postinstall scripts (as opposed
    # to the root package's own) has proven flaky enough in practice --
    # silently leaving a stale/stub @prisma/client with none of this schema's
    # models typed -- that it's worth this explicit, ~100ms-cost step rather
    # than trusting that alone.
    Write-Host "Generating Prisma client..."
    npx.cmd prisma generate
    Assert-LastCommandSucceeded "prisma generate"

    Write-Host "Applying database migrations..."
    npx.cmd prisma migrate deploy
    Assert-LastCommandSucceeded "prisma migrate deploy"

    Write-Host "Building production application..."
    npm.cmd run build
    Assert-LastCommandSucceeded "Next.js build"

    if (-not (Test-Path "$AppDirectory\caddy.exe")) {
        Write-Host "Caddy not found -- run setup-server.ps1 first." -ForegroundColor Yellow
        throw "caddy.exe missing at $AppDirectory\caddy.exe"
    }

    Write-Host "Starting Choresome and Caddy..."
    Start-ScheduledTask -TaskName $AppTaskName
    Start-ScheduledTask -TaskName $CaddyTaskName

    Start-Sleep -Seconds 3

    # Verify the app really came back, on the port we expect -- if the
    # scheduled task's action doesn't actually run on $Port for some reason,
    # this catches that as a failure rather than silently deploying a server
    # nobody can reach.
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$Port" -UseBasicParsing -TimeoutSec 10

        if ($response.StatusCode -ne 200) {
            throw "Server returned HTTP $($response.StatusCode)."
        }
    }
    catch {
        throw "Server did not start successfully on port ${Port}: $($_.Exception.Message)"
    }

    Write-Host "Deployment complete." -ForegroundColor Green
}
catch {
    Write-Host ""
    Write-Host "DEPLOYMENT FAILED:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red

    throw
}
