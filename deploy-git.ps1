<#
Srivani ERP - Deploy to Hetzner via git push + pull

What this does, in order:
  1. Commits and pushes local changes to origin/master (skipped if working
     tree is already clean/pushed).
  2. On the server: stashes any local working-tree drift (recoverable via
     'git stash list' - never discarded outright), then `git pull --ff-only`.
     If history has diverged, this fails loudly rather than merging/rewriting.
  3. Diffs prod's live DB schema against the now-pulled schema.prisma
     (read-only). Refuses to auto-apply anything destructive (DROP/data-type
     narrowing/SET NOT NULL) - stops and shows the exact lines for manual
     review.
  4. If the diff is safe, asks for one confirmation, then:
       - takes a timestamped pg_dump backup of prod first
       - applies the diff inside a single transaction (all-or-nothing)
  5. Runs `npm install` + build for backend/frontend/storefront ON THE SERVER
     (storefront build refuses to run if storefront/.env.production is
     missing there - building without it would bake dev URLs into the bundle).
  6. Restarts all three PM2 processes and runs a health check.

Usage:
  powershell -File deploy-git.ps1                                  # full run, asks for confirmation before any schema change
  powershell -File deploy-git.ps1 -DryRun                          # push + pull + show schema diff only, no schema/build/restart changes
  powershell -File deploy-git.ps1 -SkipSchema                      # skip schema diff/apply, code deploy only
  powershell -File deploy-git.ps1 -ConfirmSchema                   # apply the shown schema diff without an interactive prompt -
                                                                    #   only ever pass this after a real "yes" from whoever asked
                                                                    #   for the deploy; needed when running non-interactively
                                                                    #   (Read-Host cannot prompt without an attached console)
  powershell -File deploy-git.ps1 -CommitMessage "Fix X, add Y"    # custom commit message (default: generic)
#>

param(
  [switch]$DryRun,
  [switch]$SkipSchema,
  [switch]$ConfirmSchema,
  [string]$CommitMessage = "Deploy: sync local changes to prod"
)

$ErrorActionPreference = 'Stop'
$Server     = 'root@5.223.45.82'
$RepoRoot   = 'J:\SVN\SVN_26'
$ScriptsDir = "$RepoRoot\deploy-scripts"
$Scratch    = "$env:TEMP\srivani-deploy-git-$([guid]::NewGuid().ToString('N').Substring(0,8))"

# On this machine, bare `git` can resolve to a bogus C:\Windows\System32\git
# entry ahead of the real Git for Windows install in PATH - force the real
# one first for this process only (does not touch system/user PATH).
$RealGitDir = 'C:\Program Files\Git\cmd'
if (Test-Path "$RealGitDir\git.exe") { $env:PATH = "$RealGitDir;$env:PATH" }
if (-not (Get-Command git.exe -ErrorAction SilentlyContinue)) { Write-Host "FAILED: real git.exe not found" -ForegroundColor Red; exit 1 }

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

#  1. Commit + push local
Say "Checking local git status"
Push-Location $RepoRoot
$localStatus = git.exe status --porcelain
if ($localStatus) {
  Write-Host "`n--- Local changes to commit ---" -ForegroundColor Yellow
  git.exe status --short
  Write-Host "--- end ---`n" -ForegroundColor Yellow
  git.exe add -A
  git.exe commit -m "$CommitMessage"
  if ($LASTEXITCODE -ne 0) { Pop-Location; Fail "git commit failed" }
} else {
  Say "Working tree already clean - nothing new to commit" 'Green'
}

Say "Pushing to origin/master"
# credential.helper=manager-core is stale in this machine's global git config
# (resolves to a nonexistent git-credential-manager-core.exe) and can hang
# waiting on an interactive fallback prompt. Override it for this one
# command only - never touches the user's actual git config.
git.exe -c credential.helper=manager push origin master
if ($LASTEXITCODE -ne 0) { Pop-Location; Fail "git push failed" }
Pop-Location

#  2. Reconcile + pull on server
Say "Reconciling server working tree and pulling"
$pullResult = Invoke-RemoteScript 'git_reconcile_and_pull.sh'
$pullResult.Output | ForEach-Object { Write-Host $_ }
if ($pullResult.ExitCode -ne 0) { Fail "server-side git pull failed - see output above" }

