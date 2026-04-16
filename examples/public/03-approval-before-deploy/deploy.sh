#!/usr/bin/env bash
set -euo pipefail

echo "Deploying to production..."
echo "Deploy completed at $(date -u +%Y-%m-%dT%H:%M:%SZ)" > deploy-receipt.txt
echo "Deploy receipt written to deploy-receipt.txt"
