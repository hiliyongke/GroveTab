#!/usr/bin/env bash
# verify.sh — Run all verification steps for GroveTab
# Usage: ./scripts/verify.sh

set -euo pipefail

# ── Colors ──────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
RESET='\033[0m'

# ── Counters ────────────────────────────────────────────────────────────
PASS=0
FAIL=0
RESULTS=()

# ── Helpers ─────────────────────────────────────────────────────────────
step() {
  echo ""
  echo -e "${BOLD}════════════════════════════════════════════════════════════${RESET}"
  echo -e "${BOLD}  $1${RESET}"
  echo -e "${BOLD}════════════════════════════════════════════════════════════${RESET}"
}

record() {
  local name="$1" ok="$2"
  if [ "$ok" -eq 0 ]; then
    RESULTS+=("${GREEN}PASS${RESET}  $name")
    PASS=$((PASS + 1))
  else
    RESULTS+=("${RED}FAIL${RESET}  $name")
    FAIL=$((FAIL + 1))
  fi
}

# ── Pre-flight ──────────────────────────────────────────────────────────
cd "$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"

echo -e "${YELLOW}GroveTab Verification${RESET}"
echo -e "Working tree: $(pwd)"
echo ""

# ── 1. TypeScript Type Check ───────────────────────────────────────────
step "1/4  TypeScript Type Check (tsc --noEmit)"
if pnpm run type-check; then
  record "TypeScript type check" 0
else
  record "TypeScript type check" 1
fi

# ── 2. ESLint ──────────────────────────────────────────────────────────
step "2/4  ESLint"
if pnpm run lint; then
  record "ESLint" 0
else
  record "ESLint" 1
fi

# ── 3. Unit Tests ──────────────────────────────────────────────────────
step "3/4  Unit Tests (vitest run)"
if pnpm run test; then
  record "Unit tests" 0
else
  record "Unit tests" 1
fi

# ── 4. Build ───────────────────────────────────────────────────────────
step "4/4  Build (pnpm build)"
if pnpm run build; then
  record "Build" 0
else
  record "Build" 1
fi

# ── Summary ────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}════════════════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}  Summary${RESET}"
echo -e "${BOLD}════════════════════════════════════════════════════════════${RESET}"
for r in "${RESULTS[@]}"; do
  echo -e "  $r"
done
echo ""
TOTAL=$((PASS + FAIL))
echo -e "  Total: ${TOTAL}  |  ${GREEN}Passed: ${PASS}${RESET}  |  ${RED}Failed: ${FAIL}${RESET}"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo -e "${RED}${BOLD}✗ Verification failed.${RESET}"
  exit 1
else
  echo -e "${GREEN}${BOLD}✓ All checks passed!${RESET}"
  exit 0
fi
