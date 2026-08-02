#!/usr/bin/env bash
# Run this once from your computer (logged into GitHub) to push the full extension.
set -euo pipefail
cd "$(dirname "$0")"

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "Run from meesho-shipping-optimizer-extension folder"
  exit 1
fi

git remote set-url origin https://github.com/deepanshu207/meesho-shipping-optimizer-extension.git
git branch -M main

echo "Pushing to origin main..."
if git push -u origin main; then
  echo "Done: https://github.com/deepanshu207/meesho-shipping-optimizer-extension"
  exit 0
fi

echo ""
echo "If push was rejected (remote has README-only commit), run:"
echo "  git push -u origin main --force"
echo ""
echo "Or import without terminal: GitHub → Import repository"
echo "  Old URL: https://github.com/deepanshu207/optimize"
echo "  Branch: meesho-shipping-optimizer-extension"
