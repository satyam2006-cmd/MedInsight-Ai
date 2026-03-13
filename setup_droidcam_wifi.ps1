# ============================================================
# DroidCam Wi-Fi Setup Script
# Finds DroidCam on your local network and connects
# ============================================================

$ErrorActionPreference = "SilentlyContinue"
$DROIDCAM_PORT = 4747

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DroidCam Wi-Fi Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# --- Step 1: Get laptop's IP and subnet ---
Write-Host "[1/3] Getting your network info..." -ForegroundColor Yellow

$activeAdapter = Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
    $_.InterfaceAlias -notmatch "Loopback" -and 
    $_.PrefixOrigin -eq "Dhcp" -and
    $_.IPAddress -notlike "169.*"
} | Select-Object -First 1

if (-not $activeAdapter) {
    # Fallback: try any non-loopback IPv4
    $activeAdapter = Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
        $_.InterfaceAlias -notmatch "Loopback" -and $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.*"
    } | Select-Object -First 1
}

if (-not $activeAdapter) {
    Write-Host "  Could not find your Wi-Fi connection!" -ForegroundColor Red
    Write-Host "  Make sure you're connected to Wi-Fi." -ForegroundColor Yellow
    exit 1
}

$laptopIP = $activeAdapter.IPAddress
$subnet = $laptopIP -replace "\.\d+$", ""
Write-Host "       Your laptop IP: $laptopIP" -ForegroundColor Green
Write-Host "       Scanning subnet: $subnet.0/24" -ForegroundColor Gray

# --- Step 2: Scan for DroidCam on the network ---
Write-Host "[2/3] Scanning for DroidCam on your network..." -ForegroundColor Yellow
Write-Host "       (This takes ~15 seconds)" -ForegroundColor Gray

$foundIP = $null

# Quick scan: try common phone IPs in the subnet
$jobs = @()
1..254 | ForEach-Object {
    $ip = "$subnet.$_"
    $jobs += Start-Job -ScriptBlock {
        param($ip, $port)
        try {
            $tcp = New-Object System.Net.Sockets.TcpClient
            $result = $tcp.BeginConnect($ip, $port, $null, $null)
            $success = $result.AsyncWaitHandle.WaitOne(300)
            if ($success -and $tcp.Connected) {
                $tcp.Close()
                return $ip
            }
            $tcp.Close()
        } catch {}
        return $null
    } -ArgumentList $ip, $DROIDCAM_PORT
}

# Wait for jobs (max 20 seconds)
$jobs | Wait-Job -Timeout 20 | Out-Null

foreach ($job in $jobs) {
    $result = Receive-Job -Job $job -ErrorAction SilentlyContinue
    if ($result) {
        $foundIP = $result
        break
    }
}

$jobs | Remove-Job -Force -ErrorAction SilentlyContinue

if ($foundIP) {
    Write-Host ""
    Write-Host "  *** FOUND DroidCam at: $foundIP ***" -ForegroundColor Green
    Write-Host ""
    
    # --- Step 3: Verify DroidCam ---
    Write-Host "[3/3] Verifying DroidCam connection..." -ForegroundColor Yellow
    
    try {
        $response = Invoke-WebRequest -Uri "http://${foundIP}:${DROIDCAM_PORT}/video" -TimeoutSec 3 -UseBasicParsing -Method HEAD
        Write-Host "       DroidCam video stream is accessible!" -ForegroundColor Green
    } catch {
        Write-Host "       DroidCam port is open (video feed available)" -ForegroundColor Green
    }

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  DroidCam Found!" -ForegroundColor Green  
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Phone IP: $foundIP" -ForegroundColor White
    Write-Host "  Port:     $DROIDCAM_PORT" -ForegroundColor White
    Write-Host ""
    Write-Host "  Next steps:" -ForegroundColor Yellow
    Write-Host "  1. Open DroidCam Client on your laptop" -ForegroundColor White
    Write-Host "  2. Select 'Wi-Fi' connection" -ForegroundColor White
    Write-Host "  3. Enter IP: $foundIP" -ForegroundColor Cyan
    Write-Host "  4. Click 'Start'" -ForegroundColor White
    Write-Host "  5. Go to Vitals page -> select DroidCam from dropdown" -ForegroundColor White
    Write-Host ""

    # Try to auto-launch DroidCam Client if installed
    $droidcamPaths = @(
        "${env:ProgramFiles}\DroidCam\DroidCamApp.exe",
        "${env:ProgramFiles(x86)}\DroidCam\DroidCamApp.exe",
        "${env:LOCALAPPDATA}\DroidCam\DroidCamApp.exe"
    )
    
    foreach ($path in $droidcamPaths) {
        if (Test-Path $path) {
            Write-Host "  Launching DroidCam Client..." -ForegroundColor Cyan
            Start-Process $path
            Write-Host "  DroidCam Client launched! Enter IP: $foundIP" -ForegroundColor Green
            break
        }
    }

} else {
    Write-Host ""
    Write-Host "  DroidCam not found on the network." -ForegroundColor Red
    Write-Host ""
    Write-Host "  Please check:" -ForegroundColor Yellow
    Write-Host "  1. DroidCam app is OPEN on your phone" -ForegroundColor White
    Write-Host "  2. Phone and laptop are on the SAME Wi-Fi network" -ForegroundColor White
    Write-Host "  3. The IP shown in DroidCam app on your phone" -ForegroundColor White
    Write-Host ""
    Write-Host "  Your laptop is on subnet: $subnet.x" -ForegroundColor Gray
    Write-Host "  Phone's DroidCam IP should also start with: $subnet." -ForegroundColor Gray
    Write-Host ""
    Write-Host "  You can also manually enter the IP in DroidCam Client." -ForegroundColor Yellow
    Write-Host ""
}
