$ErrorActionPreference = "Stop"

Set-Location -LiteralPath (Resolve-Path "$PSScriptRoot\..")

Write-Host ""
Write-Host "ConnectSphere Stripe setup" -ForegroundColor Cyan
Write-Host "Paste your live Stripe secret key into this local terminal only."
Write-Host "It will not be saved to a file."
Write-Host ""

$secureKey = Read-Host "Stripe live secret key (sk_live_...)" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)

try {
  $plainKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  if ([string]::IsNullOrWhiteSpace($plainKey) -or -not $plainKey.StartsWith("sk_live_")) {
    throw "That does not look like a live Stripe secret key. Expected it to start with sk_live_."
  }

  $env:STRIPE_SECRET_KEY = $plainKey
  node .\stripe-setup.js
}
finally {
  Remove-Item Env:\STRIPE_SECRET_KEY -ErrorAction SilentlyContinue
  if ($bstr -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
  if (Get-Variable -Name plainKey -ErrorAction SilentlyContinue) {
    Remove-Variable plainKey -Force -ErrorAction SilentlyContinue
  }
}

Write-Host ""
Write-Host "Done. Copy only the printed STRIPE_PRICE_MONTHLY and STRIPE_PRICE_YEARLY values into Render." -ForegroundColor Green
Read-Host "Press Enter to close"
