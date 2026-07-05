#!/bin/bash
set -e
STAMP="$1"
docker exec srivani-db pg_dump -U srivani -d srivani_db --no-owner --no-privileges | gzip > "/tmp/srivani_prod_dump_${STAMP}.sql.gz"
SIZE=$(du -h "/tmp/srivani_prod_dump_${STAMP}.sql.gz" | cut -f1)
echo "DUMP_OK size=$SIZE"
