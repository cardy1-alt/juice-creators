#!/usr/bin/env bash
# Migration helper — run this from inside the Juice Local repo root.
# Copies all Bury Juice files into the right paths and reminds you
# of the manual steps that follow.
#
# Usage:
#   cd /path/to/juice-local
#   bash /path/to/juice-creators/bury-juice-migration/setup.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE="${SCRIPT_DIR}/files"

if [ ! -d "$SOURCE" ]; then
  echo "Error: $SOURCE not found. Re-clone the migration pack."
  exit 1
fi

if [ ! -f package.json ]; then
  echo "Error: no package.json in $(pwd). Run this from the Juice Local repo root."
  exit 1
fi

echo "Copying Bury Juice files into $(pwd)..."
cp -R "$SOURCE/." .

# Quick sanity check
if [ ! -f src/lib/bury-juice/surface.ts ]; then
  echo "Error: copy did not land surface.ts where expected."
  exit 1
fi

echo "✓ Files copied: $(find src/components/bury-juice src/lib/bury-juice api/bury-juice -type f | wc -l | tr -d ' ') Bury Juice files in place"
echo ""
echo "Next:"
echo "  1. Wire src/App.tsx + admin shell + index.css per README.md (Step 2)"
echo "  2. npm install lucide-react        # if Juice Local doesn't already have it"
echo "  3. Paste .env.juice-local into Vercel env (Step 3)"
echo "  4. Register second Stripe webhook for the new URL (Step 5)"
echo "  5. git add -A && git commit -m 'Add Bury Juice storefront' && git push"
echo ""
echo "Smoke-test checklist in README.md → Step 6."
