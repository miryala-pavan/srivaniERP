#!/bin/bash
set -e
docker cp /tmp/diff_txn.sql srivani-db:/tmp/diff_txn.sql
docker exec srivani-db psql -U srivani -d srivani_db -v ON_ERROR_STOP=1 -f /tmp/diff_txn.sql
