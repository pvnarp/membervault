#!/usr/bin/env bash
# List dependencies with current vs latest versions and highlight major bumps.
# Usage: ./dep_age.sh [directory]

set -euo pipefail

DIR="${1:-.}"

echo "=== Dependency Age Report: $DIR ==="
echo ""

if [[ ! -f "$DIR/package.json" ]]; then
  echo "No package.json found in $DIR"
  exit 1
fi

if ! command -v npm &>/dev/null; then
  echo "npm not found"
  exit 1
fi

# Run npm outdated and format output
echo "--- Root workspace ---"
cd "$DIR"
npm outdated 2>/dev/null || true
echo ""

# Check workspaces
if grep -q '"workspaces"' "$DIR/package.json" 2>/dev/null; then
  # Get workspace directories
  workspace_dirs=$(node -e "
    const pkg = require('./package.json');
    const ws = pkg.workspaces || [];
    const glob = require('path');
    ws.forEach(w => {
      // Simple glob expansion for patterns like 'apps/*'
      if (w.includes('*')) {
        const fs = require('fs');
        const base = w.replace('/*', '');
        try {
          fs.readdirSync(base).forEach(d => {
            const full = base + '/' + d;
            if (fs.existsSync(full + '/package.json')) console.log(full);
          });
        } catch(e) {}
      } else {
        console.log(w);
      }
    });
  " 2>/dev/null || true)

  for ws_dir in $workspace_dirs; do
    if [[ -d "$DIR/$ws_dir" ]] && [[ -f "$DIR/$ws_dir/package.json" ]]; then
      name=$(node -e "console.log(require('./$ws_dir/package.json').name || '$ws_dir')" 2>/dev/null || echo "$ws_dir")
      echo "--- $name ($ws_dir) ---"
      cd "$DIR/$ws_dir"
      npm outdated 2>/dev/null || true
      cd "$DIR"
      echo ""
    fi
  done
fi

# Security summary
echo "--- Security Audit ---"
cd "$DIR"
npm audit --omit=dev 2>/dev/null | tail -5 || echo "Run 'npm audit' for details"
echo ""

echo "=== Risk Guide ==="
echo "  Patch (1.0.x): Safe to update — bug fixes only"
echo "  Minor (1.x.0): Usually safe — new features, no breaking changes"
echo "  Major (x.0.0): Review changelog — may have breaking changes"
echo ""
echo "Update order: security fixes > patch > minor > major"
