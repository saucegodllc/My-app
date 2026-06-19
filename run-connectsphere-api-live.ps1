$ErrorActionPreference = "Continue"

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

try {
  $Existing = Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($Existing) {
    Write-Host "ConnectSphere API is already listening on port 8080 (PID $($Existing.OwningProcess))."
    return
  }
} catch {
  Write-Host "Could not inspect port 8080; attempting to start the API anyway."
}

$RunStamp = Get-Date -Format "yyyyMMdd-HHmmss"
$LogPath = Join-Path $Root "api-runner-$RunStamp-$PID.log"
$TranscriptPath = Join-Path $Root "api-runner-$RunStamp-$PID.transcript.log"

Start-Transcript -Path $TranscriptPath -Append | Out-Null
& "C:\Program Files\nodejs\node.exe" --enable-source-maps .\dist\index.mjs 2>&1 | Tee-Object -FilePath $LogPath -Append
