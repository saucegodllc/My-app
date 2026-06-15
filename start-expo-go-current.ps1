$env:PORT = "8095"
$env:EXPO_PUBLIC_DOMAIN = "localhost:8080"
$env:EXPO_PUBLIC_LAN_HOST = "192.168.1.197"
$env:REACT_NATIVE_PACKAGER_HOSTNAME = "192.168.1.197"
$env:EXPO_NO_TELEMETRY = "1"
$env:EXPO_NO_DOCTOR = "1"
$env:EXPO_NO_DEPENDENCY_VALIDATION = "1"

Set-Location "C:\Users\fazer\Documents\Codex\2026-04-27\github-plugin-github-openai-curated-this\artifacts\connectsphere-mobile"

.\node_modules\.bin\expo.CMD start --lan --port 8095 --clear *> "C:\Users\fazer\Documents\Codex\2026-04-27\github-plugin-github-openai-curated-this\artifacts\connectsphere-mobile\expo-lan-8095-current.log"
