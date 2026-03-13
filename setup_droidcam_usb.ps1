# ============================================================
# DroidCam USB Setup Script
# Automatically downloads ADB and connects DroidCam over USB
# ============================================================

$ErrorActionPreference = "Stop"
$ADB_DIR = "$env:LOCALAPPDATA\adb-platform-tools"
$ADB_EXE = "$ADB_DIR\platform-tools\adb.exe"
$ADB_URL = "https://dl.google.com/android/repository/platform-tools-latest-windows.zip"
$ADB_ZIP = "$env:TEMP\platform-tools.zip"
$DROIDCAM_PORT = 4747

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DroidCam USB Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# --- Step 1: Install ADB if not found ---
function Get-AdbPath {
    # Check if adb is already in PATH
    $existing = Get-Command adb -ErrorAction SilentlyContinue
    if ($existing) { return $existing.Source }
    # Check our local install
    if (Test-Path $ADB_EXE) { return $ADB_EXE }
    return $null
}

$adbPath = Get-AdbPath

if (-not $adbPath) {
    Write-Host "[1/4] ADB not found. Downloading Android Platform Tools..." -ForegroundColor Yellow
    
    # Download
    Invoke-WebRequest -Uri $ADB_URL -OutFile $ADB_ZIP -UseBasicParsing
    Write-Host "       Downloaded successfully." -ForegroundColor Green
    
    # Extract
    if (Test-Path $ADB_DIR) { Remove-Item $ADB_DIR -Recurse -Force }
    Expand-Archive -Path $ADB_ZIP -DestinationPath $ADB_DIR -Force
    Remove-Item $ADB_ZIP -Force
    
    $adbPath = $ADB_EXE
    Write-Host "       Installed to: $ADB_DIR" -ForegroundColor Green
} else {
    Write-Host "[1/4] ADB found at: $adbPath" -ForegroundColor Green
}

# --- Step 2: Check for connected device ---
Write-Host "[2/4] Checking for connected Android device..." -ForegroundColor Yellow

$deviceOutput = & $adbPath devices 2>&1 | Out-String
Write-Host $deviceOutput -ForegroundColor Gray

$connectedDevices = ($deviceOutput -split "`n" | Where-Object { $_ -match "\tdevice$" })

if (-not $connectedDevices -or $connectedDevices.Count -eq 0) {
    Write-Host ""
    Write-Host "  No device found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Please make sure:" -ForegroundColor Yellow
    Write-Host "  1. USB Debugging is enabled on your phone" -ForegroundColor White
    Write-Host "     (Settings > Developer Options > USB Debugging)" -ForegroundColor Gray
    Write-Host "  2. Your phone is connected via USB cable" -ForegroundColor White
    Write-Host "  3. You've tapped 'Allow' on the USB debugging prompt on your phone" -ForegroundColor White
    Write-Host ""
    Write-Host "  After enabling, run this script again." -ForegroundColor Yellow
    Write-Host ""
    
    # Start ADB server and wait for device 
    Write-Host "  Waiting 15 seconds for device..." -ForegroundColor Cyan
    & $adbPath wait-for-device 2>&1 | Out-Null
    Start-Sleep -Seconds 2
    
    $deviceOutput2 = & $adbPath devices 2>&1 | Out-String
    $connectedDevices = ($deviceOutput2 -split "`n" | Where-Object { $_ -match "\tdevice$" })
    
    if (-not $connectedDevices -or $connectedDevices.Count -eq 0) {
        Write-Host "  Still no device. Please connect your phone and re-run." -ForegroundColor Red
        exit 1
    }
}

$deviceId = ($connectedDevices[0] -split "\t")[0].Trim()
Write-Host "       Device connected: $deviceId" -ForegroundColor Green

# --- Step 3: Set up port forwarding for DroidCam ---
Write-Host "[3/4] Setting up USB port forwarding (port $DROIDCAM_PORT)..." -ForegroundColor Yellow

# Remove any existing forward on that port
& $adbPath forward --remove tcp:$DROIDCAM_PORT 2>&1 | Out-Null

# Create the forward
& $adbPath forward tcp:$DROIDCAM_PORT tcp:$DROIDCAM_PORT
Write-Host "       Port forwarding active: localhost:$DROIDCAM_PORT -> phone:$DROIDCAM_PORT" -ForegroundColor Green

# --- Step 4: Verify connection ---
Write-Host "[4/4] Verifying DroidCam connection..." -ForegroundColor Yellow

Start-Sleep -Seconds 1

try {
    $response = Invoke-WebRequest -Uri "http://localhost:$DROIDCAM_PORT/v1/ctl" -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
    Write-Host "       DroidCam is responding on USB!" -ForegroundColor Green
} catch {
    Write-Host "       DroidCam port forwarding is set up." -ForegroundColor Green
    Write-Host "       Make sure the DroidCam app is open on your phone." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Next steps:" -ForegroundColor White
Write-Host "  1. Make sure DroidCam app is open on your phone" -ForegroundColor Gray
Write-Host "  2. Open DroidCam Client on your laptop" -ForegroundColor Gray
Write-Host "     (click USB icon and press Start)" -ForegroundColor Gray
Write-Host "  3. Go to the Vitals page in your app" -ForegroundColor Gray
Write-Host "  4. Select 'DroidCam' from the camera dropdown" -ForegroundColor Gray
Write-Host ""
Write-Host "  Your phone camera will stream at HD quality!" -ForegroundColor Cyan
Write-Host ""
