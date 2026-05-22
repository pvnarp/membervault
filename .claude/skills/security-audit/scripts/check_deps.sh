#!/usr/bin/env bash
# Run dependency audit for the project. Detects project type and runs the appropriate tool.
# Usage: ./check_deps.sh [directory]

set -euo pipefail

DIR="${1:-.}"
EXIT_CODE=0

echo "=== Dependency Audit: $DIR ==="
echo ""

# Node.js (npm)
if [[ -f "$DIR/package-lock.json" ]] || [[ -f "$DIR/package.json" ]]; then
  echo "--- npm audit ---"
  if command -v npm &>/dev/null; then
    # Run audit, capture output
    audit_output=$(cd "$DIR" && npm audit --json 2>/dev/null || true)

    # Parse counts
    critical=$(echo "$audit_output" | grep -o '"critical":[0-9]*' | head -1 | cut -d: -f2 || echo "0")
    high=$(echo "$audit_output" | grep -o '"high":[0-9]*' | head -1 | cut -d: -f2 || echo "0")
    moderate=$(echo "$audit_output" | grep -o '"moderate":[0-9]*' | head -1 | cut -d: -f2 || echo "0")
    low=$(echo "$audit_output" | grep -o '"low":[0-9]*' | head -1 | cut -d: -f2 || echo "0")

    echo "  Critical: ${critical:-0}"
    echo "  High:     ${high:-0}"
    echo "  Moderate: ${moderate:-0}"
    echo "  Low:      ${low:-0}"

    if [[ "${critical:-0}" -gt 0 ]] || [[ "${high:-0}" -gt 0 ]]; then
      EXIT_CODE=1
      echo ""
      echo "  [ACTION REQUIRED] Run 'npm audit' for details and 'npm audit fix' to auto-fix"
    fi
  else
    echo "  [SKIP] npm not found"
  fi
  echo ""

  # Check for workspaces (monorepo)
  if grep -q '"workspaces"' "$DIR/package.json" 2>/dev/null; then
    echo "--- Workspace audit ---"
    workspaces=$(cd "$DIR" && node -e "const p=require('./package.json'); const ws=p.workspaces||[]; ws.forEach(w=>console.log(w))" 2>/dev/null || true)
    for ws in $workspaces; do
      # Expand globs
      for ws_dir in $DIR/$ws; do
        if [[ -d "$ws_dir" ]] && [[ -f "$ws_dir/package.json" ]]; then
          name=$(node -e "console.log(require('$ws_dir/package.json').name || '$ws_dir')" 2>/dev/null || echo "$ws_dir")
          echo "  Workspace: $name"
        fi
      done
    done
    echo ""
  fi
fi

# Check for outdated packages
echo "--- Outdated packages ---"
if [[ -f "$DIR/package.json" ]] && command -v npm &>/dev/null; then
  outdated=$(cd "$DIR" && npm outdated --json 2>/dev/null || true)
  if [[ -n "$outdated" ]] && [[ "$outdated" != "{}" ]]; then
    major_count=$(echo "$outdated" | grep -c '"type":"major"' || echo "0")
    minor_count=$(echo "$outdated" | grep -c '"type":"minor"' || echo "0")
    patch_count=$(echo "$outdated" | grep -c '"type":"patch"' || echo "0")
    echo "  Major updates: $major_count"
    echo "  Minor updates: $minor_count"
    echo "  Patch updates: $patch_count"

    if [[ "$major_count" -gt 0 ]]; then
      echo ""
      echo "  Major version bumps (review changelogs before updating):"
      echo "$outdated" | node -e "
        const d=require('fs').readFileSync('/dev/stdin','utf8');
        try { const j=JSON.parse(d);
          Object.entries(j).forEach(([k,v])=>{
            if(v.current!==v.latest) console.log('    '+k+': '+v.current+' → '+v.latest);
          });
        } catch(e) {}
      " 2>/dev/null || echo "  Run 'npm outdated' for details"
    fi
  else
    echo "  [OK] All packages up to date"
  fi
fi

echo ""
echo "=== Done ==="
exit $EXIT_CODE
