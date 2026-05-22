#!/usr/bin/env bash
# Scan for hardcoded secrets: API keys, passwords, tokens, private keys, connection strings.
# Usage: ./scan_secrets.sh [directory]

set -euo pipefail

DIR="${1:-.}"
FOUND=0

echo "=== Secret Scan: $DIR ==="
echo ""

# Patterns that strongly indicate hardcoded secrets
declare -a PATTERNS=(
  # API keys and tokens
  'AKIA[0-9A-Z]{16}'                          # AWS Access Key
  'sk-[a-zA-Z0-9]{20,}'                       # OpenAI / Stripe secret key
  'sk_live_[a-zA-Z0-9]+'                      # Stripe live key
  'ghp_[a-zA-Z0-9]{36}'                       # GitHub personal access token
  'gho_[a-zA-Z0-9]{36}'                       # GitHub OAuth token
  'glpat-[a-zA-Z0-9\-]{20}'                   # GitLab personal access token
  'xox[bpors]-[a-zA-Z0-9\-]+'                 # Slack tokens
  're_[a-zA-Z0-9]{20,}'                       # Resend API key

  # Private keys
  '-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----'
  '-----BEGIN PGP PRIVATE KEY BLOCK-----'

  # Connection strings with credentials
  'postgres(ql)?://[^:]+:[^@]+@'              # PostgreSQL with password
  'mysql://[^:]+:[^@]+@'                      # MySQL with password
  'mongodb(\+srv)?://[^:]+:[^@]+@'            # MongoDB with password
  'redis://:[^@]+@'                           # Redis with password

  # Generic password/secret assignments
  'password\s*[:=]\s*["\x27][^"\x27]{8,}'     # password = "..."
  'secret\s*[:=]\s*["\x27][^"\x27]{8,}'       # secret = "..."
  'api[_-]?key\s*[:=]\s*["\x27][^"\x27]{8,}'  # api_key = "..."
  'token\s*[:=]\s*["\x27][^"\x27]{16,}'       # token = "..." (long values)

  # JWT tokens
  'eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.'
)

# Exclude patterns (test data, examples, env templates)
EXCLUDE_ARGS=(
  --glob '!node_modules/**'
  --glob '!.git/**'
  --glob '!dist/**'
  --glob '!coverage/**'
  --glob '!*.lock'
  --glob '!package-lock.json'
  --glob '!*.png' --glob '!*.jpg' --glob '!*.gif' --glob '!*.ico'
  --glob '!*.woff' --glob '!*.woff2' --glob '!*.ttf'
)

for pattern in "${PATTERNS[@]}"; do
  results=$(rg -n -i "${EXCLUDE_ARGS[@]}" "$pattern" "$DIR" 2>/dev/null || true)
  if [[ -n "$results" ]]; then
    # Filter out likely false positives: .env.example, test fixtures, comments explaining format
    filtered=$(echo "$results" | grep -v -E '\.env\.example|\.env\.sample|\.env\.template|placeholder|your[-_]|change[-_]me|generate[-_]|example\.com|example\.org|TODO|FIXME' || true)
    if [[ -n "$filtered" ]]; then
      echo "[POTENTIAL SECRET] Pattern: $pattern"
      echo "$filtered" | head -10
      echo ""
      FOUND=$((FOUND + 1))
    fi
  fi
done

# Check for .env files that shouldn't be committed
echo "=== Checking for committed .env files ==="
env_files=$(find "$DIR" -name '.env' -o -name '.env.local' -o -name '.env.production' 2>/dev/null | grep -v node_modules || true)
if [[ -n "$env_files" ]]; then
  echo "[WARNING] Found .env files (should be in .gitignore):"
  echo "$env_files"
  FOUND=$((FOUND + 1))
else
  echo "[OK] No committed .env files found"
fi

echo ""
echo "=== Summary ==="
if [[ $FOUND -eq 0 ]]; then
  echo "[OK] No potential secrets detected"
else
  echo "[WARNING] $FOUND potential issue(s) found — review above"
fi
