<#
Srivani ERP - Pull prod database data down to local (one-way, never writes to prod)

What this does:
  1. Runs pg_dump on prod (read-only against prod's database).
  2. Downloads the dump to your machine, then deletes the copy left on the server.
  3. Backs up your CURRENT local database first (safety net, in case you want it back).
  4. Replaces your local database entirely with the downloaded prod data.

This script never runs any write command against prod. It only ever reads from it.
Local test data is disposable by design - this is expected to overwrite it.

Usage:
  powershell -File sync-db-from-prod.ps1              # asks for confirmation before touching local DB
  powershell -File sync-db-from-prod.ps1 -DryRun      # downloads the dump only, does not touch local DB
  powershell -File sync-db-from-prod.ps1 -Force       # skips the confirmation prompt
#>

param(
  [switch]$DryRun,
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
$Server         = 'root@5.223.45.82'
$RepoRoot       = 'J:\SVN\SVN_26'
$ScriptsDir     = "$RepoRoot\deploy-scripts"
$Scratch        = "$env:TEMP\srivani-dbsync-$([guid]::NewGuid().ToString('N').Substring(0,8))"
$LocalContainer = 'srivani_postgres'
$LocalDb        = 'srivani_db'
$LocalUser      = 'srivani'

function Say($msg, $color = 'Cyan') { Write-Host "`n== $msg ==" -ForegroundColor $color }
function Fail($msg) { Write-Host "`nFAILED: $msg" -ForegroundColor Red; exit 1 }

New-Item -ItemType Directory -Force $Scratch | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'

# -- 1. Dump prod (read-only against prod) --------------------------------------
Say "Dumping prod database (read-only, prod is never modified)"
scp "$ScriptsDir\dump_prod.sh" "${Server}:/tmp/dump_prod.sh" | Out-Null
if ($LASTEXITCODE -ne 0) { Fail "could not upload dump script" }

$dumpOutput = ssh $Server "bash /tmp/dump_prod.sh $stamp"
if (-not ($dumpOutput -join "`n").Contains('DUMP_OK')) { Fail "prod dump failed" }
Write-Host ($dumpOutput -join "`n")

# -- 2. Download, then remove the copy left on the server -----------------------
Say "Downloading dump"
$remoteFile = "/tmp/srivani_prod_dump_$stamp.sql.gz"
$localFile  = "$Scratch\prod_dump.sql.gz"
scp "${Server}:$remoteFile" $localFile
if ($LASTEXITCODE -ne 0) { Fail "download failed" }
$sizeKb = [math]::Round((Get-Item $localFile).Length / 1KB, 0)
Write-Host "Downloaded: $sizeKb KB"

ssh $Server "rm -f $remoteFile"

if ($DryRun) {
  Say "Dry run complete - dump saved at $localFile, local database was not touched" 'Yellow'
  exit 0
}

# -- 3. Confirm before touching local DB -----------------------------------------
Write-Host "`nThis will REPLACE your local database entirely with a copy of prod's data." -ForegroundColor Yellow
Write-Host "Your current local test data will be gone (a backup is taken first, see below)." -ForegroundColor Yellow
if (-not $Force) {
  $confirm = Read-Host "Replace local database with prod data now? (yes/no)"
  if ($confirm -ne 'yes') { Fail "cancelled by user" }
}

# -- 4. Backup current local DB first --------------------------------------------
Say "Backing up current local database before overwriting it"
$localBackupFile = "$Scratch\local_backup_before_sync_$stamp.sql"
docker exec $LocalContainer pg_dump -U $LocalUser -d $LocalDb --no-owner --no-privileges | Out-File -Encoding utf8 $localBackupFile
Write-Host "Local backup saved to: $localBackupFile" -ForegroundColor Green
Write-Host "Copy it out of your TEMP folder now if you want to keep it long-term." -ForegroundColor Yellow

# -- 5. Drop and recreate local DB -----------------------------------------------
Say "Recreating local database"
docker exec $LocalContainer psql -U $LocalUser -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$LocalDb' AND pid <> pg_backend_pid();" | Out-Null
docker exec $LocalContainer psql -U $LocalUser -d postgres -c "DROP DATABASE IF EXISTS $LocalDb;"
if ($LASTEXITCODE -ne 0) { Fail "could not drop local database - is something still connected to it?" }
docker exec $LocalContainer psql -U $LocalUser -d postgres -c "CREATE DATABASE $LocalDb OWNER $LocalUser;"
if ($LASTEXITCODE -ne 0) { Fail "could not recreate local database" }

# -- 6. Restore prod data into local ---------------------------------------------
Say "Restoring prod data into local database"
docker cp $localFile "${LocalContainer}:/tmp/prod_dump.sql.gz"
docker exec $LocalContainer sh -c "gunzip -c /tmp/prod_dump.sql.gz | psql -U $LocalUser -d $LocalDb -v ON_ERROR_STOP=1" | Select-Object -Last 10
if ($LASTEXITCODE -ne 0) { Fail "restore failed - your pre-sync local backup is at $localBackupFile" }

# -- 7. Sanity check --------------------------------------------------------------
Say "Verifying"
$rowCheck = docker exec $LocalContainer psql -U $LocalUser -d $LocalDb -tAc "SELECT count(*) FROM sales_bill;"
Write-Host "sales_bill rows now in local DB: $rowCheck" -ForegroundColor Green

Remove-Item -Recurse -Force $Scratch -ErrorAction SilentlyContinue
Say "Sync complete - local database now mirrors prod" 'Green'
Write-Host "Restart your local backend dev server so it picks up a fresh connection." -ForegroundColor Yellow
