#!/usr/bin/env bash
# Build Chrome Web Store upload zip (manifest.json at zip root).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/release"
NAME="Meesho_Shipping_Cost_Optimizer_AI_-_Unlimited"
STAGE="$OUT/stage-$NAME"

if [[ ! -f "$ROOT/manifest.json" ]]; then
  echo "ERROR: $ROOT/manifest.json not found — run from extension repo root"
  exit 1
fi

echo "Building Chrome extension package from $ROOT"
rm -rf "$STAGE" "$OUT/$NAME.zip"
mkdir -p "$STAGE"

# Copy extension tree (exclude dev / web / release artifacts)
tar -cf - -C "$ROOT" \
  --exclude='release' \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='*.zip' \
  . | tar -xf - -C "$STAGE"

if [[ ! -f "$STAGE/manifest.json" ]]; then
  echo "ERROR: manifest.json missing from package"
  exit 1
fi

(
  cd "$OUT"
  zip -r -q "$NAME.zip" "stage-$NAME"
  mv "stage-$NAME" "$NAME"
)

echo ""
echo "Done."
echo "  Folder: $OUT/$NAME"
echo "  Zip:    $OUT/$NAME.zip"
ls -la "$OUT/$NAME/manifest.json" "$OUT/$NAME.zip"
