#Requires -RunAsAdministrator
<#
.SYNOPSIS
  Builds ChessMaster and deploys it to IIS (no Docker).

.DESCRIPTION
  Creates (or updates) one IIS site:

    http://<server>:<Port>/        static React app      -> SitePath
    http://<server>:<Port>/api/... Node + Stockfish API  -> ApiPath (IIS application "api")

  IIS starts the Node API through HttpPlatformHandler and restarts it if it
  crashes. Re-running the script redeploys the latest code.

  Prerequisites on the server (see README, "Deploying to IIS"):
    - IIS with the "Static Content" feature
    - IIS URL Rewrite module
    - IIS HttpPlatformHandler module
    - Node.js 20.19+ (the script uses the node.exe on PATH unless -NodeExe is given)

.EXAMPLE
  .\deploy\iis\deploy.ps1
  Deploys to http://localhost:8080

.EXAMPLE
  .\deploy\iis\deploy.ps1 -Port 80 -HostName chess.example.com
#>
[CmdletBinding()]
param(
    [string]$SiteName = 'ChessMaster',
    [int]$Port = 8080,
    # Optional host name for the binding, e.g. chess.example.com. Empty = any host name.
    [string]$HostName = '',
    [string]$SitePath = 'C:\inetpub\chessmaster',
    [string]$ApiPath = 'C:\inetpub\chessmaster-api',
    [string]$NodeExe = '',
    # Reuse an existing frontend\dist instead of building it again.
    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$sitePool = "$SiteName"
$apiPool = "$SiteName-api"

function Write-Step([string]$message) {
    Write-Host ''
    Write-Host "==> $message" -ForegroundColor Cyan
}

# Runs a native command and stops the script if it fails.
function Invoke-Native([string]$exe, [string[]]$arguments, [string]$workingDir) {
    Push-Location $workingDir
    try {
        & $exe @arguments
        if ($LASTEXITCODE -ne 0) { throw "'$exe $($arguments -join ' ')' failed with exit code $LASTEXITCODE" }
    } finally {
        Pop-Location
    }
}

# robocopy uses exit codes 0-7 for success.
function Copy-Mirror([string]$from, [string]$to, [string[]]$excludeFiles = @()) {
    $arguments = @($from, $to, '/MIR', '/NFL', '/NDL', '/NJH', '/NJS', '/NP')
    if ($excludeFiles.Count -gt 0) { $arguments += '/XF'; $arguments += $excludeFiles }
    & robocopy @arguments | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "robocopy $from -> $to failed with exit code $LASTEXITCODE" }
}

function Write-Utf8File([string]$path, [string]$content) {
    [IO.File]::WriteAllText($path, $content, (New-Object Text.UTF8Encoding($false)))
}

# --- 1. Prerequisites ---------------------------------------------------------
Write-Step 'Checking prerequisites'

if (-not (Get-Service W3SVC -ErrorAction SilentlyContinue)) {
    throw 'IIS is not installed. Enable "Internet Information Services" in Windows Features (or Server Manager) first.'
}
Import-Module WebAdministration

$modules = Get-WebGlobalModule | Select-Object -ExpandProperty Name
if ($modules -notcontains 'RewriteModule') {
    throw 'The IIS URL Rewrite module is missing. Install it from https://www.iis.net/downloads/microsoft/url-rewrite'
}
if ($modules -notcontains 'httpPlatformHandler') {
    throw 'The IIS HttpPlatformHandler module is missing. Install it from https://www.iis.net/downloads/microsoft/httpplatformhandler'
}

if (-not $NodeExe) {
    $nodeCmd = Get-Command node.exe -ErrorAction SilentlyContinue
    if (-not $nodeCmd) { throw 'node.exe was not found on PATH. Install Node.js 20.19+ or pass -NodeExe.' }
    $NodeExe = $nodeCmd.Source
}
if (-not (Test-Path $NodeExe)) { throw "Node not found at $NodeExe" }
$nodeVersion = & $NodeExe --version
Write-Host "IIS, URL Rewrite, HttpPlatformHandler and Node $nodeVersion ($NodeExe) found."

