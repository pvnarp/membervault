#!/usr/bin/env bash
# Find complex code: long functions, deep nesting, large files, long parameter lists.
# Usage: ./complexity_check.sh [directory]

set -euo pipefail

DIR="${1:-.}"

echo "=== Code Complexity Check: $DIR ==="
echo ""

# Exclude paths
EXCLUDE="node_modules|dist|coverage|\.next|\.git|package-lock|migrations"

# 1. Long functions (50+ lines)
echo "--- Functions over 50 lines ---"
rg -n '^\s*(async\s+)?(function\s+\w+|(\w+)\s*[:=]\s*(async\s+)?\(|(\w+)\s*\([^)]*\)\s*\{|(\w+)\s*=\s*async\s*\()' "$DIR" \
  --glob '*.ts' --glob '*.tsx' \
  --glob '!node_modules/**' --glob '!dist/**' --glob '!coverage/**' \
  --glob '!*.spec.ts' --glob '!*.test.ts' --glob '!*.spec.tsx' --glob '!*.test.tsx' \
  2>/dev/null | while IFS=: read -r file line_num content; do
    if [[ -z "$file" ]]; then continue; fi
    # Count lines until next function or closing at same indent level
    total_lines=$(wc -l < "$file" 2>/dev/null || echo "0")
    remaining=$((total_lines - line_num))
    if [[ $remaining -gt 50 ]]; then
      # Simple heuristic: check if there's another function within 50 lines
      next_func=$(tail -n +"$((line_num + 1))" "$file" 2>/dev/null | head -50 | grep -n -E '^\s*(async\s+)?(function\s+\w+|(\w+)\s*[:=]\s*(async\s+)?\()' | head -1 | cut -d: -f1)
      if [[ -z "$next_func" ]] || [[ "$next_func" -gt 50 ]]; then
        rel="${file#$DIR/}"
        echo "  $rel:$line_num — $(echo "$content" | sed 's/^\s*//' | head -c 80)"
      fi
    fi
  done 2>/dev/null || true
echo ""

# 2. Deep nesting (4+ levels of indentation with braces/control flow)
echo "--- Deep nesting (4+ levels) ---"
rg -n '^\s{16,}(if|for|while|switch|try|catch|\{)' "$DIR" \
  --glob '*.ts' --glob '*.tsx' \
  --glob '!node_modules/**' --glob '!dist/**' --glob '!coverage/**' \
  --glob '!*.spec.ts' --glob '!*.test.ts' \
  2>/dev/null | while IFS=: read -r file line_num content; do
    rel="${file#$DIR/}"
    echo "  $rel:$line_num — $(echo "$content" | sed 's/^\s*//' | head -c 80)"
  done | head -20 || true
echo ""

# 3. Large files (300+ lines, excluding tests and generated)
echo "--- Large files (300+ lines) ---"
find "$DIR" -type f \( -name '*.ts' -o -name '*.tsx' \) \
  ! -name '*.spec.*' ! -name '*.test.*' ! -name '*.d.ts' \
  ! -path '*/node_modules/*' ! -path '*/dist/*' ! -path '*/coverage/*' \
  ! -path '*/migrations/*' \
  2>/dev/null | while read -r file; do
    lines=$(wc -l < "$file" | tr -d ' ')
    if [[ "$lines" -gt 300 ]]; then
      rel="${file#$DIR/}"
      echo "  $rel — $lines lines"
    fi
  done | sort -t— -k2 -rn || true
echo ""

# 4. Long parameter lists (5+ params)
echo "--- Functions with 5+ parameters ---"
rg -n '\([^)]*,[^)]*,[^)]*,[^)]*,[^)]*,' "$DIR" \
  --glob '*.ts' --glob '*.tsx' \
  --glob '!node_modules/**' --glob '!dist/**' --glob '!coverage/**' \
  --glob '!*.spec.ts' --glob '!*.test.ts' \
  --glob '!*.d.ts' \
  2>/dev/null | while IFS=: read -r file line_num content; do
    # Skip imports and type definitions
    if echo "$content" | grep -qE '^\s*(import|type|interface|from)'; then
      continue
    fi
    rel="${file#$DIR/}"
    echo "  $rel:$line_num — $(echo "$content" | sed 's/^\s*//' | head -c 100)"
  done | head -20 || true
echo ""

# 5. Files with many exports (potential god modules)
echo "--- Files with 10+ exports (potential god modules) ---"
find "$DIR" -type f -name '*.ts' \
  ! -name '*.spec.*' ! -name '*.test.*' ! -name '*.d.ts' ! -name 'index.ts' \
  ! -path '*/node_modules/*' ! -path '*/dist/*' \
  2>/dev/null | while read -r file; do
    count=$(grep -c '^\s*export ' "$file" 2>/dev/null || echo "0")
    if [[ "$count" -gt 10 ]]; then
      rel="${file#$DIR/}"
      echo "  $rel — $count exports"
    fi
  done | sort -t— -k2 -rn || true

echo ""
echo "=== Done ==="
