#!/usr/bin/env bash
# check-prod-copy.sh
# Fails if any banned dev/placeholder strings are present in production source.
# Run before: eas build --profile production
# Usage: bash scripts/check-prod-copy.sh

set -e

SEARCH_DIR="${1:-artifacts/connectsphere-mobile}"

BANNED=(
  "Ticketmaster is not connected"
  "RevenueCat is not configured"
  "Checkout Unavailable"
  "coming soon"
  "placeholder"
  "TODO:"
  "FIXME:"
  "__DEV__ === false"
)

EXCLUDE_PATTERNS=(
  "node_modules"
  "__tests__"
  "\.test\."
  "\.spec\."
  "check-prod-copy"
)

echo "🔍 Scanning $SEARCH_DIR for banned production copy..."
echo ""

FOUND=0
for TERM in "${BANNED[@]}"; do
  # Build exclude args
  EXCLUDES=""
  for EX in "${EXCLUDE_PATTERNS[@]}"; do
    EXCLUDES="$EXCLUDES --exclude-dir=$EX"
  done

  MATCHES=$(grep -rn --include="*.ts" --include="*.tsx" --include="*.js" \
    $EXCLUDES \
    "$TERM" "$SEARCH_DIR" 2>/dev/null || true)

  if [ -n "$MATCHES" ]; then
    echo "❌  Found banned string: \"$TERM\""
    echo "$MATCHES" | while IFS= read -r line; do
      echo "    $line"
    done
    echo ""
    FOUND=$((FOUND + 1))
  fi
done

if [ "$FOUND" -gt 0 ]; then
  echo "🚫  $FOUND banned string(s) found. Fix before shipping to production."
  exit 1
else
  echo "✅  No banned strings found. Safe to build."
  exit 0
fi
