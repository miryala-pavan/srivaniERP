Write-Host ""
Write-Host " ============================================"
Write-Host "  Fix Online PLU Flags - One Time Migration"
Write-Host " ============================================"
Write-Host ""
Write-Host " Enter your ERP login credentials:"
Write-Host ""
$USERNAME = Read-Host "Username"
$PASSWORD = Read-Host "Password"

if (-not $USERNAME -or -not $PASSWORD) {
  Write-Host " ERROR: Username and password are required." -ForegroundColor Red
  Read-Host "Press Enter to exit"
  exit 1
}

Write-Host ""
Write-Host " Logging in..." -ForegroundColor Yellow

try {
  $loginBody = @{ username = $USERNAME; password = $PASSWORD } | ConvertTo-Json
  $loginResp = Invoke-RestMethod -Uri "http://localhost:4001/api/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
  $TOKEN = $loginResp.access_token
} catch {
  Write-Host ""
  Write-Host " ERROR: Login failed. Check username/password and make sure backend is running." -ForegroundColor Red
  Write-Host " Detail: $($_.Exception.Message)" -ForegroundColor DarkRed
  Read-Host "Press Enter to exit"
  exit 1
}

if (-not $TOKEN) {
  Write-Host ""
  Write-Host " ERROR: Login returned no token." -ForegroundColor Red
  Read-Host "Press Enter to exit"
  exit 1
}

Write-Host " Login successful." -ForegroundColor Green
Write-Host ""
Write-Host " Running fix-online-plus..." -ForegroundColor Yellow
Write-Host ""

try {
  $headers = @{ Authorization = "Bearer $TOKEN" }
  $result = Invoke-RestMethod -Uri "http://localhost:4001/api/admin/fix-online-plus" -Method POST -Headers $headers -ContentType "application/json"
  Write-Host " Result:" -ForegroundColor Cyan
  Write-Host "   Total products     : $($result.total)"
  Write-Host "   Products with stock: $($result.productsWithStock)"
  Write-Host ""
  Write-Host " Done! Online PLU flags have been fixed." -ForegroundColor Green
} catch {
  Write-Host ""
  Write-Host " ERROR: Migration failed." -ForegroundColor Red
  Write-Host " Detail: $($_.Exception.Message)" -ForegroundColor DarkRed
}

Write-Host ""
Read-Host "Press Enter to exit"
