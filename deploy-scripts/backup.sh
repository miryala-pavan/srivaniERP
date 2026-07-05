#!/bin/bash
set -e
STAMP="$1"
mkdir -p /var/srivani/app/backups
docker exec srivani-db pg_dump -U srivani -d srivani_db > "/var/srivani/app/backups/pre_deploy_${STAMP}.sql"
echo BACKUP_OK
