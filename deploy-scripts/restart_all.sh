#!/bin/bash
set -e
pm2 restart srivani-backend srivani-frontend srivani-storefront
pm2 save
