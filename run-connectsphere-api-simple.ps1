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

$env:PORT = "8080"
$env:CONNECTSPHERE_LOCAL_DB_FALLBACK = "1"
$env:EVENTS_USE_MOCKS = "true"

Set-Location $ApiDir
node --enable-source-maps .\dist\index.mjs
