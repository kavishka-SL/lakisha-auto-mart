param([switch]$CheckOnly, [switch]$WhatsAppStatus)

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $projectRoot 'backend'
$frontendDir = Join-Path $projectRoot 'frontend'

if ($WhatsAppStatus) {
    try {
        $status = (Invoke-RestMethod -Uri 'http://127.0.0.1:5000/api/whatsapp/status' -TimeoutSec 5).status
    } catch {
        Write-Error 'The backend is not running. Double-click Start-Lakisha.cmd first.'
        exit 1
    }
    Write-Host "WhatsApp status: $status"
    if ($status -eq 'scan-qr') {
        $qrPath = Join-Path $backendDir 'whatsapp-qr.svg'
        if (Test-Path $qrPath) {
            Start-Process -FilePath $qrPath
            Write-Host 'On your phone, open WhatsApp > Linked devices > Link a device and scan the opened QR image.'
        } else {
            Write-Host 'The QR image is being prepared. Try this checker again in a few seconds.'
        }
    } elseif ($status -eq 'ready') {
        Write-Host 'Your WhatsApp account is linked. No QR scan is needed.'
    } elseif ($status -eq 'disabled') {
        Write-Host 'Set ENABLE_WHATSAPP=true in backend\.env and restart the backend.'
    } else {
        Write-Host 'WhatsApp is connecting. Try this checker again shortly.'
    }
    exit 0
}

function Test-LocalUrl([string]$url) {
    try {
        $response = Invoke-WebRequest -Uri $url -TimeoutSec 3 -UseBasicParsing
        return $response.StatusCode -eq 200
    } catch {
        return $false
    }
}

function Test-LakishaFrontend {
    try {
        $response = Invoke-WebRequest -Uri 'http://127.0.0.1:3000/' -TimeoutSec 3 -UseBasicParsing
        return $response.StatusCode -eq 200 -and $response.Content -match '<title>Lakisha Auto Mart</title>'
    } catch {
        return $false
    }
}

function Test-ListeningPort([int]$port) {
    return [bool](Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}

if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue) -and
    (Test-Path 'C:\Program Files\nodejs\npm.cmd')) {
    $env:Path = "C:\Program Files\nodejs;$env:Path"
}
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    Write-Error 'Node.js/npm is not on PATH. Install Node.js, then reopen this launcher.'
    exit 1
}
if (-not (Test-Path (Join-Path $backendDir '.env'))) {
    Write-Error 'backend\.env is missing. Set up the database connection before starting.'
    exit 1
}
foreach ($folder in @($backendDir, $frontendDir)) {
    if (-not (Test-Path (Join-Path $folder 'node_modules'))) {
        Write-Error "Packages are missing in $folder. Run npm.cmd ci in that folder once."
        exit 1
    }
}

$backendReady = Test-LocalUrl 'http://127.0.0.1:5000/api/health'
$frontendReady = Test-LakishaFrontend

if (-not $backendReady -and (Test-ListeningPort 5000)) {
    Write-Error 'Port 5000 is already in use by another app. Close it before starting Lakisha Auto Mart.'
    exit 1
}
if (-not $frontendReady -and (Test-ListeningPort 3000)) {
    Write-Error 'Port 3000 is already in use by another app. Close it before starting Lakisha Auto Mart.'
    exit 1
}

if ($CheckOnly) {
    Write-Host "Backend ready: $backendReady; frontend ready: $frontendReady"
    exit 0
}

if ($backendReady) {
    Write-Host 'Backend is already running.'
} else {
    Start-Process -FilePath $env:ComSpec -ArgumentList '/k', 'npm.cmd start' -WorkingDirectory $backendDir
    Write-Host 'Started backend in a new window.'
}

if ($frontendReady) {
    Write-Host 'Frontend is already running.'
} else {
    Start-Process -FilePath $env:ComSpec -ArgumentList '/k', 'npm.cmd start' -WorkingDirectory $frontendDir
    Write-Host 'Started frontend in a new window.'
}

for ($attempt = 0; $attempt -lt 60; $attempt++) {
    if ((Test-LocalUrl 'http://127.0.0.1:5000/api/health') -and
        (Test-LakishaFrontend)) {
        Start-Process 'http://localhost:3000/'
        Write-Host 'Lakisha Auto Mart is ready at http://localhost:3000/'
        exit 0
    }
    Start-Sleep -Seconds 2
}

Write-Error 'The app did not become ready within two minutes. Check the backend and frontend windows for errors.'
exit 1
