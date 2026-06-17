# Srivani Stores ERP — Full Backup Script
#
# Backs up BOTH the PostgreSQL database AND the product-images directory.
# Run from J:\SVN\SVN_26 before any schema migration or risky deployment.
#
# Usage: .\backup.ps1
#        .\backup.ps1 -Tag "before_feature_xyz"

param([string]$Tag = "manual")

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$label     = "${Tag}_${timestamp}"

# ── 1. Database dump (pg_dump via Docker) ───────────────────────────────────
$sqlFile = "backup_${label}.sql"
Write-Host "Dumping database to $sqlFile ..."
docker exec srivani_postgres pg_dump -U srivani srivani_db | Out-File -FilePath $sqlFile -Encoding utf8
Write-Host "  Database backup: OK ($sqlFile)"

# ── 2. Product images copy ───────────────────────────────────────────────────
#
# IMPORTANT: PRODUCT_IMAGES_DIR must be backed up alongside the SQL dump.
# It contains:
#   - noimage.svg  (placeholder, served at /uploads/products/noimage.svg)
#   - <productCode>.jpg/png/webp  (one file per product that has an image)
#
# The DB stores only the relative URL (e.g. /uploads/products/P001234.jpg).
# Without these files the imageUrl column in the product table points to nothing.
# When restoring: restore the SQL first, then restore this directory to PRODUCT_IMAGES_DIR.

$imagesDir  = "J:\SVN\SVN_26\storage\product-images"
$imagesBackup = "backup_images_${label}"

if (Test-Path $imagesDir) {
    Copy-Item $imagesDir -Destination $imagesBackup -Recurse
    Write-Host "  Images backup:   OK ($imagesBackup)"
} else {
    Write-Host "  Images backup:   SKIP (directory not found: $imagesDir)"
}

Write-Host ""
Write-Host "Backup complete: $label"
Write-Host "  SQL file:      $sqlFile"
Write-Host "  Images folder: $imagesBackup"
