#!/bin/bash
backend=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4001/api/health)
storefront=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4002/)
echo "backend=$backend storefront=$storefront"
