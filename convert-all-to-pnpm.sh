#!/bin/bash
# Convert ALL Node.js projects to pnpm in ~/AI/01-PROJECTS
# Run with: bash ~/AI/01-PROJECTS/convert-all-to-pnpm.sh

set -e
BASE="$HOME/AI/01-PROJECTS"
LOG="$BASE/pnpm-conversion.log"

echo "Starting pnpm conversion..." | tee "$LOG"
echo "Date: $(date)" | tee -a "$LOG"
echo "" | tee -a "$LOG"

# Check pnpm is installed
if ! command -v pnpm &> /dev/null; then
  echo "ERROR: pnpm not found. Install with: npm install -g pnpm" | tee -a "$LOG"
  exit 1
fi

echo "pnpm version: $(pnpm --version)" | tee -a "$LOG"
echo "" | tee -a "$LOG"

# List of all Node.js projects (from assessment)
projects=(
  "affiliate-preneurs"
  "awm-coastal-windows"
  "awm-llc"
  "awm-takeoff"
  "awm-takeoff-portal-full-source (1)"
  "takeoff"
  "Pixel Perfect Replication"
  "lovable/Affiliate Preneurs"
  "aixentium-os"
  "Business OS"
  "business-os-lets-talk"
  "founderos-template"
  "founderos-verification"
  "video_studio"
  "01_StoryForge_4187_Style_To_Characters_Mac"
  "StoryForge_4187_Organized_Flow_Mac"
  "StoryForge_4187_Story_Cards_Full_Style_Images_Mac"
  "StoryForge_Autonomous_Producer_Mac"
  "StoryForge_Studio_Mac_Port_4187"
  "YouTube-Bot-main"
  "Attorney forms builder"
  "jarvis-approvals"
  "Letstalkmiles-main"
  "Travel-Commerce-OS"
)

success=0
failed=0
skipped=0

for proj in "${projects[@]}"; do
  dir="$BASE/$proj"
  if [ ! -d "$dir" ]; then
    echo "⚠ SKIP: $proj (not found)" | tee -a "$LOG"
    ((skipped++))
    continue
  fi

  if [ ! -f "$dir/package.json" ]; then
    echo "⚠ SKIP: $proj (no package.json)" | tee -a "$LOG"
    ((skipped++))
    continue
  fi

  echo "=== Processing: $proj ===" | tee -a "$LOG"
  cd "$dir"

  # Remove old lock files and node_modules for clean pnpm install
  rm -f yarn.lock package-lock.json pnpm-lock.yaml bun.lock 2>/dev/null || true
  # Note: keeping node_modules for now, pnpm will handle it
  # Uncomment next line for clean install (slower but cleaner):
  # rm -rf node_modules 2>/dev/null || true

  echo "  Running pnpm install..." | tee -a "$LOG"
  if pnpm install >> "$LOG" 2>&1; then
    echo "  ✓ Install succeeded" | tee -a "$LOG"

    echo "  Running pnpm build (smoke test)..." | tee -a "$LOG"
    if pnpm build >> "$LOG" 2>&1; then
      echo "  ✓ Build succeeded" | tee -a "$LOG"
      ((success++))
    else
      echo "  ✗ Build failed (see log)" | tee -a "$LOG"
      ((failed++))
    fi
  else
    echo "  ✗ Install failed (see log)" | tee -a "$LOG"
    ((failed++))
  fi

  echo "" | tee -a "$LOG"
  cd "$BASE"
done

echo "=================================" | tee -a "$LOG"
echo "Conversion complete!" | tee -a "$LOG"
echo "Success: $success | Failed: $failed | Skipped: $skipped" | tee -a "$LOG"
echo "Full log: $LOG" | tee -a "$LOG"
