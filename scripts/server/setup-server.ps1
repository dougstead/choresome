$ErrorActionPreference = "Stop"

$AppDirectory = "C:\Apps\choresome"

Write-Host "Setting up Choresome on this machine..." -ForegroundColor Cyan

# -----------------------------
# Caddy binary
# -----------------------------
# A single native binary, not a service/installer — this is the whole
# reverse proxy. Fetched from Caddy's own "give me the latest stable build
# for this platform" endpoint rather than a hardcoded GitHub release
# filename, since those change with each version.

$CaddyExe = Join-Path $AppDirectory "caddy.exe"

if (-not (Test-Path $CaddyExe)) {
    Write-Host "Downloading Caddy..."
    Invoke-WebRequest `
        -Uri "https://caddyserver.com/api/download?os=windows&arch=amd64" `
        -OutFile $CaddyExe
    Write-Host "Caddy downloaded to $CaddyExe."
} else {
    Write-Host "Caddy already present at $CaddyExe."
}

# -----------------------------
# Windows Firewall
# -----------------------------

function Ensure-FirewallRule {
    param([string]$Name, [int]$Port)

    if (-not (Get-NetFirewallRule -DisplayName $Name -ErrorAction SilentlyContinue)) {
        New-NetFirewallRule `
            -DisplayName $Name `
            -Direction Inbound `
            -Protocol TCP `
            -LocalPort $Port `
            -Action Allow | Out-Null
        Write-Host "Created firewall rule '$Name' for port $Port."
    } else {
        Write-Host "Firewall rule '$Name' already exists."
    }
}

Ensure-FirewallRule -Name "Choresome (3010)" -Port 3010
Ensure-FirewallRule -Name "Choresome Caddy (80)" -Port 80

# -----------------------------
# Choresome app — scheduled task
# -----------------------------

$appAction = New-ScheduledTaskAction `
    -Execute "cmd.exe" `
    -Argument "/c `"$AppDirectory\scripts\server\start-choresome.cmd`""

$appTrigger = New-ScheduledTaskTrigger -AtStartup

$appSettings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -RestartCount 5 `
    -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask `
    -TaskName "Choresome" `
    -Action $appAction `
    -Trigger $appTrigger `
    -Settings $appSettings `
    -RunLevel Highest `
    -Force | Out-Null

Write-Host "Created Choresome startup task."

# -----------------------------
# Caddy — scheduled task
# -----------------------------

$caddyAction = New-ScheduledTaskAction `
    -Execute "cmd.exe" `
    -Argument "/c `"$AppDirectory\scripts\server\start-caddy.cmd`""

$caddyTrigger = New-ScheduledTaskTrigger -AtStartup

$caddySettings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -RestartCount 5 `
    -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask `
    -TaskName "Choresome Caddy" `
    -Action $caddyAction `
    -Trigger $caddyTrigger `
    -Settings $caddySettings `
    -RunLevel Highest `
    -Force | Out-Null

Write-Host "Created Choresome Caddy startup task."

Write-Host "Server setup complete. Run scripts\server\deploy.ps1 (or start the tasks manually) to bring it up." -ForegroundColor Green
