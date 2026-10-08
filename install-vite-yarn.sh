#!/bin/bash
# Yarn install for all Vite projects in ~/AI/01-PROJECTS
# Run with: bash ~/AI/01-PROJECTS/install-vite-yarn.sh

set -e
BASE="$HOME/AI/01-PROJECTS"

projects=(
  "affiliate-preneurs"
  "awm-coastal-windows"
  "awm-llc"
  "awm-takeoff"
  "awm-takeoff-portal-full-source (1)"
  "takeoff"
  "Pixel Perfect Replication"
  "lovable/Affiliate Preneurs"
)

for proj in "${projects[@]}"; do
  dir="$BASE/$proj"
  if [ -d "$dir" ]; then
    echo "=== Installing $proj ==="
    cd "$dir"
    yarn install
    echo "✓ $proj installed"
  else
    echo "⚠ Skipping $proj (not found)"
  fi
done

echo ""
echo "All done! Now try: cd \"$BASE/affiliate-preneurs\" && yarn dev"
