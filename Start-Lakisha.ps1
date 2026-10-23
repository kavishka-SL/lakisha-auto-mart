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

function Test-DatabasePort {
    $settings = @{}
    Get-Content (Join-Path $backendDir '.env') | ForEach-Object {
        if ($_ -match '^\s*(DB_HOST|DB_PORT)\s*=\s*(.*?)\s*$') {
            $settings[$matches[1]] = $matches[2].Trim('"', "'")
        }
    }
    $dbHost = if ($settings['DB_HOST']) { $settings['DB_HOST'] } else { 'localhost' }
    $dbPort = 3306
    if ($settings['DB_PORT'] -and -not [int]::TryParse($settings['DB_PORT'], [ref]$dbPort)) {
        Write-Error 'DB_PORT in backend\.env must be a number.'
        return $false
    }
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $connection = $client.BeginConnect($dbHost, $dbPort, $null, $null)
        if (-not $connection.AsyncWaitHandle.WaitOne(3000)) { return $false }
        $client.EndConnect($connection)
        return $true
    } catch {
        return $false
    } finally {
        $client.Close()
    }
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
$databaseReady = Test-DatabasePort

if ($CheckOnly) {
    Write-Host "MySQL reachable: $databaseReady; backend ready: $backendReady; frontend ready: $frontendReady"
    if (-not $databaseReady) { Write-Host 'Start MySQL Server, then run this check again. MySQL Workbench alone does not start the server.' }
    if ($databaseReady -and -not $backendReady) { Write-Host 'Run Start-Lakisha.cmd and check the backend window for an error.' }
    if (-not $frontendReady) { Write-Host 'Run Start-Lakisha.cmd and check the frontend window for an error.' }
    if ($databaseReady -and $backendReady -and $frontendReady) { exit 0 }
    exit 1
}

if (-not $databaseReady -and -not $backendReady) {
    Write-Error 'Cannot reach MySQL. Start MySQL Server and check DB_HOST and DB_PORT in backend\.env, then run Start-Lakisha.cmd again.'
    exit 1
}

if (-not $backendReady -and (Test-ListeningPort 5000)) {
    Write-Error 'Port 5000 is already in use by another app. Close it before starting Lakisha Auto Mart.'
    exit 1
}
if (-not $frontendReady -and (Test-ListeningPort 3000)) {
    Write-Error 'Port 3000 is already in use by another app. Close it before starting Lakisha Auto Mart.'
    exit 1
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
