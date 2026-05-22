#!/usr/bin/env bash
# Scan for TODO/FIXME/HACK/WORKAROUND/XXX/TEMP comments, large files, and long functions.
# Groups findings by category with counts.
# Usage: ./debt_inventory.sh [directory]

set -euo pipefail

DIR="${1:-.}"

echo "=== Tech Debt Inventory: $DIR ==="
echo ""

GLOB_ARGS=(
  --glob '*.ts' --glob '*.tsx' --glob '*.js' --glob '*.jsx'
  --glob '*.json' --glob '*.yml' --glob '*.yaml'
  --glob '!node_modules/**' --glob '!dist/**' --glob '!coverage/**'
  --glob '!package-lock.json' --glob '!*.lock'
  --glob '!.git/**'
)

# 1. Debt markers by category
echo "--- Debt Markers ---"
echo ""

declare -A CATEGORIES=(
  ["TODO"]="TODO"
  ["FIXME"]="FIXME"
  ["HACK"]="HACK|KLUDGE"
  ["WORKAROUND"]="WORKAROUND|WORK-AROUND"
  ["TEMP"]="TEMP|TEMPORARY"
  ["XXX"]="XXX"
  ["DEPRECATED"]="@deprecated|DEPRECATED"
)

total_markers=0
for category in TODO FIXME HACK WORKAROUND TEMP XXX DEPRECATED; do
  pattern="${CATEGORIES[$category]}"
  count=$(rg -c -i "${GLOB_ARGS[@]}" "$pattern" "$DIR" 2>/dev/null | awk -F: '{s+=$2} END {print s+0}' || echo "0")
  if [[ "$count" -gt 0 ]]; then
    total_markers=$((total_markers + count))
    echo "  $category: $count"
    # Show first 5 of each
    rg -n -i "${GLOB_ARGS[@]}" "$pattern" "$DIR" 2>/dev/null | head -5 | while IFS=: read -r file line_num content; do
      rel="${file#$DIR/}"
      echo "    $rel:$line_num — $(echo "$content" | sed 's/^\s*//' | head -c 100)"
    done
    echo ""
  fi
done

echo "  Total markers: $total_markers"
echo ""

# 2. Large files (likely need splitting)
echo "--- Large Files (300+ lines, excluding tests) ---"
large_count=0
find "$DIR" -type f \( -name '*.ts' -o -name '*.tsx' \) \
  ! -name '*.spec.*' ! -name '*.test.*' ! -name '*.d.ts' \
  ! -path '*/node_modules/*' ! -path '*/dist/*' ! -path '*/coverage/*' \
  ! -path '*/migrations/*' \
  2>/dev/null | while read -r file; do
    lines=$(wc -l < "$file" | tr -d ' ')
    if [[ "$lines" -gt 300 ]]; then
      rel="${file#$DIR/}"
      echo "  $rel — $lines lines"
      large_count=$((large_count + 1))
    fi
  done | sort -t— -k2 -rn || true
echo ""

# 3. Dead code indicators
echo "--- Potential Dead Code ---"
dead=0

# Unused imports (basic check)
unused_imports=$(rg -n "^import.*from" "$DIR" "${GLOB_ARGS[@]}" 2>/dev/null | grep -v "type " | wc -l | tr -d ' ' || echo "0")
echo "  Total import statements: $unused_imports (run ESLint for unused import detection)"

# Empty catch blocks
empty_catches=$(rg -n 'catch\s*\([^)]*\)\s*\{\s*\}' "$DIR" "${GLOB_ARGS[@]}" 2>/dev/null | wc -l | tr -d ' ' || echo "0")
if [[ "$empty_catches" -gt 0 ]]; then
  echo "  Empty catch blocks: $empty_catches"
  rg -n 'catch\s*\([^)]*\)\s*\{\s*\}' "$DIR" "${GLOB_ARGS[@]}" 2>/dev/null | head -5 | while IFS=: read -r file line_num content; do
    rel="${file#$DIR/}"
    echo "    $rel:$line_num"
  done
fi

# console.log left in (non-test code)
console_logs=$(rg -n 'console\.(log|debug|info|warn)' "$DIR" \
  --glob '*.ts' --glob '*.tsx' \
  --glob '!node_modules/**' --glob '!dist/**' \
  --glob '!*.spec.*' --glob '!*.test.*' \
  --glob '!**/test/**' \
  2>/dev/null | wc -l | tr -d ' ' || echo "0")
if [[ "$console_logs" -gt 0 ]]; then
  echo "  Console statements in production code: $console_logs"
fi
echo ""

# 4. Dependency debt
echo "--- Dependency Debt ---"
if [[ -f "$DIR/package.json" ]] && command -v npm &>/dev/null; then
  outdated_count=$(cd "$DIR" && npm outdated 2>/dev/null | tail -n +2 | wc -l | tr -d ' ' || echo "?")
  echo "  Outdated packages: $outdated_count (run 'npm outdated' for details)"

  # Check for security vulnerabilities
  vuln_count=$(cd "$DIR" && npm audit --json 2>/dev/null | grep -o '"total":[0-9]*' | head -1 | cut -d: -f2 || echo "?")
  echo "  Known vulnerabilities: ${vuln_count:-?} (run 'npm audit' for details)"
fi
echo ""

# 5. Summary
echo "=== Summary ==="
echo "  Debt markers:    $total_markers"
echo "  Console logs:    ${console_logs:-0}"
echo "  Empty catches:   ${empty_catches:-0}"
echo ""
echo "Priority: Fix FIXME > HACK > WORKAROUND > TODO > TEMP > XXX"
