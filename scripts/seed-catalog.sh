#!/usr/bin/env bash
set -euo pipefail

if [[ $# -gt 1 ]]; then
  echo "Usage: bash scripts/seed-catalog.sh [product-count]" >&2
  exit 1
fi

seed_count="${1:-100000}"
if [[ ! "$seed_count" =~ ^[1-9][0-9]{0,6}$ ]] || (( seed_count > 1000000 )); then
  echo "Product count must be an integer between 1 and 1000000." >&2
  exit 1
fi

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"

docker compose exec -T postgres psql -X -U catalog -d catalog \
  --set=ON_ERROR_STOP=1 --set=seed_count="$seed_count" \
  < "$project_dir/scripts/seed-catalog.sql"
