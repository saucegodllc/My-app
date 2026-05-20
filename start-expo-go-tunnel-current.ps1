$env:PORT = "8097"
$env:EXPO_PUBLIC_DOMAIN = "localhost:8080"
$env:EXPO_NO_TELEMETRY = "1"
$env:EXPO_NO_DOCTOR = "1"
$env:EXPO_NO_DEPENDENCY_VALIDATION = "1"

Set-Location "C:\Users\fazer\Documents\Codex\2026-04-27\github-plugin-github-openai-curated-this\artifacts\connectsphere-mobile"

.\node_modules\.bin\expo.CMD start --tunnel --port 8097 --clear *> "C:\Users\fazer\Documents\Codex\2026-04-27\github-plugin-github-openai-curated-this\artifacts\connectsphere-mobile\expo-tunnel-8097-current.log"
