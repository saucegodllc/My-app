$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$AppDir = Join-Path $Root "artifacts\connectsphere-mobile"
$LogPath = Join-Path $AppDir "expo-lan-8086-phone.log"

$WifiIp = (
  ipconfig |
    Select-String "IPv4 Address" |
    ForEach-Object { ($_ -split ":\s*", 2)[1].Trim() } |
    Where-Object { $_ -and $_ -notlike "127.*" -and $_ -notlike "169.254.*" -and $_ -ne "10.5.0.2" } |
    Select-Object -First 1
)

if (-not $WifiIp) {
  $WifiIp = "10.0.0.220"
}

Set-Location $AppDir
$env:PORT = "8086"
$env:EXPO_PUBLIC_DOMAIN = "localhost:8080"
$env:EXPO_PUBLIC_LAN_HOST = $WifiIp
$env:REACT_NATIVE_PACKAGER_HOSTNAME = $WifiIp
$env:EXPO_NO_TELEMETRY = "1"
$env:EXPO_NO_DOCTOR = "1"
$env:EXPO_NO_DEPENDENCY_VALIDATION = "1"

Write-Host "Starting ConnectSphere Expo LAN preview..." -ForegroundColor Magenta
Write-Host "Expo URL: exp://$WifiIp`:8086" -ForegroundColor Green
Write-Host "Phone API host: http://$WifiIp`:8080" -ForegroundColor Green

.\node_modules\.bin\expo.CMD start --lan --port 8086 --clear *>&1 | Tee-Object -FilePath $LogPath
