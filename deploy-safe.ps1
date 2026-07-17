<#
Srivani ERP - Safe Deploy to Hetzner VPS

What this does, in order:
  1. Builds backend + frontend + storefront locally (storefront requires
     storefront\.env.production to exist, or the build is refused - without
     it, NEXT_PUBLIC_* vars from local dev would get baked into the prod bundle).
  2. Diffs prod's live DB schema against local schema.prisma (read-only).
  3. Refuses to auto-apply anything destructive (DROP/data-type narrowing/SET NOT NULL) -
     stops and shows you the exact lines so you can review by hand.
  4. If the diff is safe, asks for one confirmation, then:
       - takes a timestamped pg_dump backup of prod first
       - applies the diff inside a single transaction (all-or-nothing)
  5. Ships the built backend/frontend/storefront to the server and restarts all three.

The actual remote commands live in deploy-scripts/*.sh (plain bash, no PowerShell
string-escaping involved) - this script just uploads and runs them via ssh/scp.

Usage:
  powershell -File deploy-safe.ps1              # full run, asks for confirmation
  powershell -File deploy-safe.ps1 -DryRun      # build + show schema diff only, changes nothing
  powershell -File deploy-safe.ps1 -SkipSchema  # skip schema diff/apply, code deploy only
#>

param(
  [switch]$DryRun,
  [switch]$SkipSchema
)

$ErrorActionPreference = 'Stop'
$Server     = 'root@5.223.45.82'
$AppRoot    = '/var/srivani/app'
$RepoRoot   = 'J:\SVN\SVN_26'
$ScriptsDir = "$RepoRoot\deploy-scripts"
$Scratch    = "$env:TEMP\srivani-deploy-$([guid]::NewGuid().ToString('N').Substring(0,8))"

function Say($msg, $color = 'Cyan') { Write-Host "`n== $msg ==" -ForegroundColor $color }
function Fail($msg) { Write-Host "`nFAILED: $msg" -ForegroundColor Red; exit 1 }

function Invoke-RemoteScript($scriptName, [string[]]$scriptArgs = @()) {
  scp "$ScriptsDir\$scriptName" "${Server}:/tmp/$scriptName" | Out-Null
  if ($LASTEXITCODE -ne 0) { Fail "upload of $scriptName failed" }
  $argLine = $scriptArgs -join ' '
  $output = ssh $Server "bash /tmp/$scriptName $argLine"
  return @{ Output = $output; ExitCode = $LASTEXITCODE }
}

New-Item -ItemType Directory -Force $Scratch | Out-Null

#  1. Build 
Say "Building backend"
Push-Location "$RepoRoot\backend"
npm run build
if ($LASTEXITCODE -ne 0) { Pop-Location; Fail "backend build failed" }
Pop-Location

Say "Building frontend"
Push-Location "$RepoRoot\frontend"
npm run build
if ($LASTEXITCODE -ne 0) { Pop-Location; Fail "frontend build failed" }
Pop-Location

Say "Building storefront"
Push-Location "$RepoRoot\storefront"
if (-not (Test-Path ".env.production")) { Pop-Location; Fail "storefront\.env.production is missing - a local build without it would bake localhost URLs into the production bundle" }
npm run build
if ($LASTEXITCODE -ne 0) { Pop-Location; Fail "storefront build failed" }
Pop-Location

if ($SkipSchema) {
  Say "Skipping schema diff (-SkipSchema passed)" 'Yellow'
} else {
  #  2. Schema diff (read-only)
  Say "Checking schema diff against prod"
  scp "$RepoRoot\backend\prisma\schema.prisma" "${Server}:/tmp/schema_deploy_check.prisma" | Out-Null
  if ($LASTEXITCODE -ne 0) { Fail "upload of schema.prisma for diff check failed" }

  $diffResult = Invoke-RemoteScript 'diff_check.sh'
  # A dropped SSH connection here would otherwise look identical to "no diff" -
  # a false "already matches" would ship code without its required migration.
  if ($diffResult.ExitCode -ne 0) { Fail "schema diff check failed (SSH/command error, exit $($diffResult.ExitCode)) - not safe to assume schema matches, re-run" }
  $diffText = ($diffResult.Output -join "`n").Trim()

  if ($diffText -eq '-- This is an empty migration.' -or [string]::IsNullOrWhiteSpace($diffText)) {
    Say "Schema already matches prod - nothing to apply" 'Green'
  } else {
    Write-Host "`n--- Proposed schema changes ---" -ForegroundColor Yellow
    Write-Host $diffText
    Write-Host "--- end of diff ---`n" -ForegroundColor Yellow

    $destructivePatterns = @('DROP TABLE', 'DROP COLUMN', 'SET NOT NULL', 'ALTER COLUMN .* TYPE', 'TRUNCATE', 'DELETE FROM')
    $destructiveHits = $destructivePatterns | Where-Object { $diffText -match $_ }

    if ($destructiveHits.Count -gt 0) {
      Write-Host "`nBLOCKED - this diff contains statements that can lose data:" -ForegroundColor Red
      $destructiveHits | ForEach-Object { Write-Host "  - matches pattern: $_" -ForegroundColor Red }
      Write-Host "`nReview the diff above by hand. If you're certain it's safe (e.g. the table is empty," -ForegroundColor Red
      Write-Host "or you've already checked for conflicting data), apply it manually on the server," -ForegroundColor Red
      Write-Host "then re-run this script with -SkipSchema to deploy the code." -ForegroundColor Red
      Fail "destructive schema change requires manual review"
    }

    if ($DryRun) {
      Say "Dry run - schema change shown above, nothing applied" 'Yellow'
    } else {
      $confirm = Read-Host "Apply this schema change to PROD? (yes/no)"
      if ($confirm -ne 'yes') { Fail "cancelled by user" }

      Say "Backing up prod database before schema change"
      $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
      $backupResult = Invoke-RemoteScript 'backup.sh' @($stamp)
      if (-not ($backupResult.Output -join "`n").Contains('BACKUP_OK')) { Fail "backup failed - aborting before touching schema" }
      Write-Host "Backup saved: $AppRoot/backups/pre_deploy_$stamp.sql" -ForegroundColor Green

      Say "Applying schema change (single transaction)"
      $txnSql = "BEGIN;`n$diffText`nCOMMIT;`n"
      $txnSql | Out-File -Encoding utf8 "$Scratch\diff_txn.sql"
      scp "$Scratch\diff_txn.sql" "${Server}:/tmp/diff_txn.sql" | Out-Null

      $applyResult = Invoke-RemoteScript 'apply_diff.sh'
      if ($applyResult.ExitCode -ne 0) { Fail "schema apply failed - transaction rolled back automatically, prod unchanged" }

      Say "Verifying schema now matches" 'Green'
      $verifyResult = Invoke-RemoteScript 'diff_check.sh'
      $verifyText = ($verifyResult.Output -join "`n").Trim()
      if ($verifyText -ne '-- This is an empty migration.') {
        Write-Host $verifyText -ForegroundColor Yellow
        Fail "schema still differs after apply - investigate before deploying code"
      }
      Write-Host "Confirmed: prod schema matches schema.prisma exactly" -ForegroundColor Green
    }
  }
}

if ($DryRun) {
  Say "Dry run complete - no code deployed, no schema changed" 'Yellow'
  Remove-Item -Recurse -Force $Scratch -ErrorAction SilentlyContinue
  exit 0
}

#  3. Package + ship code
Say "Packaging builds"
tar -czf "$Scratch\backend-dist.tgz" -C "$RepoRoot\backend" dist
New-Item -ItemType Directory -Force "$Scratch\.next" | Out-Null
Get-ChildItem "$RepoRoot\frontend\.next" | Where-Object Name -ne 'cache' | ForEach-Object {
  Copy-Item $_.FullName "$Scratch\.next\$($_.Name)" -Recurse
}
tar -czf "$Scratch\next.tgz" -C $Scratch .next
tar -czf "$Scratch\public.tgz" -C "$RepoRoot\frontend" public
Remove-Item -Recurse -Force "$Scratch\.next"

New-Item -ItemType Directory -Force "$Scratch\.next" | Out-Null
Get-ChildItem "$RepoRoot\storefront\.next" | Where-Object Name -ne 'cache' | ForEach-Object {
  Copy-Item $_.FullName "$Scratch\.next\$($_.Name)" -Recurse
}
tar -czf "$Scratch\storefront-next.tgz" -C $Scratch .next
tar -czf "$Scratch\storefront-public.tgz" -C "$RepoRoot\storefront" public

Say "Uploading to server"
scp "$Scratch\backend-dist.tgz" "$Scratch\next.tgz" "$Scratch\public.tgz" "$Scratch\storefront-next.tgz" "$Scratch\storefront-public.tgz" "$RepoRoot\backend\prisma\schema.prisma" "${Server}:/tmp/"
if ($LASTEXITCODE -ne 0) { Fail "upload failed" }

Say "Swapping in new build on server"
$swapResult = Invoke-RemoteScript 'swap_and_restart.sh'
$swapResult.Output | ForEach-Object { Write-Host $_ }
if ($swapResult.ExitCode -ne 0) { Fail "code swap/restart failed on server" }

#  4. Health check 
Say "Health check"
Start-Sleep -Seconds 4
$healthResult = Invoke-RemoteScript 'health_check.sh'
$health = ($healthResult.Output -join "`n").Trim()
if ($health -match 'backend=200' -and $health -match 'storefront=200') {
  Write-Host "Backend and storefront both healthy: $health" -ForegroundColor Green
} else {
  Write-Host "Health check returned: $health - check pm2 logs on the server" -ForegroundColor Red
}

Remove-Item -Recurse -Force $Scratch -ErrorAction SilentlyContinue
Say "Deploy complete" 'Green'
