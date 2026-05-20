$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$EnvFile = Join-Path $Root "artifacts\api-server\.env.local"

if (-not (Test-Path (Split-Path -Parent $EnvFile))) {
  throw "Could not find artifacts\api-server."
}

$SecureToken = Read-Host "Paste your Eventbrite private token" -AsSecureString
$Bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureToken)

try {
  $Token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($Bstr)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Bstr)
}

if (-not $Token -or -not $Token.Trim()) {
  throw "No token entered. Nothing was saved."
}

$Lines = @()
if (Test-Path $EnvFile) {
  $Lines = Get-Content $EnvFile
}

$TokenLine = "EVENTBRITE_PRIVATE_TOKEN=$($Token.Trim())"
$Updated = $false
$NextLines = foreach ($Line in $Lines) {
  if ($Line -match "^\s*EVENTBRITE_PRIVATE_TOKEN\s*=") {
    $Updated = $true
    $TokenLine
  } else {
    $Line
  }
}

if (-not $Updated) {
  $NextLines = @($NextLines) + $TokenLine
}

$NextLines | Set-Content -Path $EnvFile -Encoding UTF8
Write-Host "Saved EVENTBRITE_PRIVATE_TOKEN to artifacts\api-server\.env.local" -ForegroundColor Green
Write-Host "Restart the API with: .\start-connectsphere-api.ps1" -ForegroundColor Magenta
