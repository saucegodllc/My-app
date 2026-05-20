$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$AppDir = Join-Path $Root "artifacts\connectsphere-mobile"

$WifiIp = (
  ipconfig |
    Select-String "IPv4 Address" |
    ForEach-Object { ($_ -split ":\s*", 2)[1].Trim() } |
    Where-Object { $_ -and $_ -notlike "127.*" -and $_ -notlike "169.254.*" -and $_ -ne "10.5.0.2" } |
    Select-Object -First 1
)

if (-not $WifiIp) {
  $WifiIp = "172.16.227.94"
}

Set-Location $AppDir
$env:PORT = "8082"
$env:EXPO_PUBLIC_DOMAIN = "localhost:8080"
$env:EXPO_PUBLIC_LAN_HOST = $WifiIp
$env:REACT_NATIVE_PACKAGER_HOSTNAME = $WifiIp
$env:EXPO_NO_TELEMETRY = "1"
$env:EXPO_NO_DOCTOR = "1"
$env:EXPO_NO_DEPENDENCY_VALIDATION = "1"

Write-Host "Starting Expo Go for ConnectSphere..." -ForegroundColor Magenta
Write-Host "Expo Go is starting in tunnel mode for weaker Wi-Fi." -ForegroundColor Green
Write-Host "API host for the phone: http://$WifiIp`:8080" -ForegroundColor Green
Write-Host "Scan the QR shown below with Expo Go." -ForegroundColor Green

.\node_modules\.bin\expo.CMD start --tunnel --port 8082 --clear