# The npm next to node.exe, so the build uses the same Node installation.
$npmCmd = Join-Path (Split-Path $NodeExe) 'npm.cmd'
if (-not (Test-Path $npmCmd)) { $npmCmd = 'npm' }

# --- 2. Build the frontend ----------------------------------------------------
$frontendDir = Join-Path $repoRoot 'frontend'
$distDir = Join-Path $frontendDir 'dist'
if ($SkipBuild) {
    Write-Step 'Skipping frontend build (-SkipBuild)'
    if (-not (Test-Path (Join-Path $distDir 'index.html'))) { throw "No build found in $distDir" }
} else {
    Write-Step 'Building the frontend'
    if (-not (Test-Path (Join-Path $frontendDir 'node_modules'))) {
        Invoke-Native $npmCmd @('ci', '--no-audit', '--no-fund') $frontendDir
    }
    # Empty VITE_API_URL = the app calls /api on the same site.
    $env:VITE_API_URL = ''
    Invoke-Native $npmCmd @('run', 'build') $frontendDir
}

# --- 3. Stop the app pools so files aren't in use ------------------------------
Write-Step 'Stopping the site while files are copied'
foreach ($pool in @($apiPool, $sitePool)) {
    if ((Test-Path "IIS:\AppPools\$pool") -and ((Get-WebAppPoolState -Name $pool).Value -ne 'Stopped')) {
        Stop-WebAppPool -Name $pool
    }
}
# Give Node a moment to exit after its pool stops.
Start-Sleep -Seconds 2

# --- 4. Copy files ------------------------------------------------------------
Write-Step "Copying the frontend to $SitePath"
New-Item -ItemType Directory -Force -Path $SitePath | Out-Null
Copy-Mirror $distDir $SitePath @('web.config')
Copy-Item (Join-Path $PSScriptRoot 'frontend.web.config') (Join-Path $SitePath 'web.config') -Force

Write-Step "Copying the API to $ApiPath and installing its packages"
$backendDir = Join-Path $repoRoot 'backend'
New-Item -ItemType Directory -Force -Path $ApiPath, (Join-Path $ApiPath 'logs') | Out-Null
Copy-Mirror (Join-Path $backendDir 'src') (Join-Path $ApiPath 'src')
Copy-Item (Join-Path $backendDir 'package.json'), (Join-Path $backendDir 'package-lock.json') $ApiPath -Force
Invoke-Native $npmCmd @('ci', '--omit=dev', '--no-audit', '--no-fund') $ApiPath

