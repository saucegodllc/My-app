$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$ApiDir = Join-Path $Root "artifacts\api-server"
$EnvFile = Join-Path $ApiDir ".env.local"

if (Test-Path $EnvFile) {
  Get-Content $EnvFile | ForEach-Object {
    $Line = $_.Trim()
    if (-not $Line -or $Line.StartsWith("#") -or $Line -notmatch "=") { return }
    $Name, $Value = $Line -split "=", 2
    [Environment]::SetEnvironmentVariable($Name.Trim(), $Value.Trim().Trim('"').Trim("'"), "Process")
  }
}

Set-Location $ApiDir
$env:PORT = "8080"
$env:CONNECTSPHERE_LOCAL_DB_FALLBACK = "1"
$env:EVENTS_USE_MOCKS = "true"

Write-Host "Building ConnectSphere API..." -ForegroundColor Magenta
node .\build.mjs

Write-Host "Starting API on http://localhost:8080" -ForegroundColor Green
node --enable-source-maps .\dist\index.mjs 2>&1 | Tee-Object -FilePath (Join-Path $Root "api-runner.log") -Append
