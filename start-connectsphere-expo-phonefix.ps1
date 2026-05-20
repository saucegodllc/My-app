$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$AppDir = Join-Path $Root "artifacts\connectsphere-mobile"
$LogPath = Join-Path $AppDir "expo-phonefix.log"

Set-Location $AppDir
$env:PORT = "8085"
$env:EXPO_PUBLIC_API_URL = "http://10.2.0.2:8080"
$env:EXPO_PUBLIC_DOMAIN = "10.2.0.2:8080"
$env:EXPO_PUBLIC_LAN_HOST = "10.2.0.2"
$env:REACT_NATIVE_PACKAGER_HOSTNAME = "10.2.0.2"
$env:EXPO_NO_TELEMETRY = "1"
$env:EXPO_NO_DOCTOR = "1"
$env:EXPO_NO_DEPENDENCY_VALIDATION = "1"

Write-Host "Starting ConnectSphere Expo phone preview..." -ForegroundColor Magenta
Write-Host "Expo URL: exp://10.2.0.2:8085" -ForegroundColor Green
Write-Host "Phone API host: http://10.2.0.2:8080" -ForegroundColor Green

.\node_modules\.bin\expo.CMD start --lan --port 8085 --clear *>&1 | Tee-Object -FilePath $LogPath