$apiConfig = Get-Content (Join-Path $PSScriptRoot 'api.web.config') -Raw
$apiConfig = $apiConfig.Replace('__NODE_EXE__', $NodeExe).Replace('__API_DIR__', $ApiPath.TrimEnd('\'))
Write-Utf8File (Join-Path $ApiPath 'web.config') $apiConfig

# --- 5. App pools -------------------------------------------------------------
Write-Step 'Configuring application pools'
foreach ($pool in @($sitePool, $apiPool)) {
    if (-not (Test-Path "IIS:\AppPools\$pool")) { New-WebAppPool -Name $pool | Out-Null }
    # No .NET needed: static files and a Node process.
    Set-ItemProperty "IIS:\AppPools\$pool" -Name managedRuntimeVersion -Value ''
}
# Games are kept in the API's memory, so keep it alive: no idle shutdown, no scheduled recycling.
Set-ItemProperty "IIS:\AppPools\$apiPool" -Name startMode -Value 'AlwaysRunning'
Set-ItemProperty "IIS:\AppPools\$apiPool" -Name processModel.idleTimeout -Value ([TimeSpan]::Zero)
Set-ItemProperty "IIS:\AppPools\$apiPool" -Name recycling.periodicRestart.time -Value ([TimeSpan]::Zero)

# --- 6. Folder permissions ----------------------------------------------------
Write-Step 'Granting the app pools access to their folders'
& icacls $SitePath /grant "IIS AppPool\${sitePool}:(OI)(CI)RX" /T /Q | Out-Null
& icacls $ApiPath /grant "IIS AppPool\${apiPool}:(OI)(CI)RX" /T /Q | Out-Null
& icacls (Join-Path $ApiPath 'logs') /grant "IIS AppPool\${apiPool}:(OI)(CI)M" /T /Q | Out-Null

# --- 7. Site and /api application ---------------------------------------------
Write-Step "Configuring IIS site '$SiteName'"
# Test-Path rather than Get-Website -Name, which returns every site on some IIS versions.
if (-not (Test-Path "IIS:\Sites\$SiteName")) {
    New-Website -Name $SiteName -Port $Port -HostHeader $HostName -PhysicalPath $SitePath -ApplicationPool $sitePool | Out-Null
} else {
    Set-ItemProperty "IIS:\Sites\$SiteName" -Name physicalPath -Value $SitePath
    Set-ItemProperty "IIS:\Sites\$SiteName" -Name applicationPool -Value $sitePool
    $bindingInfo = "*:${Port}:$HostName"
    $hasBinding = Get-WebBinding -Name $SiteName -Protocol http | Where-Object { $_.bindingInformation -eq $bindingInfo }
    if (-not $hasBinding) { New-WebBinding -Name $SiteName -Protocol http -Port $Port -HostHeader $HostName }
}

if (-not (Get-WebApplication -Site $SiteName -Name 'api')) {
    New-WebApplication -Site $SiteName -Name 'api' -PhysicalPath $ApiPath -ApplicationPool $apiPool | Out-Null
} else {
    Set-ItemProperty "IIS:\Sites\$SiteName\api" -Name physicalPath -Value $ApiPath
    Set-ItemProperty "IIS:\Sites\$SiteName\api" -Name applicationPool -Value $apiPool
}
# The API's web.config sets sections that IIS locks by default on many installs, which
# gives "500.19 - This configuration section cannot be used at this path". Unlock them
# for this one application only (a <location> entry in applicationHost.config); the
# rest of the server stays locked.
$appcmd = Join-Path $env:SystemRoot 'System32\inetsrv\appcmd.exe'
foreach ($section in @('system.webServer/handlers', 'system.webServer/httpPlatform', 'system.webServer/rewrite/rules')) {
    $output = & $appcmd unlock config "$SiteName/api" "-section:$section" -commit:apphost 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Could not unlock $section for $SiteName/api: $output" }
}
Write-Host "Allowed the API's web.config to configure handlers, httpPlatform and rewrite rules."

# Start Node as soon as the pool starts (needs the Application Initialization feature; ignored without it).
try { Set-ItemProperty "IIS:\Sites\$SiteName\api" -Name preloadEnabled -Value $true } catch { Write-Host 'preloadEnabled not available; Node will start on the first request.' }

# --- 8. Start and check -------------------------------------------------------
Write-Step 'Starting the site'
Start-WebAppPool -Name $sitePool
Start-WebAppPool -Name $apiPool
if ((Get-WebsiteState -Name $SiteName).Value -ne 'Started') { Start-Website -Name $SiteName }

$hostForCheck = if ($HostName) { $HostName } else { 'localhost' }
$healthUrl = "http://localhost:$Port/api/health"
$ok = $false
for ($i = 0; $i -lt 20 -and -not $ok; $i++) {
    try {
        $response = Invoke-WebRequest $healthUrl -UseBasicParsing -Headers @{ Host = $hostForCheck } -TimeoutSec 10
        $ok = $response.StatusCode -eq 200
    } catch {
        Start-Sleep -Seconds 3
    }
}

Write-Host ''
if ($ok) {
    Write-Host "ChessMaster is running: http://${hostForCheck}:$Port/" -ForegroundColor Green
} else {
    Write-Warning "The site was deployed, but $healthUrl did not answer."
    Write-Warning "Check the Node log in $(Join-Path $ApiPath 'logs') and the IIS logs in %SystemDrive%\inetpub\logs\LogFiles."
    exit 1
}
