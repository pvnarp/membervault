#!/usr/bin/env bash
# Find source files that have no corresponding test file.
# Usage: ./coverage_gaps.sh [directory]

set -euo pipefail

DIR="${1:-.}"
MISSING=0
TOTAL=0

echo "=== Test Coverage Gaps: $DIR ==="
echo ""

# Find all TypeScript/JavaScript source files, excluding test files, configs, and generated code
find_sources() {
  local search_dir="$1"
  find "$search_dir" \
    -type f \( -name '*.ts' -o -name '*.tsx' \) \
    ! -name '*.spec.ts' \
    ! -name '*.spec.tsx' \
    ! -name '*.test.ts' \
    ! -name '*.test.tsx' \
    ! -name '*.d.ts' \
    ! -name '*.config.*' \
    ! -name 'vite-env.d.ts' \
    ! -name 'main.ts' \
    ! -name 'main.tsx' \
    ! -name 'index.ts' \
    ! -name 'index.tsx' \
    ! -path '*/node_modules/*' \
    ! -path '*/dist/*' \
    ! -path '*/coverage/*' \
    ! -path '*/.next/*' \
    ! -path '*/generated/*' \
    ! -path '*/prisma/migrations/*' \
    ! -path '*/test/*' \
    ! -path '*/__mocks__/*' \
    2>/dev/null | sort
}

# Check if a test file exists for a given source file
has_test() {
  local src="$1"
  local dir=$(dirname "$src")
  local base=$(basename "$src" | sed -E 's/\.(ts|tsx)$//')

  # Check co-located: file.spec.ts, file.test.ts, file.spec.tsx, file.test.tsx
  for ext in spec.ts test.ts spec.tsx test.tsx; do
    if [[ -f "$dir/$base.$ext" ]]; then
      return 0
    fi
  done

  # Check __tests__ directory
  if [[ -f "$dir/__tests__/$base.spec.ts" ]] || \
     [[ -f "$dir/__tests__/$base.test.ts" ]] || \
     [[ -f "$dir/__tests__/$base.spec.tsx" ]] || \
     [[ -f "$dir/__tests__/$base.test.tsx" ]]; then
    return 0
  fi

  return 1
}

# Skip files that typically don't need direct unit tests
should_skip() {
  local file="$1"
  local base=$(basename "$file")

  # Module files (NestJS), type definitions, constants, configs
  case "$base" in
    *.module.ts|*.dto.ts|*.entity.ts|*.interface.ts|*.types.ts|*.enum.ts|*.constants.ts)
      return 0 ;;
  esac

  # Barrel exports
  if [[ "$base" == "index.ts" ]] || [[ "$base" == "index.tsx" ]]; then
    return 0
  fi

  return 1
}

# Process each workspace
for workspace in apps/backend apps/frontend packages/shared-types; do
  ws_path="$DIR/$workspace"
  if [[ ! -d "$ws_path" ]]; then
    continue
  fi

  ws_missing=0
  ws_total=0
  ws_files=""

  while IFS= read -r file; do
    if should_skip "$file"; then
      continue
    fi

    ws_total=$((ws_total + 1))
    TOTAL=$((TOTAL + 1))

    if ! has_test "$file"; then
      rel_path="${file#$DIR/}"
      ws_files="${ws_files}\n  $rel_path"
      ws_missing=$((ws_missing + 1))
      MISSING=$((MISSING + 1))
    fi
  done < <(find_sources "$ws_path")

  if [[ $ws_total -gt 0 ]]; then
    covered=$((ws_total - ws_missing))
    pct=$((covered * 100 / ws_total))
    echo "--- $workspace ($covered/$ws_total files have tests, ${pct}%) ---"
    if [[ $ws_missing -gt 0 ]]; then
      echo -e "$ws_files"
    else
      echo "  [OK] All testable files have corresponding tests"
    fi
    echo ""
  fi
done

echo "=== Summary ==="
if [[ $TOTAL -gt 0 ]]; then
  covered=$((TOTAL - MISSING))
  pct=$((covered * 100 / TOTAL))
  echo "Files with tests: $covered / $TOTAL (${pct}%)"
  echo "Missing tests:    $MISSING"
else
  echo "No source files found"
fi
