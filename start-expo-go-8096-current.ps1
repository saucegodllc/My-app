$env:PORT = "8096"
$env:EXPO_PUBLIC_DOMAIN = "localhost:8080"
$env:EXPO_PUBLIC_LAN_HOST = "172.16.225.121"
$env:REACT_NATIVE_PACKAGER_HOSTNAME = "172.16.225.121"
$env:EXPO_NO_TELEMETRY = "1"
$env:EXPO_NO_DOCTOR = "1"
$env:EXPO_NO_DEPENDENCY_VALIDATION = "1"

Set-Location "C:\Users\fazer\Documents\Codex\2026-04-27\github-plugin-github-openai-curated-this\artifacts\connectsphere-mobile"

.\node_modules\.bin\expo.CMD start --lan --port 8096 --clear *> "C:\Users\fazer\Documents\Codex\2026-04-27\github-plugin-github-openai-curated-this\artifacts\connectsphere-mobile\expo-lan-8096-current.log"
