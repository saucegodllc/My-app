$env:PORT = "8097"
$env:EXPO_PUBLIC_ENVIRONMENT = "development"
$env:EXPO_PUBLIC_ENABLE_PUSH_REGISTRATION = "true"
$env:EXPO_PUBLIC_FEATURE_PUSH = "true"
$env:EXPO_NO_TELEMETRY = "1"
$env:EXPO_NO_DOCTOR = "1"
$env:EXPO_NO_DEPENDENCY_VALIDATION = "1"

Set-Location $PSScriptRoot
.\node_modules\.bin\expo.CMD start --tunnel --port 8097 --clear *>&1 |
  Tee-Object -FilePath (Join-Path $PSScriptRoot "expo-tunnel-8097-now.log")
