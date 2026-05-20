$ErrorActionPreference = "Continue"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$ApiDir = Join-Path $Root "artifacts\api-server"
$EnvFile = Join-Path $ApiDir ".env.local"
$LogPath = Join-Path $Root "api-phonefix.log"

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

node --enable-source-maps .\dist\index.mjs 2>&1 | Tee-Object -FilePath $LogPath