if ($SkipSchema) {
  Say "Skipping schema diff (-SkipSchema passed)" 'Yellow'
} else {
  #  3. Schema diff (read-only, against the now-pulled schema.prisma)
  Say "Checking schema diff against prod"
  $diffResult = Invoke-RemoteScript 'diff_check_live.sh'
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
      Write-Host "`nReview the diff above by hand, apply manually on the server if you're certain it's safe," -ForegroundColor Red
      Write-Host "then re-run this script with -SkipSchema." -ForegroundColor Red
      Fail "destructive schema change requires manual review"
    }

    if ($DryRun) {
      Say "Dry run - schema change shown above, nothing applied" 'Yellow'
    } else {
      # Read-Host cannot work when this script is launched via a
      # -NonInteractive wrapper (no console attached to prompt against) - the
      # -ConfirmSchema switch is the same confirmation, supplied explicitly
      # by whoever launches the script instead of typed at a prompt. It must
      # only ever be passed after a real "yes" from the person requesting
      # the deploy, never assumed or defaulted on.
      if ($ConfirmSchema) {
        Write-Host "Schema change confirmed via -ConfirmSchema" -ForegroundColor Yellow
      } else {
        $confirm = Read-Host "Apply this schema change to PROD? (yes/no)"
        if ($confirm -ne 'yes') { Fail "cancelled by user" }
      }

      Say "Backing up prod database before schema change"
      $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
      $backupResult = Invoke-RemoteScript 'backup.sh' @($stamp)
      if (-not ($backupResult.Output -join "`n").Contains('BACKUP_OK')) { Fail "backup failed - aborting before touching schema" }
      Write-Host "Backup saved: /var/srivani/app/backups/pre_deploy_$stamp.sql" -ForegroundColor Green

      Say "Applying schema change (single transaction)"
      $txnSql = "BEGIN;`n$diffText`nCOMMIT;`n"
      $txnSql | Out-File -Encoding utf8 "$Scratch\diff_txn.sql"
      scp "$Scratch\diff_txn.sql" "${Server}:/tmp/diff_txn.sql" | Out-Null

      $applyResult = Invoke-RemoteScript 'apply_diff.sh'
      if ($applyResult.ExitCode -ne 0) { Fail "schema apply failed - transaction rolled back automatically, prod unchanged" }

      Say "Verifying schema now matches" 'Green'
      $verifyResult = Invoke-RemoteScript 'diff_check_live.sh'
      $verifyText = ($verifyResult.Output -join "`n").Trim()
      if ($verifyText -ne '-- This is an empty migration.') {
        Write-Host $verifyText -ForegroundColor Yellow
        Fail "schema still differs after apply - investigate before building/restarting"
      }
      Write-Host "Confirmed: prod schema matches schema.prisma exactly" -ForegroundColor Green
    }
  }
}

if ($DryRun) {
  Say "Dry run complete - code pulled on server, no schema changed, no build/restart done" 'Yellow'
  Remove-Item -Recurse -Force $Scratch -ErrorAction SilentlyContinue
  exit 0
}

#  4. Install + build on server
Say "Installing dependencies and building on server (this takes a few minutes)"
$buildResult = Invoke-RemoteScript 'install_and_build.sh'
$buildResult.Output | ForEach-Object { Write-Host $_ }
if ($buildResult.ExitCode -ne 0) { Fail "install/build failed on server - see output above, apps NOT restarted" }

#  5. Restart
Say "Restarting services"
$restartResult = Invoke-RemoteScript 'restart_all.sh'
$restartResult.Output | ForEach-Object { Write-Host $_ }
if ($restartResult.ExitCode -ne 0) { Fail "restart failed on server" }

#  6. Health check
Say "Health check"
Start-Sleep -Seconds 5
$healthResult = Invoke-RemoteScript 'health_check.sh'
$health = ($healthResult.Output -join "`n").Trim()
if ($health -match 'backend=200' -and $health -match 'storefront=200') {
  Write-Host "Backend and storefront both healthy: $health" -ForegroundColor Green
} else {
  Write-Host "Health check returned: $health - check pm2 logs on the server" -ForegroundColor Red
}

Remove-Item -Recurse -Force $Scratch -ErrorAction SilentlyContinue
Say "Deploy complete" 'Green'
